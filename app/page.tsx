"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { CATEGORY_DEFINITIONS, DEFAULT_ASSETS } from "./data";
import { ChartResearchView } from "./components/ChartResearchView";
import { PricingOrderView } from "./components/PricingOrderView";
import {
  buildDecisionQueue,
  DECISION_ACTION_LABEL,
  DECISION_OUTCOME_LABEL,
  normalizeTradePlans,
  ORDER_PLAN_STORAGE_KEY,
  type DecisionQueueItem,
  type DecisionQueueSummary,
} from "./decision-log";
import {
  buildEventRadar,
  type EventRadarItem,
  type EventRadarSummary,
} from "./event-radar";
import {
  buildPortfolioRisk,
  THEME_MONITOR,
  type PortfolioRiskReport,
} from "./portfolio-risk";
import {
  buildResearchQueue,
  type ResearchPriority,
  type ResearchQueueItem,
} from "./research-priority";
import {
  clearAssetTombstone,
  isWorkspacePayload,
  isTombstoneRecord,
  markAssetDeleted,
  mergeWorkspaces,
  normalizeWorkspace,
  TOMBSTONE_STORAGE_KEY,
  type CloudWorkspace,
  type WorkspacePayload,
} from "./workspace-sync";
import {
  evaluateTwoCompletedBullishWeeks,
  isUsListedMarket,
  type TwoWeekBullishResult,
} from "./weekly-screen";
import type {
  Asset,
  AssetStatus,
  DecisionOutcome,
  MarketBar,
  Regime,
  ResearchComparison,
  ResearchEvent,
  ResearchEventKind,
  ResearchSnapshot,
  ResearchVerdict,
  SignalState,
  TechnicalLevel,
  TradePlanRecord,
} from "./types";

const STORAGE_KEY = "trader-research-desk:v1";
const CROSS_ASSET_MIGRATION_KEY =
  "trader-research-desk:migration:cross-assets-2026-07";
const EVENT_RADAR_MIGRATION_KEY =
  "trader-research-desk:migration:event-radar-2026-08";
const MANUAL_REFRESH_MIGRATION_KEY =
  "trader-research-desk:migration:manual-refresh-2026-09-30";
const CROSS_ASSET_IDS = new Set([
  "gold-futures",
  "silver-futures",
  "wti-futures",
  "btc-perpetual",
  "eth-perpetual",
]);

type FilterKey = "all" | AssetStatus | Regime | "two-week-bullish";
type ViewKey =
  | "thesis"
  | "compare"
  | "signals"
  | "technical"
  | "chart"
  | "order"
  | "framework";
type PendingDelete = { asset: Asset; index: number };
type AssetDialogIntent = "add" | "edit" | "refresh";
type GeneratedAsset = Omit<
  Asset,
  "id" | "status" | "updatedAt" | "previousVersion" | "lastComparison"
>;
type ResearchApiResponse = {
  asset?: GeneratedAsset;
  warnings?: string[];
  resolved?: {
    symbol?: string;
    name?: string;
    exchange?: string;
  };
  evidence?: {
    priceDate?: string;
    filingCount?: number;
    filingStatus?:
      | "ok"
      | "not_applicable"
      | "ticker_unresolved"
      | "mapping_unavailable"
      | "submissions_unavailable"
      | "no_recent_filings";
    newsCount?: number;
    latestNewsDate?: string;
    sourceCount?: number;
  };
  comparison?: {
    changeSummary?: string[];
    drivers?: string[];
    verdicts?: ResearchVerdict[];
    recentNews?: ResearchComparison["recentNews"];
  };
  mode?: "initial" | "refresh";
  model?: string;
  generatedAt?: string;
  error?: string;
};
type SyncStatus =
  | "checking"
  | "signed-out"
  | "local-only"
  | "syncing"
  | "synced"
  | "error";
type WorkspaceApiResponse = {
  signedIn?: boolean;
  syncAvailable?: boolean;
  displayName?: string;
  signInPath?: string;
  workspace?: CloudWorkspace;
  error?: string;
};
type WeeklyScreenEntry = TwoWeekBullishResult & {
  symbol: string;
  source: string;
  fetchedAt: string;
  error?: string;
};
type WeeklyScreenState = {
  status: "idle" | "loading" | "ready";
  entries: Record<string, WeeklyScreenEntry>;
  completed: number;
  total: number;
  scannedAt: string;
};
type MarketApiResponse = {
  bars?: MarketBar[];
  source?: string;
  fetchedAt?: string;
  error?: string;
};

const SEC_STATUS_LABEL: Record<
  NonNullable<ResearchApiResponse["evidence"]>["filingStatus"] &
    string,
  string
> = {
  ok: "已取得",
  not_applicable: "不适用",
  ticker_unresolved: "代码未解析",
  mapping_unavailable: "映射源不可用",
  submissions_unavailable: "披露源不可用",
  no_recent_filings: "无近期文件",
};

const VERDICT_LABEL: Record<ResearchVerdict["verdict"], string> = {
  confirmed: "已验证",
  invalidated: "已证伪",
  open: "仍待验证",
};

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "holding", label: "持仓" },
  { id: "watching", label: "观察" },
  { id: "two-week-bullish", label: "连续2周阳线" },
  { id: "type1", label: "第一类" },
  { id: "type2", label: "第二类" },
  { id: "type3", label: "第三类" },
  { id: "unclassified", label: "待分类" },
];

const STATUS_LABEL: Record<AssetStatus, string> = {
  watching: "观察",
  holding: "持仓",
  avoid: "回避",
};

const SIGNAL_LABEL: Record<SignalState, string> = {
  positive: "正向",
  warning: "观察",
  negative: "负向",
  neutral: "待验证",
};

const CONVICTION_LABEL: Record<Asset["conviction"], string> = {
  high: "高",
  medium: "中",
  low: "低",
  pending: "待定",
};

const RESEARCH_PRIORITY_LABEL: Record<ResearchPriority, string> = {
  urgent: "优先处理",
  review: "需要复核",
  current: "保持观察",
};

const EVENT_KIND_LABEL: Record<ResearchEventKind, string> = {
  earnings: "财报",
  macro: "宏观",
  industry: "行业",
  regulatory: "监管",
  product: "产品",
  crypto: "加密",
  other: "其他",
};

const EVENT_IMPACT_LABEL: Record<ResearchEvent["impact"], string> = {
  high: "高影响",
  medium: "中影响",
  low: "低影响",
};

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function splitLines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function optionalPercent(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 100
    ? parsed
    : undefined;
}

function linesToSignals(value: FormDataEntryValue | null, id: string) {
  const validStates: SignalState[] = [
    "positive",
    "warning",
    "negative",
    "neutral",
  ];

  return splitLines(value).map((line, index) => {
    const [label = "验证项", rawState = "neutral", ...note] = line
      .split("|")
      .map((item) => item.trim());
    const state = validStates.includes(rawState as SignalState)
      ? (rawState as SignalState)
      : "neutral";
    return {
      id: `${id}-signal-${index}`,
      label,
      state,
      note: note.join(" | ") || "等待补充验证说明。",
    };
  });
}

function linesToLevels(value: FormDataEntryValue | null) {
  const validRoles: TechnicalLevel["role"][] = [
    "support",
    "resistance",
    "pivot",
  ];

  return splitLines(value).map((line) => {
    const [label = "关键位", levelValue = "待更新", rawRole = "pivot"] = line
      .split("|")
      .map((item) => item.trim());
    const role = validRoles.includes(rawRole as TechnicalLevel["role"])
      ? (rawRole as TechnicalLevel["role"])
      : "pivot";
    return { label, value: levelValue, role };
  });
}

