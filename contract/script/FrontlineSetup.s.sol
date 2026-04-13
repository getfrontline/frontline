// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FrontlineBondingCurve} from "../src/FrontlineBondingCurve.sol";
import {FrontlinePool} from "../src/FrontlinePool.sol";
import {FrontlineToken} from "../src/FrontlineToken.sol";

contract FrontlineSetupScript is Script {
    uint256 internal constant DEFAULT_BOOTSTRAP_POOL_TOKENS = 10_000_000 * 1e8;

    function run() public {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        FrontlineToken flt = FrontlineToken(vm.envAddress("FRONTLINE_FLT_ADDRESS"));
        FrontlinePool pool = FrontlinePool(vm.envAddress("FRONTLINE_POOL_ADDRESS"));
        FrontlineBondingCurve curve = FrontlineBondingCurve(vm.envAddress("FRONTLINE_BONDING_CURVE_ADDRESS"));

        address demoMerchant = _envOrAddress("DEMO_MERCHANT_EVM_ADDRESS", deployer);
        string memory demoMerchantName = _envOrString("DEMO_MERCHANT_NAME", "Demo Merchant");
        string memory demoMerchantCategory = _envOrString("DEMO_MERCHANT_CATEGORY", "Mainnet merchant");
        uint256 poolSeedTokens = _envOrUint("POOL_SEED_TOKENS", DEFAULT_BOOTSTRAP_POOL_TOKENS);

        vm.startBroadcast(privateKey);

        if (!pool.registeredMerchants(demoMerchant)) {
            pool.registerMerchantFor(demoMerchant, demoMerchantName, demoMerchantCategory);
            console.log("Demo merchant registered:", demoMerchant);
        } else {
            console.log("Demo merchant already registered:", demoMerchant);
        }

        if (!curve.curveActive()) {
            flt.setAuthorizedMinter(address(curve), true);
            curve.activateCurve();
            console.log("Curve activated with FLT liquidity:", curve.currentLiquidity());
        } else {
            console.log("Curve already active with FLT liquidity:", curve.currentLiquidity());
        }

        if (poolSeedTokens > 0) {
            if (!curve.bootstrapDistributed()) {
                curve.bootstrapAllocation(deployer, poolSeedTokens);
            }
            flt.approve(address(pool), poolSeedTokens);
            pool.stake(poolSeedTokens);
            console.log("Pool bootstrapped from launch inventory:", poolSeedTokens);
        } else {
            console.log("Pool seed skipped: set POOL_SEED_TOKENS to bootstrap initial BNPL liquidity.");
        }

        vm.stopBroadcast();

        console.log("---");
        console.log("Merchant count:", pool.merchantCount());
        console.log("Demo merchant active:", pool.registeredMerchants(demoMerchant));
        console.log("Deployer FLT balance:", flt.balanceOf(deployer));
        console.log("Pool total staked:", pool.totalStaked());
        console.log("Curve liquidity:", curve.currentLiquidity());
    }

    function _envOrAddress(string memory key, address fallbackValue) internal view returns (address) {
        try vm.envAddress(key) returns (address value) {
            return value;
        } catch {
            return fallbackValue;
        }
    }

    function _envOrString(string memory key, string memory fallbackValue) internal view returns (string memory) {
        try vm.envString(key) returns (string memory value) {
            return value;
        } catch {
            return fallbackValue;
        }
    }

    function _envOrUint(string memory key, uint256 fallbackValue) internal view returns (uint256 value) {
        try vm.envUint(key) returns (uint256 parsed) {
            return parsed;
        } catch {
            return fallbackValue;
        }
    }
}
