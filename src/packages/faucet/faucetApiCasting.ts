export class FaucetApiCasting {
	/////////////////////////////////////////////////////////////////////
	//// Casting
	/////////////////////////////////////////////////////////////////////

	public static faucetMintCoinEventFromOnChain = (
		eventOnChain: FaucetMintCoinEventOnChain
	) => {
		const fields = eventOnChain.event.moveEvent.fields;
		return {
			minter: fields.user,
			coinMinted: fields.type,
			balanceMinted: BigInt(fields.amount),
			timestamp: eventOnChain.timestamp,
			txnDigest: eventOnChain.txDigest,
		} as FaucetMintCoinEvent;
	};
}
