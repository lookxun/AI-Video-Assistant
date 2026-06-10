export type ConversationModel = {
  label: string;
  id: string;
};

export type GenerationModel = ConversationModel & {
  durations?: string[];
};

export type ImageResolution = "1K" | "2K" | "4K";
export type ImageRatio = "智能比例" | "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";
type ConcreteImageRatio = Exclude<ImageRatio, "智能比例">;
type ImageDimensions = { width: number; height: number };
export type VideoResolution = "480p" | "720p" | "1080p" | "4K";
export type VideoRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9";

export type ImageModelRule = {
  resolutions: ImageResolution[];
  defaultResolution: ImageResolution;
  modalities: string[];
  dimensions: Partial<Record<ImageResolution, Partial<Record<ConcreteImageRatio, ImageDimensions>>>>;
};

export type VideoModelRule = {
  resolutions: VideoResolution[];
  ratios: VideoRatio[];
  defaultResolution: VideoResolution;
  defaultRatio: VideoRatio;
  sizes: Partial<Record<VideoResolution, Partial<Record<VideoRatio, ImageDimensions>>>>;
  nonStandardSizes?: Partial<Record<VideoResolution, Partial<Record<VideoRatio, true>>>>;
};

export const models: ConversationModel[] = [
  { label: "Seed 2.0 Lite", id: "bytedance-seed/seed-2.0-lite" },
  { label: "DeepSeek V4 Pro", id: "deepseek/deepseek-v4-pro" },
  { label: "DeepSeek R1 0528", id: "deepseek/deepseek-r1-0528" },
  { label: "Gemini 3 Flash Preview", id: "google/gemini-3-flash-preview" },
  { label: "Gemini 3.1 Pro Preview", id: "google/gemini-3.1-pro-preview" },
  { label: "GPT-4o", id: "openai/gpt-4o" },
  { label: "GPT-5.4", id: "openai/gpt-5.4" },
  { label: "GPT-5.5", id: "openai/gpt-5.5" },
] as const;

export const bytePlusConversationModels: ConversationModel[] = [
  { label: "Seed 2.0 Pro", id: "byteplus:chat.seed-2-0-pro" },
] as const;

export const frontendConversationModels: ConversationModel[] = [
  models[0],
  ...bytePlusConversationModels,
  ...models.slice(1),
] as const;

export const DEFAULT_CHAT_MODEL = "bytedance-seed/seed-2.0-lite";
export const ADVANCED_CHAT_MODEL = "openai/gpt-5.4";
export const imageGenerationModels: GenerationModel[] = [
  { label: "Seedream 4.5", id: "bytedance-seed/seedream-4.5" },
  { label: "Gemini 3.1 Flash Image Preview", id: "google/gemini-3.1-flash-image-preview" },
  { label: "Gemini 3 Pro Image Preview", id: "google/gemini-3-pro-image-preview" },
  { label: "GPT-5.4 Image 2", id: "openai/gpt-5.4-image-2" },
] as const;

export const bytePlusImageGenerationModels: GenerationModel[] = [
  { label: "Seedream 4.5", id: "byteplus:conversation-image.seedream-4-5" },
  { label: "Seedream 5.0 Lite", id: "byteplus:conversation-image.seedream-5-0" },
] as const;

export const frontendImageGenerationModels: GenerationModel[] = [
  ...bytePlusImageGenerationModels,
  ...imageGenerationModels,
] as const;

export const videoGenerationModels: GenerationModel[] = [
  { label: "Seedance 2.0 Fast", id: "bytedance/seedance-2.0-fast", durations: ["5秒", "10秒", "15秒"] },
  { label: "Seedance 2.0", id: "bytedance/seedance-2.0", durations: ["5秒", "10秒", "15秒"] },
  { label: "Kling v3.0 Standard", id: "kwaivgi/kling-v3.0-std", durations: ["5秒", "10秒", "15秒"] },
  { label: "Kling v3.0 Pro", id: "kwaivgi/kling-v3.0-pro", durations: ["5秒", "10秒", "15秒"] },
  { label: "Kling Video O1", id: "kwaivgi/kling-video-o1", durations: ["5秒", "10秒"] },
  { label: "Veo 3.1", id: "google/veo-3.1", durations: ["4秒", "6秒", "8秒"] },
] as const;