function linesToEvents(value: FormDataEntryValue | null, assetId: string) {
  const validKinds = new Set<ResearchEventKind>([
    "earnings",
    "macro",
    "industry",
    "regulatory",
    "product",
    "crypto",
    "other",
  ]);
  const validImpacts = new Set<ResearchEvent["impact"]>([
    "high",
    "medium",
    "low",
  ]);
  const validStatuses = new Set<ResearchEvent["status"]>([
    "scheduled",
    "reviewed",
    "cancelled",
  ]);

  return splitLines(value).flatMap((line, index): ResearchEvent[] => {
    const [date = "", title = "", rawKind = "other", rawImpact = "medium", preparation = "", rawStatus = "scheduled", source = ""] = line
      .split("|")
      .map((item) => item.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return [];
    return [
      {
        id: `${assetId}-event-${date}-${index}`,
        date,
        title,
        kind: validKinds.has(rawKind as ResearchEventKind)
          ? (rawKind as ResearchEventKind)
          : "other",
        impact: validImpacts.has(rawImpact as ResearchEvent["impact"])
          ? (rawImpact as ResearchEvent["impact"])
          : "medium",
        status: validStatuses.has(rawStatus as ResearchEvent["status"])
          ? (rawStatus as ResearchEvent["status"])
          : "scheduled",
        preparation: preparation || "事件前补充预期差与失效条件。",
        source: source || undefined,
      },
    ];
  });
}

function eventsToLines(events: ResearchEvent[] | undefined) {
  return (events ?? [])
    .map((event) =>
      [
        event.date,
        event.title,
        event.kind,
        event.impact,
        event.preparation,
        event.status,
        event.source ?? "",
      ].join(" | "),
    )
    .join("\n");
}

function safeEventUrl(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function mergeResearchEvents(
  current: ResearchEvent[] | undefined,
  generated: ResearchEvent[] | undefined,
) {
  const merged = new Map<string, ResearchEvent>();
  for (const event of current ?? []) {
    merged.set(`${event.date}|${event.title.trim().toLowerCase()}`, event);
  }
  for (const event of generated ?? []) {
    const key = `${event.date}|${event.title.trim().toLowerCase()}`;
    const existing = merged.get(key);
    merged.set(
      key,
      existing
        ? { ...event, id: existing.id, status: existing.status }
        : event,
    );
  }
  return Array.from(merged.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function mergeMissingDefaultEvents(
  current: ResearchEvent[] | undefined,
  defaults: ResearchEvent[] | undefined,
) {
  const merged = new Map<string, ResearchEvent>();
  for (const event of defaults ?? []) {
    merged.set(`${event.date}|${event.title.trim().toLowerCase()}`, event);
  }
  for (const event of current ?? []) {
    merged.set(`${event.date}|${event.title.trim().toLowerCase()}`, event);
  }
  return Array.from(merged.values()).sort((left, right) =>
    left.date.localeCompare(right.date),
  );
}

function mergeManualRefreshAssets(currentAssets: Asset[]) {
  const refreshSymbols = new Set(
    DEFAULT_ASSETS.map((asset) => asset.symbol.toUpperCase()),
  );
  const currentBySymbol = new Map(
    currentAssets.map((asset) => [asset.symbol.toUpperCase(), asset]),
  );

  const refreshed = DEFAULT_ASSETS.map((defaultAsset) => {
    const current = currentBySymbol.get(defaultAsset.symbol.toUpperCase());
    if (!current) return defaultAsset;
    return {
      ...defaultAsset,
      id: current.id,
      status: current.status,
      positionSize: current.positionSize,
      portfolioWeight: current.portfolioWeight,
      riskTheme: current.riskTheme,
      averageCost: current.averageCost,
      previousVersion: snapshotAsset(current),
    };
  });

  return [
    ...refreshed,
    ...currentAssets.filter(
      (asset) => !refreshSymbols.has(asset.symbol.toUpperCase()),
    ),
  ];
}

function blankAsset(): Asset {
  return {
    id: "new",
    symbol: "",
    name: "",
    market: "NASDAQ",
    sector: "",
    status: "watching",
    category: "unclassified",
    conviction: "pending",
    updatedAt: todayInShanghai(),
    dataFreshness: "待补充",
    valuationLogic: "",
    thesis: "",
    catalyst: [],
    keyEvents: [],
    invalidation: [],
    fundamentalSignals: [],
    technical: {
      trend: "",
      momentum: "",
      structure: "",
      levels: [],
      action: "",
    },
    sources: [],
  };
}

function snapshotAsset(asset: Asset): ResearchSnapshot {
  return {
    updatedAt: asset.updatedAt,
    dataFreshness: asset.dataFreshness,
    category: asset.category,
    conviction: asset.conviction,
    valuationLogic: asset.valuationLogic,
    thesis: asset.thesis,
    catalyst: [...asset.catalyst],
    keyEvents: asset.keyEvents?.map((event) => ({ ...event })),
    invalidation: [...asset.invalidation],
    fundamentalSignals: asset.fundamentalSignals.map((signal) => ({
      ...signal,
    })),
    technical: {
      ...asset.technical,
      levels: asset.technical.levels.map((level) => ({ ...level })),
    },
    sources: [...asset.sources],
  };
}

function isAssetArray(value: unknown): value is Asset[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "symbol" in item &&
        "technical" in item &&
        "fundamentalSignals" in item,
    )
  );
}

export default function Home() {
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSETS);
  const [selectedId, setSelectedId] = useState(DEFAULT_ASSETS[0].id);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<ViewKey>("thesis");
  const [hydrated, setHydrated] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const [draft, setDraft] = useState<Asset | null>(null);
  const [assetDialogIntent, setAssetDialogIntent] =
    useState<AssetDialogIntent>("add");
  const [pendingComparison, setPendingComparison] =
    useState<ResearchComparison | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<PendingDelete | null>(null);
  const [importError, setImportError] = useState("");
  const [tombstones, setTombstones] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<TradePlanRecord[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("checking");
  const [syncDisplayName, setSyncDisplayName] = useState("");
  const [syncMessage, setSyncMessage] = useState("正在检查云同步…");
  const [weeklyScreen, setWeeklyScreen] = useState<WeeklyScreenState>({
    status: "idle",
    entries: {},
    completed: 0,
    total: 0,
    scannedAt: "",
  });

  const commandDialogRef = useRef<HTMLDialogElement>(null);
  const assetDialogRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weeklyScreenAbortRef = useRef<AbortController | null>(null);
  const cloudRevisionRef = useRef(0);
  const lastSyncedPayloadRef = useRef("");
  const assetsRef = useRef(assets);
  const tombstonesRef = useRef(tombstones);
  const decisionsRef = useRef(decisions);
  assetsRef.current = assets;
  tombstonesRef.current = tombstones;
  decisionsRef.current = decisions;

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        const savedTombstones = window.localStorage.getItem(
          TOMBSTONE_STORAGE_KEY,
        );
        const savedDecisions = window.localStorage.getItem(
          ORDER_PLAN_STORAGE_KEY,
        );
        if (savedDecisions) {
          setDecisions(normalizeTradePlans(JSON.parse(savedDecisions)));
        }
        if (savedTombstones) {
          const parsedTombstones: unknown = JSON.parse(savedTombstones);
          if (isTombstoneRecord(parsedTombstones)) {
            setTombstones(parsedTombstones);
          }
        }
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isAssetArray(parsed)) {
            const hasMigrated = window.localStorage.getItem(
              CROSS_ASSET_MIGRATION_KEY,
            );
            const restoredWithCrossAssets = hasMigrated
              ? parsed
              : [
                  ...parsed,
                  ...DEFAULT_ASSETS.filter(
                    (asset) =>
                      CROSS_ASSET_IDS.has(asset.id) &&
                      !parsed.some(
                        (savedAsset) =>
                          savedAsset.id === asset.id ||
                          savedAsset.symbol === asset.symbol,
                      ),
                  ),
                ];
            const hasEventRadarMigration = window.localStorage.getItem(
              EVENT_RADAR_MIGRATION_KEY,
            );
            const restoredWithEvents = hasEventRadarMigration
              ? restoredWithCrossAssets
              : restoredWithCrossAssets.map((asset) => {
                  const defaultAsset = DEFAULT_ASSETS.find(
                    (item) => item.symbol === asset.symbol,
                  );
                  return defaultAsset?.keyEvents?.length
                    ? {
                        ...asset,
                        keyEvents: mergeMissingDefaultEvents(
                          asset.keyEvents,
                          defaultAsset.keyEvents,
                        ),
                      }
                    : asset;
                });
            const hasManualRefresh = window.localStorage.getItem(
              MANUAL_REFRESH_MIGRATION_KEY,
            );
            const restored = hasManualRefresh
              ? restoredWithEvents
              : mergeManualRefreshAssets(restoredWithEvents);
            window.localStorage.setItem(CROSS_ASSET_MIGRATION_KEY, "done");
            window.localStorage.setItem(EVENT_RADAR_MIGRATION_KEY, "done");
            window.localStorage.setItem(MANUAL_REFRESH_MIGRATION_KEY, "done");
            setAssets(restored);
            setSelectedId(restored[0]?.id ?? "");
          }
        } else {
          window.localStorage.setItem(CROSS_ASSET_MIGRATION_KEY, "done");
          window.localStorage.setItem(EVENT_RADAR_MIGRATION_KEY, "done");
          window.localStorage.setItem(MANUAL_REFRESH_MIGRATION_KEY, "done");
        }
      } catch {
        setImportError("本地数据读取失败，已载入默认研究框架。");
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(assets));
      window.localStorage.setItem(
        TOMBSTONE_STORAGE_KEY,
        JSON.stringify(tombstones),
      );
      window.localStorage.setItem(
        ORDER_PLAN_STORAGE_KEY,
        JSON.stringify(decisions),
      );
    }
  }, [assets, decisions, hydrated, tombstones]);

  useEffect(() => {
    if (!hydrated) return;
    void synchronizeWorkspace();
    // Initial device-to-cloud merge should only run after local data hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || syncStatus !== "synced") return;
    const payload = currentWorkspacePayload();
    const serialized = JSON.stringify(payload);
    if (serialized === lastSyncedPayloadRef.current) return;

    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void pushWorkspace(payload, cloudRevisionRef.current);
    }, 900);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
    // pushWorkspace intentionally reads the latest revision from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, decisions, hydrated, syncStatus, tombstones]);

  useEffect(() => {
    const onShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandQuery("");
        setCommandIndex(0);
        commandDialogRef.current?.showModal();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      weeklyScreenAbortRef.current?.abort();
    },
    [],
  );

  const selectedAsset =
    assets.find((asset) => asset.id === selectedId) ?? assets[0];

  const category =
    CATEGORY_DEFINITIONS.find((item) => item.id === selectedAsset?.category) ??
    CATEGORY_DEFINITIONS[3];

  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) => {
        if (filter === "all") return true;
        if (filter === "two-week-bullish") {
          return Boolean(
            isUsListedMarket(asset.market) &&
              weeklyScreen.entries[asset.symbol.toUpperCase()]?.matched,
          );
        }
        if (["holding", "watching", "avoid"].includes(filter)) {
          return asset.status === filter;
        }
        return asset.category === filter;
      }),
    [assets, filter, weeklyScreen.entries],
  );

  const weeklyScreenErrorCount = useMemo(
    () =>
      Object.values(weeklyScreen.entries).filter((entry) => entry.error)
        .length,
    [weeklyScreen.entries],
  );

  async function refreshWeeklyScreen() {
    weeklyScreenAbortRef.current?.abort();
    const controller = new AbortController();
    weeklyScreenAbortRef.current = controller;
    const targets = assets.filter((asset) => isUsListedMarket(asset.market));

    setWeeklyScreen({
      status: targets.length ? "loading" : "ready",
      entries: {},
      completed: 0,
      total: targets.length,
      scannedAt: targets.length ? "" : new Date().toISOString(),
    });
    if (!targets.length) return;

    let nextIndex = 0;
    const worker = async () => {
      while (!controller.signal.aborted) {
        const asset = targets[nextIndex];
        nextIndex += 1;
        if (!asset) return;

        const symbol = asset.symbol.toUpperCase();
        let entry: WeeklyScreenEntry;
        const requestController = new AbortController();
        const abortFromScan = () => requestController.abort();
        const timeoutId = window.setTimeout(
          () => requestController.abort(),
          12_000,
        );
        controller.signal.addEventListener("abort", abortFromScan, {
          once: true,
        });
        try {
          const response = await fetch(
            `/api/market?symbol=${encodeURIComponent(symbol)}&timeframe=1D`,
            { signal: requestController.signal },
          );
          const payload = (await response.json()) as MarketApiResponse;
          if (!response.ok || !payload.bars?.length) {
            throw new Error(payload.error || "行情暂不可用");
          }
          entry = {
            symbol,
            ...evaluateTwoCompletedBullishWeeks(payload.bars),
            source: payload.source || "公开行情源",
            fetchedAt: payload.fetchedAt || new Date().toISOString(),
          };
        } catch (error) {
          if (controller.signal.aborted) return;
          entry = {
            symbol,
            matched: false,
            reason: "insufficient_data",
            weeks: [],
            source: "",
            fetchedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : "行情暂不可用",
          };
        } finally {
          window.clearTimeout(timeoutId);
          controller.signal.removeEventListener("abort", abortFromScan);
        }

        setWeeklyScreen((current) => ({
          ...current,
          completed: current.completed + 1,
          entries: { ...current.entries, [symbol]: entry },
        }));
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(4, targets.length) }, () => worker()),
    );
    if (!controller.signal.aborted) {
      setWeeklyScreen((current) => ({
        ...current,
        status: "ready",
        scannedAt: new Date().toISOString(),
      }));
    }
  }

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return assets;
    return assets.filter((asset) =>
      [asset.symbol, asset.name, asset.sector, asset.market]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [assets, commandQuery]);

  const summary = useMemo(
    () => ({
      holdings: assets.filter((asset) => asset.status === "holding").length,
      watching: assets.filter((asset) => asset.status === "watching").length,
      warning: assets.filter((asset) =>
        asset.fundamentalSignals.some(
          (signal) => signal.state === "warning" || signal.state === "negative",
        ),
      ).length,
    }),
    [assets],
  );
  const researchQueue = useMemo(
    () => buildResearchQueue(assets, todayInShanghai()),
    [assets],
  );
  const researchQueueSummary = useMemo(
    () => ({
      urgent: researchQueue.filter((item) => item.priority === "urgent")
        .length,
      review: researchQueue.filter((item) => item.priority === "review")
        .length,
      current: researchQueue.filter((item) => item.priority === "current")
        .length,
    }),
    [researchQueue],
  );
  const eventRadar = useMemo(
    () => buildEventRadar(assets, todayInShanghai(), 30),
    [assets],
  );
  const decisionQueue = useMemo(
    () => buildDecisionQueue(decisions, todayInShanghai()),
    [decisions],
  );
  const portfolioRisk = useMemo(() => buildPortfolioRisk(assets), [assets]);

  function currentWorkspacePayload(): WorkspacePayload {
    return {
      schemaVersion: 1,
      assets: assetsRef.current,
      tombstones: tombstonesRef.current,
      decisions: decisionsRef.current,
    };
  }

  function applyWorkspace(workspace: WorkspacePayload) {
    assetsRef.current = workspace.assets;
    tombstonesRef.current = workspace.tombstones;
    decisionsRef.current = workspace.decisions;
    setAssets(workspace.assets);
    setTombstones(workspace.tombstones);
    setDecisions(workspace.decisions);
    setSelectedId((current) =>
      workspace.assets.some((asset) => asset.id === current)
        ? current
        : (workspace.assets[0]?.id ?? ""),
    );
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(workspace.assets),
    );
    window.localStorage.setItem(
      TOMBSTONE_STORAGE_KEY,
      JSON.stringify(workspace.tombstones),
    );
    window.localStorage.setItem(
      ORDER_PLAN_STORAGE_KEY,
      JSON.stringify(workspace.decisions),
    );
  }

  async function pushWorkspace(
    workspace: WorkspacePayload,
    baseRevision: number,
    retry = true,
  ) {
    setSyncStatus("syncing");
    setSyncMessage("正在保存到云端…");
    try {
      const response = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace, baseRevision }),
      });
      const payload = (await response.json()) as WorkspaceApiResponse;

      if (response.status === 501 || payload.syncAvailable === false) {
        setSyncStatus("local-only");
        setSyncMessage("当前部署使用本机保存 · 可导入导出备份");
        return;
      }

      if (response.status === 401) {
        setSyncStatus("signed-out");
        setSyncMessage("登录后可在手机和电脑之间同步");
        return;
      }

      if (
        response.status === 409 &&
        retry &&
        payload.workspace
      ) {
        const merged = mergeWorkspaces(workspace, payload.workspace);
        applyWorkspace(merged);
        await pushWorkspace(merged, payload.workspace.revision, false);
        return;
      }

      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error || "云同步失败。");
      }

      cloudRevisionRef.current = payload.workspace.revision;
      lastSyncedPayloadRef.current = JSON.stringify(workspace);
      setSyncDisplayName(payload.displayName ?? syncDisplayName);
      setSyncStatus("synced");
      setSyncMessage(
        `已同步${payload.workspace.updatedAt ? ` · ${new Date(payload.workspace.updatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : ""}`,
      );
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(
        error instanceof Error ? error.message : "云同步暂时不可用。",
      );
    }
  }

  async function synchronizeWorkspace() {
    setSyncStatus((current) =>
      current === "checking" ? "checking" : "syncing",
    );
    setSyncMessage("正在合并本机与云端数据…");
    try {
      const response = await fetch("/api/workspace", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as WorkspaceApiResponse;

      if (response.status === 501 || payload.syncAvailable === false) {
        setSyncStatus("local-only");
        setSyncMessage("当前部署使用本机保存 · 可导入导出备份");
        return;
      }

      if (response.status === 401) {
        setSyncStatus("signed-out");
        setSyncMessage("登录后可在手机和电脑之间同步");
        return;
      }
      if (!response.ok || !payload.workspace) {
        throw new Error(payload.error || "云同步暂时不可用。");
      }

      setSyncDisplayName(payload.displayName ?? "");
      const merged = mergeWorkspaces(
        currentWorkspacePayload(),
        payload.workspace,
      );
      applyWorkspace(merged);
      cloudRevisionRef.current = payload.workspace.revision;
      await pushWorkspace(merged, payload.workspace.revision);
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(
        error instanceof Error ? error.message : "云同步暂时不可用。",
      );
    }
  }

  function openCommand() {
    setCommandQuery("");
    setCommandIndex(0);
    commandDialogRef.current?.showModal();
  }

  function chooseAsset(id: string) {
    setSelectedId(id);
    setView((current) =>
      current === "chart" || current === "order" ? current : "thesis",
    );
    commandDialogRef.current?.close();
  }

  function openQueueAsset(id: string) {
    setSelectedId(id);
    setView("thesis");
    window.requestAnimationFrame(() =>
      document.getElementById("selected-research")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }

  function saveDecision(record: TradePlanRecord) {
    setDecisions((current) =>
      [record, ...current.filter((item) => item.id !== record.id)].slice(
        0,
        300,
      ),
    );
  }

  function openDecision(record: TradePlanRecord) {
    const asset = assets.find((item) => item.symbol === record.symbol);
    if (!asset) return;
    setSelectedId(asset.id);
    setView("order");
    window.requestAnimationFrame(() =>
      document.getElementById("selected-research")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }

  function reviewDecision(
    id: string,
    outcome: Exclude<DecisionOutcome, "open">,
    note: string,
  ) {
    const updatedAt = new Date().toISOString();
    setDecisions((current) =>
      current.map((record) =>
        record.id === id
          ? {
              ...record,
              status: "reviewed" as const,
              outcome,
              reviewNote: note.trim(),
              updatedAt,
            }
          : record,
      ),
    );
  }

  function handleCommandKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCommandIndex((current) =>
        Math.min(current + 1, commandResults.length - 1),
      );
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCommandIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter" && commandResults[commandIndex]) {
      event.preventDefault();
      chooseAsset(commandResults[commandIndex].id);
    }
  }

  function openAssetDialog(
    asset?: Asset,
    intent: AssetDialogIntent = asset ? "edit" : "add",
  ) {
    setAssetDialogIntent(intent);
    setPendingComparison(null);
    setDraft(asset ?? blankAsset());
    window.requestAnimationFrame(() => assetDialogRef.current?.showModal());
  }

  function handleGeneratedAsset(
    asset: GeneratedAsset,
    payload: ResearchApiResponse,
  ) {
    setDraft((current) => {
      if (!current || current.id === "new") {
        return {
          ...blankAsset(),
          ...asset,
          id: "new",
          status: "watching",
          updatedAt: todayInShanghai(),
        };
      }
      return {
        ...current,
        ...asset,
        id: current.id,
        status: current.status,
        positionSize: current.positionSize,
        portfolioWeight: current.portfolioWeight,
        riskTheme: current.riskTheme,
        averageCost: current.averageCost,
        keyEvents: mergeResearchEvents(current.keyEvents, asset.keyEvents),
        updatedAt: current.updatedAt,
        previousVersion: current.previousVersion,
        lastComparison: current.lastComparison,
      };
    });

    if (assetDialogIntent === "refresh" && payload.comparison) {
      setPendingComparison({
        generatedAt: payload.generatedAt || new Date().toISOString(),
        evidenceAsOf: payload.evidence?.priceDate || "待核验",
        changeSummary: payload.comparison.changeSummary ?? [],
        drivers: payload.comparison.drivers ?? [],
        verdicts: payload.comparison.verdicts ?? [],
        recentNews: payload.comparison.recentNews ?? [],
      });
    }
  }

  function handleAssetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;

    const form = new FormData(event.currentTarget);
    const symbol = String(form.get("symbol") ?? "")
      .trim()
      .toUpperCase();
    const name = String(form.get("name") ?? "").trim();
    if (!symbol || !name) return;

    const id =
      draft.id === "new"
        ? `${symbol.toLowerCase()}-${Date.now()}`
        : draft.id;
    const existingAsset = assets.find((asset) => asset.id === draft.id);
    const modifiedAt = new Date().toISOString();
    const nextAsset: Asset = {
      ...draft,
      id,
      symbol,
      name,
      market: String(form.get("market") ?? "").trim(),
      sector: String(form.get("sector") ?? "").trim(),
      status: String(form.get("status")) as AssetStatus,
      category: String(form.get("category")) as Regime,
      conviction: String(form.get("conviction")) as Asset["conviction"],
      modifiedAt,
      positionSize: String(form.get("positionSize") ?? "").trim() || undefined,
      portfolioWeight: optionalPercent(form.get("portfolioWeight")),
      riskTheme: String(form.get("riskTheme") ?? "").trim() || undefined,
      averageCost: String(form.get("averageCost") ?? "").trim() || undefined,
      updatedAt: todayInShanghai(),
      dataFreshness: String(form.get("dataFreshness") ?? "").trim(),
      valuationLogic: String(form.get("valuationLogic") ?? "").trim(),
      thesis: String(form.get("thesis") ?? "").trim(),
      catalyst: splitLines(form.get("catalyst")),
      keyEvents: linesToEvents(form.get("keyEvents"), id),
      invalidation: splitLines(form.get("invalidation")),
      fundamentalSignals: linesToSignals(form.get("signals"), id),
      technical: {
        trend: String(form.get("trend") ?? "").trim(),
        momentum: String(form.get("momentum") ?? "").trim(),
        structure: String(form.get("structure") ?? "").trim(),
        levels: linesToLevels(form.get("levels")),
        action: String(form.get("action") ?? "").trim(),
      },
      sources: splitLines(form.get("sources")),
      ...(assetDialogIntent === "refresh" &&
      existingAsset &&
      pendingComparison
        ? {
            previousVersion: snapshotAsset(existingAsset),
            lastComparison: pendingComparison,
          }
        : {}),
    };

    setAssets((current) =>
      draft.id === "new"
        ? [nextAsset, ...current]
        : current.map((asset) => (asset.id === draft.id ? nextAsset : asset)),
    );
    setTombstones((current) => clearAssetTombstone(current, nextAsset));
    setSelectedId(id);
    if (assetDialogIntent === "refresh" && pendingComparison) {
      setView("compare");
    }
    setDraft(null);
    setPendingComparison(null);
    setAssetDialogIntent("add");
    assetDialogRef.current?.close();
  }

  function toggleHolding() {
    if (!selectedAsset) return;
    setAssets((current) =>
      current.map((asset) =>
        asset.id === selectedAsset.id
          ? {
              ...asset,
              status: asset.status === "holding" ? "watching" : "holding",
              updatedAt: todayInShanghai(),
              modifiedAt: new Date().toISOString(),
            }
          : asset,
      ),
    );
  }

  function markEventReviewed(assetId: string, eventId: string) {
    setAssets((current) =>
      current.map((asset) =>
        asset.id !== assetId
          ? asset
          : {
              ...asset,
              keyEvents: (asset.keyEvents ?? []).map((event) =>
                event.id === eventId
                  ? { ...event, status: "reviewed" as const }
                  : event,
              ),
              modifiedAt: new Date().toISOString(),
            },
      ),
    );
  }

  function deleteSelected() {
    if (!selectedAsset) return;
    const index = assets.findIndex((asset) => asset.id === selectedAsset.id);
    const remaining = assets.filter((asset) => asset.id !== selectedAsset.id);
    setAssets(remaining);
    setTombstones((current) => markAssetDeleted(current, selectedAsset));
    setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id ?? "");
    setPendingDelete({ asset: selectedAsset, index });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setPendingDelete(null), 6000);
  }

  function undoDelete() {
    if (!pendingDelete) return;
    setAssets((current) => {
      const restored = [...current];
      restored.splice(pendingDelete.index, 0, {
        ...pendingDelete.asset,
        modifiedAt: new Date().toISOString(),
      });
      return restored;
    });
    setTombstones((current) =>
      clearAssetTombstone(current, pendingDelete.asset),
    );
    setSelectedId(pendingDelete.asset.id);
    setPendingDelete(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(currentWorkspacePayload(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trader-research-${todayInShanghai()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const importedAt = new Date().toISOString();
      if (isWorkspacePayload(parsed) && parsed.assets.length > 0) {
        const workspace = normalizeWorkspace(parsed);
        applyWorkspace({
          ...workspace,
          assets: workspace.assets.map((asset) => ({
            ...asset,
            modifiedAt: importedAt,
          })),
        });
        setImportError("");
        return;
      }
      if (!isAssetArray(parsed) || parsed.length === 0) {
        throw new Error("invalid");
      }
      const imported = parsed.map((asset) => ({
        ...asset,
        modifiedAt: importedAt,
      }));
      setAssets(imported);
      setTombstones({});
      setSelectedId(imported[0].id);
      setImportError("");
    } catch {
      setImportError("导入失败：请选择从本站导出的有效 JSON 文件。");
    } finally {
      event.target.value = "";
    }
  }

  if (!selectedAsset) {
    return (
      <>
        <main className="empty-state">
          <p className="eyebrow">TRADER / RESEARCH DESK</p>
          <h1>自选清单为空</h1>
          <p>增加一个标的，重新开始记录定价逻辑与验证信号。</p>
          <button
            className="button button-primary"
            onClick={() => openAssetDialog()}
          >
            增加标的
          </button>
          <AssetDialog
            dialogRef={assetDialogRef}
            draft={draft}
            intent={assetDialogIntent}
            onClose={() => {
              setDraft(null);
              setPendingComparison(null);
              setAssetDialogIntent("add");
              assetDialogRef.current?.close();
            }}
            onSubmit={handleAssetSubmit}
            onGenerated={handleGeneratedAsset}
          />
        </main>
        {pendingDelete && (
          <div className="undo-toast" role="status" aria-live="polite">
            <span>{pendingDelete.asset.symbol} 已从清单移除</span>
            <button onClick={undoDelete}>撤销</button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <a className="wordmark" href="#workspace" aria-label="回到研究工作台">
          <span className="wordmark-mark">T/R</span>
          <span>Research Desk</span>
        </a>
        <button className="command-pill" onClick={openCommand}>
          <span>搜索标的或逻辑</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="topbar-actions">
          <input
            ref={importRef}
            className="visually-hidden"
            type="file"
            accept="application/json"
            onChange={importData}
          />
          <button className="button button-quiet" onClick={exportData}>
            导出
          </button>
          {syncStatus === "signed-out" ? (
            <a
              className="button button-quiet sync-action"
              href="/signin-with-chatgpt?return_to=%2F"
            >
              登录同步
            </a>
          ) : syncStatus === "local-only" ? (
            <button
              className="button button-quiet sync-action"
              disabled
              title={syncMessage}
            >
              本机保存
            </button>
          ) : (
            <button
              className="button button-quiet sync-action"
              onClick={() => void synchronizeWorkspace()}
              disabled={syncStatus === "checking" || syncStatus === "syncing"}
              title={syncDisplayName || syncMessage}
            >
              {syncStatus === "checking" || syncStatus === "syncing"
                ? "同步中"
                : syncStatus === "error"
                  ? "重试同步"
                  : "立即同步"}
            </button>
          )}
          <button
            className="button button-quiet desktop-action"
            onClick={() => importRef.current?.click()}
          >
            导入
          </button>
          <button
            className="button button-primary"
            onClick={() => openAssetDialog()}
          >
            增加标的
          </button>
        </div>
      </header>

      <main id="workspace" className="page-shell">
        <section className="page-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">CROSS-DEVICE RESEARCH SYSTEM · 研究工作台</p>
            <h1 id="page-title">从叙事，到可验证的交易假设</h1>
          </div>
          <p className="intro-copy">
            先判断市场在交易什么，再看价格是否确认。
            <span className="sync-copy" data-status={syncStatus}>
              {syncMessage}
            </span>
          </p>
        </section>

        <section className="desk-summary" aria-label="研究台概览">
          <div>
            <span>覆盖标的</span>
            <strong>{assets.length}</strong>
          </div>
          <div>
            <span>当前持仓</span>
            <strong>{summary.holdings}</strong>
          </div>
          <div>
            <span>观察清单</span>
            <strong>{summary.watching}</strong>
          </div>
          <div>
            <span>含风险信号</span>
            <strong>{summary.warning}</strong>
          </div>
        </section>

        <PortfolioRiskPanel
          report={portfolioRisk}
          onOpen={(asset) => {
            setSelectedId(asset.id);
            setView("thesis");
            window.requestAnimationFrame(() =>
              document.getElementById("selected-research")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              }),
            );
          }}
          onEdit={(asset) => openAssetDialog(asset, "edit")}
        />

        <ResearchQueue
          items={researchQueue.slice(0, 5)}
          summary={researchQueueSummary}
          onOpen={openQueueAsset}
          onRefresh={(id) => {
            const asset = assets.find((item) => item.id === id);
            if (asset) openAssetDialog(asset, "refresh");
          }}
        />

        <EventRadar
          items={eventRadar.items.slice(0, 6)}
          summary={eventRadar.summary}
          onOpen={openQueueAsset}
          onEdit={(id) => {
            const asset = assets.find((item) => item.id === id);
            if (asset) openAssetDialog(asset, "edit");
          }}
          onReviewed={markEventReviewed}
        />

        <DecisionReviewPanel
          items={decisionQueue.items.slice(0, 6)}
          summary={decisionQueue.summary}
          completed={decisions
            .filter((record) => record.status === "reviewed")
            .sort((left, right) =>
              right.updatedAt.localeCompare(left.updatedAt),
            )
            .slice(0, 3)}
          onOpen={openDecision}
          onReview={reviewDecision}
          onCreate={() => {
            setView("order");
            window.requestAnimationFrame(() =>
              document.getElementById("selected-research")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              }),
            );
          }}
        />

        {importError && (
          <p className="inline-alert" role="alert">
            {importError}
          </p>
        )}

        <div
          className={`workspace-grid${
            view === "chart" || view === "order" ? " chart-mode" : ""
          }`}
        >
          <aside className="watchlist-panel" aria-label="自选标的">
            <div className="panel-heading">
              <div>
                <h2>自选与持仓</h2>
              </div>
              <span className="count-label">{filteredAssets.length}</span>
            </div>

            <div className="filter-row" aria-label="筛选标的">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  className="filter-chip"
                  data-active={filter === item.id}
                  aria-pressed={filter === item.id}
                  onClick={() => {
                    setFilter(item.id);
                    if (item.id === "two-week-bullish") {
                      void refreshWeeklyScreen();
                    }
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {filter === "two-week-bullish" && (
              <div
                className="weekly-screen-status"
                data-state={weeklyScreen.status}
                aria-live="polite"
              >
                <div>
                  <strong>
                    {weeklyScreen.status === "loading"
                      ? `扫描中 ${weeklyScreen.completed}/${weeklyScreen.total}`
                      : `${filteredAssets.length} 个命中`}
                  </strong>
                  <span>仅扫描自选中的美股，并排除本周未收盘K线</span>
                  {weeklyScreen.status === "ready" && weeklyScreen.scannedAt && (
                    <small>
                      {new Date(weeklyScreen.scannedAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {weeklyScreenErrorCount
                        ? ` · ${weeklyScreenErrorCount} 个行情读取失败`
                        : " · 行情读取完成"}
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void refreshWeeklyScreen()}
                  disabled={weeklyScreen.status === "loading"}
                >
                  {weeklyScreen.status === "loading" ? "扫描中" : "重新扫描"}
                </button>
              </div>
            )}

            <nav className="symbol-list" aria-label="标的列表">
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  className="symbol-row"
                  data-selected={asset.id === selectedAsset.id}
                  onClick={() => chooseAsset(asset.id)}
                >
                  <span>
                    <strong>{asset.symbol}</strong>
                    <small>{asset.name}</small>
                  </span>
                  <span className="symbol-row-meta">
                    {filter === "two-week-bullish" &&
                      weeklyScreen.entries[
                        asset.symbol.toUpperCase()
                      ]?.weeks.length === 2 && (
                        <span
                          className="weekly-streak-badge"
                          title={weeklyScreen.entries[
                            asset.symbol.toUpperCase()
                          ].weeks
                            .map(
                              (week) =>
                                `${week.weekStart} 周 ${formatSignedPercent(week.changePercent)}`,
                            )
                            .join("；")}
                        >
                          {weeklyScreen.entries[
                            asset.symbol.toUpperCase()
                          ].weeks
                            .map((week) =>
                              formatSignedPercent(week.changePercent),
                            )
                            .join(" · ")}
                        </span>
                      )}
                    <span className={`category-dot ${asset.category}`}>
                      {
                        CATEGORY_DEFINITIONS.find(
                          (item) => item.id === asset.category,
                        )?.short
                      }
                    </span>
                  </span>
                </button>
              ))}
              {filteredAssets.length === 0 && (
                <p className="list-empty">
                  {filter === "two-week-bullish"
                    ? weeklyScreen.status === "loading"
                      ? "正在核对最近两个已收盘周线…"
                      : "当前自选美股中没有满足连续两周阳线的标的。"
                    : "这个筛选下还没有标的。"}
                </p>
              )}
            </nav>

            <button className="text-action" onClick={openCommand}>
              快速搜索全部标的
            </button>
          </aside>

          <article className="asset-workbench" id="selected-research">
            <header className="asset-header">
              <div>
                <div className="asset-kicker">
                  <span>{selectedAsset.market}</span>
                  <span>{selectedAsset.sector}</span>
                  <span>{STATUS_LABEL[selectedAsset.status]}</span>
                </div>
                <h2>
                  <span>{selectedAsset.symbol}</span>
                  <small>{selectedAsset.name}</small>
                </h2>
              </div>
              <div className="asset-actions">
                <button
                  className="button button-primary"
                  onClick={() => openAssetDialog(selectedAsset, "refresh")}
                >
                  AI 更新逻辑
                </button>
                <button className="button button-quiet" onClick={toggleHolding}>
                  {selectedAsset.status === "holding" ? "移出持仓" : "设为持仓"}
                </button>
                <button
                  className="button button-quiet"
                  onClick={() => openAssetDialog(selectedAsset)}
                >
                  编辑
                </button>
              </div>
            </header>

            <section className="decision-strip" aria-label="当前交易判断">
              <div>
                <span className="regime-number">{category.short}</span>
                <h3>{category.title}</h3>
              </div>
              <div className="decision-copy">
                <p>{category.description}</p>
                <strong>行动原则</strong>
                <p>{category.action}</p>
              </div>
            </section>

            <nav className="view-tabs" aria-label="研究视图">
              {(
                [
                  ["thesis", "定价逻辑"],
                  ["compare", "版本对比"],
                  ["signals", "验证信号"],
                  ["technical", "技术走势"],
                  ["chart", "K线与推演"],
                  ["order", "情景定价"],
                  ["framework", "分类框架"],
                ] as [ViewKey, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  data-active={view === id}
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="view-body">
              {view === "thesis" && <ThesisView asset={selectedAsset} />}
              {view === "compare" && <ComparisonView asset={selectedAsset} />}
              {view === "signals" && <SignalsView asset={selectedAsset} />}
              {view === "technical" && <TechnicalView asset={selectedAsset} />}
              {view === "chart" && <ChartResearchView asset={selectedAsset} />}
              {view === "order" && (
                <PricingOrderView
                  asset={selectedAsset}
                  records={decisions}
                  onSave={saveDecision}
                />
              )}
              {view === "framework" && <FrameworkView />}
            </div>
          </article>

          <aside className="context-rail" aria-label="标的上下文">
            <section className="context-section sticky-card">
              <p className="eyebrow">POSITION CONTEXT</p>
              <dl className="spec-list">
                <div>
                  <dt>状态</dt>
                  <dd>{STATUS_LABEL[selectedAsset.status]}</dd>
                </div>
                <div>
                  <dt>信念等级</dt>
                  <dd>{CONVICTION_LABEL[selectedAsset.conviction]}</dd>
                </div>
                <div>
                  <dt>仓位</dt>
                  <dd>
                    {selectedAsset.portfolioWeight
                      ? `${selectedAsset.portfolioWeight}%`
                      : (selectedAsset.positionSize || "未记录")}
                  </dd>
                </div>
                <div>
                  <dt>成本</dt>
                  <dd>{selectedAsset.averageCost || "未记录"}</dd>
                </div>
                <div>
                  <dt>更新</dt>
                  <dd>{selectedAsset.updatedAt}</dd>
                </div>
              </dl>

              <div className="freshness-note">
                <span>数据边界</span>
                <p>{selectedAsset.dataFreshness}</p>
              </div>
            </section>

            <section className="context-section">
              <p className="eyebrow">PRE-TRADE CHECK</p>
              <ol className="step-list">
                <li>
                  <span>01</span>
                  <p>市场预期已经定价到哪一步？</p>
                </li>
                <li>
                  <span>02</span>
                  <p>哪一个可观测数据会验证故事？</p>
                </li>
                <li>
                  <span>03</span>
                  <p>好消息是否能让价格留下涨幅？</p>
                </li>
                <li>
                  <span>04</span>
                  <p>错了在哪里退出，而不是如何解释？</p>
                </li>
              </ol>
            </section>

            <button className="danger-action" onClick={deleteSelected}>
              删除当前标的
            </button>
          </aside>
        </div>
      </main>

      <footer className="site-footer">
        <span>TRADER / RESEARCH DESK</span>
        <span>未登录时本机保存 · 登录后跨设备同步 · 不构成投资建议</span>
        <button onClick={exportData}>导出研究备份</button>
      </footer>

      <CommandDialog
        dialogRef={commandDialogRef}
        query={commandQuery}
        index={commandIndex}
        results={commandResults}
        onQuery={(value) => {
          setCommandQuery(value);
          setCommandIndex(0);
        }}
        onKeyDown={handleCommandKey}
        onSelect={chooseAsset}
      />

      <AssetDialog
        dialogRef={assetDialogRef}
        draft={draft}
        intent={assetDialogIntent}
        onClose={() => {
          setDraft(null);
          setPendingComparison(null);
          setAssetDialogIntent("add");
          assetDialogRef.current?.close();
        }}
        onSubmit={handleAssetSubmit}
        onGenerated={handleGeneratedAsset}
      />

      {pendingDelete && (
        <div className="undo-toast" role="status" aria-live="polite">
          <span>{pendingDelete.asset.symbol} 已从清单移除</span>
          <button onClick={undoDelete}>撤销</button>
        </div>
      )}
    </>
  );
}

function formatWeight(value: number) {
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`;
}

function formatSignedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function PortfolioRiskPanel({
  report,
  onOpen,
  onEdit,
}: {
  report: PortfolioRiskReport;
  onOpen: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
}) {
  const positions = [...report.weightedHoldings, ...report.missingHoldings];

  return (
    <section className="portfolio-risk" aria-labelledby="portfolio-risk-title">
      <header className="portfolio-risk-heading">
        <div>
          <p className="eyebrow">PORTFOLIO EXPOSURE · 已录入权重口径</p>
          <h2 id="portfolio-risk-title">组合风险集中在哪</h2>
          <p>
            只汇总明确标记为持仓且已录入的权重；故事分组是透明的研究归因，不代表历史相关性或风险模型结论。
          </p>
        </div>
        <dl aria-label="组合风险统计">
          <div>
            <dt>已录入权重</dt>
            <dd>{report.recordedWeight ? formatWeight(report.recordedWeight) : "—"}</dd>
          </div>
          <div>
            <dt>最大单一标的</dt>
            <dd>
              {report.largestPosition && report.largestPosition.weight !== null
                ? formatWeight(report.largestPosition.weight)
                : "—"}
            </dd>
          </div>
          <div>
            <dt>前三大合计</dt>
            <dd>{report.topThreeWeight ? formatWeight(report.topThreeWeight) : "—"}</dd>
          </div>
          <div data-risk={report.negativeSignalWeight > 0}>
            <dt>含负向信号</dt>
            <dd>{formatWeight(report.negativeSignalWeight)}</dd>
          </div>
        </dl>
      </header>

      {report.holdings.length === 0 ? (
        <div className="portfolio-risk-empty">
          <strong>还没有标记为持仓的标的</strong>
          <p>
            在标的页点击“设为持仓”，再通过编辑录入组合权重；观察清单不会被当作实际暴露。
          </p>
        </div>
      ) : (
        <div className="portfolio-risk-body">
          <div className="portfolio-position-list">
            <header>
              <strong>持仓权重</strong>
              <span>
                {report.missingHoldings.length
                  ? `${report.missingHoldings.length} 个待补权重`
                  : "权重已覆盖全部持仓"}
              </span>
            </header>
            {positions.slice(0, 8).map((position) => (
              <article
                key={position.asset.id}
                data-missing={position.weight === null}
                data-risk={position.negativeSignals > 0}
              >
                <button type="button" onClick={() => onOpen(position.asset)}>
                  <strong>{position.asset.symbol}</strong>
                  <span>{position.theme}</span>
                </button>
                <div>
                  {position.weight === null ? (
                    <span>未录入，暂不计入集中度</span>
                  ) : (
                    <>
                      <meter
                        min="0"
                        max="100"
                        value={position.weight}
                        aria-label={`${position.asset.symbol} 组合权重 ${position.weight}%`}
                      />
                      <span>
                        {formatWeight(position.weight)}
                        {position.weightSource === "legacy" ? " · 旧仓位文本" : ""}
                      </span>
                    </>
                  )}
                </div>
                <div>
                  {position.negativeSignals > 0 && (
                    <span data-signal="negative">
                      {position.negativeSignals} 项负向
                    </span>
                  )}
                  {position.warningSignals > 0 && (
                    <span data-signal="warning">
                      {position.warningSignals} 项观察
                    </span>
                  )}
                  {position.weight === null && (
                    <button type="button" onClick={() => onEdit(position.asset)}>
                      补权重
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="portfolio-buckets">
            <section>
              <header>
                <strong>同一故事暴露</strong>
                <span>{THEME_MONITOR}% 为提示线，不是自动止损线</span>
              </header>
              {report.themes.length ? (
                <ol>
                  {report.themes.slice(0, 5).map((theme) => (
                    <li key={theme.label} data-monitor={theme.weight >= THEME_MONITOR}>
                      <div>
                        <strong>{theme.label}</strong>
                        <span>{theme.symbols.join(" · ")}</span>
                      </div>
                      <b>{formatWeight(theme.weight)}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>录入权重后显示。</p>
              )}
            </section>
            <section>
              <header>
                <strong>研究状态暴露</strong>
                <span>按第一 / 二 / 三类汇总</span>
              </header>
              {report.regimes.length ? (
                <ol>
                  {report.regimes.map((regime) => (
                    <li key={regime.label}>
                      <div>
                        <strong>{regime.label}</strong>
                        <span>{regime.symbols.join(" · ")}</span>
                      </div>
                      <b>{formatWeight(regime.weight)}</b>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>录入权重后显示。</p>
              )}
            </section>
          </div>
        </div>
      )}

      {report.holdings.length > 0 && (
        <footer className="portfolio-risk-footer">
          <div>
            <strong>当前需要处理</strong>
            {report.monitoringNotes.length ? (
              <ul>
                {report.monitoringNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : (
              <p>按当前已录入数据，尚未触发集中度提示。</p>
            )}
          </div>
          <p>
            {report.missingHoldings.length
              ? `数据未完整：已录入 ${formatWeight(report.recordedWeight)}，另有 ${report.missingHoldings.length} 个持仓缺权重。`
              : report.overAllocatedWeight
                ? `权重口径异常：合计超过 100% 达 ${formatWeight(report.overAllocatedWeight)}。`
                : `已录入 ${formatWeight(report.recordedWeight)}；剩余 ${formatWeight(report.residualWeight)} 可能是现金或尚未录入资产，本站不自行判定。`}
          </p>
        </footer>
      )}
    </section>
  );
}

function ResearchQueue({
  items,
  summary,
  onOpen,
  onRefresh,
}: {
  items: ResearchQueueItem[];
  summary: Record<ResearchPriority, number>;
  onOpen: (id: string) => void;
  onRefresh: (id: string) => void;
}) {
  return (
    <section className="research-queue" aria-labelledby="research-queue-title">
      <header className="research-queue-heading">
        <div>
          <p className="eyebrow">DAILY REVIEW QUEUE · {todayInShanghai()}</p>
          <h2 id="research-queue-title">今天先看什么</h2>
          <p>
            按持仓、研究过期天数、负向信号与旧判断证伪排序。优先级只决定研究顺序，不代表买卖方向。
          </p>
        </div>
        <dl aria-label="研究队列统计">
          <div data-priority="urgent">
            <dt>优先处理</dt>
            <dd>{summary.urgent}</dd>
          </div>
          <div data-priority="review">
            <dt>需要复核</dt>
            <dd>{summary.review}</dd>
          </div>
          <div data-priority="current">
            <dt>保持观察</dt>
            <dd>{summary.current}</dd>
          </div>
        </dl>
      </header>

      <div className="research-queue-list">
        {items.map((item, index) => (
          <article key={item.assetId} data-priority={item.priority}>
            <div className="research-queue-rank">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{RESEARCH_PRIORITY_LABEL[item.priority]}</small>
            </div>
            <button
              type="button"
              className="research-queue-symbol"
              onClick={() => onOpen(item.assetId)}
              aria-label={`打开 ${item.symbol} ${item.name} 的研究逻辑`}
            >
              <strong>{item.symbol}</strong>
              <span>{item.name}</span>
            </button>
            <div className="research-queue-reasons">
              {item.reasons.slice(0, 3).map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
            <p>{item.nextStep}</p>
            <div className="research-queue-actions">
              <button type="button" onClick={() => onOpen(item.assetId)}>
                打开逻辑
              </button>
              <button type="button" onClick={() => onRefresh(item.assetId)}>
                AI 更新
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function eventTimingLabel(item: EventRadarItem) {
  if (item.daysUntil < 0) return `逾期 ${Math.abs(item.daysUntil)} 天`;
  if (item.daysUntil === 0) return "今天";
  if (item.daysUntil === 1) return "明天";
  return `${item.daysUntil} 天后`;
}

function EventRadar({
  items,
  summary,
  onOpen,
  onEdit,
  onReviewed,
}: {
  items: EventRadarItem[];
  summary: EventRadarSummary;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onReviewed: (assetId: string, eventId: string) => void;
}) {
  return (
    <section className="event-radar" aria-labelledby="event-radar-title">
      <header className="event-radar-heading">
        <div>
          <p className="eyebrow">30-DAY EVENT RADAR · {todayInShanghai()}</p>
          <h2 id="event-radar-title">接下来什么会改变判断</h2>
          <p>
            只对明确日期做倒计时；没有可靠日期的催化继续留在交易假设中，不制造伪精确日程。
          </p>
        </div>
        <dl aria-label="事件雷达统计">
          <div data-timing="overdue">
            <dt>待复盘</dt>
            <dd>{summary.overdue}</dd>
          </div>
          <div data-timing="soon">
            <dt>未来 7 天</dt>
            <dd>{summary.next7Days}</dd>
          </div>
          <div>
            <dt>30 天内</dt>
            <dd>{summary.inWindow}</dd>
          </div>
          <div>
            <dt>条件型催化</dt>
            <dd>{summary.conditionalCatalysts}</dd>
          </div>
        </dl>
      </header>

      {items.length ? (
        <div className="event-radar-list">
          {items.map((item) => (
            <article
              key={`${item.assetId}-${item.event.id}`}
              data-timing={item.timing}
              data-impact={item.event.impact}
            >
              <time dateTime={item.event.date}>
                <strong>{item.event.date.slice(5)}</strong>
                <span>{eventTimingLabel(item)}</span>
              </time>
              <button
                type="button"
                className="event-radar-symbol"
                onClick={() => onOpen(item.assetId)}
                aria-label={`打开 ${item.symbol} ${item.name} 的研究逻辑`}
              >
                <strong>{item.symbol}</strong>
                <span>{item.holding ? "持仓" : item.name}</span>
              </button>
              <div className="event-radar-event">
                <div>
                  <span>{EVENT_KIND_LABEL[item.event.kind]}</span>
                  <span>{EVENT_IMPACT_LABEL[item.event.impact]}</span>
                </div>
                <strong>{item.event.title}</strong>
                <p>{item.event.preparation}</p>
              </div>
              <div className="event-radar-actions">
                {safeEventUrl(item.event.source) && (
                  <a
                    href={safeEventUrl(item.event.source)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    核对来源
                  </a>
                )}
                <button type="button" onClick={() => onEdit(item.assetId)}>
                  编辑
                </button>
                <button
                  type="button"
                  onClick={() => onReviewed(item.assetId, item.event.id)}
                >
                  已复盘
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="event-radar-empty">
          <div>
            <strong>未来 30 天还没有已核实日期的事件</strong>
            <p>
              这是信息缺口，不代表没有风险。可在编辑标的时录入财报、宏观数据、监管节点或行业会议。
            </p>
          </div>
          <small>日期格式必须为 YYYY-MM-DD</small>
        </div>
      )}
    </section>
  );
}

function decisionTimingLabel(item: DecisionQueueItem) {
  if (item.daysUntil < 0) return `逾期 ${Math.abs(item.daysUntil)} 天`;
  if (item.daysUntil === 0) return "今天复盘";
  if (item.daysUntil === 1) return "明天复盘";
  return `${item.daysUntil} 天后复盘`;
}

function DecisionReviewPanel({
  items,
  summary,
  completed,
  onOpen,
  onReview,
  onCreate,
}: {
  items: DecisionQueueItem[];
  summary: DecisionQueueSummary;
  completed: TradePlanRecord[];
  onOpen: (record: TradePlanRecord) => void;
  onReview: (
    id: string,
    outcome: Exclude<DecisionOutcome, "open">,
    note: string,
  ) => void;
  onCreate: () => void;
}) {
  const [reviewingId, setReviewingId] = useState("");
  const [outcome, setOutcome] = useState<Exclude<DecisionOutcome, "open">>(
    "mixed",
  );
  const [note, setNote] = useState("");

  function submitReview(id: string) {
    if (!note.trim()) return;
    onReview(id, outcome, note);
    setReviewingId("");
    setOutcome("mixed");
    setNote("");
  }

  return (
    <section
      className="decision-review"
      aria-labelledby="decision-review-title"
    >
      <header className="decision-review-heading">
        <div>
          <p className="eyebrow">DECISION JOURNAL · {todayInShanghai()}</p>
          <h2 id="decision-review-title">行动与复盘</h2>
          <p>
            把“等待”也写成决策，并在约定日期核对：当时的判断、后来的结果，以及错误来自信息还是执行。
          </p>
        </div>
        <dl aria-label="决策复盘统计">
          <div data-timing="overdue">
            <dt>已逾期</dt>
            <dd>{summary.overdue}</dd>
          </div>
          <div data-timing="today">
            <dt>今天</dt>
            <dd>{summary.today}</dd>
          </div>
          <div>
            <dt>7 天内</dt>
            <dd>{summary.next7Days}</dd>
          </div>
          <div>
            <dt>已完成</dt>
            <dd>{summary.reviewed}</dd>
          </div>
        </dl>
      </header>

      {items.length ? (
        <div className="decision-review-list">
          {items.map((item) => (
            <article key={item.record.id} data-timing={item.timing}>
              <div className="decision-review-date">
                <strong>{item.record.reviewAt.slice(5)}</strong>
                <span>{decisionTimingLabel(item)}</span>
              </div>
              <button
                type="button"
                className="decision-review-symbol"
                onClick={() => onOpen(item.record)}
                aria-label={`打开 ${item.record.symbol} 的决策计划`}
              >
                <strong>{item.record.symbol}</strong>
                <span>{DECISION_ACTION_LABEL[item.record.action]}</span>
              </button>
              <div className="decision-review-thesis">
                <p>{item.record.thesis}</p>
                <small>
                  记录于 {item.record.asOfDate} · 参考价 ${item.record.currentPrice.toFixed(2)}
                </small>
              </div>
              <div className="decision-review-actions">
                <button type="button" onClick={() => onOpen(item.record)}>
                  打开计划
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReviewingId((current) =>
                      current === item.record.id ? "" : item.record.id,
                    )
                  }
                >
                  写复盘
                </button>
              </div>
              {reviewingId === item.record.id && (
                <div className="decision-review-form">
                  <label>
                    结果判断
                    <select
                      value={outcome}
                      onChange={(event) =>
                        setOutcome(
                          event.target.value as Exclude<
                            DecisionOutcome,
                            "open"
                          >,
                        )
                      }
                    >
                      {(["right", "wrong", "mixed"] as const).map((id) => (
                        <option key={id} value={id}>
                          {DECISION_OUTCOME_LABEL[id]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    发生了什么
                    <textarea
                      rows={3}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="哪些验证信号兑现了？哪里判断错了？执行是否偏离计划？"
                    />
                  </label>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!note.trim()}
                    onClick={() => submitReview(item.record.id)}
                  >
                    完成复盘
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="decision-review-empty">
          <div>
            <strong>还没有待复盘的决策</strong>
            <p>
              先从当前标的建立一条“等待、建仓、加仓、减仓、退出或对冲”的记录；这不会发送任何交易。
            </p>
          </div>
          <button type="button" onClick={onCreate}>
            建立第一条决策
          </button>
        </div>
      )}

      {completed.length > 0 && (
        <details className="decision-review-history">
          <summary>最近完成的复盘 · {completed.length}</summary>
          <div>
            {completed.map((record) => (
              <article key={record.id}>
                <button type="button" onClick={() => onOpen(record)}>
                  <strong>{record.symbol}</strong>
                  <span>{DECISION_ACTION_LABEL[record.action]}</span>
                </button>
                <div>
                  <strong>{DECISION_OUTCOME_LABEL[record.outcome]}</strong>
                  <p>{record.reviewNote}</p>
                </div>
                <time dateTime={record.updatedAt}>
                  {record.updatedAt.slice(0, 10)}
                </time>
              </article>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function ThesisView({ asset }: { asset: Asset }) {
  return (
    <div className="content-stack">
      <section className="content-section">
        <p className="section-label">01 · 定价函数</p>
        <h3>华尔街真正需要重新估计的变量</h3>
        <p className="lead-copy">{asset.valuationLogic}</p>
      </section>

      <section className="content-section split-section">
        <div>
          <p className="section-label">02 · 当前假设</p>
          <h3>这笔交易现在在赌什么</h3>
        </div>
        <p>{asset.thesis}</p>
      </section>

      <div className="two-column-list">
        <section className="content-section">
          <p className="section-label">03 · 正向催化</p>
          <h3>什么会让市场继续上修</h3>
          <ul className="evidence-list">
            {asset.catalyst.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="content-section invalidation-section">
          <p className="section-label">04 · 失效条件</p>
          <h3>什么出现就承认假设错了</h3>
          <ul className="evidence-list">
            {asset.invalidation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="source-line">
        <span>研究来源</span>
        <p>{asset.sources.join(" · ") || "尚未记录来源"}</p>
      </section>
    </div>
  );
}

function ComparisonView({ asset }: { asset: Asset }) {
  const previous = asset.previousVersion;
  const comparison = asset.lastComparison;

  if (!previous || !comparison) {
    return (
      <div className="content-stack">
        <section className="content-section comparison-empty">
          <p className="section-label">VERSION REVIEW</p>
          <h3>还没有可以对照的上一版</h3>
          <p className="supporting-copy">
            点击标的右上角的“AI
            更新逻辑”，系统会先生成最新版草稿。你确认保存后，这里只保留上一版与最新版，并逐项标记哪些判断已验证、已证伪或仍待验证。
          </p>
        </section>
      </div>
    );
  }

  const previousCategory =
    CATEGORY_DEFINITIONS.find((item) => item.id === previous.category)?.short ??
    "待分类";
  const currentCategory =
    CATEGORY_DEFINITIONS.find((item) => item.id === asset.category)?.short ??
    "待分类";

  return (
    <div className="content-stack comparison-view">
      <section className="comparison-hero">
        <div>
          <p className="section-label">LAST VERSION</p>
          <span>{previous.updatedAt}</span>
          <strong>{previousCategory}</strong>
          <small>信念：{CONVICTION_LABEL[previous.conviction]}</small>
        </div>
        <span className="comparison-arrow" aria-hidden="true">
          →
        </span>
        <div className="current">
          <p className="section-label">LATEST VERSION</p>
          <span>{asset.updatedAt}</span>
          <strong>{currentCategory}</strong>
          <small>信念：{CONVICTION_LABEL[asset.conviction]}</small>
        </div>
      </section>

      <section className="content-section">
        <p className="section-label">01 · 变化摘要</p>
        <h3>这次逻辑具体变了什么</h3>
        <ul className="comparison-change-list">
          {comparison.changeSummary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="content-section">
        <p className="section-label">02 · 变化归因</p>
        <h3>是什么证据推动了重估</h3>
        <ul className="evidence-list">
          {comparison.drivers.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="comparison-boundary">
          证据截至 {comparison.evidenceAsOf}。消息标题只作为线索；没有日期和交叉证据，不判定对错。
        </p>
      </section>

      <section className="content-section">
        <p className="section-label">03 · 上一版复盘</p>
        <h3>哪些判断对了，哪些错了</h3>
        <div className="verdict-grid">
          {comparison.verdicts.map((item, index) => (
            <article
              className={`verdict-card ${item.verdict}`}
              key={`${item.claim}-${index}`}
            >
              <span>{VERDICT_LABEL[item.verdict]}</span>
              <strong>{item.claim}</strong>
              <p>{item.explanation}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <p className="section-label">04 · 新旧逻辑并排</p>
        <h3>只对照上一版与最新版</h3>
        <div className="version-comparison-table">
          <div className="version-comparison-head">
            <span>研究字段</span>
            <strong>上一版</strong>
            <strong>最新版</strong>
          </div>
          <ComparisonRow
            label="定价逻辑"
            previous={previous.valuationLogic}
            current={asset.valuationLogic}
          />
          <ComparisonRow
            label="交易假设"
            previous={previous.thesis}
            current={asset.thesis}
          />
          <ComparisonRow
            label="正向催化"
            previous={previous.catalyst.join("\n")}
            current={asset.catalyst.join("\n")}
          />
          <ComparisonRow
            label="失效条件"
            previous={previous.invalidation.join("\n")}
            current={asset.invalidation.join("\n")}
          />
          <ComparisonRow
            label="技术动作"
            previous={previous.technical.action}
            current={asset.technical.action}
          />
        </div>
      </section>

      <section className="content-section">
        <p className="section-label">05 · 近期消息线索</p>
        <h3>本次更新读取了什么</h3>
        {comparison.recentNews.length ? (
          <ul className="recent-news-list">
            {comparison.recentNews.map((item) => (
              <li key={`${item.url}-${item.publishedAt}`}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
                <span>
                  {item.publisher} · {item.publishedAt.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="supporting-copy">
            本次没有取得近45天可用消息；比较主要依据行情与原始披露。
          </p>
        )}
      </section>
    </div>
  );
}

function ComparisonRow({
  label,
  previous,
  current,
}: {
  label: string;
  previous: string;
  current: string;
}) {
  return (
    <div className="version-comparison-row">
      <strong>{label}</strong>
      <p>{previous || "上一版未记录"}</p>
      <p>{current || "最新版未记录"}</p>
    </div>
  );
}

function SignalsView({ asset }: { asset: Asset }) {
  return (
    <div className="content-stack">
      <section className="content-section">
        <p className="section-label">FUNDAMENTAL EVIDENCE</p>
        <h3>故事要经过哪些数据验证</h3>
        <p className="supporting-copy">
          信号用于判断方向，不直接替代入场。价格对信号的反应，才决定行情属于哪一类。
        </p>
      </section>

      <div className="signal-table" role="table" aria-label="基本面验证信号">
        <div className="signal-row signal-head" role="row">
          <span role="columnheader">验证项</span>
          <span role="columnheader">状态</span>
          <span role="columnheader">当前证据</span>
        </div>
        {asset.fundamentalSignals.map((signal) => (
          <div className="signal-row" role="row" key={signal.id}>
            <strong role="cell">{signal.label}</strong>
            <span
              className={`signal-state ${signal.state}`}
              role="cell"
              aria-label={`状态：${SIGNAL_LABEL[signal.state]}`}
            >
              {SIGNAL_LABEL[signal.state]}
            </span>
            <p role="cell">{signal.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TechnicalView({ asset }: { asset: Asset }) {
  return (
    <div className="content-stack">
      <section className="content-section">
        <p className="section-label">PRICE CONFIRMATION</p>
        <h3>技术面不是预测，是检验市场是否认同</h3>
      </section>

      <dl className="technical-spec">
        <div>
          <dt>趋势</dt>
          <dd>{asset.technical.trend}</dd>
        </div>
        <div>
          <dt>动量</dt>
          <dd>{asset.technical.momentum}</dd>
        </div>
        <div>
          <dt>结构</dt>
          <dd>{asset.technical.structure}</dd>
        </div>
      </dl>

      <section className="content-section">
        <p className="section-label">KEY LEVELS</p>
        <h3>关键位置与验证方式</h3>
        <div className="level-list">
          {asset.technical.levels.map((level) => (
            <div key={`${level.label}-${level.value}`}>
              <span className={`level-role ${level.role}`}>
                {level.role === "support"
                  ? "支撑"
                  : level.role === "resistance"
                    ? "阻力"
                    : "枢轴"}
              </span>
              <strong>{level.label}</strong>
              <b>{level.value}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="action-note">
        <span>当前动作</span>
        <p>{asset.technical.action}</p>
      </section>
    </div>
  );
}

function FrameworkView() {
  return (
    <div className="content-stack">
      <section className="content-section">
        <p className="section-label">REGIME MAP</p>
        <h3>先分类，再决定采用哪一种动作</h3>
        <p className="supporting-copy">
          同一个利好，在不同定价阶段会产生完全不同的股价反应。
        </p>
      </section>
      <div className="framework-list">
        {CATEGORY_DEFINITIONS.map((item, index) => (
          <section key={item.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <p className="section-label">{item.short}</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <strong>动作：{item.action}</strong>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function CommandDialog({
  dialogRef,
  query,
  index,
  results,
  onQuery,
  onKeyDown,
  onSelect,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  query: string;
  index: number;
  results: Asset[];
  onQuery: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <dialog className="command-dialog" ref={dialogRef}>
      <div className="dialog-header">
        <label htmlFor="command-search">搜索标的、名称、市场或赛道</label>
        <button
          className="dialog-close"
          onClick={() => dialogRef.current?.close()}
          aria-label="关闭搜索"
        >
          关闭
        </button>
      </div>
      <input
        id="command-search"
        autoFocus
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="例如：MU、存储、光模块"
      />
      <div className="command-results" role="listbox">
        {results.map((asset, resultIndex) => (
          <button
            key={asset.id}
            data-active={index === resultIndex}
            role="option"
            aria-selected={index === resultIndex}
            onClick={() => onSelect(asset.id)}
          >
            <span>
              <strong>{asset.symbol}</strong>
              <small>{asset.name}</small>
            </span>
            <span>{asset.sector}</span>
          </button>
        ))}
        {results.length === 0 && (
          <p className="command-empty">没有匹配标的。关闭搜索后可增加新标的。</p>
        )}
      </div>
      <p className="command-hint">↑↓ 选择 · Enter 打开 · Esc 关闭</p>
    </dialog>
  );
}

function AssetDialog({
  dialogRef,
  draft,
  intent,
  onClose,
  onSubmit,
  onGenerated,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  draft: Asset | null;
  intent: AssetDialogIntent;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGenerated: (
    asset: GeneratedAsset,
    payload: ResearchApiResponse,
  ) => void;
}) {
  const [researchQuery, setResearchQuery] = useState("");
  const [researchState, setResearchState] = useState<
    "idle" | "resolving" | "analyzing" | "ready" | "error"
  >("idle");
  const [researchError, setResearchError] = useState("");
  const [researchMeta, setResearchMeta] = useState<ResearchApiResponse | null>(
    null,
  );

  useEffect(() => {
    queueMicrotask(() => {
      setResearchQuery("");
      setResearchState("idle");
      setResearchError("");
      setResearchMeta(null);
    });
  }, [draft?.id, intent]);

  if (!draft) return <dialog ref={dialogRef} />;

  const signals = draft.fundamentalSignals
    .map((item) => `${item.label} | ${item.state} | ${item.note}`)
    .join("\n");
  const levels = draft.technical.levels
    .map((item) => `${item.label} | ${item.value} | ${item.role}`)
    .join("\n");
  const hasGeneratedDraft =
    draft.id !== "new" ||
    Boolean(draft.symbol && draft.valuationLogic && draft.thesis);
  const isGenerating =
    researchState === "resolving" || researchState === "analyzing";
  const isRefresh = intent === "refresh";
  const effectiveResearchQuery = isRefresh ? draft.symbol : researchQuery;
  const canSubmit =
    hasGeneratedDraft && (!isRefresh || researchState === "ready");

  async function generateResearch() {
    const query = effectiveResearchQuery.trim();
    if (!query || isGenerating) return;
    setResearchState("resolving");
    setResearchError("");
    setResearchMeta(null);
    const analyzingTimer = window.setTimeout(
      () => setResearchState("analyzing"),
      650,
    );

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          mode: isRefresh ? "refresh" : "initial",
          currentAsset: isRefresh ? draft : undefined,
        }),
      });
      const payload = (await response.json()) as ResearchApiResponse;
      if (!response.ok || !payload.asset) {
        throw new Error(payload.error || "AI 研究草稿生成失败。");
      }
      onGenerated(payload.asset, payload);
      setResearchMeta(payload);
      setResearchState("ready");
    } catch (error) {
      setResearchError(
        error instanceof Error ? error.message : "AI 研究草稿生成失败。",
      );
      setResearchState("error");
    } finally {
      window.clearTimeout(analyzingTimer);
    }
  }

  return (
    <dialog className="asset-dialog" ref={dialogRef}>
      <form
        key={`${draft.id}-${researchMeta?.generatedAt ?? "base"}`}
        onSubmit={onSubmit}
      >
        <header className="asset-dialog-header">
          <div>
            <h2>
              {isRefresh
                ? `更新 ${draft.symbol} 的研究逻辑`
                : draft.id === "new"
                  ? "增加研究标的"
                  : `编辑 ${draft.symbol}`}
            </h2>
          </div>
          <button type="button" className="dialog-close" onClick={onClose}>
            关闭
          </button>
        </header>

        {(draft.id === "new" || isRefresh) && (
          <section className="ai-add-workflow" aria-live="polite">
            <div className="ai-add-copy">
              <p className="eyebrow">
                {isRefresh
                  ? "AI RESEARCH · REFRESH REVIEW"
                  : "AI RESEARCH · EVIDENCE FIRST"}
              </p>
              <h3>
                {isRefresh
                  ? "读取近期证据，生成最新版草稿"
                  : "只输入名字，其余先由 AI 生成草稿"}
              </h3>
              <p>
                {isRefresh
                  ? "系统会读取近期行情、原始披露与近45天消息线索，对照上一版逐项解释变化。不会直接覆盖，保存前仍由你确认。"
                  : "系统先解析代码、读取最近行情与可用 SEC 原始文件，再生成定价逻辑、验证信号和技术结构。保存前仍由你确认。"}
              </p>
            </div>
            <div className="ai-query-row">
              <label htmlFor="ai-asset-query">公司 / 标的名称</label>
              <div>
                <input
                  id="ai-asset-query"
                  autoFocus
                  value={effectiveResearchQuery}
                  onChange={(event) => setResearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void generateResearch();
                    }
                  }}
                  placeholder="例如：Micron、Circle、QQQ、海力士"
                  disabled={isGenerating}
                  readOnly={isRefresh}
                />
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void generateResearch()}
                  disabled={!effectiveResearchQuery.trim() || isGenerating}
                >
                  {isGenerating
                    ? "正在分析"
                    : isRefresh
                      ? "AI 更新逻辑"
                      : "AI 生成研究草稿"}
                </button>
              </div>
            </div>

            {isGenerating && (
              <div className="ai-progress" role="status">
                <span />
                <div>
                  <strong>
                    {researchState === "resolving"
                      ? "正在解析标的与证据"
                      : "正在生成结构化研究草稿"}
                  </strong>
                  <p>通常需要几十秒，请不要关闭窗口。</p>
                </div>
              </div>
            )}

            {researchState === "error" && (
              <p className="ai-error" role="alert">
                {researchError}
              </p>
            )}

            {researchState === "ready" && researchMeta?.resolved && (
              <div className="ai-result-summary">
                <div>
                  <span>已解析</span>
                  <strong>
                    {researchMeta.resolved.symbol} ·{" "}
                    {researchMeta.resolved.name}
                  </strong>
                </div>
                <div>
                  <span>行情截至</span>
                  <strong>{researchMeta.evidence?.priceDate || "待核验"}</strong>
                </div>
                <div>
                  <span>原始文件</span>
                  <strong>
                    {(researchMeta.evidence?.filingCount ?? 0) > 0
                      ? `${researchMeta.evidence?.filingCount} 份 SEC 文件`
                      : researchMeta.evidence?.filingStatus
                        ? SEC_STATUS_LABEL[
                            researchMeta.evidence.filingStatus
                          ]
                        : "待核验"}
                  </strong>
                </div>
                <div>
                  <span>近期消息</span>
                  <strong>
                    {researchMeta.evidence?.newsCount ?? 0} 条标题线索
                  </strong>
                </div>
                <div>
                  <span>分析引擎</span>
                  <strong>{researchMeta.model || "DeepSeek V4 Pro"}</strong>
                </div>
                {Boolean(researchMeta.warnings?.length) && (
                  <ul>
                    {researchMeta.warnings?.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {isRefresh &&
              researchState === "ready" &&
              researchMeta?.comparison && (
                <section className="refresh-preview">
                  <div>
                    <p className="section-label">保存前预览</p>
                    <h4>本次逻辑变化</h4>
                    <ul>
                      {researchMeta.comparison.changeSummary?.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="section-label">上一版复盘</p>
                    <div className="refresh-verdict-list">
                      {researchMeta.comparison.verdicts?.map((item, index) => (
                        <article
                          className={item.verdict}
                          key={`${item.claim}-${index}`}
                        >
                          <span>{VERDICT_LABEL[item.verdict]}</span>
                          <strong>{item.claim}</strong>
                          <p>{item.explanation}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              )}
          </section>
        )}

        {hasGeneratedDraft && (
          <details className="asset-draft-details" open>
            <summary>
              <span>
                {isRefresh
                  ? "查看并修订最新版草稿"
                  : draft.id === "new"
                    ? "查看并修订 AI 草稿"
                    : "编辑研究字段"}
              </span>
              <small>所有字段在保存前都可以修改</small>
            </summary>
            <div className="form-grid">
          <label>
            代码
            <input
              name="symbol"
              required
              defaultValue={draft.symbol}
              placeholder="MU"
            />
          </label>
          <label>
            公司 / 资产名称
            <input
              name="name"
              required
              defaultValue={draft.name}
              placeholder="Micron"
            />
          </label>
          <label>
            市场
            <input name="market" defaultValue={draft.market} />
          </label>
          <label>
            赛道
            <input name="sector" defaultValue={draft.sector} />
          </label>
          <label>
            清单状态
            <select name="status" defaultValue={draft.status}>
              <option value="watching">观察</option>
              <option value="holding">持仓</option>
              <option value="avoid">回避</option>
            </select>
          </label>
          <label>
            行情分类
            <select name="category" defaultValue={draft.category}>
              <option value="type1">第一类</option>
              <option value="type2">第二类</option>
              <option value="type3">第三类</option>
              <option value="unclassified">待分类</option>
            </select>
          </label>
          <label>
            信念等级
            <select name="conviction" defaultValue={draft.conviction}>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
              <option value="pending">待定</option>
            </select>
          </label>
          <label>
            数据边界
            <input name="dataFreshness" defaultValue={draft.dataFreshness} />
          </label>
          <label>
            组合权重（%）
            <input
              name="portfolioWeight"
              type="number"
              inputMode="decimal"
              min="0.01"
              max="100"
              step="0.01"
              defaultValue={draft.portfolioWeight}
              placeholder="例如：12.5"
            />
            <small>用于组合集中度；只在状态为“持仓”时计入。</small>
          </label>
          <label>
            风险故事分组
            <input
              name="riskTheme"
              defaultValue={draft.riskTheme}
              placeholder="留空则按赛道自动归因"
            />
            <small>例如：AI 资本开支链、加密流动性、贵金属。</small>
          </label>
          <input
            type="hidden"
            name="positionSize"
            defaultValue={draft.positionSize}
          />
          <label>
            平均成本
            <input
              name="averageCost"
              defaultValue={draft.averageCost}
              placeholder="可留空"
            />
          </label>

          <label className="full-field">
            定价逻辑
            <textarea
              name="valuationLogic"
              required
              defaultValue={draft.valuationLogic}
              rows={4}
            />
          </label>
          <label className="full-field">
            当前交易假设
            <textarea
              name="thesis"
              required
              defaultValue={draft.thesis}
              rows={4}
            />
          </label>
          <label>
            正向催化（每行一项）
            <textarea
              name="catalyst"
              defaultValue={draft.catalyst.join("\n")}
              rows={5}
            />
          </label>
          <label>
            失效条件（每行一项）
            <textarea
              name="invalidation"
              defaultValue={draft.invalidation.join("\n")}
              rows={5}
            />
          </label>
          <label className="full-field">
            明确日期事件（每行：日期 | 事件 | 类型 | 影响 | 事前准备 | 状态 | 来源）
            <textarea
              name="keyEvents"
              defaultValue={eventsToLines(draft.keyEvents)}
              rows={5}
              placeholder="2026-09-23 | 下一次财报 | earnings | high | 记录市场预期、关键指引与价格确认位 | scheduled | 公司IR"
            />
            <small>
              类型可填 earnings / macro / industry / regulatory / product / crypto / other；影响可填 high / medium / low；状态可填 scheduled / reviewed / cancelled。只有已核实日期才应录入。
            </small>
          </label>
          <label className="full-field">
            验证信号（每行：名称 | 状态 | 说明）
            <textarea
              name="signals"
              defaultValue={signals}
              rows={6}
              placeholder="HBM订单 | positive | 订单继续上修"
            />
            <small>状态可填 positive / warning / negative / neutral</small>
          </label>
          <label>
            技术趋势
            <textarea name="trend" defaultValue={draft.technical.trend} rows={3} />
          </label>
          <label>
            技术动量
            <textarea
              name="momentum"
              defaultValue={draft.technical.momentum}
              rows={3}
            />
          </label>
          <label className="full-field">
            价格结构
            <textarea
              name="structure"
              defaultValue={draft.technical.structure}
              rows={3}
            />
          </label>
          <label className="full-field">
            关键位（每行：名称 | 数值 | 角色）
            <textarea
              name="levels"
              defaultValue={levels}
              rows={5}
              placeholder="第一阻力 | 714–719 | resistance"
            />
            <small>角色可填 support / resistance / pivot</small>
          </label>
          <label className="full-field">
            当前技术动作
            <textarea
              name="action"
              defaultValue={draft.technical.action}
              rows={3}
            />
          </label>
          <label className="full-field">
            研究来源（每行一项）
            <textarea
              name="sources"
              defaultValue={draft.sources.join("\n")}
              rows={3}
            />
          </label>
            </div>
          </details>
        )}

        <footer className="form-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={!canSubmit}
          >
            {isRefresh ? "保存为最新版" : "保存标的"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
