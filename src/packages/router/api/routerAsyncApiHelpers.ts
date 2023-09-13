import { AftermathApi } from "../../../general/providers/aftermathApi";
import {
	RouterAsyncOptions,
	RouterAsyncProtocolName,
	RouterAsyncSerializablePool,
	RouterAsyncTradeResult,
	RouterAsyncTradeResults,
} from "../routerTypes";
import { Balance, CoinType } from "../../../types";
import { RouterAsyncApiInterface } from "../utils/async/routerAsyncApiInterface";
import { CetusApi } from "../../external/cetus/cetusApi";
import { TurbosApi } from "../../external/turbos/turbosApi";
import { isTurbosPoolObject } from "../../external/turbos/turbosTypes";
import { isCetusPoolObject } from "../../external/cetus/cetusTypes";
import { DeepBookApi } from "../../external/deepBook/deepBookApi";
import { isDeepBookPoolObject } from "../../external/deepBook/deepBookTypes";
import { BCS } from "@mysten/bcs";
import {
	TransactionArgument,
	TransactionBlock,
} from "@mysten/sui.js/transactions";
import { bcs } from "@mysten/sui.js/bcs";
import { Coin } from "../../coin";
import { Casting, Helpers } from "../../../general/utils";
import { isFlowXPoolObject } from "../../external/flowX/flowXTypes";
import { FlowXApi } from "../../external/flowX/flowXApi";

export class RouterAsyncApiHelpers {
	// =========================================================================
	//  Constants
	// =========================================================================

	public readonly protocolNamesToApi: Record<
		RouterAsyncProtocolName,
		() => RouterAsyncApiInterface<any>
	> = {
		Cetus: () => new CetusApi(this.Provider),
		Turbos: () => new TurbosApi(this.Provider),
		DeepBook: () => new DeepBookApi(this.Provider),
		FlowX: () => new FlowXApi(this.Provider),
	};

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(
		private readonly Provider: AftermathApi,
		private readonly options: RouterAsyncOptions
	) {}

	// =========================================================================
	//  Objects
	// =========================================================================

	public fetchAllPools = async (inputs: {
		protocols: RouterAsyncProtocolName[];
	}): Promise<RouterAsyncSerializablePool[]> => {
		const apis = this.protocolApisFromNames(inputs);

		const poolsByProtocol = await Promise.all(
			apis.map((api) => api.fetchAllPools())
		);

		const pools = poolsByProtocol.reduce(
			(arr, acc) => [...acc, ...arr],
			[]
		);
		return pools;
	};

	public filterPossiblePools = (inputs: {
		protocols: RouterAsyncProtocolName[];
		pools: RouterAsyncSerializablePool[];
		coinInType: CoinType;
		coinOutType: CoinType;
	}): {
		exactMatchPools: RouterAsyncSerializablePool[];
		partialMatchPools: RouterAsyncSerializablePool[];
	} => {
		const apis = inputs.protocols.map((protocol) =>
			this.protocolNamesToApi[protocol]()
		);

		const maxPools = this.options.maxAsyncPoolsPerProtocol;
		const allPools: {
			partialMatchPools: RouterAsyncSerializablePool[];
			exactMatchPools: RouterAsyncSerializablePool[];
		} = apis
			.map((api) => api.filterPoolsForTrade(inputs))
			.reduce(
				(acc, pools) => {
					return {
						exactMatchPools: [
							...acc.exactMatchPools,
							...pools.exactMatchPools.slice(0, maxPools),
						],
						partialMatchPools: [
							...acc.partialMatchPools,
							...pools.partialMatchPools.slice(0, maxPools),
						],
					};
				},
				{
					partialMatchPools: [],
					exactMatchPools: [],
				}
			);

		return allPools;
	};

	public fetchTradeResults = async (inputs: {
		pools: RouterAsyncSerializablePool[];
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmounts: Balance[];
	}): Promise<RouterAsyncTradeResults> => {
		const { coinInAmounts } = inputs;

		const protocols = inputs.pools.map((pool) =>
			this.protocolNameFromPool({ pool })
		);
		const apis = protocols.map((protocol) =>
			this.protocolNamesToApi[protocol]()
		);

		const resultsOrUndefined: (RouterAsyncTradeResult | undefined)[] =
			await Promise.all(
				apis.map(async (api, index) => {
					try {
						const pool = inputs.pools[index];

						const amountsOut = await Promise.all(
							coinInAmounts.map(async (amountIn) => {
								try {
									return await api.fetchTradeAmountOut({
										...inputs,
										pool,
										coinInAmount: amountIn,
									});
								} catch (e) {
									console.error(e);
									return BigInt(0);
								}
							})
						);

						const protocol = protocols[index];

						return {
							pool,
							amountsOut,
							protocol,
						};
					} catch (e) {
						return undefined;
					}
				})
			);

		const results = resultsOrUndefined.filter(
			(result) => result !== undefined
		) as RouterAsyncTradeResult[];

		return {
			...inputs,
			results,
			coinInAmounts,
		};
	};

	// =========================================================================
	//  Helpers
	// =========================================================================

