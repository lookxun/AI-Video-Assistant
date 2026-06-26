"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type SVGProps } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import {
  RiAddLine,
  RiAddLargeLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiArrowDownFill,
  RiArrowUpDownLine,
  RiArrowUpLine,
  RiArrowUpSLine,
  RiArrowDownWideLine,
  RiAtLine,
  RiCameraLine,
  RiCheckLine,
  RiChat3Line,
  RiChatSmileAiLine,
  RiChatDeleteFill,
  RiChatDeleteLine,
  RiCheckboxCircleLine,
  RiCheckboxMultipleBlankLine,
  RiCloseLine,
  RiCopperDiamondLine,
  RiDeleteBinLine,
  RiEmotionUnhappyLine,
  RiEmotionUnhappyFill,
  RiEmotionSadLine,
  RiErrorWarningLine,
  RiFolderLine,
  RiFolderOpenLine,
  RiFormatClear,
  RiLandscapeLine,
  RiImageLine,
  RiLayoutLeft2Line,
  RiLayoutLeftLine,
  RiLeafLine,
  RiLockPasswordLine,
  RiMoreLine,
  RiMoneyCnyCircleLine,
  RiMoneyDollarCircleLine,
  RiMusic2Line,
  RiMultiImageLine,
  RiMailLine,
  RiPhoneLine,
  RiPlayLargeFill,
  RiOpenaiFill,
  RiEditBoxLine,
  RiPushpinLine,
  RiResetLeftLine,
  RiRefreshLine,
  RiResetRightLine,
  RiShining2Line,
  RiStarSmileLine,
  RiStopFill,
  RiThumbDownLine,
  RiThumbDownFill,
  RiThumbUpLine,
  RiThumbUpFill,
  RiTimeLine,
  RiUpload2Line,
  RiVipCrown2Line,
  RiVipDiamondLine,
  RiVideoLine,
  RiQuillPenAiLine,
  RiAccountBoxLine,
  RiAccountCircleLine,
  RiFilmLine,
  RiInformationLine,
  RiGlobalLine,
  RiGitMergeLine,
  RiGitPullRequestLine,
  RiFilmAiLine,
  RiGoogleFill,
  RiImageAddLine,
  RiImageAiLine,
  RiDownloadLine,
  RiRobot2Line,
  RiZoomInLine,
  RiTBoxLine,
  RiTiktokFill,
  RiTerminalWindowFill,
  RiLogoutBoxRLine,
  RiSettingsLine,
  RiSunLine,
  RiMoonLine,
  RiComputerLine,
  RiNotification2Line,
  RiShieldUserLine,
  RiSaveLine,
} from "react-icons/ri";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, bytePlusVideoGenerationModels, frontendConversationModels, frontendImageGenerationModels, getExpectedImageDimensions, getExpectedVideoDimensions, getImageQualityBadgeLabel, getImageResolutionLabel, getSupportedImageResolutions, getSupportedVideoRatios, getSupportedVideoResolutions, imageGenerationModels, isNonStandardVideoSize, normalizeImageResolutionForModel, normalizeVideoRatioForModel, normalizeVideoResolutionForModel, videoGenerationModels, type ConversationModel, type GenerationModel, type ModelName } from "@/lib/models";
import { toUserErrorMessage } from "@/lib/error-message";
import { useBodyScrollLock } from "@/components/use-body-scroll-lock";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { WorkflowCanvas, type WorkflowCanvasState, type WorkflowNode } from "@/components/workflow-tldraw-canvas";
import { getSupportedUploadTypeLabel, getUploadAcceptValue, getUploadKindFromFileName, getUploadRule } from "@/lib/upload-rules";
import { sanitizeModelOutputText } from "@/lib/text-cleanup";

const HISTORY_INITIAL_SESSION_COUNT = 10;
const HISTORY_LOAD_MORE_COUNT = 5;
const WORKFLOW_INITIAL_ITEM_COUNT = HISTORY_INITIAL_SESSION_COUNT;
const WORKFLOW_LOAD_MORE_COUNT = HISTORY_LOAD_MORE_COUNT;
const MEDIA_DURATION_EPSILON_SECONDS = 0.35;
const WORKFLOW_MODE_ENABLED = process.env.NEXT_PUBLIC_WORKFLOW_MODE_ENABLED
  ? process.env.NEXT_PUBLIC_WORKFLOW_MODE_ENABLED === "true"
  : process.env.NODE_ENV !== "production";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  suggestions?: SuggestionInput[];
  createdAt?: number;
  requestId?: string;
  images?: string[];
  imageResultSlots?: ImageResultSlot[];
  imageDimensions?: Record<string, ImageDimensions>;
  imagePrompts?: Record<string, string>;
  imagePromptDetails?: Record<string, PromptDetail>;
  mediaSystemNames?: Record<string, string>;
  imageReferences?: ImageReference[];
  uploadedFiles?: UploadedFileEntry[];
  videoDimensions?: ImageDimensions;
  videoUrl?: string;
  videos?: string[];
  videoPrompts?: Record<string, string>;
  videoPromptDetails?: Record<string, PromptDetail>;
  videoPosters?: Record<string, string>;
  videoDimensionsMap?: Record<string, ImageDimensions>;
  textModel?: ModelName;
  statusText?: string;
  bytePlusAutoReviewNoticeShown?: boolean;
  pendingImageCount?: number;
  failedImageCount?: number;
  retryingFailedImageIndexes?: number[];
  retryingFailedImageStartedAt?: Record<number, number>;
  pendingVideoCount?: number;
  failedVideoCount?: number;
  retryingFailedVideoIndexes?: number[];
  retryingFailedVideoStartedAt?: Record<number, number>;
  error?: string;
  mediaErrorReasons?: string[];
  mode?: WorkMode;
  generationMeta?: MessageGenerationMeta;
};

type PromptDetail = {
  prompt: string;
  constraints?: string[];
};

type ImageReference = {
  name: string;
  url: string;
};

type ImageDimensions = {
  width: number;
  height: number;
};

type ImageResultSlot =
  | { type: "image"; url: string }
  | { type: "pending"; startedAt?: number }
  | { type: "failed"; retryingStartedAt?: number };

type CharacterGenerationResult = {
  status: "idle" | "generating" | "succeeded" | "failed";
  url?: string;
  error?: string;
  startedAt?: number;
  dimensions?: ImageDimensions;
};

type AssetGenerateJob = {
  id: string;
  type: AssetGenerationImageType;
  prompt: string;
  ratio: AssetGenerateRatio;
  style: "realistic" | "2d" | "3d";
  model: ModelName;
  resolution: string;
  previewMeta: PreviewMediaMeta;
  result: CharacterGenerationResult;
};

type AssetType = "character_image" | "scene_image" | "shot_image" | "shot_video" | "other" | "trash";
type AssetTargetType = AssetType;
type SuggestionItem = {
  label: string;
  action?: string;
  assetTargetType?: AssetTargetType;
};
type SuggestionInput = string | SuggestionItem;

type AssetItem = {
  id: string;
  mediaId?: string;
  type: AssetType;
  name: string;
  systemName?: string;
  userName?: string;
  url: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  librarySource?: "asset_generation" | "conversation" | "workflow";
  sourcePrompt: string;
  promptSource?: "generated" | "upload" | "reverse";
  bytePlusAssetId?: string;
  bytePlusAssetGroupId?: string;
  bytePlusAssetStatus?: "Processing" | "Active" | "Failed";
  bytePlusAssetError?: string;
  bytePlusAssetUpdatedAt?: number;
  previewMeta?: PreviewMediaMeta;
  sessionId: string;
  messageId?: string;
  workflowId?: string;
  workflowNodeId?: string;
  lockedType?: boolean;
  previousType?: AssetType;
  createdAt: number;
  deletedAt?: number;
  purgeAt?: number;
};

type UploadableImageAssetType = "character_image" | "scene_image" | "shot_image";
type AssetGenerationImageType = "character_image" | "scene_image" | "shot_image";
type AssetGenerateRatio = "single" | "three-view" | "scene-grid";

const UPLOAD_IMAGE_PROMPT_PLACEHOLDER = "上传图片";

type AssetUploadSlot = {
  id: string;
  fileName: string;
  originalFileName: string;
  dataUrl: string;
  uploadFile?: File;
  tempToken?: string;
  tempUrl?: string;
  uploadStatus?: UploadTransferStatus;
  uploadProgress?: number;
  forceReencode?: boolean;
  error?: string;
  dimensions?: ImageDimensions;
  isDuplicate?: boolean;
  type: UploadableImageAssetType;
};

type ReminderMessage = {
  message: string;
  tone: "default" | "success";
  exiting?: boolean;
  noTranslate?: boolean;
};

type VideoTaskState = {
  taskId: string;
  status: string;
  videoUrl?: string;
  error?: string;
};

type ChatPayloadMessage = {
  role: "user" | "assistant";
  content: string;
  images?: string[];
};

type UploadedDocumentStatus = "reading" | "ready" | "error";
type UploadTransferStatus = "uploading" | "ready" | "error";

type UploadedDocumentFile = {
  id: string;
  name: string;
  storageName: string;
  size: number;
  extension: string;
  mediaKind?: "document" | "video" | "audio";
  durationSeconds?: number;
  dimensions?: ImageDimensions;
  url?: string;
  uploadStatus?: UploadTransferStatus;
  uploadProgress?: number;
  status?: UploadedDocumentStatus;
  progress?: number;
  text?: string;
  error?: string;
};

type UploadedFileEntry = string | UploadedDocumentFile;

type MediaFileReference = {
  name: string;
  url: string;
  mediaKind: "video" | "audio";
  file: UploadedFileEntry;
};

type PendingGeneration = {
  id: string;
  mode: WorkMode;
  model: ModelName;
  promptModel?: ModelName;
  messages: ChatPayloadMessage[];
  settings?: GenerationSettings;
  prompt?: string;
  originalPrompt?: string;
  taskId?: string;
  referenceImages?: string[];
  referenceVideos?: string[];
  referenceAudios?: string[];
  videoReferenceMode?: VideoReferenceMode;
  imageReferences?: ImageReference[];
  referenceHint?: string;
  preserveOriginalInput?: boolean;
  assetTargetType?: AssetTargetType;
  agentGenerated?: boolean;
  agentDisplayText?: string;
  agentSuggestions?: SuggestionInput[];
  agentItemPrompts?: string[];
  agentItemPromptDetails?: PromptDetail[];
  agentItemSettings?: GenerationSettings[];
  selectedMediaModels?: Record<"image" | "video", ModelName>;
  retryFailedIndex?: number;
  needsIntentResolution?: boolean;
  sourceText?: string;
};

type VideoReferenceMode = "reference" | "first_frame" | "last_frame" | "first_last_frame";

function getExplicitVideoReferenceMode(text: string, referenceCount: number): VideoReferenceMode | undefined {
  if (referenceCount <= 0) return undefined;

  const normalized = text.replace(/\s+/g, "");
  if (/首尾帧|首帧.*尾帧|尾帧.*首帧|第一帧.*最后一帧|最后一帧.*第一帧|开头帧.*结尾帧|结尾帧.*开头帧/.test(normalized)) return "first_last_frame";
  if (/尾帧|最后一帧|结尾帧|结束帧|收尾帧|作为结尾|当作结尾|做结尾|做尾帧|以这张图结束|以此图结束/.test(normalized)) return undefined;
  if (/首帧|第一帧|开头帧|起始帧|开始帧|作为开头|当作开头|做开头|做首帧|从这张图开始|以这张图开始|用这张图开头/.test(normalized)) return "first_frame";

  return undefined;
}

function getEffectiveBytePlusVideoReferenceItems<T>(items: T[] | undefined, mode?: VideoReferenceMode): T[] {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (mode === "first_last_frame") return safeItems.slice(0, 2);
  if (mode === "first_frame" || mode === "last_frame") return safeItems.slice(0, 1);
  return safeItems.slice(0, 9);
}

function getBytePlusVideoReferenceLimitHint(mode?: VideoReferenceMode) {
  if (mode === "first_last_frame") return "首尾帧模式只会使用前两张参考图";
  if (mode === "first_frame") return "首帧模式只会使用第一张参考图";
  return "普通参考图模式最多使用九张参考图";
}

type WorkMode = "general" | "agent" | "image" | "video";

type UploadedImage = {
  id: string;
  name: string;
  url: string;
  previewUrl?: string;
  uploadFile?: File;
  tempToken?: string;
  referenceName?: string;
  source?: "upload" | "asset";
  uploadStatus?: UploadTransferStatus;
  uploadProgress?: number;
  forceReencode?: boolean;
  error?: string;
};

type GenerationSettings = {
  ratio?: string;
  resolution?: string;
  style?: string;
  duration?: string;
  imageCount?: string;
};

type MessageGenerationMeta = {
  mode: "image" | "video";
  model: ModelName;
  settings?: GenerationSettings;
  preserveOriginalInput?: boolean;
  assetTargetType?: AssetTargetType;
  originalPrompt?: string;
  agentGenerated?: boolean;
  itemPrompts?: string[];
  itemPromptDetails?: PromptDetail[];
};

type ControlMenuName = "model" | "generalChatModel" | "generalImageModel" | "generalVideoModel" | "characterModel" | "characterRatio" | "characterResolution" | "characterStyle" | "imageSettings" | "style" | "duration" | "imageCount";
type ModeMenuName = "mode";
type ActivePanel = "chat" | "workflow" | "assets";
type UserDialogTab = "profile" | "credits" | "security" | "settings";
type WorkspaceStorageMode = "loading" | "user";
type WorkspaceLoadStatus = "loading" | "retrying" | "loaded" | "failed";
type UserLanguage = "简体中文" | "繁体中文";
type AssetFilter = AssetType | "conversation_images" | "conversation_uploads" | "conversation_videos" | "workflow_images" | "workflow_videos";
type AssetCategoryTarget = UploadableImageAssetType | "conversation_image";
type WorkSession = {
  id: string;
  title: string;
  conversationCode?: string;
  nextImageNumber?: number;
  nextVideoNumber?: number;
  updatedAt: number;
  messages: Message[];
  videoTask: VideoTaskState | null;
  draftInput?: string;
  uploadedFiles?: UploadedFileEntry[];
  uploadedImages?: UploadedImage[];
  pendingRequest?: PendingGeneration | null;
  pendingRequests?: PendingGeneration[];
  usageSummary?: UsageSummary;
  memorySummary?: SessionMemorySummary;
  deletedAt?: number;
  messagesLoaded?: boolean;
  messagesHasMore?: boolean;
  messagesBeforeCursor?: number;
};

type SessionMemorySummary = {
  content: string;
  updatedAt: number;
  summarizedMessageId?: string;
  summarizedTokenEstimate?: number;
};

type WorkspaceStatePayload = {
  sessions?: WorkSession[];
  sessionsHasMore?: boolean;
  sessionsNextOffset?: number;
  sessionsTotalCount?: number;
  nextConversationNumber?: number;
  nextWorkflowNumber?: number;
  activePanel?: ActivePanel;
  assetFilter?: AssetFilter;
  assetScrollTopByFilter?: Partial<Record<AssetFilter, number>>;
  workflowItems?: WorkflowItem[];
  activeWorkflowId?: string;
  assetGenerateJobs?: AssetGenerateJob[];
  activeSessionId?: string;
  inputSettings?: StoredInputSettings | null;
  intentMemoryRules?: IntentMemoryRule[];
  feedbackLogs?: FeedbackLogEntry[];
  assets?: AssetItem[];
  assetCounts?: Record<string, number>;
  assetsHasMore?: boolean;
  assetsNextOffset?: number;
};

type CurrentUserProfile = {
  id?: string;
  email: string;
  hasPassword: boolean;
  nickname?: string;
  phone?: string;
  avatarUrl?: string;
  language?: UserLanguage;
  notifyOnGenerationComplete?: boolean;
  autoSaveHistory?: boolean;
  previewWheelZoom?: boolean;
  previewWheelFlip?: boolean;
  generatedImageCount?: number;
  generatedVideoCount?: number;
  credits?: number;
  generalModeEnabled?: boolean;
  isAdmin?: boolean;
};

type UsageSummary = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  usd: number;
  cny: number;
  credits: number;
};

type UsageMeta = Partial<UsageSummary>;
type CreditMeta = { chargedCredits?: number; balance?: number; skipped?: boolean };
type UserCreditSource = "conversation" | "character_image_generation" | "scene_image_generation" | "shot_image_generation" | "image_prompt_reverse" | "prompt_optimization" | "signup" | "admin_adjust" | "recharge" | "activity";
type UserCreditConversation = {
  conversationId: string;
  source?: UserCreditSource;
  direction?: "consume" | "increase";
  title: string;
  credits: number;
  totalTokens?: number;
  imageCount: number;
  videoCount: number;
  lastActiveAt: string;
};

const userCreditSourceIcons: Record<UserCreditSource, typeof RiImageLine> = {
  conversation: RiChat3Line,
  character_image_generation: RiFolderLine,
  scene_image_generation: RiFolderLine,
  shot_image_generation: RiFolderLine,
  image_prompt_reverse: RiQuillPenAiLine,
  prompt_optimization: RiQuillPenAiLine,
  signup: RiVipCrown2Line,
  admin_adjust: RiVipDiamondLine,
  recharge: RiVipDiamondLine,
  activity: RiVipCrown2Line,
};

const userCreditSourceLabels: Partial<Record<UserCreditSource, string>> = {
  character_image_generation: "资产库_角色图片",
  scene_image_generation: "资产库_场景图片",
  shot_image_generation: "资产库_分镜图片",
  signup: "注册送积分",
  admin_adjust: "赠送积分",
  recharge: "充值积分",
  activity: "活动赠送积分",
};

type WorkflowItem = {
  id: string;
  workflowCode?: string;
  title: string;
  createdAt: number;
  updatedAt?: number;
  nextImageNumber?: number;
  nextVideoNumber?: number;
  deletedAt?: number;
  usageSummary?: UsageSummary;
  canvas?: WorkflowCanvasState;
};

type ApiError = string | { message?: string };
type IntentMode = "image" | "video";
type ChatApiResponse = {
  content?: string;
  model?: string;
  suggestions?: SuggestionInput[];
  usage?: UsageMeta;
  credit?: CreditMeta;
};
type AgentPlanResponse = {
  intent?: "chat" | "image" | "video" | "clarify";
  needsClarification?: boolean;
  clarifyQuestion?: string;
  displayText?: string;
  count?: number;
  subject?: string;
  quality?: "low" | "standard" | "high";
  ratio?: string;
  resolution?: string;
  duration?: string;
  prompt?: string;
  constraints?: string[];
  items?: Array<{ index?: number; prompt?: string; constraints?: string[]; duration?: string }>;
  suggestions?: SuggestionInput[];
  usage?: UsageMeta;
  credit?: CreditMeta;
};
type IntentMemoryRule = {
  id: string;
  mode: IntentMode;
  keywords: string[];
  source: string;
  hits: number;
  updatedAt: number;
};
type FeedbackKind = "like" | "dislike" | "wrong" | "wrong_mode" | "regenerate" | "copy";
type FeedbackLogEntry = {
  id: string;
  createdAt: number;
  kind: FeedbackKind;
  sessionId: string;
  sessionTitle: string;
  messageId: string;
  messageType: "text" | "image" | "video";
  executionMode?: WorkMode;
  activeMode: WorkMode;
  context: Array<{ role: "user" | "assistant"; content: string }>;
  message: Pick<Message, "content" | "images" | "videoUrl" | "statusText" | "error" | "mode">;
  intentMemoryRules: IntentMemoryRule[];
};
type PreviewMediaMeta = {
  modelLabel: string;
  ratio: string;
  sizeText: string;
  resolution: string;
  mode: "image" | "video";
  qualityBadgeLabel?: string;
  styleLabel?: string;
  duration?: string;
  nonStandardSize?: boolean;
};
type StoredInputSettings = {
  mode?: WorkMode;
  agentModelTier?: AgentModelTier;
  selectedRatios?: Partial<Record<WorkMode, string>>;
  selectedResolutions?: Partial<Record<WorkMode, string>>;
  selectedDurations?: Partial<Record<WorkMode, string>>;
  selectedImageCounts?: Partial<Record<WorkMode, string>>;
  selectedGenerationModels?: Partial<Record<"image" | "video", string>>;
  selectedGeneralModels?: Partial<Record<"chat" | "image" | "video", string>>;
};
type AgentModelTier = "normal" | "advanced";

const HOME_PROMPT_STORAGE_KEY = "flashmuse-home-prompt-v1";
const WORKSPACE_USER_DIALOG_STORAGE_KEY = "flashmuse-workspace-user-dialog-v1";
const WORKSPACE_THEME_STORAGE_KEY = "flashmuse-workspace-theme-v1";
const WORKSPACE_UI_STATE_STORAGE_KEY = "flashmuse-workspace-ui-state-v1";
type WorkspaceThemeMode = "light" | "dark" | "system";

function getStoredWorkspaceThemeMode(): WorkspaceThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const stored = window.localStorage.getItem(WORKSPACE_THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    return "light";
  }
  return "light";
}

function getSystemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}
const ASSET_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PERSISTED_SESSIONS = 30;
const MAX_INTENT_MEMORY_RULES = 50;
const MAX_FEEDBACK_LOGS = 300;
const MAX_UPLOADED_IMAGES = 10;
const MAX_SESSION_PENDING_REQUESTS = 10;
const GENERIC_MEDIA_ERROR_MESSAGE = "服务器繁忙，请稍候再试.....";
const ENABLE_BYTEPLUS_ASSET_REVIEW = process.env.NEXT_PUBLIC_ENABLE_BYTEPLUS_ASSET_REVIEW !== "false";
const legacyMediaUrlReplacements = new Map([
  ["/generated/videos/1780454968504-21fb484e-7894-45cb-b730-63c475ee71f2.mp4", "/generated/videos/1780454887939-f010e856-7f46-4fdc-9290-8dd58bd22d85.mp4"],
]);
const staticAssetBaseUrl = (process.env.NEXT_PUBLIC_STATIC_BASE_URL ?? "").replace(/\/$/, "");
const uploadApiBaseUrl = (process.env.NEXT_PUBLIC_UPLOAD_BASE_URL ?? "").replace(/\/$/, "");
const primaryAppBaseUrl = (process.env.NEXT_PUBLIC_PRIMARY_BASE_URL ?? "").replace(/\/$/, "");
const MALAYSIA_WORKSPACE_URL = "https://main.venusface.com/workspace";
const ALI_WORKSPACE_URL = "https://ali.venusface.com/workspace";
const mediaThumbnailVersion = "thumb256-20260606";
const videoPosterVersion = "poster640-20260606";

type WorkspaceSite = "malaysia" | "ali" | "other";

function getCurrentWorkspaceSite(hostname: string): WorkspaceSite {
  if (hostname === "main.venusface.com" || hostname === "api.venusface.com" || hostname === "101.47.19.109") return "malaysia";
  if (hostname === "ali.venusface.com" || hostname === "static.venusface.com" || hostname === "101.37.129.164") return "ali";
  return "other";
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

async function fetchJsonWithRetry<T>(url: string, init?: RequestInit, attempts = 3, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    const externalSignal = init?.signal;
    const abortFromExternalSignal = () => controller.abort();

    try {
      if (externalSignal?.aborted) controller.abort();
      externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
      const response = await fetch(url, { ...init, signal: controller.signal });
      const data = (await response.json().catch(() => ({}))) as T;
      if (response.ok || response.status === 401) return { response, data };
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    } finally {
      window.clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    }
    if (attempt < attempts - 1) await delay(600 * (attempt + 1));
  }
  throw lastError instanceof Error ? lastError : new Error("请求失败");
}

function toLocalGeneratedUrl(url: string) {
  if (/^https?:\/\/(101\.47\.19\.109|101\.37\.129\.164|main\.venusface\.com|api\.venusface\.com|ali\.venusface\.com|static\.venusface\.com)\/generated\//i.test(url)) {
    return url.replace(/^https?:\/\/(101\.47\.19\.109|101\.37\.129\.164|main\.venusface\.com|api\.venusface\.com|ali\.venusface\.com|static\.venusface\.com)/i, "");
  }
  return url;
}

function getDownloadUrl(url: string) {
  return toLocalGeneratedUrl(url);
}

function withMediaVersion(url: string, version?: string) {
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
}

function shouldUseStaticAssetBaseUrl() {
  if (!staticAssetBaseUrl || typeof window === "undefined") return Boolean(staticAssetBaseUrl);

  try {
    const currentHost = window.location.host;
    const currentHostname = window.location.hostname;
    const staticHost = new URL(staticAssetBaseUrl).host;
    const uploadHost = uploadApiBaseUrl ? new URL(uploadApiBaseUrl).host : "";
    const primaryHost = primaryAppBaseUrl ? new URL(primaryAppBaseUrl).host : "";
    if (currentHostname === "main.venusface.com" || currentHostname === "api.venusface.com" || currentHostname === "101.47.19.109") return false;
    if (currentHost === staticHost || currentHost === uploadHost || currentHost === primaryHost) return false;
  } catch {
    return Boolean(staticAssetBaseUrl);
  }

  return true;
}

function getStaticMediaUrl(url: string | undefined, version?: string) {
  if (!url) return url;
  const normalizedUrl = toLocalGeneratedUrl(url);
  if (!shouldUseStaticAssetBaseUrl() || !normalizedUrl.startsWith("/generated/")) return withMediaVersion(normalizedUrl, version);
  return withMediaVersion(`${staticAssetBaseUrl}${normalizedUrl}`, version);
}

function stripErrorCodePrefix(value: string) {
  return value.replace(/^\(B_\d+\)\s*/, "").trim();
}

function isGenericMediaReason(value: string | undefined) {
  if (!value) return true;
  const text = stripErrorCodePrefix(value);
  return text === GENERIC_MEDIA_ERROR_MESSAGE || [
    "请求失败，请稍后再试。",
    "图片生成失败，请稍后再试。",
    "视频生成失败，请稍后再试。",
    "请求超时，请稍后重试。",
    "网络连接异常，请稍后重试。",
    "平台服务临时异常，请稍后重试。",
    "任务失败，请联系管理员！",
  ].includes(text);
}

type MediaSaveStatusJob = {
  id?: string;
  remoteUrl: string;
  localUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  posterThumbnailUrl?: string;
  aliSynced?: boolean;
  type?: "image" | "video";
  status: "pending" | "downloading" | "saved" | "failed" | "expired";
  dimensions?: ImageDimensions;
};

function preloadImageUrl(url: string | undefined, timeoutMs = 30_000) {
  if (!url || typeof window === "undefined") return Promise.resolve(true);
  const startedAt = performance.now();
  let settled = false;
  return new Promise<boolean>((resolve) => {
    const image = new window.Image();
    const finish = (ok: boolean, status: "loaded" | "error" | "timeout") => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      console.info("[media-preload] image", { status, ok, ms: Math.round(performance.now() - startedAt), url: getMediaDebugTail(url), timeoutMs });
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false, "timeout"), timeoutMs);
    image.onload = () => {
      finish(true, "loaded");
    };
    image.onerror = () => {
      finish(false, "error");
    };
    image.src = url;
  });
}

async function preloadFetchUrl(url: string | undefined, timeoutMs = 180_000) {
  if (!url || typeof window === "undefined") return true;
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "force-cache", signal: controller.signal });
    if (!response.ok) {
      console.info("[media-preload] fetch", { status: "http-error", ok: false, httpStatus: response.status, ms: Math.round(performance.now() - startedAt), url: getMediaDebugTail(url), timeoutMs });
      return false;
    }
    const buffer = await response.arrayBuffer();
    console.info("[media-preload] fetch", { status: "loaded", ok: true, bytes: buffer.byteLength, ms: Math.round(performance.now() - startedAt), url: getMediaDebugTail(url), timeoutMs });
    return true;
  } catch (error) {
    console.info("[media-preload] fetch", { status: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "error", ok: false, ms: Math.round(performance.now() - startedAt), url: getMediaDebugTail(url), timeoutMs });
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

async function preloadVideoUrl(url: string | undefined, timeoutMs = 30_000) {
  if (!url || typeof window === "undefined") return true;
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "force-cache", headers: { Range: "bytes=0-0" }, signal: controller.signal });
    const ok = response.ok || response.status === 206;
    console.info("[media-preload] video-range", { status: ok ? "loaded" : "http-error", ok, httpStatus: response.status, ms: Math.round(performance.now() - startedAt), url: getMediaDebugTail(url), timeoutMs });
    return ok;
  } catch (error) {
    console.info("[media-preload] video-range", { status: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "error", ok: false, ms: Math.round(performance.now() - startedAt), url: getMediaDebugTail(url), timeoutMs });
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

async function preloadSavedMediaBeforeReplace(job: MediaSaveStatusJob) {
  if (!job.localUrl) return false;
  if (shouldUseStaticAssetBaseUrl() && job.aliSynced !== true) return false;
  const isVideo = job.type === "video" || /\.(mp4|webm|mov)(\?|#|$)/i.test(job.localUrl);
  const startedAt = performance.now();
  const preloadResults = isVideo
    ? await Promise.all([
        preloadVideoUrl(getStaticMediaUrl(job.localUrl), 30_000),
        preloadImageUrl(getStaticMediaUrl(job.posterUrl, videoPosterVersion), 60_000),
        preloadImageUrl(getStaticMediaUrl(job.posterThumbnailUrl, mediaThumbnailVersion) ?? (job.posterUrl ? getMediaThumbnailUrl(job.posterUrl) : undefined), 60_000),
      ])
    : await Promise.all([
        preloadImageUrl(getStaticMediaUrl(job.localUrl), 60_000),
        preloadImageUrl(getStaticMediaUrl(job.thumbnailUrl, mediaThumbnailVersion) ?? getMediaThumbnailUrl(job.localUrl), 60_000),
      ]);
  const ready = preloadResults.every(Boolean);
  console.info("[media-preload] media", { type: isVideo ? "video" : "image", ready, ms: Math.round(performance.now() - startedAt), remoteUrl: getMediaDebugTail(job.remoteUrl), localUrl: getMediaDebugTail(job.localUrl), posterUrl: getMediaDebugTail(job.posterUrl), results: preloadResults });
  return ready;
}

function getMediaDebugTail(url: string | undefined) {
  if (!url) return undefined;
  try {
    const parsed = /^https?:\/\//i.test(url) ? new URL(url) : undefined;
    const path = parsed?.pathname ?? url.split("?")[0].split("#")[0];
    const tail = path.split("/").filter(Boolean).slice(-3).join("/");
    return parsed ? `${parsed.host}/${tail}` : tail;
  } catch {
    return url.slice(-120);
  }
}

function isRemoteMediaUrl(url: string | undefined): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function getVideoPlaybackUrl(url: string | undefined) {
  if (!url) return url;
  if (isRemoteMediaUrl(url)) return url;
  return getStaticMediaUrl(url) ?? url;
}

function collectRemoteMediaUrls(sessions: WorkSession[], assets: AssetItem[], assetGenerateJobs: AssetGenerateJob[], workflowItems: WorkflowItem[] = []) {
  const urls = new Set<string>();
  const addRemoteUrl = (url: string | undefined) => {
    if (isRemoteMediaUrl(url) && !url.includes("#manual-test")) urls.add(url);
  };
  sessions.forEach((session) => {
    session.messages.forEach((message) => {
      message.images?.forEach(addRemoteUrl);
      message.imageResultSlots?.forEach((slot) => { if (slot.type === "image") addRemoteUrl(slot.url); });
      addRemoteUrl(message.videoUrl);
      message.videos?.forEach(addRemoteUrl);
    });
  });
  assets.forEach((asset) => addRemoteUrl(asset.url));
  assetGenerateJobs.forEach((job) => addRemoteUrl(job.result.url));
  workflowItems.forEach((workflow) => {
    workflow.canvas?.nodes?.forEach((node) => {
      node.data.images?.forEach(addRemoteUrl);
      addRemoteUrl(node.data.videoUrl);
    });
  });
  return Array.from(urls);
}

function replaceUrlValue(value: string | undefined, replacements: Map<string, string>) {
  return value && replacements.get(value) ? replacements.get(value) : value;
}

function replaceUrlArray(values: string[] | undefined, replacements: Map<string, string>) {
  if (!values) return values;
  let changed = false;
  const next = values.map((value) => {
    const replacement = replacements.get(value);
    if (replacement) changed = true;
    return replacement ?? value;
  });
  return changed ? next.filter((url, index, array) => array.indexOf(url) === index) : values;
}

function replaceUrlRecord<T>(record: Record<string, T> | undefined, replacements: Map<string, string>, extra?: Record<string, T>) {
  if (!record && !extra) return record;
  let changed = false;
  const next: Record<string, T> = {};
  Object.entries(record ?? {}).forEach(([key, value]) => {
    const replacement = replacements.get(key);
    if (replacement) changed = true;
    next[replacement ?? key] = value;
  });
  Object.entries(extra ?? {}).forEach(([key, value]) => {
    next[key] = value;
    changed = true;
  });
  return changed ? next : record;
}

function replaceMessageMediaUrls(message: Message, replacements: Map<string, string>, dimensions: Record<string, ImageDimensions>, videoPosters: Record<string, string>) {
  const images = replaceUrlArray(message.images, replacements);
  const videos = replaceUrlArray(message.videos, replacements);
  const videoUrl = replaceUrlValue(message.videoUrl, replacements);
  const imageResultSlots = message.imageResultSlots?.map((slot) => slot.type === "image" ? { ...slot, url: replacements.get(slot.url) ?? slot.url } : slot);
  const imageResultSlotsChanged = Boolean(message.imageResultSlots?.some((slot, index) => slot.type === "image" && imageResultSlots?.[index]?.type === "image" && slot.url !== imageResultSlots[index].url));
  const imageDimensions = replaceUrlRecord(message.imageDimensions, replacements, dimensions);
  const imagePrompts = replaceUrlRecord(message.imagePrompts, replacements);
  const videoPrompts = replaceUrlRecord(message.videoPrompts, replacements);
  const nextVideoPosters = replaceUrlRecord(message.videoPosters, replacements, videoPosters);
  const mediaSystemNames = replaceUrlRecord(message.mediaSystemNames, replacements);
  const videoDimensionsMap = replaceUrlRecord(message.videoDimensionsMap, replacements);
  const imageReferences = message.imageReferences?.map((item) => ({ ...item, url: replacements.get(item.url) ?? item.url }));
  const imageReferencesChanged = Boolean(message.imageReferences?.some((item, index) => item.url !== imageReferences?.[index]?.url));

  if (images === message.images && videos === message.videos && videoUrl === message.videoUrl && !imageResultSlotsChanged && imageDimensions === message.imageDimensions && imagePrompts === message.imagePrompts && videoPrompts === message.videoPrompts && nextVideoPosters === message.videoPosters && mediaSystemNames === message.mediaSystemNames && videoDimensionsMap === message.videoDimensionsMap && !imageReferencesChanged) return message;

  return {
    ...message,
    images,
    videos,
    videoUrl,
    imageResultSlots: imageResultSlotsChanged ? imageResultSlots : message.imageResultSlots,
    imageDimensions,
    imagePrompts,
    videoPrompts,
    videoPosters: nextVideoPosters,
    mediaSystemNames,
    videoDimensionsMap,
    imageReferences: imageReferencesChanged ? imageReferences : message.imageReferences,
  };
}

function replaceSessionMediaUrls(session: WorkSession, replacements: Map<string, string>, dimensions: Record<string, ImageDimensions>, videoPosters: Record<string, string> = {}) {
  let changed = false;
  const messages = session.messages.map((message) => {
    const next = replaceMessageMediaUrls(message, replacements, dimensions, videoPosters);
    if (next !== message) changed = true;
    return next;
  });
  const videoTaskUrl = replaceUrlValue(session.videoTask?.videoUrl, replacements);
  const videoTaskChanged = videoTaskUrl !== session.videoTask?.videoUrl;
  return changed || videoTaskChanged ? { ...session, updatedAt: Date.now(), messages, videoTask: session.videoTask && videoTaskChanged ? { ...session.videoTask, videoUrl: videoTaskUrl } : session.videoTask } : session;
}

function replaceAssetMediaUrls(asset: AssetItem, replacements: Map<string, string>, videoPosters: Record<string, string> = {}) {
  const url = replacements.get(asset.url);
  const posterUrl = (url && videoPosters[url]) || videoPosters[asset.url];
  return url || posterUrl ? { ...asset, url: url ?? asset.url, posterUrl: posterUrl ?? asset.posterUrl } : asset;
}

function replaceAssetGenerateJobMediaUrls(job: AssetGenerateJob, replacements: Map<string, string>, dimensions: Record<string, ImageDimensions>) {
  const url = replaceUrlValue(job.result.url, replacements);
  return url && url !== job.result.url ? { ...job, result: { ...job.result, url, dimensions: dimensions[url] ?? job.result.dimensions } } : job;
}

function replaceWorkflowItemMediaUrls(item: WorkflowItem, replacements: Map<string, string>, videoPosters: Record<string, string> = {}) {
  if (!item.canvas?.nodes?.length) return item;
  let changed = false;
  const nodes = item.canvas.nodes.map((node) => {
    const images = replaceUrlArray(node.data.images, replacements);
    const imageDimensions = node.data.imageDimensions && images
      ? Object.fromEntries(Object.entries(node.data.imageDimensions).map(([url, dimensions]) => [replacements.get(url) ?? url, dimensions]))
      : node.data.imageDimensions;
    const mediaSystemNames = node.data.mediaSystemNames
      ? Object.fromEntries(Object.entries(node.data.mediaSystemNames).map(([url, name]) => [replacements.get(url) ?? url, name]))
      : node.data.mediaSystemNames;
    const videoUrl = replaceUrlValue(node.data.videoUrl, replacements);
    const posterUrl = (videoUrl && videoPosters[videoUrl]) || (node.data.videoUrl && videoPosters[node.data.videoUrl]) || node.data.posterUrl;
    if (images === node.data.images && imageDimensions === node.data.imageDimensions && mediaSystemNames === node.data.mediaSystemNames && videoUrl === node.data.videoUrl && posterUrl === node.data.posterUrl) return node;
    changed = true;
    return { ...node, data: { ...node.data, images, imageDimensions, mediaSystemNames, videoUrl, posterUrl } };
  });
  return changed ? { ...item, canvas: { ...item.canvas, nodes } } : item;
}
const readableDocumentExtensions = ["md", "txt", "csv"];
const MAX_DOCUMENT_TEXT_CHARS = 12000;
const MAX_DOCUMENT_CONTEXT_CHARS = 30000;
const MAX_DRAFT_INPUT_LENGTH = 2000;
const MAX_USER_NICKNAME_LENGTH = 8;
const RETRY_IMAGE_SIDE = 1280;
const RETRY_IMAGE_QUALITY = 0.85;
const FINAL_RETRY_IMAGE_SIDE = 1024;
const FINAL_RETRY_IMAGE_QUALITY = 0.78;
const PROMPT_PREVIEW_IMAGE_SIDE = 512;
const PROMPT_PREVIEW_IMAGE_QUALITY = 0.72;
const FAST_VIDEO_POLL_INTERVAL_MS = 10000;
const SLOW_VIDEO_POLL_INTERVAL_MS = 30000;
const FAST_VIDEO_POLL_ATTEMPTS = 12;
const MIN_AGENT_THINKING_MS = 2000;
const DEFAULT_AGENT_SUGGESTIONS: SuggestionInput[] = ["让我写一个短剧故事", "讲讲电影是怎么做出来的", { label: "帮我拆一版分镜", assetTargetType: "shot_image" }];
const DEFAULT_AGENT_IMAGE_SUGGESTIONS: SuggestionInput[] = [
  "继续调整这组图片",
  { label: "生成同风格场景", assetTargetType: "scene_image" },
  { label: "改成图片分镜", assetTargetType: "shot_image" },
  { label: "让这张图动起来", assetTargetType: "shot_video" },
];
const DEFAULT_AGENT_VIDEO_SUGGESTIONS: SuggestionInput[] = [
  "继续调整这段视频",
  { label: "生成下一段镜头", assetTargetType: "shot_video" },
  { label: "改写镜头提示词", assetTargetType: "shot_video" },
  "继续拆完整分镜",
];
const assetTypeLabels: Record<AssetType, string> = {
  character_image: "角色图片",
  scene_image: "场景图片",
  shot_image: "分镜图片",
  shot_video: "分镜视频",
  other: "待分类",
  trash: "回收站",
};
const assetTypeOrder: AssetType[] = ["character_image", "scene_image", "shot_image", "shot_video", "other", "trash"];
const assetGenerationTypes: UploadableImageAssetType[] = ["character_image", "scene_image", "shot_image"];
type MentionAssetGroupType = UploadableImageAssetType | "conversation_upload";
const mentionAssetTypes: MentionAssetGroupType[] = ["character_image", "scene_image", "shot_image", "conversation_upload"];
const assetUploadTypes: UploadableImageAssetType[] = ["character_image", "scene_image", "shot_image"];
const ASSET_UPLOAD_SLOT_COUNT = 8;
const ASSET_RENDER_PAGE_SIZE = 30;
const assetTypeIcons: Record<AssetType, typeof RiImageLine> = {
  character_image: RiAccountBoxLine,
  scene_image: RiLandscapeLine,
  shot_image: RiMultiImageLine,
  shot_video: RiFilmLine,
  other: RiFolderLine,
  trash: RiDeleteBinLine,
};
const assetCategoryTargetLabels: Record<AssetCategoryTarget, string> = {
  character_image: "角色图片",
  scene_image: "场景图片",
  shot_image: "分镜图片",
  conversation_image: "上传图片",
};
const mentionAssetTypeLabels: Record<MentionAssetGroupType, string> = {
  character_image: "角色图片",
  scene_image: "场景图片",
  shot_image: "分镜图片",
  conversation_upload: "上传图片",
};
const assetCategoryTargetIcons: Record<AssetCategoryTarget, typeof RiImageLine> = {
  character_image: RiAccountBoxLine,
  scene_image: RiLandscapeLine,
  shot_image: RiMultiImageLine,
  conversation_image: ImageUploadLineIcon,
};

function isAssetGenerationAsset(asset: AssetItem) {
  return asset.librarySource === "asset_generation";
}

function isWorkflowAsset(asset: AssetItem) {
  return asset.librarySource === "workflow";
}

function isConversationAsset(asset: AssetItem) {
  return asset.type !== "trash" && !isAssetGenerationAsset(asset) && !isWorkflowAsset(asset);
}

function isMentionGroupAsset(asset: AssetItem, groupType: MentionAssetGroupType) {
  if (asset.type === "trash" || asset.deletedAt || isVideoAsset(asset)) return false;
  if (groupType === "conversation_upload") return isConversationUploadedAsset(asset);
  return asset.type === groupType && isAssetGenerationAsset(asset);
}

function getMediaThumbnailUrl(url: string) {
  const normalizedUrl = toLocalGeneratedUrl(url);
  if (!normalizedUrl.startsWith("/generated/")) return normalizedUrl;
  const cleanUrl = normalizedUrl.split("?")[0].split("#")[0];
  if (!shouldUseStaticAssetBaseUrl()) return `/api/media-thumbnail?url=${encodeURIComponent(cleanUrl)}&v=${mediaThumbnailVersion}`;
  const userPathMatch = cleanUrl.match(/^\/generated\/users\/([^/]+)\/(.+)$/);
  const thumbnailRelativePath = (userPathMatch ? userPathMatch[2] : cleanUrl.replace(/^\/generated\//, "")).replace(/\.[^.\/\\]+$/, ".jpg");
  const thumbnailUrl = userPathMatch ? `/generated/users/${userPathMatch[1]}/image-thumbnails/${thumbnailRelativePath}` : `/generated/image-thumbnails/${thumbnailRelativePath}`;
  return getStaticMediaUrl(thumbnailUrl, mediaThumbnailVersion) ?? thumbnailUrl;
}

type HoverImagePreviewPosition = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function getHoverImagePreviewPosition(clientX: number, clientY: number, naturalSize?: ImageDimensions): HoverImagePreviewPosition {
  const margin = 16;
  const gap = 14;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const availableRight = Math.max(0, viewportWidth - clientX - gap - margin);
  const availableLeft = Math.max(0, clientX - gap - margin);
  const useLeft = availableLeft > availableRight;
  const maxWidth = Math.max(120, Math.min(720, (useLeft ? availableLeft : availableRight) || viewportWidth - margin * 2));
  const maxHeight = Math.max(120, Math.min(760, viewportHeight - margin * 2));
  const naturalWidth = Math.max(1, naturalSize?.width ?? maxWidth);
  const naturalHeight = Math.max(1, naturalSize?.height ?? maxHeight);
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight, 1);
  const width = Math.max(120, Math.round(naturalWidth * scale));
  const height = Math.max(120, Math.round(naturalHeight * scale));
  const rawLeft = useLeft ? clientX - gap - width : clientX + gap;
  const rawTop = clientY + gap + height > viewportHeight - margin ? clientY - gap - height : clientY + gap;
  const left = Math.min(Math.max(margin, rawLeft), Math.max(margin, viewportWidth - margin - width));
  const top = Math.min(Math.max(margin, rawTop), Math.max(margin, viewportHeight - margin - height));

  return { left, top, width, height };
}

function HoverImagePreview({ src, alt, wrapperClassName = "inline-block", children }: { src: string; alt: string; wrapperClassName?: string; children: ReactNode }) {
  const [position, setPosition] = useState<HoverImagePreviewPosition | null>(null);
  const [naturalSize, setNaturalSize] = useState<ImageDimensions | undefined>(undefined);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const updatePosition = (clientX: number, clientY: number, size = naturalSize) => {
    pointerRef.current = { x: clientX, y: clientY };
    setPosition(getHoverImagePreviewPosition(clientX, clientY, size));
  };
  const displaySrc = getStaticMediaUrl(src) ?? src;
  const preview = position && typeof document !== "undefined" ? createPortal(
    <span className="pointer-events-none fixed z-[9999] flex items-center justify-center rounded-[10px] border border-white/70 bg-white p-1 shadow-[0_18px_60px_rgba(0,0,0,0.32)]" style={{ left: position.left, top: position.top, width: position.width + 8, height: position.height + 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={displaySrc} alt={alt} className="block object-contain" style={{ width: position.width, height: position.height }} onLoad={(event) => {
        const image = event.currentTarget;
        if (!image.naturalWidth || !image.naturalHeight) return;
        const nextSize = { width: image.naturalWidth, height: image.naturalHeight };
        setNaturalSize(nextSize);
        const pointer = pointerRef.current;
        if (pointer) setPosition(getHoverImagePreviewPosition(pointer.x, pointer.y, nextSize));
      }} />
    </span>,
    document.body,
  ) : null;

  return (
    <span
      className={wrapperClassName}
      onMouseEnter={(event) => updatePosition(event.clientX, event.clientY)}
      onMouseMove={(event) => updatePosition(event.clientX, event.clientY)}
      onMouseLeave={() => {
        pointerRef.current = null;
        setPosition(null);
      }}
    >
      {children}
      {preview}
    </span>
  );
}

function getAssetCardImageUrl(asset: Pick<AssetItem, "url" | "thumbnailUrl" | "posterUrl">) {
  if (asset.thumbnailUrl) return getStaticMediaUrl(asset.thumbnailUrl, mediaThumbnailVersion) ?? asset.thumbnailUrl;
  if (isUploadedAssetUrl(asset.url)) {
    const cleanUrl = toLocalGeneratedUrl(asset.url).split("?")[0].split("#")[0];
    return `/api/media-thumbnail?url=${encodeURIComponent(cleanUrl)}&v=${mediaThumbnailVersion}`;
  }
  const posterUrl = asset.posterUrl ?? getLocalVideoPosterUrl(asset.url);
  return posterUrl ? getMediaThumbnailUrl(posterUrl) : getMediaThumbnailUrl(asset.url);
}

function getAssetCardPosterUrl(asset: Pick<AssetItem, "url" | "posterUrl">) {
  return asset.posterUrl ?? getLocalVideoPosterUrl(asset.url);
}
const MIN_TYPING_DURATION_MS = 1000;
const MAX_TYPING_DURATION_MS = 8000;
const INTENT_KEYWORDS = [
  "图中人",
  "这张图",
  "刚才那张图",
  "镜头",
  "运镜",
  "动起来",
  "视频",
  "短片",
  "动画",
  "生视频",
  "生成视频",
  "图生视频",
  "生图",
  "生成图片",
  "出图",
  "做图",
  "画图",
  "人物",
  "角色",
  "男女主",
  "男主",
  "女主",
  "主角",
  "海报",
  "封面",
  "插画",
  "立绘",
  "场景",
];

const initialMessages: Message[] = [];

type QuickAction = {
  label: string;
  prompt: string;
  backgroundColor?: string;
};

const quickActionPool: QuickAction[] = [
  { label: "生成一张电影感角色海报", prompt: "帮我生成一张电影感角色海报" },
  { label: "做一段 5 秒分镜视频", prompt: "帮我做一段 5 秒分镜视频" },
  { label: "写一个悬疑短片故事梗概", prompt: "帮我写一个悬疑短片故事梗概" },
  { label: "生成主角三视图", prompt: "帮我生成主角三视图" },
  { label: "设计一个赛博朋克场景", prompt: "帮我设计一个赛博朋克场景" },
  { label: "把想法扩写成图片提示词", prompt: "帮我把这个想法扩写成图片提示词：" },
  { label: "做一组文字分镜脚本", prompt: "帮我做一组文字分镜脚本" },
  { label: "生成产品广告短片创意", prompt: "帮我生成产品广告短片创意" },
  { label: "写一个儿童绘本开头", prompt: "帮我写一个儿童绘本开头" },
  { label: "生成一个奇幻森林场景", prompt: "帮我生成一个奇幻森林场景" },
  { label: "把剧本改成分镜表", prompt: "帮我把剧本改成分镜表" },
  { label: "设计一组短视频封面", prompt: "帮我设计一组短视频封面" },
  { label: "生成一张国风概念图", prompt: "帮我生成一张国风概念图" },
  { label: "写一个品牌广告脚本", prompt: "帮我写一个品牌广告脚本" },
  { label: "生成一段镜头运动描述", prompt: "帮我生成一段镜头运动描述" },
  { label: "做一个角色小传", prompt: "帮我做一个角色小传" },
  { label: "生成一组场景参考图", prompt: "帮我生成一组场景参考图" },
  { label: "整理成可生图提示词", prompt: "帮我整理成可生图提示词：" },
];

function getQuickActionRows(seedText: string) {
  const seed = Array.from(seedText || "flashmuse").reduce((value, char) => ((value * 31 + char.charCodeAt(0)) >>> 0), 2166136261);
  let state = seed || 1;
  const nextRandom = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const shuffled = [...quickActionPool];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  const rowPatterns = [[4, 4, 4], [3, 5, 4], [5, 4, 3], [4, 3, 5]];
  const pattern = rowPatterns[seed % rowPatterns.length];
  let cursor = 0;

  return pattern.map((count, rowIndex) => {
    const row = shuffled.slice(cursor, cursor + count).map((action, actionIndex) => {
      const hue = Math.floor(nextRandom() * 360);
      const saturation = 68 + Math.floor(nextRandom() * 16);
      const lightness = 91 + Math.floor(nextRandom() * 4);

      return {
        ...action,
        backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
        colorKey: `${rowIndex}-${actionIndex}`,
      };
    });
    cursor += count;
    return row;
  });
}

const videoStatusLabels: Record<string, string> = {
  creating: "正在创建视频任务",
  queued: "视频排队中，通常需要 1-5 分钟",
  running: "视频生成中",
  processing: "视频生成中",
  succeeded: "视频已生成完成",
  success: "视频已生成完成",
  completed: "视频已生成完成",
  complete: "视频已生成完成",
  done: "视频已生成完成",
  failed: "视频生成失败",
  error: "视频生成失败",
  expired: "视频任务已过期",
};

const imageStatusLabels = {
  creating: "正在生成图片，结果出来后会直接显示在这里",
  failed: "图片生成失败",
};

const ratioOptions = ["智能比例", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const imageResolutionOptions = ["1K", "2K", "4K"];
const videoResolutionOptions = ["480p", "720p", "1080p", "4K"];
const imageCountOptions = ["1张", "2张", "3张", "4张"];
const styleOptions = ["写实风格", "2D风格", "3D风格"];
const durationOptions = ["5秒", "10秒", "15秒"];
const userLanguageOptions: UserLanguage[] = ["简体中文", "繁体中文"];
const MEMORY_SUMMARY_INITIAL_TOKEN_THRESHOLD = 20_000;
const MEMORY_SUMMARY_INCREMENTAL_TOKEN_THRESHOLD = 12_000;
const MEMORY_RECENT_MESSAGE_LIMIT = 24;
const modeOptions: Array<{ label: string; value: WorkMode; icon: typeof RiImageLine }> = [
  { label: "通用模式", value: "general", icon: AiAgentLineIcon },
  { label: "Agent 模式", value: "agent", icon: RiAiIcon },
  { label: "图片生成", value: "image", icon: RiImageAiLine },
  { label: "视频生成", value: "video", icon: RiFilmAiLine },
];
const modeNoticeText: Record<WorkMode, { title: string; description: string }> = {
  general: {
    title: "当前已切换到通用模式",
    description: "适合普通问答和自由创作。按你选择的对话模型对话；需要生图或生视频时，会调用你选择的图片或视频模型。",
  },
  agent: {
    title: "当前已切换到Agent模式",
    description: "适合想法还不明确时使用。Agent会帮你理解需求、整理创意、推进故事和分镜，也可以在明确生成意图时自动进入图片或视频生成。",
  },
  image: {
    title: "当前已切换到图片生成模式",
    description: "适合已有明确画面需求时使用。你输入的内容会直接作为图片提示词，并按当前模型、比例、分辨率和生成数量执行。",
  },
  video: {
    title: "当前已切换到视频生成模式",
    description: "适合已有明确视频需求时使用。你输入的内容会直接作为视频提示词，并按当前模型、比例、分辨率和时长执行。",
  },
};

const toolButtonClassName = "yinzao-tool-button inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap px-3.5 text-[13px] text-[#777777] outline-none transition";
const toolButtonActiveClassName = "yinzao-tool-button-active";
const ACCENT_BLUE = "#367cee";
const DEFAULT_CHARACTER_IMAGE_MODEL = "openai/gpt-5.4-image-2";
const DEFAULT_CHARACTER_IMAGE_RESOLUTION = "2K";

const generationModelOptions: Record<"image" | "video", readonly GenerationModel[]> = {
  image: frontendImageGenerationModels,
  video: [...videoGenerationModels, ...bytePlusVideoGenerationModels],
};

function isGenerationModelOption(mode: "image" | "video", modelId?: string) {
  return Boolean(modelId && generationModelOptions[mode].some((model) => model.id === modelId));
}

function formatDimensionValue(value: number) {
  return value > 0 ? String(value) : "未知";
}

function getDefaultUserAvatar(email: string) {
  const normalizedEmail = email.trim().toLowerCase() || "user";
  let hash = 0;

  for (let index = 0; index < normalizedEmail.length; index += 1) {
    hash = (hash * 31 + normalizedEmail.charCodeAt(index)) >>> 0;
  }

  const hue = hash % 360;
  const label = (normalizedEmail[0] ?? "U").toUpperCase();

  return {
    label,
    backgroundColor: `hsl(${hue} 82% 92%)`,
    borderColor: `hsl(${hue} 58% 84%)`,
    color: `hsl(${hue} 38% 34%)`,
  };
}

const traditionalTextMap: Record<string, string> = {
  用户中心: "用戶中心",
  用户信息: "用戶資訊",
  帐号安全: "帳號安全",
  设置: "設定",
  昵称: "暱稱",
  "邮箱（登录帐号）": "信箱（登入帳號）",
  手机: "手機",
  未绑定: "未綁定",
  生成图片: "生成圖片",
  生成视频: "生成影片",
  密码已设置: "密碼已設定",
  修改密码: "修改密碼",
  忘记密码: "忘記密碼",
  "设置密码后可用密码登录": "設定密碼後可用密碼登入",
  "修改密码后请使用新密码登录": "修改密碼後請使用新密碼登入",
  "验证码已发送至登录邮箱，验证后可重设密码": "驗證碼已發送至登入信箱，驗證後可重設密碼",
  重新发送: "重新發送",
  当前密码: "目前密碼",
  "新密码，至少8位": "新密碼，至少8位",
  再次输入新密码: "再次輸入新密碼",
  保存中: "儲存中",
  保存密码: "儲存密碼",
  发送中: "發送中",
  语言: "語言",
  默认进入页面: "預設進入頁面",
  "图片/视频生成完成提醒": "圖片/影片生成完成提醒",
  自动保存历史: "生成圖片/影片自動收入資產管理庫",
  "预览页鼠标放在图片上滚轮有缩放功能": "預覽頁滑鼠放在圖片上滾輪有縮放功能",
  "预览页鼠标放在缩略图区域滚轮有翻页功能": "預覽頁滑鼠放在縮略圖區域滾輪有翻頁功能",
  本地缓存: "本機快取",
  版本信息: "版本資訊",
  工作台: "工作台",
  开启: "開啟",
  "清理本地缓存（占位）": "清理本機快取（佔位）",
  "v0.1.0 内测版": "v0.1.0 內測版",
  简体中文: "簡體中文",
  繁体中文: "繁體中文",
};

function getUserText(language: UserLanguage, text: string) {
  return language === "繁体中文" ? traditionalTextMap[text] ?? text : text;
}

function getLanguageDisplayName(option: UserLanguage) {
  return option === "繁体中文" ? "繁體中文" : "简体中文";
}

const originalTextNodeValues = new WeakMap<Text, string>();
const originalAttributeValues = new WeakMap<Element, Map<string, string>>();
const translatableAttributeNames = ["placeholder", "title", "aria-label", "alt"];

const globalTraditionalPhrases = [
  ...Object.entries(traditionalTextMap),
  ["帐号", "帳號"], ["登录", "登入"], ["验证码", "驗證碼"], ["密码", "密碼"], ["邮箱", "信箱"],
  ["视频", "影片"], ["图片", "圖片"], ["用户", "用戶"], ["信息", "資訊"], ["设置", "設定"],
  ["对话", "對話"], ["资产", "資產"], ["历史", "歷史"], ["提示词", "提示詞"], ["分镜", "分鏡"],
  ["上传", "上傳"], ["下载", "下載"], ["保存", "儲存"], ["删除", "刪除"], ["恢复", "恢復"],
  ["复制", "複製"], ["当前", "目前"], ["开启", "開啟"], ["关闭", "關閉"], ["选择", "選擇"],
  ["默认", "預設"], ["缓存", "快取"], ["数量", "數量"], ["时长", "時長"], ["分辨率", "解析度"],
  ["高级", "進階"], ["新建", "新增"], ["重命名", "重新命名"], ["置顶", "置頂"], ["待分类", "待分類"],
  ["内测", "內測"], ["错误", "錯誤"], ["失败", "失敗"], ["发送", "發送"], ["输入", "輸入"],
].sort((a, b) => b[0].length - a[0].length) as Array<[string, string]>;

const globalTraditionalChars: Record<string, string> = {
  个: "個", 与: "與", 为: "為", 么: "麼", 义: "義", 乐: "樂", 书: "書", 买: "買", 乱: "亂", 于: "於", 云: "雲", 产: "產", 亲: "親", 仅: "僅", 从: "從", 仓: "倉", 们: "們", 优: "優", 会: "會", 传: "傳", 伤: "傷", 体: "體", 余: "餘", 侠: "俠", 倾: "傾", 偿: "償", 储: "儲", 儿: "兒", 党: "黨", 兰: "蘭", 关: "關", 兴: "興", 养: "養", 册: "冊", 写: "寫", 军: "軍", 农: "農", 决: "決", 况: "況", 冻: "凍", 净: "淨", 准: "準", 几: "幾", 击: "擊", 划: "劃", 则: "則", 刚: "剛", 创: "創", 别: "別", 剧: "劇", 办: "辦", 务: "務", 动: "動", 励: "勵", 劳: "勞", 势: "勢", 区: "區", 医: "醫", 华: "華", 协: "協", 单: "單", 卖: "賣", 卫: "衛", 历: "歷", 压: "壓", 县: "縣", 参: "參", 双: "雙", 发: "發", 变: "變", 叶: "葉", 号: "號", 后: "後", 吗: "嗎", 听: "聽", 员: "員", 响: "響", 团: "團", 园: "園", 围: "圍", 国: "國", 图: "圖", 圆: "圓", 场: "場", 坏: "壞", 块: "塊", 坚: "堅", 坛: "壇", 墙: "牆", 声: "聲", 处: "處", 备: "備", 复: "複", 头: "頭", 夹: "夾", 奖: "獎", 妆: "妝", 妈: "媽", 娱: "娛", 学: "學", 实: "實", 审: "審", 宫: "宮", 宽: "寬", 对: "對", 寻: "尋", 导: "導", 将: "將", 尔: "爾", 尝: "嘗", 尽: "盡", 层: "層", 属: "屬", 岁: "歲", 岛: "島", 岭: "嶺", 币: "幣", 师: "師", 帐: "帳", 带: "帶", 帧: "幀", 帮: "幫", 并: "並", 广: "廣", 庆: "慶", 库: "庫", 应: "應", 废: "廢", 开: "開", 异: "異", 张: "張", 弹: "彈", 强: "強", 归: "歸", 当: "當", 录: "錄", 忆: "憶", 忧: "憂", 怀: "懷", 态: "態", 恋: "戀", 恶: "惡", 恼: "惱", 悦: "悅", 惊: "驚", 惧: "懼", 惨: "慘", 惯: "慣", 愿: "願", 戏: "戲", 户: "戶", 扑: "撲", 执: "執", 扩: "擴", 扫: "掃", 扬: "揚", 扰: "擾", 报: "報", 担: "擔", 拟: "擬", 拢: "攏", 拥: "擁", 拦: "攔", 拨: "撥", 择: "擇", 挂: "掛", 挤: "擠", 挥: "揮", 换: "換", 损: "損", 据: "據", 掷: "擲", 揽: "攬", 携: "攜", 摄: "攝", 摆: "擺", 数: "數", 断: "斷", 无: "無", 旧: "舊", 时: "時", 显: "顯", 晒: "曬", 晓: "曉", 暂: "暫", 术: "術", 机: "機", 杀: "殺", 杂: "雜", 权: "權", 条: "條", 来: "來", 极: "極", 构: "構", 标: "標", 栏: "欄", 树: "樹", 样: "樣", 桥: "橋", 档: "檔", 梦: "夢", 检: "檢", 楼: "樓", 欢: "歡", 欧: "歐", 残: "殘", 毕: "畢", 气: "氣", 汇: "匯", 汉: "漢", 没: "沒", 泽: "澤", 洁: "潔", 测: "測", 济: "濟", 浏: "瀏", 浓: "濃", 涛: "濤", 润: "潤", 涨: "漲", 渐: "漸", 温: "溫", 湾: "灣", 湿: "濕", 满: "滿", 滚: "滾", 滤: "濾", 滥: "濫", 滨: "濱", 灯: "燈", 灵: "靈", 点: "點", 烦: "煩", 烧: "燒", 热: "熱", 爱: "愛", 状: "狀", 独: "獨", 猪: "豬", 猫: "貓", 现: "現", 环: "環", 电: "電", 画: "畫", 疗: "療", 盖: "蓋", 盘: "盤", 着: "著", 睁: "睜", 确: "確", 礼: "禮", 离: "離", 种: "種", 积: "積", 称: "稱", 稳: "穩", 穷: "窮", 窝: "窩", 竖: "豎", 笔: "筆", 签: "簽", 简: "簡", 类: "類", 粮: "糧", 级: "級", 红: "紅", 线: "線", 组: "組", 细: "細", 终: "終", 绘: "繪", 给: "給", 统: "統", 绩: "績", 续: "續", 绿: "綠", 编: "編", 缩: "縮", 网: "網", 罗: "羅", 罚: "罰", 职: "職", 联: "聯", 肠: "腸", 肤: "膚", 胜: "勝", 胶: "膠", 脑: "腦", 脸: "臉", 舰: "艦", 艺: "藝", 节: "節", 苏: "蘇", 荐: "薦", 药: "藥", 获: "獲", 营: "營", 萧: "蕭", 蓝: "藍", 虑: "慮", 虚: "虛", 虫: "蟲", 虽: "雖", 蛮: "蠻", 补: "補", 装: "裝", 见: "見", 观: "觀", 规: "規", 视: "視", 览: "覽", 觉: "覺", 计: "計", 订: "訂", 认: "認", 讨: "討", 让: "讓", 训: "訓", 议: "議", 讯: "訊", 记: "記", 讲: "講", 许: "許", 论: "論", 设: "設", 访: "訪", 证: "證", 评: "評", 识: "識", 诉: "訴", 词: "詞", 译: "譯", 试: "試", 话: "話", 诚: "誠", 该: "該", 详: "詳", 语: "語", 误: "誤", 说: "說", 请: "請", 读: "讀", 课: "課", 调: "調", 谈: "談", 谋: "謀", 谢: "謝", 谦: "謙", 贝: "貝", 负: "負", 财: "財", 责: "責", 败: "敗", 账: "賬", 货: "貨", 质: "質", 费: "費", 资: "資", 赞: "讚", 赠: "贈", 赶: "趕", 跃: "躍", 车: "車", 转: "轉", 轮: "輪", 轻: "輕", 辑: "輯", 输: "輸", 边: "邊", 达: "達", 过: "過", 运: "運", 还: "還", 这: "這", 进: "進", 远: "遠", 连: "連", 选: "選", 递: "遞", 逻: "邏", 遗: "遺", 邮: "郵", 郑: "鄭", 释: "釋", 钟: "鐘", 钢: "鋼", 钱: "錢", 铁: "鐵", 链: "鏈", 锁: "鎖", 错: "錯", 键: "鍵", 镜: "鏡", 长: "長", 门: "門", 闪: "閃", 闭: "閉", 问: "問", 间: "間", 闻: "聞", 队: "隊", 阴: "陰", 阵: "陣", 阶: "階", 际: "際", 陆: "陸", 陈: "陳", 险: "險", 随: "隨", 隐: "隱", 难: "難", 静: "靜", 页: "頁", 顶: "頂", 项: "項", 顺: "順", 须: "須", 顾: "顧", 预: "預", 频: "頻", 题: "題", 颜: "顏", 额: "額", 风: "風", 飞: "飛", 饭: "飯", 饮: "飲", 饰: "飾", 馆: "館", 马: "馬", 验: "驗", 骑: "騎", 骗: "騙", 鱼: "魚", 鲜: "鮮", 鸟: "鳥", 鸡: "雞", 鸣: "鳴", 鹰: "鷹", 麦: "麥", 黄: "黃", 齐: "齊", 齿: "齒", 龙: "龍",
};

function convertSimplifiedToTraditional(text: string) {
  let convertedText = text;
  for (const [from, to] of globalTraditionalPhrases) convertedText = convertedText.split(from).join(to);
  return Array.from(convertedText).map((char) => globalTraditionalChars[char] ?? char).join("");
}

const globalSimplifiedPhrases = globalTraditionalPhrases.map(([from, to]) => [to, from] as [string, string]).sort((a, b) => b[0].length - a[0].length);
const globalSimplifiedChars = Object.fromEntries(Object.entries(globalTraditionalChars).map(([from, to]) => [to, from]));

function convertTraditionalToSimplified(text: string) {
  let convertedText = text;
  for (const [from, to] of globalSimplifiedPhrases) convertedText = convertedText.split(from).join(to);
  return Array.from(convertedText).map((char) => globalSimplifiedChars[char] ?? char).join("");
}

function applyLanguageToTextNode(node: Text, language: UserLanguage) {
  const parent = node.parentElement;
  if (!parent || parent.closest('script, style, noscript, textarea, input, [contenteditable="true"], [data-no-translate="true"]')) return;

  if (language === "繁体中文") {
    if (!originalTextNodeValues.has(node)) originalTextNodeValues.set(node, node.nodeValue ?? "");
    const converted = convertSimplifiedToTraditional(originalTextNodeValues.get(node) ?? "");
    if (node.nodeValue !== converted) node.nodeValue = converted;
    return;
  }

  const original = originalTextNodeValues.get(node);
  if (original !== undefined) {
    const simplified = convertTraditionalToSimplified(original);
    if (node.nodeValue !== simplified) node.nodeValue = simplified;
    originalTextNodeValues.delete(node);
  } else {
    const simplified = convertTraditionalToSimplified(node.nodeValue ?? "");
    if (node.nodeValue !== simplified) node.nodeValue = simplified;
  }
}

function applyLanguageToElementAttributes(element: Element, language: UserLanguage) {
  if (element.closest('script, style, noscript, [data-no-translate="true"]')) return;

  for (const attributeName of translatableAttributeNames) {
    const value = element.getAttribute(attributeName);
    if (!value) continue;

    if (language === "繁体中文") {
      let originalAttributes = originalAttributeValues.get(element);
      if (!originalAttributes) {
        originalAttributes = new Map();
        originalAttributeValues.set(element, originalAttributes);
      }
      if (!originalAttributes.has(attributeName)) originalAttributes.set(attributeName, value);
      const converted = convertSimplifiedToTraditional(originalAttributes.get(attributeName) ?? value);
      if (element.getAttribute(attributeName) !== converted) element.setAttribute(attributeName, converted);
    } else {
      const originalAttributes = originalAttributeValues.get(element);
      const original = originalAttributes?.get(attributeName);
      if (original !== undefined) {
        const simplified = convertTraditionalToSimplified(original);
        if (element.getAttribute(attributeName) !== simplified) element.setAttribute(attributeName, simplified);
        originalAttributes?.delete(attributeName);
      } else {
        const simplified = convertTraditionalToSimplified(value);
        if (element.getAttribute(attributeName) !== simplified) element.setAttribute(attributeName, simplified);
      }
    }
  }
}

function applyLanguageToSubtree(root: ParentNode, language: UserLanguage) {
  if (root instanceof Element) applyLanguageToElementAttributes(root, language);
  const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let elementNode = elementWalker.nextNode();
  while (elementNode) {
    applyLanguageToElementAttributes(elementNode as Element, language);
    elementNode = elementWalker.nextNode();
  }

  const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let textNode = textWalker.nextNode();
  while (textNode) {
    applyLanguageToTextNode(textNode as Text, language);
    textNode = textWalker.nextNode();
  }
}

function applyDocumentLanguage(language: UserLanguage) {
  applyLanguageToSubtree(document.body, language);
  if (language !== "繁体中文") return undefined;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) applyLanguageToTextNode(node as Text, language);
        if (node.nodeType === Node.ELEMENT_NODE) applyLanguageToSubtree(node as Element, language);
      });
      if (mutation.type === "attributes" && mutation.target instanceof Element) applyLanguageToElementAttributes(mutation.target, language);
      if (mutation.type === "characterData") applyLanguageToTextNode(mutation.target as Text, language);
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: translatableAttributeNames, characterData: true, childList: true, subtree: true });
  return () => observer.disconnect();
}

function getVideoDurationOptions(modelId: string) {
  return generationModelOptions.video.find((model) => model.id === modelId)?.durations ?? durationOptions;
}

function getGenerationModelLabel(mode: WorkMode, modelId: string) {
  if (mode !== "image" && mode !== "video") return "";
  return generationModelOptions[mode].find((model) => model.id === modelId)?.label ?? modelId;
}

function getConversationModelLabel(modelId: string) {
  return frontendConversationModels.find((model) => model.id === modelId)?.label ?? getActualTextModelLabel(modelId);
}

function conversationModelSupportsImages(modelId: string) {
  return !shouldUseTextOnlyHistoryForConversationModel(modelId);
}

function shouldUseTextOnlyHistoryForConversationModel(modelId: string) {
  return modelId === "deepseek/deepseek-v4-pro" || modelId === "deepseek/deepseek-r1-0528";
}

function getActualTextModelLabel(modelId: string) {
  const labels: Record<string, string> = {
    "seed-2-0-lite-260428": "Seed 2.0 Lite",
    "seed-2-0-pro-260328": "Seed 2.0 Pro",
    "glm-4-7-251222": "GLM-4.7",
    "deepseek/deepseek-v4-pro": "DeepSeek V4 Pro",
    "deepseek/deepseek-r1-0528": "DeepSeek R1 0528",
    "google/gemini-3-flash-preview": "Gemini 3 Flash Preview",
    "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview",
    "openai/gpt-4o": "GPT-4o",
    "openai/gpt-5.5": "GPT-5.5",
  };
  return labels[modelId] ?? (modelId === DEFAULT_CHAT_MODEL ? "Seed 2.0 Lite" : modelId === ADVANCED_CHAT_MODEL ? "GPT-5.4" : modelId);
}

function getImageCountValue(value?: string, max = 4) {
  const count = Number(value?.match(/\d+/)?.[0]);
  return Number.isFinite(count) ? Math.min(max, Math.max(1, count)) : 1;
}

function parseChineseNumber(value?: string) {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === "十") return 10;
  if (map[value] !== undefined) return map[value];
  if (value.startsWith("十")) return 10 + (map[value.slice(1)] ?? 0);
  if (value.endsWith("十")) return (map[value.slice(0, -1)] ?? 1) * 10;
  if (value.includes("十")) {
    const [ten, one] = value.split("十");
    return (map[ten] ?? 1) * 10 + (map[one] ?? 0);
  }
  return undefined;
}

function getRequestedImageCount(text: string) {
  const rawCount = text.match(/(\d+|[一二两三四五六七八九十]{1,3})\s*张/)?.[1];
  const count = parseChineseNumber(rawCount);
  return count !== undefined && Number.isFinite(count) && count > 0 ? `${Math.floor(count)}张` : "1张";
}

function getRequestedRatio(text: string, supportedRatios: readonly string[], fallback: string) {
  const normalized = text.replace(/：/g, ":");
  const explicitRatio = supportedRatios.find((ratio) => ratio !== "智能比例" && normalized.includes(ratio));
  if (explicitRatio) return explicitRatio;

  if (/(全身|竖版|竖屏|纵向|手机屏|人物全身)/.test(text)) {
    if (supportedRatios.includes("3:4")) return "3:4";
    if (supportedRatios.includes("9:16")) return "9:16";
  }

  if (/(横版|横屏|宽屏|电影感|电影画幅|超宽)/.test(text)) {
    if (/(超宽|电影画幅|21\s*[:：]\s*9)/.test(text) && supportedRatios.includes("21:9")) return "21:9";
    if (supportedRatios.includes("16:9")) return "16:9";
  }

  return supportedRatios.includes(fallback) ? fallback : supportedRatios[0] ?? fallback;
}

function getRequestedResolution(text: string, supportedResolutions: readonly string[], fallback: string) {
  const explicit = ["4K", "1080p", "720p", "480p", "2K", "1K"].find((resolution) => new RegExp(resolution, "i").test(text) && supportedResolutions.includes(resolution));
  return explicit ?? (supportedResolutions.includes(fallback) ? fallback : supportedResolutions[0] ?? fallback);
}

function isExplicit4KVideoRequest(text: string) {
  const normalized = text.replace(/\s/g, "").toLowerCase();
  if (/(4k画质|4k质感|4k高清|4k电影感|像4k|4k级)/i.test(normalized)) return false;
  return /(4k.*(视频|成片|短片|影片|分辨率|输出)|(视频|成片|短片|影片|分辨率|输出).*4k)/i.test(normalized);
}

function getRecentUserDissatisfactionCount(session: WorkSession | undefined, mode: "image" | "video") {
  const keywords = /(不满意|不行|不对|不像|太差|质量差|太丑|不好看|重新来|再来|换一个|换一版|还是不行|没达到|不符合|跑偏|崩了)/;
  const mediaWords = mode === "image" ? /(图|图片|照片|画面|人物|角色)/ : /(视频|短片|片段|镜头|动画)/;

  return (session?.messages ?? [])
    .slice(-12)
    .filter((message) => message.role === "user" && keywords.test(message.content) && (mediaWords.test(message.content) || !/(图片|图|视频|短片)/.test(message.content)))
    .length;
}

function getRecentSlowComplaintCount(session: WorkSession | undefined, mode: "image" | "video") {
  const keywords = /(太慢|很慢|等太久|等了很久|一直等|卡住|排队太久|生成太久|慢死|半天)/;
  const mediaWords = mode === "image" ? /(图|图片|照片|画面)/ : /(视频|短片|片段|镜头|动画)/;

  return (session?.messages ?? [])
    .slice(-12)
    .filter((message) => message.role === "user" && keywords.test(message.content) && (mediaWords.test(message.content) || !/(图片|图|视频|短片)/.test(message.content)))
    .length;
}

function getFeedbackDissatisfactionCount(sessionId: string, mode: "image" | "video", logs: FeedbackLogEntry[]) {
  return logs
    .filter((log) => log.sessionId === sessionId && (log.executionMode === mode || log.messageType === mode) && (log.kind === "dislike" || log.kind === "wrong" || log.kind === "wrong_mode"))
    .slice(0, 8)
    .length;
}

function getPreferredAvailableGenerationModel(generationMode: "image" | "video", desiredModels: ModelName[], enabledModels?: Record<"image" | "video", string[]>) {
  const availableModels = enabledModels?.[generationMode] ?? [];
  if (availableModels.length === 0) return desiredModels[0];
  const preferredModel = desiredModels.find((model) => availableModels.includes(model));
  return (preferredModel ?? availableModels[0]) as ModelName;
}

function getAgentGenerationModel(agentTier: AgentModelTier, generationMode: WorkMode, selectedGenerationModels: Record<"image" | "video", ModelName>, options?: { sourceText?: string; session?: WorkSession; feedbackLogs?: FeedbackLogEntry[]; enabledModels?: Record<"image" | "video", string[]> }) {
  if (generationMode === "image") {
    if (agentTier === "normal") return getPreferredAvailableGenerationModel("image", ["byteplus:conversation-image.seedream-4-5", "bytedance-seed/seedream-4.5"], options?.enabledModels);
    return getPreferredAvailableGenerationModel("image", ["openai/gpt-5.4-image-2"], options?.enabledModels);
  }

  if (generationMode === "video") {
    if (agentTier === "normal") return getPreferredAvailableGenerationModel("video", ["byteplus:video.seedance-2-0-fast", "bytedance/seedance-2.0-fast"], options?.enabledModels);
    return getPreferredAvailableGenerationModel("video", ["byteplus:video.seedance-2-0", "bytedance/seedance-2.0"], options?.enabledModels);
  }

  return agentTier === "advanced" ? ADVANCED_CHAT_MODEL : DEFAULT_CHAT_MODEL;
}

function getAgentGenerationSettings(text: string, generationMode: WorkMode, model: ModelName): GenerationSettings | undefined {
  if (generationMode === "image") {
    const supportedResolutions = getSupportedImageResolutions(model);
    const ratio = getRequestedRatio(text, ratioOptions, "智能比例");
    const resolution = getRequestedResolution(text, supportedResolutions, supportedResolutions[0] ?? "1K");

    return {
      ratio,
      resolution: normalizeImageResolutionForModel(model, resolution),
      style: styleOptions[0],
      imageCount: wantsCombinedLayoutRequest(text) ? "1张" : getRequestedImageCount(text),
    };
  }

  if (generationMode === "video") {
    const supportedResolutions = getSupportedVideoResolutions(model);
    const resolution = getRequestedResolution(text, supportedResolutions, supportedResolutions[0] ?? "720p");
    const supportedRatios = getSupportedVideoRatios(model, resolution);
    const ratio = getRequestedRatio(text, supportedRatios, "16:9");
    const durations = getVideoDurationOptions(model);
    const explicitDuration = durations.find((duration) => text.includes(duration));

    return {
      ratio: normalizeVideoRatioForModel(model, ratio, resolution),
      resolution: normalizeVideoResolutionForModel(model, resolution),
      style: styleOptions[0],
      duration: explicitDuration ?? durations[0],
    };
  }

  return undefined;
}

function getAgentGenerationSettingsFromPlan(plan: AgentPlanResponse | undefined, text: string, generationMode: WorkMode, model: ModelName): GenerationSettings | undefined {
  const fallback = getAgentGenerationSettings(text, generationMode, model);

  if (generationMode === "image") {
    const supportedResolutions = getSupportedImageResolutions(model);
    const ratio = plan?.ratio && ratioOptions.includes(plan.ratio) ? plan.ratio : fallback?.ratio;
    const resolution = plan?.resolution && supportedResolutions.some((item) => item === plan.resolution) ? plan.resolution : fallback?.resolution;
    const count = wantsCombinedLayoutRequest(text) ? "1张" : plan?.count && plan.count > 0 ? `${Math.floor(plan.count)}张` : fallback?.imageCount;

    return {
      ratio,
      resolution: normalizeImageResolutionForModel(model, resolution),
      style: styleOptions[0],
      imageCount: count,
    };
  }

  if (generationMode === "video") {
    const supportedResolutions = getSupportedVideoResolutions(model);
    const resolution = plan?.resolution && supportedResolutions.some((item) => item === plan.resolution) ? plan.resolution : fallback?.resolution;
    const supportedRatios = getSupportedVideoRatios(model, resolution);
    const ratio = plan?.ratio && supportedRatios.some((item) => item === plan.ratio) ? plan.ratio : fallback?.ratio;
    const durations = getVideoDurationOptions(model);
    const duration = plan?.duration && durations.some((item) => item === plan.duration) ? plan.duration : fallback?.duration;

    return {
      ratio: normalizeVideoRatioForModel(model, ratio, resolution),
      resolution: normalizeVideoResolutionForModel(model, resolution),
      style: styleOptions[0],
      duration,
    };
  }

  return fallback;
}

function getAgentPromptFromPlan(plan: AgentPlanResponse | undefined, text: string, mode: WorkMode) {
  return joinPromptDetail(getAgentPromptDetailFromPlan(plan, text, mode));
}

function cleanPromptConstraints(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}

function joinPromptDetail(detail: PromptDetail | undefined) {
  if (!detail) return "";
  return [detail.prompt.trim(), ...(detail.constraints ?? [])].filter(Boolean).join("，");
}

function getPromptSourceDetail(detail: PromptDetail | undefined) {
  const constraints = cleanPromptConstraints(detail?.constraints);
  return constraints.length > 0 ? JSON.stringify({ agentConstraints: constraints }) : undefined;
}

function getAgentPromptDetailFromPlan(plan: AgentPlanResponse | undefined, text: string, mode: WorkMode): PromptDetail {
  const constraints = cleanPromptConstraints(plan?.constraints);
  const fallbackSubject = plan?.subject || text.replace(/(\d+|[一二两三四五六七八九十]{1,3})\s*张/g, "").trim();
  const qualityText = plan?.quality === "high" ? "高品质，精致细节，清晰画质" : "画面自然清晰";
  const basePrompt = plan?.prompt?.trim() || (mode === "image" ? `${qualityText}，${fallbackSubject}` : `${qualityText}，${fallbackSubject}，自然动作变化，镜头稳定流畅`);

  if (mode !== "image") return { prompt: basePrompt, constraints };

  return buildAgentSingleImagePromptDetail(basePrompt, constraints, text, plan);
}

function buildAgentSingleImagePrompt(basePrompt: string, constraints: string[], sourceText: string, plan?: AgentPlanResponse) {
  return joinPromptDetail(buildAgentSingleImagePromptDetail(basePrompt, constraints, sourceText, plan));
}

function buildAgentSingleImagePromptDetail(basePrompt: string, constraints: string[], sourceText: string, plan?: AgentPlanResponse): PromptDetail {
  const combinedText = [sourceText, plan?.subject, basePrompt, ...constraints].filter(Boolean).join("，");
  const requestedCount = plan?.count && Number.isFinite(plan.count) ? plan.count : parseChineseNumber(sourceText.match(/(\d+|[一二两三四五六七八九十]{1,3})\s*张/)?.[1]) ?? 1;
  const noPeopleScene = wantsNoPeopleScene(combinedText);
  const combinedLayout = wantsCombinedLayoutRequest(sourceText);
  const noCollageRequested = wantsNoCollage(combinedText);
  const asksSingleSubject = /(每张|单张|一张)[^，。；]*?(只要|只有|保留|一个|一位|一名|单人|单主体)|单人|单主体|一个美女|一位美女|一名女性|只有一位|只有一个/.test(combinedText);
  const isPersonSubject = /(美女|女性|女人|女孩|女生|人物|角色|男生|男人|男性|男孩)/.test(combinedText);
  const explicitMultiPerson = /(合照|群像|多人|两个人|三个人|双人|情侣|团队|一群)/.test(combinedText);
  const cleanedPrompt = (noPeopleScene ? removePeopleTerms(basePrompt) : basePrompt)
    .replace(/(\d+|[一二两三四五六七八九十]{1,3})\s*张\s*/g, "")
    .replace(/\d+张图片[^，。；]*(不同|彼此)[^，。；]*/g, "")
    .replace(/每张[^，。；]*(不同|彼此|需体现|必须)[^，。；]*/g, "")
    .replace(/每张(?:都)?(?:要)?不同(?:的)?(?:人物|角色|国家|国籍|性别|时代|年代|服装|造型)(?:[，、和及与\s]*(?:不同(?:的)?(?:人物|角色|国家|国籍|性别|时代|年代|服装|造型)))*/g, combinedLayout ? "" : "")
    .replace(/不同(?:的)?(?:人物|角色|国家|国籍|性别|时代|年代|服装|造型)/g, combinedLayout ? "$&" : "")
    .replace(/(一组|一套|系列|组图|合集|拼图|九宫格|多宫格|分屏|多张照片排版|多图排版|照片墙|拼接图|排版图|参考图集|基础版本)/g, combinedLayout ? "$&" : "")
    .replace(/[，、\s]+/g, "，")
    .replace(/^，|，$/g, "");
  const singleSubjectConstraint = !combinedLayout && !noPeopleScene && (asksSingleSubject || (requestedCount > 1 && isPersonSubject && !explicitMultiPerson)) ? "画面中只有一位人物主体" : undefined;
  const hardConstraints = [
    ...constraints,
    noPeopleScene ? "纯场景画面，没有任何人物、角色、行人、人影、剪影或人形主体" : undefined,
    noPeopleScene ? "画面主体只能是场景、环境、建筑、自然景观或空间氛围" : undefined,
    noPeopleScene ? "no people, no person, no human, no character, no figure, no silhouette, no man, no woman" : undefined,
    singleSubjectConstraint,
    noCollageRequested && !combinedLayout ? "不要拼图或合集" : undefined,
    singleSubjectConstraint ? "不要多人同框" : undefined,
  ];

  return { prompt: cleanedPrompt || basePrompt, constraints: cleanPromptConstraints(hardConstraints) };
}

function wantsNoPeopleScene(text: string) {
  return /(只要|仅要|只生成|生成|换成|改成).{0,10}(场景|风景|环境|背景|空镜)|(不要|不需要|别要|不能有|没有|去掉|去除|无).{0,8}(人物|人像|角色|行人|人影|人类|人形|剪影|主体)|纯场景|无人物|无人场景|空镜/.test(text);
}

function wantsCombinedLayoutRequest(text: string) {
  return /(合并|整合|汇总|放在|放到|排在|排版|组合|组合成).{0,12}(一张|同一张|一个画面|同一画面|图上|画面)|(一张|同一张|一个画面|同一画面).{0,12}(放|排|展示|呈现|包含|容纳|合并|整合|多个|多款|几款|方案)|多款.{0,8}(放一起|放在一张)|多个方案.{0,12}(一张|同一张)/.test(text);
}

function wantsNoCollage(text: string) {
  return /(不要|别|不能|避免|不要再|不做|禁止).{0,10}(拼图|合集|九宫格|多宫格|分屏|组图|照片墙)|(拼图|合集|九宫格|多宫格|分屏|组图|照片墙).{0,10}(不对|错|不要|别|避免|不行)/.test(text);
}

function removePeopleTerms(prompt: string) {
  return prompt
    .replace(/\b(Portrait\s+of|portrait\s+of|single\s+person|one\s+subject|one\s+person|person|human\s+figure|human|character|model|silhouette|figure|man|woman|girl|boy|male|female)\b/gi, "")
    .replace(/(人物主体|人物|人像|角色|行人|人影|人类|人形主体|人形|剪影|男人|女人|男性|女性|男孩|女孩|模特|主体站在|站在|一个人|一位|一名)/g, "")
    .replace(/[，、\s]+/g, "，")
    .replace(/^，|，$/g, "");
}

function getAgentItemPromptsFromPlan(plan: AgentPlanResponse | undefined, sourceText: string, mode: WorkMode) {
  return getAgentItemPromptDetailsFromPlan(plan, sourceText, mode)?.map(joinPromptDetail);
}

function getAgentItemPromptDetailsFromPlan(plan: AgentPlanResponse | undefined, sourceText: string, mode: WorkMode) {
  if (!plan?.items?.length) return undefined;

  const details = plan.items
    .map((item) => {
      if (!item.prompt?.trim()) return "";
      if (mode === "image") return buildAgentSingleImagePromptDetail(item.prompt, cleanPromptConstraints(item.constraints), sourceText, { ...plan, prompt: item.prompt, constraints: item.constraints });
      if (mode === "video") return { prompt: item.prompt.trim(), constraints: cleanPromptConstraints(item.constraints) };
      return undefined;
    })
    .filter((item): item is PromptDetail => Boolean(item));

  return details.length > 0 ? details : undefined;
}

function getNearestSupportedDuration(model: ModelName, durationText?: string) {
  const durations = getVideoDurationOptions(model);
  const fallback = durations[0];
  const seconds = durationText ? Number(durationText.match(/(\d+)\s*秒/)?.[1]) : Number.NaN;

  if (!Number.isFinite(seconds)) return fallback;

  const parsed = durations
    .map((duration) => ({ duration, seconds: Number(duration.match(/(\d+)\s*秒/)?.[1]) }))
    .filter((item) => Number.isFinite(item.seconds));
  return parsed.find((item) => item.seconds >= seconds)?.duration ?? parsed[parsed.length - 1]?.duration ?? fallback;
}

function getAgentVideoItemSettingsFromPlan(plan: AgentPlanResponse | undefined, baseSettings: GenerationSettings | undefined, model: ModelName) {
  if (!plan?.items?.length) return undefined;

  return plan.items.map((item) => ({
    ...baseSettings,
    duration: getNearestSupportedDuration(model, item.duration ?? item.prompt ?? plan.duration),
  }));
}

function getAgentImageVariantPrompt(prompt: string, sourceText: string, index: number, total: number) {
  if (total <= 1) return prompt;

  const noPeopleScene = wantsNoPeopleScene(`${sourceText}，${prompt}`);
  const combinedLayout = wantsCombinedLayoutRequest(sourceText);
  if (combinedLayout) return prompt;
  const countries = ["中国", "法国", "埃及", "日本", "印度", "英国", "墨西哥", "肯尼亚", "美国", "土耳其"];
  const eras = ["现代", "19世纪", "古代", "江户时代", "中世纪", "维多利亚时代", "20世纪初", "未来时代", "文艺复兴时期", "1920年代"];
  const genders = ["女性", "男性"];
  const needsCountry = !noPeopleScene && /国家|国籍|民族|地区/.test(sourceText);
  const needsEra = !noPeopleScene && /时代|年代|时期|古代|现代|未来/.test(sourceText);
  const needsGender = !noPeopleScene && /性别|男女|男性|女性|男|女/.test(sourceText);
  const variantParts = [
    `第 ${index + 1} 张，共 ${total} 张`,
    noPeopleScene ? "本次只生成这一张独立场景图片，画面中不能出现任何人物" : "本次只生成这一张独立人物照片",
    needsCountry ? `本张只选择一个国家或文化背景：${countries[index % countries.length]}` : undefined,
    needsGender ? `本张只选择一个性别：${genders[index % genders.length]}` : undefined,
    needsEra ? `本张只选择一个时代：${eras[index % eras.length]}` : undefined,
    noPeopleScene ? "不要出现人物、角色、行人、人影、剪影或人形主体" : "不要在同一张图里展示多个国家、多个性别、多个时代或多个角色对比",
    noPeopleScene ? "no people, no person, no human, no character, no figure, no silhouette" : undefined,
  ];

  return [prompt, ...variantParts].filter(Boolean).join("，");
}

function getAgentDisplayTextFromPlan(plan: AgentPlanResponse | undefined, mode: WorkMode, sourceText: string) {
  if (mode !== "image") return getNaturalAgentDisplayText(plan, mode, sourceText);

  const count = plan?.count && Number.isFinite(plan.count) ? Math.max(1, Math.floor(plan.count)) : getImageCountValue(getRequestedImageCount(sourceText), Number.POSITIVE_INFINITY);
  const combinedText = [sourceText, plan?.subject, plan?.prompt, ...(plan?.constraints ?? [])].filter(Boolean).join("，");
  if (wantsNoPeopleScene(combinedText)) return `我会生成${count > 1 ? `${count}张` : "一张"}场景图。`;
  const displayText = getNaturalAgentDisplayText(plan, mode, sourceText);
  const shouldMentionNoCollage = /(不要|别|不能|避免|不要再|又|不是|不做).{0,8}(拼图|合集|九宫格|多宫格|分屏|组图|照片墙)|(拼图|合集|九宫格|多宫格|分屏|组图|照片墙).{0,8}(不对|错|不要|别|避免)/.test(combinedText);

  if (count > 1 && shouldMentionNoCollage) return `${displayText}，会按单张画面处理，避免拼图或合集。`;
  return displayText;
}

function getNaturalAgentDisplayText(plan: AgentPlanResponse | undefined, mode: WorkMode, sourceText: string) {
  const cleaned = cleanAgentDisplayText(plan?.displayText?.trim() ?? "");
  if (cleaned) return cleaned;
  return getAgentMediaDisplayText(mode, sourceText, plan);
}

function cleanAgentDisplayText(text: string) {
  return text
    .replace(/，?每张(?:都)?(?:是)?单独画面/g, "")
    .replace(/，?每张画面只保留一位主体/g, "")
    .replace(/，?不做拼图或合集/g, "")
    .replace(/，?避免拼图或合集/g, "")
    .replace(/，?不会生成拼图或合集/g, "")
    .replace(/，?不做拼图/g, "")
    .replace(/，?不做合集/g, "")
    .replace(/[，。\s]+$/g, "")
    .trim();
}

function getAgentMediaDisplayText(mode: WorkMode, text: string, plan?: AgentPlanResponse) {
  const imageCount = plan?.count && Number.isFinite(plan.count) ? Math.max(1, Math.floor(plan.count)) : Number(text.match(/(\d+)\s*张/)?.[1]);
  const videoCount = plan?.count && Number.isFinite(plan.count) ? Math.max(1, Math.floor(plan.count)) : Number(text.match(/(\d+)\s*(个|条|段)\s*视频/)?.[1]);
  const countText = mode === "image" && Number.isFinite(imageCount) && imageCount > 1 ? `${Math.floor(imageCount)}张` : mode === "video" && Number.isFinite(videoCount) && videoCount > 1 ? `${Math.floor(videoCount)}个` : "";
  const subject = getNaturalSubjectLabel(text, plan);
  const differentText = /(不同|各不相同|不一样|多种|多个国家|不同国家|不同性别|不同时代|不同风格|不同场景|不同品种)/.test(text) ? "不同设定的" : "";

  if (mode === "image") return `我会生成${countText || "一张"}${differentText}${subject}。`;
  if (mode === "video") return `我先按你的需求生成${countText || "一段"}视频，结果出来后你可以继续挑选或调整。`;
  return "我先按你的需求整理一下。";
}

function getNaturalSubjectLabel(text: string, plan?: AgentPlanResponse) {
  const subject = plan?.subject?.trim();
  if (subject && subject.length <= 12 && !/(图片|照片|生成|每张|不同|一个|主体)/.test(subject)) return `${subject}图`;
  if (/美女|女性|女人|女孩|女生/.test(text)) return "美女图";
  if (/帅哥|男性|男人|男孩|男生/.test(text)) return "人物图";
  if (/人物|角色|人像/.test(text)) return "人物图";
  if (/小猫|猫咪|猫/.test(text)) return "小猫图";
  if (/场景|风景|环境|背景/.test(text)) return "场景图";
  if (/图片|照片|图/.test(text)) return "图片";
  return "图片";
}

function isAgentGeneratedMedia(message: Message) {
  return Boolean(message.generationMeta?.agentGenerated);
}

function getMessageVideos(message: Message) {
  return [...(message.videos ?? []), ...(message.videoUrl ? [message.videoUrl] : [])].filter((url, index, array) => Boolean(url) && array.indexOf(url) === index);
}

function getSessionMediaCounts(session?: WorkSession | null) {
  const imageUrls = new Set<string>();
  const videoUrls = new Set<string>();

  for (const message of session?.messages ?? []) {
    if (message.role !== "assistant") continue;

    const slotImageUrls = message.imageResultSlots?.flatMap((slot) => slot.type === "image" ? [slot.url] : []) ?? [];
    const images = slotImageUrls.length > 0 ? slotImageUrls : message.images ?? [];
    images.filter(Boolean).forEach((url) => imageUrls.add(normalizeMediaUrlForMatch(url)));
    getMessageVideos(message).forEach((url) => videoUrls.add(normalizeMediaUrlForMatch(url)));
  }

  return { images: imageUrls.size, videos: videoUrls.size };
}

function getWorkflowMediaCounts(workflow?: WorkflowItem | null) {
  const imageUrls = new Set<string>();
  const videoUrls = new Set<string>();

  for (const node of workflow?.canvas?.nodes ?? []) {
    node.data.images?.filter(Boolean).forEach((url) => imageUrls.add(normalizeMediaUrlForMatch(url)));
    if (node.data.videoUrl) videoUrls.add(normalizeMediaUrlForMatch(node.data.videoUrl));
  }

  return { images: imageUrls.size, videos: videoUrls.size };
}

function getLocalVideoPosterUrl(url: string | undefined) {
  if (!url?.startsWith("/generated/")) return undefined;
  const userVideoMatch = url.match(/^\/generated\/users\/([^/]+)\/videos\//);
  const isLegacyVideo = url.startsWith("/generated/videos/");
  if (!userVideoMatch && !isLegacyVideo) return undefined;
  const fileName = url.split("/").pop()?.split("?")[0];
  if (!fileName) return undefined;
  const baseName = fileName.replace(/\.(mp4|webm|mov)$/i, "");
  if (baseName === fileName) return undefined;
  return userVideoMatch ? `/generated/users/${userVideoMatch[1]}/video-posters/${baseName}.jpg` : `/generated/video-posters/${baseName}.jpg`;
}

function getVideoPosterForMessage(message: Message, url: string) {
  return message.videoPosters?.[url] ?? getLocalVideoPosterUrl(url);
}

function isWorkMode(value: unknown): value is WorkMode {
  return value === "general" || value === "agent" || value === "image" || value === "video";
}

function mergeValidModeSettings(current: Record<WorkMode, string>, stored: Partial<Record<WorkMode, string>> | undefined, validators: Record<WorkMode, readonly string[]>) {
  const next = { ...current };

  (["general", "agent", "image", "video"] as WorkMode[]).forEach((modeName) => {
    const value = stored?.[modeName];
    if (value && validators[modeName].includes(value)) next[modeName] = value;
  });

  return next;
}

function getGenerationModelIcon(modelId: string) {
  if (modelId.startsWith("deepseek/")) return DeepSeekIcon;
  if (modelId.startsWith("byteplus:") || modelId.startsWith("byteplus/") || modelId.startsWith("ep-")) return BytePlusIcon;
  if (modelId.startsWith("openai/")) return RiOpenaiFill;
  if (modelId.startsWith("google/")) return RiGoogleFill;
  if (modelId.startsWith("bytedance/") || modelId.startsWith("bytedance-seed/")) return RiTiktokFill;
  return null;
}

function isGoldGenerationModel(modelId: string) {
  return modelId === "openai/gpt-5.4-image-2" || modelId === "bytedance/seedance-2.0" || modelId === "byteplus:video.seedance-2-0";
}

function isGoldConversationModel(modelId: string) {
  return modelId === "openai/gpt-5.5";
}

const ratioCardMeta: Record<string, { icon: string; width: string; height: string }> = {
  智能比例: { icon: "spark", width: "16", height: "16" },
  "16:9": { icon: "rect", width: "18", height: "10" },
  "21:9": { icon: "rect", width: "18", height: "8" },
  "9:16": { icon: "rect", width: "10", height: "18" },
  "1:1": { icon: "rect", width: "14", height: "14" },
  "3:4": { icon: "rect", width: "12", height: "16" },
  "4:3": { icon: "rect", width: "16", height: "12" },
};

const ratioDimensionMap: Record<string, [number, number]> = {
  "16:9": [16, 9],
  "21:9": [21, 9],
  "4:3": [4, 3],
  "1:1": [1, 1],
  "3:4": [3, 4],
  "9:16": [9, 16],
};

function ToolButtonLabel({ icon: Icon, label, showChevron = false, strong = false, accent = false }: { icon?: typeof RiImageLine; label: string; showChevron?: boolean; strong?: boolean; accent?: boolean }) {
  return (
    <>
      {Icon ? <Icon className={accent ? "h-[18px] w-[18px] shrink-0 text-[var(--accent-blue)]" : "h-[18px] w-[18px] shrink-0 text-[#777777]"} aria-hidden="true" style={accent ? { ["--accent-blue" as string]: ACCENT_BLUE } : undefined} /> : null}
      <span className={`${accent ? (strong ? "font-semibold text-[var(--accent-blue)]" : "font-medium text-[var(--accent-blue)]") : (strong ? "font-semibold text-[#777777]" : "font-medium text-[#777777]")} max-[820px]:hidden`} style={accent ? { ["--accent-blue" as string]: ACCENT_BLUE } : undefined}>{label}</span>
      {showChevron ? <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" /> : null}
    </>
  );
}

function IconRenderer({ icon: Icon }: { icon: typeof RiImageLine }) {
  return <Icon className="h-[18px] w-[18px] shrink-0 text-[#222222]" aria-hidden="true" />;
}

function BlackHoverTooltip({ label, children, className = "", side = "top" }: { label: ReactNode; children: ReactNode; className?: string; side?: "top" | "bottom" }) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [horizontalAlign, setHorizontalAlign] = useState<"left" | "center" | "right">("center");
  const [verticalSide, setVerticalSide] = useState<"top" | "bottom">(side);
  const alignClass = horizontalAlign === "left" ? "left-0" : horizontalAlign === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  const positionClass = verticalSide === "bottom" ? "top-full mt-2" : "bottom-full mb-2";

  const updateTooltipAlign = () => {
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    const margin = 8;
    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const centeredLeft = wrapperRect.left + wrapperRect.width / 2 - tooltipWidth / 2;
    const centeredRight = centeredLeft + tooltipWidth;

    if (centeredLeft < margin) {
      setHorizontalAlign("left");
    } else if (centeredRight > window.innerWidth - margin) {
      setHorizontalAlign("right");
    } else {
      setHorizontalAlign("center");
    }

    if (side === "top" && wrapperRect.top - tooltipHeight - margin < margin) {
      setVerticalSide("bottom");
    } else if (side === "bottom" && wrapperRect.bottom + tooltipHeight + margin > window.innerHeight - margin) {
      setVerticalSide("top");
    } else {
      setVerticalSide(side);
    }
  };

  return (
    <span ref={wrapperRef} onMouseEnter={updateTooltipAlign} onFocus={updateTooltipAlign} className={`group/black-tooltip relative inline-flex ${className}`}>
      {children}
      <span ref={tooltipRef} className={`pointer-events-none absolute ${alignClass} z-[9999] ${positionClass} whitespace-nowrap rounded-lg bg-[#111111] px-3 py-2 text-[12px] font-medium leading-none text-white opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.18)] transition group-hover/black-tooltip:opacity-100`}>
        {label}
      </span>
    </span>
  );
}

function UsageSummaryButton({ summary, mediaCounts, className = "absolute right-4 top-1/2 -translate-y-1/2" }: { summary?: UsageSummary; mediaCounts?: { images: number; videos: number }; className?: string }) {
  const safeSummary = normalizeUsageSummary(summary);
  const imageCount = mediaCounts?.images ?? 0;
  const videoCount = mediaCounts?.videos ?? 0;
  const hasUsage = safeSummary.totalTokens > 0 || safeSummary.usd > 0 || safeSummary.credits > 0 || imageCount > 0 || videoCount > 0;

  return (
    <div className={`group ${className}`}>
      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label="查看当前对话用量">
        <RiCopperDiamondLine className="h-[22px] w-[22px]" aria-hidden="true" />
      </button>
      <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden min-w-[118px] rounded-[8px] bg-[#111111] px-2.5 py-1.5 text-[13px] leading-[18px] text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)] group-hover:block">
        <div className="mb-0.5 whitespace-nowrap text-[11px] text-[#8f8f8f]">使用量</div>
        {hasUsage ? (
          <div className="space-y-0 whitespace-nowrap">
            <div>• Tk {safeSummary.totalTokens.toLocaleString("en-US")}</div>
            <div>• <RiVipDiamondLine className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" /> {safeSummary.credits.toLocaleString("en-US")}</div>
            <div className="mx-2 my-1 h-px bg-[#8f8f8f]/40" aria-hidden="true" />
            <div>• <RiImageLine className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" /> {imageCount.toLocaleString("en-US")}</div>
            <div>• <RiFilmLine className="inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" /> {videoCount.toLocaleString("en-US")}</div>
          </div>
        ) : (
          <div className="whitespace-nowrap">暂无用量</div>
        )}
      </div>
    </div>
  );
}

function RatioOptionIcon({ option }: { option: string }) {
  const meta = ratioCardMeta[option] ?? ratioCardMeta["1:1"];

  if (meta.icon === "spark") {
    return <RiShining2Line className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" />;
  }

  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0 text-[#777777]">
      <rect x={(18 - Number(meta.width)) / 2} y={(18 - Number(meta.height)) / 2} width={meta.width} height={meta.height} rx="2.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ResolutionOptionIcon({ option, mode, highlighted = false }: { option: string; mode: WorkMode; highlighted?: boolean }) {
  const colorClassName = highlighted ? "text-[#b8860b]" : "text-[#222222]";

  if (mode === "video" && (option === "480p" || option === "720p" || option === "1080p" || option === "4K")) {
    const label = option === "480p" ? "SD" : option === "720p" ? "HD" : option === "1080p" ? "FHD" : "4K";
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" className="shrink-0">
        <rect x="1" y="2" width="20" height="18" rx="1" fill="#111111" />
        <text x="11" y="14.45" textAnchor="middle" fontSize="8" fontWeight="700" fill="#ffffff">
          {label}
        </text>
      </svg>
    );
  }

  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" className={`shrink-0 ${colorClassName}`}>
      <rect x="2.25" y="3.75" width="17.5" height="14.5" rx="1" stroke="currentColor" strokeWidth="1.7" />
      <text x="11" y="14.2" textAnchor="middle" fontSize="8.9" fontWeight="700" fill="currentColor">
        {option.replace(/[^0-9A-Za-z]/g, "")}
      </text>
    </svg>
  );
}

function getVideoResolutionLabel(option: string) {
  if (option === "480p") return "标清480p";
  if (option === "720p") return "高清720p";
  if (option === "1080p") return "全高清1080p";
  return option;
}

function CompactResolutionIcon({ option, mode, qualityBadgeLabel }: { option?: string; mode: "image" | "video"; qualityBadgeLabel?: string }) {
  if (mode === "video") {
    return (
      <span className="inline-flex h-4 min-w-6 items-center justify-center rounded-[3px] bg-[#111111] px-1 text-[9px] font-bold leading-none text-white">
        {option === "480p" ? "SD" : option === "1080p" ? "FHD" : option === "4K" ? "4K" : "HD"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex h-4 min-w-5 items-center justify-center rounded-[3px] border border-[#d5d5d5] px-1 text-[9px] font-bold leading-none text-[#777777]">{option ?? "1K"}</span>
      {qualityBadgeLabel ? <span className="text-[12px] font-semibold leading-none text-[#b8860b]">{qualityBadgeLabel}</span> : null}
    </span>
  );
}

function isLikelyThumbnailDimensions(dimensions?: ImageDimensions) {
  if (!dimensions) return false;
  return Math.max(dimensions.width, dimensions.height) <= 512;
}

function getImageSizeText(message: Message, imageUrl?: string) {
  if (message.mode !== "image") return undefined;
  const imageDimensions = message.imageDimensions ?? {};

  if (imageUrl && imageDimensions[imageUrl]) {
    const dimensions = imageDimensions[imageUrl];
    if (isLikelyThumbnailDimensions(dimensions)) {
      const expected = message.generationMeta?.mode === "image" ? getExpectedImageDimensions(message.generationMeta.model, message.generationMeta.settings?.resolution, message.generationMeta.settings?.ratio) : undefined;
      return expected?.width && expected.height ? `${expected.width} × ${expected.height}` : undefined;
    }
    return `${dimensions.width} × ${dimensions.height}`;
  }

  const sizeTexts = (message.images ?? [])
    .map((url) => imageDimensions[url])
    .filter((dimensions): dimensions is ImageDimensions => Boolean(dimensions))
    .filter((dimensions) => !isLikelyThumbnailDimensions(dimensions))
    .map((dimensions) => `${dimensions.width} × ${dimensions.height}`);

  return Array.from(new Set(sizeTexts)).join(" / ") || undefined;
}

function getCommonRatioLabel(width: number, height: number) {
  const commonRatios: Array<[string, number]> = [
    ["16:9", 16 / 9],
    ["21:9", 21 / 9],
    ["9:16", 9 / 16],
    ["4:3", 4 / 3],
    ["3:4", 3 / 4],
    ["1:1", 1],
  ];
  const ratio = width / height;
  const match = commonRatios.find(([, value]) => Math.abs(ratio - value) / value < 0.025);
  if (match) return match[0];

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function getImageResolutionFromDimensions(dimensions?: ImageDimensions) {
  if (!dimensions) return undefined;
  const maxSide = Math.max(dimensions.width, dimensions.height);
  if (maxSide >= 3500) return "4K";
  if (maxSide >= 1900) return "2K";
  return "1K";
}

function getVideoResolutionFromDimensions(dimensions?: ImageDimensions) {
  if (!dimensions) return undefined;
  const maxSide = Math.max(dimensions.width, dimensions.height);
  const minSide = Math.min(dimensions.width, dimensions.height);
  if (maxSide >= 3500 || minSide >= 2000) return "4K";
  if (minSide >= 1000 || maxSide >= 1900) return "1080p";
  if (minSide <= 500 || maxSide <= 800) return "480p";
  return "720p";
}

function getMessageMediaDimensions(message: Message, imageUrl?: string) {
  if (message.mode === "image") {
    if (imageUrl) {
      const dimensions = message.imageDimensions?.[imageUrl];
      return isLikelyThumbnailDimensions(dimensions) ? undefined : dimensions;
    }
    return (message.images ?? []).map((url) => message.imageDimensions?.[url]).find((dimensions) => dimensions && !isLikelyThumbnailDimensions(dimensions));
  }

  if (message.mode === "video") return message.videoDimensions;
  return undefined;
}

function formatMediaSizeText(sizeText: string, nonStandardSize = false) {
  return nonStandardSize ? `${sizeText}（非标）` : sizeText;
}

type ImageVariantGroup = {
  key: string;
  images: string[];
  imageIndexes?: number[];
  dimensions?: ImageDimensions;
  slotIndexes?: number[];
};

function getRequestedImageDisplayCount(message: Message) {
  const meta = message.generationMeta;
  if (meta?.mode !== "image") return undefined;
  if (meta.settings?.imageCount) return getImageCountValue(meta.settings.imageCount, meta.agentGenerated ? Number.POSITIVE_INFINITY : 4);
  return meta.agentGenerated ? undefined : 4;
}

function getExpectedDimensionsForMessage(message: Message) {
  const meta = message.generationMeta;
  return meta?.mode === "image" ? getExpectedImageDimensions(meta.model, meta.settings?.resolution, meta.settings?.ratio) : undefined;
}

function getDisplayImageItemsForMessage(message: Message) {
  const requestedImageCount = getRequestedImageDisplayCount(message);
  const items: Array<{ url: string; imageIndex: number; slotIndex?: number }> = message.imageResultSlots?.flatMap((slot, slotIndex) => slot.type === "image" ? [{ url: slot.url, imageIndex: slotIndex, slotIndex }] : []) ?? (message.images ?? []).map((url, imageIndex) => ({ url, imageIndex, slotIndex: undefined }));

  if (requestedImageCount === undefined) return items;
  return items.slice(0, requestedImageCount);
}

function getDisplayImagesForMessage(message: Message) {
  return getDisplayImageItemsForMessage(message).map((item) => item.url);
}

function getDisplayImageResultSlotsForMessage(message: Message) {
  if (!message.imageResultSlots) return undefined;
  const requestedImageCount = getRequestedImageDisplayCount(message);
  if (requestedImageCount === undefined) return message.imageResultSlots;
  return message.imageResultSlots.slice(0, requestedImageCount);
}

function getImageVariantPages(message: Message): ImageVariantGroup[] {
  const displayImageItems = getDisplayImageItemsForMessage(message);
  const images = displayImageItems.map((item) => item.url);
  const imageDimensions = message.imageDimensions ?? {};
  const groups = new Map<string, ImageVariantGroup>();
  const meta = message.generationMeta;
  const expected = getExpectedDimensionsForMessage(message);

  if (!meta?.agentGenerated) {
    return [{
      key: "requested:0",
      images,
      imageIndexes: displayImageItems.map((item) => item.imageIndex),
      dimensions: expected,
      slotIndexes: displayImageItems.map((item) => item.slotIndex).filter((slotIndex): slotIndex is number => slotIndex !== undefined),
    }];
  }

  const addToGroup = (url: string, imageIndex: number, slotIndex?: number) => {
    const dimensions = imageDimensions[url];
    const key = dimensions ? `${dimensions.width}x${dimensions.height}` : `unknown:${url}`;
    const group = groups.get(key);

    if (group) {
      group.images.push(url);
      group.imageIndexes = [...(group.imageIndexes ?? []), imageIndex];
      if (slotIndex !== undefined) group.slotIndexes = [...(group.slotIndexes ?? []), slotIndex];
    } else {
      groups.set(key, { key, images: [url], imageIndexes: [imageIndex], dimensions, slotIndexes: slotIndex !== undefined ? [slotIndex] : undefined });
    }
  };

  if (displayImageItems.length) {
    displayImageItems.forEach((item) => addToGroup(item.url, item.imageIndex, item.slotIndex));
  } else {
    images.forEach((url, imageIndex) => addToGroup(url, imageIndex));
  }

  const score = (group: ImageVariantGroup) => {
    if (!expected || !group.dimensions) return Number.MAX_SAFE_INTEGER;
    return Math.abs(group.dimensions.width - expected.width) + Math.abs(group.dimensions.height - expected.height);
  };

  return Array.from(groups.values())
    .sort((a, b) => score(a) - score(b))
    .flatMap((group) => {
      const pageCount = Math.max(1, Math.ceil(Math.max(group.images.length, group.slotIndexes?.length ?? 0) / 4));
      return Array.from({ length: pageCount }).map((_, pageIndex) => ({
        ...group,
        key: `${group.key}:${pageIndex}`,
        images: group.images.slice(pageIndex * 4, pageIndex * 4 + 4),
        imageIndexes: group.imageIndexes?.slice(pageIndex * 4, pageIndex * 4 + 4),
        slotIndexes: group.slotIndexes?.slice(pageIndex * 4, pageIndex * 4 + 4),
      }));
    });
}

function getPreviewMetaWithDimensions(meta: PreviewMediaMeta | undefined, dimensions: ImageDimensions, mode: "image" | "video") {
  if (!meta) return meta;
  const resolution = mode === "image" ? getImageResolutionFromDimensions(dimensions) ?? meta.resolution : getVideoResolutionFromDimensions(dimensions) ?? meta.resolution;
  const sizeText = formatMediaSizeText(`${dimensions.width} × ${dimensions.height}`, mode === "video" && meta.nonStandardSize);
  const actualRatio = getCommonRatioLabel(dimensions.width, dimensions.height);

  return {
    ...meta,
    ratio: meta.ratio.includes(actualRatio) ? meta.ratio : actualRatio,
    sizeText,
    resolution,
    qualityBadgeLabel: mode === "image" ? getImageQualityBadgeLabel(resolution) : "",
  };
}

function normalizeMediaUrlForMatch(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
}

function getAssetIdentityKey(asset: Pick<AssetItem, "id" | "mediaId" | "url">) {
  return asset.mediaId || normalizeMediaUrlForMatch(asset.url) || asset.id;
}

function messageHasMediaUrl(message: Message, url: string) {
  const target = normalizeMediaUrlForMatch(url);
  return [...(message.images ?? []), ...getMessageVideos(message)].some((item) => normalizeMediaUrlForMatch(item) === target);
}

function getPreviewMediaMeta(message: Message, imageUrl?: string): PreviewMediaMeta {
  const meta = message.generationMeta;
  const mode = meta?.mode ?? (message.mode === "video" ? "video" : "image");
  const settings = meta?.settings;
  const ratio = settings?.ratio ?? "智能比例";
  const resolution = settings?.resolution ?? (mode === "video" ? "720p" : "1K");
  const duration = mode === "video" ? settings?.duration?.trim() : "";
  const actualDimensions = getMessageMediaDimensions(message, imageUrl);
  const dimensions = getDisplayDimensions(ratio, resolution, mode, meta?.model);
  const nonStandardSize = mode === "video" && ratio !== "智能比例" && isNonStandardVideoSize(meta?.model, resolution, ratio);
  const modelLabel = meta?.model ? getGenerationModelLabel(mode, meta.model) : mode === "video" ? getGenerationModelLabel("video", DEFAULT_VIDEO_MODEL) : getGenerationModelLabel("image", DEFAULT_IMAGE_MODEL);
  const rawSizeText = actualDimensions ? `${actualDimensions.width} × ${actualDimensions.height}` : getImageSizeText(message, imageUrl) ?? (dimensions.width && dimensions.height ? `${dimensions.width} × ${dimensions.height}` : "智能尺寸");
  const sizeText = formatMediaSizeText(rawSizeText, nonStandardSize);
  const actualRatio = actualDimensions ? getCommonRatioLabel(actualDimensions.width, actualDimensions.height) : mode === "video" && dimensions.width && dimensions.height ? getCommonRatioLabel(dimensions.width, dimensions.height) : ratio;
  const actualResolution = mode === "image" ? (getImageResolutionFromDimensions(actualDimensions) ?? resolution) : (getVideoResolutionFromDimensions(actualDimensions ?? dimensions) ?? resolution);
  const qualityBadgeLabel = mode === "image" ? getImageQualityBadgeLabel(actualResolution) : "";

  return { modelLabel, ratio: actualRatio, sizeText, resolution: actualResolution, mode, duration, qualityBadgeLabel, nonStandardSize };
}

function getWorkflowNodeSourcePrompt(workflow: WorkflowItem, node: WorkflowNode) {
  return node.data.prompt?.trim() || node.data.text?.trim() || node.data.outputText?.trim() || workflow.title;
}

function getWorkflowPreviewMeta(kind: "image" | "video", node: WorkflowNode, url: string, asset?: AssetItem): PreviewMediaMeta {
  const assetMeta = asset?.previewMeta;
  const dimensions = kind === "image" ? node.data.imageDimensions?.[url] : undefined;
  if (assetMeta && assetMeta.sizeText && assetMeta.sizeText !== "-") return assetMeta;

  const ratio = node.data.ratio || assetMeta?.ratio || (kind === "video" ? "16:9" : "智能比例");
  const resolution = node.data.resolution || assetMeta?.resolution || (kind === "video" ? "720p" : "1K");
  const expectedDimensions = dimensions ?? getDisplayDimensions(ratio, resolution, kind, node.data.model) ?? undefined;
  const actualRatio = dimensions ? getCommonRatioLabel(dimensions.width, dimensions.height) : assetMeta?.ratio && assetMeta.ratio !== "-" ? assetMeta.ratio : expectedDimensions?.width && expectedDimensions.height ? getCommonRatioLabel(expectedDimensions.width, expectedDimensions.height) : ratio;
  const sizeText = dimensions
    ? `${dimensions.width} × ${dimensions.height}`
    : assetMeta?.sizeText && assetMeta.sizeText !== "-"
      ? assetMeta.sizeText
      : expectedDimensions?.width && expectedDimensions.height
        ? `${expectedDimensions.width} × ${expectedDimensions.height}`
        : "智能尺寸";
  const actualResolution = kind === "image"
    ? getImageResolutionFromDimensions(dimensions ?? expectedDimensions) ?? resolution
    : getVideoResolutionFromDimensions(dimensions ?? expectedDimensions) ?? resolution;

  return {
    modelLabel: node.data.model ? getGenerationModelLabel(kind, node.data.model) : assetMeta?.modelLabel || "-",
    ratio: actualRatio,
    sizeText,
    resolution: actualResolution,
    mode: kind,
    duration: kind === "video" ? node.data.duration || assetMeta?.duration : undefined,
    qualityBadgeLabel: kind === "image" ? getImageQualityBadgeLabel(actualResolution) : "",
  };
}

function isInvalidPersistedPrompt(value: string) {
  const text = value.trim();
  return !text || /^\?+$/.test(text);
}

function getImageSourcePrompt(message: Message, url: string) {
  const itemPrompt = getImagePromptByUrl(message.imagePrompts, url);
  if (itemPrompt) return itemPrompt;
  const fallback = message.generationMeta?.originalPrompt ?? message.content;
  if (message.generationMeta?.agentGenerated) return sanitizeAgentPromptFallback(fallback);
  return fallback;
}

function getImagePromptByUrl(prompts: Record<string, string> | undefined, url: string) {
  if (!prompts) return "";
  const direct = prompts[url]?.trim();
  if (direct) return direct;

  const normalize = (value: string) => value.split("?")[0].replace(/^https?:\/\/[^/]+/, "");
  const normalizedUrl = normalize(url);
  const match = Object.entries(prompts).find(([key]) => normalize(key) === normalizedUrl)?.[1]?.trim();
  return match ?? "";
}

function sanitizeAgentPromptFallback(prompt: string) {
  const text = prompt.trim();
  if (!text) return "";
  const firstChineseIntent = text.search(/(每张|\d+张|[一二两三四五六七八九十]{1,3}张|禁止拼图|禁止多人|不同国家|不同性别|不同时代|合集|九宫格)/);
  const hasEnglishPrompt = /[A-Za-z]{4,}/.test(text);
  if (hasEnglishPrompt && firstChineseIntent > 0) return text.slice(0, firstChineseIntent).replace(/[，,\s]+$/g, "").trim();
  return text;
}

type AgentMediaPromptItem = {
  prompt: string;
  label: string;
};

function getAgentMediaPromptItems(message: Message): AgentMediaPromptItem[] {
  if (!message.generationMeta?.agentGenerated) return [];

  if (message.mode === "video") {
    const videos = getMessageVideos(message);
    const prompts = videos
      .map((url, index) => ({ prompt: (message.videoPrompts?.[url] ?? message.generationMeta?.itemPrompts?.[index] ?? message.generationMeta?.originalPrompt ?? "").trim(), label: `视频提示词${index + 1}` }))
      .filter((item) => Boolean(item.prompt));
    if (prompts.length > 0) return prompts;
    const prompt = message.generationMeta?.originalPrompt?.trim();
    return prompt ? [{ prompt, label: "视频提示词" }] : [];
  }

  if (message.mode !== "image") return [];

  const prompts = (message.images ?? [])
    .map((url, index) => ({ prompt: getImageSourcePrompt(message, url).trim(), label: `图片提示词${index + 1}` }))
    .filter((item) => Boolean(item.prompt));

  if (prompts.length === 0) {
    const fallback = sanitizeAgentPromptFallback(message.generationMeta.originalPrompt ?? "").trim();
    return fallback ? [{ prompt: fallback, label: "图片提示词" }] : [];
  }

  const uniquePrompts: AgentMediaPromptItem[] = [];
  prompts.forEach((item) => {
    if (!uniquePrompts.some((existing) => existing.prompt === item.prompt)) uniquePrompts.push(item);
  });

  return uniquePrompts;
}

function AgentMediaPromptPanel({ items, pageIndex, expanded, onToggle, onUsePrompt, onPrevious, onNext }: { items: AgentMediaPromptItem[]; pageIndex: number; expanded: boolean; onToggle: () => void; onUsePrompt: (prompt: string) => void; onPrevious: () => void; onNext: () => void }) {
  if (items.length === 0) return null;

  const safeIndex = Math.min(Math.max(0, pageIndex), items.length - 1);
  const item = items[safeIndex];
  const hasPages = items.length > 1;
  const pager = hasPages ? (
    <span className="inline-flex items-center gap-0 text-[12px] font-medium leading-none text-[#555555]">
      <button type="button" onClick={(event) => { event.stopPropagation(); onPrevious(); }} className="flex h-4 w-4 items-center justify-center rounded-[3px] transition hover:bg-white" aria-label="上一条提示词"><RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" /></button>
      <span className="min-w-8 text-center">{safeIndex + 1}/{items.length}</span>
      <button type="button" onClick={(event) => { event.stopPropagation(); onNext(); }} className="flex h-4 w-4 items-center justify-center rounded-[3px] transition hover:bg-white" aria-label="下一条提示词"><RiArrowRightSLine className="h-4 w-4" aria-hidden="true" /></button>
    </span>
  ) : null;

  return (
    <div className="mt-2 w-full max-w-[1006px]">
      <button type="button" onClick={onToggle} className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${expanded ? "rounded-t-[8px] border-b border-[#e4e4e4] bg-[#f3f3f3] text-[#333333] ring-1 ring-[#e7e7e7] hover:bg-[#ededed]" : "rounded-[8px] bg-[#f8f8f8] text-[#9a9a9a] ring-1 ring-[#f0f0f0] hover:bg-[#f4f4f4]"}`} aria-expanded={expanded}>
        {expanded ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium leading-none text-[#777777]"><RiInformationLine className="h-3.5 w-3.5" aria-hidden="true" />{item.label.replace(/\d+$/, "")}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-[#9a9a9a]">{item.prompt}</span>
        )}
        {expanded ? (
          <div className="ml-auto flex shrink-0 items-center gap-4">
            {pager}
            <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onUsePrompt(item.prompt); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onUsePrompt(item.prompt); } }} className="inline-flex h-[26px] items-center gap-1 rounded-[5px] bg-black/70 px-1.5 font-medium leading-none text-white ring-1 ring-white/12 transition hover:bg-black/82">
              <RiTBoxLine className="h-4 w-4" aria-hidden="true" />
              <span className="text-[12px] leading-none">使用提示词</span>
            </span>
          </div>
        ) : null}
        {expanded ? <RiArrowUpSLine className="h-5 w-5 shrink-0 text-[#777777]" aria-hidden="true" /> : <RiArrowDownSLine className="h-5 w-5 shrink-0 text-[#a8a8a8]" aria-hidden="true" />}
      </button>
      {expanded ? (
        <div className="rounded-b-[8px] bg-[#f3f3f3] px-3 pb-3 pt-2 text-[14px] leading-7 text-[#333333] ring-1 ring-[#e7e7e7] ring-t-0">
          <div className="max-h-[118px] overflow-y-auto pr-2">{item.prompt}</div>
        </div>
      ) : null}
    </div>
  );
}

function MediaPromptBlock({ message, references, mediaReferences, onPreviewMedia, onUsePrompt, copyState, displayImageUrl, variantIndex = 0, variantCount = 1, onPreviousVariant, onNextVariant }: { message: Message; references?: ImageReference[]; mediaReferences?: MediaFileReference[]; onPreviewMedia?: (file: UploadedFileEntry) => void; onUsePrompt: (message: Message) => void; copyState?: "success" | "error"; displayImageUrl?: string; variantIndex?: number; variantCount?: number; onPreviousVariant?: () => void; onNextVariant?: () => void }) {
  const promptRef = useRef<HTMLDivElement | null>(null);
  const [shouldShowPromptOverlay, setShouldShowPromptOverlay] = useState(false);

  const meta = message.generationMeta;
  const mode = meta?.mode ?? (message.mode === "video" ? "video" : "image");
  const settings = meta?.settings;
  const ratio = settings?.ratio ?? "智能比例";
  const resolution = settings?.resolution ?? (mode === "video" ? "720p" : "1K");
  const duration = mode === "video" ? settings?.duration?.trim() : "";
  const actualDimensions = getMessageMediaDimensions(message, displayImageUrl);
  const dimensions = getDisplayDimensions(ratio, resolution, mode, meta?.model);
  const nonStandardSize = mode === "video" && ratio !== "智能比例" && isNonStandardVideoSize(meta?.model, resolution, ratio);
  const modelLabel = meta?.model ? getGenerationModelLabel(mode, meta.model) : mode === "video" ? getGenerationModelLabel("video", DEFAULT_VIDEO_MODEL) : getGenerationModelLabel("image", DEFAULT_IMAGE_MODEL);
  const rawSizeText = actualDimensions ? `${actualDimensions.width} × ${actualDimensions.height}` : getImageSizeText(message) ?? (dimensions.width && dimensions.height ? `${dimensions.width} × ${dimensions.height}` : "智能尺寸");
  const sizeText = formatMediaSizeText(rawSizeText, nonStandardSize);
  const displayRatio = actualDimensions ? getCommonRatioLabel(actualDimensions.width, actualDimensions.height) : mode === "video" && dimensions.width && dimensions.height ? getCommonRatioLabel(dimensions.width, dimensions.height) : ratio;
  const displayResolution = mode === "image" ? (getImageResolutionFromDimensions(actualDimensions) ?? resolution) : (getVideoResolutionFromDimensions(actualDimensions ?? dimensions) ?? resolution);
  const qualityBadgeLabel = mode === "image" ? getImageQualityBadgeLabel(displayResolution) : "";
  const promptReferences = references ?? message.imageReferences;
  const shouldShowReferenceThumbnails = !meta?.agentGenerated && (mode === "image" || mode === "video");
  const mentionedReferenceUrls = new Set(
    message.content
      .split(/(@[^@\s，。！？；;、]+)/g)
      .filter((part) => part.startsWith("@"))
      .map((part) => promptReferences?.find((reference) => reference.name === part.slice(1))?.url)
      .filter((url): url is string => Boolean(url))
      .map(normalizeMediaUrlForMatch),
  );
  const renderCopyButton = (variant: "inline" | "overlay") => (
    <button
      type="button"
      onClick={() => onUsePrompt(message)}
      className={
        variant === "overlay"
          ? "ml-2 inline-flex h-[26px] items-center gap-1 rounded-[5px] bg-black/46 px-1.5 align-[-2px] font-medium leading-none text-white ring-1 ring-white/12 backdrop-blur-[10px] transition hover:bg-black/58"
          : "ml-2 inline-flex h-[22px] items-center gap-1 rounded-[5px] bg-[#f3f3f3] px-1.5 align-middle font-medium leading-none text-[#666666] ring-1 ring-[#e5e5e5] transition hover:bg-[#ebebeb] hover:text-[#111111]"
      }
    >
      <RiTBoxLine className="h-4 w-4" aria-hidden="true" />
      <span className="text-[12px] leading-none">{copyState === "success" ? "已填入" : copyState === "error" ? "填入失败" : "使用提示词"}</span>
    </button>
  );
  const inlineCopyButton = (
    <span data-prompt-action="true" className="inline-flex items-center align-middle whitespace-nowrap">{renderCopyButton("inline")}</span>
  );
  const blockCopyButton = (
    <div className="mb-2 flex items-center justify-between gap-3 bg-white/88 pb-2">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium leading-none text-[#9a9a9a]">
        <RiInformationLine className="h-3.5 w-3.5" aria-hidden="true" />
        图片提示词
      </span>
      {renderCopyButton("overlay")}
    </div>
  );

  useEffect(() => {
    const element = promptRef.current;
    if (!element) return;

    const measure = () => {
      const clamped = element.scrollHeight > element.clientHeight + 1;
      const action = element.querySelector<HTMLElement>('[data-prompt-action="true"]');
      const actionVisible = action ? action.offsetTop + action.offsetHeight <= element.clientHeight + 1 : false;
      setShouldShowPromptOverlay(clamped && !actionVisible);
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    window.addEventListener("resize", measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [message.content, copyState]);

  if (!message.content.trim()) return null;

  return (
    <div className="relative mb-0 max-w-[1006px]">
      <div className="group/prompt relative">
        <div ref={promptRef} className="relative max-h-[56px] overflow-hidden text-[14px] leading-7 text-[#111111]">
          {shouldShowReferenceThumbnails ? <InlineReferenceThumbnails references={promptReferences} excludeUrls={mentionedReferenceUrls} /> : null}
          <ReferencedTextContent content={message.content} references={promptReferences} mediaReferences={mediaReferences} onPreviewMedia={onPreviewMedia} />
          {inlineCopyButton}
          {shouldShowPromptOverlay ? <div className="pointer-events-none absolute bottom-0 right-0 h-7 w-16 bg-gradient-to-r from-white/0 via-white/90 to-white" /> : null}
        </div>
        {shouldShowPromptOverlay ? (
          <div className="pointer-events-none absolute -inset-x-4 -top-3 z-30 max-h-[250px] rounded-[12px] bg-white/88 px-4 pb-3 pt-3 text-[14px] leading-7 text-[#111111] opacity-0 shadow-[0_18px_36px_rgba(0,0,0,0.08)] backdrop-blur-[10px] transition-opacity delay-500 duration-200 group-hover/prompt:pointer-events-auto group-hover/prompt:opacity-100 group-hover/prompt:delay-0">
            {blockCopyButton}
            <div className="max-h-[198px] overflow-y-auto pr-2">{shouldShowReferenceThumbnails ? <InlineReferenceThumbnails references={promptReferences} excludeUrls={mentionedReferenceUrls} /> : null}<ReferencedTextContent content={message.content} references={promptReferences} mediaReferences={mediaReferences} onPreviewMedia={onPreviewMedia} /></div>
          </div>
        ) : null}
      </div>
      <div className="mt-0 flex flex-wrap items-center gap-2 text-[12px] leading-5 text-[#9a9a9a]">
        <span className="truncate">{modelLabel}</span>
        <span className="text-[#d0d0d0]">|</span>
        <span>{displayRatio}</span>
        <span className="text-[#d0d0d0]">|</span>
        <span className="inline-flex items-center gap-1.5">
          <span>{sizeText}</span>
          <CompactResolutionIcon option={displayResolution} mode={mode} qualityBadgeLabel={qualityBadgeLabel} />
        </span>
        {mode === "image" && variantCount > 1 ? (
          <span className="inline-flex items-center gap-0.5 px-0.5 py-0.5 text-[12px] font-medium leading-none text-[#777777]">
            <button type="button" onClick={onPreviousVariant} className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[#777777] transition hover:bg-white hover:text-[#111111]" aria-label="上一组尺寸"><RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" /></button>
            <span className="min-w-7 text-center">{variantIndex + 1}/{variantCount}</span>
            <button type="button" onClick={onNextVariant} className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[#777777] transition hover:bg-white hover:text-[#111111]" aria-label="下一组尺寸"><RiArrowRightSLine className="h-4 w-4" aria-hidden="true" /></button>
          </span>
        ) : null}
        {mode === "video" && duration ? (
          <>
            <span className="text-[#d0d0d0]">|</span>
            <span>{duration}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function AiGenerate3dIcon({ className = "h-[18px] w-[18px] shrink-0 text-[#777777]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M15.1416 2.81836L13.1016 3.94824L12 3.31055L4.5 7.65234V7.6582L12 12V20.6895L19.5 16.3467V11.5L21.5 10.3291V17.5L12 23L2.5 17.5V6.5L12 1L15.1416 2.81836ZM18.5293 2.31934C18.7059 1.8935 19.2943 1.89349 19.4707 2.31934L19.7236 2.93066C20.1556 3.97346 20.9615 4.80618 21.9746 5.25684L22.6924 5.57617C23.1026 5.75901 23.1026 6.3562 22.6924 6.53906L21.9326 6.87695C20.9449 7.31624 20.1534 8.11944 19.7139 9.12793L19.4668 9.69336C19.2864 10.1075 18.7137 10.1075 18.5332 9.69336L18.2871 9.12793C17.8476 8.11929 17.0552 7.31628 16.0674 6.87695L15.3076 6.53906C14.8974 6.35622 14.8974 5.75899 15.3076 5.57617L16.0254 5.25684C17.0385 4.80618 17.8445 3.97348 18.2764 2.93066L18.5293 2.31934Z" />
    </svg>
  );
}

function AiAgentLineIcon({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M12 2C17.5228 2 22 6.47715 22 12C22 14.7096 20.9205 17.1697 19.1709 18.9697C17.3551 20.8376 14.8124 22 12 22C9.18756 22 6.64488 20.8376 4.8291 18.9697C3.07949 17.1697 2 14.7096 2 12C2 6.47715 6.47715 2 12 2ZM12 16C10.0022 16 8.20124 16.8375 6.9248 18.1816C8.30642 19.3175 10.0724 20 12 20C13.9274 20 15.6927 19.3173 17.0742 18.1816C15.7978 16.8377 13.9975 16 12 16ZM12 4C7.58172 4 4 7.58172 4 12C4 13.7701 4.57462 15.4044 5.54785 16.7295C7.1822 15.0483 9.46797 14 12 14C14.5318 14 16.8169 15.0485 18.4512 16.7295C19.4246 15.4043 20 13.7703 20 12C20 7.58172 16.4183 4 12 4ZM11.5293 5.31934C11.7058 4.89329 12.2943 4.89329 12.4707 5.31934L12.7236 5.93066C13.1556 6.97343 13.9615 7.80622 14.9746 8.25684L15.6924 8.5752C16.1029 8.75796 16.1028 9.35627 15.6924 9.53906L14.9326 9.87695C13.9448 10.3163 13.1534 11.1193 12.7139 12.1279L12.4668 12.6934C12.2864 13.1074 11.7137 13.1074 11.5332 12.6934L11.2871 12.1279C10.8476 11.1193 10.0552 10.3163 9.06738 9.87695L8.30762 9.53906C7.89719 9.35628 7.89717 8.75795 8.30762 8.5752L9.02539 8.25684C10.0385 7.80623 10.8445 6.97345 11.2764 5.93066L11.5293 5.31934Z" />
    </svg>
  );
}

function DeepSeekIcon({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M19.7486 6.70266C20.3482 6.09168 21.0251 5.88487 21.8216 5.88487 22.4994 5.88487 22.8772 5.51788 23.1687 5.23481 23.3841 5.0256 23.5423 4.86223 23.7495 4.9267 23.9849 4.99995 24.0039 5.27202 23.9849 5.49211 23.8092 7.48319 22.5352 9.10375 20.5089 9.33432 20.3217 9.35326 20.2848 9.41777 20.2886 9.58097 20.2886 12.135 19.3023 14.3682 17.7413 16.3177 17.3773 16.7723 17.4617 17.397 18.0099 17.5934 18.2913 17.6942 18.6306 17.8197 19.0629 18.0261 19.3173 18.1475 19.3664 18.8022 18.6619 18.952 18.2141 19.0446 17.728 19.1012 17.2409 19.0989 16.0407 19.0932 14.7567 19.2619 13.6741 19.7802 12.5444 20.3211 11.5023 20.4276 10.5351 20.4832 6.05234 20.7487 1.91959 17.3891 1.14577 12.9829.4786 9.18832 2.57147 5.07162 6.66325 4.61173 7.14737 4.55719 7.62089 4.53981 8.0848 4.55739 8.87454 4.58733 9.6213 4.41281 10.366 4.23877 11.0506 4.07878 11.7335 3.9192 12.4464 3.9192 13.289 3.9192 13.4518 4.23796 13.1926 4.33093 12.9459 4.42011 12.0002 5.5 12.8219 6.09927 13.5751 6.5753 14.217 7.22865 14.859 7.88213 15.7004 8.73861 16.542 9.59533 17.6349 10.0534 17.8183 10.1293 17.8968 10.0914 17.9488 9.91865 17.984 9.80487 18.021 9.69242 18.0579 9.58018 18.1084 9.42668 18.1588 9.27358 18.2041 9.11798 18.2458 8.98703 18.2118 8.896 18.0803 8.80682 16.5019 7.7348 15.7807 5.49544 16.7241 3.7693 16.9257 3.40591 17.2152 3.45676 17.3454 3.8414 17.5002 4.5 17.6793 4.81997 18.5532 5.2113 19.1972 5.4997 19.6209 5.94937 19.7486 6.70266ZM12.2889 8.15848C10.7532 7.02012 8.79874 6.38384 6.88727 6.59919 5.50456 6.7546 4.48708 7.51265 3.84434 8.54596 4.06732 8.56243 4.31508 8.58934 4.58987 8.62966 6.85894 8.96265 8.79097 9.98777 10.3898 11.5802 11.3587 12.5454 12.1238 13.6898 12.8253 14.6671 13.4051 15.4748 13.9559 16.1921 14.5951 16.7793 15.8396 15.7081 16.6794 14.4169 17.0503 13.8 17.8977 12.3908 17.6928 12.2942 16.853 11.898 16.316 11.6446 15.5193 11.2687 14.5722 10.3488 13.5602 9.36588 13.0771 8.7451 12.2889 8.15848ZM3.11574 12.637C3.70717 16 6.70788 18.473 10.417 18.4867 11.3223 18.4901 12.1492 18.2666 12.8906 17.9119 12.2402 17.2517 11.6978 16.526 11.2006 15.8333 10.4412 14.7753 9.79818 13.8139 8.97846 12.9972 7.66251 11.6866 6.11607 10.8751 4.29954 10.6085 3.72541 10.5242 3.34242 10.5175 3.11076 10.5295 2.99297 11.2236 2.99407 11.9452 3.11574 12.637ZM15.1938 11.1427C14.7189 10.6785 13.9006 9.95702 13.1369 10.3762 12.0002 11 14.354 13.4813 15.472 13.4291 17.254 13.3458 15.7214 11.7533 15.1938 11.1427Z" />
    </svg>
  );
}

function ImageUploadLineIcon({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M24 19H21V23H19V19H16L20 15L24 19ZM21.0078 3C21.5555 3 21.9999 3.44482 22 3.99316V13H20V5H4V18.999L14 9L17 12V14.8291L14 11.8281L6.82715 19H14V21H2.99219C2.44451 21 2.00013 20.5552 2 20.0068V3.99316C2.00013 3.44463 2.45577 3 2.99219 3H21.0078ZM8 7C9.10457 7 10 7.89543 10 9C10 10.1046 9.10457 11 8 11C6.89543 11 6 10.1046 6 9C6 7.89543 6.89543 7 8 7Z" />
    </svg>
  );
}

function RiAiIcon({ className = "h-4 w-4", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...props}>
      <path d="M16.4004 21H14.2461L12.2461 16H5.75391L3.75391 21H1.59961L8 4.99996H10L16.4004 21ZM21 12V21H19V12H21ZM6.55371 14H11.4463L9 7.88473L6.55371 14ZM19.5293 2.3193C19.7058 1.89351 20.2942 1.8935 20.4707 2.3193L20.7236 2.93063C21.1555 3.97343 21.9615 4.80613 22.9746 5.2568L23.6914 5.57613C24.1022 5.75881 24.1022 6.35634 23.6914 6.53902L22.9326 6.87691C21.945 7.31619 21.1534 8.11942 20.7139 9.12789L20.4668 9.69332C20.2863 10.1075 19.7136 10.1075 19.5332 9.69332L19.2861 9.12789C18.8466 8.11941 18.0551 7.31619 17.0674 6.87691L16.3076 6.53902C15.8974 6.35617 15.8974 5.75894 16.3076 5.57613L17.0254 5.2568C18.0384 4.80613 18.8445 3.97343 19.2764 2.93063L19.5293 2.3193Z" />
    </svg>
  );
}

function getDisplayDimensions(ratio: string, resolution: string, mode: WorkMode, modelId?: string) {
  const ratioMeta = ratioDimensionMap[ratio] ?? [1, 1];

  if (mode === "image") {
    return getExpectedImageDimensions(modelId, resolution, ratio);
  }

  if (mode === "video") {
    return getExpectedVideoDimensions(modelId, resolution, ratio);
  }

  const [ratioW, ratioH] = ratio === "智能比例" ? [16, 9] : ratioMeta;
  const isLandscape = ratioW >= ratioH;
  const longSide = 1280;
  const shortSide = Math.round((longSide * Math.min(ratioW, ratioH)) / Math.max(ratioW, ratioH));

  if (ratio === "智能比例") {
    return { width: longSide, height: Math.round((longSide * 9) / 16) };
  }

  return isLandscape ? { width: longSide, height: shortSide } : { width: shortSide, height: longSide };
}

function ThinkingIndicator() {
  return (
    <div className="flex min-h-[300px] items-start justify-start" role="status" aria-live="polite">
      <div className="flex items-center gap-2 px-0 py-1 text-sm text-[#6f6f6f]">
        <GridLoader className="mr-1" />
        <span className="yinzao-thinking-shimmer">正在认真思考</span>
        <span className="yinzao-thinking-dots flex items-center gap-1">
          <span className="yinzao-thinking-dot h-1.5 w-1.5 rounded-full" />
          <span className="yinzao-thinking-dot h-1.5 w-1.5 rounded-full" />
          <span className="yinzao-thinking-dot h-1.5 w-1.5 rounded-full" />
        </span>
      </div>
    </div>
  );
}

function PromptOptimizingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] bg-white/18 backdrop-blur-[1px]" role="status" aria-label="正在优化提示词">
      <LoadingSpinner />
    </div>
  );
}

function LoadingSpinner({ size = 32 }: { size?: number }) {
  const dotSize = Math.max(5, Math.round(size * 0.16));
  const strokeWidth = Math.max(4, Math.round(size * 0.16));
  const style = {
    width: size,
    aspectRatio: 1,
    borderRadius: "50%",
    background: `radial-gradient(farthest-side,#367cee 94%,#0000) top/${dotSize}px ${dotSize}px no-repeat, conic-gradient(#0000 10%,rgba(54,124,238,0.12) 28%,rgba(54,124,238,0.42) 48%,#367cee 100%)`,
    WebkitMask: `radial-gradient(farthest-side,#0000 calc(100% - ${strokeWidth}px),#000 0)`,
    mask: `radial-gradient(farthest-side,#0000 calc(100% - ${strokeWidth}px),#000 0)`,
  } as CSSProperties;

  return <div className="animate-spin" style={style} aria-hidden="true" />;
}

const gridLoaderPatterns = {
  sparkle: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  "plus-hollow": [0, 1, 0, 1, 0, 1, 0, 1, 0],
  cross: [1, 0, 1, 0, 1, 0, 1, 0, 1],
  frame: [1, 1, 1, 1, 0, 1, 1, 1, 1],
} as const;

type GridLoaderPattern = keyof typeof gridLoaderPatterns;
type GridLoaderMode = "pulse" | "stagger";

function GridLoader({ pattern = "sparkle", mode = "stagger", size = 16, color = "#367cee", className = "", decorative = true }: { pattern?: GridLoaderPattern; mode?: GridLoaderMode; size?: number; color?: string; className?: string; decorative?: boolean }) {
  const cells = gridLoaderPatterns[pattern];
  const style = { "--grid-loader-size": `${size}px`, "--grid-loader-color": color } as CSSProperties;

  return (
    <span className={`yinzao-grid-loader yinzao-grid-loader-${mode} ${className}`} style={style} aria-hidden={decorative ? "true" : undefined} role={decorative ? undefined : "status"} aria-label={decorative ? undefined : "Loading"}>
      {cells.map((active, index) => (
        <span key={index} className="yinzao-grid-loader-cell" data-active={active ? "true" : "false"} style={{ "--grid-loader-index": index } as CSSProperties} />
      ))}
    </span>
  );
}

function InlineLoadingDots() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 align-middle" aria-hidden="true">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a] [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a] [animation-delay:-0.1s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8a8a8a]" />
    </span>
  );
}

function HaloPulseIndicator() {
  return <GridLoader pattern="sparkle" mode="stagger" />;
}

function FeedbackButton({
  label,
  children,
  onClick,
  state = "idle",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  state?: "idle" | "success" | "error";
}) {
  return (
    <BlackHoverTooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="flashmuse-feedback-button flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-[#8a8a8a] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
      >
        {state === "success" ? <RiCheckLine className="h-4.5 w-4.5 text-[#111111]" aria-hidden="true" /> : state === "error" ? <RiCloseLine className="h-4.5 w-4.5 text-[#111111]" aria-hidden="true" /> : children}
      </button>
    </BlackHoverTooltip>
  );
}

function ActiveMessageCircleXIcon() {
  return (
    <RiChatDeleteFill className="h-5 w-5 block shrink-0" aria-hidden="true" />
  );
}

function ActiveAngryIcon() {
  return (
    <RiEmotionUnhappyFill className="h-5 w-5 block shrink-0" aria-hidden="true" />
  );
}

function getTypingDuration(content: string) {
  const length = splitGraphemes(content).length;
  if (length === 0) return 0;

  return Math.min(MAX_TYPING_DURATION_MS, Math.max(MIN_TYPING_DURATION_MS, length * 28));
}

function splitGraphemes(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const Segmenter = Intl.Segmenter as typeof Intl.Segmenter | undefined;
    if (Segmenter) return Array.from(new Segmenter("zh-CN", { granularity: "grapheme" }).segment(text), (item) => item.segment);
  }

  return Array.from(text);
}

function getAssistantMessageIds(sessions: WorkSession[]) {
  return sessions.flatMap((session) => session.messages.filter((message) => message.role === "assistant").map((message) => message.id));
}

function TypewriterFormattedMessage({
  messageId,
  content,
  isComplete,
  onComplete,
  onTick,
  leadingIcon,
}: {
  messageId: string;
  content: string;
  isComplete: boolean;
  onComplete: (messageId: string) => void;
  onTick: () => void;
  leadingIcon?: ReactNode;
}) {
  const displayContent = sanitizeMessageContentForDisplay(content);
  const characters = splitGraphemes(displayContent);
  const [visibleCount, setVisibleCount] = useState(isComplete ? characters.length : 0);
  const visibleContent = isComplete ? displayContent : characters.slice(0, visibleCount).join("");

  useEffect(() => {
    const contentCharacters = splitGraphemes(displayContent);

    if (isComplete) {
      return;
    }

    if (contentCharacters.length === 0) {
      onComplete(messageId);
      return;
    }

    const startedAt = performance.now();
    const duration = getTypingDuration(displayContent);
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const nextVisibleCount = Math.min(contentCharacters.length, Math.max(1, Math.floor(contentCharacters.length * progress)));

      setVisibleCount((current) => (current === nextVisibleCount ? current : nextVisibleCount));
      onTick();

      if (nextVisibleCount < contentCharacters.length) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      onComplete(messageId);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(frameId);
  }, [displayContent, isComplete, messageId, onComplete, onTick]);

  return (
    <>
      <FormattedMessage content={visibleContent} leadingIcon={leadingIcon} />
      {!isComplete ? <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-full bg-[#111111] align-[-2px]" aria-hidden="true" /> : null}
    </>
  );
}

function createSession(conversationNumber?: number): WorkSession {
  const conversationCode = conversationNumber ? `d${conversationNumber}` : undefined;

  return {
    id: createClientId(),
    title: "新对话",
    conversationCode,
    nextImageNumber: 1,
    nextVideoNumber: 1,
    updatedAt: Date.now(),
    messages: initialMessages,
    videoTask: null,
    draftInput: "",
    uploadedFiles: [],
    uploadedImages: [],
  };
}

function normalizeUsageSummary(value?: UsageMeta): UsageSummary {
  return {
    promptTokens: Math.max(0, Math.floor(value?.promptTokens ?? 0)),
    completionTokens: Math.max(0, Math.floor(value?.completionTokens ?? 0)),
    totalTokens: Math.max(0, Math.floor(value?.totalTokens ?? 0)),
    usd: Math.max(0, Number(value?.usd ?? 0)),
    cny: Math.max(0, Number(value?.cny ?? 0)),
    credits: Math.max(0, Math.floor(value?.credits ?? 0)),
  };
}

function addUsageSummary(current: UsageSummary | undefined, usage?: UsageMeta) {
  const safeUsage = normalizeUsageSummary(usage);
  if (safeUsage.totalTokens === 0 && safeUsage.usd === 0 && safeUsage.credits === 0) return current;
  const safeCurrent = normalizeUsageSummary(current);

  return {
    promptTokens: safeCurrent.promptTokens + safeUsage.promptTokens,
    completionTokens: safeCurrent.completionTokens + safeUsage.completionTokens,
    totalTokens: safeCurrent.totalTokens + safeUsage.totalTokens,
    usd: safeCurrent.usd + safeUsage.usd,
    cny: safeCurrent.cny + safeUsage.cny,
    credits: safeCurrent.credits + safeUsage.credits,
  };
}

function nowTimestamp() {
  return Date.now();
}

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getNextWorkflowTitle(items: WorkflowItem[]) {
  return getNextWorkflowTitleFromNumber(items, 1).title;
}

function getNextWorkflowTitleFromNumber(items: WorkflowItem[], startNumber: number) {
  let nextIndex = Math.max(1, Math.floor(startNumber));

  while (items.some((item) => item.title === `工作流_${String(nextIndex).padStart(2, "0")}`)) {
    nextIndex += 1;
  }

  return { title: `工作流_${String(nextIndex).padStart(2, "0")}`, nextWorkflowNumber: nextIndex + 1 };
}

function getMaxWorkflowTitleNumber(items: WorkflowItem[]) {
  return items.reduce((max, item) => {
    const number = Number(item.title.match(/^工作流_(\d+)$/)?.[1]);
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
}

function getMaxWorkflowCodeNumber(items: WorkflowItem[]) {
  return items.reduce((max, item) => Math.max(max, getWorkflowNumber(getWorkflowCode(item))), 0);
}

function createWorkflowItem(items: WorkflowItem[]): WorkflowItem {
  const createdAt = Date.now();
  return {
    id: createClientId(),
    title: "新工作流",
    createdAt,
    updatedAt: createdAt,
  };
}

function isUntitledWorkflow(item: WorkflowItem) {
  return !item.deletedAt && item.title === "新工作流";
}

function isDeletedWorkflow(item: Pick<WorkflowItem, "deletedAt">) {
  return Boolean(item.deletedAt);
}

function hasWorkflowAction(canvas?: WorkflowCanvasState) {
  return Boolean(canvas && ((canvas.nodes?.length ?? 0) > 0 || (canvas.edges?.length ?? 0) > 0));
}

function ensureWorkflowItems(items: WorkflowItem[]) {
  return items.some((item) => !isDeletedWorkflow(item)) ? items : [createWorkflowItem([]), ...items];
}

function keepSingleUntitledWorkflow(items: WorkflowItem[]) {
  let hasUntitledWorkflow = false;
  return items.filter((item) => {
    if (isDeletedWorkflow(item) || !isUntitledWorkflow(item)) return true;
    if (hasUntitledWorkflow) return false;
    hasUntitledWorkflow = true;
    return true;
  });
}

function getPersistableWorkflowItems(items: WorkflowItem[]) {
  return keepSingleUntitledWorkflow(ensureWorkflowItems(items));
}

function normalizeWorkflowCodesAndMediaNumbers(items: WorkflowItem[]) {
  let nextWorkflowCodeNumber = getMaxWorkflowCodeNumber(items) + 1;
  return items.map((item) => {
    const workflowCode = getWorkflowCode(item) ?? (isUntitledWorkflow(item) ? undefined : `w${nextWorkflowCodeNumber++}`);
    return {
      ...item,
      workflowCode,
      nextImageNumber: Math.max(1, Math.floor(item.nextImageNumber ?? 1)),
      nextVideoNumber: Math.max(1, Math.floor(item.nextVideoNumber ?? 1)),
    };
  });
}

function normalizeStoredWorkflowItems(value: unknown): WorkflowItem[] {
  if (!Array.isArray(value)) return ensureWorkflowItems([]);
  return ensureWorkflowItems(keepSingleUntitledWorkflow(value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const workflow = item as Partial<WorkflowItem>;
    if (typeof workflow.id !== "string" || typeof workflow.title !== "string") return [];
    const createdAt = Number.isFinite(workflow.createdAt) ? Number(workflow.createdAt) : Date.now();
    const updatedAt = Number.isFinite(workflow.updatedAt) ? Number(workflow.updatedAt) : createdAt;
    const deletedAt = Number.isFinite(workflow.deletedAt) ? Number(workflow.deletedAt) : undefined;
    const workflowCode = getWorkflowCode({ workflowCode: workflow.workflowCode, title: workflow.title }) ?? undefined;
    const nextImageNumber = Math.max(1, Math.floor(workflow.nextImageNumber ?? 1));
    const nextVideoNumber = Math.max(1, Math.floor(workflow.nextVideoNumber ?? 1));
    return [{ ...workflow, id: workflow.id, workflowCode, title: workflow.title, createdAt, updatedAt, nextImageNumber, nextVideoNumber, deletedAt }];
  })));
}

function isEmptySession(session: WorkSession) {
  return session.title === "新对话" && session.messages.every((message) => message.role === "system") && !session.draftInput?.trim() && (session.uploadedFiles?.length ?? 0) === 0 && (session.uploadedImages?.length ?? 0) === 0 && getSessionPendingRequests(session).length === 0;
}

function getSessionPendingRequests(session?: WorkSession | null) {
  if (!session) return [];

  const requests = [...(Array.isArray(session.pendingRequests) ? session.pendingRequests : []), ...(session.pendingRequest ? [session.pendingRequest] : [])];
  const seen = new Set<string>();

  return requests.filter((request) => {
    if (!request?.id || seen.has(request.id)) return false;
    seen.add(request.id);
    return true;
  });
}

function getPersistablePendingRequest(request: PendingGeneration) {
  return {
    ...request,
    referenceImages: request.referenceImages?.filter((url) => !url.startsWith("data:")),
    referenceVideos: request.referenceVideos?.filter((url) => !url.startsWith("data:")),
    referenceAudios: request.referenceAudios?.filter((url) => !url.startsWith("data:")),
    imageReferences: request.imageReferences?.filter((reference) => !reference.url.startsWith("data:")),
    messages: request.messages.map((message) => ({
      ...message,
      images: message.images?.filter((url) => !url.startsWith("data:")),
    })),
  };
}

function keepSingleEmptySession(sessions: WorkSession[]) {
  let hasEmptySession = false;

  return sessions.filter((session) => {
    if (session.deletedAt) return true;
    if (!isEmptySession(session)) return true;
    if (hasEmptySession) return false;
    hasEmptySession = true;
    return true;
  });
}

function isDeletedSession(session: Pick<WorkSession, "deletedAt">) {
  return Boolean(session.deletedAt);
}

function sortByUpdatedAtDesc<T extends { updatedAt?: number }>(items: T[]) {
  return [...items].sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0));
}

function getPersistableSessions(sessions: WorkSession[]) {
  return keepSingleEmptySession(sessions)
    .slice(0, MAX_PERSISTED_SESSIONS)
    .map((session) => ({
      ...session,
      uploadedImages: undefined,
      pendingRequest: undefined,
      pendingRequests: getSessionPendingRequests(session).map(getPersistablePendingRequest),
      messages: session.messages.map((message) => {
        const images = message.images?.filter((url) => !url.startsWith("data:"));
        const imageReferences = message.imageReferences?.filter((reference) => !reference.url.startsWith("data:"));

        return {
          ...message,
          suggestions: normalizeMessageSuggestions(message.suggestions as SuggestionInput[]),
          images: images && images.length > 0 ? images : undefined,
          imageReferences: imageReferences && imageReferences.length > 0 ? imageReferences : undefined,
        };
      }),
    }));
}

function getSessionTitle(text: string) {
  return text.length > 16 ? `${text.slice(0, 16)}...` : text;
}

function formatMessageTime(value?: number) {
  const date = new Date(value ?? Date.now());
  const pad = (item: number) => String(item).padStart(2, "0");

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCreditLastActiveTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";

  const now = Date.now();
  const elapsed = now - date.getTime();
  if (elapsed >= 0 && elapsed < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  const currentYear = new Date(now).getFullYear();
  if (date.getFullYear() === currentYear) {
    return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  }

  return String(date.getFullYear());
}

function formatElapsedTime(startedAt?: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - (startedAt ?? now)) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getVideoWaitProgress(startedAt?: number, now = Date.now(), index = 0) {
  const start = startedAt ?? now;
  const elapsedSeconds = Math.max(0, (now - start) / 1000);
  const stableOffset = index > 0 ? ((index * 7 + Math.abs(Math.floor(start / 1000))) % 7) - 3 : 0;
  const applyOffset = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value + stableOffset));
  if (elapsedSeconds <= 30) return applyOffset(Math.round(1 + (elapsedSeconds / 30) * 44), 1, 45);
  if (elapsedSeconds <= 90) return applyOffset(Math.round(45 + ((elapsedSeconds - 30) / 60) * 30), 43, 78);
  if (elapsedSeconds <= 180) return applyOffset(Math.round(75 + ((elapsedSeconds - 90) / 90) * 20), 73, 98);
  return 95 + ((Math.abs(Math.floor(start / 1000)) + index * 3) % 5);
}

function isModelIdentityQuestion(text: string) {
  const normalized = normalizeIntentText(text);
  return /(你是(什么|哪个|哪一个)?模型|你用(的)?(什么|哪个|哪一个)?模型|你是谁|谁开发(的)?你|你是哪家|你的开发商|你的模型名|当前模型|实际模型)/.test(normalized);
}

function normalizeIntentText(text: string) {
  return text.replace(/[\s，。？！?!.、；;：“”"'（）()]/g, "").toLowerCase();
}

function isAssetTargetType(value: unknown): value is AssetTargetType {
  return typeof value === "string" && assetTypeOrder.includes(value as AssetType);
}

function isAssetFilter(value: unknown): value is AssetFilter {
  return typeof value === "string" && (assetTypeOrder.includes(value as AssetType) || value === "conversation_images" || value === "conversation_uploads" || value === "conversation_videos" || value === "workflow_images" || value === "workflow_videos");
}

type StoredWorkspaceUiState = {
  activePanel?: ActivePanel;
  assetFilter?: AssetFilter;
  assetScrollTopByFilter?: Partial<Record<AssetFilter, number>>;
};

function getStoredWorkspaceUiState(): StoredWorkspaceUiState {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORKSPACE_UI_STATE_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const state = parsed as Record<string, unknown>;
    const scrollRecord = state.assetScrollTopByFilter && typeof state.assetScrollTopByFilter === "object" ? state.assetScrollTopByFilter as Record<string, unknown> : undefined;
    const assetScrollTopByFilter = scrollRecord ? Object.fromEntries(Object.entries(scrollRecord).filter(([key, value]) => isAssetFilter(key) && typeof value === "number" && Number.isFinite(value))) as Partial<Record<AssetFilter, number>> : undefined;

    return {
      activePanel: state.activePanel === "workflow" && !WORKFLOW_MODE_ENABLED ? "chat" : state.activePanel === "chat" || state.activePanel === "workflow" || state.activePanel === "assets" ? state.activePanel : undefined,
      assetFilter: isAssetFilter(state.assetFilter) ? state.assetFilter : undefined,
      assetScrollTopByFilter,
    };
  } catch {
    return {};
  }
}

function setStoredWorkspaceUiState(next: StoredWorkspaceUiState) {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredWorkspaceUiState();
    window.localStorage.setItem(WORKSPACE_UI_STATE_STORAGE_KEY, JSON.stringify({ ...current, ...next }));
  } catch {
    // UI state persistence is best-effort.
  }
}

function normalizeSuggestionItem(suggestion: SuggestionInput): SuggestionItem | null {
  if (typeof suggestion === "string") {
    const label = suggestion.trim().replace(/^[-\d.、\s]+/, "");
    return label ? { label } : null;
  }

  const label = suggestion.label?.trim().replace(/^[-\d.、\s]+/, "");
  if (!label) return null;

  return {
    label,
    action: typeof suggestion.action === "string" ? suggestion.action : undefined,
    assetTargetType: isAssetTargetType(suggestion.assetTargetType) ? suggestion.assetTargetType : undefined,
  };
}

function getIntentKeywords(text: string) {
  const normalized = normalizeIntentText(text);
  return INTENT_KEYWORDS.filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

function getCorrectionMode(text: string): IntentMode | null {
  const normalized = normalizeIntentText(text);

  if (/(不是|不对|错了|搞错|弄错|理解错).*(视频|镜头|动起来)|我(要|说的是|让你|叫你).*(视频|镜头|动起来)|应该.*(生视频|生成视频|做视频|出视频)/.test(normalized)) {
    return "video";
  }

  if (/(不是|不对|错了|搞错|弄错|理解错).*(图|图片|照片)|我(要|说的是|让你|叫你).*(图|图片|照片)|应该.*(生图|生成图片|做图|出图)/.test(normalized)) {
    return "image";
  }

  return null;
}

function getLastUserMessage(messages: Message[]) {
  return [...messages].reverse().find((message) => message.role === "user" && message.content.trim());
}

function upsertIntentMemoryRule(rules: IntentMemoryRule[], source: string, mode: IntentMode) {
  const keywords = getIntentKeywords(source);
  if (keywords.length === 0) return rules;

  const ruleKey = keywords.join("|");
  const existingRule = rules.find((rule) => rule.mode === mode && rule.keywords.join("|") === ruleKey);

  if (existingRule) {
    return rules.map((rule) => (rule.id === existingRule.id ? { ...rule, hits: rule.hits + 1, updatedAt: Date.now() } : rule));
  }

  return [
    {
      id: createClientId(),
      mode,
      keywords,
      source: source.slice(0, 80),
      hits: 1,
      updatedAt: Date.now(),
    },
    ...rules,
  ].slice(0, MAX_INTENT_MEMORY_RULES);
}

function getImageOnlyPrompt(mode: WorkMode) {
  if (mode === "image") return "请参考上传图片，生成一张保持主体一致、画面更完整的图片。";
  if (mode === "video") return "请把上传图片作为首帧，生成一段自然流畅的视频。";
  return "请分析这张图片，并告诉我可以怎么继续创作。";
}

function toChatPayloadMessages(messages: Message[]): ChatPayloadMessage[] {
  return messages
    .filter((message) => message.id !== "seed-1" && message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.role === "user" ? appendDocumentContextToText(message.content, getReadableUploadedDocuments(message.uploadedFiles)) : message.content,
      images: message.images,
    }));
}

function estimateTextTokens(text: string) {
  if (!text) return 0;
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const otherCount = Math.max(0, text.length - cjkCount);
  return Math.ceil(cjkCount + otherCount / 4);
}

function estimateMessageTokens(messages: Array<{ content?: string }>) {
  return messages.reduce((total, message) => total + estimateTextTokens(message.content ?? "") + 6, 0);
}

function getMessagesAfterSummary(messages: Message[], memorySummary?: SessionMemorySummary) {
  if (!memorySummary?.summarizedMessageId) return messages;
  const summaryIndex = messages.findIndex((message) => message.id === memorySummary.summarizedMessageId);
  return summaryIndex >= 0 ? messages.slice(summaryIndex + 1) : messages;
}

function shouldUpdateMemorySummary(session: WorkSession) {
  const messages = session.messages.filter((message) => message.role !== "system");
  const totalTokens = estimateMessageTokens(messages);
  if (!session.memorySummary?.content) return totalTokens > MEMORY_SUMMARY_INITIAL_TOKEN_THRESHOLD;
  const incrementalTokens = estimateMessageTokens(getMessagesAfterSummary(messages, session.memorySummary));
  return incrementalTokens > MEMORY_SUMMARY_INCREMENTAL_TOKEN_THRESHOLD;
}

function getSummarySourceMessages(session: WorkSession) {
  const messages = session.messages.filter((message) => message.role !== "system");
  const source = session.memorySummary?.content ? getMessagesAfterSummary(messages, session.memorySummary) : messages;
  return source.map((message) => ({ role: message.role === "assistant" ? "assistant" as const : "user" as const, content: message.content }));
}

function applyMemorySummaryToPayload(payload: ChatPayloadMessage[], memorySummary?: SessionMemorySummary): ChatPayloadMessage[] {
  const summary = memorySummary?.content.trim();
  if (!summary) return payload;

  return [
    {
      role: "user",
      content: `长期工作记忆摘要（用于保持当前历史对话连续性，不是用户新指令）：\n${summary}`,
    },
    ...payload.slice(-MEMORY_RECENT_MESSAGE_LIMIT),
  ];
}

function toGeneralPayloadMessages(messages: Message[], modelId: ModelName, memorySummary?: SessionMemorySummary): ChatPayloadMessage[] {
  const textOnlyHistory = shouldUseTextOnlyHistoryForConversationModel(modelId);
  const payload = applyMemorySummaryToPayload(toChatPayloadMessages(messages), memorySummary).map((message) => textOnlyHistory ? { ...message, images: undefined } : message);
  const latestUserMessage = [...payload].reverse().find((message) => message.role === "user");
  payload.push({
    role: "user",
    content: `系统约束：你的产品身份是“闪念通用 Agent”，当前实际选择的对话模型是 ${getConversationModelLabel(modelId)}（${modelId}）。你负责对话、理解、追问和规划；闪念系统可以调用当前选择的图片模型和视频模型完成生图、生视频。回答能力问题时，以“闪念通用 Agent”的整体能力为准，不要按当前对话模型的裸能力回答“不支持生图/生视频”。除非用户明确询问你的身份、模型、开发者或所属公司，否则不要主动提及“我是/作为某公司开发的 AI 助手/某模型”等身份表述；不要自称其它公司或其它模型开发的 AI。用户问普通知识问题时，直接回答问题本身。`,
  });
  if (latestUserMessage && isModelIdentityQuestion(latestUserMessage.content)) {
    payload.push({
      role: "user",
      content: `系统约束：如果用户问“你是谁”，回答你是“闪念通用 Agent”；如果用户问“你是什么模型/当前模型”，回答你是闪念通用 Agent，当前对话模型是 ${getConversationModelLabel(modelId)}（${modelId}）。如果用户问能力，按闪念通用 Agent 的整体能力回答：可以问答、写作、规划任务，并在需要时调用图片/视频模型生成内容。不要沿用历史中其它 assistant 对自己身份的表述。除此之外，正常参考完整上下文继续对话。`,
    });
  }

  return payload;
}

function toAgentPayloadMessages(messages: Message[], keepLatestUserImages: boolean, memorySummary?: SessionMemorySummary): ChatPayloadMessage[] {
  const payload: ChatPayloadMessage[] = applyMemorySummaryToPayload(toChatPayloadMessages(messages), memorySummary).map((message) => ({
    ...message,
    images: undefined,
  }));

  if (!keepLatestUserImages) return payload;

  let latestUserIndex = -1;
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    if (payload[index].role === "user") {
      latestUserIndex = index;
      break;
    }
  }
  const latestSourceUser = [...toChatPayloadMessages(messages)].reverse().find((message) => message.role === "user");
  if (latestUserIndex >= 0 && latestSourceUser?.images?.length) {
    payload[latestUserIndex] = { ...payload[latestUserIndex], images: latestSourceUser.images };
  }

  return payload;
}

function toPromptPayloadMessages(messages: ChatPayloadMessage[]): ChatPayloadMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.images?.length ? `${message.content}\n\n已附带 ${message.images.length} 张参考图，生成阶段会直接使用这些参考图。` : message.content,
  }));
}

function getReadableUploadedDocuments(files?: UploadedFileEntry[]) {
  return (files ?? [])
    .map((file) => typeof file === "string" ? null : file)
    .filter((file): file is UploadedDocumentFile => file !== null && Boolean(file.text?.trim()) && file.status === "ready");
}

function appendDocumentContextToText(text: string, documents: UploadedDocumentFile[]) {
  if (documents.length === 0) return text;

  let remaining = MAX_DOCUMENT_CONTEXT_CHARS;
  const sections: string[] = [];

  documents.forEach((document, index) => {
    if (remaining <= 0) return;
    const content = (document.text ?? "").trim().slice(0, remaining);
    if (!content) return;
    remaining -= content.length;
    sections.push(`文档${index + 1}：${document.name}\n${content}`);
  });

  if (sections.length === 0) return text;

  return `${text || "请阅读我上传的文档，并告诉我可以怎么继续创作。"}\n\n已读取文档内容如下。请把这些内容作为当前上下文，不要假装没有读取：\n\n${sections.join("\n\n---\n\n")}`;
}

function normalizeMessageSuggestions(suggestions?: SuggestionInput[]) {
  const nextSuggestions = (suggestions ?? [])
    .map(normalizeSuggestionItem)
    .filter((suggestion): suggestion is SuggestionItem => Boolean(suggestion))
    .filter((suggestion, index, array) => array.findIndex((item) => item.label === suggestion.label) === index)
    .slice(0, 5);

  return nextSuggestions.length > 0 ? nextSuggestions : undefined;
}

function getAgentMediaSuggestions(mode: WorkMode, suggestions?: SuggestionInput[]) {
  return normalizeMessageSuggestions(suggestions) ?? normalizeMessageSuggestions(mode === "video" ? DEFAULT_AGENT_VIDEO_SUGGESTIONS : DEFAULT_AGENT_IMAGE_SUGGESTIONS);
}

function getAssetTypeFromText(text: string, mode: WorkMode, assetTargetType?: AssetTargetType): AssetType {
  if (assetTargetType) {
    if (mode === "video" && assetTargetType === "shot_image") return "shot_video";
    if (mode === "image" && assetTargetType === "shot_video") return "shot_image";
    return assetTargetType;
  }

  const normalized = normalizeIntentText(text);
  const hasShotTarget = /(镜头|分镜|第一镜|第二镜|第三镜|下一镜|第\d+镜|第[一二三四五六七八九十]+镜)/.test(normalized);
  const hasCharacterTarget = /(角色图|角色图片|人物设定|人物图|男主|女主|主角|角色|人物|反派|配角|三视图|立绘)/.test(normalized);
  const hasSceneTarget = /(场景图|场景图片|背景图|环境图|场景|背景|房间|街道|巷子|办公室|教室|医院|楼道|室内|室外|多角度)/.test(normalized);

  if (mode === "video") return hasShotTarget ? "shot_video" : "other";
  if (hasShotTarget) return "shot_image";
  if (hasCharacterTarget) return "character_image";
  if (hasSceneTarget) return "scene_image";

  return "other";
}

function sanitizeAssetName(name: string) {
  return name.replace(/[\s，。？！?!.、；;：“”"'（）()【】\[\]{}]/g, "").slice(0, 24);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toChineseNumber(value: string) {
  const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "十") return 10;
  if (value.startsWith("十")) return 10 + (map[value.slice(1)] ?? 0);
  if (value.endsWith("十")) return (map[value.slice(0, 1)] ?? 1) * 10;
  if (value.includes("十")) {
    const [ten, one] = value.split("十");
    return (map[ten] ?? 1) * 10 + (map[one] ?? 0);
  }
  return map[value] ?? 1;
}

function getVersionedName(baseName: string, assets: AssetItem[], alwaysVersion = false) {
  const escaped = escapeRegExp(baseName);
  const versionPattern = new RegExp(`^${escaped}_(\\d+)$`);
  const versions = assets.flatMap((asset) => {
    if (asset.name === baseName) return [1];
    const match = asset.name.match(versionPattern);
    return match ? [Number(match[1])] : [];
  });

  if (versions.length === 0) return alwaysVersion ? `${baseName}_1` : baseName;
  return `${baseName}_${Math.max(...versions) + 1}`;
}

function getNextNumberedBase(prefix: string, assets: AssetItem[], pad = 2) {
  const pattern = new RegExp(`^${prefix}(\\d{2}|\\d+)(?:_\\d+)?$`);
  const numbers = assets.flatMap((asset) => {
    const match = asset.name.match(pattern);
    return match ? [Number(match[1])] : [];
  });

  const nextNumber = String((numbers.length > 0 ? Math.max(...numbers) : 0) + 1);
  return `${prefix}${pad > 1 ? nextNumber.padStart(pad, "0") : nextNumber}`;
}

function getRandomDigitString() {
  const length = 5 + Math.floor(Math.random() * 6);
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => String(value % 10)).join("");
}

function getConversationNumber(code?: string) {
  const value = Number(code?.match(/^d(\d+)$/)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getWorkflowNumber(code?: string) {
  const value = Number(code?.match(/^w(\d+)$/)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getWorkflowNumberFromTitle(title?: string) {
  const value = Number(title?.match(/^工作流_(\d+)$/)?.[1]);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getWorkflowCode(item: Pick<WorkflowItem, "workflowCode" | "title">) {
  if (getWorkflowNumber(item.workflowCode) > 0) return item.workflowCode;
  const titleNumber = getWorkflowNumberFromTitle(item.title);
  return titleNumber > 0 ? `w${titleNumber}` : undefined;
}

function buildConversationMediaSystemName(mode: WorkMode, index: number, conversationCode?: string) {
  return `${mode === "video" ? "video" : "image"}_${index}_${conversationCode || "d0"}`;
}

function buildWorkflowMediaSystemName(mediaType: "image" | "video", index: number, workflowCode?: string) {
  return `${mediaType}_${index}_${workflowCode || "w0"}`;
}

function getMediaSystemName(message: Message, url: string, fallbackName: string) {
  return message.mediaSystemNames?.[url] ?? fallbackName;
}

function isUploadedAssetUrl(url: string) {
  return /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(url);
}

function isUploadPromptPlaceholder(value: string | undefined) {
  return value === UPLOAD_IMAGE_PROMPT_PLACEHOLDER || value === "资产库上传" || value === "对话流上传";
}

function isUploadedAsset(asset: Pick<AssetItem, "url" | "sourcePrompt">) {
  return isUploadPromptPlaceholder(asset.sourcePrompt) || isUploadedAssetUrl(asset.url);
}

function isConversationUploadedAsset(asset: AssetItem) {
  return isConversationAsset(asset) && !isVideoAsset(asset) && (isUploadedAssetUrl(asset.url) || asset.promptSource === "upload" || isUploadPromptPlaceholder(asset.sourcePrompt));
}

function isAssetInFilter(asset: AssetItem, filter: AssetFilter) {
  if (filter !== "trash" && (asset.type === "trash" || asset.deletedAt)) return false;
  if (filter === "trash") return asset.type === "trash" || Boolean(asset.deletedAt);
  if (filter === "conversation_images") return isConversationAsset(asset) && !isVideoAsset(asset) && !isConversationUploadedAsset(asset);
  if (filter === "conversation_uploads") return isConversationUploadedAsset(asset);
  if (filter === "conversation_videos") return isConversationAsset(asset) && isVideoAsset(asset);
  if (filter === "workflow_images") return isWorkflowAsset(asset) && !isVideoAsset(asset);
  if (filter === "workflow_videos") return isWorkflowAsset(asset) && isVideoAsset(asset);
  if (assetGenerationTypes.includes(filter as UploadableImageAssetType)) return isAssetGenerationAsset(asset) && asset.type === filter;
  return asset.type === filter;
}

function normalizeSessionCodesAndMediaNames(sessions: WorkSession[], storedNextConversationNumber?: number) {
  let nextConversationNumber = Math.max(1, Math.floor(storedNextConversationNumber ?? 1));
  const usedNumbers = new Set<number>();

  sessions.forEach((session) => {
    const number = getConversationNumber(session.conversationCode);
    if (number > 0) usedNumbers.add(number);
  });

  const missingSessions = sessions
    .filter((session) => !getConversationNumber(session.conversationCode))
    .sort((a, b) => a.updatedAt - b.updatedAt);

  const assignedCodes = new Map<string, string>();
  missingSessions.forEach((session) => {
    while (usedNumbers.has(nextConversationNumber)) nextConversationNumber += 1;
    assignedCodes.set(session.id, `d${nextConversationNumber}`);
    usedNumbers.add(nextConversationNumber);
    nextConversationNumber += 1;
  });

  let maxConversationNumber = 0;
  const normalizedSessions = sessions.map((session) => {
    const conversationCode = session.conversationCode || assignedCodes.get(session.id) || `d${nextConversationNumber++}`;
    maxConversationNumber = Math.max(maxConversationNumber, getConversationNumber(conversationCode));
    let nextImageNumber = Math.max(1, Math.floor(session.nextImageNumber ?? 1));
    let nextVideoNumber = Math.max(1, Math.floor(session.nextVideoNumber ?? 1));
    const mediaSystemNames = new Map<string, string>();

    session.messages.forEach((message) => {
      if (message.role !== "assistant") return;
      Object.entries(message.mediaSystemNames ?? {}).forEach(([url, systemName]) => {
        if (url && systemName) mediaSystemNames.set(url, systemName);
        const imageNumber = Number(systemName.match(/^image_(\d+)_d\d+$/)?.[1]);
        const videoNumber = Number(systemName.match(/^video_(\d+)_d\d+$/)?.[1]);
        if (Number.isFinite(imageNumber)) nextImageNumber = Math.max(nextImageNumber, imageNumber + 1);
        if (Number.isFinite(videoNumber)) nextVideoNumber = Math.max(nextVideoNumber, videoNumber + 1);
      });
    });

    const messages = session.messages.map((message) => {
      if (message.role !== "assistant") return message.mediaSystemNames ? { ...message, mediaSystemNames: undefined } : message;
      const nextNames = { ...(message.mediaSystemNames ?? {}) };
      (message.images ?? []).forEach((url) => {
        if (!url || url.startsWith("data:")) return;
        if (!mediaSystemNames.has(url)) {
          mediaSystemNames.set(url, buildConversationMediaSystemName("image", nextImageNumber, conversationCode));
          nextImageNumber += 1;
        }
        nextNames[url] = mediaSystemNames.get(url) ?? nextNames[url];
      });
      getMessageVideos(message).forEach((url) => {
        if (!url || url.startsWith("data:")) return;
        if (!mediaSystemNames.has(url)) {
          mediaSystemNames.set(url, buildConversationMediaSystemName("video", nextVideoNumber, conversationCode));
          nextVideoNumber += 1;
        }
        nextNames[url] = mediaSystemNames.get(url) ?? nextNames[url];
      });

      return Object.keys(nextNames).length > 0 ? { ...message, mediaSystemNames: nextNames } : message;
    });

    return { ...session, conversationCode, nextImageNumber, nextVideoNumber, messages };
  });

  const nextNumber = Math.max(nextConversationNumber, maxConversationNumber + 1, Math.floor(storedNextConversationNumber ?? 1));
  return { sessions: normalizedSessions, nextConversationNumber: nextNumber };
}

function getConversationAssetName(mode: WorkMode, assets: AssetItem[]) {
  const prefix = mode === "video" ? "video" : "image";
  let candidate = `${prefix}_${getRandomDigitString()}`;

  while (assets.some((asset) => asset.name === candidate)) {
    candidate = `${prefix}_${getRandomDigitString()}`;
  }

  return candidate;
}

function extractNamedValue(text: string, labels: string[]) {
  const labelPattern = labels.join("|");
  const patterns = [
    new RegExp(`(?:${labelPattern})(?:名字|名称|名)?[：:叫为是\\s]*([一-龥A-Za-z0-9·号室病房沙滩医院海边街道巷子办公室教室房间]{2,18})`),
    new RegExp(`([一-龥A-Za-z0-9·号室病房沙滩医院海边街道巷子办公室教室房间]{2,18})(?:是|作为)?(?:${labelPattern})`),
  ];

  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1];
    const safeValue = value ? sanitizeAssetName(value) : "";
    if (safeValue && !/(图片|照片|视频|镜头|分镜|生成|提示词|三视图|多角度|一个|一张)/.test(safeValue)) return safeValue;
  }

  return "";
}

function extractCharacterName(text: string) {
  return extractNamedValue(text, ["男主", "女主", "主角", "角色", "人物", "反派", "配角"]);
}

function extractSceneName(text: string) {
  const explicitScene = text.match(/(医院\d+号病房|\d+号病房|海边沙滩|废弃医院|地下车库|老旧小区|城市天台|雨夜街道|学校教室|办公室|便利店|咖啡馆|森林小屋|赛博街区)/)?.[1];
  if (explicitScene) return sanitizeAssetName(explicitScene);

  return extractNamedValue(text, ["场景", "地点", "环境", "背景", "房间", "街道", "医院", "教室", "办公室"]);
}

function extractAnimalOrPlantSubject(text: string) {
  const subject = text.match(/((?:彩色|荧光|科幻|赛博朋克|可爱|白色|黑色|橘色|治愈系|发光|机械|未来|毛茸茸)?(?:小)?(?:狗|猫|兔子|兔|狐狸|熊猫|老虎|狮子|鸟|鹦鹉|鹿|马|龙|蛇|花|玫瑰|树|植物|蘑菇|荷花|竹子))/)?.[1];
  return subject ? sanitizeAssetName(subject) : "";
}

function extractStoryTitle(text: string) {
  const quoted = text.match(/《([^》]{2,24})》/)?.[1];
  if (quoted) return sanitizeAssetName(quoted);

  const named = text.match(/(?:剧名|片名|故事名|标题)[：:是为\s]*([^，。\n]{2,24})/)?.[1];
  return named ? sanitizeAssetName(named) : "";
}

function extractShotNumber(text: string, storyBase: string, assets: AssetItem[]) {
  const explicit = text.match(/(?:第\s*([一二三四五六七八九十\d]+)\s*镜|分镜\s*(\d+))/);
  if (explicit?.[1]) return toChineseNumber(explicit[1]);
  if (explicit?.[2]) return Number(explicit[2]);

  const escaped = storyBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}_分镜(\\d{2})_\\d+$`);
  const numbers = assets.flatMap((asset) => {
    const match = asset.name.match(pattern);
    return match ? [Number(match[1])] : [];
  });

  return (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
}

function getAssetBaseName(type: AssetType, sourcePrompt: string, assets: AssetItem[], mode: WorkMode) {
  const normalized = normalizeIntentText(sourcePrompt);

  if (type === "character_image") {
    const characterName = extractCharacterName(sourcePrompt) || extractAnimalOrPlantSubject(sourcePrompt);
    if (characterName) return /三视图/.test(normalized) ? `${characterName}三视图` : characterName;
    return getNextNumberedBase(/三视图/.test(normalized) ? "角色三视图" : "角色", assets, 1);
  }

  if (type === "scene_image") {
    const sceneName = extractSceneName(sourcePrompt) || extractAnimalOrPlantSubject(sourcePrompt);
    if (sceneName) return /多角度|三视图/.test(normalized) ? `${sceneName}多角度` : sceneName;
    return getNextNumberedBase(/多角度|三视图/.test(normalized) ? "场景多角度" : "场景", assets, 1);
  }

  if (type === "shot_image") {
    return getNextNumberedBase("分镜", assets, 1);
  }

  if (type === "shot_video") {
    const storyBase = extractStoryTitle(sourcePrompt) || "无名剧01";
    const shotNumber = extractShotNumber(sourcePrompt, storyBase, assets);
    return `${storyBase}_分镜${String(shotNumber).padStart(2, "0")}`;
  }

  const subjectName = extractAnimalOrPlantSubject(sourcePrompt);
  return subjectName || getNextNumberedBase(mode === "video" ? "video" : "image", assets);
}

function getNextAssetGenerationName(type: AssetGenerationImageType, assets: AssetItem[]) {
  const prefix = type === "scene_image" ? "场景" : type === "shot_image" ? "分镜" : "角色";
  const assetGenerationAssets = assets.filter((asset) => asset.librarySource === "asset_generation" && asset.type === type);
  return getNextNumberedBase(prefix, assetGenerationAssets, 1);
}

// Kept for legacy asset naming rules if generated asset categories become active again.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getNextAssetName(type: AssetType, sourcePrompt: string, assets: AssetItem[], mode: WorkMode = "image") {
  const baseName = getAssetBaseName(type, sourcePrompt, assets, mode);

  return getVersionedName(baseName, assets, type === "shot_video");
}

function getReferencedAssets(text: string, assets: AssetItem[]) {
  const mentions = new Set([...text.matchAll(/@([^@\s，。！？；;、]+)/g)].map((match) => match[1]));
  return assets.filter((asset) => mentions.has(asset.name) && !isVideoAsset(asset));
}

function getMentionNames(text: string) {
  return [...text.matchAll(/@([^@\s，。！？；;、]+)/g)].map((match) => match[1]);
}

function getAtQueryAtCursor(text: string, cursorOffset: number) {
  const cursor = Math.min(Math.max(0, cursorOffset), text.length);
  const beforeCursor = text.slice(0, cursor);
  const match = beforeCursor.match(/@([^@\s，。！？；;、]*)$/);
  if (!match) return null;

  return {
    index: cursor - match[0].length,
    query: match[1] ?? "",
    cursor,
  };
}

function getUploadedImageReferenceName(image: UploadedImage, images: UploadedImage[]) {
  if (image.referenceName) return image.referenceName;

  const stem = image.name.replace(/\.[^.]+$/, "");
  const baseName = sanitizeAssetName(stem) || "上传图片";
  const sameBaseImages = images.filter((item) => (sanitizeAssetName(item.name.replace(/\.[^.]+$/, "")) || "上传图片") === baseName);

  if (sameBaseImages.length <= 1) return baseName;

  return `${baseName}_${sameBaseImages.findIndex((item) => item.id === image.id) + 1}`;
}

function getUploadedReferenceBaseName(fileName: string) {
  return sanitizeAssetName(fileName.replace(/\.[^.]+$/, "")) || "上传图片";
}

function createAssetUploadSlots(type: UploadableImageAssetType): AssetUploadSlot[] {
  return Array.from({ length: ASSET_UPLOAD_SLOT_COUNT }, () => ({
    id: createClientId(),
    fileName: "",
    originalFileName: "",
    dataUrl: "",
    type,
  }));
}

function normalizeAssetUploadSlots(slots: AssetUploadSlot[], type: UploadableImageAssetType): AssetUploadSlot[] {
  if (slots.length >= ASSET_UPLOAD_SLOT_COUNT) return slots.slice(0, ASSET_UPLOAD_SLOT_COUNT);
  return [...slots, ...createAssetUploadSlots(type).slice(0, ASSET_UPLOAD_SLOT_COUNT - slots.length)];
}

function getDefaultAssetUploadType(assetFilter: AssetFilter): UploadableImageAssetType {
  return assetUploadTypes.includes(assetFilter as UploadableImageAssetType) ? assetFilter as UploadableImageAssetType : "character_image";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("图片转换失败")), "image/jpeg", quality);
  });
}

async function convertImageFileToJpeg(file: File, quality = 0.92) {
  const maxUploadBytes = 950 * 1024;
  const maxSide = 2048;
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new window.Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("图片读取失败"));
    });
    image.src = sourceUrl;
    await loaded;

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const sourceScale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * sourceScale));
    canvas.height = Math.max(1, Math.round(sourceHeight * sourceScale));
    const context = canvas.getContext("2d");
    if (!context || !canvas.width || !canvas.height) throw new Error("图片转换失败");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    let blob = await canvasToJpegBlob(canvas, quality);
    for (const nextQuality of [0.86, 0.78, 0.7, 0.62, 0.54]) {
      if (blob.size <= maxUploadBytes) break;
      blob = await canvasToJpegBlob(canvas, nextQuality);
    }

    while (blob.size > maxUploadBytes && Math.max(canvas.width, canvas.height) > 1024) {
      const resized = document.createElement("canvas");
      resized.width = Math.max(1, Math.round(canvas.width * 0.82));
      resized.height = Math.max(1, Math.round(canvas.height * 0.82));
      const resizedContext = resized.getContext("2d");
      if (!resizedContext) break;
      resizedContext.fillStyle = "#ffffff";
      resizedContext.fillRect(0, 0, resized.width, resized.height);
      resizedContext.drawImage(canvas, 0, 0, resized.width, resized.height);
      canvas.width = resized.width;
      canvas.height = resized.height;
      const nextContext = canvas.getContext("2d");
      if (!nextContext) break;
      nextContext.fillStyle = "#ffffff";
      nextContext.fillRect(0, 0, canvas.width, canvas.height);
      nextContext.drawImage(resized, 0, 0);
      blob = await canvasToJpegBlob(canvas, 0.72);
    }

    const baseName = (file.name || "upload").replace(/\.[^.]+$/, "") || "upload";
    const jpegFile = new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: file.lastModified || Date.now() });
    const dataUrl = await readBlobAsDataUrl(blob);
    return { file: jpegFile, dataUrl };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function withImageConversionTimeout<T>(promise: Promise<T>, timeoutMs = 5000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("图片转换超时")), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function uploadJsonWithProgress<T>(url: string, payload: unknown, onProgress?: (progress: number) => void) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(95, Math.max(8, Math.round((event.loaded / event.total) * 95))));
    };
    xhr.onload = () => {
      let data: T & { error?: string };
      try {
        data = JSON.parse(xhr.responseText || "{}") as T & { error?: string };
      } catch {
        reject(new Error("上传失败"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(data.error || "上传失败"));
        return;
      }
      onProgress?.(100);
      resolve(data);
    };
    xhr.onerror = () => reject(new Error("上传失败"));
    xhr.send(JSON.stringify(payload));
  });
}

function uploadFormDataWithProgress<T>(url: string, formData: FormData, onProgress?: (progress: number) => void, token?: string, signal?: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const resolveOnce = (data: T) => {
      if (settled) return;
      settled = true;
      resolve(data);
    };
    const abortUpload = () => {
      xhr.abort();
      rejectOnce(new Error("上传已取消"));
    };
    try {
      xhr.open("POST", url);
      xhr.timeout = 10 * 60 * 1000;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error("上传初始化失败"));
      return;
    }
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(95, Math.max(15, Math.round((event.loaded / event.total) * 95))));
    };
    xhr.onload = () => {
      let data: T & { error?: string };
      try {
        data = JSON.parse(xhr.responseText || "{}") as T & { error?: string };
      } catch {
        rejectOnce(new Error("上传失败"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        rejectOnce(new Error(data.error || "上传失败"));
        return;
      }
      onProgress?.(100);
      resolveOnce(data);
    };
    xhr.onabort = () => rejectOnce(new Error("上传已取消"));
    xhr.onerror = () => rejectOnce(new Error("上传失败，请检查网络或跨域配置"));
    xhr.ontimeout = () => rejectOnce(new Error("上传超时，请重试"));
    signal?.addEventListener("abort", abortUpload, { once: true });
    try {
      xhr.send(formData);
    } catch (error) {
      rejectOnce(error instanceof Error ? error : new Error("上传发送失败"));
    }
  });
}

function reportClientDiagnostic(message: string, detail?: unknown) {
  try {
    const payload = JSON.stringify({ message, source: "client-diagnostic", stack: detail instanceof Error ? detail.stack : typeof detail === "string" ? detail : JSON.stringify(detail), href: window.location.href, userAgent: navigator.userAgent });
    navigator.sendBeacon?.("/api/client-error", new Blob([payload], { type: "application/json" }));
  } catch {
    // Diagnostics must never affect user actions.
  }
}

async function getDirectUploadToken() {
  if (!uploadApiBaseUrl) return "";
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 20 * 1000);
  try {
    const tokenResponse = await fetch("/api/upload-token", { method: "POST", cache: "no-store", signal: controller.signal });
    const tokenData = await readJson<{ token?: string }>(tokenResponse);
    if (!tokenData.token) throw new Error("上传授权失败");
    return tokenData.token;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("上传授权超时，请重试");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

async function uploadDocumentFileAsset(file: File, options: { conversationId?: string; mediaKind?: "document" | "video" | "audio"; durationSeconds?: number; dimensions?: ImageDimensions } = {}, onProgress?: (progress: number) => void) {
  onProgress?.(6);
  const dataUrl = await readFileAsDataUrl(file);
  onProgress?.(12);
  const data = await uploadJsonWithProgress<{ url?: string; error?: string }>("/api/upload-file", { file: dataUrl, name: file.name, ...options }, onProgress);
  if (!data.url) throw new Error(data.error || "文件上传失败");
  return data.url;
}

async function uploadTemporaryAssetImage(file: File, onProgress?: (progress: number) => void, signal?: AbortSignal, forceReencode = false) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  if (forceReencode) formData.append("forceReencode", "1");
  const uploadUrl = "/api/asset-upload-temp";
  onProgress?.(8);
  const token = "";
  onProgress?.(12);
  const data = await uploadFormDataWithProgress<{ token?: string; error?: string }>(uploadUrl, formData, onProgress, token, signal);
  if (!data.token) throw new Error(data.error || "图片上传失败");
  return data.token;
}

async function commitTemporaryAssetImage(tempToken: string) {
  const uploadUrl = "/api/asset-upload-temp";
  const token = "";
  const response = await fetch(uploadUrl, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ token: tempToken }),
  });
  const data = await readJson<{ url?: string }>(response);
  if (!data.url) throw new Error("图片保存失败");
  return data.url;
}

async function deleteTemporaryAssetImages(tempTokens: string[]) {
  if (tempTokens.length === 0) return;
  const uploadUrl = "/api/asset-upload-temp";
  const token = "";
  await fetch(uploadUrl, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ tokens: tempTokens }),
  }).catch(() => undefined);
}

function getDataUrlImageDimensions(dataUrl: string) {
  return new Promise<ImageDimensions>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("图片尺寸读取失败"));
    image.src = dataUrl;
  });
}

function toUploadedAssetReference(asset: Pick<AssetItem, "name" | "url">): UploadedImage {
  return {
    id: createClientId(),
    name: asset.name,
    referenceName: asset.name,
    url: asset.url,
    source: "asset",
  };
}

function getUploadedAssetType(imageName: string, contextText: string): AssetType {
  const text = `${imageName}\n${contextText}`;
  const normalized = normalizeIntentText(text);

  if (/(分镜|镜头|第一镜|第二镜|第三镜|下一镜|第\d+镜|第[一二三四五六七八九十]+镜|storyboard|shot)/i.test(normalized)) return "shot_image";
  if (/(角色|人物|男主|女主|主角|反派|配角|立绘|三视图|全身|半身|character|person|hero)/i.test(normalized)) return "character_image";
  if (/(场景|背景|环境|地点|房间|街道|医院|教室|办公室|室内|室外|多角度|scene|background|location)/i.test(normalized)) return "scene_image";

  return "other";
}

function getUniqueUploadedAssetName(baseName: string, assets: AssetItem[], url: string) {
  if (assets.some((asset) => asset.url === url)) return baseName;
  return getVersionedName(baseName, assets);
}

function getConversationImageReferences(messages: Message[]) {
  const references: ImageReference[] = [];

  messages.forEach((message) => {
    getDisplayImageReferences(message).forEach((reference) => {
      if (reference.name && reference.url && !references.some((item) => item.name === reference.name)) {
        references.push(reference);
      }
    });
  });

  return references;
}

function getOrderedExplicitImageReferences(text: string, assets: AssetItem[], uploadedImages: UploadedImage[], conversationReferences: ImageReference[]) {
  const uploadedReferences = uploadedImages.map((image) => ({ name: getUploadedImageReferenceName(image, uploadedImages), url: image.url }));
  const assetReferences = assets.filter((asset) => !isVideoAsset(asset)).map((asset) => ({ name: asset.name, url: asset.url }));
  const availableReferences = [...uploadedReferences, ...conversationReferences, ...assetReferences];
  const references: ImageReference[] = [];

  getMentionNames(text).forEach((name) => {
    const reference = availableReferences.find((item) => item.name === name);
    if (reference && !references.some((item) => item.url === reference.url)) {
      references.push(reference);
    }
  });

  return references;
}

function getReferenceHint(references: ImageReference[]) {
  if (references.length === 0) return "";

  return `参考图顺序：${references.map((_, index) => `参考图${index + 1}`).join("，")}。生成时必须分别保留这些参考图对应的主体、人物特征、服装和场景关系，不要把人物或场景替换成无关内容。`;
}

function replaceMentionNamesForModelPrompt(prompt: string, references?: ImageReference[]) {
  if (!references?.length) return prompt;

  let nextPrompt = prompt;
  references.forEach((reference, index) => {
    if (!reference.name) return;
    const label = references.length === 1 ? "参考图中的主体" : `参考图${index + 1}中的主体`;
    nextPrompt = nextPrompt.replace(new RegExp(`@${escapeRegExp(reference.name)}(?=$|[\\s，。！？；;、])`, "g"), label);
  });

  return nextPrompt.trim() || prompt;
}

function getCharacterStyleRuleText(style: "realistic" | "2d" | "3d") {
  if (style === "2d") {
    return "风格强制规则，优先级最高，不能被用户提示词覆盖：最终必须是2D风格、平面插画、动漫/二次元/手绘美术效果；忽略并删除用户提示词里的写实摄影、真人照片、真实皮肤摄影质感、照片级、3D、CG、三维渲染、虚幻引擎、Blender、Octane、V-Ray、皮克斯、黏土、手办等冲突风格词。";
  }

  if (style === "3d") {
    return "风格强制规则，优先级最高，不能被用户提示词覆盖：最终必须是3D风格、CG三维渲染、体积感、材质和灯光明确；忽略并删除用户提示词里的写实摄影、真人照片、照片级、2D、动漫、二次元、漫画、插画、手绘、卡通、Moebius、Jean Giraud、吉卜力等冲突风格词。";
  }

  return "风格强制规则，优先级最高，不能被用户提示词覆盖：最终必须是写实风格、真实摄影感、真实镜头、真实材质、真实光影；忽略并删除用户提示词里的Moebius、Jean Giraud、吉卜力、宫崎骏、新海诚、皮克斯、迪士尼、2D、动漫、二次元、插画、卡通、漫画、手绘、3D、CG、三维渲染、虚幻引擎、Blender、Octane、V-Ray、游戏渲染等冲突风格词。";
}

function stripConflictStyleTerms(prompt: string, style: "realistic" | "2d" | "3d") {
  const commonCleanup = [/\s{2,}/g, /[，,、；;]\s*[，,、；;]/g];
  const realisticConflicts = [
    /Moebius\s*\(Jean\s*Giraud\)风格/gi, /Moebius/gi, /Jean\s*Giraud/gi, /吉卜力/gi, /宫崎骏/gi, /新海诚/gi, /皮克斯/gi, /迪士尼/gi,
    /2D风格/gi, /2D/gi, /动漫/gi, /二次元/gi, /漫画/gi, /插画/gi, /手绘/gi, /卡通/gi, /平面插画/gi,
    /3D风格/gi, /3D/gi, /CG/gi, /三维渲染/gi, /三维/gi, /虚幻引擎/gi, /虚幻/gi, /Unreal\s*Engine/gi, /Unreal/gi, /Blender/gi, /Octane/gi, /V-Ray/gi, /游戏渲染/gi,
    /anime/gi, /manga/gi, /illustration/gi, /illustrated/gi, /cartoon/gi, /pixar/gi, /disney/gi, /ghibli/gi,
  ];
  const twoDConflicts = [
    /写实风格/gi, /写实摄影/gi, /真实摄影/gi, /真人照片感/gi, /真人照片/gi, /照片级/gi, /photorealistic/gi, /photo\s*realistic/gi, /realistic\s*photo/gi,
    /3D风格/gi, /3D/gi, /CG/gi, /三维渲染/gi, /三维/gi, /虚幻引擎/gi, /虚幻/gi, /Unreal\s*Engine/gi, /Unreal/gi, /Blender/gi, /Octane/gi, /V-Ray/gi, /皮克斯/gi, /pixar/gi,
  ];
  const threeDConflicts = [
    /写实风格/gi, /写实摄影/gi, /真实摄影/gi, /真人照片感/gi, /真人照片/gi, /照片级/gi, /photorealistic/gi, /photo\s*realistic/gi,
    /2D风格/gi, /2D/gi, /动漫/gi, /二次元/gi, /漫画/gi, /插画/gi, /手绘/gi, /卡通/gi, /平面插画/gi,
    /Moebius\s*\(Jean\s*Giraud\)风格/gi, /Moebius/gi, /Jean\s*Giraud/gi, /吉卜力/gi, /宫崎骏/gi, /新海诚/gi, /anime/gi, /manga/gi, /illustration/gi, /cartoon/gi,
  ];
  const patterns = style === "realistic" ? realisticConflicts : style === "2d" ? twoDConflicts : threeDConflicts;
  let next = patterns.reduce((text, pattern) => text.replace(pattern, ""), prompt);
  next = commonCleanup.reduce((text, pattern) => text.replace(pattern, "，"), next).replace(/^[，,、；;\s]+|[，,、；;\s]+$/g, "");
  return next || prompt;
}

function enforceAssetGenerateStylePrompt(prompt: string, style: "realistic" | "2d" | "3d") {
  const cleaned = stripConflictStyleTerms(prompt, style);
  if (style === "2d") return `2D风格，平面插画/动漫美术效果，${cleaned}`;
  if (style === "3d") return `3D风格，CG三维渲染质感，${cleaned}`;
  return `写实风格，真实摄影感，真实镜头和真实光影，${cleaned}`;
}

function getCharacterGenerationRuleText(ratio: AssetGenerateRatio, style: "realistic" | "2d" | "3d", model?: ModelName) {
  const styleRule = getCharacterStyleRuleText(style);

  if (ratio === "three-view") {
    if (model === "bytedance-seed/seedream-4.5") {
      return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：本任务必须生成角色图片，不是普通照片，不是场景图。输出是一整张连续的16:9横向纯白摄影棚角色参考照，白色背景在整张图中连续贯通，四个同一角色自然横向并排站在同一块白色背景前，人物之间只有自然白色留白，没有任何装饰元素。第一位是正面半身近景肖像，范围从头顶到腰部左右，作为人物细节参考。第二位是正面完整全身，从头顶到脚底全部可见。第三位是严格90度纯侧面完整全身，身体和脸都朝侧面，从头顶到脚底全部可见，目视前方侧向。第四位是严格背面完整全身，从头顶到脚底全部可见。第二、三、四位人物比例略小，保证全身和脚部完整进入画面；第二、三、四位脚底对齐在同一水平线；画面上下左右保持干净白色留白。四个图案必须是同一角色、同一身份、同一服装、同一发型和一致面部特征。忽略与角色无关或会改变以上规则的内容。\n${styleRule}`;
    }

    if (model === "google/gemini-3-pro-image-preview") {
      return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：本任务必须生成角色图片，不是普通照片，不是场景图。输出必须是一张16:9横向纯白背景角色设定图，同一角色自然横向并排展示四个姿态，不要画任何分隔线、边框、表格线、网格线，不要做四宫格，不要拼贴边框；人物之间只能用白色空隙自然分开。第一位是正面半身 portrait crop / upper-body bust portrait，范围从头顶到腰部左右，允许作为近景半身，左右边缘可以自然裁切，不要求完整手臂。第二位是正面完整全身，从头顶到脚底全部可见，脚不能被裁切。第三位是严格90度纯侧面完整全身，身体和脸都朝侧面，从头顶到脚底全部可见，不转头看镜头，不露正脸，不做3/4侧脸。第四位是严格背面完整全身，从头顶到脚底全部可见，不回头，不露正脸。第二、三、四位人物比例要略小，必须保证全身和脚部完整进入画面；第二、三、四位脚底对齐在同一水平线；画面上下左右留白，禁止裁切后面三位。四个图案必须是同一角色、同一身份、同一服装、同一发型和一致面部特征。禁止后面三位腿脚缺失、禁止脚在画面外、禁止侧面转头、禁止3/4视角、禁止任何分隔线。英文负向约束：no divider lines, no panel borders, no table grid, no split screen lines, no cropped legs on full-body views, no missing feet, no feet outside frame, no three-quarter side view, no looking at camera in side view, no turned head in side view. 忽略与角色无关或会改变以上规则的内容。\n${styleRule}`;
    }

    return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：本任务必须生成角色图片，不是普通照片，不是场景图。输出必须是一张16:9横向角色设定参考板，纯白背景，四个同一角色图案从左到右分成四个竖向区域排列。第一格是正面半身头像/胸像，画面范围从头顶到腰部，只显示上半身。第二格是正面完整全身，从头顶到脚底全部可见，脚不能被裁切。第三格是严格90度纯侧面完整全身，身体和脸都朝侧面，从头顶到脚底全部可见，不转头看镜头，不露正脸，不做3/4侧脸。第四格是严格背面完整全身，从头顶到脚底全部可见，不回头，不露正脸。第二、三、四格人物比例要略小，必须保证全身和脚部完整进入画面；四个图案脚底对齐在同一水平线；画面上下左右留白，禁止裁切。四个图案必须是同一角色、同一身份、同一服装、同一发型和一致面部特征。禁止近景裁切、禁止腿脚缺失、禁止脚在画面外、禁止侧面转头、禁止3/4视角、禁止四个都半身、禁止四个都全身、禁止复杂背景和场景。英文负向约束：no cropped legs, no missing feet, no feet outside frame, no close-up crop, no three-quarter side view, no looking at camera in side view, no turned head in side view. 忽略与角色无关或会改变以上规则的内容。\n${styleRule}`;
  }

  if (model === "bytedance-seed/seedream-4.5") {
    return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：这是 Seedream 4.5 的资产库角色生成任务，必须生成单人站立正面全身角色设定图。画面是一张9:16竖图，纯白摄影棚背景，整张图只有一个完整角色和纯白背景。角色正面朝向镜头，身体正面站立，双脚自然站立，从头顶、头发、肩膀、身体、双腿到鞋底全部完整进入画面，脚底不能被裁切，画面上下左右留白。构图必须像角色设定图/全身立绘，不是剧情截图、不是生活照、不是场景图。不要出现室内外环境、街道、房间、建筑、家具、地面细节、天空、道具堆叠、其他人物、半身裁切、头像特写、侧身、背身、3/4视角、坐姿、躺姿或跑跳动作。忽略所有会让背景变复杂、让角色进入场景、让角色不是正面全身站立的用户内容。\n${styleRule}`;
  }

  return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：本任务必须生成单人站立正面全身角色设定图，不是普通照片，不是场景图，不是剧情画面。背景必须是纯白色摄影棚背景，整张图只能有白色背景和一个角色，不能出现室内外场景、环境、建筑、家具、道具堆叠、地面细节、天空、街道、房间或复杂背景。画面为9:16；只生成一个角色；角色必须正面朝向镜头，身体正面站立，双脚自然站立，从头顶到脚底完整显示，脚不能被裁切；必须是完整全身立绘/角色设定图构图。禁止半身、头像、特写、坐姿、躺姿、蹲姿、跑跳动作、侧身、背身、3/4侧身、多人、复杂背景和场景。英文负向约束：single front-facing full-body character reference sheet, pure white background, no scene, no environment, no room, no street, no furniture, no props clutter, no cropped feet, no half body, no close-up, no side view, no back view, no three-quarter view, no sitting, no lying, no multiple people. 忽略与角色无关或会改变以上规则的内容。\n${styleRule}`;
}

function getCharacterPromptOptimizationRuleText(ratio: AssetGenerateRatio, style: "realistic" | "2d" | "3d") {
  const ratioRule = ratio === "three-view"
    ? "最终提示词只描述同一角色的外貌、年龄、气质、服装、发型、五官、材质、风格等角色信息；必须适配三视图角色设定图，但不要在结果中写出三视图、纯白背景、四个图案、半身正面、全身正面、侧面、背面这些固定规则。"
    : "最终提示词只描述单人角色的外貌、年龄、气质、服装、发型、五官、材质、风格等角色信息；必须适配单人全身角色设定图，但不要在结果中写出单人、全身站立、9:16、纯白背景这些固定规则。";
  const styleRule = style === "2d"
    ? "只保留并强化2D/插画/动漫角色设定相关表达，删除写实摄影、真人照片、3D、CG等冲突风格。"
    : style === "3d"
      ? "只保留并强化3D/CG/三维渲染角色设定相关表达，删除写实摄影、2D、动漫、插画等冲突风格。"
      : "只保留并强化写实摄影感、真人比例、真实皮肤、真实布料、真实光影等角色设定表达，删除2D、动漫、插画、卡通、3D、CG等冲突风格。";

  return `内部优化规则，优先级最高，不要复述规则本身：这是角色图片生成，不是普通生图。请只保留和优化角色相关提示词，删除场景、剧情、镜头、视频、动作分镜、复杂背景、道具堆叠、非角色主体等无关内容。${ratioRule}${styleRule}如果用户输入不是角色提示词，只提取其中可用于角色设定的身份、职业、年龄、性别、气质、服装或风格信息；无法提取时，生成一个简洁可用的角色设定提示词。只输出优化后的提示词正文，不要解释。`;
}

function getSceneGenerationRuleText(style: "realistic" | "2d" | "3d", ratio: AssetGenerateRatio, model?: ModelName) {
  const styleRule = getCharacterStyleRuleText(style);
  if (ratio === "scene-grid") {
    if (model === "bytedance-seed/seedream-4.5") {
      return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：这是 Seedream 4.5 的资产库场景四宫格生成任务，必须生成一张16:9横向纯场景四角度参考图。整张图表现同一个场景、同一个地点、同一套空间结构、同一套建筑/自然元素/道具陈设，只改变观察角度。四个区域依次为正面视角、45度侧面视角、俯视角度、仰视角度；四个区域必须是同一个场景，不能变成四个不同地点。画面只能有环境、空间、建筑、自然景观、室内外背景、道具陈设和氛围。绝对不要出现任何人、人物、角色、人形、剪影、人群、脸、手、脚、肖像、文字、Logo、水印、UI、二维码、海报排版、说明标签、标题或编号。用户提示词里的人物、角色和动作全部忽略，只保留可用于场景的环境信息。\n${styleRule}`;
    }

    return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：本任务必须生成纯场景四宫格参考图。输出必须是一张16:9横向图片，画面平均分成四个清晰宫格，四个宫格必须是同一个场景、同一个地点、同一套空间结构、同一套建筑/自然元素/道具陈设，只改变观察角度，不能变成四个不同场景。四格内容依次为：第一格正面视角，第二格45度侧面视角，第三格俯视角度，第四格仰视角度。四格都必须是纯场景，只允许表现环境、空间、建筑、自然景观、室内外背景、道具陈设和氛围。画面中绝对不能出现任何人、人物、角色、身体部位、人形主体、行人、剪影、人群、肖像、脸、手、脚或拟人形象；如果用户提示词提到人物或角色，必须完全忽略人物，只保留可用于场景的环境信息。不能出现任何文字、字幕、标识字、招牌字、Logo、水印、UI界面、二维码、说明标签、海报排版或多余装饰。除了四宫格自身的分区结构外，不要添加额外边框、标题、编号或文字。英文负向约束：same scene from four angles, no people, no person, no human, no character, no figure, no silhouette, no portrait, no face, no hands, no crowd, no text, no letters, no logo, no watermark, no UI, no poster layout.\n${styleRule}`;
  }

  if (model === "bytedance-seed/seedream-4.5") {
    return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：这是 Seedream 4.5 的资产库场景生成任务，必须生成一张纯场景设定图。画面只能表现环境、空间、建筑、自然景观、室内外背景、道具陈设、光线、材质和氛围。整张图不能有任何人、人物、角色、人形、剪影、人群、肖像、脸、手、脚、拟人主体或角色站在场景中。用户提示词里如果有角色、人物、动作、剧情，必须完全忽略人物，只保留地点、空间、时代、材质、光线和氛围。画面不能出现文字、Logo、水印、UI、二维码、边框、相框、分割线、画中画、海报排版、说明标签或标题。最终只是一张连续完整的纯场景画面，不是角色图、不是分镜截图、不是海报、不是拼贴图。\n${styleRule}`;
  }

  return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：本任务必须生成纯场景图片，只允许表现环境、空间、建筑、自然景观、室内外背景、道具陈设和氛围。画面中绝对不能出现任何人、人物、角色、身体部位、人形主体、行人、剪影、人群、肖像、脸、手、脚或拟人形象；如果用户提示词提到人物或角色，必须完全忽略人物，只保留可用于场景的环境信息。画面不能出现任何文字、字幕、标识字、招牌字、Logo、水印、UI界面、二维码、边框、相框、分割线、拼贴框、画中画、海报排版、说明标签或多余装饰。最终只是一张连续完整的纯场景画面，不能像设定板、分镜表、海报、页面或拼图。英文负向约束：no people, no person, no human, no character, no figure, no silhouette, no portrait, no face, no hands, no crowd, no text, no letters, no logo, no watermark, no border, no frame, no panel, no grid, no UI, no poster layout.\n${styleRule}`;
}

function getScenePromptOptimizationRuleText(style: "realistic" | "2d" | "3d", ratio: AssetGenerateRatio) {
  const styleRule = style === "2d"
    ? "只保留并强化2D/插画/动漫场景美术相关表达，删除写实摄影、真人照片、3D、CG等冲突风格。"
    : style === "3d"
      ? "只保留并强化3D/CG/三维渲染场景美术相关表达，删除写实摄影、2D、动漫、插画等冲突风格。"
      : "只保留并强化写实摄影感、真实空间、真实材质、真实光影等场景表达，删除2D、动漫、插画、卡通、3D、CG等冲突风格。";

  const ratioRule = ratio === "scene-grid"
    ? "最终提示词必须适配同一场景四宫格：同一地点的正面、45度侧面、俯视、仰视四个角度；不要把四宫格固定规则、角度说明、无人物、无文字等内部规则完整写进结果，只保留场景本身的地点、空间结构、材质、光线和氛围。"
    : "最终提示词必须适配单张纯场景图；不要把无人物、无文字、无边框等内部规则完整写进结果，只保留场景本身的地点、空间结构、材质、光线和氛围。";

  return `内部优化规则，优先级最高，不要复述规则本身：这是场景图片生成，不是角色图。请只保留和优化场景、环境、空间、建筑、自然景观、室内外背景、道具陈设、光线、时间、天气、氛围和美术风格信息；删除人物、角色、肖像、肢体、人群、动作、剧情、分镜、视频和非场景主体。最终提示词必须适合生成纯场景图，不能包含人、人物、角色、剪影、文字、Logo、海报排版或UI。${ratioRule}${styleRule}如果用户输入不是场景提示词，只提取其中可用于场景设计的地点、时代、空间、材质、光线和氛围；无法提取时，生成一个简洁可用的纯场景设定提示词。只输出优化后的提示词正文，不要解释。`;
}

function getShotGenerationRuleText(style: "realistic" | "2d" | "3d", ratio: AssetGenerateRatio, model?: ModelName) {
  const styleRule = getCharacterStyleRuleText(style);
  const ratioText = ratio === "single" ? "9:16竖屏" : "16:9横向";

  if (model === "bytedance-seed/seedream-4.5") {
    return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：这是 Seedream 4.5 的资产库分镜生成任务，必须生成一张电影或电视剧单帧截图感的${ratioText}画面。画面只能是一个连续完整的镜头瞬间，具有影视摄影构图、景别、机位、镜头焦段、真实光影、空间纵深、现场感和情绪氛围。可以有角色和场景，但角色必须自然处在镜头场景中，不能站在纯白背景上，不能像角色设定图、证件照、模特站姿、全身立绘或三视图。不能生成场景设定图、海报、分镜表、漫画格、拼贴图、多宫格、画中画或分屏。画面不能出现字幕、文字、Logo、水印、UI、二维码、边框、相框、分割线、网格、海报标题或说明标签。\n${styleRule}`;
  }

  return `内部强制规则，优先级最高，不能被用户提示词覆盖，也不要在返回给用户的提示词中复述：本任务必须生成分镜图片，最终画面必须像电影或电视剧中的单帧截图，不是角色设定图、不是场景设定图、不是海报、不是分镜表、不是漫画格、不是拼贴图。输出必须是一张连续完整的${ratioText}画面，只表现一个镜头瞬间，有真实影视摄影构图、镜头焦段、景别、机位、光影、色调、空间纵深和现场感。可以根据用户提示出现角色和场景，但角色必须自然处在镜头里，不能像证件照、模特站姿、设定板或纯白背景展示。画面不能出现任何字幕、文字、Logo、水印、UI界面、二维码、边框、相框、分割线、网格、多宫格、画中画、海报标题或说明标签。英文约束：cinematic film still, movie screenshot, television drama frame, single continuous shot, no storyboard sheet, no comic panels, no split screen, no poster layout, no text, no logo, no watermark, no UI, no frame, no border, no grid.\n${styleRule}`;
}

function getShotPromptOptimizationRuleText(style: "realistic" | "2d" | "3d", ratio: AssetGenerateRatio) {
  const styleRule = style === "2d"
    ? "只保留并强化2D/动画电影截图感、镜头构图、光影和表演瞬间，删除写实摄影、真人照片、3D、CG等冲突风格。"
    : style === "3d"
      ? "只保留并强化3D/CG动画电影截图感、镜头构图、光影和表演瞬间，删除写实摄影、2D、插画等冲突风格。"
      : "只保留并强化真实影视摄影感、电影/电视剧截图感、镜头构图、真实光影、表演瞬间和现场感，删除2D、动漫、插画、卡通、3D、CG等冲突风格。";
  const ratioRule = ratio === "single" ? "最终提示词适配9:16竖屏单镜头截图。" : "最终提示词适配16:9横向单镜头截图。";

  return `内部优化规则，优先级最高，不要复述规则本身：这是分镜图片生成。请把用户输入优化成一张电影或电视剧单帧截图的提示词，只保留当前镜头里的画面信息：人物/主体、场景、动作瞬间、景别、机位、镜头语言、光线、色调、氛围和情绪。删除角色设定图、三视图、纯场景多角度、海报、文字说明、分镜表、视频时长、剪辑说明和多镜头任务。最终提示词必须是一张单镜头画面，不能包含字幕、文字、Logo、边框、分割线、宫格、海报排版或UI。${ratioRule}${styleRule}如果用户输入不是分镜提示词，提取其中可用于一个影视镜头截图的主体、场景、动作和情绪；无法提取时，生成一个简洁可用的电影截图提示词。只输出优化后的提示词正文，不要解释。`;
}

function getProfessionalPromptOptimizationRuleText(mode: "image" | "video") {
  if (mode === "video") {
    return "内部优化规则，优先级最高，不要复述规则本身：这是视频生成专业模式。请把用户输入优化成可直接用于视频生成模型的提示词，只保留画面主体、场景、动作变化、镜头运动、景别、光线、氛围、节奏和风格。不要写解释，不要写多方案，不要写标题，不要写参数说明，不要写时长/分辨率/比例按钮值。用户提到参考图或@资产时，保留对参考主体、外观、场景或构图的描述。只输出优化后的提示词正文。";
  }

  return "内部优化规则，优先级最高，不要复述规则本身：这是图片生成专业模式。请把用户输入优化成可直接用于图片生成模型的提示词，只保留画面主体、场景、构图、景别、机位、光线、色彩、质感、氛围和风格。不要写解释，不要写多方案，不要写标题，不要写参数说明，不要写生成数量/分辨率/比例按钮值。用户提到参考图或@资产时，保留对参考主体、外观、场景或构图的描述。只输出优化后的提示词正文。";
}

function getValidReferenceNames(assets: AssetItem[], uploadedImages: UploadedImage[], conversationReferences: ImageReference[] = []) {
  return new Set([
    ...assets.filter((asset) => !isVideoAsset(asset)).map((asset) => asset.name),
    ...uploadedImages.map((image) => getUploadedImageReferenceName(image, uploadedImages)),
    ...conversationReferences.map((reference) => reference.name),
  ]);
}

function getAssetReferencesText(assets: AssetItem[]) {
  if (assets.length === 0) return "";

  return `\n\n已引用资产：${assets.map((asset) => `@${asset.name}（${assetTypeLabels[asset.type]}）`).join("，")}。生成时请保持这些参考资产的一致性。`;
}

function isVideoAsset(asset: Pick<AssetItem, "type" | "url">) {
  return asset.type === "shot_video" || /\.(mp4|webm|mov)(\?|$)/i.test(asset.url);
}

function isAudioAsset(asset: Pick<AssetItem, "url">) {
  return /\.(mp3|wav)(\?|$)/i.test(asset.url);
}

function getAssetCategoryTargets(asset: Pick<AssetItem, "type" | "url">): AssetCategoryTarget[] {
  return isVideoAsset(asset) ? [] : ["character_image", "scene_image", "shot_image", "conversation_image"];
}

function getSelectedAssetCategoryTarget(asset: AssetItem): AssetCategoryTarget {
  if (isConversationUploadedAsset(asset)) return "conversation_image";
  return assetGenerationTypes.includes(asset.type as UploadableImageAssetType) ? asset.type as UploadableImageAssetType : "conversation_image";
}

function isAssetCategoryTargetSelected(asset: AssetItem, target: AssetCategoryTarget) {
  if (isConversationAsset(asset) && !isConversationUploadedAsset(asset)) return false;
  return getSelectedAssetCategoryTarget(asset) === target;
}

function getAssetCountdownText(asset: Pick<AssetItem, "purgeAt">, now: number) {
  if (!asset.purgeAt) return "";

  const remaining = Math.max(0, asset.purgeAt - now);
  const minutes = Math.ceil(remaining / (60 * 1000));
  const hours = Math.ceil(remaining / (60 * 60 * 1000));
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));

  if (remaining <= 60 * 60 * 1000) return `${minutes} 分钟后删除`;
  if (remaining <= 24 * 60 * 60 * 1000) return `${hours} 小时后删除`;
  return `${days} 天后删除`;
}

function isAssetTrashExpired(asset: Pick<AssetItem, "type" | "purgeAt">, now: number) {
  return asset.type === "trash" && Boolean(asset.purgeAt && asset.purgeAt <= now);
}

function getRestoreAssetType(asset: AssetItem): AssetType {
  if (asset.previousType && asset.previousType !== "trash") return asset.previousType;
  if (isVideoAsset(asset)) return "shot_video";
  if (asset.librarySource === "asset_generation" && asset.systemName?.startsWith("角色")) return "character_image";
  if (asset.librarySource === "asset_generation" && asset.systemName?.startsWith("场景")) return "scene_image";
  if (asset.librarySource === "asset_generation" && asset.systemName?.startsWith("分镜")) return "shot_image";
  return "other";
}

function normalizeStoredAssets(assets: AssetItem[]) {
  return assets.map((asset) => {
    const legacyType = asset.type as AssetType | "character" | "scene" | "video";
    const systemName = asset.systemName || asset.name;
    const userName = asset.userName || (asset.systemName && asset.name && asset.name !== asset.systemName ? asset.name : undefined);
    const displayName = userName || systemName;
    if (asset.type === "trash") return { ...asset, name: displayName, systemName, userName };
    if (asset.librarySource === "asset_generation" && asset.type === "other") return { ...asset, name: displayName, systemName, userName, type: getRestoreAssetType({ ...asset, systemName }) };
    if (asset.lockedType && assetTypeOrder.includes(asset.type)) return { ...asset, name: displayName, systemName, userName };

    const mode: WorkMode = legacyType === "video" || legacyType === "shot_video" || /\.(mp4|webm|mov)(\?|$)/i.test(asset.url) ? "video" : "image";
    const type = getAssetTypeFromText(asset.sourcePrompt, mode);

    return {
      ...asset,
      name: displayName,
      systemName,
      userName,
      type,
    };
  });
}

function getPersistableAssetGenerateJobs(jobs: AssetGenerateJob[]) {
  return jobs.filter((job) => job.result.status !== "succeeded").slice(0, 30);
}

function normalizeStoredAssetGenerateJobs(value: unknown): AssetGenerateJob[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const job = item as Partial<AssetGenerateJob>;
    if (!job.id || typeof job.id !== "string") return [];
    if (!job.prompt || typeof job.prompt !== "string") return [];
    if (!assetGenerationTypes.includes(job.type as UploadableImageAssetType)) return [];
    if (job.ratio !== "single" && job.ratio !== "three-view" && job.ratio !== "scene-grid") return [];
    if (job.style !== "realistic" && job.style !== "2d" && job.style !== "3d") return [];
    const model = job.model && generationModelOptions.image.some((item) => item.id === job.model) ? job.model : DEFAULT_CHARACTER_IMAGE_MODEL;
    const result = job.result?.status === "failed"
      ? { status: "failed" as const, error: job.result.error || GENERIC_MEDIA_ERROR_MESSAGE }
      : job.result?.status === "generating"
        ? { status: "failed" as const, error: "页面刷新导致生成任务中断，请重新生成。" }
        : undefined;

    if (!result) return [];

    return [{
      id: job.id,
      type: job.type as AssetGenerationImageType,
      prompt: job.prompt,
      ratio: job.ratio,
      style: job.style,
      model,
      resolution: typeof job.resolution === "string" ? job.resolution : DEFAULT_CHARACTER_IMAGE_RESOLUTION,
      previewMeta: job.previewMeta ?? {
        mode: "image" as const,
        modelLabel: getGenerationModelLabel("image", model),
        ratio: job.ratio === "single" ? "单人9:16" : "三视图16:9",
        resolution: DEFAULT_CHARACTER_IMAGE_RESOLUTION,
        sizeText: "",
      },
      result,
    }];
  });
}

function getSessionMediaSystemNameMap(sessions: WorkSession[]) {
  const map = new Map<string, string>();

  sessions.forEach((session) => {
    session.messages.forEach((message) => {
      if (message.role !== "assistant") return;
      Object.entries(message.mediaSystemNames ?? {}).forEach(([url, systemName]) => {
        if (url && systemName) map.set(normalizeMediaUrlForMatch(url), systemName);
      });
    });
  });

  return map;
}

function applySessionMediaSystemNamesToAssets(assets: AssetItem[], sessions: WorkSession[]) {
  const mediaSystemNames = getSessionMediaSystemNameMap(sessions);
  const sessionCodes = new Map(sessions.map((session) => [session.id, session.conversationCode || "d0"]));
  const fallbackSystemNames = new Map<string, string>();
  const counters = new Map<string, { image: number; video: number }>();

  const getCounter = (sessionId: string) => {
    const current = counters.get(sessionId) ?? { image: 1, video: 1 };
    counters.set(sessionId, current);
    return current;
  };

  assets
    .filter((asset) => isConversationAsset(asset) && !isUploadedAsset(asset))
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((asset) => {
      const urlKey = normalizeMediaUrlForMatch(asset.url);
      const matchedName = mediaSystemNames.get(urlKey);
      if (matchedName) {
        fallbackSystemNames.set(asset.id, matchedName);
        const imageNumber = Number(matchedName.match(/^image_(\d+)_d\d+$/)?.[1]);
        const videoNumber = Number(matchedName.match(/^video_(\d+)_d\d+$/)?.[1]);
        const counter = getCounter(asset.sessionId);
        if (Number.isFinite(imageNumber)) counter.image = Math.max(counter.image, imageNumber + 1);
        if (Number.isFinite(videoNumber)) counter.video = Math.max(counter.video, videoNumber + 1);
        return;
      }

      const counter = getCounter(asset.sessionId);
      const conversationCode = sessionCodes.get(asset.sessionId) || "d0";
      if (isVideoAsset(asset)) {
        fallbackSystemNames.set(asset.id, buildConversationMediaSystemName("video", counter.video, conversationCode));
        counter.video += 1;
      } else {
        fallbackSystemNames.set(asset.id, buildConversationMediaSystemName("image", counter.image, conversationCode));
        counter.image += 1;
      }
    });

  return assets.map((asset) => {
    if (isUploadedAsset(asset)) {
      const systemName = asset.systemName || asset.name;
      const userName = asset.userName || (asset.systemName && asset.name !== asset.systemName ? asset.name : undefined);
      return { ...asset, name: userName || systemName, systemName, userName };
    }

    const sessionSystemName = mediaSystemNames.get(normalizeMediaUrlForMatch(asset.url));
    const fallbackSystemName = fallbackSystemNames.get(asset.id);
    const legacyRandomNamePattern = /^(image|video)_\d{5,10}$/;
    const currentSystemNamePattern = /^(image|video)_\d+_d\d+$/;
    const temporaryPreviewNamePattern = /^生成(?:图片|视频)\d+$/;
    const oldSystemName = asset.systemName;
    const systemName = sessionSystemName || fallbackSystemName || oldSystemName || asset.name;
    const userName = asset.userName || (oldSystemName && asset.name !== oldSystemName && !legacyRandomNamePattern.test(asset.name) && !temporaryPreviewNamePattern.test(asset.name) && !currentSystemNamePattern.test(asset.name) ? asset.name : undefined);

    return { ...asset, name: userName || systemName, systemName, userName };
  });
}

function reserveWorkflowMediaSystemNamesForItems(workflows: WorkflowItem[], assets: AssetItem[], workflowId: string, mediaType: "image" | "video", urls: string[]) {
  const cleanUrls = urls.filter((url) => url && !url.startsWith("data:"));
  const result: Record<string, string> = {};
  if (cleanUrls.length === 0) return { names: result, workflows };

  const workflow = workflows.find((item) => item.id === workflowId);
  if (!workflow) return { names: result, workflows };

  const workflowCode = getWorkflowCode(workflow) || "w0";
  let nextImageNumber = Math.max(1, Math.floor(workflow.nextImageNumber ?? 1));
  let nextVideoNumber = Math.max(1, Math.floor(workflow.nextVideoNumber ?? 1));
  const existingNames = new Map<string, string>();
  const usedSystemNames = new Set<string>();
  let maxExistingImageNumber = 0;
  let maxExistingVideoNumber = 0;

  assets.filter((asset) => isWorkflowAsset(asset) && (asset.workflowId || asset.sessionId) === workflowId).forEach((asset) => {
    const systemName = asset.systemName || asset.name;
    if (!systemName) return;
    usedSystemNames.add(systemName);
    const imageNumber = Number(systemName.match(/^image_(\d+)_w\d+$/)?.[1]);
    const videoNumber = Number(systemName.match(/^video_(\d+)_w\d+$/)?.[1]);
    if (Number.isFinite(imageNumber)) maxExistingImageNumber = Math.max(maxExistingImageNumber, imageNumber);
    if (Number.isFinite(videoNumber)) maxExistingVideoNumber = Math.max(maxExistingVideoNumber, videoNumber);
    if (Number.isFinite(imageNumber)) nextImageNumber = Math.max(nextImageNumber, imageNumber + 1);
    if (Number.isFinite(videoNumber)) nextVideoNumber = Math.max(nextVideoNumber, videoNumber + 1);
    existingNames.set(normalizeMediaUrlForMatch(asset.url), systemName);
  });

  if (maxExistingImageNumber > 0 && nextImageNumber > maxExistingImageNumber + cleanUrls.length + 1) nextImageNumber = maxExistingImageNumber + 1;
  if (maxExistingVideoNumber > 0 && nextVideoNumber > maxExistingVideoNumber + cleanUrls.length + 1) nextVideoNumber = maxExistingVideoNumber + 1;

  cleanUrls.forEach((url) => {
    const key = normalizeMediaUrlForMatch(url);
    const existingName = existingNames.get(key);
    if (existingName) {
      result[url] = existingName;
      return;
    }

    if (mediaType === "video") {
      while (usedSystemNames.has(buildWorkflowMediaSystemName("video", nextVideoNumber, workflowCode))) nextVideoNumber += 1;
      result[url] = buildWorkflowMediaSystemName("video", nextVideoNumber, workflowCode);
      usedSystemNames.add(result[url]);
      nextVideoNumber += 1;
    } else {
      while (usedSystemNames.has(buildWorkflowMediaSystemName("image", nextImageNumber, workflowCode))) nextImageNumber += 1;
      result[url] = buildWorkflowMediaSystemName("image", nextImageNumber, workflowCode);
      usedSystemNames.add(result[url]);
      nextImageNumber += 1;
    }
  });

  const changed = workflow.workflowCode !== workflowCode || (workflow.nextImageNumber ?? 1) !== nextImageNumber || (workflow.nextVideoNumber ?? 1) !== nextVideoNumber;
  const nextWorkflows = changed ? workflows.map((item) => item.id === workflowId ? { ...item, workflowCode, nextImageNumber, nextVideoNumber } : item) : workflows;
  return { names: result, workflows: nextWorkflows };
}

function applyAssetGenerationSystemNames(assets: AssetItem[]) {
  const systemNames = new Map<string, string>();

  assetGenerationTypes.forEach((type) => {
    const prefix = type === "scene_image" ? "场景" : type === "shot_image" ? "分镜" : "角色";
    assets
      .filter((asset) => asset.librarySource === "asset_generation" && asset.type === type && !isUploadPromptPlaceholder(asset.sourcePrompt))
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((asset, index) => {
        systemNames.set(asset.id, `${prefix}${index + 1}`);
      });
  });

  return assets.map((asset) => {
    const systemName = systemNames.get(asset.id);
    if (!systemName) return asset;
    const userName = asset.userName || (asset.systemName && asset.name !== asset.systemName ? asset.name : undefined);
    return { ...asset, name: userName || systemName, systemName, userName };
  });
}

function extractAssetsFromSessions(sessions: WorkSession[], existingAssets: AssetItem[]) {
  let nextAssets = existingAssets;
  const knownUrls = new Set(existingAssets.map((asset) => asset.url));
  const mediaSystemNames = getSessionMediaSystemNameMap(sessions);

  sessions.forEach((session) => {
    let previousUserText = "";

    session.messages.forEach((message) => {
      if (message.role === "user") {
        previousUserText = message.content;
        return;
      }

      const sourcePrompt = previousUserText || message.content || session.title;
      const messageVideos = getMessageVideos(message);
      const urls = [...(message.images ?? []), ...messageVideos].filter((url) => url && !url.startsWith("data:"));

      urls.forEach((url) => {
        if (knownUrls.has(url)) return;

        const mode: WorkMode = messageVideos.includes(url) ? "video" : "image";
        const type = getAssetTypeFromText(sourcePrompt, mode);
        const systemName = mediaSystemNames.get(normalizeMediaUrlForMatch(url)) ?? getConversationAssetName(mode, nextAssets);
        const name = systemName;

        knownUrls.add(url);
        nextAssets = [
          ...nextAssets,
          {
            id: createClientId(),
            type,
            name,
            systemName,
            url,
            librarySource: "conversation",
            sourcePrompt,
            sessionId: session.id,
            messageId: message.id,
            createdAt: message.createdAt ?? session.updatedAt,
          },
        ];
      });
    });
  });

  return nextAssets.sort((a, b) => b.createdAt - a.createdAt);
}

function isReferencingRecentImage(text: string) {
  const normalized = normalizeIntentText(text);
  return /(这张图|这张图片|这图|刚才那张|上一张|上面那张|图中|图片里|让它|让他|让她|动起来|首帧|参考图|用这张|按这张)/.test(normalized);
}

function getRecentReferenceImages(messages: Message[], text: string) {
  if (!isReferencingRecentImage(text)) return [];

  return [...messages]
    .reverse()
    .flatMap((message) => message.images ?? [])
    .filter(Boolean)
    .slice(0, MAX_UPLOADED_IMAGES);
}

function renderInlineFormatting(text: string) {
  const pattern = /(\*\*[^*]+\*\*|\[red\][\s\S]+?\[\/red\]|\[blue\][\s\S]+?\[\/blue\])/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const cleanText = (value: string) => value.replace(/\*\*/g, "").replace(/__/g, "");

  text.replace(pattern, (match, _token, index: number) => {
    if (index > lastIndex) nodes.push(cleanText(text.slice(lastIndex, index)));

    if (match.startsWith("**")) {
      nodes.push(
        <strong key={`${match}-${index}`} className="font-semibold text-[#111111]">
          {match.slice(2, -2)}
        </strong>,
      );
    } else if (match.startsWith("[red]")) {
      nodes.push(
        <span key={`${match}-${index}`} className="rounded-md bg-[#fff1f1] px-1.5 py-0.5 text-[14px] font-semibold text-[#d36b63]">
          {match.slice(5, -6)}
        </span>,
      );
    } else {
      nodes.push(
        <span key={`${match}-${index}`} className="rounded-md bg-[#eef5ff] px-1.5 py-0.5 text-[14px] font-semibold text-[#6f95d8]">
          {match.slice(6, -7)}
        </span>,
      );
    }

    lastIndex = index + match.length;
    return match;
  });

  if (lastIndex < text.length) nodes.push(cleanText(text.slice(lastIndex)));
  return nodes.length > 0 ? nodes : cleanText(text);
}

function sanitizeMessageContentForDisplay(content: string) {
  return sanitizeModelOutputText(content)
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/^```[\w-]*\s*$/gm, "")
    .replace(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .trim();
}

const BYTEPLUS_AUTO_REVIEW_NOTICE = "系统检测到真人图片，需要审核才能生成视频，此次视频生成任务会延长时间，请稍候....";

function isBytePlusAutoReviewNotice(content: string) {
  return content === BYTEPLUS_AUTO_REVIEW_NOTICE;
}

function isAgentActivationMessage(content: string) {
  const firstLine = sanitizeMessageContentForDisplay(content).split(/\n/).find((line) => line.trim())?.replace(/^#{1,6}\s*/, "").trim() ?? "";
  return /已激活[。！!]*$/.test(firstLine);
}

function InlineAgentIcon({ activated = false, variant = "agent" }: { activated?: boolean; variant?: "agent" | "general" }) {
  if (activated) return <RiTerminalWindowFill className="mr-1.5 inline-block h-5 w-5 align-[-3px] text-[#367cee]" />;
  if (variant === "general") return <AiAgentLineIcon className="mr-1.5 inline-block h-5 w-5 align-[-3px] text-[#367cee]" />;
  return <RiAiIcon className="mr-1.5 inline-block h-5 w-5 align-[-3px] text-[#367cee]" />;
}

function InlineAssistantIcon({ message, activated = false, provider }: { message: Message; activated?: boolean; provider?: "openrouter" | "byteplus" }) {
  if (message.mode === "general" && !activated) {
    const ModelIcon = provider === "byteplus" ? BytePlusIcon : message.textModel ? getGenerationModelIcon(message.textModel) : null;
    return ModelIcon ? <ModelIcon className="mr-1.5 inline-block h-5 w-5 align-[-3px] text-[#367cee]" aria-hidden="true" /> : <AiAgentLineIcon className="mr-1.5 inline-block h-5 w-5 align-[-3px] text-[#367cee]" />;
  }

  return <InlineAgentIcon activated={activated} variant={message.mode === "general" ? "general" : "agent"} />;
}

function FormattedMessage({ content, leadingIcon }: { content: string; leadingIcon?: ReactNode }) {
  const displayContent = sanitizeMessageContentForDisplay(content);
  const blocks = displayContent.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  if (blocks.length === 0) return null;

  const renderLine = (line: string, key: string, lineLeadingIcon?: ReactNode) => {
    const redCallout = line.match(/^\[red\]([\s\S]+)\[\/red\]$/);
    const blueCallout = line.match(/^\[blue\]([\s\S]+)\[\/blue\]$/);
    const divider = /^-{3,}$/.test(line);
    const heading = line.match(/^(#{1,6})\s*(.*)$/);
    const boldHeading = line.match(/^\*\*([^*]{2,24})\*\*$/);
    const labeledListItem = line.match(/^(?:[-*]|\d+[.、])\s*(.{2,30}?[：:])\s*([\s\S]*)$/);
    const bulletItem = line.match(/^[-*]\s+([\s\S]+)$/);

    if (divider) {
      return <hr key={key} className="my-4 border-[#e5e5e5]" />;
    }

    if (redCallout || blueCallout) {
      const isRed = Boolean(redCallout);
      return (
        <div key={key} className={isRed ? "rounded-xl bg-[#fff1f1] px-3 py-2 text-[14px] font-semibold leading-6 text-[#d36b63]" : "rounded-xl bg-[#eef5ff] px-3 py-2 text-[14px] font-semibold leading-6 text-[#6f95d8]"}>
          {lineLeadingIcon}
          {redCallout?.[1] ?? blueCallout?.[1]}
        </div>
      );
    }

    if (heading) {
      const level = heading[1].length;
      const headingText = heading[2]?.trim() ?? "";

      if (!headingText) return null;

      if (level === 1) {
        return (
          <h1 key={key} className="pt-2 text-[22px] font-semibold leading-8 tracking-[-0.02em] text-[#111111]">
            {lineLeadingIcon}
            {renderInlineFormatting(headingText)}
          </h1>
        );
      }

      return level === 2 ? (
        <h2 key={key} className="pt-2 text-[19px] font-semibold leading-7 tracking-[-0.01em] text-[#111111]">
          {lineLeadingIcon}
          {renderInlineFormatting(headingText)}
        </h2>
      ) : (
        <h3 key={key} className="pt-1 text-[16px] font-semibold leading-6 text-[#111111]">
          {lineLeadingIcon}
          {renderInlineFormatting(headingText)}
        </h3>
      );
    }

    if (boldHeading) {
      return (
        <h3 key={key} className="pt-1 text-[16px] font-semibold leading-6 text-[#111111]">
          {lineLeadingIcon}
          {boldHeading[1]}
        </h3>
      );
    }

    if (labeledListItem) {
      return (
        <div key={key} className="flex gap-2">
          <span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#111111]" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            {lineLeadingIcon}
            <span className="font-semibold text-[#111111]">{renderInlineFormatting(labeledListItem[1])}</span>
            {labeledListItem[2] ? renderInlineFormatting(labeledListItem[2]) : null}
          </p>
        </div>
      );
    }

    if (bulletItem) {
      return (
        <div key={key} className="flex gap-2">
          <span className="mt-[0.72em] h-1.5 w-1.5 shrink-0 rounded-full bg-[#111111]" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            {lineLeadingIcon}
            {renderInlineFormatting(bulletItem[1])}
          </p>
        </div>
      );
    }

    return <p key={key}>{lineLeadingIcon}{renderInlineFormatting(line)}</p>;
  };

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const lines = block.split(/\n/).map((line) => line.trim()).filter(Boolean);
        const isList = lines.every((line) => /^[-*]\s+/.test(line));

        if (isList) {
          return (
            <ul key={blockIndex} className="space-y-1 pl-5">
              {lines.map((line, lineIndex) => {
                const content = line.replace(/^[-*]\s+/, "");
                const labeledItem = content.match(/^(.{2,30}?[：:])\s*([\s\S]*)$/);

                return (
                  <li key={`${blockIndex}-${lineIndex}`} className="list-disc">
                    {blockIndex === 0 && lineIndex === 0 ? leadingIcon : null}
                    {labeledItem ? (
                      <>
                        <span className="font-semibold text-[#111111]">{renderInlineFormatting(labeledItem[1])}</span>
                        {labeledItem[2] ? renderInlineFormatting(labeledItem[2]) : null}
                      </>
                    ) : (
                      renderInlineFormatting(content)
                    )}
                  </li>
                );
              })}
            </ul>
          );
        }

        return (
          <div key={blockIndex} className="space-y-2">
            {lines.map((line, lineIndex) => renderLine(line, `${blockIndex}-${lineIndex}`, blockIndex === 0 && lineIndex === 0 ? leadingIcon : undefined))}
          </div>
        );
      })}
    </div>
  );
}

function SuggestionButtons({ suggestions, onSelect }: { suggestions?: SuggestionInput[]; onSelect: (suggestion: SuggestionItem) => void }) {
  const safeSuggestions = normalizeMessageSuggestions(suggestions);

  if (!safeSuggestions) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {safeSuggestions.map((suggestion) => (
        <button
          key={`${suggestion.label}-${suggestion.assetTargetType ?? "none"}`}
          type="button"
          onClick={() => onSelect(suggestion)}
          className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-[8px] bg-[#f4f4f4] px-3.5 py-1.5 text-[10px] font-normal leading-4 text-[#999999] transition hover:bg-[#ececec]"
        >
          <span className="text-[14px] leading-4">{suggestion.label}</span>
          <span className="text-[14px] leading-none text-[#999999]">→</span>
        </button>
      ))}
    </div>
  );
}

function getEditableText(element: HTMLElement) {
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

  // Browsers keep an empty contenteditable focusable by inserting a lone <br>.
  // Treat that browser placeholder as empty input, not as a real newline.
  if (normalizedText.replace(/\n/g, "") === "") return "";

  return normalizedText;
}

function appendEditorText(element: HTMLElement, text: string) {
  text.split("\n").forEach((line, index) => {
    if (index > 0) element.append(document.createElement("br"));
    if (line) element.append(document.createTextNode(line));
  });
}

function getEditorMentionRanges(value: string, validReferences: Set<string>) {
  const names = Array.from(validReferences).filter(Boolean).sort((a, b) => b.length - a.length);
  const ranges: Array<{ start: number; end: number; name: string }> = [];
  if (names.length === 0) return ranges;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "@") continue;
    const matchedName = names.find((name) => value.startsWith(`@${name}`, index));
    if (!matchedName) continue;
    const end = index + matchedName.length + 1;
    ranges.push({ start: index, end, name: matchedName });
    index = end - 1;
  }

  return ranges;
}

function getMentionRangeForDeletion(value: string, cursorOffset: number, direction: "backward" | "forward", validReferences: Set<string>) {
  const probeOffset = direction === "backward" ? cursorOffset - 1 : cursorOffset;
  if (probeOffset < 0 || probeOffset >= value.length) return undefined;
  return getEditorMentionRanges(value, validReferences).find((range) => probeOffset >= range.start && probeOffset < range.end);
}

function getSelectionTextOffset(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return getEditableText(element).length;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return getEditableText(element).length;

  let offset = 0;
  let found = false;
  const nodeTextLength = (node: Node): number => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
    if (node.nodeName === "BR") return node instanceof HTMLElement && node.dataset.trailingBreak === "true" ? 0 : 1;
    return Array.from(node.childNodes).reduce((sum, child) => sum + nodeTextLength(child), 0);
  };
  const walk = (node: Node) => {
    if (found) return;

    if (node === range.startContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.startOffset;
      } else {
        Array.from(node.childNodes).slice(0, range.startOffset).forEach((child) => {
          offset += nodeTextLength(child);
        });
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
  return found ? offset : getEditableText(element).length;
}

function setSelectionTextOffset(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  let remaining = Math.max(0, offset);
  const placeCaret = (container: Node): boolean => {
    const children = Array.from(container.childNodes);

    for (const child of children) {
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

function renderEditorContent(element: HTMLElement, value: string, validReferences: Set<string>) {
  element.replaceChildren();

  if (!value) return;

  let cursor = 0;
  getEditorMentionRanges(value, validReferences).forEach((range) => {
    if (range.start > cursor) appendEditorText(element, value.slice(cursor, range.start));

    const mention = document.createElement("span");
    mention.className = "text-[#4f7cff]";
    mention.dataset.mention = "true";
    mention.contentEditable = "false";
    mention.textContent = value.slice(range.start, range.end);
    element.append(mention);
    cursor = range.end;
  });

  if (cursor < value.length) appendEditorText(element, value.slice(cursor));

  if (value.endsWith("\n")) {
    const trailingBreak = document.createElement("br");
    trailingBreak.dataset.trailingBreak = "true";
    element.append(trailingBreak);
  }
}

function isEditorScrolledToBottom(element: HTMLElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= 8;
}

function preserveEditorScroll(element: HTMLElement, callback: () => void) {
  const wasAtBottom = isEditorScrolledToBottom(element);
  const previousScrollTop = element.scrollTop;

  callback();

  if (wasAtBottom) {
    element.scrollTop = element.scrollHeight;
  } else {
    element.scrollTop = previousScrollTop;
  }
}

function PlainMentionEditor({
  value,
  disabled = false,
  validReferences,
  editorRef,
  className = "",
  editorStyle,
  maxHeight = 300,
  onChange,
  onPasteImages,
  onSubmit,
  onAtTrigger,
  onAtClose,
  onLimit,
  onCursorChange,
}: {
  value: string;
  disabled?: boolean;
  validReferences: Set<string>;
  editorRef: RefObject<HTMLDivElement | null>;
  className?: string;
  editorStyle?: CSSProperties;
  maxHeight?: CSSProperties["maxHeight"];
  onChange: (value: string) => void;
  onPasteImages: (files: File[]) => void;
  onSubmit: () => void;
  onAtTrigger: () => void;
  onAtClose: () => void;
  onLimit: () => void;
  onCursorChange: (offset: number) => void;
}) {
  const isComposingRef = useRef(false);
  const inputScrollSnapshotRef = useRef<{ wasAtBottom: boolean; scrollTop: number } | null>(null);

  const captureInputScroll = useCallback((element: HTMLElement) => {
    inputScrollSnapshotRef.current = { wasAtBottom: isEditorScrolledToBottom(element), scrollTop: element.scrollTop };
  }, []);

  const restoreInputScroll = useCallback((element: HTMLElement) => {
    const snapshot = inputScrollSnapshotRef.current;
    if (!snapshot) return;

    const apply = () => {
      element.scrollTop = snapshot.wasAtBottom ? element.scrollHeight : snapshot.scrollTop;
    };

    apply();
    requestAnimationFrame(apply);
  }, []);

  const syncEditor = useCallback((nextValue: string, caretOffset?: number) => {
    const element = editorRef.current;
    if (!element) return;

    preserveEditorScroll(element, () => {
      renderEditorContent(element, nextValue, validReferences);
      setSelectionTextOffset(element, caretOffset ?? nextValue.length);
    });
  }, [editorRef, validReferences]);

  const commitInput = useCallback((rawValue: string, caretOffset: number, options?: { syncDom?: boolean }) => {
    if (disabled) return;

    const nextValue = Array.from(rawValue).slice(0, MAX_DRAFT_INPUT_LENGTH).join("");
    const nextCaretOffset = Math.min(caretOffset, nextValue.length);

    if (rawValue !== nextValue) onLimit();

    onCursorChange(nextCaretOffset);
    onChange(nextValue);
    if (options?.syncDom || rawValue !== nextValue) syncEditor(nextValue, nextCaretOffset);

    if (getAtQueryAtCursor(nextValue, nextCaretOffset)) {
      onAtTrigger();
    } else {
      onAtClose();
    }
  }, [disabled, onAtClose, onAtTrigger, onChange, onCursorChange, onLimit, syncEditor]);

  const syncCursorFromDom = useCallback(() => {
    if (disabled) return;
    if (isComposingRef.current) return;

    const element = editorRef.current;
    if (!element) return;
    const cursorOffset = getSelectionTextOffset(element);
    onCursorChange(cursorOffset);
    if (getAtQueryAtCursor(getEditableText(element), cursorOffset)) {
      onAtTrigger();
    } else {
      onAtClose();
    }
  }, [disabled, editorRef, onAtClose, onAtTrigger, onCursorChange]);

  useEffect(() => {
    const element = editorRef.current;
    if (!element) return;
    if (isComposingRef.current) return;
    if (getEditableText(element) === value) return;

    const currentCaretOffset = getSelectionTextOffset(element);
    preserveEditorScroll(element, () => {
      renderEditorContent(element, value, validReferences);
      setSelectionTextOffset(element, Math.min(currentCaretOffset, value.length));
    });
  }, [editorRef, validReferences, value]);

  return (
    <div
      ref={editorRef}
      contentEditable={!disabled}
      role="textbox"
      aria-multiline="true"
      aria-disabled={disabled}
      translate="no"
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
      suppressContentEditableWarning
      onCompositionStart={() => {
        const element = editorRef.current;
        if (element) captureInputScroll(element);
        isComposingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        if (disabled) return;
        isComposingRef.current = false;
        const element = event.currentTarget;
        commitInput(getEditableText(element), getSelectionTextOffset(element));
        restoreInputScroll(element);
      }}
      onBeforeInput={(event) => {
        if (disabled) return;
        captureInputScroll(event.currentTarget);
      }}
      onInput={(event) => {
        if (disabled) return;
        if (isComposingRef.current) return;
        const element = event.currentTarget;
        commitInput(getEditableText(element), getSelectionTextOffset(element));
        restoreInputScroll(element);
      }}
      onPaste={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }

        captureInputScroll(event.currentTarget);

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
        const selectionOffset = getSelectionTextOffset(element);
        const currentText = getEditableText(element);
        const selection = window.getSelection();
        const selectedTextLength = selection?.rangeCount && element.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.getRangeAt(0).toString().length : 0;
        const nextText = `${currentText.slice(0, selectionOffset)}${text}${currentText.slice(selectionOffset + selectedTextLength)}`;
        commitInput(nextText, selectionOffset + text.length, { syncDom: true });
        restoreInputScroll(element);
      }}
      onKeyDown={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }

        captureInputScroll(event.currentTarget);

        if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const element = event.currentTarget;
          const selection = window.getSelection();
          const hasRangeSelection = Boolean(selection?.rangeCount && element.contains(selection.getRangeAt(0).commonAncestorContainer) && selection.getRangeAt(0).toString().length > 0);
          if (!hasRangeSelection) {
            const currentText = getEditableText(element);
            const cursorOffset = getSelectionTextOffset(element);
            const mentionRange = getMentionRangeForDeletion(currentText, cursorOffset, event.key === "Backspace" ? "backward" : "forward", validReferences);
            if (mentionRange) {
              event.preventDefault();
              const nextText = `${currentText.slice(0, mentionRange.start)}${currentText.slice(mentionRange.end)}`;
              commitInput(nextText, mentionRange.start, { syncDom: true });
              restoreInputScroll(element);
              return;
            }
          }
        }

        if (event.key !== "Enter") return;

        event.preventDefault();
        if (!event.shiftKey) {
          onSubmit();
          return;
        }

        const element = event.currentTarget;
        const selectionOffset = getSelectionTextOffset(element);
        const currentText = getEditableText(element);
        commitInput(`${currentText.slice(0, selectionOffset)}\n${currentText.slice(selectionOffset)}`, selectionOffset + 1, { syncDom: true });
        restoreInputScroll(element);
      }}
      onKeyUp={syncCursorFromDom}
      onMouseUp={syncCursorFromDom}
      onFocus={syncCursorFromDom}
      className={`relative z-10 min-h-10 w-full overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent px-2 py-1 text-[14px] leading-6 outline-none selection:bg-[#2f6df6] selection:text-white ${disabled ? "cursor-not-allowed text-[#999999] caret-transparent" : "text-[#111111] caret-[#111111]"} ${className}`}
      style={{ maxHeight, ...editorStyle }}
    />
  );
}

function ReferencedTextContent({ content, references, mediaReferences, onPreviewMedia }: { content: string; references?: ImageReference[]; mediaReferences?: MediaFileReference[]; onPreviewMedia?: (file: UploadedFileEntry) => void }) {
  const safeReferences = references ?? [];
  const safeMediaReferences = mediaReferences ?? [];
  const normalizedContent = content.replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\\t/g, " ");
  const referenceByName = new Map<string, ImageReference | MediaFileReference>();
  safeReferences.forEach((reference) => referenceByName.set(reference.name, reference));
  safeMediaReferences.forEach((reference) => referenceByName.set(reference.name, reference));
  const ranges = getEditorMentionRanges(normalizedContent, new Set(referenceByName.keys()));
  const parts: Array<{ text: string; reference?: ImageReference | MediaFileReference }> = [];
  let cursor = 0;
  ranges.forEach((range) => {
    if (range.start > cursor) parts.push({ text: normalizedContent.slice(cursor, range.start) });
    parts.push({ text: normalizedContent.slice(range.start, range.end), reference: referenceByName.get(range.name) });
    cursor = range.end;
  });
  if (cursor < normalizedContent.length) parts.push({ text: normalizedContent.slice(cursor) });

  return (
    <span className="align-middle">
      {parts.map((part, index) => {
        const reference = part.reference;

        if (!reference) return <span key={`${part.text}-${index}`}>{part.text}</span>;
        if ("mediaKind" in reference) {
          const Icon = reference.mediaKind === "video" ? RiVideoLine : RiMusic2Line;
          return (
            <span key={`${part.text}-${index}`} className="mx-0.5 inline-flex items-center gap-1 align-[-4px] leading-none text-[#4f7cff]">
              <button type="button" onClick={() => onPreviewMedia?.(reference.file)} className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded bg-[#eef3ff] text-[#4f7cff] ring-1 ring-[#dbe5ff] transition hover:bg-white" aria-label={`预览${reference.name}`}>
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="max-w-[180px] truncate leading-[18px]">{part.text}</span>
            </span>
          );
        }

        return (
          <span key={`${part.text}-${index}`} className="mx-0.5 inline-flex items-center gap-1 align-[-3px] leading-none text-[#4f7cff]">
            <HoverImagePreview src={getStaticMediaUrl(reference.url) ?? reference.url} alt={reference.name} wrapperClassName="inline-flex h-[18px] w-[18px] shrink-0 items-center align-middle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getStaticMediaUrl(reference.url) ?? reference.url} alt={reference.name} className="block h-[18px] w-[18px] rounded object-cover" />
            </HoverImagePreview>
            <span className="leading-[18px]">{part.text}</span>
          </span>
        );
      })}
    </span>
  );
}

function UserMessageContent({ content, references, mediaReferences, onPreviewMedia }: { content: string; references?: ImageReference[]; mediaReferences?: MediaFileReference[]; onPreviewMedia?: (file: UploadedFileEntry) => void }) {
  return <ReferencedTextContent content={content} references={references} mediaReferences={mediaReferences} onPreviewMedia={onPreviewMedia} />;
}

function InlineReferenceThumbnails({ references, excludeUrls }: { references?: ImageReference[]; excludeUrls?: Set<string> }) {
  const uniqueReferences: ImageReference[] = [];
  (references ?? []).forEach((reference) => {
    const normalizedUrl = normalizeMediaUrlForMatch(reference.url);
    if (!reference.url || excludeUrls?.has(normalizedUrl) || uniqueReferences.some((item) => normalizeMediaUrlForMatch(item.url) === normalizedUrl)) return;
    uniqueReferences.push(reference);
  });

  if (uniqueReferences.length === 0) return null;

  return (
    <span className="mr-1 inline-flex items-center gap-1 align-[-3px]">
      {uniqueReferences.map((reference, index) => (
        <HoverImagePreview key={`${reference.url}-${index}`} src={getStaticMediaUrl(reference.url) ?? reference.url} alt={reference.name || `参考图${index + 1}`} wrapperClassName="inline-flex h-[18px] w-[18px] shrink-0 items-center align-middle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getStaticMediaUrl(reference.url) ?? reference.url} alt={reference.name || `参考图${index + 1}`} className="block h-[18px] w-[18px] rounded object-cover" />
        </HoverImagePreview>
      ))}
    </span>
  );
}

function ReminderToast({ reminder, fixed = false }: { reminder: ReminderMessage; fixed?: boolean }) {
  const baseClass = fixed
    ? "pointer-events-none fixed left-1/2 top-20 z-[9999] inline-flex h-10 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
    : "pointer-events-none inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]";
  const toneClass = reminder.tone === "success" ? "bg-[#75d06a]" : "bg-[#111111]";
  const animationClass = reminder.exiting ? "yinzao-asset-upload-tip-exit" : "yinzao-asset-upload-tip-enter";

  return (
    <div className={`${baseClass} ${toneClass} ${animationClass}`} data-no-translate={reminder.noTranslate ? "true" : undefined}>
      {reminder.tone === "success" ? <RiCheckboxCircleLine className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{reminder.message}</span>
    </div>
  );
}

function SettingsSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[46px] rounded-full border transition ${checked ? "border-[#367cee] bg-[#367cee]" : "border-[#c8c8c8] bg-[#d7d7d7]"}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full bg-white transition ${checked ? "left-[21px]" : "left-[2px]"}`} />
    </button>
  );
}

function ReferenceThumbnailStrip({ references, onUseReference }: { references?: ImageReference[]; onUseReference: (reference: ImageReference) => void }) {
  if (!references?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap justify-end gap-2">
      {references.map((reference, index) => (
        <button
          key={`${reference.name}-${reference.url}-${index}`}
          type="button"
          onClick={() => onUseReference(reference)}
          className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] text-left"
        >
          <HoverImagePreview src={reference.url} alt={reference.name} wrapperClassName="block h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getMediaThumbnailUrl(reference.url)} alt={reference.name} className="h-full w-full object-cover" />
          </HoverImagePreview>
          <span className="absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-2 text-left font-medium leading-4 text-white">
            <span className="text-[10px] leading-4">@{reference.name}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function UploadedDocumentStrip({ files, onPreview }: { files?: UploadedFileEntry[]; onPreview?: (file: UploadedFileEntry) => void }) {
  if (!files?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap justify-end gap-2">
      {files.map((file, index) => {
        const displayName = getUploadedFileDisplayName(file);
        const meta = getUploadedDocumentMeta(displayName);
        const sizeText = formatUploadedFileSize(file);
        const mediaKind = getUploadedFileMediaKind(file);

        return (
          <button key={`${getUploadedFileKey(file)}-${index}`} type="button" onClick={() => onPreview?.(file)} className="flex h-[54px] w-[200px] shrink-0 items-center gap-3 rounded-[10px] bg-[#f2f2f2] px-4 text-left transition hover:bg-[#ececec]">
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[3px] border-2 text-[15px] font-bold leading-none" style={{ backgroundColor: meta.bg, borderColor: meta.border, color: meta.color }}>
              {mediaKind === "video" ? <RiVideoLine className="h-4 w-4" aria-hidden="true" /> : mediaKind === "audio" ? <RiMusic2Line className="h-4 w-4" aria-hidden="true" /> : meta.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-4 text-[#222222]">{displayName}</div>
              <div className="mt-0.5 truncate text-[11px] leading-4 text-[#9a9a9a]">{meta.label}{sizeText ? ` · ${sizeText}` : ""}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function getDisplayImageReferences(message: Message) {
  if (message.imageReferences?.length) return message.imageReferences;

  return (message.images ?? []).map((url, index) => ({
    name: `图片${index + 1}`,
    url,
  }));
}

function AssetManagementPanel({
  assets,
  assetFilter,
  renderLimit,
  openAssetActionMenuId,
  isLoadingMore,
  onPreview,
  onUseAsset,
  onRename,
  onToggleActionMenu,
  onChangeType,
  onDelete,
  onRestore,
  onOpenUpload,
  onOpenCharacterGenerate,
  onOpenSceneGenerate,
  onOpenShotGenerate,
  onOpenPendingGenerate,
  onDismissGenerateJob,
  pendingAssetGenerateJobs,
  now,
}: {
  assets: AssetItem[];
  assetFilter: AssetFilter;
  renderLimit: number;
  openAssetActionMenuId: string;
  isLoadingMore: boolean;
  onPreview: (asset: AssetItem) => void;
  onUseAsset: (asset: AssetItem) => void;
  onRename: (asset: AssetItem) => void;
  onToggleActionMenu: (assetId: string) => void;
  onChangeType: (assetId: string, target: AssetCategoryTarget) => void;
  onDelete: (assetId: string) => void;
  onRestore: (assetId: string) => void;
  onOpenUpload: () => void;
  onOpenCharacterGenerate: () => void;
  onOpenSceneGenerate: () => void;
  onOpenShotGenerate: () => void;
  onOpenPendingGenerate: (jobId: string) => void;
  onDismissGenerateJob: (jobId: string) => void;
  pendingAssetGenerateJobs: AssetGenerateJob[];
  now: number;
}) {
  const [openAssetMoveMenuId, setOpenAssetMoveMenuId] = useState("");
  const [assetActionMenuPlacement, setAssetActionMenuPlacement] = useState<Record<string, "left" | "right">>({});
  const getAssetActionMenuPlacement = (assetId: string) => assetActionMenuPlacement[assetId] ?? "right";
  const handleAssetActionMenuClick = (event: React.MouseEvent<HTMLButtonElement>, assetId: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    setAssetActionMenuPlacement((current) => ({ ...current, [assetId]: window.innerWidth - rect.right < menuWidth ? "left" : "right" }));
    onToggleActionMenu(assetId);
  };
  const visibleAssets = useMemo(() => assets.filter((asset) => {
    if (isAssetTrashExpired(asset, now)) return false;
    return isAssetInFilter(asset, assetFilter);
  }), [assets, assetFilter, now]);
  const visibleTypes: AssetType[] = assetFilter === "conversation_images" || assetFilter === "conversation_uploads" || assetFilter === "conversation_videos" || assetFilter === "workflow_images" || assetFilter === "workflow_videos" ? assetTypeOrder : [assetFilter];
  const title = assetFilter === "conversation_images" ? "生成图片" : assetFilter === "conversation_uploads" ? "上传图片" : assetFilter === "conversation_videos" ? "生成视频" : assetFilter === "workflow_images" ? "工作流生成图片" : assetFilter === "workflow_videos" ? "工作流生成视频" : assetTypeLabels[assetFilter];
  const canUploadImages = assetFilter === "conversation_uploads";
  const canGenerateImages = assetGenerationTypes.includes(assetFilter as UploadableImageAssetType);
  const emptyText = assetFilter === "conversation_uploads"
    ? "在对话流上传的图片会出现在这里。"
      : assetFilter === "conversation_images"
        ? "对话流生成的图片会出现在这里。"
      : assetFilter === "conversation_videos"
        ? "对话流生成的视频会出现在这里。"
        : assetFilter === "workflow_images"
          ? "工作流生成的图片会出现在这里。"
          : assetFilter === "workflow_videos"
            ? "工作流生成的视频会出现在这里。"
          : assetFilter === "trash"
            ? "删除的资产会出现在这里。"
          : "还没有生成资产。生成角色图、场景图或分镜图后会自动出现在这里。";
  const currentGenerateType = canGenerateImages ? assetFilter as AssetGenerationImageType : undefined;
  const CurrentGenerateIcon = currentGenerateType ? assetTypeIcons[currentGenerateType] : RiImageAddLine;
  const currentGenerateLabel = currentGenerateType === "character_image" ? "角色生成" : currentGenerateType === "scene_image" ? "场景生成" : currentGenerateType === "shot_image" ? "分镜生成" : "生成图片";
  const openCurrentGenerate = () => {
    if (currentGenerateType === "character_image") onOpenCharacterGenerate();
    if (currentGenerateType === "scene_image") onOpenSceneGenerate();
    if (currentGenerateType === "shot_image") onOpenShotGenerate();
  };
  let remainingRenderCount = renderLimit;
  const getRenderableAssets = (typeAssets: AssetItem[]) => {
    const count = Math.max(0, remainingRenderCount);
    const renderableAssets = typeAssets.slice(0, count);
    remainingRenderCount -= renderableAssets.length;
    return renderableAssets;
  };
  const renderAssetGrid = (typeAssets: AssetItem[], variant: "square" | "video-row" = "square", generateButtonType?: AssetGenerationImageType) => {
    const typeJobs = generateButtonType ? pendingAssetGenerateJobs.filter((job) => job.type === generateButtonType && job.result.status !== "idle") : [];
    const jobUrls = new Set(typeJobs.map((job) => job.result.url).filter(Boolean));
    const renderableTypeAssets = typeAssets.filter((asset) => !jobUrls.has(asset.url));

    return (
    <div className={variant === "video-row" ? "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" : "grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"}>
      {generateButtonType ? (
        <button type="button" onClick={generateButtonType === "scene_image" ? onOpenSceneGenerate : generateButtonType === "shot_image" ? onOpenShotGenerate : onOpenCharacterGenerate} className="flex aspect-square flex-col items-center justify-center gap-2 border border-dashed border-[#cfcfcf] bg-[#fafafa] text-[#777777] transition hover:border-[#b8b8b8] hover:bg-[#f5f5f5] hover:text-[#111111]" aria-label={generateButtonType === "scene_image" ? "生成场景图片" : generateButtonType === "shot_image" ? "生成分镜图片" : "生成角色图片"}>
          <RiAddLargeLine className="h-8 w-8" aria-hidden="true" />
          <span className="text-[13px] font-medium leading-none">{generateButtonType === "scene_image" ? "场景生成" : generateButtonType === "shot_image" ? "分镜生成" : "角色生成"}</span>
        </button>
      ) : null}
      {typeJobs.map((job) => job.result.status === "succeeded" && job.result.url ? (() => {
        const asset = assets.find((item) => item.url === job.result.url);
        const name = asset?.name ?? getNextAssetName(job.type, job.prompt, assets, "image");

        return (
          <div key={job.id} className="group relative aspect-square overflow-visible bg-[#f4f4f4]">
            <button type="button" onClick={() => { if (asset) onPreview(asset); }} className="block h-full w-full overflow-hidden bg-[#f4f4f4] text-left">
              <Image src={getMediaThumbnailUrl(job.result.url)} alt={name} width={240} height={240} loading="lazy" unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
            </button>
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/75 to-transparent" />
            {asset ? (
              <button type="button" onClick={(event) => { event.stopPropagation(); onUseAsset(asset); }} className="absolute bottom-2 left-2 max-w-[calc(100%-48px)] truncate px-0 py-0 text-white" aria-label={`插入 @${asset.name}`}>
                <span className="text-[13px] font-medium leading-none">@{asset.name}</span>
              </button>
            ) : (
              <div className="absolute bottom-2 left-2 max-w-[calc(100%-48px)] truncate text-white">
                <span className="text-[13px] font-medium leading-none">@{name}</span>
              </div>
            )}
            {asset ? (
              <div className="absolute bottom-2 right-2" onClick={(event) => event.stopPropagation()}>
                <button type="button" onClick={(event) => handleAssetActionMenuClick(event, asset.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-white transition hover:bg-black/25" aria-label="资产操作">
                  <RiMoreLine className="h-4 w-4" aria-hidden="true" />
                </button>
                {openAssetActionMenuId === asset.id ? (
                  <div className={`absolute bottom-8 z-50 w-32 rounded-xl border border-[#eeeeee] bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)] ${getAssetActionMenuPlacement(asset.id) === "left" ? "right-0" : "left-0"}`}>
                    <button type="button" onClick={() => onRename(asset)} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]">
                      <RiEditBoxLine className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" />
                      <span className="text-[13px] leading-none">重命名</span>
                    </button>
                    <div className="relative" onMouseEnter={() => setOpenAssetMoveMenuId(asset.id)} onMouseLeave={() => setOpenAssetMoveMenuId((current) => (current === asset.id ? "" : current))}>
                      <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]">
                        <RiFolderLine className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-[13px] leading-none">移动到</span>
                        <RiArrowRightSLine className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" />
                      </button>
                      {openAssetMoveMenuId === asset.id ? (
                      <div className={`absolute bottom-0 z-50 w-42 rounded-xl border border-[#eeeeee] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.16)] ${getAssetActionMenuPlacement(asset.id) === "left" ? "right-full mr-1" : "left-full ml-1"}`}>
                        <div className="px-2 pb-1.5 pt-1 text-[12px] font-medium leading-none text-[#9a9a9a]">移动位置</div>
                        {getAssetCategoryTargets(asset).map((target) => {
                          const AssetIcon = assetCategoryTargetIcons[target];
                          const isSelectedTarget = isAssetCategoryTargetSelected(asset, target);

                          return (
                            <button key={target} type="button" onClick={() => onChangeType(asset.id, target)} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]">
                              <AssetIcon className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" />
                              <span className="min-w-0 flex-1 truncate text-[13px] leading-none">{assetCategoryTargetLabels[target]}</span>
                              {isSelectedTarget ? <RiCheckLine className="h-4 w-4" aria-hidden="true" /> : null}
                            </button>
                          );
                        })}
                      </div>
                      ) : null}
                    </div>
                    <button type="button" onClick={() => onDelete(asset.id)} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-red-500 hover:bg-red-50">
                      <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="text-[13px] leading-none">删除</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })() : job.result.status === "failed" ? (
        <div key={job.id} className="flashmuse-failed-media-card relative aspect-square overflow-hidden bg-[#f3f3f3] text-left text-[#777777]" style={{ backgroundColor: "var(--flashmuse-media-surface)" }}>
          <button type="button" onClick={() => onDismissGenerateJob(job.id)} className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-md text-[#999999] transition hover:bg-black/5 hover:text-[#333333]" aria-label="清除失败卡">
            <RiCloseLine className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onOpenPendingGenerate(job.id)} className="block h-full w-full text-left" aria-label="查看生成失败图片">
            <div className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium leading-none text-[#777777]">
              <RiEmotionSadLine className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>图片生成失败</span>
            </div>
            <div className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 text-[13px] font-medium text-[#367cee]">
              <RiResetLeftLine className="h-3.5 w-3.5" aria-hidden="true" />
              <span>查看失败</span>
            </div>
          </button>
        </div>
      ) : (
        <button key={job.id} type="button" onClick={() => onOpenPendingGenerate(job.id)} className="relative aspect-square overflow-hidden bg-[#eaf7ff] text-left text-sm text-[#4f6f86]" aria-label="查看生成中图片">
          <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),radial-gradient(circle_at_86%_82%,rgba(174,247,241,0.5),transparent_31%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
          <div className="absolute -left-20 top-8 h-48 w-48 animate-[yinzaoBlobOne_4.5s_ease-in-out_infinite] rounded-full bg-[#b8c8ff]/45 blur-3xl" />
          <div className="absolute -right-16 bottom-10 h-56 w-56 animate-[yinzaoBlobTwo_6s_ease-in-out_infinite] rounded-full bg-[#9eeef0]/50 blur-3xl" />
          <div className="absolute left-20 top-48 h-40 w-40 animate-[yinzaoBlobThree_5.5s_ease-in-out_infinite] rounded-full bg-[#b5e0ff]/55 blur-3xl" />
          <div className="absolute inset-0 animate-[yinzaoVideoShimmer_2.8s_ease-in-out_infinite] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.22),transparent_28%)]" />
          <div className="absolute left-3 top-3 z-10 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">
            {getVideoWaitProgress(job.result.startedAt, now)}%生成中
          </div>
          <div className="absolute bottom-4 left-5 z-10 text-xs text-[#4f6f86]">
            <div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(job.result.startedAt, now)}</div>
          </div>
        </button>
      ))}
      {renderableTypeAssets.map((asset) => {
        const assetCardPosterUrl = isVideoAsset(asset) ? getAssetCardPosterUrl(asset) : undefined;

        return (
        <div key={asset.id} className={variant === "video-row" ? "group relative aspect-video overflow-visible bg-[#f4f4f4]" : "group relative aspect-square overflow-visible bg-[#f4f4f4]"}>
          <button type="button" onClick={() => onPreview(asset)} className="block h-full w-full overflow-hidden bg-[#f4f4f4] text-left">
            {isVideoAsset(asset) ? (
              assetCardPosterUrl ? <Image src={getMediaThumbnailUrl(assetCardPosterUrl)} alt={asset.name} width={240} height={240} loading="lazy" unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} /> : <div className="flex h-full w-full items-center justify-center bg-[#ededed] text-[#8a8a8a]"><RiFilmLine className="h-8 w-8" aria-hidden="true" /></div>
            ) : (
              <Image src={getAssetCardImageUrl(asset)} alt={asset.name} width={240} height={240} loading="lazy" unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
            )}
          </button>
          {isVideoAsset(asset) ? (
            <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/42 text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-[4px]">
              <RiPlayLargeFill className="ml-0.5 h-6 w-6" aria-hidden="true" />
            </span>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/75 to-transparent" />
          {isVideoAsset(asset) ? (
            <div className="absolute bottom-2 left-2 max-w-[calc(100%-48px)] truncate text-white">
              <span className="text-[13px] font-medium leading-none">{asset.name}</span>
            </div>
          ) : (
            <button type="button" onClick={(event) => { event.stopPropagation(); onUseAsset(asset); }} className="absolute bottom-2 left-2 max-w-[calc(100%-48px)] truncate px-0 py-0 text-white" aria-label={`插入 @${asset.name}`}>
              <span className="text-[13px] font-medium leading-none">@{asset.name}</span>
            </button>
          )}
          <div className="absolute right-1 top-1" onClick={(event) => event.stopPropagation()}>
            {asset.type === "trash" ? (
              <div className="bg-white/45 px-2.5 py-1.5 text-[13px] font-medium leading-none text-red-500 backdrop-blur-sm">
                {getAssetCountdownText(asset, now)}
              </div>
            ) : null}
          </div>
          <div className="absolute bottom-2 right-2" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={(event) => handleAssetActionMenuClick(event, asset.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-white transition hover:bg-black/25" aria-label="资产操作">
              <RiMoreLine className="h-4 w-4" aria-hidden="true" />
            </button>
            {openAssetActionMenuId === asset.id ? (
              <div className={`absolute bottom-8 z-50 w-32 rounded-xl border border-[#eeeeee] bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)] ${getAssetActionMenuPlacement(asset.id) === "left" ? "right-0" : "left-0"}`}>
                <button type="button" onClick={() => onRename(asset)} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]">
                  <RiEditBoxLine className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" />
                  <span className="text-[13px] leading-none">重命名</span>
                </button>
                {!isVideoAsset(asset) && asset.type !== "trash" ? (
                  <div className="relative" onMouseEnter={() => setOpenAssetMoveMenuId(asset.id)} onMouseLeave={() => setOpenAssetMoveMenuId((current) => (current === asset.id ? "" : current))}>
                    <button type="button" className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]">
                      <RiFolderLine className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[13px] leading-none">移动到</span>
                      <RiArrowRightSLine className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" />
                    </button>
                    {openAssetMoveMenuId === asset.id ? (
                    <div className={`absolute bottom-0 z-50 w-42 rounded-xl border border-[#eeeeee] bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.16)] ${getAssetActionMenuPlacement(asset.id) === "left" ? "right-full mr-1" : "left-full ml-1"}`}>
                      <div className="px-2 pb-1.5 pt-1 text-[12px] font-medium leading-none text-[#9a9a9a]">移动位置</div>
                      {getAssetCategoryTargets(asset).map((target) => {
                        const AssetIcon = assetCategoryTargetIcons[target];
                        const isSelectedTarget = isAssetCategoryTargetSelected(asset, target);

                        return (
                          <button key={target} type="button" onClick={() => onChangeType(asset.id, target)} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]">
                            <AssetIcon className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-[13px] leading-none">{assetCategoryTargetLabels[target]}</span>
                            {isSelectedTarget ? <RiCheckLine className="h-4 w-4" aria-hidden="true" /> : null}
                          </button>
                        );
                      })}
                    </div>
                    ) : null}
                  </div>
                ) : null}
                <button type="button" onClick={() => (asset.type === "trash" ? onRestore(asset.id) : onDelete(asset.id))} className={asset.type === "trash" ? "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]" : "flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-red-500 hover:bg-red-50"}>
                  {asset.type === "trash" ? <RiResetRightLine className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" /> : <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  <span className="text-[13px] leading-none">{asset.type === "trash" ? "恢复" : "删除"}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
        );
      })}
    </div>
  );
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-2">
      <div className="min-h-[64px]">
        <div className="flex h-8 items-center justify-between gap-4">
          <div className="text-[26px] font-semibold tracking-[-0.02em] text-[#111111]">{title}</div>
          <div className="flex shrink-0 items-center gap-4">
            {canGenerateImages ? (
              <button type="button" onClick={openCurrentGenerate} className="inline-flex h-8 shrink-0 items-center gap-1.5 bg-transparent px-0 py-0 font-medium leading-none text-[#777777] transition hover:text-[#111111]" aria-label={currentGenerateLabel}>
                <CurrentGenerateIcon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="text-[13px] leading-none">{currentGenerateLabel}</span>
              </button>
            ) : null}
            {canUploadImages ? (
              <button type="button" onClick={onOpenUpload} className="inline-flex h-8 shrink-0 items-center gap-1.5 bg-transparent px-0 py-0 font-medium leading-none text-[#367cee] transition hover:text-[#255fc3]" aria-label="上传图片">
                <RiUpload2Line className="h-4 w-4" aria-hidden="true" />
                <span className="text-[13px] leading-none">上传图片</span>
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-2 min-h-6 text-sm leading-6 text-red-500">
          {assetFilter === "trash" ? "回收站中的内容将在30天后删除，不可恢复。" : null}
        </div>
      </div>

      {visibleAssets.length === 0 && assetFilter !== "character_image" && assetFilter !== "scene_image" && assetFilter !== "shot_image" ? (
        <div className="rounded-2xl border border-dashed border-[#d8d8d8] bg-[#fafafa] px-6 py-12 text-center text-sm text-[#8a8a8a]">{emptyText}</div>
      ) : assetFilter === "conversation_images" || assetFilter === "conversation_uploads" || assetFilter === "conversation_videos" || assetFilter === "workflow_images" || assetFilter === "workflow_videos" ? (
        renderAssetGrid(getRenderableAssets(visibleAssets), assetFilter === "conversation_videos" || assetFilter === "workflow_videos" ? "video-row" : "square")
      ) : assetFilter === "character_image" ? (
        renderAssetGrid(getRenderableAssets(visibleAssets), "square", "character_image")
      ) : assetFilter === "scene_image" ? (
        renderAssetGrid(getRenderableAssets(visibleAssets), "square", "scene_image")
      ) : assetFilter === "shot_image" ? (
        renderAssetGrid(getRenderableAssets(visibleAssets), "square", "shot_image")
      ) : (
        visibleTypes.some((type) => visibleAssets.some((asset) => asset.type === type)) ? visibleTypes.map((type) => {
          const typeAssets = visibleAssets.filter((asset) => asset.type === type);
          if (typeAssets.length === 0) return null;

          if (type === "other") {
            const imageAssets = typeAssets.filter((asset) => !isVideoAsset(asset));
            const videoAssets = typeAssets.filter(isVideoAsset);
            const renderableImageAssets = getRenderableAssets(imageAssets);
            const renderableVideoAssets = getRenderableAssets(videoAssets);

            return (
              <section key={type} className="space-y-6">
                {renderableImageAssets.length > 0 ? (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[15px] font-semibold text-[#111111]">待分类图片</div>
                      <div className="text-xs text-[#9a9a9a]">{imageAssets.length} 个</div>
                    </div>
                    {renderAssetGrid(renderableImageAssets)}
                  </div>
                ) : null}
                {renderableVideoAssets.length > 0 ? (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-[15px] font-semibold text-[#111111]">待分类视频</div>
                      <div className="text-xs text-[#9a9a9a]">{videoAssets.length} 个</div>
                    </div>
                    {renderAssetGrid(renderableVideoAssets)}
                  </div>
                ) : null}
              </section>
            );
          }
          const renderableTypeAssets = getRenderableAssets(typeAssets);
          if (renderableTypeAssets.length === 0) return null;

          return (
            <section key={type}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[15px] font-semibold text-[#111111]">{assetTypeLabels[type]}</div>
                <div className="text-xs text-[#9a9a9a]">{typeAssets.length} 个</div>
              </div>
              {renderAssetGrid(renderableTypeAssets)}
            </section>
          );
        }) : <div className="flex min-h-[280px] items-center justify-center text-sm text-[#a0a0a0]">当前没有内容</div>
      )}
      {isLoadingMore ? <div className="py-4 text-center text-[13px] text-[#8a8a8a]">正在加载中...</div> : null}
    </div>
  );
}

function AssetUploadDialog({
  slots,
  activeIndex,
  isUploading,
  tip,
  onClose,
  onSelectSlot,
  onSelectFiles,
  onRemoveSlot,
  onRetrySlot,
  onChangeName,
  onRestoreEmptyName,
  onClearName,
  onSubmit,
}: {
  slots: AssetUploadSlot[];
  activeIndex: number;
  isUploading: boolean;
  tip?: ReminderMessage;
  onClose: () => void;
  onSelectSlot: (index: number) => void;
  onSelectFiles: (files: File[]) => void;
  onRemoveSlot: (index: number) => void;
  onRetrySlot: (index: number) => void;
  onChangeName: (value: string) => void;
  onRestoreEmptyName: () => void;
  onClearName: () => void;
  onSubmit: () => void;
}) {
  const filledSlots = slots.map((slot, index) => ({ slot, index })).filter((item) => item.slot.dataUrl);
  const activeSlot = slots[activeIndex]?.dataUrl ? slots[activeIndex] : filledSlots[0]?.slot;
  const hasImages = filledSlots.length > 0;
  const hasPendingUpload = filledSlots.some((item) => item.slot.uploadStatus === "uploading");
  const hasReadyUpload = filledSlots.some((item) => item.slot.dataUrl && item.slot.uploadStatus === "ready" && item.slot.tempToken);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overscroll-contain bg-black/35 px-4">
      <div className="mb-3 h-8">
        {tip ? (
          <ReminderToast reminder={tip} />
        ) : null}
      </div>
      <div className="relative flex min-h-[560px] w-full max-w-[420px] flex-col rounded-2xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
        <button type="button" onClick={onClose} disabled={isUploading} className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#111111] text-white transition hover:bg-[#252525] disabled:pointer-events-none disabled:opacity-40" aria-label="关闭上传图片弹窗">
          <RiCloseLine className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="text-[15px] font-semibold text-[#111111]">上传图片</div>
        <div className="mt-1 text-[12px] leading-5 text-[#8a8a8a]">最多同时上传八张图片。所有上传图片都会保存到上传图片分类。</div>

        <div className="mt-5 grid w-max grid-cols-4 justify-start gap-2">
          {filledSlots.map(({ slot, index }) => {
            const isActive = index === activeIndex;

            return (
              <div key={slot.id} className="space-y-2">
                  <div className={`relative h-[80px] w-[80px] overflow-hidden border bg-[#f8f8f8] transition ${slot.isDuplicate ? "border-red-500" : isActive ? "border-[#367cee]" : "border-[#e1e1e1] hover:border-[#bdbdbd]"}`}>
                    <button type="button" onClick={() => onSelectSlot(index)} className="relative block h-full w-full" aria-label={`选择第 ${index + 1} 张图片`}>
                      <Image src={slot.dataUrl} alt={slot.fileName || "上传图片"} fill sizes="80px" unoptimized className="object-contain" />
                      {slot.dimensions ? (
                        <span className="absolute inset-x-0 bottom-0 flex h-6 items-end justify-center bg-gradient-to-t from-black/75 to-transparent pb-1 text-[9px] font-medium leading-none text-white">
                          {slot.dimensions.width} x {slot.dimensions.height}
                        </span>
                      ) : null}
                    </button>
                    {slot.uploadStatus === "uploading" ? <UploadProgressOverlay progress={slot.uploadProgress} /> : null}
                    {slot.uploadStatus === "error" ? (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-black/58 px-2 text-center text-[13px] font-semibold leading-4 text-white">
                        <span>上传失败</span>
                        {slot.uploadFile ? (
                          <button type="button" onClick={() => onRetrySlot(index)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#75a7ff] transition hover:text-[#a9c8ff]">
                            <RiRefreshLine className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>重试</span>
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <button type="button" onClick={() => onRemoveSlot(index)} className="absolute right-0.5 top-0.5 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[6px] transition hover:bg-black/62" aria-label="移除图片">
                      <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
              </div>
            );
          })}
          {filledSlots.length < ASSET_UPLOAD_SLOT_COUNT ? (
            <label className="flex h-[80px] w-[80px] cursor-pointer items-center justify-center border border-dashed border-[#cfcfcf] bg-[#fbfbfb] transition hover:border-[#367cee]/70">
              <input type="file" accept="image/*" multiple className="hidden" disabled={isUploading} onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.currentTarget.value = "";
                if (files.length > 0) onSelectFiles(files);
              }} />
              <RiAddLine className="h-7 w-7 text-[#9a9a9a]" aria-hidden="true" />
            </label>
          ) : null}
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-[12px] font-medium leading-none text-[#777777]">文件名(支持改名)</label>
          <div className="relative">
            <input
              value={activeSlot?.fileName ?? ""}
              onChange={(event) => onChangeName(event.target.value)}
              onBlur={onRestoreEmptyName}
              disabled={!activeSlot?.dataUrl || isUploading}
              placeholder="请先选择图片"
              className="h-10 w-full rounded-lg border border-[#e3e3e3] px-3 pr-11 text-[13px] text-[#111111] outline-none transition placeholder:text-[#b5b5b5] hover:border-[#cfcfcf] focus:border-[#367cee] disabled:bg-[#f7f7f7] disabled:text-[#b0b0b0]"
            />
            {activeSlot?.dataUrl ? (
              <button type="button" onClick={onClearName} disabled={isUploading} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-[#eeeeee] text-[#777777] transition hover:bg-[#e2e2e2] hover:text-[#333333] disabled:pointer-events-none disabled:opacity-50" aria-label="清除文件名">
                <RiCloseLine className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-auto flex justify-end gap-2 pt-6">
          <button type="button" onClick={onClose} disabled={isUploading} className="h-9 w-20 rounded-lg border border-[#e0e0e0] px-4 text-[13px] font-medium text-[#777777] transition hover:bg-[#f7f7f7] disabled:pointer-events-none disabled:opacity-50">
            取消
          </button>
          <button type="button" onClick={onSubmit} disabled={!hasReadyUpload || isUploading || hasPendingUpload} className="h-9 min-w-20 rounded-lg bg-[#111111] px-4 text-[13px] font-medium text-white transition hover:bg-[#252525] disabled:cursor-not-allowed disabled:bg-[#d7d7d7]">
            {isUploading ? "保存中..." : hasPendingUpload ? "上传中..." : "确定上传"}
          </button>
        </div>
      </div>
    </div>
  );
}

async function readJson<T>(response: Response): Promise<T & { error?: ApiError }> {
  let data: T & { error?: ApiError };

  try {
    data = (await response.json()) as T & { error?: ApiError };
  } catch {
    const text = await response.text().catch(() => "");
    if (response.status === 413 || /Request Entity Too Large/i.test(text)) {
      throw new Error(toUserErrorMessage(text));
    }
    throw new Error(toUserErrorMessage(text));
  }

  if (!response.ok) {
    const error = typeof data.error === "string" ? data.error : data.error?.message;
    if (response.status === 413 || /413|Request Entity Too Large/i.test(error ?? "")) {
      throw new Error(toUserErrorMessage(error));
    }
    throw new Error(toUserErrorMessage(error));
  }

  return data;
}

function resultErrorMessage(results: PromiseSettledResult<unknown>[]) {
  const rejected = results.find((result) => result.status === "rejected");
  if (!rejected) return undefined;

  return toUserErrorMessage(rejected.reason);
}

function mediaFailureMessage(results: PromiseSettledResult<unknown>[], failureCount: number, fallback: string) {
  const reason = resultErrorMessage(results);
  if (failureCount <= 0) return undefined;
  if (reason) return reason;
  return fallback;
}

function mediaFailureReasons(results: PromiseSettledResult<unknown>[], fallback: string) {
  return results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => toUserErrorMessage(result.reason, fallback));
}

function UploadProgressOverlay({ progress }: { progress?: number }) {
  const value = Math.min(100, Math.max(0, Math.floor(progress ?? 0)));
  const degrees = value * 3.6;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `conic-gradient(#367cee ${degrees}deg, rgba(255,255,255,0.26) 0deg)` }}>
        <div className="absolute inset-[4px] rounded-full bg-black/62" />
        <span className="relative text-[11px] font-semibold leading-none text-white">{value}%</span>
      </div>
    </div>
  );
}

function normalizeMediaErrorText(error: string | undefined, mode: WorkMode | undefined) {
  if (!error) return undefined;
  const imageMatch = error.match(/^有\s*\d+\s*张图片生成失败[：:]\s*(.+)$/);
  if (imageMatch?.[1]) return imageMatch[1];
  const videoMatch = error.match(/^有\s*\d+\s*个视频生成失败[：:]\s*(.+)$/);
  if (videoMatch?.[1]) return videoMatch[1];
  if (/^有\s*\d+\s*张图片生成失败/.test(error)) return GENERIC_MEDIA_ERROR_MESSAGE;
  if (/^有\s*\d+\s*个视频生成失败/.test(error)) return GENERIC_MEDIA_ERROR_MESSAGE;
  if (mode === "image" && /平台服务临时异常|500|internal server error/i.test(error)) return "平台服务临时异常，请稍后重试。";
  return error;
}

async function persistUploadedImagesForSend(images: UploadedImage[]) {
  return Promise.all(
    images.map(async (image) => {
      if (image.tempToken) {
        const url = await commitTemporaryAssetImage(image.tempToken);
        return { ...image, url, tempToken: undefined, uploadStatus: "ready" as const, uploadProgress: 100 };
      }
      if (!image.url.startsWith("data:")) return image;

      const response = await fetch("/api/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: image.url }),
      });
      const data = await readJson<{ url?: string }>(response);

      return data.url ? { ...image, url: data.url } : image;
    }),
  );
}

function getMessageType(message: Message): "text" | "image" | "video" {
  if (message.videoUrl || (message.videos?.length ?? 0) > 0) return "video";
  if (message.images?.length) return "image";
  return "text";
}

function LazyMediaMount({ children, height, className = "" }: { children: ReactNode; height: number; className?: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) return;
    const element = rootRef.current;
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldRender(true);
        observer.disconnect();
      }
    }, { rootMargin: "900px 0px" });

    observer.observe(element);
    return () => observer.disconnect();
  }, [shouldRender]);

  return <div ref={rootRef} className={className} style={shouldRender ? undefined : { minHeight: height }}>{shouldRender ? children : null}</div>;
}

function InlineVideoResult({ url, posterUrl, onPreview, onLoadedDimensions, rounded = false, compact = false }: { url: string; posterUrl?: string; onPreview: () => void; onLoadedDimensions?: (dimensions: ImageDimensions) => void; rounded?: boolean; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(!posterUrl);
  const [isHovering, setIsHovering] = useState(false);
  const mediaSurfaceStyle = { backgroundColor: "var(--flashmuse-media-surface)" } as CSSProperties;
  const displayUrl = getStaticMediaUrl(url) ?? url;
  const displayPosterUrl = getStaticMediaUrl(posterUrl, videoPosterVersion) ?? posterUrl;

  useEffect(() => {
    if (!shouldLoadVideo || !isHovering) return;
    void videoRef.current?.play().catch(() => undefined);
  }, [isHovering, shouldLoadVideo]);

  const playVideo = () => {
    setIsHovering(true);
    setShouldLoadVideo(true);
    void videoRef.current?.play().catch(() => undefined);
  };

  const pauseVideo = () => {
    setIsHovering(false);
    videoRef.current?.pause();
  };

  return (
    <button type="button" onClick={onPreview} className={`flashmuse-success-media-card flex h-[360px] ${compact ? "w-full" : "w-[640px]"} max-w-full items-center justify-center overflow-hidden bg-[#f4f4f4] text-left ${rounded ? "rounded-[10px]" : ""}`} style={mediaSurfaceStyle}>
      {displayPosterUrl && !shouldLoadVideo ? (
        <span onMouseEnter={playVideo} onFocus={playVideo} className="relative flex h-full w-full items-center justify-center">
          <Image src={displayPosterUrl} alt="视频封面" fill sizes={compact ? "50vw" : "640px"} unoptimized className="object-contain" />
          <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/42 text-white shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-[4px]">
            <RiPlayLargeFill className="ml-0.5 h-7 w-7" aria-hidden="true" />
          </span>
        </span>
      ) : (
        <video
          ref={videoRef}
          src={displayUrl}
          poster={displayPosterUrl}
          className="block max-h-full max-w-full object-contain"
          controls
          loop
          playsInline
          preload={displayPosterUrl ? "none" : "metadata"}
          onMouseEnter={playVideo}
          onMouseLeave={pauseVideo}
          onFocus={playVideo}
          onBlur={pauseVideo}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (video.videoWidth && video.videoHeight) onLoadedDimensions?.({ width: video.videoWidth, height: video.videoHeight });
            if (isHovering) void video.play().catch(() => undefined);
          }}
        />
      )}
    </button>
  );
}

function ImageResultThumb({ url, imageIndex, onPreview, onLoadedDimensions, rounded = false }: { url: string; imageIndex: number; onPreview: (url: string, index: number) => void; onLoadedDimensions?: (url: string, dimensions: ImageDimensions) => void; rounded?: boolean }) {
  const [loadedUrl, setLoadedUrl] = useState("");
  const [failedThumbnailUrl, setFailedThumbnailUrl] = useState("");
  const mediaSurfaceStyle = { backgroundColor: "var(--flashmuse-media-surface)" } as CSSProperties;
  const useOriginalImage = failedThumbnailUrl === url;
  const displayUrl = useOriginalImage ? getStaticMediaUrl(url) ?? url : getMediaThumbnailUrl(url);
  const isLoaded = loadedUrl === displayUrl;

  return (
    <button
      type="button"
      onClick={() => onPreview(url, imageIndex)}
      className={`flashmuse-success-media-card group relative flex h-[250px] w-[250px] shrink-0 items-center justify-center overflow-hidden bg-[#f4f4f4] transition ${rounded ? "rounded-[10px]" : ""}`}
      style={mediaSurfaceStyle}
    >
      {!isLoaded ? (
        <div className="absolute left-4 top-4 z-10 inline-flex items-center text-[13px] font-medium leading-none text-[#777777]">
          <span>正在加载中</span>
          <InlineLoadingDots />
        </div>
      ) : null}
      <Image
        src={displayUrl}
        alt="生成图片"
        fill
        unoptimized
        loading="lazy"
        sizes="250px"
        className="object-contain transition group-hover:scale-[1.02]"
        onLoad={(event) => {
          setLoadedUrl(displayUrl);
          if (!useOriginalImage && displayUrl !== url) return;
          const image = event.currentTarget;
          if (image.naturalWidth && image.naturalHeight) onLoadedDimensions?.(url, { width: image.naturalWidth, height: image.naturalHeight });
        }}
        onError={() => {
          if (useOriginalImage) return;
          setFailedThumbnailUrl(url);
          setLoadedUrl("");
        }}
      />
    </button>
  );
}

function ImageResultStrip({ images, imageIndexes, pendingCount, failedCount, retryingFailedIndexes = [], retryingFailedStartedAt = {}, createdAt, now, onPreview, onLoadedDimensions, rounded = false, onRetryFailed }: { images: string[]; imageIndexes?: number[]; pendingCount: number; failedCount: number; retryingFailedIndexes?: number[]; retryingFailedStartedAt?: Record<number, number>; createdAt?: number; now: number; onPreview: (url: string, index: number) => void; onLoadedDimensions?: (url: string, dimensions: ImageDimensions) => void; rounded?: boolean; onRetryFailed?: (failedIndex: number) => void }) {
  if (images.length + pendingCount + failedCount === 0) return null;
  const items = [
    ...images.map((url, imageIndex) => ({ type: "image" as const, url, imageIndex: imageIndexes?.[imageIndex] ?? imageIndex })),
    ...Array.from({ length: pendingCount }).map((_, pendingIndex) => ({ type: "pending" as const, pendingIndex })),
    ...Array.from({ length: failedCount }).map((_, failedIndex) => ({ type: "failed" as const, failedIndex })),
  ];

  return (
    <div className="relative max-w-full pb-1">
      <div className="grid grid-cols-4 gap-0.5">
        {items.map((item) => {
          if (item.type === "image") {
            return <ImageResultThumb key={`${item.url}-${item.imageIndex}`} url={item.url} imageIndex={item.imageIndex} onPreview={onPreview} onLoadedDimensions={onLoadedDimensions} rounded={rounded} />;
          }

          if (item.type === "pending") {
            return <MediaWaitingCard key={`pending-${item.pendingIndex}`} createdAt={createdAt} now={now} isImage index={images.length + item.pendingIndex + 1} rounded={rounded} />;
          }

          if (retryingFailedIndexes.includes(item.failedIndex)) {
            return <MediaWaitingCard key={`retrying-failed-${item.failedIndex}`} createdAt={retryingFailedStartedAt[item.failedIndex] ?? createdAt} now={now} isImage index={images.length + pendingCount + item.failedIndex + 1} rounded={rounded} />;
          }

          return (
            <div key={`failed-${item.failedIndex}`} className={`flashmuse-failed-media-card relative h-[250px] w-[250px] shrink-0 overflow-hidden bg-[#f4f4f4] text-[#777777] ${rounded ? "rounded-[10px]" : ""}`} style={{ backgroundColor: "var(--flashmuse-media-surface)" }}>
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium leading-none text-[#777777]">
                <RiEmotionSadLine className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>图片生成失败</span>
              </div>
              {onRetryFailed ? (
                <button type="button" onClick={() => onRetryFailed(item.failedIndex)} className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 bg-transparent text-[10px] font-medium text-[#367cee] transition hover:text-[#2568d8]">
                  <RiResetLeftLine className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-[14px] leading-none">重新生成</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImageResultSlotStrip({ slots, imageIndexes, pendingCount, createdAt, now, onPreview, onLoadedDimensions, rounded = false, onRetryFailed, isRetrying = false }: { slots: ImageResultSlot[]; imageIndexes?: number[]; pendingCount: number; createdAt?: number; now: number; onPreview: (url: string, index: number) => void; onLoadedDimensions?: (url: string, dimensions: ImageDimensions) => void; rounded?: boolean; onRetryFailed?: (failedIndex: number) => void; isRetrying?: boolean }) {
  if (slots.length + pendingCount === 0) return null;
  const items = [
    ...slots.map((slot, slotIndex) => ({ type: "slot" as const, slot, slotIndex })),
    ...Array.from({ length: pendingCount }).map((_, pendingIndex) => ({ type: "pending" as const, pendingIndex })),
  ];

  return (
    <div className="relative max-w-full pb-1">
      <div className="grid grid-cols-4 gap-0.5">
        {items.map((item) => {
          if (item.type === "pending") {
            return <MediaWaitingCard key={`pending-${item.pendingIndex}`} createdAt={createdAt} now={now} isImage index={slots.length + item.pendingIndex + 1} rounded={rounded} />;
          }

          if (item.slot.type === "pending") {
            return <MediaWaitingCard key={`slot-pending-${item.slotIndex}`} createdAt={item.slot.startedAt ?? createdAt} now={now} isImage index={item.slotIndex + 1} rounded={rounded} />;
          }

          if (item.slot.type === "image") {
            const imageOrdinal = slots.slice(0, item.slotIndex + 1).filter((slot) => slot.type === "image").length - 1;
            return <ImageResultThumb key={`${item.slot.url}-${item.slotIndex}`} url={item.slot.url} imageIndex={imageIndexes?.[imageOrdinal] ?? imageOrdinal} onPreview={onPreview} onLoadedDimensions={onLoadedDimensions} rounded={rounded} />;
          }

          const failedIndex = slots.slice(0, item.slotIndex + 1).filter((slot) => slot.type === "failed").length - 1;
          if (isRetrying && item.slot.retryingStartedAt) {
            return <MediaWaitingCard key={`retrying-failed-${item.slotIndex}`} createdAt={item.slot.retryingStartedAt} now={now} isImage index={item.slotIndex + 1} rounded={rounded} />;
          }

          return (
            <div key={`failed-${item.slotIndex}`} className={`flashmuse-failed-media-card relative h-[250px] w-[250px] shrink-0 overflow-hidden bg-[#f4f4f4] text-[#777777] ${rounded ? "rounded-[10px]" : ""}`} style={{ backgroundColor: "var(--flashmuse-media-surface)" }}>
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium leading-none text-[#777777]">
                <RiEmotionSadLine className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>图片生成失败</span>
              </div>
              {onRetryFailed ? (
                <button type="button" onClick={() => onRetryFailed(failedIndex)} className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 bg-transparent text-[10px] font-medium text-[#367cee] transition hover:text-[#2568d8]">
                  <RiResetLeftLine className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-[14px] leading-none">重新生成</span>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VideoFailedCard({ rounded = false, compact = false, onRetry }: { rounded?: boolean; compact?: boolean; onRetry?: () => void }) {
  return (
    <div className={`flashmuse-failed-media-card relative h-[360px] ${compact ? "w-full" : "w-[640px]"} max-w-full overflow-hidden bg-[#f4f4f4] text-[#777777] ${rounded ? "rounded-[10px]" : ""}`} style={{ backgroundColor: "var(--flashmuse-media-surface)" }}>
      <div className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium leading-none text-[#777777]">
        <RiEmotionSadLine className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>视频生成失败</span>
      </div>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 bg-transparent text-[10px] font-medium text-[#367cee] transition hover:text-[#2568d8]">
          <RiResetLeftLine className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-[14px] leading-none">重新生成</span>
        </button>
      ) : null}
    </div>
  );
}

function MediaWaitingCard({ createdAt, now, isImage, index, rounded = false, compactVideo = false }: { createdAt?: number; now: number; isImage: boolean; index?: number; rounded?: boolean; compactVideo?: boolean }) {
  return (
    <div className={`flashmuse-media-card ${isImage ? "relative h-[250px] w-[250px] shrink-0 overflow-hidden bg-[#eaf7ff] text-sm text-[#4f6f86]" : `relative h-[360px] ${compactVideo ? "w-full" : "w-[640px]"} max-w-full overflow-hidden bg-[#eaf7ff] text-sm text-[#4f6f86]`} ${rounded ? "rounded-[10px]" : ""}`}>
      <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),radial-gradient(circle_at_86%_82%,rgba(174,247,241,0.5),transparent_31%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
      <div className="absolute -left-20 top-8 h-48 w-48 animate-[yinzaoBlobOne_4.5s_ease-in-out_infinite] rounded-full bg-[#b8c8ff]/45 blur-3xl" />
      <div className="absolute -right-16 bottom-10 h-56 w-56 animate-[yinzaoBlobTwo_6s_ease-in-out_infinite] rounded-full bg-[#9eeef0]/50 blur-3xl" />
      <div className="absolute left-20 top-48 h-40 w-40 animate-[yinzaoBlobThree_5.5s_ease-in-out_infinite] rounded-full bg-[#b5e0ff]/55 blur-3xl" />
      <div className="absolute inset-0 animate-[yinzaoVideoShimmer_2.8s_ease-in-out_infinite] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.22),transparent_28%)]" />
      <div className="relative z-10 ml-3 mt-3 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">
        {getVideoWaitProgress(createdAt, now, index ?? 0)}%{isImage ? "生成中" : "渲染中"}{index ? ` ${index}` : ""}
      </div>
      <div className="absolute bottom-4 left-5 z-10 text-xs text-[#4f6f86]">
        <div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(createdAt, now)}</div>
      </div>
    </div>
  );
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败"));
    image.src = src;
  });
}

async function compressImageForGeneration(url: string, maxSide: number, quality: number) {
  const image = await loadImageElement(url);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return url;

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

async function compressReferenceImagesForRetry(urls: string[] = [], maxSide: number, quality: number) {
  return Promise.all(
    urls.map(async (url) => {
      try {
        return await compressImageForGeneration(url, maxSide, quality);
      } catch {
        return url;
      }
    }),
  );
}

async function toPromptPreviewPayloadMessages(messages: ChatPayloadMessage[]) {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      images: message.images?.length ? await compressReferenceImagesForRetry(message.images, PROMPT_PREVIEW_IMAGE_SIDE, PROMPT_PREVIEW_IMAGE_QUALITY) : undefined,
    })),
  );
}

function isRequestTooLargeError(message: string) {
  return /413|Request Entity Too Large/i.test(message);
}

async function readFileAsUploadedImage(file: File): Promise<UploadedImage> {
  const dataUrl = await readBlobAsDataUrl(file);
  return {
    id: createClientId(),
    name: file.name || "粘贴图片",
    referenceName: getUploadedReferenceBaseName(file.name || "粘贴图片"),
    source: "upload",
    url: dataUrl,
    previewUrl: dataUrl,
    uploadFile: file,
    uploadStatus: "uploading",
    uploadProgress: 6,
  };
}

async function readFileAsAssetUploadItem(file: File) {
  return { fileName: getUploadedReferenceBaseName(file.name), dataUrl: await readBlobAsDataUrl(file), file };
}

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isReadableDocumentFile(file: File | string) {
  const fileName = typeof file === "string" ? file : file.name;
  return readableDocumentExtensions.includes(getFileExtension(fileName));
}

function getUploadedFileMediaKind(file: UploadedFileEntry): "document" | "video" | "audio" {
  if (typeof file !== "string" && file.mediaKind) return file.mediaKind;
  const extension = getFileExtension(getUploadedFileDisplayName(file));
  if (["mp4", "mov"].includes(extension)) return "video";
  if (["mp3", "wav"].includes(extension)) return "audio";
  return "document";
}

function isUploadedMediaFile(file: UploadedFileEntry) {
  const kind = getUploadedFileMediaKind(file);
  return kind === "video" || kind === "audio";
}

function getUploadedMediaFileUrl(file: UploadedFileEntry) {
  return typeof file === "string" ? "" : file.url ?? "";
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

function getUploadedDocumentMeta(fileName: string) {
  const extension = getFileExtension(fileName);
  if (extension === "mp4" || extension === "mov") return { label: "视频", icon: "V", color: "#7c3aed", border: "#c4b5fd", bg: "#f1ebff" };
  if (extension === "mp3" || extension === "wav") return { label: "音频", icon: "A", color: "#0f766e", border: "#8bd6cb", bg: "#e5f7f4" };
  if (extension === "doc" || extension === "docx") return { label: "Word", icon: "W", color: "#1f65d6", border: "#8bb8ff", bg: "#e3efff" };
  if (extension === "ppt" || extension === "pptx") return { label: "PPT", icon: "P", color: "#d84324", border: "#ffa895", bg: "#ffe8e1" };
  if (extension === "xls" || extension === "xlsx" || extension === "csv") return { label: "Excel", icon: "X", color: "#238445", border: "#87c99b", bg: "#e4f4e9" };
  if (extension === "pdf") return { label: "PDF", icon: "P", color: "#d22f27", border: "#f39b96", bg: "#ffe7e6" };
  if (extension === "md") return { label: "Markdown", icon: "M", color: "#4b5563", border: "#b9c0ca", bg: "#eceff3" };
  if (extension === "txt") return { label: "txt", icon: "T", color: "#526173", border: "#b7c2d1", bg: "#e8edf4" };
  return { label: extension || "文件", icon: "F", color: "#526173", border: "#b7c2d1", bg: "#e8edf4" };
}

function getUploadedFileKey(file: UploadedFileEntry) {
  return typeof file === "string" ? file : file.id;
}

function formatUploadedFileSize(file: UploadedFileEntry) {
  if (typeof file !== "string") return formatFileSize(file.size);
  const fileName = file;
  const match = fileName.match(/\s·\s([^·]+)$/);
  return match?.[1] ?? "";
}

function getUploadedFileDisplayName(file: UploadedFileEntry) {
  if (typeof file !== "string") return file.name;
  const fileName = file;
  return fileName.replace(/\s·\s[^·]+$/, "");
}

function getUploadedFileStorageValue(file: UploadedFileEntry) {
  return typeof file === "string" ? file : file.storageName;
}

function getUploadedFilePreviewText(file: UploadedFileEntry) {
  return typeof file === "string" ? "" : file.text?.trim() ?? "";
}

function getMediaDurationLabel(seconds?: number) {
  if (!Number.isFinite(seconds ?? Number.NaN) || !seconds) return "";
  return `${Math.round(seconds * 10) / 10}s`;
}

function getUploadedMediaDuration(file: UploadedFileEntry) {
  return typeof file === "string" ? 0 : Math.max(0, file.durationSeconds ?? 0);
}

function validateMediaDuration(kindLabel: string, durationSeconds: number | undefined, rule: { minSeconds?: number; maxSeconds?: number }) {
  if (!Number.isFinite(durationSeconds ?? Number.NaN) || !durationSeconds) return `${kindLabel}时长读取失败`;
  if (rule.minSeconds !== undefined && durationSeconds < rule.minSeconds - MEDIA_DURATION_EPSILON_SECONDS) return `${kindLabel}时长不能少于 ${rule.minSeconds} 秒`;
  if (rule.maxSeconds !== undefined && durationSeconds > rule.maxSeconds + MEDIA_DURATION_EPSILON_SECONDS) return `${kindLabel}时长不能超过 ${rule.maxSeconds} 秒`;
  return undefined;
}

function validateReferenceVideoDimensions(dimensions?: ImageDimensions) {
  if (!dimensions?.width || !dimensions.height) return "视频尺寸读取失败";
  const ratio = dimensions.width / dimensions.height;
  if (ratio < 0.4 || ratio > 2.5) return "视频宽高比需在 0.4 到 2.5 之间";
  if (dimensions.width < 300 || dimensions.width > 6000 || dimensions.height < 300 || dimensions.height > 6000) return "视频宽高需在 300 到 6000 像素之间";
  const pixels = dimensions.width * dimensions.height;
  if (pixels < 409600 || pixels > 2086876) return "视频总像素需在 409600 到 2086876 之间";
  return undefined;
}

function getUploadedFilePreviewAsset(file: UploadedFileEntry): AssetItem | undefined {
  if (!isUploadedMediaFile(file)) return undefined;
  const url = getUploadedMediaFileUrl(file);
  if (!url) return undefined;
  const kind = getUploadedFileMediaKind(file);
  const name = getUploadedFileDisplayName(file);
  const media = typeof file === "string" ? undefined : file;
  return {
    id: getUploadedFileKey(file),
    type: kind === "video" ? "shot_video" : "other",
    name,
    systemName: name,
    url,
    librarySource: "conversation",
    sourcePrompt: kind === "video" ? "参考视频" : "参考音频",
    previewMeta: media?.dimensions ? getPreviewMetaWithDimensions(undefined, media.dimensions, "video") : undefined,
    sessionId: "",
    createdAt: Date.now(),
  };
}

function getUploadedMediaReferences(files?: UploadedFileEntry[]): MediaFileReference[] {
  return (files ?? []).flatMap((file): MediaFileReference[] => {
    const mediaKind = getUploadedFileMediaKind(file);
    if (mediaKind !== "video" && mediaKind !== "audio") return [];
    const url = getUploadedMediaFileUrl(file);
    if (!url) return [];
    return [{ name: getUploadedFileDisplayName(file), url, mediaKind, file }];
  });
}

function ensureMediaFileMentions(text: string, references: MediaFileReference[]) {
  const missing = references.filter((reference) => !text.includes(`@${reference.name}`));
  if (missing.length === 0) return text;
  const prefix = missing.map((reference) => `@${reference.name}`).join(" ");
  return [prefix, text].filter(Boolean).join(" ").trim();
}

function getDocumentOnlyUploadedFiles(files?: UploadedFileEntry[]) {
  return (files ?? []).filter((file) => !isUploadedMediaFile(file));
}

function isUploadedMarkdownFile(file: UploadedFileEntry) {
  return getFileExtension(getUploadedFileDisplayName(file)) === "md";
}

function DocumentPreviewPanel({ file, width, onResizeStart, onClose }: { file: UploadedFileEntry | null; width: number; onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const displayName = getUploadedFileDisplayName(file);
  const meta = getUploadedDocumentMeta(displayName);
  const text = getUploadedFilePreviewText(file);
  const sizeText = formatUploadedFileSize(file);
  const canUseText = Boolean(text);
  const copyDocumentText = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  const downloadDocumentText = () => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = displayName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 overscroll-contain border-l border-[#e8e8e8] bg-white shadow-[-18px_0_40px_rgba(0,0,0,0.08)]" style={{ width }}>
      <div role="separator" aria-label="调整文档预览宽度" onPointerDown={onResizeStart} className="group absolute bottom-0 left-[-5px] top-0 z-10 w-[10px] cursor-col-resize bg-transparent">
        <div className="mx-auto h-full w-px bg-[#eeeeee] transition group-hover:bg-[#d6d6d6]" />
        <div className="absolute left-1/2 top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#e1e1e1] bg-white transition group-hover:border-[#d2d2d2] group-hover:bg-[#f7f7f7]" />
      </div>
      <div className="flex h-[58px] items-center justify-between gap-4 border-b border-[#eeeeee] px-5">
        <div className="min-w-0 flex items-center gap-3">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[3px] border-2 text-[15px] font-bold leading-none" style={{ backgroundColor: meta.bg, borderColor: meta.border, color: meta.color }}>
            {meta.icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium leading-5 text-[#111111]">{displayName}</div>
            <div className="mt-0.5 text-[11px] leading-4 text-[#9a9a9a]">{meta.label}{sizeText ? ` · ${sizeText}` : ""}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <BlackHoverTooltip label={copied ? "已复制" : "复制文档全文"}>
            <button type="button" disabled={!canUseText} onClick={() => void copyDocumentText()} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777777] transition hover:bg-[#f3f3f3] hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#777777]" aria-label={copied ? "已复制" : "复制文档全文"}>
              {copied ? <RiCheckLine className="h-4.5 w-4.5 text-[#111111]" aria-hidden="true" /> : <RiCheckboxMultipleBlankLine className="h-4.5 w-4.5" aria-hidden="true" />}
            </button>
          </BlackHoverTooltip>
          <BlackHoverTooltip label="下载文档">
            <button type="button" disabled={!canUseText} onClick={downloadDocumentText} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777777] transition hover:bg-[#f3f3f3] hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#777777]" aria-label="下载文档">
              <RiDownloadLine className="h-4.5 w-4.5" aria-hidden="true" />
            </button>
          </BlackHoverTooltip>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#777777] transition hover:bg-[#f3f3f3] hover:text-[#111111]" aria-label="关闭文档预览">
            <RiCloseLine className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="h-[calc(100vh-58px)] overflow-y-auto overscroll-contain px-8 py-8 text-[15px] leading-8 text-[#111111]">
        {text ? (
          isUploadedMarkdownFile(file) ? <FormattedMessage content={text} /> : <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-8 text-[#111111]">{text}</pre>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-[14px] leading-7 text-[#999999]">
            {typeof file !== "string" && file.status === "reading" ? "文件读取中，请稍后再预览。" : typeof file !== "string" && file.status === "error" ? file.error || "文件读取失败" : "当前文件暂不支持预览内容，后续接服务端解析。"}
          </div>
        )}
      </div>
    </div>
  );
}

function getUploadedFileStorageName(file: File) {
  const sizeText = formatFileSize(file.size);
  return sizeText ? `${file.name} · ${sizeText}` : file.name;
}

function createUploadedDocumentEntry(file: File, media?: { mediaKind?: "document" | "video" | "audio"; durationSeconds?: number; dimensions?: ImageDimensions }): UploadedDocumentFile {
  const extension = getFileExtension(file.name);
  const readable = isReadableDocumentFile(file);

  return {
    id: createClientId(),
    name: file.name,
    storageName: getUploadedFileStorageName(file),
    size: file.size,
    extension,
    mediaKind: media?.mediaKind ?? "document",
    durationSeconds: media?.durationSeconds,
    dimensions: media?.dimensions,
    uploadStatus: "uploading",
    uploadProgress: 6,
    status: readable ? "reading" : undefined,
    progress: readable ? 6 : undefined,
  };
}

function readMediaFileMetadata(file: File, kind: "video" | "audio") {
  return new Promise<{ durationSeconds?: number; dimensions?: ImageDimensions }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = kind === "video" ? document.createElement("video") : document.createElement("audio");
    const cleanup = () => URL.revokeObjectURL(url);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const durationSeconds = Number.isFinite(element.duration) ? element.duration : undefined;
      const dimensions = kind === "video"
        ? { width: Math.floor((element as HTMLVideoElement).videoWidth), height: Math.floor((element as HTMLVideoElement).videoHeight) }
        : undefined;
      cleanup();
      resolve({ durationSeconds, dimensions: dimensions?.width && dimensions.height ? dimensions : undefined });
    };
    element.onerror = () => {
      cleanup();
      reject(new Error(kind === "video" ? "视频信息读取失败" : "音频信息读取失败"));
    };
    element.src = url;
  });
}

function readDocumentFileText(file: File, onProgress: (progress: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(96, Math.max(8, Math.round((event.loaded / event.total) * 96))));
    };
    reader.onload = () => {
      onProgress(100);
      const text = typeof reader.result === "string" ? reader.result : "";
      resolve(text.slice(0, MAX_DOCUMENT_TEXT_CHARS));
    };
    reader.onerror = () => reject(reader.error ?? new Error("文件读取失败"));
    reader.readAsText(file, "utf-8");
  });
}

async function copyImageToClipboard(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();

  await navigator.clipboard.write([
    new ClipboardItem({
      [blob.type || "image/png"]: blob,
    }),
  ]);
}

function getDownloadName(asset: AssetItem) {
  if (/\.[a-z0-9]{2,5}$/i.test(asset.name)) return asset.name;

  const extension = asset.url.split("?")[0].split("#")[0].split(".").pop();
  const safeExtension = extension && /^[a-z0-9]{2,5}$/i.test(extension) ? extension : isVideoAsset(asset) ? "mp4" : "png";
  return `${asset.name}.${safeExtension}`;
}

export function ChatWorkbench() {
  const workspaceInstanceIdRef = useRef(createClientId());
  const workspaceInstanceClaimedRef = useRef(false);
  const initialWorkspaceUiStateRef = useRef<StoredWorkspaceUiState | null>(null);
  if (initialWorkspaceUiStateRef.current === null) initialWorkspaceUiStateRef.current = getStoredWorkspaceUiState();
  const [mode, setMode] = useState<WorkMode>("agent");
  const [agentModelTier, setAgentModelTier] = useState<AgentModelTier>("normal");
  const selectedModel: ModelName = agentModelTier === "advanced" ? ADVANCED_CHAT_MODEL : DEFAULT_CHAT_MODEL;
  const [activePanel, setActivePanel] = useState<ActivePanel>(() => initialWorkspaceUiStateRef.current?.activePanel ?? "chat");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>(() => initialWorkspaceUiStateRef.current?.assetFilter ?? "character_image");
  const [assetsLoadStatus, setAssetsLoadStatus] = useState<"idle" | "loading" | "loaded" | "failed">("idle");
  const [assetLoadingReason, setAssetLoadingReason] = useState<"" | "initial" | "scroll" | "auto">("");
  const [loadedAssetFilters, setLoadedAssetFilters] = useState<Partial<Record<AssetFilter, boolean>>>({});
  const [assetCounts, setAssetCounts] = useState<Record<string, number>>({});
  const [assetsHasMore, setAssetsHasMore] = useState(false);
  const [assetsNextOffset, setAssetsNextOffset] = useState(0);
  const [assetScrollTopByFilter, setAssetScrollTopByFilter] = useState<Partial<Record<AssetFilter, number>>>(() => initialWorkspaceUiStateRef.current?.assetScrollTopByFilter ?? {});
  const assetScrollTopByFilterRef = useRef<Partial<Record<AssetFilter, number>>>({});
  const previousAssetFilterRef = useRef<AssetFilter>(assetFilter);
  const [selectedRatios, setSelectedRatios] = useState<Record<WorkMode, string>>({
    general: ratioOptions[0],
    agent: ratioOptions[0],
    image: ratioOptions[0],
    video: ratioOptions[0],
  });
  const [selectedResolutions, setSelectedResolutions] = useState<Record<WorkMode, string>>({
    general: imageResolutionOptions[0],
    agent: imageResolutionOptions[0],
    image: imageResolutionOptions[0],
    video: videoResolutionOptions[0],
  });
  const [selectedStyle] = useState(styleOptions[0]);
  const [selectedDurations, setSelectedDurations] = useState<Record<WorkMode, string>>({
    general: durationOptions[0],
    agent: durationOptions[0],
    image: durationOptions[0],
    video: durationOptions[0],
  });
  const [selectedImageCounts, setSelectedImageCounts] = useState<Record<WorkMode, string>>({
    general: imageCountOptions[0],
    agent: imageCountOptions[0],
    image: imageCountOptions[0],
    video: imageCountOptions[0],
  });
  const [selectedGenerationModels, setSelectedGenerationModels] = useState<Record<"image" | "video", ModelName>>({
    image: DEFAULT_IMAGE_MODEL,
    video: DEFAULT_VIDEO_MODEL,
  });
  const [selectedGeneralModels, setSelectedGeneralModels] = useState<Record<"chat" | "image" | "video", ModelName>>({
    chat: frontendConversationModels[0].id,
    image: DEFAULT_IMAGE_MODEL,
    video: DEFAULT_VIDEO_MODEL,
  });
  const [enabledGeneralChatModelIds, setEnabledGeneralChatModelIds] = useState<string[]>(frontendConversationModels.map((model) => model.id));
  const [generalModelProviders, setGeneralModelProviders] = useState<Record<string, "openrouter" | "byteplus">>({});
  const [enabledGenerationModelIds, setEnabledGenerationModelIds] = useState<Record<"image" | "video", string[]>>({
    image: imageGenerationModels.map((model) => model.id),
    video: videoGenerationModels.map((model) => model.id),
  });
  const [enabledAgentGenerationModelIds, setEnabledAgentGenerationModelIds] = useState<Record<"image" | "video", string[]>>({
    image: frontendImageGenerationModels.map((model) => model.id),
    video: [...videoGenerationModels, ...bytePlusVideoGenerationModels].map((model) => model.id),
  });
  const [enabledAssetImageModelIds, setEnabledAssetImageModelIds] = useState<string[]>([DEFAULT_CHARACTER_IMAGE_MODEL, ...imageGenerationModels.map((model) => model.id)]);
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [nextConversationNumber, setNextConversationNumber] = useState(1);
  const sessionsRef = useRef<WorkSession[]>([]);
  const [historyVisibleSessionCount, setHistoryVisibleSessionCount] = useState(HISTORY_INITIAL_SESSION_COUNT);
  const [historyHasMoreSessions, setHistoryHasMoreSessions] = useState(false);
  const [historyNextOffset, setHistoryNextOffset] = useState(HISTORY_INITIAL_SESSION_COUNT);
  const [historyTotalSessionCount, setHistoryTotalSessionCount] = useState(0);
  const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false);
  const [nextWorkflowNumber, setNextWorkflowNumber] = useState(1);
  const [workspaceLoadStatus, setWorkspaceLoadStatus] = useState<WorkspaceLoadStatus>("loading");
  const [workspaceLoadRetryKey, setWorkspaceLoadRetryKey] = useState(0);
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState("");
  const [workflowVisibleItemCount, setWorkflowVisibleItemCount] = useState(WORKFLOW_INITIAL_ITEM_COUNT);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [loadingSessionIds, setLoadingSessionIds] = useState<Set<string>>(() => new Set());
  const [loadingOlderMessageSessionIds, setLoadingOlderMessageSessionIds] = useState<Set<string>>(() => new Set());
  const [loadingSessionStartedAt, setLoadingSessionStartedAt] = useState<Record<string, number>>({});
  const [pendingHomePrompt, setPendingHomePrompt] = useState<{ sessionId: string; prompt: string } | null>(null);
  const [openWorkflowMenuId, setOpenWorkflowMenuId] = useState("");
  const [openSessionMenuId, setOpenSessionMenuId] = useState("");
  const [isCollapsedHistoryMenuOpen, setIsCollapsedHistoryMenuOpen] = useState(false);
  const [collapsedActionMenuPosition, setCollapsedActionMenuPosition] = useState<{ left: number; top: number } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<WorkspaceThemeMode>(getStoredWorkspaceThemeMode);
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);
  const sendMessageRef = useRef<((suggestion?: SuggestionInput, forcedMode?: WorkMode) => void | Promise<void>) | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("user@example.com");
  const [currentUserNickname, setCurrentUserNickname] = useState("user@example.com");
  const [userNicknameInput, setUserNicknameInput] = useState("user@example.com");
  const [isEditingUserNickname, setIsEditingUserNickname] = useState(false);
  const [currentUserPhone, setCurrentUserPhone] = useState("");
  const [userPhoneInput, setUserPhoneInput] = useState("");
  const [isEditingUserPhone, setIsEditingUserPhone] = useState(false);
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState("");
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [currentUserGeneralModeEnabled, setCurrentUserGeneralModeEnabled] = useState(false);
  const [isUploadingUserAvatar, setIsUploadingUserAvatar] = useState(false);
  const [userLanguage, setUserLanguage] = useState<UserLanguage>("简体中文");
  const [notifyOnGenerationComplete, setNotifyOnGenerationComplete] = useState(true);
  const [autoSaveHistory, setAutoSaveHistory] = useState(true);
  const [previewWheelZoom, setPreviewWheelZoom] = useState(true);
  const [previewWheelFlip, setPreviewWheelFlip] = useState(true);
  const [generatedImageCount, setGeneratedImageCount] = useState(0);
  const [generatedVideoCount, setGeneratedVideoCount] = useState(0);
  const [currentUserCredits, setCurrentUserCredits] = useState(1500);
  const [giftedUserCredits, setGiftedUserCredits] = useState(1500);
  const [userCreditConversations, setUserCreditConversations] = useState<UserCreditConversation[]>([]);
  const [userCreditPage, setUserCreditPage] = useState(1);
  const [currentUserHasPassword, setCurrentUserHasPassword] = useState(false);
  const defaultUserAvatar = useMemo(() => getDefaultUserAvatar(currentUserEmail), [currentUserEmail]);
  const [workspaceStorageMode, setWorkspaceStorageMode] = useState<WorkspaceStorageMode>("loading");
  const [userDialogTab, setUserDialogTab] = useState<UserDialogTab | "">("");
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [, setPasswordActionMessage] = useState("");
  const [passwordActionError, setPasswordActionError] = useState("");
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [securityPasswordMode, setSecurityPasswordMode] = useState<"default" | "change" | "forgot-code" | "forgot-reset">("default");
  const [forgotPasswordCode, setForgotPasswordCode] = useState("");
  const [isForgotPasswordSending, setIsForgotPasswordSending] = useState(false);
  const [userDialogTip, setUserDialogTip] = useState<ReminderMessage | undefined>();
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState("");
  const [sessionMenuPlacement, setSessionMenuPlacement] = useState<"top" | "bottom">("bottom");
  const [renamingSessionId, setRenamingSessionId] = useState("");
  const [renameInput, setRenameInput] = useState("");
  const [renamingAssetId, setRenamingAssetId] = useState("");
  const [assetRenameInput, setAssetRenameInput] = useState("");
  const [openAssetActionMenuId, setOpenAssetActionMenuId] = useState("");
  const [atAssetFilter, setAtAssetFilter] = useState<MentionAssetGroupType>("character_image");
  const [isAtAssetMenuOpen, setIsAtAssetMenuOpen] = useState(false);
  const [openControlMenu, setOpenControlMenu] = useState<ControlMenuName | ModeMenuName | "">("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [workspaceSite, setWorkspaceSite] = useState<WorkspaceSite>("other");
  const [modelInfoSessionId, setModelInfoSessionId] = useState("");
  const [activeTypingMessageIds, setActiveTypingMessageIds] = useState<Set<string>>(() => new Set());
  const [completedTypingMessageIds, setCompletedTypingMessageIds] = useState<Set<string>>(() => new Set());
  const [intentMemoryRules, setIntentMemoryRules] = useState<IntentMemoryRule[]>([]);
  const [feedbackLogs, setFeedbackLogs] = useState<FeedbackLogEntry[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetRenderLimit, setAssetRenderLimit] = useState(ASSET_RENDER_PAGE_SIZE);
  const [isAssetUploadOpen, setIsAssetUploadOpen] = useState(false);
  const [isCharacterGenerateOpen, setIsCharacterGenerateOpen] = useState(false);
  const [assetGenerateType, setAssetGenerateType] = useState<AssetGenerationImageType>("character_image");
  const [characterGeneratePrompt, setCharacterGeneratePrompt] = useState("");
  const [assetGeneratePromptDrafts, setAssetGeneratePromptDrafts] = useState<Record<AssetGenerationImageType, string>>({ character_image: "", scene_image: "", shot_image: "" });
  const [assetGenerateRatioSelections, setAssetGenerateRatioSelections] = useState<Record<AssetGenerationImageType, AssetGenerateRatio>>({ character_image: "single", scene_image: "single", shot_image: "single" });
  const [characterGenerateRatio, setCharacterGenerateRatio] = useState<AssetGenerateRatio>("single");
  const [characterGenerateStyle, setCharacterGenerateStyle] = useState<"realistic" | "2d" | "3d">("realistic");
  const [characterGenerateModel, setCharacterGenerateModel] = useState<ModelName>(DEFAULT_CHARACTER_IMAGE_MODEL);
  const [characterGenerateResolution, setCharacterGenerateResolution] = useState(DEFAULT_CHARACTER_IMAGE_RESOLUTION);
  const [characterGenerateResult, setCharacterGenerateResult] = useState<CharacterGenerationResult>({ status: "idle" });
  const [assetGenerateJobs, setAssetGenerateJobs] = useState<AssetGenerateJob[]>([]);
  const [activeAssetGenerateJobId, setActiveAssetGenerateJobId] = useState("");
  const [characterImageScale, setCharacterImageScale] = useState(1);
  const [characterImageFitMode, setCharacterImageFitMode] = useState<"fit" | "actual">("fit");
  const [characterImagePan, setCharacterImagePan] = useState({ x: 0, y: 0 });
  const [characterImageNaturalSize, setCharacterImageNaturalSize] = useState({ width: 0, height: 0 });
  const [characterImageFitScale, setCharacterImageFitScale] = useState(1);
  const [isCharacterImageDragging, setIsCharacterImageDragging] = useState(false);
  const [isInputPromptOptimizing, setIsInputPromptOptimizing] = useState(false);
  const [isCharacterPromptOptimizing, setIsCharacterPromptOptimizing] = useState(false);
  const [characterPromptCursorOffset, setCharacterPromptCursorOffset] = useState(0);
  const [characterAtAssetFilter, setCharacterAtAssetFilter] = useState<MentionAssetGroupType>("character_image");
  const [isCharacterAtAssetMenuOpen, setIsCharacterAtAssetMenuOpen] = useState(false);
  const [assetUploadSlots, setAssetUploadSlots] = useState<AssetUploadSlot[]>(() => createAssetUploadSlots("character_image"));
  const [activeAssetUploadIndex, setActiveAssetUploadIndex] = useState(0);
  const [isAssetUploading, setIsAssetUploading] = useState(false);
  const [assetUploadTip, setAssetUploadTip] = useState<ReminderMessage | undefined>();
  const [generationCompleteReminder, setGenerationCompleteReminder] = useState<ReminderMessage | undefined>();
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  const [previewDocumentFile, setPreviewDocumentFile] = useState<UploadedFileEntry | null>(null);
  const [previewDocumentWidth, setPreviewDocumentWidth] = useState(0);
  const [hasCustomPreviewDocumentWidth, setHasCustomPreviewDocumentWidth] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [isReversePromptingPreview, setIsReversePromptingPreview] = useState(false);
  const [previewPromptError, setPreviewPromptError] = useState<{ assetId: string; message: string } | null>(null);
  const [isSubmittingBytePlusAsset, setIsSubmittingBytePlusAsset] = useState(false);
  const [bytePlusAssetError, setBytePlusAssetError] = useState<{ assetId: string; message: string } | null>(null);
  const [previewPromptCopyState, setPreviewPromptCopyState] = useState<"idle" | "success" | "error">("idle");
  const [previewFitMode, setPreviewFitMode] = useState<"fit" | "actual">("fit");
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [previewNaturalSize, setPreviewNaturalSize] = useState({ width: 0, height: 0 });
  const [previewFitScale, setPreviewFitScale] = useState(1);
  const [previewThumbPageStart, setPreviewThumbPageStart] = useState(0);
  const [previewThumbPageSize, setPreviewThumbPageSize] = useState(4);
  const [isPreviewDragging, setIsPreviewDragging] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<{ messageId: string; state: "success" | "error" } | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, "like" | "dislike">>({});
  const [messageIssueFeedback, setMessageIssueFeedback] = useState<Record<string, "wrong" | "wrong_mode">>({});
  const [inputReminder, setInputReminder] = useState<ReminderMessage | undefined>();
  const [draftCursorOffset, setDraftCursorOffset] = useState(0);
  const [sendingSessionIds, setSendingSessionIds] = useState<Set<string>>(() => new Set());
  const [resolvingSessionIds] = useState<Set<string>>(() => new Set());
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [imageVariantIndexes, setImageVariantIndexes] = useState<Record<string, number>>({});
  const [agentPromptExpandedIds, setAgentPromptExpandedIds] = useState<Record<string, boolean>>({});
  const [agentPromptPageIndexes, setAgentPromptPageIndexes] = useState<Record<string, number>>({});
  const [mediaErrorPageIndexes, setMediaErrorPageIndexes] = useState<Record<string, number>>({});
  const [isDragUploadActive, setIsDragUploadActive] = useState(false);
  const [canScrollUploadedFiles, setCanScrollUploadedFiles] = useState({ left: false, right: false });
  const [canScrollUploadedImages, setCanScrollUploadedImages] = useState({ left: false, right: false });
  const [canScrollAssetGenerateReferences, setCanScrollAssetGenerateReferences] = useState({ left: false, right: false });
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const uploadedFilesRowRef = useRef<HTMLDivElement | null>(null);
  const uploadedImagesRowRef = useRef<HTMLDivElement | null>(null);
  const assetGenerateReferencesRowRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const characterEditorRef = useRef<HTMLDivElement | null>(null);
  const characterViewportRef = useRef<HTMLDivElement | null>(null);
  const characterImageDragStartRef = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const userAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const previewThumbListRef = useRef<HTMLDivElement | null>(null);
  const previewAssetRef = useRef<AssetItem | null>(null);
  const preloadedPreviewThumbUrlsRef = useRef<Set<string>>(new Set());
  const preloadingSavedMediaUrlsRef = useRef<Set<string>>(new Set());
  const inputImageUploadAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const previewDragStartRef = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const activeAssetGenerateJobIdRef = useRef("");
  const runningRequestIdsRef = useRef<Set<string>>(new Set());
  const sendingSessionIdsRef = useRef<Set<string>>(new Set());
  const requestAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const stoppedRequestIdsRef = useRef<Set<string>>(new Set());
  const completedNotificationRequestIdsRef = useRef<Set<string>>(new Set());
  const dragUploadDepthRef = useRef(0);
  const workspaceSaveTimerRef = useRef<number | null>(null);
  const userProfileSaveTimerRef = useRef<number | null>(null);
  const workspaceInstanceCheckFailuresRef = useRef(0);
  const authCheckFailuresRef = useRef(0);
  const authActivityPingRef = useRef(0);
  const typingScrollFrameRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const inputTipTimerRef = useRef<number | null>(null);
  const inputTipQueueRef = useRef<ReminderMessage[]>([]);
  const inputCurrentTipRef = useRef<ReminderMessage | undefined>(undefined);
  const showNextInputTipRef = useRef<(() => void) | null>(null);
  const assetUploadTipTimerRef = useRef<number | null>(null);
  const assetUploadTipQueueRef = useRef<ReminderMessage[]>([]);
  const assetUploadCurrentTipRef = useRef<ReminderMessage | undefined>(undefined);
  const assetUploadAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const showNextAssetUploadTipRef = useRef<(() => void) | null>(null);
  const generationCompleteTipTimerRef = useRef<number | null>(null);
  const generationCompleteTipQueueRef = useRef<ReminderMessage[]>([]);
  const generationCompleteCurrentTipRef = useRef<ReminderMessage | undefined>(undefined);
  const showNextGenerationCompleteTipRef = useRef<(() => void) | null>(null);
  const userDialogTipTimerRef = useRef<number | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useBodyScrollLock(Boolean(isAssetUploadOpen || isCharacterGenerateOpen || userDialogTab || renamingSessionId || renamingAssetId || previewAsset));

  useEffect(() => {
    activeAssetGenerateJobIdRef.current = activeAssetGenerateJobId;
  }, [activeAssetGenerateJobId]);
  const selectedRatio = mode === "video" ? (selectedRatios.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(selectedGenerationModels.video, selectedRatios.video, selectedResolutions.video)) : selectedRatios[mode];
  const selectedResolution = mode === "image" ? normalizeImageResolutionForModel(selectedGenerationModels.image, selectedRatios.image === "智能比例" ? "智能比例" : selectedResolutions.image) : mode === "video" ? (selectedRatios.video === "智能比例" ? "720p" : normalizeVideoResolutionForModel(selectedGenerationModels.video, selectedResolutions.video)) : selectedResolutions[mode];
  const selectedImageCount = selectedImageCounts[mode];
  const selectedGenerationModel = mode === "general" ? selectedGeneralModels.chat : mode === "agent" ? selectedModel : selectedGenerationModels[mode];
  const currentUploadRule = useMemo(() => getUploadRule({ mode, modelId: selectedGenerationModel, transportMode: "local-base64" }), [mode, selectedGenerationModel]);
  const currentMaxReferenceImages = currentUploadRule.image.maxCount;
  const uploadAcceptValue = useMemo(() => getUploadAcceptValue(currentUploadRule), [currentUploadRule]);
  const supportedUploadTypeLabel = useMemo(() => getSupportedUploadTypeLabel(currentUploadRule), [currentUploadRule]);
  const selectedGenerationModelLabel = mode === "image" || mode === "video" ? getGenerationModelLabel(mode, selectedGenerationModel) : "";
  const currentDurationOptions = getVideoDurationOptions(selectedGenerationModels.video);
  const selectedVideoDuration = currentDurationOptions.includes(selectedDurations.video) ? selectedDurations.video : currentDurationOptions[0];
  const isSceneGeneration = assetGenerateType === "scene_image";
  const isShotGeneration = assetGenerateType === "shot_image";
  const characterGenerateDisplayRatio = characterGenerateRatio === "single" ? "9:16" : "16:9";
  const characterGenerateDisplayResolution = normalizeImageResolutionForModel(characterGenerateModel, characterGenerateResolution);
  const assetGenerateUploadRule = useMemo(() => getUploadRule({ mode: "asset-image", modelId: characterGenerateModel, transportMode: "local-base64" }), [characterGenerateModel]);
  const assetGenerateMaxReferenceImages = assetGenerateUploadRule.image.maxCount;
  const characterGenerateDisplayDimensions = getDisplayDimensions(characterGenerateDisplayRatio, characterGenerateDisplayResolution, "image", characterGenerateModel);
  const characterGenerateQualityBadgeLabel = getImageQualityBadgeLabel(characterGenerateDisplayResolution);
  const assetGenerateTitle = isShotGeneration ? "分镜生成" : isSceneGeneration ? "场景生成" : "角色生成";
  const assetGenerateAreaTitle = isShotGeneration ? "分镜图片生成区" : isSceneGeneration ? "场景图片生成区" : "角色图片生成区";
  const assetGeneratePlaceholder = isShotGeneration ? "描述一个电影或电视剧截图感的镜头画面..." : isSceneGeneration ? "描述要生成的纯场景画面..." : "描述要生成的角色形象...";
  const AssetGenerateIcon = isShotGeneration ? RiMultiImageLine : isSceneGeneration ? RiLandscapeLine : RiAccountBoxLine;
  const assetGenerateRatioLabel = isShotGeneration
    ? characterGenerateRatio === "single" ? "竖屏分镜9:16" : "横屏分镜16:9"
    : isSceneGeneration
    ? characterGenerateRatio === "scene-grid" ? "四宫格16:9" : characterGenerateRatio === "single" ? "单场景9:16" : "单场景16:9"
    : characterGenerateRatio === "single" ? "单人9:16" : "三视图16:9";
  const setActiveAssetGeneratePrompt = useCallback((value: string) => {
    setCharacterGeneratePrompt(value);
    setAssetGeneratePromptDrafts((current) => ({ ...current, [assetGenerateType]: value }));
  }, [assetGenerateType]);
  const setActiveAssetGenerateRatio = useCallback((value: AssetGenerateRatio) => {
    setCharacterGenerateRatio(value);
    setAssetGenerateRatioSelections((current) => ({ ...current, [assetGenerateType]: value }));
  }, [assetGenerateType]);
  const userText = useCallback((text: string) => getUserText(userLanguage, text), [userLanguage]);

  const applyCurrentUserProfile = useCallback((profile: CurrentUserProfile) => {
    const nickname = profile.nickname?.trim() || profile.email;
    const phone = profile.phone?.trim() || "";
    const avatarUrl = profile.avatarUrl?.trim() || "";

    setCurrentUserId(profile.id?.trim() || "");
    setCurrentUserEmail(profile.email);
    setCurrentUserIsAdmin(Boolean(profile.isAdmin));
    setCurrentUserGeneralModeEnabled(Boolean(profile.generalModeEnabled));
    setCurrentUserHasPassword(Boolean(profile.hasPassword));
    setCurrentUserNickname(nickname);
    setUserNicknameInput(nickname);
    setCurrentUserPhone(phone);
    setUserPhoneInput(phone);
    setCurrentUserAvatarUrl(avatarUrl);
    setUserLanguage(profile.language && userLanguageOptions.includes(profile.language) ? profile.language : "简体中文");
    setNotifyOnGenerationComplete(profile.notifyOnGenerationComplete ?? true);
    setAutoSaveHistory(profile.autoSaveHistory ?? true);
    setPreviewWheelZoom(profile.previewWheelZoom ?? true);
    setPreviewWheelFlip(profile.previewWheelFlip ?? true);
    setGeneratedImageCount(profile.generatedImageCount ?? 0);
    setGeneratedVideoCount(profile.generatedVideoCount ?? 0);
    setCurrentUserCredits(profile.credits ?? 0);
  }, []);

  useEffect(() => {
    if (!currentUserGeneralModeEnabled && mode === "general") setMode("agent");
  }, [currentUserGeneralModeEnabled, mode]);

  const logoutUser = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/";
  }, []);

  const openUserDialog = useCallback((tab: UserDialogTab) => {
    setIsUserMenuOpen(false);
    setUserDialogTab(tab);
    if (tab === "credits") {
      setUserCreditPage(1);
      void fetch("/api/credits/me", { cache: "no-store" })
        .then((response) => readJson<{ credits: number; giftedCredits?: number; conversations: UserCreditConversation[] }>(response))
        .then((data) => {
          setCurrentUserCredits(Math.max(0, Math.floor(data.credits ?? 0)));
          setGiftedUserCredits(Math.max(0, Math.floor(data.giftedCredits ?? data.credits ?? 0)));
          setUserCreditConversations(data.conversations ?? []);
        })
        .catch(() => undefined);
    }
    setSecurityPasswordMode("default");
    setForgotPasswordCode("");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setPasswordActionMessage("");
    setPasswordActionError("");
  }, []);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;

    const requestedTab = window.sessionStorage.getItem(WORKSPACE_USER_DIALOG_STORAGE_KEY);
    if (requestedTab !== "profile" && requestedTab !== "credits" && requestedTab !== "security" && requestedTab !== "settings") return;

    window.sessionStorage.removeItem(WORKSPACE_USER_DIALOG_STORAGE_KEY);
    const timer = window.setTimeout(() => openUserDialog(requestedTab), 0);
    return () => window.clearTimeout(timer);
  }, [isLoaded, openUserDialog, workspaceStorageMode]);

  const submitPasswordSettings = useCallback(async () => {
    setPasswordActionMessage("");
    setPasswordActionError("");

    if (newPasswordInput.length < 8) {
      setPasswordActionError("密码至少需要8位");
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordActionError("两次输入的新密码不一致");
      return;
    }

    setIsPasswordSaving(true);
    try {
      const isForgotReset = securityPasswordMode === "forgot-reset";
      const response = await fetch(isForgotReset ? "/api/auth/reset-password" : currentUserHasPassword ? "/api/auth/change-password" : "/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isForgotReset ? { code: forgotPasswordCode, password: newPasswordInput } : currentUserHasPassword ? { currentPassword: currentPasswordInput, newPassword: newPasswordInput } : { password: newPasswordInput }),
      });
      await readJson<{ ok: boolean }>(response);

      setCurrentUserHasPassword(true);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");
      setForgotPasswordCode("");
      setSecurityPasswordMode("default");
      setUserDialogTip({ message: currentUserHasPassword || isForgotReset ? "密码已修改" : "密码已设置", tone: "success" });
    } catch (error) {
      setPasswordActionError(toUserErrorMessage(error));
    } finally {
      setIsPasswordSaving(false);
    }
  }, [confirmPasswordInput, currentPasswordInput, currentUserHasPassword, forgotPasswordCode, newPasswordInput, securityPasswordMode]);

  const startForgotPasswordFlow = useCallback(async () => {
    setPasswordActionError("");
    setPasswordActionMessage("");
    setForgotPasswordCode("");
    setCurrentPasswordInput("");
    setNewPasswordInput("");
    setConfirmPasswordInput("");
    setIsForgotPasswordSending(true);
    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUserEmail }),
      });
      await readJson<{ ok: boolean }>(response);
      setSecurityPasswordMode("forgot-code");
      setUserDialogTip({ message: "验证码已发送到您当前登录的邮箱中", tone: "default" });
    } catch (error) {
      setPasswordActionError(toUserErrorMessage(error));
    } finally {
      setIsForgotPasswordSending(false);
    }
  }, [currentUserEmail]);

  const verifyForgotPasswordCode = useCallback(async () => {
    setPasswordActionError("");
    setPasswordActionMessage("");

    if (!/^\d{6}$/.test(forgotPasswordCode)) {
      setPasswordActionError("请输入6位验证码");
      return;
    }

    setIsForgotPasswordSending(true);
    try {
      const response = await fetch("/api/auth/check-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUserEmail, code: forgotPasswordCode }),
      });
      await readJson<{ ok: boolean }>(response);
      setSecurityPasswordMode("forgot-reset");
      setUserDialogTip({ message: "邮箱验证成功", tone: "success" });
    } catch (error) {
      setPasswordActionError(toUserErrorMessage(error));
    } finally {
      setIsForgotPasswordSending(false);
    }
  }, [currentUserEmail, forgotPasswordCode]);

  const startEditingUserNickname = useCallback(() => {
    setUserNicknameInput(currentUserNickname.trim() || currentUserEmail);
    setIsEditingUserNickname(true);
  }, [currentUserEmail, currentUserNickname]);

  const commitUserNickname = useCallback(() => {
    const nextNickname = Array.from(userNicknameInput.trim()).slice(0, MAX_USER_NICKNAME_LENGTH).join("") || currentUserEmail;

    setCurrentUserNickname(nextNickname);
    setUserNicknameInput(nextNickname);
    setIsEditingUserNickname(false);
  }, [currentUserEmail, userNicknameInput]);

  const cancelEditingUserNickname = useCallback(() => {
    setUserNicknameInput(currentUserNickname.trim() || currentUserEmail);
    setIsEditingUserNickname(false);
  }, [currentUserEmail, currentUserNickname]);

  const startEditingUserPhone = useCallback(() => {
    setUserPhoneInput(currentUserPhone.trim());
    setIsEditingUserPhone(true);
  }, [currentUserPhone]);

  const commitUserPhone = useCallback(() => {
    const nextPhone = userPhoneInput.trim();

    setCurrentUserPhone(nextPhone);
    setUserPhoneInput(nextPhone);
    setIsEditingUserPhone(false);
  }, [userPhoneInput]);

  const cancelEditingUserPhone = useCallback(() => {
    setUserPhoneInput(currentUserPhone.trim());
    setIsEditingUserPhone(false);
  }, [currentUserPhone]);

  const updatePasswordField = useCallback((setter: (value: string) => void, value: string) => {
    setter(value);
    setPasswordActionError("");
    setPasswordActionMessage("");
  }, []);

  const uploadUserAvatar = useCallback(async (file?: File) => {
    if (!file) return;

    setIsUploadingUserAvatar(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const response = await fetch("/api/upload-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await readJson<{ url?: string }>(response);

      if (data.url) setCurrentUserAvatarUrl(data.url);
    } catch (error) {
      console.warn("头像上传失败", error);
    } finally {
      setIsUploadingUserAvatar(false);
    }
  }, []);

  const activeSession = sessions.find((session) => session.id === activeSessionId && !isDeletedSession(session)) ?? sessions.find((session) => !isDeletedSession(session)) ?? sessions[0];
  const activeWorkflowItems = sortByUpdatedAtDesc(workflowItems.filter((item) => !isDeletedWorkflow(item)));
  const activeWorkflow = activeWorkflowItems.find((item) => item.id === activeWorkflowId) ?? activeWorkflowItems[0];
  const messages = activeSession?.messages ?? initialMessages;
  const activeInput = activeSession?.draftInput ?? "";
  const activeInputLength = Array.from(activeInput).length;
  const toolbarRequiredWidth = mode === "agent" ? 800 : Math.min(1006, 610 + selectedGenerationModelLabel.length * 8 + (mode === "video" ? 90 : 70));
  const inputShellWidth = Math.max(toolbarRequiredWidth, 800 + Math.min(206, Math.max(0, activeInputLength - 650) * 0.42));
  const activeUploadedFiles = activeSession?.uploadedFiles ?? [];
  const activeUploadedImages = activeSession?.uploadedImages ?? [];
  const hasReadingUploadedFiles = activeUploadedFiles.some((file) => typeof file !== "string" && file.status === "reading");
  const hasUploadingInputs = activeUploadedImages.some((image) => image.uploadStatus === "uploading") || activeUploadedFiles.some((file) => typeof file !== "string" && file.uploadStatus === "uploading");
  const hasFailedUploadInputs = activeUploadedImages.some((image) => image.uploadStatus === "error") || activeUploadedFiles.some((file) => typeof file !== "string" && file.uploadStatus === "error");
  const activeSessionIdValue = activeSession?.id ?? "";
  const resolvedTheme: "light" | "dark" = themeMode === "system" ? systemPrefersDark ? "dark" : "light" : themeMode;
  const themeModeLabel = themeMode === "dark" ? "深色模式" : themeMode === "system" ? `跟随系统 · ${resolvedTheme === "dark" ? "深色" : "浅色"}` : "浅色模式";
  const ThemeModeIcon = themeMode === "dark" ? RiMoonLine : themeMode === "system" ? RiComputerLine : RiSunLine;
  const quickActionRows = useMemo(() => getQuickActionRows(activeSessionIdValue), [activeSessionIdValue]);
  const activeConversationImageReferences = useMemo(() => getConversationImageReferences(messages), [messages]);
  const assetNameByUrl = useMemo(() => new Map(assets.map((asset) => [normalizeMediaUrlForMatch(asset.url), asset.name])), [assets]);
  const getCanonicalMediaName = useCallback((message: Message, url: string, fallbackName: string) => assetNameByUrl.get(normalizeMediaUrlForMatch(url)) ?? getMediaSystemName(message, url, fallbackName), [assetNameByUrl]);

  useEffect(() => {
    if (activePanel !== "workflow") return;
    const nextActiveWorkflowId = activeWorkflowItems.some((item) => item.id === activeWorkflowId) ? activeWorkflowId : activeWorkflowItems[0]?.id ?? "";
    if (nextActiveWorkflowId !== activeWorkflowId) setActiveWorkflowId(nextActiveWorkflowId);
  }, [activePanel, activeWorkflowId, activeWorkflowItems]);
  const updateUploadedRowScrollState = useCallback(() => {
    const filesRow = uploadedFilesRowRef.current;
    const imagesRow = uploadedImagesRowRef.current;

    if (filesRow) {
      setCanScrollUploadedFiles({
        left: filesRow.scrollLeft > 1,
        right: filesRow.scrollLeft + filesRow.clientWidth < filesRow.scrollWidth - 1,
      });
    } else {
      setCanScrollUploadedFiles({ left: false, right: false });
    }

    if (imagesRow) {
      setCanScrollUploadedImages({
        left: imagesRow.scrollLeft > 1,
        right: imagesRow.scrollLeft + imagesRow.clientWidth < imagesRow.scrollWidth - 1,
      });
    } else {
      setCanScrollUploadedImages({ left: false, right: false });
    }
  }, []);
  const scrollUploadedRow = useCallback((kind: "files" | "images", direction: -1 | 1) => {
    const row = kind === "files" ? uploadedFilesRowRef.current : uploadedImagesRowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * Math.max(180, row.clientWidth * 0.72), behavior: "smooth" });
    window.setTimeout(updateUploadedRowScrollState, 220);
  }, [updateUploadedRowScrollState]);
  const updateAssetGenerateReferenceScrollState = useCallback(() => {
    const row = assetGenerateReferencesRowRef.current;
    if (!row) {
      setCanScrollAssetGenerateReferences({ left: false, right: false });
      return;
    }

    setCanScrollAssetGenerateReferences({
      left: row.scrollLeft > 1,
      right: row.scrollLeft + row.clientWidth < row.scrollWidth - 1,
    });
  }, []);
  const scrollAssetGenerateReferences = useCallback((direction: -1 | 1) => {
    const row = assetGenerateReferencesRowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * Math.max(160, row.clientWidth * 0.72), behavior: "smooth" });
    window.setTimeout(updateAssetGenerateReferenceScrollState, 220);
  }, [updateAssetGenerateReferenceScrollState]);
  const removeAssetGenerateReference = useCallback((name: string) => {
    const pattern = new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=\\s|$)\\s?`, "g");
    const nextPrompt = characterGeneratePrompt.replace(pattern, (match, prefix: string) => prefix ? prefix : "").replace(/\s{2,}/g, " ").trimStart();
    setActiveAssetGeneratePrompt(nextPrompt);
    setCharacterPromptCursorOffset(Math.min(characterPromptCursorOffset, nextPrompt.length));
  }, [characterGeneratePrompt, characterPromptCursorOffset, setActiveAssetGeneratePrompt]);
  const getWorkflowPreviewAsset = useCallback((workflow: WorkflowItem, node: WorkflowNode, kind: "image" | "video", url: string, asset?: AssetItem): AssetItem => {
    const nodeName = node.data.mediaSystemNames?.[url];
    const fallbackName = kind === "video" ? "视频生成" : "图片生成";
    const name = nodeName || asset?.systemName || asset?.name || fallbackName;
    const assetPrompt = asset?.sourcePrompt?.trim() ?? "";
    const sourcePrompt = assetPrompt && !isInvalidPersistedPrompt(assetPrompt) ? assetPrompt : getWorkflowNodeSourcePrompt(workflow, node);
    const previewMeta = getWorkflowPreviewMeta(kind, node, url, asset);

    if (asset) {
      return {
        ...asset,
        name,
        systemName: asset.systemName || nodeName || name,
        sourcePrompt,
        posterUrl: kind === "video" ? asset.posterUrl || node.data.posterUrl : asset.posterUrl,
        previewMeta,
        sessionId: asset.sessionId || workflow.id,
        workflowId: asset.workflowId || workflow.id,
        workflowNodeId: asset.workflowNodeId || node.id,
      };
    }

    return {
      id: `${workflow.id}-${node.id}-${kind}-${normalizeMediaUrlForMatch(url)}`,
      type: kind === "video" ? "shot_video" : "other",
      name,
      systemName: nodeName || name,
      url,
      posterUrl: kind === "video" ? node.data.posterUrl : undefined,
      librarySource: "workflow",
      sourcePrompt,
      promptSource: "generated",
      previewMeta,
      sessionId: workflow.id,
      workflowId: workflow.id,
      workflowNodeId: node.id,
      lockedType: true,
      createdAt: workflow.updatedAt ?? Date.now(),
    };
  }, []);
  const getCanonicalPreviewAsset = useCallback((asset: AssetItem): AssetItem => {
    if (isUploadedAsset(asset)) return { ...asset, previewMeta: undefined };

    const normalizedAssetUrl = normalizeMediaUrlForMatch(asset.url);
    const sourceSession = sessions.find((session) => session.id === asset.sessionId && session.messages.some((message) => message.id === asset.messageId || messageHasMediaUrl(message, asset.url))) ?? sessions.find((session) => session.messages.some((message) => message.id === asset.messageId || messageHasMediaUrl(message, asset.url)));
    const sourceMessage = sourceSession?.messages.find((message) => message.role === "assistant" && (message.id === asset.messageId || messageHasMediaUrl(message, asset.url)));
    if (!sourceSession || !sourceMessage) return asset;

    const matchedVideoUrl = getMessageVideos(sourceMessage).find((url) => normalizeMediaUrlForMatch(url) === normalizedAssetUrl);
    const matchedImageUrl = (sourceMessage.images ?? []).find((url) => normalizeMediaUrlForMatch(url) === normalizedAssetUrl);
    const mediaUrl = matchedVideoUrl ?? matchedImageUrl ?? asset.url;
    const isVideo = Boolean(matchedVideoUrl);

    return {
      ...asset,
      name: asset.name || getMediaSystemName(sourceMessage, mediaUrl, asset.name),
      sourcePrompt: isVideo ? sourceMessage.videoPrompts?.[mediaUrl] ?? sourceMessage.generationMeta?.originalPrompt ?? sourceMessage.content : getImageSourcePrompt(sourceMessage, mediaUrl),
      posterUrl: isVideo ? getVideoPosterForMessage(sourceMessage, mediaUrl) ?? asset.posterUrl : asset.posterUrl,
      previewMeta: getPreviewMediaMeta(sourceMessage, isVideo ? undefined : mediaUrl),
      sessionId: sourceSession.id,
      messageId: sourceMessage.id,
    };
  }, [sessions]);
  const visibleAssetUploadSlots = normalizeAssetUploadSlots(assetUploadSlots, getDefaultAssetUploadType(assetFilter));
  const previewMediaOptions = useMemo(() => {
    if (previewAsset?.librarySource === "workflow") {
      const workflowId = previewAsset.workflowId || previewAsset.sessionId;
      const workflow = workflowItems.find((item) => item.id === workflowId);
      if (workflow?.canvas?.nodes?.length) {
        return workflow.canvas.nodes.flatMap((node) => {
          const imageItems = (node.data.images ?? []).map((url, imageIndex) => {
            const existingAsset = assets.find((asset) => isWorkflowAsset(asset) && normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(url));
            const item = getWorkflowPreviewAsset(workflow, node, "image", url, existingAsset);
            return imageIndex === 0 ? item : { ...item, id: `${item.id}-${imageIndex}` };
          });
          const videoItem = node.data.videoUrl ? (() => {
            const existingAsset = assets.find((asset) => isWorkflowAsset(asset) && normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(node.data.videoUrl as string));
            return [getWorkflowPreviewAsset(workflow, node, "video", node.data.videoUrl as string, existingAsset)];
          })() : [];
          return [...imageItems, ...videoItem];
        });
      }
    }

    const isAssetLibraryPreview = Boolean(previewAsset && assets.some((asset) => asset.id === previewAsset.id));
    if (isAssetLibraryPreview) {
      return assets.filter((asset) => {
        if (isAssetTrashExpired(asset, timerNow)) return false;
        return isAssetInFilter(asset, assetFilter);
      }).map(getCanonicalPreviewAsset);
    }

    return messages.flatMap((message) => {
      if (message.role !== "assistant") return [];

      const imageItems = getDisplayImageItemsForMessage(message).map(({ url, imageIndex }) => ({
        id: `${message.id}-${imageIndex}`,
        type: "other" as const,
        name: getCanonicalMediaName(message, url, `生成图片${imageIndex + 1}`),
        url,
        posterUrl: undefined,
        sourcePrompt: getImageSourcePrompt(message, url),
        previewMeta: getPreviewMediaMeta(message, url),
        sessionId: activeSessionIdValue,
        messageId: message.id,
        createdAt: message.createdAt ?? 0,
      }));

      const videoItem = getMessageVideos(message).map((url, videoIndex) => ({
        id: `${message.id}-video-${videoIndex}`,
        type: "shot_video" as const,
        name: getCanonicalMediaName(message, url, `生成视频${videoIndex + 1}`),
        url,
        posterUrl: getVideoPosterForMessage(message, url),
        sourcePrompt: message.videoPrompts?.[url] ?? message.generationMeta?.itemPrompts?.[videoIndex] ?? message.generationMeta?.originalPrompt ?? message.content,
        previewMeta: getPreviewMediaMeta(message),
        sessionId: activeSessionIdValue,
        messageId: message.id,
        createdAt: message.createdAt ?? 0,
      }));

      return [...imageItems, ...videoItem];
    });
  }, [activeSessionIdValue, assetFilter, assets, getCanonicalMediaName, getCanonicalPreviewAsset, getWorkflowPreviewAsset, messages, previewAsset, timerNow, workflowItems]);
  const enrichAssetPreviewMeta = getCanonicalPreviewAsset;
  const previewAssetId = previewAsset?.id;
  const previewDisplayMeta = previewAsset ? enrichAssetPreviewMeta(previewAsset).previewMeta : undefined;
  const previewIsUploadedAsset = previewAsset ? isUploadedAsset(previewAsset) : false;
  const isPreviewDownloadReady = Boolean(previewAsset?.url);
  const previewSourceLabel = previewAsset && !previewDisplayMeta ? previewAsset.promptSource === "upload" || isUploadPromptPlaceholder(previewAsset.sourcePrompt) ? UPLOAD_IMAGE_PROMPT_PLACEHOLDER : "" : "";
  const previewHasReversedUploadPrompt = Boolean(previewAsset?.sourcePrompt.trim()) && previewAsset?.promptSource === "reverse" && previewIsUploadedAsset;
  const previewHasUsablePrompt = Boolean(previewAsset?.sourcePrompt.trim()) && !isUploadPromptPlaceholder(previewAsset?.sourcePrompt) && (!previewIsUploadedAsset || previewHasReversedUploadPrompt);
  const previewPromptText = previewHasUsablePrompt ? previewAsset?.sourcePrompt.trim() ?? "" : "";
  const canReversePreviewPrompt = Boolean(previewAsset && !isVideoAsset(previewAsset) && previewIsUploadedAsset && !previewHasUsablePrompt);
  const previewPromptErrorText = previewPromptError && previewPromptError.assetId === previewAssetId ? previewPromptError.message : "";
  const previewBytePlusErrorText = bytePlusAssetError && bytePlusAssetError.assetId === previewAssetId ? bytePlusAssetError.message : "";
  const previewBytePlusStatusText = previewAsset?.bytePlusAssetStatus === "Active" ? "审核通过" : previewAsset?.bytePlusAssetStatus === "Failed" ? "审核失败" : previewAsset?.bytePlusAssetStatus === "Processing" ? "审核中" : "未提交";
  const canReviewBytePlusAsset = Boolean(previewAsset && !isVideoAsset(previewAsset) && (previewAsset.type === "character_image" || previewAsset.type === "shot_image" || isConversationUploadedAsset(previewAsset)));
  const canSubmitBytePlusAsset = Boolean(ENABLE_BYTEPLUS_ASSET_REVIEW && canReviewBytePlusAsset && previewAsset && !previewAsset.bytePlusAssetId);
  const canRefreshBytePlusAsset = Boolean(ENABLE_BYTEPLUS_ASSET_REVIEW && canReviewBytePlusAsset && previewAsset && previewAsset.bytePlusAssetId && previewAsset.bytePlusAssetStatus !== "Active");
  const validReferenceNames = new Set([...getValidReferenceNames(assets, activeUploadedImages, activeConversationImageReferences), ...getUploadedMediaReferences(activeUploadedFiles).map((reference) => reference.name)]);
  const hasAnyConversationRunning = resolvingSessionIds.size > 0 || sessions.some((session) => getSessionPendingRequests(session).length > 0) || Boolean(modelInfoSessionId);
  const hasAnyAssetGenerating = assetGenerateJobs.some((job) => job.result.status === "generating");
  const hasAnyWorkflowGenerating = activeWorkflowItems.some((workflow) => workflow.canvas?.nodes?.some((node) => node.data.isRunning));
  const hasAnyGenerationRunning = hasAnyConversationRunning || hasAnyAssetGenerating || hasAnyWorkflowGenerating;
  const characterValidReferenceNames = getValidReferenceNames(assets, [], []);
  const assetGenerateReferenceImages = useMemo(() => getOrderedExplicitImageReferences(characterGeneratePrompt, assets, [], []), [assets, characterGeneratePrompt]);
  const characterAtQuery = getAtQueryAtCursor(characterGeneratePrompt, characterPromptCursorOffset);
  const characterAtAssetSearch = characterAtQuery?.query ?? "";
  const characterAtAssetGroups = isCharacterAtAssetMenuOpen
    ? mentionAssetTypes.map((type) => ({
        type,
        assets: assets.filter((asset) => isMentionGroupAsset(asset, type) && asset.name.includes(characterAtAssetSearch)),
      }))
    : [];
  const hasCharacterAtAssetOptions = characterAtAssetGroups.some((group) => group.assets.length > 0) && isCharacterAtAssetMenuOpen;
  const activeCharacterAtAssetGroup = characterAtAssetGroups.find((group) => group.type === characterAtAssetFilter && group.assets.length > 0) ?? characterAtAssetGroups.find((group) => group.assets.length > 0);
  const characterGenerateStyleLabel = characterGenerateStyle === "2d" ? "2D风格" : characterGenerateStyle === "3d" ? "3D风格" : "写实风格";
  const characterPreviewMeta: PreviewMediaMeta = useMemo(() => ({
    modelLabel: getGenerationModelLabel("image", characterGenerateModel),
    ratio: assetGenerateRatioLabel,
    sizeText: `${characterGenerateDisplayDimensions.width} × ${characterGenerateDisplayDimensions.height}`,
    resolution: characterGenerateDisplayResolution,
    mode: "image",
    qualityBadgeLabel: characterGenerateQualityBadgeLabel,
    styleLabel: characterGenerateStyleLabel,
  }), [assetGenerateRatioLabel, characterGenerateDisplayDimensions.height, characterGenerateDisplayDimensions.width, characterGenerateDisplayResolution, characterGenerateModel, characterGenerateQualityBadgeLabel, characterGenerateStyleLabel]);
  const characterPreviewFrameStyle: CSSProperties = useMemo(() => ({
    aspectRatio: `${characterGenerateDisplayDimensions.width} / ${characterGenerateDisplayDimensions.height}`,
    width: characterGenerateRatio === "single" ? "min(calc((100vh - 190px) * 0.5625), calc(100vw - 470px), 720px)" : "min(calc(100vh - 190px), calc(100vw - 470px), 1180px)",
    maxWidth: "calc(100% - 24px)",
    maxHeight: "calc(100% - 24px)",
  }), [characterGenerateDisplayDimensions.height, characterGenerateDisplayDimensions.width, characterGenerateRatio]);
  const hasCharacterGeneratedImage = characterGenerateResult.status === "succeeded" && Boolean(characterGenerateResult.url);
  const isCharacterGenerating = characterGenerateResult.status === "generating";
  const isCharacterGenerateInputDisabled = isCharacterGenerating || isCharacterPromptOptimizing;
  const visibleCharacterImageScale = characterImageFitMode === "fit" ? characterImageFitScale : characterImageScale;
  const characterImageScalePercent = hasCharacterGeneratedImage ? `${Math.round(visibleCharacterImageScale * 100)}%` : "适合";
  const hasConversation = messages.length > 0;
  const isActiveSessionLoading = activeSession?.messagesLoaded === false || (activeSession ? loadingSessionIds.has(activeSession.id) : false);
  const activeSessionLoadingStartedAt = activeSession ? loadingSessionStartedAt[activeSession.id] ?? timerNow : timerNow;
  const activeSessionLoadingProgress = isActiveSessionLoading ? Math.min(96, Math.floor(Math.max(0, timerNow - activeSessionLoadingStartedAt) / 180)) : 100;
  const activeIsResolving = activeSession ? resolvingSessionIds.has(activeSession.id) : false;
  const activePendingRequests = getSessionPendingRequests(activeSession);
  const activePendingRequestCount = activePendingRequests.length;
  const activeHasMaxPendingRequests = activePendingRequestCount >= MAX_SESSION_PENDING_REQUESTS;
  const isThinking = activeIsResolving || activePendingRequests.some((request) => request.mode === "agent" || request.mode === "general") || modelInfoSessionId === activeSession?.id;
  const isMainInputDisabled = isThinking || isInputPromptOptimizing;
  const activeIsSending = activeSession ? sendingSessionIds.has(activeSession.id) : false;

  useEffect(() => {
    previewAssetRef.current = previewAsset;
  }, [previewAsset]);

  useEffect(() => {
    if (!previewAsset) return;
    const latest = previewMediaOptions.find((item) => item.id === previewAsset.id || normalizeMediaUrlForMatch(item.url) === normalizeMediaUrlForMatch(previewAsset.url));
    const latestPreviewMetaKey = latest?.previewMeta ? JSON.stringify(latest.previewMeta) : "";
    const currentPreviewMetaKey = previewAsset.previewMeta ? JSON.stringify(previewAsset.previewMeta) : "";
    if (!latest || (latest.name === previewAsset.name && latest.url === previewAsset.url && latest.posterUrl === previewAsset.posterUrl && latest.sourcePrompt === previewAsset.sourcePrompt && latestPreviewMetaKey === currentPreviewMetaKey)) return;
    const timer = window.setTimeout(() => {
      setPreviewAsset((current) => {
        if (!current || (current.id !== previewAsset.id && normalizeMediaUrlForMatch(current.url) !== normalizeMediaUrlForMatch(previewAsset.url))) return current;
        const currentMetaKey = current.previewMeta ? JSON.stringify(current.previewMeta) : "";
        if (current.name === latest.name && current.url === latest.url && current.posterUrl === latest.posterUrl && current.sourcePrompt === latest.sourcePrompt && currentMetaKey === latestPreviewMetaKey && current.sessionId === latest.sessionId && current.messageId === latest.messageId) return current;
        return { ...current, name: latest.name, url: latest.url, posterUrl: latest.posterUrl, sourcePrompt: latest.sourcePrompt, previewMeta: latest.previewMeta, sessionId: latest.sessionId, messageId: latest.messageId };
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [previewAsset, previewMediaOptions]);

  const clampPreviewScale = useCallback((value: number) => Math.min(2.5, Math.max(0.1, Number(value.toFixed(2)))), []);
  const applyPreviewScale = useCallback((nextScale: number) => {
    setPreviewScale(clampPreviewScale(nextScale));
  }, [clampPreviewScale]);
  const resetPreviewTransform = useCallback(() => {
    setPreviewFitMode("fit");
    setPreviewScale(1);
    setPreviewPan({ x: 0, y: 0 });
    setPreviewNaturalSize({ width: 0, height: 0 });
    setPreviewFitScale(1);
    setIsPreviewDragging(false);
  }, []);
  const applyCharacterImageScale = useCallback((nextScale: number) => {
    setCharacterImageScale(clampPreviewScale(nextScale));
  }, [clampPreviewScale]);
  const visiblePreviewScale = previewFitMode === "fit" ? previewFitScale : previewScale;
  const previewScalePercent = `${Math.round(visiblePreviewScale * 100)}%`;
  const previewLightToolButtonStyle = resolvedTheme === "dark" ? {
    borderColor: "rgba(210, 210, 210, 0.72)",
    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.34), rgba(232, 234, 238, 0.42))",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.72), inset 0 -1px 0 rgba(255, 255, 255, 0.2)",
    color: "#777777",
  } as CSSProperties : undefined;

  const updateCharacterImageFitScale = useCallback((dimensions = characterImageNaturalSize) => {
    if (!hasCharacterGeneratedImage || !dimensions.width || !dimensions.height) return;

    const viewport = characterViewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const styles = window.getComputedStyle(viewport);
    const availableWidth = rect.width - Number.parseFloat(styles.paddingLeft) - Number.parseFloat(styles.paddingRight);
    const availableHeight = rect.height - Number.parseFloat(styles.paddingTop) - Number.parseFloat(styles.paddingBottom);
    if (availableWidth <= 0 || availableHeight <= 0) return;

    setCharacterImageFitScale(clampPreviewScale(Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height)));
  }, [characterImageNaturalSize, clampPreviewScale, hasCharacterGeneratedImage]);

  const updatePreviewFitScale = useCallback((dimensions = previewNaturalSize) => {
    if (!previewAsset || isVideoAsset(previewAsset) || !dimensions.width || !dimensions.height) return;

    const viewport = previewViewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const styles = window.getComputedStyle(viewport);
    const availableWidth = rect.width - Number.parseFloat(styles.paddingLeft) - Number.parseFloat(styles.paddingRight);
    const availableHeight = rect.height - Number.parseFloat(styles.paddingTop) - Number.parseFloat(styles.paddingBottom);
    if (availableWidth <= 0 || availableHeight <= 0) return;

    setPreviewFitScale(clampPreviewScale(Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height)));
  }, [clampPreviewScale, previewAsset, previewNaturalSize]);

  useEffect(() => {
    if (!previewAssetId) return;
    const frame = window.requestAnimationFrame(() => {
      resetPreviewTransform();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [previewAssetId, resetPreviewTransform]);

  useEffect(() => {
    if (!previewAsset || isVideoAsset(previewAsset)) return;

    const frame = window.requestAnimationFrame(() => {
      const image = previewImageRef.current;
      if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
      if (normalizeMediaUrlForMatch(image.currentSrc || image.src) !== normalizeMediaUrlForMatch(previewAsset.url)) return;

      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      setPreviewNaturalSize((current) => current.width === dimensions.width && current.height === dimensions.height ? current : dimensions);
      updatePreviewFitScale(dimensions);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [previewAsset, updatePreviewFitScale]);

  useEffect(() => {
    if (!hasCharacterGeneratedImage) return;
    const frame = window.requestAnimationFrame(() => {
      setCharacterImageFitMode("fit");
      setCharacterImageScale(1);
      setCharacterImagePan({ x: 0, y: 0 });
      setCharacterImageFitScale(1);
      setIsCharacterImageDragging(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [characterGenerateResult.url, hasCharacterGeneratedImage]);

  useEffect(() => {
    if (!hasCharacterGeneratedImage) return;

    const handleResize = () => updateCharacterImageFitScale();

    updateCharacterImageFitScale();
    const resizeObserver = new ResizeObserver(handleResize);
    if (characterViewportRef.current) resizeObserver.observe(characterViewportRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [hasCharacterGeneratedImage, updateCharacterImageFitScale]);

  useEffect(() => {
    if (!previewAsset || previewMediaOptions.length <= 1) return;

    const updateThumbScrollState = () => {
      const availableHeight = Math.max(166, window.innerHeight - 320);
      const nextPageSize = Math.max(1, Math.floor((availableHeight + 8) / 58));
      setPreviewThumbPageSize((current) => current === nextPageSize ? current : nextPageSize);
    };

    updateThumbScrollState();
    window.addEventListener("resize", updateThumbScrollState);

    return () => {
      window.removeEventListener("resize", updateThumbScrollState);
    };
  }, [previewAsset, previewMediaOptions.length]);

  useEffect(() => {
    if (!previewAsset || previewMediaOptions.length <= 1) return;
    const currentIndex = previewMediaOptions.findIndex((item) => item.id === previewAsset.id || normalizeMediaUrlForMatch(item.url) === normalizeMediaUrlForMatch(previewAsset.url));
    if (currentIndex < 0) return;
    if (currentIndex >= previewThumbPageStart && currentIndex < previewThumbPageStart + previewThumbPageSize) return;
    const timer = window.setTimeout(() => setPreviewThumbPageStart(Math.floor(currentIndex / previewThumbPageSize) * previewThumbPageSize), 0);
    return () => window.clearTimeout(timer);
  }, [previewAsset, previewMediaOptions, previewThumbPageSize, previewThumbPageStart]);

  useEffect(() => {
    const maxStart = Math.max(0, previewMediaOptions.length - 1);
    if (previewThumbPageStart <= maxStart) return;
    const timer = window.setTimeout(() => setPreviewThumbPageStart(maxStart), 0);
    return () => window.clearTimeout(timer);
  }, [previewMediaOptions.length, previewThumbPageStart]);

  useEffect(() => {
    if (!previewAsset || isVideoAsset(previewAsset)) return;

    const handleResize = () => updatePreviewFitScale();

    updatePreviewFitScale();
    const resizeObserver = new ResizeObserver(handleResize);
    if (previewViewportRef.current) resizeObserver.observe(previewViewportRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [previewAsset, updatePreviewFitScale]);

  const shiftPreviewAsset = useCallback((direction: number) => {
    if (!previewAsset || previewMediaOptions.length <= 1) return;
    const currentIndex = previewMediaOptions.findIndex((item) => item.id === previewAsset.id || normalizeMediaUrlForMatch(item.url) === normalizeMediaUrlForMatch(previewAsset.url));
    if (currentIndex < 0) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= previewMediaOptions.length) return;
    const visibleEnd = Math.min(previewMediaOptions.length - 1, previewThumbPageStart + previewThumbPageSize - 1);
    let nextPageStart = previewThumbPageStart;

    if (direction > 0 && currentIndex >= visibleEnd) nextPageStart = nextIndex;
    if (direction < 0 && currentIndex <= previewThumbPageStart) nextPageStart = Math.max(0, nextIndex - previewThumbPageSize + 1);

    setPreviewThumbPageStart(nextPageStart);
    resetPreviewTransform();
    setPreviewAsset(previewMediaOptions[nextIndex]);
  }, [previewAsset, previewMediaOptions, previewThumbPageSize, previewThumbPageStart, resetPreviewTransform]);

  const pagePreviewThumbs = useMemo(() => previewMediaOptions.slice(previewThumbPageStart, previewThumbPageStart + previewThumbPageSize), [previewMediaOptions, previewThumbPageSize, previewThumbPageStart]);
  const previewThumbsNeedScroll = previewMediaOptions.length > previewThumbPageSize;
  const pagePreviewThumbListHeight = Math.max(0, previewThumbPageSize * 50 + Math.max(0, previewThumbPageSize - 1) * 8);
  const previewThumbPreloadCount = Math.min(previewMediaOptions.length, Math.max(previewThumbPageSize * 2, previewThumbPageStart + previewThumbPageSize * 2));
  const canPagePreviewThumbsUp = previewThumbPageStart > 0;
  const canPagePreviewThumbsDown = previewThumbPageStart + previewThumbPageSize < previewMediaOptions.length;
  useEffect(() => {
    if (!previewAsset || previewMediaOptions.length <= 1) return;

    for (const item of previewMediaOptions.slice(0, previewThumbPreloadCount)) {
      if (isVideoAsset(item)) continue;
      const key = normalizeMediaUrlForMatch(item.url);
      if (!key || preloadedPreviewThumbUrlsRef.current.has(key)) continue;
      preloadedPreviewThumbUrlsRef.current.add(key);
      const image = new window.Image();
      image.decoding = "async";
      image.src = item.url;
    }
  }, [previewAsset, previewMediaOptions, previewThumbPreloadCount]);

  const pagePreviewThumbsByButton = useCallback((direction: number) => {
    if (previewMediaOptions.length <= previewThumbPageSize) return;
    if (direction > 0 && !canPagePreviewThumbsDown) return;
    if (direction < 0 && !canPagePreviewThumbsUp) return;

    const nextStart = direction > 0 ? previewThumbPageStart + previewThumbPageSize : Math.max(0, previewThumbPageStart - previewThumbPageSize);
    const nextIndex = direction > 0 ? nextStart : Math.min(previewMediaOptions.length - 1, nextStart + previewThumbPageSize - 1);
    setPreviewThumbPageStart(nextStart);
    resetPreviewTransform();
    setPreviewAsset(previewMediaOptions[nextIndex]);
  }, [canPagePreviewThumbsDown, canPagePreviewThumbsUp, previewMediaOptions, previewThumbPageSize, previewThumbPageStart, resetPreviewTransform]);

  const copyPreviewPrompt = useCallback(async () => {
    if (!previewPromptText) return;
    try {
      await navigator.clipboard.writeText(previewPromptText);
      setPreviewPromptCopyState("success");
    } catch {
      setPreviewPromptCopyState("error");
    }
    window.setTimeout(() => setPreviewPromptCopyState("idle"), 1200);
  }, [previewPromptText]);

  const setSessionSending = useCallback((sessionId: string, isSending: boolean) => {
    if (isSending) {
      sendingSessionIdsRef.current.add(sessionId);
    } else {
      sendingSessionIdsRef.current.delete(sessionId);
    }

    setSendingSessionIds((current) => {
      const next = new Set(current);
      if (isSending) {
        next.add(sessionId);
      } else {
        next.delete(sessionId);
      }
      return next;
    });
  }, []);

  const showInputTip = useCallback((message: string) => {
    const nextTip: ReminderMessage = { message, tone: "default" };
    const currentTip = inputCurrentTipRef.current;

    if (inputTipTimerRef.current !== null || currentTip) {
      if (currentTip?.message === nextTip.message && currentTip.tone === nextTip.tone) return;
      const lastQueuedTip = inputTipQueueRef.current[inputTipQueueRef.current.length - 1];
      if (lastQueuedTip?.message === nextTip.message && lastQueuedTip.tone === nextTip.tone) return;
      inputTipQueueRef.current.push(nextTip);
      return;
    }

    inputCurrentTipRef.current = nextTip;
    setInputReminder(nextTip);
    inputTipTimerRef.current = window.setTimeout(() => {
      setInputReminder((current) => current ? { ...current, exiting: true } : current);
      inputTipTimerRef.current = window.setTimeout(() => {
        inputCurrentTipRef.current = undefined;
        if (inputTipQueueRef.current.length > 0) {
          showNextInputTipRef.current?.();
          return;
        }

        setInputReminder(undefined);
        inputTipTimerRef.current = null;
      }, 100);
    }, 3000);
  }, []);

  useEffect(() => {
    showNextInputTipRef.current = () => {
      const nextTip = inputTipQueueRef.current.shift();
      if (!nextTip) {
        setInputReminder(undefined);
        inputTipTimerRef.current = null;
        return;
      }

      inputCurrentTipRef.current = nextTip;
      setInputReminder(nextTip);
      if (inputTipTimerRef.current !== null) {
        window.clearTimeout(inputTipTimerRef.current);
      }
      inputTipTimerRef.current = window.setTimeout(() => {
        setInputReminder((current) => current ? { ...current, exiting: true } : current);
        inputTipTimerRef.current = window.setTimeout(() => {
          inputCurrentTipRef.current = undefined;
          if (inputTipQueueRef.current.length > 0) {
            showNextInputTipRef.current?.();
            return;
          }

          setInputReminder(undefined);
          inputTipTimerRef.current = null;
        }, 100);
      }, 2000);
    };
  }, []);

  const showAssetUploadTipNow = useCallback((tip: ReminderMessage) => {
    assetUploadCurrentTipRef.current = tip;
    setAssetUploadTip(tip);
    if (assetUploadTipTimerRef.current !== null) {
      window.clearTimeout(assetUploadTipTimerRef.current);
    }
    assetUploadTipTimerRef.current = window.setTimeout(() => {
      setAssetUploadTip((current) => current ? { ...current, exiting: true } : current);
      assetUploadTipTimerRef.current = window.setTimeout(() => {
        assetUploadCurrentTipRef.current = undefined;
        if (assetUploadTipQueueRef.current.length > 0) {
          showNextAssetUploadTipRef.current?.();
          return;
        }
        setAssetUploadTip(undefined);
        assetUploadTipTimerRef.current = null;
      }, 100);
    }, 2000);
  }, []);
  useEffect(() => {
    showNextAssetUploadTipRef.current = () => {
      const nextTip = assetUploadTipQueueRef.current.shift();
      if (!nextTip) {
        setAssetUploadTip(undefined);
        assetUploadTipTimerRef.current = null;
        return;
      }
      showAssetUploadTipNow(nextTip);
    };
  }, [showAssetUploadTipNow]);

  const showAssetUploadTip = useCallback((message: string, tone: ReminderMessage["tone"] = "default") => {
    const nextTip = { message, tone };
    const currentTip = assetUploadCurrentTipRef.current;

    if (assetUploadTipTimerRef.current !== null || currentTip) {
      if (currentTip?.message === nextTip.message && currentTip.tone === nextTip.tone) return;
      const lastQueuedTip = assetUploadTipQueueRef.current[assetUploadTipQueueRef.current.length - 1];
      if (lastQueuedTip?.message === nextTip.message && lastQueuedTip.tone === nextTip.tone) return;
      assetUploadTipQueueRef.current.push(nextTip);
      return;
    }

    showAssetUploadTipNow(nextTip);
  }, [showAssetUploadTipNow]);

  const showGenerationCompleteTipNow = useCallback((tip: ReminderMessage) => {
    generationCompleteCurrentTipRef.current = tip;
    setGenerationCompleteReminder(tip);
    if (generationCompleteTipTimerRef.current !== null) {
      window.clearTimeout(generationCompleteTipTimerRef.current);
    }
    generationCompleteTipTimerRef.current = window.setTimeout(() => {
      setGenerationCompleteReminder((current) => current ? { ...current, exiting: true } : current);
      generationCompleteTipTimerRef.current = window.setTimeout(() => {
        generationCompleteCurrentTipRef.current = undefined;
        if (generationCompleteTipQueueRef.current.length > 0) {
          showNextGenerationCompleteTipRef.current?.();
          return;
        }
        setGenerationCompleteReminder(undefined);
        generationCompleteTipTimerRef.current = null;
      }, 100);
    }, 2000);
  }, []);

  useEffect(() => {
    showNextGenerationCompleteTipRef.current = () => {
      const nextTip = generationCompleteTipQueueRef.current.shift();
      if (!nextTip) {
        setGenerationCompleteReminder(undefined);
        generationCompleteTipTimerRef.current = null;
        return;
      }
      showGenerationCompleteTipNow(nextTip);
    };
  }, [showGenerationCompleteTipNow]);

  const showGenerationCompleteTip = useCallback((message: string) => {
    if (!notifyOnGenerationComplete) return;
    const nextTip: ReminderMessage = { message, tone: "success" };
    const currentTip = generationCompleteCurrentTipRef.current;

    if (generationCompleteTipTimerRef.current !== null || currentTip) {
      if (currentTip?.message === nextTip.message && currentTip.tone === nextTip.tone) return;
      const lastQueuedTip = generationCompleteTipQueueRef.current[generationCompleteTipQueueRef.current.length - 1];
      if (lastQueuedTip?.message === nextTip.message && lastQueuedTip.tone === nextTip.tone) return;
      generationCompleteTipQueueRef.current.push(nextTip);
      return;
    }

    showGenerationCompleteTipNow(nextTip);
  }, [notifyOnGenerationComplete, showGenerationCompleteTipNow]);

  const notifyGenerationCompleteOnce = useCallback((requestId: string, message: string) => {
    if (completedNotificationRequestIdsRef.current.has(requestId)) return;
    completedNotificationRequestIdsRef.current.add(requestId);
    showGenerationCompleteTip(message);
  }, [showGenerationCompleteTip]);

  const openAssetUploadDialog = useCallback(() => {
    const defaultType = getDefaultAssetUploadType(assetFilter);
    setAssetUploadSlots(createAssetUploadSlots(defaultType));
    setActiveAssetUploadIndex(0);
    setIsAssetUploadOpen(true);
    assetUploadTipQueueRef.current = [];
    assetUploadCurrentTipRef.current = undefined;
    setAssetUploadTip(undefined);
    if (assetUploadTipTimerRef.current !== null) {
      window.clearTimeout(assetUploadTipTimerRef.current);
      assetUploadTipTimerRef.current = null;
    }
    setOpenAssetActionMenuId("");
  }, [assetFilter]);

  const closeAssetUploadDialog = useCallback(() => {
    if (isAssetUploading) return;
    assetUploadAbortControllersRef.current.forEach((controller) => controller.abort());
    assetUploadAbortControllersRef.current.clear();
    const tempTokens = assetUploadSlots.map((slot) => slot.tempToken).filter((token): token is string => Boolean(token));
    void deleteTemporaryAssetImages(tempTokens);
    setIsAssetUploadOpen(false);
    setAssetUploadSlots(createAssetUploadSlots(getDefaultAssetUploadType(assetFilter)));
  }, [assetFilter, assetUploadSlots, isAssetUploading]);

  const selectAssetUploadFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      showAssetUploadTip("请选择图片文件");
      return;
    }

    try {
      const defaultType = getDefaultAssetUploadType(assetFilter);
      const newItems = await Promise.all(imageFiles.map(readFileAsAssetUploadItem));
      const newItemsWithDimensions = await Promise.all(newItems.map(async (item) => ({
        ...item,
        dimensions: await getDataUrlImageDimensions(item.dataUrl).catch(() => undefined),
      })));
      const normalizedSlots = normalizeAssetUploadSlots(assetUploadSlots, defaultType);
      const existingCount = normalizedSlots.filter((slot) => slot.dataUrl).length;
      const availableCount = Math.max(0, ASSET_UPLOAD_SLOT_COUNT - existingCount);
      const acceptedItems = newItemsWithDimensions.slice(0, availableCount);
      let itemIndex = 0;
      const nextSlots: AssetUploadSlot[] = normalizedSlots.map((slot) => {
        if (slot.dataUrl || itemIndex >= acceptedItems.length) return slot;
        const item = acceptedItems[itemIndex];
        itemIndex += 1;
        return { ...slot, fileName: item.fileName, originalFileName: item.fileName, dataUrl: item.dataUrl, uploadFile: item.file, dimensions: item.dimensions, isDuplicate: false, tempToken: undefined, uploadStatus: "uploading", uploadProgress: 6, error: undefined };
      });

      setAssetUploadSlots(nextSlots);
      setActiveAssetUploadIndex((current) => {
        const firstEmptyIndex = nextSlots.findIndex((slot) => !slot.dataUrl);
        return firstEmptyIndex >= 0 ? firstEmptyIndex : current;
      });
      if (newItemsWithDimensions.length > availableCount) showAssetUploadTip("最多同时上传8张");
    } catch (error) {
      showAssetUploadTip(toUserErrorMessage(error, "图片读取失败"));
    }
  }, [assetFilter, assetUploadSlots, showAssetUploadTip]);

  useEffect(() => {
    assetUploadSlots.forEach((slot) => {
      if (slot.uploadStatus !== "uploading" || !slot.uploadFile || assetUploadAbortControllersRef.current.has(slot.id)) return;

      const controller = new AbortController();
      assetUploadAbortControllersRef.current.set(slot.id, controller);
      void uploadTemporaryAssetImage(slot.uploadFile, (progress) => {
        setAssetUploadSlots((current) => current.map((item) => item.id === slot.id ? { ...item, uploadStatus: "uploading", uploadProgress: progress } : item));
      }, controller.signal, Boolean(slot.forceReencode))
        .then((tempToken) => {
          assetUploadAbortControllersRef.current.delete(slot.id);
          setAssetUploadSlots((current) => current.map((item) => item.id === slot.id ? { ...item, uploadFile: undefined, tempToken, uploadStatus: "ready", uploadProgress: 100, forceReencode: undefined, error: undefined } : item));
        })
        .catch((error) => {
          assetUploadAbortControllersRef.current.delete(slot.id);
          if (controller.signal.aborted) return;
          const errorMessage = toUserErrorMessage(error, "上传失败");
          reportClientDiagnostic("asset-upload-temp failed", { fileName: slot.fileName, error: errorMessage, rawError: error instanceof Error ? error.message : String(error) });
          setAssetUploadSlots((current) => current.map((item) => item.id === slot.id ? { ...item, uploadStatus: "error", uploadProgress: 100, error: errorMessage } : item));
        });
    });
  }, [assetUploadSlots]);

  const retryAssetUploadSlot = useCallback((index: number) => {
    const slot = assetUploadSlots[index];
    if (!slot?.uploadFile) {
      showAssetUploadTip("请重新选择图片");
      return;
    }
    assetUploadAbortControllersRef.current.get(slot.id)?.abort();
    assetUploadAbortControllersRef.current.delete(slot.id);
    setAssetUploadSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, tempToken: undefined, uploadStatus: "uploading", uploadProgress: 6, forceReencode: true, error: undefined } : item));
  }, [assetUploadSlots, showAssetUploadTip]);

  const removeAssetUploadSlot = useCallback((index: number) => {
    const slot = assetUploadSlots[index];
    if (slot) {
      assetUploadAbortControllersRef.current.get(slot.id)?.abort();
      assetUploadAbortControllersRef.current.delete(slot.id);
      if (slot.tempToken) void deleteTemporaryAssetImages([slot.tempToken]);
    }
    setAssetUploadSlots((current) => {
      const defaultType = getDefaultAssetUploadType(assetFilter);
      const normalized = normalizeAssetUploadSlots(current, defaultType);
      const kept = normalized.filter((_, slotIndex) => slotIndex !== index && normalized[slotIndex].dataUrl);
      return normalizeAssetUploadSlots(kept, defaultType);
    });
    setActiveAssetUploadIndex(0);
  }, [assetFilter, assetUploadSlots]);

  const updateActiveAssetUploadName = useCallback((value: string) => {
    setAssetUploadSlots((current) => normalizeAssetUploadSlots(current, getDefaultAssetUploadType(assetFilter)).map((slot, index) => (index === activeAssetUploadIndex ? { ...slot, fileName: value } : slot)));
  }, [activeAssetUploadIndex, assetFilter]);

  const restoreEmptyAssetUploadName = useCallback((slotIndex = activeAssetUploadIndex) => {
    setAssetUploadSlots((current) => normalizeAssetUploadSlots(current, getDefaultAssetUploadType(assetFilter)).map((slot, index) => (index === slotIndex && slot.dataUrl && !slot.fileName.trim() ? { ...slot, fileName: slot.originalFileName || "上传图片" } : slot)));
  }, [activeAssetUploadIndex, assetFilter]);

  const selectAssetUploadSlot = useCallback((index: number) => {
    restoreEmptyAssetUploadName(activeAssetUploadIndex);
    setActiveAssetUploadIndex(index);
  }, [activeAssetUploadIndex, restoreEmptyAssetUploadName]);

  const clearActiveAssetUploadName = useCallback(() => {
    setAssetUploadSlots((current) => normalizeAssetUploadSlots(current, getDefaultAssetUploadType(assetFilter)).map((slot, index) => (index === activeAssetUploadIndex ? { ...slot, fileName: "" } : slot)));
  }, [activeAssetUploadIndex, assetFilter]);

  const submitAssetUpload = useCallback(async () => {
    const uploadItems = visibleAssetUploadSlots.filter((slot) => slot.dataUrl && slot.uploadStatus === "ready" && slot.tempToken);
    if (uploadItems.length === 0 || isAssetUploading) return;
    if (uploadItems.some((slot) => slot.uploadStatus === "uploading")) {
      showAssetUploadTip("图片上传中，请稍候");
      return;
    }

    setIsAssetUploading(true);

    try {
      const uploadedItems = await Promise.all(uploadItems.map(async (slot) => {
        const url = await commitTemporaryAssetImage(slot.tempToken as string);

        return {
          name: sanitizeAssetName(slot.fileName) || sanitizeAssetName(slot.originalFileName) || "上传图片",
          type: slot.type,
          url,
          slot,
        };
      }));

      const validItems = uploadedItems.filter((item) => item.url);
      const knownUrls = new Set(assets.map((asset) => asset.url));
      const newItems: typeof validItems = [];
      const duplicateItems: typeof validItems = [];

      validItems.forEach((item) => {
        if (knownUrls.has(item.url)) {
          duplicateItems.push(item);
          return;
        }

        knownUrls.add(item.url);
        newItems.push(item);
      });

      if (newItems.length > 0) {
        let simulatedAssets = assets;
        const itemsToPersist: Array<{ name: string; url: string }> = [];
        newItems.forEach((item) => {
          if (simulatedAssets.some((asset) => asset.url === item.url)) return;
          const name = getVersionedName(item.name, simulatedAssets);
          itemsToPersist.push({ name, url: item.url });
          simulatedAssets = [{ id: item.url, type: "other", name, systemName: name, url: item.url, librarySource: "conversation", sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload", sessionId: activeSessionIdValue, lockedType: true, createdAt: Date.now() }, ...simulatedAssets];
        });
        setAssets((current) => {
          let nextAssets = current;

          itemsToPersist.forEach((item) => {
            if (nextAssets.some((asset) => asset.url === item.url)) return;
            nextAssets = [
              {
            id: createClientId(),
            type: "other",
            name: item.name,
            systemName: item.name,
            url: item.url,
            librarySource: "conversation",
            sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
            promptSource: "upload",
            sessionId: activeSessionIdValue,
                lockedType: true,
                createdAt: Date.now(),
              },
              ...nextAssets,
            ];
          });

          return nextAssets;
        });
        itemsToPersist.forEach((item) => {
          void fetch("/api/media-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: item.url,
              name: item.name,
              currentCategory: "conversation_uploads",
              mediaType: "image",
              sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
              promptSource: "upload",
              conversationId: activeSessionIdValue,
            }),
          }).catch((error) => console.warn("[media-assets] failed to persist uploaded asset", error));
        });
      }

      if (duplicateItems.length > 0) {
        const defaultType = getDefaultAssetUploadType(assetFilter);
        setAssetUploadSlots(normalizeAssetUploadSlots(duplicateItems.map((item) => ({ ...item.slot, tempToken: undefined, uploadStatus: "ready", uploadProgress: 100, isDuplicate: true })), defaultType));
        setActiveAssetUploadIndex(0);
        if (newItems.length > 0) showAssetUploadTip(`成功上传${newItems.length}张图片`, "success");
        showAssetUploadTip("图片已存在，无需要重复添加");
        return;
      }

      showAssetUploadTip(`成功上传${newItems.length}张图片`, "success");
      assetUploadAbortControllersRef.current.clear();
      setAssetUploadSlots(createAssetUploadSlots(getDefaultAssetUploadType(assetFilter)));
      setIsAssetUploadOpen(false);
    } catch (error) {
      showAssetUploadTip(toUserErrorMessage(error, "图片上传失败，请稍后再试。"));
    } finally {
      setIsAssetUploading(false);
    }
  }, [activeSessionIdValue, assetFilter, assets, isAssetUploading, showAssetUploadTip, visibleAssetUploadSlots]);

  const setActiveDraftInput = useCallback((value: string) => {
    const nextValue = Array.from(value).slice(0, MAX_DRAFT_INPUT_LENGTH).join("");
    if (value !== nextValue) showInputTip("最多输入2000字");
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? { ...session, draftInput: nextValue, updatedAt: Date.now() } : session)));
  }, [activeSessionId, showInputTip]);

  const addSessionUsage = useCallback((sessionId: string, usage?: UsageMeta) => {
    if (!usage) return;

    setSessions((current) =>
      current.map((session) => {
        if (session.id !== sessionId) return session;
        const nextUsage = addUsageSummary(session.usageSummary, usage);
        return nextUsage ? { ...session, usageSummary: nextUsage } : session;
      }),
    );
  }, []);

  const applyCreditResult = useCallback((sessionId: string, credit?: CreditMeta) => {
    if (!credit || credit.skipped) return;
    if (typeof credit.balance === "number") setCurrentUserCredits(Math.max(0, Math.floor(credit.balance)));
    const chargedCredits = Math.max(0, Math.floor(credit.chargedCredits ?? 0));
    if (chargedCredits > 0) addSessionUsage(sessionId, { credits: chargedCredits });
  }, [addSessionUsage]);

  const applyWorkflowCreditResult = useCallback((credit?: { skipped?: boolean; balance?: number }) => {
    if (!credit || credit.skipped) return;
    if (typeof credit.balance === "number") setCurrentUserCredits(Math.max(0, Math.floor(credit.balance)));
    setWorkflowItems((current) => current.map((workflow) => {
      if (workflow.id !== activeWorkflowId) return workflow;
      const chargedCredits = Math.max(0, Math.floor((credit as { chargedCredits?: number }).chargedCredits ?? 0));
      const usage = (credit as { usage?: UsageMeta }).usage;
      const nextUsage = addUsageSummary(workflow.usageSummary, usage ?? (chargedCredits > 0 ? { credits: chargedCredits } : undefined));
      return nextUsage ? { ...workflow, usageSummary: nextUsage, updatedAt: Date.now() } : workflow;
    }));
  }, [activeWorkflowId]);

  const ensureSessionMemorySummary = useCallback(async (session: WorkSession, model: ModelName, requestId: string) => {
    if (!shouldUpdateMemorySummary(session)) return session;

    const sourceMessages = getSummarySourceMessages(session);
    if (sourceMessages.length === 0) return session;

    try {
      const response = await fetch("/api/conversation-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          previousSummary: session.memorySummary?.content,
          messages: sourceMessages,
          conversationId: session.id,
          conversationTitle: session.title,
          requestId,
        }),
      });
      const data = await readJson<{ summary?: string; usage?: UsageMeta; credit?: CreditMeta }>(response);
      const summary = data.summary?.trim();
      if (!summary) return session;

      addSessionUsage(session.id, data.usage);
      applyCreditResult(session.id, data.credit);

      const nonSystemMessages = session.messages.filter((message) => message.role !== "system");
      const nextMemorySummary: SessionMemorySummary = {
        content: summary,
        updatedAt: Date.now(),
        summarizedMessageId: nonSystemMessages[nonSystemMessages.length - 1]?.id,
        summarizedTokenEstimate: estimateMessageTokens(nonSystemMessages),
      };
      const nextSession = { ...session, memorySummary: nextMemorySummary };

      setSessions((current) => current.map((item) => item.id === session.id ? { ...item, memorySummary: nextMemorySummary } : item));
      return nextSession;
    } catch (error) {
      console.error("[conversation-memory] summary failed", { sessionId: session.id, requestId, error });
      return session;
    }
  }, [addSessionUsage, applyCreditResult]);

  const reversePreviewPrompt = useCallback(async () => {
    if (!previewAsset || isVideoAsset(previewAsset) || isReversePromptingPreview) return;
    if (!isUploadedAsset(previewAsset) || (previewAsset.sourcePrompt.trim() && !isUploadPromptPlaceholder(previewAsset.sourcePrompt))) return;

    setIsReversePromptingPreview(true);
    setPreviewPromptError(null);
    try {
      const reverseModels = Array.from(new Set(["openai/gpt-5.5", ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL]));
      let data: ChatApiResponse | undefined;
      let nextPrompt = "";
      let lastError: unknown;

      for (const [modelIndex, model] of reverseModels.entries()) {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              mode: "image",
              messages: [{ role: "user", content: "请根据这张图片反推出一段可用于 AI 生图的中文提示词。只输出提示词正文，不要解释，不要分点。", images: [previewAsset.url] }],
              conversationId: activeSessionIdValue,
              conversationTitle: activeSession?.title,
              requestId: createClientId(),
              metadata: { creditSource: "image_prompt_reverse", mediaUrls: [previewAsset.url], recordFailure: modelIndex === reverseModels.length - 1 },
            }),
          });
          data = await readJson<ChatApiResponse>(response);
          nextPrompt = data.content?.trim() ?? "";
          if (nextPrompt) break;
        } catch (error) {
          lastError = error;
        }
      }

      void lastError;
      if (!data || !nextPrompt) throw new Error("服务器繁忙，请稍候再试！");
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);
      setPreviewAsset((current) => current && current.id === previewAsset.id ? { ...current, sourcePrompt: nextPrompt, promptSource: "reverse" } : current);
      setAssets((current) => current.map((asset) => asset.id === previewAsset.id || normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(previewAsset.url) ? { ...asset, sourcePrompt: nextPrompt, promptSource: "reverse" } : asset));
      if (workspaceStorageMode === "user") {
        void fetch("/api/media-assets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId: previewAsset.id, mediaAssetId: previewAsset.mediaId, url: previewAsset.url, reversePrompt: nextPrompt }),
        }).catch((error) => console.warn("[media-assets] failed to persist reverse prompt", error));
      }
    } catch (error) {
      setPreviewPromptError({ assetId: previewAsset.id, message: toUserErrorMessage(error, "服务器繁忙，请稍候再试！") });
    } finally {
      setIsReversePromptingPreview(false);
    }
  }, [activeSession, activeSessionIdValue, addSessionUsage, applyCreditResult, isReversePromptingPreview, previewAsset, showInputTip, workspaceStorageMode]);

  const applyBytePlusAssetUpdate = useCallback((assetId: string, patch: Partial<AssetItem>) => {
    setPreviewAsset((current) => current && current.id === assetId ? { ...current, ...patch } : current);
    setAssets((current) => current.map((asset) => asset.id === assetId ? { ...asset, ...patch } : asset));
  }, []);

  const applyBytePlusAssetUpdatesByUrl = useCallback((updates: Array<{ url?: string; assetId?: string; groupId?: string; status?: AssetItem["bytePlusAssetStatus"]; error?: string }>) => {
    const updateByUrl = new Map(updates.filter((item) => item.url && item.assetId).map((item) => [normalizeMediaUrlForMatch(item.url ?? ""), item]));
    if (updateByUrl.size === 0) return;

    const patchAsset = (asset: AssetItem) => {
      const update = updateByUrl.get(normalizeMediaUrlForMatch(asset.url));
      if (!update?.assetId) return asset;
      return {
        ...asset,
        bytePlusAssetId: update.assetId,
        bytePlusAssetGroupId: update.groupId,
        bytePlusAssetStatus: update.status ?? "Active",
        bytePlusAssetError: update.error,
        bytePlusAssetUpdatedAt: Date.now(),
      };
    };

    setPreviewAsset((current) => current ? patchAsset(current) : current);
    setAssets((current) => current.map(patchAsset));
  }, []);

  const submitBytePlusAsset = useCallback(async () => {
    if (!previewAsset || isVideoAsset(previewAsset) || isSubmittingBytePlusAsset) return;

    setIsSubmittingBytePlusAsset(true);
    setBytePlusAssetError(null);
    try {
      const response = await fetch("/api/byteplus-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: previewAsset.url, name: previewAsset.name }),
      });
      const data = await readJson<{ id?: string; groupId?: string; status?: AssetItem["bytePlusAssetStatus"] }>(response);
      if (!data.id) throw new Error("火山没有返回素材 ID");
      applyBytePlusAssetUpdate(previewAsset.id, {
        bytePlusAssetId: data.id,
        bytePlusAssetGroupId: data.groupId,
        bytePlusAssetStatus: data.status ?? "Processing",
        bytePlusAssetError: undefined,
        bytePlusAssetUpdatedAt: Date.now(),
      });
    } catch (error) {
      setBytePlusAssetError({ assetId: previewAsset.id, message: toUserErrorMessage(error, "提交素材审核失败") });
    } finally {
      setIsSubmittingBytePlusAsset(false);
    }
  }, [applyBytePlusAssetUpdate, isSubmittingBytePlusAsset, previewAsset]);

  const refreshBytePlusAsset = useCallback(async () => {
    if (!previewAsset?.bytePlusAssetId || isSubmittingBytePlusAsset) return;

    setIsSubmittingBytePlusAsset(true);
    setBytePlusAssetError(null);
    try {
      const response = await fetch(`/api/byteplus-assets?id=${encodeURIComponent(previewAsset.bytePlusAssetId)}`, { cache: "no-store" });
      const data = await readJson<{ asset?: { Status?: AssetItem["bytePlusAssetStatus"]; Error?: { Message?: string } } }>(response);
      const status = data.asset?.Status ?? previewAsset.bytePlusAssetStatus ?? "Processing";
      applyBytePlusAssetUpdate(previewAsset.id, {
        bytePlusAssetStatus: status,
        bytePlusAssetError: data.asset?.Error?.Message,
        bytePlusAssetUpdatedAt: Date.now(),
      });
    } catch (error) {
      setBytePlusAssetError({ assetId: previewAsset.id, message: toUserErrorMessage(error, "刷新素材状态失败") });
    } finally {
      setIsSubmittingBytePlusAsset(false);
    }
  }, [applyBytePlusAssetUpdate, isSubmittingBytePlusAsset, previewAsset]);

  const addActiveUploadedImages = useCallback((images: UploadedImage[], options?: { draftBase?: string; draftSuffix?: string; insertReferenceText?: boolean }) => {
    if (images.length === 0) return;

    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSessionId) return session;

        const existingImages = session.uploadedImages ?? [];
        const maxImages = currentUploadRule.image.maxCount;
        const availableCount = Math.max(0, maxImages - existingImages.length);
        const newImages = images.filter((image) => !existingImages.some((item) => item.url === image.url)).slice(0, availableCount);
        const nextUploadedImages = [...existingImages, ...newImages].slice(0, maxImages);
        const acceptedImages = images
          .map((image) => nextUploadedImages.find((item) => item.url === image.url))
          .filter((image): image is UploadedImage => Boolean(image));
        const referenceText = options?.insertReferenceText ? acceptedImages.map((image) => `@${getUploadedImageReferenceName(image, nextUploadedImages)}`).filter((name, index, array) => array.indexOf(name) === index).join(" ") : "";
        const currentDraft = options?.draftBase ?? session.draftInput ?? "";
        const draftSuffix = options?.draftSuffix ?? "";
        const rawNextDraft = referenceText ? `${currentDraft}${currentDraft && !/\s$/.test(currentDraft) ? " " : ""}${referenceText} ${draftSuffix}` : `${currentDraft}${draftSuffix}`;
        const nextDraft = Array.from(rawNextDraft).slice(0, MAX_DRAFT_INPUT_LENGTH).join("");

        return {
          ...session,
          draftInput: nextDraft,
          uploadedFiles: session.uploadedFiles,
          uploadedImages: nextUploadedImages,
          updatedAt: Date.now(),
        };
      }),
    );
  }, [activeSessionId, currentUploadRule.image.maxCount]);

  const removeActiveUploadedImage = useCallback((imageId: string) => {
    const image = activeUploadedImages.find((item) => item.id === imageId);
    inputImageUploadAbortControllersRef.current.get(imageId)?.abort();
    inputImageUploadAbortControllersRef.current.delete(imageId);
    if (image?.tempToken) void deleteTemporaryAssetImages([image.tempToken]);
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).filter((image) => image.id !== imageId), updatedAt: Date.now() } : session)));
  }, [activeSessionId, activeUploadedImages]);

  const removeActiveUploadedFile = useCallback((fileIndex: number) => {
    const removingFile = activeUploadedFiles[fileIndex];
    const removingName = removingFile && isUploadedMediaFile(removingFile) ? getUploadedFileDisplayName(removingFile) : "";
    setSessions((current) => current.map((session) => {
      if (session.id !== activeSessionId) return session;
      const nextDraft = removingName ? (session.draftInput ?? "").replace(new RegExp(`(^|\\s)@${escapeRegExp(removingName)}(?=\\s|$)\\s?`, "g"), (match, prefix: string) => prefix ? prefix : "").replace(/\s{2,}/g, " ").trimStart() : session.draftInput;
      return { ...session, draftInput: nextDraft, uploadedFiles: (session.uploadedFiles ?? []).filter((_, index) => index !== fileIndex), updatedAt: Date.now() };
    }));
  }, [activeSessionId, activeUploadedFiles]);

  const markTypingComplete = useCallback((messageId: string) => {
    setActiveTypingMessageIds((current) => {
      if (!current.has(messageId)) return current;

      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
    setCompletedTypingMessageIds((current) => {
      if (current.has(messageId)) return current;

      const next = new Set(current);
      next.add(messageId);
      return next;
    });
  }, []);

  const keepTypingAtBottom = useCallback(() => {
    if (typingScrollFrameRef.current !== null) return;

    typingScrollFrameRef.current = window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      typingScrollFrameRef.current = null;
    });
  }, []);

  const keepTypingInPlace = useCallback(() => undefined, []);

  const rememberIntentCorrection = useCallback((source: string, targetMode: IntentMode) => {
    setIntentMemoryRules((current) => upsertIntentMemoryRule(current, source, targetMode));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    if (!activeSessionId) return;
    const activeIndex = sessions.findIndex((session) => session.id === activeSessionId);
    if (activeIndex < historyVisibleSessionCount) return;
    setHistoryVisibleSessionCount(Math.max(HISTORY_INITIAL_SESSION_COUNT, activeIndex + 1));
  }, [activeSessionId, historyVisibleSessionCount, sessions]);

  useEffect(() => {
    if (!activeWorkflowId) return;
    const activeIndex = activeWorkflowItems.findIndex((item) => item.id === activeWorkflowId);
    if (activeIndex < workflowVisibleItemCount) return;
    setWorkflowVisibleItemCount(Math.max(WORKFLOW_INITIAL_ITEM_COUNT, activeIndex + 1));
  }, [activeWorkflowId, activeWorkflowItems, workflowVisibleItemCount]);

  const loadSessionDetails = useCallback(async (sessionId: string) => {
    const targetSession = sessionsRef.current.find((session) => session.id === sessionId);
    if (!targetSession || targetSession.messagesLoaded !== false || loadingSessionIds.has(sessionId)) return;

    setLoadingSessionIds((current) => new Set(current).add(sessionId));
    setLoadingSessionStartedAt((current) => ({ ...current, [sessionId]: current[sessionId] ?? Date.now() }));
    try {
      const response = await fetch(`/api/workspace-session?id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const data = await readJson<{ session?: WorkSession | null }>(response);
      if (!data.session) return;
      setSessions((current) => current.map((session) => session.id === sessionId ? { ...data.session, messagesLoaded: true } as WorkSession : session));
    } catch {
      showInputTip("历史对话加载失败，请稍后重试");
    } finally {
      setLoadingSessionIds((current) => {
        const next = new Set(current);
        next.delete(sessionId);
        return next;
      });
      setLoadingSessionStartedAt((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
    }
  }, [loadingSessionIds, showInputTip]);

  const loadOlderMessages = useCallback(async (sessionId: string) => {
    const targetSession = sessionsRef.current.find((session) => session.id === sessionId);
    if (!targetSession?.messagesHasMore || !targetSession.messagesBeforeCursor || loadingOlderMessageSessionIds.has(sessionId)) return;

    setLoadingOlderMessageSessionIds((current) => new Set(current).add(sessionId));
    try {
      const response = await fetch(`/api/workspace-session?id=${encodeURIComponent(sessionId)}&historyOnly=1&before=${targetSession.messagesBeforeCursor}`, { cache: "no-store" });
      const data = await readJson<{ messages?: Message[]; messagesHasMore?: boolean; messagesBeforeCursor?: number }>(response);
      const olderMessages = Array.isArray(data.messages) ? data.messages : [];
      setSessions((current) => current.map((session) => {
        if (session.id !== sessionId) return session;
        const existingIds = new Set(session.messages.map((message) => message.id));
        const nextOlderMessages = olderMessages.filter((message) => !existingIds.has(message.id));
        return {
          ...session,
          messages: [...nextOlderMessages, ...session.messages],
          messagesHasMore: Boolean(data.messagesHasMore),
          messagesBeforeCursor: data.messagesBeforeCursor,
        };
      }));
    } catch {
      showInputTip("更早消息加载失败，请稍后重试");
    } finally {
      setLoadingOlderMessageSessionIds((current) => {
        const next = new Set(current);
        next.delete(sessionId);
        return next;
      });
    }
  }, [loadingOlderMessageSessionIds, showInputTip]);

  const loadMoreHistorySessions = useCallback(async () => {
    if (!historyHasMoreSessions || isHistoryLoadingMore) return;

    setIsHistoryLoadingMore(true);
    try {
      const { data } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>(`/api/workspace-state?summary=1&historyOnly=1&offset=${historyNextOffset}&limit=${HISTORY_LOAD_MORE_COUNT}`, { cache: "no-store" });
      const incomingSessions = Array.isArray(data.state?.sessions) ? data.state.sessions.map((session) => replaceSessionMediaUrls(session, legacyMediaUrlReplacements, {})) : [];
      const existingIds = new Set(sessionsRef.current.map((session) => session.id));
      const nextItems = incomingSessions.filter((session) => {
        if (existingIds.has(session.id)) return false;
        existingIds.add(session.id);
        return true;
      });
      setSessions((current) => {
        return nextItems.length > 0 ? [...current, ...nextItems] : current;
      });
      setHistoryHasMoreSessions(Boolean(data.state?.sessionsHasMore));
      setHistoryNextOffset(Math.floor(Number(data.state?.sessionsNextOffset ?? historyNextOffset)));
      setHistoryTotalSessionCount((current) => Math.max(current, Math.floor(Number(data.state?.sessionsTotalCount ?? 0)), sessionsRef.current.filter((session) => !isDeletedSession(session)).length + nextItems.length));
      setHistoryVisibleSessionCount((count) => Math.max(count, count + nextItems.length));
    } catch {
      showInputTip("历史对话加载失败，请稍后重试");
    } finally {
      setIsHistoryLoadingMore(false);
    }
  }, [historyHasMoreSessions, historyNextOffset, isHistoryLoadingMore, showInputTip]);

  const loadWorkspaceAssets = useCallback(async (force = false, filter: AssetFilter = assetFilter, offset = 0, reason: "initial" | "scroll" | "auto" = offset > 0 ? "scroll" : "initial") => {
    const filterAssetCount = assets.filter((asset) => isAssetInFilter(asset, filter)).length;
    const hasFilterAssets = filterAssetCount > 0;
    if (assetsLoadStatus === "loading" || (!force && offset === 0 && loadedAssetFilters[filter] && hasFilterAssets)) return;
    setAssetLoadingReason(reason);
    setAssetsLoadStatus("loading");
    try {
      const { response, data } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>(`/api/workspace-state?assetsOnly=1&assetFilter=${encodeURIComponent(filter)}&assetOffset=${offset}&assetLimit=30`, { cache: "no-store" }, 2, 45_000);
      if (response.status === 401) {
        window.location.replace("/");
        return;
      }
      const state = data.state ?? {};
      const nextAssets = Array.isArray(state.assets)
        ? applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(state.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), sessionsRef.current))
        : [];
      const nextAssetGenerateJobs = Array.isArray(state.assetGenerateJobs) ? normalizeStoredAssetGenerateJobs(state.assetGenerateJobs).map((job) => replaceAssetGenerateJobMediaUrls(job, legacyMediaUrlReplacements, {})) : [];
      setAssets((current) => {
        const kept = offset > 0 ? current : current.filter((asset) => !isAssetInFilter(asset, filter));
        const incomingKeys = new Set(nextAssets.map(getAssetIdentityKey));
        if (offset === 0) return [...nextAssets, ...kept.filter((asset) => !incomingKeys.has(getAssetIdentityKey(asset)))];
        const existingKeys = new Set(kept.map(getAssetIdentityKey));
        return [...kept, ...nextAssets.filter((asset) => !existingKeys.has(getAssetIdentityKey(asset)))];
      });
      if (state.assetCounts && typeof state.assetCounts === "object") setAssetCounts(state.assetCounts);
      setAssetsHasMore(Boolean(state.assetsHasMore));
      setAssetsNextOffset(Math.floor(Number(state.assetsNextOffset ?? nextAssets.length)));
      setAssetRenderLimit((current) => Math.max(current, offset + nextAssets.length, ASSET_RENDER_PAGE_SIZE));
      setAssetGenerateJobs(nextAssetGenerateJobs);
      setLoadedAssetFilters((current) => ({ ...current, [filter]: true }));
      setAssetsLoadStatus("loaded");
      setAssetLoadingReason("");
    } catch {
      if (assets.some((asset) => isAssetInFilter(asset, filter))) {
        setAssetsLoadStatus("loaded");
        setAssetLoadingReason("");
        showInputTip("资产库刷新失败，已显示上次加载内容");
        return;
      }
      setAssetsLoadStatus("failed");
      setAssetLoadingReason("");
      showInputTip("资产库加载失败，请稍后重试");
    }
  }, [assetFilter, assets, assetsLoadStatus, loadedAssetFilters, showInputTip]);

  const loadMentionAssetFilters = useCallback(async () => {
    const filters: AssetFilter[] = ["character_image", "scene_image", "shot_image", "conversation_uploads"];
    const missingFilters = filters.filter((filter) => !loadedAssetFilters[filter] || !assets.some((asset) => isAssetInFilter(asset, filter)));
    if (missingFilters.length === 0 || assetsLoadStatus === "loading") return;
    setAssetsLoadStatus("loading");
    try {
      const loadedFilters: Partial<Record<AssetFilter, boolean>> = {};
      for (const filter of missingFilters) {
        const { data } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>(`/api/workspace-state?assetsOnly=1&assetFilter=${encodeURIComponent(filter)}&assetOffset=0&assetLimit=30`, { cache: "no-store" }, 2, 45_000);
        const state = data.state ?? {};
        const nextAssets = Array.isArray(state.assets)
          ? applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(state.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), sessionsRef.current))
          : [];
        setAssets((current) => {
          const incomingKeys = new Set(nextAssets.map(getAssetIdentityKey));
          return [...nextAssets, ...current.filter((asset) => !incomingKeys.has(getAssetIdentityKey(asset)))];
        });
        if (state.assetCounts && typeof state.assetCounts === "object") setAssetCounts(state.assetCounts);
        loadedFilters[filter] = true;
      }
      setLoadedAssetFilters((current) => ({ ...current, ...loadedFilters }));
      setAssetsLoadStatus("loaded");
    } catch {
      setAssetsLoadStatus(assets.some((asset) => mentionAssetTypes.some((type) => isMentionGroupAsset(asset, type))) ? "loaded" : "failed");
      showInputTip("资产引用加载失败，请稍后重试");
    }
  }, [assets, assetsLoadStatus, loadedAssetFilters, showInputTip]);

  useEffect(() => {
    if (workspaceStorageMode !== "user") return;
    if (activePanel !== "assets" || assetsLoadStatus === "loading") return;
    const filterAssetCount = assets.filter((asset) => isAssetInFilter(asset, assetFilter)).length;
    const serverFilterCount = Number(assetCounts[assetFilter]);
    const needsCurrentFilter = !loadedAssetFilters[assetFilter] || (!filterAssetCount && Number.isFinite(serverFilterCount) && serverFilterCount > 0);
    if (assetsLoadStatus === "idle" || assetsLoadStatus === "failed" || needsCurrentFilter) void loadWorkspaceAssets(false, assetFilter, 0);
  }, [activePanel, assetCounts, assetFilter, assets, assetsLoadStatus, loadWorkspaceAssets, loadedAssetFilters, workspaceStorageMode]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setWorkspaceSite(getCurrentWorkspaceSite(window.location.hostname));
        setWorkspaceLoadStatus("loading");

        const applyInputSettings = (parsedInputSettings: StoredInputSettings | null | undefined) => {
          if (!parsedInputSettings) return;
          const storedImageModel = parsedInputSettings.selectedGenerationModels?.image;
          const storedVideoModel = parsedInputSettings.selectedGenerationModels?.video;
          const storedGeneralChatModel = parsedInputSettings.selectedGeneralModels?.chat;
          const storedGeneralImageModel = parsedInputSettings.selectedGeneralModels?.image;
          const storedGeneralVideoModel = parsedInputSettings.selectedGeneralModels?.video;
          const nextImageModel = storedImageModel && isGenerationModelOption("image", storedImageModel) ? storedImageModel : DEFAULT_IMAGE_MODEL;
          const nextVideoModel = storedVideoModel && isGenerationModelOption("video", storedVideoModel) ? storedVideoModel : DEFAULT_VIDEO_MODEL;
          const nextGeneralModels = {
            chat: storedGeneralChatModel && frontendConversationModels.some((model) => model.id === storedGeneralChatModel) ? storedGeneralChatModel : frontendConversationModels[0].id,
            image: storedGeneralImageModel && isGenerationModelOption("image", storedGeneralImageModel) ? storedGeneralImageModel : DEFAULT_IMAGE_MODEL,
            video: storedGeneralVideoModel && isGenerationModelOption("video", storedGeneralVideoModel) ? storedGeneralVideoModel : DEFAULT_VIDEO_MODEL,
          };
          const nextImageResolution = normalizeImageResolutionForModel(nextImageModel, parsedInputSettings.selectedResolutions?.image);
          const nextVideoResolution = normalizeVideoResolutionForModel(nextVideoModel, parsedInputSettings.selectedResolutions?.video);
          if (isWorkMode(parsedInputSettings.mode)) setMode(parsedInputSettings.mode);
          if (parsedInputSettings.agentModelTier === "normal" || parsedInputSettings.agentModelTier === "advanced") setAgentModelTier(parsedInputSettings.agentModelTier);
          setSelectedRatios((current) => ({
            ...mergeValidModeSettings(current, parsedInputSettings.selectedRatios, { general: ratioOptions, agent: ratioOptions, image: ratioOptions, video: ["智能比例", ...getSupportedVideoRatios(nextVideoModel)] }),
            video: parsedInputSettings.selectedRatios?.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(nextVideoModel, parsedInputSettings.selectedRatios?.video, nextVideoResolution),
          }));
          setSelectedResolutions((current) => ({
            ...mergeValidModeSettings(current, parsedInputSettings.selectedResolutions, { general: imageResolutionOptions, agent: imageResolutionOptions, image: getSupportedImageResolutions(nextImageModel), video: getSupportedVideoResolutions(nextVideoModel) }),
            image: nextImageResolution,
            video: nextVideoResolution,
          }));
          setSelectedDurations((current) => mergeValidModeSettings(current, parsedInputSettings.selectedDurations, { general: durationOptions, agent: durationOptions, image: durationOptions, video: getVideoDurationOptions(parsedInputSettings.selectedGenerationModels?.video ?? DEFAULT_VIDEO_MODEL) }));
          setSelectedImageCounts((current) => mergeValidModeSettings(current, parsedInputSettings.selectedImageCounts, { general: imageCountOptions, agent: imageCountOptions, image: imageCountOptions, video: imageCountOptions }));
          setSelectedGenerationModels(() => ({
            image: nextImageModel,
            video: nextVideoModel,
          }));
          setSelectedGeneralModels(nextGeneralModels as Record<"chat" | "image" | "video", ModelName>);
        };

        const applyWorkspaceState = (state: WorkspaceStatePayload, storageMode: WorkspaceStorageMode) => {
          const uiState = getStoredWorkspaceUiState();
          const savedSessions = Array.isArray(state.sessions) && state.sessions.length > 0 ? state.sessions : [createSession(state.nextConversationNumber ?? 1)];
          const normalizedWorkspace = normalizeSessionCodesAndMediaNames(getPersistableSessions(savedSessions), state.nextConversationNumber);
          const nextSessions = normalizedWorkspace.sessions.map((session) => replaceSessionMediaUrls(session, legacyMediaUrlReplacements, {}));
          const nextWorkflows = normalizeWorkflowCodesAndMediaNumbers(normalizeStoredWorkflowItems(state.workflowItems));
          const nextStoredWorkflowNumber = Math.max(1, Math.floor(Number(state.nextWorkflowNumber ?? 1)));
          const nextWorkflowNumberValue = Math.max(nextStoredWorkflowNumber, getMaxWorkflowTitleNumber(nextWorkflows) + 1);
          const nextActiveWorkflowId = state.activeWorkflowId && nextWorkflows.some((item) => item.id === state.activeWorkflowId) ? state.activeWorkflowId : nextWorkflows[0]?.id ?? "";
          const nextActiveSessionId = state.activeSessionId && nextSessions.some((session) => session.id === state.activeSessionId) ? state.activeSessionId : nextSessions[0].id;
          const savedAssets = Array.isArray(state.assets) ? applyAssetGenerationSystemNames(applySessionMediaSystemNamesToAssets(normalizeStoredAssets(state.assets).map((asset) => replaceAssetMediaUrls(asset, legacyMediaUrlReplacements)), nextSessions)) : undefined;
          const savedAssetGenerateJobs = Array.isArray(state.assetGenerateJobs) ? normalizeStoredAssetGenerateJobs(state.assetGenerateJobs).map((job) => replaceAssetGenerateJobMediaUrls(job, legacyMediaUrlReplacements, {})) : undefined;

          setWorkspaceStorageMode(storageMode);
          applyInputSettings(state.inputSettings);
          const storedActivePanel = state.activePanel === "workflow" && !WORKFLOW_MODE_ENABLED ? "chat" : state.activePanel;
          const nextActivePanel = uiState.activePanel ?? (storedActivePanel === "chat" || storedActivePanel === "workflow" || storedActivePanel === "assets" ? storedActivePanel : undefined);
          const nextAssetFilter = uiState.assetFilter ?? (isAssetFilter(state.assetFilter) ? state.assetFilter : undefined);
          const nextAssetScrollTopByFilter = uiState.assetScrollTopByFilter ?? state.assetScrollTopByFilter;
          if (nextActivePanel) setActivePanel(nextActivePanel);
          if (nextAssetFilter) setAssetFilter(nextAssetFilter);
          if (nextAssetScrollTopByFilter && typeof nextAssetScrollTopByFilter === "object") setAssetScrollTopByFilter(nextAssetScrollTopByFilter);
          setSessions(nextSessions);
          setHistoryHasMoreSessions(Boolean(state.sessionsHasMore));
          setHistoryNextOffset(Math.floor(Number(state.sessionsNextOffset ?? nextSessions.length)));
          setHistoryTotalSessionCount(Math.max(Math.floor(Number(state.sessionsTotalCount ?? 0)), nextSessions.filter((session) => !isDeletedSession(session)).length));
          setHistoryVisibleSessionCount(Math.max(HISTORY_INITIAL_SESSION_COUNT, nextSessions.length));
          setNextConversationNumber(normalizedWorkspace.nextConversationNumber);
          setWorkflowItems(nextWorkflows);
          setNextWorkflowNumber(nextWorkflowNumberValue);
          setWorkflowVisibleItemCount(Math.max(WORKFLOW_INITIAL_ITEM_COUNT, Math.min(nextWorkflows.filter((item) => !isDeletedWorkflow(item)).length, WORKFLOW_INITIAL_ITEM_COUNT)));
          setActiveWorkflowId(nextActiveWorkflowId);
          setActiveSessionId(nextActiveSessionId);
          setCompletedTypingMessageIds(new Set(getAssistantMessageIds(nextSessions)));
          setIntentMemoryRules(Array.isArray(state.intentMemoryRules) ? state.intentMemoryRules.slice(0, MAX_INTENT_MEMORY_RULES) : []);
          setFeedbackLogs(Array.isArray(state.feedbackLogs) ? state.feedbackLogs.slice(0, MAX_FEEDBACK_LOGS) : []);
          if (savedAssets) {
            setAssets(extractAssetsFromSessions(nextSessions, savedAssets));
            setAssetsLoadStatus("loaded");
          }
          if (savedAssetGenerateJobs) setAssetGenerateJobs(savedAssetGenerateJobs);
        };

        try {
          const { response: meResponse, data: meData } = await fetchJsonWithRetry<{ user?: CurrentUserProfile | null }>("/api/auth/me", { cache: "no-store" });

          if (meResponse.status === 401 || (meResponse.ok && typeof meData.user?.email !== "string")) {
            window.location.replace("/");
            return;
          }

          if (typeof meData.user?.email !== "string") return;

          applyCurrentUserProfile(meData.user);
          let workspaceLoaded = false;
          let workspaceLoadError: unknown;
          for (let attempt = 0; attempt < 5; attempt += 1) {
            if (cancelled) return;
            setWorkspaceLoadStatus(attempt === 0 ? "loading" : "retrying");
            try {
              const { data: workspaceData } = await fetchJsonWithRetry<{ state?: WorkspaceStatePayload | null }>("/api/workspace-state?summary=1&panel=chat", { cache: "no-store" }, 1, 30_000);
              if (cancelled) return;
              applyWorkspaceState(workspaceData.state ?? {}, "user");
              setWorkspaceLoadStatus("loaded");
              workspaceLoaded = true;
              break;
            } catch (error) {
              workspaceLoadError = error;
              if (attempt < 4) await delay(Math.min(4_000, 1_200 * (attempt + 1)));
            }
          }
          if (!workspaceLoaded) {
            console.warn("用户工作区加载失败，等待用户重试", workspaceLoadError);
            if (!cancelled) setWorkspaceLoadStatus("failed");
          }
        } catch (error) {
          console.warn("登录状态检查失败，保留当前页面等待重试", error);
          if (!cancelled) setWorkspaceLoadStatus("failed");
        } finally {
          if (!cancelled) setIsLoaded(true);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [applyCurrentUserProfile, workspaceLoadRetryKey]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;

    const loadModelAvailability = async () => {
      try {
        const response = await fetch("/api/model-availability", { cache: "no-store" });
        const data = (await response.json()) as { generalModels?: string[]; generalModelProviders?: Record<string, "openrouter" | "byteplus">; imageModels?: string[]; assetImageModels?: string[]; videoModels?: string[]; agentImageModels?: string[]; agentVideoModels?: string[] };
        if (cancelled) return;
        const next = {
          image: Array.isArray(data.imageModels) ? data.imageModels : [],
          video: Array.isArray(data.videoModels) ? data.videoModels : [],
        };
        setEnabledGenerationModelIds(next);
        setEnabledAgentGenerationModelIds({
          image: Array.isArray(data.agentImageModels) ? data.agentImageModels : [],
          video: Array.isArray(data.agentVideoModels) ? data.agentVideoModels : [],
        });
        const nextAssetImageModels = Array.isArray(data.assetImageModels) ? data.assetImageModels : [];
        setEnabledAssetImageModelIds(nextAssetImageModels);
        setSelectedGenerationModels((current) => ({
          image: next.image.includes(current.image) ? current.image : next.image[0] ?? current.image,
          video: next.video.includes(current.video) ? current.video : next.video[0] ?? current.video,
        }));
        setSelectedGeneralModels((current) => ({
          chat: Array.isArray(data.generalModels) && data.generalModels.includes(current.chat) ? current.chat : Array.isArray(data.generalModels) ? data.generalModels[0] as ModelName | undefined ?? current.chat : current.chat,
          image: next.image.includes(current.image) ? current.image : next.image[0] as ModelName | undefined ?? current.image,
          video: next.video.includes(current.video) ? current.video : next.video[0] as ModelName | undefined ?? current.video,
        }));
        setEnabledGeneralChatModelIds(Array.isArray(data.generalModels) ? data.generalModels : []);
        setGeneralModelProviders(data.generalModelProviders && typeof data.generalModelProviders === "object" ? data.generalModelProviders : {});
        setCharacterGenerateModel((current) => nextAssetImageModels.includes(current) ? current : nextAssetImageModels[0] ?? current);
      } catch {
        if (!cancelled) {
          setEnabledGenerationModelIds({ image: [], video: [] });
          setEnabledGeneralChatModelIds([]);
          setGeneralModelProviders({});
          setEnabledAgentGenerationModelIds({ image: [], video: [] });
          setEnabledAssetImageModelIds([]);
        }
      }
    };

    void loadModelAvailability();

    return () => { cancelled = true; };
  }, [isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;

    const checkWorkspaceInstance = async (claim = false) => {
      try {
        const response = await fetch("/api/auth/workspace-instance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ instanceId: workspaceInstanceIdRef.current, claim }),
        });
        const data = (await response.json().catch(() => ({}))) as { active?: boolean };
        if (cancelled) return;
        if (response.status === 401) {
          window.location.replace("/");
          return;
        }
        if (!response.ok) {
          workspaceInstanceCheckFailuresRef.current += 1;
          return;
        }
        if (data.active === true) {
          if (claim) workspaceInstanceClaimedRef.current = true;
          workspaceInstanceCheckFailuresRef.current = 0;
          return;
        }
        if (!claim && workspaceInstanceClaimedRef.current) {
          window.location.replace("/");
          return;
        }
        if (!claim && !workspaceInstanceClaimedRef.current) {
          void checkWorkspaceInstance(true);
          return;
        }
        workspaceInstanceCheckFailuresRef.current = 0;
      } catch {
        if (!cancelled) workspaceInstanceCheckFailuresRef.current += 1;
      }
    };

    void checkWorkspaceInstance(true);
    const instanceInterval = window.setInterval(() => void checkWorkspaceInstance(false), 2000);
    const onFocus = () => void checkWorkspaceInstance(false);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(instanceInterval);
      window.removeEventListener("focus", onFocus);
    };
  }, [isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;
    const activityEvents = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    const recordActivity = () => {
      const now = Date.now();
      if (now - authActivityPingRef.current < 60_000) return;
      authActivityPingRef.current = now;
      void fetch("/api/auth/activity", { method: "POST", cache: "no-store", keepalive: true }).then((response) => {
        if (!cancelled && response.status === 401) window.location.replace("/");
      }).catch(() => undefined);
    };
    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true, capture: true }));
    return () => {
      cancelled = true;
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity, { capture: true }));
    };
  }, [isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user" || !hasAnyGenerationRunning) return;
    let cancelled = false;
    const keepGenerationAlive = () => {
      authActivityPingRef.current = Date.now();
      void fetch("/api/auth/activity", { method: "POST", cache: "no-store", keepalive: true }).then((response) => {
        if (!cancelled && response.status === 401) window.location.replace("/");
      }).catch(() => undefined);
    };
    keepGenerationAlive();
    const interval = window.setInterval(keepGenerationAlive, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [hasAnyGenerationRunning, isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await response.json().catch(() => ({}))) as { user?: CurrentUserProfile | null };
        if (cancelled) return;
        if (response.status === 401 || (response.ok && !data.user?.email)) {
          window.location.replace("/");
          return;
        }
        if (!response.ok) {
          authCheckFailuresRef.current += 1;
          return;
        }
        authCheckFailuresRef.current = 0;
      } catch {
        if (!cancelled) authCheckFailuresRef.current += 1;
      }
    };

    const interval = window.setInterval(() => void checkAuth(), 5000);
    window.addEventListener("focus", checkAuth);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", checkAuth);
    };
  }, [isLoaded, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    const prompt = window.sessionStorage.getItem(HOME_PROMPT_STORAGE_KEY)?.trim();
    if (!prompt) return;

    window.sessionStorage.removeItem(HOME_PROMPT_STORAGE_KEY);
    const timer = window.setTimeout(() => {
      const session = createSession(nextConversationNumber);
      setNextConversationNumber((current) => Math.max(current + 1, nextConversationNumber + 1));
      setActivePanel("chat");
      setMode("agent");
      setSessions((current) => [session, ...current]);
      setHistoryTotalSessionCount((count) => count + 1);
      setActiveSessionId(session.id);
      setPendingHomePrompt({ sessionId: session.id, prompt });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isLoaded, nextConversationNumber, workspaceStorageMode]);

  useEffect(() => {
    if (!isThinking) return;
    const frame = window.requestAnimationFrame(() => {
      setOpenControlMenu("");
      setIsAtAssetMenuOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isThinking]);

  useEffect(() => {
    if (!userDialogTip) return;
    if (userDialogTip.exiting) return;
    if (userDialogTipTimerRef.current !== null) window.clearTimeout(userDialogTipTimerRef.current);

    userDialogTipTimerRef.current = window.setTimeout(() => {
      setUserDialogTip((current) => current ? { ...current, exiting: true } : current);
      userDialogTipTimerRef.current = window.setTimeout(() => setUserDialogTip(undefined), 100);
    }, 2000);

    return () => {
      if (userDialogTipTimerRef.current !== null) window.clearTimeout(userDialogTipTimerRef.current);
    };
  }, [userDialogTip]);

  useEffect(() => {
    if (securityPasswordMode !== "forgot-code" || forgotPasswordCode.length !== 6 || isForgotPasswordSending) return;

    const timer = window.setTimeout(() => {
      void verifyForgotPasswordCode();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [forgotPasswordCode, isForgotPasswordSending, securityPasswordMode, verifyForgotPasswordCode]);

  useEffect(() => {
    if (!isLoaded) return undefined;
    return applyDocumentLanguage(userLanguage);
  }, [isLoaded, userLanguage]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    setStoredWorkspaceUiState({ activePanel, assetFilter, assetScrollTopByFilter });
  }, [activePanel, assetFilter, assetScrollTopByFilter, isLoaded, workspaceStorageMode]);

  useEffect(() => {
    assetScrollTopByFilterRef.current = assetScrollTopByFilter;
  }, [assetScrollTopByFilter]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    if (workspaceLoadStatus !== "loaded") return;
    if (workspaceSaveTimerRef.current !== null) window.clearTimeout(workspaceSaveTimerRef.current);

    const payload: WorkspaceStatePayload = {
      sessions: getPersistableSessions(sessions),
      nextConversationNumber,
      nextWorkflowNumber,
      activePanel,
      assetFilter,
      assetScrollTopByFilter,
      workflowItems: getPersistableWorkflowItems(normalizeWorkflowCodesAndMediaNumbers(workflowItems)),
      activeWorkflowId,
      activeSessionId,
      inputSettings: {
        mode,
        agentModelTier,
        selectedRatios,
        selectedResolutions,
        selectedDurations,
        selectedImageCounts,
        selectedGenerationModels,
        selectedGeneralModels,
      },
      intentMemoryRules: intentMemoryRules.slice(0, MAX_INTENT_MEMORY_RULES),
      feedbackLogs: feedbackLogs.slice(0, MAX_FEEDBACK_LOGS),
    };
    if (assetsLoadStatus === "loaded" || assetGenerateJobs.length > 0) payload.assetGenerateJobs = getPersistableAssetGenerateJobs(assetGenerateJobs);

    workspaceSaveTimerRef.current = window.setTimeout(() => {
      fetch("/api/workspace-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => console.warn("用户工作区保存失败"));
    }, 500);

    return () => {
      if (workspaceSaveTimerRef.current !== null) window.clearTimeout(workspaceSaveTimerRef.current);
    };
  }, [activePanel, activeSessionId, activeWorkflowId, agentModelTier, assetFilter, assetGenerateJobs, assetScrollTopByFilter, assets, assetsLoadStatus, feedbackLogs, intentMemoryRules, isLoaded, mode, nextConversationNumber, nextWorkflowNumber, selectedDurations, selectedGeneralModels, selectedGenerationModels, selectedImageCounts, selectedRatios, selectedResolutions, sessions, workflowItems, workspaceLoadStatus, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    let cancelled = false;

    const pollMediaSaveStatus = async () => {
      const urls = collectRemoteMediaUrls(sessionsRef.current, assets, assetGenerateJobs, workflowItems).slice(0, 80);
      if (urls.length === 0) return;

      try {
        const response = await fetch("/api/media-save-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });
        const data = (await response.json()) as { jobs?: MediaSaveStatusJob[] };
        if (cancelled) return;

        const savedJobs = (data.jobs ?? []).filter((job) => job.status === "saved" && job.localUrl && job.remoteUrl && job.localUrl !== job.remoteUrl);
        if (savedJobs.length === 0) return;
        const jobsToPreload = savedJobs.filter((job) => !preloadingSavedMediaUrlsRef.current.has(job.remoteUrl));
        if (jobsToPreload.length === 0) return;
        jobsToPreload.forEach((job) => preloadingSavedMediaUrlsRef.current.add(job.remoteUrl));
        const preloadResults = await Promise.all(jobsToPreload.map(async (job) => ({ job, ready: await preloadSavedMediaBeforeReplace(job) })));
        preloadResults.forEach(({ job }) => preloadingSavedMediaUrlsRef.current.delete(job.remoteUrl));
        if (cancelled) return;
        const readyJobs = preloadResults.filter((item) => item.ready).map((item) => item.job);
        const replacements = new Map(readyJobs.map((job) => [job.remoteUrl, job.localUrl as string]));
        const dimensions = Object.fromEntries(readyJobs.filter((job) => job.localUrl && job.dimensions).map((job) => [job.localUrl as string, job.dimensions as ImageDimensions]));
        const videoPosters = Object.fromEntries(readyJobs.filter((job) => job.localUrl && job.posterUrl).map((job) => [job.localUrl as string, job.posterUrl as string]));
        const persistItems = savedJobs.flatMap((job) => {
          if (!job.localUrl) return [];
          const isVideo = job.type === "video" || /\.(mp4|webm|mov)(\?|#|$)/i.test(job.localUrl);
          const fromMessage = sessionsRef.current.flatMap((session) => session.messages.map((message) => ({ session, message }))).find(({ message }) => {
            if (isVideo) return message.videoUrl === job.remoteUrl || message.videos?.includes(job.remoteUrl);
            return message.images?.includes(job.remoteUrl) || message.imageResultSlots?.some((slot) => slot.type === "image" && slot.url === job.remoteUrl);
          });
          const fromAsset = assets.find((asset) => asset.url === job.remoteUrl);
          const fromWorkflow = workflowItems.flatMap((workflow) => workflow.canvas?.nodes?.map((node) => ({ workflow, node })) ?? []).find(({ node }) => {
            if (isVideo) return node.data.videoUrl === job.remoteUrl;
            return node.data.images?.includes(job.remoteUrl);
          });
          const message = fromMessage?.message;
          const session = fromMessage?.session;
          const workflowName = fromWorkflow?.node.data.mediaSystemNames?.[job.remoteUrl] ?? (job.localUrl ? fromWorkflow?.node.data.mediaSystemNames?.[job.localUrl] : undefined);
          const name = message?.mediaSystemNames?.[job.remoteUrl] ?? fromAsset?.systemName ?? fromAsset?.name ?? workflowName ?? fromWorkflow?.node.title;
          const promptDetail = isVideo ? message?.videoPromptDetails?.[job.remoteUrl] : message?.imagePromptDetails?.[job.remoteUrl];
          const workflowPrompt = fromWorkflow ? getWorkflowNodeSourcePrompt(fromWorkflow.workflow, fromWorkflow.node) : undefined;
          const sourcePrompt = isVideo
            ? promptDetail?.prompt ?? message?.videoPrompts?.[job.remoteUrl] ?? message?.generationMeta?.originalPrompt ?? workflowPrompt ?? fromAsset?.sourcePrompt ?? message?.content
            : promptDetail?.prompt ?? message?.imagePrompts?.[job.remoteUrl] ?? workflowPrompt ?? fromAsset?.sourcePrompt ?? message?.content;
          const assetGenerationCategory = fromAsset && ["character_image", "scene_image", "shot_image"].includes(fromAsset.type) ? fromAsset.type : undefined;
          const currentCategory = fromWorkflow
            ? isVideo ? "workflow_videos" : "workflow_images"
            : fromAsset?.librarySource === "asset_generation" && assetGenerationCategory
            ? fromAsset.type
            : isVideo ? "conversation_videos" : "conversation_images";
          return [{
            url: job.localUrl,
            name,
            currentCategory,
            mediaType: isVideo ? "video" : "image",
            posterUrl: job.posterUrl,
            thumbnailUrl: job.thumbnailUrl,
            dimensions: job.dimensions,
            sourcePrompt,
            sourceDetail: getPromptSourceDetail(promptDetail),
            promptSource: "generated",
            conversationId: session?.id ?? fromAsset?.sessionId,
            messageId: message?.id ?? fromAsset?.messageId,
            workflowId: fromWorkflow?.workflow.id,
            workflowNodeId: fromWorkflow?.node.id,
            model: fromWorkflow?.node.data.model,
            settings: fromWorkflow ? { ratio: fromWorkflow.node.data.ratio, resolution: fromWorkflow.node.data.resolution, duration: fromWorkflow.node.data.duration } : undefined,
          }];
        });

        if (readyJobs.length > 0) {
          setSessions((current) => current.map((session) => replaceSessionMediaUrls(session, replacements, dimensions, videoPosters)));
          setAssets((current) => current.map((asset) => replaceAssetMediaUrls(asset, replacements, videoPosters)));
          setAssetGenerateJobs((current) => current.map((job) => replaceAssetGenerateJobMediaUrls(job, replacements, dimensions)));
          setWorkflowItems((current) => current.map((item) => replaceWorkflowItemMediaUrls(item, replacements, videoPosters)));
        }
        persistItems.forEach((item) => {
          void fetch("/api/media-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item),
          }).catch((error) => console.warn("[media-assets] failed to persist saved generated asset", error));
        });
      } catch {
        // Remote media saving is best-effort; generated content can still display via temporary URL.
      }
    };

    void pollMediaSaveStatus();
    const interval = window.setInterval(() => void pollMediaSaveStatus(), 12_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [assetGenerateJobs, assets, isLoaded, workflowItems, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded || workspaceStorageMode !== "user") return;
    if (userProfileSaveTimerRef.current !== null) window.clearTimeout(userProfileSaveTimerRef.current);

    const payload = {
      nickname: currentUserNickname,
      phone: currentUserPhone,
      avatarUrl: currentUserAvatarUrl,
      language: userLanguage,
      notifyOnGenerationComplete,
      autoSaveHistory,
      previewWheelZoom,
      previewWheelFlip,
    };

    userProfileSaveTimerRef.current = window.setTimeout(() => {
      fetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => console.warn("用户资料保存失败"));
    }, 500);

    return () => {
      if (userProfileSaveTimerRef.current !== null) window.clearTimeout(userProfileSaveTimerRef.current);
    };
  }, [autoSaveHistory, currentUserAvatarUrl, currentUserNickname, currentUserPhone, isLoaded, notifyOnGenerationComplete, previewWheelFlip, previewWheelZoom, userLanguage, workspaceStorageMode]);

  useEffect(() => {
    if (!isLoaded) return;

    const expiredAssets = assets.filter((asset) => asset.type === "trash" && asset.purgeAt && asset.purgeAt <= Date.now());
    if (expiredAssets.length === 0) return;

    setPreviewAsset((current) => (current && isAssetTrashExpired(current, Date.now()) ? null : current));
  }, [assets, isLoaded, timerNow]);

  useEffect(() => {
    document.documentElement.dataset.flashmuseTheme = resolvedTheme;
    document.documentElement.dataset.flashmuseThemeMode = themeMode;
    try {
      window.localStorage.setItem(WORKSPACE_THEME_STORAGE_KEY, themeMode);
    } catch {
      // Theme preference is optional.
    }
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode]);

  useEffect(() => {
    return () => {
      if (typingScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(typingScrollFrameRef.current);
      }
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      if (inputTipTimerRef.current !== null) {
        window.clearTimeout(inputTipTimerRef.current);
      }
      inputTipQueueRef.current = [];
      inputCurrentTipRef.current = undefined;
      if (assetUploadTipTimerRef.current !== null) {
        window.clearTimeout(assetUploadTipTimerRef.current);
      }
      assetUploadTipQueueRef.current = [];
      assetUploadCurrentTipRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (activePanel !== "chat") return;
    messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [activePanel, activeSessionId, messages.length, isThinking]);

  useEffect(() => {
    if (activePanel !== "assets") return;
    const filterChanged = previousAssetFilterRef.current !== assetFilter;
    previousAssetFilterRef.current = assetFilter;
    const top = filterChanged ? 0 : assetScrollTopByFilterRef.current[assetFilter] ?? 0;
    if (filterChanged) {
      assetScrollTopByFilterRef.current = { ...assetScrollTopByFilterRef.current, [assetFilter]: 0 };
      setAssetScrollTopByFilter((current) => ({ ...current, [assetFilter]: 0 }));
    }
    const frame = window.requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top, behavior: "auto" }));
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel, assetFilter]);

  useEffect(() => {
    if (activePanel !== "chat") return;
    const timer = window.setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      const element = chatScrollRef.current;
      if (!element) return;

      const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      setShowScrollToBottom(distanceToBottom > 120);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activePanel, activeSessionId]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const updateScrollToBottomButton = () => {
    const element = chatScrollRef.current;
    if (!element) return;

    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (activePanel === "assets") {
      setShowScrollToBottom(false);
      setAssetScrollTopByFilter((current) => {
        const currentTop = current[assetFilter] ?? 0;
        if (Math.abs(currentTop - element.scrollTop) < 24) return current;
        const next = { ...current, [assetFilter]: element.scrollTop };
        assetScrollTopByFilterRef.current = next;
        return next;
      });
      if (distanceToBottom < 520) {
        setAssetRenderLimit((current) => current + ASSET_RENDER_PAGE_SIZE);
        if (assetsHasMore && assetsLoadStatus !== "loading") void loadWorkspaceAssets(false, assetFilter, assetsNextOffset, "scroll");
      }
      return;
    }

    setShowScrollToBottom(distanceToBottom > 120);
  };

  useEffect(() => {
    if (activePanel !== "assets" || !assetsHasMore || assetsLoadStatus !== "loaded") return;
    const frame = window.requestAnimationFrame(() => {
      const element = chatScrollRef.current;
      if (!element) return;
      if (element.scrollHeight <= element.clientHeight + 120) void loadWorkspaceAssets(false, assetFilter, assetsNextOffset, "auto");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePanel, assetFilter, assets.length, assetsHasMore, assetsLoadStatus, assetsNextOffset, loadWorkspaceAssets]);

  const closeAllPopupMenus = (except?: "session" | "workflow" | "collapsedHistory" | "user" | "message" | "assetAction" | "control" | "mention") => {
    if (except !== "session") setOpenSessionMenuId("");
    if (except !== "workflow") setOpenWorkflowMenuId("");
    if (except !== "session" && except !== "workflow") setCollapsedActionMenuPosition(null);
    if (except !== "collapsedHistory") {
      setIsCollapsedHistoryMenuOpen(false);
      setCollapsedActionMenuPosition(null);
    }
    if (except !== "user") {
      setIsUserMenuOpen(false);
      setIsThemeMenuOpen(false);
    }
    if (except !== "message") setOpenMessageMenuId("");
    if (except !== "assetAction") setOpenAssetActionMenuId("");
    if (except !== "control") setOpenControlMenu("");
    if (except !== "mention") setIsAtAssetMenuOpen(false);
  };

  const toggleSessionMenu = (sessionId: string, button: HTMLButtonElement) => {
    const shouldClose = openSessionMenuId === sessionId;
    closeAllPopupMenus(isSidebarCollapsed ? "collapsedHistory" : undefined);
    if (shouldClose) return;

    const rect = button.getBoundingClientRect();
    const menuHeight = 128;
    const reservedBottom = 32;
    if (isSidebarCollapsed) {
      setCollapsedActionMenuPosition({
        left: Math.min(window.innerWidth - 140, rect.right + 8),
        top: Math.min(window.innerHeight - menuHeight - reservedBottom, Math.max(12, rect.top - 8)),
      });
    }
    setSessionMenuPlacement(window.innerHeight - rect.bottom < menuHeight + reservedBottom ? "top" : "bottom");
    setOpenSessionMenuId(sessionId);
  };

  const toggleWorkflowMenu = (workflowId: string, button: HTMLButtonElement) => {
    const shouldClose = openWorkflowMenuId === workflowId;
    closeAllPopupMenus(isSidebarCollapsed ? "collapsedHistory" : undefined);
    if (shouldClose) return;

    const rect = button.getBoundingClientRect();
    const menuHeight = 132;
    const reservedBottom = 24;
    if (isSidebarCollapsed) {
      setCollapsedActionMenuPosition({
        left: Math.min(window.innerWidth - 140, rect.right + 8),
        top: Math.min(window.innerHeight - menuHeight - reservedBottom, Math.max(12, rect.top - 8)),
      });
    }
    setSessionMenuPlacement(window.innerHeight - rect.bottom < menuHeight + reservedBottom ? "top" : "bottom");
    setOpenWorkflowMenuId(workflowId);
  };

  const closeInputMenus = () => {
    closeAllPopupMenus();
  };

  useEffect(() => {
    if (!openSessionMenuId) return;

    const closeMenu = () => setOpenSessionMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openSessionMenuId]);

  useEffect(() => {
    if (!isCollapsedHistoryMenuOpen) return;

    const closeMenu = () => {
      setIsCollapsedHistoryMenuOpen(false);
      setOpenSessionMenuId("");
    };
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isCollapsedHistoryMenuOpen]);

  useEffect(() => {
    if (!openMessageMenuId) return;

    const closeMenu = () => setOpenMessageMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openMessageMenuId]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeMenu = () => {
      setIsUserMenuOpen(false);
      setIsThemeMenuOpen(false);
    };
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!openAssetActionMenuId) return;

    const closeMenu = () => {
      setOpenAssetActionMenuId("");
    };
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openAssetActionMenuId]);

  useEffect(() => {
    if (!openControlMenu) return;

    const closeMenu = () => setOpenControlMenu("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openControlMenu]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const closeMenu = () => setIsLanguageMenuOpen(false);
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isLanguageMenuOpen]);

  useEffect(() => {
    if (!isAtAssetMenuOpen) return;

    const closeMenu = () => setIsAtAssetMenuOpen(false);
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isAtAssetMenuOpen]);

  useEffect(() => {
    if (!isCharacterAtAssetMenuOpen) return;

    const closeMenu = () => setIsCharacterAtAssetMenuOpen(false);
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isCharacterAtAssetMenuOpen]);

  useEffect(() => {
    const options = getVideoDurationOptions(selectedGenerationModels.video);
    if (options.includes(selectedDurations.video)) return;

    const timer = window.setTimeout(() => {
      setSelectedDurations((current) => ({ ...current, video: options[0] }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedDurations.video, selectedGenerationModels.video]);

  useEffect(() => {
    const safeResolution = normalizeImageResolutionForModel(selectedGenerationModels.image, selectedResolutions.image);
    if (safeResolution === selectedResolutions.image) return;

    const timer = window.setTimeout(() => {
      setSelectedResolutions((current) => ({ ...current, image: safeResolution }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedGenerationModels.image, selectedRatios.image, selectedResolutions.image]);

  useEffect(() => {
    const safeResolution = normalizeImageResolutionForModel(characterGenerateModel, characterGenerateResolution);
    if (safeResolution === characterGenerateResolution) return;

    const timer = window.setTimeout(() => {
      setCharacterGenerateResolution(safeResolution);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [characterGenerateModel, characterGenerateResolution]);

  const renderControlMenu = (name: ControlMenuName, label: string, title: string, options: string[], value: string, onChange: (value: string) => void, icon?: typeof RiImageLine) => {
    const isDurationMenu = name === "duration";
    const isBytePlusDurationMenu = isDurationMenu && (selectedGenerationModels.video === "byteplus:video.seedance-2-0-fast" || selectedGenerationModels.video === "byteplus:video.seedance-2-0");
    const durationMenuRows = Math.ceil(options.length / 2);
    const durationMenuSplitIndex = Math.max(0, options.length - durationMenuRows);

    return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === name;
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu(name);
        }}
        className={`${toolButtonClassName} ${openControlMenu === name ? toolButtonActiveClassName : ""}`}
      >
        <ToolButtonLabel icon={icon} label={label} showChevron />
      </button>

      {openControlMenu === name ? (
        <div className="absolute bottom-full left-0 z-[70] mb-2 max-h-[420px] min-w-[180px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
          <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>
          <div className={isBytePlusDurationMenu ? "grid grid-cols-2 gap-1.5" : ""}>
          {options.map((option, index) => (
            <button
              key={option}
              type="button"
              style={isBytePlusDurationMenu ? { gridRow: durationMenuRows - (index < durationMenuSplitIndex ? index : index - durationMenuSplitIndex), gridColumn: index < durationMenuSplitIndex ? 2 : 1 } : undefined}
              onClick={() => {
                onChange(option);
                setOpenControlMenu("");
              }}
              className={
                option === value
                  ? `${isDurationMenu ? "h-10" : "my-[3px] h-11"} flex w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]`
                  : `${isDurationMenu ? "h-10" : "my-[3px] h-11"} flex w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]`
              }
            >
              <span className="flex items-center gap-2">
                {icon ? <IconRenderer icon={icon} /> : null}
                <span>{option}</span>
              </span>
              {option === value ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" /> : null}
            </button>
          ))}
          </div>
        </div>
      ) : null}
    </div>
    );
  };

  const renderModelMenu = () => {
    if (mode === "agent" || mode === "general") return null;

    const options = generationModelOptions[mode].filter((option) => enabledGenerationModelIds[mode].includes(option.id));
    const SelectedModelIcon = getGenerationModelIcon(selectedGenerationModel);

    return (
      <div className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "model";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("model");
          }}
          className={`${toolButtonClassName} ${openControlMenu === "model" ? toolButtonActiveClassName : ""} w-max max-w-none shrink-0 justify-start whitespace-nowrap max-[820px]:w-9 max-[820px]:justify-center max-[820px]:px-0`}
        >
          <span className="flex min-w-0 flex-nowrap items-center gap-2">
            {SelectedModelIcon ? <SelectedModelIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" /> : <AiGenerate3dIcon />}
            <span className={`whitespace-nowrap font-medium max-[820px]:hidden ${isGoldGenerationModel(selectedGenerationModel) ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedGenerationModelLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
        </button>

        {openControlMenu === "model" ? (
          <div className="absolute bottom-full left-0 z-[70] mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择模型</div>
            {options.length === 0 ? <div className="px-2 py-6 text-center text-[13px] text-[#999999]">暂无可用模型</div> : options.map((option) => {
              const ModelIcon = getGenerationModelIcon(option.id);
              const isGoldModel = isGoldGenerationModel(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedGenerationModels((current) => ({ ...current, [mode]: option.id }));
                    if (mode === "image") {
                      setSelectedResolutions((current) => ({ ...current, image: normalizeImageResolutionForModel(option.id, current.image) }));
                    } else if (mode === "video") {
                      setSelectedRatios((current) => ({ ...current, video: current.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(option.id, current.video, normalizeVideoResolutionForModel(option.id, selectedResolutions.video)) }));
                      setSelectedResolutions((current) => ({ ...current, video: normalizeVideoResolutionForModel(option.id, current.video) }));
                      setSelectedDurations((current) => {
                        const options = getVideoDurationOptions(option.id);
                        return { ...current, video: options.includes(current.video) ? current.video : options[0] };
                      });
                    }
                    setOpenControlMenu("");
                  }}
                  className={
                    option.id === selectedGenerationModel
                      ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]"
                      : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon />}
                    <span className={`min-w-0 truncate text-[13px] ${isGoldModel ? "text-[#b8860b]" : ""}`}>{option.label}</span>
                  </span>
                  {option.id === selectedGenerationModel ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderGeneralModelMenu = (kind: "chat" | "image" | "video", title: string) => {
    const menuName = kind === "chat" ? "generalChatModel" : kind === "image" ? "generalImageModel" : "generalVideoModel";
    const options: readonly (ConversationModel | GenerationModel)[] = kind === "chat"
      ? frontendConversationModels.filter((option) => enabledGeneralChatModelIds.includes(option.id))
      : generationModelOptions[kind].filter((option) => enabledGenerationModelIds[kind].includes(option.id));
    const getGeneralChatIcon = (modelId: string) => generalModelProviders[modelId] === "byteplus" ? BytePlusIcon : getGenerationModelIcon(modelId) ?? RiChat3Line;
    const selectedId = selectedGeneralModels[kind];
    const selectedLabel = kind === "chat" ? getConversationModelLabel(selectedId) : getGenerationModelLabel(kind, selectedId);
    const SelectedModelIcon = kind === "chat" ? getGeneralChatIcon(selectedId) : getGenerationModelIcon(selectedId);
    const selectedIsGold = kind === "chat" ? isGoldConversationModel(selectedId) : isGoldGenerationModel(selectedId);

    return (
      <div className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === menuName;
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu(menuName);
          }}
          className={`${toolButtonClassName} ${openControlMenu === menuName ? toolButtonActiveClassName : ""} w-full min-w-0 justify-start whitespace-nowrap px-2.5 max-[820px]:justify-center`}
        >
          <span className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
            {SelectedModelIcon ? <SelectedModelIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" /> : <AiGenerate3dIcon />}
            <span className={`min-w-0 flex-1 truncate whitespace-nowrap font-medium max-[820px]:hidden ${selectedIsGold ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
        </button>

        {openControlMenu === menuName ? (
          <div className="absolute bottom-full left-0 z-[70] mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>
            {options.length === 0 ? <div className="px-2 py-6 text-center text-[13px] text-[#999999]">暂无可用模型</div> : options.map((option) => {
              const ModelIcon = kind === "chat" ? getGeneralChatIcon(option.id) : getGenerationModelIcon(option.id);
              const isGoldModel = kind === "chat" ? isGoldConversationModel(option.id) : isGoldGenerationModel(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSelectedGeneralModels((current) => ({ ...current, [kind]: option.id }));
                    if (kind === "image") {
                      setSelectedResolutions((current) => ({ ...current, general: normalizeImageResolutionForModel(option.id, current.general) }));
                    } else if (kind === "video") {
                      setSelectedDurations((current) => {
                        const durationOptionsForModel = getVideoDurationOptions(option.id);
                        return { ...current, general: durationOptionsForModel.includes(current.general) ? current.general : durationOptionsForModel[0] };
                      });
                    }
                    setOpenControlMenu("");
                  }}
                  className={
                    option.id === selectedId
                      ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]"
                      : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon />}
                    <span className={`min-w-0 truncate text-[13px] ${isGoldModel ? "text-[#b8860b]" : ""}`}>{option.label}</span>
                  </span>
                  {option.id === selectedId ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterImageModelMenu = () => {
    const options = generationModelOptions.image.filter((option) => enabledAssetImageModelIds.includes(option.id));
    const selectedImageModel = characterGenerateModel;
    const selectedImageModelLabel = getGenerationModelLabel("image", selectedImageModel);
    const SelectedModelIcon = getGenerationModelIcon(selectedImageModel);

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterModel";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterModel");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] px-3.5 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterModel" ? toolButtonActiveClassName : ""}`}
        >
          <span className="flex min-w-0 max-w-full flex-nowrap items-center justify-center gap-2">
            {SelectedModelIcon ? <SelectedModelIcon className="h-4 w-4 shrink-0 text-[#777777]" aria-hidden="true" /> : <AiGenerate3dIcon />}
            <span className={`min-w-0 truncate whitespace-nowrap text-[13px] font-medium ${isGoldGenerationModel(selectedImageModel) ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedImageModelLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
          </span>
        </button>

        {openControlMenu === "characterModel" && !isCharacterGenerateInputDisabled ? (
          <div className="absolute left-0 top-full z-[70] mt-1 w-full rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择模型</div>
            {options.length === 0 ? <div className="px-2 py-3 text-[13px] text-[#999999]">暂无可用模型</div> : null}
            {options.map((option) => {
              const ModelIcon = getGenerationModelIcon(option.id);
              const isGoldModel = isGoldGenerationModel(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setCharacterGenerateModel(option.id);
                    setCharacterGenerateResolution((current) => normalizeImageResolutionForModel(option.id, current));
                    setOpenControlMenu("");
                  }}
                  className={
                    option.id === selectedImageModel
                      ? "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                      : "my-[3px] flex h-11 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {ModelIcon ? <ModelIcon className="h-4.5 w-4.5 shrink-0 text-[#555555]" aria-hidden="true" /> : <AiGenerate3dIcon />}
                    <span className={`min-w-0 truncate text-[13px] leading-none ${isGoldModel ? "text-[#b8860b]" : ""}`}>{option.label}</span>
                  </span>
                  {option.id === selectedImageModel ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterImageResolutionMenu = () => {
    const options = getSupportedImageResolutions(characterGenerateModel);
    const selectedImageResolution = normalizeImageResolutionForModel(characterGenerateModel, characterGenerateResolution);
    const selectedLabel = selectedImageResolution;

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterResolution";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterResolution");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterResolution" ? toolButtonActiveClassName : ""}`}
        >
          <span className="text-[13px] font-medium leading-none text-[#777777]">{selectedLabel}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
        </button>

        {openControlMenu === "characterResolution" && !isCharacterGenerateInputDisabled ? (
          <div className="absolute left-0 top-full z-[70] mt-1 w-full rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择分辨率</div>
            {options.map((option) => {
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCharacterGenerateResolution(option);
                    setOpenControlMenu("");
                  }}
                  className={
                    option === selectedImageResolution
                      ? "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                      : "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                  }
                >
                  <span className="text-[13px] font-medium leading-none">{option}</span>
                  {option === selectedImageResolution ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterRatioMenu = () => {
    const options: Array<{ value: AssetGenerateRatio; label: string; iconClassName: string }> = isShotGeneration
      ? [
        { value: "single", label: "竖屏分镜9:16", iconClassName: "h-4 w-[9px]" },
        { value: "three-view", label: "横屏分镜16:9", iconClassName: "h-[9px] w-4" },
      ]
      : isSceneGeneration
      ? [
        { value: "single", label: "单场景9:16", iconClassName: "h-4 w-[9px]" },
        { value: "three-view", label: "单场景16:9", iconClassName: "h-[9px] w-4" },
        { value: "scene-grid", label: "四宫格16:9", iconClassName: "h-[9px] w-4" },
      ]
      : [
        { value: "single", label: "单人9:16", iconClassName: "h-4 w-[9px]" },
        { value: "three-view", label: "三视图16:9", iconClassName: "h-[9px] w-4" },
      ];
    const selectedOption = options.find((option) => option.value === characterGenerateRatio) ?? options[0];

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterRatio";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterRatio");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] px-3.5 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterRatio" ? toolButtonActiveClassName : ""}`}
        >
          <span className={`${selectedOption.iconClassName} shrink-0 rounded-[2px] border border-[#777777]`} aria-hidden="true" />
          <span className="truncate text-[13px] font-medium leading-none text-[#777777]">{selectedOption.label}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
        </button>

        {openControlMenu === "characterRatio" && !isCharacterGenerateInputDisabled ? (
          <div className="absolute left-0 top-full z-[70] mt-1 w-full rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择比例</div>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setActiveAssetGenerateRatio(option.value);
                  setOpenControlMenu("");
                }}
                className={
                  option.value === characterGenerateRatio
                    ? "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                    : "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                }
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`${option.iconClassName} shrink-0 rounded-[2px] border border-[#777777]`} aria-hidden="true" />
                  <span className="truncate text-[13px] font-medium leading-none">{option.label}</span>
                </span>
                {option.value === characterGenerateRatio ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCharacterStyleMenu = () => {
    const options: Array<{ value: "realistic" | "2d" | "3d"; label: string }> = [
      { value: "realistic", label: "写实风格" },
      { value: "2d", label: "2D风格" },
      { value: "3d", label: "3D风格" },
    ];
    const selectedStyleLabel = options.find((option) => option.value === characterGenerateStyle)?.label ?? "写实风格";

    return (
      <div className="relative w-full" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isCharacterGenerateInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "characterStyle";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("characterStyle");
          }}
          className={`yinzao-tool-button inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] text-[#777777] outline-none transition disabled:cursor-not-allowed disabled:opacity-45 ${openControlMenu === "characterStyle" ? toolButtonActiveClassName : ""}`}
        >
          <span className="truncate text-[13px] font-medium leading-none text-[#777777]">{selectedStyleLabel}</span>
          <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />
        </button>

        {openControlMenu === "characterStyle" && !isCharacterGenerateInputDisabled ? (
          <div className="absolute left-0 top-full z-[70] mt-1 w-full rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择风格</div>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setCharacterGenerateStyle(option.value);
                  setOpenControlMenu("");
                }}
                className={
                  option.value === characterGenerateStyle
                    ? "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[13px] font-medium text-[#111111]"
                    : "my-[3px] flex h-10 w-full items-center justify-between rounded-[8px] px-3 text-left text-[13px] text-[#555555] hover:bg-[#f7f7f7]"
                }
              >
                <span className="truncate text-[13px] font-medium leading-none">{option.label}</span>
                {option.value === characterGenerateStyle ? <RiCheckLine className="ml-2 h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderImageSettingsMenu = () => {
    const currentResolutionOptions = mode === "video" ? getSupportedVideoResolutions(selectedGenerationModels.video) : getSupportedImageResolutions(selectedGenerationModels.image);
    const isSmartImageRatio = mode === "image" && selectedRatio === "智能比例";
    const isSmartSettings = isSmartImageRatio || (mode === "video" && selectedRatio === "智能比例");
    const displayResolution = isSmartImageRatio ? normalizeImageResolutionForModel(selectedGenerationModels.image, "智能比例") : selectedResolution;
    const currentRatioOptions = mode === "video" ? ["智能比例", ...getSupportedVideoRatios(selectedGenerationModels.video, displayResolution)] : ratioOptions;
    const displayRatio = mode === "video" ? (selectedRatio === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(selectedGenerationModels.video, selectedRatio, displayResolution)) : selectedRatio;
    const displayDimensions = getDisplayDimensions(displayRatio, displayResolution, mode, mode === "image" ? selectedGenerationModels.image : mode === "video" ? selectedGenerationModels.video : undefined);
    const isNonStandardVideoDimensions = mode === "video" && displayRatio !== "智能比例" && isNonStandardVideoSize(selectedGenerationModels.video, displayResolution, displayRatio);
    const imageResolutionLabel = mode === "image" ? getImageResolutionLabel(displayResolution) : getVideoResolutionLabel(displayResolution);
    const imageQualityBadgeLabel = mode === "image" ? getImageQualityBadgeLabel(displayResolution) : "";
    const settingsMenuWidthClassName = "w-[min(420px,calc(100vw-40px))]";
    const resolutionGridClassName = mode === "video" ? "gap-1.5 px-1.5" : "gap-2 px-2";
    const resolutionButtonPaddingClassName = mode === "video" ? "px-2" : "px-4";
    const resolutionLabelGapClassName = mode === "video" ? "gap-1.5" : "gap-2";

    return (
      <div className="relative" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isMainInputDisabled}
          onClick={() => {
            const shouldClose = openControlMenu === "imageSettings";
            closeAllPopupMenus();
            if (!shouldClose) setOpenControlMenu("imageSettings");
          }}
          className={`relative ${toolButtonClassName} pl-10 ${openControlMenu === "imageSettings" ? toolButtonActiveClassName : ""}`}
        >
          <span className="flex min-w-0 flex-nowrap items-center gap-2">
            <span className="font-medium text-[#777777] max-[820px]:hidden">{displayRatio} /</span>
            <span className={`font-medium max-[820px]:hidden ${imageQualityBadgeLabel ? "text-[#b8860b]" : "text-[#777777]"}`}>{imageResolutionLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2"><RatioOptionIcon option={displayRatio} /></span>
        </button>

        {openControlMenu === "imageSettings" ? (
          <div className={`absolute bottom-full left-0 z-[70] mb-2 ${settingsMenuWidthClassName} rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]`}>
            <div className="pb-2 text-[13px] font-medium text-[#a0a0a0]">选择比例</div>
            <div className="mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-[12px] bg-[#f6f6f6] px-1.5 py-1">
              {currentRatioOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSelectedRatios((current) => ({ ...current, [mode]: option }));
                    if (mode === "image") {
                      setSelectedResolutions((current) => ({ ...current, image: normalizeImageResolutionForModel(selectedGenerationModels.image, current.image) }));
                    }
                  }}
                  className={option === displayRatio ? "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] bg-white px-1 text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)]" : "flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 text-[#555555] transition hover:bg-white/80"}
                >
                  <RatioOptionIcon option={option} />
                  <span className="text-[13px] font-medium leading-none">{option === "智能比例" ? "智能" : option}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">选择分辨率</div>
            <div className={`mt-2 grid ${resolutionGridClassName} rounded-[12px] bg-[#f6f6f6] py-1 ${currentResolutionOptions.length === 1 ? "grid-cols-1" : currentResolutionOptions.length === 2 ? "grid-cols-2" : currentResolutionOptions.length === 3 ? "grid-cols-3" : "grid-cols-4"} ${isSmartSettings ? "opacity-45" : ""}`}>
              {currentResolutionOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={isSmartSettings}
                  onClick={() => {
                    setSelectedResolutions((current) => ({ ...current, [mode]: option }));
                    if (mode === "video") {
                      setSelectedRatios((current) => ({ ...current, video: current.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(selectedGenerationModels.video, current.video, option) }));
                    }
                  }}
                  className={option === displayResolution ? `flex h-[56px] items-center justify-center rounded-[10px] bg-white ${resolutionButtonPaddingClassName} text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.06)] disabled:cursor-not-allowed` : `flex h-[56px] items-center justify-center rounded-[10px] ${resolutionButtonPaddingClassName} text-[#666666] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                >
                  <span className={`flex items-center ${resolutionLabelGapClassName} whitespace-nowrap text-[13px] font-medium leading-none ${mode === "image" && getImageQualityBadgeLabel(option) ? "text-[#b8860b]" : ""}`}>
                    <ResolutionOptionIcon option={option} mode={mode} highlighted={mode === "image" && Boolean(getImageQualityBadgeLabel(option))} />
                    <span>{mode === "video" ? getVideoResolutionLabel(option) : getImageResolutionLabel(option)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">尺寸{isNonStandardVideoDimensions ? "（非标）" : ""}</div>
            <div className={`mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 ${isSmartSettings ? "opacity-45" : ""}`}>
              <div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4">
                <span className="text-[13px] font-medium text-[#9a9a9a]">W</span>
                <span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(displayDimensions.width)}</span>
              </div>
              <div className="flex h-[48px] w-[24px] items-center justify-center text-[#8a8a8a]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M4 4L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4">
                <span className="text-[13px] font-medium text-[#9a9a9a]">H</span>
                <span className="text-[13px] font-medium text-[#111111]">{formatDimensionValue(displayDimensions.height)}</span>
              </div>
              <div className="text-[13px] font-medium text-[#8a8a8a]">PX</div>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const startNewSession = () => {
    setOpenSessionMenuId("");

    if (activeSession && isEmptySession(activeSession)) {
      return;
    }

    const existingEmptySession = sessions.find(isEmptySession);

    if (existingEmptySession) {
      setActiveSessionId(existingEmptySession.id);
      return;
    }

    const session = createSession(nextConversationNumber);
    setNextConversationNumber((current) => Math.max(current + 1, nextConversationNumber + 1));
    setSessions((current) => [session, ...current]);
    setHistoryTotalSessionCount((count) => count + 1);
    setActiveSessionId(session.id);
  };

  const startNewWorkflow = () => {
    setOpenWorkflowMenuId("");
    const existingUntitledWorkflow = activeWorkflowItems.find(isUntitledWorkflow);
    if (existingUntitledWorkflow) {
      setActiveWorkflowId(existingUntitledWorkflow.id);
      return;
    }

    const workflow = createWorkflowItem(workflowItems);
    setWorkflowItems((current) => [workflow, ...current]);
    setWorkflowVisibleItemCount((count) => Math.max(WORKFLOW_INITIAL_ITEM_COUNT, Math.min(activeWorkflowItems.length + 1, count + 1)));
    setActiveWorkflowId(workflow.id);
  };

  const pinWorkflow = (workflowId: string) => {
    setOpenWorkflowMenuId("");
    setWorkflowItems((current) => {
      const target = current.find((item) => item.id === workflowId);
      if (!target) return current;
      return [{ ...target, updatedAt: Date.now() }, ...current.filter((item) => item.id !== workflowId)];
    });
  };

  const renameWorkflow = (workflowId: string) => {
    const workflow = workflowItems.find((item) => item.id === workflowId);
    if (!workflow) return;

    setOpenWorkflowMenuId("");
    setRenamingSessionId(workflowId);
    setRenameInput(workflow.title);
  };

  const deleteWorkflow = (workflowId: string) => {
    setOpenWorkflowMenuId("");
    setWorkflowItems((current) => {
      const deletedAt = Date.now();
      const next = ensureWorkflowItems(current.map((item) => item.id === workflowId ? { ...item, deletedAt, updatedAt: deletedAt } : item));
      const nextVisible = next.filter((item) => !isDeletedWorkflow(item));
      setActiveWorkflowId((currentActiveId) => {
        if (currentActiveId !== workflowId && nextVisible.some((item) => item.id === currentActiveId)) return currentActiveId;
        return nextVisible[0]?.id ?? next[0]?.id ?? "";
      });
      return next;
    });
  };

  const updateWorkflowCanvas = useCallback((workflowId: string, canvas: WorkflowCanvasState) => {
    setWorkflowItems((current) => {
      const target = current.find((item) => item.id === workflowId);
      if (!target) return current;
      let title = target.title;
      let workflowCode = getWorkflowCode(target);
      if (isUntitledWorkflow(target) && hasWorkflowAction(canvas)) {
        const result = getNextWorkflowTitleFromNumber(current, nextWorkflowNumber);
        title = result.title;
        workflowCode = `w${getWorkflowNumberFromTitle(result.title)}`;
        setNextWorkflowNumber(result.nextWorkflowNumber);
      }
      return current.map((item) => item.id === workflowId ? { ...item, workflowCode, title, canvas, updatedAt: Date.now() } : item);
    });
  }, [nextWorkflowNumber]);

  const pinSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const target = current.find((session) => session.id === sessionId);
      if (!target) return current;
      return [{ ...target, updatedAt: Date.now() }, ...current.filter((session) => session.id !== sessionId)];
    });
  };

  const renameSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;

    setOpenSessionMenuId("");
    setRenamingSessionId(sessionId);
    setRenameInput(session.title);
  };

  const submitRenameSession = () => {
    const title = renameInput.trim();
    if (!title) return;

    if (activePanel === "workflow") {
      setWorkflowItems((current) => current.map((item) => (item.id === renamingSessionId ? { ...item, title, updatedAt: Date.now() } : item)));
    } else {
      setSessions((current) => current.map((item) => (item.id === renamingSessionId ? { ...item, title, updatedAt: Date.now() } : item)));
      if (workspaceStorageMode === "user") {
        void fetch("/api/credits/conversation-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: renamingSessionId, title }),
        }).catch(() => undefined);
      }
    }
    setRenamingSessionId("");
    setRenameInput("");
  };

  const cancelRenameSession = () => {
    setRenamingSessionId("");
    setRenameInput("");
  };

  const persistMediaAssetState = useCallback((asset: AssetItem | undefined, patch: Record<string, unknown>) => {
    if (!asset || workspaceStorageMode !== "user") return;
    if (isRemoteMediaUrl(asset.url)) return;
    void fetch("/api/media-assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: asset.id, mediaAssetId: asset.mediaId, url: asset.url, ...patch }),
    }).catch((error) => {
      console.warn("[media-assets] failed to update asset state", error);
      showInputTip("资产状态保存失败，请刷新后重试");
    });
  }, [showInputTip, workspaceStorageMode]);

  const submitRenameAsset = () => {
    const name = assetRenameInput.trim();
    if (!name) return;
    const asset = assets.find((item) => item.id === renamingAssetId);

    setAssets((current) => current.map((asset) => {
      if (asset.id !== renamingAssetId) return asset;
      const systemName = asset.systemName || asset.name;
      return { ...asset, systemName, userName: name === systemName ? undefined : name, name };
    }));
    setOpenAssetActionMenuId("");
    setRenamingAssetId("");
    setAssetRenameInput("");
    persistMediaAssetState(asset, { name });
  };

  const cancelRenameAsset = () => {
    setRenamingAssetId("");
    setAssetRenameInput("");
  };

  const deleteAsset = (assetId: string) => {
    setOpenAssetActionMenuId("");
    const deletingAsset = assets.find((asset) => asset.id === assetId);
    setAssets((current) => current.map((asset) => (asset.id === assetId ? { ...asset, previousType: asset.type, type: "trash", deletedAt: Date.now(), purgeAt: Date.now() + ASSET_TRASH_RETENTION_MS } : asset)));
    if (deletingAsset?.url) setAssetGenerateJobs((current) => current.filter((job) => job.result.url !== deletingAsset.url));
    setPreviewAsset((current) => (current?.id === assetId ? { ...current, previousType: current.type, type: "trash", deletedAt: Date.now(), purgeAt: Date.now() + ASSET_TRASH_RETENTION_MS } : current));
    persistMediaAssetState(deletingAsset, { delete: true });
  };

  const restoreAsset = (assetId: string) => {
    setOpenAssetActionMenuId("");
    const restoringAsset = assets.find((asset) => asset.id === assetId);
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              type: getRestoreAssetType(asset),
              previousType: undefined,
              deletedAt: undefined,
              purgeAt: undefined,
            }
          : asset,
      ),
    );
    persistMediaAssetState(restoringAsset, { restore: true });
  };

  const deleteSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const deletedAt = Date.now();
      const nextSessions = current.map((session) => (session.id === sessionId ? { ...session, deletedAt, updatedAt: deletedAt } : session));
      const visibleSessions = nextSessions.filter((session) => !isDeletedSession(session));
      const safeSessions = visibleSessions.length > 0 ? nextSessions : [createSession(nextConversationNumber), ...nextSessions];
      if (visibleSessions.length === 0) setNextConversationNumber((current) => Math.max(current + 1, nextConversationNumber + 1));
      setHistoryTotalSessionCount((count) => Math.max(visibleSessions.length === 0 ? 1 : 0, count - 1 + (visibleSessions.length === 0 ? 1 : 0)));
      const nextVisibleSessions = safeSessions.filter((session) => !isDeletedSession(session));

      if (sessionId === activeSessionId || !nextVisibleSessions.some((session) => session.id === activeSessionId)) {
        setActiveSessionId(nextVisibleSessions[0]?.id ?? safeSessions[0].id);
      }

      return safeSessions;
    });
  };

  const appendAssistantMessage = useCallback((sessionId: string, payload: Partial<Message> & Pick<Message, "content">) => {
    const messageId = createClientId();
    const shouldTypeMessage = Boolean(payload.content.trim()) && payload.mode !== "image" && payload.mode !== "video" && !payload.error;
    if (shouldTypeMessage) {
      setActiveTypingMessageIds((current) => {
        const next = new Set(current);
        next.add(messageId);
        return next;
      });
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? payload.requestId && payload.mode !== "video" && session.messages.some((message) => message.role === "assistant" && message.requestId === payload.requestId)
            ? session
            : {
                ...session,
                updatedAt: Date.now(),
                messages: [
                  ...session.messages,
                  {
                    id: messageId,
                    role: "assistant",
                    content: payload.content,
                    suggestions: normalizeMessageSuggestions(payload.suggestions),
                    createdAt: Date.now(),
                    requestId: payload.requestId,
                    images: payload.images,
                    imageResultSlots: payload.imageResultSlots ?? (payload.mode === "image" && payload.pendingImageCount ? Array.from({ length: payload.pendingImageCount }).map(() => ({ type: "pending" as const, startedAt: Date.now() })) : undefined),
                    imageDimensions: payload.imageDimensions,
                    imagePrompts: payload.imagePrompts,
                    imageReferences: payload.imageReferences,
                    uploadedFiles: payload.uploadedFiles,
                    videoDimensions: payload.videoDimensions,
                    videoUrl: payload.videoUrl,
                    videos: payload.videos,
                    videoPrompts: payload.videoPrompts,
                    videoDimensionsMap: payload.videoDimensionsMap,
                    textModel: payload.textModel,
                    statusText: payload.statusText,
                    pendingImageCount: payload.pendingImageCount,
                    failedImageCount: payload.failedImageCount,
                    pendingVideoCount: payload.pendingVideoCount,
                    failedVideoCount: payload.failedVideoCount,
                    error: payload.error,
                    mode: payload.mode,
                    generationMeta: payload.generationMeta,
                  },
                ],
              }
          : session,
      ),
    );
  }, []);

  const appendSystemMessage = useCallback((sessionId: string, payload: Pick<Message, "content"> & Partial<Pick<Message, "mode" | "error">>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: [
                ...session.messages,
                {
                  id: createClientId(),
                  role: "system",
                  content: payload.content,
                  mode: payload.mode,
                  error: payload.error,
                  createdAt: Date.now(),
                },
              ],
            }
          : session,
      ),
    );
  }, []);

  const updateAssistantMessageByRequestId = useCallback((sessionId: string, requestId: string, payload: Partial<Message>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      ...payload,
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const appendImagesToAssistantMessage = useCallback((sessionId: string, requestId: string, imageUrls: string[], imageDimensions: Record<string, ImageDimensions> = {}, pendingCompleteCount = 1, imagePrompts: Record<string, string> = {}, mediaSystemNames: Record<string, string> = {}, retryFailedIndex?: number, targetSlotIndex?: number, imagePromptDetails: Record<string, PromptDetail> = {}) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      images: message.retryingFailedImageIndexes?.length ? [...(message.images ?? []), ...imageUrls] : [...(message.images ?? []), ...imageUrls],
                      imageResultSlots: (() => {
                        const requestedCount = getRequestedImageDisplayCount(message) ?? Math.max(1, (message.images?.length ?? 0) + (message.failedImageCount ?? 0) + (message.pendingImageCount ?? 0));
                        const currentSlots = message.imageResultSlots ?? [
                          ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: message.failedImageCount ?? 0 }).map((_, index) => ({ type: "failed" as const, retryingStartedAt: message.retryingFailedImageStartedAt?.[index] })),
                          ...Array.from({ length: message.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: message.createdAt })),
                        ];
                        while (currentSlots.length < requestedCount) currentSlots.push({ type: "pending" as const, startedAt: message.createdAt });
                        let failedOrdinal = -1;
                        const replaceSlotIndex = targetSlotIndex ?? (retryFailedIndex === undefined
                          ? currentSlots.findIndex((slot) => slot.type === "pending" || (slot.type === "failed" && slot.retryingStartedAt))
                          : currentSlots.findIndex((slot) => {
                              if (slot.type !== "failed") return false;
                              failedOrdinal += 1;
                              return failedOrdinal === retryFailedIndex;
                            }));
                        if (replaceSlotIndex >= 0 && imageUrls[0]) {
                          return currentSlots.map((slot, index) => index === replaceSlotIndex ? { type: "image" as const, url: imageUrls[0] } : slot).slice(0, requestedCount);
                        }

                        return currentSlots.slice(0, requestedCount);
                      })(),
                      imageDimensions: { ...(message.imageDimensions ?? {}), ...imageDimensions },
                      imagePrompts: { ...(message.imagePrompts ?? {}), ...imagePrompts },
                      imagePromptDetails: { ...(message.imagePromptDetails ?? {}), ...imagePromptDetails },
                      mediaSystemNames: { ...(message.mediaSystemNames ?? {}), ...mediaSystemNames },
                      pendingImageCount: Math.max(0, (message.pendingImageCount ?? (message.retryingFailedImageIndexes?.length ? 0 : 1)) - pendingCompleteCount),
                      failedImageCount: message.retryingFailedImageIndexes?.length ? Math.max(0, (message.failedImageCount ?? 1) - pendingCompleteCount) : message.failedImageCount,
                      retryingFailedImageIndexes: message.retryingFailedImageIndexes?.slice(pendingCompleteCount),
                      retryingFailedImageStartedAt: message.retryingFailedImageIndexes?.slice(pendingCompleteCount).reduce<Record<number, number>>((next, index) => ({ ...next, [index]: message.retryingFailedImageStartedAt?.[index] ?? Date.now() }), {}),
                      mode: "image",
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const markAssistantImageFailure = useCallback((sessionId: string, requestId: string, retryFailedIndex?: number, errorMessage?: string, targetSlotIndex?: number) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      error: errorMessage ?? message.error,
                      failedImageCount: message.retryingFailedImageIndexes?.length ? message.failedImageCount : (message.failedImageCount ?? 0) + 1,
                      imageResultSlots: (() => {
                        const requestedCount = getRequestedImageDisplayCount(message) ?? Math.max(1, (message.images?.length ?? 0) + (message.failedImageCount ?? 0) + (message.pendingImageCount ?? 0));
                        const currentSlots = message.imageResultSlots ?? [
                          ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: message.failedImageCount ?? 0 }).map((_, index) => ({ type: "failed" as const, retryingStartedAt: message.retryingFailedImageStartedAt?.[index] })),
                          ...Array.from({ length: message.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: message.createdAt })),
                        ];
                        while (currentSlots.length < requestedCount) currentSlots.push({ type: "pending" as const, startedAt: message.createdAt });
                        let failedOrdinal = -1;
                        const failedSlotIndex = targetSlotIndex ?? (retryFailedIndex === undefined
                          ? currentSlots.findIndex((slot) => slot.type === "pending" || (slot.type === "failed" && slot.retryingStartedAt))
                          : currentSlots.findIndex((slot) => {
                              if (slot.type !== "failed") return false;
                              failedOrdinal += 1;
                              return failedOrdinal === retryFailedIndex;
                            }));
                        if (failedSlotIndex >= 0) {
                          return currentSlots.map((slot, index) => index === failedSlotIndex ? { type: "failed" as const } : slot).slice(0, requestedCount);
                        }

                        return currentSlots.slice(0, requestedCount);
                      })(),
                      mediaErrorReasons: (() => {
                        const reason = errorMessage ?? GENERIC_MEDIA_ERROR_MESSAGE;
                        const currentReasons = message.mediaErrorReasons ?? [];
                        if (retryFailedIndex === undefined) return [...currentReasons, reason];
                        const nextReasons = [...currentReasons];
                        nextReasons[retryFailedIndex] = reason;
                        return nextReasons;
                      })(),
                      pendingImageCount: Math.max(0, (message.pendingImageCount ?? (message.retryingFailedImageIndexes?.length ? 0 : 1)) - 1),
                      retryingFailedImageIndexes: message.retryingFailedImageIndexes?.slice(1),
                      retryingFailedImageStartedAt: message.retryingFailedImageIndexes?.slice(1).reduce<Record<number, number>>((next, index) => ({ ...next, [index]: message.retryingFailedImageStartedAt?.[index] ?? Date.now() }), {}),
                      mode: "image",
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const finalizeAssistantImageFailures = useCallback((sessionId: string, requestId: string, failureCount: number, payload: Pick<Message, "content" | "mode"> & Partial<Pick<Message, "error" | "statusText" | "mediaErrorReasons">>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) => {
                if (message.role !== "assistant" || message.requestId !== requestId) return message;

                const requestedCount = getRequestedImageDisplayCount(message) ?? Math.max(1, (message.images?.length ?? 0) + failureCount);
                const currentSlots = message.imageResultSlots ?? [
                  ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
                  ...Array.from({ length: message.failedImageCount ?? 0 }).map(() => ({ type: "failed" as const })),
                  ...Array.from({ length: message.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: message.createdAt })),
                ];
                while (currentSlots.length < requestedCount) currentSlots.push({ type: "pending" as const, startedAt: message.createdAt });
                let remainingFailures = failureCount;
                const finalizedSlots = currentSlots.map((slot) => {
                  if (slot.type === "image") return slot;
                  if (remainingFailures <= 0) return slot.type === "failed" ? { type: "failed" as const } : slot;
                  remainingFailures -= 1;
                  return { type: "failed" as const };
                }).slice(0, requestedCount);

                return {
                  ...message,
                  ...payload,
                  pendingImageCount: 0,
                  failedImageCount: Math.max(message.failedImageCount ?? 0, failureCount),
                  imageResultSlots: finalizedSlots,
                  mediaErrorReasons: payload.mediaErrorReasons ?? message.mediaErrorReasons,
                  retryingFailedImageIndexes: undefined,
                  retryingFailedImageStartedAt: undefined,
                };
              }),
            }
          : session,
      ),
    );
  }, []);

  const appendVideoToAssistantMessage = useCallback((sessionId: string, requestId: string, videoUrl: string, prompt: string, mediaSystemName?: string, posterUrl?: string, promptDetail?: PromptDetail) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      videoUrl: message.videoUrl ?? videoUrl,
                      videos: [...(message.videos ?? (message.videoUrl ? [message.videoUrl] : [])), videoUrl].filter((url, index, array) => array.indexOf(url) === index),
                      videoPrompts: { ...(message.videoPrompts ?? {}), [videoUrl]: prompt },
                      videoPromptDetails: promptDetail ? { ...(message.videoPromptDetails ?? {}), [videoUrl]: promptDetail } : message.videoPromptDetails,
                      videoPosters: posterUrl ? { ...(message.videoPosters ?? {}), [videoUrl]: posterUrl } : message.videoPosters,
                      mediaSystemNames: mediaSystemName ? { ...(message.mediaSystemNames ?? {}), [videoUrl]: mediaSystemName } : message.mediaSystemNames,
                      pendingVideoCount: Math.max(0, (message.pendingVideoCount ?? (message.retryingFailedVideoIndexes?.length ? 0 : 1)) - 1),
                      failedVideoCount: message.retryingFailedVideoIndexes?.length ? Math.max(0, (message.failedVideoCount ?? 1) - 1) : message.failedVideoCount,
                      retryingFailedVideoIndexes: message.retryingFailedVideoIndexes?.slice(1),
                      retryingFailedVideoStartedAt: message.retryingFailedVideoIndexes?.slice(1).reduce<Record<number, number>>((next, index) => ({ ...next, [index]: message.retryingFailedVideoStartedAt?.[index] ?? Date.now() }), {}),
                      mode: "video",
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const markAssistantVideoFailure = useCallback((sessionId: string, requestId: string, errorMessage?: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.map((message) =>
                message.role === "assistant" && message.requestId === requestId
                  ? {
                      ...message,
                      error: errorMessage ?? message.error,
                      mediaErrorReasons: [...(message.mediaErrorReasons ?? []), errorMessage ?? GENERIC_MEDIA_ERROR_MESSAGE],
                      failedVideoCount: message.retryingFailedVideoIndexes?.length ? message.failedVideoCount : (message.failedVideoCount ?? 0) + 1,
                      pendingVideoCount: Math.max(0, (message.pendingVideoCount ?? (message.retryingFailedVideoIndexes?.length ? 0 : 1)) - 1),
                      retryingFailedVideoIndexes: message.retryingFailedVideoIndexes?.slice(1),
                      retryingFailedVideoStartedAt: message.retryingFailedVideoIndexes?.slice(1).reduce<Record<number, number>>((next, index) => ({ ...next, [index]: message.retryingFailedVideoStartedAt?.[index] ?? Date.now() }), {}),
                      mode: "video",
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const updateMessageImageDimensions = useCallback((sessionId: string, messageId: string, imageUrl: string, dimensions: ImageDimensions) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: session.messages.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      imageDimensions: { ...(message.imageDimensions ?? {}), [imageUrl]: dimensions },
                    }
                  : message,
              ),
            }
          : session,
      ),
    );
  }, []);

  const updateMessageVideoDimensions = useCallback((sessionId: string, messageId: string, dimensions: ImageDimensions) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              messages: session.messages.map((message) => (message.id === messageId ? { ...message, videoDimensions: dimensions } : message)),
            }
          : session,
      ),
    );
  }, []);

  const updatePendingRequest = useCallback((sessionId: string, requestId: string, payload: Partial<PendingGeneration>) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId && getSessionPendingRequests(session).some((request) => request.id === requestId)
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: getSessionPendingRequests(session).map((request) => (request.id === requestId ? { ...request, ...payload } : request)),
            }
          : session,
      ),
    );
  }, []);

  const addGeneratedAssets = useCallback((sessionId: string, mode: WorkMode, sourcePrompt: string, urls: string[], messageId?: string, assetTargetType?: AssetTargetType, contextText = "", mediaSystemNames: Record<string, string> = {}, mediaPosterUrls: Record<string, string> = {}, mediaPromptDetails: Record<string, PromptDetail> = {}) => {
    if (urls.length === 0) return;

    const namingText = [sourcePrompt, contextText].filter(Boolean).join("\n");
    const type = getAssetTypeFromText(namingText || sourcePrompt, mode, assetTargetType);
    const simulatedAssets = [...assets];
    const itemsToPersist: Array<{ url: string; name: string; posterUrl?: string }> = [];
    urls.forEach((url) => {
      if (!url || simulatedAssets.some((asset) => asset.url === url)) return;
      const systemName = mediaSystemNames[url] || getConversationAssetName(mode, simulatedAssets);
      if (!isRemoteMediaUrl(url)) itemsToPersist.push({ url, name: systemName, posterUrl: mediaPosterUrls[url] });
      simulatedAssets.unshift({ id: url, type, name: systemName, systemName, url, posterUrl: mediaPosterUrls[url], librarySource: "conversation", sourcePrompt: namingText || sourcePrompt, promptSource: "generated", sessionId, messageId, createdAt: Date.now() });
    });

    setAssets((current) => {
      let nextAssets = current;

      urls.forEach((url) => {
        if (!url || nextAssets.some((asset) => asset.url === url)) return;

        const systemName = mediaSystemNames[url] || getConversationAssetName(mode, nextAssets);
        const name = systemName;
        nextAssets = [
          {
            id: createClientId(),
            type,
            name,
            systemName,
            url,
            posterUrl: mediaPosterUrls[url],
            librarySource: "conversation",
            sourcePrompt: namingText || sourcePrompt,
            promptSource: "generated",
            sessionId,
            messageId,
            createdAt: Date.now(),
          },
          ...nextAssets,
        ];
      });

      return nextAssets;
    });
    if (workspaceStorageMode === "user") {
      itemsToPersist.forEach((item) => {
        const promptDetail = mediaPromptDetails[item.url];
        void fetch("/api/media-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            name: item.name,
            currentCategory: mode === "video" ? "conversation_videos" : "conversation_images",
            mediaType: mode === "video" ? "video" : "image",
            posterUrl: item.posterUrl,
            sourcePrompt: promptDetail?.prompt || namingText || sourcePrompt,
            sourceDetail: getPromptSourceDetail(promptDetail),
            promptSource: "generated",
            conversationId: sessionId,
            messageId,
          }),
        }).catch((error) => console.warn("[media-assets] failed to persist conversation generated asset", error));
      });
    }
  }, [assets, workspaceStorageMode]);

  const addUploadedImagesToAssets = useCallback((sessionId: string, images: UploadedImage[], contextText: string) => {
    if (images.length === 0) return;
    void contextText;

    const simulatedAssets = [...assets];
    const itemsToPersist: Array<{ url: string; name: string }> = [];
    images.forEach((image) => {
      if (!image.url || simulatedAssets.some((asset) => asset.url === image.url)) return;
      const baseName = getUploadedImageReferenceName(image, images);
      const name = getUniqueUploadedAssetName(baseName, simulatedAssets, image.url);
      itemsToPersist.push({ url: image.url, name });
      simulatedAssets.unshift({ id: image.url, type: "other", name, systemName: name, url: image.url, librarySource: "conversation", sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload", sessionId, lockedType: true, createdAt: Date.now() });
    });

    setAssets((current) => {
      let nextAssets = current;

      images.forEach((image) => {
        if (!image.url || nextAssets.some((asset) => asset.url === image.url)) return;

        const baseName = getUploadedImageReferenceName(image, images);
        const name = getUniqueUploadedAssetName(baseName, nextAssets, image.url);

        nextAssets = [
          {
            id: createClientId(),
            type: "other",
            name,
            systemName: name,
            url: image.url,
            librarySource: "conversation",
            sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
            promptSource: "upload",
            sessionId,
            lockedType: true,
            createdAt: Date.now(),
          },
          ...nextAssets,
        ];
      });

      return nextAssets;
    });
    if (workspaceStorageMode === "user") {
      itemsToPersist.forEach((item) => {
        void fetch("/api/media-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            name: item.name,
            currentCategory: "conversation_uploads",
            mediaType: "image",
            sourcePrompt: UPLOAD_IMAGE_PROMPT_PLACEHOLDER,
            promptSource: "upload",
            conversationId: sessionId,
          }),
        }).catch((error) => console.warn("[media-assets] failed to persist conversation uploaded asset", error));
      });
    }
  }, [assets, workspaceStorageMode]);

  const addWorkflowGeneratedAssets = useCallback((workflowId: string, nodeId: string, media: { kind: "image" | "video"; urls: string[]; posterUrl?: string; sourcePrompt: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: Record<string, ImageDimensions> }) => {
    const cleanUrls = media.urls.filter((url) => url && !url.startsWith("data:"));
    if (cleanUrls.length === 0) return;
    const workflow = workflowItems.find((item) => item.id === workflowId);
    if (!workflow) return;
    const reserved = reserveWorkflowMediaSystemNamesForItems(workflowItems, assets, workflowId, media.kind, cleanUrls);
    if (reserved.workflows !== workflowItems) {
      const reservedWorkflow = reserved.workflows.find((item) => item.id === workflowId);
      if (reservedWorkflow) {
        setWorkflowItems((current) => current.map((item) => item.id === workflowId ? {
          ...item,
          workflowCode: reservedWorkflow.workflowCode,
          nextImageNumber: Math.max(item.nextImageNumber ?? 1, reservedWorkflow.nextImageNumber ?? 1),
          nextVideoNumber: Math.max(item.nextVideoNumber ?? 1, reservedWorkflow.nextVideoNumber ?? 1),
        } : item));
      }
    }

    const items = cleanUrls.map((url) => {
      const name = reserved.names[url] ?? (media.kind === "video" ? "视频生成" : "图片生成");
      const dimensions = media.dimensions?.[url];
      const displayRatio = dimensions ? getCommonRatioLabel(dimensions.width, dimensions.height) : media.ratio || "-";
      const previewMeta: PreviewMediaMeta = media.kind === "video"
        ? { modelLabel: media.model ? getGenerationModelLabel("video", media.model) : "-", ratio: displayRatio, sizeText: dimensions ? `${dimensions.width} × ${dimensions.height}` : "-", resolution: media.resolution || "-", mode: "video", duration: media.duration }
        : { modelLabel: media.model ? getGenerationModelLabel("image", media.model) : "-", ratio: displayRatio, sizeText: dimensions ? `${dimensions.width} × ${dimensions.height}` : "-", resolution: media.resolution || "-", mode: "image" };
      return { url, name, dimensions, previewMeta };
    });

    const systemNamesByUrl = Object.fromEntries(items.map((item) => [item.url, item.name]));
    setWorkflowItems((current) => current.map((workflow) => {
      if (workflow.id !== workflowId || !workflow.canvas?.nodes?.length) return workflow;
      return {
        ...workflow,
        canvas: {
          ...workflow.canvas,
          nodes: workflow.canvas.nodes.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, mediaSystemNames: { ...(node.data.mediaSystemNames ?? {}), ...systemNamesByUrl } } } : node),
        },
      };
    }));

    setAssets((current) => {
      let next = current;
      items.forEach((item) => {
        const existingIndex = next.findIndex((asset) => normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(item.url) && isWorkflowAsset(asset));
        if (existingIndex >= 0) {
          next = next.map((asset, index) => index === existingIndex ? { ...asset, name: item.name, systemName: item.name, userName: undefined, sourcePrompt: media.sourcePrompt, previewMeta: item.previewMeta, workflowId, workflowNodeId: nodeId } : asset);
          return;
        }
        next = [{
          id: createClientId(),
          type: media.kind === "video" ? "shot_video" : "other",
          name: item.name,
          systemName: item.name,
          url: item.url,
          posterUrl: media.kind === "video" ? media.posterUrl : undefined,
          librarySource: "workflow",
          sourcePrompt: media.sourcePrompt,
          promptSource: "generated",
          previewMeta: item.previewMeta,
          sessionId: workflowId,
          workflowId,
          workflowNodeId: nodeId,
          lockedType: true,
          createdAt: Date.now(),
        }, ...next];
      });
      return next;
    });

    if (workspaceStorageMode === "user") {
      items.forEach((item) => {
        if (isRemoteMediaUrl(item.url)) return;
        void fetch("/api/media-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: item.url,
            name: item.name,
            currentCategory: media.kind === "video" ? "workflow_videos" : "workflow_images",
            mediaType: media.kind,
            posterUrl: media.kind === "video" ? media.posterUrl : undefined,
            dimensions: item.dimensions,
            sourcePrompt: media.sourcePrompt,
            promptSource: "generated",
            workflowId,
            workflowNodeId: nodeId,
            model: media.model,
            settings: { ratio: media.ratio, resolution: media.resolution, duration: media.duration },
          }),
        }).then(() => loadWorkspaceAssets(true, media.kind === "video" ? "workflow_videos" : "workflow_images", 0, "auto")).catch((error) => console.warn("[media-assets] failed to persist workflow generated asset", error));
      });
    }
  }, [assets, loadWorkspaceAssets, workflowItems, workspaceStorageMode]);

  const reserveMediaSystemNames = useCallback((sessionId: string, mode: WorkMode, urls: string[]) => {
    const cleanUrls = urls.filter((url) => url && !url.startsWith("data:"));
    const result: Record<string, string> = {};
    if (cleanUrls.length === 0) return result;

    const currentSession = sessionsRef.current.find((session) => session.id === sessionId);
    const conversationCode = currentSession?.conversationCode || "d0";
    let nextImageNumber = Math.max(1, Math.floor(currentSession?.nextImageNumber ?? 1));
    let nextVideoNumber = Math.max(1, Math.floor(currentSession?.nextVideoNumber ?? 1));
    const existingNames = new Map<string, string>();
    const usedSystemNames = new Set<string>();
    currentSession?.messages.forEach((message) => {
      Object.entries(message.mediaSystemNames ?? {}).forEach(([url, systemName]) => {
        if (!systemName) return;
        usedSystemNames.add(systemName);
        const imageNumber = Number(systemName.match(/^image_(\d+)_d\d+$/)?.[1]);
        const videoNumber = Number(systemName.match(/^video_(\d+)_d\d+$/)?.[1]);
        if (Number.isFinite(imageNumber)) nextImageNumber = Math.max(nextImageNumber, imageNumber + 1);
        if (Number.isFinite(videoNumber)) nextVideoNumber = Math.max(nextVideoNumber, videoNumber + 1);
        if (url) existingNames.set(normalizeMediaUrlForMatch(url), systemName);
      });
    });

    cleanUrls.forEach((url) => {
      const key = normalizeMediaUrlForMatch(url);
      const existingName = existingNames.get(key);
      if (existingName) {
        result[url] = existingName;
        return;
      }

      if (mode === "video") {
        while (usedSystemNames.has(buildConversationMediaSystemName("video", nextVideoNumber, conversationCode))) nextVideoNumber += 1;
        result[url] = buildConversationMediaSystemName("video", nextVideoNumber, conversationCode);
        usedSystemNames.add(result[url]);
        nextVideoNumber += 1;
      } else {
        while (usedSystemNames.has(buildConversationMediaSystemName("image", nextImageNumber, conversationCode))) nextImageNumber += 1;
        result[url] = buildConversationMediaSystemName("image", nextImageNumber, conversationCode);
        usedSystemNames.add(result[url]);
        nextImageNumber += 1;
      }
    });

    sessionsRef.current = sessionsRef.current.map((session) => session.id === sessionId ? { ...session, nextImageNumber, nextVideoNumber } : session);
    setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, nextImageNumber: Math.max(nextImageNumber, session.nextImageNumber ?? 1), nextVideoNumber: Math.max(nextVideoNumber, session.nextVideoNumber ?? 1) } : session));

    return result;
  }, []);

  const clearPendingRequest = useCallback((sessionId: string, requestId: string) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId && getSessionPendingRequests(session).some((request) => request.id === requestId)
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: getSessionPendingRequests(session).filter((request) => request.id !== requestId),
            }
          : session,
      ),
    );
  }, []);

  const runGeneration = useCallback(async (sessionId: string, pendingRequest: PendingGeneration) => {
    if (runningRequestIdsRef.current.has(pendingRequest.id)) return;

    runningRequestIdsRef.current.add(pendingRequest.id);
    const abortController = new AbortController();
    requestAbortControllersRef.current.set(pendingRequest.id, abortController);
    try {
      if (pendingRequest.needsIntentResolution) {
        const sourceText = pendingRequest.sourceText ?? pendingRequest.messages[pendingRequest.messages.length - 1]?.content ?? "";
        const conversationTitle = sessions.find((session) => session.id === sessionId)?.title;
        const [plan] = await Promise.all([
          fetch("/api/agent-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              model: pendingRequest.model,
              mode: pendingRequest.mode === "general" ? "general" : "agent",
              messages: pendingRequest.messages,
              conversationId: sessionId,
              conversationTitle,
              requestId: pendingRequest.id,
            }),
          }).then((response) => readJson<AgentPlanResponse>(response)),
          new Promise((resolve) => window.setTimeout(resolve, MIN_AGENT_THINKING_MS)),
        ]);
        addSessionUsage(sessionId, plan.usage);
        applyCreditResult(sessionId, plan.credit);

        if (plan.needsClarification || plan.intent === "clarify") {
          appendAssistantMessage(sessionId, {
            content: plan.clarifyQuestion?.trim() || "我需要再确认一下你的目标：你想让我继续聊创意、生成图片，还是生成视频？",
            suggestions: plan.suggestions,
            mode: pendingRequest.mode === "general" ? "general" : "agent",
            requestId: pendingRequest.id,
            textModel: pendingRequest.mode === "general" ? pendingRequest.model : undefined,
          });
          return;
        }

        const generationMode: WorkMode = plan.intent === "image" || plan.intent === "video" ? plan.intent : pendingRequest.mode === "general" ? "general" : "agent";
        let availableMediaModels = pendingRequest.mode === "general" ? enabledGenerationModelIds : enabledAgentGenerationModelIds;
        if (generationMode === "image" || generationMode === "video") {
          try {
            const response = await fetch("/api/model-availability", { cache: "no-store" });
            const data = (await response.json()) as { imageModels?: string[]; videoModels?: string[]; agentImageModels?: string[]; agentVideoModels?: string[] };
            availableMediaModels = pendingRequest.mode === "general"
              ? {
                  image: Array.isArray(data.imageModels) ? data.imageModels : [],
                  video: Array.isArray(data.videoModels) ? data.videoModels : [],
                }
              : {
                  image: Array.isArray(data.agentImageModels) ? data.agentImageModels : [],
                  video: Array.isArray(data.agentVideoModels) ? data.agentVideoModels : [],
                };
            if (pendingRequest.mode === "general") setEnabledGenerationModelIds(availableMediaModels);
            else setEnabledAgentGenerationModelIds(availableMediaModels);
          } catch {}

          if (availableMediaModels[generationMode].length === 0) {
            appendSystemMessage(sessionId, { content: "连接不到模型，请联系管理员！", error: "连接不到模型，请联系管理员！", mode: generationMode });
            return;
          }
        }
        const generationModel = pendingRequest.mode === "general" && generationMode === "general"
          ? pendingRequest.model
          : pendingRequest.mode === "general" && (generationMode === "image" || generationMode === "video")
          ? (availableMediaModels[generationMode].includes(pendingRequest.selectedMediaModels?.[generationMode] ?? "") ? pendingRequest.selectedMediaModels?.[generationMode] : availableMediaModels[generationMode][0]) as ModelName
          : getAgentGenerationModel(agentModelTier, generationMode, selectedGenerationModels, { sourceText, session: sessions.find((session) => session.id === sessionId), feedbackLogs, enabledModels: availableMediaModels });
        const agentSettings = getAgentGenerationSettingsFromPlan(plan, sourceText, generationMode, generationModel);
        const agentPromptDetail = generationMode === "image" || generationMode === "video" ? getAgentPromptDetailFromPlan(plan, sourceText, generationMode) : undefined;
        const agentPrompt = joinPromptDetail(agentPromptDetail);
        const videoReferenceMode = generationMode === "video" ? getExplicitVideoReferenceMode([sourceText, agentPrompt ?? ""].join(" "), pendingRequest.referenceImages?.length ?? 0) : undefined;
        if (videoReferenceMode === "first_last_frame" && (pendingRequest.referenceImages?.length ?? 0) < 2) {
          appendSystemMessage(sessionId, { content: "首尾帧生视频需要至少两张参考图，请补充首帧和尾帧图片。", error: "首尾帧生视频需要至少两张参考图，请补充首帧和尾帧图片。", mode: "video" });
          return;
        }
        const effectiveVideoReferenceImages = generationMode === "video" && generationModel.startsWith("byteplus:video.")
          ? getEffectiveBytePlusVideoReferenceItems(pendingRequest.referenceImages, videoReferenceMode)
          : pendingRequest.referenceImages;
        const effectiveVideoImageReferences = generationMode === "video" && generationModel.startsWith("byteplus:video.")
          ? getEffectiveBytePlusVideoReferenceItems(pendingRequest.imageReferences, videoReferenceMode)
          : pendingRequest.imageReferences;
        if (generationMode === "video" && generationModel.startsWith("byteplus:video.") && (pendingRequest.referenceImages?.length ?? 0) > (effectiveVideoReferenceImages?.length ?? 0)) {
          appendSystemMessage(sessionId, { content: getBytePlusVideoReferenceLimitHint(videoReferenceMode), mode: "video" });
        }
        const plannedItemPromptDetails = agentPrompt ? getAgentItemPromptDetailsFromPlan(plan, sourceText, generationMode) : undefined;
        const plannedItemPrompts = plannedItemPromptDetails?.map(joinPromptDetail);
        const agentItemPrompts = generationMode === "video" && agentPrompt && (!plannedItemPrompts?.length) && plan.count && plan.count > 1
          ? Array.from({ length: Math.min(20, Math.floor(plan.count)) }).map((_, index) => `${agentPrompt}，第 ${index + 1} 镜，只生成当前这一镜的一段视频`)
          : plannedItemPrompts;
        const agentItemPromptDetails = plannedItemPromptDetails ?? (agentPromptDetail ? [agentPromptDetail] : undefined);
        const agentItemSettings = generationMode === "video" ? getAgentVideoItemSettingsFromPlan(plan, agentSettings, generationModel) : undefined;
        const agentDisplayText = generationMode === "image" || generationMode === "video" ? getAgentDisplayTextFromPlan(plan, generationMode, sourceText) : undefined;
        const assetTargetType = getAssetTypeFromText([sourceText, plan.subject, ...(plan.constraints ?? [])].filter(Boolean).join("，"), generationMode);
        const nextPendingRequest: PendingGeneration = {
          ...pendingRequest,
          mode: generationMode,
          model: generationModel,
          promptModel: generationMode === "image" || generationMode === "video" ? pendingRequest.model : undefined,
          prompt: agentPrompt,
          originalPrompt: agentPrompt,
          settings: generationMode === "agent" ? undefined : agentSettings,
          assetTargetType: assetTargetType === "other" ? undefined : assetTargetType,
          agentGenerated: generationMode === "image" || generationMode === "video",
          agentDisplayText,
          agentSuggestions: getAgentMediaSuggestions(generationMode, plan.suggestions),
          agentItemPrompts,
          agentItemPromptDetails,
          agentItemSettings,
          referenceImages: effectiveVideoReferenceImages,
          imageReferences: effectiveVideoImageReferences,
          videoReferenceMode,
          needsIntentResolution: false,
        };

        updatePendingRequest(sessionId, pendingRequest.id, nextPendingRequest);

        if (generationMode === "image") {
          appendAssistantMessage(sessionId, {
            content: agentDisplayText ?? "",
            statusText: imageStatusLabels.creating,
            suggestions: nextPendingRequest.agentSuggestions,
            pendingImageCount: getImageCountValue(nextPendingRequest.settings?.imageCount, Number.POSITIVE_INFINITY),
            mode: generationMode,
            requestId: pendingRequest.id,
            imageReferences: effectiveVideoImageReferences,
            generationMeta: { mode: "image", model: nextPendingRequest.model, settings: nextPendingRequest.settings, preserveOriginalInput: nextPendingRequest.preserveOriginalInput, assetTargetType: nextPendingRequest.assetTargetType, originalPrompt: agentPrompt, agentGenerated: true, itemPromptDetails: nextPendingRequest.agentItemPromptDetails },
          });
        }

        if (generationMode === "video") {
          appendAssistantMessage(sessionId, {
            content: agentDisplayText ?? "",
            statusText: videoStatusLabels.creating,
            suggestions: nextPendingRequest.agentSuggestions,
            pendingVideoCount: Math.max(1, agentItemPrompts?.length ?? Math.floor(plan.count ?? 1)),
            mode: generationMode,
            requestId: pendingRequest.id,
            imageReferences: pendingRequest.imageReferences,
            generationMeta: { mode: "video", model: nextPendingRequest.model, settings: nextPendingRequest.settings, preserveOriginalInput: nextPendingRequest.preserveOriginalInput, assetTargetType: nextPendingRequest.assetTargetType, originalPrompt: agentPrompt, agentGenerated: true, itemPrompts: agentItemPrompts, itemPromptDetails: nextPendingRequest.agentItemPromptDetails },
          });
        }

        pendingRequest = nextPendingRequest;
      }

      let prompt = pendingRequest.prompt;

      if (!prompt) {
        const conversationTitle = sessions.find((session) => session.id === sessionId)?.title;
        let promptMessages = pendingRequest.mode === "image" || pendingRequest.mode === "video" ? await toPromptPreviewPayloadMessages(pendingRequest.messages) : pendingRequest.messages;
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            model: pendingRequest.promptModel ?? pendingRequest.model,
            mode: pendingRequest.mode,
            messages: pendingRequest.referenceHint ? [...promptMessages, { role: "user", content: pendingRequest.referenceHint }] : promptMessages,
            settings: pendingRequest.settings,
            originalPrompt: pendingRequest.originalPrompt,
            conversationId: sessionId,
            conversationTitle,
            requestId: pendingRequest.id,
          }),
        });

        let data: ChatApiResponse;
        try {
          data = await readJson<ChatApiResponse>(response);
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (!isRequestTooLargeError(message) || (pendingRequest.mode !== "agent" && pendingRequest.mode !== "image" && pendingRequest.mode !== "video")) throw error;

          promptMessages = toPromptPayloadMessages(pendingRequest.messages);
          const retryResponse = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              model: pendingRequest.promptModel ?? pendingRequest.model,
              mode: pendingRequest.mode,
              messages: pendingRequest.referenceHint ? [...promptMessages, { role: "user", content: pendingRequest.referenceHint }] : promptMessages,
              settings: pendingRequest.settings,
              originalPrompt: pendingRequest.originalPrompt,
              conversationId: sessionId,
              conversationTitle,
              requestId: pendingRequest.id,
            }),
          });
          data = await readJson<ChatApiResponse>(retryResponse);
        }
        addSessionUsage(sessionId, data.usage);
        applyCreditResult(sessionId, data.credit);
        prompt = data.content?.trim() || "暂时没有生成出可用内容，请换一种说法再试。";
        updatePendingRequest(sessionId, pendingRequest.id, { prompt });

        if (pendingRequest.mode === "image" || pendingRequest.mode === "video") {
          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
            generationMeta: {
              mode: pendingRequest.mode,
              model: pendingRequest.model,
              settings: pendingRequest.settings,
              preserveOriginalInput: pendingRequest.preserveOriginalInput,
              assetTargetType: pendingRequest.assetTargetType,
              originalPrompt: prompt,
              agentGenerated: pendingRequest.agentGenerated,
            },
          });
        }

        if (pendingRequest.mode === "agent" || pendingRequest.mode === "general") {
          appendAssistantMessage(sessionId, { content: prompt, suggestions: data.suggestions, mode: pendingRequest.mode, requestId: pendingRequest.id, textModel: pendingRequest.mode === "general" ? pendingRequest.model : undefined });
        }
      }

      if (pendingRequest.mode === "image" && prompt) {
        const sourceText = pendingRequest.sourceText ?? pendingRequest.messages[pendingRequest.messages.length - 1]?.content ?? "";
        const withReferenceHint = (value: string) => pendingRequest.referenceHint ? `${value}\n\n${pendingRequest.referenceHint}` : value;
        const createImage = async (referenceImages?: string[], promptOverride = prompt, imageRequestId?: string, requestedCount = 1) => {
          const conversationTitle = sessions.find((session) => session.id === sessionId)?.title;
          const imageResponse = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              prompt: withReferenceHint(promptOverride),
              model: pendingRequest.model,
              referenceImages,
              settings: pendingRequest.settings,
              count: requestedCount,
              conversationId: sessionId,
              conversationTitle,
              requestId: imageRequestId,
              metadata: pendingRequest.agentGenerated ? { creditSource: "agent_image_generation" } : undefined,
            }),
          });

            return readJson<{ images?: string[]; imageDimensions?: Record<string, ImageDimensions>; failureReasons?: string[]; usage?: UsageMeta; credit?: CreditMeta }>(imageResponse);
        };

        const createImageWithRetry = async (promptOverride = prompt, imageRequestId?: string, requestedCount = 1) => {
          let imageData: { images?: string[]; imageDimensions?: Record<string, ImageDimensions>; failureReasons?: string[]; usage?: UsageMeta; credit?: CreditMeta; billableImageCount?: number };

          try {
            imageData = await createImage(pendingRequest.referenceImages, promptOverride, imageRequestId, requestedCount);
          } catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (pendingRequest.preserveOriginalInput || !isRequestTooLargeError(message) || !pendingRequest.referenceImages?.length) throw error;

            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: "参考图过大，正在压缩副本后重试" });

            try {
              const retryImages = await compressReferenceImagesForRetry(pendingRequest.referenceImages, RETRY_IMAGE_SIDE, RETRY_IMAGE_QUALITY);
              imageData = await createImage(retryImages, promptOverride, imageRequestId, requestedCount);
            } catch (retryError) {
              const retryMessage = retryError instanceof Error ? retryError.message : "";
              if (!isRequestTooLargeError(retryMessage)) throw retryError;

              const finalRetryImages = await compressReferenceImagesForRetry(pendingRequest.referenceImages, FINAL_RETRY_IMAGE_SIDE, FINAL_RETRY_IMAGE_QUALITY);
              imageData = await createImage(finalRetryImages, promptOverride, imageRequestId, requestedCount);
            }
          }

          const nextImages = imageData.images ?? [];
          if (nextImages.length === 0) throw new Error(GENERIC_MEDIA_ERROR_MESSAGE);
          return { images: nextImages, imageDimensions: imageData.imageDimensions ?? {}, failureReasons: imageData.failureReasons ?? [], usage: imageData.usage, credit: imageData.credit, billableImageCount: imageData.billableImageCount };
        };

        const imageCount = getImageCountValue(pendingRequest.settings?.imageCount, pendingRequest.agentGenerated ? Number.POSITIVE_INFINITY : 4);
        const contextText = pendingRequest.messages.map((message) => message.content).join("\n");
          const results = await Promise.allSettled(
            Array.from({ length: imageCount }).map(async (_, index) => {
              try {
                const fallbackPromptDetail = pendingRequest.agentGenerated ? { prompt: getAgentImageVariantPrompt(prompt, sourceText, index, imageCount) } : undefined;
                const itemPromptDetail = pendingRequest.agentGenerated ? pendingRequest.agentItemPromptDetails?.[index] ?? fallbackPromptDetail : undefined;
                const itemPrompt = pendingRequest.agentGenerated ? joinPromptDetail(itemPromptDetail) || prompt : prompt;
                const imageResult = await createImageWithRetry(itemPrompt, `${pendingRequest.id}:image:${index}`);
                const resultImages = imageResult.images;
                const resultDimensions = Object.fromEntries(resultImages.map((url) => [url, imageResult.imageDimensions[url]]).filter((item): item is [string, ImageDimensions] => Boolean(item[1])));
                const mediaSystemNames = reserveMediaSystemNames(sessionId, "image", resultImages);
                addSessionUsage(sessionId, imageResult.usage);
                applyCreditResult(sessionId, imageResult.credit);
                const imagePrompts = Object.fromEntries(resultImages.map((url) => [url, itemPrompt]));
                const imagePromptDetails = itemPromptDetail ? Object.fromEntries(resultImages.map((url) => [url, itemPromptDetail])) : {};
                appendImagesToAssistantMessage(sessionId, pendingRequest.id, resultImages, resultDimensions, 1, imagePrompts, mediaSystemNames, pendingRequest.retryFailedIndex, pendingRequest.retryFailedIndex ?? index, imagePromptDetails);
                addGeneratedAssets(sessionId, pendingRequest.mode, itemPrompt, resultImages, undefined, pendingRequest.assetTargetType, contextText, mediaSystemNames, {}, imagePromptDetails);
                notifyGenerationCompleteOnce(pendingRequest.id, "图片生成已完成");
                return resultImages;
              } catch (error) {
                markAssistantImageFailure(sessionId, pendingRequest.id, pendingRequest.retryFailedIndex, toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), pendingRequest.retryFailedIndex ?? index);
                throw error;
              }
            }),
          );

          const successCount = results.filter((result) => result.status === "fulfilled").length;
          const failureCount = results.length - successCount;
          const failureReasons = mediaFailureReasons(results, GENERIC_MEDIA_ERROR_MESSAGE);
          if (failureReasons.length > 0) {
            console.warn("[media-generation] image failure reasons", {
              requestId: pendingRequest.id,
              model: pendingRequest.model,
              successCount,
              failureCount,
              reasons: failureReasons,
            });
          }

          finalizeAssistantImageFailures(sessionId, pendingRequest.id, failureCount, {
            content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? prompt : prompt,
            statusText: undefined,
            error: failureCount > 0 ? (successCount > 0 ? mediaFailureMessage(results, failureCount, GENERIC_MEDIA_ERROR_MESSAGE) : resultErrorMessage(results) ?? GENERIC_MEDIA_ERROR_MESSAGE) : undefined,
            mediaErrorReasons: failureReasons.length > 0 ? failureReasons : undefined,
            mode: pendingRequest.mode,
          });
      }

      if (pendingRequest.mode === "video" && prompt) {
        const withReferenceHint = (value: string) => pendingRequest.referenceHint ? `${value}\n\n${pendingRequest.referenceHint}` : value;
        const createAndPollVideo = async (videoPrompt: string, itemSettings: GenerationSettings | undefined, itemIndex: number, promptDetail?: PromptDetail) => {
          let taskId = itemIndex === 0 ? pendingRequest.taskId : undefined;
          let videoUsageRecorded = false;
          let pendingVideoUsage: UsageMeta | undefined;
          const conversationTitle = sessions.find((session) => session.id === sessionId)?.title;
          const videoRequestId = `${pendingRequest.id}:video:${itemIndex}`;

          const settings = itemSettings ?? pendingRequest.settings;

          if (!taskId) {
          const modelVideoPrompt = replaceMentionNamesForModelPrompt(videoPrompt, pendingRequest.imageReferences);
          let reviewNoticeShownForRequest = false;
          const hasReviewNoticeShown = () => {
            if (reviewNoticeShownForRequest) return true;
            const session = sessionsRef.current.find((item) => item.id === sessionId);
            return Boolean(session?.messages.some((message) =>
              message.role === "assistant" && message.requestId === pendingRequest.id && message.bytePlusAutoReviewNoticeShown,
            ));
          };
          const showReviewNoticeOnce = () => {
            if (hasReviewNoticeShown()) return false;
            reviewNoticeShownForRequest = true;
            appendSystemMessage(sessionId, { content: BYTEPLUS_AUTO_REVIEW_NOTICE, mode: "video" });
            return true;
          };
          const createVideoTask = (autoBytePlusAssetReview = false) => fetch("/api/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({ prompt: withReferenceHint(modelVideoPrompt), model: pendingRequest.model, referenceImages: pendingRequest.referenceImages, referenceVideos: pendingRequest.referenceVideos, referenceAudios: pendingRequest.referenceAudios, referenceMode: pendingRequest.videoReferenceMode, settings, conversationId: sessionId, conversationTitle, requestId: videoRequestId, metadata: pendingRequest.agentGenerated ? { creditSource: "agent_video_generation" } : undefined, autoBytePlusAssetReview }),
          });

          let taskResponse = await createVideoTask();
          let taskData = await readJson<{ id?: string; polling_url?: string; pollingUrl?: string; status?: string; usage?: UsageMeta; autoBytePlusAssetReview?: { triggered?: boolean; assets?: Array<{ url?: string; assetId?: string; groupId?: string; status?: AssetItem["bytePlusAssetStatus"]; error?: string }> } }>(taskResponse);
          if (taskData.status === "reviewing" && taskData.autoBytePlusAssetReview?.triggered) {
            const reviewNotice = BYTEPLUS_AUTO_REVIEW_NOTICE;
            const shouldShowReviewNotice = showReviewNoticeOnce();
            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, shouldShowReviewNotice ? { statusText: reviewNotice, bytePlusAutoReviewNoticeShown: true } : { bytePlusAutoReviewNoticeShown: true });
            taskResponse = await createVideoTask(true);
            taskData = await readJson<{ id?: string; polling_url?: string; pollingUrl?: string; status?: string; usage?: UsageMeta; autoBytePlusAssetReview?: { triggered?: boolean; assets?: Array<{ url?: string; assetId?: string; groupId?: string; status?: AssetItem["bytePlusAssetStatus"]; error?: string }> } }>(taskResponse);
          }
          if (taskData.autoBytePlusAssetReview?.triggered) {
            applyBytePlusAssetUpdatesByUrl(taskData.autoBytePlusAssetReview.assets ?? []);
            if (showReviewNoticeOnce()) updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: BYTEPLUS_AUTO_REVIEW_NOTICE, bytePlusAutoReviewNoticeShown: true });
          }
          pendingVideoUsage = taskData.usage;

          const openRouterTaskId = taskData.polling_url ?? taskData.pollingUrl ?? taskData.id;

          if (!openRouterTaskId) {
            throw new Error("视频平台没有返回任务编号");
          }

          taskId = openRouterTaskId;
          if (itemIndex === 0) updatePendingRequest(sessionId, pendingRequest.id, { taskId });
          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: videoStatusLabels.queued });
          setSessions((current) =>
            current.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    videoTask: { taskId: taskId ?? "", status: "queued" },
                  }
                : session,
            ),
          );
          }

          let pollAttempt = 0;
          while (true) {
          const i = pollAttempt;
          pollAttempt += 1;
          const pollInterval = i < FAST_VIDEO_POLL_ATTEMPTS ? FAST_VIDEO_POLL_INTERVAL_MS : SLOW_VIDEO_POLL_INTERVAL_MS;
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          const pollResponse = await fetch("/api/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({ taskId, model: pendingRequest.model, conversationId: sessionId, conversationTitle, requestId: videoRequestId, usage: pendingVideoUsage }),
          });

          const pollData = await readJson<{
            status?: string;
            content?: { video_url?: string; poster_url?: string };
            error?: { message?: string } | string;
            usage?: UsageMeta;
            credit?: CreditMeta;
          }>(pollResponse);

          const status = (pollData.status ?? "running").toLowerCase();
          const statusText = videoStatusLabels[status] ?? `视频状态：${status}`;

          updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText });

          setSessions((current) =>
            current.map((session) =>
              session.id === sessionId
                ? {
                    ...session,
                    updatedAt: Date.now(),
                    videoTask: {
                      taskId: taskId ?? "",
                      status,
                      videoUrl: pollData.content?.video_url,
                    },
                  }
                : session,
            ),
          );

          if (["succeeded", "success", "completed", "complete", "done"].includes(status)) {
            if (!videoUsageRecorded) {
              const finalUsage = pollData.usage ?? pendingVideoUsage;
              addSessionUsage(sessionId, finalUsage);
              applyCreditResult(sessionId, pollData.credit);
              videoUsageRecorded = Boolean(finalUsage);
            }

            if (!pollData.content?.video_url) {
              updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
                content: "视频平台返回已完成，但没有返回视频地址。",
                error: "视频生成完成但缺少视频链接，需要继续对接平台返回字段。",
                statusText: "视频缺少链接",
                mode: pendingRequest.mode,
              });
              throw new Error("视频生成完成但缺少视频链接");
            }

            const mediaSystemNames = reserveMediaSystemNames(sessionId, "video", [pollData.content.video_url]);
            appendVideoToAssistantMessage(sessionId, pendingRequest.id, pollData.content.video_url, videoPrompt, mediaSystemNames[pollData.content.video_url], pollData.content.poster_url, promptDetail);
            addGeneratedAssets(sessionId, pendingRequest.mode, videoPrompt, [pollData.content.video_url], undefined, pendingRequest.assetTargetType, pendingRequest.messages.map((message) => message.content).join("\n"), mediaSystemNames, pollData.content.poster_url ? { [pollData.content.video_url]: pollData.content.poster_url } : {}, promptDetail ? { [pollData.content.video_url]: promptDetail } : {});
            notifyGenerationCompleteOnce(pendingRequest.id, "视频生成已完成");
            return pollData.content.video_url;
          }

          if (["failed", "error", "expired"].includes(status)) {
            if (!videoUsageRecorded) {
              addSessionUsage(sessionId, pollData.usage);
              videoUsageRecorded = Boolean(pollData.usage);
            }

            const errorMessage = typeof pollData.error === "string" ? pollData.error : pollData.error?.message;
            throw new Error(errorMessage ?? videoStatusLabels[status]);
          }
          }
        };

        const videoPromptDetails = pendingRequest.agentGenerated ? pendingRequest.agentItemPromptDetails?.length ? pendingRequest.agentItemPromptDetails : [{ prompt }] : undefined;
        const videoPrompts = pendingRequest.agentGenerated ? videoPromptDetails?.map(joinPromptDetail) ?? [prompt] : [prompt];
        const results = await Promise.allSettled(
          videoPrompts.map(async (videoPrompt, index) => {
            try {
              return await createAndPollVideo(videoPrompt, pendingRequest.agentItemSettings?.[index], index, videoPromptDetails?.[index]);
            } catch (error) {
              markAssistantVideoFailure(sessionId, pendingRequest.id, toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE));
              throw error;
            }
          }),
        );

        const successCount = results.filter((result) => result.status === "fulfilled").length;
        const failureCount = results.length - successCount;
        const failureReasons = mediaFailureReasons(results, GENERIC_MEDIA_ERROR_MESSAGE);
        if (failureReasons.length > 0) {
          console.warn("[media-generation] video failure reasons", {
            requestId: pendingRequest.id,
            model: pendingRequest.model,
            successCount,
            failureCount,
            reasons: failureReasons,
          });
        }

        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? prompt : prompt,
          statusText: failureCount > 0 && successCount === 0 ? "视频生成失败" : videoStatusLabels.succeeded,
          pendingVideoCount: 0,
          error: failureCount > 0 ? (successCount > 0 ? mediaFailureMessage(results, failureCount, GENERIC_MEDIA_ERROR_MESSAGE) : resultErrorMessage(results) ?? GENERIC_MEDIA_ERROR_MESSAGE) : undefined,
          mediaErrorReasons: failureReasons.length > 0 ? failureReasons : undefined,
          mode: pendingRequest.mode,
          generationMeta: {
            mode: "video",
            model: pendingRequest.model,
            settings: pendingRequest.settings,
            preserveOriginalInput: pendingRequest.preserveOriginalInput,
            assetTargetType: pendingRequest.assetTargetType,
            originalPrompt: pendingRequest.originalPrompt,
            agentGenerated: pendingRequest.agentGenerated,
            itemPrompts: videoPrompts,
            itemPromptDetails: videoPromptDetails,
          },
        });
      }
    } catch (error) {
      if (stoppedRequestIdsRef.current.has(pendingRequest.id) || (error instanceof DOMException && error.name === "AbortError")) return;
      const message = toUserErrorMessage(error, pendingRequest.mode === "image" || pendingRequest.mode === "video" ? GENERIC_MEDIA_ERROR_MESSAGE : undefined);
      if (pendingRequest.mode === "video") {
        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? pendingRequest.prompt ?? "" : pendingRequest.prompt ?? "",
          error: message,
          mediaErrorReasons: [message],
          statusText: "视频生成失败",
          mode: pendingRequest.mode,
        });
      } else if (pendingRequest.mode === "image") {
        const expectedFailureCount = pendingRequest.retryFailedIndex === undefined ? getImageCountValue(pendingRequest.settings?.imageCount, pendingRequest.agentGenerated ? Number.POSITIVE_INFINITY : 4) : 1;
        finalizeAssistantImageFailures(sessionId, pendingRequest.id, expectedFailureCount, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? pendingRequest.prompt ?? "" : pendingRequest.prompt ?? "",
          error: message,
          mediaErrorReasons: [message],
          statusText: imageStatusLabels.failed,
          mode: pendingRequest.mode,
        });
      } else {
        appendSystemMessage(sessionId, { content: message, error: message, mode: pendingRequest.mode });
      }
    } finally {
      clearPendingRequest(sessionId, pendingRequest.id);
      runningRequestIdsRef.current.delete(pendingRequest.id);
      requestAbortControllersRef.current.delete(pendingRequest.id);
      stoppedRequestIdsRef.current.delete(pendingRequest.id);
    }
  }, [addGeneratedAssets, addSessionUsage, agentModelTier, appendAssistantMessage, appendImagesToAssistantMessage, appendSystemMessage, appendVideoToAssistantMessage, applyBytePlusAssetUpdatesByUrl, applyCreditResult, autoSaveHistory, clearPendingRequest, enabledAgentGenerationModelIds, ensureSessionMemorySummary, feedbackLogs, finalizeAssistantImageFailures, markAssistantImageFailure, markAssistantVideoFailure, notifyGenerationCompleteOnce, reserveMediaSystemNames, selectedGenerationModels, selectedModel, sessions, updateAssistantMessageByRequestId, updatePendingRequest]);

  useEffect(() => {
    if (!isLoaded) return;

    sessions.forEach((session) => {
      getSessionPendingRequests(session).forEach((pendingRequest) => {
        if (runningRequestIdsRef.current.has(pendingRequest.id)) return;
        void runGeneration(session.id, pendingRequest);
      });
    });
  }, [isLoaded, runGeneration, sessions]);

  const sendMessage = async (suggestion?: SuggestionInput, forcedMode?: WorkMode) => {
    const normalizedSuggestion = suggestion === undefined ? null : normalizeSuggestionItem(suggestion);
    const isSuggestionSend = Boolean(normalizedSuggestion);
    const rawText = normalizedSuggestion ? normalizedSuggestion.label : activeInput.trim();
    const submitMode = forcedMode ?? mode;
    const modeForSettings: WorkMode = submitMode === "agent" ? mode : submitMode;
    let generationModelsForSubmit = selectedGenerationModels;
    let generalModelsForSubmit = selectedGeneralModels;
    let enabledModelsForSubmit = enabledGenerationModelIds;
    const availableUploadedImages = isSuggestionSend ? [] : activeUploadedImages;
    const availableUploadedFiles = isSuggestionSend ? [] : activeUploadedFiles;
    const submitUploadRule = getUploadRule({ mode: submitMode, modelId: submitMode === "general" ? generalModelsForSubmit.chat : submitMode === "agent" ? selectedModel : generationModelsForSubmit[submitMode], transportMode: "local-base64" });
    if (availableUploadedImages.length > submitUploadRule.image.maxCount) {
      showInputTip(`当前模型最多支持 ${submitUploadRule.image.maxCount} 张参考图，不能上传更多图片`);
      return;
    }
    const submitMaxUploadFiles = submitUploadRule.document.maxCount + submitUploadRule.video.maxCount + submitUploadRule.audio.maxCount;
    if (availableUploadedFiles.length > submitMaxUploadFiles) {
      showInputTip(`当前模型最多支持 ${submitMaxUploadFiles} 个文件`);
      return;
    }
    const uploadedVideoFiles = availableUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "video");
    const uploadedAudioFiles = availableUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "audio");
    if (uploadedVideoFiles.length > 0 && !submitUploadRule.video.enabled) {
      showInputTip("当前模型不支持上传视频");
      return;
    }
    if (uploadedAudioFiles.length > 0 && !submitUploadRule.audio.enabled) {
      showInputTip("当前模型不支持上传音频");
      return;
    }
    if (uploadedVideoFiles.length > submitUploadRule.video.maxCount) {
      showInputTip(`当前模型最多支持 ${submitUploadRule.video.maxCount} 个参考视频`);
      return;
    }
    if (uploadedAudioFiles.length > submitUploadRule.audio.maxCount) {
      showInputTip(`当前模型最多支持 ${submitUploadRule.audio.maxCount} 个参考音频`);
      return;
    }
    const uploadedVideoDuration = uploadedVideoFiles.reduce((sum, file) => sum + getUploadedMediaDuration(file), 0);
    const uploadedAudioDuration = uploadedAudioFiles.reduce((sum, file) => sum + getUploadedMediaDuration(file), 0);
    if (submitUploadRule.video.maxTotalSeconds !== undefined && uploadedVideoDuration > submitUploadRule.video.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) {
      showInputTip(`参考视频总时长不能超过 ${submitUploadRule.video.maxTotalSeconds} 秒`);
      return;
    }
    if (submitUploadRule.audio.maxTotalSeconds !== undefined && uploadedAudioDuration > submitUploadRule.audio.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) {
      showInputTip(`参考音频总时长不能超过 ${submitUploadRule.audio.maxTotalSeconds} 秒`);
      return;
    }
    if (hasReadingUploadedFiles && !isSuggestionSend) {
      showInputTip("文件读取中");
      return;
    }
    if (hasUploadingInputs && !isSuggestionSend) {
      showInputTip("文件上传中");
      return;
    }
    if (hasFailedUploadInputs && !isSuggestionSend) {
      showInputTip("有文件上传失败，请删除后重新上传");
      return;
    }
    const uploadedMediaReferencesForText = getUploadedMediaReferences(availableUploadedFiles);
    const rawTextWithMediaMentions = submitMode === "video" ? ensureMediaFileMentions(rawText, uploadedMediaReferencesForText) : rawText;
    if ((!rawTextWithMediaMentions && availableUploadedImages.length === 0 && availableUploadedFiles.length === 0) || !activeSession || (submitMode !== "agent" && submitMode !== "general" && activeHasMaxPendingRequests) || sendingSessionIdsRef.current.has(activeSession.id)) return;
    if (workspaceStorageMode === "user" && currentUserCredits <= 0) {
      showInputTip("积分不足，请充值后再使用模型");
      return;
    }

    const availabilityMode = submitMode === "image" || submitMode === "video" ? submitMode : undefined;
    if (availabilityMode) {
      const modelForAvailability = submitMode === "general" ? generalModelsForSubmit[availabilityMode] : generationModelsForSubmit[availabilityMode];
      const isCurrentModelAvailable = enabledModelsForSubmit[availabilityMode].includes(modelForAvailability);
      if (enabledModelsForSubmit[availabilityMode].length === 0 || !isCurrentModelAvailable) {
        try {
          const response = await fetch("/api/model-availability", { cache: "no-store" });
          const data = (await response.json()) as { imageModels?: string[]; assetImageModels?: string[]; videoModels?: string[]; agentImageModels?: string[]; agentVideoModels?: string[] };
          const refreshedModels = {
            image: Array.isArray(data.imageModels) ? data.imageModels : [],
            video: Array.isArray(data.videoModels) ? data.videoModels : [],
          };
          const refreshedAgentModels = {
            image: Array.isArray(data.agentImageModels) ? data.agentImageModels : [],
            video: Array.isArray(data.agentVideoModels) ? data.agentVideoModels : [],
          };
          const refreshedAssetImageModels = Array.isArray(data.assetImageModels) ? data.assetImageModels : [];
          const nextSelectedModels = {
            image: refreshedModels.image.includes(generationModelsForSubmit.image) ? generationModelsForSubmit.image : refreshedModels.image[0] as ModelName | undefined ?? generationModelsForSubmit.image,
            video: refreshedModels.video.includes(generationModelsForSubmit.video) ? generationModelsForSubmit.video : refreshedModels.video[0] as ModelName | undefined ?? generationModelsForSubmit.video,
          };
          const nextGeneralModels = {
            chat: generalModelsForSubmit.chat,
            image: refreshedModels.image.includes(generalModelsForSubmit.image) ? generalModelsForSubmit.image : refreshedModels.image[0] as ModelName | undefined ?? generalModelsForSubmit.image,
            video: refreshedModels.video.includes(generalModelsForSubmit.video) ? generalModelsForSubmit.video : refreshedModels.video[0] as ModelName | undefined ?? generalModelsForSubmit.video,
          };
          enabledModelsForSubmit = refreshedModels;
          generationModelsForSubmit = nextSelectedModels;
          generalModelsForSubmit = nextGeneralModels;
          setEnabledGenerationModelIds(refreshedModels);
          setEnabledAgentGenerationModelIds(refreshedAgentModels);
          setEnabledAssetImageModelIds(refreshedAssetImageModels);
          setSelectedGenerationModels(nextSelectedModels);
          if (submitMode === "general") setSelectedGeneralModels(nextGeneralModels);
          setCharacterGenerateModel((current) => refreshedAssetImageModels.includes(current) ? current : refreshedAssetImageModels[0] as ModelName | undefined ?? current);
        } catch {}
      }
    }

    if (availabilityMode && enabledModelsForSubmit[availabilityMode].length === 0) {
      appendSystemMessage(activeSession.id, { content: "连接不到模型，请联系管理员！", error: "连接不到模型，请联系管理员！", mode: availabilityMode });
      return;
    }
    if (availabilityMode === "image" && !enabledModelsForSubmit.image.includes(submitMode === "general" ? generalModelsForSubmit.image : generationModelsForSubmit.image)) {
      appendSystemMessage(activeSession.id, { content: "连接不到模型，请联系管理员！", error: "连接不到模型，请联系管理员！", mode: availabilityMode });
      return;
    }
    if (availabilityMode === "video" && !enabledModelsForSubmit.video.includes(submitMode === "general" ? generalModelsForSubmit.video : generationModelsForSubmit.video)) {
      appendSystemMessage(activeSession.id, { content: "连接不到模型，请联系管理员！", error: "连接不到模型，请联系管理员！", mode: availabilityMode });
      return;
    }

    const sessionId = activeSession.id;
    setSessionSending(sessionId, true);
    let sessionForSend = activeSession;
    sessionForSend = await ensureSessionMemorySummary(
      activeSession,
      submitMode === "general" ? generalModelsForSubmit.chat : selectedModel,
      createClientId(),
    );
    let sendUploadedImages = availableUploadedImages;

    try {
      sendUploadedImages = await persistUploadedImagesForSend(availableUploadedImages);
    } catch {
      sendUploadedImages = availableUploadedImages;
    }

    const explicitImageReferences = getOrderedExplicitImageReferences(rawTextWithMediaMentions, assets, sendUploadedImages, activeConversationImageReferences);
    const uploadedImageReferences = sendUploadedImages.map((image) => ({ name: getUploadedImageReferenceName(image, sendUploadedImages), url: image.url }));
    const recentReferenceImages = explicitImageReferences.length > 0 || uploadedImageReferences.length > 0 ? [] : getRecentReferenceImages(sessionForSend.messages, rawText);
    const recentImageReferences = recentReferenceImages.map((url, index) => ({ name: `图片${index + 1}`, url }));
    const sourceImageReferences = explicitImageReferences.length > 0 ? explicitImageReferences : uploadedImageReferences.length > 0 ? uploadedImageReferences : recentImageReferences;
    if (sourceImageReferences.filter((reference, index, array) => Boolean(reference.url) && array.findIndex((item) => item.url === reference.url) === index).length > currentMaxReferenceImages) {
      showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
      return;
    }
    const namedImageReferences: ImageReference[] = sourceImageReferences
      .filter((reference, index, array) => Boolean(reference.url) && array.findIndex((item) => item.url === reference.url) === index)
      .slice(0, currentMaxReferenceImages);
    if (submitMode === "general" && namedImageReferences.length > 0 && !conversationModelSupportsImages(generalModelsForSubmit.chat)) {
      showInputTip("当前对话模型不支持图片，请切换 Seed、Gemini、GPT-4o、GPT-5.4 或 GPT-5.5");
      setSessionSending(sessionId, false);
      return;
    }
    const referenceImages = namedImageReferences.map((reference) => reference.url);
    const referenceVideos = uploadedVideoFiles.map(getUploadedMediaFileUrl).filter(Boolean);
    const referenceAudios = uploadedAudioFiles.map(getUploadedMediaFileUrl).filter(Boolean);
    const modelReferenceImages = namedImageReferences.map((reference) => {
      const matchedAsset = assets.find((asset) => normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(reference.url));
      if (matchedAsset?.bytePlusAssetStatus === "Active" && matchedAsset.bytePlusAssetId) return `asset://${matchedAsset.bytePlusAssetId}`;
      return reference.url;
    });
    const referencedAssets = getReferencedAssets(rawTextWithMediaMentions, assets);
    const displayImageReferences = (namedImageReferences.length > 0 ? namedImageReferences : referenceImages.map((url, index) => ({ name: `图片${index + 1}`, url }))).slice(0, currentMaxReferenceImages);
    const text = rawTextWithMediaMentions || getImageOnlyPrompt(submitMode);
    const generationMode: WorkMode = submitMode;
    if (generationMode === "video" && referenceAudios.length > 0 && referenceImages.length === 0 && referenceVideos.length === 0) {
      showInputTip("参考音频不能单独用于生视频，请同时上传参考图片或参考视频");
      setSessionSending(sessionId, false);
      return;
    }
    const directVideoReferenceMode = generationMode === "video" ? getExplicitVideoReferenceMode(text, referenceImages.length) : undefined;
    if (directVideoReferenceMode === "first_last_frame" && referenceImages.length < 2) {
      showInputTip("首尾帧生视频需要至少两张参考图");
      setSessionSending(sessionId, false);
      return;
    }
    const userMessage: Message = { id: createClientId(), role: "user", content: rawTextWithMediaMentions, createdAt: nowTimestamp(), images: referenceImages.length > 0 ? referenceImages : undefined, imageReferences: displayImageReferences.length > 0 ? displayImageReferences : undefined, uploadedFiles: availableUploadedFiles.length > 0 ? availableUploadedFiles : undefined };
    const payloadUserMessage: Message = { ...userMessage, content: text };
    const messagesWithoutSuggestions = sessionForSend.messages.map((message) => (message.suggestions ? { ...message, suggestions: undefined } : message));
    const optimisticMessages = [...messagesWithoutSuggestions, payloadUserMessage];
    const visibleOptimisticMessages = [...messagesWithoutSuggestions, userMessage];
    const isDirectGenerationMode = submitMode === "image" || submitMode === "video";
    const visibleMessages = isDirectGenerationMode ? activeSession.messages : visibleOptimisticMessages;
    addUploadedImagesToAssets(sessionId, sendUploadedImages, text);

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: session.title === "新对话" ? getSessionTitle(text) : session.title,
              updatedAt: Date.now(),
              messages: visibleMessages,
              draftInput: "",
              uploadedFiles: [],
              uploadedImages: [],
            }
          : session,
      ),
    );

    if (submitMode !== "general" && isModelIdentityQuestion(text)) {
      const textModel = selectedModel;
      const selectedModelLabel = agentModelTier === "advanced" ? "GPT-5.4" : "Seed 2.0 Lite";
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: session.title === "新对话" ? getSessionTitle(text) : session.title,
                updatedAt: Date.now(),
                messages: visibleMessages,
                draftInput: "",
              }
            : session,
        ),
      );
      setModelInfoSessionId(sessionId);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: textModel,
            mode: "agent",
            messages: [{ role: "user", content: "请返回一次模型探测结果。" }],
            conversationId: sessionId,
            conversationTitle: activeSession.title,
            requestId: createClientId(),
          }),
        });
        const data = await readJson<{ model?: string; usage?: UsageMeta; credit?: CreditMeta }>(response);
        addSessionUsage(sessionId, data.usage);
        applyCreditResult(sessionId, data.credit);
        appendAssistantMessage(sessionId, {
          content: data.model
            ? `前端入口：${selectedModelLabel}（${textModel}）。后台实际模型：${getActualTextModelLabel(data.model)}（${data.model}）。`
            : `前端入口：${selectedModelLabel}（${textModel}）。本次没有返回后台实际模型。`,
          suggestions: DEFAULT_AGENT_SUGGESTIONS,
          mode: "agent",
        });
      } catch (error) {
        const message = toUserErrorMessage(error, "模型信息查询失败。");
        appendSystemMessage(sessionId, { content: message, error: message, mode: "agent" });
      } finally {
        setModelInfoSessionId((current) => (current === sessionId ? "" : current));
        setSessionSending(sessionId, false);
      }
      return;
    }

    const correctionMode = getCorrectionMode(text);
    const previousUserMessage = getLastUserMessage(activeSession.messages);

    if (correctionMode && previousUserMessage) {
      rememberIntentCorrection(previousUserMessage.content, correctionMode);
    }

    if (submitMode === "agent") {
      const payloadMessages = toAgentPayloadMessages(optimisticMessages, referenceImages.length > 0, sessionForSend.memorySummary);
      if (referencedAssets.length > 0) {
        const lastUserMessage = [...payloadMessages].reverse().find((message) => message.role === "user");
        if (lastUserMessage) {
          lastUserMessage.content = `${lastUserMessage.content}${getAssetReferencesText(referencedAssets)}`;
        }
      }

      const pendingRequest: PendingGeneration = {
        id: createClientId(),
        model: selectedModel,
        mode: "agent",
        messages: payloadMessages,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        imageReferences: displayImageReferences.length > 0 ? displayImageReferences : undefined,
        referenceHint: getReferenceHint(namedImageReferences),
        needsIntentResolution: true,
        sourceText: text,
      };

      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: session.title === "新对话" ? getSessionTitle(text) : session.title,
                updatedAt: Date.now(),
                messages: visibleMessages,
                pendingRequest: undefined,
                pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
                draftInput: "",
                uploadedFiles: [],
                uploadedImages: [],
              }
            : session,
        ),
      );

      setSessionSending(sessionId, false);
      void runGeneration(sessionId, pendingRequest);
      return;
    }

    if (submitMode === "general") {
      const payloadMessages = toGeneralPayloadMessages(optimisticMessages, generalModelsForSubmit.chat, sessionForSend.memorySummary);
      if (referencedAssets.length > 0) {
        const lastUserMessage = [...payloadMessages].reverse().find((message) => message.role === "user");
        if (lastUserMessage) lastUserMessage.content = `${lastUserMessage.content}${getAssetReferencesText(referencedAssets)}`;
      }

      const pendingRequest: PendingGeneration = {
        id: createClientId(),
        model: generalModelsForSubmit.chat,
        mode: "general",
        messages: payloadMessages,
        referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        imageReferences: displayImageReferences.length > 0 ? displayImageReferences : undefined,
        sourceText: text,
        referenceHint: getReferenceHint(namedImageReferences),
        selectedMediaModels: {
          image: generalModelsForSubmit.image,
          video: generalModelsForSubmit.video,
        },
        needsIntentResolution: true,
      };
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: session.title === "新对话" ? getSessionTitle(text) : session.title,
                updatedAt: Date.now(),
                messages: visibleMessages,
                pendingRequest: undefined,
                pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
                draftInput: "",
                uploadedFiles: [],
                uploadedImages: [],
              }
            : session,
        ),
      );

      setSessionSending(sessionId, false);
      void runGeneration(sessionId, pendingRequest);
      return;
    }

    const payloadMessages = applyMemorySummaryToPayload(toChatPayloadMessages(optimisticMessages), sessionForSend.memorySummary);
    if (referencedAssets.length > 0) {
      const lastUserMessage = [...payloadMessages].reverse().find((message) => message.role === "user");
      if (lastUserMessage) {
        lastUserMessage.content = `${lastUserMessage.content}${getAssetReferencesText(referencedAssets)}`;
      }
    }

    const isAgentAutoGeneration = false;
    const assetTargetType = normalizedSuggestion?.assetTargetType ?? getAssetTypeFromText(text, generationMode);
    const generationModel = isAgentAutoGeneration ? getAgentGenerationModel(agentModelTier, generationMode, generationModelsForSubmit, { sourceText: text, session: activeSession, feedbackLogs, enabledModels: enabledModelsForSubmit }) : generationMode === "image" ? generationModelsForSubmit.image : generationModelsForSubmit.video;
    const shouldApplyBytePlusReferenceMode = generationMode === "video" && generationModel.startsWith("byteplus:video.");
    const effectiveReferenceImages = shouldApplyBytePlusReferenceMode ? getEffectiveBytePlusVideoReferenceItems(referenceImages, directVideoReferenceMode) : referenceImages;
    const effectiveModelReferenceImages = shouldApplyBytePlusReferenceMode ? getEffectiveBytePlusVideoReferenceItems(modelReferenceImages, directVideoReferenceMode) : modelReferenceImages;
    const effectiveDisplayImageReferences = shouldApplyBytePlusReferenceMode ? getEffectiveBytePlusVideoReferenceItems(displayImageReferences, directVideoReferenceMode) : displayImageReferences;
    if (shouldApplyBytePlusReferenceMode && referenceImages.length > effectiveReferenceImages.length) showInputTip(getBytePlusVideoReferenceLimitHint(directVideoReferenceMode));
    const agentSettings = isAgentAutoGeneration ? getAgentGenerationSettings(text, generationMode, generationModel) : undefined;
    const generationResolution = agentSettings?.resolution ?? (generationMode === "image" ? normalizeImageResolutionForModel(generationModel, selectedResolutions[modeForSettings]) : generationMode === "video" ? (selectedRatios.video === "智能比例" ? "720p" : normalizeVideoResolutionForModel(generationModel, selectedResolutions.video)) : selectedResolutions[modeForSettings]);
    const generationRatio = agentSettings?.ratio ?? (generationMode === "video" ? (selectedRatios.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(generationModel, selectedRatios.video, generationResolution)) : selectedRatios[modeForSettings]);
    const agentDisplayText = isAgentAutoGeneration ? getAgentMediaDisplayText(generationMode, text) : undefined;
    const pendingRequest: PendingGeneration = {
      id: createClientId(),
      model: generationModel,
      promptModel: isAgentAutoGeneration ? selectedModel : undefined,
      mode: generationMode,
      prompt: generationMode === "image" || generationMode === "video" ? text : undefined,
      originalPrompt: generationMode === "image" || generationMode === "video" ? text : undefined,
      preserveOriginalInput: false,
      assetTargetType: assetTargetType === "other" ? undefined : assetTargetType,
      referenceImages: (shouldApplyBytePlusReferenceMode ? effectiveModelReferenceImages : effectiveReferenceImages).length > 0 ? (shouldApplyBytePlusReferenceMode ? effectiveModelReferenceImages : effectiveReferenceImages) : undefined,
      referenceVideos: generationMode === "video" && referenceVideos.length > 0 ? referenceVideos : undefined,
      referenceAudios: generationMode === "video" && referenceAudios.length > 0 ? referenceAudios : undefined,
      videoReferenceMode: directVideoReferenceMode,
      imageReferences: effectiveDisplayImageReferences.length > 0 ? effectiveDisplayImageReferences : undefined,
      referenceHint: getReferenceHint(effectiveDisplayImageReferences),
      agentGenerated: isAgentAutoGeneration,
      agentDisplayText,
      settings: agentSettings ?? {
        ratio: generationRatio,
        resolution: generationResolution,
        style: selectedStyle,
        duration: generationMode === "video" ? (modeForSettings === "video" ? selectedVideoDuration : selectedDurations.video) : undefined,
        imageCount: generationMode === "image" ? selectedImageCounts[modeForSettings] : undefined,
      },
      messages: payloadMessages,
    };

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: session.title === "新对话" ? getSessionTitle(text) : session.title,
              updatedAt: Date.now(),
              messages: visibleMessages,
              pendingRequest: undefined,
              pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
              draftInput: "",
              uploadedFiles: [],
              uploadedImages: [],
            }
          : session,
      ),
    );

    if (generationMode === "image") {
      appendAssistantMessage(sessionId, {
        content: isAgentAutoGeneration ? agentDisplayText ?? "" : isDirectGenerationMode ? text : "",
        statusText: imageStatusLabels.creating,
        pendingImageCount: getImageCountValue(pendingRequest.settings?.imageCount ?? selectedImageCounts[modeForSettings], isAgentAutoGeneration ? Number.POSITIVE_INFINITY : 4),
        mode: generationMode,
        requestId: pendingRequest.id,
        imageReferences: pendingRequest.imageReferences,
        generationMeta: { mode: "image", model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, assetTargetType: pendingRequest.assetTargetType, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated },
      });
    }

    if (generationMode === "video") {
      appendAssistantMessage(sessionId, {
        content: isAgentAutoGeneration ? agentDisplayText ?? "" : isDirectGenerationMode ? text : "",
        statusText: videoStatusLabels.creating,
        pendingVideoCount: 1,
        mode: generationMode,
        requestId: pendingRequest.id,
        imageReferences: pendingRequest.imageReferences,
        uploadedFiles: availableUploadedFiles.length > 0 ? availableUploadedFiles : undefined,
        generationMeta: { mode: "video", model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, assetTargetType: pendingRequest.assetTargetType, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated },
      });
    }

    setSessionSending(sessionId, false);
    void runGeneration(sessionId, pendingRequest);
  };

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  useEffect(() => {
    if (!pendingHomePrompt || activeSessionId !== pendingHomePrompt.sessionId || activeSession?.id !== pendingHomePrompt.sessionId) return;

    const prompt = pendingHomePrompt.prompt;
    const timer = window.setTimeout(() => {
      setPendingHomePrompt(null);
      void sendMessageRef.current?.(prompt, "agent");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeSession?.id, activeSessionId, pendingHomePrompt]);

  const stopAgentThinking = () => {
    if (!activeSession) return;
    const agentRequests = getSessionPendingRequests(activeSession).filter((request) => request.mode === "agent" || request.mode === "general");
    if (agentRequests.length === 0) return;

    agentRequests.forEach((request) => {
      stoppedRequestIdsRef.current.add(request.id);
      requestAbortControllersRef.current.get(request.id)?.abort();
    });

    setSessions((current) =>
      current.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: getSessionPendingRequests(session).filter((request) => request.mode !== "agent" && request.mode !== "general"),
              messages: [
                ...session.messages,
                {
                  id: createClientId(),
                  role: "system",
                  content: "已中断思考",
                  mode: "agent",
                  createdAt: Date.now(),
                },
              ],
            }
          : session,
      ),
    );
    setSessionSending(activeSession.id, false);
  };

  const addFeedbackLog = useCallback((kind: FeedbackKind, message: Message) => {
    if (!activeSession) return;

    const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
    const context: Array<{ role: "user" | "assistant"; content: string }> = activeSession.messages
      .slice(Math.max(0, messageIndex - 6), messageIndex + 1)
      .filter((item) => item.role !== "system")
      .map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content.slice(0, 1200) }));

    setFeedbackLogs((current) => [
      {
        id: createClientId(),
        createdAt: Date.now(),
        kind,
        sessionId: activeSession.id,
        sessionTitle: activeSession.title,
        messageId: message.id,
        messageType: getMessageType(message),
        executionMode: message.mode,
        activeMode: mode,
        context,
        message: {
          content: message.content,
          images: message.images,
          videoUrl: message.videoUrl,
          statusText: message.statusText,
          error: message.error,
          mode: message.mode,
        },
        intentMemoryRules,
      },
      ...current,
    ].slice(0, MAX_FEEDBACK_LOGS));
  }, [activeSession, intentMemoryRules, mode]);

  const copyMessage = useCallback(async (message: Message) => {
    addFeedbackLog("copy", message);

    const showCopyFeedback = (state: "success" | "error") => {
      setCopyFeedback({ messageId: message.id, state });
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
        copyFeedbackTimerRef.current = null;
      }, 1000);
    };

    try {
      if (message.videoUrl) {
        showCopyFeedback("error");
        return;
      }

      if (message.images?.[0]) {
        await copyImageToClipboard(message.images[0]);
      } else {
        await navigator.clipboard.writeText(message.content);
      }

      showCopyFeedback("success");
    } catch {
      showCopyFeedback("error");
    }
  }, [addFeedbackLog]);

  const copyPrompt = useCallback(async (message: Message) => {
    try {
      setActiveDraftInput(message.content);
      requestAnimationFrame(() => editorRef.current?.focus());
      setCopyFeedback({ messageId: message.id, state: "success" });
    } catch {
      setCopyFeedback({ messageId: message.id, state: "error" });
    }

    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = window.setTimeout(() => {
      setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
      copyFeedbackTimerRef.current = null;
    }, 1000);
  }, [setActiveDraftInput]);

  const regenerateMessage = (message: Message) => {
    if (!activeSession || (message.generationMeta?.agentGenerated ? false : activeHasMaxPendingRequests)) return;
    if (message.role !== "assistant") return;

    addFeedbackLog("regenerate", message);

    const replayMeta = message.generationMeta;
    const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
    if (messageIndex < 0) return;
    const generationMode: WorkMode = replayMeta?.mode ?? (message.videoUrl ? "video" : message.images?.length || message.statusText || message.error ? "image" : message.mode === "agent" ? "agent" : mode);
    const previousUserMessage = [...activeSession.messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user");
    const replayPrompt = generationMode === "image" || generationMode === "video" ? (replayMeta?.originalPrompt ?? message.content).trim() : (previousUserMessage?.content ?? "").trim();
    if (!replayPrompt) return;
    if (generationMode === "agent" && !previousUserMessage) return;

    const sessionId = activeSession.id;
    const replaySettings = replayMeta?.settings;
    const replayUploadedFiles = message.uploadedFiles ?? previousUserMessage?.uploadedFiles ?? [];
    const replayReferenceVideos = getUploadedMediaReferences(replayUploadedFiles).filter((reference) => reference.mediaKind === "video").map((reference) => reference.url);
    const replayReferenceAudios = getUploadedMediaReferences(replayUploadedFiles).filter((reference) => reference.mediaKind === "audio").map((reference) => reference.url);
    const replayMessages: ChatPayloadMessage[] = activeSession.messages
      .slice(0, messageIndex)
      .filter((item) => item.id !== "seed-1" && item.role !== "system")
      .map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content, images: item.images }));
    const replayImageReferences = message.imageReferences?.length
      ? message.imageReferences
      : generationMode === "image" || generationMode === "video"
        ? getOrderedExplicitImageReferences(replayPrompt, assets, [], getConversationImageReferences(activeSession.messages.slice(0, messageIndex)))
        : previousUserMessage?.imageReferences;
    const referenceImages = replayImageReferences?.map((reference) => reference.url).filter(Boolean) ?? previousUserMessage?.images?.filter(Boolean);
    const replayModel = generationMode === "image" || generationMode === "video"
      ? (replayMeta?.model ?? (generationMode === "image" ? selectedGenerationModels.image : selectedGenerationModels.video))
      : agentModelTier === "advanced" ? ADVANCED_CHAT_MODEL : DEFAULT_CHAT_MODEL;
    const replayResolution = generationMode === "image" ? normalizeImageResolutionForModel(replayModel, replaySettings?.resolution ?? selectedResolutions[generationMode]) : generationMode === "video" ? ((replaySettings?.ratio ?? selectedRatios.video) === "智能比例" ? "720p" : normalizeVideoResolutionForModel(replayModel, replaySettings?.resolution ?? selectedResolutions.video)) : replaySettings?.resolution ?? selectedResolutions[generationMode];
    const replayRatio = generationMode === "video" ? ((replaySettings?.ratio ?? selectedRatios.video) === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(replayModel, replaySettings?.ratio ?? selectedRatios.video, replayResolution)) : replaySettings?.ratio ?? selectedRatios[generationMode];
    const replayVideoReferenceMode = generationMode === "video" ? getExplicitVideoReferenceMode(replayPrompt, referenceImages?.length ?? 0) : undefined;
    if (replayVideoReferenceMode === "first_last_frame" && (referenceImages?.length ?? 0) < 2) {
      showInputTip("首尾帧生视频需要至少两张参考图");
      return;
    }
    const shouldApplyReplayBytePlusReferenceMode = generationMode === "video" && replayModel.startsWith("byteplus:video.");
    const effectiveReplayReferenceImages = shouldApplyReplayBytePlusReferenceMode ? getEffectiveBytePlusVideoReferenceItems(referenceImages, replayVideoReferenceMode) : referenceImages;
    const effectiveReplayImageReferences = shouldApplyReplayBytePlusReferenceMode ? getEffectiveBytePlusVideoReferenceItems(replayImageReferences, replayVideoReferenceMode) : replayImageReferences;
    if (shouldApplyReplayBytePlusReferenceMode && (referenceImages?.length ?? 0) > (effectiveReplayReferenceImages?.length ?? 0)) showInputTip(getBytePlusVideoReferenceLimitHint(replayVideoReferenceMode));
    const pendingRequest: PendingGeneration = {
      id: createClientId(),
      model: replayModel,
      promptModel: replayMeta?.agentGenerated ? (agentModelTier === "advanced" ? ADVANCED_CHAT_MODEL : DEFAULT_CHAT_MODEL) : undefined,
      mode: generationMode,
      prompt: generationMode === "image" || generationMode === "video" ? replayPrompt : undefined,
      originalPrompt: generationMode === "image" || generationMode === "video" ? replayPrompt : undefined,
      preserveOriginalInput: false,
      referenceImages: effectiveReplayReferenceImages && effectiveReplayReferenceImages.length > 0 ? effectiveReplayReferenceImages : undefined,
      referenceVideos: generationMode === "video" && replayReferenceVideos.length > 0 ? replayReferenceVideos : undefined,
      referenceAudios: generationMode === "video" && replayReferenceAudios.length > 0 ? replayReferenceAudios : undefined,
      videoReferenceMode: replayVideoReferenceMode,
      imageReferences: effectiveReplayImageReferences && effectiveReplayImageReferences.length > 0 ? effectiveReplayImageReferences : undefined,
      referenceHint: effectiveReplayImageReferences && effectiveReplayImageReferences.length > 0 ? getReferenceHint(effectiveReplayImageReferences) : undefined,
      assetTargetType: replayMeta?.assetTargetType,
      agentGenerated: replayMeta?.agentGenerated,
      agentDisplayText: replayMeta?.agentGenerated ? message.content : undefined,
      agentItemPrompts: replayMeta?.itemPrompts,
      agentItemPromptDetails: replayMeta?.itemPromptDetails,
      settings:
        generationMode === "agent"
          ? undefined
          : {
              ratio: replayRatio,
              resolution: replayResolution,
              style: selectedStyle,
              duration: generationMode === "video" ? (replaySettings?.duration ?? selectedVideoDuration) : undefined,
              imageCount: generationMode === "image" ? (replaySettings?.imageCount ?? selectedImageCounts[generationMode]) : undefined,
            },
      messages: replayMessages,
    };

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
            }
          : session,
      ),
    );
    if (generationMode === "image" || generationMode === "video") {
      appendAssistantMessage(sessionId, {
        content: replayMeta?.agentGenerated ? message.content : replayPrompt,
        statusText: generationMode === "video" ? videoStatusLabels.creating : imageStatusLabels.creating,
        pendingImageCount: generationMode === "image" ? getImageCountValue(replaySettings?.imageCount ?? selectedImageCounts[generationMode], replayMeta?.agentGenerated ? Number.POSITIVE_INFINITY : 4) : undefined,
        pendingVideoCount: generationMode === "video" ? Math.max(1, replayMeta?.itemPrompts?.length ?? 1) : undefined,
        mode: generationMode,
        requestId: pendingRequest.id,
        imageReferences: pendingRequest.imageReferences,
        uploadedFiles: replayUploadedFiles.length > 0 ? replayUploadedFiles : undefined,
        generationMeta: generationMode === "image" || generationMode === "video" ? { mode: generationMode, model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, assetTargetType: pendingRequest.assetTargetType, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated, itemPrompts: pendingRequest.agentItemPrompts, itemPromptDetails: pendingRequest.agentItemPromptDetails } : undefined,
      });
    }
    void runGeneration(sessionId, pendingRequest);
  };

  const retryFailedMedia = (message: Message, failedIndex = 0) => {
    if (!activeSession || message.role !== "assistant") return;
    const meta = message.generationMeta;
    if (!meta || (meta.mode !== "image" && meta.mode !== "video")) return;
    const existingMediaCount = meta.mode === "video" ? getMessageVideos(message).length : message.images?.length ?? 0;
    const targetItemIndex = existingMediaCount + Math.max(0, failedIndex);
    const prompt = ((meta.mode === "video" || meta.agentGenerated ? meta.itemPrompts?.[targetItemIndex] ?? meta.originalPrompt : meta.originalPrompt) ?? "").trim();
    if (!prompt) return;

    const sessionId = activeSession.id;
    const requestId = createClientId();
    const retryStartedAt = Date.now();
    const retryMediaReferences = getUploadedMediaReferences(message.uploadedFiles);
    const retryReferenceVideos = retryMediaReferences.filter((reference) => reference.mediaKind === "video").map((reference) => reference.url);
    const retryReferenceAudios = retryMediaReferences.filter((reference) => reference.mediaKind === "audio").map((reference) => reference.url);
    const pendingRequest: PendingGeneration = {
      id: requestId,
      model: meta.model,
      mode: meta.mode,
      prompt,
      originalPrompt: prompt,
      preserveOriginalInput: meta.preserveOriginalInput,
      referenceImages: message.imageReferences?.map((reference) => reference.url).filter(Boolean),
      referenceVideos: meta.mode === "video" && retryReferenceVideos.length > 0 ? retryReferenceVideos : undefined,
      referenceAudios: meta.mode === "video" && retryReferenceAudios.length > 0 ? retryReferenceAudios : undefined,
      imageReferences: message.imageReferences,
      referenceHint: message.imageReferences?.length ? getReferenceHint(message.imageReferences) : undefined,
      assetTargetType: meta.assetTargetType,
      agentGenerated: meta.agentGenerated,
      agentDisplayText: meta.agentGenerated ? message.content : undefined,
      agentItemPrompts: meta.mode === "video" ? [prompt] : undefined,
      agentItemPromptDetails: meta.itemPromptDetails?.[targetItemIndex] ? [meta.itemPromptDetails[targetItemIndex]] : undefined,
      retryFailedIndex: failedIndex,
      settings: meta.mode === "image" ? { ...meta.settings, imageCount: "1张" } : meta.settings,
      messages: activeSession.messages.filter((item) => item.role !== "system").map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content, images: item.images })),
    };

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              pendingRequest: undefined,
              pendingRequests: [...getSessionPendingRequests(session), pendingRequest],
              messages: session.messages.map((item) =>
                item.id === message.id
                  ? {
                      ...item,
                      requestId,
                      statusText: meta.mode === "video" ? videoStatusLabels.creating : imageStatusLabels.creating,
                      imageResultSlots: meta.mode === "image" ? (() => {
                        let failedOrdinal = -1;
                        const requestedCount = getRequestedImageDisplayCount(item) ?? Math.max(1, (item.images?.length ?? 0) + (item.failedImageCount ?? 0) + (item.pendingImageCount ?? 0));
                        const currentSlots = item.imageResultSlots ?? [
                          ...(item.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: item.failedImageCount ?? 0 }).map(() => ({ type: "failed" as const })),
                          ...Array.from({ length: item.pendingImageCount ?? 0 }).map(() => ({ type: "pending" as const, startedAt: item.createdAt })),
                        ];
                        while (currentSlots.length < requestedCount) currentSlots.push({ type: "pending" as const, startedAt: item.createdAt });
                        return currentSlots.map((slot) => {
                          if (slot.type !== "failed") return slot;
                          failedOrdinal += 1;
                          return failedOrdinal === failedIndex ? { type: "failed" as const, retryingStartedAt: retryStartedAt } : slot;
                        }).slice(0, requestedCount);
                      })() : item.imageResultSlots,
                      retryingFailedImageIndexes: meta.mode === "image" ? Array.from(new Set([...(item.retryingFailedImageIndexes ?? []), failedIndex])) : item.retryingFailedImageIndexes,
                      retryingFailedImageStartedAt: meta.mode === "image" ? { ...(item.retryingFailedImageStartedAt ?? {}), [failedIndex]: retryStartedAt } : item.retryingFailedImageStartedAt,
                      retryingFailedVideoIndexes: meta.mode === "video" ? Array.from(new Set([...(item.retryingFailedVideoIndexes ?? []), failedIndex])) : item.retryingFailedVideoIndexes,
                      retryingFailedVideoStartedAt: meta.mode === "video" ? { ...(item.retryingFailedVideoStartedAt ?? {}), [failedIndex]: retryStartedAt } : item.retryingFailedVideoStartedAt,
                      error: (() => {
                        if (meta.mode === "image") {
                          const failedCount = Math.max(0, item.failedImageCount ?? 0);
                          const retryingIndexes = Array.from(new Set([...(item.retryingFailedImageIndexes ?? []), failedIndex]));
                          return failedCount > 0 && retryingIndexes.length >= failedCount ? undefined : item.error;
                        }

                        if (meta.mode === "video") {
                          const failedCount = Math.max(0, item.failedVideoCount ?? 0);
                          const retryingIndexes = Array.from(new Set([...(item.retryingFailedVideoIndexes ?? []), failedIndex]));
                          return failedCount > 0 && retryingIndexes.length >= failedCount ? undefined : item.error;
                        }

                        return undefined;
                      })(),
                    }
                  : item,
              ),
            }
          : session,
      ),
    );

    void runGeneration(sessionId, pendingRequest);
  };

  const submitFeedback = useCallback((kind: FeedbackKind, message: Message) => {
    addFeedbackLog(kind, message);

    if (kind === "wrong_mode" && activeSession) {
      const messageIndex = activeSession.messages.findIndex((item) => item.id === message.id);
      const previousUserMessage = [...activeSession.messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user");
      const correctedMode: IntentMode = message.mode === "video" ? "image" : "video";

      if (previousUserMessage) {
        rememberIntentCorrection(previousUserMessage.content, correctedMode);
      }
    }
  }, [activeSession, addFeedbackLog, rememberIntentCorrection]);

  const copyMessageTextOnly = useCallback(async (message: Message) => {
    setOpenMessageMenuId("");

    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      setCopyFeedback({ messageId: message.id, state: "error" });
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
        copyFeedbackTimerRef.current = null;
      }, 1000);
    }
  }, []);

  const copyUserMessageText = useCallback(async (message: Message) => {
    const showCopyFeedback = (state: "success" | "error") => {
      setCopyFeedback({ messageId: message.id, state });
      if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current);
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedback((current) => (current?.messageId === message.id ? null : current));
        copyFeedbackTimerRef.current = null;
      }, 1000);
    };

    try {
      await navigator.clipboard.writeText(message.content);
      showCopyFeedback("success");
    } catch {
      showCopyFeedback("error");
    }
  }, []);

  const deleteAssistantMessage = useCallback((messageId: string) => {
    setOpenMessageMenuId("");
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: session.messages.filter((message) => message.id !== messageId),
            }
          : session,
      ),
    );
  }, [activeSessionId]);

  const toggleReaction = useCallback((kind: "like" | "dislike", message: Message) => {
    setMessageReactions((current) => {
      const next = { ...current };

      if (next[message.id] === kind) {
        delete next[message.id];
        return next;
      }

      next[message.id] = kind;
      return next;
    });
    addFeedbackLog(kind, message);
  }, [addFeedbackLog]);

  const toggleIssueFeedback = useCallback((kind: "wrong" | "wrong_mode", message: Message) => {
    setMessageIssueFeedback((current) => {
      const next = { ...current };

      if (next[message.id] === kind) {
        delete next[message.id];
        return next;
      }

      next[message.id] = kind;
      return next;
    });
    submitFeedback(kind, message);
  }, [submitFeedback]);

  const addFilesToInput = useCallback(async (files: File[]) => {
    const tips = new Set<string>();
    const imageFiles: File[] = [];
    const uploadFiles: Array<{ file: File; media?: { mediaKind?: "document" | "video" | "audio"; durationSeconds?: number; dimensions?: ImageDimensions } }> = [];
    let acceptedImageCount = 0;
    let acceptedFileCount = 0;
    let acceptedVideoCount = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "video").length;
    let acceptedAudioCount = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "audio").length;
    let acceptedVideoDuration = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "video").reduce((sum, file) => sum + getUploadedMediaDuration(file), 0);
    let acceptedAudioDuration = activeUploadedFiles.filter((file) => getUploadedFileMediaKind(file) === "audio").reduce((sum, file) => sum + getUploadedMediaDuration(file), 0);
    const maxImages = currentUploadRule.image.maxCount;
    const maxUploadFiles = currentUploadRule.document.maxCount + currentUploadRule.video.maxCount + currentUploadRule.audio.maxCount;
    const remainingImages = Math.max(0, maxImages - activeUploadedImages.length);
    const remainingDocuments = Math.max(0, maxUploadFiles - activeUploadedFiles.length);

    for (const file of files) {
      const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : getUploadKindFromFileName(file.name || file.type);
      const extension = getFileExtension(file.name) || file.type.split("/")[1]?.toLowerCase() || "";

      if (kind === "image") {
        if (!currentUploadRule.image.enabled) {
          tips.add("当前模型不支持上传图片");
        } else if (!currentUploadRule.image.formats.includes(extension)) {
          tips.add("当前模型不支持该图片格式");
        } else if (file.size > currentUploadRule.image.maxSizeMb * 1024 * 1024) {
          tips.add(`当前模型支持的单张图片最大为 ${currentUploadRule.image.maxSizeMb}MB`);
        } else if (acceptedImageCount >= remainingImages) {
          tips.add(`当前模型最多支持 ${maxImages} 张参考图，不能上传更多图片`);
        } else {
          imageFiles.push(file);
          acceptedImageCount += 1;
        }
        continue;
      }

      if (kind === "document") {
        if (!currentUploadRule.document.enabled) {
          tips.add("当前模型不支持上传文件");
        } else if (!currentUploadRule.document.formats.includes(extension)) {
          tips.add("当前模型不支持该文件格式");
        } else if (file.size > currentUploadRule.document.maxSizeMb * 1024 * 1024) {
          tips.add(`当前模型支持的单个文件最大为 ${currentUploadRule.document.maxSizeMb}MB`);
        } else if (acceptedFileCount >= remainingDocuments) {
          tips.add(`当前模型最多支持 ${maxUploadFiles} 个文件`);
        } else {
          uploadFiles.push({ file, media: { mediaKind: "document" } });
          acceptedFileCount += 1;
        }
        continue;
      }

      if (kind === "video") {
        if (!currentUploadRule.video.enabled) {
          tips.add("当前模型不支持上传视频");
        } else if (!currentUploadRule.video.formats.includes(extension)) {
          tips.add("当前模型不支持该视频格式");
        } else if (file.size > currentUploadRule.video.maxSizeMb * 1024 * 1024) {
          tips.add(`当前模型支持的单个视频最大为 ${currentUploadRule.video.maxSizeMb}MB`);
        } else if (acceptedVideoCount >= currentUploadRule.video.maxCount) {
          tips.add(`当前模型最多支持 ${currentUploadRule.video.maxCount} 个参考视频`);
        } else if (acceptedFileCount >= remainingDocuments) {
          tips.add(`当前模型最多支持 ${maxUploadFiles} 个文件`);
        } else {
          try {
            const media = await readMediaFileMetadata(file, "video");
            const durationError = validateMediaDuration("视频", media.durationSeconds, currentUploadRule.video);
            const dimensionError = validateReferenceVideoDimensions(media.dimensions);
            const nextTotal = acceptedVideoDuration + (media.durationSeconds ?? 0);
            if (durationError) tips.add(durationError);
            else if (dimensionError) tips.add(dimensionError);
            else if (currentUploadRule.video.maxTotalSeconds !== undefined && nextTotal > currentUploadRule.video.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) tips.add(`参考视频总时长不能超过 ${currentUploadRule.video.maxTotalSeconds} 秒`);
            else {
              uploadFiles.push({ file, media: { mediaKind: "video", ...media } });
              acceptedVideoCount += 1;
              acceptedVideoDuration = nextTotal;
              acceptedFileCount += 1;
            }
          } catch (error) {
            tips.add(toUserErrorMessage(error, "视频信息读取失败"));
          }
        }
        continue;
      }

      if (kind === "audio") {
        if (!currentUploadRule.audio.enabled) {
          tips.add("当前模型不支持上传音频");
        } else if (!currentUploadRule.audio.formats.includes(extension)) {
          tips.add("当前模型不支持该音频格式");
        } else if (file.size > currentUploadRule.audio.maxSizeMb * 1024 * 1024) {
          tips.add(`当前模型支持的单个音频最大为 ${currentUploadRule.audio.maxSizeMb}MB`);
        } else if (acceptedAudioCount >= currentUploadRule.audio.maxCount) {
          tips.add(`当前模型最多支持 ${currentUploadRule.audio.maxCount} 个参考音频`);
        } else if (acceptedFileCount >= remainingDocuments) {
          tips.add(`当前模型最多支持 ${maxUploadFiles} 个文件`);
        } else {
          try {
            const media = await readMediaFileMetadata(file, "audio");
            const durationError = validateMediaDuration("音频", media.durationSeconds, currentUploadRule.audio);
            const nextTotal = acceptedAudioDuration + (media.durationSeconds ?? 0);
            if (durationError) tips.add(durationError);
            else if (currentUploadRule.audio.maxTotalSeconds !== undefined && nextTotal > currentUploadRule.audio.maxTotalSeconds + MEDIA_DURATION_EPSILON_SECONDS) tips.add(`参考音频总时长不能超过 ${currentUploadRule.audio.maxTotalSeconds} 秒`);
            else {
              uploadFiles.push({ file, media: { mediaKind: "audio", ...media } });
              acceptedAudioCount += 1;
              acceptedAudioDuration = nextTotal;
              acceptedFileCount += 1;
            }
          } catch (error) {
            tips.add(toUserErrorMessage(error, "音频信息读取失败"));
          }
        }
        continue;
      }

      tips.add("暂不支持该文件类型");
    }

    Array.from(tips).slice(0, 3).forEach((tip) => showInputTip(tip));

    if (uploadFiles.length > 0) {
      const documentEntries = uploadFiles.map((item) => createUploadedDocumentEntry(item.file, item.media));
      setSessions((current) =>
        current.map((session) => {
          if (session.id !== activeSessionId) return session;
          const existingFiles = session.uploadedFiles ?? [];
          const existingKeys = new Set(existingFiles.map(getUploadedFileStorageValue));
          const nextFiles = [...existingFiles, ...documentEntries.filter((file) => !existingKeys.has(file.storageName))].slice(0, maxUploadFiles);
          return { ...session, uploadedFiles: nextFiles, updatedAt: Date.now() };
        }),
      );

      uploadFiles.forEach(({ file, media }, index) => {
        const entry = documentEntries[index];
        if (!entry) return;

        void uploadDocumentFileAsset(file, { conversationId: activeSessionId, mediaKind: media?.mediaKind, durationSeconds: media?.durationSeconds, dimensions: media?.dimensions }, (progress) => {
          setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, uploadProgress: progress, uploadStatus: "uploading" } : item) } : session));
        })
          .then((url) => {
            setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, url, uploadProgress: 100, uploadStatus: "ready" } : item) } : session));
          })
          .catch((error) => {
            setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, uploadProgress: 100, uploadStatus: "error", error: item.error ?? toUserErrorMessage(error, "上传失败") } : item) } : session));
          });

        if (!isReadableDocumentFile(file)) return;

        void readDocumentFileText(file, (progress) => {
          setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, progress, status: "reading" } : item) } : session));
        })
          .then((text) => {
            setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, text, progress: 100, status: "ready", error: undefined } : item) } : session));
          })
          .catch((error) => {
            setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedFiles: (session.uploadedFiles ?? []).map((item) => typeof item !== "string" && item.id === entry.id ? { ...item, progress: 100, status: "error", error: toUserErrorMessage(error, "读取失败") } : item) } : session));
          });
      });
    }

    if (imageFiles.length === 0) return;

    const imageResults = await Promise.allSettled(imageFiles.map(readFileAsUploadedImage));
    const images = imageResults.filter((result): result is PromiseFulfilledResult<UploadedImage> => result.status === "fulfilled").map((result) => result.value);
    const imageError = imageResults.find((result) => result.status === "rejected");
    if (imageError) showInputTip("图片读取失败");
    addActiveUploadedImages(images);

    images.forEach((image) => {
      const controller = new AbortController();
      inputImageUploadAbortControllersRef.current.set(image.id, controller);
      void uploadTemporaryAssetImage(image.uploadFile as File, (progress) => {
        setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === image.id ? { ...item, uploadProgress: progress, uploadStatus: "uploading" } : item) } : session));
      }, controller.signal)
        .then((tempToken) => {
          inputImageUploadAbortControllersRef.current.delete(image.id);
          setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === image.id ? { ...item, tempToken, uploadProgress: 100, uploadStatus: "ready", forceReencode: undefined, error: undefined } : item) } : session));
        })
          .catch((error) => {
            inputImageUploadAbortControllersRef.current.delete(image.id);
            if (controller.signal.aborted) return;
            const errorMessage = toUserErrorMessage(error, "上传失败");
            reportClientDiagnostic("input-image-upload failed", { fileName: image.name, error: errorMessage, rawError: error instanceof Error ? error.message : String(error) });
          setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === image.id ? { ...item, uploadProgress: 100, uploadStatus: "error", error: errorMessage } : item) } : session));
        });
    });
  }, [activeSessionId, activeUploadedFiles, activeUploadedImages.length, addActiveUploadedImages, currentUploadRule, showInputTip]);

  const retryInputImageUpload = useCallback((imageId: string) => {
    const image = activeUploadedImages.find((item) => item.id === imageId);
    if (!image?.uploadFile) {
      showInputTip("请重新选择图片");
      return;
    }
    inputImageUploadAbortControllersRef.current.get(imageId)?.abort();
    inputImageUploadAbortControllersRef.current.delete(imageId);
    const controller = new AbortController();
    inputImageUploadAbortControllersRef.current.set(imageId, controller);
    setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === imageId ? { ...item, tempToken: undefined, uploadProgress: 6, uploadStatus: "uploading", forceReencode: true, error: undefined } : item) } : session));
    void uploadTemporaryAssetImage(image.uploadFile, (progress) => {
      setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === imageId ? { ...item, uploadProgress: progress, uploadStatus: "uploading" } : item) } : session));
    }, controller.signal, true)
      .then((tempToken) => {
        inputImageUploadAbortControllersRef.current.delete(imageId);
        setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === imageId ? { ...item, tempToken, uploadProgress: 100, uploadStatus: "ready", forceReencode: undefined, error: undefined } : item) } : session));
      })
      .catch((error) => {
        inputImageUploadAbortControllersRef.current.delete(imageId);
        if (controller.signal.aborted) return;
        const errorMessage = toUserErrorMessage(error, "上传失败");
        reportClientDiagnostic("input-image-upload retry failed", { fileName: image.name, error: errorMessage, rawError: error instanceof Error ? error.message : String(error) });
        setSessions((current) => current.map((session) => session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).map((item) => item.id === imageId ? { ...item, uploadProgress: 100, uploadStatus: "error", error: errorMessage } : item) } : session));
      });
  }, [activeSessionId, activeUploadedImages, showInputTip]);

  const hasDraggedFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");
  const handleChatDragEnter = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragUploadDepthRef.current += 1;
    setIsDragUploadActive(true);
  };
  const handleChatDragOver = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  };
  const handleChatDragLeave = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragUploadDepthRef.current = Math.max(0, dragUploadDepthRef.current - 1);
    if (dragUploadDepthRef.current === 0) setIsDragUploadActive(false);
  };
  const handleChatDrop = (event: DragEvent) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragUploadDepthRef.current = 0;
    setIsDragUploadActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) void addFilesToInput(files);
  };

  const focusEditorAt = useCallback((offset: number) => {
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      setSelectionTextOffset(editor, offset);
      setDraftCursorOffset(offset);
    });
  }, []);
  const getCurrentDraftCursor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return Math.min(Math.max(0, draftCursorOffset), activeInput.length);

    const cursor = getSelectionTextOffset(editor);
    return Math.min(Math.max(0, cursor), activeInput.length);
  }, [activeInput.length, draftCursorOffset]);
  const insertTextAtDraftCursor = useCallback((text: string) => {
    const cursor = getCurrentDraftCursor();
    const nextInput = `${activeInput.slice(0, cursor)}${text}${activeInput.slice(cursor)}`;
    setActiveDraftInput(nextInput);
    focusEditorAt(cursor + text.length);
  }, [activeInput, focusEditorAt, getCurrentDraftCursor, setActiveDraftInput]);
  const focusCharacterEditorAt = useCallback((offset: number) => {
    requestAnimationFrame(() => {
      const editor = characterEditorRef.current;
      if (!editor) return;
      editor.focus();
      setSelectionTextOffset(editor, offset);
      setCharacterPromptCursorOffset(offset);
    });
  }, []);
  const getCurrentCharacterPromptCursor = useCallback(() => {
    const editor = characterEditorRef.current;
    if (!editor) return Math.min(Math.max(0, characterPromptCursorOffset), characterGeneratePrompt.length);

    const cursor = getSelectionTextOffset(editor);
    return Math.min(Math.max(0, cursor), characterGeneratePrompt.length);
  }, [characterGeneratePrompt.length, characterPromptCursorOffset]);
  const activeAtQuery = getAtQueryAtCursor(activeInput, draftCursorOffset);
  useEffect(() => {
    const timer = window.setTimeout(updateUploadedRowScrollState, 0);
    window.addEventListener("resize", updateUploadedRowScrollState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateUploadedRowScrollState);
    };
  }, [activeUploadedFiles.length, activeUploadedImages.length, inputShellWidth, updateUploadedRowScrollState]);
  useEffect(() => {
    const timer = window.setTimeout(updateAssetGenerateReferenceScrollState, 0);
    window.addEventListener("resize", updateAssetGenerateReferenceScrollState);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateAssetGenerateReferenceScrollState);
    };
  }, [assetGenerateReferenceImages.length, isCharacterGenerateOpen, updateAssetGenerateReferenceScrollState]);
  const hasMentionAssetImages = assets.some((asset) => mentionAssetTypes.some((type) => isMentionGroupAsset(asset, type)));
  const atAssetSearch = activeAtQuery?.query ?? "";
  const atAssetGroups = activeAtQuery || isAtAssetMenuOpen
    ? mentionAssetTypes.map((type) => ({
        type,
        assets: assets.filter((asset) => isMentionGroupAsset(asset, type) && asset.name.includes(atAssetSearch)),
      }))
    : [];
  const hasAtAssetOptions = atAssetGroups.some((group) => group.assets.length > 0) && isAtAssetMenuOpen;
  const activeAtAssetGroup = atAssetGroups.find((group) => group.type === atAssetFilter && group.assets.length > 0) ?? atAssetGroups.find((group) => group.assets.length > 0);
  const insertAssetReference = (asset: AssetItem) => {
    if (activeUploadedImages.length >= currentMaxReferenceImages && !activeUploadedImages.some((image) => image.url === asset.url)) {
      showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
      setIsAtAssetMenuOpen(false);
      return;
    }

    const insertBase = activeAtQuery ? activeInput.slice(0, activeAtQuery.index) : activeInput.slice(0, draftCursorOffset);
    const insertSuffix = activeAtQuery ? activeInput.slice(activeAtQuery.cursor) : activeInput.slice(draftCursorOffset);
    const referenceText = `@${asset.name} `;
    addActiveUploadedImages([toUploadedAssetReference(asset)], { draftBase: insertBase, draftSuffix: insertSuffix, insertReferenceText: true });
    setIsAtAssetMenuOpen(false);
    focusEditorAt(Math.min(MAX_DRAFT_INPUT_LENGTH, insertBase.length + referenceText.length));
  };
  const insertCharacterAssetReference = (asset: AssetItem) => {
    if (assetGenerateReferenceImages.length >= assetGenerateMaxReferenceImages && !assetGenerateReferenceImages.some((image) => image.url === asset.url)) {
      showInputTip(`当前模型最多支持 ${assetGenerateMaxReferenceImages} 张参考图，不能上传更多图片`);
      setIsCharacterAtAssetMenuOpen(false);
      return;
    }

    const currentCursor = getCurrentCharacterPromptCursor();
    const currentAtQuery = getAtQueryAtCursor(characterGeneratePrompt, currentCursor);
    const insertBase = currentAtQuery ? characterGeneratePrompt.slice(0, currentAtQuery.index) : characterGeneratePrompt.slice(0, currentCursor);
    const insertSuffix = currentAtQuery ? characterGeneratePrompt.slice(currentAtQuery.cursor) : characterGeneratePrompt.slice(currentCursor);
    const referenceText = `@${asset.name} `;
    const nextPrompt = Array.from(`${insertBase}${referenceText}${insertSuffix}`).slice(0, MAX_DRAFT_INPUT_LENGTH).join("");

    setActiveAssetGeneratePrompt(nextPrompt);
    setIsCharacterAtAssetMenuOpen(false);
    focusCharacterEditorAt(Math.min(MAX_DRAFT_INPUT_LENGTH, insertBase.length + referenceText.length));
  };
  const openCharacterMentionAssetMenu = () => {
    const needsMentionAssetLoad = ["character_image", "scene_image", "shot_image", "conversation_uploads"].some((filter) => !loadedAssetFilters[filter as AssetFilter] || !assets.some((asset) => isAssetInFilter(asset, filter as AssetFilter)));
    if (assetsLoadStatus !== "loaded" || needsMentionAssetLoad) {
      setCharacterPromptCursorOffset(getCurrentCharacterPromptCursor());
      setIsCharacterAtAssetMenuOpen(true);
      void loadMentionAssetFilters();
      return;
    }
    if (!hasMentionAssetImages) {
      setIsCharacterAtAssetMenuOpen(false);
      showInputTip("当前资产库没有图片");
      return;
    }

    setCharacterPromptCursorOffset(getCurrentCharacterPromptCursor());
    setIsCharacterAtAssetMenuOpen(true);
  };
  const resetCharacterGenerateWorkspace = useCallback(() => {
    setActiveAssetGenerateJobId("");
    setCharacterGenerateResult({ status: "idle" });
    setCharacterImageScale(1);
    setCharacterImageFitMode("fit");
    setCharacterImagePan({ x: 0, y: 0 });
    setCharacterImageNaturalSize({ width: 0, height: 0 });
    setCharacterImageFitScale(1);
    setIsCharacterImageDragging(false);
    setIsCharacterPromptOptimizing(false);
    setCharacterPromptCursorOffset(0);
    setCharacterAtAssetFilter("character_image");
    setIsCharacterAtAssetMenuOpen(false);
    setOpenControlMenu("");
  }, []);
  const openAssetGenerateJob = useCallback((jobId: string) => {
    const job = assetGenerateJobs.find((item) => item.id === jobId);
    if (!job) return;

    setAssetGenerateType(job.type);
    setCharacterGeneratePrompt(job.prompt);
    setCharacterPromptCursorOffset(job.prompt.length);
    setCharacterGenerateRatio(job.ratio);
    setCharacterGenerateStyle(job.style);
    setCharacterGenerateModel(job.model);
    setCharacterGenerateResolution(job.resolution);
    setCharacterGenerateResult(job.result);
    setCharacterImageScale(1);
    setCharacterImageFitMode("fit");
    setCharacterImagePan({ x: 0, y: 0 });
    setCharacterImageNaturalSize(job.result.dimensions ?? { width: 0, height: 0 });
    setCharacterImageFitScale(1);
    setIsCharacterImageDragging(false);
    setIsCharacterPromptOptimizing(false);
    setCharacterAtAssetFilter("character_image");
    setIsCharacterAtAssetMenuOpen(false);
    setOpenControlMenu("");
    setActiveAssetGenerateJobId(job.id);
    setIsCharacterGenerateOpen(true);
  }, [assetGenerateJobs]);
  const getCharacterPromptReferences = useCallback(() => {
    const prompt = characterGeneratePrompt.trim();
    return getOrderedExplicitImageReferences(prompt, assets, [], []);
  }, [assets, characterGeneratePrompt]);
  const optimizeCharacterPrompt = async () => {
    const rawPrompt = characterGeneratePrompt.trim();
    if (!rawPrompt || isCharacterPromptOptimizing || characterGenerateResult.status === "generating") return;

    setIsCharacterPromptOptimizing(true);
    try {
      setIsCharacterAtAssetMenuOpen(false);
      setOpenControlMenu("");
      const referencedAssets = getReferencedAssets(rawPrompt, assets);
      const optimizeModels = Array.from(new Set(["openai/gpt-5.5", ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL]));
      let data: ChatApiResponse | undefined;
      let nextPrompt = "";
      let lastError: unknown;

      for (const model of optimizeModels) {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              mode: "image",
              messages: [{ role: "user", content: `${isShotGeneration ? getShotPromptOptimizationRuleText(characterGenerateStyle, characterGenerateRatio) : isSceneGeneration ? getScenePromptOptimizationRuleText(characterGenerateStyle, characterGenerateRatio) : getCharacterPromptOptimizationRuleText(characterGenerateRatio, characterGenerateStyle)}\n\n用户输入：${referencedAssets.length > 0 ? `${rawPrompt}${getAssetReferencesText(referencedAssets)}` : rawPrompt}` }],
              settings: {
                ratio: characterGenerateDisplayRatio,
                resolution: characterGenerateDisplayResolution,
                style: characterGenerateStyleLabel,
                imageCount: "1张",
              },
              originalPrompt: rawPrompt,
              conversationId: activeSessionIdValue,
              conversationTitle: activeSession?.title,
              requestId: createClientId(),
              metadata: { creditSource: "prompt_optimization", originalPrompt: rawPrompt, recordFailure: true },
            }),
          });
          data = await readJson<ChatApiResponse>(response);
          nextPrompt = data.content?.trim() ?? "";
          if (nextPrompt) break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!data || !nextPrompt) throw lastError instanceof Error ? lastError : new Error("没有优化出提示词，请稍后再试。");
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);

      const styledPrompt = enforceAssetGenerateStylePrompt(nextPrompt, characterGenerateStyle);
      setActiveAssetGeneratePrompt(styledPrompt);
      focusCharacterEditorAt(styledPrompt.length);
    } catch (error) {
      void error;
    } finally {
      setIsCharacterPromptOptimizing(false);
    }
  };
  const addCharacterGeneratedAsset = useCallback((url: string, prompt: string, dimensions?: ImageDimensions, type = assetGenerateType, previewMeta = characterPreviewMeta) => {
    if (!url) return;
    const name = getNextAssetGenerationName(type, assets);

    setAssets((current) => {
      if (current.some((asset) => asset.url === url)) return current;

      return [
        {
          id: createClientId(),
          type,
          name,
          systemName: name,
          url,
          librarySource: "asset_generation" as const,
          sourcePrompt: prompt,
          sessionId: activeSessionIdValue,
          lockedType: true,
          previewMeta: dimensions ? getPreviewMetaWithDimensions(previewMeta, dimensions, "image") : previewMeta,
          createdAt: Date.now(),
        },
        ...current,
      ];
    });
    if (isRemoteMediaUrl(url)) return;
    void fetch("/api/media-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        name,
        currentCategory: type,
        mediaType: "image",
        sourcePrompt: prompt,
        promptSource: "generated",
        model: characterGenerateModel,
        settings: { ratio: characterGenerateDisplayRatio, resolution: characterGenerateDisplayResolution, style: characterGenerateStyleLabel, imageCount: "1张" },
        dimensions,
        previewMeta: dimensions ? getPreviewMetaWithDimensions(previewMeta, dimensions, "image") : previewMeta,
        conversationId: activeSessionIdValue,
      }),
    }).catch((error) => console.warn("[media-assets] failed to persist generated asset", error));
  }, [activeSessionIdValue, assetGenerateType, assets, characterGenerateDisplayRatio, characterGenerateDisplayResolution, characterGenerateModel, characterGenerateStyleLabel, characterPreviewMeta]);
  const generateCharacterImage = async () => {
    const rawPrompt = characterGeneratePrompt.trim();
    if (!rawPrompt || characterGenerateResult.status === "generating") return;
    if (workspaceStorageMode === "user" && currentUserCredits <= 0) {
      showInputTip("积分不足，请充值后再使用模型");
      return;
    }
    if (enabledAssetImageModelIds.length === 0 || !enabledAssetImageModelIds.includes(characterGenerateModel)) {
      showInputTip("连接不到模型，请联系管理员！");
      return;
    }

    const requestId = createClientId();
    const jobId = activeAssetGenerateJobId && characterGenerateResult.status === "failed" ? activeAssetGenerateJobId : requestId;
    const startedAt = Date.now();
    const references = getCharacterPromptReferences();
    if (references.length > assetGenerateMaxReferenceImages) {
      showInputTip(`当前模型最多支持 ${assetGenerateMaxReferenceImages} 张参考图，不能上传更多图片`);
      return;
    }
    const referenceHint = getReferenceHint(references);
    const ruleText = isShotGeneration ? getShotGenerationRuleText(characterGenerateStyle, characterGenerateRatio, characterGenerateModel) : isSceneGeneration ? getSceneGenerationRuleText(characterGenerateStyle, characterGenerateRatio, characterGenerateModel) : getCharacterGenerationRuleText(characterGenerateRatio, characterGenerateStyle, characterGenerateModel);
    const styledPrompt = enforceAssetGenerateStylePrompt(rawPrompt, characterGenerateStyle);
    const prompt = [ruleText, referenceHint, `${isShotGeneration ? "用户分镜提示词" : isSceneGeneration ? "用户场景提示词" : "用户角色提示词"}：${styledPrompt}`].filter(Boolean).join("\n\n");
    const previewMetaSnapshot = characterPreviewMeta;
    const settings: GenerationSettings = {
      ratio: characterGenerateDisplayRatio,
      resolution: characterGenerateDisplayResolution,
      style: characterGenerateStyleLabel,
      imageCount: "1张",
    };

    setCharacterImageFitMode("fit");
    setCharacterImageScale(1);
    setCharacterImagePan({ x: 0, y: 0 });
    setCharacterImageNaturalSize({ width: 0, height: 0 });
    setCharacterImageFitScale(1);
    setIsCharacterImageDragging(false);
    setIsCharacterAtAssetMenuOpen(false);
    setOpenControlMenu("");
    const generatingResult: CharacterGenerationResult = { status: "generating", startedAt };
    const jobSnapshot: AssetGenerateJob = {
      id: jobId,
      type: assetGenerateType,
      prompt: rawPrompt,
      ratio: characterGenerateRatio,
      style: characterGenerateStyle,
      model: characterGenerateModel,
      resolution: characterGenerateResolution,
      previewMeta: previewMetaSnapshot,
      result: generatingResult,
    };

    setActiveAssetGenerateJobId(jobId);
    setAssetGenerateJobs((current) => {
      const existingIndex = current.findIndex((job) => job.id === jobId);
      if (existingIndex < 0) return [jobSnapshot, ...current];
      return current.map((job) => job.id === jobId ? jobSnapshot : job);
    });
    setCharacterGenerateResult(generatingResult);
    try {
      const response = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            model: characterGenerateModel,
            referenceImages: references.length > 0 ? references.map((reference) => reference.url) : undefined,
            settings,
            count: 1,
            candidateMode: "best",
            conversationId: activeSessionIdValue,
            conversationTitle: activeSession?.title,
            requestId,
          metadata: { creditSource: isShotGeneration ? "shot_image_generation" : isSceneGeneration ? "scene_image_generation" : "character_image_generation" },
        }),
      });
      const data = await readJson<{ images?: string[]; imageDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta; credit?: CreditMeta; billableImageCount?: number }>(response);
      const url = data.images?.[0];
      if (!url) throw new Error(GENERIC_MEDIA_ERROR_MESSAGE);

      const dimensions = data.imageDimensions?.[url];
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);
      if (dimensions && activeAssetGenerateJobIdRef.current === jobId) setCharacterImageNaturalSize(dimensions);
      const succeededResult: CharacterGenerationResult = { status: "succeeded", url, dimensions };
      setAssetGenerateJobs((current) => current
        .filter((job) => !(job.type === jobSnapshot.type && job.result.status === "failed" && job.id !== jobId))
        .map((job) => job.id === jobId ? { ...job, result: succeededResult } : job));
      if (activeAssetGenerateJobIdRef.current === jobId) setCharacterGenerateResult(succeededResult);
      addCharacterGeneratedAsset(url, rawPrompt, dimensions, jobSnapshot.type, previewMetaSnapshot);
      notifyGenerationCompleteOnce(requestId, "图片生成已完成");
    } catch (error) {
        const message = normalizeMediaErrorText(toUserErrorMessage(error, GENERIC_MEDIA_ERROR_MESSAGE), "image") ?? GENERIC_MEDIA_ERROR_MESSAGE;
      const failedResult: CharacterGenerationResult = { status: "failed", error: message };
      console.error("[asset-generation] image request failed", {
        jobId,
        requestId,
        type: jobSnapshot.type,
        model: jobSnapshot.model,
        ratio: jobSnapshot.ratio,
        resolution: jobSnapshot.resolution,
        error: message,
      });
      setAssetGenerateJobs((current) => {
        const hasJob = current.some((job) => job.id === jobId);
        if (!hasJob) return [{ ...jobSnapshot, result: failedResult }, ...current];
        return current.map((job) => job.id === jobId ? { ...job, result: failedResult } : job);
      });
      if (activeAssetGenerateJobIdRef.current === jobId) setCharacterGenerateResult(failedResult);
    }
  };
  const clearActiveInput = () => {
    closeInputMenus();
    activeUploadedImages.forEach((image) => {
      inputImageUploadAbortControllersRef.current.get(image.id)?.abort();
      inputImageUploadAbortControllersRef.current.delete(image.id);
    });
    const tempTokens = activeUploadedImages.map((image) => image.tempToken).filter((token): token is string => Boolean(token));
    void deleteTemporaryAssetImages(tempTokens);
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              draftInput: "",
              uploadedFiles: [],
              uploadedImages: [],
            }
          : session,
      ),
    );
    setDraftCursorOffset(0);
    requestAnimationFrame(() => editorRef.current?.focus());
  };
  const optimizeActivePrompt = async () => {
    const rawPrompt = activeInput.trim();
    if (!rawPrompt || isInputPromptOptimizing || (mode !== "image" && mode !== "video")) return;

    setIsInputPromptOptimizing(true);
    try {
      closeInputMenus();
      const referencedAssets = getReferencedAssets(rawPrompt, assets);
      const optimizeModels = Array.from(new Set(["openai/gpt-5.5", ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL]));
      let data: ChatApiResponse | undefined;
      let nextPrompt = "";
      let lastError: unknown;

      for (const model of optimizeModels) {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              mode,
              messages: [{ role: "user", content: `${getProfessionalPromptOptimizationRuleText(mode)}\n\n用户输入：${referencedAssets.length > 0 ? `${rawPrompt}${getAssetReferencesText(referencedAssets)}` : rawPrompt}` }],
              settings: {
                ratio: selectedRatio,
                resolution: selectedResolution,
                duration: mode === "video" ? selectedVideoDuration : undefined,
                imageCount: mode === "image" ? selectedImageCount : undefined,
              },
              originalPrompt: rawPrompt,
              conversationId: activeSessionIdValue,
              conversationTitle: activeSession?.title,
              requestId: createClientId(),
              metadata: { creditSource: "prompt_optimization", originalPrompt: rawPrompt, recordFailure: true },
            }),
          });
          data = await readJson<ChatApiResponse>(response);
          nextPrompt = data.content?.trim() ?? "";
          if (nextPrompt) break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!data || !nextPrompt) throw lastError instanceof Error ? lastError : new Error("没有优化出提示词，请稍后再试。");
      addSessionUsage(activeSessionIdValue, data.usage);
      applyCreditResult(activeSessionIdValue, data.credit);
      setActiveDraftInput(nextPrompt);
      focusEditorAt(nextPrompt.length);
    } catch (error) {
      void error;
    } finally {
      setIsInputPromptOptimizing(false);
    }
  };
  const openMentionAssetMenu = () => {
    closeAllPopupMenus("mention");
    const needsMentionAssetLoad = ["character_image", "scene_image", "shot_image", "conversation_uploads"].some((filter) => !loadedAssetFilters[filter as AssetFilter] || !assets.some((asset) => isAssetInFilter(asset, filter as AssetFilter)));
    if (assetsLoadStatus !== "loaded" || needsMentionAssetLoad) {
      setIsAtAssetMenuOpen(true);
      void loadMentionAssetFilters();
      return;
    }
    if (!hasMentionAssetImages) {
      setIsAtAssetMenuOpen(false);
      showInputTip("当前资产库没有图片");
      return;
    }

    setIsAtAssetMenuOpen(true);
  };
  const getDefaultDocumentPreviewWidth = useCallback(() => {
    const sidebarWidth = isSidebarVisible ? isSidebarCollapsed ? 80 : 262 : 0;
    const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
    const availableWidth = Math.max(840, viewportWidth - sidebarWidth);
    return Math.max(420, Math.round((availableWidth * 4) / 9));
  }, [isSidebarCollapsed, isSidebarVisible]);
  useEffect(() => {
    if (!previewDocumentFile || hasCustomPreviewDocumentWidth) return;
    const updateDefaultWidth = () => setPreviewDocumentWidth(getDefaultDocumentPreviewWidth());
    updateDefaultWidth();
    window.addEventListener("resize", updateDefaultWidth);
    return () => window.removeEventListener("resize", updateDefaultWidth);
  }, [getDefaultDocumentPreviewWidth, hasCustomPreviewDocumentWidth, previewDocumentFile]);
  const startDocumentPreviewResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setHasCustomPreviewDocumentWidth(true);
    const startX = event.clientX;
    const startWidth = previewDocumentWidth || getDefaultDocumentPreviewWidth();
    const getMaxWidth = () => Math.max(420, window.innerWidth - (isSidebarVisible ? isSidebarCollapsed ? 100 : 282 : 20) - 420);
    const clampWidth = (width: number) => Math.min(getMaxWidth(), Math.max(420, width));
    const handlePointerMove = (moveEvent: PointerEvent) => {
      setPreviewDocumentWidth(clampWidth(startWidth + startX - moveEvent.clientX));
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [getDefaultDocumentPreviewWidth, isSidebarCollapsed, isSidebarVisible, previewDocumentWidth]);
  const switchAgentModelTier = (tier: AgentModelTier) => {
    if (agentModelTier === tier) return;

    setAgentModelTier(tier);
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              updatedAt: Date.now(),
              messages: [
                ...session.messages,
                {
                  id: createClientId(),
                  role: "system",
                  content: `当前已切换至${tier === "advanced" ? "高级" : "普通"}模式`,
                  createdAt: Date.now(),
                },
              ],
            }
          : session,
      ),
    );
  };

  const showWorkspaceIntlBadge = workspaceSite === "malaysia";
  const historySessions = sortByUpdatedAtDesc(sessions.filter((session) => !isDeletedSession(session)));
  const visibleHistorySessions = historySessions.slice(0, historyVisibleSessionCount);
  const hiddenHistorySessionCount = Math.max(0, historySessions.length - visibleHistorySessions.length);
  const historyDisplaySessionCount = Math.max(historyTotalSessionCount, historySessions.length);
  const visibleWorkflowItems = activeWorkflowItems.slice(0, workflowVisibleItemCount);
  const hiddenWorkflowItemCount = Math.max(0, activeWorkflowItems.length - visibleWorkflowItems.length);
  const shouldShowHistoryLoadStatus = activePanel !== "workflow" && sessions.length === 0 && workspaceLoadStatus !== "loaded";
  const historyLoadStatusText = workspaceLoadStatus === "failed" ? "重新加载历史" : "历史加载中...";
  const retryWorkspaceLoad = () => {
    setIsLoaded(false);
    setWorkspaceLoadStatus("loading");
    setWorkspaceLoadRetryKey((key) => key + 1);
  };
  const getAssetCount = (key: string, fallback: number) => Math.max(0, Math.floor(Number(assetCounts[key] ?? fallback)));
  const hasCurrentFilterAssets = assets.some((asset) => isAssetInFilter(asset, assetFilter));
  const workspaceRootClassName = isSidebarVisible
    ? isSidebarCollapsed
      ? "flashmuse-workspace-root grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white lg:grid-cols-[80px_minmax(0,1fr)]"
      : "flashmuse-workspace-root grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white lg:grid-cols-[262px_minmax(0,1fr)]"
    : "flashmuse-workspace-root grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white";
  const toggleSidebarVisibility = () => {
    closeAllPopupMenus();
    setIsSidebarVisible((current) => !current);
  };

  return (
    <section className={workspaceRootClassName}>
      {isSidebarVisible ? (
      <aside className={isSidebarCollapsed ? "flashmuse-sidebar relative z-10 hidden h-screen min-h-0 flex-col overflow-visible border-r border-[#e5e5e5] bg-[#f9f9f9] px-2 pb-1 pt-4 lg:flex" : "flashmuse-sidebar relative z-10 hidden h-screen min-h-0 flex-col overflow-visible border-r border-[#e5e5e5] bg-[#f9f9f9] px-3 pb-1 pt-4 lg:flex"}>
          <button type="button" onClick={() => setIsSidebarCollapsed((current) => !current)} className={isSidebarCollapsed ? "mb-5 flex justify-center text-left" : "mb-5 flex items-center gap-3 px-2 text-left"} aria-label={isSidebarCollapsed ? "展开左侧栏" : "收起左侧栏"} title={isSidebarCollapsed ? "展开左侧栏" : "收起左侧栏"}>
          <div className={isSidebarCollapsed ? "flex h-[50px] w-[50px] items-center justify-center" : "flex h-[50px] w-[50px] items-center justify-center"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home-assets/logo.png" alt="闪念 FlashMuse" className="h-[50px] w-[50px] object-contain" />
          </div>
          {!isSidebarCollapsed ? <div className="flex min-w-0 flex-col justify-center">
            <span className="flex items-end gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/home-assets/logo-text.png" alt="闪念" className="flashmuse-logo-text w-auto object-contain" style={{ height: 26 }} />
              {showWorkspaceIntlBadge ? <span className="pb-[1px] text-[12px] font-medium leading-none text-[#8a8a8a]">Intl.</span> : null}
            </span>
            <div className="mt-1 whitespace-nowrap text-xs leading-4 text-[#8a8a8a]">AI视频助手</div>
          </div> : null}
        </button>
        <div className={isSidebarCollapsed ? "mb-3 flex flex-col items-center gap-[5px]" : "mb-[22px] space-y-[5px]"}>
          <button type="button" onClick={() => { setStoredWorkspaceUiState({ activePanel: "chat" }); setActivePanel("chat"); }} className={isSidebarCollapsed ? activePanel === "chat" ? "relative flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec] font-medium text-[#111111]" : "relative flex h-10 w-10 items-center justify-center rounded-lg font-medium text-[#555555] transition hover:bg-[#ececec]" : activePanel === "chat" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#555555] transition hover:bg-[#ececec]"} title="对话模式" aria-label="对话模式">
            {activePanel === "chat" ? <RiChatSmileAiLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiChat3Line className="h-5 w-5 shrink-0 text-[#555555]" aria-hidden="true" />}
            {!isSidebarCollapsed ? <span className="text-[13px] leading-[1.2]">对话模式</span> : null}
            {activePanel !== "chat" && hasAnyConversationRunning ? <span className={isSidebarCollapsed ? "absolute ml-7 mt-7 flex w-4 shrink-0 justify-end" : "ml-auto flex w-7 shrink-0 justify-end"}><HaloPulseIndicator /></span> : null}
          </button>
          <button type="button" disabled={!WORKFLOW_MODE_ENABLED} onClick={() => { if (!WORKFLOW_MODE_ENABLED) return; setStoredWorkspaceUiState({ activePanel: "workflow" }); setActivePanel("workflow"); }} className={!WORKFLOW_MODE_ENABLED ? isSidebarCollapsed ? "relative flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-lg font-medium text-[#b0b0b0]" : "flex h-10 w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 text-left font-medium text-[#b0b0b0]" : isSidebarCollapsed ? activePanel === "workflow" ? "relative flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec] font-medium text-[#111111]" : "relative flex h-10 w-10 items-center justify-center rounded-lg font-medium text-[#555555] transition hover:bg-[#ececec]" : activePanel === "workflow" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#555555] transition hover:bg-[#ececec]"} title="工作流模式暂未开放" aria-label="工作流模式暂未开放">
            {activePanel === "workflow" && WORKFLOW_MODE_ENABLED ? <RiGitMergeLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiGitPullRequestLine className={!WORKFLOW_MODE_ENABLED ? "h-5 w-5 shrink-0 text-[#b0b0b0]" : "h-5 w-5 shrink-0 text-[#555555]"} aria-hidden="true" />}
            {!isSidebarCollapsed ? <span className="text-[13px] leading-[1.2]">工作流模式</span> : null}
            {!isSidebarCollapsed && !WORKFLOW_MODE_ENABLED ? <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-[#9a9a9a] ring-1 ring-[#e3e3e3]">未开放</span> : null}
          </button>
          <button type="button" onClick={() => {
            setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
            setShowScrollToBottom(false);
            setPreviewDocumentFile(null);
            setStoredWorkspaceUiState({ activePanel: "assets", assetFilter });
            setActivePanel("assets");
            void loadWorkspaceAssets(false, assetFilter, 0);
          }} className={isSidebarCollapsed ? activePanel === "assets" ? "relative flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec] font-medium text-[#111111]" : "relative flex h-10 w-10 items-center justify-center rounded-lg font-medium text-[#555555] transition hover:bg-[#ececec]" : activePanel === "assets" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#555555] transition hover:bg-[#ececec]"} title="资产库" aria-label="资产库">
            {activePanel === "assets" ? <RiFolderOpenLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiFolderLine className="h-5 w-5 shrink-0 text-[#555555]" aria-hidden="true" />}
            {!isSidebarCollapsed ? <span className="text-[13px] leading-[1.2]">资产库</span> : null}
            {activePanel !== "assets" && hasAnyAssetGenerating ? <span className={isSidebarCollapsed ? "absolute ml-7 mt-7 flex w-4 shrink-0 justify-end" : "ml-auto flex w-7 shrink-0 justify-end"}><HaloPulseIndicator /></span> : null}
          </button>
        </div>
        {isSidebarCollapsed ? <div className="mx-auto mb-3 h-px w-12 shrink-0 bg-[#e5e5e5]" aria-hidden="true" /> : null}

        {activePanel === "assets" ? (
          <>
            <div className={isSidebarCollapsed ? "yinzao-chat-scroll yinzao-scrollbar-hover min-h-0 flex-1 space-y-[6px] overflow-y-auto pb-px pt-px" : "yinzao-chat-scroll yinzao-scrollbar-hover -mr-3 min-h-0 flex-1 space-y-[3px] overflow-y-auto pb-px pl-px pr-3 pt-px"}>
              {assetGenerationTypes.map((type) => ({ label: assetTypeLabels[type], value: type, count: getAssetCount(type, assets.filter((asset) => asset.type === type && isAssetGenerationAsset(asset)).length) })).map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = assetTypeIcons[item.value];
                const isAssetTypeGenerating = assetGenerateJobs.some((job) => job.type === item.value && job.result.status === "generating");

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto flex w-10 shrink-0 justify-end text-[12px] text-[#9a9a9a]">{isAssetTypeGenerating ? <HaloPulseIndicator /> : item.count}</span> : isAssetTypeGenerating ? <span className="absolute ml-7 mt-7"><HaloPulseIndicator /></span> : null}
                  </button>
                );
              })}
              {[{ label: "上传图片", value: "conversation_uploads" as const, count: getAssetCount("conversation_uploads", assets.filter(isConversationUploadedAsset).length), icon: ImageUploadLineIcon }].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{item.count}</span> : null}
                  </button>
                );
              })}
              {!isSidebarCollapsed ? <div className="mx-3 my-3 h-px bg-[#e5e5e5]" aria-hidden="true" /> : <div className="mx-auto my-2 h-px w-12 bg-[#e5e5e5]" aria-hidden="true" />}
              {!isSidebarCollapsed ? <div className="flex items-center px-3 pb-1 pt-4 text-xs text-[#8a8a8a]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#b7b7b7]" aria-hidden="true" />对话流资产</span>
              </div> : <div className="h-2" />}
              {[
                { label: "生成图片", value: "conversation_images" as const, count: getAssetCount("conversation_images", assets.filter((asset) => isConversationAsset(asset) && !isVideoAsset(asset) && !isConversationUploadedAsset(asset)).length), icon: RiImageAiLine },
                { label: "生成视频", value: "conversation_videos" as const, count: getAssetCount("conversation_videos", assets.filter((asset) => isConversationAsset(asset) && isVideoAsset(asset)).length), icon: RiFilmAiLine },
              ].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{item.count}</span> : null}
                  </button>
                );
              })}
              {!isSidebarCollapsed ? <div className="flex items-center px-3 pb-1 pt-4 text-xs text-[#8a8a8a]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#b7b7b7]" aria-hidden="true" />工作流资产</span>
              </div> : <div className="h-2" />}
              {[
                { label: "生成图片", value: "workflow_images" as const, count: getAssetCount("workflow_images", assets.filter((asset) => isWorkflowAsset(asset) && !isVideoAsset(asset)).length), icon: RiImageAiLine },
                { label: "生成视频", value: "workflow_videos" as const, count: getAssetCount("workflow_videos", assets.filter((asset) => isWorkflowAsset(asset) && isVideoAsset(asset)).length), icon: RiFilmAiLine },
              ].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{item.count}</span> : null}
                  </button>
                );
              })}
              {!isSidebarCollapsed ? <div className="flex items-center px-3 pb-1 pt-4 text-xs text-[#8a8a8a]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#b7b7b7]" aria-hidden="true" />回收资产30天删除</span>
              </div> : <div className="h-2" />}
              {[{ label: assetTypeLabels.trash, value: "trash" as const, count: getAssetCount("trash", assets.filter((asset) => asset.type === "trash").length), icon: RiDeleteBinLine }].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.icon;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setPreviewDocumentFile(null);
                      setStoredWorkspaceUiState({ activePanel: "assets", assetFilter: item.value, assetScrollTopByFilter: { ...assetScrollTopByFilter, [item.value]: 0 } });
                      setAssetFilter(item.value);
                      void loadWorkspaceAssets(false, item.value, 0);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isSidebarCollapsed ? isActive ? "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec]" : "relative mx-auto flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                    title={item.label}
                    aria-label={item.label}
                  >
                    <AssetIcon className={isSidebarCollapsed ? "h-5 w-5 shrink-0 text-[#777777]" : "mr-2 h-5 w-5 shrink-0 text-[#777777]"} aria-hidden="true" />
                    {!isSidebarCollapsed ? <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span> : null}
                    {!isSidebarCollapsed ? <span className="ml-auto w-10 shrink-0 text-right text-[12px] text-[#9a9a9a]">{item.count}</span> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {!isSidebarCollapsed ? <div className="mb-2 flex items-center justify-between px-2 text-xs text-[#8a8a8a]">
              <span>{activePanel === "workflow" ? "历史工作流" : "历史对话"}</span>
              <span>{activePanel === "workflow" ? activeWorkflowItems.length : historyDisplaySessionCount}</span>
            </div> : null}
            <button
              type="button"
              onClick={activePanel === "workflow" ? startNewWorkflow : startNewSession}
              className={isSidebarCollapsed ? "relative mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-[#cfcfcf] text-center font-medium text-[#111111] transition hover:border-[#b8b8b8] hover:bg-[#ececec]" : "relative mb-2 flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-[#cfcfcf] px-3 text-center font-medium text-[#111111] transition hover:border-[#b8b8b8] hover:bg-[#ececec]"}
              aria-label={activePanel === "workflow" ? "新建工作流" : "新建对话"}
              title={activePanel === "workflow" ? "新建工作流" : "新建对话"}
            >
              {isSidebarCollapsed ? <RiAddLine className="h-5 w-5 text-[#111111]" aria-hidden="true" /> : <span className="relative text-[13px] leading-[1.2]">
                <RiAddLine className="absolute right-full top-1/2 mr-2 h-5 w-5 -translate-y-1/2 text-[#111111]" aria-hidden="true" />
                {activePanel === "workflow" ? "新建工作流" : "新建对话"}
              </span>}
            </button>
            {isSidebarCollapsed ? (
              <div className="relative flex min-h-0 flex-1 justify-center pt-px">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    const shouldClose = isCollapsedHistoryMenuOpen;
                    closeAllPopupMenus();
                    if (!shouldClose) setIsCollapsedHistoryMenuOpen(true);
                  }}
                  className={isCollapsedHistoryMenuOpen ? "flex h-10 w-10 items-center justify-center rounded-lg bg-[#ececec] text-[#111111]" : "flex h-10 w-10 items-center justify-center rounded-lg text-[#555555] transition hover:bg-[#ececec] hover:text-[#111111]"}
                  aria-label={activePanel === "workflow" ? "打开工作流列表" : "打开历史对话"}
                  title={activePanel === "workflow" ? "工作流列表" : "历史对话"}
                >
                  {activePanel === "workflow" ? <RiGitPullRequestLine className="h-5 w-5" aria-hidden="true" /> : <RiChat3Line className="h-5 w-5" aria-hidden="true" />}
                </button>

                {isCollapsedHistoryMenuOpen ? (
                  <div onClick={(event) => event.stopPropagation()} className="absolute left-[66px] top-0 z-40 flex max-h-[520px] w-[222px] flex-col overflow-hidden rounded-[12px] border border-[#e0e0e0] bg-white p-2 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                    <div className="yinzao-chat-scroll yinzao-scrollbar-hover min-h-0 flex-1 space-y-[3px] overflow-y-auto pr-1">
                      {activePanel === "workflow" ? visibleWorkflowItems.map((item) => {
                        const isMenuOpen = openWorkflowMenuId === item.id;

                        return (
                          <div key={item.id} className="relative">
                            <button type="button" onClick={() => { setActiveWorkflowId(item.id); setOpenWorkflowMenuId(""); setIsCollapsedHistoryMenuOpen(false); }} className={item.id === activeWorkflow?.id ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left" : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"}>
                              <div className={item.id === activeWorkflow?.id ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{item.title}</div>
                            </button>
                            <button type="button" aria-label="打开工作流菜单" onClick={(event) => { event.stopPropagation(); toggleWorkflowMenu(item.id, event.currentTarget); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]">
                              <RiMoreLine className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {isMenuOpen && !isSidebarCollapsed ? (
                              <div onClick={(event) => event.stopPropagation()} className="absolute right-1 top-10 z-50 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                                <button type="button" onClick={() => pinWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>置顶</span></button>
                                <button type="button" onClick={() => renameWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>重命名</span></button>
                                <button type="button" onClick={() => deleteWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50"><RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>删除</span></button>
                              </div>
                            ) : null}
                          </div>
                        );
                      }) : visibleHistorySessions.map((session) => {
                        const isActive = session.id === activeSession?.id;
                        const isMenuOpen = openSessionMenuId === session.id;
                        const isSessionRunning = resolvingSessionIds.has(session.id) || getSessionPendingRequests(session).length > 0 || modelInfoSessionId === session.id;

                        return (
                          <div key={session.id} className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSessionId(session.id);
                                setOpenSessionMenuId("");
                                setIsCollapsedHistoryMenuOpen(false);
                                void loadSessionDetails(session.id);
                              }}
                              className={isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left" : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"}
                            >
                              <div className={isActive ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{session.title}{loadingSessionIds.has(session.id) ? " · 加载中" : ""}</div>
                            </button>

                            {isSessionRunning ? (
                              <div className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center" aria-label="对话生成中"><HaloPulseIndicator /></div>
                            ) : (
                              <button type="button" aria-label="打开对话菜单" onClick={(event) => { event.stopPropagation(); toggleSessionMenu(session.id, event.currentTarget); }} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]"><RiMoreLine className="h-4 w-4" aria-hidden="true" /></button>
                            )}

                            {isMenuOpen && !isSessionRunning && !isSidebarCollapsed ? (
                              <div onClick={(event) => event.stopPropagation()} className="absolute right-1 top-10 z-50 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                                <button type="button" onClick={() => pinSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>置顶</span></button>
                                <button type="button" onClick={() => renameSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50"><RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>重命名</span></button>
                                <button type="button" onClick={() => deleteSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50"><RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" /><span>删除</span></button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {shouldShowHistoryLoadStatus ? (
                        workspaceLoadStatus === "failed" ? (
                          <button type="button" onClick={retryWorkspaceLoad} className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]">
                            <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#367cee]">{historyLoadStatusText}</div>
                          </button>
                        ) : (
                          <div className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left">
                            <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">{historyLoadStatusText}</div>
                          </div>
                        )
                      ) : null}
                      {activePanel === "workflow" && hiddenWorkflowItemCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setWorkflowVisibleItemCount((count) => Math.min(activeWorkflowItems.length, count + WORKFLOW_LOAD_MORE_COUNT))}
                          className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"
                        >
                          <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">加载更多</div>
                        </button>
                      ) : activePanel !== "workflow" && (hiddenHistorySessionCount > 0 || historyHasMoreSessions) ? (
                        <button
                          type="button"
                          disabled={isHistoryLoadingMore}
                          onClick={() => {
                            if (hiddenHistorySessionCount > 0) {
                              setHistoryVisibleSessionCount((count) => Math.min(historySessions.length, count + HISTORY_LOAD_MORE_COUNT));
                              return;
                            }
                            void loadMoreHistorySessions();
                          }}
                          className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"
                        >
                          <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">{isHistoryLoadingMore ? "加载中..." : "加载更多"}</div>
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : <div className="yinzao-chat-scroll yinzao-scrollbar-hover -mr-3 min-h-0 flex-1 space-y-[3px] overflow-y-auto pb-10 pl-px pr-3 pt-px">
              {activePanel === "workflow" ? visibleWorkflowItems.map((item) => {
                const isMenuOpen = openWorkflowMenuId === item.id;

                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => { setActiveWorkflowId(item.id); setOpenWorkflowMenuId(""); }}
                      className={item.id === activeWorkflow?.id ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left" : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"}
                    >
                      <div className={item.id === activeWorkflow?.id ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{item.title}</div>
                    </button>

                    <button
                      type="button"
                      aria-label="打开工作流菜单"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleWorkflowMenu(item.id, event.currentTarget);
                      }}
                      className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]"
                    >
                      <RiMoreLine className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {isMenuOpen ? (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        className={
                          sessionMenuPlacement === "top"
                            ? "absolute bottom-10 right-1 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                            : "absolute right-1 top-10 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                        }
                      >
                        <button type="button" onClick={() => pinWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                          <RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>置顶</span>
                        </button>
                        <button type="button" onClick={() => renameWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                          <RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>重命名</span>
                        </button>
                        <button type="button" onClick={() => deleteWorkflow(item.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                          <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>删除</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              }) : visibleHistorySessions.map((session) => {
            const isActive = session.id === activeSession?.id;
            const isMenuOpen = openSessionMenuId === session.id;
            const isSessionRunning = resolvingSessionIds.has(session.id) || getSessionPendingRequests(session).length > 0 || modelInfoSessionId === session.id;

            return (
              <div key={session.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSessionId(session.id);
                    setOpenSessionMenuId("");
                    void loadSessionDetails(session.id);
                  }}
                  className={
                    isActive
                      ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left"
                      : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"
                  }
                >
                  <div className={isActive ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{session.title}{loadingSessionIds.has(session.id) ? " · 加载中" : ""}</div>
                </button>

                {isSessionRunning ? (
                  <div className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center" aria-label="对话生成中">
                    <HaloPulseIndicator />
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label="打开对话菜单"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSessionMenu(session.id, event.currentTarget);
                    }}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#dedede] hover:text-[#111111]"
                  >
                    <RiMoreLine className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}

                {isMenuOpen && !isSessionRunning ? (
                  <div
                    onClick={(event) => event.stopPropagation()}
                    className={
                      sessionMenuPlacement === "top"
                        ? "absolute bottom-10 right-1 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                        : "absolute right-1 top-10 z-30 w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                    }
                  >
                    <button type="button" onClick={() => pinSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                      <RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>置顶</span>
                    </button>
                    <button type="button" onClick={() => renameSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                      <RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>重命名</span>
                    </button>
                    <button type="button" onClick={() => deleteSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                      <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>删除</span>
                    </button>
                  </div>
                ) : null}
              </div>
            );
              })}
              {shouldShowHistoryLoadStatus ? (
                workspaceLoadStatus === "failed" ? (
                  <button type="button" onClick={retryWorkspaceLoad} className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]">
                    <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#367cee]">{historyLoadStatusText}</div>
                  </button>
                ) : (
                  <div className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left">
                    <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">{historyLoadStatusText}</div>
                  </div>
                )
              ) : null}
              {activePanel === "workflow" && hiddenWorkflowItemCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setWorkflowVisibleItemCount((count) => Math.min(activeWorkflowItems.length, count + WORKFLOW_LOAD_MORE_COUNT))}
                  className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"
                >
                  <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">加载更多</div>
                </button>
              ) : activePanel !== "workflow" && (hiddenHistorySessionCount > 0 || historyHasMoreSessions) ? (
                <button
                  type="button"
                  disabled={isHistoryLoadingMore}
                  onClick={() => {
                    if (hiddenHistorySessionCount > 0) {
                      setHistoryVisibleSessionCount((count) => Math.min(historySessions.length, count + HISTORY_LOAD_MORE_COUNT));
                      return;
                    }
                    void loadMoreHistorySessions();
                  }}
                  className="mt-2 flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"
                >
                  <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#9a9a9a]">{isHistoryLoadingMore ? "加载中..." : "加载更多"}</div>
                </button>
              ) : null}
            </div>}
          </>
        )}
        <div className={isSidebarCollapsed ? "relative z-20 mt-0 flex min-h-[118px] flex-col items-center justify-center pb-3 pt-1" : "relative z-20 mt-0 flex min-h-[148px] flex-col justify-center pb-3 pt-1"}>
          <div aria-hidden="true" className={isSidebarCollapsed ? "absolute bottom-0 left-0 right-0 top-[-6px] bg-[#f9f9f9]" : "absolute bottom-0 left-[-12px] right-[-12px] top-[-6px] bg-[#f9f9f9]"} />
          <div aria-hidden="true" style={{ position: "absolute", left: isSidebarCollapsed ? 0 : -12, right: isSidebarCollapsed ? 0 : -12, top: -6, height: 1, background: "#e5e5e5", zIndex: 1 }} />
          {isUserMenuOpen ? (
            <div onClick={(event) => event.stopPropagation()} className={isSidebarCollapsed ? "absolute bottom-[60px] left-[18px] z-[9999] w-[222px] overflow-visible rounded-[12px] border border-[#e0e0e0] bg-white pt-2 shadow-[0_10px_28px_rgba(0,0,0,0.12)]" : "absolute bottom-[60px] left-[calc(50%-1px)] z-[9999] w-[222px] -translate-x-1/2 overflow-visible rounded-[12px] border border-[#e0e0e0] bg-white pt-2 shadow-[0_10px_28px_rgba(0,0,0,0.12)]"}>
              <button type="button" onClick={() => openUserDialog("profile")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                <RiAccountCircleLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                <span style={{ fontSize: 13 }}>用户信息</span>
              </button>
              <button type="button" onClick={() => openUserDialog("credits")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                <RiVipDiamondLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                <span style={{ fontSize: 13 }}>我的积分</span>
              </button>
              <button type="button" onClick={() => openUserDialog("security")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                <RiShieldUserLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                <span style={{ fontSize: 13 }}>帐号安全</span>
              </button>
              <div className="relative mx-2" onMouseEnter={() => setIsThemeMenuOpen(false)} onMouseLeave={() => setIsThemeMenuOpen(false)}>
                <button type="button" disabled aria-disabled="true" onClick={(event) => { event.stopPropagation(); setIsThemeMenuOpen(false); }} className="flex h-11 w-full cursor-not-allowed items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#aaaaaa] opacity-70">
                  <ThemeModeIcon className="h-[18px] w-[18px] text-[#b0b0b0]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13 }}>{themeModeLabel}</span>
                  <RiArrowRightSLine className="h-[18px] w-[18px] shrink-0 text-[#b0b0b0]" aria-hidden="true" />
                </button>
                {isThemeMenuOpen ? (
                  <div className="absolute bottom-0 left-[calc(100%+8px)] z-[10000] w-[220px] rounded-[12px] border border-[#e0e0e0] bg-white p-2 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
                    {([
                      { value: "light" as const, label: "浅色模式", icon: RiSunLine },
                      { value: "dark" as const, label: "深色模式", icon: RiMoonLine },
                      { value: "system" as const, label: `跟随系统 · ${resolvedTheme === "dark" ? "深色" : "浅色"}`, icon: RiComputerLine },
                    ]).map((item) => {
                      const ItemIcon = item.icon;
                      const selected = themeMode === item.value;

                      return (
                        <button key={item.value} type="button" onClick={(event) => { event.stopPropagation(); setThemeMode(item.value); setIsThemeMenuOpen(false); setIsUserMenuOpen(false); }} className="flex h-10 w-full items-center gap-3 rounded-[8px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                          <ItemIcon className="h-[18px] w-[18px] shrink-0 text-[#333333]" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13 }}>{item.label}</span>
                          {selected ? <RiCheckLine className="h-[18px] w-[18px] shrink-0 text-[#111111]" aria-hidden="true" /> : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <button type="button" onClick={() => openUserDialog("settings")} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                <RiSettingsLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                <span style={{ fontSize: 13 }}>设置</span>
              </button>
              {currentUserIsAdmin ? (
                <button type="button" onClick={() => { setIsUserMenuOpen(false); window.open("/admin", "_blank", "noopener,noreferrer"); }} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                  <RiTerminalWindowFill className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                  <span style={{ fontSize: 13 }}>后台管理</span>
                </button>
              ) : null}
              <div className="mt-2 overflow-hidden rounded-b-[12px] border-t border-[#e7e7e7] bg-[#f4f4f4]">
                <button type="button" onClick={() => void logoutUser()} className="flex h-14 w-full items-center gap-3 px-3 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#eeeeee]">
                  <RiLogoutBoxRLine className="h-[18px] w-[18px] text-[#777777]" aria-hidden="true" />
                  <span style={{ fontSize: 13 }}>退出登录</span>
                </button>
              </div>
            </div>
          ) : null}
          {isSidebarCollapsed ? (
            <button type="button" onClick={() => openUserDialog("credits")} className="relative z-10 mt-0 flex h-12 w-12 flex-col items-center justify-center rounded-[10px] border border-[#eeeeee] bg-white text-[#222222] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition hover:bg-[#f7f7f7]" aria-label="打开我的积分" title="我的积分">
              <div className="flex flex-col items-center justify-center gap-0.5">
                <div className="flex flex-col items-center gap-0.5 whitespace-nowrap text-[11px] font-semibold leading-none text-[#222222]">
                  <RiVipDiamondLine className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
                  <span className="font-semibold">{currentUserCredits.toLocaleString("en-US")}</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="relative z-10 mx-[7px] mt-0 rounded-[10px] border border-[#eeeeee] bg-white p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex h-7 items-center px-1">
                <div className="flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-[#222222]">
                  <RiVipDiamondLine className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
                  <span>积分：<span className="font-semibold">{currentUserCredits.toLocaleString("en-US")}</span></span>
                </div>
              </div>
              <button type="button" onClick={() => openUserDialog("credits")} className="mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[#faf8f2] px-2 text-[#9b8460] transition hover:bg-[#f5f1e8]">
                <RiVipCrown2Line className="h-[18px] w-[18px] shrink-0 text-[#9b8460]" aria-hidden="true" />
                <span className="font-medium leading-none" style={{ fontSize: 12 }}>个人免费版</span>
              </button>
            </div>
          )}
          <button type="button" onClick={(event) => { event.stopPropagation(); const shouldClose = isUserMenuOpen; closeAllPopupMenus(); if (!shouldClose) setIsUserMenuOpen(true); }} className={isSidebarCollapsed ? "relative z-10 mt-2 flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-[#ececec]" : "relative z-10 mx-2 mt-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-lg px-2 text-left transition hover:bg-[#ececec]"}>
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full" style={currentUserAvatarUrl ? undefined : { backgroundColor: defaultUserAvatar.backgroundColor, border: `1px solid ${defaultUserAvatar.borderColor}`, color: defaultUserAvatar.color }}>
              {currentUserAvatarUrl ? (
                <Image src={currentUserAvatarUrl} alt="用户头像" width={32} height={32} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[13px] font-medium">{defaultUserAvatar.label}</div>
              )}
            </div>
            {!isSidebarCollapsed ? <div className="flex min-w-0 flex-col justify-center">
              <div className="truncate text-[13px] font-medium leading-4 text-[#333333]">{currentUserNickname || currentUserEmail}</div>
              <div className="truncate text-[12px] leading-4 text-[#8a8a8a]">{currentUserEmail}</div>
            </div> : null}
          </button>
        </div>
      </aside>
      ) : null}

      {isSidebarVisible && isSidebarCollapsed && isCollapsedHistoryMenuOpen && collapsedActionMenuPosition && typeof document !== "undefined" ? (() => {
        const session = openSessionMenuId ? visibleHistorySessions.find((item) => item.id === openSessionMenuId) : undefined;
        if (session) {
          return createPortal(
            <div
              onClick={(event) => event.stopPropagation()}
              className="fixed z-[10000] w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
              style={{ left: collapsedActionMenuPosition.left, top: collapsedActionMenuPosition.top }}
            >
              <button type="button" onClick={() => pinSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                <RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>置顶</span>
              </button>
              <button type="button" onClick={() => renameSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                <RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>重命名</span>
              </button>
              <button type="button" onClick={() => deleteSession(session.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>删除</span>
              </button>
            </div>,
            document.body,
          );
        }

        const workflow = openWorkflowMenuId ? workflowItems.find((item) => item.id === openWorkflowMenuId) : undefined;
        if (!workflow) return null;

        return createPortal(
          <div
            onClick={(event) => event.stopPropagation()}
            className="fixed z-[10000] w-32 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
            style={{ left: collapsedActionMenuPosition.left, top: collapsedActionMenuPosition.top }}
          >
            <button type="button" onClick={() => pinWorkflow(workflow.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
              <RiPushpinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>置顶</span>
            </button>
            <button type="button" onClick={() => renameWorkflow(workflow.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
              <RiEditBoxLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>重命名</span>
            </button>
            <button type="button" onClick={() => deleteWorkflow(workflow.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
              <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>删除</span>
            </button>
          </div>,
          document.body,
        );
      })() : null}

      <section
        className="flashmuse-main relative flex h-screen min-h-screen flex-col bg-white"
        style={{ marginRight: previewDocumentFile ? (previewDocumentWidth || getDefaultDocumentPreviewWidth()) : 0 }}
        onDragEnter={handleChatDragEnter}
        onDragOver={handleChatDragOver}
        onDragLeave={handleChatDragLeave}
        onDrop={handleChatDrop}
      >
        {activePanel !== "workflow" ? <div className="relative z-30 flex h-[56px] shrink-0 items-center justify-center border-b border-[#eeeeee] bg-white px-14">
          <button
            type="button"
            onClick={toggleSidebarVisibility}
            className="absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
            aria-label={isSidebarVisible ? "隐藏左侧栏" : "显示左侧栏"}
            title={isSidebarVisible ? "隐藏左侧栏" : "显示左侧栏"}
          >
            {isSidebarVisible ? <RiLayoutLeft2Line className="h-[22px] w-[22px]" aria-hidden="true" /> : <RiLayoutLeftLine className="h-[22px] w-[22px]" aria-hidden="true" />}
          </button>

          <div className="flex min-w-0 items-center gap-1.5 text-center">
            <div className="truncate text-[13px] font-medium leading-8 text-[#111111]">{activePanel === "assets" ? "资产库" : activeSession?.title ?? "新对话"}</div>
            {activePanel === "chat" && activeSession ? (
              <button
                type="button"
                onClick={() => renameSession(activeSession.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
                aria-label="重命名当前对话"
              >
                <RiEditBoxLine className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {activePanel === "chat" ? <UsageSummaryButton summary={activeSession?.usageSummary} mediaCounts={getSessionMediaCounts(activeSession)} /> : null}

        </div> : null}

        <div className="relative flex-1 overflow-hidden">
          {isDragUploadActive ? (
            <div className="pointer-events-none absolute inset-2 z-[90] flex items-center justify-center rounded-[12px] border border-dashed border-[#b9b9b9] bg-white/58 backdrop-blur-[8px]">
              <div className="flex -translate-y-6 flex-col items-center text-center">
                <div className="mb-4 flex h-[76px] w-[76px] items-center justify-center rounded-full border-2 border-[#75d06a] bg-transparent text-[#75d06a]">
                  <RiArrowDownFill className="h-[48px] w-[48px]" aria-hidden="true" />
                </div>
                <div className="text-[18px] font-semibold text-[#111111]">在此处拖放文件</div>
                <div className="mt-3 max-w-[420px] text-[13px] leading-6 text-[#8a8a8a]">
                  文件类型：{supportedUploadTypeLabel}
                </div>
              </div>
            </div>
          ) : null}
          <div ref={chatScrollRef} onScroll={updateScrollToBottomButton} className={activePanel === "workflow" ? "yinzao-chat-scroll h-full overflow-y-auto bg-white" : "yinzao-chat-scroll h-full overflow-y-auto bg-white px-4 py-8 pb-6 sm:px-6 lg:px-8"}>
          {activePanel === "assets" ? (
            assetsLoadStatus !== "loaded" && !hasCurrentFilterAssets ? (
              <div className="flex min-h-full items-center justify-center bg-white pb-20 pt-10 text-center">
                <div className="flex w-[220px] flex-col items-center gap-2">
                  <div className="text-[13px] font-medium leading-none text-[#367cee]">{assetsLoadStatus === "failed" ? "加载失败" : "加载中..."}</div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[#e8efff]">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-[#367cee]" />
                  </div>
                  {assetsLoadStatus === "failed" ? <button type="button" onClick={() => { setAssetsLoadStatus("idle"); void loadWorkspaceAssets(); }} className="mt-2 text-[13px] font-medium text-[#367cee]">重新加载</button> : null}
                </div>
              </div>
            ) : (
            <AssetManagementPanel assets={assets} assetFilter={assetFilter} renderLimit={assetRenderLimit} openAssetActionMenuId={openAssetActionMenuId} isLoadingMore={assetsLoadStatus === "loading" && hasCurrentFilterAssets && assetLoadingReason === "scroll"} now={timerNow} pendingAssetGenerateJobs={assetGenerateJobs} onOpenPendingGenerate={openAssetGenerateJob} onDismissGenerateJob={(jobId) => setAssetGenerateJobs((current) => current.filter((job) => job.id !== jobId))} onOpenUpload={openAssetUploadDialog} onPreview={(asset) => { setPreviewDocumentFile(null); setPreviewAsset(enrichAssetPreviewMeta(asset)); }} onUseAsset={(asset) => {
              if (activeUploadedImages.length >= currentMaxReferenceImages && !activeUploadedImages.some((image) => image.url === asset.url)) {
                showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
                return;
              }

              setActivePanel("chat");
              const cursor = Math.min(Math.max(0, draftCursorOffset), activeInput.length);
              addActiveUploadedImages([toUploadedAssetReference(asset)], { draftBase: activeInput.slice(0, cursor), draftSuffix: activeInput.slice(cursor), insertReferenceText: true });
              focusEditorAt(cursor + asset.name.length + 2);
            }} onRename={(asset) => {
              closeAllPopupMenus();
              setOpenAssetActionMenuId("");
              setRenamingAssetId(asset.id);
              setAssetRenameInput(asset.name);
            }} onToggleActionMenu={(assetId) => {
              const shouldClose = openAssetActionMenuId === assetId;
              closeAllPopupMenus();
              if (!shouldClose) setOpenAssetActionMenuId(assetId);
            }} onOpenCharacterGenerate={() => {
              closeAllPopupMenus();
              setAssetGenerateType("character_image");
              setCharacterGenerateRatio(assetGenerateRatioSelections.character_image === "scene-grid" ? "single" : assetGenerateRatioSelections.character_image);
              resetCharacterGenerateWorkspace();
              setCharacterGeneratePrompt(assetGeneratePromptDrafts.character_image);
              setCharacterPromptCursorOffset(assetGeneratePromptDrafts.character_image.length);
              setIsCharacterGenerateOpen(true);
            }} onOpenSceneGenerate={() => {
              closeAllPopupMenus();
              setAssetGenerateType("scene_image");
              setCharacterGenerateRatio(assetGenerateRatioSelections.scene_image);
              resetCharacterGenerateWorkspace();
              setCharacterGeneratePrompt(assetGeneratePromptDrafts.scene_image);
              setCharacterPromptCursorOffset(assetGeneratePromptDrafts.scene_image.length);
              setIsCharacterGenerateOpen(true);
            }} onOpenShotGenerate={() => {
              closeAllPopupMenus();
              setAssetGenerateType("shot_image");
              setCharacterGenerateRatio(assetGenerateRatioSelections.shot_image === "scene-grid" ? "three-view" : assetGenerateRatioSelections.shot_image);
              resetCharacterGenerateWorkspace();
              setCharacterGeneratePrompt(assetGeneratePromptDrafts.shot_image);
              setCharacterPromptCursorOffset(assetGeneratePromptDrafts.shot_image.length);
              setIsCharacterGenerateOpen(true);
            }} onChangeType={(assetId, target) => {
              const changingAsset = assets.find((asset) => asset.id === assetId);
              setAssets((current) => {
                const targetAsset = current.find((asset) => asset.id === assetId);
                if (!targetAsset) return current;
                const movedAsset = target === "conversation_image"
                  ? { ...targetAsset, type: "other" as const, librarySource: "conversation" as const, sourcePrompt: targetAsset.sourcePrompt || UPLOAD_IMAGE_PROMPT_PLACEHOLDER, promptSource: "upload" as const, lockedType: true }
                  : { ...targetAsset, type: target, librarySource: "asset_generation" as const, lockedType: true };
                const movedKey = getAssetIdentityKey(movedAsset);
                return [movedAsset, ...current.filter((asset) => asset.id !== assetId && getAssetIdentityKey(asset) !== movedKey)];
              });
              setOpenAssetActionMenuId("");
              setLoadedAssetFilters((current) => ({ ...current, [assetFilter]: false, [target === "conversation_image" ? "conversation_uploads" : target]: false, conversation_uploads: false }));
              persistMediaAssetState(changingAsset, { currentCategory: target === "conversation_image" ? "conversation_uploads" : target });
            }} onDelete={deleteAsset} onRestore={restoreAsset} />
            )
          ) : activePanel === "workflow" ? (
            activeWorkflow ? (
              <>
                <WorkflowCanvas
                  key={activeWorkflow.id}
                  workflowId={activeWorkflow.id}
                  value={activeWorkflow.canvas}
                  workflowTitle={activeWorkflow.title}
                  leftSidebarVisible={isSidebarVisible}
                  onToggleLeftSidebar={toggleSidebarVisibility}
                  workflowAssets={assets.filter((asset) => isWorkflowAsset(asset) && (asset.workflowId || asset.sessionId) === activeWorkflow.id).map((asset) => ({ id: asset.id, name: asset.name, url: asset.url, posterUrl: asset.posterUrl, kind: isVideoAsset(asset) ? "video" : "image", nodeId: asset.workflowNodeId }))}
                  enabledImageModelIds={enabledGenerationModelIds.image}
                  enabledVideoModelIds={enabledGenerationModelIds.video}
                  getImageDisplayUrl={(url) => getMediaThumbnailUrl(url)}
                  getVideoPosterDisplayUrl={(url, posterUrl) => {
                    const poster = posterUrl ?? getLocalVideoPosterUrl(url);
                    return poster ? getMediaThumbnailUrl(poster) : undefined;
                  }}
                  onGeneratedMedia={(media) => addWorkflowGeneratedAssets(activeWorkflow.id, media.nodeId, { kind: media.kind, urls: media.urls, posterUrl: media.posterUrl, sourcePrompt: media.sourcePrompt, model: media.model, ratio: media.ratio, resolution: media.resolution, duration: media.duration, dimensions: media.dimensions })}
                  onPreviewMedia={(media) => {
                    const existingAsset = assets.find((asset) => isWorkflowAsset(asset) && normalizeMediaUrlForMatch(asset.url) === normalizeMediaUrlForMatch(media.url));
                    const workflowNode = activeWorkflow.canvas?.nodes?.find((node) => node.id === media.nodeId);
                    setPreviewDocumentFile(null);
                    if (workflowNode) {
                      setPreviewAsset(getWorkflowPreviewAsset(activeWorkflow, workflowNode, media.kind, media.url, existingAsset));
                      return;
                    }
                    if (existingAsset) {
                      setPreviewAsset(enrichAssetPreviewMeta(existingAsset));
                      return;
                    }
                    const dimensions = media.dimensions;
                    const previewMeta: PreviewMediaMeta = media.kind === "video"
                      ? { modelLabel: media.model ? getGenerationModelLabel("video", media.model) : "-", ratio: dimensions ? getCommonRatioLabel(dimensions.width, dimensions.height) : media.ratio || "-", sizeText: dimensions ? `${dimensions.width} × ${dimensions.height}` : "-", resolution: dimensions ? getVideoResolutionFromDimensions(dimensions) ?? media.resolution ?? "-" : media.resolution || "-", mode: "video", duration: media.duration }
                      : { modelLabel: media.model ? getGenerationModelLabel("image", media.model) : "-", ratio: dimensions ? getCommonRatioLabel(dimensions.width, dimensions.height) : media.ratio || "-", sizeText: dimensions ? `${dimensions.width} × ${dimensions.height}` : "-", resolution: dimensions ? getImageResolutionFromDimensions(dimensions) ?? media.resolution ?? "-" : media.resolution || "-", mode: "image" };
                    setPreviewAsset({
                      id: `${activeWorkflow.id}-${media.nodeId}-${media.kind}`,
                      type: media.kind === "video" ? "shot_video" : "other",
                      name: media.name,
                      systemName: media.name,
                      url: media.url,
                      posterUrl: media.posterUrl,
                      librarySource: "workflow",
                      sourcePrompt: media.sourcePrompt || activeWorkflow.title,
                      promptSource: "generated",
                      previewMeta,
                      sessionId: activeWorkflow.id,
                      workflowId: activeWorkflow.id,
                      workflowNodeId: media.nodeId,
                      lockedType: true,
                      createdAt: activeWorkflow.updatedAt ?? Date.now(),
                    });
                  }}
                  onChange={(canvas) => updateWorkflowCanvas(activeWorkflow.id, canvas)}
                  onCredit={applyWorkflowCreditResult}
                />
                <UsageSummaryButton summary={activeWorkflow.usageSummary} mediaCounts={getWorkflowMediaCounts(activeWorkflow)} className="absolute right-4 top-4 z-30" />
              </>
            ) : (
              <div className="relative flex h-full min-h-full items-center justify-center bg-[#f3f3f3] bg-[linear-gradient(to_right,#d8d8d8_1px,transparent_1px),linear-gradient(to_bottom,#d8d8d8_1px,transparent_1px),linear-gradient(to_right,#e9e9e9_1px,transparent_1px),linear-gradient(to_bottom,#e9e9e9_1px,transparent_1px)] bg-[size:120px_120px,120px_120px,24px_24px,24px_24px] text-center">
                <button type="button" onClick={toggleSidebarVisibility} className="absolute left-4 top-3 flex h-8 w-8 items-center justify-center rounded-md text-[#5c626b] transition hover:bg-black/5 hover:text-[#30343a]" aria-label={isSidebarVisible ? "隐藏左侧栏" : "显示左侧栏"} title={isSidebarVisible ? "隐藏左侧栏" : "显示左侧栏"}>
                  {isSidebarVisible ? <RiLayoutLeft2Line className="h-[22px] w-[22px]" aria-hidden="true" /> : <RiLayoutLeftLine className="h-[22px] w-[22px]" aria-hidden="true" />}
                </button>
                <div className="rounded-[16px] border border-[#e5e5e5] bg-white/90 px-8 py-7 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur">
                  <div className="text-[17px] font-semibold text-[#111111]">还没有工作流</div>
                  <div className="mt-2 text-[13px] text-[#8a8a8a]">先新建一个工作流，再添加文本和图片节点。</div>
                  <button type="button" onClick={startNewWorkflow} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#367cee] px-4 text-[13px] font-semibold text-white transition hover:bg-[#286fe0]">
                    <RiAddLine className="h-4 w-4" aria-hidden="true" /> 新建工作流
                  </button>
                </div>
              </div>
            )
          ) : isActiveSessionLoading ? (
            <div className="flex min-h-full items-center justify-center bg-white pb-20 pt-10 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="text-[13px] font-medium leading-none text-[#367cee]">加载中...{activeSessionLoadingProgress}%</div>
                <div className="h-1 w-[100px] overflow-hidden bg-[#dbe8ff]">
                  <div className="h-full bg-[#367cee] transition-[width] duration-300 ease-out" style={{ width: `${activeSessionLoadingProgress}%` }} />
                </div>
              </div>
            </div>
          ) : !hasConversation ? (
            <div className="flex min-h-full flex-col items-center justify-center pb-20 pt-10 text-center">
              <div className="mb-9 text-[28px] font-semibold tracking-[-0.03em] text-[#050505] sm:text-[32px]">hi~把你的闪念跟我聊一聊！</div>

              <div className="flex max-w-[900px] flex-col items-center gap-3 px-6">
                {quickActionRows.map((row, rowIndex) => (
                  <div key={rowIndex} className="flex flex-wrap items-center justify-center gap-2">
                    {row.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => {
                          setMode("agent");
                          void sendMessage(action.prompt, "agent");
                        }}
                        className="rounded-[12px] px-4 py-3 leading-none text-[#111111] transition hover:brightness-[0.98] hover:text-[#000000]"
                        style={{ backgroundColor: action.backgroundColor }}
                      >
                        <span style={{ fontSize: 13, lineHeight: 1 }}>{action.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[1006px] space-y-12">
              {activeSession?.messagesHasMore ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    disabled={loadingOlderMessageSessionIds.has(activeSession.id)}
                    onClick={() => void loadOlderMessages(activeSession.id)}
                    className="rounded-full border border-[#e5e5e5] bg-white px-4 py-2 text-[13px] font-medium text-[#8a8a8a] transition hover:border-[#d8d8d8] hover:bg-[#f7f7f7] hover:text-[#666666] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingOlderMessageSessionIds.has(activeSession.id) ? "加载中..." : "加载更早消息"}
                  </button>
                </div>
              ) : null}
              {messages.map((message, messageIndex) => {
                const isLegacyAgentErrorNotice = message.role === "assistant" && message.mode === "agent" && Boolean(message.error) && message.content === message.error;

                if (message.role === "system" || isLegacyAgentErrorNotice) {
                  const noticeMode = message.mode ?? "agent";
                  const modeNoticeContent = `${modeNoticeText[noticeMode].title}，${modeNoticeText[noticeMode].description}`;
                  const isErrorNotice = Boolean(message.error);
                  const isModeNotice = message.content === modeNoticeContent;
                  const isAutoReviewNotice = isBytePlusAutoReviewNotice(message.content);
                  const ModeIcon = isErrorNotice || !isModeNotice ? RiErrorWarningLine : modeOptions.find((option) => option.value === noticeMode)?.icon ?? RiRobot2Line;

                  return (
                    <div key={message.id} className={isErrorNotice || isAutoReviewNotice ? "flex justify-start" : "flex justify-start border-t border-[#eeeeee] pt-4"}>
                      <div className={isErrorNotice ? "inline-flex max-w-full items-start gap-2 text-rose-500" : isAutoReviewNotice ? "inline-flex max-w-full items-start gap-2 text-[#367cee]" : "inline-flex max-w-full items-start gap-2 text-[#9a9a9a]"}>
                        <ModeIcon className="mt-[3px] h-5 w-5 shrink-0" aria-hidden="true" />
                        <div className="text-[13px] leading-6">
                          {isErrorNotice ? (
                            <span>{message.error ?? message.content}</span>
                          ) : !isModeNotice ? (
                            <span>{message.content}</span>
                          ) : (
                            <>
                              <span className="font-semibold text-[#777777]">{modeNoticeText[noticeMode].title}</span>
                              <span>，{modeNoticeText[noticeMode].description}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                const lastMessage = messages[messages.length - 1];
                const activeSuggestionMessageId = lastMessage?.role === "assistant" && (lastMessage.mode === "agent" || isAgentGeneratedMedia(lastMessage)) ? lastMessage.id : "";
                const isAssistantMessageComplete = message.role !== "assistant" || message.mode === "image" || message.mode === "video" || !activeTypingMessageIds.has(message.id) || completedTypingMessageIds.has(message.id);
                const messageType = getMessageType(message);
                const reaction = messageReactions[message.id];
                const issueFeedback = messageIssueFeedback[message.id];
                const activeMessagePendingRequest = activePendingRequests.find((request) => request.id === message.requestId);
                const imagePendingCount = message.mode === "image" ? Math.max(0, message.pendingImageCount ?? 0) : 0;
                const slotFailedImageCount = message.imageResultSlots?.filter((slot) => slot.type === "failed").length ?? 0;
                const imageFailedCount = message.mode === "image" ? Math.max(0, message.failedImageCount ?? 0, slotFailedImageCount) : 0;
                const videoPendingCount = message.mode === "video" ? Math.max(0, message.pendingVideoCount ?? 0) : 0;
                const videoFailedCount = message.mode === "video" ? Math.max(0, message.failedVideoCount ?? 0) : 0;
                const allImageFailuresRetrying = message.mode === "image" && imageFailedCount > 0 && (message.retryingFailedImageIndexes?.length ?? 0) >= imageFailedCount;
                const allVideoFailuresRetrying = message.mode === "video" && videoFailedCount > 0 && (message.retryingFailedVideoIndexes?.length ?? 0) >= videoFailedCount;
                const normalizedMediaErrorReasons = (message.mediaErrorReasons ?? []).map((reason) => normalizeMediaErrorText(reason, message.mode)).filter((reason): reason is string => Boolean(reason));
                const mediaErrorReasonCount = normalizedMediaErrorReasons.length;
                const preferredMediaErrorIndex = Math.max(0, normalizedMediaErrorReasons.findIndex((reason) => !isGenericMediaReason(reason)));
                const selectedMediaErrorIndex = mediaErrorReasonCount > 0 ? Math.min(mediaErrorPageIndexes[message.id] ?? preferredMediaErrorIndex, mediaErrorReasonCount - 1) : 0;
                const mediaErrorText = allImageFailuresRetrying || allVideoFailuresRetrying ? undefined : normalizedMediaErrorReasons[selectedMediaErrorIndex] ?? normalizeMediaErrorText(message.error, message.mode) ?? (message.mode === "image" && imagePendingCount === 0 && imageFailedCount > 0 ? GENERIC_MEDIA_ERROR_MESSAGE : message.mode === "video" && videoPendingCount === 0 && videoFailedCount > 0 ? GENERIC_MEDIA_ERROR_MESSAGE : undefined);
                const isActiveVideoPending = activeMessagePendingRequest?.mode === "video" && videoPendingCount > 0 && !message.error;
                const isActiveImagePending = activeMessagePendingRequest?.mode === "image" && imagePendingCount > 0;
                const isActiveMediaPending = isActiveVideoPending || isActiveImagePending;
                const userImageReferences = message.role === "user" ? getDisplayImageReferences(message) : undefined;
                const previousUserMessageForMedia = message.role === "assistant" ? [...messages.slice(0, messageIndex)].reverse().find((item) => item.role === "user") : undefined;
                const isAgentMediaMessage = message.role === "assistant" && isAgentGeneratedMedia(message);
                const mediaPromptReferences = message.role === "assistant" && (message.mode === "image" || message.mode === "video") ? (message.imageReferences?.length ? message.imageReferences : getOrderedExplicitImageReferences(message.content, assets, [], activeConversationImageReferences)) : undefined;
                const imageVariantGroups = message.role === "assistant" && message.mode === "image" && !isAgentMediaMessage ? getImageVariantPages(message) : [];
                const imageVariantCount = imageVariantGroups.length;
                const selectedImageVariantIndex = imageVariantCount > 0 ? Math.min(imageVariantIndexes[message.id] ?? 0, imageVariantCount - 1) : 0;
                const selectedImageVariant = imageVariantGroups[selectedImageVariantIndex];
                const displayImageResultSlots = getDisplayImageResultSlotsForMessage(message);
                const hasDisplayedImageResultSlots = (displayImageResultSlots?.length ?? 0) > 0;
                const displayedMessageImages = isAgentMediaMessage ? getDisplayImagesForMessage(message) : selectedImageVariant?.images ?? getDisplayImagesForMessage(message);
                const displayedImageResultSlots = displayImageResultSlots;
                const showImageStatusOnCurrentPage = selectedImageVariantIndex === 0 || imageVariantCount === 0;
                const displayedPendingImageCount = showImageStatusOnCurrentPage && !displayedImageResultSlots ? imagePendingCount : 0;
                const displayedFailedImageCount = showImageStatusOnCurrentPage ? imageFailedCount : 0;
                const displayedMessageVideos = getMessageVideos(message);
                const userMediaReferences = message.role === "user" ? getUploadedMediaReferences(message.uploadedFiles) : [];
                const mediaPromptFileReferences = message.role === "assistant" && (message.mode === "image" || message.mode === "video") ? getUploadedMediaReferences(message.uploadedFiles?.length ? message.uploadedFiles : previousUserMessageForMedia?.uploadedFiles) : [];
                const documentUploadedFiles = getDocumentOnlyUploadedFiles(message.uploadedFiles);
                const agentPromptItems = isAgentMediaMessage ? getAgentMediaPromptItems(message) : [];
                const agentPromptPageIndex = Math.min(agentPromptPageIndexes[message.id] ?? 0, Math.max(0, agentPromptItems.length - 1));
                const setImageVariantIndex = (nextIndex: number) => {
                  if (imageVariantCount <= 1) return;
                  setImageVariantIndexes((current) => ({
                    ...current,
                    [message.id]: (nextIndex + imageVariantCount) % imageVariantCount,
                  }));
                };
                const setAgentPromptPageIndex = (nextIndex: number) => {
                  if (agentPromptItems.length <= 1) return;
                  setAgentPromptPageIndexes((current) => ({ ...current, [message.id]: (nextIndex + agentPromptItems.length) % agentPromptItems.length }));
                };
                const setMediaErrorPageIndex = (nextIndex: number) => {
                  if (mediaErrorReasonCount <= 1) return;
                  setMediaErrorPageIndexes((current) => ({ ...current, [message.id]: (nextIndex + mediaErrorReasonCount) % mediaErrorReasonCount }));
                };

                return (
                <div key={message.id} className={message.role === "user" ? "group flex justify-end" : "flex justify-start"}>
                  <div className={message.role === "user" ? "max-w-[92%]" : isAgentMediaMessage ? "flex w-full max-w-full" : "flex max-w-full"}>
                    {false && message.role === "assistant" ? (
                      <div className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e5ddff] bg-[#f1ecff] text-[#6d4aff]">
                        <RiStarSmileLine className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                    ) : null}
                    <div className={message.role === "user" ? "flex min-w-0 flex-col items-end" : isAgentMediaMessage ? "min-w-0 w-full" : "min-w-0"}>
                    {message.role !== "user" || message.content.trim() ? (
                      <>
                      <div
                        className={
                          message.role === "user"
                            ? "inline-block max-w-full rounded-xl bg-[#f4f4f4] px-5 py-3 text-sm leading-7 text-[#111111]"
                            : message.mode === "image" || message.mode === "video"
                              ? "px-0 py-1 text-sm leading-7 text-[#111111]"
                              : "px-0 py-1 text-sm leading-7 text-[#111111]"
                        }
                      >
                        {message.role === "assistant" ? (
                        message.mode === "agent" || message.mode === "general" || isAgentMediaMessage ? (
                          isAgentMediaMessage ? <><InlineAssistantIcon message={message} activated={isAgentActivationMessage(message.content)} provider={message.textModel ? generalModelProviders[message.textModel] : undefined} /><ReferencedTextContent content={message.content} references={mediaPromptReferences} /></> : <TypewriterFormattedMessage messageId={message.id} content={message.content} isComplete={isAssistantMessageComplete} onComplete={markTypingComplete} onTick={keepTypingInPlace} leadingIcon={<InlineAssistantIcon message={message} activated={isAgentActivationMessage(message.content)} provider={message.textModel ? generalModelProviders[message.textModel] : undefined} />} />
                        ) : message.mode === "image" || message.mode === "video" ? <MediaPromptBlock message={message} references={mediaPromptReferences} mediaReferences={mediaPromptFileReferences} onPreviewMedia={(file) => {
                          const previewMedia = getUploadedFilePreviewAsset(file);
                          if (!previewMedia) return;
                          setPreviewDocumentFile(null);
                          setPreviewAsset(previewMedia);
                        }} onUsePrompt={(item) => void copyPrompt(item)} copyState={copyFeedback?.messageId === message.id ? copyFeedback.state : undefined} displayImageUrl={displayedMessageImages[0]} variantIndex={selectedImageVariantIndex} variantCount={imageVariantCount} onPreviousVariant={() => setImageVariantIndex(selectedImageVariantIndex - 1)} onNextVariant={() => setImageVariantIndex(selectedImageVariantIndex + 1)} /> : <TypewriterFormattedMessage messageId={message.id} content={message.content} isComplete={isAssistantMessageComplete} onComplete={markTypingComplete} onTick={keepTypingAtBottom} />
                        ) : (
                        <UserMessageContent content={message.content} references={userImageReferences} mediaReferences={userMediaReferences} onPreviewMedia={(file) => {
                          const previewMedia = getUploadedFilePreviewAsset(file);
                          if (!previewMedia) return;
                          setPreviewDocumentFile(null);
                          setPreviewAsset(previewMedia);
                        }} />
                        )}
                      </div>
                      {message.role === "user" && message.content.trim() ? (
                        <div className="mt-1 flex items-center justify-end gap-2 text-[12px] text-[#b0b0b0] opacity-0 transition-opacity group-hover:opacity-100">
                          <span>{formatMessageTime(message.createdAt)}</span>
                          <button
                            type="button"
                            onClick={() => void copyUserMessageText(message)}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-[6px] text-[#9a9a9a] transition hover:bg-[#f2f2f2] hover:text-[#555555]"
                            aria-label="复制用户消息"
                          >
                            {copyFeedback?.messageId === message.id && copyFeedback.state === "success" ? <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" /> : <RiCheckboxMultipleBlankLine className="h-3.5 w-3.5" aria-hidden="true" />}
                          </button>
                        </div>
                      ) : null}
                      </>
                    ) : null}

                    {message.role === "user" ? (
                      <>
                        <UploadedDocumentStrip files={documentUploadedFiles} onPreview={(file) => {
                          const previewMedia = getUploadedFilePreviewAsset(file);
                          if (previewMedia) {
                            setPreviewDocumentFile(null);
                            setPreviewAsset(previewMedia);
                          } else if (isUploadedMediaFile(file)) {
                            showInputTip("文件上传中");
                          } else {
                            setPreviewDocumentFile(file);
                          }
                        }} />
                        <ReferenceThumbnailStrip references={userImageReferences} onUseReference={(reference) => {
                          if (activeUploadedImages.length >= currentMaxReferenceImages && !activeUploadedImages.some((image) => image.url === reference.url)) {
                            showInputTip(`当前模型最多支持 ${currentMaxReferenceImages} 张参考图，不能上传更多图片`);
                            return;
                          }

                          const cursor = Math.min(Math.max(0, draftCursorOffset), activeInput.length);
                          addActiveUploadedImages([{ id: createClientId(), name: reference.name, referenceName: reference.name, url: reference.url, source: "asset" }], { draftBase: activeInput.slice(0, cursor), draftSuffix: activeInput.slice(cursor), insertReferenceText: true });
                          focusEditorAt(cursor + reference.name.length + 2);
                        }} />
                      </>
                    ) : null}

                    {isAgentMediaMessage && (message.mode === "image" || message.mode === "video") ? (
                      <AgentMediaPromptPanel
                        items={agentPromptItems}
                        pageIndex={agentPromptPageIndex}
                        expanded={Boolean(agentPromptExpandedIds[message.id])}
                        onToggle={() => setAgentPromptExpandedIds((current) => ({ ...current, [message.id]: !current[message.id] }))}
                        onUsePrompt={(prompt) => {
                          setActiveDraftInput(prompt);
                          requestAnimationFrame(() => editorRef.current?.focus());
                        }}
                        onPrevious={() => setAgentPromptPageIndex(agentPromptPageIndex - 1)}
                        onNext={() => setAgentPromptPageIndex(agentPromptPageIndex + 1)}
                      />
                    ) : null}

                      {message.role === "assistant" && message.mode === "image" && isAssistantMessageComplete && ((message.images?.length ?? 0) > 0 || hasDisplayedImageResultSlots || imagePendingCount > 0 || imageFailedCount > 0) ? (
                         <LazyMediaMount height={250} className="mt-2">
                             {displayedImageResultSlots ? (
                               <ImageResultSlotStrip slots={displayedImageResultSlots} imageIndexes={selectedImageVariant?.imageIndexes} pendingCount={displayedPendingImageCount} createdAt={message.createdAt} now={timerNow} rounded={isAgentMediaMessage} isRetrying={activeMessagePendingRequest?.mode === "image"} onRetryFailed={(failedIndex) => retryFailedMedia(message, failedIndex)} onLoadedDimensions={(url, dimensions) => updateMessageImageDimensions(activeSession?.id ?? "", message.id, url, dimensions)} onPreview={(url, imageIndex) => setPreviewAsset({ id: `${message.id}-${imageIndex}`, type: "other", name: getCanonicalMediaName(message, url, `生成图片${imageIndex + 1}`), url, sourcePrompt: getImageSourcePrompt(message, url), previewMeta: getPreviewMediaMeta(message, url), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                             ) : (
                               <ImageResultStrip images={displayedMessageImages} imageIndexes={selectedImageVariant?.imageIndexes} pendingCount={displayedPendingImageCount} failedCount={displayedFailedImageCount} retryingFailedIndexes={message.retryingFailedImageIndexes} retryingFailedStartedAt={message.retryingFailedImageStartedAt} createdAt={message.createdAt} now={timerNow} rounded={isAgentMediaMessage} onRetryFailed={(failedIndex) => retryFailedMedia(message, failedIndex)} onLoadedDimensions={(url, dimensions) => updateMessageImageDimensions(activeSession?.id ?? "", message.id, url, dimensions)} onPreview={(url, imageIndex) => setPreviewAsset({ id: `${message.id}-${imageIndex}`, type: "other", name: getCanonicalMediaName(message, url, `生成图片${imageIndex + 1}`), url, sourcePrompt: getImageSourcePrompt(message, url), previewMeta: getPreviewMediaMeta(message, url), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                             )}
                          </LazyMediaMount>
                        ) : null}

                      {message.role === "assistant" && message.mode === "video" && isAssistantMessageComplete && (displayedMessageVideos.length > 0 || videoFailedCount > 0 || (isActiveVideoPending && videoPendingCount > 0)) ? (
                        <LazyMediaMount height={360} className={isAgentMediaMessage ? "mt-2 grid w-full max-w-[1006px] grid-cols-2 gap-0.5" : "mt-2 flex max-w-full flex-wrap gap-0.5"}>
                           {displayedMessageVideos.map((url, videoIndex) => (
                             <div key={`${url}-${videoIndex}`} className="contents">
                               <InlineVideoResult url={url} posterUrl={getVideoPosterForMessage(message, url)} rounded={isAgentMediaMessage} compact={isAgentMediaMessage} onLoadedDimensions={(dimensions) => updateMessageVideoDimensions(activeSession?.id ?? "", message.id, dimensions)} onPreview={() => setPreviewAsset({ id: `${message.id}-video-${videoIndex}`, type: "shot_video", name: getCanonicalMediaName(message, url, `生成视频${videoIndex + 1}`), url, posterUrl: getVideoPosterForMessage(message, url), sourcePrompt: message.videoPrompts?.[url] ?? message.generationMeta?.itemPrompts?.[videoIndex] ?? message.generationMeta?.originalPrompt ?? message.content, previewMeta: getPreviewMediaMeta(message), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                             </div>
                            ))}
                          {Array.from({ length: isActiveVideoPending ? videoPendingCount : 0 }).map((_, pendingIndex) => (
                            <MediaWaitingCard key={`video-pending-${pendingIndex}`} createdAt={message.createdAt} now={timerNow} isImage={false} index={videoPendingCount > 1 ? displayedMessageVideos.length + pendingIndex + 1 : undefined} rounded={isAgentMediaMessage} compactVideo={isAgentMediaMessage} />
                          ))}
                           {Array.from({ length: videoFailedCount }).map((_, failedIndex) => (
                            message.retryingFailedVideoIndexes?.includes(failedIndex) ? (
                              <MediaWaitingCard key={`video-retrying-failed-${failedIndex}`} createdAt={message.retryingFailedVideoStartedAt?.[failedIndex] ?? message.createdAt} now={timerNow} isImage={false} index={displayedMessageVideos.length + videoPendingCount + failedIndex + 1} rounded={isAgentMediaMessage} compactVideo={isAgentMediaMessage} />
                            ) : (
                              <VideoFailedCard key={`video-failed-${failedIndex}`} rounded={isAgentMediaMessage} compact={isAgentMediaMessage} onRetry={() => retryFailedMedia(message, failedIndex)} />
                            )
                          ))}
                        </LazyMediaMount>
                      ) : null}

                    {message.statusText && message.mode !== "video" && message.mode !== "image" && isAssistantMessageComplete ? (
                      isActiveMediaPending ? (
                        <div className={isActiveImagePending ? "mt-3 flex max-w-full flex-nowrap gap-0.5 overflow-x-auto pb-1" : "mt-3 grid max-w-full grid-cols-2 gap-0.5 pb-1"}>
                          {Array.from({ length: isActiveImagePending ? getImageCountValue(String(message.pendingImageCount ?? 1)) : Math.max(1, videoPendingCount) }).map((_, pendingIndex) => (
                            <MediaWaitingCard key={pendingIndex} createdAt={message.createdAt} now={timerNow} isImage={isActiveImagePending} index={(isActiveImagePending && (message.pendingImageCount ?? 1) > 1) || (!isActiveImagePending && videoPendingCount > 1) ? pendingIndex + 1 : undefined} rounded={isAgentMediaMessage} compactVideo={isAgentMediaMessage && !isActiveImagePending} />
                          ))}
                        </div>
                      ) : (
                      <div className="relative mt-3 h-[220px] w-[220px] max-w-full overflow-hidden rounded-xl border border-[#dceefa] bg-[#eaf7ff] text-sm text-[#4f6f86]">
                        {isActiveMediaPending ? (
                          <>
                            <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),radial-gradient(circle_at_86%_82%,rgba(174,247,241,0.5),transparent_31%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
                            <div className="absolute -left-20 top-8 h-48 w-48 animate-[yinzaoBlobOne_4.5s_ease-in-out_infinite] rounded-full bg-[#b8c8ff]/45 blur-3xl" />
                            <div className="absolute -right-16 bottom-10 h-56 w-56 animate-[yinzaoBlobTwo_6s_ease-in-out_infinite] rounded-full bg-[#9eeef0]/50 blur-3xl" />
                            <div className="absolute left-20 top-48 h-40 w-40 animate-[yinzaoBlobThree_5.5s_ease-in-out_infinite] rounded-full bg-[#b5e0ff]/55 blur-3xl" />
                            <div className="absolute inset-0 animate-[yinzaoVideoShimmer_2.8s_ease-in-out_infinite] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.22),transparent_28%)]" />
                            <div className="relative z-10 ml-3 mt-3 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">
                              {getVideoWaitProgress(message.createdAt, timerNow)}%{isActiveImagePending ? "生成中" : "渲染中"}
                            </div>
                            <div className="absolute bottom-4 left-5 z-10 text-xs text-[#4f6f86]">
                              {message.statusText}
                              <InlineLoadingDots />
                              <div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(message.createdAt, timerNow)}</div>
                            </div>
                          </>
                        ) : (
                          <div className="p-5">
                            {message.statusText}
                          </div>
                        )}
                      </div>
                      )
                    ) : null}

                    {mediaErrorText && isAssistantMessageComplete ? (
                      <div className="mt-3 text-sm text-rose-500">
                        {mediaErrorReasonCount > 1 ? (
                          <div className="mb-1 flex items-center gap-1 text-[12px] leading-5 text-rose-400">
                            <button type="button" onClick={() => setMediaErrorPageIndex(selectedMediaErrorIndex - 1)} className="rounded px-1 leading-5 transition hover:bg-rose-50 hover:text-rose-500" aria-label="上一条失败原因">&lt;</button>
                            <span>{selectedMediaErrorIndex + 1}/{mediaErrorReasonCount}</span>
                            <button type="button" onClick={() => setMediaErrorPageIndex(selectedMediaErrorIndex + 1)} className="rounded px-1 leading-5 transition hover:bg-rose-50 hover:text-rose-500" aria-label="下一条失败原因">&gt;</button>
                          </div>
                        ) : null}
                        <div>{mediaErrorText}</div>
                      </div>
                    ) : null}
                    {message.role === "assistant" && isAssistantMessageComplete ? (
                      <>
                        <div className={message.mode === "image" || message.mode === "video" ? "mt-2 flex flex-wrap items-center gap-1.5" : "mt-3 flex flex-wrap items-center gap-1.5"}>
                          {(message.mode === "agent" || message.mode === "general") && messageType === "text" ? (
                            <FeedbackButton label={copyFeedback?.messageId === message.id ? (copyFeedback.state === "success" ? "已复制" : "无法复制") : "复制"} state={copyFeedback?.messageId === message.id ? copyFeedback.state : "idle"} onClick={() => void copyMessage(message)}>
                              <RiCheckboxMultipleBlankLine className="h-4.5 w-4.5" aria-hidden="true" />
                            </FeedbackButton>
                          ) : null}
                          <FeedbackButton label="重新生成" onClick={() => regenerateMessage(message)}>
                            <RiRefreshLine className="h-4.5 w-4.5" aria-hidden="true" />
                          </FeedbackButton>
                          {reaction !== "dislike" ? (
                            <FeedbackButton label={reaction === "like" ? "取消喜欢" : "喜欢"} onClick={() => toggleReaction("like", message)}>
                              {reaction === "like" ? <RiThumbUpFill className="h-4.5 w-4.5" aria-hidden="true" /> : <RiThumbUpLine className="h-4.5 w-4.5" aria-hidden="true" />}
                            </FeedbackButton>
                          ) : null}
                          {reaction !== "like" ? (
                            <FeedbackButton label={reaction === "dislike" ? "取消不喜欢" : "不喜欢"} onClick={() => toggleReaction("dislike", message)}>
                              {reaction === "dislike" ? <RiThumbDownFill className="h-4.5 w-4.5" aria-hidden="true" /> : <RiThumbDownLine className="h-4.5 w-4.5" aria-hidden="true" />}
                            </FeedbackButton>
                          ) : null}
                          {messageType === "text" ? (
                            <FeedbackButton label={issueFeedback === "wrong" ? "取消回答不对" : "回答不对"} onClick={() => toggleIssueFeedback("wrong", message)}>
                              {issueFeedback === "wrong" ? <ActiveMessageCircleXIcon /> : <RiChatDeleteLine className="h-5 w-5" aria-hidden="true" />}
                            </FeedbackButton>
                          ) : null}
                          {messageType !== "text" ? (
                            <FeedbackButton label={issueFeedback === "wrong_mode" ? "取消模式反馈" : "要图给视频或要视频给图"} onClick={() => toggleIssueFeedback("wrong_mode", message)}>
                              {issueFeedback === "wrong_mode" ? <ActiveAngryIcon /> : <RiEmotionUnhappyLine className="h-5 w-5" aria-hidden="true" />}
                            </FeedbackButton>
                          ) : null}
                          <div className="relative" onClick={(event) => event.stopPropagation()}>
                            <FeedbackButton label="更多" onClick={() => { const shouldClose = openMessageMenuId === message.id; closeAllPopupMenus(); if (!shouldClose) setOpenMessageMenuId(message.id); }}>
                              <RiMoreLine className="h-4.5 w-4.5" aria-hidden="true" />
                            </FeedbackButton>

                            {openMessageMenuId === message.id ? (
                              <div className="absolute bottom-9 left-0 z-40 w-36 rounded-xl border border-slate-100 bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.12)]">
                                <button type="button" onClick={() => void copyMessageTextOnly(message)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-slate-900 hover:bg-slate-50">
                                  <RiCheckboxMultipleBlankLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                                  <span>复制文字</span>
                                </button>
                                <button type="button" onClick={() => deleteAssistantMessage(message.id)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-red-500 hover:bg-red-50">
                                  <RiDeleteBinLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                                  <span>删除</span>
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <span className="flashmuse-feedback-meta ml-[10px] text-[12px] leading-8 text-[#b0b0b0]">感谢反馈 {formatMessageTime(message.createdAt)}</span>
                        </div>
                        {message.id === activeSuggestionMessageId ? <SuggestionButtons suggestions={message.suggestions} onSelect={(suggestion) => void sendMessage(suggestion, "agent")} /> : null}
                      </>
                    ) : null}
                    </div>
                  </div>
                </div>
                );
              })}
              {isThinking ? <ThinkingIndicator /> : null}
              <div className="h-[360px]" ref={messageEndRef} />
            </div>
          )}
          </div>

          {activePanel === "chat" ? <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-transparent px-4 pb-3 sm:px-6 lg:px-8">
          {inputReminder ? (
            <div className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-3 -translate-x-1/2">
              <ReminderToast reminder={inputReminder} />
            </div>
          ) : null}
          {showScrollToBottom ? (
            <button
              type="button"
              onClick={scrollToBottom}
              className="pointer-events-auto relative z-40 mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#d9d9d9] bg-white text-[#6f6f6f] shadow-[0_8px_18px_rgba(0,0,0,0.10)] transition hover:text-[#111111]"
              aria-label="定位到最新对话"
            >
              <RiArrowDownWideLine className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          <div onClick={() => closeInputMenus()} style={{ width: inputShellWidth }} className="pointer-events-auto relative z-10 mx-auto w-full max-w-[calc(100vw-32px)] rounded-[26px] border-0 bg-transparent px-0 py-0 transition min-[840px]:min-w-[800px]">
            {!isThinking && (activeInput || activeUploadedImages.length > 0 || activeUploadedFiles.length > 0) ? (
              <div className="absolute -top-7 right-12 z-10 flex items-center gap-4">
                {(mode === "image" || mode === "video") && activeInput.trim() ? (
                  <button
                    type="button"
                    disabled={isInputPromptOptimizing}
                    onClick={(event) => {
                      event.stopPropagation();
                      void optimizeActivePrompt();
                    }}
                    className="inline-flex items-center gap-1 bg-transparent px-0 py-0 font-medium leading-none text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label="优化提示词"
                  >
                    <RiQuillPenAiLine className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-[11px] leading-none">{isInputPromptOptimizing ? "优化中" : "优化提示词"}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={isInputPromptOptimizing}
                  onClick={(event) => {
                    event.stopPropagation();
                    clearActiveInput();
                  }}
                  className="inline-flex items-center gap-1 bg-transparent px-0 py-0 font-medium leading-none text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="清空输入框"
                >
                  <RiFormatClear className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-[11px] leading-none">清空输入框</span>
                </button>
              </div>
            ) : null}
            <div className={`relative z-20 rounded-[26px] border-2 border-[#f1f2f2] bg-white/78 px-4 py-3 shadow-none backdrop-blur-[18px] transition focus-within:border-white/70 focus-within:shadow-[0_10px_32px_rgba(0,0,0,0.12)] ${isMainInputDisabled ? "border-[#f4f4f4] bg-white/54" : ""}`}>
            <div className={isMainInputDisabled ? "pointer-events-none opacity-45 grayscale-[0.15] transition" : "transition"}>
            {activeUploadedImages.length > 0 || activeUploadedFiles.length > 0 ? (
              <div className="mb-3 space-y-2 px-2">
                {activeUploadedFiles.length > 0 ? (
                  <div className="relative">
                  {canScrollUploadedFiles.left ? (
                    <button type="button" onClick={() => scrollUploadedRow("files", -1)} className="absolute left-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#777777] shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:text-[#111111]" aria-label="向左查看文件">
                      <RiArrowLeftSLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  ) : null}
                  {canScrollUploadedFiles.left ? <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-[5] w-9 bg-gradient-to-r from-white/95 to-transparent" /> : null}
                  <div ref={uploadedFilesRowRef} onScroll={updateUploadedRowScrollState} className="yinzao-upload-row-scroll flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden scroll-smooth px-0.5">
                    {activeUploadedFiles.map((file, index) => {
                      const displayName = getUploadedFileDisplayName(file);
                      const meta = getUploadedDocumentMeta(displayName);
                      const sizeText = formatUploadedFileSize(file);
                      const mediaKind = getUploadedFileMediaKind(file);
                      const progress = typeof file === "string" ? 0 : Math.min(100, Math.max(0, Math.floor(file.progress ?? 0)));
                      const uploadProgress = typeof file === "string" ? 0 : Math.min(100, Math.max(0, Math.floor(file.uploadProgress ?? 0)));
                      const isUploading = typeof file !== "string" && file.uploadStatus === "uploading";
                      const durationText = typeof file !== "string" ? getMediaDurationLabel(file.durationSeconds) : "";
                      const isMediaFile = isUploadedMediaFile(file);
                      const canPreviewMediaFile = Boolean(getUploadedFilePreviewAsset(file));

                      return (
                        <div key={`${getUploadedFileKey(file)}-${index}`} onClick={() => {
                          if (isMediaFile) {
                            if (!canPreviewMediaFile) {
                              showInputTip("文件上传中");
                              return;
                            }
                            insertTextAtDraftCursor(`@${displayName} `);
                            return;
                          }
                          setPreviewDocumentFile(file);
                        }} className="relative flex h-[54px] w-[200px] shrink-0 cursor-pointer items-center gap-3 overflow-hidden rounded-[10px] bg-[#f2f2f2] px-4 transition hover:bg-[#ececec]">
                          <button
                            type="button"
                            disabled={isMainInputDisabled}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeActiveUploadedFile(index);
                            }}
                            className="absolute right-1 top-1 z-30 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/55 disabled:pointer-events-none disabled:opacity-40"
                            aria-label="移除文件"
                          >
                            <RiCloseLine className="h-3 w-3" aria-hidden="true" />
                          </button>
                          {isMediaFile ? (
                            <button
                              type="button"
                              disabled={isMainInputDisabled || !canPreviewMediaFile}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (!canPreviewMediaFile) {
                                  showInputTip("文件上传中");
                                  return;
                                }
                                insertTextAtDraftCursor(`@${displayName} `);
                              }}
                              className="absolute bottom-1 right-1 z-30 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-[4px] bg-black/45 px-1 text-[10px] font-medium leading-none text-white transition hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`引用${displayName}`}
                            >
                              @
                            </button>
                          ) : null}
                          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[3px] border-2 text-[15px] font-bold leading-none" style={{ backgroundColor: meta.bg, borderColor: meta.border, color: meta.color }}>
                            {mediaKind === "video" ? <RiVideoLine className="h-4 w-4" aria-hidden="true" /> : mediaKind === "audio" ? <RiMusic2Line className="h-4 w-4" aria-hidden="true" /> : meta.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium leading-4 text-[#222222]">{displayName}</div>
                            <div className="mt-0.5 truncate text-[11px] leading-4 text-[#9a9a9a]">{meta.label}{sizeText ? ` · ${sizeText}` : ""}{durationText ? ` · ${durationText}` : ""}</div>
                          </div>
                          {isUploading ? <UploadProgressOverlay progress={uploadProgress} /> : null}
                          {!isUploading && typeof file !== "string" && file.status === "reading" ? <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black/8"><div className="h-full bg-[#367cee] transition-all" style={{ width: `${progress}%` }} /></div> : null}
                        </div>
                      );
                    })}
                  </div>
                  {canScrollUploadedFiles.right ? (
                    <button type="button" onClick={() => scrollUploadedRow("files", 1)} className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#777777] shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:text-[#111111]" aria-label="向右查看文件">
                      <RiArrowRightSLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  ) : null}
                  {canScrollUploadedFiles.right ? <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-[5] w-9 bg-gradient-to-l from-white/95 to-transparent" /> : null}
                  </div>
                ) : null}
                {activeUploadedImages.length > 0 ? (
                  <div className="relative">
                  {canScrollUploadedImages.left ? (
                    <button type="button" onClick={() => scrollUploadedRow("images", -1)} className="absolute left-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#777777] shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:text-[#111111]" aria-label="向左查看图片">
                      <RiArrowLeftSLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  ) : null}
                  {canScrollUploadedImages.left ? <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-[5] w-10 bg-gradient-to-r from-white/95 to-transparent" /> : null}
                  <div ref={uploadedImagesRowRef} onScroll={updateUploadedRowScrollState} className="yinzao-upload-row-scroll flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden scroll-smooth px-0.5">
                    {activeUploadedImages.map((image) => {
                      const isUploading = image.uploadStatus === "uploading";
                      const uploadProgress = Math.min(100, Math.max(0, Math.floor(image.uploadProgress ?? 0)));
                      const previewUrl = image.previewUrl ?? getMediaThumbnailUrl(image.url);

                      return (
                      <div key={image.id} className="group relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]">
                          <HoverImagePreview src={previewUrl} alt={image.name} wrapperClassName="block h-full w-full">
                            <Image src={previewUrl} alt={image.name} width={100} height={100} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                          </HoverImagePreview>
                        <button
                          type="button"
                          disabled={isMainInputDisabled}
                          onClick={() => removeActiveUploadedImage(image.id)}
                          className="absolute right-1 top-1 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                          aria-label="移除图片"
                        >
                          <RiCloseLine className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={isMainInputDisabled}
                          onClick={() => {
                            insertTextAtDraftCursor(`@${getUploadedImageReferenceName(image, activeUploadedImages)} `);
                          }}
                          className="absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-2 text-left font-medium leading-4 text-white transition"
                        >
                          <span className="text-[10px] leading-4">@{getUploadedImageReferenceName(image, activeUploadedImages)}</span>
                        </button>
                        {isUploading ? <UploadProgressOverlay progress={uploadProgress} /> : null}
                        {image.uploadStatus === "error" ? (
                          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 bg-black/58 px-2 text-center text-[13px] font-semibold leading-4 text-white">
                            <span>上传失败</span>
                            {image.uploadFile ? (
                              <button type="button" onClick={() => retryInputImageUpload(image.id)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#75a7ff] transition hover:text-[#a9c8ff]">
                                <RiRefreshLine className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>重试</span>
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      );
                    })}
                  </div>
                  {canScrollUploadedImages.right ? (
                    <button type="button" onClick={() => scrollUploadedRow("images", 1)} className="absolute right-0 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#777777] shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:text-[#111111]" aria-label="向右查看图片">
                      <RiArrowRightSLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  ) : null}
                  {canScrollUploadedImages.right ? <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-[5] w-10 bg-gradient-to-l from-white/95 to-transparent" /> : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="relative">
              {!activeInput ? (
                <div className="pointer-events-none absolute left-2 top-1 z-20 flex items-center text-[14px] leading-6 text-[#b3b3b3]">
                  <span>输入文字，上传图片或</span>
                    <button
                      type="button"
                      disabled={isMainInputDisabled}
                      className="pointer-events-auto inline-flex items-center px-0.5 text-[#367cee] transition hover:text-[#367cee]"
                      onClick={(event) => {
                        event.stopPropagation();
                        openMentionAssetMenu();
                    }}
                    >
                      <RiAtLine className="h-4 w-4" aria-hidden="true" />
                    </button>
                  <span>资产，描述生成内容...</span>
                </div>
              ) : null}
              {isAtAssetMenuOpen && (hasAtAssetOptions || assetsLoadStatus === "loading") ? (
                <div onClick={(event) => event.stopPropagation()} className="absolute bottom-full left-2 z-50 mb-4 max-h-80 w-[380px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
                  <div className="px-2 pb-2 text-[12px] text-[#8a8a8a]">引用资产</div>
                  {assetsLoadStatus === "loading" ? <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] font-medium text-[#367cee]"><LoadingSpinner size={18} /><span>加载中...</span></div> : null}
                  {assetsLoadStatus !== "loading" ? <>
                  <div className="mb-2 flex flex-nowrap gap-1.5 px-1">
                    {atAssetGroups.map((group) => {
                      const count = group.assets.length;
                      const isActive = activeAtAssetGroup?.type === group.type;

                      return (
                        <button
                          key={group.type}
                          type="button"
                          disabled={count === 0}
                          onClick={() => setAtAssetFilter(group.type)}
                            className={isActive ? "h-7 shrink-0 whitespace-nowrap rounded-[8px] bg-[#111111] px-2 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40" : "h-7 shrink-0 whitespace-nowrap rounded-[8px] bg-[#f4f4f4] px-2 text-[12px] font-medium text-[#666666] transition hover:bg-[#ececec] disabled:cursor-not-allowed disabled:opacity-40"}
                        >
                          <span className="whitespace-nowrap text-[12px] leading-none">{mentionAssetTypeLabels[group.type]}({count})</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeAtAssetGroup?.assets.map((asset) => (
                    <button key={asset.id} type="button" onClick={() => insertAssetReference(asset)} className="flex h-12 w-full items-center gap-3 rounded-[8px] px-2 text-left transition hover:bg-[#f5f5f5]">
                      <div className="h-8 w-8 overflow-hidden rounded-[8px] bg-[#eeeeee]">
                        <HoverImagePreview src={asset.url} alt={asset.name} wrapperClassName="block h-full w-full">
                          <Image src={getMediaThumbnailUrl(asset.url)} alt={asset.name} width={32} height={32} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                        </HoverImagePreview>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#222222]">@{asset.name}</div>
                        <div className="text-[11px] text-[#999999]">{assetTypeLabels[asset.type]}</div>
                      </div>
                    </button>
                  ))}
                  </> : null}
                </div>
              ) : null}
              <PlainMentionEditor
                value={activeInput}
                disabled={isMainInputDisabled}
                validReferences={validReferenceNames}
                editorRef={editorRef}
                onChange={setActiveDraftInput}
                onPasteImages={(files) => void addFilesToInput(files)}
                onSubmit={() => void sendMessage()}
                onAtTrigger={() => {
                  openMentionAssetMenu();
                }}
                onAtClose={() => setIsAtAssetMenuOpen(false)}
                onLimit={() => showInputTip("最多输入2000字")}
                onCursorChange={setDraftCursorOffset}
              />
              </div>
            </div>
            <div className="mt-3 flex flex-nowrap items-center justify-between gap-3 pb-0.5">
              <div className={`flex ${mode === "general" ? "min-w-0 flex-1" : "min-w-max"} flex-nowrap items-center gap-2 text-[12px] transition ${isMainInputDisabled ? "pointer-events-none opacity-45 grayscale-[0.15]" : ""}`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadAcceptValue}
                  multiple
                  disabled={isMainInputDisabled}
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    void addFilesToInput(files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={isMainInputDisabled}
                  onClick={() => fileInputRef.current?.click()}
                  className="yinzao-tool-button yinzao-tool-button-round inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#777777] transition"
                  aria-label="上传图片"
                >
                  <RiAddLine className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="relative" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    disabled={isMainInputDisabled}
                    onClick={() => {
                      const shouldClose = openControlMenu === "mode";
                      closeAllPopupMenus();
                      if (!shouldClose) setOpenControlMenu("mode");
                    }}
                    className={`${toolButtonClassName} ${openControlMenu === "mode" ? toolButtonActiveClassName : ""}`}
                  >
                    <ToolButtonLabel icon={modeOptions.find((option) => option.value === mode)?.icon} label={modeOptions.find((option) => option.value === mode)?.label ?? "模式"} showChevron accent />
                  </button>

                  {openControlMenu === "mode" ? (
                    <div className="absolute bottom-full left-0 z-[70] mb-2 w-[220px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                      <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">创作类型</div>
                      {modeOptions.filter((option) => option.value !== "general" || currentUserGeneralModeEnabled).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (option.value === mode) {
                              setOpenControlMenu("");
                              return;
                            }

                            setMode(option.value);
                            setSessions((current) =>
                              current.map((session) =>
                                session.id === activeSessionId
                                  ? {
                                      ...session,
                                      updatedAt: Date.now(),
                                      messages: [
                                        ...session.messages,
                                        {
                                          id: createClientId(),
                                          role: "system",
                                          content: `${modeNoticeText[option.value].title}，${modeNoticeText[option.value].description}`,
                                          mode: option.value,
                                          createdAt: Date.now(),
                                        },
                                      ],
                                    }
                                  : session,
                              ),
                            );
                            setOpenControlMenu("");
                          }}
                          className={
                            option.value === mode
                              ? "my-[3px] flex h-12 w-full items-center justify-between whitespace-nowrap rounded-[12px] bg-[#eef4ff] px-3 text-left text-[16px] font-medium text-[#111111] ring-1 ring-[#d9e7ff]"
                              : "my-[3px] flex h-12 w-full items-center justify-between whitespace-nowrap rounded-[12px] px-3 text-left text-[16px] text-[#333333] hover:bg-[#f7f7f7]"
                          }
                        >
                          <span className="flex items-center gap-3">
                            <IconRenderer icon={option.icon} />
                            <span>{option.label}</span>
                          </span>
                          {option.value === mode ? <RiCheckLine className="h-[18px] w-[18px] text-[#111111]" aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  disabled={isMainInputDisabled}
                  onClick={(event) => {
                    event.stopPropagation();
                    openMentionAssetMenu();
                  }}
                  className={`yinzao-tool-button inline-flex h-9 shrink-0 items-center rounded-[8px] px-3.5 text-[#777777] outline-none transition ${isAtAssetMenuOpen ? toolButtonActiveClassName : ""}`}
                  aria-label="引用资产"
                >
                  <RiAtLine className="h-4.5 w-4.5 text-[#777777]" aria-hidden="true" />
                </button>

                {mode === "agent" ? (
                  <div className="yinzao-tool-button inline-flex h-9 shrink-0 items-center gap-0.5 rounded-[8px] p-0.5 text-[12px] text-[#777777]">
                    <button
                      type="button"
                      disabled={isMainInputDisabled}
                      onClick={() => switchAgentModelTier("normal")}
                      className={agentModelTier === "normal" ? "h-8 rounded-[7px] bg-white px-3 text-[12px] font-medium text-[#111111] shadow-sm" : "h-8 rounded-[7px] px-3 text-[12px] font-medium text-[#777777] transition hover:text-[#333333]"}
                    >
                      普通
                    </button>
                    <button
                      type="button"
                      disabled={isMainInputDisabled}
                      onClick={() => switchAgentModelTier("advanced")}
                      className={agentModelTier === "advanced" ? "h-8 rounded-[7px] bg-white px-3 text-[12px] font-medium text-[#111111] shadow-sm" : "h-8 rounded-[7px] px-3 text-[12px] font-medium text-[#777777] transition hover:text-[#333333]"}
                    >
                      高级
                    </button>
                  </div>
                ) : null}

                {mode === "general" ? (
                  <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
                    {renderGeneralModelMenu("chat", "选择对话模型")}
                    {renderGeneralModelMenu("image", "选择图片模型")}
                    {renderGeneralModelMenu("video", "选择视频模型")}
                  </div>
                ) : null}

                {mode !== "agent" && mode !== "general" ? (
                  <>
                    {renderModelMenu()}
                    {renderImageSettingsMenu()}
                    {mode === "image" ? renderControlMenu("imageCount", selectedImageCount, "同时生成数量", imageCountOptions, selectedImageCount, (value) => setSelectedImageCounts((current) => ({ ...current, [mode]: value })), RiImageAddLine) : null}
                    {mode === "video" ? renderControlMenu("duration", selectedVideoDuration, "视频时长", currentDurationOptions, selectedVideoDuration, (value) => setSelectedDurations((current) => ({ ...current, video: value })), RiTimeLine) : null}
                  </>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => isThinking ? stopAgentThinking() : void sendMessage()}
                disabled={!isThinking && (isInputPromptOptimizing || hasUploadingInputs || hasFailedUploadInputs || (mode !== "agent" && mode !== "general" && activeHasMaxPendingRequests) || activeIsSending || (!activeInput.trim() && activeUploadedImages.length === 0 && activeUploadedFiles.length === 0))}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#111111] text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white ${isThinking ? "yinzao-stop-shimmer" : ""}`}
                aria-label={isThinking ? "停止思考" : "发送"}
              >
                {isThinking ? <RiStopFill className="h-4 w-4" aria-hidden="true" /> : <RiArrowUpLine className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            </div>
            {isInputPromptOptimizing ? <PromptOptimizingOverlay /> : null}
          </div>
        </div> : null}

        </div>
      </section>

      {isAssetUploadOpen ? (
        <AssetUploadDialog
          slots={visibleAssetUploadSlots}
          activeIndex={activeAssetUploadIndex}
          isUploading={isAssetUploading}
          tip={assetUploadTip}
          onClose={closeAssetUploadDialog}
          onSelectSlot={selectAssetUploadSlot}
          onSelectFiles={(files) => void selectAssetUploadFiles(files)}
          onRemoveSlot={removeAssetUploadSlot}
          onRetrySlot={retryAssetUploadSlot}
          onChangeName={updateActiveAssetUploadName}
          onRestoreEmptyName={() => restoreEmptyAssetUploadName()}
          onClearName={clearActiveAssetUploadName}
          onSubmit={() => void submitAssetUpload()}
        />
      ) : null}
      {isCharacterGenerateOpen ? (
        <div className="flashmuse-asset-generate-modal fixed inset-0 z-50 overscroll-contain bg-black/58" onMouseDown={() => setIsCharacterGenerateOpen(false)}>
          <div className="flex h-full w-full flex-col">
            <div className="flex min-h-0 min-w-[920px] flex-1 overflow-hidden bg-transparent shadow-[0_20px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flashmuse-preview-stage relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[rgba(245,245,242,0.58)] backdrop-blur-[56px] backdrop-saturate-[190%] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.64)_0%,rgba(255,255,255,0.22)_42%,rgba(255,255,255,0.38)_100%)] after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.72),transparent_28%),radial-gradient(circle_at_82%_88%,rgba(255,255,255,0.36),transparent_34%)]">
                <div className="relative z-10 flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                  <div className="flashmuse-preview-toolbar flex items-center gap-2.5">
                    <button type="button" disabled={!hasCharacterGeneratedImage || isCharacterGenerating} onClick={() => { setCharacterImageFitMode("actual"); applyCharacterImageScale(visibleCharacterImageScale - 0.1); }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle} aria-label={hasCharacterGeneratedImage ? "缩小图片" : "缩小图片不可用"}>
                      <span className="text-[18px] leading-none">-</span>
                    </button>
                    <div className={`flex h-9 min-w-[64px] items-center justify-center text-[13px] font-medium text-[#666666] ${hasCharacterGeneratedImage ? "" : "opacity-30"}`}>{characterImageScalePercent}</div>
                    <button type="button" disabled={!hasCharacterGeneratedImage || isCharacterGenerating} onClick={() => { setCharacterImageFitMode("actual"); applyCharacterImageScale(visibleCharacterImageScale + 0.1); }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle} aria-label={hasCharacterGeneratedImage ? "放大图片" : "放大图片不可用"}>
                      <span className="text-[18px] leading-none">+</span>
                    </button>
                    <button type="button" disabled={!hasCharacterGeneratedImage || isCharacterGenerating} onClick={() => { setCharacterImageFitMode("actual"); setCharacterImageScale(1); setCharacterImagePan({ x: 0, y: 0 }); }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle}>
                      <span className="text-[13px] font-medium leading-none">实际尺寸</span>
                    </button>
                    <button type="button" disabled={!hasCharacterGeneratedImage || isCharacterGenerating} onClick={() => { setCharacterImageFitMode("fit"); updateCharacterImageFitScale(); setCharacterImagePan({ x: 0, y: 0 }); }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle}>
                      <span className="text-[13px] font-medium leading-none">适合尺寸</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasCharacterGeneratedImage && characterGenerateResult.url && !isCharacterGenerating ? (
                      <a href={characterGenerateResult.url} download={getDownloadName({ id: "asset-generated", type: assetGenerateType, name: isSceneGeneration ? "生成场景" : "生成角色", url: characterGenerateResult.url, sourcePrompt: characterGeneratePrompt, sessionId: activeSessionIdValue, createdAt: 0 })} className="inline-flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-[8px] bg-[#111111] px-6 text-[13px] font-medium text-white transition hover:bg-[#252525]" aria-label="下载图片">
                        <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                        <span>下载</span>
                      </a>
                    ) : (
                      <button type="button" disabled className="inline-flex h-9 min-w-[112px] cursor-not-allowed items-center justify-center gap-2 rounded-[8px] bg-[#111111] px-6 text-[13px] font-medium text-white opacity-30" aria-label="下载图片不可用">
                        <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                        <span>下载</span>
                      </button>
                    )}
                    <button type="button" onClick={() => setIsCharacterGenerateOpen(false)} className="yinzao-tool-button flex h-9 w-9 translate-x-2 items-center justify-center text-[#777777] transition" style={previewLightToolButtonStyle} aria-label={`关闭${assetGenerateTitle}`}>
                      <RiCloseLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div ref={characterViewportRef} className={`relative z-10 flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7 ${hasCharacterGeneratedImage && characterImageFitMode === "actual" ? isCharacterImageDragging ? "cursor-grabbing" : "cursor-grab" : ""}`} onWheel={(event) => {
                  if (!hasCharacterGeneratedImage) return;
                  event.preventDefault();
                  const delta = event.deltaY < 0 ? 0.1 : -0.1;
                  setCharacterImageFitMode("actual");
                  applyCharacterImageScale(visibleCharacterImageScale + delta);
                }} onMouseDown={(event) => {
                  if (!hasCharacterGeneratedImage || characterImageFitMode !== "actual") return;
                  event.preventDefault();
                  characterImageDragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, panX: characterImagePan.x, panY: characterImagePan.y };
                  setIsCharacterImageDragging(true);
                }} onMouseMove={(event) => {
                  if (!isCharacterImageDragging) return;
                  const start = characterImageDragStartRef.current;
                  setCharacterImagePan({ x: start.panX + event.clientX - start.pointerX, y: start.panY + event.clientY - start.pointerY });
                }} onMouseUp={() => setIsCharacterImageDragging(false)} onMouseLeave={() => setIsCharacterImageDragging(false)}>
                  <div className="flex h-full w-full items-center justify-center bg-transparent text-center text-[#9a9a9a]">
                    {characterGenerateResult.status === "generating" ? (
                      <div className="relative shrink-0 overflow-hidden bg-[#eaf7ff] text-sm text-[#4f6f86]" style={characterPreviewFrameStyle}>
                        <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),radial-gradient(circle_at_86%_82%,rgba(174,247,241,0.5),transparent_31%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
                        <div className="absolute -left-20 top-8 h-48 w-48 animate-[yinzaoBlobOne_4.5s_ease-in-out_infinite] rounded-full bg-[#b8c8ff]/45 blur-3xl" />
                        <div className="absolute -right-16 bottom-10 h-56 w-56 animate-[yinzaoBlobTwo_6s_ease-in-out_infinite] rounded-full bg-[#9eeef0]/50 blur-3xl" />
                        <div className="absolute left-20 top-48 h-40 w-40 animate-[yinzaoBlobThree_5.5s_ease-in-out_infinite] rounded-full bg-[#b5e0ff]/55 blur-3xl" />
                        <div className="absolute inset-0 animate-[yinzaoVideoShimmer_2.8s_ease-in-out_infinite] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.22),transparent_28%)]" />
                        <div className="absolute left-3 top-3 z-10 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">
                          {getVideoWaitProgress(characterGenerateResult.startedAt, timerNow)}%生成中
                        </div>
                        <div className="absolute bottom-4 left-5 z-10 text-xs text-[#4f6f86]">
                          <div className="mt-1 text-[#6f8fa3]">已等待 {formatElapsedTime(characterGenerateResult.startedAt, timerNow)}</div>
                        </div>
                      </div>
                    ) : characterGenerateResult.status === "failed" ? (
                      <div className="relative shrink-0 overflow-hidden bg-[#f3f3f3] text-[#777777]" style={characterPreviewFrameStyle}>
                        <div className="absolute left-4 top-4 inline-flex items-center gap-2 text-[13px] font-medium leading-none text-[#777777]">
                          <RiEmotionSadLine className="h-5 w-5 shrink-0" aria-hidden="true" />
                          <span>图片生成失败</span>
                        </div>
                        <button type="button" onClick={() => void generateCharacterImage()} className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 bg-transparent text-[10px] font-medium text-[#367cee] transition hover:text-[#2568d8]">
                          <RiResetLeftLine className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="text-[14px] leading-none">重新生成</span>
                        </button>
                        {characterGenerateResult.error ? <div className="absolute bottom-4 left-5 right-5 text-left text-[12px] leading-5 text-red-500">{normalizeMediaErrorText(characterGenerateResult.error, "image") ?? GENERIC_MEDIA_ERROR_MESSAGE}</div> : null}
                      </div>
                    ) : characterGenerateResult.status === "succeeded" && characterGenerateResult.url ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={characterGenerateResult.url} alt={isSceneGeneration ? "生成场景" : "生成角色"} draggable={false} onLoad={(event) => {
                          const image = event.currentTarget;
                          const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
                          setCharacterImageNaturalSize(dimensions);
                          setCharacterGenerateResult((current) => current.status === "succeeded" ? { ...current, dimensions } : current);
                          requestAnimationFrame(() => updateCharacterImageFitScale(dimensions));
                        }} className="max-w-none shrink-0 select-none object-contain shadow-[0_8px_30px_rgba(0,0,0,0.08)]" style={{ width: `${(characterImageNaturalSize.width || characterGenerateDisplayDimensions.width) * visibleCharacterImageScale}px`, height: "auto", transform: `translate3d(${characterImagePan.x}px, ${characterImagePan.y}px, 0)`, transition: isCharacterImageDragging ? "none" : "transform 120ms ease-out" }} />
                      </>
                    ) : (
                      <div className="flashmuse-asset-generate-empty">
                        <RiImageAddLine className="mx-auto h-8 w-8" aria-hidden="true" />
                        <div className="mt-3 text-[14px] font-medium text-[#777777]">{assetGenerateAreaTitle}</div>
                        <div className="mt-1 text-[12px] text-[#9a9a9a]">生成后的图片会显示在这里</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <aside className="flashmuse-preview-aside flex h-full w-[360px] shrink-0 flex-col border-l border-[#eceae6] bg-[#f8f7f4]" style={resolvedTheme === "dark" ? { backgroundColor: "#2a303c", borderColor: "var(--fm-border-subtle)" } : undefined}>
                <div className="flex min-h-0 flex-1 flex-col px-[10px] pb-[10px] pt-7">
                  <div className="flex shrink-0 items-center gap-2 px-1 text-left text-[16px] font-medium leading-none text-[#111111]">
                    <AssetGenerateIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{assetGenerateTitle}</span>
                  </div>
                  <div className="mt-2 grid shrink-0 grid-cols-3 gap-2">
                    <div className="col-span-2 min-w-0">
                      {renderCharacterRatioMenu()}
                    </div>
                    <div className="min-w-0">
                      {renderCharacterStyleMenu()}
                    </div>
                  </div>
                  <div className="mt-2 grid shrink-0 grid-cols-3 gap-2">
                    <div className="col-span-2 min-w-0">
                      {renderCharacterImageModelMenu()}
                    </div>
                    <div className="min-w-0">
                      {renderCharacterImageResolutionMenu()}
                    </div>
                  </div>
                  <div className="mt-2 flex h-6 shrink-0 items-center justify-center gap-2 px-3 text-[12px] leading-5 text-[#8c8c8c]">
                    <span>{assetGenerateRatioLabel}</span>
                    <span className="text-[#d0d0d0]">|</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span>{characterGenerateDisplayDimensions.width} × {characterGenerateDisplayDimensions.height}</span>
                      <CompactResolutionIcon option={characterGenerateDisplayResolution} mode="image" qualityBadgeLabel={characterGenerateQualityBadgeLabel} />
                    </span>
                    <span className="text-[#d0d0d0]">|</span>
                    <span>{characterGenerateStyleLabel}</span>
                  </div>
                  <div className="flashmuse-asset-generate-input relative mt-3 flex min-h-0 flex-1 flex-col rounded-[8px] border border-[#f1f2f2] bg-white/78 py-3 pl-[10px] pr-0 shadow-none backdrop-blur-[18px] transition focus-within:border-[#c8dbff]" style={resolvedTheme === "dark" ? { backgroundColor: "color-mix(in srgb, var(--fm-panel) 88%, transparent)", borderColor: "var(--fm-border)", boxShadow: "0 16px 42px var(--fm-shadow)" } : undefined}>
                    <div className="flex shrink-0 items-center gap-4 pl-[10px] pr-[10px] text-[13px] font-medium text-[#367cee]">
                      <button type="button" disabled={isCharacterGenerateInputDisabled} onClick={(event) => { event.stopPropagation(); openCharacterMentionAssetMenu(); }} className="inline-flex h-5 items-center gap-1.5 bg-transparent p-0 text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-35" aria-label="引用资产">
                        <RiAtLine className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>引用资产</span>
                      </button>
                      <button type="button" disabled={isCharacterPromptOptimizing || characterGenerateResult.status === "generating" || !characterGeneratePrompt.trim()} onClick={() => void optimizeCharacterPrompt()} className="inline-flex h-5 items-center gap-1.5 bg-transparent p-0 text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-35" aria-label="优化提示词">
                        <RiShining2Line className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{isCharacterPromptOptimizing ? "优化中" : "优化提示词"}</span>
                      </button>
                      <button type="button" disabled={isCharacterGenerateInputDisabled || !characterGeneratePrompt.trim()} onClick={() => { setActiveAssetGeneratePrompt(""); setCharacterPromptCursorOffset(0); setIsCharacterAtAssetMenuOpen(false); requestAnimationFrame(() => characterEditorRef.current?.focus()); }} className="inline-flex h-5 items-center gap-1.5 bg-transparent p-0 text-[#367cee] transition hover:text-[#1f63d4] disabled:cursor-not-allowed disabled:opacity-35" aria-label="清空输入框">
                        <RiFormatClear className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>清空输入框</span>
                      </button>
                    </div>
                    {isCharacterAtAssetMenuOpen && (hasCharacterAtAssetOptions || assetsLoadStatus === "loading") && !isCharacterGenerateInputDisabled ? (
                      <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-10 z-[90] max-h-80 w-[380px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
                        <div className="px-2 pb-2 text-[12px] text-[#8a8a8a]">引用资产</div>
                        {assetsLoadStatus === "loading" ? <div className="flex min-h-[180px] items-center justify-center gap-2 text-[13px] font-medium text-[#367cee]"><LoadingSpinner size={18} /><span>加载中...</span></div> : null}
                        {assetsLoadStatus !== "loading" ? <>
                        <div className="mb-2 flex flex-nowrap gap-1.5 px-1">
                          {characterAtAssetGroups.map((group) => {
                            const count = group.assets.length;
                            const isActive = activeCharacterAtAssetGroup?.type === group.type;

                            return (
                              <button key={group.type} type="button" disabled={count === 0} onClick={() => setCharacterAtAssetFilter(group.type)} className={isActive ? "h-7 shrink-0 whitespace-nowrap rounded-[8px] bg-[#111111] px-2 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40" : "h-7 shrink-0 whitespace-nowrap rounded-[8px] bg-[#f4f4f4] px-2 text-[12px] font-medium text-[#666666] transition hover:bg-[#ececec] disabled:cursor-not-allowed disabled:opacity-40"}>
                                <span className="whitespace-nowrap text-[12px] leading-none">{mentionAssetTypeLabels[group.type]}({count})</span>
                              </button>
                            );
                          })}
                        </div>
                        {activeCharacterAtAssetGroup?.assets.map((asset) => (
                          <button key={asset.id} type="button" onClick={() => insertCharacterAssetReference(asset)} className="flex h-12 w-full items-center gap-3 rounded-[8px] px-2 text-left transition hover:bg-[#f5f5f5]">
                            <div className="h-8 w-8 overflow-hidden rounded-[8px] bg-[#eeeeee]">
                              <HoverImagePreview src={asset.url} alt={asset.name} wrapperClassName="block h-full w-full">
                                <Image src={getMediaThumbnailUrl(asset.url)} alt={asset.name} width={32} height={32} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                              </HoverImagePreview>
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium text-[#222222]">@{asset.name}</div>
                              <div className="text-[11px] text-[#999999]">{assetTypeLabels[asset.type]}</div>
                            </div>
                          </button>
                        ))}
                        </> : null}
                      </div>
                    ) : null}
                    {assetGenerateReferenceImages.length > 0 ? (
                      <div className="relative mt-2 shrink-0 pl-[10px] pr-[10px]">
                        {canScrollAssetGenerateReferences.left ? (
                          <button type="button" onClick={() => scrollAssetGenerateReferences(-1)} className="absolute left-[10px] top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#777777] shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:text-[#111111]" aria-label="向左查看图片">
                            <RiArrowLeftSLine className="h-5 w-5" aria-hidden="true" />
                          </button>
                        ) : null}
                        {canScrollAssetGenerateReferences.left ? <div className="pointer-events-none absolute bottom-0 left-[10px] top-0 z-[5] w-10 bg-gradient-to-r from-white/95 to-transparent" /> : null}
                        <div ref={assetGenerateReferencesRowRef} onScroll={updateAssetGenerateReferenceScrollState} className="yinzao-upload-row-scroll flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden scroll-smooth px-0.5">
                          {assetGenerateReferenceImages.map((image) => (
                            <div key={`${image.name}-${image.url}`} className="group relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]">
                              <HoverImagePreview src={image.url} alt={image.name} wrapperClassName="block h-full w-full">
                                <Image src={getMediaThumbnailUrl(image.url)} alt={image.name} width={100} height={100} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                              </HoverImagePreview>
                              <button type="button" disabled={isCharacterGenerateInputDisabled} onClick={() => removeAssetGenerateReference(image.name)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-40" aria-label="移除图片">
                                <RiCloseLine className="h-3 w-3" aria-hidden="true" />
                              </button>
                              <button type="button" disabled={isCharacterGenerateInputDisabled} onClick={() => { focusCharacterEditorAt(characterGeneratePrompt.length); }} className="absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-2 text-left font-medium leading-4 text-white transition">
                                <span className="text-[10px] leading-4">@{image.name}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        {canScrollAssetGenerateReferences.right ? (
                          <button type="button" onClick={() => scrollAssetGenerateReferences(1)} className="absolute right-[10px] top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#777777] shadow-[0_4px_12px_rgba(0,0,0,0.12)] transition hover:text-[#111111]" aria-label="向右查看图片">
                            <RiArrowRightSLine className="h-5 w-5" aria-hidden="true" />
                          </button>
                        ) : null}
                        {canScrollAssetGenerateReferences.right ? <div className="pointer-events-none absolute bottom-0 right-[10px] top-0 z-[5] w-10 bg-gradient-to-l from-white/95 to-transparent" /> : null}
                      </div>
                    ) : null}
                    <div className="relative mt-2 min-h-0 flex-1 pr-0">
                      {!characterGeneratePrompt ? <div className="flashmuse-asset-generate-placeholder pointer-events-none absolute left-[10px] top-1 z-20 text-[13px] leading-[22px] text-[#b3b3b3]">{assetGeneratePlaceholder}</div> : null}
                      <PlainMentionEditor
                        value={characterGeneratePrompt}
                        validReferences={characterValidReferenceNames}
                        editorRef={characterEditorRef}
                        className="h-full min-h-0 flex-1 pl-[10px] pr-[10px] text-[#111111]"
                        editorStyle={{ fontSize: 13, lineHeight: "22px" }}
                        maxHeight="none"
                        disabled={isCharacterGenerateInputDisabled}
                        onChange={(value) => setActiveAssetGeneratePrompt(value)}
                        onPasteImages={() => showInputTip(`${assetGenerateTitle}界面暂不支持直接粘贴图片，请使用@引用资产`)}
                        onSubmit={() => void generateCharacterImage()}
                        onAtTrigger={() => setIsCharacterAtAssetMenuOpen(true)}
                        onAtClose={() => setIsCharacterAtAssetMenuOpen(false)}
                        onLimit={() => showInputTip("最多输入2000字")}
                        onCursorChange={setCharacterPromptCursorOffset}
                      />
                    </div>
                    {isCharacterPromptOptimizing ? <PromptOptimizingOverlay /> : null}
                  </div>
                  <button type="button" disabled={!characterGeneratePrompt.trim() || isCharacterGenerateInputDisabled} onClick={() => void generateCharacterImage()} className="flashmuse-asset-generate-submit mt-[10px] h-12 shrink-0 rounded-[8px] bg-[#111111] px-4 text-[13px] font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-30">{characterGenerateResult.status === "generating" ? "生成中" : "生成图片"}</button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
      {!isAssetUploadOpen && assetUploadTip ? (
        <ReminderToast reminder={assetUploadTip} fixed />
      ) : null}
      {generationCompleteReminder ? (
        <ReminderToast reminder={generationCompleteReminder} fixed />
      ) : null}
      {userDialogTab ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/46 px-5 backdrop-blur-[6px]" onMouseDown={() => setUserDialogTab("")}>
          {userDialogTip ? (
            <div className="pointer-events-none absolute left-1/2 top-[calc(50%-376px)] z-[70] -translate-x-1/2">
              <ReminderToast reminder={userDialogTip} />
            </div>
          ) : null}
          <div className="relative flex h-[min(640px,calc(100vh-48px))] w-[min(820px,calc(100vw-48px))] overflow-hidden rounded-[18px] bg-white text-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.22)]" onMouseDown={(event) => event.stopPropagation()}>
            <div className="w-[230px] shrink-0 border-r border-[#eeeeee] px-5 py-5">
              <div className="mb-9 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- keep raw img to avoid next/image caching an old replaced logo file. */}
                <img src="/home-assets/logo.png" alt="闪念" className="h-8 w-8 shrink-0 object-contain" />
                <div className="text-[16px] font-semibold leading-none">{userText("用户中心")}</div>
              </div>

              <div className="space-y-1.5">
                <button type="button" onClick={() => openUserDialog("profile")} className={`flex h-9 w-full items-center gap-2.5 rounded-[8px] px-3 text-left transition ${userDialogTab === "profile" ? "bg-[#f1f1f1] text-[#111111]" : "text-[#333333] hover:bg-[#f7f7f7]"}`}>
                  <RiAccountCircleLine className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="text-[14px] font-medium">{userText("用户信息")}</span>
                </button>
                <button type="button" onClick={() => openUserDialog("credits")} className={`flex h-9 w-full items-center gap-2.5 rounded-[8px] px-3 text-left transition ${userDialogTab === "credits" ? "bg-[#f1f1f1] text-[#111111]" : "text-[#333333] hover:bg-[#f7f7f7]"}`}>
                  <RiVipDiamondLine className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="text-[14px] font-medium">{userText("我的积分")}</span>
                </button>
                <button type="button" onClick={() => openUserDialog("security")} className={`flex h-9 w-full items-center gap-2.5 rounded-[8px] px-3 text-left transition ${userDialogTab === "security" ? "bg-[#f1f1f1] text-[#111111]" : "text-[#333333] hover:bg-[#f7f7f7]"}`}>
                  <RiShieldUserLine className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="text-[14px] font-medium">{userText("帐号安全")}</span>
                </button>
                <button type="button" onClick={() => openUserDialog("settings")} className={`flex h-9 w-full items-center gap-2.5 rounded-[8px] px-3 text-left transition ${userDialogTab === "settings" ? "bg-[#f1f1f1] text-[#111111]" : "text-[#333333] hover:bg-[#f7f7f7]"}`}>
                  <RiSettingsLine className="h-[18px] w-[18px]" aria-hidden="true" />
                  <span className="text-[14px] font-medium">{userText("设置")}</span>
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col pt-3">
              <div className="flex h-[64px] shrink-0 items-center justify-between gap-4 px-8">
                <h2 className="text-[18px] font-normal leading-none">
                  {userDialogTab === "profile" ? userText("用户信息") : userDialogTab === "credits" ? userText("我的积分") : userDialogTab === "security" ? userText("帐号安全") : userText("设置")}
                </h2>
                <button type="button" onClick={() => setUserDialogTab("")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] text-[#333333] transition hover:bg-[#f4f4f4]" aria-label="关闭用户信息弹窗">
                  <RiCloseLine className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="min-w-0 flex-1 overflow-y-auto px-8 pb-8 pt-0">
              {userDialogTab === "profile" ? (
                <div>
                  <div className="mt-1 flex w-[min(490px,100%)] justify-center">
                    <div className="flex flex-col items-center">
                      <div className="relative h-[92px] w-[92px]">
                        <div className="h-full w-full overflow-hidden rounded-full" style={currentUserAvatarUrl ? undefined : { backgroundColor: defaultUserAvatar.backgroundColor, border: `1px solid ${defaultUserAvatar.borderColor}`, color: defaultUserAvatar.color }}>
                          {currentUserAvatarUrl ? (
                            <Image src={currentUserAvatarUrl} alt="用户头像" width={92} height={92} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[30px] font-medium">{defaultUserAvatar.label}</div>
                          )}
                        </div>
                        <input
                          ref={userAvatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            void uploadUserAvatar(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                        <button
                          type="button"
                          disabled={isUploadingUserAvatar}
                          onClick={() => userAvatarInputRef.current?.click()}
                          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-[#d9d9d9] bg-white p-0 text-[#777777] leading-none transition hover:border-[#c8c8c8] hover:text-[#333333] disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label="上传头像"
                        >
                          <RiCameraLine className="block h-[19px] w-[19px]" aria-hidden="true" />
                        </button>
                      </div>
                      {currentUserId ? <div className="mt-2 text-[14px] font-medium text-[#8a8a8a]">{currentUserId}</div> : null}
                    </div>
                  </div>

                  <div className="mt-10 w-[min(534px,100%)] space-y-2">
                    {[
                      { key: "nickname", label: userText("昵称"), value: currentUserNickname || currentUserEmail, icon: RiAccountCircleLine },
                      { key: "email", label: userText("邮箱（登录帐号）"), value: currentUserEmail, icon: RiMailLine },
                      { key: "phone", label: userText("手机"), value: currentUserPhone || userText("未绑定"), icon: RiPhoneLine },
                      { key: "image", label: userText("生成图片"), value: `${generatedImageCount}张`, icon: RiImageLine },
                      { key: "video", label: userText("生成视频"), value: `${generatedVideoCount}段`, icon: RiFilmLine },
                    ].map((item) => {
                      const RowIcon = item.icon;

                      return item.key === "nickname" || item.key === "phone" ? (
                        <div key={item.key} className="flex min-h-11 items-center gap-2">
                          <div className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                            <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                              <RowIcon className="h-[18px] w-[18px] shrink-0 text-[#9a9a9a]" aria-hidden="true" />
                              <span className="text-[14px] font-normal">{item.label}</span>
                            </div>
                            <div className="min-w-0 flex-1 text-right">
                              {item.key === "nickname" && isEditingUserNickname ? (
                                <input
                                  value={userNicknameInput}
                                  onChange={(event) => setUserNicknameInput(Array.from(event.target.value).slice(0, MAX_USER_NICKNAME_LENGTH).join(""))}
                                  maxLength={MAX_USER_NICKNAME_LENGTH}
                                  onBlur={commitUserNickname}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") commitUserNickname();
                                    if (event.key === "Escape") cancelEditingUserNickname();
                                  }}
                                  autoFocus
                                  className="h-8 w-full rounded-[8px] border border-[#dddddd] bg-white px-2 text-right text-[14px] text-[#333333] outline-none transition focus:border-[#367cee]"
                                />
                              ) : item.key === "phone" && isEditingUserPhone ? (
                                <input
                                  value={userPhoneInput}
                                  onChange={(event) => setUserPhoneInput(event.target.value)}
                                  onBlur={commitUserPhone}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") commitUserPhone();
                                    if (event.key === "Escape") cancelEditingUserPhone();
                                  }}
                                  autoFocus
                                  className="h-8 w-full rounded-[8px] border border-[#dddddd] bg-white px-2 text-right text-[14px] text-[#333333] outline-none transition focus:border-[#367cee]"
                                />
                              ) : (
                                <div className="min-w-0 truncate text-right text-[14px] text-[#333333]">{item.value}</div>
                              )}
                            </div>
                          </div>
                          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={item.key === "nickname" ? (isEditingUserNickname ? commitUserNickname : startEditingUserNickname) : (isEditingUserPhone ? commitUserPhone : startEditingUserPhone)} className="flex h-9 w-9 shrink-0 items-center justify-center text-[#9a9a9a] transition hover:text-[#333333]" aria-label={item.key === "nickname" ? "修改昵称" : "修改手机"}>
                            <RiEditBoxLine className="h-[18px] w-[18px]" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <div key={item.key} className="mr-[44px] flex min-h-11 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                          <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                            <RowIcon className="h-[18px] w-[18px] shrink-0 text-[#9a9a9a]" aria-hidden="true" />
                            <span className="text-[14px] font-normal">{item.label}</span>
                          </div>
                            <div className={`min-w-0 truncate text-right text-[14px] ${item.key === "email" ? "text-[#9a9a9a]" : "text-[#333333]"}`}>{item.value}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {userDialogTab === "credits" ? (() => {
                const pageSize = 8;
                const totalPages = Math.max(1, Math.ceil(userCreditConversations.length / pageSize));
                const safePage = Math.min(totalPages, Math.max(1, userCreditPage));
                const rows = userCreditConversations.slice((safePage - 1) * pageSize, safePage * pageSize);

                return (
                  <div>
                    <div className="flex items-center gap-6 rounded-[12px] bg-[#f3f2ed] p-2.5">
                      <div className="min-h-[96px] w-[238px] rounded-[12px] border border-[#e1cbb6] bg-[linear-gradient(100deg,#ffffff_0%,#fbfaf7_54%,#f2eee6_100%)] px-4 py-3 shadow-[0_8px_20px_rgba(114,90,62,0.07)]">
                        <div className="flex h-5 w-fit items-center rounded-full bg-[#c6b19d] px-2.5 text-[11px] font-semibold text-white">免费套餐</div>
                        <div className="mt-3 flex items-center gap-1.5 text-[18px] font-semibold tracking-[-0.02em] text-[#111111]">个人免费版 <RiLeafLine className="h-4.5 w-4.5" aria-hidden="true" /></div>
                        <div className="mt-1.5 max-w-[190px] text-[11px] leading-4 text-[#9a8b7b]">当前为免费版本，暂无升级套餐功能。如有疑问请联系管理员！</div>
                      </div>
                      <div className="min-w-0 flex-1 self-start pt-3">
                        <div className="text-[20px] font-normal tracking-[-0.02em] text-[#111111]">总积分 <span className="ml-2 font-semibold">{currentUserCredits.toLocaleString("en-US")}</span></div>
                        <div className="mt-1.5 text-[12px] leading-5 text-[#9a9a9a]">已赠送积分：{giftedUserCredits.toLocaleString("en-US")}</div>
                      </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-[5px] border border-[#eeeeee]">
                      <table className="w-full table-fixed text-left text-[12px]">
                        <thead className="bg-[#f7f7f7] text-[#888888]">
                          <tr>
                            <th className="border-r border-[#dddddd] px-3 py-2 font-medium">积分来源</th>
                            <th className="w-[92px] border-r border-[#dddddd] px-3 py-2 text-right font-medium">积分变动</th>
                            <th className="w-[92px] border-r border-[#dddddd] px-3 py-2 text-right font-medium">对话Token</th>
                            <th className="w-[92px] border-r border-[#dddddd] px-3 py-2 text-right font-medium">图片/视频</th>
                            <th className="w-[72px] whitespace-nowrap px-2 py-2 text-right font-medium">最后活跃</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length > 0 ? rows.map((row) => {
                            const SourceIcon = userCreditSourceIcons[row.source ?? "conversation"] ?? RiChatSmileAiLine;
                            const isImageGenerationSource = row.source === "character_image_generation" || row.source === "scene_image_generation" || row.source === "shot_image_generation";
                            const isTextOnlySource = row.source === "image_prompt_reverse" || row.source === "prompt_optimization";
                            const isIncreaseRow = row.direction === "increase";
                            const tokenCount = Math.max(0, Math.floor(row.totalTokens ?? 0));
                            const imageText = isIncreaseRow || isTextOnlySource ? "--" : row.imageCount.toLocaleString("en-US");
                            const videoText = isIncreaseRow || ((isImageGenerationSource || isTextOnlySource) && row.videoCount === 0) ? "--" : row.videoCount.toLocaleString("en-US");
                            const sourceTitle = userCreditSourceLabels[row.source ?? "conversation"] ?? row.title;
                            const creditValue = Math.trunc(row.credits);
                            const creditDisplay = creditValue === 0 ? "0" : isIncreaseRow && creditValue > 0 ? `+${creditValue.toLocaleString("en-US")}` : creditValue < 0 ? `-${Math.abs(creditValue).toLocaleString("en-US")}` : `-${creditValue.toLocaleString("en-US")}`;
                            const creditClassName = isIncreaseRow && creditValue > 0 ? "text-[#18a058]" : "text-red-500";
                            return (
                              <tr key={row.conversationId} className="border-t border-[#eeeeee]">
                                <td className="border-r border-[#eeeeee] px-3 py-2 text-[#333333]">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <SourceIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
                                    <span className="min-w-0 truncate">{sourceTitle}</span>
                                  </div>
                                </td>
                                <td className={`border-r border-[#eeeeee] px-3 py-2 text-right font-semibold ${creditClassName}`}>{creditDisplay}</td>
                                <td className="border-r border-[#eeeeee] px-3 py-2 text-right text-[#555555]">{tokenCount > 0 ? tokenCount.toLocaleString("en-US") : "--"}</td>
                                <td className="border-r border-[#eeeeee] px-3 py-2 text-right text-[#555555]">{imageText}/{videoText}</td>
                                <td className="whitespace-nowrap px-2 py-2 text-right text-[#777777]">{formatCreditLastActiveTime(row.lastActiveAt)}</td>
                              </tr>
                            );
                          }) : <tr><td colSpan={5} className="px-3 py-10 text-center text-[#999999]">暂无积分记录</td></tr>}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-[#777777]">
                      <button type="button" disabled={safePage <= 1} onClick={() => setUserCreditPage((page) => Math.max(1, page - 1))} className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[#333333] transition hover:bg-[#f4f4f4] disabled:pointer-events-none disabled:opacity-40"><RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" />上一页</button>
                      <span>{safePage} / {totalPages}</span>
                      <button type="button" disabled={safePage >= totalPages} onClick={() => setUserCreditPage((page) => Math.min(totalPages, page + 1))} className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[#333333] transition hover:bg-[#f4f4f4] disabled:pointer-events-none disabled:opacity-40">下一页<RiArrowRightSLine className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                  </div>
                );
              })() : null}

              {userDialogTab === "security" ? (
                <div>
                  <div className="w-[min(490px,100%)] space-y-2">
                    {currentUserHasPassword && securityPasswordMode === "default" ? (
                      <>
                        <div className="flex min-h-11 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                          <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                            <RiLockPasswordLine className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                            <span className="text-[14px] font-normal">***********</span>
                          </div>
                          <div className="min-w-0 truncate text-right text-[14px] text-[#9a9a9a]">{userText("密码已设置")}</div>
                        </div>
                        <div className="flex items-center justify-end gap-5 pt-2">
                          <button type="button" onClick={() => { setSecurityPasswordMode("change"); setPasswordActionError(""); setPasswordActionMessage(""); }} className="bg-transparent p-0 font-normal text-[#367cee] transition hover:text-[#1f63d9]"><span style={{ fontSize: 13 }}>{userText("修改密码")}</span></button>
                          <button type="button" onClick={() => void startForgotPasswordFlow()} disabled={isForgotPasswordSending} className="bg-transparent p-0 font-normal text-[#367cee] transition hover:text-[#1f63d9] disabled:text-[#9bbcf5]"><span style={{ fontSize: 13 }}>{isForgotPasswordSending ? userText("发送中") + "..." : userText("忘记密码")}</span></button>
                        </div>
                      </>
                    ) : null}

                    {!currentUserHasPassword || securityPasswordMode === "change" || securityPasswordMode === "forgot-reset" ? (
                      <>
                        <div className="mb-3 flex items-center gap-2 text-[14px] font-normal text-[#9a9a9a]">
                          <RiErrorWarningLine className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                          <span style={{ fontSize: 13 }}>{securityPasswordMode === "forgot-reset" || !currentUserHasPassword ? userText("设置密码后可用密码登录") : userText("修改密码后请使用新密码登录")}</span>
                        </div>
                        {currentUserHasPassword && securityPasswordMode === "change" ? (
                          <input type="password" value={currentPasswordInput} onChange={(event) => updatePasswordField(setCurrentPasswordInput, event.target.value)} placeholder={userText("当前密码")} className="h-11 w-full rounded-[10px] border-0 bg-[#f7f7f7] px-4 text-[14px] text-[#333333] outline-none transition placeholder:text-[#9a9a9a] focus:bg-[#f4f7ff]" />
                        ) : null}
                        <input type="password" value={newPasswordInput} onChange={(event) => updatePasswordField(setNewPasswordInput, event.target.value)} placeholder={userText("新密码，至少8位")} className="h-11 w-full rounded-[10px] border-0 bg-[#f7f7f7] px-4 text-[14px] text-[#333333] outline-none transition placeholder:text-[#9a9a9a] focus:bg-[#f4f7ff]" />
                        <input type="password" value={confirmPasswordInput} onChange={(event) => updatePasswordField(setConfirmPasswordInput, event.target.value)} placeholder={userText("再次输入新密码")} className="h-11 w-full rounded-[10px] border-0 bg-[#f7f7f7] px-4 text-[14px] text-[#333333] outline-none transition placeholder:text-[#9a9a9a] focus:bg-[#f4f7ff]" />
                      </>
                    ) : null}

                    {securityPasswordMode === "forgot-code" ? (
                      <>
                        <div className="mb-3 flex items-center gap-2 text-[14px] font-normal text-[#9a9a9a]">
                          <RiErrorWarningLine className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                          <span style={{ fontSize: 13 }}>{userText("验证码已发送至登录邮箱，验证后可重设密码")}</span>
                        </div>
                        <div className="flex gap-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <input
                              key={index}
                              value={forgotPasswordCode[index] ?? ""}
                              onChange={(event) => {
                                const digits = event.target.value.replace(/\D/g, "");
                                if (!digits) {
                                  setForgotPasswordCode((current) => `${current.slice(0, index)}${current.slice(index + 1)}`.slice(0, 6));
                                  setPasswordActionError("");
                                  return;
                                }

                                setForgotPasswordCode((current) => `${current.slice(0, index)}${digits}${current.slice(index + 1)}`.slice(0, 6));
                                setPasswordActionError("");
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Backspace" && !forgotPasswordCode[index]) {
                                  (event.currentTarget.previousElementSibling as HTMLInputElement | null)?.focus();
                                }
                              }}
                              onInput={(event) => {
                                if ((event.currentTarget.value || "").length > 0) {
                                  (event.currentTarget.nextElementSibling as HTMLInputElement | null)?.focus();
                                }
                              }}
                              inputMode="numeric"
                              maxLength={1}
                              className="h-11 w-11 rounded-[10px] border border-[#dddddd] bg-[#f7f7f7] px-0 text-center text-[16px] text-[#333333] outline-none transition placeholder:text-[#9a9a9a] focus:border-[#c8d8ff] focus:bg-[#f4f7ff]"
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <button type="button" onClick={() => void startForgotPasswordFlow()} disabled={isForgotPasswordSending} className="bg-transparent p-0 font-normal text-[#367cee] transition hover:text-[#1f63d9] disabled:text-[#9bbcf5]"><span style={{ fontSize: 13 }}>{userText("重新发送")}</span></button>
                        </div>
                      </>
                    ) : null}

                    {passwordActionError ? <div className="mt-3 text-[12px] text-red-500">{passwordActionError}</div> : null}
                    {!currentUserHasPassword || securityPasswordMode === "change" || securityPasswordMode === "forgot-reset" ? (
                      <button type="button" onClick={() => void submitPasswordSettings()} disabled={isPasswordSaving} className="mt-4 h-11 min-w-24 rounded-[10px] bg-[#111111] px-5 text-[14px] font-medium text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#cfcfcf]">
                        {isPasswordSaving ? `${userText("保存中")}...` : currentUserHasPassword ? userText("修改密码") : userText("保存密码")}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {userDialogTab === "settings" ? (
                <div>
                  <div className="w-[min(490px,100%)] space-y-2">
                    {[
                      { key: "language", label: userText("语言"), value: getLanguageDisplayName(userLanguage), icon: RiGlobalLine },
                      { key: "notify", label: userText("图片/视频生成完成提醒"), value: "", icon: RiNotification2Line },
                      { key: "history", label: userText("生成图片/视频自动收入资产库"), value: "", icon: RiSaveLine },
                      { key: "wheelZoom", label: userText("预览页鼠标放在图片上滚轮有缩放功能"), value: "", icon: RiZoomInLine },
                      { key: "wheelFlip", label: userText("预览页鼠标放在缩略图区域滚轮有翻页功能"), value: "", icon: RiArrowUpDownLine },
                      { key: "version", label: userText("版本信息"), value: userText("v0.1.0 内测版"), icon: RiInformationLine },
                    ].map((item) => {
                      const RowIcon = item.icon;

                      return (
                      <div key={item.key} className="relative flex min-h-11 items-center justify-between gap-6 rounded-[10px] bg-[#f7f7f7] px-4">
                        <div className="flex min-w-0 items-center gap-2.5 text-[#9a9a9a]">
                          <RowIcon className="h-[18px] w-[18px] shrink-0 text-[#9a9a9a]" aria-hidden="true" />
                          <span className="text-[14px] font-normal">{item.label}</span>
                        </div>
                        {item.key === "language" ? (
                          <div className="relative" onClick={(event) => event.stopPropagation()}>
                            <button type="button" onClick={() => setIsLanguageMenuOpen((current) => !current)} className="inline-flex items-center gap-1.5 bg-transparent p-0 text-right font-normal text-[#333333]" data-no-translate="true">
                              <span style={{ fontSize: 14 }}>{item.value}</span>
                              <RiArrowDownSLine className="h-4 w-4 text-[#9a9a9a]" aria-hidden="true" />
                            </button>
                            {isLanguageMenuOpen ? (
                              <div className="absolute right-0 top-8 z-50 w-36 rounded-[10px] bg-white p-1.5 shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
                                {userLanguageOptions.map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => {
                                      setUserLanguage(option);
                                      setIsLanguageMenuOpen(false);
                                      setUserDialogTip({ message: option === "繁体中文" ? "已切換到繁體中文" : "已切换到简体中文", tone: "default", noTranslate: true });
                                    }}
                                    className={option === userLanguage ? "flex h-9 w-full items-center justify-between rounded-[8px] bg-[#f5f5f5] px-2.5 text-left text-[#111111]" : "flex h-9 w-full items-center justify-between rounded-[8px] px-2.5 text-left text-[#555555] hover:bg-[#f7f7f7]"}
                                  >
                                    <span style={{ fontSize: 13 }} data-no-translate="true">{getLanguageDisplayName(option)}</span>
                                    {option === userLanguage ? <RiCheckLine className="h-4 w-4" aria-hidden="true" /> : null}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : item.key === "notify" ? (
                          <SettingsSwitch checked={notifyOnGenerationComplete} onChange={setNotifyOnGenerationComplete} />
                        ) : item.key === "history" ? (
                          <SettingsSwitch checked={autoSaveHistory} onChange={setAutoSaveHistory} />
                        ) : item.key === "wheelZoom" ? (
                          <SettingsSwitch checked={previewWheelZoom} onChange={setPreviewWheelZoom} />
                        ) : item.key === "wheelFlip" ? (
                          <SettingsSwitch checked={previewWheelFlip} onChange={setPreviewWheelFlip} />
                        ) : (
                          <div className="min-w-0 truncate text-right text-[14px] text-[#333333]">{item.value}</div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {renamingSessionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/35 px-4">
          <div className="relative w-full max-w-[500px] rounded-xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
            <button type="button" onClick={cancelRenameSession} className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-900" aria-label="关闭重命名弹窗">
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="mb-3 text-sm font-medium text-slate-900">请重新编辑对话名称：</div>
            <input
              value={renameInput}
              onChange={(event) => setRenameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRenameSession();
                if (event.key === "Escape") cancelRenameSession();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition hover:border-[#bcd3ff] focus:border-[#2b65f5]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cancelRenameSession} className="h-9 w-20 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50">
                取消
              </button>
              <button type="button" onClick={submitRenameSession} className="h-9 w-20 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800">
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {renamingAssetId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/35 px-4">
          <div className="relative w-full max-w-[500px] rounded-xl bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
            <button type="button" onClick={cancelRenameAsset} className="absolute right-4 top-4 text-slate-400 transition hover:text-slate-900" aria-label="关闭资产重命名弹窗">
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="mb-3 text-sm font-medium text-slate-900">请重新编辑资产名称：</div>
            <input
              value={assetRenameInput}
              onChange={(event) => setAssetRenameInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitRenameAsset();
                if (event.key === "Escape") cancelRenameAsset();
              }}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none transition hover:border-[#bcd3ff] focus:border-[#2b65f5]"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cancelRenameAsset} className="h-9 w-20 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50">
                取消
              </button>
              <button type="button" onClick={submitRenameAsset} className="h-9 w-20 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800">
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <DocumentPreviewPanel file={previewDocumentFile} width={previewDocumentWidth || getDefaultDocumentPreviewWidth()} onResizeStart={startDocumentPreviewResize} onClose={() => setPreviewDocumentFile(null)} />

      {previewAsset ? (
        <div className="flashmuse-preview-modal fixed inset-0 z-50 overscroll-contain bg-black/58" onClick={() => setPreviewAsset(null)}>
          <div className="flex h-full w-full flex-col pt-8 sm:pt-10 lg:pt-12">
            <div className="flex min-h-0 min-w-[920px] flex-1 overflow-hidden rounded-t-[20px] bg-transparent shadow-[0_20px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5" onClick={(event) => event.stopPropagation()}>
              <div className="flashmuse-preview-stage relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[rgba(245,245,242,0.58)] backdrop-blur-[56px] backdrop-saturate-[190%] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.64)_0%,rgba(255,255,255,0.22)_42%,rgba(255,255,255,0.38)_100%)] after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.72),transparent_28%),radial-gradient(circle_at_82%_88%,rgba(255,255,255,0.36),transparent_34%)]">
                <div className="relative z-10 flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                  <div className="flashmuse-preview-toolbar flex items-center gap-2.5">
                    {!isVideoAsset(previewAsset) ? (
                      <>
                        <button type="button" onClick={() => {
                          setPreviewFitMode("actual");
                          applyPreviewScale(visiblePreviewScale - 0.1);
                        }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition" style={previewLightToolButtonStyle} aria-label="缩小图片">
                          <span className="text-[18px] leading-none">-</span>
                        </button>
                        <div className="flex h-9 min-w-[64px] items-center justify-center text-[13px] font-medium text-[#666666]">{previewScalePercent}</div>
                        <button type="button" onClick={() => {
                          setPreviewFitMode("actual");
                          applyPreviewScale(visiblePreviewScale + 0.1);
                        }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition" style={previewLightToolButtonStyle} aria-label="放大图片">
                          <span className="text-[18px] leading-none">+</span>
                        </button>
                        <BlackHoverTooltip label="显示图片的实际尺寸" side="bottom">
                          <button type="button" onClick={() => {
                            setPreviewFitMode("actual");
                            setPreviewScale(1);
                            setPreviewPan({ x: 0, y: 0 });
                          }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition" style={previewLightToolButtonStyle}>
                            <span className="text-[13px] font-medium leading-none">实际尺寸</span>
                          </button>
                        </BlackHoverTooltip>
                        <BlackHoverTooltip label="显示适合屏幕的完整图片" side="bottom">
                          <button type="button" onClick={() => {
                            setPreviewFitMode("fit");
                            updatePreviewFitScale();
                            setPreviewPan({ x: 0, y: 0 });
                            const viewport = previewViewportRef.current;
                            if (viewport) {
                              viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
                            }
                          }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition" style={previewLightToolButtonStyle}>
                            <span className="text-[13px] font-medium leading-none">适合尺寸</span>
                          </button>
                        </BlackHoverTooltip>
                      </>
                    ) : (
                      <>
                        <button type="button" disabled className="yinzao-tool-button flex h-9 w-9 cursor-not-allowed items-center justify-center text-[#777777] opacity-30" style={previewLightToolButtonStyle} aria-label="缩小图片不可用">
                          <span className="text-[18px] leading-none">-</span>
                        </button>
                        <div className="flex h-9 min-w-[64px] items-center justify-center text-[13px] font-medium text-[#666666] opacity-30">适合</div>
                        <button type="button" disabled className="yinzao-tool-button flex h-9 w-9 cursor-not-allowed items-center justify-center text-[#777777] opacity-30" style={previewLightToolButtonStyle} aria-label="放大图片不可用">
                          <span className="text-[18px] leading-none">+</span>
                        </button>
                        <button type="button" disabled className="yinzao-tool-button inline-flex h-9 cursor-not-allowed items-center px-3.5 text-[#777777] opacity-30" style={previewLightToolButtonStyle}>
                          <span className="text-[13px] font-medium leading-none">实际尺寸</span>
                        </button>
                        <button type="button" disabled className="yinzao-tool-button inline-flex h-9 cursor-not-allowed items-center px-3.5 text-[#777777] opacity-30" style={previewLightToolButtonStyle}>
                          <span className="text-[13px] font-medium leading-none">适合尺寸</span>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isPreviewDownloadReady ? (
                      <a href={getDownloadUrl(previewAsset.url)} download={getDownloadName(previewAsset)} className="inline-flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-[8px] bg-[#111111] px-6 text-[13px] font-medium text-white transition hover:bg-[#252525]" aria-label={isVideoAsset(previewAsset) ? "下载视频" : "下载图片"}>
                        <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                        <span>下载</span>
                      </a>
                    ) : (
                      <button type="button" disabled className="inline-flex h-9 min-w-[132px] cursor-not-allowed items-center justify-center gap-2 rounded-[8px] bg-[#b8b8b8] px-5 text-[13px] font-medium text-white opacity-80" aria-label="下载准备中">
                        <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                        <span>下载准备中...</span>
                      </button>
                    )}
                    <button type="button" onClick={() => setPreviewAsset(null)} className="yinzao-tool-button flex h-9 w-9 translate-x-2 items-center justify-center text-[#777777] transition" style={previewLightToolButtonStyle} aria-label="关闭预览">
                      <RiCloseLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {previewMediaOptions.length > 1 ? (
                  <div className="absolute right-2 top-[92px] z-20 flex max-h-[calc(100%-124px)] w-[50px] flex-col items-center gap-2" onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onWheelCapture={(event) => {
                    event.stopPropagation();
                    if (!previewWheelFlip || previewMediaOptions.length <= 1) return;
                    event.preventDefault();
                    shiftPreviewAsset(event.deltaY < 0 ? -1 : 1);
                  }}>
                    {previewThumbsNeedScroll ? (
                      <button type="button" disabled={!canPagePreviewThumbsUp} onClick={(event) => {
                        event.stopPropagation();
                        pagePreviewThumbsByButton(-1);
                      }} className="yinzao-tool-button flex h-[50px] w-[50px] shrink-0 items-center justify-center text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle} aria-label="上一页缩略图">
                        <RiArrowUpSLine className="h-6 w-6" aria-hidden="true" />
                      </button>
                    ) : null}
                    <div className="relative overflow-hidden" style={{ height: pagePreviewThumbListHeight }}>
                      <div ref={previewThumbListRef} className="yinzao-hidden-scrollbar flex flex-col gap-2 overflow-hidden">
                        {pagePreviewThumbs.map((image) => {
                          const isSelected = previewAsset.id === image.id || previewAsset.url === image.url;
                          const isVideoThumb = isVideoAsset(image);

                          return (
                            <button key={image.id} type="button" data-preview-thumb-id={image.id} data-preview-thumb-url={image.url} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onClick={() => { if (isSelected) return; resetPreviewTransform(); setPreviewAsset(image); }} className={`flashmuse-preview-thumb relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded-[5px] border-2 bg-[#f1f1f1] transition ${isSelected ? "flashmuse-preview-thumb-selected" : "flashmuse-preview-thumb-rest"}`} aria-label={`查看${image.name}`}>
                              {isVideoThumb ? (
                                <>
                                  {image.posterUrl ? <Image src={getMediaThumbnailUrl(image.posterUrl)} alt={image.name} fill sizes="50px" unoptimized className="object-cover" /> : <video src={getStaticMediaUrl(image.url)} className="h-full w-full object-cover" muted playsInline preload="metadata" />}
                                  <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-[3px] bg-black/56 text-white backdrop-blur-[4px]">
                                    <RiFilmLine className="h-3 w-3" aria-hidden="true" />
                                  </span>
                                </>
                              ) : (
                                <Image src={getMediaThumbnailUrl(image.url)} alt={image.name} fill sizes="50px" unoptimized className="object-cover" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {previewThumbsNeedScroll ? (
                      <button type="button" disabled={!canPagePreviewThumbsDown} onClick={(event) => {
                        event.stopPropagation();
                        pagePreviewThumbsByButton(1);
                      }} className="yinzao-tool-button flex h-[50px] w-[50px] shrink-0 items-center justify-center text-[#777777] transition disabled:cursor-not-allowed disabled:opacity-30" style={previewLightToolButtonStyle} aria-label="下一页缩略图">
                        <RiArrowDownSLine className="h-6 w-6" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div ref={previewViewportRef} className={`relative z-10 flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7 ${!isVideoAsset(previewAsset) && !isAudioAsset(previewAsset) && previewFitMode === "actual" ? isPreviewDragging ? "cursor-grabbing" : "cursor-grab" : ""}`} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onWheel={(event) => {
                  if (!previewWheelZoom || isVideoAsset(previewAsset) || isAudioAsset(previewAsset)) return;
                  event.preventDefault();
                  const delta = event.deltaY < 0 ? 0.1 : -0.1;
                  setPreviewFitMode("actual");
                  applyPreviewScale(visiblePreviewScale + delta);
                }} onMouseDown={(event) => {
                  if (isVideoAsset(previewAsset) || isAudioAsset(previewAsset) || previewFitMode !== "actual") return;
                  event.preventDefault();
                  previewDragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, panX: previewPan.x, panY: previewPan.y };
                  setIsPreviewDragging(true);
                }} onMouseMove={(event) => {
                  if (!isPreviewDragging) return;
                  const start = previewDragStartRef.current;
                  setPreviewPan({ x: start.panX + event.clientX - start.pointerX, y: start.panY + event.clientY - start.pointerY });
                }} onMouseUp={() => setIsPreviewDragging(false)} onMouseLeave={() => setIsPreviewDragging(false)}>
                  <div className="flex h-full w-full items-center justify-center bg-transparent">
                    {isAudioAsset(previewAsset) ? (
                      <div className="flex w-full max-w-[680px] flex-col items-center gap-5 rounded-[20px] bg-white/92 px-8 py-10 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e5f7f4] text-[#0f766e]">
                          <RiMusic2Line className="h-8 w-8" aria-hidden="true" />
                        </div>
                        <div className="max-w-full truncate text-[15px] font-medium text-[#222222]">{previewAsset.name}</div>
                        <audio key={`${previewAsset.id}-${previewAsset.url}`} src={getStaticMediaUrl(previewAsset.url)} preload="metadata" controls className="w-full" />
                      </div>
                    ) : isVideoAsset(previewAsset) ? (
                      <video key={`${previewAsset.id}-${previewAsset.url}`} src={getVideoPlaybackUrl(previewAsset.url)} poster={getStaticMediaUrl(previewAsset.posterUrl, videoPosterVersion)} preload="metadata" className="h-full w-full max-h-full max-w-full object-contain shadow-[0_8px_30px_rgba(0,0,0,0.08)]" controls playsInline onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        if (!video.videoWidth || !video.videoHeight) return;
                        const dimensions = { width: video.videoWidth, height: video.videoHeight };
                        setPreviewAsset((current) => current && current.id === previewAsset.id ? { ...current, previewMeta: getPreviewMetaWithDimensions(current.previewMeta, dimensions, "video") } : current);
                        if (previewAsset.sessionId && previewAsset.messageId) updateMessageVideoDimensions(previewAsset.sessionId, previewAsset.messageId, dimensions);
                      }} />
                    ) : (
                      <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img key={`${previewAsset.id}-${previewAsset.url}`} ref={previewImageRef} src={getStaticMediaUrl(previewAsset.url)} alt={previewAsset.name} draggable={false} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); }} onLoad={(event) => {
                        const image = event.currentTarget;
                        const currentPreviewAsset = previewAssetRef.current;
                        if (!currentPreviewAsset || (currentPreviewAsset.id !== previewAsset.id && normalizeMediaUrlForMatch(currentPreviewAsset.url) !== normalizeMediaUrlForMatch(previewAsset.url))) return;
                        const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
                        setPreviewNaturalSize((current) => current.width === dimensions.width && current.height === dimensions.height ? current : dimensions);
                        requestAnimationFrame(() => updatePreviewFitScale(dimensions));
                        setPreviewAsset((current) => current && current.id === previewAsset.id ? { ...current, previewMeta: getPreviewMetaWithDimensions(current.previewMeta, dimensions, "image") } : current);
                        if (previewAsset.sessionId && previewAsset.messageId) updateMessageImageDimensions(previewAsset.sessionId, previewAsset.messageId, previewAsset.url, dimensions);
                      }} className="shrink-0 select-none object-contain shadow-[0_8px_30px_rgba(0,0,0,0.08)]" style={previewFitMode === "fit" ? { maxWidth: previewNaturalSize.width ? "none" : "100%", maxHeight: previewNaturalSize.height ? "none" : "100%", width: previewNaturalSize.width ? `${previewNaturalSize.width * previewFitScale}px` : "auto", height: "auto", transform: "translate3d(0, 0, 0)", transition: isPreviewDragging ? "none" : "transform 120ms ease-out" } : { maxWidth: "none", width: `${(previewNaturalSize.width || 2000) * visiblePreviewScale}px`, height: "auto", transform: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0)`, transition: isPreviewDragging ? "none" : "transform 120ms ease-out" }} />
                      </>
                    )}
                  </div>
                </div>
              </div>
              <aside className="flashmuse-preview-aside relative flex h-full w-[360px] shrink-0 flex-col border-l border-[#eceae6] bg-[#f8f7f4]" style={resolvedTheme === "dark" ? { backgroundColor: "#2a303c", borderColor: "var(--fm-border-subtle)" } : undefined}>
                {isReversePromptingPreview ? <PromptOptimizingOverlay /> : null}
                <div className="mx-9 shrink-0 border-b border-[#e4e2dd] pb-3 pt-7">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-[#111111]">{previewAsset.name}</div>
                    {previewDisplayMeta || previewSourceLabel ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] leading-5 text-[#8c8c8c]">
                        {previewDisplayMeta ? (
                          <>
                            <span className="truncate">{previewDisplayMeta.modelLabel}</span>
                            <span className="text-[#d0d0d0]">|</span>
                            <span>{previewDisplayMeta.ratio}</span>
                            <span className="text-[#d0d0d0]">|</span>
                            <span className="inline-flex items-center gap-1.5">
                              <span>{previewDisplayMeta.sizeText}</span>
                              <CompactResolutionIcon option={previewDisplayMeta.resolution} mode={previewDisplayMeta.mode} qualityBadgeLabel={previewDisplayMeta.qualityBadgeLabel} />
                            </span>
                            {previewDisplayMeta.styleLabel ? (
                              <>
                                <span className="text-[#d0d0d0]">|</span>
                                <span>{previewDisplayMeta.styleLabel}</span>
                              </>
                            ) : null}
                            {previewDisplayMeta.duration ? (
                              <>
                                <span className="text-[#d0d0d0]">|</span>
                                <span>{previewDisplayMeta.duration}</span>
                              </>
                            ) : null}
                          </>
                        ) : null}
                        {previewSourceLabel ? <span>{previewSourceLabel}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={`min-h-0 flex-1 overflow-y-auto px-9 pb-8 pt-4 transition ${isReversePromptingPreview ? "pointer-events-none opacity-45 grayscale-[0.15]" : ""}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#8b8b8b]">
                      <RiInformationLine className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>图片提示词</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                    {previewHasUsablePrompt ? (
                      <button type="button" disabled={isReversePromptingPreview} onClick={() => void copyPreviewPrompt()} className="inline-flex h-[26px] w-[26px] items-center justify-center bg-transparent p-0 text-[#777777] transition hover:text-[#111111] disabled:cursor-not-allowed disabled:opacity-45" aria-label="复制提示词">
                        {previewPromptCopyState === "success" ? <RiCheckLine className="h-5 w-5 text-[#777777]" aria-hidden="true" /> : previewPromptCopyState === "error" ? <RiCloseLine className="h-4 w-4 text-red-500" aria-hidden="true" /> : <RiCheckboxMultipleBlankLine className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    ) : null}
                    {previewHasUsablePrompt ? (
                      <button type="button" disabled={isReversePromptingPreview} onClick={() => {
                        if (!previewAsset.sourcePrompt.trim()) return;
                        setActiveDraftInput(previewAsset.sourcePrompt);
                        setActivePanel("chat");
                        setPreviewAsset(null);
                        requestAnimationFrame(() => editorRef.current?.focus());
                      }} className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-[5px] bg-black/46 px-1.5 font-medium leading-none text-white ring-1 ring-white/12 backdrop-blur-[10px] transition hover:bg-black/58 disabled:cursor-not-allowed disabled:opacity-45">
                        <RiTBoxLine className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[12px] leading-none">使用提示词</span>
                      </button>
                    ) : canReversePreviewPrompt ? (
                      <button type="button" disabled={isReversePromptingPreview} onClick={() => void reversePreviewPrompt()} className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-[5px] bg-[#367cee] px-1.5 font-medium leading-none text-white transition hover:bg-[#2f6fd4] disabled:cursor-not-allowed disabled:opacity-55">
                        <RiQuillPenAiLine className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[12px] leading-none">{isReversePromptingPreview ? "反推中" : "反推提示词"}</span>
                      </button>
                    ) : null}
                    </div>
                  </div>
                  {previewPromptErrorText ? <div className="mt-1.5 text-[14px] leading-6 text-red-500">{previewPromptErrorText}</div> : null}
                  <div className="mt-1.5 text-[14px] leading-6 text-[#333333]">{previewHasUsablePrompt ? previewAsset.sourcePrompt : "暂无提示词"}</div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
