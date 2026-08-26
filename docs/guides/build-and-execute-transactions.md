# Build and execute a transaction

Use a package transaction builder to obtain an unsigned Sui `Transaction`. The
SDK does not sign or execute that transaction. Your wallet or signer must
authorize and submit it.

This guide assumes that you installed `aftermath-ts-sdk` and its
`@mysten/sui` 2.x peer dependency. It also assumes that you have a wallet
address, a signer for that address, and any package-specific on-chain objects
that the builder requires.

## Build an unsigned transaction

The staking builder shows the complete caller path:

```ts
import { Aftermath } from "aftermath-ts-sdk";

const sdk = await Aftermath.create({ network: "MAINNET" });

// Replace these example addresses with addresses on the selected network.
const walletAddress = "0x1";
const validatorAddress = "0x4";

const tx = await sdk.Staking().getStakeTransaction({
	walletAddress,
	suiStakeAmount: 1_000_000_000n,
	validatorAddress,
});
```

`getStakeTransaction` returns a Sui `Transaction`, sets `walletAddress` as the
sender, performs gRPC coin selection, and does not submit the transaction. The
validator must be active, and the wallet must have enough SUI for the stake and
gas. The example addresses are syntactically valid placeholders. Replace them
with addresses that exist on the selected network.

Other builders use package-specific method names and input types. Read the
method's generated reference entry before constructing its input object.

## Sign and execute the transaction

Pass the returned `Transaction` to the wallet integration used by your
application. The SDK does not provide a universal signer because wallet
adapters own account access, signature prompts, and transaction submission.

For `getStakeTransaction`, the builder has already set the sender. If another
builder leaves the sender unset, set it with the `Transaction.setSender` method
before signing. The sender must match the address controlled by the signer.

Do not treat a failed builder request and a failed on-chain execution as the
same error. Coin selection and HTTP or gRPC calls can fail while the SDK builds
the transaction. A Move abort, insufficient gas, or rejected signature occurs
when another system signs or executes the transaction.

## Keep amounts and time values exact

Use `bigint` for `Balance` values. Most token amounts use the coin's smallest
unit. The staking example uses MIST, so `1_000_000_000n` is 1 SUI.

Read each input type for time units. Fields ending in `Ms`, such as
`frequencyMs` and `expiryDurationMs`, use milliseconds. Do not convert a large
on-chain amount to a JavaScript `number` before the calculation is complete.

## Distinguish transactions, serialized data, and previews

Check the method's return type before passing its result to a wallet:

- A `Transaction` is a programmable transaction block that a Sui wallet can sign.
- A serialized transaction is a string representation. It is not a
  `Transaction` instance, so use the wallet or service API that accepts that
  representation.
- A method with `Preview` in its name returns calculated or validation data. It
  does not submit an on-chain transaction.

Method names do not guarantee the return representation. A method named
`get...Tx` can return a `Transaction`, a serialized value, or a response object.
Use the generated signature and method documentation as the contract.

## Use sponsored or dynamic-gas flows

Some package input types include `isSponsoredTx` or sponsor-specific fields.
Follow the package method's input type and keep the wallet address, transaction
representation, and sponsor data in one signing flow.

`sdk.DynamicGas().getUseDynamicGasForTx` is a separate HTTP service. It
serializes a `Transaction` with `Transaction.toJSON()` and sends the serialized
transaction, `walletAddress`, and `gasCoinType` to Aftermath. It returns
`txBytes` and `sponsoredSignature`. It does not return a `Transaction`, sign the
transaction, or execute it.

Use [Configure and bootstrap the SDK](./configure-and-bootstrap.md) for client
ownership and [Understand the provider layers](../explanation/provider-layers.md)
for the transport boundary.
