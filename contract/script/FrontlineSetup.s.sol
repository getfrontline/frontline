// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {FrontlinePool} from "../src/FrontlinePool.sol";
import {FrontlineToken} from "../src/FrontlineToken.sol";

contract FrontlineSetupScript is Script {
    uint256 internal constant DEFAULT_MINT_AMOUNT = 100_000 * 1e8;
    uint256 internal constant DEFAULT_POOL_SEED_AMOUNT = 50_000 * 1e8;

    function run() public {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);

        FrontlineToken flt = FrontlineToken(vm.envAddress("FRONTLINE_FLT_ADDRESS"));
        FrontlinePool pool = FrontlinePool(vm.envAddress("FRONTLINE_POOL_ADDRESS"));

        address demoMerchant = _envOrAddress("DEMO_MERCHANT_EVM_ADDRESS", deployer);
        string memory demoMerchantName = _envOrString("DEMO_MERCHANT_NAME", "Demo Merchant");
        string memory demoMerchantCategory = _envOrString("DEMO_MERCHANT_CATEGORY", "Testnet demo");
        uint256 mintAmount = _envOrUint("DEPLOYER_MINT_AMOUNT", DEFAULT_MINT_AMOUNT);
        uint256 poolSeedAmount = _envOrUint("POOL_SEED_AMOUNT", DEFAULT_POOL_SEED_AMOUNT);

        require(poolSeedAmount <= mintAmount, "seed exceeds mint");

        vm.startBroadcast(privateKey);

        if (!pool.registeredMerchants(demoMerchant)) {
            pool.registerMerchantFor(demoMerchant, demoMerchantName, demoMerchantCategory);
            console.log("Demo merchant registered:", demoMerchant);
        } else {
            console.log("Demo merchant already registered:", demoMerchant);
        }

        flt.mint(deployer, mintAmount);
        console.log("Minted FLT to deployer:", mintAmount);

        flt.approve(address(pool), poolSeedAmount);
        console.log("Approved pool spend:", poolSeedAmount);

        pool.stake(poolSeedAmount);
        console.log("Pool seeded with FLT:", poolSeedAmount);

        vm.stopBroadcast();

        console.log("---");
        console.log("Merchant count:", pool.merchantCount());
        console.log("Demo merchant active:", pool.registeredMerchants(demoMerchant));
        console.log("Deployer FLT balance:", flt.balanceOf(deployer));
        console.log("Pool total staked:", pool.totalStaked());
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
