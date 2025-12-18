# AO Token Trading System

## Overview

The AO Token Trading System in Bazar is a truly decentralized exchange mechanism built on the Universal Content Marketplace (UCM) protocol. Unlike traditional DEXs that require liquidity pools, this system enables direct peer-to-peer trading through an on-chain orderbook, allowing users to buy, sell, bid, and list tokens without intermediaries.

## Key Concepts

### Orderbook-Based Trading

The system uses an **orderbook** - a decentralized ledger of buy and sell orders stored on-chain. Each asset can have its own orderbook that tracks:

- **Asks (Listings)**: Sell orders where users list assets at a specific price
- **Bids**: Buy orders where users offer to purchase assets at a specific price

### No Liquidity Pools Required

Traditional DEXs (like Uniswap) require liquidity providers to deposit tokens into pools. The AO Token Trading System eliminates this need:

- **Direct Matching**: Orders are matched directly between buyers and sellers
- **No Intermediaries**: Trades execute peer-to-peer through the UCM protocol
- **On-Chain Orderbook**: All orders are stored on the Arweave blockchain via AO processes
- **True Decentralization**: No centralized exchange or liquidity pool required

## System Evolution: Legacy vs. New Orderbook

### Legacy System (Before Bid/List Update)

The original trading system had a simpler structure with only **3 trading actions**:

1. **Buy** - Purchase assets from existing listings (same as current)
2. **List** - Create a sell listing at a specific price (this was the only way to sell)
3. **Transfer** - Direct asset transfer (same as current)

**Key Characteristics:**

- No separate "Sell" tab - users had to create a listing first
- No "Bid" functionality - buyers could only purchase from existing listings
- Orders stored in a simple `Orders` array without side information
- Less flexible - required creating limit orders even for immediate sales

**Legacy Orderbook Structure:**

```typescript
{
  Pair: [baseToken, quoteToken],
  Orders: [...] // Simple array without Ask/Bid distinction
}
```

### New System (Current)

The updated system introduces **5 trading actions** with clearer separation of market and limit orders:

1. **Buy** - Market order to purchase from listings (unchanged behavior)
2. **Sell** - Market order to fill existing bids (NEW - immediate sales)
3. **Bid** - Limit order to place buy offers (NEW - waiting for sellers)
4. **List** - Limit order to create sell listings (renamed from old "Sell")
5. **Transfer** - Direct asset transfer (unchanged)

**Key Improvements:**

- **Sell** tab allows immediate market sales by filling existing bids
- **Bid** tab allows buyers to place offers and wait for sellers
- Clearer distinction between market orders (Buy/Sell) and limit orders (Bid/List)
- Better price discovery through bid/ask spread
- More flexible trading options for users

**New Orderbook Structure:**

```typescript
{
  Pair: [baseToken, quoteToken],
  Asks: [...],  // Sell orders (listings)
  Bids: [...]   // Buy orders (bids)
}
```

### Key Differences

**Tabs Available**

- Legacy: Buy, List, Transfer
- New: Buy, Sell, Bid, List, Transfer

**Immediate Sales**

- Legacy: Must create listing first, then wait for buyers
- New: "Sell" tab allows immediate sales by filling existing bids

**Buy Offers**

- Legacy: Not available - buyers could only purchase from existing listings
- New: "Bid" tab allows placing buy offers and waiting for sellers

**Order Structure**

- Legacy: Simple `Orders` array without side distinction
- New: Separate `Asks` and `Bids` arrays with clear side information

**Market Orders**

- Legacy: Buy only
- New: Buy + Sell

**Limit Orders**

- Legacy: List only
- New: Bid + List

**Price Discovery**

- Legacy: Limited to listings only
- New: Full bid/ask spread with both sides of the market

### Migration Notes

- **Legacy assets** (with old orderbook structure) still work with the 3-tab interface (Buy, List, Transfer)
- **New assets** automatically use the 5-tab interface (Buy, Sell, Bid, List, Transfer)
- The system detects legacy orderbooks and adapts the UI accordingly
- All new assets created after the update use the new structure
- **Backward compatible**: Legacy assets continue to function normally

