export type UserDataIndexerUserRequest = {
	address: string;
};

export type UserDataIndexerUserResponse = {
	address: string;
	public_key_object: string;
	public_key_bytes: string;
};

// =========================================================================
// User Create
// =========================================================================

export type UserDataIndexerCreateUserRequest = {
	address: string;
	signature: string;
	message: string;
};

export type UserDataIndexerCreateUserResponse = boolean;
