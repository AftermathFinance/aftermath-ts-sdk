import { FaucetAddresses, PerpetualsAddresses } from "../src/types";

export const perpetualsConfig: PerpetualsAddresses = {
	packages: {
		perpetuals:
			"0xa770922eff639016e7bc768a8a43da8d0e50afa7e647f65f129e6b500540f18b",
	},
	objects: {
		adminCapability:
			"0x6361d08c3994d1be809fc9c153b91941f970bfb3fffa14630276b06a0921971a",
		registry:
			"0xf77c21b815d855aa3ef4bb0f944c75302d8b1f560f87769727d22ba37429cf73",
		exchanges: [
			{
				accountManager:
					"0x6be0d1d8840f927177dea6da824dc9cb4cfe99bf0bbb1743e5970fe8b2d9b040",
				marketManager:
					"0x82affe8b7ba5c5805a0d51e8ea34a74a731d16938974dcff49faee37ce7ed18d",
				vault: "0xe95c24e93e8cde64486acfb2cb41289ab1aa698e55755257c02afbc937c8f9b9",
				insuranceFund:
					"0xff72c80f20c0529e3f9b9c74839c459fd30b57de42ffd00fea2a0a845c0c2e85",
			},
		],
		oracle: {
			packages: {
				oracle: "0x4cd46adf9b99416d8574ab61120b3e5d0af2fec949ab87e77ea29fb4a8cce1cb",
			},
			objects: {
				authorityCapability:
					"0x63a54fcd413b0f36e8ff35753e52ab67cd7eaad0960ffa4c9a459e1dd5cb9012",
				priceFeedStorage:
					"0x431660b4734cda180ce297fc498b03ee085407cc1abd3fce0c408724f6079ed8",
			},
		},
	},
};

export const faucetConfig: FaucetAddresses = {
	packages: {
		faucet: "0xe351053c6ebdaa3f6294e6cdd7be5bd6d4c1e693e66b50db4c30ea8ec175bacc",
	},
	objects: {
		faucet: "0x3f2766c0b07faddb6224d10381b2995b2d1b9afd6a26d8ee0be53bbbc9cdeb31",
		faucetRegistry:
			"0x0e91b86e3c2d86137d9ac79bac486c207005d8fbfe934f5c9df92a3b5de69703",
	},
};