## Trading Actions

The system provides five main trading actions, each serving a specific purpose:

### 1. Buy (Market Order)

**Purpose**: Purchase assets from existing listings at market price

**How it works**:

- User selects quantity of assets to buy
- System automatically matches against available **Ask orders** (listings created via "List" tab)
- Fills orders starting from lowest price first (best price for buyer)
- User sends payment token (e.g., PI) and receives assets immediately
- **Works the same in both legacy and new systems**

**When to use**: When you want to purchase assets immediately at current market price

**Implementation**:

```typescript
// Buy order: Send currency (quote token), receive asset (base token)
dominantToken = tokenProvider.selectedToken.id; // Payment token
swapToken = props.asset.data.id; // Asset being purchased

// Transfer quantity is the total payment amount
transferQuantity = quantity * averagePrice;
```

**Code Reference**:

```572:576:bazar/src/views/Asset/AssetAction/AssetActionMarket/AssetActionMarketOrders/AssetActionMarketOrders.tsx
			case 'buy':
				dominantToken = tokenProvider.selectedToken.id;
				swapToken = props.asset.data.id;
				break;
```

### 2. Sell (Market Order) - NEW

**Purpose**: Sell assets immediately by filling existing bids at market price

**How it works**:

- User selects quantity of assets to sell
- System automatically matches against available **Bid orders** (created via "Bid" tab)
- Fills bids starting from highest price first (best price for seller)
- User sends assets and receives payment token immediately
- **Only available in new orderbook system** (not in legacy)

**Key Difference from Legacy System**:

- **Legacy**: Users had to use "List" to create a sell order and wait for buyers
- **New**: Users can immediately sell by filling existing bids without creating a listing

**Key Difference from Traditional DEX**: The "Sell" tab doesn't create a new listing - it fills existing bids. This follows standard market conventions where "selling" means accepting existing buy offers.

**When to use**: When you want to sell assets immediately at current market price (requires existing bids)

**Implementation**:

```typescript
// Sell order: Send asset (base token), receive currency (quote token)
dominantToken = props.asset.data.id; // Asset being sold
swapToken = tokenProvider.selectedToken.id; // Payment token

// System calculates total received by matching against highest bids first
sortedOrders = bids.sort((a, b) => b.price - a.price);
```

**Code Reference**:

```577:581:bazar/src/views/Asset/AssetAction/AssetActionMarket/AssetActionMarketOrders/AssetActionMarketOrders.tsx
			case 'sell':
				// Sell: Market order - send asset (base token), receive currency (quote token)
				dominantToken = props.asset.data.id;
				swapToken = tokenProvider.selectedToken.id;
				break;
```

**Bid Matching Logic**:

