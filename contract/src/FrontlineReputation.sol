// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title FrontlineReputation — On-chain portable credit score
/// @notice Stores a simple reputation score (300–850), an on-time streak, and
///         emits ledger events for each repayment. Only the protocol (owner)
///         can record repayments; anyone can read scores.
contract FrontlineReputation {
    struct Profile {
        uint16 score;
        uint16 onTimeStreak;
        uint32 totalRepayments;
        uint32 lateRepayments;
    }

    uint16 public constant MIN_SCORE = 300;
    uint16 public constant MAX_SCORE = 850;
    uint16 public constant INITIAL_SCORE = 656;
    int16 public constant ON_TIME_DELTA = 18;
    int16 public constant LATE_DELTA = -22;

    address public owner;
    mapping(address => Profile) public profiles;
    mapping(address => bool) public authorizedCallers;

    event RepaymentRecorded(address indexed user, uint256 indexed loanId, bool onTime, uint16 newScore, uint16 streak);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(msg.sender == owner || authorizedCallers[msg.sender], "not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        require(caller != address(0), "zero address");
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function recordRepayment(address user, uint256 loanId, bool onTime) external onlyAuthorized {
        Profile storage p = profiles[user];
        if (p.score == 0) p.score = INITIAL_SCORE;

        p.totalRepayments++;
        if (onTime) {
            p.onTimeStreak++;
            p.score = _clamp(int16(p.score) + ON_TIME_DELTA);
        } else {
            p.onTimeStreak = 0;
            p.lateRepayments++;
            p.score = _clamp(int16(p.score) + LATE_DELTA);
        }

        emit RepaymentRecorded(user, loanId, onTime, p.score, p.onTimeStreak);
    }

    function getProfile(address user) external view returns (Profile memory) {
        Profile memory p = profiles[user];
        if (p.score == 0) p.score = INITIAL_SCORE;
        return p;
    }

    function tierOf(address user) external view returns (string memory) {
        uint16 s = profiles[user].score;
        if (s == 0) s = INITIAL_SCORE;
        if (s < 560) return "Recovering";
        if (s < 620) return "Fair";
        if (s < 680) return "Good";
        if (s < 740) return "Strong";
        return "Elite";
    }

    function _clamp(int16 raw) internal pure returns (uint16) {
        if (raw < int16(MIN_SCORE)) return MIN_SCORE;
        if (raw > int16(MAX_SCORE)) return MAX_SCORE;
        return uint16(raw);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }
}
