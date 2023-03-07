import {
	ObjectId,
	SequenceNumber,
	SuiAddress,
	SuiMoveModuleId,
	TransactionDigest,
} from "@mysten/sui.js";

/////////////////////////////////////////////////////////////////////
//// On Chain
/////////////////////////////////////////////////////////////////////

interface MoveEventOnChain<Fields> {
	bsc: string;
	fields: Fields;
	packageId: ObjectId;
	sender: SuiAddress;
	transactionModule: SuiMoveModuleId;
	type: string;
}

export interface EventOnChain<Fields> {
	event: {
		moveEvent: MoveEventOnChain<Fields>;
	};
	// NOTE: do we want/need this info ?
	// id: {
	// 	tsSeq: SequenceNumber;
	// 	eventSeq: SequenceNumber;
	// };
	timestamp: number;
	txDigest: TransactionDigest;
}