```1044:1105:bazar/src/views/Asset/AssetAction/AssetActionMarket/AssetActionMarketOrders/AssetActionMarketOrders.tsx
		} else if (props.type === 'sell') {
			// For SELL orders: Market order - calculate total amount based on available bids
			if (props.asset && props.asset.orderbook?.orders) {
				const selectedTokenId = tokenProvider.selectedToken.id;

				let sortedOrders = props.asset.orderbook?.orders
					.filter((order: AssetOrderType) => {
						const price = Number(order.price);
						const quantity = Number(order.quantity);
						const matchesCurrency = order.currency === props.asset.data.id; // Bids have base token as currency
						const matchesSelectedToken = order.token === selectedTokenId; // Bid is offering the selected token
						const isBid = order.side === 'Bid';
						return (
							!isNaN(price) &&
							!isNaN(quantity) &&
							price > 0 &&
							quantity > 0 &&
							matchesCurrency &&
							matchesSelectedToken &&
							isBid
						);
					})
					.sort((a: AssetOrderType, b: AssetOrderType) => Number(b.price) - Number(a.price)); // Highest price first

				let totalQuantitySold = 0; // Track how much we've sold (in base token)
				let totalQuoteReceived = 0; // Track how much quote token we receive

				const inputQuantity = currentOrderQuantity as number; // Amount we want to sell

				for (let i = 0; i < sortedOrders.length; i++) {
					const orderQuantity = Number(sortedOrders[i].quantity); // Total quote tokens in bid
					const orderPrice = Number(sortedOrders[i].price); // Price per base token

					// Skip orders with invalid quantity or price
					if (isNaN(orderQuantity) || isNaN(orderPrice) || orderQuantity <= 0 || orderPrice <= 0) {
						continue;
					}

					// For bids: quantity field is total quote tokens, divide by price to get base token quantity available
					const baseTokenAvailable = orderQuantity / orderPrice;

					// How much more do we need to sell?
					const remainingToSell = inputQuantity - totalQuantitySold;

					if (baseTokenAvailable >= remainingToSell) {
						// This bid can fulfill the rest of our sell order
						const quoteReceived = remainingToSell * orderPrice;
						totalQuoteReceived += quoteReceived;
						totalQuantitySold += remainingToSell;
						break;
					} else {
						// Sell as much as this bid can take
						const quoteReceived = baseTokenAvailable * orderPrice; // Should equal orderQuantity
						totalQuoteReceived += quoteReceived;
						totalQuantitySold += baseTokenAvailable;
					}
				}

				// Convert to denominated integer for display
				const result = denomination ? totalQuoteReceived : totalQuoteReceived;
				return BigInt(Math.floor(result));
			} else return 0;
```

### 3. Bid (Limit Order) - NEW

**Purpose**: Place a buy order at a specific price, waiting for sellers to fill it

**How it works**:

- User specifies quantity and price per unit
- Creates a **Bid order** in the orderbook
- Order remains active until filled or cancelled
- When someone uses "Sell" tab, they can fill your bid
- User's payment tokens are locked until order is filled or cancelled
- **Only available in new orderbook system** (not in legacy)

**When to use**: When you want to buy at a specific price and are willing to wait for sellers to fill your bid

**Implementation**:

```typescript
// Bid: Send currency (quote token), receive asset (base token) at specified price
dominantToken = tokenProvider.selectedToken.id; // Payment token
swapToken = props.asset.data.id; // Asset being bid on

// Transfer quantity is total payment amount (quantity * price)
transferQuantity = quantity * unitPrice;
```

**Code Reference**:

```587:591:bazar/src/views/Asset/AssetAction/AssetActionMarket/AssetActionMarketOrders/AssetActionMarketOrders.tsx
			case 'bid':
				// Bid: Send currency (quote token), receive asset (base token)
				dominantToken = tokenProvider.selectedToken.id;
				swapToken = props.asset.data.id;
				break;
```

### 4. List (Limit Order)

**Purpose**: Create a sell listing at a specific price, waiting for buyers to purchase

**How it works**:

- User specifies quantity and price per unit
- Creates an **Ask order** (listing) in the orderbook
- Order remains active until filled or cancelled
- When someone uses "Buy" tab, they can purchase from your listing
- User's assets are locked until order is filled or cancelled

**Evolution from Legacy System**:

- **Legacy**: "List" was the only way to sell assets (users had to create a listing)
- **New**: "List" is now specifically for limit orders, while "Sell" handles immediate market sales
- The functionality is the same, but the naming is clearer and more aligned with market conventions

**When to use**: When you want to sell at a specific price and are willing to wait for buyers to purchase from your listing

**Implementation**:

```typescript
// List: Send asset (base token), receive currency (quote token) at specified price
dominantToken = props.asset.data.id; // Asset being listed
swapToken = tokenProvider.selectedToken.id; // Payment token

// Transfer quantity is the asset amount being listed
transferQuantity = quantity;
```

**Code Reference**:

