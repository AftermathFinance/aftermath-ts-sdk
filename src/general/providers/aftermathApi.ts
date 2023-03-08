import { JsonRpcProvider } from "@mysten/sui.js";
import { ConfigAddresses } from "../types/configTypes";
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
import { WalletApi } from "../wallet/walletApi";
import { RouterApi } from "../../packages/router/api/routerApi";
import { PlaceholderPricesApi } from "../prices/placeholder/placeholderPricesApi";

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
	////  Utils
	/////////////////////////////////////////////////////////////////////

	public readonly Wallet;
	public readonly Prices;

	/////////////////////////////////////////////////////////////////////
	////  Packages
	/////////////////////////////////////////////////////////////////////

	public readonly Pools;
	public readonly Faucet;
	public readonly Coin;
	public readonly Sui;
	public readonly Router;

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
		////  Utils
		/////////////////////////////////////////////////////////////////////

		this.Wallet = new WalletApi(this);
		this.Prices = new PlaceholderPricesApi(this);

		/////////////////////////////////////////////////////////////////////
		////  Packages
		/////////////////////////////////////////////////////////////////////

		this.Pools = new PoolsApi(this);
		this.Faucet = new FaucetApi(this);
		this.Coin = new CoinApi(this);
		this.Sui = new SuiApi(this);
		this.Router = new RouterApi(this);
	}
}
