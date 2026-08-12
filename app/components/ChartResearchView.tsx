"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  aggregateWeeklyBars,
  DEFAULT_QQQ_FORECASTS,
  filterBarsByRange,
  FORECAST_STORAGE_KEY,
  isForecastRecordArray,
  marketTimeToMilliseconds,
  resolveMarketSymbol,
} from "../chart-data";
import {
  fetchBinanceFuturesMarket,
  isBinanceFuturesSymbol,
  type DerivativesSnapshot,
} from "../binance-market";
import { calculateTraderCFramework } from "../indicators";
import { fetchYahooIntradayMarket } from "../yahoo-market";
import type {
  Asset,
  ChartRange,
  ChartTimeframe,
  ForecastBias,
  ForecastRecord,
  MarketBar,
} from "../types";
import { MarketChart } from "./MarketChart";

type MarketResponse = {
  bars?: MarketBar[];
  error?: string;
  source?: string;
  fetchedAt?: string;
  derivatives?: DerivativesSnapshot;
};

type ForecastDraft = {
  asOfDate: string;
  title: string;
  bias: ForecastBias;
  narrative: string;
  confirmation: string;
  invalidation: string;
  triggerPrice: string;
  invalidationPrice: string;
  path: Array<{ date: string; price: string }>;
};

type PendingForecastDelete = {
  record: ForecastRecord;
};

const RANGE_OPTIONS: Array<{ id: ChartRange; label: string }> = [
  { id: "6M", label: "6个月" },
  { id: "1Y", label: "1年" },
  { id: "2Y", label: "2年" },
];

const TIMEFRAME_OPTIONS: Array<{ id: ChartTimeframe; label: string }> = [
  { id: "4H", label: "4小时" },
  { id: "6H", label: "6小时" },
  { id: "1D", label: "日线" },
  { id: "1W", label: "周线" },
];

const CHART_PREFERENCES_STORAGE_KEY =
  "trader-research-chart-preferences:v1";

const BIAS_LABEL: Record<ForecastBias, string> = {
  bullish: "偏多",
  neutral: "中性",
  bearish: "偏空",
};

function currentDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function emptyDraft(date = currentDate()): ForecastDraft {
  return {
    asOfDate: date,
    title: "",
    bias: "neutral",
    narrative: "",
    confirmation: "",
    invalidation: "",
    triggerPrice: "",
    invalidationPrice: "",
    path: [],
  };
}

function recordToDraft(record: ForecastRecord): ForecastDraft {
  return {
    asOfDate: record.asOfDate,
    title: record.title,
    bias: record.bias,
    narrative: record.narrative,
    confirmation: record.confirmation,
    invalidation: record.invalidation,
    triggerPrice: record.triggerPrice?.toString() ?? "",
    invalidationPrice: record.invalidationPrice?.toString() ?? "",
    path: record.path.map((point) => ({
      date: point.date,
      price: point.price.toString(),
    })),
  };
}

function parseOptionalPrice(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : undefined;
}

function sortForecasts(records: ForecastRecord[]) {
  return [...records].sort((a, b) => b.asOfDate.localeCompare(a.asOfDate));
}

