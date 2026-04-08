// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title FrontlineToken (FLT) — Testnet token used across the Frontline protocol
/// @notice ERC-20 with a public faucet `mint()`. Designed for Hedera testnet use;
///         on mainnet this would be replaced by USDC via HTS association.
contract FrontlineToken is IERC20 {
    string public constant name = "Frontline Token";
    string public constant symbol = "FLT";
    uint8 public constant decimals = 8;

    uint256 public constant FAUCET_AMOUNT = 10_000 * 10 ** 8; // 10,000 FLT per drip
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastFaucetDrip;

    event FaucetDrip(address indexed to, uint256 amount);

    /// @notice Open faucet — anyone can call once per cooldown period.
    function faucet() external {
        require(
            lastFaucetDrip[msg.sender] == 0 || block.timestamp >= lastFaucetDrip[msg.sender] + FAUCET_COOLDOWN,
            "faucet cooldown"
        );
        lastFaucetDrip[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetDrip(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Unrestricted mint for contract-level setup and testing.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "insufficient allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
}
