import { Prisma } from "@prisma/client";
import { getCreditSettings } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

type WorkspaceWorkflowRow = {
  workflowId: string;
  workflowCode: string | null;
  title: string;
  nextImageNumber: number;
  nextVideoNumber: number;
  updatedAt: Date;
  createdAt: Date;
  deletedAt: Date | null;
  canvasJson: Prisma.JsonValue;
  usageSummary: Prisma.JsonValue | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toDate(value: unknown) {
  const date = typeof value === "number" || typeof value === "string" ? new Date(value) : value instanceof Date ? value : new Date();
  return Number.isFinite(date.getTime()) ? date : new Date();
}

function toNullableDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const date = toDate(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toJsonObject(value: unknown): Prisma.InputJsonObject {
  return isRecord(value) ? value as Prisma.InputJsonObject : {};
}

function toPositiveInt(value: unknown, fallback = 1) {
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function metadataNumber(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return undefined;
  const value = metadata[key];
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getWorkflowCodeFromTitle(title: string) {
  const number = Number(title.match(/^工作流_(\d+)$/)?.[1]);
  return Number.isFinite(number) && number > 0 ? `w${number}` : undefined;
}

function normalizeWorkflowCode(value: unknown, title: string) {
  if (typeof value === "string" && /^w\d+$/.test(value)) return value;
  return getWorkflowCodeFromTitle(title);
}

function getWorkflowActionCount(value: unknown) {
  if (!isRecord(value)) return 0;
  const canvas = isRecord(value.canvas) ? value.canvas : undefined;
  const nodes = Array.isArray(canvas?.nodes) ? canvas.nodes.length : 0;
  const edges = Array.isArray(canvas?.edges) ? canvas.edges.length : 0;
  return nodes + edges;
}

function getCanvasActionCount(value: unknown) {
  if (!isRecord(value)) return 0;
  const nodes = Array.isArray(value.nodes) ? value.nodes.length : 0;
  const edges = Array.isArray(value.edges) ? value.edges.length : 0;
  return nodes + edges;
}

function mergeWorkflowCanvasMedia(existingCanvas: unknown, incomingCanvas: Prisma.InputJsonObject) {
  if (!isRecord(existingCanvas) || !Array.isArray(existingCanvas.nodes) || !Array.isArray(incomingCanvas.nodes)) return incomingCanvas;
  const existingNodes = new Map<string, Record<string, unknown>>();
  existingCanvas.nodes.filter(isRecord).forEach((node) => {
    if (typeof node.id === "string" && node.id) existingNodes.set(node.id, node);
  });
  const nodes = incomingCanvas.nodes.map((node) => {
    if (!isRecord(node) || typeof node.id !== "string") return node;
    const existing = existingNodes.get(node.id);
    if (!isRecord(existing) || !isRecord(existing.data)) return node;
    const data = isRecord(node.data) ? node.data : {};
    const nextData = { ...data };
    if (!Array.isArray(nextData.images) && Array.isArray(existing.data.images)) nextData.images = existing.data.images;
    if (!isRecord(nextData.imageDimensions) && isRecord(existing.data.imageDimensions)) nextData.imageDimensions = existing.data.imageDimensions;
    if (!isRecord(nextData.mediaSystemNames) && isRecord(existing.data.mediaSystemNames)) nextData.mediaSystemNames = existing.data.mediaSystemNames;
    if (typeof nextData.videoUrl !== "string" && typeof existing.data.videoUrl === "string") nextData.videoUrl = existing.data.videoUrl;
    if (typeof nextData.posterUrl !== "string" && typeof existing.data.posterUrl === "string") nextData.posterUrl = existing.data.posterUrl;
    return { ...node, data: nextData };
  });
  return { ...incomingCanvas, nodes };
}

function normalizeWorkflowItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((workflow) => {
    const workflowId = typeof workflow.id === "string" ? workflow.id : "";
    if (!workflowId) return [];
    const title = typeof workflow.title === "string" && workflow.title.trim() ? workflow.title.trim() : "新工作流";
    return [{
      workflowId,
      workflowCode: normalizeWorkflowCode(workflow.workflowCode, title),
      title,
      nextImageNumber: toPositiveInt(workflow.nextImageNumber),
      nextVideoNumber: toPositiveInt(workflow.nextVideoNumber),
      updatedAt: toDate(workflow.updatedAt),
      deletedAt: toNullableDate(workflow.deletedAt),
      canvasJson: toJsonObject(workflow.canvas),
      usageSummary: toJsonObject(workflow.usageSummary),
    }];
  });
}

export function stripWorkflowsFromWorkspaceState(state: unknown) {
  if (!isRecord(state)) return state;
  const { workflowItems: _workflowItems, ...rest } = state;
  return rest;
}

export async function upsertWorkspaceWorkflows(userId: string, workflowItems: unknown, options: { activePanel?: unknown } = {}) {
  if (!Array.isArray(workflowItems)) return;
  const incoming = normalizeWorkflowItems(workflowItems);
  if (incoming.length === 0) return;

  const existingRows = await prisma.workspaceWorkflow.findMany({
    where: { userId, deletedAt: null },
    select: { workflowId: true, canvasJson: true },
  });
  const existingCanvasByWorkflowId = new Map(existingRows.map((row) => [row.workflowId, row.canvasJson]));
  const existingActionCount = existingRows.reduce((sum, row) => sum + getCanvasActionCount(row.canvasJson), 0);
  const incomingActionCount = workflowItems.filter(isRecord).reduce((sum, item) => sum + getWorkflowActionCount(item), 0);
  const incomingLooksAutoEmpty = incoming.length <= 1 && incomingActionCount === 0;
  if (options.activePanel !== "workflow" && incomingLooksAutoEmpty && existingActionCount > 0) return;

  await Promise.all(incoming.map((workflow) => {
    const canvasJson = mergeWorkflowCanvasMedia(existingCanvasByWorkflowId.get(workflow.workflowId), workflow.canvasJson);
    return prisma.workspaceWorkflow.upsert({
      where: { userId_workflowId: { userId, workflowId: workflow.workflowId } },
      create: { userId, workflowId: workflow.workflowId, workflowCode: workflow.workflowCode, workspaceKind: "workflow", title: workflow.title, nextImageNumber: workflow.nextImageNumber, nextVideoNumber: workflow.nextVideoNumber, updatedAt: workflow.updatedAt, deletedAt: workflow.deletedAt, canvasJson, usageSummary: workflow.usageSummary },
      update: { workspaceKind: "workflow", workflowCode: workflow.workflowCode, title: workflow.title, nextImageNumber: workflow.nextImageNumber, nextVideoNumber: workflow.nextVideoNumber, updatedAt: workflow.updatedAt, deletedAt: workflow.deletedAt, canvasJson, usageSummary: workflow.usageSummary },
    });
  }));

  // Deletion is explicit through each workflow's deletedAt. A partial or stale
  // client payload must never delete workflows merely because they are absent.
}

export async function migrateWorkspaceWorkflowsFromState(userId: string, state: unknown) {
  if (!isRecord(state) || !Array.isArray(state.workflowItems) || state.workflowItems.length === 0) return false;
  const count = await prisma.workspaceWorkflow.count({ where: { userId } });
  if (count > 0) return false;
  await upsertWorkspaceWorkflows(userId, state.workflowItems, { activePanel: state.activePanel });
  return true;
}

export function workspaceWorkflowRowToPayload(row: WorkspaceWorkflowRow) {
  return {
    id: row.workflowId,
    workflowCode: row.workflowCode ?? getWorkflowCodeFromTitle(row.title),
    title: row.title,
    nextImageNumber: row.nextImageNumber,
    nextVideoNumber: row.nextVideoNumber,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    deletedAt: row.deletedAt ? row.deletedAt.getTime() : undefined,
    canvas: isRecord(row.canvasJson) ? row.canvasJson : {},
    usageSummary: isRecord(row.usageSummary) ? row.usageSummary : undefined,
  };
}

async function getWorkflowUsageSummariesFromLedger(userId: string) {
  const [settings, ledgers] = await Promise.all([
    getCreditSettings(),
    prisma.creditLedger.findMany({
      where: { userId, direction: "consume", workspaceKind: "workflow", workspaceId: { not: null } },
      select: { workspaceId: true, credits: true, promptTokens: true, completionTokens: true, totalTokens: true, metadata: true },
    }),
  ]);

  const summaries = new Map<string, { promptTokens: number; completionTokens: number; totalTokens: number; usd: number; cny: number; credits: number }>();
  for (const item of ledgers) {
    if (!item.workspaceId) continue;
    const summary = summaries.get(item.workspaceId) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, usd: 0, cny: 0, credits: 0 };
    const chargedCny = metadataNumber(item.metadata, "chargedCny") ?? (settings.creditsPerCny > 0 ? item.credits / settings.creditsPerCny : 0);
    const chargedUsd = metadataNumber(item.metadata, "chargedUsd") ?? (settings.usdToCnyRate > 0 ? chargedCny / settings.usdToCnyRate : 0);
    summary.promptTokens += item.promptTokens;
    summary.completionTokens += item.completionTokens;
    summary.totalTokens += item.totalTokens;
    summary.usd += chargedUsd;
    summary.cny += chargedCny;
    summary.credits += item.credits;
    summaries.set(item.workspaceId, summary);
  }
  return summaries;
}

export async function getWorkspaceWorkflowPayloads(userId: string, fallbackState?: unknown) {
  await migrateWorkspaceWorkflowsFromState(userId, fallbackState);
  const rows = await prisma.workspaceWorkflow.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }, { workflowId: "desc" }],
    select: { workflowId: true, workflowCode: true, title: true, nextImageNumber: true, nextVideoNumber: true, createdAt: true, updatedAt: true, deletedAt: true, canvasJson: true, usageSummary: true },
  });
  if (rows.length > 0) {
    const ledgerSummaries = await getWorkflowUsageSummariesFromLedger(userId);
    return rows.map((row) => {
      const payload = workspaceWorkflowRowToPayload(row);
      const ledgerSummary = ledgerSummaries.get(row.workflowId);
      return ledgerSummary ? { ...payload, usageSummary: ledgerSummary } : payload;
    });
  }
  return normalizeWorkflowItems(isRecord(fallbackState) ? fallbackState.workflowItems : undefined).filter((workflow) => !workflow.deletedAt).map((workflow) => ({
    id: workflow.workflowId,
    workflowCode: workflow.workflowCode,
    title: workflow.title,
    nextImageNumber: workflow.nextImageNumber,
    nextVideoNumber: workflow.nextVideoNumber,
    updatedAt: workflow.updatedAt.getTime(),
    canvas: workflow.canvasJson,
    usageSummary: workflow.usageSummary,
  }));
}
