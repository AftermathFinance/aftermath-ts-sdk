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
	//// General
	/////////////////////////////////////////////////////////////////////

	public readonly DynamicFields;
	public readonly Events;
	public readonly Inspections;
	public readonly Objects;
	public readonly Transactions;
	public readonly Rpc;

	/////////////////////////////////////////////////////////////////////
	//// Utils
	/////////////////////////////////////////////////////////////////////

	public readonly Wallet;
	public readonly Prices;

	/////////////////////////////////////////////////////////////////////
	//// General Packages
	/////////////////////////////////////////////////////////////////////

	public readonly Coin;
	public readonly Sui;

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
		//// General
		/////////////////////////////////////////////////////////////////////

		this.DynamicFields = new DynamicFieldsApiHelpers(this);
		this.Events = new EventsApiHelpers(this);
		this.Inspections = new InspectionsApiHelpers(this);
		this.Objects = new ObjectsApiHelpers(this);
		this.Transactions = new TransactionsApiHelpers(this);
		this.Rpc = new RpcApiHelpers(this);

		/////////////////////////////////////////////////////////////////////
		//// Utils
		/////////////////////////////////////////////////////////////////////

		this.Wallet = new WalletApi(this);
		this.Prices = new PlaceholderPricesApi(this);

		/////////////////////////////////////////////////////////////////////
		//// General Packages
		/////////////////////////////////////////////////////////////////////

		this.Coin = new CoinApi(this);
		this.Sui = new SuiApi(this);
	}

	/////////////////////////////////////////////////////////////////////
	//// Aftermath Packages
	/////////////////////////////////////////////////////////////////////

	public Pools = () => new PoolsApi(this);
	public Faucet = () => new FaucetApi(this);
	public Router = () => new RouterApi(this);
}