const bytePlusSeedanceDurations = ["4秒", "5秒", "6秒", "7秒", "8秒", "9秒", "10秒", "11秒", "12秒", "13秒", "14秒", "15秒"];

export const bytePlusVideoGenerationModels: GenerationModel[] = [
  { label: "Seedance 2.0 Fast", id: "byteplus:video.seedance-2-0-fast", durations: bytePlusSeedanceDurations },
  { label: "Seedance 2.0", id: "byteplus:video.seedance-2-0", durations: bytePlusSeedanceDurations },
] as const;

export const DEFAULT_IMAGE_MODEL = imageGenerationModels[0].id;
export const DEFAULT_VIDEO_MODEL = videoGenerationModels[0].id;

const seedream2KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2560, height: 1440 },
  "9:16": { width: 1440, height: 2560 },
  "21:9": { width: 3024, height: 1296 },
  "4:3": { width: 2304, height: 1728 },
  "3:4": { width: 1728, height: 2304 },
};

const seedream4KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 4096, height: 4096 },
  "16:9": { width: 4096, height: 2304 },
  "9:16": { width: 2304, height: 4096 },
  "21:9": { width: 4096, height: 1756 },
  "4:3": { width: 4096, height: 3072 },
  "3:4": { width: 3072, height: 4096 },
};

const bytePlusSeedream2KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2848, height: 1600 },
  "9:16": { width: 1600, height: 2848 },
  "21:9": { width: 3136, height: 1344 },
  "4:3": { width: 2304, height: 1728 },
  "3:4": { width: 1728, height: 2304 },
};

const bytePlusSeedream4KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 4096, height: 4096 },
  "16:9": { width: 5504, height: 3040 },
  "9:16": { width: 3040, height: 5504 },
  "21:9": { width: 6240, height: 2656 },
  "4:3": { width: 4704, height: 3520 },
  "3:4": { width: 3520, height: 4704 },
};

const bytePlusSeedream50Dimensions = {
  "2K": bytePlusSeedream2KDimensions,
  "4K": bytePlusSeedream4KDimensions,
};

const gemini1KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1376, height: 768 },
  "9:16": { width: 768, height: 1376 },
  "21:9": { width: 1584, height: 672 },
  "4:3": { width: 1200, height: 896 },
  "3:4": { width: 896, height: 1200 },
};

const gemini2KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2752, height: 1536 },
  "9:16": { width: 1536, height: 2752 },
  "21:9": { width: 3168, height: 1344 },
  "4:3": { width: 2400, height: 1792 },
  "3:4": { width: 1792, height: 2400 },
};

const gemini4KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 4096, height: 4096 },
  "16:9": { width: 5504, height: 3072 },
  "9:16": { width: 3072, height: 5504 },
  "21:9": { width: 6336, height: 2688 },
  "4:3": { width: 4800, height: 3584 },
  "3:4": { width: 3584, height: 4800 },
};

const gpt541KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1280, height: 720 },
  "9:16": { width: 720, height: 1280 },
  "21:9": { width: 1568, height: 672 },
  "4:3": { width: 1152, height: 864 },
  "3:4": { width: 864, height: 1152 },
};

const gpt542KDimensions: Record<ConcreteImageRatio, ImageDimensions> = {
  "1:1": { width: 2048, height: 2048 },
  "16:9": { width: 2560, height: 1440 },
  "9:16": { width: 1440, height: 2560 },
  "21:9": { width: 3024, height: 1296 },
  "4:3": { width: 2304, height: 1728 },
  "3:4": { width: 1728, height: 2304 },
};

