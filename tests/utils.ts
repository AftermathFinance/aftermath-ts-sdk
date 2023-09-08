import {
	Ed25519Keypair,
	ObjectId,
	RawSigner,
	SuiAddress,
	SuiObjectChange,
	SuiObjectChangeCreated,
} from "@mysten/sui.js";
import { fromB64 } from "@mysten/bcs";
import { AftermathApi } from "../src/general/providers";
import { PerpetualsAccount, PerpetualsMarket } from "../src/packages";

export const adminPrivateKey = "AFHMjegm2IwuiLemXb6o7XvuDL7xn1JTHc66CZefYY+B";
export const user1PrivateKey = "AOzplQlAK2Uznvog7xmcMtlFC+DfuJx3axo9lfyI876G";
export const user2PrivateKey = "AI1I9i3mk2e1kAjPnB7fKiqquxc1OjjAkkpQPIk9Id5Q";
export const user3PrivateKey = "AIUAgL5jYMzf0JPCmc263Ou6tH5Z/HuAdtWFFUiz8Zc0";
export const user4PrivateKey = "AAu4ySMvq2wygxl/Ze6AGgkYfxg+rzUElj7UxxI6NHBI";
export const ASK = true;
export const BID = false;
export const LOT_SIZE = BigInt(1000000);
export const TICK_SIZE = BigInt(1000);
export const BRANCH_MIN = BigInt(25);
export const BRANCH_MAX = BigInt(75);
export const LEAF_MIN = BigInt(2);
export const LEAF_MAX = BigInt(4);
export const BRANCHES_MERGE_MAX = BigInt(55);
export const LEAVES_MERGE_MAX = BigInt(4);
export const ONE_B9 = BigInt(1_000_000_000); // 9 decimal places
export const ONE_F18 = BigInt(1_000_000_000_000_000_000); // 18 decimal places
export const MARKET_ID0 = BigInt(0);
export const MARKET_ID1 = BigInt(1);

export const getSigner = (
	private_key: string,
	providerApi: AftermathApi
): RawSigner => {
	const decoded_array_buffer = fromB64(private_key); // UInt8Array
	const decoded_array = Array.from(decoded_array_buffer);
	decoded_array.shift(); // shift the scheme flag byte which should be 0 since it is ed25519
	const seed = Uint8Array.from(decoded_array);
	const keypair = Ed25519Keypair.fromSecretKey(seed);
	return new RawSigner(keypair, providerApi.provider);
};

export const fromOraclePriceToOrderbookPrice = (
	oracle_price: bigint,
	lot_size: bigint,
	tick_size: bigint
): bigint => {
	oracle_price = oracle_price / ONE_B9; // convert f18 to b9 (assuming the former is positive)
	return oracle_price / tick_size / (ONE_B9 / lot_size);
};

export async function getPerpetualsAccount(
	aftermathApi: AftermathApi,
	walletAddress: SuiAddress,
	accountId: bigint,
	coinType: string
): Promise<PerpetualsAccount> {
	let accountObj = await aftermathApi
		.Perpetuals()
		.fetchAccount({ coinType, accountId });
	let accCap = await aftermathApi.Perpetuals().fetchOwnedAccountCapsOfType({
		walletAddress,
		coinType,
	});
	return new PerpetualsAccount(
		accountObj,
		accCap[0],
		aftermathApi.provider.connection.fullnode
	);
}

export async function getPerpetualsMarket(
	aftermathApi: AftermathApi,
	marketId: bigint,
	coinType: string
): Promise<PerpetualsMarket> {
	let marketParams = await aftermathApi
		.Perpetuals()
		.fetchMarketParams({ coinType, marketId });
	let marketState = await aftermathApi
		.Perpetuals()
		.fetchMarketState({ coinType, marketId });
	return new PerpetualsMarket(
		marketId,
		marketParams,
		marketState,
		aftermathApi.provider.connection.fullnode
	);
}

export function printAccountMetrics(
	account: PerpetualsAccount,
	markets: PerpetualsMarket[],
	indexPrices: number[],
	collateralPrice: number
) {
	console.log(account);

	console.log(
		"Unrealized Fundings: ",
		account.calcUnrealizedFundingsForAccount({
			markets,
		})
	);

	console.log(
		"[PnL, MinInitMargin, MinMaintMargin, AbsNetValue]: ",
		account.calcPnLAndMarginForAccount({
			markets,
			indexPrices,
			collateralPrice,
		})
	);

	console.log(
		"Margin Ratio: ",
		account.calcMarginRatio({
			markets,
			indexPrices,
			collateralPrice,
		})
	);

	console.log(
		"Free Collateral: ",
		account.calcFreeCollateral({
			markets,
			indexPrices,
			collateralPrice,
		})
	);
}

export async function createAndFetchAccountCap(
	signer: RawSigner,
	aftermathApi: AftermathApi,
	coinType: string
): Promise<ObjectId> {
	let tx = await aftermathApi.Perpetuals().fetchCreateAccountTx({
		walletAddress: await signer.getAddress(),
		coinType,
	});
	let response = await signer.signAndExecuteTransactionBlock({
		transactionBlock: tx,
		requestType: "WaitForLocalExecution",
		options: { showObjectChanges: true },
	});
	let change = response.objectChanges?.find(
		isAccountCapCreated
	) as SuiObjectChangeCreated;

	return change.objectId;
}

function isAccountCapCreated(change: SuiObjectChange): boolean {
	return (
		change.type === "created" && change.objectType.includes("AccountCap")
	);
}
