import type { SuiEvent, TransactionEffects } from "@mysten/sui/jsonRpc";
import type { Transaction } from "@mysten/sui/transactions";
import type { Byte, SuiAddress } from "../../types";
import type { AftermathApi } from "../providers/aftermathApi";

export class InspectionsApiHelpers {
  public static constants = {
    devInspectSigner:
      "0xacb7cb045c3afac61381cdf272cd24ebe115f86361c9f06490482c238765aeb5",
  };

  // =========================================================================
  //  Constructor
  // =========================================================================

  constructor(private readonly Provider: AftermathApi) {}

  // =========================================================================
  //  Public Methods
  // =========================================================================

  // =========================================================================
  //  Fetching
  // =========================================================================

  // TODO: replace all bytes types with uint8array type

  public fetchFirstBytesFromTxOutput = async (inputs: {
    tx: Transaction;
    sender?: SuiAddress;
  }) => {
    return (await this.fetchAllBytesFromTxOutput(inputs))[0];
  };

  public fetchAllBytesFromTxOutput = async (inputs: {
    tx: Transaction;
    sender?: SuiAddress;
  }): Promise<Byte[][]> => {
    const { allBytes } = await this.fetchAllBytesFromTx(inputs);
    return allBytes[allBytes.length - 1];
  };

  public fetchAllBytesFromTx = async (inputs: {
    tx: Transaction;
    sender?: SuiAddress;
  }): Promise<{
    events: SuiEvent[];
    effects: TransactionEffects;
    allBytes: Byte[][][];
  }> => {
    const sender =
      inputs.sender ?? InspectionsApiHelpers.constants.devInspectSigner;
    const response = await this.Provider.provider.devInspectTransactionBlock({
      sender,
      transactionBlock: inputs.tx,
    });

    if (response.effects.status.status === "failure") {
      throw new Error(
        response.effects.status.error ?? response.error ?? "dev inspect failed"
      );
    }

    if (!response.results) {
      throw Error("dev inspect move call returned no results");
    }

    const resultBytes = response.results.map(
      (result: { returnValues?: [number[], string][] }) =>
        result.returnValues?.map((val: [number[], string]) => val[0]) ?? []
    );
    return {
      events: response.events,
      effects: response.effects,
      allBytes: resultBytes,
    };
  };
}
