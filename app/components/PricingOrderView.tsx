"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchBinanceFuturesMarket,
  isBinanceFuturesSymbol,
} from "../binance-market";
import { resolveMarketSymbol } from "../chart-data";
import {
  calculateTradeMetrics,
  expectedTargetPrice,
  probabilityTotal,
} from "../order-math";
import {
  DECISION_ACTION_LABEL,
  defaultReviewDate,
} from "../decision-log";
import type {
  Asset,
  DecisionAction,
  MarketBar,
  PricingScenario,
  PricingScenarioId,
  TradeInstrument,
  TradePlanRecord,
} from "../types";

const SCENARIO_COPY: Record<
  PricingScenarioId,
  { label: string; hint: string }
> = {
  bear: { label: "Bear", hint: "假设被下修" },
  base: { label: "Base", hint: "市场共识兑现" },
  bull: { label: "Bull", hint: "出现上修" },
};

const CHECKLIST = [
  "我能用一句话说明市场正在定价的变量",
  "我写明了基本面失效条件，不只依赖止损价",
  "若采取行动，计划亏损不会超过风险预算",
  "这不是因为社交媒体情绪而临时追单",
];

type MarketResponse = {
  bars?: MarketBar[];
  error?: string;
  source?: string;
  fetchedAt?: string;
};

type PlanDraft = {
  asOfDate: string;
  action: DecisionAction;
  reviewAt: string;
  currentPrice: string;
  scenarios: Array<{
    id: PricingScenarioId;
    probability: string;
    targetPrice: string;
  }>;
  instrument: TradeInstrument;
  portfolioValue: string;
  maxRiskPercent: string;
  entryPrice: string;
  stopPrice: string;
  targetPrice: string;
  expiry: string;
  strike: string;
  exitPremium: string;
  multiplier: string;
  quantity: string;
  thesis: string;
  invalidation: string;
  checklist: string[];
};

function currentDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function asNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function asOptionalNumber(value: string) {
  const parsed = asNumber(value);
  return parsed > 0 ? parsed : undefined;
}

