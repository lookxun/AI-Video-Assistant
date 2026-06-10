import { getCurrentUser, jsonError } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCreditSettings } from "@/lib/credits";
import { migrateLegacyUserProfileFromWorkspace, stripUserProfileFromWorkspaceState } from "@/lib/user-profile";
import { compactWorkspaceState, hasJsonChanged, mergeUnloadedSessions, replaceLegacyMediaUrls, summarizeWorkspaceState } from "@/lib/workspace-state-cleanup";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function metadataNumber(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return undefined;
  const value = metadata[key];
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

async function applyLedgerUsageSummaries(userId: string, state: unknown) {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return state;

  const [settings, ledgers] = await Promise.all([
    getCreditSettings(),
    prisma.creditLedger.findMany({
      where: { userId, direction: "consume", conversationId: { not: null } },
      select: { conversationId: true, credits: true, promptTokens: true, completionTokens: true, totalTokens: true, metadata: true },
    }),
  ]);

  const summaries = new Map<string, { promptTokens: number; completionTokens: number; totalTokens: number; usd: number; cny: number; credits: number }>();
  for (const item of ledgers) {
    if (!item.conversationId) continue;
    const summary = summaries.get(item.conversationId) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, usd: 0, cny: 0, credits: 0 };
    const chargedCny = metadataNumber(item.metadata, "chargedCny") ?? (settings.creditsPerCny > 0 ? item.credits / settings.creditsPerCny : 0);
    const chargedUsd = metadataNumber(item.metadata, "chargedUsd") ?? (settings.usdToCnyRate > 0 ? chargedCny / settings.usdToCnyRate : 0);
    summary.promptTokens += item.promptTokens;
    summary.completionTokens += item.completionTokens;
    summary.totalTokens += item.totalTokens;
    summary.usd += chargedUsd;
    summary.cny += chargedCny;
    summary.credits += item.credits;
    summaries.set(item.conversationId, summary);
  }

  return {
    ...state,
    sessions: state.sessions.map((session) => {
      if (!isRecord(session) || typeof session.id !== "string") return session;
      const ledgerSummary = summaries.get(session.id);
      const existing = isRecord(session.usageSummary) ? session.usageSummary : undefined;
      const totalTokens = ledgerSummary?.totalTokens ?? Math.max(0, Math.floor(Number(existing?.totalTokens ?? 0)));
      const promptTokens = ledgerSummary?.promptTokens ?? Math.max(0, Math.floor(Number(existing?.promptTokens ?? 0)));
      const completionTokens = ledgerSummary?.completionTokens ?? Math.max(0, Math.floor(Number(existing?.completionTokens ?? 0)));
      return {
        ...session,
        usageSummary: {
          promptTokens,
          completionTokens,
          totalTokens,
          usd: ledgerSummary?.usd ?? 0,
          cny: ledgerSummary?.cny ?? 0,
          credits: ledgerSummary?.credits ?? 0,
        },
      };
    }),
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  const summaryOnly = new URL(request.url).searchParams.get("summary") === "1";

  const workspace = await prisma.userWorkspaceState.findUnique({
    where: { userId: user.id },
  });

  if (workspace?.state) {
    await migrateLegacyUserProfileFromWorkspace(user.id, workspace.state);
    const cleanState = await applyLedgerUsageSummaries(user.id, compactWorkspaceState(replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(workspace.state))));
    if (hasJsonChanged(workspace.state, cleanState)) {
      await prisma.userWorkspaceState.update({ where: { userId: user.id }, data: { state: cleanState as Prisma.InputJsonValue } });
    }
    return Response.json({ state: summaryOnly ? summarizeWorkspaceState(cleanState) : cleanState });
  }

  return Response.json({ state: null });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("工作区数据无效");

  await migrateLegacyUserProfileFromWorkspace(user.id, body);
  const existing = await prisma.userWorkspaceState.findUnique({ where: { userId: user.id } });
  const mergedBody = existing?.state ? mergeUnloadedSessions(body, existing.state) : body;
  const cleanBody = await applyLedgerUsageSummaries(user.id, compactWorkspaceState(replaceLegacyMediaUrls(stripUserProfileFromWorkspaceState(mergedBody))));

  await prisma.userWorkspaceState.upsert({
    where: { userId: user.id },
    update: { state: cleanBody as Prisma.InputJsonValue },
    create: { userId: user.id, state: cleanBody as Prisma.InputJsonValue },
  });

  return Response.json({ ok: true });
}