```582:586:bazar/src/views/Asset/AssetAction/AssetActionMarket/AssetActionMarketOrders/AssetActionMarketOrders.tsx
			case 'list':
				// List: Limit ask - send asset (base token), receive currency (quote token)
				dominantToken = props.asset.data.id;
				swapToken = tokenProvider.selectedToken.id;
				break;
```

### 5. Transfer

**Purpose**: Directly transfer assets to another address without trading

**How it works**:

- User specifies recipient address and quantity
- Assets are transferred directly to the recipient
- No orderbook interaction required
- Useful for gifting or moving assets between wallets

**Implementation**:

```typescript
// Direct transfer - no orderbook involved
await messageResults({
	processId: assetId,
	action: 'Transfer',
	wallet: arProvider.wallet,
	tags: [
		{ name: 'Quantity', value: quantity },
		{ name: 'Recipient', value: recipientAddress },
	],
});
```

## System Flow Diagram

The following diagram illustrates how orders flow through the system:

```
┌─────────────────────────────────────────────────────────────┐
│              AO Token Trading System Flow                    │
└─────────────────────────────────────────────────────────────┘

    User A                    Orderbook                  User B
    ──────                    ────────                  ──────
      │                          │                        │
      │  1. List 100 AO @ 10 PI  │                        │
      │─────────────────────────>│                        │
      │                          │                        │
      │                          │  2. Bid 50 AO @ 12 PI │
      │                          │<───────────────────────│
      │                          │                        │
      │                          │  Orderbook State:      │
      │                          │  • Ask: 100 AO @ 10 PI│
      │                          │  • Bid: 50 AO @ 12 PI │
      │                          │                        │
      │                          │  3. Buy 30 AO          │
      │                          │<───────────────────────│
      │                          │                        │
      │  4. Match with Ask       │                        │
      │<─────────────────────────│                        │
      │                          │                        │
      │  5. Receive 300 PI       │                        │  5. Receive 30 AO
      │<─────────────────────────│                        │<───────────────
      │                          │                        │
      │                          │  6. Sell 20 AO         │
      │                          │<───────────────────────│
      │                          │                        │
      │  7. Receive 20 AO        │                        │  7. Match with Bid
      │<─────────────────────────│                        │<───────────────
      │                          │                        │
      │                          │                        │  8. Receive 240 PI
      │                          │                        │<───────────────
```

**Step-by-Step Explanation:**

1. **User A** creates a **List** order: 100 AO @ 10 PI per token

   - Order stored in orderbook as an **Ask**

2. **User B** creates a **Bid** order: 50 AO @ 12 PI per token

   - Order stored in orderbook as a **Bid**

3. **User B** uses **Buy** tab to purchase 30 AO

   - System matches against User A's Ask (lowest price first)
   - User B sends 300 PI, receives 30 AO

4. **User A** uses **Sell** tab to sell 20 AO
   - System matches against User B's Bid (highest price first)
   - User A sends 20 AO, receives 240 PI

**Key Points:**

- **Buy** matches against existing **Asks** (List orders)
- **Sell** matches against existing **Bids** (Bid orders)
- Orders are matched automatically by price priority
- All transactions are peer-to-peer through the on-chain orderbook

## Order Matching Logic

The UCM protocol handles order matching automatically:

### Market Orders (Buy/Sell)

1. **Buy Orders**: Match against existing **Ask orders** (listings)

   - Sorted by price: **lowest first** (best price for buyer)
   - Fills orders until quantity is satisfied
   - Partial fills are supported

2. **Sell Orders**: Match against existing **Bid orders**
   - Sorted by price: **highest first** (best price for seller)
   - Fills bids until quantity is satisfied
   - Partial fills are supported

### Limit Orders (Bid/List)

1. **Bid Orders**: Placed in orderbook, waiting for sellers

   - Stored with specified price and total payment amount
   - Can be filled by "Sell" market orders
   - Can be cancelled by creator

2. **List Orders**: Placed in orderbook, waiting for buyers
   - Stored with specified price and asset quantity
   - Can be filled by "Buy" market orders
   - Can be cancelled by creator

