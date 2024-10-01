export type UserDataIndexerUserRequest = {
	wallet_address: string;
};

export type UserDataIndexerUserResponse = {
	public_key?: string;
};

// =========================================================================
// User Create
// =========================================================================

export type UserDataIndexerCreateUserRequest = {
	wallet_address: string;
	signature: string;
	bytes: string;
};

export type UserDataIndexerCreateUserResponse = boolean;
