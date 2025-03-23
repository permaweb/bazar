## Universal Content Marketplace (UCM)

**Overview**

The Universal Content Marketplace (UCM) is a protocol built on the permaweb designed to enable trustless exchange of atomic assets. It empowers creators and users to interact, trade, and transact with any form of digital content, from images and music to videos, papers, components, and even applications.

**How it works**

The UCM functions by accepting a deposit from a buyer or seller and fulfilling orders based on the swap pair, quantity, and possibly price that are passed along with the deposit. Here is a list of actions that take place to complete a UCM order.

1. A user deposits (transfers) their tokens to the UCM. The user will also have to add additional tags to the **Transfer Message** which are forwarded to the UCM process and will be used to create the order.
2. The token process issues a **Credit-Notice** to the UCM and a **Debit-Notice** to the user.
3. The UCM **Credit-Notice Handler** determines if the required tags are present in order to create the order.
4. The UCM uses the forwarded tags passed to the **Transfer Handler** to submit an order to the orderbook. The order creation input includes the swap pair to execute on, as well as the quantity of tokens and price of tokens if the order is a limit order.

#### Creating orders

##### AOS

**Deposit (Transfer)**

```lua
Send({
	Target = TOKEN_PROCESS,
	Action = 'Transfer'
	Tags = {
		'Recipient' = UCM_PROCESS,
		'Quantity' = ORDER_QUANTITY,
		'X-Quantity' = ORDER_QUANTITY,
		'X-Swap-Token' = SWAP_TOKEN,
		'X-Price' = UNIT_PRICE,
		'X-Order-Action' = 'Create-Order'
	}
})
```

#### NodeJS

**Deposit (Transfer)**

```js
const response = await messageResults({
	processId: arProvider.profile.id,
	action: 'Transfer',
	wallet: arProvider.wallet,
	tags: transferTags,
	data: {
		Target: dominantToken,
		Recipient: recipient,
		Quantity: calculatedQuantity,
	},
	responses: ['Transfer-Success', 'Transfer-Error'],
	handler: 'Create-Order',
});
```

```js
const response = await message({
	process: TOKEN_PROCESS,
	signer: createDataItemSigner(global.window.arweaveWallet),
	tags: [
		{ name: 'Action', value: 'Transfer' },
		{ name: 'Recipient', value: UCM_PROCESS },
		{ name: 'Quantity', value: ORDER_QUANTITY },
		{ name: 'X-Quantity', value: ORDER_QUANTITY },
		{ name: 'X-Swap-Token', value: SWAP_TOKEN },
		{ name: 'X-Price', value: ORDER_PRICE },
		{ name: 'X-Order-Action', value: 'Create-Order' },
	],
});
```