## Implementation Details

### Order Creation

All orders are created through the UCM protocol using the `createOrder` function from `@permaweb/ucm`:

```typescript
const orderId = await createOrder(
	permawebProvider.deps,
	{
		orderbookId: currentOrderbook,
		baseToken: props.asset.data.id, // Asset token
		quoteToken: tokenProvider.selectedToken.id, // Payment token
		dominantToken: dominantToken, // Token being sent
		swapToken: swapToken, // Token being received
		quantity: transferQuantity, // Amount to transfer
		unitPrice: unitPrice, // Price (for limit orders)
		action: 'Run-Action',
		creatorId: permawebProvider.profile?.id,
	},
	(statusCallback) => {
		// Handle status updates
	}
);
```

### Orderbook Creation

If an asset doesn't have an orderbook, one is created automatically:

```typescript
const newOrderbook = await createOrderbook(
	permawebProvider.deps,
	{
		assetId: props.asset.data.id,
		writeToProcess: true,
		collectionId: props.asset.data.collectionId, // Optional
	},
	(statusCallback) => {
		// Handle status updates
	}
);
```

### Token Denominations

The system handles tokens with different denominations (decimals):

```typescript
// Base token denomination (asset)
if (denomination && denomination > 1) {
	data.baseTokenDenomination = denomination.toString();
}

// Quote token denomination (payment token)
if (transferDenomination && transferDenomination > 1) {
	data.quoteTokenDenomination = transferDenomination.toString();
}
```

### Balance Management

The system supports both wallet and profile balances:

- **Profile Balance**: Tokens stored in user's AO profile
- **Wallet Balance**: Tokens stored directly in wallet

The system automatically transfers from wallet to profile when needed:

```typescript
// Check if wallet has sufficient balance
if (walletBalance >= BigInt(transferQuantity)) {
	useWalletAddress = true; // Use wallet directly
} else {
	// Transfer from wallet to profile first
	await handleWalletToProfileTransfer();
}
```

## Differences from Traditional DEX

### Traditional DEX (e.g., Uniswap)

- **Requires Liquidity Pools**: Users must provide liquidity to enable trading
- **Automated Market Maker (AMM)**: Prices determined by pool ratios
- **Liquidity Provider Fees**: LPs earn fees but face impermanent loss
- **Centralized Components**: Often relies on centralized components for some operations

### AO Token Trading System

- **No Liquidity Pools**: Direct peer-to-peer matching
- **Orderbook-Based**: Prices set by market participants
- **No Intermediaries**: Fully decentralized on Arweave/AO
- **True Ownership**: Users maintain full control of their assets
- **Flexible Pricing**: Market and limit orders supported

## Code Structure

The main implementation is located in:

```
bazar/src/views/Asset/AssetAction/AssetActionMarket/AssetActionMarketOrders/
├── AssetActionMarketOrders.tsx  # Main component with all trading logic
└── types.ts                     # TypeScript type definitions
```

Key functions:

- `handleSubmit()`: Creates orders via UCM
- `getTransferQuantity()`: Calculates transfer amounts based on order type
- `getTotalOrderAmount()`: Calculates total cost/received for orders
- `getActionDisabled()`: Validates order parameters

## Best Practices

1. **Market Orders**: Use for immediate execution at current market price
2. **Limit Orders**: Use when you want to set a specific price
3. **Bid Strategy**: Place bids slightly below market for better fills
4. **List Strategy**: List slightly above market for better prices
5. **Partial Fills**: System supports partial order fills automatically

## Security Considerations

- All orders are stored on-chain via AO processes
- No centralized exchange risk
- Users maintain custody of assets until trade execution
- Orders can be cancelled by creator
- Transparent orderbook for all participants

## Future Enhancements

Potential improvements to the system:

- Order expiration timestamps
- Advanced order types (stop-loss, take-profit)
- Order history and analytics
- Batch order operations
- Cross-chain compatibility
