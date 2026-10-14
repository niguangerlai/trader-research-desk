"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { discoveryCounts, type DiscoveryResult, type DiscoverySnapshot, type ListedSecurity, type BinanceListedContract } from "../market-discovery";
import type { Asset } from "../types";
import { ChartResearchView } from "./ChartResearchView";

type ScanState = "idle" | "loading" | "running" | "paused" | "done";
const PAGE_SIZE = 50;

function percent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function price(value?: number) {
  return value === undefined ? "—" : `$${value.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
}

function chartAsset(security: ListedSecurity): Asset {
  return {
    id: `discovery-${security.symbol}`, symbol: security.symbol, name: security.name,
    market: security.exchange, sector: "交易发现", status: "watching", category: "unclassified",
    conviction: "pending", updatedAt: new Date().toISOString().slice(0, 10), dataFreshness: "查看实时行情",
    valuationLogic: "", thesis: "", catalyst: [], invalidation: [], fundamentalSignals: [], sources: [],
    technical: { trend: "", momentum: "", structure: "", levels: [], action: "" },
  };
}

export function MarketDiscovery({ watchedSymbols, onAdd, onOpen }: {
  watchedSymbols: string[];
  onAdd: (security: ListedSecurity) => void;
  onOpen: (symbol: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot | null>(null);
  const [state, setState] = useState<ScanState>("idle");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [resultView, setResultView] = useState("matched");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<ListedSecurity | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const snapshotRef = useRef(snapshot);
  const previewRef = useRef<HTMLDialogElement>(null);
  snapshotRef.current = snapshot;

  useEffect(() => () => abortRef.current?.abort(), []);
  const counts = snapshot ? discoveryCounts(snapshot) : null;
  const watched = useMemo(() => new Set(watchedSymbols.map((symbol) => symbol.toUpperCase())), [watchedSymbols]);
  const rows = useMemo(() => {
    if (!snapshot) return [];
    const search = query.trim().toLowerCase();
    return snapshot.universe.filter((security) => {
      const result = snapshot.results[security.symbol];
      return result?.status === resultView && (kind === "all" || security.kind === kind) &&
        (!search || `${security.symbol} ${security.name}`.toLowerCase().includes(search));
    }).sort((left, right) => {
      const body = (symbol: string) => snapshot.results[symbol]?.weeks.reduce((total, week) => total + week.changePercent, 0) ?? 0;
      return body(right.symbol) - body(left.symbol) || left.symbol.localeCompare(right.symbol);
    });
  }, [snapshot, query, kind, resultView]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visibleRows = rows.slice((Math.min(page, pages) - 1) * PAGE_SIZE, Math.min(page, pages) * PAGE_SIZE);

  async function scan(current: DiscoverySnapshot, retry = false) {
    if (current.binanceMetadata && Date.now() - Date.parse(current.binanceMetadata.fetchedAt) > 8 * 60_000) {
      await start(retry);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController(); abortRef.current = controller;
    setError(""); setState("running");
    const targets = current.universe.filter((security) => {
      const status = current.results[security.symbol]?.status;
      return retry ? status === "unavailable" : !status;
    });
    let next = 0;
    const worker = async () => {
      while (!controller.signal.aborted && next < targets.length) {
        const batch = targets.slice(next, next + 20); next += 20;
        const response = await fetch("/api/discovery", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ periodKey: current.periodKey, symbols: batch.map((item) => item.symbol), retry, binanceMetadata: current.binanceMetadata }),
        });
        const payload = await response.json() as { results?: DiscoveryResult[]; error?: string };
        if (!response.ok || !payload.results) throw new Error(payload.error || "这一批行情未返回，请继续扫描重试。");
        if (controller.signal.aborted) return;
        const added = Object.fromEntries(payload.results.map((result) => [result.symbol, result]));
        setSnapshot((previous) => previous ? { ...previous, results: { ...previous.results, ...added } } : previous);
      }
    };
    try {
      await Promise.all([worker(), worker()]);
      if (!controller.signal.aborted) setState("done");
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : "扫描暂时中断，请继续扫描。");
        setState("paused"); controller.abort();
      }
    }
  }

  async function start(retry = false) {
    abortRef.current?.abort();
    const controller = new AbortController(); abortRef.current = controller;
    setState("loading"); setError("");
    try {
      let response = await fetch("/api/discovery", { signal: controller.signal });
      let payload = await response.json() as DiscoverySnapshot & { error?: string; needsClientBinance?: boolean };
      if (!response.ok && payload.needsClientBinance && !controller.signal.aborted) {
        const contractResponse = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo", { signal: controller.signal });
        if (!contractResponse.ok) throw new Error(`浏览器也无法取得币安名录（${contractResponse.status}）。`);
        const binance = await contractResponse.json() as { symbols?: BinanceListedContract[] };
        const contracts = binance.symbols?.filter((item) => item.underlyingType === "EQUITY") ?? [];
        if (!contracts.length) throw new Error("币安当前没有返回美股类产品。");
        let prices: Array<{ symbol: string; price: number }> = [];
        try {
          const priceResponse = await fetch("https://fapi.binance.com/fapi/v2/ticker/price", { signal: controller.signal });
          if (priceResponse.ok) {
            const rawPrices = await priceResponse.json() as Array<{ symbol: string; price: string }>;
            const allowed = new Set(contracts.map((item) => item.symbol));
            prices = rawPrices.filter((item) => allowed.has(item.symbol) && Number(item.price) > 0)
              .map((item) => ({ symbol: item.symbol, price: Number(item.price) }));
          }
        } catch { /* Scope and weekly verification remain available without the latest price. */ }
        response = await fetch("/api/discovery", {
          method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "universe", binanceMetadata: { contracts, prices, fetchedAt: new Date().toISOString() } }),
        });
        payload = await response.json() as typeof payload;
      }
      if (!response.ok || !payload.universe?.length) throw new Error(payload.error || "币安可交易美股范围读取失败。");
      if (controller.signal.aborted) return;
      setSnapshot(payload); snapshotRef.current = payload;
      await scan(payload, retry);
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : "币安美股扫描暂不可用。"); setState("paused");
      }
    }
  }

  function pause() {
    abortRef.current?.abort(); setState("paused");
  }

  function openPreview(security: ListedSecurity) {
    setPreview(security);
    window.requestAnimationFrame(() => previewRef.current?.showModal());
  }

  const busy = state === "running" || state === "loading";
  const completed = counts ? counts.total - counts.pending : 0;

  return (
    <section className="market-discovery" id="trade-discovery" aria-labelledby="discovery-title">
      <div className="discovery-heading">
        <div>
          <p className="eyebrow">TRADE DISCOVERY · 币安美股发现</p>
          <h2 id="discovery-title">连续两周周阳线</h2>
          <p>先筛币安当前可交易的美股/ETF类永续合约，再检查对应正股连续两个已收盘周是否为阳线。</p>
        </div>
        <div className="discovery-actions">
          {busy ? <button className="button button-quiet" onClick={pause}>暂停扫描</button>
            : counts && counts.pending > 0 ? <button className="button button-primary" onClick={() => void scan(snapshotRef.current!)}>继续扫描</button>
              : <button className="button button-primary" onClick={() => void start()}>{snapshot ? "刷新币安范围" : "扫描币安美股"}</button>}
          {!busy && counts && counts.pending > 0 && <button className="button button-quiet" onClick={() => void start()}>刷新币安范围</button>}
          {!busy && counts && counts.unavailable > 0 && (
            <button className="button button-quiet" onClick={() => void scan(snapshotRef.current!, true)}>重试缺失行情</button>
          )}
        </div>
      </div>

      {error && <p className="inline-alert" role="alert">{error}</p>}
      {state === "loading" && <p className="discovery-loading" role="status">正在读取币安官方合约名录，并核对美国挂牌代码…</p>}
      {!snapshot && state !== "loading" && <p className="discovery-empty">点击“扫描币安美股”开始。扫描全部处于交易状态的币安美股/ETF类永续合约，范围独立于自选清单。</p>}

      {snapshot && counts && <>
        <div className="discovery-summary" aria-label="币安美股扫描覆盖">
          <div><span>币安可交易美股</span><strong>{counts.total.toLocaleString()}</strong></div>
          <div><span>已处理</span><strong>{completed.toLocaleString()}</strong></div>
          <div><span>两周阳线</span><strong>{counts.matched.toLocaleString()}</strong></div>
          <div><span>行情缺失</span><strong>{counts.unavailable.toLocaleString()}</strong></div>
        </div>
        <div className="discovery-progress" role="progressbar" aria-label="币安美股扫描进度" aria-valuemin={0} aria-valuemax={counts.total} aria-valuenow={completed}>
          <span style={{ width: `${completed / counts.total * 100}%` }} />
        </div>
        <div className="discovery-coverage" aria-live="polite">
          <p>{state === "running" ? "扫描进行中，命中会逐批出现" : counts.pending ? "扫描已暂停，可继续" : counts.unavailable ? "币安范围已处理，缺失行情可重试" : "币安范围扫描完成"} · 待处理 {counts.pending.toLocaleString()} · 两周复核未通过 {counts.rejected.toLocaleString()}</p>
          <p>检验周：{snapshot.weekStarts[0]} / {snapshot.weekStarts[1]} · 正股周收盘价 &gt; 周开盘价 · 美国东部时间收盘后确认</p>
          {snapshot.scope && <p>从 {snapshot.scope.listedTotal.toLocaleString()} 个美国挂牌代码核对映射 · 币安官方美股类在交易合约 {snapshot.scope.binanceEquitiesTotal} 个 · 已确认挂牌映射 {snapshot.scope.mappedTotal} 个</p>}
          {snapshot.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>

        <div className="discovery-controls">
          <label>搜索标的<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="代码或公司名称" /></label>
          <label>证券类型<select value={kind} onChange={(event) => { setKind(event.target.value); setPage(1); }}><option value="all">全部币安美股</option><option value="stock">股票与ADR</option><option value="etf">ETF</option><option value="other">代码待核验 / 其他</option></select></label>
          <label>结果<select value={resultView} onChange={(event) => { setResultView(event.target.value); setPage(1); }}><option value="matched">连续两周阳线</option><option value="unavailable">行情缺失 / 待核验</option></select></label>
        </div>

        <div className="discovery-table-wrap">
          <table className="discovery-table">
            <thead><tr><th>正股 / 币安合约</th><th>{snapshot.weekStarts[0]} 周</th><th>{snapshot.weekStarts[1]} 周</th><th>币安报价</th><th>研究</th></tr></thead>
            <tbody>{visibleRows.map((security) => {
              const result = snapshot.results[security.symbol];
              return <tr key={security.symbol}>
                <td><strong>{security.symbol}</strong><small title={security.name}>{security.name}</small><span>{security.exchange} · {security.binanceSymbol} · {security.kind === "etf" ? "ETF" : security.kind === "stock" ? "股票/ADR" : "待核验"}</span></td>
                {snapshot.weekStarts.map((start) => { const week = result.weeks.find((item) => item.weekStart === start); return <td key={start} className={week?.bullish ? "positive" : ""} title={week ? `开 ${week.open} → 收 ${week.close}` : result.reason}>{week ? percent(week.changePercent) : "待核验"}</td>; })}
                <td>{price(security.price)}</td>
                <td><div className="discovery-row-actions"><button onClick={() => openPreview(security)}>查看K线</button><button onClick={() => watched.has(security.symbol.toUpperCase()) ? onOpen(security.symbol) : onAdd(security)}>{watched.has(security.symbol.toUpperCase()) ? "打开研究" : "加入研究"}</button></div></td>
              </tr>;
            })}</tbody>
          </table>
          {rows.length === 0 && <p className="discovery-empty">{state === "running" ? "正在复核历史K线，命中结果会逐批出现。" : "当前条件下没有结果。"}</p>}
        </div>
        <div className="discovery-footer"><p>{rows.length.toLocaleString()} 个结果 · {snapshot.source} · <a href="https://www.nasdaqtrader.com/trader.aspx?id=symbollookup" target="_blank" rel="noreferrer">核对完整名录</a></p><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button><span>{Math.min(page, pages)} / {pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>下一页</button></div></div>
        <details className="discovery-method"><summary>扫描口径与覆盖</summary><p>初筛读取币安官方 exchangeInfo，只保留 status=TRADING、contractType=TRADIFI_PERPETUAL、underlyingType=EQUITY 的合约，再与 Nasdaq Trader 完整美国挂牌名录核对。币安合约存在并不代表你持有正股；这里只标识产品名录的交易状态，不核验个人账户权限。</p><p>连续阳线按对应正股的 Nasdaq / Yahoo 历史日线聚合，取周首开盘与末个收盘；币安报价来自官方 ticker 接口。币安合约24/7周线与正股交易时段周线可能不同。缺失历史数据或未确认代码映射会单列，不当作未命中。可暂停续扫。</p><p>名录生成时间：{snapshot.directoryAsOf}。结果按两周实体涨幅之和排序。</p></details>
      </>}

      <dialog className="discovery-chart-dialog" ref={previewRef} onClose={() => setPreview(null)}>
        <div className="dialog-header"><strong>{preview?.symbol} · {preview?.name}</strong><button className="dialog-close" onClick={() => { previewRef.current?.close(); setPreview(null); }}>关闭图表</button></div>
        {preview && <ChartResearchView key={preview.symbol} asset={chartAsset(preview)} />}
      </dialog>
    </section>
  );
}