export const imageModelRules: Record<string, ImageModelRule> = {
  "bytedance-seed/seedream-4.5": {
    resolutions: ["2K", "4K"],
    defaultResolution: "2K",
    modalities: ["image"],
    dimensions: {
      "2K": seedream2KDimensions,
      "4K": seedream4KDimensions,
    },
  },
  "byteplus:conversation-image.seedream-4-5": {
    resolutions: ["2K", "4K"],
    defaultResolution: "2K",
    modalities: ["image"],
    dimensions: {
      "2K": bytePlusSeedream2KDimensions,
      "4K": bytePlusSeedream4KDimensions,
    },
  },
  "byteplus:conversation-image.seedream-5-0": {
    resolutions: ["2K", "4K"],
    defaultResolution: "2K",
    modalities: ["image"],
    dimensions: {
      "2K": bytePlusSeedream50Dimensions["2K"],
      "4K": bytePlusSeedream50Dimensions["4K"],
    },
  },
  "google/gemini-3.1-flash-image-preview": {
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "1K",
    modalities: ["image", "text"],
    dimensions: {
      "1K": gemini1KDimensions,
      "2K": gemini2KDimensions,
      "4K": gemini4KDimensions,
    },
  },
  "google/gemini-3-pro-image-preview": {
    resolutions: ["1K", "2K", "4K"],
    defaultResolution: "1K",
    modalities: ["image", "text"],
    dimensions: {
      "1K": gemini1KDimensions,
      "2K": gemini2KDimensions,
      "4K": gemini4KDimensions,
    },
  },
  "openai/gpt-5.4-image-2": {
    resolutions: ["1K", "2K"],
    defaultResolution: "1K",
    modalities: ["image", "text"],
    dimensions: {
      "1K": gpt541KDimensions,
      "2K": gpt542KDimensions,
    },
  },
};

export const fallbackImageModelRule: ImageModelRule = {
  resolutions: ["1K", "2K"],
  defaultResolution: "1K",
  modalities: ["image", "text"],
  dimensions: {
    "1K": gemini1KDimensions,
    "2K": gemini2KDimensions,
  },
};

const seedanceFastVideoSizes: VideoModelRule["sizes"] = {
  "480p": {
    "21:9": { width: 992, height: 432 },
    "16:9": { width: 864, height: 496 },
    "4:3": { width: 752, height: 560 },
    "1:1": { width: 640, height: 640 },
    "3:4": { width: 560, height: 752 },
    "9:16": { width: 496, height: 864 },
  },
  "720p": {
    "21:9": { width: 1470, height: 630 },
    "16:9": { width: 1280, height: 720 },
    "4:3": { width: 1112, height: 834 },
    "1:1": { width: 960, height: 960 },
    "3:4": { width: 834, height: 1112 },
    "9:16": { width: 720, height: 1280 },
  },
};

const seedanceFastNonStandardVideoSizes: VideoModelRule["nonStandardSizes"] = {
  "480p": { "21:9": true, "16:9": true, "4:3": true, "1:1": true, "3:4": true, "9:16": true },
  "720p": { "21:9": true, "4:3": true, "1:1": true, "3:4": true },
};

const seedanceVideoSizes: VideoModelRule["sizes"] = {
  ...seedanceFastVideoSizes,
  "1080p": {
    "21:9": { width: 2206, height: 946 },
    "16:9": { width: 1920, height: 1080 },
    "4:3": { width: 1664, height: 1248 },
    "1:1": { width: 1440, height: 1440 },
    "3:4": { width: 1248, height: 1664 },
    "9:16": { width: 1080, height: 1920 },
  },
};

const seedanceNonStandardVideoSizes: VideoModelRule["nonStandardSizes"] = {
  ...seedanceFastNonStandardVideoSizes,
  "1080p": { "21:9": true, "4:3": true, "1:1": true, "3:4": true },
};

const klingVideoSizes: VideoModelRule["sizes"] = {
  "720p": {
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
    "1:1": { width: 960, height: 960 },
  },
};

const klingNonStandardVideoSizes: VideoModelRule["nonStandardSizes"] = {
  "720p": { "1:1": true },
};

