// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FrontlinePool} from "../src/FrontlinePool.sol";
import {FrontlineReputation} from "../src/FrontlineReputation.sol";
import {FrontlineToken} from "../src/FrontlineToken.sol";

contract FrontlineScript is Script {
    uint256 internal constant DEFAULT_MINT_AMOUNT = 100_000 * 1e8;
    uint256 internal constant DEFAULT_POOL_SEED_AMOUNT = 50_000 * 1e8;

    function run() public {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address demoMerchant = _envOrAddress("DEMO_MERCHANT_EVM_ADDRESS", deployer);
        string memory demoMerchantName = _envOrString("DEMO_MERCHANT_NAME", "Demo Merchant");
        string memory demoMerchantCategory = _envOrString("DEMO_MERCHANT_CATEGORY", "Testnet demo");
        uint256 mintAmount = _envOrUint("DEPLOYER_MINT_AMOUNT", DEFAULT_MINT_AMOUNT);
        uint256 poolSeedAmount = _envOrUint("POOL_SEED_AMOUNT", DEFAULT_POOL_SEED_AMOUNT);

        require(poolSeedAmount <= mintAmount, "seed exceeds mint");

        vm.startBroadcast(privateKey);

        FrontlineToken flt = new FrontlineToken();
        console.log("FrontlineToken:", address(flt));

        FrontlinePool pool = new FrontlinePool(address(flt));
        console.log("FrontlinePool:", address(pool));

        FrontlineReputation rep = new FrontlineReputation();
        console.log("FrontlineReputation:", address(rep));

        pool.registerMerchantFor(demoMerchant, demoMerchantName, demoMerchantCategory);
        console.log("Demo merchant registered:", demoMerchant);

        flt.mint(deployer, mintAmount);
        flt.approve(address(pool), poolSeedAmount);
        pool.stake(poolSeedAmount);
        console.log("Pool seeded with FLT:", poolSeedAmount);

        console.log("Merchant count:", pool.merchantCount());
        console.log("Demo merchant active:", pool.registeredMerchants(demoMerchant));

        vm.stopBroadcast();

        console.log("---");
        console.log("Add to frontlineapp/.env:");
        console.log("  NEXT_PUBLIC_FLT_TOKEN_ADDRESS=", address(flt));
        console.log("  NEXT_PUBLIC_FRONTLINE_POOL_ADDRESS=", address(pool));
        console.log("  NEXT_PUBLIC_FRONTLINE_REPUTATION_ADDRESS=", address(rep));
        console.log("  NEXT_PUBLIC_MERCHANT_NORTH_ADDRESS=", demoMerchant);
        console.log("  NEXT_PUBLIC_MERCHANT_PARCEL_ADDRESS=", demoMerchant);
        console.log("  NEXT_PUBLIC_MERCHANT_VOLT_ADDRESS=", demoMerchant);
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

    function _envOrUint(string memory key, uint256 fallbackValue) internal view returns (uint256) {
        try vm.envUint(key) returns (uint256 value) {
            return value;
        } catch {
            return fallbackValue;
        }
    }
}
