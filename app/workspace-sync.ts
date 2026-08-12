import { normalizeTradePlans } from "./decision-log.ts";
import type { Asset, TradePlanRecord } from "./types";

export const TOMBSTONE_STORAGE_KEY =
  "trader-research-desk:deleted-assets:v1";

export type WorkspacePayload = {
  schemaVersion: 1;
  assets: Asset[];
  tombstones: Record<string, string>;
  decisions: TradePlanRecord[];
};

export type CloudWorkspace = WorkspacePayload & {
  revision: number;
  updatedAt: string;
};

function canonicalAssetKey(asset: Pick<Asset, "market" | "symbol">) {
  return `${asset.market.trim().toUpperCase()}:${asset.symbol
    .trim()
    .toUpperCase()}`;
}

function assetVersion(asset: Asset) {
  return (
    asset.modifiedAt ||
    asset.lastComparison?.generatedAt ||
    (asset.updatedAt ? `${asset.updatedAt}T00:00:00.000Z` : "")
  );
}

function newestTimestamp(left = "", right = "") {
  return left >= right ? left : right;
}

export function emptyWorkspace(assets: Asset[] = []): WorkspacePayload {
  return {
    schemaVersion: 1,
    assets,
    tombstones: {},
    decisions: [],
  };
}

function mergeDecisions(
  local: TradePlanRecord[],
  cloud: TradePlanRecord[],
) {
  const decisionsById = new Map<string, TradePlanRecord>();
  for (const decision of [...cloud, ...local]) {
    const current = decisionsById.get(decision.id);
    if (!current || decision.updatedAt >= current.updatedAt) {
      decisionsById.set(decision.id, decision);
    }
  }
  return Array.from(decisionsById.values())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 300);
}

export function mergeWorkspaces(
  local: WorkspacePayload,
  cloud: WorkspacePayload,
): WorkspacePayload {
  const tombstones: Record<string, string> = { ...cloud.tombstones };
  for (const [key, timestamp] of Object.entries(local.tombstones)) {
    tombstones[key] = newestTimestamp(tombstones[key], timestamp);
  }

  const assetsByKey = new Map<string, Asset>();
  for (const asset of [...cloud.assets, ...local.assets]) {
    const key = canonicalAssetKey(asset);
    const current = assetsByKey.get(key);
    if (!current || assetVersion(asset) >= assetVersion(current)) {
      assetsByKey.set(key, asset);
    }
  }

  const assets = Array.from(assetsByKey.entries())
    .filter(([key, asset]) => {
      const deletedAt = tombstones[key];
      return !deletedAt || assetVersion(asset) > deletedAt;
    })
    .map(([, asset]) => asset);

  const decisions = mergeDecisions(
    normalizeTradePlans(local.decisions),
    normalizeTradePlans(cloud.decisions),
  );

  return { schemaVersion: 1, assets, tombstones, decisions };
}

export function markAssetDeleted(
  tombstones: Record<string, string>,
  asset: Asset,
  timestamp = new Date().toISOString(),
) {
  return {
    ...tombstones,
    [canonicalAssetKey(asset)]: timestamp,
  };
}

export function clearAssetTombstone(
  tombstones: Record<string, string>,
  asset: Asset,
) {
  const key = canonicalAssetKey(asset);
  if (!(key in tombstones)) return tombstones;
  const next = { ...tombstones };
  delete next[key];
  return next;
}

export function isTombstoneRecord(
  value: unknown,
): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

export function isWorkspacePayload(value: unknown): value is WorkspacePayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkspacePayload>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.assets) &&
    candidate.assets.every(
      (asset) =>
        typeof asset === "object" &&
        asset !== null &&
        typeof (asset as Partial<Asset>).id === "string" &&
        typeof (asset as Partial<Asset>).symbol === "string" &&
        typeof (asset as Partial<Asset>).market === "string" &&
        typeof (asset as Partial<Asset>).name === "string" &&
        typeof (asset as Partial<Asset>).technical === "object" &&
        Array.isArray((asset as Partial<Asset>).fundamentalSignals),
    ) &&
    isTombstoneRecord(candidate.tombstones) &&
    (candidate.decisions === undefined ||
      (Array.isArray(candidate.decisions) &&
        normalizeTradePlans(candidate.decisions).length ===
          candidate.decisions.length))
  );
}

export function normalizeWorkspace(
  workspace: WorkspacePayload,
): WorkspacePayload {
  return {
    schemaVersion: 1,
    assets: workspace.assets,
    tombstones: workspace.tombstones,
    decisions: normalizeTradePlans(workspace.decisions),
  };
}
