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
import { SuiApi } from "../../packages/sui/api/suiApi";
import { SuiApiHelpers } from "../../packages/sui/api/suiApiHelpers";

export class AftermathApi {
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

	public readonly Sui;
	public readonly SuiHelpers;

	/////////////////////////////////////////////////////////////////////
	//// Constructor
	/////////////////////////////////////////////////////////////////////

	public constructor(
		public readonly provider: JsonRpcProvider,
		// TODO: accept ALL addresses or remove the class instantiations
		// below to be functions not constants
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

		this.Sui = new SuiApi(this);
		this.SuiHelpers = new SuiApiHelpers(this);
	}
}