	public protocolNameFromPool = (inputs: {
		pool: RouterAsyncSerializablePool;
	}): RouterAsyncProtocolName => {
		const { pool } = inputs;

		const protocolName: RouterAsyncProtocolName | undefined =
			isTurbosPoolObject(pool)
				? "Turbos"
				: isCetusPoolObject(pool)
				? "Cetus"
				: isDeepBookPoolObject(pool)
				? "DeepBook"
				: isFlowXPoolObject(pool)
				? "FlowX"
				: undefined;

		if (!protocolName)
			throw new Error("unknown RouterAsyncSerializablePool");

		return protocolName;
	};

	// =========================================================================
	//  Public Static Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	public static devInspectTradeAmountOut = async (inputs: {
		Provider: AftermathApi;
		coinInType: CoinType;
		coinOutType: CoinType;
		coinInAmount: Balance;
		devInspectTx: (inputs: {
			tx: TransactionBlock;
			coinInBytes: Uint8Array;
			routerSwapCapBytes: Uint8Array;
		}) => TransactionArgument;
	}): Promise<Balance> => {
		const tx = new TransactionBlock();
		tx.setSender(Helpers.inspections.constants.devInspectSigner);

		const coinInStructName = new Coin(inputs.coinInType).coinTypeSymbol;
		const coinOutStructName = new Coin(inputs.coinOutType).coinTypeSymbol;

		for (const coinStructName of [coinInStructName, coinOutStructName]) {
			bcs.registerStructType(coinStructName, {});
		}

		bcs.registerStructType("ID", {
			bytes: BCS.ADDRESS,
		});

		bcs.registerStructType("UID", {
			id: "ID",
		});

		bcs.registerStructType(`Balance<${coinInStructName}>`, {
			value: BCS.U64,
		});

		bcs.registerStructType(`Coin<${coinInStructName}>`, {
			id: "UID",
			balance: `Balance<${coinInStructName}>`,
		});

		/*

		struct RouterFeeMetadata has copy, drop {
			recipient: address,
			fee: u64,
		}

		struct SwapMetadata has copy, drop {
			type: vector<u8>,
			amount: u64,
		}
		
		struct RouterSwapCap<phantom CS> {
			coin_in: Coin<CS>,
			min_amount_out: u64,
			first_swap: SwapMetadata,
			previous_swap: SwapMetadata,
			final_swap: SwapMetadata,
			router_fee_metadata: RouterFeeMetadata,
			referrer: Option<address>,
		}

		*/

		bcs.registerStructType("RouterFeeMetadata", {
			recipient: BCS.ADDRESS,
			fee: BCS.U64,
		});

		bcs.registerStructType("SwapMetadata", {
			type: "vector<u8>",
			amount: BCS.U64,
		});

		bcs.registerStructType(`RouterSwapCap<${coinInStructName}>`, {
			coin_in: `Coin<${coinInStructName}>`,
			min_amount_out: BCS.U64,
			first_swap: "SwapMetadata",
			previous_swap: "SwapMetadata",
			final_swap: "SwapMetadata",
			router_fee_metadata: "RouterFeeMetadata",
			referrer: "Option<address>",
		});

		const coinInBytes = bcs
			.ser(`Coin<${coinInStructName}>`, {
				id: {
					id: {
						bytes: "0x0000000000000000000000000000000000000000000000000000000000000123",
					},
				},
				balance: {
					value: inputs.coinInAmount,
				},
			})
			.toBytes();

		const routerSwapCapBytes = bcs
			.ser(`RouterSwapCap<${coinInStructName}>`, {
				coin_in: {
					id: {
						id: {
							bytes: "0x0000000000000000000000000000000000000000000000000000000000000321",
						},
					},
					balance: {
						value: inputs.coinInAmount,
					},
				},
				min_amount_out: 0,
				first_swap: {
					type: Casting.u8VectorFromString(
						inputs.coinInType.replace("0x", "")
					),
					amount: inputs.coinInAmount,
				},
				previous_swap: {
					type: Casting.u8VectorFromString(
						inputs.coinInType.replace("0x", "")
					),
					amount: inputs.coinInAmount,
				},
				final_swap: {
					type: Casting.u8VectorFromString(
						inputs.coinOutType.replace("0x", "")
					),
					amount: 0,
				},
				router_fee_metadata: {
					recipient:
						"0x0000000000000000000000000000000000000000000000000000000000000000",
					fee: 0,
				},
				referrer: {
					None: true,
				},
			})
			.toBytes();

		inputs.devInspectTx({ tx, coinInBytes, routerSwapCapBytes });

		const resultBytes =
			await inputs.Provider.Inspections().fetchFirstBytesFromTxOutput({
				tx,
			});

		const data = bcs.de(
			`Coin<${coinOutStructName}>`,
			new Uint8Array(resultBytes)
		);

		return BigInt(data.balance.value);
	};

	// =========================================================================
	//  Private Methods
	// =========================================================================

	// =========================================================================
	//  Helpers
	// =========================================================================

	private protocolApisFromNames = (inputs: {
		protocols: RouterAsyncProtocolName[];
	}): RouterAsyncApiInterface<any>[] => {
		const { protocols } = inputs;
		return protocols.map((name) => this.protocolNamesToApi[name]());
	};
}
