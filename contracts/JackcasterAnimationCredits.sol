// SPDX-License-Identifier: MIT
// Compile with Solidity 0.8.30 and pinned OpenZeppelin Contracts 5.7.0.
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts@5.7.0/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.7.0/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step} from "@openzeppelin/contracts@5.7.0/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts@5.7.0/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts@5.7.0/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts@5.7.0/utils/ReentrancyGuard.sol";

/// @title Jackcaster Animation Credits
/// @author Jackcaster
/// @notice USDC credits for AI avatar-animation drafts, direct credit gifts, and usage stats.
/// @dev This contract handles payments and credit accounting only. AI processing, profile
///      images, and a user's saved animation collection remain offchain. The contract emits
///      public events and exposes per-wallet/global counters for the app's stats and rankings.
///
///      Security properties:
///      - Circle-issued USDC on Base only; SafeERC20 handles nonstandard ERC-20 returns.
///      - Two-step ownership transfer, bounded owner settings, and purchase-only pausing.
///      - Gift credits are assigned to the recipient at payment time and cannot be redirected.
///      - Credits are nontransferable, do not expire, and remain usable while sales are paused.
///      - No owner withdrawal, arbitrary credit edits, upgrade path, or user-credit expiry.
contract JackcasterAnimationCredits is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical Circle-issued USDC on Base mainnet (6 decimals).
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    /// @dev Owner-settable price bounds avoid zero-price purchases and accidental large charges.
    uint256 public constant MIN_PRICE_USDC = 100_000; // $0.10
    uint256 public constant MAX_PRICE_USDC = 10_000_000; // $10.00
    uint8 public constant MIN_PAID_CREDITS = 1;
    uint8 public constant MAX_PAID_CREDITS = 10;
    uint8 public constant MAX_BONUS_CREDITS = 2;
    uint8 public constant MIN_GIFT_CREDITS = 1;
    uint8 public constant MAX_GIFT_CREDITS = 10;

    /// @notice USDC base units charged for every personal or gift purchase.
    uint256 public priceUSDC = 1_000_000; // $1.00 USDC

    /// @notice Personal purchase defaults: pay for 3 credits and receive 2 bonus credits.
    uint8 public paidCreditsPerPurchase = 3;
    uint8 public bonusCreditsPerPurchase = 2;

    /// @notice Gift defaults: the recipient receives exactly 3 credits for a $1 purchase.
    uint8 public giftCreditsPerPurchase = 3;

    /// @notice Receives USDC immediately; this contract never holds purchase funds.
    address public treasury = 0x76bC75Ef2F1f0F25e078641910D8E23A430204F5;

    /// @notice Remaining animation attempts, keyed to the wallet that owns the credits.
    mapping(address account => uint256 amount) public creditsOf;

    /// @notice Per-wallet lifetime counters for profile and leaderboard views.
    struct AccountStats {
        uint256 usdcPaid;
        uint256 personalPurchases;
        uint256 paidCreditsPurchased;
        uint256 bonusCreditsReceived;
        uint256 giftsPurchased;
        uint256 giftCreditsSent;
        uint256 giftCreditsReceived;
        uint256 animationAttempts;
    }

    /// @notice Publicly readable wallet stats; counters never decrease.
    mapping(address account => AccountStats stats) public accountStats;

    /// @notice Every request ID can spend at most one credit per wallet.
    mapping(address account => mapping(bytes32 requestId => bool used)) public usedRequests;

    /// @notice Count wallets that have ever received a credit (purchase or gift).
    mapping(address account => bool counted) private _hasReceivedCredits;
    uint256 public totalUniqueCreditAccounts;

    /// @notice Global counters useful for app analytics and offchain leaderboard indexing.
    uint256 public totalUSDCCollected;
    uint256 public totalPersonalPurchases;
    uint256 public totalPaidCreditsPurchased;
    uint256 public totalBonusCreditsGranted;
    uint256 public totalGiftPurchases;
    uint256 public totalGiftCreditsGranted;
    uint256 public totalAnimationAttempts;

    event CreditsPurchased(
        address indexed account,
        uint256 usdcAmount,
        uint8 paidCredits,
        uint8 bonusCredits
    );
    event CreditsGifted(
        address indexed payer,
        address indexed recipient,
        uint256 usdcAmount,
        uint8 creditsAdded
    );
    event CreditUsed(address indexed account, bytes32 indexed requestId, uint256 creditsRemaining);
    event PriceUpdated(uint256 previousPriceUSDC, uint256 newPriceUSDC);
    event PersonalPackUpdated(uint8 oldPaid, uint8 newPaid, uint8 oldBonus, uint8 newBonus);
    event GiftPackUpdated(uint8 previousCredits, uint8 newCredits);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    error WrongChain();
    error InvalidPrice();
    error InvalidPersonalPack();
    error InvalidGiftPack();
    error InvalidTreasury();
    error InvalidGiftRecipient();
    error InvalidRequestId();
    error InsufficientCredits();
    error RequestAlreadyUsed();

    /// @param initialOwner Wallet that can adjust bounded settings and pause purchases.
    ///        A multisig is recommended for production ownership.
    constructor(address initialOwner) Ownable(initialOwner) {
        if (block.chainid != 8453) revert WrongChain();
    }

    /// @notice Buy personal credits: default is 3 paid credits plus 2 bonus credits.
    /// @dev Approve this contract for `priceUSDC` first. Both counters and the credit
    ///      balance are updated atomically with the payment or the whole call reverts.
    function buyCredits() external nonReentrant whenNotPaused {
        uint256 price = priceUSDC;
        uint8 paid = paidCreditsPerPurchase;
        uint8 bonus = bonusCreditsPerPurchase;
        uint256 granted = uint256(paid) + uint256(bonus);

        USDC.safeTransferFrom(msg.sender, treasury, price);
        creditsOf[msg.sender] += granted;

        AccountStats storage stats = accountStats[msg.sender];
        stats.usdcPaid += price;
        stats.personalPurchases += 1;
        stats.paidCreditsPurchased += paid;
        stats.bonusCreditsReceived += bonus;

        totalUSDCCollected += price;
        totalPersonalPurchases += 1;
        totalPaidCreditsPurchased += paid;
        totalBonusCreditsGranted += bonus;
        _countCreditAccount(msg.sender);

        emit CreditsPurchased(msg.sender, price, paid, bonus);
    }

    /// @notice Buy a gift pack that is immediately and permanently assigned to `recipient`.
    /// @dev The payer cannot later redirect, reclaim, or spend the recipient's gift credits.
    ///      Gift packs receive the configured gift amount (3 by default), not the personal
    ///      purchase bonus. This avoids gifting extra credits without clearly pricing them.
    function giftCredits(address recipient) external nonReentrant whenNotPaused {
        if (recipient == address(0) || recipient == msg.sender) revert InvalidGiftRecipient();

        uint256 price = priceUSDC;
        uint8 amount = giftCreditsPerPurchase;
        USDC.safeTransferFrom(msg.sender, treasury, price);
        creditsOf[recipient] += amount;

        AccountStats storage payerStats = accountStats[msg.sender];
        payerStats.usdcPaid += price;
        payerStats.giftsPurchased += 1;
        payerStats.giftCreditsSent += amount;

        accountStats[recipient].giftCreditsReceived += amount;
        totalUSDCCollected += price;
        totalGiftPurchases += 1;
        totalGiftCreditsGranted += amount;
        _countCreditAccount(recipient);

        emit CreditsGifted(msg.sender, recipient, price, amount);
    }

    /// @notice Spend one credit for one offchain animation generation attempt.
    /// @param requestId Fresh, nonzero random bytes32 ID generated for this attempt.
    /// @dev This records a paid attempt, not a guaranteed successful AI output. The
    ///      caller's credit is consumed before generation; provider failures are not
    ///      automatically refunded. Duplicate IDs cannot spend twice for the same wallet.
    function useCredit(bytes32 requestId) external {
        if (requestId == bytes32(0)) revert InvalidRequestId();
        if (usedRequests[msg.sender][requestId]) revert RequestAlreadyUsed();

        // A direct balance check keeps this guard obvious in Remix and in audits.
        if (creditsOf[msg.sender] < 1) revert InsufficientCredits();

        usedRequests[msg.sender][requestId] = true;
        creditsOf[msg.sender] -= 1;
        accountStats[msg.sender].animationAttempts += 1;
        totalAnimationAttempts += 1;

        emit CreditUsed(msg.sender, requestId, creditsOf[msg.sender]);
    }

    /// @notice Set a bounded price for future purchases; existing balances are unaffected.
    function setPriceUSDC(uint256 newPriceUSDC) external onlyOwner {
        if (newPriceUSDC < MIN_PRICE_USDC || newPriceUSDC > MAX_PRICE_USDC) revert InvalidPrice();
        uint256 oldPrice = priceUSDC;
        priceUSDC = newPriceUSDC;
        emit PriceUpdated(oldPrice, newPriceUSDC);
    }

    /// @notice Configure future personal packs. Bonus credits are capped at two.
    function setPersonalPack(uint8 paidCredits, uint8 bonusCredits) external onlyOwner {
        if (
            paidCredits < MIN_PAID_CREDITS || paidCredits > MAX_PAID_CREDITS
                || bonusCredits > MAX_BONUS_CREDITS
        ) revert InvalidPersonalPack();

        uint8 oldPaid = paidCreditsPerPurchase;
        uint8 oldBonus = bonusCreditsPerPurchase;
        paidCreditsPerPurchase = paidCredits;
        bonusCreditsPerPurchase = bonusCredits;
        emit PersonalPackUpdated(oldPaid, paidCredits, oldBonus, bonusCredits);
    }

    /// @notice Configure the recipient-bound gift size for future gifts.
    function setGiftCreditsPerPurchase(uint8 newCredits) external onlyOwner {
        if (newCredits < MIN_GIFT_CREDITS || newCredits > MAX_GIFT_CREDITS) revert InvalidGiftPack();
        uint8 oldCredits = giftCreditsPerPurchase;
        giftCreditsPerPurchase = newCredits;
        emit GiftPackUpdated(oldCredits, newCredits);
    }

    /// @notice Change destination for future payments. Already-sent payments cannot change.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /// @notice Pause purchases and gifts during an emergency; spending credits stays enabled.
    function pausePurchases() external onlyOwner {
        _pause();
    }

    /// @notice Resume purchases and gifts after an issue has been resolved.
    function unpausePurchases() external onlyOwner {
        _unpause();
    }

    /// @dev Count a wallet once, when it first receives purchased or gifted credits.
    function _countCreditAccount(address account) private {
        if (!_hasReceivedCredits[account]) {
            _hasReceivedCredits[account] = true;
            totalUniqueCreditAccounts += 1;
        }
    }
}
