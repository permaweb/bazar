## Integrations

The Bazar ecosystem provides several integration points for developers looking to build on top of our platform or incorporate Bazar functionality into their applications.

### Contract Addresses

Here are the key process IDs for integrating with Bazar:

- **Universal Content Marketplace (UCM)**: `process.env.UCM`
- **UCM Activity**: `process.env.UCM_ACTIVITY`
- **PIXL Token**: `process.env.PIXL`
- **Collections Registry**: `process.env.COLLECTIONS_REGISTRY`
- **Profile Registry**: `process.env.PROFILE_REGISTRY`
- **Profile Source**: `process.env.PROFILE_SRC`

Note: These values are environment variables populated at build time. For the most current contract addresses, refer to the latest deployed version or contact the Bazar team.

### JavaScript SDKs

The Bazar ecosystem uses several JavaScript SDKs that you can incorporate in your projects:

1. **@permaweb/aoconnect** - Core library for interacting with AO processes

   ```bash
   npm install @permaweb/aoconnect
   ```

2. **@permaweb/stampjs** - Library for working with Arweave Stamps

   ```bash
   npm install @permaweb/stampjs
   ```

3. **@permaweb/ucm** - SDK for interacting with the Universal Content Marketplace

   ```bash
   npm install @permaweb/ucm
   ```

4. **@permaweb/aoprofile** - SDK for working with AO Profiles
   ```bash
   npm install @permaweb/aoprofile
   ```

### Integration Examples

#### Embedding Bazar Assets

You can embed Bazar assets in your applications using iframe:

```html
<iframe src="https://bazar.arweave.net/#/asset/[ASSET_ID]" width="500" height="500" frameborder="0"> </iframe>
```

#### Linking to Bazar

You can link directly to assets, collections, or profiles:

```
Asset: https://bazar.arweave.net/#/asset/[ASSET_ID]
Collection: https://bazar.arweave.net/#/collection/[COLLECTION_ID]/assets
Profile: https://bazar.arweave.net/#/profile/[PROFILE_ID]/assets
```

#### API Integration

While Bazar doesn't provide a traditional REST API, you can interact with the underlying AO processes directly using the aoconnect library:

```js
import { aos } from '@permaweb/aoconnect';
import { createDataItemSigner } from '@permaweb/aoconnect';

// Query the UCM for available orders
const message = await aos.message({
	process: process.env.UCM,
	signer: createDataItemSigner(window.arweaveWallet),
	tags: [{ name: 'Action', value: 'Get-Orders' }],
});

const result = await aos.result({
	message,
	process: process.env.UCM,
});

console.log('Available orders:', result);
```

For additional integration support, join the Bazar community on Discord or GitHub.
