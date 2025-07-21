# Add token registry and improve token balance handling

## Description

Added a centralized token registry and improved token balance handling to support multiple tokens (wAR, PIXL, Wander) with better error handling.

## Changes Made

### Core Changes

- **Token Registry**: Added `TOKEN_REGISTRY` in `config.ts` for centralized token management
- **Balance Handling**: Updated `PermawebProvider` to handle multiple token balances
- **Error Handling**: Added fallback handling for failed token requests

### Files Modified

- `src/helpers/config.ts` - Added token registry
- `src/providers/PermawebProvider.tsx` - Enhanced balance fetching
- `src/components/atoms/CurrencyLine/CurrencyLine.tsx` - Token display updates
- `src/components/organisms/ActivityTable/ActivityTable.tsx` - Token-aware display
- `src/wallet/WalletConnect/WalletConnect.tsx` - Token integration

### New Files

- `src/helpers/tokenValidation.ts` - Token validation utilities
- `src/helpers/tokenAlternatives.ts` - Alternative token discovery
- `src/providers/TokenProvider.tsx` - Token state management
- `src/components/atoms/TokenHealthIndicator/` - Health indicators
- `src/components/atoms/TokenSelector/` - Enhanced token selector

## Current Tokens Supported

- wAR (Wrapped AR) - Primary token
- PIXL - Secondary token
- Wander - Secondary token

## Branch

`feat/dynamic-token-selection`

## Status

In Progress