export function ChartResearchView({ asset }: { asset: Asset }) {
  const [range, setRange] = useState<ChartRange>("1Y");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("1D");
  const [requestVersion, setRequestVersion] = useState(0);
  const [market, setMarket] = useState<{
    loading: boolean;
    bars: MarketBar[];
    error: string;
    fetchedAt: string;
    source: string;
    derivatives?: DerivativesSnapshot;
  }>({
    loading: true,
    bars: [],
    error: "",
    fetchedAt: "",
    source: "",
  });
  const [forecasts, setForecasts] = useState<ForecastRecord[]>(
    DEFAULT_QQQ_FORECASTS,
  );
  const [forecastsHydrated, setForecastsHydrated] = useState(false);
  const [selectedForecastId, setSelectedForecastId] = useState(
    DEFAULT_QQQ_FORECASTS[0].id,
  );
  const [draft, setDraft] = useState<ForecastDraft>(
    recordToDraft(DEFAULT_QQQ_FORECASTS[0]),
  );
  const [showForecast, setShowForecast] = useState(true);
  const [showIndicators, setShowIndicators] = useState(true);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [pendingDelete, setPendingDelete] =
    useState<PendingForecastDelete | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const marketSymbol = resolveMarketSymbol(asset.symbol, asset.market);
  const requestTimeframe: ChartTimeframe =
    timeframe === "1W" ? "1D" : timeframe;
  const canShowForecast = timeframe === "1D" || timeframe === "1W";

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      setMarket({
        loading: true,
        bars: [],
        error: "",
        fetchedAt: "",
        source: "",
        derivatives: undefined,
      });
    });

    async function loadMarket(): Promise<MarketResponse> {
      if (isBinanceFuturesSymbol(marketSymbol)) {
        const periodEnd = new Date();
        periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
        const periodStart = new Date(periodEnd);
        if (requestTimeframe === "4H" || requestTimeframe === "6H") {
          periodStart.setUTCDate(periodStart.getUTCDate() - 729);
        } else {
          periodStart.setUTCFullYear(periodStart.getUTCFullYear() - 2);
        }
        return fetchBinanceFuturesMarket(
          marketSymbol,
          periodStart,
          periodEnd,
          requestTimeframe,
          controller.signal,
        );
      }

      if (requestTimeframe === "4H" || requestTimeframe === "6H") {
        const periodEnd = new Date();
        periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
        const periodStart = new Date(periodEnd);
        periodStart.setUTCDate(periodStart.getUTCDate() - 729);
        try {
          return await fetchYahooIntradayMarket(
            marketSymbol,
            periodStart,
            periodEnd,
            requestTimeframe,
            controller.signal,
          );
        } catch {
          // Sites server route remains a fallback when direct browser access is
          // filtered by the viewer's network.
        }
      }

      const response = await fetch(
        `/api/market?symbol=${encodeURIComponent(marketSymbol)}&timeframe=${requestTimeframe}`,
        { signal: controller.signal },
      );
      const payload = (await response.json()) as MarketResponse;
      if (!response.ok) throw new Error(payload.error || "行情请求失败。");
      return payload;
    }

    void loadMarket()
      .then((payload) => {
        setMarket({
          loading: false,
          bars: payload.bars ?? [],
          error: payload.bars?.length ? "" : "行情源没有返回可用K线。",
          fetchedAt: payload.fetchedAt ?? "",
          source: payload.source ?? "免费历史行情",
          derivatives: payload.derivatives,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMarket({
          loading: false,
          bars: [],
          error: error instanceof Error ? error.message : "行情请求失败。",
          fetchedAt: "",
          source: "",
          derivatives: undefined,
        });
      });

    return () => controller.abort();
  }, [marketSymbol, requestTimeframe, requestVersion]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(
          CHART_PREFERENCES_STORAGE_KEY,
        );
        if (saved) {
          const parsed = JSON.parse(saved) as {
            timeframe?: ChartTimeframe;
            range?: ChartRange;
            showIndicators?: boolean;
            showForecast?: boolean;
          };
          if (TIMEFRAME_OPTIONS.some((option) => option.id === parsed.timeframe)) {
            setTimeframe(parsed.timeframe!);
          }
          if (RANGE_OPTIONS.some((option) => option.id === parsed.range)) {
            setRange(parsed.range!);
          }
          if (typeof parsed.showIndicators === "boolean") {
            setShowIndicators(parsed.showIndicators);
          }
          if (typeof parsed.showForecast === "boolean") {
            setShowForecast(parsed.showForecast);
          }
        }
      } catch {
        // Invalid device-local preferences should not block chart loading.
      } finally {
        setPreferencesHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!preferencesHydrated) return;
    window.localStorage.setItem(
      CHART_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ timeframe, range, showIndicators, showForecast }),
    );
  }, [
    preferencesHydrated,
    range,
    showForecast,
    showIndicators,
    timeframe,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(FORECAST_STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isForecastRecordArray(parsed) && parsed.length) {
            const sorted = sortForecasts(parsed);
            setForecasts(sorted);
            setSelectedForecastId(sorted[0].id);
            setDraft(recordToDraft(sorted[0]));
          }
        }
      } finally {
        setForecastsHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (forecastsHydrated) {
      window.localStorage.setItem(
        FORECAST_STORAGE_KEY,
        JSON.stringify(forecasts),
      );
    }
  }, [forecasts, forecastsHydrated]);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    [],
  );

  const timeframeBars = useMemo(
    () =>
      timeframe === "1W" ? aggregateWeeklyBars(market.bars) : market.bars,
    [market.bars, timeframe],
  );
  const visibleBars = useMemo(
    () => filterBarsByRange(timeframeBars, range),
    [range, timeframeBars],
  );
  const indicator = useMemo(
    () => calculateTraderCFramework(timeframeBars),
    [timeframeBars],
  );
  const selectedForecast = selectedForecastId
    ? forecasts.find((record) => record.id === selectedForecastId)
    : undefined;

  function loadForecast(record: ForecastRecord) {
    setSelectedForecastId(record.id);
    setDraft(recordToDraft(record));
    setShowForecast(true);
  }

  function startNewForecast() {
    setSelectedForecastId("");
    setDraft(emptyDraft());
    setShowForecast(true);
  }

  function saveForecast(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const timestamp = new Date().toISOString();
    const existing =
      forecasts.find((record) => record.asOfDate === draft.asOfDate) ??
      forecasts.find((record) => record.id === selectedForecastId);
    const record: ForecastRecord = {
      id: existing?.id ?? `qqq-${draft.asOfDate}-${Date.now()}`,
      symbol: "QQQ",
      asOfDate: draft.asOfDate,
      title: draft.title.trim() || "未命名推演",
      bias: draft.bias,
      narrative: draft.narrative.trim(),
      confirmation: draft.confirmation.trim(),
      invalidation: draft.invalidation.trim(),
      triggerPrice: parseOptionalPrice(draft.triggerPrice),
      invalidationPrice: parseOptionalPrice(draft.invalidationPrice),
      path: draft.path
        .flatMap((point) => {
          const price = parseOptionalPrice(point.price);
          return point.date && price
            ? [{ date: point.date, price }]
            : [];
        })
        .sort((a, b) => a.date.localeCompare(b.date)),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    setForecasts((current) =>
      sortForecasts([
        record,
        ...current.filter(
          (item) =>
            item.id !== record.id && item.asOfDate !== record.asOfDate,
        ),
      ]),
    );
    setSelectedForecastId(record.id);
    setDraft(recordToDraft(record));
    setPendingDelete(null);
  }

  function deleteForecast() {
    if (!selectedForecast) return;
    const remaining = forecasts.filter(
      (record) => record.id !== selectedForecast.id,
    );
    setForecasts(remaining);
    setPendingDelete({ record: selectedForecast });
    const next = remaining[0];
    setSelectedForecastId(next?.id ?? "");
    setDraft(next ? recordToDraft(next) : emptyDraft());
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setPendingDelete(null), 6000);
  }

  function undoForecastDelete() {
    if (!pendingDelete) return;
    setForecasts((current) =>
      sortForecasts([pendingDelete.record, ...current]),
    );
    loadForecast(pendingDelete.record);
    setPendingDelete(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }

  function updatePathPoint(
    index: number,
    key: "date" | "price",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      path: current.path.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [key]: value } : point,
      ),
    }));
  }

  return (
    <div className="chart-research">
      <section className="chart-toolbar" aria-label="图表控制">
        <div>
          <h3>真实 K 线与状态复现</h3>
        </div>
        <div className="chart-control-groups">
          <div
            className="segmented-control timeframe-control"
            aria-label="时间周期"
          >
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                data-active={timeframe === option.id}
                aria-pressed={timeframe === option.id}
                onClick={() => setTimeframe(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="segmented-control" aria-label="图表范围">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                data-active={range === option.id}
                aria-pressed={range === option.id}
                onClick={() => setRange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showIndicators}
              onChange={(event) => setShowIndicators(event.target.checked)}
            />
            Trader-C 指标
          </label>
          {asset.symbol === "QQQ" && (
            <label className="layer-toggle">
              <input
                type="checkbox"
                checked={showForecast}
                onChange={(event) => setShowForecast(event.target.checked)}
                disabled={!canShowForecast}
              />
              {canShowForecast ? "预测图层" : "预测图层（日/周）"}
            </label>
          )}
        </div>
      </section>

      {market.loading && (
        <div className="chart-loading" role="status">
          <span />
          <p>
            正在载入 {marketSymbol} 的
            {requestTimeframe === "1D" ? "两年日线" : requestTimeframe}…
          </p>
        </div>
      )}

      {!market.loading && market.error && (
        <div className="chart-error" role="alert">
          <div>
            <strong>行情暂时没有载入</strong>
            <p>{market.error}</p>
          </div>
          <button
            type="button"
            className="button button-quiet"
            onClick={() => setRequestVersion((value) => value + 1)}
          >
            重试
          </button>
        </div>
      )}

      {!market.loading && !market.error && visibleBars.length > 0 && (
        <>
          <MarketChart
            symbol={asset.symbol}
            bars={visibleBars}
            indicator={indicator}
            forecast={
              asset.symbol === "QQQ" ? selectedForecast : undefined
            }
            showForecast={
              asset.symbol === "QQQ" && showForecast && canShowForecast
            }
            showIndicators={showIndicators}
            dataSource={market.source}
            timeframe={timeframe}
          />
          {market.derivatives && (
            <DerivativesReadout
              snapshot={market.derivatives}
              bars={market.bars}
            />
          )}
          {showIndicators && (
            <section className="indicator-status" aria-label="指标当前状态">
            <div>
              <span>动量</span>
              <strong
                data-tone={
                  indicator.snapshot?.momentum === "向上"
                    ? "positive"
                    : indicator.snapshot?.momentum === "向下"
                      ? "negative"
                      : "neutral"
                }
              >
                {indicator.snapshot?.momentum ?? "数据不足"}
              </strong>
              <small>
                ATR 标准分{" "}
                {indicator.snapshot?.momentumScore.toFixed(2) ?? "—"}
              </small>
            </div>
            <div>
              <span>波动状态</span>
              <strong>{indicator.snapshot?.volatility ?? "数据不足"}</strong>
              <small>ATR/价格相对 50 期中位数</small>
            </div>
            <div>
              <span>价格结构</span>
              <strong>{indicator.snapshot?.structure ?? "数据不足"}</strong>
              <small>近 10 期高低点对比前 10 期</small>
            </div>
            <div>
              <span>通道位置</span>
              <strong>{indicator.snapshot?.channelPosition ?? "数据不足"}</strong>
              <small>20 期高低通道</small>
            </div>
            </section>
          )}
        </>
      )}

      {showIndicators && (
        <section className="indicator-method">
          <div>
            <h3>Trader-C 公开框架复现版</h3>
          </div>
          <p>
            以多周期趋势、动量状态、波动区间、HH/HL 或 LH/LL
            结构、通道位置与 VWAP 组合判断。向上/向下阈值为
            EMA20 与 EMA50 之差除以 ATR14 后超过
            ±0.6；图上状态标记只在组合切换时出现。
          </p>
          <strong>
            非原作者付费指标公式；所有计算规则在本站代码中可审计。
          </strong>
        </section>
      )}

      {asset.symbol === "QQQ" && (
        <section className="forecast-workspace" aria-label="QQQ 走势推演">
          <ForecastArchive
            forecasts={forecasts}
            selectedId={selectedForecastId}
            onLoad={loadForecast}
            onNew={startNewForecast}
          />
          <ForecastEditor
            draft={draft}
            selectedForecast={selectedForecast}
            pendingDelete={pendingDelete}
            onDraft={setDraft}
            onPathPoint={updatePathPoint}
            onSave={saveForecast}
            onDelete={deleteForecast}
            onUndoDelete={undoForecastDelete}
          />
        </section>
      )}

      <p className="market-freshness">
        {market.fetchedAt
          ? `行情拉取：${new Date(market.fetchedAt).toLocaleString("zh-CN")}。`
          : ""}
        免费行情可能延迟，图表只用于研究记录。
      </p>
    </div>
  );
}

function formatMarketNumber(
  value: number | undefined,
  options?: Intl.NumberFormatOptions,
) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", options).format(value);
}

