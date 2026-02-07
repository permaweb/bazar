# Bazar

Welcome to Bazar, a fully decentralized atomic asset exchange built on the permaweb. Bazar leverages the power of the [Universal Content Marketplace (UCM)](https://github.com/permaweb/ao-ucm) protocol, [AO](https://ao.arweave.net) and the [Universal Data License](https://udlicense.arweave.net/ 'UDL') to enable content creators to trade digital assets with real-world rights.

## AO Overview

AO is a hyper-parallel computing system built on the Arweave network, offering a unified environment for executing decentralized applications and smart contracts. Unlike traditional decentralized computer systems, AO provides an open message passing layer that connects parallel processes, creating a cohesive computing experience similar to websites linked through hyperlinks.

AO enables computation without protocol-enforced limitations on size and form while ensuring network verifiability and trust minimization. For a more detailed breakdown of AO, visit the [core repository](https://github.com/permaweb/ao?tab=readme-ov-file#what-is-ao).

Orders on Bazar are fulfilled by a trustless orderbook process built on AO, called the Universal Content Marketplace.

## UCM Overview

The Universal Content Marketplace (UCM) is a protocol built on the permaweb designed to enable trustless exchange of atomic assets. It empowers creators and users to interact, trade, and transact with any form of digital content, from images and music to videos, papers, components, and even applications. Bazar is the first user interface that operates on the Universal Content Marketplace (UCM) protocol.

## Development

#### Prerequisites

Before running Bazar, ensure the following dependencies are installed:

- Node.js version 18.0 or higher
- `npm`

#### Development

Run the development server:

```
npm install
```

```
npm run start:development
```

This will launch the app locally at http://localhost:3000. Port configurations can be modified in `vite.config.js`

## License

ISC
