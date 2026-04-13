// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FrontlineBondingCurve} from "../src/FrontlineBondingCurve.sol";
import {FrontlinePool} from "../src/FrontlinePool.sol";
import {FrontlineReputation} from "../src/FrontlineReputation.sol";
import {FrontlineToken} from "../src/FrontlineToken.sol";

contract FrontlineScript is Script {
    uint256 internal constant DEFAULT_BASE_PRICE_PER_TOKEN_TINYBAR = 2_000; // 0.00002 HBAR
    uint256 internal constant DEFAULT_CURVE_STEEPNESS_WAD = 2e18;
    uint256 internal constant DEFAULT_BOOTSTRAP_POOL_TOKENS = 10_000_000 * 1e8;

    function run() public {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        uint256 basePricePerTokenWei =
            _envOrUint("CURVE_BASE_PRICE_PER_TOKEN_TINYBAR", DEFAULT_BASE_PRICE_PER_TOKEN_TINYBAR);
        uint256 curveSteepnessWad = _envOrUint("CURVE_STEEPNESS_WAD", DEFAULT_CURVE_STEEPNESS_WAD);
        uint256 poolSeedTokens = _envOrUint("POOL_SEED_TOKENS", DEFAULT_BOOTSTRAP_POOL_TOKENS);

        vm.startBroadcast(privateKey);

        FrontlineToken flt = new FrontlineToken();
        console.log("FrontlineToken:", address(flt));

        FrontlinePool pool = new FrontlinePool(address(flt));
        console.log("FrontlinePool:", address(pool));

        FrontlineReputation rep = new FrontlineReputation();
        console.log("FrontlineReputation:", address(rep));

        FrontlineBondingCurve curve = new FrontlineBondingCurve(address(flt), basePricePerTokenWei, curveSteepnessWad);
        console.log("FrontlineBondingCurve:", address(curve));

        pool.setReputation(address(rep));
        rep.setAuthorizedCaller(address(pool), true);

        flt.setAuthorizedMinter(address(curve), true);
        curve.activateCurve();
        console.log("Curve activated with FLT liquidity:", curve.currentLiquidity());

        _bootstrapPool(curve, flt, pool, deployer, poolSeedTokens);
        console.log("Merchant count:", pool.merchantCount());

        vm.stopBroadcast();

        console.log("---");
        console.log("Add to frontlineapp/.env:");
        console.log("  NEXT_PUBLIC_FLT_TOKEN_ADDRESS=", address(flt));
        console.log("  NEXT_PUBLIC_FRONTLINE_POOL_ADDRESS=", address(pool));
        console.log("  NEXT_PUBLIC_FRONTLINE_REPUTATION_ADDRESS=", address(rep));
        console.log("  NEXT_PUBLIC_FRONTLINE_BONDING_CURVE_ADDRESS=", address(curve));
    }

    function _envOrString(string memory key, string memory fallbackValue) internal view returns (string memory) {
        try vm.envString(key) returns (string memory value) {
            return value;
        } catch {
            return fallbackValue;
        }
    }

    function _envOrUint(string memory key, uint256 fallbackValue) internal view returns (uint256) {
        try vm.envUint(key) returns (uint256 value) {
            return value;
        } catch {
            return fallbackValue;
        }
    }

    function _bootstrapPool(
        FrontlineBondingCurve curve,
        FrontlineToken flt,
        FrontlinePool pool,
        address deployer,
        uint256 poolSeedTokens
    ) internal {
        if (poolSeedTokens == 0) {
            console.log("Pool seed skipped: set POOL_SEED_TOKENS to bootstrap initial BNPL liquidity.");
            return;
        }

        curve.bootstrapAllocation(deployer, poolSeedTokens);
        flt.approve(address(pool), poolSeedTokens);
        pool.stake(poolSeedTokens);
        console.log("Pool bootstrapped from launch inventory:", poolSeedTokens);
    }
}