function formatSignedPercent(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}%`;
}

function positioningInterpretation(
  priceChange: number | undefined,
  openInterestChange: number | undefined,
) {
  if (
    priceChange === undefined ||
    openInterestChange === undefined ||
    !Number.isFinite(priceChange) ||
    !Number.isFinite(openInterestChange)
  ) {
    return {
      label: "等待仓位数据",
      detail: "价格与未平仓量不足，暂不归类。",
      tone: "neutral",
    };
  }
  if (priceChange < 0 && openInterestChange < 0) {
    return {
      label: "去杠杆 / 多头平仓",
      detail: "价格与未平仓量同步下降，符合多头撤退或强平的常见特征。",
      tone: "negative",
    };
  }
  if (priceChange < 0 && openInterestChange >= 0) {
    return {
      label: "新空增仓",
      detail: "价格下降但未平仓量增加，更像新增空头推动。",
      tone: "negative",
    };
  }
  if (priceChange >= 0 && openInterestChange >= 0) {
    return {
      label: "趋势增仓",
      detail: "价格与未平仓量同步上升，杠杆资金在顺势加码。",
      tone: "positive",
    };
  }
  return {
    label: "回补推动",
    detail: "价格上升但未平仓量下降，更像空头回补而非新增多头。",
    tone: "warning",
  };
}

function DerivativesReadout({
  snapshot,
  bars,
}: {
  snapshot: DerivativesSnapshot;
  bars: MarketBar[];
}) {
  const latestClose = bars.at(-1)?.close;
  const latestTime = bars.at(-1)?.time;
  const sevenDaysAgo =
    latestTime === undefined
      ? undefined
      : marketTimeToMilliseconds(latestTime) - 7 * 24 * 60 * 60 * 1000;
  const comparisonClose =
    sevenDaysAgo === undefined
      ? undefined
      : [...bars]
          .reverse()
          .find(
            (bar) => marketTimeToMilliseconds(bar.time) <= sevenDaysAgo,
          )?.close;
  const priceChange7d =
    latestClose !== undefined &&
    comparisonClose !== undefined &&
    comparisonClose !== 0
      ? ((latestClose - comparisonClose) / comparisonClose) * 100
      : undefined;
  const interpretation = positioningInterpretation(
    priceChange7d,
    snapshot.openInterestChange7dPercent,
  );
  const fundingTone =
    (snapshot.fundingRatePercent ?? 0) > 0.03
      ? "warning"
      : (snapshot.fundingRatePercent ?? 0) < -0.03
        ? "negative"
        : "neutral";

  return (
    <section className="derivatives-panel" aria-label="永续合约仓位温度">
      <header>
        <div>
          <span>永续合约仓位温度</span>
          <strong data-tone={interpretation.tone}>
            {interpretation.label}
          </strong>
        </div>
        <p>
          近 7 日价格 {formatSignedPercent(priceChange7d)} · 未平仓量{" "}
          {formatSignedPercent(snapshot.openInterestChange7dPercent)}
        </p>
      </header>
      <div className="derivatives-status">
        <div>
          <span>标记价格</span>
          <strong>
            {formatMarketNumber(snapshot.markPrice, {
              maximumFractionDigits: 2,
            })}
          </strong>
          <small>{snapshot.contract}</small>
        </div>
        <div>
          <span>标记 / 指数基差</span>
          <strong>{formatSignedPercent(snapshot.basisPercent)}</strong>
          <small>
            指数价{" "}
            {formatMarketNumber(snapshot.indexPrice, {
              maximumFractionDigits: 2,
            })}
          </small>
        </div>
        <div>
          <span>当期资金费率</span>
          <strong data-tone={fundingTone}>
            {formatSignedPercent(snapshot.fundingRatePercent)}
          </strong>
          <small>
            {snapshot.nextFundingTime
              ? `下次 ${new Date(snapshot.nextFundingTime).toLocaleString(
                  "zh-CN",
                  { hour: "2-digit", minute: "2-digit" },
                )}`
              : "结算时间待更新"}
          </small>
        </div>
        <div>
          <span>近 3 日平均费率</span>
          <strong>
            {formatSignedPercent(snapshot.averageFundingRate3dPercent)}
          </strong>
          <small>每 8 小时一期</small>
        </div>
        <div>
          <span>未平仓量</span>
          <strong>
            {formatMarketNumber(snapshot.openInterest, {
              notation: "compact",
              maximumFractionDigits: 2,
            })}
          </strong>
          <small>
            名义价值{" "}
            {formatMarketNumber(snapshot.openInterestNotional, {
              style: "currency",
              currency: "USD",
              notation: "compact",
              maximumFractionDigits: 2,
            })}
          </small>
        </div>
      </div>
      <p>
        {interpretation.detail}
        {"  "}
        这是价格与仓位的启发式归类；资金费率为正表示多头付费给空头，不能单独作为反转信号。
      </p>
    </section>
  );
}

function ForecastArchive({
  forecasts,
  selectedId,
  onLoad,
  onNew,
}: {
  forecasts: ForecastRecord[];
  selectedId: string;
  onLoad: (record: ForecastRecord) => void;
  onNew: () => void;
}) {
  return (
    <aside className="forecast-archive">
      <header>
        <div>
          <h3>按日期调取推演</h3>
        </div>
        <button type="button" className="button button-quiet" onClick={onNew}>
          新建
        </button>
      </header>
      <div className="forecast-date-list">
        {forecasts.map((record) => (
          <button
            type="button"
            key={record.id}
            data-active={record.id === selectedId}
            aria-pressed={record.id === selectedId}
            onClick={() => onLoad(record)}
          >
            <span>{record.asOfDate}</span>
            <strong>{record.title}</strong>
            <small data-bias={record.bias}>{BIAS_LABEL[record.bias]}</small>
          </button>
        ))}
        {forecasts.length === 0 && (
          <p>还没有历史推演。新建一条后，它会按日期保存在这里。</p>
        )}
      </div>
    </aside>
  );
}

function ForecastEditor({
  draft,
  selectedForecast,
  pendingDelete,
  onDraft,
  onPathPoint,
  onSave,
  onDelete,
  onUndoDelete,
}: {
  draft: ForecastDraft;
  selectedForecast?: ForecastRecord;
  pendingDelete: PendingForecastDelete | null;
  onDraft: (draft: ForecastDraft) => void;
  onPathPoint: (
    index: number,
    key: "date" | "price",
    value: string,
  ) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onUndoDelete: () => void;
}) {
  return (
    <form className="forecast-editor" onSubmit={onSave}>
      <header>
        <div>
          <h3>文字假设与图层</h3>
        </div>
        <span>{selectedForecast ? "编辑已存版本" : "新推演"}</span>
      </header>

      <div className="forecast-form-grid">
        <label>
          推演日期
          <input
            required
            type="date"
            value={draft.asOfDate}
            onChange={(event) =>
              onDraft({ ...draft, asOfDate: event.target.value })
            }
          />
        </label>
        <label>
          方向偏置
          <select
            value={draft.bias}
            onChange={(event) =>
              onDraft({
                ...draft,
                bias: event.target.value as ForecastBias,
              })
            }
          >
            <option value="bullish">偏多</option>
            <option value="neutral">中性</option>
            <option value="bearish">偏空</option>
          </select>
        </label>
        <label className="forecast-full-field">
          标题
          <input
            required
            value={draft.title}
            placeholder="例如：突破确认前维持区间假设"
            onChange={(event) =>
              onDraft({ ...draft, title: event.target.value })
            }
          />
        </label>
        <label className="forecast-full-field">
          当前预期
          <textarea
            required
            rows={4}
            value={draft.narrative}
            placeholder="写清市场处于什么结构、你预期下一段如何演化，以及为什么。"
            onChange={(event) =>
              onDraft({ ...draft, narrative: event.target.value })
            }
          />
        </label>
        <label>
          确认价格
          <input
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={draft.triggerPrice}
            placeholder="可留空"
            onChange={(event) =>
              onDraft({ ...draft, triggerPrice: event.target.value })
            }
          />
        </label>
        <label>
          失效价格
          <input
            inputMode="decimal"
            type="number"
            min="0"
            step="0.01"
            value={draft.invalidationPrice}
            placeholder="可留空"
            onChange={(event) =>
              onDraft({ ...draft, invalidationPrice: event.target.value })
            }
          />
        </label>
        <label>
          确认条件
          <textarea
            rows={3}
            value={draft.confirmation}
            placeholder="什么出现才增加仓位或转为偏多？"
            onChange={(event) =>
              onDraft({ ...draft, confirmation: event.target.value })
            }
          />
        </label>
        <label>
          失效条件
          <textarea
            rows={3}
            value={draft.invalidation}
            placeholder="什么出现就承认假设错误？"
            onChange={(event) =>
              onDraft({ ...draft, invalidation: event.target.value })
            }
          />
        </label>
      </div>

      <section className="forecast-path-editor">
        <header>
          <div>
            <strong>预期路径点</strong>
            <p>按日期输入目标价格，图上会从推演日实际收盘连接为虚线。</p>
          </div>
          <button
            type="button"
            className="button button-quiet"
            onClick={() =>
              onDraft({
                ...draft,
                path: [...draft.path, { date: "", price: "" }],
              })
            }
          >
            增加路径点
          </button>
        </header>
        {draft.path.map((point, index) => (
          <div className="forecast-path-row" key={`path-${index}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <label>
              <span className="visually-hidden">路径日期</span>
              <input
                type="date"
                value={point.date}
                min={draft.asOfDate}
                onChange={(event) =>
                  onPathPoint(index, "date", event.target.value)
                }
              />
            </label>
            <label>
              <span className="visually-hidden">目标价格</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={point.price}
                placeholder="目标价"
                onChange={(event) =>
                  onPathPoint(index, "price", event.target.value)
                }
              />
            </label>
            <button
              type="button"
              className="path-remove"
              onClick={() =>
                onDraft({
                  ...draft,
                  path: draft.path.filter(
                    (_, pointIndex) => pointIndex !== index,
                  ),
                })
              }
            >
              移除
            </button>
          </div>
        ))}
        {!draft.path.length && (
          <p className="forecast-path-empty">
            暂无路径点；确认价与失效价仍会以水平线显示。
          </p>
        )}
      </section>

      <footer className="forecast-actions">
        <div>
          {selectedForecast && (
            <button
              type="button"
              className="danger-action"
              onClick={onDelete}
            >
              删除这个日期
            </button>
          )}
          {pendingDelete && (
            <button
              type="button"
              className="forecast-undo"
              onClick={onUndoDelete}
            >
              已删除 {pendingDelete.record.asOfDate} · 撤销
            </button>
          )}
        </div>
        <button type="submit" className="button button-primary">
          保存并显示图层
        </button>
      </footer>
    </form>
  );
}
