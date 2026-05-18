"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject, type SVGProps } from "react";
import Image from "next/image";
import {
  RiAddLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiArrowUpLine,
  RiArrowUpSLine,
  RiArrowDownWideLine,
  RiAtLine,
  RiCheckLine,
  RiChat3Line,
  RiChatSmileAiLine,
  RiChatDeleteFill,
  RiChatDeleteLine,
  RiCheckboxCircleLine,
  RiCheckboxMultipleBlankLine,
  RiCloseLine,
  RiCoinsLine,
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
  RiMoreLine,
  RiMultiImageLine,
  RiMovie2Line,
  RiOpenaiFill,
  RiPencilLine,
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
  RiAccountBoxLine,
  RiFilmLine,
  Ri4kLine,
  RiInformationLine,
  RiGitMergeLine,
  RiGitPullRequestLine,
  RiFilmAiLine,
  RiGoogleFill,
  RiImageAddLine,
  RiImageAiLine,
  RiDownloadLine,
  RiRobot2Line,
  RiTBoxLine,
  RiTiktokFill,
  RiLogoutBoxRLine,
  RiSettings3Line,
  RiShieldUserLine,
  RiUserLine,
} from "react-icons/ri";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, getExpectedImageDimensions, getExpectedVideoDimensions, getImageQualityBadgeLabel, getImageResolutionLabel, getSupportedImageResolutions, getSupportedVideoRatios, getSupportedVideoResolutions, imageGenerationModels, isNonStandardVideoSize, normalizeImageResolutionForModel, normalizeVideoRatioForModel, normalizeVideoResolutionForModel, videoGenerationModels, type GenerationModel, type ModelName } from "@/lib/models";
import { toUserErrorMessage } from "@/lib/error-message";

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
  imageReferences?: ImageReference[];
  videoDimensions?: ImageDimensions;
  videoUrl?: string;
  videos?: string[];
  videoPrompts?: Record<string, string>;
  videoDimensionsMap?: Record<string, ImageDimensions>;
  statusText?: string;
  pendingImageCount?: number;
  failedImageCount?: number;
  retryingFailedImageIndexes?: number[];
  retryingFailedImageStartedAt?: Record<number, number>;
  pendingVideoCount?: number;
  failedVideoCount?: number;
  retryingFailedVideoIndexes?: number[];
  retryingFailedVideoStartedAt?: Record<number, number>;
  error?: string;
  mode?: WorkMode;
  generationMeta?: MessageGenerationMeta;
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
  | { type: "failed"; retryingStartedAt?: number };

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
  type: AssetType;
  name: string;
  url: string;
  sourcePrompt: string;
  previewMeta?: PreviewMediaMeta;
  sessionId: string;
  messageId?: string;
  lockedType?: boolean;
  createdAt: number;
  deletedAt?: number;
  purgeAt?: number;
};

type UploadableImageAssetType = "character_image" | "scene_image" | "shot_image";

type AssetUploadSlot = {
  id: string;
  fileName: string;
  originalFileName: string;
  dataUrl: string;
  dimensions?: ImageDimensions;
  isDuplicate?: boolean;
  type: UploadableImageAssetType;
};

type ReminderMessage = {
  message: string;
  tone: "default" | "success";
  exiting?: boolean;
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
  imageReferences?: ImageReference[];
  referenceHint?: string;
  preserveOriginalInput?: boolean;
  assetTargetType?: AssetTargetType;
  agentGenerated?: boolean;
  agentDisplayText?: string;
  agentItemPrompts?: string[];
  agentItemSettings?: GenerationSettings[];
  retryFailedIndex?: number;
  needsIntentResolution?: boolean;
  sourceText?: string;
};

type WorkMode = "agent" | "image" | "video";

type UploadedImage = {
  id: string;
  name: string;
  url: string;
  referenceName?: string;
  source?: "upload" | "asset";
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
};

type ControlMenuName = "model" | "imageSettings" | "style" | "duration" | "imageCount";
type ModeMenuName = "mode";
type ActivePanel = "chat" | "workflow" | "assets";
type AssetFilter = "all" | AssetType;
type AssetMenuPlacement = "top" | "bottom";

type WorkSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  videoTask: VideoTaskState | null;
  draftInput?: string;
  uploadedFiles?: string[];
  uploadedImages?: UploadedImage[];
  pendingRequest?: PendingGeneration | null;
  pendingRequests?: PendingGeneration[];
  usageSummary?: UsageSummary;
};

type UsageSummary = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  usd: number;
};

type UsageMeta = Partial<UsageSummary>;

type WorkflowItem = {
  id: string;
  title: string;
  createdAt: number;
};

type ApiError = string | { message?: string };
type IntentMode = "image" | "video";
type ChatApiResponse = {
  content?: string;
  model?: string;
  suggestions?: SuggestionInput[];
  usage?: UsageMeta;
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
};
type AgentModelTier = "normal" | "advanced";

const STORAGE_KEY = "yinzao-sessions-v2";
const ASSETS_STORAGE_KEY = "yinzao-assets-v1";
const ACTIVE_SESSION_KEY = "yinzao-active-session-v1";
const WORKFLOW_STORAGE_KEY = "yinzao-workflows-v1";
const INPUT_SETTINGS_STORAGE_KEY = "yinzao-input-settings-v1";
const INTENT_MEMORY_KEY = "yinzao-intent-memory-v1";
const FEEDBACK_LOG_KEY = "yinzao-feedback-log-v1";
const ASSET_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PERSISTED_SESSIONS = 30;
const MAX_INTENT_MEMORY_RULES = 50;
const MAX_FEEDBACK_LOGS = 300;
const USD_TO_CNY_RATE = 7.2;
const MAX_UPLOADED_IMAGES = 10;
const MAX_SESSION_PENDING_REQUESTS = 10;
const MAX_DRAFT_INPUT_LENGTH = 2000;
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
const assetTypeLabels: Record<AssetType, string> = {
  character_image: "角色图片",
  scene_image: "场景图片",
  shot_image: "分镜图片",
  shot_video: "分镜视频",
  other: "待分类",
  trash: "回收站",
};
const assetTypeOrder: AssetType[] = ["character_image", "scene_image", "shot_image", "shot_video", "other", "trash"];
const mentionAssetTypes: AssetType[] = ["character_image", "scene_image", "shot_image", "other"];
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

