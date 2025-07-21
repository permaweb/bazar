# Bazar Token Balance and Order Tests

This directory contains TypeScript tests for the Bazar token balance and order functionality, following the same patterns as the `ao-ucm` backend tests.

## Overview

These tests verify that:

- Token balances can be fetched for all supported tokens (wAR, PIXL, Wander, AO)
- Token information can be retrieved for all tokens
- Order parameters can be validated for different tokens

### Test Types

1. **Unit Tests** (Mock Data): Validate structure and parameters without network calls
2. **Real Integration Tests** (AO Network): Test actual token functionality with real AO processes
3. **Debug Tests** (Detailed Analysis): Help identify specific issues with token balance loading, metadata, and order creation

**Note**: Real integration tests require:

- Valid wallet files with proper signing keys
- Access to the actual AO network
- Real token process IDs that are deployed and accessible

## Test Structure

The tests follow the same pattern as `ao-ucm/tests/node/src/index.ts`:

### Unit Tests (`token-balance-order.test.ts`)

- **Token Balance Tests**: Test fetching balances for wallet and profile addresses
- **Token Info Tests**: Test retrieving token metadata and information
- **Order Parameter Validation Tests**: Test validating order parameters for different tokens

### Real Integration Tests (`real-integration.test.ts`)

- **Real Token Balance Tests**: Test actual balance fetching from AO network
- **Real Token Info Tests**: Test actual token info retrieval from AO network
- **Real Order Creation Tests**: Test actual order creation with real tokens

### Debug Tests (`debug-token-issues.test.ts`)

- **Token Balance Debug**: Identify why balances show "Loading..." instead of zero
- **Wander Metadata Debug**: Investigate Wander token metadata issues
- **Order Creation Debug**: Debug why orders work with wAR but fail with other tokens

## Setup

1. Install dependencies:

```bash
cd bazar/tests
npm install
```

2. Set environment variables (optional, defaults are provided):

```bash
export UCM="your-ucm-process-id"
export DEFAULT_TOKEN="your-wAR-token-id"
export PIXL="your-PIXL-token-id"
```

3. For real integration tests, create test wallet files:

```bash
# Create wallets directory
mkdir wallets

# Add wallet files (see wallets/README.md for details)
# Example: wallets/wallet-1.json
```

**Note**: Test wallets should contain minimal funds for testing purposes only.

## Running Tests

### Unit Tests (Mock Data)

```bash
# Run all unit tests
npm test

# Run specific unit test suites
npm run test:balance    # Token balance tests only
npm run test:info       # Token info tests only
npm run test:orders     # Order parameter validation tests only
```

### Real Integration Tests (AO Network)

```bash
# Run all real integration tests
npm run test:real

# Run specific real integration test suites
npm run test:real:balance    # Real token balance tests
npm run test:real:info       # Real token info tests
npm run test:real:orders     # Real order creation tests
```

### Debug Tests (Detailed Analysis)

```bash
# Run all debug tests
npm run test:debug

# Run specific debug test suites
npm run test:debug:balance    # Debug token balance loading issues
npm run test:debug:metadata   # Debug Wander token metadata problems
npm run test:debug:orders     # Debug order creation failures
```

### From Main Bazar Directory

```bash
# Unit tests
npm run test:tokens
npm run test:tokens:balance
npm run test:tokens:info
npm run test:tokens:orders

# Real integration tests
npm run test:tokens:real
npm run test:tokens:real:balance
npm run test:tokens:real:info
npm run test:tokens:real:orders

# Debug tests
npm run test:tokens:debug
npm run test:tokens:debug:balance
npm run test:tokens:debug:metadata
npm run test:tokens:debug:orders
```

## Test Configuration

The tests use the same token registry as the frontend:

- **wAR**: `xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10`
- **PIXL**: `DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo`
- **Wander**: `L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs`
- **AO**: `UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE`

## Test Output

Tests output detailed JSON responses showing:

- Success/failure status
- Response data from AO processes
- Error messages if tests fail

## Integration with Frontend

These tests verify the same functionality that the frontend uses:

- Token balance fetching in `PermawebProvider`
- Order creation in `AssetActionMarketOrders`
- Token selection in `TokenProvider`

## Troubleshooting

### General Issues

- **Connection errors**: Ensure you have access to the AO network
- **Token not found**: Verify token process IDs are correct
- **Permission errors**: Some tests may require specific wallet permissions

### Specific Token Issues

#### Token Balance Shows "Loading..."

- Run debug tests: `npm run test:debug:balance`
- Check if token contracts return proper balance responses
- Verify wallet addresses are valid

#### Wander Token Metadata Error

- Run debug tests: `npm run test:debug:metadata`
- Wander token may not return JSON data in Info action
- Frontend may need to handle null metadata gracefully

#### Order Creation Fails with PIXL/Wander/AO

- Run debug tests: `npm run test:debug:orders`
- Check if UCM contract supports these tokens
- Verify token transfer permissions
- Compare successful wAR orders with failed token orders

#### Real Integration Test Failures

- Ensure test wallet files exist in `wallets/` directory
- Verify wallet files have proper JSON structure
- Check that wallets have minimal funds for testing

## Adding New Tests

To add new tests:

1. Add new test functions following the existing pattern
2. Update the `runAllTests()` function to include new tests
3. Add new npm scripts if needed
4. Update this README with new test descriptions
