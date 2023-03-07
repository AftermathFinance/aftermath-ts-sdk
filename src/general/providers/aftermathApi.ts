import { JsonRpcProvider } from "@mysten/sui.js";
import { ConfigAddresses } from "../types/configTypes";
import { PoolsApiHelpers } from "../../packages/pools/api/poolsApiHelpers";
import { FaucetApiHelpers } from "../../packages/faucet/api/faucetApiHelpers";
import { CoinApiHelpers } from "../../packages/coin/api/coinApiHelpers";
import { PoolsApi } from "../../packages/pools/api/poolsApi";
import { FaucetApi } from "../../packages/faucet/api/faucetApi";
import { CoinApi } from "../../packages/coin/api/coinApi";
import { DynamicFieldsApiHelpers } from "../api/dynamicFieldsApiHelpers";
import { EventsApiHelpers } from "../api/eventsApiHelpers";
import { InspectionsApiHelpers } from "../api/inspectionsApiHelpers";
import { ObjectsApiHelpers } from "../api/objectsApiHelpers";
import { RpcApiHelpers } from "../api/rpcApiHelpers";
import { TransactionsApiHelpers } from "../api/transactionsApiHelpers";

export class AftermathApi {
	/////////////////////////////////////////////////////////////////////
	//// Constants
	/////////////////////////////////////////////////////////////////////

	public static readonly constants = {
		// TODO: change this into modules ?
		packages: {
			sui: {
				packageId: "0x0000000000000000000000000000000000000002",
				systemStateId: "0x0000000000000000000000000000000000000005",
			},
		},
	};

	/////////////////////////////////////////////////////////////////////
	//// Class Object Class Members
	/////////////////////////////////////////////////////////////////////

	/////////////////////////////////////////////////////////////////////
	////  General
	/////////////////////////////////////////////////////////////////////

	public readonly DynamicFields;
	public readonly Events;
	public readonly Inspections;
	public readonly Objects;
	public readonly Transactions;
	public readonly Rpc;

	/////////////////////////////////////////////////////////////////////
	////  Packages
	/////////////////////////////////////////////////////////////////////

	public readonly Pools;
	public readonly PoolsHelpers;

	public readonly Faucet;
	public readonly FaucetHelpers;

	public readonly Coin;
	public readonly CoinHelpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	public constructor(
		public readonly provider: JsonRpcProvider,
		public readonly addresses: Partial<ConfigAddresses>
	) {
		this.provider = provider;

		/////////////////////////////////////////////////////////////////////
		//// Class Object Creation
		/////////////////////////////////////////////////////////////////////

		/////////////////////////////////////////////////////////////////////
		////  General
		/////////////////////////////////////////////////////////////////////

		this.DynamicFields = new DynamicFieldsApiHelpers(this);
		this.Events = new EventsApiHelpers(this);
		this.Inspections = new InspectionsApiHelpers(this);
		this.Objects = new ObjectsApiHelpers(this);
		this.Transactions = new TransactionsApiHelpers(this);
		this.Rpc = new RpcApiHelpers(this);

		/////////////////////////////////////////////////////////////////////
		////  Packages
		/////////////////////////////////////////////////////////////////////

		this.Pools = new PoolsApi(this);
		this.PoolsHelpers = new PoolsApiHelpers(this);

		this.Faucet = new FaucetApi(this);
		this.FaucetHelpers = new FaucetApiHelpers(this);

		this.Coin = new CoinApi(this);
		this.CoinHelpers = new CoinApiHelpers(this);
	}
}
