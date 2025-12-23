## AO Token Trading System

The AO Token Trading System in Bazar is a decentralized exchange mechanism built on the Universal Content Marketplace (UCM) protocol. Unlike traditional DEXs that require liquidity pools, this system enables direct peer-to-peer trading through an on-chain orderbook, allowing users to buy, sell, bid, and list tokens without intermediaries.

### Core Concepts

#### Orderbook-Based Trading

The system uses an **orderbook** - a decentralized ledger of buy and sell orders stored on-chain. Each asset can have its own orderbook that tracks:

- **Asks (Listings)**: Sell orders where users list assets at a specific price
- **Bids**: Buy orders where users offer to purchase assets at a specific price

The orderbook structure separates orders into `Asks` and `Bids` arrays, each containing orders with:

- Order ID
- Creator address
- Quantity (remaining and original)
- Token address
- Price
- Creation timestamp
- Side (Ask or Bid)

#### No Liquidity Pools Required

Traditional DEXs require liquidity providers to deposit tokens into pools. The AO Token Trading System eliminates this need:

- **Direct Matching**: Orders are matched directly between buyers and sellers
- **No Intermediaries**: Trades execute peer-to-peer through the UCM protocol
- **On-Chain Orderbook**: All orders are stored on the Arweave blockchain via AO processes
- **True Decentralization**: No centralized exchange or liquidity pool required

### Trading Actions

The system provides **5 trading actions** that cover all trading needs:

1. **Buy** - Market order to purchase from listings
2. **Sell** - Market order to fill existing bids
3. **Bid** - Limit order to place buy offers
4. **List** - Limit order to create sell listings
5. **Transfer** - Direct asset transfer

These actions provide:

- Clear distinction between market orders (Buy/Sell) and limit orders (Bid/List)
- Full price discovery through bid/ask spread
- Flexible trading options for both buyers and sellers

#### 1. Buy (Market Order)

**Purpose**: Purchase assets from existing listings at market price

**How it works**:

- User selects quantity of assets to buy
- System automatically matches against available **Ask orders** (listings)
- Fills orders starting from lowest price first (best price for buyer)
- User sends payment token and receives assets immediately
- Supports partial fills if insufficient liquidity

**When to use**: When you want to purchase assets immediately at current market price

**Implementation**: Buy orders send the payment token (quote token) and receive the asset (base token). The orderbook process calculates the total payment amount and matches against available asks, applying a 0.05% fee that goes toward buybacks.

#### 2. Sell (Market Order)

**Purpose**: Sell assets immediately by filling existing bids at market price

**How it works**:

- User selects quantity of assets to sell
- System automatically matches against available **Bid orders**
- Fills bids starting from highest price first (best price for seller)
- User sends assets and receives payment token immediately
- Supports partial fills if insufficient liquidity

**When to use**: When you want to sell assets immediately at current market price (requires existing bids)

**Implementation**: Sell orders send the asset (base token) and receive the payment token (quote token). The system matches against existing bids sorted by highest price first, ensuring sellers get the best available price. A 0.05% fee is applied toward buybacks.

#### 3. Bid (Limit Order)

**Purpose**: Place a buy order at a specific price, waiting for sellers to fill it

**How it works**:

- User specifies quantity and price per unit
- Creates a **Bid order** in the orderbook
- Order remains active until filled or cancelled
- Sellers using "Sell" can fill your bid
- Payment tokens are locked in the orderbook until order is filled or cancelled

**When to use**: When you want to buy at a specific price and are willing to wait for sellers

**Implementation**: Bid orders send the total payment amount (quantity × price) to the orderbook process. The order is added to the `Bids` table and remains until matched or cancelled. When matched, the base token is transferred to the bidder and the quote token to the seller.

#### 4. List (Limit Order)

**Purpose**: Create a sell listing at a specific price, waiting for buyers to purchase

**How it works**:

- User specifies quantity and price per unit
- Creates an **Ask order** (listing) in the orderbook
- Order remains active until filled or cancelled
- Buyers using "Buy" can purchase from your listing
- Assets are locked in the orderbook until order is filled or cancelled

**When to use**: When you want to sell at a specific price and are willing to wait for buyers

**Implementation**: List orders send the asset quantity to the orderbook process. The order is added to the `Asks` table with the specified price. When matched, the base token is transferred to the buyer and the quote token to the seller.

#### 5. Transfer

**Purpose**: Directly transfer assets to another address without trading

**How it works**:

- User specifies recipient address and quantity
- Assets are transferred directly to the recipient
- No orderbook interaction required
- Useful for gifting or moving assets between wallets

**Implementation**: Transfer operations send a direct message to the asset process with the `Transfer` action, bypassing the orderbook entirely.

#### Order Matching Logic

The orderbook process automatically matches orders using price-time priority:

#### Market Orders (Buy/Sell)

**Buy Orders**: Match against existing **Ask orders** (listings)

