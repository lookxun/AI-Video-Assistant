"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode, type SyntheticEvent } from "react";
import { BaseBoxShapeUtil, HTMLContainer, Rectangle2d, SelectionForegroundOverlayUtil, T, Tldraw, createShapeId, defaultOverlayUtils, resizeBox, useActions, useEditor, useValue, type Editor, type TLComponents, type TLResizeInfo, type TLShape, type TLShapeId, type TLUiOverrides, type TldrawOptions } from "tldraw";
import { RiAddLine, RiArrowDownSLine, RiArrowUpLine, RiCheckLine, RiCheckboxBlankCircleLine, RiCloseLine, RiCursorLine, RiEmotionSadLine, RiEyeLine, RiFileTextLine, RiFilmAiLine, RiFocus3Line, RiGoogleFill, RiHand, RiImageAiLine, RiImageLine, RiLayoutLeft2Line, RiLayoutLeftLine, RiLoader4Line, RiNodeTree, RiOpenaiFill, RiPlayLargeFill, RiResetLeftLine, RiRoadMapLine, RiShining2Line, RiStackLine, RiTBoxLine, RiTextBlock, RiTimeLine, RiTiktokFill, RiVideoLine, RiVideoOnLine, RiVoiceprintLine, RiZoomInLine, RiZoomOutLine } from "react-icons/ri";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, bytePlusVideoGenerationModels, frontendConversationModels, frontendImageGenerationModels, getExpectedImageDimensions, getExpectedVideoDimensions, getSupportedImageResolutions, getSupportedVideoRatios, getSupportedVideoResolutions, imageGenerationModels, normalizeImageResolutionForModel, normalizeVideoRatioForModel, normalizeVideoResolutionForModel, videoGenerationModels, type ConversationModel, type GenerationModel, type ModelName } from "@/lib/models";
import { toUserErrorMessage } from "@/lib/error-message";
import { sanitizeModelOutputText } from "@/lib/text-cleanup";
import { getUploadKindFromFileName, getUploadRule, type UploadKind, type UploadKindRule, type UploadRule } from "@/lib/upload-rules";

export type WorkflowNodeKind = "text" | "image" | "video";

export type WorkflowNodeData = {
  text?: string;
  outputText?: string;
  prompt?: string;
  model?: ModelName;
  ratio?: string;
  resolution?: string;
  duration?: string;
  images?: string[];
  imageDimensions?: Record<string, { width: number; height: number }>;
  videoUrl?: string;
  posterUrl?: string;
  videoDimensions?: { width: number; height: number };
  durationSeconds?: number;
  videoCurrentTime?: number;
  mediaSystemNames?: Record<string, string>;
  visualSize?: { width: number; height: number };
  error?: string;
  isRunning?: boolean;
  taskId?: string;
  startedAt?: number;
  uploads?: WorkflowUploadItem[];
};

type WorkflowUploadKind = UploadKind;

type WorkflowUploadItem = {
  id: string;
  kind: WorkflowUploadKind;
  name: string;
  url?: string;
  previewUrl?: string;
  status: "uploading" | "ready" | "error";
  progress?: number;
  error?: string;
  text?: string;
  dimensions?: { width: number; height: number };
  durationSeconds?: number;
};

export type WorkflowNode = {
  id: string;
  kind: WorkflowNodeKind;
  title: string;
  x: number;
  y: number;
  data: WorkflowNodeData;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
};

export type WorkflowCanvasState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
  historicalTextNodes?: WorkflowNode[];
};

type UsageMeta = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  usd?: number;
  cny?: number;
  credits?: number;
};

type CreditResult = {
  skipped?: boolean;
  balance?: number;
  chargedCredits?: number;
  usage?: UsageMeta;
};

type WorkflowCanvasProps = {
  workflowId: string;
  value?: WorkflowCanvasState;
  onChange: (next: WorkflowCanvasState) => void;
  workflowTitle: string;
  onCredit?: (credit?: CreditResult) => void;
  onGeneratedMedia?: (media: { nodeId: string; kind: "image" | "video"; urls: string[]; posterUrl?: string; sourcePrompt: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: Record<string, { width: number; height: number }>; durationSeconds?: Record<string, number> }) => void;
  onPreviewMedia?: (media: { nodeId: string; kind: "image" | "video"; url: string; posterUrl?: string; name: string; sourcePrompt?: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: { width: number; height: number } }) => void;
  getImageDisplayUrl?: (url: string) => string;
  getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined;
  enabledTextModelIds?: string[];
  textModelProviders?: Record<string, "openrouter" | "byteplus">;
  enabledImageModelIds?: string[];
  enabledVideoModelIds?: string[];
  leftSidebarVisible?: boolean;
  onToggleLeftSidebar?: () => void;
  workflowAssets?: WorkflowAssetSummary[];
  referenceAssets?: WorkflowReferenceAsset[];
  referenceAssetsLoadStatus?: "idle" | "loading" | "loaded" | "failed";
  onLoadReferenceAssets?: () => void;
};

type WorkflowAssetSummary = {
  id: string;
  name: string;
  url: string;
  posterUrl?: string;
  kind: "image" | "video";
  nodeId?: string;
  sourcePrompt?: string;
  ratio?: string;
  resolution?: string;
  duration?: string;
  dimensions?: { width: number; height: number };
};

type WorkflowReferenceAsset = {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  groupType: string;
  groupLabel: string;
};

const workflowReferenceGroupOrder = ["character_image", "scene_image", "shot_image", "conversation_upload"];
const workflowReadableDocumentFormats = ["md", "txt", "csv"];
const MAX_WORKFLOW_DOCUMENT_TEXT_CHARS = 50_000;
const MAX_WORKFLOW_DOCUMENT_CONTEXT_CHARS = 30_000;
const WORKFLOW_TEXT_OUTPUT_INSTRUCTIONS = "\n\n输出要求：请只用中文回答，不要夹带英文段落或英文标题；不要输出代码、代码块、命令行、JSON、Markdown 表格或反引号内容；不要解释格式规则。第一行写一个简短中文标题，不要带 # 号；正文用清晰分段、短句和列表表达。可以适当使用少量自然表情或符号做视觉提示，但不要堆砌。重点可用 **加粗**，重要提醒可用 [blue]...[/blue] 或 [red]...[/red]。";

class WorkflowSelectionForegroundOverlayUtil extends SelectionForegroundOverlayUtil {
  override options = { zIndex: 100, lineWidth: 3 };
}

const workflowOverlayUtils = defaultOverlayUtils.map((OverlayUtil) => OverlayUtil === SelectionForegroundOverlayUtil ? WorkflowSelectionForegroundOverlayUtil : OverlayUtil);

type WorkflowModelOptions = {
  textModels: readonly ConversationModel[];
  textModelProviders: Record<string, "openrouter" | "byteplus">;
  imageModels: readonly GenerationModel[];
  videoModels: readonly GenerationModel[];
};

type VideoApiResponse = {
  id?: string;
  job_id?: string;
  polling_url?: string;
  pollingUrl?: string;
  status?: string;
  content?: unknown;
  videoUrl?: string;
  usage?: UsageMeta;
  credit?: CreditResult;
  error?: { message?: string };
  errorCode?: string;
};

type WorkflowNodeShape = TLShape<"workflow_node">;

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    workflow_node: { w: number; h: number; node: WorkflowNode };
  }
}

const NODE_WIDTH = 320;
const NODE_HEIGHT = 180;
const CARD_HEIGHT = 180;
const TEXT_NODE_WIDTH = 720;
const TEXT_NODE_HEIGHT = 480;
const DEFAULT_STATE: WorkflowCanvasState = { nodes: [], edges: [] };
const imageRatioOptions = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const fallbackVideoDurationOptions = ["5秒", "10秒", "15秒"];
const workflowVideoModels = [...videoGenerationModels, ...bytePlusVideoGenerationModels];
const videoPollIntervalMs = 10_000;
const videoMaxPollAttempts = 90;
const MAX_WORKFLOW_PROMPT_LENGTH = 2000;
const DEFAULT_WORKFLOW_IMAGE_MODEL = "byteplus:conversation-image.seedream-4-5";
const DEFAULT_WORKFLOW_VIDEO_MODEL = "byteplus:video.seedance-2-0";
const WORKFLOW_NODE_GAP = 160;

const ratioCardMeta: Record<string, { icon: string; width: string; height: string }> = {
  智能比例: { icon: "spark", width: "16", height: "16" },
  "16:9": { icon: "rect", width: "18", height: "10" },
  "21:9": { icon: "rect", width: "18", height: "8" },
  "9:16": { icon: "rect", width: "10", height: "18" },
  "1:1": { icon: "rect", width: "14", height: "14" },
  "3:4": { icon: "rect", width: "12", height: "16" },
  "4:3": { icon: "rect", width: "16", height: "16" },
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function getWorkflowUploadAccept(rule: UploadRule, kind: WorkflowUploadKind) {
  const kindRule = rule[kind];
  if (!kindRule.enabled) return "";
  const mimeByFormat: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    md: "text/markdown",
    mp4: "video/mp4",
    mov: "video/quicktime",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  };
  const values = new Set<string>();
  kindRule.formats.forEach((format) => {
    values.add(`.${format}`);
    const mime = mimeByFormat[format];
    if (mime) values.add(mime);
  });
  return Array.from(values).join(",");
}

function getWorkflowUploadRule(node: WorkflowNode) {
  const mode = node.kind === "text" ? "agent" : node.kind;
  return getUploadRule({ mode, modelId: node.data.model, transportMode: node.kind === "video" ? "server-url" : "local-base64" });
}

const disabledWorkflowUploadRule: UploadKindRule = { enabled: false, maxCount: 0, maxSizeMb: 0, formats: [] };
const workflowReadableDocumentUploadRule: UploadKindRule = { enabled: true, maxCount: 5, maxSizeMb: 10, formats: workflowReadableDocumentFormats };

function getEffectiveWorkflowUploadRule(node: WorkflowNode) {
  const rule = getWorkflowUploadRule(node);

  return { ...rule, document: node.kind === "text" ? workflowReadableDocumentUploadRule : disabledWorkflowUploadRule };
}

function sanitizeWorkflowReferenceName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[@\s，。！？；;、]+/g, "").trim() || "上传文件";
}

function readWorkflowFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function readWorkflowDocumentText(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(96, Math.max(8, Math.round((event.loaded / event.total) * 96))));
    };
    reader.onload = () => {
      onProgress(100);
      const text = typeof reader.result === "string" ? reader.result : "";
      resolve(text.slice(0, MAX_WORKFLOW_DOCUMENT_TEXT_CHARS));
    };
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });
}

function appendWorkflowDocumentContext(prompt: string, uploads?: WorkflowUploadItem[]) {
  const documents = (uploads ?? []).filter((upload) => upload.kind === "document" && upload.status === "ready" && upload.text?.trim());
  if (documents.length === 0) return prompt;

  let remaining = MAX_WORKFLOW_DOCUMENT_CONTEXT_CHARS;
  const sections: string[] = [];
  documents.forEach((document, index) => {
    if (remaining <= 0) return;
    const content = (document.text ?? "").trim().slice(0, remaining);
    if (!content) return;
    remaining -= content.length;
    sections.push(`文档${index + 1}：${document.name}\n${content}`);
  });

  if (sections.length === 0) return prompt;
  return `${prompt || "请阅读我上传的文档，并告诉我可以怎么继续创作。"}\n\n已读取文档内容如下。请把这些内容作为当前上下文，不要假装没有读取：\n\n${sections.join("\n\n---\n\n")}`;
}

async function uploadWorkflowImage(file: File) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  const postResponse = await fetch("/api/asset-upload-temp", { method: "POST", body: formData });
  const postData = await readJson<{ token?: string; error?: string }>(postResponse);
  if (!postData.token) throw new Error(postData.error || "图片上传失败");
  const patchResponse = await fetch("/api/asset-upload-temp", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: postData.token }) });
  const patchData = await readJson<{ url?: string; error?: string }>(patchResponse);
  if (!patchData.url) throw new Error(patchData.error || "图片保存失败");
  return patchData.url;
}

async function uploadWorkflowFile(file: File, kind: Exclude<WorkflowUploadKind, "image">) {
  const dataUrl = await readWorkflowFileAsDataUrl(file);
  const response = await fetch("/api/upload-file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: dataUrl, name: file.name, mediaKind: kind }) });
  const data = await readJson<{ url?: string; error?: string }>(response);
  if (!data.url) throw new Error(data.error || "文件上传失败");
  return data.url;
}

function getWorkflowMentionNames(text: string) {
  return [...text.matchAll(/@([^@\s，。！？；;、]+)/g)].map((match) => match[1]);
}

function getWorkflowUploadReferenceName(upload: WorkflowUploadItem) {
  return sanitizeWorkflowReferenceName(upload.name);
}

function getWorkflowPromptReferenceUrls(prompt: string, node: WorkflowNode, referenceAssets: WorkflowReferenceAsset[], kind: "image" | "video" | "audio") {
  const names = new Set(getWorkflowMentionNames(prompt));
  const urls: string[] = [];
  referenceAssets.forEach((asset) => {
    if (kind === "image" && names.has(asset.name) && !urls.includes(asset.url)) urls.push(asset.url);
  });
  (node.data.uploads ?? []).forEach((upload) => {
    if (upload.status !== "ready" || !upload.url || upload.kind !== kind) return;
    if (!urls.includes(upload.url)) urls.push(upload.url);
  });
  return urls;
}

function getShapeId(nodeId: string) {
  return createShapeId(nodeId);
}

function getNodeIdFromShapeId(shapeId: string) {
  return shapeId.replace(/^shape:/, "");
}

function getNodeLabel(kind: WorkflowNodeKind) {
  if (kind === "text") return "文本输入";
  if (kind === "image") return "图片生成";
  return "视频生成";
}

function getNodeIcon(kind: WorkflowNodeKind) {
  if (kind === "text") return RiTextBlock;
  if (kind === "image") return RiImageAiLine;
  return RiFilmAiLine;
}

function getWorkflowNodeMediaName(node: WorkflowNode) {
  const imageUrl = node.data.images?.[0];
  if (imageUrl) return node.data.mediaSystemNames?.[imageUrl] ?? "图片生成";
  if (node.data.videoUrl) return node.data.mediaSystemNames?.[node.data.videoUrl] ?? "视频生成";
  return "";
}

function getWorkflowNodeParamParts(node: WorkflowNode) {
  const currentSize = getWorkflowNodeVisualSize(node);
  const sizeText = currentSize.w && currentSize.h ? `${Math.round(currentSize.w)}x${Math.round(currentSize.h)}` : "";
  const modelOptions = node.kind === "text" ? frontendConversationModels : node.kind === "image" ? frontendImageGenerationModels : workflowVideoModels;
  const modelLabel = node.data.model ? getModelLabel(modelOptions, node.data.model) : "";
  if (node.kind === "text") return { modelLabel: "", ratio: "", resolution: "", duration: "", sizeText };
  return { modelLabel, ratio: node.data.ratio ?? "", resolution: node.data.resolution ?? "", duration: node.kind === "video" ? node.data.duration ?? "" : "", sizeText };
}

function estimateParamTextWidth(text: string) {
  return text.length * 8.5;
}

function estimateTitleTextWidth(text: string) {
  return 16 + 6 + text.length * 8 + 8;
}

function buildWorkflowParamLabel(parts: ReturnType<typeof getWorkflowNodeParamParts>, maxWidth: number) {
  const candidates = [
    [parts.modelLabel, parts.ratio, parts.resolution, parts.duration, parts.sizeText],
    [parts.ratio, parts.resolution, parts.duration, parts.sizeText],
    [parts.resolution, parts.duration, parts.sizeText],
    [parts.sizeText],
  ];
  for (const candidate of candidates) {
    const label = candidate.filter(Boolean).join(" / ");
    if (label && estimateParamTextWidth(label) <= maxWidth) return label;
  }
  return maxWidth >= 52 ? parts.sizeText : "";
}

function hasWorkflowNodeResult(node: WorkflowNode) {
  return Boolean(node.data.images?.length || node.data.videoUrl);
}

function hasResizableGeneratedMedia(node: WorkflowNode) {
  return node.kind === "image" ? Boolean(node.data.images?.[0]) : node.kind === "video" ? Boolean(node.data.videoUrl) : false;
}

function getWorkflowNodeExpectedDimensions(node: WorkflowNode) {
  if (node.kind === "image") return getExpectedImageDimensions(node.data.model, node.data.resolution, imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio : "16:9");
  if (node.kind === "video") return getExpectedVideoDimensions(node.data.model, node.data.resolution, node.data.ratio);
  return { width: TEXT_NODE_WIDTH, height: TEXT_NODE_HEIGHT };
}

function getWorkflowNodeNaturalSize(node: WorkflowNode) {
  const imageUrl = node.data.images?.[0];
  if (node.kind === "image" && imageUrl) {
    const dimensions = node.data.imageDimensions?.[imageUrl];
    if (dimensions?.width && dimensions.height) return { width: dimensions.width, height: dimensions.height };
  }
  return getWorkflowNodeExpectedDimensions(node);
}

function getWorkflowResizeSizeLimits(node: WorkflowNode) {
  const natural = getWorkflowNodeNaturalSize(node);
  if (!natural.width || !natural.height) return undefined;
  const longEdge = Math.max(natural.width, natural.height);
  const minScale = Math.min(1, 256 / longEdge);
  return {
    minWidth: Math.max(1, Math.round(natural.width * minScale)),
    minHeight: Math.max(1, Math.round(natural.height * minScale)),
    maxWidth: Math.round(natural.width),
    maxHeight: Math.round(natural.height),
  };
}

function getClampedGeneratedVisualSize(node: WorkflowNode) {
  const visual = node.data.visualSize;
  if (!visual?.width || !visual.height || !hasResizableGeneratedMedia(node)) return undefined;
  const natural = getWorkflowNodeNaturalSize(node);
  if (!natural.width || !natural.height) return undefined;
  const minScale = Math.min(1, 256 / Math.max(natural.width, natural.height));
  const currentScale = Math.min(visual.width / natural.width, visual.height / natural.height);
  const scale = Math.max(minScale, Math.min(1, currentScale));
  return { w: Math.round(natural.width * scale), h: Math.round(natural.height * scale) };
}

function getWorkflowNodeVisualSize(node: WorkflowNode) {
  const clampedGeneratedSize = getClampedGeneratedVisualSize(node);
  if (clampedGeneratedSize) return clampedGeneratedSize;
  if (hasResizableGeneratedMedia(node)) {
    const natural = getWorkflowNodeNaturalSize(node);
    if (natural.width && natural.height) return { w: Math.round(natural.width), h: Math.round(natural.height) };
  }
  if (node.data.visualSize?.width && node.data.visualSize.height) return { w: Math.round(node.data.visualSize.width), h: Math.round(node.data.visualSize.height) };
  const dimensions = getWorkflowNodeExpectedDimensions(node);
  const width = Math.max(1, dimensions.width || NODE_WIDTH);
  const height = Math.max(1, dimensions.height || CARD_HEIGHT);
  return { w: Math.round(width), h: Math.round(height) };
}

function getCommonWorkflowRatioLabel(dimensions?: { width: number; height: number }) {
  if (!dimensions?.width || !dimensions.height) return undefined;
  const ratio = dimensions.width / dimensions.height;
  const matches = imageRatioOptions.map((label) => {
    const [width, height] = label.split(":").map(Number);
    return { label, value: width / height };
  });
  return matches.find((item) => Math.abs(ratio - item.value) / item.value < 0.025)?.label;
}

function normalizeWorkflowImageRatio(value: unknown, dimensions?: { width: number; height: number }) {
  if (typeof value === "string" && imageRatioOptions.includes(value)) return value;
  return getCommonWorkflowRatioLabel(dimensions) ?? "16:9";
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w + WORKFLOW_NODE_GAP && a.x + a.w + WORKFLOW_NODE_GAP > b.x && a.y < b.y + b.h + WORKFLOW_NODE_GAP && a.y + a.h + WORKFLOW_NODE_GAP > b.y;
}

function findNonOverlappingNodePosition(nodes: WorkflowNode[], size: { w: number; h: number }, anchor?: WorkflowNode, fallback?: { x: number; y: number }) {
  const occupied = nodes.map((node) => ({ x: node.x, y: node.y, ...getWorkflowNodeVisualSize(node) }));
  const anchorSize = anchor ? getWorkflowNodeVisualSize(anchor) : undefined;
  const base = anchor && anchorSize ? { x: anchor.x + anchorSize.w + WORKFLOW_NODE_GAP, y: anchor.y } : fallback ?? { x: 160, y: 120 };
  const candidates = anchor && anchorSize
    ? [
      base,
      { x: anchor.x, y: anchor.y + anchorSize.h + WORKFLOW_NODE_GAP },
      { x: anchor.x - size.w - WORKFLOW_NODE_GAP, y: anchor.y },
      { x: anchor.x, y: anchor.y - size.h - WORKFLOW_NODE_GAP },
    ]
    : [base];
  for (let ring = 0; ring < 12; ring += 1) {
    for (const candidate of candidates) {
      const shifted = { x: candidate.x + ring * WORKFLOW_NODE_GAP, y: candidate.y + ring * WORKFLOW_NODE_GAP, ...size };
      if (!occupied.some((rect) => rectsOverlap(shifted, rect))) return { x: shifted.x, y: shifted.y };
    }
  }
  return base;
}

function focusWorkflowNodeInViewport(editor: Editor, node: WorkflowNode) {
  const size = getWorkflowNodeVisualSize(node);
  const screen = editor.getViewportScreenBounds();
  const zoom = Math.min(screen.w * 0.7 / size.w, screen.h * 0.7 / size.h);
  editor.zoomToBounds({ x: node.x, y: node.y, w: size.w, h: size.h }, { targetZoom: zoom, inset: 0, animation: { duration: 180 } });
}

function zoomToWorkflowNodes(editor: Editor, nodes: WorkflowNode[]) {
  const shapes = editor.getCurrentPageShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
  const shapeBounds = shapes.map((shape) => editor.getShapePageBounds(shape)).filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds));
  const rects = shapeBounds.length > 0
    ? shapeBounds.map((bounds) => ({ x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }))
    : nodes.map((node) => ({ x: node.x, y: node.y, ...getWorkflowNodeVisualSize(node) }));
  if (rects.length === 0) return;
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.h));
  const bounds = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
  editor.zoomToBounds(bounds, { inset: 96, animation: { duration: 180 } });
}

