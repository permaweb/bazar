# Test Wallets for AO Network Testing

This directory contains test wallet files for running real integration tests against the AO network.

## Setup Instructions

### 1. Create Test Wallets

You can create test wallets using the AO CLI or Arweave wallet tools:

```bash
# Using AO CLI (if available)
ao wallet create --name test-wallet-1

# Or using Arweave wallet tools
# Download wallet files and place them here
```

### 2. Wallet File Structure

Each wallet file should be a JSON file with the following structure:

```json
{
	"address": "your-arweave-address",
	"key": "your-private-key-data",
	"type": "arweave"
}
```

### 3. Required Wallets

For comprehensive testing, you'll need:

- `wallet-1.json` - Primary test wallet
- `wallet-2.json` - Secondary test wallet (for transfers)
- `wallet-3.json` - Tertiary test wallet (for multi-user scenarios)

### 4. Security Note

⚠️ **IMPORTANT**: These are test wallets only. Never use real wallets with significant funds for testing.

### 5. Environment Variables

Set these environment variables for testing:

```bash
export AO_TEST_WALLET_1="path/to/wallet-1.json"
export AO_TEST_WALLET_2="path/to/wallet-2.json"
export AO_TEST_WALLET_3="path/to/wallet-3.json"
```

## Example Wallet Creation

If you don't have wallet files, you can create them using the Arweave wallet extension or other Arweave wallet tools and export the JSON format.
