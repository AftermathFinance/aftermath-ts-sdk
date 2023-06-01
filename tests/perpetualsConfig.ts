import { PerpetualsAddresses } from "../src/types";

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
				accountManager: "",
				marketManager: "",
				vault: "",
				insuranceFund: "",
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