function zoomToSelectedOrWorkflowNodes(editor: Editor, nodes: WorkflowNode[]) {
  const selectedShapeIds = editor.getSelectedShapeIds();
  const selectedBounds = selectedShapeIds
    .map((shapeId) => editor.getShape(shapeId))
    .filter((shape): shape is WorkflowNodeShape => shape?.type === "workflow_node")
    .map((shape) => editor.getShapePageBounds(shape))
    .filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds));
  if (selectedBounds.length > 0) {
    const minX = Math.min(...selectedBounds.map((bounds) => bounds.x));
    const minY = Math.min(...selectedBounds.map((bounds) => bounds.y));
    const maxX = Math.max(...selectedBounds.map((bounds) => bounds.x + bounds.w));
    const maxY = Math.max(...selectedBounds.map((bounds) => bounds.y + bounds.h));
    editor.zoomToBounds({ x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }, { inset: 96, animation: { duration: 180 } });
    return;
  }
  zoomToWorkflowNodes(editor, nodes);
}

function getDefaultNodeData(kind: WorkflowNodeKind): WorkflowNodeData {
  if (kind === "text") return { text: "", prompt: "" };
  if (kind === "video") {
    const resolution = normalizeVideoResolutionForModel(DEFAULT_WORKFLOW_VIDEO_MODEL, "720p");
    return { model: DEFAULT_WORKFLOW_VIDEO_MODEL, ratio: normalizeVideoRatioForModel(DEFAULT_WORKFLOW_VIDEO_MODEL, "16:9", resolution), resolution, duration: "8秒", prompt: "" };
  }
  const defaultImageModel = frontendImageGenerationModels.some((model) => model.id === DEFAULT_WORKFLOW_IMAGE_MODEL) ? DEFAULT_WORKFLOW_IMAGE_MODEL : frontendImageGenerationModels[0]?.id ?? DEFAULT_IMAGE_MODEL;
  const resolution = normalizeImageResolutionForModel(defaultImageModel, "2K");
  return { model: defaultImageModel, ratio: "16:9", resolution, prompt: "" };
}

function normalizeState(value?: WorkflowCanvasState): WorkflowCanvasState {
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return DEFAULT_STATE;
  const nodes = value.nodes
    .filter((node) => node && typeof node.id === "string" && (node.kind === "text" || node.kind === "image" || node.kind === "video"))
    .map((node) => {
      const data = { ...getDefaultNodeData(node.kind), ...(node.data && typeof node.data === "object" ? node.data : {}) };
      if (node.kind === "image") {
        const imageUrl = Array.isArray(data.images) ? data.images[0] : undefined;
        data.ratio = normalizeWorkflowImageRatio(data.ratio, imageUrl ? data.imageDimensions?.[imageUrl] : undefined);
      }
      return {
        ...node,
        title: node.kind === "text" && (node.title === "文本生成" || node.title === "文本") ? "文本输入" : typeof node.title === "string" && node.title.trim() ? node.title : getNodeLabel(node.kind),
        x: Number.isFinite(node.x) ? node.x : 160,
        y: Number.isFinite(node.y) ? node.y : 120,
        data,
      };
    });
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = value.edges.filter((edge) => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const viewport = value.viewport && typeof value.viewport === "object"
    ? { x: Number.isFinite(value.viewport.x) ? value.viewport.x : 0, y: Number.isFinite(value.viewport.y) ? value.viewport.y : 0, zoom: Number.isFinite(value.viewport.zoom) ? value.viewport.zoom : 1 }
    : undefined;
  const historicalTextNodes = Array.isArray(value.historicalTextNodes)
    ? value.historicalTextNodes.filter((node) => node?.kind === "text" && getWorkflowTextNodeContent(node).trim()).map((node) => ({
      ...node,
      title: node.title || getNodeLabel("text"),
      x: Number.isFinite(node.x) ? node.x : 160,
      y: Number.isFinite(node.y) ? node.y : 120,
      data: { ...getDefaultNodeData("text"), ...(node.data && typeof node.data === "object" ? node.data : {}) },
    }))
    : undefined;
  return { nodes, edges, viewport, historicalTextNodes };
}

function getWorkflowTextNodeContent(node: WorkflowNode) {
  return node.kind === "text" ? node.data.text ?? node.data.prompt ?? node.data.outputText ?? "" : "";
}

function addHistoricalTextNodes(state: WorkflowCanvasState, nodes: WorkflowNode[]) {
  const additions = nodes.filter((node) => node.kind === "text" && getWorkflowTextNodeContent(node).trim());
  if (additions.length === 0) return state;
  const existing = state.historicalTextNodes ?? [];
  const existingIds = new Set(existing.map((node) => node.id));
  const nextHistorical = [...additions.filter((node) => !existingIds.has(node.id)), ...existing].slice(0, 80);
  return { ...state, historicalTextNodes: nextHistorical };
}

function stateKey(value: WorkflowCanvasState) {
  return JSON.stringify(value);
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw data;
  return data as T;
}

function getVideoUrlFromResponse(data: VideoApiResponse) {
  const content = data.content && typeof data.content === "object" ? data.content as Record<string, unknown> : undefined;
  const direct = typeof data.videoUrl === "string" ? data.videoUrl : undefined;
  const contentUrl = typeof content?.video_url === "string" ? content.video_url : undefined;
  return direct || contentUrl || "";
}

function getPosterUrlFromResponse(data: VideoApiResponse) {
  const content = data.content && typeof data.content === "object" ? data.content as Record<string, unknown> : undefined;
  return typeof content?.poster_url === "string" ? content.poster_url : undefined;
}

function isVideoDoneStatus(status: unknown) {
  return status === "succeeded" || status === "success" || status === "completed" || status === "complete";
}

function getVideoTaskId(data: VideoApiResponse) {
  return data.id || data.job_id || data.polling_url || data.pollingUrl || "";
}

function getVideoWaitProgress(startedAt?: number, index = 0) {
  const start = startedAt ?? Date.now();
  const elapsedSeconds = Math.max(0, (Date.now() - start) / 1000);
  const stableOffset = index > 0 ? ((index * 7 + Math.abs(Math.floor(start / 1000))) % 7) - 3 : 0;
  const applyOffset = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value + stableOffset));
  if (elapsedSeconds <= 30) return applyOffset(Math.round(1 + (elapsedSeconds / 30) * 44), 1, 45);
  if (elapsedSeconds <= 90) return applyOffset(Math.round(45 + ((elapsedSeconds - 30) / 60) * 30), 43, 78);
  if (elapsedSeconds <= 180) return applyOffset(Math.round(75 + ((elapsedSeconds - 90) / 90) * 20), 73, 98);
  return 95 + ((Math.abs(Math.floor(start / 1000)) + index * 3) % 5);
}

function formatDimensionValue(value: number) {
  return value > 0 ? String(value) : "未知";
}

function closeWorkflowPopups() {
  window.dispatchEvent(new Event("workflow-close-popups"));
}

