import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { researchWorkspaces } from "../../../db/schema";
import { chatGPTSignInPath, getChatGPTUser } from "../../chatgpt-auth";
import {
  emptyWorkspace,
  isWorkspacePayload,
  normalizeWorkspace,
  type WorkspacePayload,
} from "../../workspace-sync";

const MAX_PAYLOAD_BYTES = 1_500_000;
const WORKSPACE_SYNC_DISABLED =
  process.env.WORKSPACE_SYNC_MODE === "disabled";

function syncDisabledResponse() {
  return Response.json(
    {
      signedIn: false,
      syncAvailable: false,
      error: "当前部署使用本机保存；跨设备同步未启用。",
    },
    { status: 501 },
  );
}

async function ownerKey(email: string) {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function parseStoredPayload(payload: string): WorkspacePayload {
  try {
    const parsed: unknown = JSON.parse(payload);
    return isWorkspacePayload(parsed)
      ? normalizeWorkspace(parsed)
      : emptyWorkspace();
  } catch {
    return emptyWorkspace();
  }
}

function unauthenticatedResponse() {
  return Response.json(
    {
      signedIn: false,
      signInPath: chatGPTSignInPath("/"),
    },
    { status: 401 },
  );
}

function databaseError(error: unknown) {
  const detail = error instanceof Error ? error.message : "";
  const missingTable =
    detail.includes("no such table") ||
    detail.includes("research_workspaces");
  return Response.json(
    {
      error: missingTable
        ? "云同步数据库正在初始化，请稍后重试。"
        : "云同步暂时不可用，请稍后重试。",
    },
    { status: 503 },
  );
}

export async function GET() {
  if (WORKSPACE_SYNC_DISABLED) return syncDisabledResponse();
  const user = await getChatGPTUser();
  if (!user) return unauthenticatedResponse();

  try {
    const key = await ownerKey(user.email);
    const db = await getDb();
    const [row] = await db
      .select()
      .from(researchWorkspaces)
      .where(eq(researchWorkspaces.ownerKey, key))
      .limit(1);

    return Response.json({
      signedIn: true,
      displayName: user.displayName,
      workspace: row
        ? {
            ...parseStoredPayload(row.payload),
            revision: row.revision,
            updatedAt: row.updatedAt,
          }
        : {
            ...emptyWorkspace(),
            revision: 0,
            updatedAt: "",
          },
    });
  } catch (error) {
    return databaseError(error);
  }
}

export async function PUT(request: Request) {
  if (WORKSPACE_SYNC_DISABLED) return syncDisabledResponse();
  const user = await getChatGPTUser();
  if (!user) return unauthenticatedResponse();

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return Response.json({ error: "同步数据过大，无法保存。" }, { status: 413 });
  }

  let body: { workspace?: unknown; baseRevision?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "同步数据格式无效。" }, { status: 400 });
  }

  if (
    !isWorkspacePayload(body.workspace) ||
    typeof body.baseRevision !== "number" ||
    !Number.isInteger(body.baseRevision) ||
    body.baseRevision < 0
  ) {
    return Response.json({ error: "同步数据格式无效。" }, { status: 400 });
  }

  const normalizedWorkspace = normalizeWorkspace(body.workspace);
  const serialized = JSON.stringify(normalizedWorkspace);
  if (new TextEncoder().encode(serialized).byteLength > MAX_PAYLOAD_BYTES) {
    return Response.json({ error: "同步数据过大，无法保存。" }, { status: 413 });
  }

  try {
    const key = await ownerKey(user.email);
    const db = await getDb();
    const [current] = await db
      .select()
      .from(researchWorkspaces)
      .where(eq(researchWorkspaces.ownerKey, key))
      .limit(1);

    if ((current?.revision ?? 0) !== body.baseRevision) {
      return Response.json(
        {
          error: "云端已有更新，请合并后重试。",
          workspace: current
            ? {
                ...parseStoredPayload(current.payload),
                revision: current.revision,
                updatedAt: current.updatedAt,
              }
            : {
                ...emptyWorkspace(),
                revision: 0,
                updatedAt: "",
              },
        },
        { status: 409 },
      );
    }

    const nextRevision = body.baseRevision + 1;
    const updatedAt = new Date().toISOString();

    if (!current) {
      await db.insert(researchWorkspaces).values({
        ownerKey: key,
        payload: serialized,
        revision: nextRevision,
        updatedAt,
      });
    } else {
      const updated = await db
        .update(researchWorkspaces)
        .set({
          payload: serialized,
          revision: nextRevision,
          updatedAt,
        })
        .where(
          and(
            eq(researchWorkspaces.ownerKey, key),
            eq(researchWorkspaces.revision, body.baseRevision),
          ),
        )
        .returning({ revision: researchWorkspaces.revision });
      if (!updated.length) {
        return Response.json(
          { error: "云端刚刚发生了更新，请重新同步。" },
          { status: 409 },
        );
      }
    }

    return Response.json({
      signedIn: true,
      displayName: user.displayName,
      workspace: {
        ...normalizedWorkspace,
        revision: nextRevision,
        updatedAt,
      },
    });
  } catch (error) {
    return databaseError(error);
  }
}
