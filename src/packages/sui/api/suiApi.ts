import type { CommitteeInfo, SuiSystemStateSummary } from "@mysten/sui/jsonRpc";
import { AftermathApi } from "../../../general/providers/aftermathApi";
import { Helpers } from "../../../general/utils";

export class SuiApi {
	// =========================================================================
	//  Class Members
	// =========================================================================

	// =========================================================================
	//  Constructor
	// =========================================================================

	constructor(private readonly api: AftermathApi) {}

	// =========================================================================
	//  Inspections
	// =========================================================================

	/**
	 * @deprecated Use `getSystemState()` method instead.
	 * This method will be removed in a future release.
	 *
	 * @remarks **Remaining JSON-RPC surface** — see
	 * {@link AftermathApi.jsonRpcClient}. gRPC has no `SuiSystemStateSummary`
	 * equivalent. `client.core.getCurrentSystemState()` carries no validators at
	 * all, and while `client.ledgerService.getEpoch({ readMask: { paths:
	 * ["system_state"] } })` does return them (verified: 125 active validators on
	 * mainnet, under the runtime key `validators`, not the generated
	 * `validatorSet`), its validator shape is not a superset of
	 * `SuiValidatorSummary`: keys are renamed (`address`/`p2PAddress`/
	 * `networkAddress`/`protocolPublicKey` vs `suiAddress`/`p2pAddress`/
	 * `netAddress`/`protocolPubkeyBytes`), the staking-pool fields are nested
	 * rather than flattened, numbers are `bigint` rather than decimal strings,
	 * public keys are `Uint8Array` rather than base64, and
	 * `stakingPoolDeactivationEpoch` / `validatorVeryLowStakeThreshold` are
	 * absent entirely. Remapping it would change what this method returns.
	 *
	 * Note `Sui().getSystemState()` — the public method — does not touch the
	 * fullnode; it reads the Aftermath API. Only this deprecated helper does.
	 *
	 * @throws If no `jsonRpcClient` was passed to {@link AftermathApi}, since it
	 * is optional there.
	 *
	 * @example
	 * ```typescript
	 * const afSdk = await Aftermath.create({ network: "MAINNET" });
	 *
	 * const sui = afSdk.Sui();
	 *
	 * const systemState = await sui.getSystemState();
	 * console.log(systemState.epoch, systemState.validators);
	 */
	public fetchSystemState = async (): Promise<SuiSystemStateSummary> => {
		const jsonRpcClient = this.api.requireJsonRpcClient(
			"Sui().fetchSystemState"
		);

		const systemState = await jsonRpcClient.getLatestSuiSystemState();

		const activeValidators = systemState.activeValidators.map((validator) => ({
			...validator,
			suiAddress: Helpers.addLeadingZeroesToType(validator.suiAddress),
		}));

		return {
			...systemState,
			activeValidators,
		} as SuiSystemStateSummary;
	};
}