function formatElapsedTime(startedAt?: number) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - (startedAt ?? Date.now())) / 1000));
  return `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
}

function getStaticMediaUrl(url: string | undefined) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return url;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

async function getWorkflowExportImageSrc(url: string | undefined) {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) return undefined;
  return blobToDataUrl(await response.blob());
}

function getWorkflowDownloadFileName(node: WorkflowNode) {
  if (node.kind === "text") return `${node.title || "文本输入"}.txt`;
  const imageUrl = node.data.images?.[0];
  if (node.kind === "image" && imageUrl) return `${node.data.mediaSystemNames?.[imageUrl] ?? "workflow-image"}.${getUrlExtension(imageUrl, "jpg")}`;
  if (node.kind === "video" && node.data.videoUrl) return `${node.data.mediaSystemNames?.[node.data.videoUrl] ?? "workflow-video"}.${getUrlExtension(node.data.videoUrl, "mp4")}`;
  return "workflow-node.txt";
}

function getUrlExtension(url: string, fallback: string) {
  const path = url.split("?")[0].split("#")[0];
  const extension = path.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  return extension || fallback;
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function downloadWorkflowNode(node: WorkflowNode) {
  if (node.kind === "text") {
    const text = node.data.text ?? node.data.prompt ?? node.data.outputText ?? "";
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), getWorkflowDownloadFileName(node));
    return;
  }

  const url = node.kind === "image" ? node.data.images?.[0] : node.data.videoUrl;
  if (!url) return;
  const response = await fetch(url);
  if (!response.ok) throw new Error("下载失败");
  downloadBlob(await response.blob(), getWorkflowDownloadFileName(node));
}

const workflowTldrawComponents: TLComponents = { ContextMenu: null };
const workflowTldrawOptions = { maxPages: 1, rightClickPanning: false } satisfies Partial<TldrawOptions>;
const workflowTldrawOverrides: TLUiOverrides = {
  translations: { en: { "action.workflow-download-node": "下载" }, zh: { "action.workflow-download-node": "下载" }, "zh-cn": { "action.workflow-download-node": "下载" }, "zh-CN": { "action.workflow-download-node": "下载" } },
  actions(editor, actions) {
    const { ["flatten-to-image"]: _flattenToImage, ...workflowSafeActions } = actions;
    return {
      ...workflowSafeActions,
      "workflow-download-node": {
        id: "workflow-download-node",
        label: "action.workflow-download-node",
        icon: "download",
        onSelect() {
          const selectedWorkflowNodes = editor.getSelectedShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node").map((shape) => shape.props.node);
          const node = selectedWorkflowNodes.length === 1 ? selectedWorkflowNodes[0] : undefined;
          if (!node) return;
          void downloadWorkflowNode(node).catch((error) => console.warn("[workflow] download failed", error));
        },
      },
    };
  },
};

function getWorkflowVideoFrameDataUrl(url: string, timeSeconds: number) {
  return new Promise<string | undefined>((resolve) => {
    const video = document.createElement("video");
    let settled = false;
    const settle = (value?: string) => {
      if (settled) return;
      settled = true;
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    const timeout = window.setTimeout(() => settle(undefined), 10_000);
    const cleanupSettle = (value?: string) => {
      window.clearTimeout(timeout);
      settle(value);
    };
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("error", () => cleanupSettle(undefined), { once: true });
    video.addEventListener("loadedmetadata", () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const targetTime = Math.max(0, Math.min(timeSeconds, Math.max(0, duration - 0.04)));
      video.currentTime = targetTime;
    }, { once: true });
    video.addEventListener("seeked", () => {
      try {
        const width = video.videoWidth || 1;
        const height = video.videoHeight || 1;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) return cleanupSettle(undefined);
        context.drawImage(video, 0, 0, width, height);
        cleanupSettle(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        cleanupSettle(undefined);
      }
    }, { once: true });
    video.src = url;
  });
}

function getWorkflowSvgTextLines(text: string, maxCharsPerLine: number, maxLines: number) {
  const lines: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine;
    if (!line) {
      lines.push("");
      continue;
    }
    while (line.length > maxCharsPerLine) {
      lines.push(line.slice(0, maxCharsPerLine));
      line = line.slice(maxCharsPerLine);
      if (lines.length >= maxLines) return lines;
    }
    lines.push(line);
    if (lines.length >= maxLines) return lines;
  }
  return lines;
}

type WorkflowRuntime = {
  selectedNodeId: string;
  connectingFrom: string;
  modelOptions: WorkflowModelOptions;
  workflowTitle: string;
  updateNode: (nodeId: string, patch: Partial<WorkflowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  connectTo: (nodeId: string) => void;
  setConnectingFrom: (nodeId: string) => void;
  runImageNode: (node: WorkflowNode) => void;
  runVideoNode: (node: WorkflowNode) => void;
  onGeneratedMedia?: WorkflowCanvasProps["onGeneratedMedia"];
  markNodeAction: (nodeId: string) => void;
  onPreviewMedia?: WorkflowCanvasProps["onPreviewMedia"];
  getImageDisplayUrl?: (url: string) => string;
  getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined;
  referenceAssets: WorkflowReferenceAsset[];
  referenceAssetsLoadStatus: "idle" | "loading" | "loaded" | "failed";
  onLoadReferenceAssets?: () => void;
};

const WorkflowRuntimeContext = createContext<WorkflowRuntime | null>(null);

function useWorkflowRuntime() {
  const context = useContext(WorkflowRuntimeContext);
  if (!context) throw new Error("Workflow runtime is missing");
  return context;
}

class WorkflowNodeShapeUtil extends BaseBoxShapeUtil<WorkflowNodeShape> {
  static override type = "workflow_node";
  static override props = { w: T.number, h: T.number, node: T.any };

  override canResize(shape: WorkflowNodeShape) { return shape.props.node.kind === "text" || hasResizableGeneratedMedia(shape.props.node); }
  override canEdit(shape: WorkflowNodeShape) { return shape.props.node.kind === "text"; }
  override canScroll(shape: WorkflowNodeShape) { return shape.props.node.kind === "text"; }
  override canBind() { return false; }
  override hideRotateHandle() { return true; }
  override isAspectRatioLocked(shape: WorkflowNodeShape) { return shape.props.node.kind !== "text"; }

  getDefaultProps(): WorkflowNodeShape["props"] {
    return { w: NODE_WIDTH, h: NODE_HEIGHT, node: { id: "", kind: "text", title: "文本输入", x: 0, y: 0, data: getDefaultNodeData("text") } };
  }

  override getGeometry(shape: WorkflowNodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  component(shape: WorkflowNodeShape) {
    return <WorkflowShapeComponent shape={shape} />;
  }

  override onEditStart(shape: WorkflowNodeShape) {
    if (shape.props.node.kind !== "text") return;
    focusWorkflowNodeInViewport(this.editor, { ...shape.props.node, x: shape.x, y: shape.y });
  }

  override getIndicatorPath(shape: WorkflowNodeShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }

  override async toSvg(shape: WorkflowNodeShape): Promise<ReactElement | null> {
    const node = shape.props.node;
    const width = shape.props.w;
    const height = shape.props.h;

    if (node.kind === "text") {
      const padding = 24;
      const lineHeight = 28;
      const text = node.data.text ?? node.data.prompt ?? node.data.outputText ?? "";
      const maxCharsPerLine = Math.max(8, Math.floor((width - padding * 2) / 8.5));
      const maxLines = Math.max(1, Math.floor((height - padding * 2) / lineHeight));
      const lines = getWorkflowSvgTextLines(text || "大段提示词或者剧本可以输入到这里...", maxCharsPerLine, maxLines);
      const isPlaceholder = !text.trim();
      return (
        <g>
          <rect width={width} height={height} rx={20} fill="#ffffff" stroke="#b8b8b8" strokeWidth={5} />
          <text x={padding} y={padding + 18} fill={isPlaceholder ? "#a6a6a6" : "#222222"} fontFamily="Arial, Helvetica, sans-serif" fontSize={16}>
            {lines.map((line, index) => <tspan key={index} x={padding} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>)}
          </text>
        </g>
      );
    }

    if (node.kind === "image") {
      const url = await getWorkflowExportImageSrc(getStaticMediaUrl(node.data.images?.[0]));
      if (!url) return <rect width={width} height={height} fill="#e6e6e6" />;
      return <image href={url} width={width} height={height} preserveAspectRatio="xMidYMid slice" />;
    }

    const videoUrl = getStaticMediaUrl(node.data.videoUrl);
    const frameUrl = videoUrl?.startsWith("/generated/") ? await getWorkflowVideoFrameDataUrl(videoUrl, node.data.videoCurrentTime ?? 0) : undefined;
    if (frameUrl) return <image href={frameUrl} width={width} height={height} preserveAspectRatio="xMidYMid slice" />;
    const posterUrl = await getWorkflowExportImageSrc(getStaticMediaUrl(node.data.posterUrl));
    if (posterUrl) return <image href={posterUrl} width={width} height={height} preserveAspectRatio="xMidYMid slice" />;
    return (
      <g>
        <rect width={width} height={height} fill="#20242a" />
        <circle cx={width / 2} cy={height / 2} r={Math.max(18, Math.min(width, height) * 0.08)} fill="rgba(255,255,255,0.86)" />
        <path d={`M ${width / 2 - 8} ${height / 2 - 13} L ${width / 2 - 8} ${height / 2 + 13} L ${width / 2 + 14} ${height / 2} Z`} fill="#20242a" />
      </g>
    );
  }

  override onResize(shape: WorkflowNodeShape, info: TLResizeInfo<WorkflowNodeShape>) {
    const node = shape.props.node;
    const resized = node.kind === "text"
      ? resizeBox(shape, info, { minWidth: 240, minHeight: 180 })
      : resizeBox(shape, info, getWorkflowResizeSizeLimits(node));
    return {
      x: resized.x,
      y: resized.y,
      props: {
        ...resized.props,
        node: {
          ...shape.props.node,
          x: resized.x,
          y: resized.y,
          data: { ...shape.props.node.data, visualSize: { width: resized.props.w, height: resized.props.h } },
        },
      },
    };
  }
}

function WorkflowShapeComponent({ shape }: { shape: WorkflowNodeShape }) {
  const runtime = useWorkflowRuntime();
  const editor = useEditor();
  const node = shape.props.node;
  const isSelected = useValue(`workflow-selected-${shape.id}`, () => editor.getSelectedShapeIds().includes(shape.id), [editor, shape.id]);
  const isEditing = useValue(`workflow-editing-${shape.id}`, () => editor.getEditingShapeId() === shape.id, [editor, shape.id]);
  const sourcePrompt = node.data.prompt?.trim() || node.data.text?.trim() || node.data.outputText?.trim() || runtime.workflowTitle;
  const imageUrl = node.data.images?.[0];
  const imageDisplayUrl = imageUrl ? getStaticMediaUrl(imageUrl) ?? imageUrl : undefined;
  const videoPosterDisplayUrl = node.data.videoUrl ? runtime.getVideoPosterDisplayUrl?.(node.data.videoUrl, node.data.posterUrl) : undefined;
  const imageMediaName = imageUrl ? node.data.mediaSystemNames?.[imageUrl] ?? "图片生成" : "图片生成";
  const videoMediaName = node.data.videoUrl ? node.data.mediaSystemNames?.[node.data.videoUrl] ?? "视频生成" : "视频生成";

  return (
    <HTMLContainer className="workflow-node-html overflow-visible" style={{ pointerEvents: "all" }}>
      <div data-workflow-node-id={node.id} className="workflow-node relative overflow-visible text-[#111111]" style={{ width: shape.props.w, height: shape.props.h }} onPointerDown={() => runtime.markNodeAction(node.id)} onDoubleClick={(event) => event.stopPropagation()}>
        {node.kind === "text" ? <TextDisplayCard node={node} selected={isSelected} height={shape.props.h} isEditing={isEditing} /> : null}
        {node.kind === "image" ? <ImageDisplayCard node={node} selected={isSelected} displayUrl={imageDisplayUrl} height={shape.props.h} /> : null}
        {node.kind === "video" ? <VideoDisplayCard node={node} selected={isSelected} height={shape.props.h} onSelect={() => editor.select(shape.id)} /> : null}
      </div>
    </HTMLContainer>
  );
}

function WorkflowSelectedNodeOverlay() {
  const runtime = useWorkflowRuntime();
  const editor = useEditor();
  const selected = useValue("workflow-selected-node-overlay", () => {
    const selectedShapeId = editor.getOnlySelectedShapeId();
    if (!selectedShapeId) return undefined;
    const shape = editor.getShape(selectedShapeId) as WorkflowNodeShape | undefined;
    if (!shape || shape.type !== "workflow_node") return undefined;
    const point = editor.pageToViewport({ x: shape.x, y: shape.y });
    return { shape, point, zoom: editor.getCamera().z };
  }, [editor]);

  if (!selected) return null;
  const { shape, point, zoom } = selected;
  const node = shape.props.node;
  const Icon = getNodeIcon(node.kind);
  const mediaName = getWorkflowNodeMediaName(node);
  const title = node.kind === "text" ? "文本输入（双击进入编辑模式）" : [getNodeLabel(node.kind), mediaName].filter(Boolean).join(" ");
  const paramParts = getWorkflowNodeParamParts(node);
  const showEditor = node.kind !== "text" && !hasWorkflowNodeResult(node) && !node.data.isRunning;
  const screenNodeWidth = shape.props.w * zoom;
  const screenNodeHeight = shape.props.h * zoom;
  const maxParamWidth = Math.max(0, screenNodeWidth - estimateTitleTextWidth(title));
  const sizeLabel = buildWorkflowParamLabel(paramParts, maxParamWidth);
  const paramWidth = sizeLabel ? Math.min(maxParamWidth, estimateParamTextWidth(sizeLabel) + 2) : 0;
  const inputLeft = point.x + screenNodeWidth / 2;
  const inputTop = point.y + screenNodeHeight + 8;
  const stopCanvasPointer = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <>
      <div className="pointer-events-none absolute z-30 h-[18px] overflow-visible text-[#367cee]" style={{ left: point.x, top: point.y - 18, width: screenNodeWidth, maxWidth: screenNodeWidth }}>
        <div className="absolute left-0 top-0 flex h-[18px] min-w-0 items-center gap-1.5 overflow-hidden" style={{ right: sizeLabel ? paramWidth + 8 : 0 }}>
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate text-[13px] font-semibold leading-[18px]">{title}</span>
        </div>
        {sizeLabel ? <div className="absolute right-0 top-0 h-[18px] truncate text-right text-[12px] font-medium leading-[18px] text-[#367cee]" style={{ width: paramWidth, maxWidth: paramWidth }}>{sizeLabel}</div> : null}
      </div>
      {showEditor ? (
        <div
          className="pointer-events-auto absolute z-[9999] w-[680px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-[26px] border-0 bg-transparent px-0 py-0"
          style={{ left: inputLeft, top: inputTop }}
          onPointerDownCapture={stopCanvasPointer}
          onMouseDownCapture={stopCanvasPointer}
          onClick={stopCanvasPointer}
          onWheel={stopCanvasPointer}
        >
          {node.kind === "image" ? <ImageNodeEditor node={node} modelOptions={runtime.modelOptions} onChange={runtime.updateNode} onRun={() => runtime.runImageNode(node)} /> : null}
          {node.kind === "video" ? <VideoNodeEditor node={node} modelOptions={runtime.modelOptions} onChange={runtime.updateNode} onRun={() => runtime.runVideoNode(node)} /> : null}
        </div>
      ) : null}
    </>
  );
}

type WorkflowContextMenuState = { x: number; y: number } | null;

function WorkflowCustomContextMenu({ menu, onClose }: { menu: WorkflowContextMenuState; onClose: () => void }) {
  const editor = useEditor();
  const actions = useActions();
  const selectedShapeIds = useValue("workflow-context-menu-selected", () => editor.getSelectedShapeIds(), [editor]);
  const hasSelection = selectedShapeIds.length > 0;
  const hasShapes = useValue("workflow-context-menu-has-shapes", () => editor.getCurrentPageShapes().length > 0, [editor]);

  if (!menu) return null;

  const runAction = (actionId: string) => {
    const action = actions[actionId];
    if (!action) return;
    void action.onSelect("context-menu");
    onClose();
  };
  const runDownload = () => {
    const selectedWorkflowNodes = editor.getSelectedShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node").map((shape) => shape.props.node);
    const node = selectedWorkflowNodes.length === 1 ? selectedWorkflowNodes[0] : undefined;
    if (node) void downloadWorkflowNode(node).catch((error) => console.warn("[workflow] download failed", error));
    onClose();
  };
  const runDelete = () => {
    editor.markHistoryStoppingPoint("delete workflow context menu");
    editor.deleteShapes(selectedShapeIds);
    onClose();
  };
  const runSelectAll = () => {
    editor.select(...editor.getCurrentPageShapes().map((shape) => shape.id));
    onClose();
  };

  const itemClassName = "flex h-8 w-full items-center justify-between rounded-[6px] px-2 text-left text-[13px] text-[#222222] transition hover:bg-[#f3f3f3] disabled:cursor-not-allowed disabled:text-[#b8b8b8] disabled:hover:bg-transparent";
  const separator = <div className="my-1 h-px bg-[#eeeeee]" />;

  return (
    <div data-workflow-context-menu className="pointer-events-auto absolute z-[10000] w-[180px] rounded-[10px] border border-[#e8e8e8] bg-white p-1.5 text-[#222222] shadow-[0_12px_32px_rgba(0,0,0,0.16)]" style={{ left: menu.x, top: menu.y }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("cut")} className={itemClassName}><span>剪切</span><span className="text-[11px] text-[#999999]">Ctrl X</span></button>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("copy")} className={itemClassName}><span>复制</span><span className="text-[11px] text-[#999999]">Ctrl C</span></button>
      <button type="button" onClick={() => runAction("paste")} className={itemClassName}><span>粘贴</span><span className="text-[11px] text-[#999999]">Ctrl V</span></button>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("duplicate")} className={itemClassName}><span>复制副本</span><span className="text-[11px] text-[#999999]">Ctrl D</span></button>
      <button type="button" disabled={!hasSelection} onClick={runDelete} className={itemClassName}><span>删除</span><span className="text-[11px] text-[#999999]">Del</span></button>
      {separator}
      <button type="button" disabled={!hasSelection} onClick={() => runAction("bring-to-front")} className={itemClassName}>置于顶层</button>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("bring-forward")} className={itemClassName}>上移一层</button>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("send-backward")} className={itemClassName}>下移一层</button>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("send-to-back")} className={itemClassName}>置于底层</button>
      {separator}
      <button type="button" disabled={!hasSelection} onClick={() => runAction("copy-as-svg")} className={itemClassName}>复制为 SVG</button>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("copy-as-png")} className={itemClassName}>复制为 PNG</button>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("export-as-svg")} className={itemClassName}>导出 SVG</button>
      <button type="button" disabled={!hasSelection} onClick={() => runAction("export-as-png")} className={itemClassName}>导出 PNG</button>
      <button type="button" disabled={!hasSelection} onClick={runDownload} className={itemClassName}>下载</button>
      {separator}
      <button type="button" disabled={!hasShapes} onClick={runSelectAll} className={itemClassName}><span>全选</span><span className="text-[11px] text-[#999999]">Ctrl A</span></button>
    </div>
  );
}

export function WorkflowCanvas({ workflowId, value, onChange, workflowTitle, onCredit, onGeneratedMedia, onPreviewMedia, getImageDisplayUrl, getVideoPosterDisplayUrl, enabledTextModelIds, textModelProviders = {}, enabledImageModelIds, enabledVideoModelIds, leftSidebarVisible = true, onToggleLeftSidebar, workflowAssets = [], referenceAssets = [], referenceAssetsLoadStatus = "idle", onLoadReferenceAssets }: WorkflowCanvasProps) {
  const editorRef = useRef<Editor | null>(null);
  const stateRef = useRef(normalizeState(value));
  const loadedWorkflowIdRef = useRef(workflowId);
  const lastExternalKeyRef = useRef(stateKey(stateRef.current));
  const lastEmittedKeyRef = useRef("");
  const loadingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const geometryPollRef = useRef<number | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const selectedNodeIdRef = useRef("");
  const activeCanvasToolRef = useRef<"select" | "hand">("select");
  const recentActionNodeIdsRef = useRef<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [connectingFrom, setConnectingFrom] = useState("");
  const [activeCanvasTool, setActiveCanvasToolState] = useState<"select" | "hand">("select");
  const [editorTick, setEditorTick] = useState(0);
  const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
  const [canvasBackground, setCanvasBackground] = useState("#cccccc");
  const [contextMenu, setContextMenu] = useState<WorkflowContextMenuState>(null);

  const textModels = useMemo(() => {
    const modelById = new Map(frontendConversationModels.map((model) => [model.id, model]));
    const filtered = enabledTextModelIds && enabledTextModelIds.length > 0 ? enabledTextModelIds.map((id) => modelById.get(id)).filter((model): model is ConversationModel => Boolean(model)) : frontendConversationModels;
    return filtered.length > 0 ? filtered : frontendConversationModels;
  }, [enabledTextModelIds]);
  const imageModels = useMemo(() => {
    const enabled = enabledImageModelIds && enabledImageModelIds.length > 0 ? new Set(enabledImageModelIds) : undefined;
    const filtered = enabled ? frontendImageGenerationModels.filter((model) => enabled.has(model.id)) : frontendImageGenerationModels;
    return filtered.length > 0 ? filtered : frontendImageGenerationModels;
  }, [enabledImageModelIds]);
  const videoModels = useMemo(() => {
    const enabled = enabledVideoModelIds && enabledVideoModelIds.length > 0 ? new Set(enabledVideoModelIds) : undefined;
    const filtered = enabled ? workflowVideoModels.filter((model) => enabled.has(model.id)) : workflowVideoModels;
    return filtered.length > 0 ? filtered : workflowVideoModels;
  }, [enabledVideoModelIds]);
  const modelOptions = useMemo<WorkflowModelOptions>(() => ({ textModels, textModelProviders, imageModels, videoModels }), [imageModels, textModelProviders, textModels, videoModels]);

  const hasMentionedWorkflowPrompt = useMemo(() => normalizeState(value).nodes.some((node) => (node.data.prompt ?? node.data.text ?? "").includes("@")), [value]);

  useEffect(() => {
    if (!hasMentionedWorkflowPrompt) return;
    if (referenceAssetsLoadStatus === "loaded" || referenceAssetsLoadStatus === "loading") return;
    onLoadReferenceAssets?.();
  }, [hasMentionedWorkflowPrompt, onLoadReferenceAssets, referenceAssetsLoadStatus]);

  const exportStateFromEditor = useCallback((editor: Editor): WorkflowCanvasState => {
    const shapes = editor.getCurrentPageShapesSorted().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
    const nodes = shapes.map((shape) => ({ ...shape.props.node, x: shape.x, y: shape.y }));
    const nodeIds = new Set(nodes.map((node) => node.id));
    const current = stateRef.current;
    const missingNodes = current.nodes.filter((node) => !nodeIds.has(node.id));
    const withHistoricalText = addHistoricalTextNodes(current, missingNodes);
    const camera = editor.getCamera();
    return {
      nodes,
      edges: current.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
      viewport: { x: camera.x, y: camera.y, zoom: camera.z },
      historicalTextNodes: withHistoricalText.historicalTextNodes,
    };
  }, []);

  const normalizeWorkflowShapesForTldrawActions = useCallback((editor: Editor) => {
    const shapes = editor.getCurrentPageShapesSorted().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
    const updates: WorkflowNodeShape[] = [];
    for (const shape of shapes) {
      const nodeId = getNodeIdFromShapeId(String(shape.id));
      if (shape.props.node.id === nodeId && shape.props.node.x === shape.x && shape.props.node.y === shape.y) continue;
      updates.push({
        ...shape,
        props: {
          ...shape.props,
          node: { ...shape.props.node, id: nodeId, x: shape.x, y: shape.y },
        },
      });
    }
    if (updates.length > 0) editor.updateShapes(updates);
  }, []);

  const emitEditorState = useCallback((editor: Editor) => {
    const next = exportStateFromEditor(editor);
    const key = stateKey(next);
    if (key === lastEmittedKeyRef.current || key === lastExternalKeyRef.current) return;
    stateRef.current = next;
    lastEmittedKeyRef.current = key;
    lastExternalKeyRef.current = key;
    onChange(next);
    setEditorTick((tick) => tick + 1);
  }, [exportStateFromEditor, onChange]);

  const scheduleEmit = useCallback(() => {
    if (loadingRef.current || !editorRef.current) return;
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const editor = editorRef.current;
      if (!editor || loadingRef.current) return;
      const selected = editor.getOnlySelectedShapeId();
      const nextSelectedNodeId = selected ? getNodeIdFromShapeId(String(selected)) : "";
      if (nextSelectedNodeId !== selectedNodeIdRef.current) {
        selectedNodeIdRef.current = nextSelectedNodeId;
        setSelectedNodeId(nextSelectedNodeId);
      }
      normalizeWorkflowShapesForTldrawActions(editor);
      emitEditorState(editor);
    });
  }, [emitEditorState, normalizeWorkflowShapesForTldrawActions]);

  const syncNodeGeometryFromEditor = useCallback((editor: Editor) => {
    if (loadingRef.current) return;
    const shapes = editor.getCurrentPageShapes().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node");
    if (shapes.length === 0) return;
    const geometryByNodeId = new Map(shapes.map((shape) => [shape.props.node.id, { x: shape.x, y: shape.y, w: shape.props.w, h: shape.props.h }]));
    let changed = false;
    const nextNodes = stateRef.current.nodes.map((node) => {
      const geometry = geometryByNodeId.get(node.id);
      if (!geometry) return node;
      const currentSize = getWorkflowNodeVisualSize(node);
      const shouldPersistVisualSize = node.kind === "text" || hasResizableGeneratedMedia(node);
      const nextVisualSize = shouldPersistVisualSize ? { width: geometry.w, height: geometry.h } : node.data.visualSize;
      const sizeChanged = shouldPersistVisualSize && (Math.round(currentSize.w) !== Math.round(geometry.w) || Math.round(currentSize.h) !== Math.round(geometry.h));
      const positionChanged = Math.round(node.x) !== Math.round(geometry.x) || Math.round(node.y) !== Math.round(geometry.y);
      if (!positionChanged && !sizeChanged) return node;
      changed = true;
      return { ...node, x: geometry.x, y: geometry.y, data: nextVisualSize ? { ...node.data, visualSize: nextVisualSize } : node.data };
    });
    if (!changed) return;
    const next = { ...stateRef.current, nodes: nextNodes };
    stateRef.current = next;
    lastEmittedKeyRef.current = stateKey(next);
    lastExternalKeyRef.current = lastEmittedKeyRef.current;
    onChange(next);
  }, [onChange]);

  const loadStateIntoEditor = useCallback((editor: Editor, nextState: WorkflowCanvasState) => {
    loadingRef.current = true;
    const existing = editor.getCurrentPageShapes().filter((shape) => shape.type === "workflow_node").map((shape) => shape.id);
    if (existing.length > 0) editor.deleteShapes(existing);
    if (nextState.nodes.length > 0) {
      editor.createShapes(nextState.nodes.map((node) => ({ id: getShapeId(node.id), type: "workflow_node", x: node.x, y: node.y, props: { ...getWorkflowNodeVisualSize(node), node } })) as never);
    }
    stateRef.current = nextState;
    loadingRef.current = false;
    selectedNodeIdRef.current = "";
    setSelectedNodeId("");
    setConnectingFrom("");
    setEditorTick((tick) => tick + 1);
    if (nextState.nodes.length > 0) window.requestAnimationFrame(() => zoomToWorkflowNodes(editor, nextState.nodes));
  }, []);

  const handleMount = useCallback((editor: Editor) => {
    unlistenRef.current?.();
    editorRef.current = editor;
    editor.user.updateUserPreferences({ isSnapMode: true });
    editor.setCameraOptions({ zoomSteps: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8] });
    loadedWorkflowIdRef.current = workflowId;
    loadStateIntoEditor(editor, stateRef.current);
    const syncAfterTldrawAction = () => {
      if (loadingRef.current) return;
      scheduleEmit();
    };
    const unlistenCreate = editor.sideEffects.registerAfterCreateHandler("shape", (shape) => {
      if (shape.type !== "workflow_node") return;
      syncAfterTldrawAction();
    });
    const unlistenChange = editor.sideEffects.registerAfterChangeHandler("shape", (prevShape, nextShape) => {
      if (prevShape.type !== "workflow_node" && nextShape.type !== "workflow_node") return;
      syncAfterTldrawAction();
    });
    const unlistenDelete = editor.sideEffects.registerAfterDeleteHandler("shape", (shape) => {
      if (shape.type !== "workflow_node") return;
      stateRef.current = addHistoricalTextNodes(stateRef.current, [(shape as WorkflowNodeShape).props.node]);
      syncAfterTldrawAction();
    });
    unlistenRef.current = () => {
      unlistenCreate();
      unlistenChange();
      unlistenDelete();
    };
  }, [loadStateIntoEditor, scheduleEmit, workflowId]);

  useEffect(() => {
    const next = normalizeState(value);
    const key = stateKey(next);
    const workflowChanged = loadedWorkflowIdRef.current !== workflowId;
    if (!workflowChanged && (key === lastExternalKeyRef.current || key === lastEmittedKeyRef.current)) return;
    loadedWorkflowIdRef.current = workflowId;
    lastExternalKeyRef.current = key;
    if (workflowChanged) lastEmittedKeyRef.current = "";
    stateRef.current = next;
    const editor = editorRef.current;
    if (editor) loadStateIntoEditor(editor, next);
  }, [value, workflowId, loadStateIntoEditor]);

  useEffect(() => () => {
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    if (geometryPollRef.current !== null) window.clearInterval(geometryPollRef.current);
    unlistenRef.current?.();
    unlistenRef.current = null;
  }, []);

  useEffect(() => {
    geometryPollRef.current = window.setInterval(() => {
      const editor = editorRef.current;
      if (!editor) return;
      syncNodeGeometryFromEditor(editor);
    }, 900);
    return () => {
      if (geometryPollRef.current !== null) window.clearInterval(geometryPollRef.current);
      geometryPollRef.current = null;
    };
  }, [syncNodeGeometryFromEditor]);

  const updateState = useCallback((updater: (current: WorkflowCanvasState) => WorkflowCanvasState) => {
    const editor = editorRef.current;
    const current = editor ? exportStateFromEditor(editor) : stateRef.current;
    const next = updater(current);
    stateRef.current = next;
    lastEmittedKeyRef.current = stateKey(next);
    lastExternalKeyRef.current = lastEmittedKeyRef.current;
    onChange(next);
    if (!editor) return;
    loadingRef.current = true;
    const existingIds = new Set(editor.getCurrentPageShapes().filter((shape) => shape.type === "workflow_node").map((shape) => shape.id));
    const nextIds = new Set<TLShapeId>();
    next.nodes.forEach((node) => {
      const id = getShapeId(node.id);
      nextIds.add(id);
      const shape = editor.getShape(id) as WorkflowNodeShape | undefined;
      const size = getWorkflowNodeVisualSize(node);
      if (shape) editor.updateShape<WorkflowNodeShape>({ id, type: "workflow_node", x: node.x, y: node.y, props: { ...shape.props, ...size, node } });
      else editor.createShapes([{ id, type: "workflow_node", x: node.x, y: node.y, props: { ...size, node } }] as never);
    });
    const removed = Array.from(existingIds).filter((id) => !nextIds.has(id));
    if (removed.length > 0) editor.deleteShapes(removed);
    loadingRef.current = false;
    setEditorTick((tick) => tick + 1);
  }, [onChange]);

  const markNodeAction = useCallback((nodeId: string) => {
    recentActionNodeIdsRef.current = [nodeId, ...recentActionNodeIdsRef.current.filter((id) => id !== nodeId)].slice(0, 20);
  }, []);

  const updateNode = useCallback((nodeId: string, patch: Partial<WorkflowNodeData>) => {
    markNodeAction(nodeId);
    updateState((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node) }));
  }, [markNodeAction, updateState]);

  const addNode = useCallback((kind: WorkflowNodeKind) => {
    const editor = editorRef.current;
    const current = stateRef.current;
    const viewport = editor?.getViewportPageBounds();
    const draftNode: WorkflowNode = { id: createId("workflow_node"), kind, title: getNodeLabel(kind), x: 0, y: 0, data: getDefaultNodeData(kind) };
    const size = getWorkflowNodeVisualSize(draftNode);
    const anchorId = recentActionNodeIdsRef.current.find((nodeId) => current.nodes.some((node) => node.id === nodeId)) || selectedNodeIdRef.current;
    const anchor = current.nodes.find((node) => node.id === anchorId);
    const fallback = viewport ? { x: viewport.x + viewport.w / 2 - size.w / 2, y: viewport.y + viewport.h / 2 - size.h / 2 } : undefined;
    const position = findNonOverlappingNodePosition(current.nodes, size, anchor, fallback);
    const node: WorkflowNode = {
      id: draftNode.id,
      kind,
      title: getNodeLabel(kind),
      x: position.x,
      y: position.y,
      data: draftNode.data,
    };
    recentActionNodeIdsRef.current = [node.id, ...recentActionNodeIdsRef.current].slice(0, 20);
    updateState((state) => ({ ...state, nodes: [...state.nodes, node] }));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const nextEditor = editorRef.current;
      if (!nextEditor) return;
      const shapeId = getShapeId(node.id);
      if (!nextEditor.getShape(shapeId)) return;
      nextEditor.select(shapeId);
      focusWorkflowNodeInViewport(nextEditor, node);
    }));
  }, [updateState]);

  const restoreWorkflowAssetToCanvas = useCallback((asset: WorkflowAssetSummary, pagePoint?: { x: number; y: number }) => {
    const current = stateRef.current;
    if (current.nodes.some((node) => [...(node.data.images ?? []), ...(node.data.videoUrl ? [node.data.videoUrl] : [])].some((url) => normalizeWorkflowMediaUrl(url) === normalizeWorkflowMediaUrl(asset.url)))) return;
    const kind: WorkflowNodeKind = asset.kind;
    const defaultData = getDefaultNodeData(kind);
    const data: WorkflowNodeData = kind === "image"
      ? {
        ...defaultData,
        prompt: asset.sourcePrompt ?? defaultData.prompt,
        ratio: normalizeWorkflowImageRatio(asset.ratio, asset.dimensions),
        resolution: asset.resolution ?? defaultData.resolution,
        images: [asset.url],
        imageDimensions: asset.dimensions ? { [asset.url]: asset.dimensions } : undefined,
        mediaSystemNames: { [asset.url]: asset.name },
        visualSize: undefined,
      }
      : {
        ...defaultData,
        prompt: asset.sourcePrompt ?? defaultData.prompt,
        ratio: asset.ratio ?? defaultData.ratio,
        resolution: asset.resolution ?? defaultData.resolution,
        duration: asset.duration ?? defaultData.duration,
        videoUrl: asset.url,
        posterUrl: asset.posterUrl,
        videoCurrentTime: 0,
        mediaSystemNames: { [asset.url]: asset.name },
        visualSize: undefined,
      };
    const draftNode: WorkflowNode = { id: createId("workflow_node"), kind, title: getNodeLabel(kind), x: 0, y: 0, data };
    const size = getWorkflowNodeVisualSize(draftNode);
    const position = pagePoint
      ? { x: pagePoint.x - size.w / 2, y: pagePoint.y - size.h / 2 }
      : findNonOverlappingNodePosition(current.nodes, size, current.nodes[current.nodes.length - 1]);
    const node = { ...draftNode, x: position.x, y: position.y };
    recentActionNodeIdsRef.current = [node.id, ...recentActionNodeIdsRef.current].slice(0, 20);
    updateState((state) => ({ ...state, nodes: [...state.nodes, node] }));
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const shapeId = getShapeId(node.id);
      editor.select(shapeId);
      focusWorkflowNodeInViewport(editor, node);
    });
  }, [updateState]);

  const restoreHistoricalTextNodeToCanvas = useCallback((historicalNode: WorkflowNode) => {
    const current = stateRef.current;
    const size = getWorkflowNodeVisualSize(historicalNode);
    const position = findNonOverlappingNodePosition(current.nodes, size, current.nodes[current.nodes.length - 1]);
    const node = { ...historicalNode, id: createId("workflow_node"), x: position.x, y: position.y };
    updateState((state) => ({
      ...state,
      nodes: [...state.nodes, node],
      historicalTextNodes: (state.historicalTextNodes ?? []).filter((item) => item.id !== historicalNode.id),
    }));
    window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.select(getShapeId(node.id));
      focusWorkflowNodeInViewport(editor, node);
    });
  }, [updateState]);

  const handleWorkflowAssetDrop = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
    const assetId = event.dataTransfer.getData("application/x-flashmuse-workflow-asset") || event.dataTransfer.getData("text/plain");
    if (!assetId) return;
    const asset = workflowAssets.find((item) => item.id === assetId);
    if (!asset) return;
    event.preventDefault();
    const editor = editorRef.current;
    const pagePoint = editor?.screenToPage({ x: event.clientX, y: event.clientY });
    restoreWorkflowAssetToCanvas(asset, pagePoint);
  }, [restoreWorkflowAssetToCanvas, workflowAssets]);

  const handleWorkflowContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;
    event.preventDefault();
    event.stopPropagation();
    closeWorkflowPopups();
    const target = event.target as HTMLElement | null;
    const nodeElement = target?.closest<HTMLElement>("[data-workflow-node-id]");
    const nodeId = nodeElement?.dataset.workflowNodeId;
    if (nodeId && stateRef.current.nodes.some((node) => node.id === nodeId)) {
      const shapeId = getShapeId(nodeId);
      if (!editor.getSelectedShapeIds().includes(shapeId)) editor.select(shapeId);
      markNodeAction(nodeId);
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 180;
    const menuMaxHeight = 520;
    setContextMenu({
      x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - menuMaxHeight - 8)),
    });
  }, [markNodeAction]);

  const handleWorkflowPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!contextMenu || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-workflow-context-menu]")) return;
    setContextMenu(null);
  }, [contextMenu]);

  const reorderWorkflowNodeLayer = useCallback((dragNodeId: string, targetNodeId: string, position: "before" | "after") => {
    if (!dragNodeId || !targetNodeId || dragNodeId === targetNodeId) return;
    const editor = editorRef.current;
    if (!editor) return;
    const currentTopToBottom = editor.getCurrentPageShapesSorted().filter((shape): shape is WorkflowNodeShape => shape.type === "workflow_node").map((shape) => shape.props.node.id).reverse();
    const dragIndex = currentTopToBottom.indexOf(dragNodeId);
    if (dragIndex < 0 || !currentTopToBottom.includes(targetNodeId)) return;
    const nextTopToBottom = currentTopToBottom.filter((id) => id !== dragNodeId);
    const targetIndex = nextTopToBottom.indexOf(targetNodeId);
    if (targetIndex < 0) return;
    nextTopToBottom.splice(position === "after" ? targetIndex + 1 : targetIndex, 0, dragNodeId);
    editor.markHistoryStoppingPoint("reorder workflow layers");
    [...nextTopToBottom].reverse().forEach((nodeId) => {
      const shape = editor.getShape(getShapeId(nodeId));
      if (shape) editor.bringToFront([shape.id]);
    });
    scheduleEmit();
  }, [scheduleEmit]);

  const deleteNode = useCallback((nodeId: string) => {
    recentActionNodeIdsRef.current = recentActionNodeIdsRef.current.filter((id) => id !== nodeId);
    updateState((current) => {
      const deletedNodes = current.nodes.filter((node) => node.id === nodeId);
      const withHistory = addHistoricalTextNodes(current, deletedNodes);
      return { ...withHistory, nodes: withHistory.nodes.filter((node) => node.id !== nodeId), edges: withHistory.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) };
    });
    if (connectingFrom === nodeId) setConnectingFrom("");
  }, [connectingFrom, updateState]);

  const setCanvasTool = useCallback((tool: "select" | "hand") => {
    activeCanvasToolRef.current = tool;
    setActiveCanvasToolState(tool);
    editorRef.current?.setCurrentTool(tool === "hand" ? "hand" : "select");
  }, []);

  useEffect(() => {
    const deleteSelectedNodes = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const editor = editorRef.current;
      if (!editor) return;
      const selectedNodeIds = editor.getSelectedShapeIds().map((id) => getNodeIdFromShapeId(String(id))).filter((nodeId) => stateRef.current.nodes.some((node) => node.id === nodeId));
      if (selectedNodeIds.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const deleting = new Set(selectedNodeIds);
      updateState((current) => {
        const deletedNodes = current.nodes.filter((node) => deleting.has(node.id));
        const withHistory = addHistoricalTextNodes(current, deletedNodes);
        return { ...withHistory, nodes: withHistory.nodes.filter((node) => !deleting.has(node.id)), edges: withHistory.edges.filter((edge) => !deleting.has(edge.source) && !deleting.has(edge.target)) };
      });
      if (selectedNodeIds.includes(connectingFrom)) setConnectingFrom("");
    };
    window.addEventListener("keydown", deleteSelectedNodes, true);
    return () => window.removeEventListener("keydown", deleteSelectedNodes, true);
  }, [connectingFrom, updateState]);

  useEffect(() => {
    const handleToolShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (event.key.toLowerCase() === "v") {
        setCanvasTool("select");
        return;
      }
      if (event.key.toLowerCase() === "h") {
        setCanvasTool("hand");
      }
    };
    window.addEventListener("keydown", handleToolShortcut, true);
    return () => window.removeEventListener("keydown", handleToolShortcut, true);
  }, [setCanvasTool]);

  const connectTo = useCallback((targetId: string) => {
    if (!connectingFrom || connectingFrom === targetId) return;
    updateState((current) => current.edges.some((edge) => edge.source === connectingFrom && edge.target === targetId) ? current : { ...current, edges: [...current.edges, { id: createId("workflow_edge"), source: connectingFrom, target: targetId }] });
    setConnectingFrom("");
  }, [connectingFrom, updateState]);

  const getIncomingNodes = useCallback((nodeId: string) => stateRef.current.edges.filter((edge) => edge.target === nodeId).map((edge) => stateRef.current.nodes.find((node) => node.id === edge.source)).filter(Boolean) as WorkflowNode[], []);
  const getInputText = useCallback((nodeId: string) => getIncomingNodes(nodeId).map((node) => node.kind === "text" ? node.data.text?.trim() || node.data.prompt?.trim() || node.data.outputText?.trim() || "" : node.data.prompt?.trim() ?? "").filter(Boolean).join("\n\n"), [getIncomingNodes]);
  const getReferenceImages = useCallback((nodeId: string) => {
    const urls: string[] = [];
    for (const source of getIncomingNodes(nodeId)) for (const url of source.data.images ?? []) if (url && !urls.includes(url)) urls.push(url);
    return urls;
  }, [getIncomingNodes]);

  const getPromptReferenceUrls = useCallback((prompt: string, node: WorkflowNode, kind: "image" | "video" | "audio") => getWorkflowPromptReferenceUrls(prompt, node, referenceAssets, kind), [referenceAssets]);

  const getEnabledImageModel = useCallback((model?: ModelName) => (model && imageModels.some((item) => item.id === model) ? model : (imageModels[0]?.id as ModelName | undefined) ?? DEFAULT_IMAGE_MODEL), [imageModels]);
  const getEnabledVideoModel = useCallback((model?: ModelName) => (model && videoModels.some((item) => item.id === model) ? model : (videoModels[0]?.id as ModelName | undefined) ?? DEFAULT_VIDEO_MODEL), [videoModels]);

  const runImageNode = useCallback(async (node: WorkflowNode) => {
    const upstreamPrompt = getInputText(node.id);
    const ownPrompt = node.data.prompt?.trim() ?? "";
    const prompt = [upstreamPrompt, ownPrompt].filter(Boolean).join("\n\n").trim();
    if (!prompt) return updateNode(node.id, { error: "请先输入提示词，或连接一个文本节点。" });
    const model = getEnabledImageModel(node.data.model);
    const imageRatio = imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio : "16:9";
    const settings = { ratio: imageRatio, resolution: node.data.resolution ?? normalizeImageResolutionForModel(model, getSupportedImageResolutions(model)[0]) };
    updateNode(node.id, { isRunning: true, error: undefined, images: [], visualSize: undefined, startedAt: Date.now() });
    try {
      const referenceImages = [...getReferenceImages(node.id), ...getPromptReferenceUrls(prompt, node, "image")].filter((url, index, array) => array.indexOf(url) === index);
      const data = await fetch("/api/image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, model, settings, referenceImages, count: 1, conversationId: workflowId, conversationTitle: workflowTitle, requestId: createId("workflow_image"), metadata: { creditSource: "workflow_image_generation" } }) }).then((response) => readJson<{ images?: string[]; imageDimensions?: Record<string, { width: number; height: number }>; usage?: UsageMeta; credit?: CreditResult }>(response));
      const images = data.images ?? [];
      updateNode(node.id, { images, imageDimensions: data.imageDimensions, visualSize: undefined, isRunning: false, error: undefined });
      if (images.length > 0) onGeneratedMedia?.({ nodeId: node.id, kind: "image", urls: images, sourcePrompt: prompt, model, ratio: settings.ratio, resolution: settings.resolution, dimensions: data.imageDimensions });
      onCredit?.({ ...data.credit, usage: data.usage });
    } catch (error) {
      updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error) });
    }
  }, [getEnabledImageModel, getInputText, getPromptReferenceUrls, getReferenceImages, onCredit, onGeneratedMedia, updateNode, workflowId, workflowTitle]);

  const pollVideoNode = useCallback(async (node: WorkflowNode, taskId: string, prompt: string, model: ModelName, settings: { ratio?: string; resolution?: string; duration?: string }, requestId: string, initialUsage?: UsageMeta) => {
    let usage = initialUsage;
    for (let attempt = 0; attempt < videoMaxPollAttempts; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, videoPollIntervalMs));
      const pollData = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ taskId, prompt, model, settings, conversationId: workflowId, conversationTitle: workflowTitle, requestId, usage, metadata: { creditSource: "workflow_video_generation" } }) }).then((response) => readJson<VideoApiResponse>(response));
      usage = pollData.usage ?? usage;
      if (pollData.status === "failed" || pollData.error?.message) throw new Error(pollData.error?.message || "视频生成失败");
      const videoUrl = getVideoUrlFromResponse(pollData);
      if (isVideoDoneStatus(pollData.status) && videoUrl) {
        const posterUrl = getPosterUrlFromResponse(pollData);
        updateNode(node.id, { videoUrl, posterUrl, videoCurrentTime: 0, visualSize: undefined, isRunning: false, error: undefined, taskId: undefined });
        onGeneratedMedia?.({ nodeId: node.id, kind: "video", urls: [videoUrl], posterUrl, sourcePrompt: prompt, model, ratio: settings.ratio, resolution: settings.resolution, duration: settings.duration });
        onCredit?.({ ...pollData.credit, usage: pollData.usage });
        return;
      }
    }
    throw new Error("视频生成超时，请稍后查看或重试。");
  }, [onCredit, onGeneratedMedia, updateNode, workflowId, workflowTitle]);

  const runVideoNode = useCallback(async (node: WorkflowNode) => {
    const upstreamPrompt = getInputText(node.id);
    const ownPrompt = node.data.prompt?.trim() ?? "";
    const prompt = [upstreamPrompt, ownPrompt].filter(Boolean).join("\n\n").trim();
    if (!prompt) return updateNode(node.id, { error: "请先输入视频提示词，或连接一个文本/图片节点。" });
    const model = getEnabledVideoModel(node.data.model);
    const resolution = normalizeVideoResolutionForModel(model, node.data.resolution);
    const settings = { ratio: normalizeVideoRatioForModel(model, node.data.ratio, resolution), resolution, duration: node.data.duration ?? workflowVideoModels.find((item) => item.id === model)?.durations?.[0] ?? "5秒" };
    const requestId = createId("workflow_video");
    updateNode(node.id, { isRunning: true, error: undefined, videoUrl: undefined, posterUrl: undefined, videoCurrentTime: undefined, visualSize: undefined, startedAt: Date.now() });
    try {
      const referenceImages = [...getReferenceImages(node.id), ...getPromptReferenceUrls(prompt, node, "image")].filter((url, index, array) => array.indexOf(url) === index);
      const referenceVideos = getPromptReferenceUrls(prompt, node, "video");
      const referenceAudios = getPromptReferenceUrls(prompt, node, "audio");
      const createData = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, model, settings, referenceImages, referenceVideos, referenceAudios, conversationId: workflowId, conversationTitle: workflowTitle, requestId, metadata: { creditSource: "workflow_video_generation" } }) }).then((response) => readJson<VideoApiResponse>(response));
      const taskId = getVideoTaskId(createData);
      if (!taskId) throw new Error("视频任务创建失败");
      updateNode(node.id, { taskId });
      await pollVideoNode(node, taskId, prompt, model, settings, requestId, createData.usage);
    } catch (error) {
      updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error), taskId: undefined });
    }
  }, [getEnabledVideoModel, getInputText, getPromptReferenceUrls, getReferenceImages, pollVideoNode, updateNode, workflowId, workflowTitle]);

  const runtime = useMemo<WorkflowRuntime>(() => ({ selectedNodeId, connectingFrom, modelOptions, workflowTitle, updateNode, deleteNode, connectTo, setConnectingFrom, runImageNode: (node) => void runImageNode(node), runVideoNode: (node) => void runVideoNode(node), onGeneratedMedia, markNodeAction, onPreviewMedia, getImageDisplayUrl, getVideoPosterDisplayUrl, referenceAssets, referenceAssetsLoadStatus, onLoadReferenceAssets }), [connectTo, connectingFrom, deleteNode, getImageDisplayUrl, getVideoPosterDisplayUrl, markNodeAction, modelOptions, onGeneratedMedia, onLoadReferenceAssets, onPreviewMedia, referenceAssets, referenceAssetsLoadStatus, runImageNode, runVideoNode, selectedNodeId, updateNode, workflowTitle]);

  return (
    <WorkflowRuntimeContext.Provider value={runtime}>
      <div className="relative h-full min-h-full overflow-hidden bg-[#cccccc] text-[#111111] workflow-tldraw-shell workflow-lovart-skin" style={{ "--workflow-canvas-bg": canvasBackground } as CSSProperties} onContextMenu={handleWorkflowContextMenu} onPointerDownCapture={handleWorkflowPointerDownCapture} onDragOver={(event) => { if (event.dataTransfer.types.includes("application/x-flashmuse-workflow-asset")) event.preventDefault(); }} onDrop={handleWorkflowAssetDrop}>
        <style>{`.workflow-tldraw-shell .tl-watermark_SEE-LICENSE,.workflow-tldraw-shell [data-testid="tl-watermark-unlicensed"],.workflow-tldraw-shell [data-testid="tl-watermark-licensed"]{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important;}.workflow-tldraw-shell .yinzao-tool-button-active+div{opacity:.9!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);}`}</style>
        <Tldraw hideUi shapeUtils={[WorkflowNodeShapeUtil]} overlayUtils={workflowOverlayUtils} components={workflowTldrawComponents} overrides={workflowTldrawOverrides} options={workflowTldrawOptions} onMount={handleMount} licenseKey="">
          <WorkflowCanvasStatusControls state={stateRef.current} tick={editorTick} canvasBackground={canvasBackground} onCanvasBackgroundChange={setCanvasBackground} isLayerPanelOpen={isLayerPanelOpen} onToggleLayerPanel={() => setIsLayerPanelOpen((current) => !current)} />
          <WorkflowSelectedNodeOverlay />
          <WorkflowCustomContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
        </Tldraw>
        <WorkflowEdgesOverlay editor={editorRef.current} state={stateRef.current} tick={editorTick} />
        {isLayerPanelOpen ? <WorkflowLayerPanel state={stateRef.current} workflowAssets={workflowAssets} selectedNodeId={selectedNodeId} getImageDisplayUrl={getImageDisplayUrl} getVideoPosterDisplayUrl={getVideoPosterDisplayUrl} onClose={() => setIsLayerPanelOpen(false)} onSelectNode={(nodeId, focus) => { const editor = editorRef.current; const node = stateRef.current.nodes.find((item) => item.id === nodeId); if (!editor || !node) return; editor.select(getShapeId(nodeId)); if (focus) focusWorkflowNodeInViewport(editor, node); }} onReorderNode={reorderWorkflowNodeLayer} onRestoreAsset={restoreWorkflowAssetToCanvas} onRestoreTextNode={restoreHistoricalTextNodeToCanvas} /> : null}
        <div className="pointer-events-auto absolute left-4 top-3 z-20 flex items-center gap-2 text-[#5c626b]">
          {onToggleLeftSidebar ? (
            <button type="button" onClick={onToggleLeftSidebar} className="flex h-8 w-8 items-center justify-center rounded-md text-[#5c626b] transition hover:bg-black/5 hover:text-[#30343a]" aria-label={leftSidebarVisible ? "隐藏左侧栏" : "显示左侧栏"} title={leftSidebarVisible ? "隐藏左侧栏" : "显示左侧栏"}>
              {leftSidebarVisible ? <RiLayoutLeft2Line className="h-[22px] w-[22px]" aria-hidden="true" /> : <RiLayoutLeftLine className="h-[22px] w-[22px]" aria-hidden="true" />}
            </button>
          ) : null}
          <div className="max-w-[260px] truncate text-[13px] font-semibold text-[#5c626b]">{workflowTitle || "Untitled"}</div>
        </div>
        {connectingFrom ? <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-[#111111] px-4 py-2 text-[12px] font-medium text-white shadow-lg">选择一个节点左侧的“+”完成连接<button type="button" onClick={() => setConnectingFrom("")} className="ml-3 text-white/70 hover:text-white">取消</button></div> : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
        <div className="lovart-workflow-dock pointer-events-auto flex items-center gap-1 rounded-[14px] border border-white/72 bg-white/92 p-1.5 shadow-[0_16px_34px_rgba(0,0,0,0.16)] backdrop-blur-[16px]">
          <button type="button" onClick={() => addNode("text")} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#30343a] outline-none hover:bg-[#f0f0f0]" title="文本输入"><RiTextBlock className="h-5 w-5 shrink-0" /></button>
          <button type="button" onClick={() => addNode("image")} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#30343a] outline-none hover:bg-[#f0f0f0]" title="图片节点"><RiImageAiLine className="h-5 w-5 shrink-0" /></button>
          <button type="button" onClick={() => addNode("video")} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#30343a] outline-none hover:bg-[#f0f0f0]" title="视频节点"><RiFilmAiLine className="h-5 w-5 shrink-0" /></button>
          <div className="mx-1 h-5 w-px bg-[#e5e5e5]" />
          <button type="button" onClick={() => editorRef.current?.zoomOut()} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#30343a] outline-none hover:bg-[#f0f0f0]" title="缩小"><RiZoomOutLine className="h-5 w-5 shrink-0" /></button>
          <button type="button" onClick={() => editorRef.current?.zoomIn()} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#30343a] outline-none hover:bg-[#f0f0f0]" title="放大"><RiZoomInLine className="h-5 w-5 shrink-0" /></button>
          <button type="button" onClick={() => { const editor = editorRef.current; if (editor) zoomToSelectedOrWorkflowNodes(editor, stateRef.current.nodes); }} className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#30343a] outline-none hover:bg-[#f0f0f0]" title="定位节点"><RiFocus3Line className="h-5 w-5 shrink-0" /></button>
          <WorkflowToolMenu activeTool={activeCanvasTool} onChange={setCanvasTool} />
        </div>
        </div>
        {stateRef.current.nodes.length === 0 ? <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"><div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e5e5e5] bg-white text-[#367cee] shadow-[0_10px_30px_rgba(15,23,42,0.08)]"><RiImageAiLine className="h-7 w-7" /></div><div className="text-[16px] font-semibold text-[#111111]">从一个节点开始</div><div className="mt-2 text-[13px] text-[#8a8a8a]">文本输入、图片、视频节点都走同一套工作流链路。</div><button type="button" onClick={() => addNode("text")} className="pointer-events-auto mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#367cee] px-4 text-[13px] font-semibold text-white transition hover:bg-[#286fe0]"><RiAddLine className="h-4 w-4" /> 添加文本输入</button></div> : null}
      </div>
    </WorkflowRuntimeContext.Provider>
  );
}

function normalizeWorkflowMediaUrl(url: string) {
  return url.split("?")[0].split("#")[0];
}

function WorkflowCanvasStatusControls({ state, tick, canvasBackground, onCanvasBackgroundChange, isLayerPanelOpen, onToggleLayerPanel }: { state: WorkflowCanvasState; tick: number; canvasBackground: string; onCanvasBackgroundChange: (color: string) => void; isLayerPanelOpen: boolean; onToggleLayerPanel: () => void }) {
  const editor = useEditor();
  void tick;
  const [openPanel, setOpenPanel] = useState<"background" | "minimap" | "zoom" | "">("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const zoomPercent = useValue("workflow-zoom-percent", () => Math.round(editor.getCamera().z * 100), [editor]);
  const isGridMode = useValue("workflow-grid-mode", () => editor.getInstanceState().isGridMode, [editor]);
  const backgroundOptions = [
    { label: "默认灰", value: "#cccccc" },
    { label: "浅灰", value: "#e2e2e2" },
    { label: "白色", value: "#f7f7f7" },
    { label: "深灰", value: "#b8b8b8" },
  ];

  useEffect(() => {
    if (!openPanel) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpenPanel("");
    };
    window.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointerDown, true);
  }, [openPanel]);

  return (
    <div ref={rootRef} className="pointer-events-auto absolute bottom-[5px] left-5 z-20 flex items-center gap-0.5 text-[12px] font-medium text-[#5c626b]">
      <div className="relative">
        <button type="button" onClick={() => setOpenPanel((current) => current === "background" ? "" : "background")} className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-[#5c626b] hover:bg-black/5" aria-label="画布背景" title="画布背景"><RiCheckboxBlankCircleLine className="h-4 w-4" /></button>
        {openPanel === "background" ? (
          <div className="absolute bottom-7 left-0 w-[176px] rounded-[12px] border border-black/8 bg-white p-2 text-[#333333] shadow-[0_12px_30px_rgba(0,0,0,0.14)]">
            <div className="px-2 pb-2 text-[12px] font-semibold text-[#111111]">画布背景</div>
            {backgroundOptions.map((item) => (
              <button key={item.value} type="button" onClick={() => { onCanvasBackgroundChange(item.value); setOpenPanel(""); }} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] hover:bg-[#f3f3f3]">
                <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: item.value }} />
                <span className="flex-1">{item.label}</span>
                {canvasBackground === item.value ? <RiCheckLine className="h-4 w-4" /> : null}
              </button>
            ))}
            <button type="button" onClick={() => editor.updateInstanceState({ isGridMode: !isGridMode })} className="mt-1 flex h-8 w-full items-center justify-between rounded-lg px-2 text-left text-[12px] hover:bg-[#f3f3f3]">
              <span>显示网格</span>
              {isGridMode ? <RiCheckLine className="h-4 w-4" /> : null}
            </button>
          </div>
        ) : null}
      </div>
      <button type="button" onClick={() => { setOpenPanel(""); onToggleLayerPanel(); }} className={`flex h-[30px] w-[30px] items-center justify-center rounded-md text-[#5c626b] hover:bg-black/5 ${isLayerPanelOpen ? "bg-black/5" : ""}`} aria-label="图层" title="图层"><RiStackLine className="h-4 w-4" /></button>
      <div className="relative">
        <button type="button" onClick={() => setOpenPanel((current) => current === "minimap" ? "" : "minimap")} className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-[#5c626b] hover:bg-black/5" aria-label="小地图" title="小地图"><RiRoadMapLine className="h-4 w-4" /></button>
        {openPanel === "minimap" ? (
          <div className="absolute bottom-7 left-0 overflow-hidden rounded-[10px] bg-white p-1 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
            <WorkflowMiniMap editor={editor} state={state} />
          </div>
        ) : null}
      </div>
      <span className="mx-1 h-3 w-px bg-black/12" />
      <div className="relative">
        <button type="button" onClick={() => setOpenPanel((current) => current === "zoom" ? "" : "zoom")} className="flex h-[30px] min-w-11 items-center justify-center rounded-md px-1.5 text-[12px] font-medium text-[#5c626b] hover:bg-black/5" aria-label="缩放菜单" title="缩放菜单">{zoomPercent}%</button>
        {openPanel === "zoom" ? <WorkflowZoomMenu editor={editor} state={state} onClose={() => setOpenPanel("")} /> : null}
      </div>
    </div>
  );
}

