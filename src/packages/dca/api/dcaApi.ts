import { AftermathApi } from "../../../general/providers";
import { TransactionArgument, TransactionBlock } from "@mysten/sui.js/transactions";
import { Casting, Helpers } from "../../../general/utils";
import { Coin } from "../../coin";
import { 
    ApiDcaTransactionForCancelOrderBody, 
    ApiDcaTransactionForCreateOrderBody, 
    DcaOrderObject, 
    DcaOrdersObject 
} from "../dcaTypes";
import { 
    AnyObjectType,
    Balance, 
    CoinType, 
    DcaAddresses, 
    ObjectId, 
    SuiAddress, 
} from "../../../types";
import { 
    DcaIndexerOrderCancelRequest,
    DcaIndexerOrderCancelResponse,
    DcaIndexerOrderCreateRequest,
    DcaIndexerOrderCreateResponse,
    DcaIndexerOrdersRequest, 
    DcaIndexerOrdersResponse
} from "./dcaApiCastingTypes";
import { Transaction, TransactionObjectArgument } from "@mysten/sui/transactions";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { ApiMultisigUserBody } from "../../multisig/multisigTypes";

const GAS_SUI_AMOUNT = BigInt(5_000_000);                   // 0.005 SUI
const ORDER_MAX_ALLOWABLE_SLIPPAGE_BPS = BigInt(10000);     // Maximum valued
    
export class DcaApi {

    // =========================================================================
    // Constants
    // =========================================================================

    private static readonly constants = {
        moduleNames: {
            dca: "order",
            events: "events",
            config: "config"
        },
        eventNames: {
            createdOrder: "CreatedOrderEvent",
            closedOrder: "CancelledOrderEvent",
            executedTrade: "ExecutedTradeEvent",
        }
    }

    // =========================================================================
    // Class Members
    // =========================================================================

    public readonly addresses: DcaAddresses;
    public readonly eventTypes: {
        createdOrder: AnyObjectType;
        closedOrder: AnyObjectType;
        executedTrade: AnyObjectType;
    }

    // =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly Provider: AftermathApi) {
        const addresses = this.Provider.addresses.dca;
		if (!addresses)
			throw new Error(
				"not all required addresses have been set in provider"
			);

