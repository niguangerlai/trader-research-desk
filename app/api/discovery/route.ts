import { getDiscoverySnapshot, scanDiscoveryBatch } from "../../market-discovery-server";
import { isBinanceBrowserMetadata } from "../../market-discovery";

export async function GET() {
  try {
    return Response.json(await getDiscoverySnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "全市场名录暂不可用，请重试。", needsClientBinance: true }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let body: { action?: unknown; periodKey?: unknown; symbols?: unknown; retry?: unknown; binanceMetadata?: unknown };
  try { body = await request.json(); } catch {
    return Response.json({ error: "扫描请求格式无效。" }, { status: 400 });
  }
  if (body.binanceMetadata !== undefined && !isBinanceBrowserMetadata(body.binanceMetadata)) {
    return Response.json({ error: "币安名录数据无效或已过期，请重新读取。" }, { status: 400 });
  }
  const metadata = isBinanceBrowserMetadata(body.binanceMetadata) ? body.binanceMetadata : undefined;
  if (body.action === "universe" && metadata) {
    try { return Response.json(await getDiscoverySnapshot(metadata), { headers: { "Cache-Control": "no-store" } }); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "美国挂牌名录暂不可用。" }, { status: 502 }); }
  }
  if (typeof body.periodKey !== "string" || !Array.isArray(body.symbols) ||
    body.symbols.length < 1 || body.symbols.length > 20 ||
    !body.symbols.every((symbol) => typeof symbol === "string" && symbol.length <= 20)) {
    return Response.json({ error: "每批扫描应包含1–20个名录内标的。" }, { status: 400 });
  }
  try {
    return Response.json(await scanDiscoveryBatch(body.periodKey, body.symbols, body.retry === true, metadata),
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "扫描暂不可用，请重试。" }, { status: 502 });
  }
}
