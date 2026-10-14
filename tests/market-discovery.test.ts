import assert from "node:assert/strict";
import test from "node:test";
import { binanceTradableEquityUniverse, discoveryCounts, isBinanceBrowserMetadata, parseSymbolDirectory, type DiscoverySnapshot } from "../app/market-discovery.ts";

test("uses the complete directory rather than a watchlist, excluding only test issues", () => {
  const nasdaq = parseSymbolDirectory("Symbol|Security Name|Test Issue|ETF\nAAPL|Apple Common Stock|N|N\nQQQ|Invesco QQQ|N|Y\nTEST|Test Symbol|Y|N\nFile Creation Time: 1014202603:02|||", true);
  const other = parseSymbolDirectory("ACT Symbol|Security Name|Exchange|ETF|Test Issue\nGLW|Corning Common Stock|N|N|N\nBRK.B|Berkshire Class B|N|N|N\nXYZ.W|XYZ Warrants|A|N|N", false);
  assert.deepEqual(nasdaq.securities.map((item) => item.symbol), ["AAPL", "QQQ"]);
  assert.equal(other.securities[0].exchange, "NYSE");
  assert.equal(other.securities[2].kind, "other");
  assert.equal(nasdaq.securities[1].kind, "etf");
});

test("browser fallback rejects old or malformed inventory and crypto instruments", () => {
  const valid = { fetchedAt: new Date().toISOString(), prices: [], contracts: [{ symbol: "AAPLUSDT", baseAsset: "AAPL", status: "TRADING", contractType: "TRADIFI_PERPETUAL", underlyingType: "EQUITY" }] };
  assert.equal(isBinanceBrowserMetadata(valid), true);
  assert.equal(isBinanceBrowserMetadata({ ...valid, fetchedAt: "2020-01-01" }), false);
  assert.equal(isBinanceBrowserMetadata({ ...valid, contracts: [{ ...valid.contracts[0], symbol: "../AAPL" }] }), false);
  assert.equal(isBinanceBrowserMetadata({ ...valid, contracts: [{ ...valid.contracts[0], underlyingType: "COIN" }] }), false);
});

test("takes every active Binance equity contract and excludes crypto, halted and overseas products", () => {
  const securities = ["AAPL", "BRK.B", "SPX", "GLW"].map((symbol) => ({ symbol, name: symbol, exchange: "NASDAQ", kind: "stock" as const }));
  const contract = (baseAsset: string, extra = {}) => ({ symbol: `${baseAsset}USDT`, baseAsset, status: "TRADING", underlyingType: "EQUITY", contractType: "TRADIFI_PERPETUAL", quoteAsset: "USDT", ...extra });
  const result = binanceTradableEquityUniverse(securities, [
    contract("AAPL"), contract("BRKB"), contract("NEW"),
    contract("SPX", { underlyingType: "COIN", contractType: "PERPETUAL" }),
    contract("GLW", { status: "BREAK" }), contract("0700", { underlyingType: "HK_EQUITY" }),
  ]);
  assert.deepEqual(result.universe.map((item) => item.symbol), ["AAPL", "BRK.B", "NEW"]);
  assert.equal(result.universe[1].binanceSymbol, "BRKBUSDT");
  assert.equal(result.universe[2].mappingStatus, "unresolved");
  assert.equal(result.scope.binanceEquitiesTotal, 3);
  assert.equal(result.scope.mappedTotal, 2);
  assert.deepEqual(result.scope.unresolved, ["NEWUSDT"]);
  const snapshot: DiscoverySnapshot = {
    universe: result.universe, results: { AAPL: { symbol: "AAPL", status: "matched", weeks: [], source: "test", fetchedAt: "" } },
    periodKey: "test", weekStarts: [], directoryAsOf: "test", fetchedAt: "", source: "test", warnings: [], cache: "session",
  };
  assert.deepEqual(discoveryCounts(snapshot), { total: 3, pending: 2, matched: 1, prefiltered: 0, rejected: 0, unavailable: 0 });
});
