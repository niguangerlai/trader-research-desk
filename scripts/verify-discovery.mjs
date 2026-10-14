import { mkdir, writeFile } from "node:fs/promises";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(new EnvHttpProxyAgent({ noProxy: "127.0.0.1,localhost,::1" }));

const base = process.argv[2] || "http://127.0.0.1:3012";
let token = "";
if (process.argv.includes("--token-stdin")) {
  console.log("Ready for Site service token on stdin (input is hidden).");
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  token = await new Promise((resolve) => {
    let buffer = "";
    const receive = (chunk) => {
      buffer += chunk.toString();
      if (!buffer.includes("\n") && !buffer.includes("\r")) return;
      process.stdin.off("data", receive); process.stdin.setRawMode?.(false); process.stdin.pause();
      resolve(buffer.trim());
    };
    process.stdin.on("data", receive);
  });
}
const auth = token ? { "OAI-Sites-Authorization": `Bearer ${token}` } : {};
let response = await fetch(`${base}/api/discovery`, { headers: auth });
if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
  throw new Error(`Discovery returned ${response.status} ${response.headers.get("content-type")} at ${new URL(response.url).origin}${new URL(response.url).pathname}`);
}
let snapshot = await response.json();
if (!response.ok && snapshot.needsClientBinance) {
  const infoResponse = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo");
  const info = await infoResponse.json();
  const contracts = info.symbols.filter((item) => item.underlyingType === "EQUITY");
  const quotes = await (await fetch("https://fapi.binance.com/fapi/v2/ticker/price")).json();
  const allowed = new Set(contracts.map((item) => item.symbol));
  const prices = quotes.filter((item) => allowed.has(item.symbol) && Number(item.price) > 0)
    .map((item) => ({ symbol: item.symbol, price: Number(item.price) }));
  response = await fetch(`${base}/api/discovery`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "universe", binanceMetadata: { contracts, prices, fetchedAt: new Date().toISOString() } }) });
  snapshot = await response.json();
}
if (!response.ok || !snapshot.universe?.length) throw new Error(snapshot.error || "Invalid universe");
const counts = () => {
  const tally = { total: snapshot.universe.length, pending: 0, matched: 0, prefiltered: 0, rejected: 0, unavailable: 0 };
  for (const item of snapshot.universe) tally[snapshot.results[item.symbol]?.status || "pending"]++;
  return tally;
};
console.log(JSON.stringify({ event: "universe", periodKey: snapshot.periodKey, cache: snapshot.cache, scope: snapshot.scope, warnings: snapshot.warnings, counts: counts(), kinds: Object.fromEntries(["stock", "etf", "other"].map((kind) => [kind, snapshot.universe.filter((item) => item.kind === kind).length])) }));
const targets = snapshot.universe.filter((item) => !snapshot.results[item.symbol]);
let next = 0; let batches = 0;
const started = Date.now();
await Promise.all(Array.from({ length: 2 }, async () => {
  while (next < targets.length) {
    const batch = targets.slice(next, next + 20); next += 20;
    let payload;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${base}/api/discovery`, {
        method: "POST", headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ periodKey: snapshot.periodKey, symbols: batch.map((item) => item.symbol), binanceMetadata: snapshot.binanceMetadata }),
        signal: AbortSignal.timeout(120_000),
      });
      payload = await res.json();
      if (res.ok && payload.results) break;
      console.log(JSON.stringify({ event: "retry", error: payload.error }));
      if (attempt === 2) throw new Error(payload.error || "Batch failed");
    }
    for (const result of payload.results) snapshot.results[result.symbol] = result;
    batches++;
    if (batches % 5 === 0) console.log(JSON.stringify({ event: "progress", seconds: Math.round((Date.now() - started) / 1000), ...counts() }));
  }
}));
await mkdir("output/discovery", { recursive: true });
await writeFile("output/discovery/full-scan-verification.json", JSON.stringify(snapshot));
console.log(JSON.stringify({ event: "complete", seconds: Math.round((Date.now() - started) / 1000), ...counts() }));