const klingO1VideoSizes: VideoModelRule["sizes"] = {
  "1080p": {
    "16:9": { width: 1920, height: 1080 },
    "1:1": { width: 1440, height: 1440 },
    "9:16": { width: 1080, height: 1920 },
  },
};

const klingO1NonStandardVideoSizes: VideoModelRule["nonStandardSizes"] = {
  "1080p": { "1:1": true },
};

const veoVideoSizes: VideoModelRule["sizes"] = {
  "720p": {
    "16:9": { width: 1280, height: 720 },
    "9:16": { width: 720, height: 1280 },
  },
  "1080p": {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
  },
  "4K": {
    "16:9": { width: 3840, height: 2160 },
    "9:16": { width: 2160, height: 3840 },
  },
};

export const videoModelRules: Record<string, VideoModelRule> = {
  "bytedance/seedance-2.0-fast": {
    resolutions: ["480p", "720p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: seedanceFastVideoSizes,
    nonStandardSizes: seedanceFastNonStandardVideoSizes,
  },
  "byteplus:video.seedance-2-0-fast": {
    resolutions: ["480p", "720p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: seedanceFastVideoSizes,
    nonStandardSizes: seedanceFastNonStandardVideoSizes,
  },
  "bytedance/seedance-2.0": {
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: seedanceVideoSizes,
    nonStandardSizes: seedanceNonStandardVideoSizes,
  },
  "byteplus:video.seedance-2-0": {
    resolutions: ["480p", "720p", "1080p"],
    ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: seedanceVideoSizes,
    nonStandardSizes: seedanceNonStandardVideoSizes,
  },
  "kwaivgi/kling-v3.0-std": {
    resolutions: ["720p"],
    ratios: ["16:9", "1:1", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: klingVideoSizes,
    nonStandardSizes: klingNonStandardVideoSizes,
  },
  "kwaivgi/kling-v3.0-pro": {
    resolutions: ["720p"],
    ratios: ["16:9", "1:1", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: klingVideoSizes,
    nonStandardSizes: klingNonStandardVideoSizes,
  },
  "kwaivgi/kling-video-o1": {
    resolutions: ["1080p"],
    ratios: ["16:9", "1:1", "9:16"],
    defaultResolution: "1080p",
    defaultRatio: "16:9",
    sizes: klingO1VideoSizes,
    nonStandardSizes: klingO1NonStandardVideoSizes,
  },
  "google/veo-3.1": {
    resolutions: ["720p", "1080p", "4K"],
    ratios: ["16:9", "9:16"],
    defaultResolution: "720p",
    defaultRatio: "16:9",
    sizes: veoVideoSizes,
  },
};

export const fallbackVideoModelRule: VideoModelRule = videoModelRules[DEFAULT_VIDEO_MODEL];

export const imageRatioMap: Record<ConcreteImageRatio, [number, number]> = {
  "16:9": [16, 9],
  "9:16": [9, 16],
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:4": [3, 4],
  "21:9": [21, 9],
};

export function getVideoModelRule(modelId?: string) {
  return modelId ? videoModelRules[modelId] ?? fallbackVideoModelRule : fallbackVideoModelRule;
}

export function getSupportedVideoResolutions(modelId?: string) {
  return getVideoModelRule(modelId).resolutions;
}

export function getSupportedVideoRatios(modelId?: string, resolution?: string) {
  const rule = getVideoModelRule(modelId);
  const ratiosForResolution = resolution ? rule.sizes[normalizeVideoResolutionForModel(modelId, resolution)] : undefined;
  return ratiosForResolution ? rule.ratios.filter((ratio) => Boolean(ratiosForResolution[ratio])) : rule.ratios;
}

export function normalizeVideoResolutionForModel(modelId: string | undefined, resolution?: string) {
  const rule = getVideoModelRule(modelId);
  return rule.resolutions.includes(resolution as VideoResolution) ? resolution as VideoResolution : rule.defaultResolution;
}

export function normalizeVideoRatioForModel(modelId: string | undefined, ratio?: string, resolution?: string) {
  const rule = getVideoModelRule(modelId);
  const ratios = getSupportedVideoRatios(modelId, resolution);
  if (ratios.includes(ratio as VideoRatio)) return ratio as VideoRatio;
  return ratios.includes(rule.defaultRatio) ? rule.defaultRatio : ratios[0] ?? rule.defaultRatio;
}

export function resolveVideoSettingsForModel(modelId: string | undefined, settings?: { ratio?: string; resolution?: string }) {
  const rule = getVideoModelRule(modelId);
  if (settings?.ratio === "智能比例") {
    const size = { width: 1280, height: 720 };
    return { ratio: "16:9" as const, resolution: "720p" as const, size };
  }

  const resolution = normalizeVideoResolutionForModel(modelId, settings?.resolution);
  const ratio = normalizeVideoRatioForModel(modelId, settings?.ratio, resolution);
  const size = rule.sizes[resolution]?.[ratio] ?? rule.sizes[rule.defaultResolution]?.[rule.defaultRatio] ?? { width: 1280, height: 720 };

  return { ratio, resolution, size };
}

export function getExpectedVideoDimensions(modelId: string | undefined, resolution: string | undefined, ratio: string | undefined) {
  return resolveVideoSettingsForModel(modelId, { ratio, resolution }).size;
}

export function isNonStandardVideoSize(modelId: string | undefined, resolution: string | undefined, ratio: string | undefined) {
  const rule = getVideoModelRule(modelId);
  const resolved = resolveVideoSettingsForModel(modelId, { ratio, resolution });
  return Boolean(rule.nonStandardSizes?.[resolved.resolution]?.[resolved.ratio]);
}

export function getImageModelRule(modelId?: string) {
  return modelId ? imageModelRules[modelId] ?? fallbackImageModelRule : fallbackImageModelRule;
}

export function getSupportedImageResolutions(modelId?: string) {
  return getImageModelRule(modelId).resolutions;
}

export function normalizeImageResolutionForModel(modelId: string | undefined, resolution?: string) {
  const rule = getImageModelRule(modelId);
  if (resolution === "智能比例") return rule.defaultResolution;
  return rule.resolutions.includes(resolution as ImageResolution) ? resolution as ImageResolution : rule.defaultResolution;
}

export function resolveImageSettingsForModel(modelId: string | undefined, settings?: { ratio?: string; resolution?: string }) {
  const rule = getImageModelRule(modelId);
  const isSmartRatio = !settings?.ratio || settings.ratio === "智能比例";
  const ratio = isSmartRatio ? "16:9" as const : normalizeImageRatio(settings?.ratio);

  return {
    ratio,
    resolution: isSmartRatio ? rule.defaultResolution : normalizeImageResolutionForModel(modelId, settings?.resolution),
  };
}

export function normalizeImageRatio(ratio?: string): ConcreteImageRatio {
  return ratio && ratio !== "智能比例" && ratio in imageRatioMap ? ratio as ConcreteImageRatio : "16:9";
}

export function getExpectedImageDimensions(modelId: string | undefined, resolution: string | undefined, ratio: string | undefined) {
  const rule = getImageModelRule(modelId);
  const resolvedSettings = resolveImageSettingsForModel(modelId, { ratio, resolution });
  const safeResolution = resolvedSettings.resolution;
  const safeRatio = resolvedSettings.ratio;

  return rule.dimensions[safeResolution]?.[safeRatio] ?? { width: 0, height: 0 };
}

export function getImageQualityBadgeLabel(resolution?: string) {
  return resolution === "4K" ? "超清4K" : "";
}

export function getImageResolutionLabel(resolution: string) {
  return getImageQualityBadgeLabel(resolution) || `高清${resolution}`;
}

export type ModelName = string;

export function isModelName(value: unknown): value is ModelName {
  return typeof value === "string" && value.length > 0 && value.length < 120 && /^[a-zA-Z0-9~._:/-]+$/.test(value);
}