function WorkflowZoomMenu({ editor, state, onClose }: { editor: Editor; state: WorkflowCanvasState; onClose: () => void }) {
  const zoomPercent = useValue("workflow-zoom-menu-percent", () => Math.round(editor.getCamera().z * 100), [editor]);
  const setZoom = (zoom: number) => {
    const center = editor.getViewportPageBounds().center;
    const screen = editor.getViewportScreenBounds();
    editor.setCamera({ x: screen.w / 2 / zoom - center.x, y: screen.h / 2 / zoom - center.y, z: zoom });
    onClose();
  };
  const items = [
    { label: "放大", shortcut: "Ctrl +", onClick: () => { editor.zoomIn(); onClose(); } },
    { label: "缩小", shortcut: "Ctrl -", onClick: () => { editor.zoomOut(); onClose(); } },
    { label: "显示画布所有元素", shortcut: "Shift + 1", onClick: () => { zoomToWorkflowNodes(editor, state.nodes); onClose(); } },
    { type: "divider" as const },
    { label: "缩放至25%", zoomPercent: 25, onClick: () => setZoom(0.25) },
    { label: "缩放至50%", zoomPercent: 50, onClick: () => setZoom(0.5) },
    { label: "缩放至100%", zoomPercent: 100, onClick: () => setZoom(1) },
    { label: "缩放至200%", zoomPercent: 200, onClick: () => setZoom(2) },
  ];

  return (
    <div className="absolute bottom-9 left-0 w-[200px] rounded-[12px] bg-white p-2 text-[#111111] shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
      {items.map((item, index) => item.type === "divider" ? <div key={index} className="my-2 h-px bg-[#eeeeee]" /> : (
        <button key={item.label} type="button" onClick={item.onClick} className={`flex h-[31px] w-full items-center justify-between rounded-[8px] px-2 text-left text-[13px] font-medium hover:bg-[#eeeeee] ${item.zoomPercent === zoomPercent ? "bg-[#eeeeee]" : ""}`}>
          <span>{item.label}</span>
          {item.shortcut ? <span className="text-[13px] font-normal text-[#b4b4b4]">{item.shortcut}</span> : null}
        </button>
      ))}
    </div>
  );
}

