/**
 * `Wallet`'s balance reads must go through the gRPC provider when one is
 * available: `getBalance` reports owned coin objects *plus* the wallet's SIP-58
 * address balance, while the service endpoint sums owned coin objects only, so
 * accumulator-held funds read as zero there.
 *
 * ## Running
 *
 * ```sh
 * bun test tests/walletBalances.test.ts
 * ```
 */

import type { AftermathApi } from "../src";
// @dev: deep path — `Wallet` is reached through `Aftermath.Wallet()` in normal
// use and is not re-exported by the package barrel.
import { Wallet } from "../src/general/wallet/wallet";

const ADDRESS = "0x5";
const SUI = "0x2::sui::SUI";

/** An `AftermathApi` exposing just the wallet provider these reads use. */
const mockApi = (inputs: {
	fetchAllCoinBalances?: () => Promise<Record<string, bigint>>;
	fetchCoinBalance?: () => Promise<bigint>;
}): AftermathApi =>
	({
		Wallet: () => ({
			fetchAllCoinBalances:
				inputs.fetchAllCoinBalances ?? (async () => ({}) as never),
			fetchCoinBalance: inputs.fetchCoinBalance ?? (async () => BigInt(0)),
		}),
	}) as unknown as AftermathApi;

/** Records whether the HTTP fallback was reached, and with which route. */
const walletWith = (api?: AftermathApi): Wallet =>
	new Wallet(ADDRESS, undefined, api);

const trackFetchApi = (wallet: Wallet, result: unknown) => {
	const calls: string[] = [];
	(wallet as unknown as { fetchApi: unknown }).fetchApi = async (
		route: string
	) => {
		calls.push(route);
		return result;
	};
	return calls;
};

describe("Wallet.getAllBalances", () => {
	it("reads the gRPC provider, which includes the address balance", async () => {
		const wallet = walletWith(
			mockApi({
				fetchAllCoinBalances: async () => ({ [SUI]: BigInt(8_765_959_765) }),
			})
		);
		const calls = trackFetchApi(wallet, {});

		expect(await wallet.getAllBalances()).toEqual({
			[SUI]: BigInt(8_765_959_765),
		});
		// The service endpoint would have reported 0 for an accumulator-held coin.
		expect(calls).toEqual([]);
	});

	it("falls back to the service endpoint without a provider", async () => {
		const wallet = walletWith();
		const calls = trackFetchApi(wallet, { [SUI]: BigInt(1) });

		expect(await wallet.getAllBalances()).toEqual({ [SUI]: BigInt(1) });
		expect(calls).toEqual(["all-coin-balances"]);
	});
});

describe("Wallet.getBalances", () => {
	it("reads the gRPC provider once per requested coin, in order", async () => {
		const requested: string[] = [];
		const wallet = walletWith({
			Wallet: () => ({
				fetchCoinBalance: async (inputs: { coin: string }) => {
					requested.push(inputs.coin);
					return inputs.coin === SUI ? BigInt(7) : BigInt(3);
				},
			}),
		} as unknown as AftermathApi);
		const calls = trackFetchApi(wallet, []);

		expect(await wallet.getBalances({ coins: [SUI, "0xa::a::A"] })).toEqual([
			BigInt(7),
			BigInt(3),
		]);
		expect(requested).toEqual([SUI, "0xa::a::A"]);
		expect(calls).toEqual([]);
	});

	it("falls back to the service endpoint without a provider", async () => {
		const wallet = walletWith();
		const calls = trackFetchApi(wallet, [BigInt(5)]);

		expect(await wallet.getBalances({ coins: [SUI] })).toEqual([BigInt(5)]);
		expect(calls).toEqual(["coin-balances"]);
	});
});
