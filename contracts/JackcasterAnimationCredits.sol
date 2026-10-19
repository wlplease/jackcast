// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Jackcaster Animation Credits
/// @notice Pay 1 USDC on Base to receive three one-use animation credits.
/// @dev No owner, admin, upgrade, or withdrawal functions. Each generation
///      consumes one credit in a separate wallet transaction.
interface IERC20Minimal {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract JackcasterAnimationCredits {
    error WrongChain();
    error InvalidRequestId();
    error NoCredits();
    error RequestAlreadyUsed();
    error PaymentFailed();

    // Circle-issued USDC on Base mainnet (6 decimals).
    IERC20Minimal public constant USDC = IERC20Minimal(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);
    address public constant TREASURY = 0x76bC75Ef2F1f0F25e078641910D8E23A430204F5;
    uint256 public constant PRICE_USDC = 1_000_000;
    uint8 public constant CREDITS_PER_PURCHASE = 3;

    mapping(address account => uint256 amount) public creditsOf;
    mapping(address account => mapping(bytes32 requestId => bool used)) public usedRequests;

    event CreditsPurchased(address indexed account, uint256 usdcAmount, uint8 creditsAdded);
    event CreditUsed(address indexed account, bytes32 indexed requestId, uint256 creditsRemaining);

    constructor() {
        if (block.chainid != 8453) revert WrongChain();
    }

    /// @notice Purchase exactly three generation attempts for 1 USDC.
    /// @dev Approve this contract to spend 1 USDC before calling this method.
    function buyCredits() external {
        if (!USDC.transferFrom(msg.sender, TREASURY, PRICE_USDC)) revert PaymentFailed();
        creditsOf[msg.sender] += CREDITS_PER_PURCHASE;
        emit CreditsPurchased(msg.sender, PRICE_USDC, CREDITS_PER_PURCHASE);
    }

    /// @notice Spend one credit for one animation attempt.
    /// @dev Use a fresh random bytes32 request id for every generation attempt.
    function useCredit(bytes32 requestId) external {
        if (requestId == bytes32(0)) revert InvalidRequestId();
        if (usedRequests[msg.sender][requestId]) revert RequestAlreadyUsed();
        uint256 available = creditsOf[msg.sender];
        if (available == 0) revert NoCredits();

        usedRequests[msg.sender][requestId] = true;
        creditsOf[msg.sender] = available - 1;
        emit CreditUsed(msg.sender, requestId, available - 1);
    }
}
