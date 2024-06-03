import { TransactionBlock } from "@mysten/sui.js/transactions";
import { ApiDcaInitializeVaultBody, DcaCreatedVaultEvent, DcaVaultObject } from "../dcaTypes";
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

    public fetchDcaVaultObjects = async (inputs: {
        walletAddress: SuiAddress;   
    }): Promise<DcaVaultObject[]> => {
        const { walletAddress } = inputs;
        console.log({
            function: "fetchDcaVaultObjects",
            walletAddress: walletAddress
        })
        return [];
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
    