const quickActions = [
  { title: "高级感产品海报", description: "适合电商主图、上新视觉和品牌海报" },
  { title: "扩写图片提示词", description: "把一句想法整理成完整可生成描述" },
  { title: "5 秒人物出场视频", description: "生成镜头、动作、氛围更完整的视频提示" },
  { title: "治愈系插画封面", description: "适合社媒封面、故事插图和视觉草案" },
];

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
const modeOptions: Array<{ label: string; value: WorkMode; icon: typeof RiImageLine }> = [
  { label: "Agent 模式", value: "agent", icon: RiAiIcon },
  { label: "图片生成", value: "image", icon: RiImageAiLine },
  { label: "视频生成", value: "video", icon: RiFilmAiLine },
];
const modeNoticeText: Record<WorkMode, { title: string; description: string }> = {
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

const generationModelOptions: Record<"image" | "video", readonly GenerationModel[]> = {
  image: imageGenerationModels,
  video: videoGenerationModels,
};

function getVideoDurationOptions(modelId: string) {
  return videoGenerationModels.find((model) => model.id === modelId)?.durations ?? durationOptions;
}

function getGenerationModelLabel(mode: WorkMode, modelId: string) {
  if (mode === "agent") return "";
  return generationModelOptions[mode].find((model) => model.id === modelId)?.label ?? modelId;
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

function getAgentGenerationModel(agentTier: AgentModelTier, generationMode: WorkMode, selectedGenerationModels: Record<"image" | "video", ModelName>, options?: { sourceText?: string; session?: WorkSession; feedbackLogs?: FeedbackLogEntry[] }) {
  if (generationMode === "image") {
    if (agentTier === "normal") return DEFAULT_IMAGE_MODEL;
    const dissatisfactionCount = getRecentUserDissatisfactionCount(options?.session, "image") + getFeedbackDissatisfactionCount(options?.session?.id ?? "", "image", options?.feedbackLogs ?? []);
    const slowCount = getRecentSlowComplaintCount(options?.session, "image");
    if (dissatisfactionCount >= 2) return "openai/gpt-5.4-image-2";
    if (slowCount >= 2) return "google/gemini-3.1-flash-image-preview";
    return selectedGenerationModels.image;
  }

  if (generationMode === "video") {
    if (isExplicit4KVideoRequest(options?.sourceText ?? "")) return "google/veo-3.1";
    if (agentTier === "normal") return DEFAULT_VIDEO_MODEL;
    const dissatisfactionCount = getRecentUserDissatisfactionCount(options?.session, "video") + getFeedbackDissatisfactionCount(options?.session?.id ?? "", "video", options?.feedbackLogs ?? []);
    const slowCount = getRecentSlowComplaintCount(options?.session, "video");
    if (dissatisfactionCount >= 2) return "bytedance/seedance-2.0";
    if (slowCount >= 2) return "bytedance/seedance-2.0-fast";
    return selectedGenerationModels.video;
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
  const constraints = plan?.constraints?.filter(Boolean) ?? [];
  const fallbackSubject = plan?.subject || text.replace(/(\d+|[一二两三四五六七八九十]{1,3})\s*张/g, "").trim();
  const qualityText = plan?.quality === "high" ? "高品质，精致细节，清晰画质" : "画面自然清晰";
  const basePrompt = plan?.prompt?.trim() || (mode === "image" ? `${qualityText}，${fallbackSubject}` : `${qualityText}，${fallbackSubject}，自然动作变化，镜头稳定流畅`);

  if (mode !== "image") return [basePrompt, ...constraints].filter(Boolean).join("，");

  return buildAgentSingleImagePrompt(basePrompt, constraints, text, plan);
}

function buildAgentSingleImagePrompt(basePrompt: string, constraints: string[], sourceText: string, plan?: AgentPlanResponse) {
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
    noPeopleScene ? "纯场景画面，没有任何人物、角色、行人、人影、剪影或人形主体" : undefined,
    noPeopleScene ? "画面主体只能是场景、环境、建筑、自然景观或空间氛围" : undefined,
    noPeopleScene ? "no people, no person, no human, no character, no figure, no silhouette, no man, no woman" : undefined,
    singleSubjectConstraint,
    noCollageRequested && !combinedLayout ? "不要拼图或合集" : undefined,
    singleSubjectConstraint ? "不要多人同框" : undefined,
  ];

  return [cleanedPrompt || basePrompt, ...hardConstraints].filter(Boolean).join("，");
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
  if (!plan?.items?.length) return undefined;

  const prompts = plan.items
    .map((item) => {
      if (!item.prompt?.trim()) return "";
      if (mode === "image") return buildAgentSingleImagePrompt(item.prompt, item.constraints ?? [], sourceText, { ...plan, prompt: item.prompt, constraints: item.constraints });
      if (mode === "video") return [item.prompt.trim(), ...(item.constraints ?? [])].filter(Boolean).join("，");
      return "";
    })
    .filter(Boolean);

  return prompts.length > 0 ? prompts : undefined;
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

function isWorkMode(value: unknown): value is WorkMode {
  return value === "agent" || value === "image" || value === "video";
}

function mergeValidModeSettings(current: Record<WorkMode, string>, stored: Partial<Record<WorkMode, string>> | undefined, validators: Record<WorkMode, readonly string[]>) {
  const next = { ...current };

  (["agent", "image", "video"] as WorkMode[]).forEach((modeName) => {
    const value = stored?.[modeName];
    if (value && validators[modeName].includes(value)) next[modeName] = value;
  });

  return next;
}

function getGenerationModelIcon(modelId: string) {
  if (modelId.startsWith("openai/")) return RiOpenaiFill;
  if (modelId.startsWith("google/")) return RiGoogleFill;
  if (modelId.startsWith("bytedance/") || modelId.startsWith("bytedance-seed/")) return RiTiktokFill;
  return null;
}

function isGoldGenerationModel(modelId: string) {
  return modelId === "openai/gpt-5.4-image-2" || modelId === "bytedance/seedance-2.0";
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

function UsageSummaryButton({ summary }: { summary?: UsageSummary }) {
  const safeSummary = normalizeUsageSummary(summary);
  const hasUsage = safeSummary.totalTokens > 0 || safeSummary.usd > 0;
  const cny = safeSummary.usd * USD_TO_CNY_RATE;

  return (
    <div className="group absolute right-4 top-1/2 -translate-y-1/2">
      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label="查看当前对话用量">
        <RiCoinsLine className="h-4.5 w-4.5" aria-hidden="true" />
      </button>
      <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 hidden min-w-[118px] rounded-[8px] bg-[#111111] px-2.5 py-1.5 text-[13px] leading-[18px] text-white shadow-[0_12px_28px_rgba(0,0,0,0.24)] group-hover:block">
        <div className="mb-0.5 whitespace-nowrap text-[11px] text-[#8f8f8f]">使用量</div>
        {hasUsage ? (
          <div className="space-y-0 whitespace-nowrap">
            <div>• Token {safeSummary.totalTokens.toLocaleString("en-US")}</div>
            <div>• {formatUsd(safeSummary.usd)}</div>
            <div>• {formatCny(cny)}</div>
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

function ResolutionOptionIcon({ option, highlighted = false }: { option: string; highlighted?: boolean }) {
  const colorClassName = highlighted ? "text-[#b8860b]" : "text-[#222222]";

  if (option === "480p" || option === "720p" || option === "1080p" || option === "4K") {
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

  if (option === "4K") {
    return <Ri4kLine className={`h-[22px] w-[22px] shrink-0 ${colorClassName}`} aria-hidden="true" />;
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

function getImageSizeText(message: Message, imageUrl?: string) {
  if (message.mode !== "image") return undefined;
  const imageDimensions = message.imageDimensions ?? {};

  if (imageUrl && imageDimensions[imageUrl]) {
    const dimensions = imageDimensions[imageUrl];
    return `${dimensions.width} × ${dimensions.height}`;
  }

  const sizeTexts = (message.images ?? [])
    .map((url) => imageDimensions[url])
    .filter((dimensions): dimensions is ImageDimensions => Boolean(dimensions))
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
    if (imageUrl) return message.imageDimensions?.[imageUrl];
    return (message.images ?? []).map((url) => message.imageDimensions?.[url]).find(Boolean);
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
  dimensions?: ImageDimensions;
};

function getImageVariantGroups(message: Message): ImageVariantGroup[] {
  const images = message.images ?? [];
  const imageDimensions = message.imageDimensions ?? {};
  const groups = new Map<string, ImageVariantGroup>();

  images.forEach((url) => {
    const dimensions = imageDimensions[url];
    const key = dimensions ? `${dimensions.width}x${dimensions.height}` : `unknown:${url}`;
    const group = groups.get(key);

    if (group) {
      group.images.push(url);
    } else {
      groups.set(key, { key, images: [url], dimensions });
    }
  });

  const meta = message.generationMeta;
  const expected = meta?.mode === "image" ? getExpectedImageDimensions(meta.model, meta.settings?.resolution, meta.settings?.ratio) : undefined;
  const score = (group: ImageVariantGroup) => {
    if (!expected || !group.dimensions) return Number.MAX_SAFE_INTEGER;
    return Math.abs(group.dimensions.width - expected.width) + Math.abs(group.dimensions.height - expected.height);
  };

  return Array.from(groups.values()).sort((a, b) => score(a) - score(b));
}

function getPreviewMetaWithDimensions(meta: PreviewMediaMeta | undefined, dimensions: ImageDimensions, mode: "image" | "video") {
  if (!meta) return meta;
  const resolution = mode === "image" ? getImageResolutionFromDimensions(dimensions) ?? meta.resolution : getVideoResolutionFromDimensions(dimensions) ?? meta.resolution;
  const sizeText = formatMediaSizeText(`${dimensions.width} × ${dimensions.height}`, mode === "video" && meta.nonStandardSize);

  return {
    ...meta,
    ratio: getCommonRatioLabel(dimensions.width, dimensions.height),
    sizeText,
    resolution,
    qualityBadgeLabel: mode === "image" ? getImageQualityBadgeLabel(resolution) : "",
  };
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
    <div className="mt-2 max-w-[1006px]">
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

function MediaPromptBlock({ message, references, onUsePrompt, copyState, displayImageUrl, variantIndex = 0, variantCount = 1, onPreviousVariant, onNextVariant }: { message: Message; references?: ImageReference[]; onUsePrompt: (message: Message) => void; copyState?: "success" | "error"; displayImageUrl?: string; variantIndex?: number; variantCount?: number; onPreviousVariant?: () => void; onNextVariant?: () => void }) {
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
          <ReferencedTextContent content={message.content} references={promptReferences} />
          {inlineCopyButton}
          {shouldShowPromptOverlay ? <div className="pointer-events-none absolute bottom-0 right-0 h-7 w-16 bg-gradient-to-r from-white/0 via-white/90 to-white" /> : null}
        </div>
        {shouldShowPromptOverlay ? (
          <div className="pointer-events-none absolute -inset-x-4 -top-3 z-30 max-h-[250px] rounded-[12px] bg-white/88 px-4 pb-3 pt-3 text-[14px] leading-7 text-[#111111] opacity-0 shadow-[0_18px_36px_rgba(0,0,0,0.08)] backdrop-blur-[10px] transition-opacity delay-500 duration-200 group-hover/prompt:pointer-events-auto group-hover/prompt:opacity-100 group-hover/prompt:delay-0">
            {blockCopyButton}
            <div className="max-h-[198px] overflow-y-auto pr-2"><ReferencedTextContent content={message.content} references={promptReferences} /></div>
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
    <div className="flex min-h-[300px] items-start justify-start">
      <div className="flex items-center gap-2 px-0 py-1 text-sm text-[#6f6f6f]">
        <HaloPulseIndicator />
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
  return (
    <span className="yinzao-dot-grid mr-1" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="yinzao-dot-grid-item">
          <span className="yinzao-dot-grid-highlight" />
        </span>
      ))}
    </span>
  );
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
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group relative flex h-8 w-8 items-center justify-center rounded-md text-[#8a8a8a] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
    >
      {state === "success" ? <RiCheckLine className="h-4.5 w-4.5 text-[#111111]" aria-hidden="true" /> : state === "error" ? <RiCloseLine className="h-4.5 w-4.5 text-[#111111]" aria-hidden="true" /> : children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#111111] px-3 py-2 text-[12px] font-medium leading-none text-white opacity-0 shadow-[0_8px_18px_rgba(0,0,0,0.18)] transition group-hover:opacity-100">
        {label}
      </span>
    </button>
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
  const length = Array.from(content).length;
  if (length === 0) return 0;

  return Math.min(MAX_TYPING_DURATION_MS, Math.max(MIN_TYPING_DURATION_MS, length * 28));
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
  const characters = Array.from(displayContent);
  const [visibleCount, setVisibleCount] = useState(isComplete ? characters.length : 0);
  const visibleContent = isComplete ? displayContent : characters.slice(0, visibleCount).join("");

  useEffect(() => {
    const contentCharacters = Array.from(displayContent);

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

function createSession(): WorkSession {
  return {
    id: crypto.randomUUID(),
    title: "新对话",
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
  };
}

function addUsageSummary(current: UsageSummary | undefined, usage?: UsageMeta) {
  const safeUsage = normalizeUsageSummary(usage);
  if (safeUsage.totalTokens === 0 && safeUsage.usd === 0) return current;
  const safeCurrent = normalizeUsageSummary(current);

  return {
    promptTokens: safeCurrent.promptTokens + safeUsage.promptTokens,
    completionTokens: safeCurrent.completionTokens + safeUsage.completionTokens,
    totalTokens: safeCurrent.totalTokens + safeUsage.totalTokens,
    usd: safeCurrent.usd + safeUsage.usd,
  };
}

function formatUsd(value: number) {
  if (value <= 0) return "$0.0000";
  return `$${value < 0.0001 ? value.toFixed(6) : value.toFixed(4)}`;
}

function formatCny(value: number) {
  if (value <= 0) return "¥0.00 约";
  return `¥${value < 0.01 ? value.toFixed(4) : value.toFixed(2)} 约`;
}

function nowTimestamp() {
  return Date.now();
}

function getNextWorkflowTitle(items: WorkflowItem[]) {
  let nextIndex = 1;

  while (items.some((item) => item.title === `工作流_${String(nextIndex).padStart(2, "0")}`)) {
    nextIndex += 1;
  }

  return `工作流_${String(nextIndex).padStart(2, "0")}`;
}

function createWorkflowItem(items: WorkflowItem[]): WorkflowItem {
  return {
    id: crypto.randomUUID(),
    title: getNextWorkflowTitle(items),
    createdAt: Date.now(),
  };
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
    if (!isEmptySession(session)) return true;
    if (hasEmptySession) return false;
    hasEmptySession = true;
    return true;
  });
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

function saveSessions(sessions: WorkSession[]) {
  const persistableSessions = getPersistableSessions(sessions);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistableSessions));
  } catch {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          persistableSessions.map((session) => ({
            ...session,
            uploadedImages: undefined,
            messages: session.messages.map((message) => ({ ...message, images: undefined })),
          })),
        ),
      );
    } catch {
      console.warn("会话历史保存失败，已保留上一次成功保存的历史。");
    }
  }
}

function getSessionTitle(text: string) {
  return text.length > 16 ? `${text.slice(0, 16)}...` : text;
}

function formatMessageTime(value?: number) {
  const date = new Date(value ?? Date.now());
  const pad = (item: number) => String(item).padStart(2, "0");

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatElapsedTime(startedAt?: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - (startedAt ?? now)) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getVideoWaitProgress(startedAt?: number, now = Date.now()) {
  const elapsedSeconds = Math.max(0, Math.floor((now - (startedAt ?? now)) / 1000));
  return Math.min(99, Math.max(1, Math.round((elapsedSeconds / 600) * 100)));
}

function isModelInfoQuestion(text: string) {
  const normalized = text.replace(/[\s，。？！?!.]/g, "");

  return /模型/.test(normalized) && /(什么|哪个|哪一个|哪种|用了|使用|当前|现在|是谁|名称|名字)/.test(normalized);
}

function normalizeIntentText(text: string) {
  return text.replace(/[\s，。？！?!.、；;：“”"'（）()]/g, "").toLowerCase();
}

function isAssetTargetType(value: unknown): value is AssetTargetType {
  return typeof value === "string" && assetTypeOrder.includes(value as AssetType);
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
      id: crypto.randomUUID(),
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
      content: message.content,
      images: message.images,
    }));
}

function toAgentPayloadMessages(messages: Message[], keepLatestUserImages: boolean): ChatPayloadMessage[] {
  const payload: ChatPayloadMessage[] = toChatPayloadMessages(messages).map((message) => ({
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

function normalizeMessageSuggestions(suggestions?: SuggestionInput[]) {
  const nextSuggestions = (suggestions ?? [])
    .map(normalizeSuggestionItem)
    .filter((suggestion): suggestion is SuggestionItem => Boolean(suggestion))
    .filter((suggestion, index, array) => array.findIndex((item) => item.label === suggestion.label) === index)
    .slice(0, 5);

  return nextSuggestions.length > 0 ? nextSuggestions : undefined;
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
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  if (type === "shot_image" || type === "shot_video") {
    const storyBase = extractStoryTitle(sourcePrompt) || "无名剧01";
    const shotNumber = extractShotNumber(sourcePrompt, storyBase, assets);
    return `${storyBase}_分镜${String(shotNumber).padStart(2, "0")}`;
  }

  const subjectName = extractAnimalOrPlantSubject(sourcePrompt);
  return subjectName || getNextNumberedBase(mode === "video" ? "video" : "image", assets);
}

function getNextAssetName(type: AssetType, sourcePrompt: string, assets: AssetItem[], mode: WorkMode = "image") {
  const baseName = getAssetBaseName(type, sourcePrompt, assets, mode);

  return getVersionedName(baseName, assets, type === "shot_image" || type === "shot_video");
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
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
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

  return `参考图顺序：${references.map((reference, index) => `参考图${index + 1}=@${reference.name}`).join("，")}。生成时必须分别保留这些参考图对应的主体、人物特征、服装和场景关系，不要把人物或场景替换成无关内容。`;
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

function getAllowedAssetTypes(asset: Pick<AssetItem, "type" | "url">): AssetType[] {
  return isVideoAsset(asset) ? ["shot_video", "other"] : ["character_image", "scene_image", "shot_image", "other"];
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

function normalizeStoredAssets(assets: AssetItem[]) {
  return assets.map((asset) => {
    const legacyType = asset.type as AssetType | "character" | "scene" | "video";
    if (asset.type === "trash") return asset;
    if (asset.lockedType && assetTypeOrder.includes(asset.type)) return asset;

    const mode: WorkMode = legacyType === "video" || legacyType === "shot_video" || /\.(mp4|webm|mov)(\?|$)/i.test(asset.url) ? "video" : "image";
    const type = getAssetTypeFromText(asset.sourcePrompt, mode);

    return {
      ...asset,
      type,
    };
  });
}

function extractAssetsFromSessions(sessions: WorkSession[], existingAssets: AssetItem[]) {
  let nextAssets = existingAssets;
  const knownUrls = new Set(existingAssets.map((asset) => asset.url));

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
        const name = getNextAssetName(type, sourcePrompt, nextAssets, mode);

        knownUrls.add(url);
        nextAssets = [
          ...nextAssets,
          {
            id: crypto.randomUUID(),
            type,
            name,
            url,
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
  return content
    .replace(/^```[\w-]*\s*$/gm, "")
    .replace(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, "")
    .trim();
}

function InlineAgentIcon() {
  return <RiAiIcon className="mr-1.5 inline-block h-5 w-5 align-[-3px] text-[#367cee]" />;
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
            <strong className="font-semibold text-[#111111]">{labeledListItem[1]}</strong>
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
                        <strong className="font-semibold text-[#111111]">{labeledItem[1]}</strong>
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

  value.split(/(@[^@\s，。！？；;、]+)/g).forEach((part) => {
    if (!part) return;

    if (part.startsWith("@") && validReferences.has(part.slice(1))) {
      const mention = document.createElement("span");
      mention.className = "text-[#4f7cff]";
      mention.dataset.mention = "true";
      mention.textContent = part;
      element.append(mention);
      return;
    }

    appendEditorText(element, part);
  });

  if (value.endsWith("\n")) {
    const trailingBreak = document.createElement("br");
    trailingBreak.dataset.trailingBreak = "true";
    element.append(trailingBreak);
  }
}

function PlainMentionEditor({
  value,
  disabled = false,
  validReferences,
  editorRef,
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
  onChange: (value: string) => void;
  onPasteImages: (files: File[]) => void;
  onSubmit: () => void;
  onAtTrigger: () => void;
  onAtClose: () => void;
  onLimit: () => void;
  onCursorChange: (offset: number) => void;
}) {
  const isComposingRef = useRef(false);

  const syncEditor = useCallback((nextValue: string, caretOffset?: number) => {
    const element = editorRef.current;
    if (!element) return;

    renderEditorContent(element, nextValue, validReferences);
    setSelectionTextOffset(element, caretOffset ?? nextValue.length);
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

    renderEditorContent(element, value, validReferences);
    setSelectionTextOffset(element, value.length);
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
        isComposingRef.current = true;
      }}
      onCompositionEnd={(event) => {
        if (disabled) return;
        isComposingRef.current = false;
        const element = event.currentTarget;
        commitInput(getEditableText(element), getSelectionTextOffset(element));
      }}
      onInput={(event) => {
        if (disabled) return;
        if (isComposingRef.current) return;
        const element = event.currentTarget;
        commitInput(getEditableText(element), getSelectionTextOffset(element));
      }}
      onPaste={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }

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
      }}
      onKeyDown={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
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
      }}
      onKeyUp={syncCursorFromDom}
      onMouseUp={syncCursorFromDom}
      onFocus={syncCursorFromDom}
      className={`relative z-10 min-h-10 max-h-[300px] w-full overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent px-2 py-1 text-[14px] leading-6 outline-none selection:bg-[#2f6df6] selection:text-white ${disabled ? "cursor-not-allowed text-[#999999] caret-transparent" : "text-[#111111] caret-[#111111]"}`}
    />
  );
}

function ReferencedTextContent({ content, references }: { content: string; references?: ImageReference[] }) {
  const safeReferences = references ?? [];
  const parts = content.split(/(@[^@\s，。！？；;、]+)/g);

  return (
    <span className="align-middle">
      {parts.map((part, index) => {
        const reference = part.startsWith("@") ? safeReferences.find((item) => item.name === part.slice(1)) : undefined;

        if (!reference) return <span key={`${part}-${index}`}>{part}</span>;

        return (
          <span key={`${part}-${index}`} className="mx-0.5 inline-flex items-center gap-1 align-middle text-[#4f7cff]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reference.url} alt={reference.name} className="inline-block h-[18px] w-[18px] rounded object-cover align-middle" />
            <span>{part}</span>
          </span>
        );
      })}
    </span>
  );
}

function UserMessageContent({ content, references }: { content: string; references?: ImageReference[] }) {
  return <ReferencedTextContent content={content} references={references} />;
}

function ReminderToast({ reminder, fixed = false }: { reminder: ReminderMessage; fixed?: boolean }) {
  const baseClass = fixed
    ? "pointer-events-none fixed left-1/2 top-20 z-50 inline-flex h-10 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
    : "pointer-events-none inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-medium leading-none text-white shadow-[0_8px_18px_rgba(0,0,0,0.18)]";
  const toneClass = reminder.tone === "success" ? "bg-[#75d06a]" : "bg-[#111111]";
  const animationClass = reminder.exiting ? "yinzao-asset-upload-tip-exit" : "yinzao-asset-upload-tip-enter";

  return (
    <div className={`${baseClass} ${toneClass} ${animationClass}`}>
      {reminder.tone === "success" ? <RiCheckboxCircleLine className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      <span>{reminder.message}</span>
    </div>
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
          className="relative h-[100px] w-[100px] overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] text-left"
          title={`@${reference.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reference.url} alt={reference.name} className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-2 text-left font-medium leading-4 text-white">
            <span className="text-[10px] leading-4">@{reference.name}</span>
          </span>
        </button>
      ))}
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
  openAssetMenuId,
  openAssetActionMenuId,
  assetMenuPlacement,
  onPreview,
  onUseAsset,
  onRename,
  onToggleMenu,
  onToggleActionMenu,
  onChangeType,
  onDelete,
  onRestore,
  onOpenUpload,
  now,
}: {
  assets: AssetItem[];
  assetFilter: AssetFilter;
  renderLimit: number;
  openAssetMenuId: string;
  openAssetActionMenuId: string;
  assetMenuPlacement: AssetMenuPlacement;
  onPreview: (asset: AssetItem) => void;
  onUseAsset: (asset: AssetItem) => void;
  onRename: (asset: AssetItem) => void;
  onToggleMenu: (assetId: string, button: HTMLButtonElement) => void;
  onToggleActionMenu: (assetId: string) => void;
  onChangeType: (assetId: string, type: AssetType) => void;
  onDelete: (assetId: string) => void;
  onRestore: (assetId: string) => void;
  onOpenUpload: () => void;
  now: number;
}) {
  const visibleTypes = assetFilter === "all" ? assetTypeOrder : [assetFilter];
  const title = assetFilter === "all" ? "全部资产" : assetTypeLabels[assetFilter];
  const canUploadImages = assetFilter !== "trash";
  let remainingRenderCount = renderLimit;
  const getRenderableAssets = (typeAssets: AssetItem[]) => {
    const count = Math.max(0, remainingRenderCount);
    const renderableAssets = typeAssets.slice(0, count);
    remainingRenderCount -= renderableAssets.length;
    return renderableAssets;
  };
  const renderAssetGrid = (typeAssets: AssetItem[]) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {typeAssets.map((asset) => (
        <div key={asset.id} className="group relative aspect-square overflow-visible bg-[#f4f4f4]">
          <button type="button" onClick={() => onPreview(asset)} className="block h-full w-full overflow-hidden bg-[#f4f4f4] text-left">
            {isVideoAsset(asset) ? (
              <video src={asset.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
            ) : (
              <Image src={asset.url} alt={asset.name} width={240} height={240} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
            )}
          </button>
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
            ) : (
              <>
                <button type="button" onClick={(event) => onToggleMenu(asset.id, event.currentTarget)} className="flex h-7 w-7 items-center justify-center rounded-md bg-black/35 text-white backdrop-blur-sm transition hover:bg-black/55" aria-label="资产分类">
                  <RiFolderLine className="h-4 w-4" aria-hidden="true" />
                </button>
                {openAssetMenuId === asset.id ? (
              <div className={assetMenuPlacement === "top" ? "absolute bottom-8 right-0 z-50 w-36 rounded-xl border border-[#eeeeee] bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)]" : "absolute right-0 top-8 z-50 w-36 rounded-xl border border-[#eeeeee] bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)]"}>
                {getAllowedAssetTypes(asset).map((type) => {
                  const AssetIcon = assetTypeIcons[type];

                  return (
                  <button key={type} type="button" onClick={() => onChangeType(asset.id, type)} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[10px] text-[#333333] hover:bg-[#f5f5f5]">
                    <AssetIcon className="h-3.5 w-3.5 shrink-0 text-[#777777]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[12px] leading-none">{assetTypeLabels[type]}</span>
                    {asset.type === type ? <RiCheckLine className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  </button>
                  );
                })}
              </div>
                ) : null}
              </>
            )}
          </div>
          <div className="absolute bottom-2 right-2" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => onToggleActionMenu(asset.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-white transition hover:bg-black/25" aria-label="资产操作">
              <RiMoreLine className="h-4 w-4" aria-hidden="true" />
            </button>
            {openAssetActionMenuId === asset.id ? (
              <div className="absolute bottom-8 right-0 z-50 w-32 rounded-xl border border-[#eeeeee] bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.16)]">
                <button type="button" onClick={() => onRename(asset)} className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]">
                  <RiPencilLine className="h-3.5 w-3.5 shrink-0 text-[#777777]" aria-hidden="true" />
                  <span className="text-[12px] leading-none">重命名</span>
                </button>
                <button type="button" onClick={() => (asset.type === "trash" ? onRestore(asset.id) : onDelete(asset.id))} className={asset.type === "trash" ? "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[#333333] hover:bg-[#f5f5f5]" : "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-red-500 hover:bg-red-50"}>
                  {asset.type === "trash" ? <RiResetRightLine className="h-3.5 w-3.5 shrink-0 text-[#777777]" aria-hidden="true" /> : <RiDeleteBinLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  <span className="text-[12px] leading-none">{asset.type === "trash" ? "恢复" : "删除"}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-2">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[26px] font-semibold tracking-[-0.02em] text-[#111111]">{title}</div>
          {canUploadImages ? (
            <button type="button" onClick={onOpenUpload} className="inline-flex h-8 shrink-0 items-center gap-1.5 bg-transparent px-0 py-0 font-medium leading-none text-[#367cee] transition hover:text-[#255fc3]" aria-label="上传图片">
              <RiUpload2Line className="h-4 w-4" aria-hidden="true" />
              <span className="text-[13px] leading-none">上传图片</span>
            </button>
          ) : null}
        </div>
        {assetFilter !== "trash" ? <div className="mt-2 text-sm leading-6 text-[#777777]">自动收集生成出的角色图片、场景图片、分镜图片和分镜视频。点击小图预览，左下角可引用资产，右上角可改分类，右下角可重命名或删除。</div> : null}
        {assetFilter === "trash" ? <div className="mt-2 text-sm leading-6 text-red-500">回收站中的内容将在30天后删除，不可恢复。</div> : null}
      </div>

      {assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8d8d8] bg-[#fafafa] px-6 py-12 text-center text-sm text-[#8a8a8a]">还没有生成资产。生成角色图、场景图或分镜图后会自动出现在这里。</div>
      ) : (
        visibleTypes.some((type) => assets.some((asset) => asset.type === type)) ? visibleTypes.map((type) => {
          const typeAssets = assets.filter((asset) => asset.type === type);
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
  onChangeName,
  onRestoreEmptyName,
  onClearName,
  onChangeType,
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
  onChangeName: (value: string) => void;
  onRestoreEmptyName: () => void;
  onClearName: () => void;
  onChangeType: (type: UploadableImageAssetType) => void;
  onSubmit: () => void;
}) {
  const filledSlots = slots.map((slot, index) => ({ slot, index })).filter((item) => item.slot.dataUrl);
  const activeSlot = slots[activeIndex]?.dataUrl ? slots[activeIndex] : filledSlots[0]?.slot;
  const hasImages = filledSlots.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/35 px-4">
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
        <div className="mt-1 text-[12px] leading-5 text-[#8a8a8a]">最多同时上传八张图片。点击图片位置后，下方会显示该图片的文件名和分类。</div>

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
                    <button type="button" onClick={() => onRemoveSlot(index)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-[6px] transition hover:bg-black/62" aria-label="移除图片">
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

        <div className="mt-4">
          <div className="mb-2 text-[12px] font-medium leading-none text-[#777777]">分类</div>
          <div className="inline-flex h-10 rounded-[10px] bg-[#f3f3f3] p-1">
            {assetUploadTypes.map((type) => {
              const AssetIcon = assetTypeIcons[type];
              const isActive = activeSlot?.type === type;

              return (
                <button key={type} type="button" disabled={!activeSlot?.dataUrl || isUploading} onClick={() => onChangeType(type)} className={isActive ? "inline-flex h-8 min-w-[92px] items-center justify-center gap-1.5 rounded-[8px] bg-white px-3 text-[#111111] shadow-sm" : "inline-flex h-8 min-w-[92px] items-center justify-center gap-1.5 rounded-[8px] px-3 text-[#777777] transition hover:text-[#333333] disabled:hover:text-[#777777]"}>
                  <AssetIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="text-[12px] font-medium leading-none">{assetTypeLabels[type]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto flex justify-end gap-2 pt-6">
          <button type="button" onClick={onClose} disabled={isUploading} className="h-9 w-20 rounded-lg border border-[#e0e0e0] px-4 text-[13px] font-medium text-[#777777] transition hover:bg-[#f7f7f7] disabled:pointer-events-none disabled:opacity-50">
            取消
          </button>
          <button type="button" onClick={onSubmit} disabled={!hasImages || isUploading} className="h-9 min-w-20 rounded-lg bg-[#111111] px-4 text-[13px] font-medium text-white transition hover:bg-[#252525] disabled:cursor-not-allowed disabled:bg-[#d7d7d7]">
            {isUploading ? "上传中..." : "确定上传"}
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

async function persistUploadedImagesForSend(images: UploadedImage[]) {
  return Promise.all(
    images.map(async (image) => {
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

function InlineVideoResult({ url, onPreview, onLoadedDimensions, rounded = false }: { url: string; onPreview: () => void; onLoadedDimensions?: (dimensions: ImageDimensions) => void; rounded?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const playVideo = () => {
    void videoRef.current?.play().catch(() => undefined);
  };

  const pauseVideo = () => {
    videoRef.current?.pause();
  };

  return (
    <button type="button" onClick={onPreview} className={`flex h-[360px] w-full max-w-full items-center justify-center overflow-hidden bg-[#f4f4f4] text-left ${rounded ? "rounded-[10px]" : ""}`}>
      <video
        ref={videoRef}
        src={url}
        className="block max-h-full max-w-full object-contain"
        controls
        loop
        muted
        playsInline
        preload="metadata"
        onMouseEnter={playVideo}
        onMouseLeave={pauseVideo}
        onFocus={playVideo}
        onBlur={pauseVideo}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (video.videoWidth && video.videoHeight) onLoadedDimensions?.({ width: video.videoWidth, height: video.videoHeight });
        }}
      />
    </button>
  );
}

function ImageResultThumb({ url, imageIndex, onPreview, onLoadedDimensions, rounded = false }: { url: string; imageIndex: number; onPreview: (url: string, index: number) => void; onLoadedDimensions?: (url: string, dimensions: ImageDimensions) => void; rounded?: boolean }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onPreview(url, imageIndex)}
      className={`group relative flex h-[250px] w-[250px] shrink-0 items-center justify-center overflow-hidden bg-[#f4f4f4] transition ${rounded ? "rounded-[10px]" : ""}`}
    >
      {!isLoaded ? (
        <div className="absolute left-4 top-4 z-10 inline-flex items-center text-[13px] font-medium leading-none text-[#777777]">
          <span>正在加载中</span>
          <InlineLoadingDots />
        </div>
      ) : null}
      <Image
        src={url}
        alt="生成图片"
        width={250}
        height={250}
        unoptimized
        loading="eager"
        fetchPriority="high"
        sizes="250px"
        className="max-h-full max-w-full object-contain transition group-hover:scale-[1.02]"
        style={{ width: "auto", height: "auto" }}
        onLoad={(event) => {
          setIsLoaded(true);
          const image = event.currentTarget;
          if (image.naturalWidth && image.naturalHeight) onLoadedDimensions?.(url, { width: image.naturalWidth, height: image.naturalHeight });
        }}
      />
    </button>
  );
}

function ImageResultStrip({ images, pendingCount, failedCount, retryingFailedIndexes = [], retryingFailedStartedAt = {}, createdAt, now, pageIndex = 0, onPageChange, onPreview, onLoadedDimensions, noPagination = false, rounded = false, onRetryFailed }: { images: string[]; pendingCount: number; failedCount: number; retryingFailedIndexes?: number[]; retryingFailedStartedAt?: Record<number, number>; createdAt?: number; now: number; pageIndex?: number; onPageChange?: (index: number) => void; onPreview: (url: string, index: number) => void; onLoadedDimensions?: (url: string, dimensions: ImageDimensions) => void; noPagination?: boolean; rounded?: boolean; onRetryFailed?: (failedIndex: number) => void }) {
  if (images.length + pendingCount + failedCount === 0) return null;
  const items = [
    ...images.map((url, imageIndex) => ({ type: "image" as const, url, imageIndex })),
    ...Array.from({ length: pendingCount }).map((_, pendingIndex) => ({ type: "pending" as const, pendingIndex })),
    ...Array.from({ length: failedCount }).map((_, failedIndex) => ({ type: "failed" as const, failedIndex })),
  ];
  const pageCount = noPagination ? 1 : Math.max(1, Math.ceil(items.length / 4));
  const safePageIndex = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const visibleItems = noPagination ? items : items.slice(safePageIndex * 4, safePageIndex * 4 + 4);
  const switchPage = (nextIndex: number) => onPageChange?.((nextIndex + pageCount) % pageCount);

  return (
    <div className="relative max-w-full pb-1">
      <div className="grid grid-cols-4 gap-0.5">
        {visibleItems.map((item) => {
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
            <div key={`failed-${item.failedIndex}`} className={`relative h-[250px] w-[250px] shrink-0 overflow-hidden bg-[#f3f3f3] text-[#777777] ${rounded ? "rounded-[10px]" : ""}`}>
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
      {!noPagination && pageCount > 1 ? (
        <div className="mt-2 flex justify-end">
          <span className="inline-flex items-center gap-0.5 px-0.5 py-0.5 text-[12px] font-medium leading-none text-[#777777]">
            <button type="button" onClick={() => switchPage(safePageIndex - 1)} className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[#777777] transition hover:bg-white hover:text-[#111111]" aria-label="上一页图片"><RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" /></button>
            <span className="min-w-7 text-center">{safePageIndex + 1}/{pageCount}</span>
            <button type="button" onClick={() => switchPage(safePageIndex + 1)} className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[#777777] transition hover:bg-white hover:text-[#111111]" aria-label="下一页图片"><RiArrowRightSLine className="h-4 w-4" aria-hidden="true" /></button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ImageResultSlotStrip({ slots, pendingCount, createdAt, now, pageIndex = 0, onPageChange, onPreview, onLoadedDimensions, noPagination = false, rounded = false, onRetryFailed }: { slots: ImageResultSlot[]; pendingCount: number; createdAt?: number; now: number; pageIndex?: number; onPageChange?: (index: number) => void; onPreview: (url: string, index: number) => void; onLoadedDimensions?: (url: string, dimensions: ImageDimensions) => void; noPagination?: boolean; rounded?: boolean; onRetryFailed?: (failedIndex: number) => void }) {
  if (slots.length + pendingCount === 0) return null;
  const items = [
    ...slots.map((slot, slotIndex) => ({ type: "slot" as const, slot, slotIndex })),
    ...Array.from({ length: pendingCount }).map((_, pendingIndex) => ({ type: "pending" as const, pendingIndex })),
  ];
  const pageCount = noPagination ? 1 : Math.max(1, Math.ceil(items.length / 4));
  const safePageIndex = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const visibleItems = noPagination ? items : items.slice(safePageIndex * 4, safePageIndex * 4 + 4);
  const switchPage = (nextIndex: number) => onPageChange?.((nextIndex + pageCount) % pageCount);

  return (
    <div className="relative max-w-full pb-1">
      <div className="grid grid-cols-4 gap-0.5">
        {visibleItems.map((item) => {
          if (item.type === "pending") {
            return <MediaWaitingCard key={`pending-${item.pendingIndex}`} createdAt={createdAt} now={now} isImage index={slots.length + item.pendingIndex + 1} rounded={rounded} />;
          }

          if (item.slot.type === "image") {
            return <ImageResultThumb key={`${item.slot.url}-${item.slotIndex}`} url={item.slot.url} imageIndex={item.slotIndex} onPreview={onPreview} onLoadedDimensions={onLoadedDimensions} rounded={rounded} />;
          }

          const failedIndex = slots.slice(0, item.slotIndex + 1).filter((slot) => slot.type === "failed").length - 1;
          if (item.slot.retryingStartedAt) {
            return <MediaWaitingCard key={`retrying-failed-${item.slotIndex}`} createdAt={item.slot.retryingStartedAt} now={now} isImage index={item.slotIndex + 1} rounded={rounded} />;
          }

          return (
            <div key={`failed-${item.slotIndex}`} className={`relative h-[250px] w-[250px] shrink-0 overflow-hidden bg-[#f3f3f3] text-[#777777] ${rounded ? "rounded-[10px]" : ""}`}>
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
      {!noPagination && pageCount > 1 ? (
        <div className="mt-2 flex justify-end">
          <span className="inline-flex items-center gap-0.5 px-0.5 py-0.5 text-[12px] font-medium leading-none text-[#777777]">
            <button type="button" onClick={() => switchPage(safePageIndex - 1)} className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[#777777] transition hover:bg-white hover:text-[#111111]" aria-label="上一页图片"><RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" /></button>
            <span className="min-w-7 text-center">{safePageIndex + 1}/{pageCount}</span>
            <button type="button" onClick={() => switchPage(safePageIndex + 1)} className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[#777777] transition hover:bg-white hover:text-[#111111]" aria-label="下一页图片"><RiArrowRightSLine className="h-4 w-4" aria-hidden="true" /></button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function VideoFailedCard({ rounded = false, onRetry }: { rounded?: boolean; onRetry?: () => void }) {
  return (
    <div className={`relative h-[360px] w-full max-w-full overflow-hidden bg-[#f3f3f3] text-[#777777] ${rounded ? "rounded-[10px]" : ""}`}>
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

function MediaWaitingCard({ createdAt, now, isImage, index, rounded = false }: { createdAt?: number; now: number; isImage: boolean; index?: number; rounded?: boolean }) {
  return (
    <div className={`${isImage ? "relative h-[250px] w-[250px] shrink-0 overflow-hidden bg-[#eaf7ff] text-sm text-[#4f6f86]" : "relative h-[360px] w-full max-w-full overflow-hidden bg-[#eaf7ff] text-sm text-[#4f6f86]"} ${rounded ? "rounded-[10px]" : ""}`}>
      <div className="absolute inset-0 animate-[yinzaoVideoWaiting_5s_ease-in-out_infinite] bg-[radial-gradient(circle_at_16%_22%,rgba(193,210,255,0.7),transparent_31%),radial-gradient(circle_at_42%_70%,rgba(188,177,255,0.46),transparent_34%),radial-gradient(circle_at_76%_34%,rgba(126,205,255,0.52),transparent_35%),radial-gradient(circle_at_86%_82%,rgba(174,247,241,0.5),transparent_31%),linear-gradient(120deg,#eef8ff_0%,#d8efff_36%,#edfaff_68%,#dcf8ff_100%)]" />
      <div className="absolute -left-20 top-8 h-48 w-48 animate-[yinzaoBlobOne_4.5s_ease-in-out_infinite] rounded-full bg-[#b8c8ff]/45 blur-3xl" />
      <div className="absolute -right-16 bottom-10 h-56 w-56 animate-[yinzaoBlobTwo_6s_ease-in-out_infinite] rounded-full bg-[#9eeef0]/50 blur-3xl" />
      <div className="absolute left-20 top-48 h-40 w-40 animate-[yinzaoBlobThree_5.5s_ease-in-out_infinite] rounded-full bg-[#b5e0ff]/55 blur-3xl" />
      <div className="absolute inset-0 animate-[yinzaoVideoShimmer_2.8s_ease-in-out_infinite] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_22%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.22),transparent_28%)]" />
      <div className="relative z-10 ml-3 mt-3 inline-flex rounded-md bg-black/12 px-2.5 py-1 text-xs font-medium text-black/75 backdrop-blur-sm">
        {getVideoWaitProgress(createdAt, now)}%{isImage ? "生成中" : "渲染中"}{index ? ` ${index}` : ""}
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

function readFileAsUploadedImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name || "粘贴图片",
        referenceName: getUploadedReferenceBaseName(file.name || "粘贴图片"),
        source: "upload",
        url: String(reader.result),
      });
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
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
  const [mode, setMode] = useState<WorkMode>("agent");
  const [agentModelTier, setAgentModelTier] = useState<AgentModelTier>("normal");
  const selectedModel: ModelName = agentModelTier === "advanced" ? ADVANCED_CHAT_MODEL : DEFAULT_CHAT_MODEL;
  const [activePanel, setActivePanel] = useState<ActivePanel>("chat");
  const [assetFilter, setAssetFilter] = useState<AssetFilter>("all");
  const [selectedRatios, setSelectedRatios] = useState<Record<WorkMode, string>>({
    agent: ratioOptions[0],
    image: ratioOptions[0],
    video: ratioOptions[0],
  });
  const [selectedResolutions, setSelectedResolutions] = useState<Record<WorkMode, string>>({
    agent: imageResolutionOptions[0],
    image: imageResolutionOptions[0],
    video: videoResolutionOptions[0],
  });
  const [selectedStyle] = useState(styleOptions[0]);
  const [selectedDurations, setSelectedDurations] = useState<Record<WorkMode, string>>({
    agent: durationOptions[0],
    image: durationOptions[0],
    video: durationOptions[0],
  });
  const [selectedImageCounts, setSelectedImageCounts] = useState<Record<WorkMode, string>>({
    agent: imageCountOptions[0],
    image: imageCountOptions[0],
    video: imageCountOptions[0],
  });
  const [selectedGenerationModels, setSelectedGenerationModels] = useState<Record<"image" | "video", ModelName>>({
    image: DEFAULT_IMAGE_MODEL,
    video: DEFAULT_VIDEO_MODEL,
  });
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [workflowItems, setWorkflowItems] = useState<WorkflowItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [openWorkflowMenuId, setOpenWorkflowMenuId] = useState("");
  const [openSessionMenuId, setOpenSessionMenuId] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [openMessageMenuId, setOpenMessageMenuId] = useState("");
  const [sessionMenuPlacement, setSessionMenuPlacement] = useState<"top" | "bottom">("bottom");
  const [renamingSessionId, setRenamingSessionId] = useState("");
  const [renameInput, setRenameInput] = useState("");
  const [renamingAssetId, setRenamingAssetId] = useState("");
  const [assetRenameInput, setAssetRenameInput] = useState("");
  const [openAssetMenuId, setOpenAssetMenuId] = useState("");
  const [openAssetActionMenuId, setOpenAssetActionMenuId] = useState("");
  const [assetMenuPlacement, setAssetMenuPlacement] = useState<AssetMenuPlacement>("bottom");
  const [atAssetFilter, setAtAssetFilter] = useState<AssetType>("character_image");
  const [isAtAssetMenuOpen, setIsAtAssetMenuOpen] = useState(false);
  const [openControlMenu, setOpenControlMenu] = useState<ControlMenuName | ModeMenuName | "">("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [modelInfoSessionId, setModelInfoSessionId] = useState("");
  const [completedTypingMessageIds, setCompletedTypingMessageIds] = useState<Set<string>>(() => new Set());
  const [intentMemoryRules, setIntentMemoryRules] = useState<IntentMemoryRule[]>([]);
  const [feedbackLogs, setFeedbackLogs] = useState<FeedbackLogEntry[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetRenderLimit, setAssetRenderLimit] = useState(ASSET_RENDER_PAGE_SIZE);
  const [isAssetUploadOpen, setIsAssetUploadOpen] = useState(false);
  const [assetUploadSlots, setAssetUploadSlots] = useState<AssetUploadSlot[]>(() => createAssetUploadSlots("character_image"));
  const [activeAssetUploadIndex, setActiveAssetUploadIndex] = useState(0);
  const [isAssetUploading, setIsAssetUploading] = useState(false);
  const [assetUploadTip, setAssetUploadTip] = useState<ReminderMessage | undefined>();
  const [previewAsset, setPreviewAsset] = useState<AssetItem | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewFitMode, setPreviewFitMode] = useState<"fit" | "actual">("fit");
  const [previewPan, setPreviewPan] = useState({ x: 0, y: 0 });
  const [previewNaturalSize, setPreviewNaturalSize] = useState({ width: 0, height: 0 });
  const [previewFitScale, setPreviewFitScale] = useState(1);
  const [previewThumbsNeedScroll, setPreviewThumbsNeedScroll] = useState(false);
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
  const [imageResultPageIndexes, setImageResultPageIndexes] = useState<Record<string, number>>({});
  const [agentPromptExpandedIds, setAgentPromptExpandedIds] = useState<Record<string, boolean>>({});
  const [agentPromptPageIndexes, setAgentPromptPageIndexes] = useState<Record<string, number>>({});
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewViewportRef = useRef<HTMLDivElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const previewThumbListRef = useRef<HTMLDivElement | null>(null);
  const previewDragStartRef = useRef({ pointerX: 0, pointerY: 0, panX: 0, panY: 0 });
  const runningRequestIdsRef = useRef<Set<string>>(new Set());
  const sendingSessionIdsRef = useRef<Set<string>>(new Set());
  const requestAbortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const stoppedRequestIdsRef = useRef<Set<string>>(new Set());
  const typingScrollFrameRef = useRef<number | null>(null);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const inputTipTimerRef = useRef<number | null>(null);
  const inputTipQueueRef = useRef<ReminderMessage[]>([]);
  const inputCurrentTipRef = useRef<ReminderMessage | undefined>(undefined);
  const showNextInputTipRef = useRef<(() => void) | null>(null);
  const assetUploadTipTimerRef = useRef<number | null>(null);
  const assetUploadTipQueueRef = useRef<ReminderMessage[]>([]);
  const assetUploadCurrentTipRef = useRef<ReminderMessage | undefined>(undefined);
  const showNextAssetUploadTipRef = useRef<(() => void) | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const selectedRatio = mode === "video" ? (selectedRatios.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(selectedGenerationModels.video, selectedRatios.video, selectedResolutions.video)) : selectedRatios[mode];
  const selectedResolution = mode === "image" ? normalizeImageResolutionForModel(selectedGenerationModels.image, selectedRatios.image === "智能比例" ? "智能比例" : selectedResolutions.image) : mode === "video" ? (selectedRatios.video === "智能比例" ? "720p" : normalizeVideoResolutionForModel(selectedGenerationModels.video, selectedResolutions.video)) : selectedResolutions[mode];
  const selectedImageCount = selectedImageCounts[mode];
  const selectedGenerationModel = mode === "agent" ? selectedModel : selectedGenerationModels[mode];
  const selectedGenerationModelLabel = mode === "agent" ? "" : getGenerationModelLabel(mode, selectedGenerationModel);
  const currentDurationOptions = getVideoDurationOptions(selectedGenerationModels.video);
  const selectedVideoDuration = currentDurationOptions.includes(selectedDurations.video) ? selectedDurations.video : currentDurationOptions[0];

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const messages = activeSession?.messages ?? initialMessages;
  const activeInput = activeSession?.draftInput ?? "";
  const activeInputLength = Array.from(activeInput).length;
  const toolbarRequiredWidth = mode === "agent" ? 800 : Math.min(1006, 610 + selectedGenerationModelLabel.length * 8 + (mode === "video" ? 90 : 70));
  const inputShellWidth = Math.max(toolbarRequiredWidth, 800 + Math.min(206, Math.max(0, activeInputLength - 650) * 0.42));
  const activeUploadedFiles = activeSession?.uploadedFiles ?? [];
  const activeUploadedImages = activeSession?.uploadedImages ?? [];
  const activeSessionIdValue = activeSession?.id ?? "";
  const activeConversationImageReferences = useMemo(() => getConversationImageReferences(messages), [messages]);
  const visibleAssetUploadSlots = normalizeAssetUploadSlots(assetUploadSlots, getDefaultAssetUploadType(assetFilter));
  const previewImageOptions = useMemo(() => {
    return messages.flatMap((message) => {
      if (message.role !== "assistant") return [];

      const imageItems = (message.images ?? []).map((url, imageIndex) => ({
        id: `${message.id}-${imageIndex}`,
        type: "other" as const,
        name: `生成图片${imageIndex + 1}`,
        url,
        sourcePrompt: getImageSourcePrompt(message, url),
        previewMeta: getPreviewMediaMeta(message, url),
        sessionId: activeSessionIdValue,
        messageId: message.id,
        createdAt: message.createdAt ?? 0,
      }));

      const videoItem = getMessageVideos(message).map((url, videoIndex) => ({
        id: `${message.id}-video-${videoIndex}`,
        type: "shot_video" as const,
        name: `生成视频${videoIndex + 1}`,
        url,
        sourcePrompt: message.videoPrompts?.[url] ?? message.generationMeta?.itemPrompts?.[videoIndex] ?? message.generationMeta?.originalPrompt ?? message.content,
        previewMeta: getPreviewMediaMeta(message),
        sessionId: activeSessionIdValue,
        messageId: message.id,
        createdAt: message.createdAt ?? 0,
      }));

      return [...imageItems, ...videoItem];
    });
  }, [activeSessionIdValue, messages]);
  const previewAssetId = previewAsset?.id;
  const validReferenceNames = getValidReferenceNames(assets, activeUploadedImages, activeConversationImageReferences);
  const hasConversation = messages.length > 0;
  const activeIsResolving = activeSession ? resolvingSessionIds.has(activeSession.id) : false;
  const activePendingRequests = getSessionPendingRequests(activeSession);
  const activePendingRequestCount = activePendingRequests.length;
  const activeHasMaxPendingRequests = activePendingRequestCount >= MAX_SESSION_PENDING_REQUESTS;
  const isThinking = activeIsResolving || activePendingRequests.some((request) => request.mode === "agent") || modelInfoSessionId === activeSession?.id;
  const activeIsSending = activeSession ? sendingSessionIds.has(activeSession.id) : false;

  useEffect(() => {
    if (!previewAsset || isVideoAsset(previewAsset)) return;
    const latest = previewImageOptions.find((item) => item.id === previewAsset.id || item.url === previewAsset.url);
    if (!latest || latest.sourcePrompt === previewAsset.sourcePrompt) return;
    const timer = window.setTimeout(() => {
      setPreviewAsset((current) => current && (current.id === previewAsset.id || current.url === previewAsset.url) ? { ...current, sourcePrompt: latest.sourcePrompt } : current);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [previewAsset, previewImageOptions]);

  const clampPreviewScale = useCallback((value: number) => Math.min(2.5, Math.max(0.1, Number(value.toFixed(2)))), []);
  const applyPreviewScale = useCallback((nextScale: number) => {
    setPreviewScale(clampPreviewScale(nextScale));
  }, [clampPreviewScale]);
  const visiblePreviewScale = previewFitMode === "fit" ? previewFitScale : previewScale;
  const previewScalePercent = `${Math.round(visiblePreviewScale * 100)}%`;

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
    const editor = editorRef.current;
    if (!editor) return;
    if (draftCursorOffset < activeInput.length) return;

    editor.scrollTop = editor.scrollHeight;
  }, [activeInput, draftCursorOffset]);

  useEffect(() => {
    if (!previewAssetId) return;
    const frame = window.requestAnimationFrame(() => {
      setPreviewFitMode("fit");
      setPreviewScale(1);
      setPreviewPan({ x: 0, y: 0 });
      setPreviewNaturalSize({ width: 0, height: 0 });
      setPreviewFitScale(1);
      setPreviewThumbsNeedScroll(false);
      setIsPreviewDragging(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [previewAssetId]);

  useEffect(() => {
    if (!previewAsset || previewImageOptions.length <= 2) return;

    const list = previewThumbListRef.current;
    if (!list) return;

    const updateThumbScrollState = () => {
      setPreviewThumbsNeedScroll(list.scrollHeight > list.clientHeight + 1);
    };

    updateThumbScrollState();
    const resizeObserver = new ResizeObserver(updateThumbScrollState);
    resizeObserver.observe(list);
    window.addEventListener("resize", updateThumbScrollState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateThumbScrollState);
    };
  }, [previewAsset, previewImageOptions.length]);

  useEffect(() => {
    if (!previewAsset || previewImageOptions.length <= 2) return;

    requestAnimationFrame(() => {
      const list = previewThumbListRef.current;
      if (!list) return;

      const selected = list.querySelector<HTMLElement>(`[data-preview-thumb-id="${CSS.escape(previewAsset.id)}"]`) ?? Array.from(list.querySelectorAll<HTMLElement>("[data-preview-thumb-url]")).find((item) => item.dataset.previewThumbUrl === previewAsset.url);
      selected?.scrollIntoView({ block: "center", inline: "nearest" });
    });
  }, [previewAsset, previewImageOptions.length]);

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
    }, 2000);
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
    setOpenAssetMenuId("");
    setOpenAssetActionMenuId("");
  }, [assetFilter]);

  const closeAssetUploadDialog = useCallback(() => {
    if (isAssetUploading) return;
    setIsAssetUploadOpen(false);
  }, [isAssetUploading]);

  const selectAssetUploadFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      showAssetUploadTip("请选择图片文件");
      return;
    }

    try {
      const defaultType = getDefaultAssetUploadType(assetFilter);
      const newItems = await Promise.all(imageFiles.map(async (file) => {
        const dataUrl = await readFileAsDataUrl(file);
        return {
          fileName: getUploadedReferenceBaseName(file.name),
          dataUrl,
        };
      }));
      const newItemsWithDimensions = await Promise.all(newItems.map(async (item) => ({
        ...item,
        dimensions: await getDataUrlImageDimensions(item.dataUrl).catch(() => undefined),
      })));

      setAssetUploadSlots((current) => {
        const normalized = normalizeAssetUploadSlots(current, defaultType);
        const existingCount = normalized.filter((slot) => slot.dataUrl).length;
        const availableCount = Math.max(0, ASSET_UPLOAD_SLOT_COUNT - existingCount);
        const acceptedItems = newItemsWithDimensions.slice(0, availableCount);
        let itemIndex = 0;

        return normalized.map((slot) => {
          if (slot.dataUrl || itemIndex >= acceptedItems.length) return slot;
          const item = acceptedItems[itemIndex];
          itemIndex += 1;
          return { ...slot, fileName: item.fileName, originalFileName: item.fileName, dataUrl: item.dataUrl, dimensions: item.dimensions, isDuplicate: false };
        });
      });
      setActiveAssetUploadIndex((current) => {
        const normalized = normalizeAssetUploadSlots(assetUploadSlots, defaultType);
        const firstEmptyIndex = normalized.findIndex((slot) => !slot.dataUrl);
        return firstEmptyIndex >= 0 ? firstEmptyIndex : current;
      });
      if (newItemsWithDimensions.length > Math.max(0, ASSET_UPLOAD_SLOT_COUNT - assetUploadSlots.filter((slot) => slot.dataUrl).length)) showAssetUploadTip("最多同时上传8张");
    } catch (error) {
      showAssetUploadTip(toUserErrorMessage(error, "图片读取失败"));
    }
  }, [assetFilter, assetUploadSlots, showAssetUploadTip]);

  const removeAssetUploadSlot = useCallback((index: number) => {
    setAssetUploadSlots((current) => {
      const defaultType = getDefaultAssetUploadType(assetFilter);
      const normalized = normalizeAssetUploadSlots(current, defaultType);
      const kept = normalized.filter((_, slotIndex) => slotIndex !== index && normalized[slotIndex].dataUrl);
      return normalizeAssetUploadSlots(kept, defaultType);
    });
    setActiveAssetUploadIndex(0);
  }, [assetFilter]);

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

  const updateActiveAssetUploadType = useCallback((type: UploadableImageAssetType) => {
    setAssetUploadSlots((current) => normalizeAssetUploadSlots(current, getDefaultAssetUploadType(assetFilter)).map((slot, index) => (index === activeAssetUploadIndex ? { ...slot, type } : slot)));
  }, [activeAssetUploadIndex, assetFilter]);

  const submitAssetUpload = useCallback(async () => {
    const uploadItems = visibleAssetUploadSlots.filter((slot) => slot.dataUrl);
    if (uploadItems.length === 0 || isAssetUploading) return;

    setIsAssetUploading(true);

    try {
      const uploadedItems = await Promise.all(uploadItems.map(async (slot) => {
        const response = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: slot.dataUrl }),
        });
        const data = await readJson<{ url?: string }>(response);

        return {
          name: sanitizeAssetName(slot.fileName) || sanitizeAssetName(slot.originalFileName) || "上传图片",
          type: slot.type,
          url: data.url ?? "",
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
        setAssets((current) => {
          let nextAssets = current;

          newItems.forEach((item) => {
            if (nextAssets.some((asset) => asset.url === item.url)) return;
            const name = getVersionedName(item.name, nextAssets);
            nextAssets = [
              {
                id: crypto.randomUUID(),
                type: item.type,
                name,
                url: item.url,
                sourcePrompt: "资产管理上传",
                sessionId: activeSessionIdValue,
                lockedType: true,
                createdAt: Date.now(),
              },
              ...nextAssets,
            ];
          });

          return nextAssets;
        });
      }

      if (duplicateItems.length > 0) {
        const defaultType = getDefaultAssetUploadType(assetFilter);
        setAssetUploadSlots(normalizeAssetUploadSlots(duplicateItems.map((item) => ({ ...item.slot, isDuplicate: true })), defaultType));
        setActiveAssetUploadIndex(0);
        if (newItems.length > 0) showAssetUploadTip(`成功上传${newItems.length}张图片`, "success");
        showAssetUploadTip("图片已存在，无需要重复添加");
        return;
      }

      showAssetUploadTip(`成功上传${newItems.length}张图片`, "success");
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
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? { ...session, draftInput: nextValue } : session)));
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

  const addActiveUploadedImages = useCallback((images: UploadedImage[], options?: { draftBase?: string; draftSuffix?: string; insertReferenceText?: boolean }) => {
    if (images.length === 0) return;

    setSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSessionId) return session;

        const existingImages = session.uploadedImages ?? [];
        const availableCount = Math.max(0, MAX_UPLOADED_IMAGES - existingImages.length);
        const newImages = images.filter((image) => !existingImages.some((item) => item.url === image.url)).slice(0, availableCount);
        const nextUploadedImages = [...existingImages, ...newImages].slice(0, MAX_UPLOADED_IMAGES);
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
          uploadedFiles: undefined,
          uploadedImages: nextUploadedImages,
        };
      }),
    );
  }, [activeSessionId]);

  const removeActiveUploadedImage = useCallback((imageId: string) => {
    setSessions((current) => current.map((session) => (session.id === activeSessionId ? { ...session, uploadedImages: (session.uploadedImages ?? []).filter((image) => image.id !== imageId) } : session)));
  }, [activeSessionId]);

  const markTypingComplete = useCallback((messageId: string) => {
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
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? (JSON.parse(stored) as WorkSession[]) : [];
        const savedSessions = Array.isArray(parsed) && parsed.length > 0 ? parsed : [createSession()];
        const nextSessions = getPersistableSessions(savedSessions);
        const storedWorkflows = window.localStorage.getItem(WORKFLOW_STORAGE_KEY);
        const parsedWorkflows = storedWorkflows ? (JSON.parse(storedWorkflows) as WorkflowItem[]) : [];
        const nextWorkflows = Array.isArray(parsedWorkflows) ? parsedWorkflows.filter((item) => item && typeof item.id === "string" && typeof item.title === "string") : [];
        const storedActiveSessionId = window.localStorage.getItem(ACTIVE_SESSION_KEY);
        const nextActiveSessionId = storedActiveSessionId && nextSessions.some((session) => session.id === storedActiveSessionId) ? storedActiveSessionId : nextSessions[0].id;
        const storedInputSettings = window.localStorage.getItem(INPUT_SETTINGS_STORAGE_KEY);
        const parsedInputSettings = storedInputSettings ? (JSON.parse(storedInputSettings) as StoredInputSettings) : null;
        if (parsedInputSettings) {
          const storedImageModel = parsedInputSettings.selectedGenerationModels?.image;
          const storedVideoModel = parsedInputSettings.selectedGenerationModels?.video;
          const nextVideoModel = storedVideoModel && videoGenerationModels.some((model) => model.id === storedVideoModel) ? storedVideoModel : DEFAULT_VIDEO_MODEL;
          const nextVideoResolution = normalizeVideoResolutionForModel(nextVideoModel, parsedInputSettings.selectedResolutions?.video);
          if (isWorkMode(parsedInputSettings.mode)) setMode(parsedInputSettings.mode);
          if (parsedInputSettings.agentModelTier === "normal" || parsedInputSettings.agentModelTier === "advanced") setAgentModelTier(parsedInputSettings.agentModelTier);
          setSelectedRatios((current) => ({
            ...mergeValidModeSettings(current, parsedInputSettings.selectedRatios, { agent: ratioOptions, image: ratioOptions, video: ["智能比例", ...getSupportedVideoRatios(nextVideoModel)] }),
            video: parsedInputSettings.selectedRatios?.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(nextVideoModel, parsedInputSettings.selectedRatios?.video, nextVideoResolution),
          }));
          setSelectedResolutions((current) => ({
            ...mergeValidModeSettings(current, parsedInputSettings.selectedResolutions, { agent: imageResolutionOptions, image: imageResolutionOptions, video: getSupportedVideoResolutions(nextVideoModel) }),
            video: nextVideoResolution,
          }));
          setSelectedDurations((current) => mergeValidModeSettings(current, parsedInputSettings.selectedDurations, { agent: durationOptions, image: durationOptions, video: getVideoDurationOptions(parsedInputSettings.selectedGenerationModels?.video ?? DEFAULT_VIDEO_MODEL) }));
          setSelectedImageCounts((current) => mergeValidModeSettings(current, parsedInputSettings.selectedImageCounts, { agent: imageCountOptions, image: imageCountOptions, video: imageCountOptions }));
          setSelectedGenerationModels((current) => ({
            image: storedImageModel && imageGenerationModels.some((model) => model.id === storedImageModel) ? storedImageModel : current.image,
            video: nextVideoModel,
          }));
        }
        setSessions(nextSessions);
        setWorkflowItems(nextWorkflows);
        setActiveSessionId(nextActiveSessionId);
        setCompletedTypingMessageIds(new Set(getAssistantMessageIds(nextSessions)));
        const storedIntentMemory = window.localStorage.getItem(INTENT_MEMORY_KEY);
        const parsedIntentMemory = storedIntentMemory ? (JSON.parse(storedIntentMemory) as IntentMemoryRule[]) : [];
        setIntentMemoryRules(Array.isArray(parsedIntentMemory) ? parsedIntentMemory.slice(0, MAX_INTENT_MEMORY_RULES) : []);
        const storedFeedbackLogs = window.localStorage.getItem(FEEDBACK_LOG_KEY);
        const parsedFeedbackLogs = storedFeedbackLogs ? (JSON.parse(storedFeedbackLogs) as FeedbackLogEntry[]) : [];
        setFeedbackLogs(Array.isArray(parsedFeedbackLogs) ? parsedFeedbackLogs.slice(0, MAX_FEEDBACK_LOGS) : []);
        const storedAssets = window.localStorage.getItem(ASSETS_STORAGE_KEY);
        const parsedAssets = storedAssets ? (JSON.parse(storedAssets) as AssetItem[]) : [];
        const savedAssets = Array.isArray(parsedAssets) ? normalizeStoredAssets(parsedAssets) : [];
        setAssets(extractAssetsFromSessions(nextSessions, savedAssets));
      } catch {
        const session = createSession();
        setSessions([session]);
        setWorkflowItems([]);
        setActiveSessionId(session.id);
        setCompletedTypingMessageIds(new Set(getAssistantMessageIds([session])));
        setIntentMemoryRules([]);
        setFeedbackLogs([]);
        setAssets([]);
      } finally {
        setIsLoaded(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    saveSessions(sessions);
  }, [isLoaded, sessions]);

  useEffect(() => {
    if (!isThinking) return;
    const frame = window.requestAnimationFrame(() => {
      setOpenControlMenu("");
      setIsAtAssetMenuOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isThinking]);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      const payload: StoredInputSettings = {
        mode,
        agentModelTier,
        selectedRatios,
        selectedResolutions,
        selectedDurations,
        selectedImageCounts,
        selectedGenerationModels,
      };
      window.localStorage.setItem(INPUT_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      window.localStorage.removeItem(INPUT_SETTINGS_STORAGE_KEY);
    }
  }, [agentModelTier, isLoaded, mode, selectedDurations, selectedGenerationModels, selectedImageCounts, selectedRatios, selectedResolutions]);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      window.localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(workflowItems));
    } catch {
      window.localStorage.removeItem(WORKFLOW_STORAGE_KEY);
    }
  }, [isLoaded, workflowItems]);

  useEffect(() => {
    if (!isLoaded || !activeSessionId) return;

    window.localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
  }, [activeSessionId, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      window.localStorage.setItem(INTENT_MEMORY_KEY, JSON.stringify(intentMemoryRules));
    } catch {
      window.localStorage.removeItem(INTENT_MEMORY_KEY);
    }
  }, [intentMemoryRules, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      window.localStorage.setItem(FEEDBACK_LOG_KEY, JSON.stringify(feedbackLogs));
    } catch {
      window.localStorage.removeItem(FEEDBACK_LOG_KEY);
    }
  }, [feedbackLogs, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      window.localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(assets));
    } catch {
      window.localStorage.removeItem(ASSETS_STORAGE_KEY);
    }
  }, [assets, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    const expiredAssets = assets.filter((asset) => asset.type === "trash" && asset.purgeAt && asset.purgeAt <= Date.now());
    if (expiredAssets.length === 0) return;

    expiredAssets.forEach((asset) => {
      fetch("/api/asset-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: asset.url }),
      }).catch(() => undefined);
    });

    const cleanupTimer = window.setTimeout(() => {
      setAssets((current) => current.filter((asset) => !(asset.type === "trash" && asset.purgeAt && asset.purgeAt <= Date.now())));
      setPreviewAsset((current) => (current && current.type === "trash" && current.purgeAt && current.purgeAt <= Date.now() ? null : current));
    }, 0);

    return () => window.clearTimeout(cleanupTimer);
  }, [assets, isLoaded, timerNow]);

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
    chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
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
      if (distanceToBottom < 520) {
        setAssetRenderLimit((current) => current + ASSET_RENDER_PAGE_SIZE);
      }
      return;
    }

    setShowScrollToBottom(distanceToBottom > 120);
  };

  const toggleSessionMenu = (sessionId: string, button: HTMLButtonElement) => {
    setOpenSessionMenuId((current) => {
      if (current === sessionId) return "";

      const rect = button.getBoundingClientRect();
      const menuHeight = 128;
      const reservedBottom = 32;
      setSessionMenuPlacement(window.innerHeight - rect.bottom < menuHeight + reservedBottom ? "top" : "bottom");

      return sessionId;
    });
  };

  const toggleWorkflowMenu = (workflowId: string, button: HTMLButtonElement) => {
    setOpenWorkflowMenuId((current) => {
      if (current === workflowId) return "";

      const rect = button.getBoundingClientRect();
      const menuHeight = 132;
      const reservedBottom = 24;
      setSessionMenuPlacement(window.innerHeight - rect.bottom < menuHeight + reservedBottom ? "top" : "bottom");

      return workflowId;
    });
  };

  const closeInputMenus = () => {
    setOpenControlMenu("");
    setIsAtAssetMenuOpen(false);
  };

  useEffect(() => {
    if (!openSessionMenuId) return;

    const closeMenu = () => setOpenSessionMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openSessionMenuId]);

  useEffect(() => {
    if (!openMessageMenuId) return;

    const closeMenu = () => setOpenMessageMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openMessageMenuId]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const closeMenu = () => setIsUserMenuOpen(false);
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!openAssetMenuId) return;

    const closeMenu = () => setOpenAssetMenuId("");
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [openAssetMenuId]);

  useEffect(() => {
    if (!openAssetActionMenuId) return;

    const closeMenu = () => setOpenAssetActionMenuId("");
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
    if (!isAtAssetMenuOpen) return;

    const closeMenu = () => setIsAtAssetMenuOpen(false);
    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [isAtAssetMenuOpen]);

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

  const renderControlMenu = (name: ControlMenuName, label: string, title: string, options: string[], value: string, onChange: (value: string) => void, icon?: typeof RiImageLine) => (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isThinking}
          onClick={() => {
            setIsAtAssetMenuOpen(false);
            setOpenControlMenu((current) => (current === name ? "" : name));
        }}
        className={`${toolButtonClassName} ${openControlMenu === name ? toolButtonActiveClassName : ""}`}
      >
        <ToolButtonLabel icon={icon} label={label} showChevron />
      </button>

      {openControlMenu === name ? (
        <div className="absolute bottom-full left-0 z-40 mb-2 min-w-[180px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
          <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">{title}</div>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpenControlMenu("");
              }}
              className={
                option === value
                  ? "my-[3px] flex h-11 w-full items-center justify-between whitespace-nowrap rounded-[8px] bg-[#f5f5f5] px-3 text-left text-[14px] font-medium text-[#111111]"
                  : "my-[3px] flex h-11 w-full items-center justify-between whitespace-nowrap rounded-[8px] px-3 text-left text-[14px] text-[#555555] hover:bg-[#f7f7f7]"
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
      ) : null}
    </div>
  );

  const renderModelMenu = () => {
    if (mode === "agent") return null;

    const options = generationModelOptions[mode];
    const SelectedModelIcon = getGenerationModelIcon(selectedGenerationModel);

    return (
      <div className="relative min-w-0" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          disabled={isThinking}
          onClick={() => {
            setIsAtAssetMenuOpen(false);
            setOpenControlMenu((current) => (current === "model" ? "" : "model"));
          }}
          className={`${toolButtonClassName} ${openControlMenu === "model" ? toolButtonActiveClassName : ""} w-max max-w-none shrink-0 justify-start whitespace-nowrap max-[820px]:w-9 max-[820px]:justify-center max-[820px]:px-0`}
          title={selectedGenerationModelLabel}
        >
          <span className="flex min-w-0 flex-nowrap items-center gap-2">
            {SelectedModelIcon ? <SelectedModelIcon className="h-[18px] w-[18px] shrink-0 text-[#777777]" aria-hidden="true" /> : <AiGenerate3dIcon />}
            <span className={`whitespace-nowrap font-medium max-[820px]:hidden ${isGoldGenerationModel(selectedGenerationModel) ? "text-[#b8860b]" : "text-[#777777]"}`}>{selectedGenerationModelLabel}</span>
            <RiArrowDownSLine className="h-3.5 w-3.5 shrink-0 text-[#8a8a8a] max-[820px]:hidden" aria-hidden="true" />
          </span>
        </button>

        {openControlMenu === "model" ? (
          <div className="absolute bottom-full left-0 z-40 mb-2 w-[300px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
            <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">选择模型</div>
            {options.map((option) => {
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
                    <span className={`min-w-0 truncate ${isGoldModel ? "text-[#b8860b]" : ""}`}>{option.label}</span>
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
          onClick={() => {
            setIsAtAssetMenuOpen(false);
            setOpenControlMenu((current) => (current === "imageSettings" ? "" : "imageSettings"));
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
          <div className={`absolute bottom-full left-0 z-40 mb-2 ${settingsMenuWidthClassName} rounded-[12px] bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]`}>
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
                    <ResolutionOptionIcon option={option} highlighted={mode === "image" && Boolean(getImageQualityBadgeLabel(option))} />
                    <span>{mode === "video" ? getVideoResolutionLabel(option) : getImageResolutionLabel(option)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 text-[13px] font-medium text-[#a0a0a0]">尺寸{isNonStandardVideoDimensions ? "（非标）" : ""}</div>
            <div className={`mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 ${isSmartSettings ? "opacity-45" : ""}`}>
              <div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4">
                <span className="text-[13px] font-medium text-[#9a9a9a]">W</span>
                <span className="text-[13px] font-medium text-[#111111]">{displayDimensions.width}</span>
              </div>
              <div className="flex h-[48px] w-[24px] items-center justify-center text-[#8a8a8a]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M4 4L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="flex h-[48px] items-center justify-between rounded-[12px] bg-[#f6f6f6] px-4">
                <span className="text-[13px] font-medium text-[#9a9a9a]">H</span>
                <span className="text-[13px] font-medium text-[#111111]">{displayDimensions.height}</span>
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

    const session = createSession();
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
  };

  const startNewWorkflow = () => {
    setOpenWorkflowMenuId("");
    setWorkflowItems((current) => [createWorkflowItem(current), ...current]);
  };

  const pinWorkflow = (workflowId: string) => {
    setOpenWorkflowMenuId("");
    setWorkflowItems((current) => {
      const target = current.find((item) => item.id === workflowId);
      if (!target) return current;
      return [target, ...current.filter((item) => item.id !== workflowId)];
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
    setWorkflowItems((current) => current.filter((item) => item.id !== workflowId));
  };

  const pinSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const target = current.find((session) => session.id === sessionId);
      if (!target) return current;
      return [target, ...current.filter((session) => session.id !== sessionId)];
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
      setWorkflowItems((current) => current.map((item) => (item.id === renamingSessionId ? { ...item, title } : item)));
    } else {
      setSessions((current) => current.map((item) => (item.id === renamingSessionId ? { ...item, title, updatedAt: Date.now() } : item)));
    }
    setRenamingSessionId("");
    setRenameInput("");
  };

  const cancelRenameSession = () => {
    setRenamingSessionId("");
    setRenameInput("");
  };

  const submitRenameAsset = () => {
    const name = assetRenameInput.trim();
    if (!name) return;

    setAssets((current) => current.map((asset) => (asset.id === renamingAssetId ? { ...asset, name } : asset)));
    setOpenAssetActionMenuId("");
    setRenamingAssetId("");
    setAssetRenameInput("");
  };

  const cancelRenameAsset = () => {
    setRenamingAssetId("");
    setAssetRenameInput("");
  };

  const deleteAsset = (assetId: string) => {
    setOpenAssetActionMenuId("");
    setOpenAssetMenuId("");
    setAssets((current) => current.map((asset) => (asset.id === assetId ? { ...asset, type: "trash", deletedAt: Date.now(), purgeAt: Date.now() + ASSET_TRASH_RETENTION_MS } : asset)));
    setPreviewAsset((current) => (current?.id === assetId ? { ...current, type: "trash", deletedAt: Date.now(), purgeAt: Date.now() + ASSET_TRASH_RETENTION_MS } : current));
  };

  const restoreAsset = (assetId: string) => {
    setOpenAssetActionMenuId("");
    setAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              type: isVideoAsset(asset) ? "other" : "other",
              deletedAt: undefined,
              purgeAt: undefined,
            }
          : asset,
      ),
    );
  };

  const deleteSession = (sessionId: string) => {
    setOpenSessionMenuId("");
    setSessions((current) => {
      const nextSessions = current.filter((session) => session.id !== sessionId);
      const safeSessions = nextSessions.length > 0 ? nextSessions : [createSession()];

      if (sessionId === activeSessionId || !safeSessions.some((session) => session.id === activeSessionId)) {
        setActiveSessionId(safeSessions[0].id);
      }

      return safeSessions;
    });
  };

  const appendAssistantMessage = useCallback((sessionId: string, payload: Partial<Message> & Pick<Message, "content">) => {
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
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: payload.content,
                    suggestions: normalizeMessageSuggestions(payload.suggestions),
                    createdAt: Date.now(),
                    requestId: payload.requestId,
                    images: payload.images,
                    imageResultSlots: payload.imageResultSlots,
                    imageDimensions: payload.imageDimensions,
                    imagePrompts: payload.imagePrompts,
                    imageReferences: payload.imageReferences,
                    videoDimensions: payload.videoDimensions,
                    videoUrl: payload.videoUrl,
                    videos: payload.videos,
                    videoPrompts: payload.videoPrompts,
                    videoDimensionsMap: payload.videoDimensionsMap,
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
                  id: crypto.randomUUID(),
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

  const appendImagesToAssistantMessage = useCallback((sessionId: string, requestId: string, imageUrls: string[], imageDimensions: Record<string, ImageDimensions> = {}, pendingCompleteCount = 1, imagePrompts: Record<string, string> = {}, retryFailedIndex?: number) => {
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
                        if (!message.imageResultSlots && !(message.failedImageCount ?? 0) && retryFailedIndex === undefined && !message.retryingFailedImageIndexes?.length) return undefined;
                        const currentSlots = message.imageResultSlots ?? [
                          ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: message.failedImageCount ?? 0 }).map((_, index) => ({ type: "failed" as const, retryingStartedAt: message.retryingFailedImageStartedAt?.[index] })),
                        ];
                        let failedOrdinal = -1;
                        const retryingSlotIndex = retryFailedIndex === undefined
                          ? currentSlots.findIndex((slot) => slot.type === "failed" && slot.retryingStartedAt)
                          : currentSlots.findIndex((slot) => {
                              if (slot.type !== "failed") return false;
                              failedOrdinal += 1;
                              return failedOrdinal === retryFailedIndex;
                            });
                        if (retryingSlotIndex >= 0 && imageUrls[0]) {
                          return currentSlots.flatMap((slot, index) => index === retryingSlotIndex ? imageUrls.map((url) => ({ type: "image" as const, url })) : [slot]);
                        }

                        return [...currentSlots, ...imageUrls.map((url) => ({ type: "image" as const, url }))];
                      })(),
                      imageDimensions: { ...(message.imageDimensions ?? {}), ...imageDimensions },
                      imagePrompts: { ...(message.imagePrompts ?? {}), ...imagePrompts },
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

  const markAssistantImageFailure = useCallback((sessionId: string, requestId: string, retryFailedIndex?: number) => {
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
                      failedImageCount: message.retryingFailedImageIndexes?.length ? message.failedImageCount : (message.failedImageCount ?? 0) + 1,
                      imageResultSlots: (() => {
                        const currentSlots = message.imageResultSlots ?? [
                          ...(message.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: message.failedImageCount ?? 0 }).map((_, index) => ({ type: "failed" as const, retryingStartedAt: message.retryingFailedImageStartedAt?.[index] })),
                        ];
                        let failedOrdinal = -1;
                        const retryingSlotIndex = retryFailedIndex === undefined
                          ? currentSlots.findIndex((slot) => slot.type === "failed" && slot.retryingStartedAt)
                          : currentSlots.findIndex((slot) => {
                              if (slot.type !== "failed") return false;
                              failedOrdinal += 1;
                              return failedOrdinal === retryFailedIndex;
                            });
                        if (retryingSlotIndex >= 0) {
                          return currentSlots.map((slot, index) => index === retryingSlotIndex ? { type: "failed" as const } : slot);
                        }

                        return [...currentSlots, { type: "failed" as const }];
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

  const appendVideoToAssistantMessage = useCallback((sessionId: string, requestId: string, videoUrl: string, prompt: string) => {
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

  const markAssistantVideoFailure = useCallback((sessionId: string, requestId: string) => {
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

  const addGeneratedAssets = useCallback((sessionId: string, mode: WorkMode, sourcePrompt: string, urls: string[], messageId?: string, assetTargetType?: AssetTargetType, contextText = "") => {
    if (urls.length === 0) return;

    setAssets((current) => {
      let nextAssets = current;
      const namingText = [sourcePrompt, contextText].filter(Boolean).join("\n");
      const type = getAssetTypeFromText(namingText || sourcePrompt, mode, assetTargetType);

      urls.forEach((url) => {
        if (!url || nextAssets.some((asset) => asset.url === url)) return;

        const name = getNextAssetName(type, namingText || sourcePrompt, nextAssets, mode);
        nextAssets = [
          {
            id: crypto.randomUUID(),
            type,
            name,
            url,
            sourcePrompt: namingText || sourcePrompt,
            sessionId,
            messageId,
            createdAt: Date.now(),
          },
          ...nextAssets,
        ];
      });

      return nextAssets;
    });
  }, []);

  const addUploadedImagesToAssets = useCallback((sessionId: string, images: UploadedImage[], contextText: string) => {
    if (images.length === 0) return;

    setAssets((current) => {
      let nextAssets = current;

      images.forEach((image) => {
        if (!image.url || nextAssets.some((asset) => asset.url === image.url)) return;

        const baseName = getUploadedImageReferenceName(image, images);
        const type = getUploadedAssetType(baseName, contextText);
        const name = getUniqueUploadedAssetName(baseName, nextAssets, image.url);

        nextAssets = [
          {
            id: crypto.randomUUID(),
            type,
            name,
            url: image.url,
            sourcePrompt: contextText || baseName,
            sessionId,
            createdAt: Date.now(),
          },
          ...nextAssets,
        ];
      });

      return nextAssets;
    });
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
        const [plan] = await Promise.all([
          fetch("/api/agent-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              model: selectedModel,
              messages: pendingRequest.messages,
            }),
          }).then((response) => readJson<AgentPlanResponse>(response)),
          new Promise((resolve) => window.setTimeout(resolve, MIN_AGENT_THINKING_MS)),
        ]);
        addSessionUsage(sessionId, plan.usage);

        if (plan.needsClarification || plan.intent === "clarify") {
          appendAssistantMessage(sessionId, {
            content: plan.clarifyQuestion?.trim() || "我需要再确认一下你的目标：你想让我继续聊创意、生成图片，还是生成视频？",
            suggestions: plan.suggestions,
            mode: "agent",
            requestId: pendingRequest.id,
          });
          return;
        }

        const generationMode: WorkMode = plan.intent === "image" || plan.intent === "video" ? plan.intent : "agent";
        const generationModel = getAgentGenerationModel(agentModelTier, generationMode, selectedGenerationModels, { sourceText, session: sessions.find((session) => session.id === sessionId), feedbackLogs });
        const agentSettings = getAgentGenerationSettingsFromPlan(plan, sourceText, generationMode, generationModel);
        const agentPrompt = generationMode === "image" || generationMode === "video" ? getAgentPromptFromPlan(plan, sourceText, generationMode) : undefined;
        const plannedItemPrompts = agentPrompt ? getAgentItemPromptsFromPlan(plan, sourceText, generationMode) : undefined;
        const agentItemPrompts = generationMode === "video" && agentPrompt && (!plannedItemPrompts?.length) && plan.count && plan.count > 1
          ? Array.from({ length: Math.min(20, Math.floor(plan.count)) }).map((_, index) => `${agentPrompt}，第 ${index + 1} 镜，只生成当前这一镜的一段视频`)
          : plannedItemPrompts;
        const agentItemSettings = generationMode === "video" ? getAgentVideoItemSettingsFromPlan(plan, agentSettings, generationModel) : undefined;
        const agentDisplayText = generationMode === "image" || generationMode === "video" ? getAgentDisplayTextFromPlan(plan, generationMode, sourceText) : undefined;
        const assetTargetType = getAssetTypeFromText([sourceText, plan.subject, ...(plan.constraints ?? [])].filter(Boolean).join("，"), generationMode);
        const nextPendingRequest: PendingGeneration = {
          ...pendingRequest,
          mode: generationMode,
          model: generationModel,
          promptModel: generationMode === "image" || generationMode === "video" ? selectedModel : undefined,
          prompt: agentPrompt,
          originalPrompt: agentPrompt,
          settings: generationMode === "agent" ? undefined : agentSettings,
          assetTargetType: assetTargetType === "other" ? undefined : assetTargetType,
          agentGenerated: generationMode === "image" || generationMode === "video",
          agentDisplayText,
          agentItemPrompts,
          agentItemSettings,
          needsIntentResolution: false,
        };

        updatePendingRequest(sessionId, pendingRequest.id, nextPendingRequest);

        if (generationMode === "image") {
          appendAssistantMessage(sessionId, {
            content: agentDisplayText ?? "",
            statusText: imageStatusLabels.creating,
            pendingImageCount: getImageCountValue(nextPendingRequest.settings?.imageCount, Number.POSITIVE_INFINITY),
            mode: generationMode,
            requestId: pendingRequest.id,
            imageReferences: pendingRequest.imageReferences,
            generationMeta: { mode: "image", model: nextPendingRequest.model, settings: nextPendingRequest.settings, preserveOriginalInput: nextPendingRequest.preserveOriginalInput, assetTargetType: nextPendingRequest.assetTargetType, originalPrompt: agentPrompt, agentGenerated: true },
          });
        }

        if (generationMode === "video") {
          appendAssistantMessage(sessionId, {
            content: agentDisplayText ?? "",
            statusText: videoStatusLabels.creating,
            pendingVideoCount: Math.max(1, agentItemPrompts?.length ?? Math.floor(plan.count ?? 1)),
            mode: generationMode,
            requestId: pendingRequest.id,
            imageReferences: pendingRequest.imageReferences,
            generationMeta: { mode: "video", model: nextPendingRequest.model, settings: nextPendingRequest.settings, preserveOriginalInput: nextPendingRequest.preserveOriginalInput, assetTargetType: nextPendingRequest.assetTargetType, originalPrompt: agentPrompt, agentGenerated: true, itemPrompts: agentItemPrompts },
          });
        }

        pendingRequest = nextPendingRequest;
      }

      let prompt = pendingRequest.prompt;

      if (!prompt) {
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
            }),
          });
          data = await readJson<ChatApiResponse>(retryResponse);
        }
        addSessionUsage(sessionId, data.usage);
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

        if (pendingRequest.mode === "agent") {
          appendAssistantMessage(sessionId, { content: prompt, suggestions: data.suggestions, mode: pendingRequest.mode, requestId: pendingRequest.id });
        }
      }

      if (pendingRequest.mode === "image" && prompt) {
        const sourceText = pendingRequest.sourceText ?? pendingRequest.messages[pendingRequest.messages.length - 1]?.content ?? "";
        const createImage = async (referenceImages?: string[], promptOverride = prompt) => {
          const imageResponse = await fetch("/api/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({
              prompt: promptOverride,
              model: pendingRequest.model,
              referenceImages,
              settings: pendingRequest.settings,
              count: 1,
            }),
          });

          return readJson<{ images?: string[]; imageDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta }>(imageResponse);
        };

        const createImageWithRetry = async (promptOverride = prompt) => {
          let imageData: { images?: string[]; imageDimensions?: Record<string, ImageDimensions>; usage?: UsageMeta };

          try {
            imageData = await createImage(pendingRequest.referenceImages, promptOverride);
          } catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (pendingRequest.preserveOriginalInput || !isRequestTooLargeError(message) || !pendingRequest.referenceImages?.length) throw error;

            updateAssistantMessageByRequestId(sessionId, pendingRequest.id, { statusText: "参考图过大，正在压缩副本后重试" });

            try {
              const retryImages = await compressReferenceImagesForRetry(pendingRequest.referenceImages, RETRY_IMAGE_SIDE, RETRY_IMAGE_QUALITY);
              imageData = await createImage(retryImages, promptOverride);
            } catch (retryError) {
              const retryMessage = retryError instanceof Error ? retryError.message : "";
              if (!isRequestTooLargeError(retryMessage)) throw retryError;

              const finalRetryImages = await compressReferenceImagesForRetry(pendingRequest.referenceImages, FINAL_RETRY_IMAGE_SIDE, FINAL_RETRY_IMAGE_QUALITY);
              imageData = await createImage(finalRetryImages, promptOverride);
            }
          }

          const nextImages = imageData.images ?? [];
          if (nextImages.length === 0) throw new Error("图片平台没有返回图片，请稍后再试。");
          return { images: nextImages, imageDimensions: imageData.imageDimensions ?? {}, usage: imageData.usage };
        };

        const imageCount = getImageCountValue(pendingRequest.settings?.imageCount, pendingRequest.agentGenerated ? Number.POSITIVE_INFINITY : 4);
        const contextText = pendingRequest.messages.map((message) => message.content).join("\n");

        const results = await Promise.allSettled(
          Array.from({ length: imageCount }).map(async (_, index) => {
            try {
              const itemPrompt = pendingRequest.agentGenerated ? pendingRequest.agentItemPrompts?.[index] ?? getAgentImageVariantPrompt(prompt, sourceText, index, imageCount) : prompt;
              const imageResult = await createImageWithRetry(itemPrompt);
              const resultImages = pendingRequest.agentGenerated ? imageResult.images.slice(0, 1) : imageResult.images;
              const resultDimensions = Object.fromEntries(resultImages.map((url) => [url, imageResult.imageDimensions[url]]).filter((item): item is [string, ImageDimensions] => Boolean(item[1])));
              addSessionUsage(sessionId, imageResult.usage);
              const imagePrompts = Object.fromEntries(resultImages.map((url) => [url, itemPrompt]));
              appendImagesToAssistantMessage(sessionId, pendingRequest.id, resultImages, resultDimensions, 1, imagePrompts, pendingRequest.retryFailedIndex);
              addGeneratedAssets(sessionId, pendingRequest.mode, itemPrompt, resultImages, undefined, pendingRequest.assetTargetType, contextText);
              return resultImages;
            } catch (error) {
              markAssistantImageFailure(sessionId, pendingRequest.id, pendingRequest.retryFailedIndex);
              throw error;
            }
          }),
        );

        const successCount = results.filter((result) => result.status === "fulfilled").length;
        const failureCount = results.length - successCount;

        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? prompt : prompt,
          statusText: undefined,
          pendingImageCount: 0,
          error: failureCount > 0 ? (successCount > 0 ? `有 ${failureCount} 张图片生成失败，其它图片已完成。` : resultErrorMessage(results) ?? "图片生成失败，请稍后再试。") : undefined,
          mode: pendingRequest.mode,
        });
      }

      if (pendingRequest.mode === "video" && prompt) {
        const createAndPollVideo = async (videoPrompt: string, itemSettings: GenerationSettings | undefined, itemIndex: number) => {
          let taskId = itemIndex === 0 ? pendingRequest.taskId : undefined;
          let videoUsageRecorded = false;

          const settings = itemSettings ?? pendingRequest.settings;

          if (!taskId) {
          const taskResponse = await fetch("/api/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: abortController.signal,
            body: JSON.stringify({ prompt: videoPrompt, model: pendingRequest.model, referenceImages: pendingRequest.referenceImages, settings }),
          });

          const taskData = await readJson<{ id?: string; polling_url?: string; pollingUrl?: string; usage?: UsageMeta }>(taskResponse);
          addSessionUsage(sessionId, taskData.usage);
          videoUsageRecorded = Boolean(taskData.usage);

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
            body: JSON.stringify({ taskId }),
          });

          const pollData = await readJson<{
            status?: string;
            content?: { video_url?: string };
            error?: { message?: string } | string;
            usage?: UsageMeta;
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
              addSessionUsage(sessionId, pollData.usage);
              videoUsageRecorded = Boolean(pollData.usage);
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

            appendVideoToAssistantMessage(sessionId, pendingRequest.id, pollData.content.video_url, videoPrompt);
            addGeneratedAssets(sessionId, pendingRequest.mode, videoPrompt, [pollData.content.video_url], undefined, pendingRequest.assetTargetType, pendingRequest.messages.map((message) => message.content).join("\n"));
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

        const videoPrompts = pendingRequest.agentGenerated ? pendingRequest.agentItemPrompts?.length ? pendingRequest.agentItemPrompts : [prompt] : [prompt];
        const results = await Promise.allSettled(
          videoPrompts.map(async (videoPrompt, index) => {
            try {
              return await createAndPollVideo(videoPrompt, pendingRequest.agentItemSettings?.[index], index);
            } catch (error) {
              markAssistantVideoFailure(sessionId, pendingRequest.id);
              throw error;
            }
          }),
        );

        const successCount = results.filter((result) => result.status === "fulfilled").length;
        const failureCount = results.length - successCount;

        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? prompt : prompt,
          statusText: failureCount > 0 && successCount === 0 ? "视频生成失败" : videoStatusLabels.succeeded,
          pendingVideoCount: 0,
          error: failureCount > 0 ? (successCount > 0 ? `有 ${failureCount} 个视频生成失败，其它视频已完成。` : resultErrorMessage(results) ?? "视频生成失败，请稍后再试。") : undefined,
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
          },
        });
      }
    } catch (error) {
      if (stoppedRequestIdsRef.current.has(pendingRequest.id) || (error instanceof DOMException && error.name === "AbortError")) return;
      const message = toUserErrorMessage(error);
      if (pendingRequest.mode === "video") {
        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? pendingRequest.prompt ?? "" : pendingRequest.prompt ?? "",
          error: message,
          statusText: "视频生成失败",
          mode: pendingRequest.mode,
        });
      } else if (pendingRequest.mode === "image") {
        updateAssistantMessageByRequestId(sessionId, pendingRequest.id, {
          content: pendingRequest.agentGenerated ? pendingRequest.agentDisplayText ?? pendingRequest.prompt ?? "" : pendingRequest.prompt ?? "",
          error: message,
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
  }, [addGeneratedAssets, addSessionUsage, agentModelTier, appendAssistantMessage, appendImagesToAssistantMessage, appendSystemMessage, appendVideoToAssistantMessage, clearPendingRequest, feedbackLogs, markAssistantImageFailure, markAssistantVideoFailure, selectedGenerationModels, selectedModel, sessions, updateAssistantMessageByRequestId, updatePendingRequest]);

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
    const availableUploadedImages = isSuggestionSend ? [] : activeUploadedImages;
    if ((!rawText && availableUploadedImages.length === 0) || !activeSession || (submitMode !== "agent" && activeHasMaxPendingRequests) || sendingSessionIdsRef.current.has(activeSession.id)) return;

    const sessionId = activeSession.id;
    setSessionSending(sessionId, true);
    let sendUploadedImages = availableUploadedImages;

    try {
      sendUploadedImages = await persistUploadedImagesForSend(availableUploadedImages);
    } catch {
      sendUploadedImages = availableUploadedImages;
    }

    const explicitImageReferences = getOrderedExplicitImageReferences(rawText, assets, sendUploadedImages, activeConversationImageReferences);
    const uploadedImageReferences = sendUploadedImages.map((image) => ({ name: getUploadedImageReferenceName(image, sendUploadedImages), url: image.url }));
    const recentReferenceImages = explicitImageReferences.length > 0 || uploadedImageReferences.length > 0 ? [] : getRecentReferenceImages(activeSession.messages, rawText);
    const recentImageReferences = recentReferenceImages.map((url, index) => ({ name: `图片${index + 1}`, url }));
    const namedImageReferences: ImageReference[] = (explicitImageReferences.length > 0 ? explicitImageReferences : uploadedImageReferences.length > 0 ? uploadedImageReferences : recentImageReferences)
      .filter((reference, index, array) => Boolean(reference.url) && array.findIndex((item) => item.url === reference.url) === index)
      .slice(0, MAX_UPLOADED_IMAGES);
    const referenceImages = namedImageReferences.map((reference) => reference.url);
    const referencedAssets = getReferencedAssets(rawText, assets);
    const displayImageReferences = (namedImageReferences.length > 0 ? namedImageReferences : referenceImages.map((url, index) => ({ name: `图片${index + 1}`, url }))).slice(0, MAX_UPLOADED_IMAGES);
    const text = rawText || getImageOnlyPrompt(submitMode);
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text, createdAt: nowTimestamp(), images: referenceImages.length > 0 ? referenceImages : undefined, imageReferences: displayImageReferences.length > 0 ? displayImageReferences : undefined };
    const optimisticMessages = [...activeSession.messages, userMessage];
    const isDirectGenerationMode = submitMode !== "agent";
    const visibleMessages = isDirectGenerationMode ? activeSession.messages : optimisticMessages;
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

    if (isModelInfoQuestion(text)) {
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
            model: selectedModel,
            mode: "agent",
            messages: [{ role: "user", content: "请返回一次模型探测结果。" }],
          }),
        });
        const data = await readJson<{ model?: string; usage?: UsageMeta }>(response);
        addSessionUsage(sessionId, data.usage);
        appendAssistantMessage(sessionId, {
          content: data.model
            ? `当前选择：${selectedModelLabel}（${selectedModel}）。本次实际路由到：${data.model}。`
            : `当前选择：${selectedModelLabel}（${selectedModel}）。本次没有返回实际路由模型。`,
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
      const payloadMessages = toAgentPayloadMessages(optimisticMessages, referenceImages.length > 0);
      if (referencedAssets.length > 0) {
        const lastUserMessage = [...payloadMessages].reverse().find((message) => message.role === "user");
        if (lastUserMessage) {
          lastUserMessage.content = `${lastUserMessage.content}${getAssetReferencesText(referencedAssets)}`;
        }
      }

      const pendingRequest: PendingGeneration = {
        id: crypto.randomUUID(),
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

    const generationMode: WorkMode = submitMode;

    const payloadMessages = toChatPayloadMessages(optimisticMessages);
    if (referencedAssets.length > 0) {
      const lastUserMessage = [...payloadMessages].reverse().find((message) => message.role === "user");
      if (lastUserMessage) {
        lastUserMessage.content = `${lastUserMessage.content}${getAssetReferencesText(referencedAssets)}`;
      }
    }

    const isAgentAutoGeneration = false;
    const assetTargetType = normalizedSuggestion?.assetTargetType ?? getAssetTypeFromText(text, generationMode);
    const generationModel = isAgentAutoGeneration ? getAgentGenerationModel(agentModelTier, generationMode, selectedGenerationModels, { sourceText: text, session: activeSession, feedbackLogs }) : generationMode === "image" ? selectedGenerationModels.image : generationMode === "video" ? selectedGenerationModels.video : selectedModel;
    const agentSettings = isAgentAutoGeneration ? getAgentGenerationSettings(text, generationMode, generationModel) : undefined;
    const generationResolution = agentSettings?.resolution ?? (generationMode === "image" ? normalizeImageResolutionForModel(generationModel, selectedResolutions[modeForSettings]) : generationMode === "video" ? (selectedRatios.video === "智能比例" ? "720p" : normalizeVideoResolutionForModel(generationModel, selectedResolutions.video)) : selectedResolutions[modeForSettings]);
    const generationRatio = agentSettings?.ratio ?? (generationMode === "video" ? (selectedRatios.video === "智能比例" ? "智能比例" : normalizeVideoRatioForModel(generationModel, selectedRatios.video, generationResolution)) : selectedRatios[modeForSettings]);
    const agentDisplayText = isAgentAutoGeneration ? getAgentMediaDisplayText(generationMode, text) : undefined;
    const pendingRequest: PendingGeneration = {
      id: crypto.randomUUID(),
      model: generationModel,
      promptModel: isAgentAutoGeneration ? selectedModel : undefined,
      mode: generationMode,
      prompt: generationMode === "image" || generationMode === "video" ? text : undefined,
      originalPrompt: generationMode === "image" || generationMode === "video" ? text : undefined,
      preserveOriginalInput: false,
      assetTargetType: assetTargetType === "other" ? undefined : assetTargetType,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      imageReferences: displayImageReferences.length > 0 ? displayImageReferences : undefined,
      referenceHint: getReferenceHint(namedImageReferences),
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
        generationMeta: { mode: "video", model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, assetTargetType: pendingRequest.assetTargetType, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated },
      });
    }

    setSessionSending(sessionId, false);
    void runGeneration(sessionId, pendingRequest);
  };

  const stopAgentThinking = () => {
    if (!activeSession) return;
    const agentRequests = getSessionPendingRequests(activeSession).filter((request) => request.mode === "agent");
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
              pendingRequests: getSessionPendingRequests(session).filter((request) => request.mode !== "agent"),
              messages: [
                ...session.messages,
                {
                  id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
    const pendingRequest: PendingGeneration = {
      id: crypto.randomUUID(),
      model: replayModel,
      promptModel: replayMeta?.agentGenerated ? (agentModelTier === "advanced" ? ADVANCED_CHAT_MODEL : DEFAULT_CHAT_MODEL) : undefined,
      mode: generationMode,
      prompt: generationMode === "image" || generationMode === "video" ? replayPrompt : undefined,
      originalPrompt: generationMode === "image" || generationMode === "video" ? replayPrompt : undefined,
      preserveOriginalInput: false,
      referenceImages: referenceImages && referenceImages.length > 0 ? referenceImages : undefined,
      imageReferences: replayImageReferences && replayImageReferences.length > 0 ? replayImageReferences : undefined,
      referenceHint: replayImageReferences && replayImageReferences.length > 0 ? getReferenceHint(replayImageReferences) : undefined,
      assetTargetType: replayMeta?.assetTargetType,
      agentGenerated: replayMeta?.agentGenerated,
      agentDisplayText: replayMeta?.agentGenerated ? message.content : undefined,
      agentItemPrompts: replayMeta?.itemPrompts,
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
        generationMeta: generationMode === "image" || generationMode === "video" ? { mode: generationMode, model: pendingRequest.model, settings: pendingRequest.settings, preserveOriginalInput: pendingRequest.preserveOriginalInput, assetTargetType: pendingRequest.assetTargetType, originalPrompt: pendingRequest.originalPrompt, agentGenerated: pendingRequest.agentGenerated } : undefined,
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
    const requestId = crypto.randomUUID();
    const retryStartedAt = Date.now();
    const pendingRequest: PendingGeneration = {
      id: requestId,
      model: meta.model,
      mode: meta.mode,
      prompt,
      originalPrompt: prompt,
      preserveOriginalInput: meta.preserveOriginalInput,
      referenceImages: message.imageReferences?.map((reference) => reference.url).filter(Boolean),
      imageReferences: message.imageReferences,
      referenceHint: message.imageReferences?.length ? getReferenceHint(message.imageReferences) : undefined,
      assetTargetType: meta.assetTargetType,
      agentGenerated: meta.agentGenerated,
      agentDisplayText: meta.agentGenerated ? message.content : undefined,
      agentItemPrompts: meta.mode === "video" ? [prompt] : undefined,
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
                        const currentSlots = item.imageResultSlots ?? [
                          ...(item.images ?? []).map((url) => ({ type: "image" as const, url })),
                          ...Array.from({ length: item.failedImageCount ?? 0 }).map(() => ({ type: "failed" as const })),
                        ];
                        return currentSlots.map((slot) => {
                          if (slot.type !== "failed") return slot;
                          failedOrdinal += 1;
                          return failedOrdinal === failedIndex ? { type: "failed" as const, retryingStartedAt: retryStartedAt } : slot;
                        });
                      })() : item.imageResultSlots,
                      retryingFailedImageIndexes: meta.mode === "image" ? Array.from(new Set([...(item.retryingFailedImageIndexes ?? []), failedIndex])) : item.retryingFailedImageIndexes,
                      retryingFailedImageStartedAt: meta.mode === "image" ? { ...(item.retryingFailedImageStartedAt ?? {}), [failedIndex]: retryStartedAt } : item.retryingFailedImageStartedAt,
                      retryingFailedVideoIndexes: meta.mode === "video" ? Array.from(new Set([...(item.retryingFailedVideoIndexes ?? []), failedIndex])) : item.retryingFailedVideoIndexes,
                      retryingFailedVideoStartedAt: meta.mode === "video" ? { ...(item.retryingFailedVideoStartedAt ?? {}), [failedIndex]: retryStartedAt } : item.retryingFailedVideoStartedAt,
                      error: undefined,
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
    const allowedCount = MAX_UPLOADED_IMAGES - activeUploadedImages.length;
    const allImageFiles = files.filter((file) => file.type.startsWith("image/"));
    const imageFiles = allImageFiles.slice(0, Math.max(0, allowedCount));

    if (allImageFiles.length > allowedCount) {
      showInputTip("@或上传最多支持10张图片");
    }

    if (imageFiles.length === 0) return;

    const images = await Promise.all(imageFiles.map(readFileAsUploadedImage));
    addActiveUploadedImages(images);
  }, [activeUploadedImages.length, addActiveUploadedImages, showInputTip]);

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
  const activeAtQuery = getAtQueryAtCursor(activeInput, draftCursorOffset);
  const hasMentionAssetImages = assets.some((asset) => mentionAssetTypes.includes(asset.type) && !isVideoAsset(asset));
  const atAssetSearch = activeAtQuery?.query ?? "";
  const atAssetGroups = activeAtQuery
    ? mentionAssetTypes.map((type) => ({
        type,
        assets: assets.filter((asset) => asset.type === type && !isVideoAsset(asset) && asset.name.includes(atAssetSearch)),
      }))
    : [];
  const hasAtAssetOptions = atAssetGroups.some((group) => group.assets.length > 0) && isAtAssetMenuOpen;
  const activeAtAssetGroup = atAssetGroups.find((group) => group.type === atAssetFilter && group.assets.length > 0) ?? atAssetGroups.find((group) => group.assets.length > 0);
  const insertAssetReference = (asset: AssetItem) => {
    if (activeUploadedImages.length >= MAX_UPLOADED_IMAGES && !activeUploadedImages.some((image) => image.url === asset.url)) {
      showInputTip("@或上传最多支持10张图片");
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
  const clearActiveInput = () => {
    closeInputMenus();
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
  const openMentionAssetMenu = () => {
    setOpenControlMenu("");
    if (!hasMentionAssetImages) {
      setIsAtAssetMenuOpen(false);
      showInputTip("当前资产库没有图片");
      return;
    }

    setIsAtAssetMenuOpen(true);
  };
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
                  id: crypto.randomUUID(),
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

  return (
    <section className={isSidebarCollapsed ? "grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white" : "grid h-screen min-h-screen grid-cols-1 overflow-hidden bg-white lg:grid-cols-[262px_minmax(0,1fr)]"}>
      <aside className={isSidebarCollapsed ? "hidden" : "hidden h-screen min-h-0 flex-col overflow-hidden border-r border-[#e5e5e5] bg-[#f9f9f9] px-3 py-4 lg:flex"}>
          <div className="mb-5 flex items-center gap-3 px-2">
          <div className="flex h-[50px] w-[50px] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home-assets/logo.png" alt="闪念 FlashMuse" className="h-[50px] w-[50px] object-contain" />
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/home-assets/logo-text.png" alt="闪念" className="w-auto object-contain" style={{ height: 26 }} />
            <div className="mt-1 whitespace-nowrap text-xs leading-4 text-[#8a8a8a]">AI影片助手</div>
          </div>
        </div>
        <div className="mb-[22px] space-y-[5px]">
          <button type="button" onClick={() => setActivePanel("chat")} className={activePanel === "chat" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#555555] transition hover:bg-[#ececec]"}>
            {activePanel === "chat" ? <RiChatSmileAiLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiChat3Line className="h-5 w-5 shrink-0 text-[#555555]" aria-hidden="true" />}
            <span className="text-[13px] leading-[1.2]">对话模式</span>
          </button>
          <button type="button" onClick={() => setActivePanel("workflow")} className={activePanel === "workflow" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#8a8a8a] transition hover:bg-[#ececec]"}>
            {activePanel === "workflow" ? <RiGitMergeLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiGitPullRequestLine className="h-5 w-5 shrink-0 text-[#8a8a8a]" aria-hidden="true" />}
            <span className="text-[13px] leading-[1.2]">工作流模式</span>
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] text-[#8a8a8a] ring-1 ring-[#e3e3e3]">未开放</span>
          </button>
          <button type="button" onClick={() => {
            setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
            setShowScrollToBottom(false);
            setActivePanel("assets");
            requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
          }} className={activePanel === "assets" ? "flex h-10 w-full items-center gap-2 rounded-lg bg-[#ececec] px-3 text-left font-medium text-[#111111]" : "flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left font-medium text-[#555555] transition hover:bg-[#ececec]"}>
            {activePanel === "assets" ? <RiFolderOpenLine className="h-5 w-5 shrink-0 text-[#111111]" aria-hidden="true" /> : <RiFolderLine className="h-5 w-5 shrink-0 text-[#555555]" aria-hidden="true" />}
            <span className="text-[13px] leading-[1.2]">资产管理</span>
          </button>
        </div>

        {activePanel === "assets" ? (
          <>
            <div className="mb-2 flex items-center justify-between px-2 text-xs text-[#8a8a8a]">
              <span>我的资产</span>
              <span>{assets.length}</span>
            </div>
            <div className="yinzao-chat-scroll -mr-3 min-h-0 flex-1 space-y-[3px] overflow-y-auto pb-px pl-px pr-3 pt-px">
              {[{ label: "全部资产", value: "all" as const, count: assets.length }, ...assetTypeOrder.map((type) => ({ label: assetTypeLabels[type], value: type, count: assets.filter((asset) => asset.type === type).length }))].map((item) => {
                const isActive = assetFilter === item.value;
                const AssetIcon = item.value === "all" ? RiFolderLine : assetTypeIcons[item.value];

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setAssetRenderLimit(ASSET_RENDER_PAGE_SIZE);
                      setAssetFilter(item.value);
                      requestAnimationFrame(() => chatScrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
                    }}
                    className={isActive ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 text-left" : "flex h-9 w-full items-center rounded-lg px-3 text-left transition hover:bg-[#ececec]"}
                  >
                    <AssetIcon className="mr-2 h-5 w-5 shrink-0 text-[#777777]" aria-hidden="true" />
                    <span className={isActive ? "min-w-0 flex-1 truncate text-[13px] font-medium text-[#111111]" : "min-w-0 flex-1 truncate text-[13px] font-medium text-[#333333]"}>{item.label}</span>
                    <span className="ml-2 text-[12px] text-[#9a9a9a]">{item.count}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between px-2 text-xs text-[#8a8a8a]">
              <span>{activePanel === "workflow" ? "我的工作流" : "历史对话"}</span>
              <span>{activePanel === "workflow" ? workflowItems.length : sessions.length}</span>
            </div>
            <button
              type="button"
              onClick={activePanel === "workflow" ? startNewWorkflow : startNewSession}
              className="relative mb-2 flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-[#cfcfcf] px-3 text-center font-medium text-[#111111] transition hover:border-[#b8b8b8] hover:bg-[#ececec]"
            >
              <span className="relative text-[13px] leading-[1.2]">
                <RiAddLine className="absolute right-full top-1/2 mr-2 h-5 w-5 -translate-y-1/2 text-[#111111]" aria-hidden="true" />
                {activePanel === "workflow" ? "新建工作流" : "新建对话"}
              </span>
            </button>
            <div className="yinzao-chat-scroll -mr-3 min-h-0 flex-1 space-y-[3px] overflow-y-auto pb-px pl-px pr-3 pt-px">
              {activePanel === "workflow" ? workflowItems.map((item) => {
                const isMenuOpen = openWorkflowMenuId === item.id;

                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenWorkflowMenuId("")}
                      className="flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"
                    >
                      <div className="min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]">{item.title}</div>
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
                          <RiPencilLine className="h-4 w-4 shrink-0" aria-hidden="true" />
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
              }) : sessions.map((session) => {
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
                  }}
                  className={
                    isActive
                      ? "flex h-9 w-full items-center rounded-lg bg-[#ececec] px-3 pr-10 text-left"
                      : "flex h-9 w-full items-center rounded-lg px-3 pr-10 text-left transition hover:bg-[#ececec]"
                  }
                >
                  {isSessionRunning ? <HaloPulseIndicator /> : null}
                  <div className={isActive ? "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#111111]" : "min-w-0 truncate text-[13px] font-medium leading-[1.2] text-[#333333]"}>{session.title}</div>
                </button>

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

                {isMenuOpen ? (
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
                      <RiPencilLine className="h-4 w-4 shrink-0" aria-hidden="true" />
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
            </div>
          </>
        )}
        <div className="relative mt-0 py-2.5">
          <div aria-hidden="true" style={{ position: "absolute", left: -12, right: -12, top: 0, height: 1, background: "#e5e5e5" }} />
          {isUserMenuOpen ? (
            <div onClick={(event) => event.stopPropagation()} className="absolute bottom-[58px] left-1/2 z-40 w-[222px] -translate-x-1/2 overflow-hidden rounded-[12px] border border-[#e0e0e0] bg-white pt-2 shadow-[0_10px_28px_rgba(0,0,0,0.12)]">
              <button type="button" className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                <RiUserLine className="h-4 w-4 text-[#777777]" aria-hidden="true" />
                <span style={{ fontSize: 13 }}>用户信息</span>
              </button>
              <button type="button" className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                <RiShieldUserLine className="h-4 w-4 text-[#777777]" aria-hidden="true" />
                <span style={{ fontSize: 13 }}>用户安全</span>
              </button>
              <button type="button" className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-[6px] px-2 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#e9e9e9]">
                <RiSettings3Line className="h-4 w-4 text-[#777777]" aria-hidden="true" />
                <span style={{ fontSize: 13 }}>设置</span>
              </button>
              <div className="mt-2 border-t border-[#e7e7e7] bg-[#f4f4f4]">
                <button type="button" className="flex h-14 w-full items-center gap-3 px-3 text-left text-[12px] font-medium text-[#333333] transition hover:bg-[#eeeeee]">
                  <RiLogoutBoxRLine className="h-4 w-4 text-[#777777]" aria-hidden="true" />
                  <span style={{ fontSize: 13 }}>退出登录</span>
                </button>
              </div>
            </div>
          ) : null}
          <button type="button" onClick={(event) => { event.stopPropagation(); setIsUserMenuOpen((current) => !current); }} className="mx-2 flex h-11 w-[calc(100%-16px)] items-center gap-3 rounded-lg px-2 text-left transition hover:bg-[#ececec]" style={{ transform: "translateY(4px)" }}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e5e5e5] text-[13px] font-medium text-[#777777]">
              U
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              <div className="truncate text-[13px] font-medium leading-4 text-[#333333]">用户头像</div>
              <div className="truncate text-[12px] leading-4 text-[#8a8a8a]">user@example.com</div>
            </div>
          </button>
        </div>
      </aside>

      <section className="flex h-screen min-h-screen flex-col bg-white">
        <div className="relative z-30 flex h-[56px] shrink-0 items-center justify-center border-b border-[#eeeeee] bg-white px-14">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            className="absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
            aria-label={isSidebarCollapsed ? "展开左侧栏" : "收起左侧栏"}
          >
            {isSidebarCollapsed ? <RiLayoutLeftLine className="h-[22px] w-[22px]" aria-hidden="true" /> : <RiLayoutLeft2Line className="h-[22px] w-[22px]" aria-hidden="true" />}
          </button>

          <div className="flex min-w-0 items-center gap-1.5 text-center">
            <div className="truncate text-[13px] font-medium leading-8 text-[#111111]">{activePanel === "assets" ? "资产管理" : activePanel === "workflow" ? "工作流模式" : activeSession?.title ?? "新对话"}</div>
            {activePanel === "chat" && activeSession ? (
              <button
                type="button"
                onClick={() => renameSession(activeSession.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#6f6f6f] transition hover:bg-[#f2f2f2] hover:text-[#111111]"
                aria-label="重命名当前对话"
              >
                <RiPencilLine className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {activePanel === "chat" ? <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-end"><UsageSummaryButton summary={activeSession?.usageSummary} /></div> : null}

        </div>

        <div className="relative flex-1 overflow-hidden">
          <div ref={chatScrollRef} onScroll={updateScrollToBottomButton} className="yinzao-chat-scroll h-full overflow-y-auto bg-white px-4 py-8 pb-6 sm:px-6 lg:px-8">
          {activePanel === "assets" ? (
            <AssetManagementPanel assets={assets} assetFilter={assetFilter} renderLimit={assetRenderLimit} openAssetMenuId={openAssetMenuId} openAssetActionMenuId={openAssetActionMenuId} assetMenuPlacement={assetMenuPlacement} now={timerNow} onOpenUpload={openAssetUploadDialog} onPreview={setPreviewAsset} onUseAsset={(asset) => {
              if (activeUploadedImages.length >= MAX_UPLOADED_IMAGES && !activeUploadedImages.some((image) => image.url === asset.url)) {
                showInputTip("@或上传最多支持10张图片");
                return;
              }

              setActivePanel("chat");
              const cursor = Math.min(Math.max(0, draftCursorOffset), activeInput.length);
              addActiveUploadedImages([toUploadedAssetReference(asset)], { draftBase: activeInput.slice(0, cursor), draftSuffix: activeInput.slice(cursor), insertReferenceText: true });
              focusEditorAt(cursor + asset.name.length + 2);
            }} onRename={(asset) => {
              setOpenAssetActionMenuId("");
              setRenamingAssetId(asset.id);
              setAssetRenameInput(asset.name);
            }} onToggleMenu={(assetId, button) => {
              setOpenAssetActionMenuId("");
              setOpenAssetMenuId((current) => {
                if (current === assetId) return "";

                const rect = button.getBoundingClientRect();
                const menuHeight = 168;
                const reservedBottom = 24;
                setAssetMenuPlacement(window.innerHeight - rect.bottom < menuHeight + reservedBottom ? "top" : "bottom");

                return assetId;
              });
            }} onToggleActionMenu={(assetId) => {
              setOpenAssetMenuId("");
              setOpenAssetActionMenuId((current) => (current === assetId ? "" : assetId));
            }} onChangeType={(assetId, type) => {
              setAssets((current) => current.map((asset) => (asset.id === assetId ? { ...asset, type, lockedType: true } : asset)));
              setOpenAssetMenuId("");
            }} onDelete={deleteAsset} onRestore={restoreAsset} />
          ) : activePanel === "workflow" ? (
            <div className="min-h-full bg-[#f3f3f3] bg-[linear-gradient(to_right,#e4e4e4_1px,transparent_1px),linear-gradient(to_bottom,#e4e4e4_1px,transparent_1px)] bg-[size:24px_24px]" />
          ) : !hasConversation ? (
            <div className="flex min-h-full flex-col items-center justify-center pb-8 pt-10 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f7f7f7] px-3 py-1.5 text-xs font-medium text-[#333333] ring-1 ring-[#e5e5e5]">
                <RiStarSmileLine className="h-3.5 w-3.5" aria-hidden="true" />
                AI 创作工作台
              </div>
              <div className="mb-3 text-[32px] font-semibold tracking-[-0.03em] text-[#111111] sm:text-[38px]">今天你有什么想做的？</div>
              <div className="max-w-2xl text-sm leading-7 text-[#6f6f6f]">
                你可以像聊天一样直接输入需求。图片、视频和生成结果都会在对话里连续显示，不再单独分栏。
              </div>

              <div className="mt-8 grid w-full max-w-3xl gap-3 sm:grid-cols-2">
                {quickActions.map((action, index) => (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => setActiveDraftInput(action.title)}
                    className="group rounded-2xl border border-[#e5e5e5] bg-white px-4 py-4 text-left transition hover:bg-[#f7f7f7]"
                  >
                    <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-[#f2f2f2] text-[#333333] transition group-hover:bg-[#e8e8e8]">
                      {index === 2 ? <RiMovie2Line className="h-4 w-4" aria-hidden="true" /> : <RiImageLine className="h-4 w-4" aria-hidden="true" />}
                    </div>
                    <div className="text-sm font-medium text-[#111111]">{action.title}</div>
                    <div className="mt-1 text-xs leading-5 text-[#6f6f6f]">{action.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-[1006px] space-y-12">
              {messages.map((message) => {
                const isLegacyAgentErrorNotice = message.role === "assistant" && message.mode === "agent" && Boolean(message.error) && message.content === message.error;

                if (message.role === "system" || isLegacyAgentErrorNotice) {
                  const noticeMode = message.mode ?? "agent";
                  const modeNoticeContent = `${modeNoticeText[noticeMode].title}，${modeNoticeText[noticeMode].description}`;
                  const isErrorNotice = Boolean(message.error);
                  const isModeNotice = message.content === modeNoticeContent;
                  const ModeIcon = isErrorNotice || !isModeNotice ? RiErrorWarningLine : modeOptions.find((option) => option.value === noticeMode)?.icon ?? RiRobot2Line;

                  return (
                    <div key={message.id} className={isErrorNotice ? "flex justify-start" : "flex justify-start border-t border-[#eeeeee] pt-4"}>
                      <div className={isErrorNotice ? "inline-flex max-w-full items-start gap-2 text-rose-500" : "inline-flex max-w-full items-start gap-2 text-[#9a9a9a]"}>
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

                const activeSuggestionMessageId = messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.mode === "agent" ? messages[messages.length - 1].id : "";
                const isAssistantMessageComplete = message.role !== "assistant" || message.mode === "image" || message.mode === "video" || completedTypingMessageIds.has(message.id);
                const messageType = getMessageType(message);
                const reaction = messageReactions[message.id];
                const issueFeedback = messageIssueFeedback[message.id];
                const activeMessagePendingRequest = activePendingRequests.find((request) => request.id === message.requestId);
                const imagePendingCount = message.mode === "image" ? Math.max(0, message.pendingImageCount ?? 0) : 0;
                const imageFailedCount = message.mode === "image" ? Math.max(0, message.failedImageCount ?? 0) : 0;
                const videoPendingCount = message.mode === "video" ? Math.max(0, message.pendingVideoCount ?? 0) : 0;
                const videoFailedCount = message.mode === "video" ? Math.max(0, message.failedVideoCount ?? 0) : 0;
                const isActiveVideoPending = activeMessagePendingRequest?.mode === "video" && videoPendingCount > 0 && !message.error;
                const isActiveImagePending = activeMessagePendingRequest?.mode === "image" && imagePendingCount > 0;
                const isActiveMediaPending = isActiveVideoPending || isActiveImagePending;
                const userImageReferences = message.role === "user" ? getDisplayImageReferences(message) : undefined;
                const isAgentMediaMessage = message.role === "assistant" && isAgentGeneratedMedia(message);
                const mediaPromptReferences = message.role === "assistant" && (message.mode === "image" || message.mode === "video") ? (message.imageReferences?.length ? message.imageReferences : getOrderedExplicitImageReferences(message.content, assets, [], activeConversationImageReferences)) : undefined;
                const imageVariantGroups = message.role === "assistant" && message.mode === "image" && !isAgentMediaMessage ? getImageVariantGroups(message) : [];
                const imageVariantCount = imageVariantGroups.length;
                const selectedImageVariantIndex = imageVariantCount > 0 ? Math.min(imageVariantIndexes[message.id] ?? 0, imageVariantCount - 1) : 0;
                const selectedImageVariant = imageVariantGroups[selectedImageVariantIndex];
                const displayedMessageImages = isAgentMediaMessage ? message.images ?? [] : selectedImageVariant?.images ?? message.images ?? [];
                const displayedMessageVideos = getMessageVideos(message);
                const agentPromptItems = isAgentMediaMessage ? getAgentMediaPromptItems(message) : [];
                const agentPromptPageIndex = Math.min(agentPromptPageIndexes[message.id] ?? 0, Math.max(0, agentPromptItems.length - 1));
                const imageResultPageKey = `${message.id}:${selectedImageVariantIndex}`;
                const imageResultPageIndex = imageResultPageIndexes[imageResultPageKey] ?? 0;
                const setImageVariantIndex = (nextIndex: number) => {
                  if (imageVariantCount <= 1) return;
                  setImageVariantIndexes((current) => ({
                    ...current,
                    [message.id]: (nextIndex + imageVariantCount) % imageVariantCount,
                  }));
                };
                const setImageResultPageIndex = (nextIndex: number) => {
                  setImageResultPageIndexes((current) => ({ ...current, [imageResultPageKey]: nextIndex }));
                };
                const setAgentPromptPageIndex = (nextIndex: number) => {
                  if (agentPromptItems.length <= 1) return;
                  setAgentPromptPageIndexes((current) => ({ ...current, [message.id]: (nextIndex + agentPromptItems.length) % agentPromptItems.length }));
                };

                return (
                <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={message.role === "user" ? "max-w-[78%]" : "flex max-w-full"}>
                    {false && message.role === "assistant" ? (
                      <div className="mt-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e5ddff] bg-[#f1ecff] text-[#6d4aff]">
                        <RiStarSmileLine className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                    ) : null}
                    <div className="min-w-0">
                    <div
                      className={
                        message.role === "user"
                          ? "rounded-xl bg-[#f4f4f4] px-5 py-3 text-sm leading-7 text-[#111111]"
                          : message.mode === "image" || message.mode === "video"
                            ? "px-0 py-1 text-sm leading-7 text-[#111111]"
                            : "px-0 py-1 text-sm leading-7 text-[#111111]"
                      }
                    >
                      {message.role === "assistant" ? (
                        message.mode === "agent" || isAgentMediaMessage ? (
                          isAgentMediaMessage ? <><InlineAgentIcon /><ReferencedTextContent content={message.content} references={mediaPromptReferences} /></> : <TypewriterFormattedMessage messageId={message.id} content={message.content} isComplete={isAssistantMessageComplete} onComplete={markTypingComplete} onTick={keepTypingInPlace} leadingIcon={<InlineAgentIcon />} />
                        ) : message.mode === "image" || message.mode === "video" ? <MediaPromptBlock message={message} references={mediaPromptReferences} onUsePrompt={(item) => void copyPrompt(item)} copyState={copyFeedback?.messageId === message.id ? copyFeedback.state : undefined} displayImageUrl={displayedMessageImages[0]} variantIndex={selectedImageVariantIndex} variantCount={imageVariantCount} onPreviousVariant={() => setImageVariantIndex(selectedImageVariantIndex - 1)} onNextVariant={() => setImageVariantIndex(selectedImageVariantIndex + 1)} /> : <TypewriterFormattedMessage messageId={message.id} content={message.content} isComplete={isAssistantMessageComplete} onComplete={markTypingComplete} onTick={keepTypingAtBottom} />
                      ) : (
                        <UserMessageContent content={message.content} references={userImageReferences} />
                      )}
                    </div>

                    {message.role === "user" ? (
                      <ReferenceThumbnailStrip references={userImageReferences} onUseReference={(reference) => {
                        if (activeUploadedImages.length >= MAX_UPLOADED_IMAGES && !activeUploadedImages.some((image) => image.url === reference.url)) {
                          showInputTip("@或上传最多支持10张图片");
                          return;
                        }

                        const cursor = Math.min(Math.max(0, draftCursorOffset), activeInput.length);
                        addActiveUploadedImages([{ id: crypto.randomUUID(), name: reference.name, referenceName: reference.name, url: reference.url, source: "asset" }], { draftBase: activeInput.slice(0, cursor), draftSuffix: activeInput.slice(cursor), insertReferenceText: true });
                        focusEditorAt(cursor + reference.name.length + 2);
                      }} />
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

                     {message.role === "assistant" && message.mode === "image" && isAssistantMessageComplete && ((message.images?.length ?? 0) > 0 || imagePendingCount > 0 || imageFailedCount > 0) ? (
                        <div className="mt-2">
                            {message.imageResultSlots ? (
                              <ImageResultSlotStrip slots={message.imageResultSlots} pendingCount={imagePendingCount} createdAt={message.createdAt} now={timerNow} pageIndex={imageResultPageIndex} onPageChange={setImageResultPageIndex} noPagination={isAgentMediaMessage} rounded={isAgentMediaMessage} onRetryFailed={(failedIndex) => retryFailedMedia(message, failedIndex)} onLoadedDimensions={(url, dimensions) => updateMessageImageDimensions(activeSession?.id ?? "", message.id, url, dimensions)} onPreview={(url, imageIndex) => setPreviewAsset({ id: `${message.id}-${selectedImageVariantIndex}-${imageIndex}`, type: "other", name: `生成图片${imageIndex + 1}`, url, sourcePrompt: getImageSourcePrompt(message, url), previewMeta: getPreviewMediaMeta(message, url), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                            ) : (
                              <ImageResultStrip images={displayedMessageImages} pendingCount={imagePendingCount} failedCount={imageFailedCount} retryingFailedIndexes={message.retryingFailedImageIndexes} retryingFailedStartedAt={message.retryingFailedImageStartedAt} createdAt={message.createdAt} now={timerNow} pageIndex={imageResultPageIndex} onPageChange={setImageResultPageIndex} noPagination={isAgentMediaMessage} rounded={isAgentMediaMessage} onRetryFailed={(failedIndex) => retryFailedMedia(message, failedIndex)} onLoadedDimensions={(url, dimensions) => updateMessageImageDimensions(activeSession?.id ?? "", message.id, url, dimensions)} onPreview={(url, imageIndex) => setPreviewAsset({ id: `${message.id}-${selectedImageVariantIndex}-${imageIndex}`, type: "other", name: `生成图片${imageIndex + 1}`, url, sourcePrompt: getImageSourcePrompt(message, url), previewMeta: getPreviewMediaMeta(message, url), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                            )}
                         </div>
                       ) : null}

                     {message.role === "assistant" && message.mode === "video" && isAssistantMessageComplete && (displayedMessageVideos.length > 0 || videoFailedCount > 0 || (isActiveVideoPending && videoPendingCount > 0)) ? (
                       <div className="mt-2 grid max-w-full grid-cols-2 gap-0.5">
                         {displayedMessageVideos.map((url, videoIndex) => (
                           <InlineVideoResult key={`${url}-${videoIndex}`} url={url} rounded={isAgentMediaMessage} onLoadedDimensions={(dimensions) => updateMessageVideoDimensions(activeSession?.id ?? "", message.id, dimensions)} onPreview={() => setPreviewAsset({ id: `${message.id}-video-${videoIndex}`, type: "shot_video", name: `生成视频${videoIndex + 1}`, url, sourcePrompt: message.videoPrompts?.[url] ?? message.generationMeta?.itemPrompts?.[videoIndex] ?? message.generationMeta?.originalPrompt ?? message.content, previewMeta: getPreviewMediaMeta(message), sessionId: activeSession?.id ?? "", messageId: message.id, createdAt: message.createdAt ?? Date.now() })} />
                         ))}
                         {Array.from({ length: isActiveVideoPending ? videoPendingCount : 0 }).map((_, pendingIndex) => (
                           <MediaWaitingCard key={`video-pending-${pendingIndex}`} createdAt={message.createdAt} now={timerNow} isImage={false} index={videoPendingCount > 1 ? displayedMessageVideos.length + pendingIndex + 1 : undefined} rounded={isAgentMediaMessage} />
                         ))}
                          {Array.from({ length: videoFailedCount }).map((_, failedIndex) => (
                            message.retryingFailedVideoIndexes?.includes(failedIndex) ? (
                              <MediaWaitingCard key={`video-retrying-failed-${failedIndex}`} createdAt={message.retryingFailedVideoStartedAt?.[failedIndex] ?? message.createdAt} now={timerNow} isImage={false} index={displayedMessageVideos.length + videoPendingCount + failedIndex + 1} rounded={isAgentMediaMessage} />
                            ) : (
                              <VideoFailedCard key={`video-failed-${failedIndex}`} rounded={isAgentMediaMessage} onRetry={() => retryFailedMedia(message, failedIndex)} />
                            )
                          ))}
                       </div>
                     ) : null}

                    {message.statusText && message.mode !== "video" && message.mode !== "image" && isAssistantMessageComplete ? (
                      isActiveMediaPending ? (
                        <div className={isActiveImagePending ? "mt-3 flex max-w-full flex-nowrap gap-0.5 overflow-x-auto pb-1" : "mt-3 grid max-w-full grid-cols-2 gap-0.5 pb-1"}>
                          {Array.from({ length: isActiveImagePending ? getImageCountValue(String(message.pendingImageCount ?? 1)) : Math.max(1, videoPendingCount) }).map((_, pendingIndex) => (
                            <MediaWaitingCard key={pendingIndex} createdAt={message.createdAt} now={timerNow} isImage={isActiveImagePending} index={(isActiveImagePending && (message.pendingImageCount ?? 1) > 1) || (!isActiveImagePending && videoPendingCount > 1) ? pendingIndex + 1 : undefined} rounded={isAgentMediaMessage} />
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

                    {message.error && isAssistantMessageComplete ? <div className="mt-3 text-sm text-rose-500">{message.error}</div> : null}
                    {message.role === "assistant" && isAssistantMessageComplete ? (
                      <>
                        <div className={message.mode === "image" || message.mode === "video" ? "mt-2 flex flex-wrap items-center gap-1.5" : "mt-3 flex flex-wrap items-center gap-1.5"}>
                          {message.mode === "agent" && messageType === "text" ? (
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
                            <FeedbackButton label="更多" onClick={() => setOpenMessageMenuId((current) => (current === message.id ? "" : message.id))}>
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
                          <span className="ml-[10px] text-[12px] leading-8 text-[#b0b0b0]">感谢反馈 {formatMessageTime(message.createdAt)}</span>
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
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  clearActiveInput();
                }}
                className="absolute -top-7 right-12 z-30 inline-flex items-center gap-1 bg-transparent px-0 py-0 font-medium leading-none text-[#8a8a8a] transition hover:text-[#111111]"
                aria-label="清空输入框"
              >
                <RiFormatClear className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-[11px] leading-none">清空输入框</span>
              </button>
            ) : null}
            <div className={`rounded-[26px] border-2 border-[#f1f2f2] bg-white/78 px-4 py-3 shadow-none backdrop-blur-[18px] transition focus-within:border-white/70 focus-within:shadow-[0_10px_32px_rgba(0,0,0,0.12)] ${isThinking ? "border-[#f4f4f4] bg-white/54" : ""}`}>
            <div className={isThinking ? "pointer-events-none opacity-45 grayscale-[0.15] transition" : "transition"}>
            {activeUploadedImages.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-2 px-2">
                {activeUploadedImages.map((image) => (
                  <div key={image.id} className={image.source === "asset" ? "group relative h-[60px] w-[60px] overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]" : "group relative h-[100px] w-[100px] overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f7f7f7]"}>
                        <Image src={image.url} alt={image.name} width={100} height={100} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                    <button
                      type="button"
                      disabled={isThinking}
                      onClick={() => removeActiveUploadedImage(image.id)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                      aria-label="移除图片"
                    >
                      <RiCloseLine className="h-3 w-3" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={isThinking}
                      onClick={() => {
                        insertTextAtDraftCursor(`@${getUploadedImageReferenceName(image, activeUploadedImages)} `);
                      }}
                      className="absolute inset-x-0 bottom-0 block truncate bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-0.5 pt-2 text-left font-medium leading-4 text-white transition"
                      title={`@${getUploadedImageReferenceName(image, activeUploadedImages)}`}
                    >
                      <span className="text-[10px] leading-4">@{getUploadedImageReferenceName(image, activeUploadedImages)}</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : activeUploadedFiles.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2 px-2">
                {activeUploadedFiles.map((fileName, index) => (
                  <span key={`${fileName}-${index}`} className="rounded-full bg-[#f4f4f4] px-3 py-1 text-[12px] text-[#555555] ring-1 ring-[#e5e5e5]">
                    {fileName}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="relative">
              {!activeInput ? (
                <div className="pointer-events-none absolute left-2 top-1 z-20 flex items-center text-[14px] leading-6 text-[#b3b3b3]">
                  <span>输入文字，上传图片或</span>
                    <button
                      type="button"
                      disabled={isThinking}
                      className="pointer-events-auto inline-flex items-center px-0.5 text-[#367cee] transition hover:text-[#367cee]"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!hasMentionAssetImages) {
                          showInputTip("当前资产库没有图片");
                          return;
                        }

                        openMentionAssetMenu();
                        insertTextAtDraftCursor("@");
                    }}
                    >
                      <RiAtLine className="h-4 w-4" aria-hidden="true" />
                    </button>
                  <span>资产，描述生成内容...</span>
                </div>
              ) : null}
              {hasAtAssetOptions ? (
                <div onClick={(event) => event.stopPropagation()} className="absolute bottom-full left-2 z-50 mb-4 max-h-80 w-[380px] overflow-y-auto rounded-[12px] bg-white p-2 shadow-[0_18px_44px_rgba(0,0,0,0.14)]">
                  <div className="px-2 pb-2 text-[12px] text-[#8a8a8a]">引用资产</div>
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
                          <span className="whitespace-nowrap text-[12px] leading-none">{assetTypeLabels[group.type]}({count})</span>
                        </button>
                      );
                    })}
                  </div>
                  {activeAtAssetGroup?.assets.map((asset) => (
                    <button key={asset.id} type="button" onClick={() => insertAssetReference(asset)} className="flex h-12 w-full items-center gap-3 rounded-[8px] px-2 text-left transition hover:bg-[#f5f5f5]">
                      <div className="h-8 w-8 overflow-hidden rounded-[8px] bg-[#eeeeee]">
                        <Image src={asset.url} alt={asset.name} width={32} height={32} unoptimized className="h-full w-full object-cover" style={{ width: "100%", height: "100%" }} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#222222]">@{asset.name}</div>
                        <div className="text-[11px] text-[#999999]">{assetTypeLabels[asset.type]}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
              <PlainMentionEditor
                value={activeInput}
                disabled={isThinking}
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
              <div className={`flex min-w-max flex-nowrap items-center gap-2 text-[12px] transition ${isThinking ? "pointer-events-none opacity-45 grayscale-[0.15]" : ""}`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isThinking}
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    void addFilesToInput(files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={isThinking}
                  onClick={() => fileInputRef.current?.click()}
                  className="yinzao-tool-button yinzao-tool-button-round inline-flex h-9 w-9 shrink-0 items-center justify-center text-[#777777] transition"
                  aria-label="上传图片"
                >
                  <RiAddLine className="h-4 w-4" aria-hidden="true" />
                </button>

                <div className="relative" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    disabled={isThinking}
                    onClick={() => {
                      setIsAtAssetMenuOpen(false);
                      setOpenControlMenu((current) => (current === "mode" ? "" : "mode"));
                    }}
                    className={`${toolButtonClassName} ${openControlMenu === "mode" ? toolButtonActiveClassName : ""}`}
                  >
                    <ToolButtonLabel icon={modeOptions.find((option) => option.value === mode)?.icon} label={modeOptions.find((option) => option.value === mode)?.label ?? "模式"} showChevron accent />
                  </button>

                  {openControlMenu === "mode" ? (
                    <div className="absolute bottom-full left-0 z-40 mb-2 w-[220px] rounded-[12px] bg-white p-2 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
                      <div className="px-2 pb-2 text-[12px] font-medium text-[#a0a0a0]">创作类型</div>
                      {modeOptions.map((option) => (
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
                                          id: crypto.randomUUID(),
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
                  disabled={isThinking}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!hasMentionAssetImages) {
                      showInputTip("当前资产库没有图片");
                      return;
                    }

                    openMentionAssetMenu();
                    insertTextAtDraftCursor("@");
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
                      disabled={isThinking}
                      onClick={() => switchAgentModelTier("normal")}
                      className={agentModelTier === "normal" ? "h-8 rounded-[7px] bg-white px-3 text-[12px] font-medium text-[#111111] shadow-sm" : "h-8 rounded-[7px] px-3 text-[12px] font-medium text-[#777777] transition hover:text-[#333333]"}
                    >
                      普通
                    </button>
                    <button
                      type="button"
                      disabled={isThinking}
                      onClick={() => switchAgentModelTier("advanced")}
                      className={agentModelTier === "advanced" ? "h-8 rounded-[7px] bg-white px-3 text-[12px] font-medium text-[#111111] shadow-sm" : "h-8 rounded-[7px] px-3 text-[12px] font-medium text-[#777777] transition hover:text-[#333333]"}
                    >
                      高级
                    </button>
                  </div>
                ) : null}

                {mode !== "agent" ? (
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
                disabled={!isThinking && ((mode !== "agent" && activeHasMaxPendingRequests) || activeIsSending || (!activeInput.trim() && activeUploadedImages.length === 0))}
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] bg-[#111111] text-white transition hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white ${isThinking ? "yinzao-stop-shimmer" : ""}`}
                aria-label={isThinking ? "停止思考" : "发送"}
              >
                {isThinking ? <RiStopFill className="h-4 w-4" aria-hidden="true" /> : <RiArrowUpLine className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
            </div>
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
          onChangeName={updateActiveAssetUploadName}
          onRestoreEmptyName={() => restoreEmptyAssetUploadName()}
          onClearName={clearActiveAssetUploadName}
          onChangeType={updateActiveAssetUploadType}
          onSubmit={() => void submitAssetUpload()}
        />
      ) : null}
      {!isAssetUploadOpen && assetUploadTip ? (
        <ReminderToast reminder={assetUploadTip} fixed />
      ) : null}

      {renamingSessionId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
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
      {previewAsset ? (
        <div className="fixed inset-0 z-50 bg-black/58" onClick={() => setPreviewAsset(null)}>
          <div className="flex h-full w-full flex-col pt-8 sm:pt-10 lg:pt-12">
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-t-[20px] bg-transparent shadow-[0_20px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5" onClick={(event) => event.stopPropagation()}>
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[rgba(245,245,242,0.58)] backdrop-blur-[56px] backdrop-saturate-[190%] before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.64)_0%,rgba(255,255,255,0.22)_42%,rgba(255,255,255,0.38)_100%)] after:pointer-events-none after:absolute after:inset-0 after:z-0 after:bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.72),transparent_28%),radial-gradient(circle_at_82%_88%,rgba(255,255,255,0.36),transparent_34%)]">
                <div className="relative z-10 flex items-center justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
                  <div className="flex items-center gap-2.5">
                    {!isVideoAsset(previewAsset) ? (
                      <>
                        <button type="button" onClick={() => {
                          setPreviewFitMode("actual");
                          applyPreviewScale(visiblePreviewScale - 0.1);
                        }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition" aria-label="缩小图片">
                          <span className="text-[18px] leading-none">-</span>
                        </button>
                        <div className="flex h-9 min-w-[64px] items-center justify-center text-[13px] font-medium text-[#666666]">{previewScalePercent}</div>
                        <button type="button" onClick={() => {
                          setPreviewFitMode("actual");
                          applyPreviewScale(visiblePreviewScale + 0.1);
                        }} className="yinzao-tool-button flex h-9 w-9 items-center justify-center text-[#777777] transition" aria-label="放大图片">
                          <span className="text-[18px] leading-none">+</span>
                        </button>
                        <button type="button" onClick={() => {
                          setPreviewFitMode("actual");
                          setPreviewScale(1);
                          setPreviewPan({ x: 0, y: 0 });
                        }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition">
                          <span className="text-[13px] font-medium leading-none">实际尺寸</span>
                        </button>
                        <button type="button" onClick={() => {
                          setPreviewFitMode("fit");
                          updatePreviewFitScale();
                          setPreviewPan({ x: 0, y: 0 });
                          const viewport = previewViewportRef.current;
                          if (viewport) {
                            viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
                          }
                        }} className="yinzao-tool-button inline-flex h-9 items-center px-3.5 text-[#777777] transition">
                          <span className="text-[13px] font-medium leading-none">适合尺寸</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" disabled className="yinzao-tool-button flex h-9 w-9 cursor-not-allowed items-center justify-center text-[#777777] opacity-30" aria-label="缩小图片不可用">
                          <span className="text-[18px] leading-none">-</span>
                        </button>
                        <div className="flex h-9 min-w-[64px] items-center justify-center text-[13px] font-medium text-[#666666] opacity-30">适合</div>
                        <button type="button" disabled className="yinzao-tool-button flex h-9 w-9 cursor-not-allowed items-center justify-center text-[#777777] opacity-30" aria-label="放大图片不可用">
                          <span className="text-[18px] leading-none">+</span>
                        </button>
                        <button type="button" disabled className="yinzao-tool-button inline-flex h-9 cursor-not-allowed items-center px-3.5 text-[#777777] opacity-30">
                          <span className="text-[13px] font-medium leading-none">实际尺寸</span>
                        </button>
                        <button type="button" disabled className="yinzao-tool-button inline-flex h-9 cursor-not-allowed items-center px-3.5 text-[#777777] opacity-30">
                          <span className="text-[13px] font-medium leading-none">适合尺寸</span>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={previewAsset.url} download={getDownloadName(previewAsset)} className="inline-flex h-9 min-w-[112px] items-center justify-center gap-2 rounded-[8px] bg-[#111111] px-6 text-[13px] font-medium text-white transition hover:bg-[#252525]" aria-label={isVideoAsset(previewAsset) ? "下载视频" : "下载图片"}>
                      <RiDownloadLine className="h-4 w-4" aria-hidden="true" />
                      <span>下载</span>
                    </a>
                    <button type="button" onClick={() => setPreviewAsset(null)} className="yinzao-tool-button flex h-9 w-9 translate-x-2 items-center justify-center text-[#777777] transition" aria-label="关闭预览">
                      <RiCloseLine className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {previewImageOptions.length > 2 ? (
                  <div className="absolute right-2 top-[92px] z-20 flex max-h-[calc(100%-124px)] w-[50px] flex-col items-center gap-2">
                    {previewThumbsNeedScroll ? (
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        previewThumbListRef.current?.scrollBy({ top: -116, behavior: "smooth" });
                      }} className="yinzao-tool-button flex h-[50px] w-[50px] shrink-0 items-center justify-center text-[#777777] transition" aria-label="向上滚动缩略图">
                        <RiArrowUpSLine className="h-6 w-6" aria-hidden="true" />
                      </button>
                    ) : null}
                    <div className="relative h-[calc(100vh-320px)] min-h-[166px] overflow-hidden">
                      <div ref={previewThumbListRef} className="yinzao-hidden-scrollbar flex h-full flex-col gap-2 overflow-y-auto" onWheel={(event) => event.stopPropagation()}>
                        {previewImageOptions.map((image) => {
                          const isSelected = previewAsset.id === image.id || previewAsset.url === image.url;
                          const isVideoThumb = isVideoAsset(image);

                          return (
                            <button key={image.id} type="button" data-preview-thumb-id={image.id} data-preview-thumb-url={image.url} onClick={() => setPreviewAsset(image)} className={`relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded-[5px] border-2 bg-[#f1f1f1] transition ${isSelected ? "border-[#367cee]" : "border-[#d8d8d8] hover:border-[#bdbdbd]"}`} aria-label={`查看${image.name}`}>
                              {isVideoThumb ? (
                                <>
                                  <video src={image.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                  <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-[3px] bg-black/56 text-white backdrop-blur-[4px]">
                                    <RiFilmLine className="h-3 w-3" aria-hidden="true" />
                                  </span>
                                </>
                              ) : (
                                <Image src={image.url} alt={image.name} fill sizes="50px" unoptimized className="object-cover" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {previewThumbsNeedScroll ? (
                      <button type="button" onClick={(event) => {
                        event.stopPropagation();
                        previewThumbListRef.current?.scrollBy({ top: 116, behavior: "smooth" });
                      }} className="yinzao-tool-button flex h-[50px] w-[50px] shrink-0 items-center justify-center text-[#777777] transition" aria-label="向下滚动缩略图">
                        <RiArrowDownSLine className="h-6 w-6" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div ref={previewViewportRef} className={`relative z-10 flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden px-4 pb-5 sm:px-6 sm:pb-6 lg:px-7 lg:pb-7 ${!isVideoAsset(previewAsset) && previewFitMode === "actual" ? isPreviewDragging ? "cursor-grabbing" : "cursor-grab" : ""}`} onWheel={(event) => {
                  if (isVideoAsset(previewAsset)) return;
                  event.preventDefault();
                  const delta = event.deltaY < 0 ? 0.1 : -0.1;
                  setPreviewFitMode("actual");
                  applyPreviewScale(visiblePreviewScale + delta);
                }} onMouseDown={(event) => {
                  if (isVideoAsset(previewAsset) || previewFitMode !== "actual") return;
                  event.preventDefault();
                  previewDragStartRef.current = { pointerX: event.clientX, pointerY: event.clientY, panX: previewPan.x, panY: previewPan.y };
                  setIsPreviewDragging(true);
                }} onMouseMove={(event) => {
                  if (!isPreviewDragging) return;
                  const start = previewDragStartRef.current;
                  setPreviewPan({ x: start.panX + event.clientX - start.pointerX, y: start.panY + event.clientY - start.pointerY });
                }} onMouseUp={() => setIsPreviewDragging(false)} onMouseLeave={() => setIsPreviewDragging(false)}>
                  <div className="flex h-full w-full items-center justify-center bg-transparent">
                    {isVideoAsset(previewAsset) ? (
                      <video src={previewAsset.url} className="max-h-full max-w-full object-contain shadow-[0_8px_30px_rgba(0,0,0,0.08)]" controls playsInline onLoadedMetadata={(event) => {
                        const video = event.currentTarget;
                        if (!video.videoWidth || !video.videoHeight) return;
                        const dimensions = { width: video.videoWidth, height: video.videoHeight };
                        setPreviewAsset((current) => current && current.id === previewAsset.id ? { ...current, previewMeta: getPreviewMetaWithDimensions(current.previewMeta, dimensions, "video") } : current);
                        if (previewAsset.sessionId && previewAsset.messageId) updateMessageVideoDimensions(previewAsset.sessionId, previewAsset.messageId, dimensions);
                      }} />
                    ) : (
                      <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img ref={previewImageRef} src={previewAsset.url} alt={previewAsset.name} draggable={false} onLoad={(event) => {
                        const image = event.currentTarget;
                        const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
                        setPreviewNaturalSize(dimensions);
                        requestAnimationFrame(() => updatePreviewFitScale(dimensions));
                        setPreviewAsset((current) => current && current.id === previewAsset.id ? { ...current, previewMeta: getPreviewMetaWithDimensions(current.previewMeta, dimensions, "image") } : current);
                        if (previewAsset.sessionId && previewAsset.messageId) updateMessageImageDimensions(previewAsset.sessionId, previewAsset.messageId, previewAsset.url, dimensions);
                      }} className="max-w-none shrink-0 select-none object-contain shadow-[0_8px_30px_rgba(0,0,0,0.08)]" style={{ width: `${(previewNaturalSize.width || 2000) * visiblePreviewScale}px`, height: "auto", transform: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0)`, transition: isPreviewDragging ? "none" : "transform 120ms ease-out" }} />
                      </>
                    )}
                  </div>
                </div>
              </div>
              <aside className="hidden h-full w-[360px] shrink-0 border-l border-[#eceae6] bg-[#f8f7f4] xl:flex xl:flex-col">
                <div className="mx-9 shrink-0 border-b border-[#e4e2dd] pb-3 pt-7">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-[#111111]">{previewAsset.name}</div>
                    {previewAsset.previewMeta ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] leading-5 text-[#8c8c8c]">
                        <span className="truncate">{previewAsset.previewMeta.modelLabel}</span>
                        <span className="text-[#d0d0d0]">|</span>
                        <span>{previewAsset.previewMeta.ratio}</span>
                        <span className="text-[#d0d0d0]">|</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span>{previewAsset.previewMeta.sizeText}</span>
                          <CompactResolutionIcon option={previewAsset.previewMeta.resolution} mode={previewAsset.previewMeta.mode} qualityBadgeLabel={previewAsset.previewMeta.qualityBadgeLabel} />
                        </span>
                        {previewAsset.previewMeta.duration ? (
                          <>
                            <span className="text-[#d0d0d0]">|</span>
                            <span>{previewAsset.previewMeta.duration}</span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-9 pb-8 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#8b8b8b]">
                      <RiInformationLine className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>图片提示词</span>
                    </div>
                    <button type="button" onClick={() => {
                      if (!previewAsset.sourcePrompt.trim()) return;
                      setActiveDraftInput(previewAsset.sourcePrompt);
                      setPreviewAsset(null);
                      requestAnimationFrame(() => editorRef.current?.focus());
                    }} className="inline-flex h-[26px] shrink-0 items-center gap-1 rounded-[5px] bg-black/46 px-1.5 font-medium leading-none text-white ring-1 ring-white/12 backdrop-blur-[10px] transition hover:bg-black/58">
                      <RiTBoxLine className="h-4 w-4" aria-hidden="true" />
                      <span className="text-[12px] leading-none">使用提示词</span>
                    </button>
                  </div>
                  <div className="mt-1.5 text-[14px] leading-6 text-[#333333]">{previewAsset.sourcePrompt || "暂无提示词"}</div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
