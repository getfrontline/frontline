// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FrontlinePool} from "../src/FrontlinePool.sol";
import {FrontlineReputation} from "../src/FrontlineReputation.sol";
import {FrontlineToken} from "../src/FrontlineToken.sol";

contract FrontlinePoolTest is Test {
    FrontlineToken flt;
    FrontlinePool pool;
    FrontlineReputation rep;

    address owner = address(this);
    address lp1 = makeAddr("lp1");
    address lp2 = makeAddr("lp2");
    address payer = makeAddr("payer");
    address merNorth = makeAddr("merNorth");
    address merVolt = makeAddr("merVolt");

    function setUp() public {
        flt = new FrontlineToken();
        pool = new FrontlinePool(address(flt));
        rep = new FrontlineReputation();

        // Wire reputation into pool
        pool.setReputation(address(rep));
        rep.setAuthorizedCaller(address(pool), true);

        vm.prank(merNorth);
        pool.registerMerchant("North Supply Co.", "Outdoor");
        vm.prank(merVolt);
        pool.registerMerchant("Volt Street", "Electronics");

        flt.mint(lp1, 500_000e8);
        flt.mint(lp2, 300_000e8);
        flt.mint(payer, 100_000e8);

        vm.prank(lp1);
        flt.approve(address(pool), type(uint256).max);
        vm.prank(lp2);
        flt.approve(address(pool), type(uint256).max);
        vm.prank(payer);
        flt.approve(address(pool), type(uint256).max);
    }

    // --------------------------------------------------------- helpers

    function _openSingleLoan(uint256 amount) internal returns (uint256) {
        address[] memory m = new address[](1);
        m[0] = merNorth;
        uint256[] memory a = new uint256[](1);
        a[0] = amount;
        vm.prank(payer);
        return pool.openBnpl(m, a);
    }

    // ===================================================== Merchant & Product registration

    function test_register_merchant() public {
        (string memory name, string memory category, bool active) = pool.merchantInfo(merNorth);
        assertEq(name, "North Supply Co.");
        assertEq(category, "Outdoor");
        assertTrue(active);
        assertEq(pool.merchantCount(), 2);
    }

    function test_add_product() public {
        uint256 pid = pool.addProduct(merNorth, "Arctic 2P tent", 428e8);
        (address merchant, string memory name, uint256 price, bool active) = pool.products(pid);
        assertEq(merchant, merNorth);
        assertEq(name, "Arctic 2P tent");
        assertEq(price, 428e8);
        assertTrue(active);
        assertEq(pool.productCount(), 1);
    }

    function test_RevertWhen_duplicate_merchant() public {
        vm.prank(merNorth);
        vm.expectRevert("already registered");
        pool.registerMerchant("North Supply Co.", "Outdoor");
    }

    function test_self_register_merchant() public {
        address newMerch = makeAddr("newMerch");
        vm.prank(newMerch);
        pool.registerMerchant("New Shop", "Retail");
        assertTrue(pool.registeredMerchants(newMerch));
        (string memory name, string memory category, bool active) = pool.merchantInfo(newMerch);
        assertEq(name, "New Shop");
        assertEq(category, "Retail");
        assertTrue(active);
    }

    function test_update_merchant() public {
        vm.prank(merNorth);
        pool.updateMerchant("North Supply (updated)", "Gear");
        (string memory name, string memory category,) = pool.merchantInfo(merNorth);
        assertEq(name, "North Supply (updated)");
        assertEq(category, "Gear");
    }

    function test_RevertWhen_update_unregistered() public {
        address unknown = makeAddr("unknown");
        vm.prank(unknown);
        vm.expectRevert("not registered");
        pool.updateMerchant("X", "Y");
    }

    function test_owner_registerFor() public {
        address newMerch = makeAddr("forMerch");
        pool.registerMerchantFor(newMerch, "Owner Registered", "Admin");
        assertTrue(pool.registeredMerchants(newMerch));
    }

    function test_RevertWhen_product_unregistered_merchant() public {
        address unknown = makeAddr("unknown");
        vm.expectRevert("unregistered merchant");
        pool.addProduct(unknown, "Widget", 10e8);
    }

    function test_merchant_adds_own_product() public {
        vm.prank(merNorth);
        uint256 pid = pool.addProduct(merNorth, "Merchant Added Tent", 350e8);
        (address merchant, string memory name, uint256 price, bool active) = pool.products(pid);
        assertEq(merchant, merNorth);
        assertEq(name, "Merchant Added Tent");
        assertEq(price, 350e8);
        assertTrue(active);
    }

    function test_RevertWhen_merchant_adds_for_other() public {
        vm.prank(merVolt);
        vm.expectRevert("not authorized");
        pool.addProduct(merNorth, "Impersonated", 10e8);
    }

    // ===================================================== LP basics

    function test_stake_and_unstake() public {
        vm.prank(lp1);
        pool.stake(100_000e8);
        assertEq(pool.stakes(lp1), 100_000e8);
        assertEq(pool.totalStaked(), 100_000e8);

        vm.prank(lp1);
        pool.unstake(40_000e8);
        assertEq(pool.stakes(lp1), 60_000e8);
        assertEq(flt.balanceOf(lp1), 440_000e8);
    }

    function test_unstake_blocked_by_outstanding() public {
        vm.prank(lp1);
        pool.stake(1000e8);
        _openSingleLoan(800e8);

        vm.prank(lp1);
        vm.expectRevert("liquidity locked");
        pool.unstake(500e8);
    }

    // ===================================================== BNPL flow

    function test_bnpl_flow_two_merchants() public {
        vm.prank(lp1);
        pool.stake(200_000e8);

        address[] memory merchants = new address[](2);
        merchants[0] = merNorth;
        merchants[1] = merVolt;
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 428e8;
        amounts[1] = 129e8;

        vm.prank(payer);
        uint256 loanId = pool.openBnpl(merchants, amounts);

        (address rPayer, uint256 principal, uint256 repaid,, uint64 openedAt, uint64 dueAt, bool closed) =
            pool.loans(loanId);
        assertEq(rPayer, payer);
        assertEq(principal, 557e8);
        assertEq(repaid, 0);
        assertFalse(closed);
        assertGt(openedAt, 0);
        assertEq(dueAt, openedAt + uint64(7 days));
        assertEq(pool.totalOutstanding(), 557e8);

        uint256 feeNorth = (428e8 * 200) / 10_000;
        uint256 feeVolt = (129e8 * 200) / 10_000;
        assertEq(pool.merchantBalances(merNorth), 428e8 - feeNorth);
        assertEq(pool.merchantBalances(merVolt), 129e8 - feeVolt);
        assertEq(pool.totalFeesCollected(), feeNorth + feeVolt);
    }

    // ===================================================== Repayment

    function test_repay_on_time() public {
        vm.prank(lp1);
        pool.stake(200_000e8);
        uint256 lid = _openSingleLoan(1000e8);

        vm.prank(payer);
        pool.repay(lid, 1000e8);
        (,, uint256 repaid, uint256 lateFeeCharged,,, bool closed) = pool.loans(lid);
        assertEq(repaid, 1000e8);
        assertEq(lateFeeCharged, 0);
        assertTrue(closed);
        assertEq(pool.totalOutstanding(), 0);
    }

    function test_repay_partial_then_full() public {
        vm.prank(lp1);
        pool.stake(200_000e8);
        uint256 lid = _openSingleLoan(1000e8);

        vm.prank(payer);
        pool.repay(lid, 600e8);
        (,, uint256 repaid1,,,, bool closed1) = pool.loans(lid);
        assertEq(repaid1, 600e8);
        assertFalse(closed1);

        vm.prank(payer);
        pool.repay(lid, 500e8);
        (,, uint256 repaid2,,,, bool closed2) = pool.loans(lid);
        assertEq(repaid2, 1000e8);
        assertTrue(closed2);
    }

    // ===================================================== Late fee

    function test_late_repay_charges_fee() public {
        vm.prank(lp1);
        pool.stake(200_000e8);
        uint256 lid = _openSingleLoan(1000e8);

        vm.warp(block.timestamp + 8 days);

        uint256 payerBefore = flt.balanceOf(payer);
        vm.prank(payer);
        pool.repay(lid, 1000e8);

        uint256 expectedLateFee = (1000e8 * 500) / 10_000;
        (,, uint256 repaid, uint256 lateFeeCharged,,, bool closed) = pool.loans(lid);
        assertEq(repaid, 1000e8);
        assertEq(lateFeeCharged, expectedLateFee);
        assertTrue(closed);

        uint256 payerSpent = payerBefore - flt.balanceOf(payer);
        assertEq(payerSpent, 1000e8 + expectedLateFee);
        assertEq(pool.totalLateFees(), expectedLateFee);
    }

    function test_late_fee_charged_only_once() public {
        vm.prank(lp1);
        pool.stake(200_000e8);
        uint256 lid = _openSingleLoan(1000e8);

        vm.warp(block.timestamp + 8 days);

        vm.prank(payer);
        pool.repay(lid, 400e8);
        (,,, uint256 lf1,,,) = pool.loans(lid);
        uint256 expectedLateFee = (1000e8 * 500) / 10_000;
        assertEq(lf1, expectedLateFee);

        uint256 payerBefore = flt.balanceOf(payer);
        vm.prank(payer);
        pool.repay(lid, 600e8);
        (,,, uint256 lf2,,, bool closed) = pool.loans(lid);
        assertEq(lf2, expectedLateFee);
        assertTrue(closed);
        assertEq(payerBefore - flt.balanceOf(payer), 600e8);
    }

    // ===================================================== Fee distribution

    function test_fee_split_lp_and_treasury() public {
        vm.prank(lp1);
        pool.stake(100_000e8);

        uint256 gross = 10_000e8;
        _openSingleLoan(gross);

        uint256 bnplFee = (gross * 200) / 10_000;
        uint256 lpCut = (bnplFee * 7_000) / 10_000;
        uint256 protocolCut = bnplFee - lpCut;

        assertEq(pool.protocolTreasury(), protocolCut);
        assertEq(pool.lpPendingYield(lp1), lpCut);
    }

    function test_lp_yield_proportional_to_stake() public {
        vm.prank(lp1);
        pool.stake(75_000e8);
        vm.prank(lp2);
        pool.stake(25_000e8);

        uint256 gross = 10_000e8;
        _openSingleLoan(gross);

        uint256 bnplFee = (gross * 200) / 10_000;
        uint256 lpCut = (bnplFee * 7_000) / 10_000;

        uint256 y1 = pool.lpPendingYield(lp1);
        uint256 y2 = pool.lpPendingYield(lp2);
        assertApproxEqAbs(y1, (lpCut * 75_000e8) / 100_000e8, 1);
        assertApproxEqAbs(y2, (lpCut * 25_000e8) / 100_000e8, 1);
    }

    function test_claim_yield() public {
        vm.prank(lp1);
        pool.stake(100_000e8);
        _openSingleLoan(10_000e8);

        uint256 pending = pool.lpPendingYield(lp1);
        assertTrue(pending > 0);

        uint256 before = flt.balanceOf(lp1);
        vm.prank(lp1);
        pool.claimYield();
        assertEq(flt.balanceOf(lp1) - before, pending);
        assertEq(pool.lpPendingYield(lp1), 0);
    }

    function test_late_fee_also_splits() public {
        vm.prank(lp1);
        pool.stake(100_000e8);
        uint256 lid = _openSingleLoan(1000e8);

        vm.warp(block.timestamp + 8 days);

        uint256 treasuryBefore = pool.protocolTreasury();
        vm.prank(payer);
        pool.repay(lid, 1000e8);

        uint256 lateFee = (1000e8 * 500) / 10_000;
        uint256 lateProtocol = lateFee - (lateFee * 7_000) / 10_000;
        uint256 treasuryGain = pool.protocolTreasury() - treasuryBefore;
        assertEq(treasuryGain, lateProtocol);
    }

    // ===================================================== Treasury

    function test_withdraw_treasury() public {
        vm.prank(lp1);
        pool.stake(100_000e8);
        _openSingleLoan(10_000e8);

        uint256 treasury = pool.protocolTreasury();
        assertTrue(treasury > 0);

        address dest = makeAddr("dest");
        pool.withdrawTreasury(dest, treasury);
        assertEq(flt.balanceOf(dest), treasury);
        assertEq(pool.protocolTreasury(), 0);
    }

    // ===================================================== Merchant

    function test_merchant_withdraw() public {
        vm.prank(lp1);
        pool.stake(200_000e8);

        address[] memory m = new address[](1);
        m[0] = merNorth;
        uint256[] memory a = new uint256[](1);
        a[0] = 1000e8;
        vm.prank(payer);
        pool.openBnpl(m, a);

        uint256 bal = pool.merchantBalances(merNorth);
        assertTrue(bal > 0);

        vm.prank(merNorth);
        pool.merchantWithdraw(bal);
        assertEq(pool.merchantBalances(merNorth), 0);
        assertEq(flt.balanceOf(merNorth), bal);
    }

    // ===================================================== Views

    function test_pool_utilization() public {
        vm.prank(lp1);
        pool.stake(10_000e8);
        _openSingleLoan(2000e8);

        assertEq(pool.poolUtilizationBps(), 2000);
        assertEq(pool.availableLiquidity(), 8000e8);
    }

    // ===================================================== Reverts

    function test_RevertWhen_unregistered_merchant() public {
        vm.prank(lp1);
        pool.stake(10_000e8);

        address[] memory m = new address[](1);
        m[0] = makeAddr("unknown");
        uint256[] memory a = new uint256[](1);
        a[0] = 100e8;

        vm.prank(payer);
        vm.expectRevert("unregistered merchant");
        pool.openBnpl(m, a);
    }

    // ===================================================== Reputation

    function test_reputation_on_time() public {
        FrontlineReputation.Profile memory p = rep.getProfile(payer);
        assertEq(p.score, 656);

        rep.recordRepayment(payer, 0, true);
        p = rep.getProfile(payer);
        assertEq(p.score, 674);
        assertEq(p.onTimeStreak, 1);
    }

    function test_reputation_late() public {
        rep.recordRepayment(payer, 0, true);
        rep.recordRepayment(payer, 1, false);
        FrontlineReputation.Profile memory p = rep.getProfile(payer);
        assertEq(p.score, 652);
        assertEq(p.onTimeStreak, 0);
        assertEq(p.lateRepayments, 1);
    }

    // ===================================================== Auto-reputation on repay

    function test_repay_on_time_updates_reputation() public {
        vm.prank(lp1);
        pool.stake(200_000e8);
        uint256 lid = _openSingleLoan(1000e8);

        vm.prank(payer);
        pool.repay(lid, 1000e8);

        FrontlineReputation.Profile memory p = rep.getProfile(payer);
        assertEq(p.score, 674); // 656 + 18
        assertEq(p.onTimeStreak, 1);
        assertEq(p.totalRepayments, 1);
        assertEq(p.lateRepayments, 0);
    }

    function test_repay_late_updates_reputation() public {
        vm.prank(lp1);
        pool.stake(200_000e8);
        uint256 lid = _openSingleLoan(1000e8);

        vm.warp(block.timestamp + 8 days);

        vm.prank(payer);
        pool.repay(lid, 1000e8);

        FrontlineReputation.Profile memory p = rep.getProfile(payer);
        assertEq(p.score, 634); // 656 - 22
        assertEq(p.onTimeStreak, 0);
        assertEq(p.lateRepayments, 1);
    }

    // ===================================================== FrontlineToken faucet

    function test_faucet_drip() public {
        address user = makeAddr("faucetUser");
        vm.prank(user);
        flt.faucet();
        assertEq(flt.balanceOf(user), 10_000e8);
    }

    function test_faucet_cooldown() public {
        address user = makeAddr("faucetUser");
        vm.prank(user);
        flt.faucet();

        vm.prank(user);
        vm.expectRevert("faucet cooldown");
        flt.faucet();

        vm.warp(block.timestamp + 1 hours);
        vm.prank(user);
        flt.faucet();
        assertEq(flt.balanceOf(user), 20_000e8);
    }
}
