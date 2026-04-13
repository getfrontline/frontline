// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FrontlineToken} from "./FrontlineToken.sol";

/// @title FrontlineBondingCurve
/// @notice Mainnet-oriented issuance path for FLT. The curve mints a one-time
///         launch inventory of 1,000,000,000 FLT to itself, supports an
///         owner-controlled bootstrap allocation for initial protocol seeding,
///         then sells and buys back against native HBAR using an exponential
///         liquidity curve.
contract FrontlineBondingCurve {
    uint256 public constant WAD = 1e18;
    uint256 public constant TOKEN_SCALE = 1e8;
    uint256 public constant INITIAL_LAUNCH_SUPPLY = 1_000_000_000 * TOKEN_SCALE;
    uint256 internal constant MAX_EXPONENT_WAD = 8e18;
    uint256 internal constant RANGE_REDUCTION_THRESHOLD_WAD = 5e17;
    uint256 internal constant MAX_TAYLOR_TERMS = 16;

    FrontlineToken public immutable token;
    address public owner;
    uint256 public immutable basePricePerTokenWei;
    uint256 public immutable curveSteepnessWad;

    bool public curveActive;
    bool public bootstrapDistributed;
    uint256 private _locked = 1;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event CurveActivated(uint256 tokenLiquidity);
    event BootstrapAllocated(address indexed recipient, uint256 tokenAmount);
    event TokensPurchased(
        address indexed buyer, address indexed recipient, uint256 tokenAmount, uint256 costWei, uint256 refundWei
    );
    event TokensSold(address indexed seller, address indexed recipient, uint256 tokenAmount, uint256 payoutWei);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier nonReentrant() {
        require(_locked == 1, "reentrant");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address tokenAddress, uint256 initialBasePricePerTokenWei, uint256 initialCurveSteepnessWad) {
        require(tokenAddress != address(0), "zero token");
        require(initialBasePricePerTokenWei > 0, "base price too low");
        require(initialCurveSteepnessWad > 0, "zero steepness");
        require(initialCurveSteepnessWad <= MAX_EXPONENT_WAD, "steepness too high");

        token = FrontlineToken(tokenAddress);
        owner = msg.sender;
        basePricePerTokenWei = initialBasePricePerTokenWei;
        curveSteepnessWad = initialCurveSteepnessWad;

        emit OwnershipTransferred(address(0), msg.sender);
    }

    function activateCurve() external onlyOwner {
        require(!curveActive, "curve active");
        token.mint(address(this), INITIAL_LAUNCH_SUPPLY);
        curveActive = true;
        emit CurveActivated(INITIAL_LAUNCH_SUPPLY);
    }

    function bootstrapAllocation(address recipient, uint256 tokenAmount) external onlyOwner {
        require(curveActive, "curve inactive");
        require(!bootstrapDistributed, "bootstrap done");
        require(recipient != address(0), "zero recipient");
        require(tokenAmount > 0, "zero amount");
        require(tokenAmount <= currentLiquidity(), "insufficient curve liquidity");

        bootstrapDistributed = true;
        require(token.transfer(recipient, tokenAmount), "token transfer failed");

        emit BootstrapAllocated(recipient, tokenAmount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function currentLiquidity() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function soldSupply() public view returns (uint256) {
        return INITIAL_LAUNCH_SUPPLY - currentLiquidity();
    }

    function spotPricePerTokenWei() external view returns (uint256) {
        if (!curveActive) return basePricePerTokenWei;
        uint256 exponent = _curveExponentWad(soldSupply());
        return _mulDiv(basePricePerTokenWei, _expWad(exponent), WAD);
    }

    function spotPricePerUnitWei() public view returns (uint256) {
        if (!curveActive) return _mulDiv(basePricePerTokenWei, 1, TOKEN_SCALE);
        uint256 exponent = _curveExponentWad(soldSupply());
        return _mulDiv(basePricePerTokenWei, _expWad(exponent), WAD * TOKEN_SCALE);
    }

    function quoteBuyExactTokens(uint256 tokenAmount) public view returns (uint256) {
        require(curveActive, "curve inactive");
        require(tokenAmount > 0, "zero amount");

        uint256 liquidity = currentLiquidity();
        require(tokenAmount <= liquidity, "insufficient curve liquidity");

        uint256 soldBefore = INITIAL_LAUNCH_SUPPLY - liquidity;
        return _integralCost(soldBefore, soldBefore + tokenAmount);
    }

    function quoteSellExactTokens(uint256 tokenAmount) public view returns (uint256) {
        require(curveActive, "curve inactive");
        require(tokenAmount > 0, "zero amount");

        uint256 soldBefore = soldSupply();
        require(tokenAmount <= soldBefore, "sell exceeds circulating");
        return _integralCost(soldBefore - tokenAmount, soldBefore);
    }

    function buyExactTokens(uint256 tokenAmount, uint256 maxCostWei, address recipient)
        external
        payable
        nonReentrant
        returns (uint256 costWei)
    {
        require(recipient != address(0), "zero recipient");
        costWei = quoteBuyExactTokens(tokenAmount);
        require(costWei <= maxCostWei, "slippage");
        require(msg.value >= costWei, "insufficient payment");

        require(token.transfer(recipient, tokenAmount), "token transfer failed");

        uint256 refundWei = msg.value - costWei;
        if (refundWei > 0) {
            (bool refunded,) = payable(msg.sender).call{value: refundWei}("");
            require(refunded, "refund failed");
        }

        emit TokensPurchased(msg.sender, recipient, tokenAmount, costWei, refundWei);
    }

    function sellExactTokens(uint256 tokenAmount, uint256 minPayoutWei, address payable recipient)
        external
        nonReentrant
        returns (uint256 payoutWei)
    {
        require(recipient != address(0), "zero recipient");
        payoutWei = quoteSellExactTokens(tokenAmount);
        require(payoutWei >= minPayoutWei, "slippage");
        require(address(this).balance >= payoutWei, "insufficient reserve");

        require(token.transferFrom(msg.sender, address(this), tokenAmount), "token transfer failed");
        (bool sent,) = recipient.call{value: payoutWei}("");
        require(sent, "payout failed");

        emit TokensSold(msg.sender, recipient, tokenAmount, payoutWei);
    }

    function _integralCost(uint256 soldFrom, uint256 soldTo) internal view returns (uint256) {
        uint256 fromExp = _expWad(_curveExponentWad(soldFrom));
        uint256 toExp = _expWad(_curveExponentWad(soldTo));
        uint256 liquidityScaledPrice = _mulDiv(basePricePerTokenWei, INITIAL_LAUNCH_SUPPLY, TOKEN_SCALE);
        return _mulDiv(liquidityScaledPrice, toExp - fromExp, curveSteepnessWad);
    }

    function _curveExponentWad(uint256 soldAmount) internal view returns (uint256) {
        return (soldAmount * curveSteepnessWad) / INITIAL_LAUNCH_SUPPLY;
    }

    /// @dev Positive-only wad exponent with range reduction. Halving the
    ///      exponent before the Taylor evaluation keeps the approximation stable
    ///      across the configured launch range, then repeated squaring rebuilds
    ///      the original value.
    function _expWad(uint256 xWad) internal pure returns (uint256 result) {
        require(xWad <= MAX_EXPONENT_WAD, "exponent too high");

        uint256 reduced = xWad;
        uint256 halvings;
        while (reduced > RANGE_REDUCTION_THRESHOLD_WAD) {
            reduced /= 2;
            halvings++;
        }

        result = _expTaylorWad(reduced);
        for (uint256 i; i < halvings; i++) {
            result = _mulDiv(result, result, WAD);
        }
    }

    function _expTaylorWad(uint256 xWad) internal pure returns (uint256 result) {
        result = WAD;
        uint256 term = WAD;

        for (uint256 i = 1; i <= MAX_TAYLOR_TERMS; i++) {
            term = _mulDiv(term, xWad, WAD * i);
            if (term == 0) break;
            result += term;
        }
    }

    /// @dev 512-bit multiply/divide adapted for pricing math so large
    ///      configuration values do not silently overflow intermediate products.
    function _mulDiv(uint256 x, uint256 y, uint256 denominator) internal pure returns (uint256 result) {
        require(denominator > 0, "zero denominator");

        uint256 prod0;
        uint256 prod1;
        assembly {
            let mm := mulmod(x, y, not(0))
            prod0 := mul(x, y)
            prod1 := sub(sub(mm, prod0), lt(mm, prod0))
        }

        if (prod1 == 0) {
            return prod0 / denominator;
        }

        require(denominator > prod1, "mulDiv overflow");

        uint256 remainder;
        assembly {
            remainder := mulmod(x, y, denominator)
            prod1 := sub(prod1, gt(remainder, prod0))
            prod0 := sub(prod0, remainder)
        }

        uint256 twos = denominator & (~denominator + 1);
        assembly {
            denominator := div(denominator, twos)
            prod0 := div(prod0, twos)
            twos := add(div(sub(0, twos), twos), 1)
        }

        prod0 |= prod1 * twos;

        uint256 inverse = (3 * denominator) ^ 2;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;
        inverse *= 2 - denominator * inverse;

        result = prod0 * inverse;
    }
}
