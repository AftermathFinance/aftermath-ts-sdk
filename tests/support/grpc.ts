export function makeGrpcCoin(
	objectId: string,
	balance: string,
	coinType = "0x2::sui::SUI"
) {
	return {
		objectId,
		version: "1",
		digest: `digest-${objectId}`,
		owner: { $kind: "AddressOwner", AddressOwner: "0x5" },
		type: `0x2::coin::Coin<${coinType}>`,
		balance,
	};
}