function WorkflowMiniMap({ editor, state }: { editor: Editor; state: WorkflowCanvasState }) {
  const viewport = useValue("workflow-minimap-viewport", () => editor.getViewportPageBounds(), [editor]);
  const width = 200;
  const height = 130;
  const padding = 10;
  const nodeRects = state.nodes.map((node) => ({ x: node.x, y: node.y, ...getWorkflowNodeVisualSize(node) }));
  const allRects = [...nodeRects, { x: viewport.x, y: viewport.y, w: viewport.w, h: viewport.h }];
  const minX = Math.min(...allRects.map((rect) => rect.x)) - 80;
  const minY = Math.min(...allRects.map((rect) => rect.y)) - 80;
  const maxX = Math.max(...allRects.map((rect) => rect.x + rect.w)) + 80;
  const maxY = Math.max(...allRects.map((rect) => rect.y + rect.h)) + 80;
  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const scale = Math.min((width - padding * 2) / contentWidth, (height - padding * 2) / contentHeight);
  const offsetX = (width - contentWidth * scale) / 2;
  const offsetY = (height - contentHeight * scale) / 2;
  const toMini = (x: number, y: number) => ({ x: offsetX + (x - minX) * scale, y: offsetY + (y - minY) * scale });
  const centerCanvas = (clientX: number, clientY: number, element: SVGSVGElement) => {
    const rect = element.getBoundingClientRect();
    const pageX = minX + ((clientX - rect.left) / rect.width * width - offsetX) / scale;
    const pageY = minY + ((clientY - rect.top) / rect.height * height - offsetY) / scale;
    editor.centerOnPoint({ x: pageX, y: pageY });
  };
  const viewportPoint = toMini(viewport.x, viewport.y);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block h-[130px] w-[200px] cursor-grab rounded-[8px] bg-white active:cursor-grabbing"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        centerCanvas(event.clientX, event.clientY, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        centerCanvas(event.clientX, event.clientY, event.currentTarget);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    >
      <rect x="0" y="0" width={width} height={height} rx="8" fill="#ffffff" />
      {nodeRects.map((rect, index) => {
        const point = toMini(rect.x, rect.y);
        return <rect key={index} x={point.x} y={point.y} width={Math.max(5, rect.w * scale)} height={Math.max(4, rect.h * scale)} rx="1.5" fill="#e2e2e2" />;
      })}
      <rect x={viewportPoint.x} y={viewportPoint.y} width={Math.max(10, viewport.w * scale)} height={Math.max(8, viewport.h * scale)} rx="4" fill="rgba(80,80,80,0.06)" stroke="#d7d7d7" strokeWidth="1" />
    </svg>
  );
}

