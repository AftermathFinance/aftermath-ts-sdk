import { TransactionBlock } from "@mysten/sui.js/transactions";
import { ApiDcaInitializeVaultBody, DcaCreatedVaultEvent, DcaVaultsOjbect } from "../dcaTypes";
import { AftermathApi } from "../../../general/providers";
import { AnyObjectType, DcaAddresses, EventsInputs, SuiAddress } from "../../../types";
import { EventsApiHelpers } from "../../../general/apiHelpers/eventsApiHelpers";
import { DcaCreatedVaultEventOnChain } from "./dcaApiCastingTypes";
import { Casting } from "../../../general/utils";

    
export class DcaApi {

    // =========================================================================
    // Constants
    // =========================================================================

    private static readonly constants = {
        moduleNames: {
            events: "events",
        },
        eventNames: {
            createdVault: "CreatedVaultEvent",
        }
    }

    // =========================================================================
    // Class Members
    // =========================================================================

    public readonly addresses: DcaAddresses;

    public readonly eventTypes: {
        createdVault: AnyObjectType;
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
            // Creation
            createdVault: this.createdVaultEventType(),
        }
    }

    // =========================================================================
	//  Public Methods
	// =========================================================================

    public fetchBuildCreateVault = async (
        inputs: ApiDcaInitializeVaultBody
    ): Promise<TransactionBlock> => {
        const { walletAddress } = inputs;
        const tx = new TransactionBlock();
        tx.setSender(walletAddress);
        
        // Todo: - Setup transaction

        return tx;
    };

    // =========================================================================
    // Class Objects
    // =========================================================================

    public fetchDcaVaultsObject = async (inputs: {
        walletAddress: SuiAddress;   
    }): Promise<DcaVaultsOjbect> => {
        const { walletAddress } = inputs;
        console.log({
            function: "fetchDcaVaultObjects",
            walletAddress: walletAddress
        })
        return {
            active: [
                {
                    currentAllocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                    currentAllocatedCoinAmount: BigInt(0),
                    currentBuyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                    currentBuyCoinAmount: BigInt(0),
                    widthrowAmount: BigInt(0),
                    totalDeposited: BigInt(0),
                    totalSpent: BigInt(0),
                    averagePrice: BigInt(0),
                    interval: BigInt(0),
                    ordersRemaining: BigInt(0),
                    orders: [
                        {
                            allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            allocatedCoinAmount: BigInt(1000000000000),
                            buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            buyCoinAmount: BigInt(83000000),
                            buyDate: 1715456204000
                        },
                        {
                            allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                            allocatedCoinAmount: BigInt(1000000000000),
                            buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                            buyCoinAmount: BigInt(83000000),
                            buyDate: 1715456204000
                        }
                    ]
                }
            ],
            past: [
                {
                    currentAllocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                    currentAllocatedCoinAmount: BigInt(0),
                    currentBuyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                    currentBuyCoinAmount: BigInt(0),
                    widthrowAmount: BigInt(0),
                    totalDeposited: BigInt(0),
                    totalSpent: BigInt(0),
                    averagePrice: BigInt(0),
                    interval: BigInt(0),
                    ordersRemaining: BigInt(0),
                    orders: [{
                        allocatedCoin: "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN",
                        allocatedCoinAmount: BigInt(1000000000000),
                        buyCoin: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
                        buyCoinAmount: BigInt(83000000),
                        buyDate: 1715456204000
                    }]
                }
            ]
        };
    }

    // =========================================================================
    // Events
    // =========================================================================

    public fetchCreatedVaultEvents = (inputs: EventsInputs) =>
		this.Provider.Events().fetchCastEventsWithCursor<
			DcaCreatedVaultEventOnChain,
			DcaCreatedVaultEvent
		>({
			...inputs,
			query: {
				MoveEventType: this.eventTypes.createdVault,
			},
			eventFromEventOnChain: Casting.dca.createdVaultEventFromOnChain,
		});

    // =========================================================================
    // Vault Creation
    // =========================================================================

    private createdVaultEventType = () => 
		EventsApiHelpers.createEventType(
			this.addresses.packages.vaultsInitial,
			DcaApi.constants.moduleNames.events,
			DcaApi.constants.eventNames.createdVault
		);
}
    