function formatMoney(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function emptyDraft(asset: Asset): PlanDraft {
  const asOfDate = currentDate();
  return {
    asOfDate,
    action: "wait",
    reviewAt: defaultReviewDate(asOfDate),
    currentPrice: "",
    scenarios: [
      { id: "bear", probability: "25", targetPrice: "" },
      { id: "base", probability: "50", targetPrice: "" },
      { id: "bull", probability: "25", targetPrice: "" },
    ],
    instrument: "stock",
    portfolioValue: "",
    maxRiskPercent: "1",
    entryPrice: "",
    stopPrice: "",
    targetPrice: "",
    expiry: "",
    strike: "",
    exitPremium: "",
    multiplier: "100",
    quantity: "",
    thesis: asset.thesis,
    invalidation: asset.invalidation.join("\n"),
    checklist: [],
  };
}

function recordToDraft(record: TradePlanRecord): PlanDraft {
  return {
    asOfDate: record.asOfDate,
    action: record.action,
    reviewAt: record.reviewAt,
    currentPrice: record.currentPrice.toString(),
    scenarios: record.scenarios.map((scenario) => ({
      id: scenario.id,
      probability: scenario.probability.toString(),
      targetPrice: scenario.targetPrice.toString(),
    })),
    instrument: record.instrument,
    portfolioValue: record.portfolioValue.toString(),
    maxRiskPercent: record.maxRiskPercent.toString(),
    entryPrice: record.entryPrice.toString(),
    stopPrice: record.stopPrice?.toString() ?? "",
    targetPrice: record.targetPrice?.toString() ?? "",
    expiry: record.expiry ?? "",
    strike: record.strike?.toString() ?? "",
    exitPremium: record.exitPremium?.toString() ?? "",
    multiplier: record.multiplier.toString(),
    quantity: record.quantity.toString(),
    thesis: record.thesis,
    invalidation: record.invalidation,
    checklist: record.checklist,
  };
}

function planScenarios(draft: PlanDraft): PricingScenario[] {
  return draft.scenarios.map((scenario) => ({
    id: scenario.id,
    probability: asNumber(scenario.probability),
    targetPrice: asNumber(scenario.targetPrice),
  }));
}

export function PricingOrderView({
  asset,
  records,
  onSave,
}: {
  asset: Asset;
  records: TradePlanRecord[];
  onSave: (record: TradePlanRecord) => void;
}) {
  const [draft, setDraft] = useState<PlanDraft>(() => emptyDraft(asset));
  const [market, setMarket] = useState({
    loading: true,
    source: "",
    fetchedAt: "",
    error: "",
  });
  const [notice, setNotice] = useState("");
  const marketSymbol = resolveMarketSymbol(asset.symbol, asset.market);
  const assetRecords = useMemo(
    () =>
      records
        .filter((record) => record.symbol === asset.symbol)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [asset.symbol, records],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setDraft(
        assetRecords[0] ? recordToDraft(assetRecords[0]) : emptyDraft(asset),
      );
    });
    return () => {
      active = false;
    };
  }, [asset, assetRecords]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setMarket({ loading: true, source: "", fetchedAt: "", error: "" });
      }
    });

    async function loadMarket(): Promise<MarketResponse> {
      if (isBinanceFuturesSymbol(marketSymbol)) {
        const periodEnd = new Date();
        periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
        const periodStart = new Date(periodEnd);
        periodStart.setUTCFullYear(periodStart.getUTCFullYear() - 2);
        return fetchBinanceFuturesMarket(
          marketSymbol,
          periodStart,
          periodEnd,
          "1D",
          controller.signal,
        );
      }

      const response = await fetch(
        `/api/market?symbol=${encodeURIComponent(marketSymbol)}`,
        { signal: controller.signal },
      );
      const payload = (await response.json()) as MarketResponse;
      if (!response.ok) throw new Error(payload.error || "行情请求失败。");
      return payload;
    }

    void loadMarket()
      .then((payload) => {
        const latest = payload.bars?.at(-1);
        if (!latest) throw new Error("行情源没有返回可用收盘价。");
        const price = latest.close.toFixed(2);
        setMarket({
          loading: false,
          source: payload.source ?? "免费历史行情",
          fetchedAt: payload.fetchedAt ?? "",
          error: "",
        });
        setDraft((current) => {
          if (current.currentPrice) return current;
          return {
            ...current,
            currentPrice: price,
            entryPrice: current.entryPrice || price,
          };
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMarket({
          loading: false,
          source: "",
          fetchedAt: "",
          error: error instanceof Error ? error.message : "行情请求失败。",
        });
      });

    return () => controller.abort();
  }, [marketSymbol]);

  const scenarios = useMemo(() => planScenarios(draft), [draft]);
  const probability = useMemo(() => probabilityTotal(scenarios), [scenarios]);
  const expectedPrice = useMemo(
    () => expectedTargetPrice(scenarios),
    [scenarios],
  );
  const currentPrice = asNumber(draft.currentPrice);
  const expectedReturn =
    expectedPrice !== undefined && currentPrice > 0
      ? (expectedPrice / currentPrice - 1) * 100
      : undefined;
  const metrics = useMemo(
    () =>
      calculateTradeMetrics({
        instrument: draft.instrument,
        portfolioValue: asNumber(draft.portfolioValue),
        maxRiskPercent: asNumber(draft.maxRiskPercent),
        entryPrice: asNumber(draft.entryPrice),
        stopPrice: asOptionalNumber(draft.stopPrice),
        targetPrice: asOptionalNumber(draft.targetPrice),
        strike: asOptionalNumber(draft.strike),
        exitPremium: asOptionalNumber(draft.exitPremium),
        multiplier: asNumber(draft.multiplier),
        quantity: asNumber(draft.quantity),
      }),
    [draft],
  );
  const isProbabilityValid = Math.abs(probability - 100) < 0.001;
  const hasScenarioTargets = scenarios.every(
    (scenario) => scenario.targetPrice > 0,
  );
  const isRiskValid =
    metrics.plannedRisk > 0 && metrics.plannedRisk <= metrics.riskBudget;
  const isChecklistComplete = draft.checklist.length === CHECKLIST.length;
  const hasInstrumentTerms =
    draft.instrument === "stock"
      ? asNumber(draft.stopPrice) > 0 &&
        asNumber(draft.entryPrice) > asNumber(draft.stopPrice)
      : Boolean(draft.expiry) && asNumber(draft.strike) > 0;
  const canSave =
    isProbabilityValid &&
    hasScenarioTargets &&
    currentPrice > 0 &&
    Boolean(draft.reviewAt) &&
    (draft.action === "wait" ||
      (asNumber(draft.entryPrice) > 0 &&
        asNumber(draft.quantity) > 0 &&
        isRiskValid &&
        hasInstrumentTerms)) &&
    isChecklistComplete &&
    draft.thesis.trim().length > 0 &&
    draft.invalidation.trim().length > 0;

  function updateScenario(
    id: PricingScenarioId,
    field: "probability" | "targetPrice",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      scenarios: current.scenarios.map((scenario) =>
        scenario.id === id ? { ...scenario, [field]: value } : scenario,
      ),
    }));
  }

  function toggleChecklist(item: string) {
    setDraft((current) => ({
      ...current,
      checklist: current.checklist.includes(item)
        ? current.checklist.filter((entry) => entry !== item)
        : [...current.checklist, item],
    }));
  }

  function useSuggestedQuantity() {
    if (!metrics.suggestedQuantity) return;
    setDraft((current) => ({
      ...current,
      quantity: metrics.suggestedQuantity.toString(),
    }));
  }

  function persistPlan() {
    if (!canSave) {
      setNotice("先补齐定价、仓位与确认项；风险金额必须在预算内。");
      return;
    }
    const record: TradePlanRecord = {
      id: `${asset.symbol}-${draft.asOfDate}`,
      symbol: asset.symbol,
      assetName: asset.name,
      asOfDate: draft.asOfDate,
      currentPrice,
      scenarios,
      instrument: draft.instrument,
      portfolioValue: asNumber(draft.portfolioValue),
      maxRiskPercent: asNumber(draft.maxRiskPercent),
      entryPrice: asNumber(draft.entryPrice),
      stopPrice: asOptionalNumber(draft.stopPrice),
      targetPrice: asOptionalNumber(draft.targetPrice),
      expiry: draft.expiry || undefined,
      strike: asOptionalNumber(draft.strike),
      exitPremium: asOptionalNumber(draft.exitPremium),
      multiplier: asNumber(draft.multiplier),
      quantity: Math.floor(asNumber(draft.quantity)),
      thesis: draft.thesis.trim(),
      invalidation: draft.invalidation.trim(),
      checklist: draft.checklist,
      action: draft.action,
      status: "planned",
      reviewAt: draft.reviewAt,
      outcome: "open",
      reviewNote: "",
      marketSource: market.source,
      marketFetchedAt: market.fetchedAt,
      updatedAt: new Date().toISOString(),
    };
    onSave(record);
    setNotice(`${draft.asOfDate} 的决策已保存并加入跨设备同步。`);
  }

  async function copyOrderTicket() {
    if (draft.action === "wait") {
      setNotice("当前记录是等待决策，不生成下单清单。");
      return;
    }
    if (!canSave) {
      setNotice("下单清单尚未通过风险与确认检查。");
      return;
    }
    const instrument =
      draft.instrument === "stock"
        ? "买入股票"
        : draft.instrument === "call"
          ? "买入 Call"
          : "买入 Put";
    const optionTerms =
      draft.instrument === "stock"
        ? ""
        : `\n到期日：${draft.expiry || "待填"}\n行权价：${formatMoney(asOptionalNumber(draft.strike))}\n权利金：${formatMoney(asNumber(draft.entryPrice))}\n合约乘数：${draft.multiplier}`;
    const ticket = `${asset.symbol} · ${asset.name}
计划日期：${draft.asOfDate}
方向：${instrument}
数量：${Math.floor(asNumber(draft.quantity))}
计划入场：${formatMoney(asNumber(draft.entryPrice))}${optionTerms}
风险预算：${formatMoney(metrics.riskBudget)}
计划最大损失：${formatMoney(metrics.plannedRisk)}
目标/计划退出：${
      draft.instrument === "stock"
        ? formatMoney(asOptionalNumber(draft.targetPrice))
        : formatMoney(asOptionalNumber(draft.exitPremium))
    }
失效条件：${draft.invalidation.trim()}
交易假设：${draft.thesis.trim()}

执行说明：这是研究与下单前清单，不代表券商已接单。提交前再次核对报价、流动性、合约代码与订单类型。`;
    try {
      await navigator.clipboard.writeText(ticket);
      setNotice("下单清单已复制；请在券商端复核合约与报价后再提交。");
    } catch {
      setNotice("浏览器未允许复制，请手动保存当前计划。");
    }
  }

  return (
    <div className="pricing-order">
      <section className="pricing-order-intro">
        <div>
          <p className="section-label">SCENARIO PRICING</p>
          <h3>先算预期，再决定风险预算</h3>
        </div>
        <p>
          这里把研究结论转成可检查的动作、情景定价与复盘日。等待也是有效决策；当前不连接券商，也不发送委托。
        </p>
      </section>

      <section className="order-panel">
        <header className="order-panel-heading">
          <div>
            <span>01</span>
            <h3>情景定价</h3>
          </div>
          <label className="compact-field">
            计划日期
            <input
              type="date"
              value={draft.asOfDate}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  asOfDate: event.target.value,
                }))
              }
            />
          </label>
        </header>

        <div className="decision-plan-row">
          <label>
            本次动作
            <select
              value={draft.action}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  action: event.target.value as DecisionAction,
                }))
              }
            >
              {Object.entries(DECISION_ACTION_LABEL).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            计划复盘日
            <input
              type="date"
              value={draft.reviewAt}
              min={draft.asOfDate}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reviewAt: event.target.value,
                }))
              }
            />
          </label>
          <p>
            {draft.action === "wait"
              ? "不为行动而行动：写清等待什么、什么变化会让你改主意。"
              : "这是计划动作，不是已成交记录；到复盘日检查判断和执行是否一致。"}
          </p>
        </div>

        <div className="market-price-row">
          <label>
            参考现价
            <input
              inputMode="decimal"
              value={draft.currentPrice}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  currentPrice: event.target.value,
                }))
              }
              placeholder="0.00"
            />
          </label>
          <div>
            <span>行情状态</span>
            <strong>
              {market.loading
                ? "正在读取"
                : market.error
                  ? "需手动填写"
                  : market.source}
            </strong>
            <small>{market.error || "使用最近可用日线收盘价，非实时盘口。"}</small>
          </div>
        </div>

        <div className="scenario-grid">
          {draft.scenarios.map((scenario) => (
            <div className={`scenario-card ${scenario.id}`} key={scenario.id}>
              <header>
                <strong>{SCENARIO_COPY[scenario.id].label}</strong>
                <span>{SCENARIO_COPY[scenario.id].hint}</span>
              </header>
              <label>
                概率
                <span className="input-suffix">
                  <input
                    inputMode="decimal"
                    value={scenario.probability}
                    onChange={(event) =>
                      updateScenario(
                        scenario.id,
                        "probability",
                        event.target.value,
                      )
                    }
                  />
                  <span>%</span>
                </span>
              </label>
              <label>
                目标价
                <span className="input-prefix">
                  <span>$</span>
                  <input
                    inputMode="decimal"
                    value={scenario.targetPrice}
                    onChange={(event) =>
                      updateScenario(
                        scenario.id,
                        "targetPrice",
                        event.target.value,
                      )
                    }
                  />
                </span>
              </label>
            </div>
          ))}
        </div>

        <div className="pricing-output" data-valid={isProbabilityValid}>
          <div>
            <span>概率合计</span>
            <strong>{probability.toFixed(0)}%</strong>
          </div>
          <div>
            <span>概率加权目标</span>
            <strong>{formatMoney(expectedPrice)}</strong>
          </div>
          <div>
            <span>相对现价预期</span>
            <strong>{formatPercent(expectedReturn)}</strong>
          </div>
          {!isProbabilityValid && <p>三种情景概率必须合计 100%。</p>}
        </div>
      </section>

      <section className="order-panel">
        <header className="order-panel-heading">
          <div>
            <span>02</span>
            <h3>风险预算与工具</h3>
          </div>
          {assetRecords.length > 0 && (
            <label className="compact-field">
              调出历史计划
              <select
                value=""
                onChange={(event) => {
                  const record = assetRecords.find(
                    (item) => item.id === event.target.value,
                  );
                  if (record) setDraft(recordToDraft(record));
                }}
              >
                <option value="">选择日期</option>
                {assetRecords.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.asOfDate}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        {draft.action === "wait" ? (
          <div className="wait-decision-note">
            <strong>当前选择：等待 / 不行动</strong>
            <p>
              不要求填写仓位和止损，但仍需完成情景目标、交易假设、失效条件与确认项。
            </p>
          </div>
        ) : (
          <>
        <div className="order-form-grid">
          <label>
            账户净值（USD）
            <input
              inputMode="decimal"
              value={draft.portfolioValue}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  portfolioValue: event.target.value,
                }))
              }
              placeholder="100000"
            />
          </label>
          <label>
            单笔最大风险
            <span className="input-suffix">
              <input
                inputMode="decimal"
                value={draft.maxRiskPercent}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxRiskPercent: event.target.value,
                  }))
                }
              />
              <span>%</span>
            </span>
          </label>
          <label>
            工具
            <select
              value={draft.instrument}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  instrument: event.target.value as TradeInstrument,
                  entryPrice: "",
                  quantity: "",
                }))
              }
            >
              <option value="stock">买入股票</option>
              <option value="call">买入 Call</option>
              <option value="put">买入 Put</option>
            </select>
          </label>
          <label>
            {draft.instrument === "stock" ? "计划入场价" : "权利金 / 股"}
            <input
              inputMode="decimal"
              value={draft.entryPrice}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  entryPrice: event.target.value,
                }))
              }
              placeholder="0.00"
            />
          </label>

          {draft.instrument === "stock" ? (
            <>
              <label>
                止损价
                <input
                  inputMode="decimal"
                  value={draft.stopPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      stopPrice: event.target.value,
                    }))
                  }
                  placeholder="必须低于入场价"
                />
              </label>
              <label>
                目标价
                <input
                  inputMode="decimal"
                  value={draft.targetPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetPrice: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : (
            <>
              <label>
                到期日
                <input
                  type="date"
                  value={draft.expiry}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      expiry: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                行权价
                <input
                  inputMode="decimal"
                  value={draft.strike}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      strike: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                计划退出权利金
                <input
                  inputMode="decimal"
                  value={draft.exitPremium}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      exitPremium: event.target.value,
                    }))
                  }
                  placeholder="用于计算计划收益"
                />
              </label>
              <label>
                合约乘数
                <input
                  inputMode="numeric"
                  value={draft.multiplier}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      multiplier: event.target.value,
                    }))
                  }
                />
                <small>标准美股期权通常为 100；调整合约请以券商为准。</small>
              </label>
            </>
          )}

          <label>
            {draft.instrument === "stock" ? "股数" : "合约数"}
            <input
              inputMode="numeric"
              value={draft.quantity}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
              placeholder="0"
            />
          </label>
          <div className="suggested-size">
            <span>风险预算建议</span>
            <strong>{metrics.suggestedQuantity || "—"}</strong>
            <button type="button" onClick={useSuggestedQuantity}>
              采用建议数量
            </button>
          </div>
        </div>

        <div className="risk-output">
          <div>
            <span>风险预算</span>
            <strong>{formatMoney(metrics.riskBudget)}</strong>
          </div>
          <div data-warning={metrics.plannedRisk > metrics.riskBudget}>
            <span>计划最大损失</span>
            <strong>{formatMoney(metrics.plannedRisk)}</strong>
          </div>
          <div>
            <span>占用资金</span>
            <strong>{formatMoney(metrics.capitalRequired)}</strong>
          </div>
          <div>
            <span>计划收益</span>
            <strong>{formatMoney(metrics.plannedReward)}</strong>
          </div>
          <div>
            <span>收益 / 风险</span>
            <strong>
              {metrics.riskReward !== undefined
                ? `${metrics.riskReward.toFixed(2)}×`
                : "—"}
            </strong>
          </div>
          <div>
            <span>到期盈亏平衡</span>
            <strong>{formatMoney(metrics.breakEven)}</strong>
          </div>
        </div>
          </>
        )}
      </section>

      <section className="order-panel">
        <header className="order-panel-heading">
          <div>
            <span>03</span>
            <h3>交易假设与提交前确认</h3>
          </div>
        </header>

        <div className="order-thesis-grid">
          <label>
            交易假设
            <textarea
              rows={5}
              value={draft.thesis}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  thesis: event.target.value,
                }))
              }
            />
          </label>
          <label>
            失效条件
            <textarea
              rows={5}
              value={draft.invalidation}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  invalidation: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div className="preflight-list">
          {CHECKLIST.map((item) => (
            <label key={item}>
              <input
                type="checkbox"
                checked={draft.checklist.includes(item)}
                onChange={() => toggleChecklist(item)}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>

        <div className="order-actions">
          <p role="status">
            {notice || "计划会随研究工作区同步；未登录时仍保存在本机。"}
          </p>
          <div>
            <button
              type="button"
              className="button button-quiet"
              onClick={persistPlan}
            >
              保存当日计划
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!canSave || draft.action === "wait"}
              onClick={copyOrderTicket}
            >
              复制下单清单
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
