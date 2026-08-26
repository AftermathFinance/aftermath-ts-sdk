import type { Transaction } from "@mysten/sui/transactions";

import type { JsonRecord } from "@test/support/http";

export function transactionCommands(tx: Transaction): readonly JsonRecord[] {
	return tx.getData().commands as readonly JsonRecord[];
}
