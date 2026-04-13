// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FrontlineBondingCurve} from "../src/FrontlineBondingCurve.sol";
import {FrontlineToken} from "../src/FrontlineToken.sol";

contract FrontlineBondingCurveTest is Test {
    uint256 internal constant BASE_PRICE_PER_TOKEN_WEI = 0.00002 ether;
    uint256 internal constant CURVE_STEEPNESS_WAD = 2e18;
    uint256 internal constant LAUNCH_SUPPLY = 1_000_000_000e8;

    FrontlineToken flt;
    FrontlineBondingCurve curve;

    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");

    function setUp() public {
        flt = new FrontlineToken();
        curve = new FrontlineBondingCurve(address(flt), BASE_PRICE_PER_TOKEN_WEI, CURVE_STEEPNESS_WAD);
        flt.setAuthorizedMinter(address(curve), true);
    }

    function _buyTokens(address account, uint256 tokenAmount) internal returns (uint256 quote) {
        quote = curve.quoteBuyExactTokens(tokenAmount);
        vm.deal(account, account.balance + quote + 10 ether);
        vm.prank(account);
        curve.buyExactTokens{value: quote}(tokenAmount, quote, account);
    }

    function test_activateCurve_mintsLaunchLiquidity() public {
        curve.activateCurve();

        assertTrue(curve.curveActive());
        assertEq(flt.totalSupply(), LAUNCH_SUPPLY);
        assertEq(flt.balanceOf(address(curve)), LAUNCH_SUPPLY);
    }

    function test_bootstrapAllocation_transfersInitialPoolTokens() public {
        curve.activateCurve();
        curve.bootstrapAllocation(address(this), 10_000_000e8);

        assertTrue(curve.bootstrapDistributed());
        assertEq(flt.balanceOf(address(this)), 10_000_000e8);
        assertEq(curve.currentLiquidity(), LAUNCH_SUPPLY - 10_000_000e8);
    }

    function test_RevertWhen_unauthorizedMint() public {
        vm.expectRevert("not authorized minter");
        flt.mint(address(this), 1);
    }

    function test_buyExactTokens_movesAlongExponentialCurve() public {
        curve.activateCurve();

        uint256 firstQuote = _buyTokens(buyer, 1_000e8);

        uint256 secondQuote = curve.quoteBuyExactTokens(1_000e8);
        assertGt(secondQuote, firstQuote);
        assertEq(flt.balanceOf(buyer), 1_000e8);
        assertEq(curve.currentLiquidity(), LAUNCH_SUPPLY - 1_000e8);
    }

    function test_sellExactTokens_returnsEthAndRestoresLiquidity() public {
        curve.activateCurve();

        _buyTokens(seller, 2_000e8);

        uint256 sellQuote = curve.quoteSellExactTokens(500e8);
        uint256 ethBefore = seller.balance;
        vm.startPrank(seller);
        flt.approve(address(curve), 500e8);
        curve.sellExactTokens(500e8, sellQuote, payable(seller));
        vm.stopPrank();

        assertEq(seller.balance - ethBefore, sellQuote);
        assertEq(flt.balanceOf(seller), 1_500e8);
        assertEq(curve.currentLiquidity(), LAUNCH_SUPPLY - 1_500e8);
    }

    function test_RevertWhen_buyBeforeActivation() public {
        vm.expectRevert("curve inactive");
        curve.quoteBuyExactTokens(1);
    }

    function test_stress_sequentialBuysKeepPriceMonotonic() public {
        curve.activateCurve();

        uint256 probeAmount = 250e8;
        uint256 previousProbeQuote = curve.quoteBuyExactTokens(probeAmount);
        uint256 totalBought;

        uint256[9] memory chunks =
            [uint256(100_000_000e8), 100_000_000e8, 150_000_000e8, 150_000_000e8, 150_000_000e8, 100_000_000e8, 100_000_000e8, 50_000_000e8, 50_000_000e8];

        for (uint256 i; i < chunks.length; i++) {
            totalBought += chunks[i];
            _buyTokens(buyer, chunks[i]);

            uint256 nextProbeQuote = curve.quoteBuyExactTokens(probeAmount);
            assertGt(nextProbeQuote, previousProbeQuote);
            previousProbeQuote = nextProbeQuote;
        }

        assertEq(totalBought, 950_000_000e8);
        assertEq(flt.balanceOf(buyer), totalBought);
        assertEq(curve.currentLiquidity(), LAUNCH_SUPPLY - totalBought);
    }

    function test_stress_largeRoundTripRestoresLiquidity() public {
        curve.activateCurve();

        uint256 buyAmount = 350_000_000e8;
        uint256 buyCost = _buyTokens(seller, buyAmount);
        assertEq(curve.currentLiquidity(), LAUNCH_SUPPLY - buyAmount);

        vm.startPrank(seller);
        flt.approve(address(curve), type(uint256).max);

        uint256 totalPayout;
        uint256[5] memory sellChunks = [uint256(50_000_000e8), 70_000_000e8, 80_000_000e8, 60_000_000e8, 90_000_000e8];

        for (uint256 i; i < sellChunks.length; i++) {
            uint256 sellQuote = curve.quoteSellExactTokens(sellChunks[i]);
            totalPayout += curve.sellExactTokens(sellChunks[i], sellQuote, payable(seller));
        }
        vm.stopPrank();

        assertApproxEqAbs(totalPayout, buyCost, 5);
        assertEq(flt.balanceOf(seller), 0);
        assertEq(curve.currentLiquidity(), LAUNCH_SUPPLY);
    }

    function testFuzz_sellQuoteNeverExceedsRoundTripBuyCost(uint256 tokenAmount) public {
        curve.activateCurve();

        tokenAmount = bound(tokenAmount, 1e8, 400_000_000e8);
        uint256 buyCost = _buyTokens(seller, tokenAmount);
        uint256 sellQuote = curve.quoteSellExactTokens(tokenAmount);

        assertLe(sellQuote, buyCost);
        assertApproxEqAbs(sellQuote, buyCost, 1);
    }
}