		this.addresses = addresses;
        this.eventTypes = {
            createdOrder: this.createdOrderEventType(),
            closedOrder: this.closedOrderEventType(),
            executedTrade: this.executedOrderEventType(),
        }
    }

    // =========================================================================
	//  Public Transaction Methods
	// =========================================================================

    public fetchBuildCreateOrderTx = async (
        inputs: ApiDcaTransactionForCreateOrderBody
    ): Promise<Transaction> => {
        const { walletAddress } = inputs;
        const tx = new Transaction();
        tx.setSender(walletAddress);

        const tradesGasAmount = BigInt(inputs.tradesAmount) * GAS_SUI_AMOUNT;
        const orderAmountPerTrade = inputs.allocateCoinAmount / BigInt(inputs.tradesAmount);
        const recipientAddress = inputs.customRecipient ? inputs.customRecipient : walletAddress;

        const [gasCoinTxArg, inputCoinTxArg] = await Promise.all([
            this.Provider.Coin().fetchCoinWithAmountTx({
                tx,
                walletAddress,
                coinType: Coin.constants.suiCoinType,
                coinAmount: tradesGasAmount,                    
                isSponsoredTx: inputs.isSponsoredTx
            }),
            this.Provider.Coin().fetchCoinWithAmountTx({
                tx,
                walletAddress,
                coinType: inputs.allocateCoinType,
                coinAmount: inputs.allocateCoinAmount,
                isSponsoredTx: inputs.isSponsoredTx
            })
        ])
        
        const resultTx = await this.createNewOrderTx({
            ...inputs,
            tx,
            gasCoinTxArg,
            inputCoinTxArg,
            orderAmountPerTrade,
            recipientAddress,
        });

        return resultTx;
    };

    public fetchBuildCancelOrderTx = async (
        inputs: ApiDcaTransactionForCancelOrderBody
        ): Promise<Transaction> =>  {
        const { walletAddress, userPublicKey } = inputs;
        const tx = await this.getSponsorTransaction(walletAddress);
        const pulicKey = Uint8Array.from(Buffer.from(userPublicKey, "hex"))
        const multisig = await this.Provider.Multisig().fetchMultisigForUser({
            userPublicKey: pulicKey
        });
        tx.setSender(multisig.address);
        this.createCancelOrderTx({
            ...inputs,
            tx,
        });
        return tx;
    }

    // =========================================================================
    // Transaction Commands
    // =========================================================================

    public createNewOrderTx = async (inputs: {
        tx: Transaction,
        inputCoinTxArg: TransactionObjectArgument,
        gasCoinTxArg: TransactionObjectArgument,
        recipientAddress: SuiAddress,
        orderAmountPerTrade: Balance,
    } & ApiDcaTransactionForCreateOrderBody) => {
        const initTx = inputs.tx ?? new Transaction();

        const txBytes = await initTx.build({
			client: this.Provider.provider,
			onlyTransactionKind: true,
		});

		const b64TxBytes = Buffer.from(txBytes).toString("base64");

        const { tx_data } =
			await this.Provider.indexerCaller.fetchIndexer<
                DcaIndexerOrderCreateResponse,
                DcaIndexerOrderCreateRequest
			>(
				"dca/create",
				{
                    tx_kind: b64TxBytes,
					order: {
                        input_coin: Helpers.transactions.serviceCoinDataFromCoinTxArg({
                            coinTxArg: inputs.inputCoinTxArg,
                        }),
                        input_coin_type: inputs.allocateCoinType,
                        output_coin_type: inputs.buyCoinType,
                        gas_coin: Helpers.transactions.serviceCoinDataFromCoinTxArg({
                            coinTxArg: inputs.gasCoinTxArg,
                        }),
                        owner: inputs.walletAddress,
                        user_pk: inputs.publicKey,
                        recipient: inputs.recipientAddress,
                        frequency_ms: inputs.frequencyMs.toString(),
                        delay_timestamp_ms: inputs.delayTimeMs.toString(),
                        amount_per_trade: inputs.orderAmountPerTrade.toString(),
                        max_allowable_slippage_bps: Number(ORDER_MAX_ALLOWABLE_SLIPPAGE_BPS),
                        min_amount_out: (inputs.straregy?.priceMin ?? 0).toString().replace("n", ""),
                        max_amount_out: (inputs.straregy?.priceMax ?? Casting.u64MaxBigInt).toString().replace("n", ""),
                        number_of_trades: Number(inputs.tradesAmount)
                    }
				},
				undefined,
				undefined,
				undefined,
				true
			);

        const tx = Transaction.fromKind(tx_data);
        DcaApi.transferTxMetadata({
			initTx,
			newTx: tx,
		});
        return tx;
    }

    public createCancelOrderTx = (inputs: {
        tx: Transaction | TransactionBlock,
        allocateCoinType: CoinType,
        buyCoinType: CoinType,
        orderId: ObjectId | TransactionArgument
    }) => {
        const { tx } = inputs;
        return tx.moveCall({
            target: Helpers.transactions.createTxTarget(
                this.addresses.packages.dca,
                DcaApi.constants.moduleNames.dca,
                "close_order"
            ),
            typeArguments: [inputs.allocateCoinType, inputs.buyCoinType],
            arguments: [
                tx.object(inputs.orderId),
                tx.object(this.addresses.objects.config),
            ],
        });
    }

    // =========================================================================
    // Class Objects
    // =========================================================================

    public fetchAllOrdersObjects = async (inputs: {
        walletAddress: SuiAddress;
    }): Promise<DcaOrdersObject> => {
        const [
            activeOrders = [], 
            pastOrders = []
        ] = await Promise.all([
            this.fetchActiveOrdersObjects(inputs),
            this.fetchPastOrdersObjects(inputs)
        ])
        return {
            active: activeOrders,
            past: pastOrders
        }
    }

    public fetchActiveOrdersObjects = async (inputs: {
        walletAddress: SuiAddress
    }): Promise<DcaOrderObject[]> => {
        return this.fetchOrdersObjectsByType({
            ...inputs, 
            type: "active"
        });
    }

    public fetchPastOrdersObjects = async (inputs: {
        walletAddress: SuiAddress
    }): Promise<DcaOrderObject[]> => {
        return this.fetchOrdersObjectsByType({
            ...inputs, 
            type: "past"
        });
    }

    public fetchOrdersObjectsByType = async (inputs: {
        walletAddress: SuiAddress,
        type: "active" | "past"
    }): Promise<DcaOrderObject[]> => {
        const {
            type,
            walletAddress
        } = inputs;
        try {
            const uncastedResponse = 
                await this.Provider.indexerCaller.fetchIndexer<
                    DcaIndexerOrdersResponse, 
                    DcaIndexerOrdersRequest
                >(
                    `dca/get/${type}`, 
                    {
                        sender: walletAddress,
                    },
                    undefined,
                    undefined,
                    undefined,
                    true
                );
            return uncastedResponse.orders
                .sort((lhs, rhs) => rhs.created.timestamp - lhs.created.timestamp)
                .map(order => Casting.dca.createdOrderEventOnIndexer(order));
        } catch (error) {
            return [];
        }
    }

    public fetchOrderExecutionPause = async (
		inputs: DcaIndexerOrderCancelRequest
	): Promise<DcaIndexerOrderCancelResponse> => {
        const { order_object_id } = inputs;
        return this.Provider.indexerCaller.fetchIndexer<
            DcaIndexerOrderCancelResponse,
            DcaIndexerOrderCancelRequest
        >(
            "dca/cancel", 
            {
                order_object_id
            },
            undefined,
            undefined,
            undefined,
            true
        );
    }

    // =========================================================================
    // Events
    // =========================================================================

    private createdOrderEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdOrder
		);
    
    private closedOrderEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.closedOrder
		);

    private executedOrderEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.dca,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.executedTrade
		);

    // =========================================================================
    // Helpers
    // =========================================================================

    private getSponsorTransaction = async (
        sponsor: SuiAddress
    ): Promise<Transaction> => {
        const txBlock = new Transaction();
        const kindBytes = await txBlock.build({ onlyTransactionKind: true });
        const tx = Transaction.fromKind(kindBytes);
        tx.setGasOwner(sponsor);
        return tx;
    }

    private static transferTxMetadata = (inputs: {
		initTx: Transaction;
		newTx: Transaction;
	}) => {
		const { initTx, newTx } = inputs;

		const sender = initTx.getData().sender;
		if (sender) newTx.setSender(sender);

		const expiration = initTx.getData().expiration;
		if (expiration) newTx.setExpiration(expiration);

		const gasData = initTx.getData().gasData;

		if (gasData.budget && typeof gasData.budget !== "string")
			newTx.setGasBudget(gasData.budget);

		if (gasData.owner) newTx.setGasOwner(gasData.owner);

		if (gasData.payment) newTx.setGasPayment(gasData.payment);

		if (gasData.price && typeof gasData.price !== "string")
			newTx.setGasPrice(gasData.price);

        console.log({
            gasData,
            budget: gasData.budget,
            owner: gasData.owner,
            payment: gasData.payment,
        })
	};
}