- Orders sorted by price: **lowest first** (best execution for buyer)
- Fills available asks until requested quantity is satisfied
- Calculates VWAP (volume-weighted average price) across all fills
- Supports partial fills if insufficient liquidity
- Transfers quote token from buyer to seller, base token from seller to buyer

**Sell Orders**: Match against existing **Bid orders**

- Orders sorted by price: **highest first** (best execution for seller)
- Fills available bids until requested quantity is satisfied
- Calculates VWAP across all fills
- Supports partial fills if insufficient liquidity
- Transfers base token from seller to bidder, quote token from bidder to seller

#### Limit Orders (Bid/List)

**Bid Orders**: Added to orderbook, waiting for sellers

- Stored in `Bids` table with specified price and quantity
- Locked payment tokens held by orderbook process
- Matched when sellers use "Sell" market orders
- Can be cancelled by creator (returns locked tokens)

**List Orders**: Added to orderbook, waiting for buyers

- Stored in `Asks` table with specified price and quantity
- Locked assets held by orderbook process
- Matched when buyers use "Buy" market orders
- Can be cancelled by creator (returns locked assets)

#### Price Calculation

The system handles token denominations for accurate pricing:

- Each trading pair stores base and quote token denominations
- Price is expressed as: quote token (raw) per 1 base token (display units)
- Example: If base denomination is 1,000,000 (6 decimals), price of 500,000 means 0.5 quote tokens per 1 display unit of base token
- Calculations preserve precision using integer arithmetic throughout

### Implementation Architecture

#### Order Creation Flow

1. **User initiates order** via Bazar UI (Buy, Sell, Bid, List)
2. **UCM SDK** (`@permaweb/ucm`) prepares the order with proper tags
3. **Token transfer** sent to dominant token process with `Credit-Notice` action
4. **Orderbook process** receives credit notice and processes order:
5. **Activity tracking** updates executed/listed orders
6. **Response sent** to user with order status and details

#### Orderbook Structure

Each trading pair in the orderbook contains:

```lua
{
  Pair = [BaseToken, QuoteToken],      -- Token addresses
  Denominations = [BaseDenom, QuoteDenom], -- Token decimals (default: 1)
  Asks = [...],                         -- Sell orders
  Bids = [...],                         -- Buy orders
  PriceData = {                         -- Market data
    Vwap,                               -- Volume-weighted average price
    Block,                              -- Last trade block height
    DominantToken,                      -- Last trade dominant token
    MatchLogs                           -- Trade history
  }
}
```

#### Order Structure

Each order in the `Asks` or `Bids` table contains:

```lua
{
  Id,                 -- Transaction ID
  Creator,            -- Order creator address
  Quantity,           -- Remaining quantity
  OriginalQuantity,   -- Initial quantity
  Token,              -- Token being sent
  DateCreated,        -- Creation timestamp
  Price,              -- Price per unit
  Side                -- "Ask" or "Bid"
}
```

#### Token Denominations

Tokens can have different decimal places (denominations):

- Stored as base denomination (e.g., 1,000,000 for 6 decimals)
- Orderbook stores denominations for both base and quote tokens
- Prices calculated using raw token amounts for precision
- UI converts to display units for user-friendly presentation

#### Balance Management

The system supports multiple balance sources:

- **Wallet Balance**: Direct wallet holdings
- **Profile Balance**: Tokens in AO profile process

Order creation attempts wallet first, falls back to profile if insufficient funds.

### Comparison to Traditional DEX Models

#### AMM-Based DEX

- **Liquidity Pools**: Requires liquidity providers to deposit token pairs
- **Automated Pricing**: Prices determined by pool ratios (constant product formula)
- **Impermanent Loss**: LPs risk losing value when prices diverge
- **Immediate Execution**: Always available if pool has liquidity
- **Slippage**: Large orders move price significantly

#### Orderbook-Based DEX (AO Token Trading System)

- **Direct Matching**: Peer-to-peer orders without intermediaries
- **Market-Set Pricing**: Buyers and sellers determine prices
- **No Impermanent Loss**: No liquidity provider role required
- **Execution Depends on Orders**: Market orders need matching limit orders
- **Price Priority**: Best prices matched first, transparent orderbook

### Trading Strategies

#### Market Orders

- **Use when**: You want immediate execution at best available price
- **Best for**: Quick trades when price certainty is less important than execution
- **Tip**: Check orderbook depth before large market orders

#### Limit Orders

- **Use when**: You have a target price and can wait for execution
- **Best for**: Patient traders who want price control
- **Tip**: Place bids below current asks, place asks above current bids for better chances of execution

#### Price Discovery

- Monitor the bid-ask spread to understand market liquidity
- Tight spreads indicate active markets
- Wide spreads may require competitive limit orders

#### Order Management

- **Cancellable**: Creators can cancel unfilled orders anytime
- **Atomic Execution**: Trades execute completely or not at all
- **Token Locking**: Assets locked in orderbook process during active orders
- **Fee Structure**: 0.05% trading fee supports ecosystem buybacks
