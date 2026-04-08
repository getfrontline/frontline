// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {FrontlineReputation} from "./FrontlineReputation.sol";

/// @title FrontlinePool — Liquidity pool, BNPL settlement, and repayment engine
///
/// Fee & yield model
/// -----------------
///   Revenue sources:
///     1. Merchant BNPL fee (2%) — charged on gross order at settlement.
///     2. Late repayment fee (5% of principal) — charged when payer repays
///        after the 7-day window closes.
///
///   Revenue split:
///     - LP_SHARE_BPS (70%) → distributed to LPs (increases their redeemable
///       balance proportional to their stake at the moment fees arrive).
///     - PROTOCOL_SHARE_BPS (30%) → held for the protocol treasury, withdrawable
///       by the owner.
///
///   LP APR is emergent: it depends on transaction volume and late-fee frequency.
///   A view helper `lpPendingYield(address)` lets the frontend show accumulated
///   yield before the LP claims it.
contract FrontlinePool {
    // ------------------------------------------------------------------ types

    struct BnplLoan {
        address payer;
        uint256 principal;
        uint256 repaid;
        uint256 lateFeeCharged;
        uint64 openedAt;
        uint64 dueAt;
        bool closed;
    }

    struct MerchantInfo {
        string name;
        string category;
        bool active;
    }

    struct ProductInfo {
        address merchant;
        string name;
        uint256 price; // FLT base-unit price (8 decimals)
        bool active;
    }

    struct MerchantPayout {
        address merchant;
        uint256 grossAmount;
        uint256 feeAmount;
        uint256 netAmount;
    }

    // ------------------------------------------------------------ constants

    uint256 public constant BNPL_FEE_BPS = 200; // 2 %
    uint256 public constant LATE_FEE_BPS = 500; // 5 %
    uint256 public constant LP_SHARE_BPS = 7_000; // 70 % of fees → LPs
    uint256 public constant PROTOCOL_SHARE_BPS = 3_000; // 30 % of fees → treasury
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant REPAYMENT_WINDOW = 7 days;

    // -------------------------------------------------------------- storage

    IERC20 public immutable token;
    address public owner;
    FrontlineReputation public reputation;

    // --- LP accounting (share-based) ---
    uint256 public totalStaked; // sum of LP deposits (principal only)
    mapping(address => uint256) public stakes;

    /// @dev Accumulated yield per 1e18 units of stake. Increases every time
    ///      fee revenue is distributed to LPs.
    uint256 public yieldPerStake;
    /// @dev Snapshot of yieldPerStake at the time of each LP's last action.
    mapping(address => uint256) internal _lpYieldSnapshot;
    /// @dev Uncollected yield that has accrued since the LP's last snapshot.
    mapping(address => uint256) internal _lpPendingYield;

    // --- Outstanding / fees ---
    uint256 public totalOutstanding;
    uint256 public totalFeesCollected;
    uint256 public totalLateFees;
    uint256 public protocolTreasury;

    // --- Loans ---
    uint256 public nextLoanId;
    mapping(uint256 => BnplLoan) public loans;
    mapping(uint256 => MerchantPayout[]) internal _loanPayouts;

    // --- Merchants & products ---
    mapping(address => bool) public registeredMerchants;
    mapping(address => MerchantInfo) public merchantInfo;
    mapping(address => uint256) public merchantBalances;
    address[] public merchantList;

    uint256 public nextProductId;
    mapping(uint256 => ProductInfo) public products;
    uint256[] public productIdList;

    // -------------------------------------------------------------- events

    event MerchantRegistered(address indexed merchant, string name, string category);
    event MerchantUpdated(address indexed merchant, string name, string category);
    event ProductAdded(uint256 indexed productId, address indexed merchant, string name, uint256 price);
    event Staked(address indexed lp, uint256 amount, uint256 newStake);
    event Unstaked(address indexed lp, uint256 amount, uint256 newStake);
    event YieldClaimed(address indexed lp, uint256 amount);
    event BnplOpened(uint256 indexed loanId, address indexed payer, uint256 principal, uint64 dueAt);
    event MerchantSettled(uint256 indexed loanId, address indexed merchant, uint256 net, uint256 fee);
    event Repaid(uint256 indexed loanId, uint256 amount, uint256 lateFee, bool closed);
    event MerchantWithdrew(address indexed merchant, uint256 amount);
    event TreasuryWithdrew(address indexed to, uint256 amount);

    // ----------------------------------------------------------- modifiers

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // --------------------------------------------------------- constructor

    constructor(address _token) {
        token = IERC20(_token);
        owner = msg.sender;
    }

    /// @notice Set the reputation contract address so repay() can auto-record.
    function setReputation(address _reputation) external onlyOwner {
        reputation = FrontlineReputation(_reputation);
    }

    // ------------------------------------------------------ merchant self-service

    /// @notice Anyone can register themselves as a merchant.
    function registerMerchant(string calldata name, string calldata category) external {
        require(!registeredMerchants[msg.sender], "already registered");
        require(bytes(name).length > 0, "empty name");
        registeredMerchants[msg.sender] = true;
        merchantInfo[msg.sender] = MerchantInfo({name: name, category: category, active: true});
        merchantList.push(msg.sender);
        emit MerchantRegistered(msg.sender, name, category);
    }

    /// @notice Merchant can update their own name and category.
    function updateMerchant(string calldata name, string calldata category) external {
        require(registeredMerchants[msg.sender], "not registered");
        require(bytes(name).length > 0, "empty name");
        merchantInfo[msg.sender].name = name;
        merchantInfo[msg.sender].category = category;
        emit MerchantUpdated(msg.sender, name, category);
    }

    /// @notice Owner can also register a merchant on behalf of an address.
    function registerMerchantFor(address merchant, string calldata name, string calldata category) external onlyOwner {
        require(!registeredMerchants[merchant], "already registered");
        require(bytes(name).length > 0, "empty name");
        registeredMerchants[merchant] = true;
        merchantInfo[merchant] = MerchantInfo({name: name, category: category, active: true});
        merchantList.push(merchant);
        emit MerchantRegistered(merchant, name, category);
    }

    function addProduct(address merchant, string calldata name, uint256 price) external returns (uint256 pid) {
        require(msg.sender == owner || msg.sender == merchant, "not authorized");
        require(registeredMerchants[merchant], "unregistered merchant");
        require(price > 0, "zero price");
        pid = nextProductId++;
        products[pid] = ProductInfo({merchant: merchant, name: name, price: price, active: true});
        productIdList.push(pid);
        emit ProductAdded(pid, merchant, name, price);
    }

    function merchantCount() external view returns (uint256) {
        return merchantList.length;
    }

    function productCount() external view returns (uint256) {
        return productIdList.length;
    }

    // ============================================================ LP FLOW

    function stake(uint256 amount) external {
        require(amount > 0, "zero amount");
        _updateLpYield(msg.sender);
        token.transferFrom(msg.sender, address(this), amount);
        stakes[msg.sender] += amount;
        totalStaked += amount;
        emit Staked(msg.sender, amount, stakes[msg.sender]);
    }

    function unstake(uint256 amount) external {
        require(amount > 0 && amount <= stakes[msg.sender], "bad amount");
        uint256 available = totalStaked - totalOutstanding;
        require(amount <= available, "liquidity locked");
        _updateLpYield(msg.sender);
        stakes[msg.sender] -= amount;
        totalStaked -= amount;
        token.transfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount, stakes[msg.sender]);
    }

    /// @notice Claim accumulated yield from pool fees.
    function claimYield() external {
        _updateLpYield(msg.sender);
        uint256 pending = _lpPendingYield[msg.sender];
        require(pending > 0, "no yield");
        _lpPendingYield[msg.sender] = 0;
        token.transfer(msg.sender, pending);
        emit YieldClaimed(msg.sender, pending);
    }

    /// @notice View: how much yield an LP can claim right now.
    function lpPendingYield(address lp) external view returns (uint256) {
        uint256 stk = stakes[lp];
        if (stk == 0) return _lpPendingYield[lp];
        uint256 newYield = (stk * (yieldPerStake - _lpYieldSnapshot[lp])) / 1e18;
        return _lpPendingYield[lp] + newYield;
    }

    // ============================================================ BNPL FLOW

    /// @notice Open a BNPL line: instantly pays merchants from the pool.
    /// @param merchants  Destination addresses (must be registered).
    /// @param amounts    Gross amounts per merchant (before fee deduction).
    function openBnpl(address[] calldata merchants, uint256[] calldata amounts) external returns (uint256 loanId) {
        require(merchants.length > 0 && merchants.length == amounts.length, "bad input");

        uint256 totalGross;
        for (uint256 i; i < amounts.length; i++) {
            require(registeredMerchants[merchants[i]], "unregistered merchant");
            require(amounts[i] > 0, "zero line");
            totalGross += amounts[i];
        }

        uint256 available = totalStaked - totalOutstanding;
        require(totalGross <= available, "insufficient pool liquidity");

        loanId = nextLoanId++;
        uint64 dueAt = uint64(block.timestamp) + uint64(REPAYMENT_WINDOW);
        loans[loanId] = BnplLoan({
            payer: msg.sender,
            principal: totalGross,
            repaid: 0,
            lateFeeCharged: 0,
            openedAt: uint64(block.timestamp),
            dueAt: dueAt,
            closed: false
        });
        totalOutstanding += totalGross;

        uint256 orderFees;
        for (uint256 i; i < merchants.length; i++) {
            uint256 fee = (amounts[i] * BNPL_FEE_BPS) / BPS_DENOMINATOR;
            uint256 net = amounts[i] - fee;
            orderFees += fee;
            merchantBalances[merchants[i]] += net;
            _loanPayouts[loanId].push(
                MerchantPayout({merchant: merchants[i], grossAmount: amounts[i], feeAmount: fee, netAmount: net})
            );
            emit MerchantSettled(loanId, merchants[i], net, fee);
        }

        _distributeFees(orderFees);
        totalFeesCollected += orderFees;

        emit BnplOpened(loanId, msg.sender, totalGross, dueAt);
    }

    // ============================================================ REPAYMENT

    function repay(uint256 loanId, uint256 amount) external {
        BnplLoan storage loan = loans[loanId];
        require(!loan.closed, "already closed");
        require(amount > 0, "zero amount");

        uint256 remaining = loan.principal - loan.repaid;
        if (amount > remaining) amount = remaining;

        // Late fee: applied once per loan, on first repayment after dueAt
        uint256 lateFee;
        if (block.timestamp > loan.dueAt && loan.lateFeeCharged == 0) {
            lateFee = (loan.principal * LATE_FEE_BPS) / BPS_DENOMINATOR;
            loan.lateFeeCharged = lateFee;
            totalLateFees += lateFee;
            _distributeFees(lateFee);
        }

        uint256 totalPull = amount + lateFee;
        token.transferFrom(msg.sender, address(this), totalPull);

        loan.repaid += amount;
        totalOutstanding -= amount;

        bool closed = loan.repaid >= loan.principal;
        if (closed) {
            loan.closed = true;
            if (address(reputation) != address(0)) {
                bool onTime = loan.lateFeeCharged == 0;
                reputation.recordRepayment(loan.payer, loanId, onTime);
            }
        }

        emit Repaid(loanId, amount, lateFee, closed);
    }

    // ============================================================ MERCHANT

    function merchantWithdraw(uint256 amount) external {
        require(registeredMerchants[msg.sender], "not merchant");
        require(amount > 0 && amount <= merchantBalances[msg.sender], "bad amount");
        merchantBalances[msg.sender] -= amount;
        token.transfer(msg.sender, amount);
        emit MerchantWithdrew(msg.sender, amount);
    }

    // ============================================================ TREASURY

    function withdrawTreasury(address to, uint256 amount) external onlyOwner {
        require(amount > 0 && amount <= protocolTreasury, "bad amount");
        protocolTreasury -= amount;
        token.transfer(to, amount);
        emit TreasuryWithdrew(to, amount);
    }

    // ============================================================ VIEWS

    function loanPayouts(uint256 loanId) external view returns (MerchantPayout[] memory) {
        return _loanPayouts[loanId];
    }

    function poolUtilizationBps() external view returns (uint256) {
        if (totalStaked == 0) return 0;
        return (totalOutstanding * BPS_DENOMINATOR) / totalStaked;
    }

    function availableLiquidity() external view returns (uint256) {
        return totalStaked - totalOutstanding;
    }

    // ============================================================ INTERNAL

    /// @dev Split fee revenue between LP yield pool and protocol treasury.
    function _distributeFees(uint256 totalFee) internal {
        if (totalFee == 0) return;
        uint256 lpCut = (totalFee * LP_SHARE_BPS) / BPS_DENOMINATOR;
        uint256 protocolCut = totalFee - lpCut;
        protocolTreasury += protocolCut;
        if (totalStaked > 0 && lpCut > 0) {
            yieldPerStake += (lpCut * 1e18) / totalStaked;
        } else {
            // No LPs → all goes to treasury
            protocolTreasury += lpCut;
        }
    }

    /// @dev Checkpoint an LP's accumulated yield before changing their stake.
    function _updateLpYield(address lp) internal {
        uint256 stk = stakes[lp];
        if (stk > 0) {
            uint256 delta = yieldPerStake - _lpYieldSnapshot[lp];
            if (delta > 0) {
                _lpPendingYield[lp] += (stk * delta) / 1e18;
            }
        }
        _lpYieldSnapshot[lp] = yieldPerStake;
    }
}