function WorkflowLayerPanel({ state, workflowAssets, selectedNodeId, getImageDisplayUrl, getVideoPosterDisplayUrl, onClose, onSelectNode, onReorderNode, onRestoreAsset, onRestoreTextNode }: { state: WorkflowCanvasState; workflowAssets: WorkflowAssetSummary[]; selectedNodeId: string; getImageDisplayUrl?: (url: string) => string; getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined; onClose: () => void; onSelectNode: (nodeId: string, focus?: boolean) => void; onReorderNode: (dragNodeId: string, targetNodeId: string, position: "before" | "after") => void; onRestoreAsset: (asset: WorkflowAssetSummary) => void; onRestoreTextNode: (node: WorkflowNode) => void }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ nodeId: string; position: "before" | "after" } | null>(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const currentMediaUrls = new Set(state.nodes.flatMap((node) => [...(node.data.images ?? []), ...(node.data.videoUrl ? [node.data.videoUrl] : [])].map(normalizeWorkflowMediaUrl)));
  const workflowAssetByUrl = new Map(workflowAssets.map((asset) => [normalizeWorkflowMediaUrl(asset.url), asset]));
  const orderedNodes = [...state.nodes].reverse();
  const currentCanvasAssets = state.nodes.flatMap((node) => {
    const imageAssets = (node.data.images ?? []).map((url, index) => workflowAssetByUrl.get(normalizeWorkflowMediaUrl(url)) ?? { id: `${node.id}-image-${index}`, name: node.data.mediaSystemNames?.[url] ?? `Image ${index + 1}`, url, kind: "image" as const, nodeId: node.id, dimensions: node.data.imageDimensions?.[url], sourcePrompt: node.data.prompt, ratio: node.data.ratio, resolution: node.data.resolution });
    const videoAssets = node.data.videoUrl ? [workflowAssetByUrl.get(normalizeWorkflowMediaUrl(node.data.videoUrl)) ?? { id: `${node.id}-video`, name: node.data.mediaSystemNames?.[node.data.videoUrl] ?? "Video 1", url: node.data.videoUrl, posterUrl: node.data.posterUrl, kind: "video" as const, nodeId: node.id, sourcePrompt: node.data.prompt, ratio: node.data.ratio, resolution: node.data.resolution, duration: node.data.duration }] : [];
    return [...imageAssets, ...videoAssets].map((asset) => ({ ...asset, nodeId: node.id }));
  });
  const historicalAssets = workflowAssets.filter((asset) => !currentMediaUrls.has(normalizeWorkflowMediaUrl(asset.url)));
  const historicalTextNodes = state.historicalTextNodes ?? [];
  const hasHistory = historicalTextNodes.length > 0 || historicalAssets.length > 0;

  useEffect(() => {
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    window.addEventListener("pointerdown", closeOnOutsidePointerDown, true);
    return () => window.removeEventListener("pointerdown", closeOnOutsidePointerDown, true);
  }, [onClose]);

  const startLayerDrag = (event: ReactDragEvent<HTMLElement>, nodeId: string) => {
    event.dataTransfer.setData("application/x-flashmuse-workflow-node", nodeId);
    event.dataTransfer.effectAllowed = "move";
  };
  const updateLayerDropIndicator = (event: ReactDragEvent<HTMLElement>, targetNodeId: string) => {
    if (!event.dataTransfer.types.includes("application/x-flashmuse-workflow-node")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropIndicator((current) => current?.nodeId === targetNodeId && current.position === position ? current : { nodeId: targetNodeId, position });
  };
  const dropLayerAtIndicator = (event: ReactDragEvent<HTMLElement>, targetNodeId: string) => {
    const dragNodeId = event.dataTransfer.getData("application/x-flashmuse-workflow-node");
    if (!dragNodeId) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const position = dropIndicator?.nodeId === targetNodeId ? dropIndicator.position : event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropIndicator(null);
    onReorderNode(dragNodeId, targetNodeId, position);
  };
  const renderDropIndicator = (nodeId: string) => dropIndicator?.nodeId === nodeId ? <div className={`pointer-events-none absolute left-0 right-0 z-20 h-[2px] bg-[#111111] ${dropIndicator.position === "before" ? "top-[-1px]" : "bottom-[-1px]"}`} /> : null;

  return (
    <div ref={panelRef} onDragOver={(event) => event.stopPropagation()} onDrop={(event) => event.stopPropagation()} className="workflow-layer-panel pointer-events-auto absolute bottom-0 left-0 top-0 z-30 flex w-[274px] flex-col border-r border-[#e5e5e5] bg-white text-[#333333] shadow-[12px_0_28px_rgba(0,0,0,0.08)]">
      <div className="flex h-14 shrink-0 items-center justify-between px-5">
        <div className="text-[16px] font-semibold text-[#111111]">图层</div>
        <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-[#555555] hover:bg-[#f2f2f2]" aria-label="关闭图层"><RiCloseLine className="h-5 w-5" /></button>
      </div>
      <div className={`${isHistoryExpanded ? "h-[180px] pb-5" : "h-14 pb-0"} shrink-0 border-b border-[#eeeeee] px-5 transition-[height] duration-150`}>
        <div className="mb-3 flex h-8 items-center justify-between text-[14px] font-semibold text-[#111111]">
          <span>历史记录</span>
          <button type="button" onClick={() => setIsHistoryExpanded((current) => !current)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#555555] transition hover:bg-[#f2f2f2]" aria-label={isHistoryExpanded ? "收起历史记录" : "展开历史记录"} title={isHistoryExpanded ? "收起历史记录" : "展开历史记录"}>
            <RiArrowDownSLine className={`h-4 w-4 transition-transform ${isHistoryExpanded ? "" : "-rotate-90"}`} />
          </button>
        </div>
        {isHistoryExpanded ? hasHistory ? (
          <div className="h-[112px] space-y-1 overflow-y-auto pr-1">
            {historicalTextNodes.map((node) => <WorkflowHistoricalTextLayerRow key={node.id} node={node} onRestore={() => onRestoreTextNode(node)} />)}
            {historicalAssets.map((asset) => <WorkflowAssetLayerRow key={asset.id} asset={asset} getImageDisplayUrl={getImageDisplayUrl} getVideoPosterDisplayUrl={getVideoPosterDisplayUrl} onRestore={() => onRestoreAsset(asset)} />)}
          </div>
        ) : (
          <div className="flex h-[112px] flex-col items-center justify-center text-[#c4c8d0]">
            <div className="flex items-center gap-3 opacity-60">
              <RiTextBlock className="h-6 w-6" />
              <RiImageAiLine className="h-6 w-6" />
              <RiFilmAiLine className="h-6 w-6" />
            </div>
            <div className="mt-2 text-[13px]">暂无历史记录</div>
            <div className="mt-1 text-[13px] text-[#aeb4bd]">删除后的节点在这里</div>
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-2 flex items-center gap-2 text-[12px] text-[#4b5563]">
          <RiNodeTree className="h-5 w-5 text-[#333333]" />
          <span>画布上的节点</span>
        </div>
        <div className="ml-5 space-y-1">
          {orderedNodes.length === 0 ? <div className="px-2 py-4 text-[13px] text-[#9a9a9a]">当前画布暂无节点</div> : orderedNodes.map((node) => {
            const nodeAssets = currentCanvasAssets.filter((asset) => asset.nodeId === node.id);
            if (nodeAssets.length > 0) {
              return <div key={node.id} className="relative space-y-1" draggable onDragStart={(event) => startLayerDrag(event, node.id)} onDragEnd={() => setDropIndicator(null)} onDragOver={(event) => updateLayerDropIndicator(event, node.id)} onDrop={(event) => dropLayerAtIndicator(event, node.id)}>{renderDropIndicator(node.id)}{nodeAssets.map((asset) => <WorkflowAssetLayerRow key={`${node.id}-${asset.id}`} asset={asset} selected={selectedNodeId === node.id} getImageDisplayUrl={getImageDisplayUrl} getVideoPosterDisplayUrl={getVideoPosterDisplayUrl} compact onSelect={() => onSelectNode(node.id)} onFocus={() => onSelectNode(node.id, true)} />)}</div>;
            }
            return (
              <div key={node.id} className="relative" draggable onDragStart={(event) => startLayerDrag(event, node.id)} onDragEnd={() => setDropIndicator(null)} onDragOver={(event) => updateLayerDropIndicator(event, node.id)} onDrop={(event) => dropLayerAtIndicator(event, node.id)}>
                {renderDropIndicator(node.id)}
                <button type="button" onClick={() => onSelectNode(node.id)} onDoubleClick={() => onSelectNode(node.id, true)} className={`flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left transition hover:bg-[#f3f4f6] ${selectedNodeId === node.id ? "bg-[#eef1f4]" : ""}`}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#6b7280]"><WorkflowLayerNodeIcon node={node} /></span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[#6b7280]">{getWorkflowLayerNodeLabel(node)}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WorkflowLayerNodeIcon({ node }: { node: WorkflowNode }) {
  if (node.kind === "image") return <RiImageAiLine className="h-4.5 w-4.5" />;
  if (node.kind === "video") return <RiFilmAiLine className="h-4.5 w-4.5" />;
  return <RiTextBlock className="h-4.5 w-4.5" />;
}

function getWorkflowLayerNodeLabel(node: WorkflowNode) {
  if (node.kind !== "text") return node.title || getNodeLabel(node.kind);
  return (node.data.text ?? node.data.prompt ?? node.data.outputText ?? "").trim() || node.title || getNodeLabel(node.kind);
}

function WorkflowHistoricalTextLayerRow({ node, onRestore }: { node: WorkflowNode; onRestore: () => void }) {
  return (
    <div className="group flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] text-[#4b5563] hover:bg-[#f3f4f6]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#f8fafc] text-[#5c626b]"><RiTextBlock className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1 truncate">{getWorkflowLayerNodeLabel(node)}</span>
      <button type="button" onClick={onRestore} className="hidden h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-[#367cee] hover:bg-[#eaf1ff] group-hover:block">移入</button>
    </div>
  );
}

function WorkflowAssetLayerRow({ asset, getImageDisplayUrl, getVideoPosterDisplayUrl, compact, onRestore, onSelect, onFocus, selected }: { asset: WorkflowAssetSummary; getImageDisplayUrl?: (url: string) => string; getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined; compact?: boolean; onRestore?: () => void; onSelect?: () => void; onFocus?: () => void; selected?: boolean }) {
  const previewUrl = asset.kind === "video" ? getVideoPosterDisplayUrl?.(asset.url, asset.posterUrl) : getImageDisplayUrl?.(asset.url);
  return (
    <div draggable={Boolean(onRestore)} onClick={onSelect} onDoubleClick={onFocus} onDragStart={(event) => { if (!onRestore) return; event.dataTransfer.setData("application/x-flashmuse-workflow-asset", asset.id); event.dataTransfer.setData("text/plain", asset.id); event.dataTransfer.effectAllowed = "copy"; }} className={`group flex items-center gap-2 rounded-lg px-2 text-[13px] text-[#4b5563] ${compact ? "h-9" : "h-10"} ${onRestore ? "cursor-grab hover:bg-[#f3f4f6] active:cursor-grabbing" : onSelect ? "cursor-pointer hover:bg-[#f3f4f6]" : ""} ${selected ? "bg-[#eef1f4]" : ""}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#dfe3e8] bg-[#f8fafc] text-[#5c626b]">
        {previewUrl ? <img src={previewUrl} alt="" className="h-full w-full object-cover" draggable={false} /> : asset.kind === "video" ? <RiVideoLine className="h-4 w-4" /> : <RiImageAiLine className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{asset.name}</span>
      {onRestore ? <button type="button" onClick={onRestore} className="hidden h-7 shrink-0 rounded-md px-2 text-[12px] font-medium text-[#367cee] hover:bg-[#eaf1ff] group-hover:block">移入</button> : null}
    </div>
  );
}

function WorkflowToolMenu({ activeTool, onChange }: { activeTool: "select" | "hand"; onChange: (tool: "select" | "hand") => void }) {
  const [open, setOpen] = useState(false);
  const Icon = activeTool === "hand" ? RiHand : RiCursorLine;
  const options = [
    { value: "select" as const, label: "选择", shortcut: "V", icon: RiCursorLine },
    { value: "hand" as const, label: "移动", shortcut: "H", icon: RiHand },
  ];

  return (
    <div className="relative" onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1f2329] text-white outline-none" title={activeTool === "hand" ? "移动画布" : "选择"} aria-label={activeTool === "hand" ? "移动画布" : "选择"}>
        <Icon className="h-5 w-5 shrink-0" />
      </button>
      {open ? (
        <div className="absolute bottom-full left-1/2 w-[170px] -translate-x-1/2 rounded-[12px] bg-white p-2 text-[#111111] shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
          {options.map((item) => {
            const ItemIcon = item.icon;
            return (
              <button key={item.value} type="button" onClick={() => { onChange(item.value); setOpen(false); }} className={`flex h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] font-medium hover:bg-[#eeeeee] ${activeTool === item.value ? "bg-[#eeeeee]" : ""}`}>
                <ItemIcon className="h-4 w-4 text-[#30343a]" />
                <span className="flex-1">{item.label}</span>
                <span className="text-[12px] font-normal text-[#b4b4b4]">{item.shortcut}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function WorkflowEdgesOverlay({ editor, state, tick }: { editor: Editor | null; state: WorkflowCanvasState; tick: number }) {
  void tick;
  if (!editor || state.edges.length === 0) return null;
  const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
  return <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible">{state.edges.map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return null;
    const sourceSize = getWorkflowNodeVisualSize(source);
    const targetSize = getWorkflowNodeVisualSize(target);
    const a = editor.pageToViewport({ x: source.x + sourceSize.w, y: source.y + sourceSize.h / 2 });
    const b = editor.pageToViewport({ x: target.x, y: target.y + targetSize.h / 2 });
    const mid = Math.max(60, Math.abs(b.x - a.x) / 2);
    return <path key={edge.id} d={`M ${a.x} ${a.y} C ${a.x + mid} ${a.y}, ${b.x - mid} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke="#367cee" strokeWidth="2" strokeLinecap="round" />;
  })}</svg>;
}

function NodePort({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onClick(); }} className={`absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#367cee] bg-white text-[#367cee] shadow-[0_6px_14px_rgba(54,124,238,0.22)] transition hover:bg-[#eef4ff] ${side === "left" ? "-left-3.5" : "-right-3.5"}`} title={side === "left" ? "连接输入" : "连接输出"}><RiAddLine className="h-4 w-4" /></button>;
}

function cardBorderClassName(_selected?: boolean) { return "border-[#f5f5f5]"; }
function EmptyMediaCard({ kind, selected, height }: { kind: WorkflowNodeKind; selected?: boolean; height: number }) { const Icon = getNodeIcon(kind); const iconSize = Math.max(40, Math.min(220, height * 0.16)); return <div className={`flex w-full items-center justify-center border bg-[#e6e6e6] text-[#d1d1d1] ${cardBorderClassName(selected)}`} style={{ height }}><Icon style={{ width: iconSize, height: iconSize }} /></div>; }
function WaitingCard({ isImage, startedAt, selected, height }: { isImage: boolean; startedAt?: number; selected?: boolean; height: number }) { const statusFontSize = Math.max(12, Math.min(44, height * 0.035)); const timeFontSize = Math.max(11, Math.min(34, height * 0.028)); const inset = Math.max(12, Math.min(48, height * 0.035)); return <div className={`relative w-full overflow-hidden border bg-[#e6e6e6] text-left text-[#4f6f86] ${cardBorderClassName(selected)}`} style={{ height }}><div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" /><div className="absolute z-10 inline-flex rounded-md bg-black/12 px-[0.8em] py-[0.32em] font-medium text-black/75 backdrop-blur-sm" style={{ left: inset, top: inset, fontSize: statusFontSize }}>{getVideoWaitProgress(startedAt)}%{isImage ? "生成中" : "渲染中"}</div><div className="absolute z-10 text-[#4f6f86]" style={{ left: inset, bottom: inset, fontSize: timeFontSize }}><div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(startedAt)}</div></div></div>; }
function FailedCard({ isImage, selected, height }: { isImage: boolean; selected?: boolean; height: number }) { return <div className={`relative flex w-full items-center justify-center border bg-[#e6e6e6] text-[#777777] ${cardBorderClassName(selected)}`} style={{ height }}><div className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium leading-none"><RiEmotionSadLine className="h-5 w-5" /><span>{isImage ? "图片生成失败" : "视频生成失败"}</span></div><div className="inline-flex items-center gap-1 text-[13px] font-medium text-[#367cee]"><RiResetLeftLine className="h-3.5 w-3.5" /><span>修改后重试</span></div></div>; }
function isRightClickOrContextMenuEvent(event: SyntheticEvent) {
  const nativeEvent = event.nativeEvent as MouseEvent | PointerEvent | WheelEvent;
  return event.type === "contextmenu" || ("button" in nativeEvent && nativeEvent.button === 2);
}
function TextDisplayCard({ node, height, isEditing }: { node: WorkflowNode; selected?: boolean; height: number; isEditing: boolean }) {
  const editor = useEditor();
  const runtime = useWorkflowRuntime();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const value = node.data.text ?? node.data.prompt ?? node.data.outputText ?? "";
  const markTextEvent = (event: SyntheticEvent) => {
    if (!isEditing) return;
    if (isRightClickOrContextMenuEvent(event)) return;
    event.stopPropagation();
    editor.markEventAsHandled(event);
  };
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.currentTarget.value;
    runtime.updateNode(node.id, { text: nextValue, prompt: nextValue, outputText: undefined, error: undefined, isRunning: false });
  };

  useEffect(() => {
    if (!isEditing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus({ preventScroll: true });
  }, [isEditing]);

  return (
    <div className="relative w-full overflow-hidden rounded-[20px] border-[5px] border-[#b8b8b8] bg-white" style={{ height }}>
      <textarea
        ref={textareaRef}
        value={value}
        placeholder="大段提示词或者剧本可以输入到这里..."
        readOnly={!isEditing}
        onChange={handleChange}
        onPointerDownCapture={markTextEvent}
        onPointerUpCapture={markTextEvent}
        onMouseDownCapture={markTextEvent}
        onMouseUpCapture={markTextEvent}
        onClickCapture={markTextEvent}
        onDoubleClickCapture={markTextEvent}
        onWheelCapture={(event) => { if (isEditing) event.stopPropagation(); }}
        className={`yinzao-workflow-text-scroll h-full w-full resize-none overflow-y-auto border-0 bg-transparent px-5 py-5 text-[16px] leading-7 text-[#222222] outline-none placeholder:text-[#a6a6a6] selection:bg-[#2f6df6] selection:text-white ${isEditing ? "cursor-text" : "cursor-move select-none"}`}
        style={{ font: "16px / 28px var(--font-geist-sans), Arial, Helvetica, sans-serif", pointerEvents: isEditing ? "all" : "none" }}
      />
    </div>
  );
}
function PreviewEyeButton({ label, onPreview }: { label: string; onPreview: () => void }) { return <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPreview(); }} className="absolute bottom-3 right-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-[0_8px_20px_rgba(0,0,0,0.24)] backdrop-blur transition hover:bg-black/72" aria-label={label} title={label}><RiEyeLine className="h-4.5 w-4.5" /></button>; }
function ImageDisplayCard({ node, selected, displayUrl, height }: { node: WorkflowNode; selected?: boolean; displayUrl?: string; height: number }) { if (node.data.isRunning) return <WaitingCard isImage startedAt={node.data.startedAt} selected={selected} height={height} />; if (node.data.error) return <FailedCard isImage selected={selected} height={height} />; const url = node.data.images?.[0]; if (url) return <div className={`relative w-full overflow-hidden border bg-[#e6e6e6] ${cardBorderClassName(selected)}`} style={{ height }}><img src={displayUrl ?? getStaticMediaUrl(url) ?? url} alt="生成图片" draggable={false} className="h-full w-full select-none object-cover" /></div>; return <EmptyMediaCard kind="image" selected={selected} height={height} />; }
function WorkflowInlineVideo({ node, url, onSelect }: { node: WorkflowNode; url: string; onSelect: () => void }) {
  const editor = useEditor();
  const runtime = useWorkflowRuntime();
  const lastSavedTimeRef = useRef(node.data.videoCurrentTime ?? 0);
  const displayUrl = getStaticMediaUrl(url) ?? url;
  const markVideoEvent = (event: SyntheticEvent) => {
    if (isRightClickOrContextMenuEvent(event)) return;
    event.stopPropagation();
    editor.markEventAsHandled(event);
  };
  const saveCurrentTime = (time: number, force = false) => {
    if (!Number.isFinite(time)) return;
    if (!force && Math.abs(time - lastSavedTimeRef.current) < 0.5) return;
    lastSavedTimeRef.current = time;
    runtime.updateNode(node.id, { videoCurrentTime: time });
  };
  const saveVideoMetadata = (video: HTMLVideoElement) => {
    const dimensions = video.videoWidth > 0 && video.videoHeight > 0 ? { width: video.videoWidth, height: video.videoHeight } : undefined;
    const durationSeconds = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
    if (!dimensions && !durationSeconds) return;
    runtime.updateNode(node.id, { videoDimensions: dimensions ?? node.data.videoDimensions, durationSeconds: durationSeconds ?? node.data.durationSeconds });
    runtime.onGeneratedMedia?.({
      nodeId: node.id,
      kind: "video",
      urls: [url],
      posterUrl: node.data.posterUrl,
      sourcePrompt: node.data.prompt ?? "",
      model: node.data.model,
      ratio: node.data.ratio,
      resolution: node.data.resolution,
      duration: node.data.duration,
      dimensions: dimensions ? { [url]: dimensions } : undefined,
      durationSeconds: durationSeconds ? { [url]: durationSeconds } : undefined,
    });
  };

  return <div className="relative h-full w-full cursor-default bg-[#e6e6e6]" style={{ pointerEvents: "all" }}><video src={displayUrl} className="h-full w-full select-none object-cover" style={{ pointerEvents: "all", cursor: "default" }} draggable={false} controls playsInline preload="auto" onLoadedMetadata={(event) => saveVideoMetadata(event.currentTarget)} onDragStart={(event) => event.preventDefault()} onTimeUpdate={(event) => saveCurrentTime(event.currentTarget.currentTime)} onPause={(event) => saveCurrentTime(event.currentTarget.currentTime, true)} onSeeked={(event) => saveCurrentTime(event.currentTarget.currentTime, true)} onEnded={(event) => saveCurrentTime(event.currentTarget.currentTime, true)} onPointerDownCapture={markVideoEvent} onPointerUpCapture={markVideoEvent} onMouseDownCapture={markVideoEvent} onMouseUpCapture={markVideoEvent} onClickCapture={markVideoEvent} onDoubleClickCapture={markVideoEvent} /><div className="absolute left-0 right-0 top-0 z-10 cursor-default" style={{ bottom: 112, pointerEvents: "all" }} onDragStart={(event) => event.preventDefault()} onPointerDown={(event) => { if (event.button !== 2) onSelect(); }} /></div>;
}

function VideoDisplayCard({ node, selected, height, onSelect }: { node: WorkflowNode; selected?: boolean; height: number; onSelect: () => void }) { if (node.data.isRunning) return <WaitingCard isImage={false} startedAt={node.data.startedAt} selected={selected} height={height} />; if (node.data.error) return <FailedCard isImage={false} selected={selected} height={height} />; if (node.data.videoUrl) return <div className={`relative w-full overflow-hidden border bg-[#e6e6e6] ${cardBorderClassName(selected)}`} style={{ height }}><WorkflowInlineVideo node={node} url={node.data.videoUrl} onSelect={onSelect} /></div>; return <EmptyMediaCard kind="video" selected={selected} height={height} />; }

function getWorkflowEditableText(element: HTMLElement) {
  let text = "";
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent ?? "";
        return;
      }
      if (child.nodeName === "BR") {
        if (!(child instanceof HTMLElement) || child.dataset.trailingBreak !== "true") text += "\n";
        return;
      }
      walk(child);
    });
  };
  walk(element);
  const normalizedText = text.replace(/\u00a0/g, " ");
  return normalizedText.replace(/\n/g, "") === "" ? "" : normalizedText;
}

function appendWorkflowEditorText(element: HTMLElement, text: string) {
  text.split("\n").forEach((line, index) => {
    if (index > 0) element.append(document.createElement("br"));
    if (line) element.append(document.createTextNode(line));
  });
}

function getWorkflowMentionRanges(value: string, validReferences: Set<string>) {
  const names = Array.from(validReferences).filter(Boolean).sort((a, b) => b.length - a.length);
  const ranges: Array<{ start: number; end: number }> = [];
  if (names.length === 0) return ranges;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "@") continue;
    const matchedName = names.find((name) => value.startsWith(`@${name}`, index));
    if (!matchedName) continue;
    const end = index + matchedName.length + 1;
    ranges.push({ start: index, end });
    index = end - 1;
  }
  return ranges;
}

function getWorkflowMentionRangeForDeletion(value: string, cursorOffset: number, direction: "backward" | "forward", validReferences: Set<string>) {
  const probeOffset = direction === "backward" ? cursorOffset - 1 : cursorOffset;
  if (probeOffset < 0 || probeOffset >= value.length) return undefined;
  return getWorkflowMentionRanges(value, validReferences).find((range) => probeOffset >= range.start && probeOffset < range.end);
}

function getWorkflowAtQueryAtCursor(text: string, cursorOffset: number) {
  const cursor = Math.min(Math.max(0, cursorOffset), text.length);
  const beforeCursor = text.slice(0, cursor);
  const match = beforeCursor.match(/@([^@\s，。！？；;、]*)$/);
  if (!match) return null;
  return { index: cursor - match[0].length, query: match[1] ?? "", cursor };
}

function getWorkflowSelectionTextOffset(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return getWorkflowEditableText(element).length;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return getWorkflowEditableText(element).length;

  let offset = 0;
  let found = false;
  const nodeTextLength = (node: Node): number => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
    if (node.nodeName === "BR") return node instanceof HTMLElement && node.dataset.trailingBreak === "true" ? 0 : 1;
    return Array.from(node.childNodes).reduce((sum, child) => sum + nodeTextLength(child), 0);
  };
  const walk = (node: Node) => {
    if (found) return;

    if (node instanceof HTMLElement && node.dataset.mention === "true") {
      offset += nodeTextLength(node);
      if (node.contains(range.startContainer)) found = true;
      return;
    }

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.startOffset;
      } else {
        Array.from(node.childNodes).slice(0, range.startOffset).forEach((child) => { offset += nodeTextLength(child); });
      }
      found = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE || node.nodeName === "BR") {
      offset += nodeTextLength(node);
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(element);
  return found ? offset : getWorkflowEditableText(element).length;
}

function setWorkflowSelectionTextOffset(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  let remaining = Math.max(0, offset);
  const placeCaret = (container: Node): boolean => {
    const children = Array.from(container.childNodes);
    for (const child of children) {
      if (child instanceof HTMLElement && child.dataset.mention === "true") {
        const length = child.textContent?.length ?? 0;
        if (remaining <= length) {
          const range = document.createRange();
          if (remaining <= 0) range.setStartBefore(child);
          else range.setStartAfter(child);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= length;
        continue;
      }

      if (child.nodeType === Node.TEXT_NODE) {
        const length = child.textContent?.length ?? 0;
        if (remaining <= length) {
          const range = document.createRange();
          range.setStart(child, remaining);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= length;
        continue;
      }
      if (child.nodeName === "BR") {
        if (remaining <= 1) {
          const parent = child.parentNode;
          if (!parent) return false;
          const range = document.createRange();
          range.setStart(parent, children.indexOf(child) + 1);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          return true;
        }
        remaining -= 1;
        continue;
      }
      if (placeCaret(child)) return true;
    }
    return false;
  };
  if (placeCaret(element)) return;

  if (element.lastChild?.nodeName === "BR") {
    const range = document.createRange();
    range.setStart(element, element.childNodes.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode() as Text | null;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function renderWorkflowEditorContent(element: HTMLElement, value: string, validReferences: Set<string>) {
  element.replaceChildren();
  if (!value) return;
  let cursor = 0;
  getWorkflowMentionRanges(value, validReferences).forEach((range) => {
    if (range.start > cursor) appendWorkflowEditorText(element, value.slice(cursor, range.start));
    const mention = document.createElement("span");
    mention.className = "text-[#4f7cff]";
    mention.dataset.mention = "true";
    mention.contentEditable = "false";
    mention.textContent = value.slice(range.start, range.end);
    element.append(mention);
    cursor = range.end;
  });
  if (cursor < value.length) appendWorkflowEditorText(element, value.slice(cursor));
  if (value.endsWith("\n")) {
    const trailingBreak = document.createElement("br");
    trailingBreak.dataset.trailingBreak = "true";
    element.append(trailingBreak);
  }
}

function shouldRenderWorkflowEditorContent(element: HTMLElement, value: string, validReferences: Set<string>) {
  if (getWorkflowEditableText(element) !== value) return true;
  const expectedMentions = getWorkflowMentionRanges(value, validReferences).length;
  const renderedMentions = element.querySelectorAll("[data-mention='true']").length;
  return expectedMentions !== renderedMentions;
}

function isWorkflowEditorScrolledToBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 8;
}

function preserveWorkflowEditorScroll(element: HTMLElement, callback: () => void) {
  const wasAtBottom = isWorkflowEditorScrolledToBottom(element);
  const previousScrollTop = element.scrollTop;
  callback();
  element.scrollTop = wasAtBottom ? element.scrollHeight : previousScrollTop;
}

function renderWorkflowInlineFormatting(text: string) {
  const pattern = /(\*\*[^*]+\*\*|\[red\][\s\S]+?\[\/red\]|\[blue\][\s\S]+?\[\/blue\])/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const cleanText = (value: string) => value.replace(/\*\*/g, "").replace(/__/g, "").replace(/`/g, "");

  text.replace(pattern, (match, _token, index: number) => {
    if (index > lastIndex) nodes.push(cleanText(text.slice(lastIndex, index)));
    if (match.startsWith("**")) {
      nodes.push(<strong key={`${match}-${index}`} className="font-semibold text-[#111111]">{match.slice(2, -2)}</strong>);
    } else if (match.startsWith("[red]")) {
      nodes.push(<span key={`${match}-${index}`} className="rounded-md bg-[#fff1f1] px-1.5 py-0.5 text-[13px] font-semibold text-[#d36b63]">{match.slice(5, -6)}</span>);
    } else {
      nodes.push(<span key={`${match}-${index}`} className="rounded-md bg-[#eef5ff] px-1.5 py-0.5 text-[13px] font-semibold text-[#6f95d8]">{match.slice(6, -7)}</span>);
    }
    lastIndex = index + match.length;
    return match;
  });

  if (lastIndex < text.length) nodes.push(cleanText(text.slice(lastIndex)));
  return nodes.length > 0 ? nodes : cleanText(text);
}

function sanitizeWorkflowTextOutputForDisplay(content: string) {
  const raw = content.trim();
  let text = raw;
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw) as { content?: unknown; displayText?: unknown };
      text = typeof parsed.content === "string" ? parsed.content : typeof parsed.displayText === "string" ? parsed.displayText : raw;
    } catch {}
  }

  return sanitizeModelOutputText(text)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[{[][^\n]*$/gm, "")
    .replace(/\r\n|\n|\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/^```[\w-]*\s*$/gm, "")
    .replace(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function extractWorkflowTextContent(content: string | undefined) {
  const raw = (content ?? "").trim();
  if (!raw) return "";
  if (!raw.startsWith("{")) return raw;

  try {
    const parsed = JSON.parse(raw) as { content?: unknown; displayText?: unknown };
    if (typeof parsed.content === "string") return parsed.content;
    if (typeof parsed.displayText === "string") return parsed.displayText;
  } catch {}

  return raw;
}

function WorkflowFormattedText({ content }: { content: string }) {
  const displayContent = sanitizeWorkflowTextOutputForDisplay(content);
  const blocks = displayContent.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return null;

  const renderLine = (line: string, key: string, isFirstLine: boolean) => {
    const divider = /^-{3,}$/.test(line);
    const heading = line.match(/^(#{1,3})\s*(.*)$/);
    const boldHeading = line.match(/^\*\*([^*]{2,24})\*\*$/);
    const labeledListItem = line.match(/^(?:[-*]|\d+[.、])\s*(.{2,30}?[：:])\s*([\s\S]*)$/);
    const bulletItem = line.match(/^[-*]\s+([\s\S]+)$/);
    const plainHeading = isFirstLine && line.length <= 28 && !/[。！？.!?]$/.test(line);

    if (divider) return <hr key={key} className="my-3 border-[#d8d8d8]" />;
    if (heading || boldHeading || plainHeading) {
      const headingText = heading ? heading[2]?.trim() ?? "" : boldHeading ? boldHeading[1] : line;
      if (!headingText) return null;
      return <h2 key={key} className="pt-1 text-[17px] font-semibold leading-7 tracking-[-0.01em] text-[#111111]">{renderWorkflowInlineFormatting(headingText)}</h2>;
    }
    if (labeledListItem) {
      return <div key={key} className="flex gap-2"><span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#111111]" aria-hidden="true" /><p className="min-w-0 flex-1"><span className="font-semibold text-[#111111]">{renderWorkflowInlineFormatting(labeledListItem[1])}</span>{labeledListItem[2] ? renderWorkflowInlineFormatting(labeledListItem[2]) : null}</p></div>;
    }
    if (bulletItem) {
      return <div key={key} className="flex gap-2"><span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#111111]" aria-hidden="true" /><p className="min-w-0 flex-1">{renderWorkflowInlineFormatting(bulletItem[1])}</p></div>;
    }
    return <p key={key}>{renderWorkflowInlineFormatting(line)}</p>;
  };

  return <div className="space-y-3">{blocks.map((block, blockIndex) => <div key={blockIndex} className="space-y-2">{block.split(/\n/).map((line) => line.trim()).filter(Boolean).map((line, lineIndex) => renderLine(line, `${blockIndex}-${lineIndex}`, blockIndex === 0 && lineIndex === 0))}</div>)}</div>;
}

function WorkflowUploadProgressOverlay({ progress }: { progress?: number }) {
  const safeProgress = Math.min(100, Math.max(0, Math.floor(progress ?? 8)));

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-black/18">
      <div className="h-1 w-full bg-white/25">
        <div className="h-full bg-[#367cee] transition-all" style={{ width: `${safeProgress}%` }} />
      </div>
    </div>
  );
}

function WorkflowUploadIcon({ kind }: { kind: WorkflowUploadKind }) {
  if (kind === "video") return <RiVideoOnLine className="h-5 w-5" aria-hidden="true" />;
  if (kind === "audio") return <RiVoiceprintLine className="h-5 w-5" aria-hidden="true" />;
  if (kind === "document") return <RiFileTextLine className="h-5 w-5" aria-hidden="true" />;
  return <RiImageLine className="h-5 w-5" aria-hidden="true" />;
}

function WorkflowMentionEditor({ value, placeholder, running, validReferences, focusRequest, onChange, onRun, onPasteImages, onLimit, onCursorChange, onAtTrigger, onAtClose }: { value: string; placeholder: string; running?: boolean; validReferences: Set<string>; focusRequest?: { offset: number; key: number }; onChange: (value: string) => void; onRun: () => void; onPasteImages: (files: File[]) => void; onLimit: () => void; onCursorChange: (offset: number) => void; onAtTrigger: (query: { index: number; query: string; cursor: number }) => void; onAtClose: () => void }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isComposingRef = useRef(false);
  const scrollSnapshotRef = useRef<{ wasAtBottom: boolean; scrollTop: number } | null>(null);
  const handledFocusRequestKeyRef = useRef<number | null>(null);
  const isApplyingFocusRequestRef = useRef(false);
  const validReferencesKey = useMemo(() => Array.from(validReferences).sort().join("\n"), [validReferences]);

  const captureScroll = useCallback((element: HTMLElement) => {
    scrollSnapshotRef.current = { wasAtBottom: isWorkflowEditorScrolledToBottom(element), scrollTop: element.scrollTop };
  }, []);

  const restoreScroll = useCallback((element: HTMLElement) => {
    const snapshot = scrollSnapshotRef.current;
    if (!snapshot) return;
    const apply = () => { element.scrollTop = snapshot.wasAtBottom ? element.scrollHeight : snapshot.scrollTop; };
    apply();
    requestAnimationFrame(apply);
  }, []);

  const syncEditor = useCallback((nextValue: string, caretOffset?: number) => {
    const element = editorRef.current;
    if (!element) return;
    preserveWorkflowEditorScroll(element, () => {
      renderWorkflowEditorContent(element, nextValue, validReferences);
      setWorkflowSelectionTextOffset(element, caretOffset ?? nextValue.length);
    });
  }, [validReferences]);

  const commitInput = useCallback((rawValue: string, caretOffset: number, options?: { syncDom?: boolean }) => {
    if (running) return;
    const nextValue = Array.from(rawValue).slice(0, MAX_WORKFLOW_PROMPT_LENGTH).join("");
    const nextCaretOffset = Math.min(caretOffset, nextValue.length);
    if (rawValue !== nextValue) onLimit();
    onCursorChange(nextCaretOffset);
    onChange(nextValue);
    const atQuery = getWorkflowAtQueryAtCursor(nextValue, nextCaretOffset);
    if (atQuery) onAtTrigger(atQuery);
    else onAtClose();
    if (options?.syncDom || rawValue !== nextValue) syncEditor(nextValue, nextCaretOffset);
  }, [onAtClose, onAtTrigger, onChange, onCursorChange, onLimit, running, syncEditor]);

  useEffect(() => {
    const element = editorRef.current;
    if (!element || isComposingRef.current || !shouldRenderWorkflowEditorContent(element, value, validReferences)) return;
    const currentCaretOffset = getWorkflowSelectionTextOffset(element);
    preserveWorkflowEditorScroll(element, () => {
      renderWorkflowEditorContent(element, value, validReferences);
      setWorkflowSelectionTextOffset(element, Math.min(currentCaretOffset, value.length));
    });
  }, [validReferences, validReferencesKey, value]);

  useEffect(() => {
    const element = editorRef.current;
    if (!element || !focusRequest) return;
    if (handledFocusRequestKeyRef.current === focusRequest.key) return;
    handledFocusRequestKeyRef.current = focusRequest.key;
    isApplyingFocusRequestRef.current = true;
    element.focus();
    syncEditor(value, Math.min(focusRequest.offset, value.length));
    requestAnimationFrame(() => { isApplyingFocusRequestRef.current = false; });
  }, [focusRequest, syncEditor, value]);

  const syncCursorFromDom = useCallback(() => {
    if (running) return;
    if (isComposingRef.current) return;
    if (isApplyingFocusRequestRef.current) return;
    const element = editorRef.current;
    if (!element) return;
    const cursorOffset = getWorkflowSelectionTextOffset(element);
    onCursorChange(cursorOffset);
    const atQuery = getWorkflowAtQueryAtCursor(getWorkflowEditableText(element), cursorOffset);
    if (atQuery) onAtTrigger(atQuery);
    else onAtClose();
  }, [onAtClose, onAtTrigger, onCursorChange, running]);

  return (
    <div className="relative">
      {!value ? <div className="pointer-events-none absolute left-2 top-1 z-20 text-[14px] leading-6 text-[#b3b3b3]">{placeholder}</div> : null}
      <div
        ref={editorRef}
        contentEditable={!running}
        role="textbox"
        aria-multiline="true"
        aria-disabled={running}
        translate="no"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        suppressContentEditableWarning
        onCompositionStart={(event) => { captureScroll(event.currentTarget); isComposingRef.current = true; }}
        onCompositionEnd={(event) => { if (running) return; isComposingRef.current = false; const element = event.currentTarget; commitInput(getWorkflowEditableText(element), getWorkflowSelectionTextOffset(element)); restoreScroll(element); }}
        onBeforeInput={(event) => { if (running) return; captureScroll(event.currentTarget); }}
        onInput={(event) => { if (running) return; if (isComposingRef.current) return; const element = event.currentTarget; commitInput(getWorkflowEditableText(element), getWorkflowSelectionTextOffset(element)); restoreScroll(element); }}
        onPaste={(event) => {
          if (running) {
            event.preventDefault();
            return;
          }
          captureScroll(event.currentTarget);
          const files = Array.from(event.clipboardData.files ?? []);
          if (files.some((file) => file.type.startsWith("image/"))) {
            event.preventDefault();
            onPasteImages(files);
            return;
          }
          const text = event.clipboardData.getData("text/plain");
          if (!text) return;
          event.preventDefault();
          const element = event.currentTarget;
          const selectionOffset = getWorkflowSelectionTextOffset(element);
          const currentText = getWorkflowEditableText(element);
          const selection = window.getSelection();
          const selectedTextLength = selection?.rangeCount && element.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.getRangeAt(0).toString().length : 0;
          const nextText = `${currentText.slice(0, selectionOffset)}${text}${currentText.slice(selectionOffset + selectedTextLength)}`;
          commitInput(nextText, selectionOffset + text.length, { syncDom: true });
          restoreScroll(element);
        }}
        onKeyDown={(event) => {
          if (running) {
            event.preventDefault();
            return;
          }
          captureScroll(event.currentTarget);
          if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const element = event.currentTarget;
            const selection = window.getSelection();
            const hasRangeSelection = Boolean(selection?.rangeCount && element.contains(selection.getRangeAt(0).commonAncestorContainer) && selection.getRangeAt(0).toString().length > 0);
            if (!hasRangeSelection) {
              const currentText = getWorkflowEditableText(element);
              const cursorOffset = getWorkflowSelectionTextOffset(element);
              const mentionRange = getWorkflowMentionRangeForDeletion(currentText, cursorOffset, event.key === "Backspace" ? "backward" : "forward", validReferences);
              if (mentionRange) {
                event.preventDefault();
                const nextText = `${currentText.slice(0, mentionRange.start)}${currentText.slice(mentionRange.end)}`;
                commitInput(nextText, mentionRange.start, { syncDom: true });
                restoreScroll(element);
                return;
              }
            }
          }
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (!event.shiftKey) {
            onRun();
            return;
          }
          const element = event.currentTarget;
          const selectionOffset = getWorkflowSelectionTextOffset(element);
          const currentText = getWorkflowEditableText(element);
          commitInput(`${currentText.slice(0, selectionOffset)}\n${currentText.slice(selectionOffset)}`, selectionOffset + 1, { syncDom: true });
          restoreScroll(element);
        }}
        onKeyUp={syncCursorFromDom}
        onMouseUp={syncCursorFromDom}
        onFocus={syncCursorFromDom}
        className={`workflow-prompt-textarea min-h-[52px] w-full overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent px-2 py-1 outline-none selection:bg-[#2f6df6] selection:text-white ${running ? "cursor-not-allowed text-[#999999] caret-transparent" : "text-[#111111] caret-[#111111]"}`}
        style={{ maxHeight: 500, font: "14px / 24px var(--font-geist-sans), Arial, Helvetica, sans-serif" }}
      />
    </div>
  );
}

function WorkflowPromptBox({ node, value, placeholder, onChange, children, running, onRun }: { node: WorkflowNode; value: string; placeholder: string; onChange: (value: string) => void; children: ReactNode; running?: boolean; onRun: () => void }) {
  const runtime = useWorkflowRuntime();
  const [isReferenceMenuOpen, setIsReferenceMenuOpen] = useState(false);
  const [referenceGroupType, setReferenceGroupType] = useState("character_image");
  const [activeAtQuery, setActiveAtQuery] = useState<{ index: number; query: string; cursor: number } | null>(null);
  const [cursorOffset, setCursorOffset] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{ offset: number; key: number }>();
  const [uploadError, setUploadError] = useState("");
  const suppressAtTriggerUntilRef = useRef(0);
  const focusRequestKeyRef = useRef(0);
  const uploadsRef = useRef<WorkflowUploadItem[]>(node.data.uploads ?? []);
  const uploadRule = getEffectiveWorkflowUploadRule(node);
  const uploadButtons = [
    { label: "图片", icon: RiImageLine, ariaLabel: "上传图片", kind: "image" as const },
    { label: "视频", icon: RiVideoOnLine, ariaLabel: "上传视频", kind: "video" as const },
    { label: "音频", icon: RiVoiceprintLine, ariaLabel: "上传音频", kind: "audio" as const },
    { label: "文件", icon: RiFileTextLine, ariaLabel: "上传文件", kind: "document" as const },
  ];

  useEffect(() => {
    const close = () => setIsReferenceMenuOpen(false);
    window.addEventListener("workflow-close-popups", close);
    return () => window.removeEventListener("workflow-close-popups", close);
  }, []);

  useEffect(() => {
    uploadsRef.current = node.data.uploads ?? [];
  }, [node.data.uploads]);

  useEffect(() => {
    if (!value.includes("@")) return;
    runtime.onLoadReferenceAssets?.();
  }, [runtime.onLoadReferenceAssets, value]);

  const insertReferenceText = (name: string) => {
    const referenceText = `@${name} `;
    const insertOffset = activeAtQuery ? activeAtQuery.index : Math.min(Math.max(0, cursorOffset), value.length);
    const insertEnd = activeAtQuery ? activeAtQuery.cursor : insertOffset;
    const nextValue = Array.from(`${value.slice(0, insertOffset)}${referenceText}${value.slice(insertEnd)}`).slice(0, MAX_WORKFLOW_PROMPT_LENGTH).join("");
    const nextOffset = Math.min(MAX_WORKFLOW_PROMPT_LENGTH, insertOffset + referenceText.length);
    suppressAtTriggerUntilRef.current = Date.now() + 500;
    onChange(nextValue);
    setCursorOffset(nextOffset);
    focusRequestKeyRef.current += 1;
    setFocusRequest({ offset: nextOffset, key: focusRequestKeyRef.current });
    setActiveAtQuery(null);
    setIsReferenceMenuOpen(false);
  };
  const insertAssetReference = (asset: WorkflowReferenceAsset) => insertReferenceText(asset.name);
  const updateUploads = (updater: (uploads: WorkflowUploadItem[]) => WorkflowUploadItem[]) => {
    const nextUploads = updater(uploadsRef.current);
    uploadsRef.current = nextUploads;
    runtime.updateNode(node.id, { uploads: nextUploads });
  };
  const removeUpload = (uploadId: string) => {
    const removing = (node.data.uploads ?? []).find((upload) => upload.id === uploadId);
    if (removing?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(removing.previewUrl);
    updateUploads((uploads) => uploads.filter((upload) => upload.id !== uploadId));
  };
  const handleUploadFiles = (kind: WorkflowUploadKind, files: File[]) => {
    setUploadError("");
    const kindRule = uploadRule[kind];
    if (!kindRule.enabled) {
      setUploadError(kind === "image" ? "当前模型不支持上传图片" : kind === "video" ? "当前模型不支持上传视频" : kind === "audio" ? "当前模型不支持上传音频" : "当前模型不支持上传文件");
      return;
    }
    const accepted = files.filter((file) => {
      const detectedKind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : getUploadKindFromFileName(file.name);
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      return detectedKind === kind && kindRule.formats.includes(extension) && file.size <= kindRule.maxSizeMb * 1024 * 1024;
    });
    if (accepted.length === 0) {
      setUploadError("没有符合当前类型和格式限制的文件");
      return;
    }
    const currentCount = (node.data.uploads ?? []).filter((item) => item.kind === kind).length;
    const nextFiles = accepted.slice(0, Math.max(0, kindRule.maxCount - currentCount));
    if (nextFiles.length === 0) {
      setUploadError(`当前类型最多支持 ${kindRule.maxCount} 个文件`);
      return;
    }
    const uploadItems = nextFiles.map((file): WorkflowUploadItem => ({ id: createId("workflow_upload"), kind, name: file.name, previewUrl: kind === "image" || kind === "video" ? URL.createObjectURL(file) : undefined, status: "uploading", progress: 8 }));
    updateUploads((uploads) => [...uploads, ...uploadItems]);
    nextFiles.forEach((file, index) => {
      const item = uploadItems[index];
      if (!item) return;
      if (kind === "document") {
        void readWorkflowDocumentText(file, (progress) => {
          updateUploads((uploads) => uploads.map((upload) => upload.id === item.id && upload.status === "uploading" ? { ...upload, progress } : upload));
        }).then((text) => {
          updateUploads((uploads) => uploads.map((upload) => upload.id === item.id ? { ...upload, text, status: "ready", progress: 100 } : upload));
        }).catch((error) => {
          updateUploads((uploads) => uploads.map((upload) => upload.id === item.id ? { ...upload, status: "error", progress: 100, error: toUserErrorMessage(error, "读取失败") } : upload));
        });
        return;
      }

      const uploadPromise = kind === "image" ? uploadWorkflowImage(file) : uploadWorkflowFile(file, kind as Exclude<WorkflowUploadKind, "image">);
      window.setTimeout(() => {
        updateUploads((uploads) => uploads.map((upload) => upload.id === item.id && upload.status === "uploading" ? { ...upload, progress: 42 } : upload));
      }, 250);
      window.setTimeout(() => {
        updateUploads((uploads) => uploads.map((upload) => upload.id === item.id && upload.status === "uploading" ? { ...upload, progress: 78 } : upload));
      }, 900);
      void uploadPromise.then((url) => {
        updateUploads((uploads) => uploads.map((upload) => upload.id === item.id ? { ...upload, url, status: "ready", progress: 100 } : upload));
      }).catch((error) => {
        updateUploads((uploads) => uploads.map((upload) => upload.id === item.id ? { ...upload, status: "error", progress: 100, error: toUserErrorMessage(error, "上传失败") } : upload));
      });
    });
  };
  const validReferenceNames = useMemo(() => new Set([...runtime.referenceAssets.map((asset) => asset.name), ...(node.data.uploads ?? []).filter((upload) => upload.status === "ready").map(getWorkflowUploadReferenceName)]), [node.data.uploads, runtime.referenceAssets]);
  const referenceGroups = workflowReferenceGroupOrder.map((groupType) => ({
    type: groupType,
    label: runtime.referenceAssets.find((asset) => asset.groupType === groupType)?.groupLabel ?? (groupType === "character_image" ? "角色图片" : groupType === "scene_image" ? "场景图片" : groupType === "shot_image" ? "分镜图片" : "上传图片"),
    assets: runtime.referenceAssets.filter((asset) => asset.groupType === groupType && (!activeAtQuery?.query || asset.name.includes(activeAtQuery.query))),
  }));
  const activeReferenceGroup = referenceGroups.find((group) => group.type === referenceGroupType && group.assets.length > 0) ?? referenceGroups.find((group) => group.assets.length > 0) ?? referenceGroups[0];
  const isReferenceAssetsLoading = runtime.referenceAssetsLoadStatus === "loading";
  const isWaitingForMentionReferences = value.includes("@") && (runtime.referenceAssetsLoadStatus === "idle" || runtime.referenceAssetsLoadStatus === "loading");

  return (
    <div
      className="relative z-20 rounded-[26px] border-2 border-[#f1f2f2] bg-white/78 px-4 py-4 shadow-none backdrop-blur-[18px] transition focus-within:border-white/70 focus-within:shadow-[0_10px_32px_rgba(0,0,0,0.12)]"
      onPointerDownCapture={(event) => { if (!(event.target as HTMLElement).closest("[data-workflow-menu]")) closeWorkflowPopups(); }}
    >
      <div className="mb-2 flex min-h-[76px] flex-wrap items-start gap-2 px-0.5">
        {uploadButtons.filter(({ kind }) => uploadRule[kind].enabled).map(({ label, icon: Icon, ariaLabel, kind }) => (
          <label key={label} style={{ backgroundColor: "#ededed" }} className="workflow-upload-chip flex h-[70px] w-[64px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] text-[#a7a7a7] transition" aria-label={ariaLabel} title={getWorkflowUploadAccept(uploadRule, kind)}>
            <input type="file" hidden multiple accept={getWorkflowUploadAccept(uploadRule, kind)} onChange={(event) => { handleUploadFiles(kind, Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            <span className="text-[12px] leading-none">{label}</span>
          </label>
        ))}
        {(node.data.uploads ?? []).map((upload) => {
          const referenceName = getWorkflowUploadReferenceName(upload);
          const canInsert = upload.status === "ready";
          const mediaSrc = upload.previewUrl ?? upload.url;
          const isVisual = upload.kind === "image" || upload.kind === "video";

          return (
            <div key={upload.id} className={isVisual ? "group relative h-[70px] w-[70px] shrink-0 overflow-hidden rounded-[16px] border border-[#e5e5e5] bg-[#f7f7f7]" : "group relative flex h-[70px] w-[132px] shrink-0 items-center gap-2 overflow-hidden rounded-[16px] bg-[#ededed] px-3 text-left text-[#777777]"}>
              {isVisual ? (
                mediaSrc ? upload.kind === "video" ? (
                  <video src={mediaSrc} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaSrc} alt={upload.name} className="h-full w-full object-cover" />
                ) : <div className="flex h-full w-full items-center justify-center text-[#b5b5b5]"><WorkflowUploadIcon kind={upload.kind} /></div>
              ) : (
                <>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/80 text-[#777777] ring-1 ring-black/5">
                    <WorkflowUploadIcon kind={upload.kind} />
                  </div>
                  <div className="min-w-0 flex-1 pr-4">
                    <button type="button" disabled={!canInsert} onClick={() => insertReferenceText(referenceName)} className="block w-full truncate text-left text-[12px] font-medium leading-4 text-[#333333] disabled:cursor-not-allowed disabled:text-[#999999]">
                      {canInsert ? `@${referenceName}` : upload.status === "error" ? "上传失败" : "上传中..."}
                    </button>
                    <div className="mt-0.5 truncate text-[10px] leading-3 text-[#999999]">{upload.name}</div>
                  </div>
                </>
              )}
              <button type="button" onClick={(event) => { event.stopPropagation(); removeUpload(upload.id); }} className="absolute right-1 top-1 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70" aria-label="移除上传文件">
                <RiCloseLine className="h-3 w-3" aria-hidden="true" />
              </button>
              {isVisual ? (
                <button type="button" disabled={!canInsert} onClick={() => insertReferenceText(referenceName)} className="absolute inset-x-0 bottom-0 z-10 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-4 text-left font-medium leading-4 text-white transition disabled:cursor-not-allowed disabled:opacity-75">
                  <span className="text-[10px] leading-4">{canInsert ? `@${referenceName}` : upload.status === "error" ? "上传失败" : "上传中..."}</span>
                </button>
              ) : null}
              {upload.status === "uploading" ? <WorkflowUploadProgressOverlay progress={upload.progress} /> : null}
              {upload.status === "error" && isVisual ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/58 px-2 text-center text-[12px] font-semibold text-white">上传失败</div> : null}
            </div>
          );
        })}
      </div>
      {uploadError ? <div className="mb-2 px-2 text-[12px] leading-5 text-red-500">{uploadError}</div> : null}
      {isWaitingForMentionReferences ? (
        <div className="flex min-h-[52px] items-center gap-2 px-2 py-1 text-[13px] leading-6 text-[#8a8a8a]" style={{ font: "14px / 24px var(--font-geist-sans), Arial, Helvetica, sans-serif" }}>
          <RiLoader4Line className="h-4 w-4 animate-spin text-[#367cee]" aria-hidden="true" />
          <span>加载引用资产...</span>
        </div>
      ) : (
        <WorkflowMentionEditor value={value} placeholder={placeholder} running={running} validReferences={validReferenceNames} focusRequest={focusRequest} onChange={onChange} onRun={onRun} onPasteImages={(files) => handleUploadFiles("image", files)} onLimit={() => setUploadError("最多输入2000字")} onCursorChange={setCursorOffset} onAtTrigger={(query) => { if (Date.now() < suppressAtTriggerUntilRef.current) return; runtime.onLoadReferenceAssets?.(); setActiveAtQuery(query); setIsReferenceMenuOpen(true); }} onAtClose={() => { setActiveAtQuery(null); setIsReferenceMenuOpen(false); }} />
      )}
      <div className="mt-3 flex min-w-0 flex-nowrap items-center justify-between gap-3 pb-0.5">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-[12px]">
          <div data-workflow-menu className="relative shrink-0" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => { const shouldOpen = !isReferenceMenuOpen; closeWorkflowPopups(); setActiveAtQuery(null); if (shouldOpen) runtime.onLoadReferenceAssets?.(); setIsReferenceMenuOpen(shouldOpen); }} className={`yinzao-tool-button inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] p-0 text-[#777777] outline-none transition ${isReferenceMenuOpen ? "yinzao-tool-button-active" : ""}`} aria-label="引用资产">
              <span className="text-[15px] font-semibold leading-none">@</span>
            </button>
            {isReferenceMenuOpen ? (
              <div className="absolute bottom-full left-0 z-[10000] mb-2 max-h-80 w-[380px] overflow-y-auto rounded-[12px] bg-white p-2 text-left shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
                <div className="px-2 pb-2 text-[12px] text-[#8a8a8a]">引用资产</div>
                {isReferenceAssetsLoading ? <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] font-medium text-[#367cee]"><RiLoader4Line className="h-[18px] w-[18px] animate-spin" /><span>加载中...</span></div> : null}
                {!isReferenceAssetsLoading ? <>
                  <div className="mb-2 flex flex-nowrap gap-1.5 px-1">
                    {referenceGroups.map((group) => {
                      const count = group.assets.length;
                      const isActive = activeReferenceGroup?.type === group.type;
                      return (
                        <button key={group.type} type="button" disabled={count === 0} onClick={() => setReferenceGroupType(group.type)} className={isActive ? "h-7 shrink-0 whitespace-nowrap rounded-[8px] bg-[#111111] px-2 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40" : "h-7 shrink-0 whitespace-nowrap rounded-[8px] bg-[#f4f4f4] px-2 text-[12px] font-medium text-[#666666] transition hover:bg-[#ececec] disabled:cursor-not-allowed disabled:opacity-40"}>
                          <span className="whitespace-nowrap text-[12px] leading-none">{group.label}({count})</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeReferenceGroup?.assets.length > 0 ? activeReferenceGroup.assets.map((asset) => (
                    <button key={asset.id} type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); insertAssetReference(asset); }} className="flex h-12 w-full items-center gap-3 rounded-[8px] px-2 text-left transition hover:bg-[#f5f5f5]">
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-[8px] bg-[#eeeeee]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.thumbnailUrl ?? asset.url} alt={asset.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#222222]">@{asset.name}</div>
                        <div className="text-[11px] text-[#999999]">{asset.groupLabel}</div>
                      </div>
                    </button>
                  )) : <div className="flex h-20 items-center justify-center text-[13px] text-[#999999]">暂无可引用资产</div>}
                </> : null}
              </div>
            ) : null}
          </div>
          {children}
        </div>
        <button type="button" disabled={running || !value.trim()} onClick={onRun} className="inline-flex h-9 w-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#111111] text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white" aria-label="生成">
          {running ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiArrowUpLine className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
const workflowToolButtonClassName = "yinzao-tool-button inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-2.5 text-[13px] text-[#777777] outline-none transition";
function useWorkflowMenuOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("workflow-close-popups", close);
    return () => window.removeEventListener("workflow-close-popups", close);
  }, []);
  const toggle = () => { const shouldOpen = !open; closeWorkflowPopups(); setOpen(shouldOpen); };
  return { open, setOpen, toggle };
}

function WorkflowModelMenuSingle({ value, options, title, onChange, className = "", getIcon }: { value: ModelName; options: readonly (ConversationModel | GenerationModel)[]; title: string; onChange: (value: ModelName) => void; className?: string; getIcon?: (modelId: string) => typeof BytePlusIcon | typeof RiOpenaiFill | typeof RiGoogleFill | typeof RiTiktokFill | null }) {
  const { open, setOpen, toggle } = useWorkflowMenuOpen();
  const SelectedIcon = getIcon?.(value) ?? getGenerationModelIcon(value);
  const selectedLabel = getModelLabel(options, value);
  const selectedGold = isGoldGenerationModel(value);
  return <div data-workflow-menu className={`relative min-w-0 ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={toggle} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} justify-start whitespace-nowrap`}><span className="flex min-w-0 flex-nowrap items-center gap-1.5">{SelectedIcon ? <SelectedIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" /> : <AiGenerate3dIcon />}<span className={`min-w-0 truncate whitespace-nowrap font-medium ${selectedGold ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedLabel}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>{options.map((option) => { const ModelIcon = getIcon?.(option.id) ?? getGenerationModelIcon(option.id); const selected = option.id === value; const gold = isGoldGenerationModel(option.id); return <button key={option.id} type="button" onClick={() => { onChange(option.id as ModelName); setOpen(false); }} className={selected ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span className="flex min-w-0 items-center gap-2">{ModelIcon ? <ModelIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" /> : <AiGenerate3dIcon />}<span className={`min-w-0 truncate ${gold ? "text-[#b8860b]" : ""}`}>{option.label}</span></span>{selected ? <RiCheckLine className="h-[18px] w-[18px] shrink-0 text-[#111111]" /> : null}</button>; })}</div> : null}</div>;
}

function WorkflowSettingsMenuSingle({ mode, model, ratio, resolution, ratios, resolutions, onChange, className = "" }: { mode: "image" | "video"; model?: ModelName; ratio: string; resolution: string; ratios: string[]; resolutions: string[]; onChange: (patch: { ratio?: string; resolution?: string }) => void; className?: string }) {
  const { open, setOpen, toggle } = useWorkflowMenuOpen();
  const dimensions = mode === "image" ? getExpectedImageDimensions(model, resolution, ratio) : getExpectedVideoDimensions(model, resolution, ratio);
  return <div data-workflow-menu className={`relative ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={toggle} className={`relative ${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} pl-10`}><span className="flex min-w-0 flex-nowrap items-center gap-2"><span className="font-medium text-[#777777]">{ratio} /</span><span className="font-medium text-[#777777]">{resolution}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span><span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={ratio} /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[min(420px,calc(100vw-40px))] rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div><div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">{ratios.map((option) => <button key={option} type="button" onClick={() => { onChange({ ratio: option }); setOpen(false); }} className={option === ratio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}><RatioOptionIcon option={option} /><span className="text-[13px] font-medium leading-none">{option}</span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div><div className={`mt-2 grid rounded-[12px] bg-[#f6f6f6] py-1 ${mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2"} ${resolutions.length === 1 ? "grid-cols-1" : resolutions.length === 2 ? "grid-cols-2" : resolutions.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>{resolutions.map((option) => <button key={option} type="button" onClick={() => { onChange(mode === "video" ? { resolution: option, ratio: normalizeVideoRatioForModel(model, ratio, option) } : { resolution: option }); setOpen(false); }} className={option === resolution ? `flex h-[56px] items-center justify-center rounded-[10px] bg-white ${mode === "video" ? "px-2" : "px-4"} text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]` : `flex h-[56px] items-center justify-center rounded-[10px] ${mode === "video" ? "px-2" : "px-4"} text-[#666666] transition hover:bg-white/80`}><span className={`flex items-center ${mode === "video" ? "gap-1.5" : "gap-2"} whitespace-nowrap text-[13px] font-medium leading-none`}><CompactResolutionIcon option={option} mode={mode} /><span>{option}</span></span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">尺寸</div><div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3"><div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4"><span className="text-[13px] font-medium text-[#9a9a9a]">W</span><span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(dimensions.width)}</span></div><div className="flex h-[48px] w-[24px] items-center justify-center text-[#8a8a8a]">×</div><div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4"><span className="text-[13px] font-medium text-[#9a9a9a]">H</span><span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(dimensions.height)}</span></div><div className="text-[13px] font-medium text-[#8a8a8a]">PX</div></div></div> : null}</div>;
}

function WorkflowDurationMenuSingle({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const { open, setOpen, toggle } = useWorkflowMenuOpen();
  return <div data-workflow-menu className="relative" onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={toggle} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""}`}><RiTimeLine className="h-[18px] w-[18px] shrink-0 text-[#777777]" /><span className="font-medium text-[#777777]">{value}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 max-h-[420px] min-w-[180px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">视频时长</div>{options.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={option === value ? "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span>{option}</span>{option === value ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" /> : null}</button>)}</div> : null}</div>;
}
function WorkflowSettingsMenuV2({ mode, model, ratio, resolution, ratios, resolutions, onChange, className = "" }: { mode: "image" | "video"; model?: ModelName; ratio: string; resolution: string; ratios: string[]; resolutions: string[]; onChange: (patch: { ratio?: string; resolution?: string }) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const resolutionGridClassName = mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2";
  const resolutionButtonPaddingClassName = mode === "video" ? "px-2" : "px-4";
  const resolutionLabelGapClassName = mode === "video" ? "gap-1.5" : "gap-2";
  const dimensions = mode === "image" ? getExpectedImageDimensions(model, resolution, ratio) : getExpectedVideoDimensions(model, resolution, ratio);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("workflow-close-popups", close);
    return () => window.removeEventListener("workflow-close-popups", close);
  }, []);

  return <div className={`relative ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setOpen((current) => !current)} className={`relative ${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} pl-10`}><span className="flex min-w-0 flex-nowrap items-center gap-2"><span className="font-medium text-[#777777]">{ratio} /</span><span className="font-medium text-[#777777]">{resolution}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span><span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={ratio} /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[min(420px,calc(100vw-40px))] rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div><div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">{ratios.map((option) => <button key={option} type="button" onClick={() => onChange({ ratio: option })} className={option === ratio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}><RatioOptionIcon option={option} /><span className="text-[13px] font-medium leading-none">{option}</span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div><div className={`mt-2 grid ${resolutionGridClassName} rounded-[12px] bg-[#f6f6f6] py-1 ${resolutions.length === 1 ? "grid-cols-1" : resolutions.length === 2 ? "grid-cols-2" : resolutions.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>{resolutions.map((option) => <button key={option} type="button" onClick={() => onChange(mode === "video" ? { resolution: option, ratio: normalizeVideoRatioForModel(model, ratio, option) } : { resolution: option })} className={option === resolution ? `flex h-[56px] items-center justify-center rounded-[10px] bg-white ${resolutionButtonPaddingClassName} text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]` : `flex h-[56px] items-center justify-center rounded-[10px] ${resolutionButtonPaddingClassName} text-[#666666] transition hover:bg-white/80`}><span className={`flex items-center ${resolutionLabelGapClassName} whitespace-nowrap text-[13px] font-medium leading-none`}><CompactResolutionIcon option={option} mode={mode} /><span>{option}</span></span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">尺寸</div><div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3"><div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4"><span className="text-[13px] font-medium text-[#9a9a9a]">W</span><span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(dimensions.width)}</span></div><div className="flex h-[48px] w-[24px] items-center justify-center text-[#8a8a8a]"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M4 4L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg></div><div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4"><span className="text-[13px] font-medium text-[#9a9a9a]">H</span><span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(dimensions.height)}</span></div><div className="text-[13px] font-medium text-[#8a8a8a]">PX</div></div></div> : null}</div>;
}
function getGenerationModelIcon(modelId: string) { if (modelId.startsWith("byteplus:") || modelId.startsWith("byteplus/") || modelId.startsWith("ep-")) return BytePlusIcon; if (modelId.startsWith("openai/")) return RiOpenaiFill; if (modelId.startsWith("google/")) return RiGoogleFill; if (modelId.startsWith("bytedance/") || modelId.startsWith("bytedance-seed/")) return RiTiktokFill; return null; }
function isGoldGenerationModel(modelId: string) { return modelId === "openai/gpt-5.4-image-2" || modelId === "bytedance/seedance-2.0" || modelId === "byteplus:video.seedance-2-0"; }
function getModelLabel(options: readonly (ConversationModel | GenerationModel)[], value: string) { return options.find((item) => item.id === value)?.label ?? value; }
function AiGenerate3dIcon({ className = "h-[18px] w-[18px] shrink-0 text-[#777777]" }: { className?: string }) { return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}><path d="M15.1416 2.81836L13.1016 3.94824L12 3.31055L4.5 7.65234V7.6582L12 12V20.6895L19.5 16.3467V11.5L21.5 10.3291V17.5L12 23L2.5 17.5V6.5L12 1L15.1416 2.81836ZM18.5293 2.31934C18.7059 1.8935 19.2943 1.89349 19.4707 2.31934L19.7236 2.93066C20.1556 3.97346 20.9615 4.80618 21.9746 5.25684L22.6924 5.57617C23.1026 5.75901 23.1026 6.3562 22.6924 6.53906L21.9326 6.87695C20.9449 7.31624 20.1534 8.11944 19.7139 9.12793L19.4668 9.69336C19.2864 10.1075 18.7137 10.1075 18.5332 9.69336L18.2871 9.12793C17.8476 8.11929 17.0552 7.31628 16.0674 6.87695L15.3076 6.53906C14.8974 6.35622 14.8974 5.75899 15.3076 5.57617L16.0254 5.25684C17.0385 4.80618 17.8445 3.97348 18.2764 2.93066L18.5293 2.31934Z" /></svg>; }
function RatioOptionIcon({ option }: { option: string }) { const meta = ratioCardMeta[option] ?? ratioCardMeta["1:1"]; if (meta.icon === "spark") return <RiShining2Line className="h-[18px] w-[18px] shrink-0 text-[#777777]" />; return <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0 text-[#777777]"><rect x={(18 - Number(meta.width)) / 2} y={(18 - Number(meta.height)) / 2} width={meta.width} height={meta.height} rx="2.2" stroke="currentColor" strokeWidth="1.4" /></svg>; }
function CompactResolutionIcon({ option, mode }: { option?: string; mode: "image" | "video" }) { if (mode === "video") return <span className="inline-flex h-4 min-w-6 items-center justify-center rounded-[3px] bg-[#111111] px-1 text-[9px] font-bold leading-none text-white">{option === "480p" ? "SD" : option === "1080p" ? "FHD" : option === "4K" ? "4K" : "HD"}</span>; return <span className="inline-flex h-4 min-w-5 items-center justify-center rounded-[3px] border border-[#d5d5d5] px-1 text-[9px] font-bold leading-none text-[#777777]">{option ?? "1K"}</span>; }
function WorkflowModelMenu({ value, options, title, onChange, className = "" }: { value: ModelName; options: readonly (ConversationModel | GenerationModel)[]; title: string; onChange: (value: ModelName) => void; className?: string }) { const [open, setOpen] = useState(false); const SelectedIcon = getGenerationModelIcon(value); const selectedLabel = getModelLabel(options, value); const selectedGold = isGoldGenerationModel(value); return <div className={`relative min-w-0 ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setOpen((current) => !current)} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} w-full max-w-none justify-start whitespace-nowrap`}><span className="flex min-w-0 flex-nowrap items-center gap-2">{SelectedIcon ? <SelectedIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" /> : <AiGenerate3dIcon />}<span className={`min-w-0 truncate whitespace-nowrap font-medium ${selectedGold ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedLabel}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>{options.map((option) => { const ModelIcon = getGenerationModelIcon(option.id); const selected = option.id === value; const gold = isGoldGenerationModel(option.id); return <button key={option.id} type="button" onClick={() => { onChange(option.id as ModelName); setOpen(false); }} className={selected ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span className="flex min-w-0 items-center gap-2">{ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" /> : <AiGenerate3dIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" />}<span className={`min-w-0 truncate text-[13px] ${gold ? "text-[#b8860b]" : ""}`}>{option.label}</span></span>{selected ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" /> : null}</button>; })}</div> : null}</div>; }
function WorkflowSettingsMenu({ mode, ratio, resolution, ratios, resolutions, onChange, className = "" }: { mode: "image" | "video"; ratio: string; resolution: string; ratios: string[]; resolutions: string[]; onChange: (patch: { ratio?: string; resolution?: string }) => void; className?: string }) { const [open, setOpen] = useState(false); const isSmartSettings = mode === "image" && ratio === "智能比例"; const resolutionGridClassName = mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2"; return <div className={`relative ${className}`} onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setOpen((current) => !current)} className={`relative ${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""} pl-10`}><span className="flex min-w-0 flex-nowrap items-center gap-2"><span className="font-medium text-[#777777]">{ratio} /</span><span className="font-medium text-[#777777]">{resolution}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></span><span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={ratio} /></span></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 w-[min(420px,calc(100vw-40px))] rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div><div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">{ratios.map((option) => <button key={option} type="button" onClick={() => onChange({ ratio: option })} className={option === ratio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}><RatioOptionIcon option={option} /><span className="text-[13px] font-medium leading-none">{option === "智能比例" ? "智能" : option}</span></button>)}</div><div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div><div className={`mt-2 grid ${resolutionGridClassName} rounded-[12px] bg-[#f6f6f6] py-1 ${resolutions.length === 1 ? "grid-cols-1" : resolutions.length === 2 ? "grid-cols-2" : resolutions.length === 3 ? "grid-cols-3" : "grid-cols-4"} ${isSmartSettings ? "opacity-45" : ""}`}>{resolutions.map((option) => <button key={option} type="button" disabled={isSmartSettings} onClick={() => onChange({ resolution: option })} className={option === resolution ? "flex h-[56px] items-center justify-center gap-2 rounded-[10px] bg-white px-2 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)] disabled:cursor-not-allowed" : "flex h-[56px] items-center justify-center gap-2 rounded-[10px] px-2 text-[#666666] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:hover:bg-transparent"}><CompactResolutionIcon option={option} mode={mode} /><span className="whitespace-nowrap text-[13px] font-medium leading-none">{option}</span></button>)}</div></div> : null}</div>; }
function WorkflowDurationMenu({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) { const [open, setOpen] = useState(false); return <div className="relative" onPointerDown={(event) => event.stopPropagation()}><button type="button" onClick={() => setOpen((current) => !current)} className={`${workflowToolButtonClassName} ${open ? "yinzao-tool-button-active" : ""}`}><RiTimeLine className="h-[18px] w-[18px] shrink-0 text-[#777777]" /><span className="font-medium text-[#777777]">{value}</span><RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" /></button>{open ? <div className="absolute bottom-full left-0 z-[10000] mb-2 max-h-[420px] min-w-[180px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]"><div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">视频时长</div>{options.map((option) => <button key={option} type="button" onClick={() => { onChange(option); setOpen(false); }} className={option === value ? "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]" : "flex h-10 w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"}><span>{option}</span>{option === value ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" /> : null}</button>)}</div> : null}</div>; }
function ImageNodeEditor({ node, modelOptions, onChange, onRun }: { node: WorkflowNode; modelOptions: WorkflowModelOptions; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void; onRun: () => void }) { const model = modelOptions.imageModels.some((item) => item.id === node.data.model) ? node.data.model ?? DEFAULT_IMAGE_MODEL : (modelOptions.imageModels[0]?.id as ModelName | undefined) ?? DEFAULT_IMAGE_MODEL; const supportedResolutions = getSupportedImageResolutions(model); const ratio = imageRatioOptions.includes(node.data.ratio ?? "") ? node.data.ratio as string : "16:9"; return <div className="space-y-2"><WorkflowPromptBox node={node} value={node.data.prompt ?? ""} placeholder="输入图片生成提示词；也可以连接文本节点。" onChange={(value) => onChange(node.id, { prompt: value })} running={node.data.isRunning} onRun={onRun}><WorkflowModelMenuSingle value={model} options={modelOptions.imageModels} title="选择模型" onChange={(value) => onChange(node.id, { model: value, ratio, resolution: normalizeImageResolutionForModel(value, node.data.resolution) })} className="w-[190px] shrink-0" /><WorkflowSettingsMenuSingle mode="image" model={model} ratio={ratio} resolution={node.data.resolution ?? supportedResolutions[0]} ratios={imageRatioOptions} resolutions={supportedResolutions} onChange={(patch) => onChange(node.id, patch)} className="shrink-0" /></WorkflowPromptBox>{node.data.error ? <div className="px-1 text-[12px] leading-5 text-red-500">{node.data.error}</div> : null}</div>; }
function VideoNodeEditor({ node, modelOptions, onChange, onRun }: { node: WorkflowNode; modelOptions: WorkflowModelOptions; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void; onRun: () => void }) { const model = modelOptions.videoModels.some((item) => item.id === node.data.model) ? node.data.model ?? DEFAULT_VIDEO_MODEL : (modelOptions.videoModels[0]?.id as ModelName | undefined) ?? DEFAULT_VIDEO_MODEL; const supportedResolutions = getSupportedVideoResolutions(model); const resolution = normalizeVideoResolutionForModel(model, node.data.resolution); const supportedRatios = getSupportedVideoRatios(model, resolution); const ratio = (supportedRatios as readonly string[]).includes(node.data.ratio ?? "") ? node.data.ratio as string : supportedRatios[0]; const durationOptions = modelOptions.videoModels.find((item) => item.id === model)?.durations ?? fallbackVideoDurationOptions; return <div className="space-y-2"><WorkflowPromptBox node={node} value={node.data.prompt ?? ""} placeholder="输入视频生成提示词；也可以连接文本或图片节点。" onChange={(value) => onChange(node.id, { prompt: value })} running={node.data.isRunning} onRun={onRun}><WorkflowModelMenuSingle value={model} options={modelOptions.videoModels} title="选择模型" onChange={(value) => { const nextResolution = normalizeVideoResolutionForModel(value, node.data.resolution); onChange(node.id, { model: value, resolution: nextResolution, ratio: normalizeVideoRatioForModel(value, ratio, nextResolution), duration: value === DEFAULT_WORKFLOW_VIDEO_MODEL ? "8秒" : modelOptions.videoModels.find((item) => item.id === value)?.durations?.[0] ?? "5秒" }); }} className="w-[190px] shrink-0" /><WorkflowSettingsMenuSingle mode="video" model={model} ratio={ratio} resolution={resolution} ratios={supportedRatios} resolutions={supportedResolutions} onChange={(patch) => onChange(node.id, patch)} className="shrink-0" /><WorkflowDurationMenuSingle value={node.data.duration ?? durationOptions[0]} options={durationOptions} onChange={(value) => onChange(node.id, { duration: value })} /></WorkflowPromptBox>{node.data.error ? <div className="px-1 text-[12px] leading-5 text-red-500">{node.data.error}</div> : null}</div>; }
