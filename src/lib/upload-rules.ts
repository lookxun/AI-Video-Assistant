export type UploadRuleMode = "agent" | "general" | "image" | "video" | "asset-image";
export type UploadTransportMode = "local-base64" | "server-url";

export type UploadKind = "image" | "document" | "video" | "audio";

export type UploadKindRule = {
  enabled: boolean;
  maxCount: number;
  maxSizeMb: number;
  formats: string[];
  minSeconds?: number;
  maxSeconds?: number;
  maxTotalSeconds?: number;
  requiresServerUrl?: boolean;
};

export type UploadRule = {
  image: UploadKindRule;
  document: UploadKindRule;
  video: UploadKindRule;
  audio: UploadKindRule;
};

export type UploadRuleContext = {
  mode: UploadRuleMode;
  modelId?: string;
  transportMode?: UploadTransportMode;
};

const commonImageFormats = ["jpg", "jpeg", "png", "webp"];
const bytePlusImageFormats = ["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif", "heic", "heif"];
const documentFormats = ["pdf", "txt", "csv", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "md"];

const disabledRule: UploadKindRule = { enabled: false, maxCount: 0, maxSizeMb: 0, formats: [] };

function kindRule(rule: Partial<UploadKindRule> & Pick<UploadKindRule, "enabled" | "maxCount" | "maxSizeMb" | "formats">): UploadKindRule {
  return rule;
}

function makeRule(partial: Partial<UploadRule>): UploadRule {
  return {
    image: disabledRule,
    document: disabledRule,
    video: disabledRule,
    audio: disabledRule,
    ...partial,
  };
}

function isBytePlusImageModel(modelId?: string) {
  return modelId === "byteplus:conversation-image.seedream-4-5" || modelId === "byteplus:conversation-image.seedream-5-0";
}

function isBytePlusVideoModel(modelId?: string) {
  return modelId === "byteplus:video.seedance-2-0-fast" || modelId === "byteplus:video.seedance-2-0";
}

function isKlingVideoModel(modelId?: string) {
  return modelId === "kwaivgi/kling-v3.0-std" || modelId === "kwaivgi/kling-v3.0-pro" || modelId === "kwaivgi/kling-video-o1";
}

function isVeoVideoModel(modelId?: string) {
  return modelId === "google/veo-3.1";
}

export function getUploadRule(context: UploadRuleContext): UploadRule {
  const transportMode = context.transportMode ?? "local-base64";
  const bytePlusLocalImageMax = transportMode === "server-url" ? 14 : 6;

  if (context.mode === "agent" || context.mode === "general") {
    return makeRule({
      image: kindRule({ enabled: true, maxCount: 5, maxSizeMb: 5, formats: commonImageFormats }),
      document: kindRule({ enabled: true, maxCount: 5, maxSizeMb: 10, formats: documentFormats }),
    });
  }

  if (context.mode === "asset-image" || context.mode === "image") {
    if (isBytePlusImageModel(context.modelId)) {
      return makeRule({
        image: kindRule({ enabled: true, maxCount: bytePlusLocalImageMax, maxSizeMb: 30, formats: bytePlusImageFormats }),
      });
    }

    return makeRule({
      image: kindRule({ enabled: true, maxCount: 3, maxSizeMb: 8, formats: commonImageFormats }),
      document: context.modelId === "openai/gpt-5.4-image-2" ? kindRule({ enabled: true, maxCount: 1, maxSizeMb: 10, formats: documentFormats }) : disabledRule,
    });
  }

  if (context.mode === "video") {
    if (isBytePlusVideoModel(context.modelId)) {
      return makeRule({
        image: kindRule({ enabled: true, maxCount: 9, maxSizeMb: 30, formats: bytePlusImageFormats }),
        video: kindRule({ enabled: true, maxCount: 3, maxSizeMb: 50, formats: ["mp4", "mov"], minSeconds: 2, maxSeconds: 15, maxTotalSeconds: 15, requiresServerUrl: true }),
        audio: kindRule({ enabled: true, maxCount: 3, maxSizeMb: 15, formats: ["mp3", "wav"], minSeconds: 2, maxSeconds: 15, maxTotalSeconds: 15, requiresServerUrl: true }),
      });
    }

    return makeRule({
      image: kindRule({ enabled: true, maxCount: isKlingVideoModel(context.modelId) || isVeoVideoModel(context.modelId) ? 2 : 3, maxSizeMb: 8, formats: commonImageFormats }),
    });
  }

  return makeRule({ image: kindRule({ enabled: true, maxCount: 3, maxSizeMb: 8, formats: commonImageFormats }) });
}

export function getAllowedImageCount(context: UploadRuleContext) {
  return getUploadRule(context).image.maxCount;
}

export function getAllowedDocumentCount(context: UploadRuleContext) {
  return getUploadRule(context).document.maxCount;
}

export function getUploadAcceptValue(rule: UploadRule) {
  const values: string[] = [];
  if (rule.image.enabled) values.push(...rule.image.formats.map((format) => `.${format}`));
  if (rule.document.enabled) values.push(...rule.document.formats.map((format) => `.${format}`));
  if (rule.video.enabled) values.push(...rule.video.formats.map((format) => `.${format}`));
  if (rule.audio.enabled) values.push(...rule.audio.formats.map((format) => `.${format}`));
  return values.join(",") || ".png,.jpg,.jpeg,.webp";
}

export function getSupportedUploadTypeLabel(rule: UploadRule) {
  const labels: string[] = [];
  if (rule.image.enabled) labels.push(`图片（最多${rule.image.maxCount}张）`);
  if (rule.document.enabled) labels.push(`文件（最多${rule.document.maxCount}个）`);
  if (rule.video.enabled) labels.push(`视频（最多${rule.video.maxCount}个）`);
  if (rule.audio.enabled) labels.push(`音频（最多${rule.audio.maxCount}个）`);
  return labels.join("、") || "当前模型不支持上传文件";
}

export function getFileExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function getUploadKindFromFileName(name: string): UploadKind | "unsupported" {
  const extension = getFileExtension(name);
  if (["jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif", "gif", "heic", "heif"].includes(extension)) return "image";
  if (documentFormats.includes(extension)) return "document";
  if (["mp4", "mov"].includes(extension)) return "video";
  if (["mp3", "wav"].includes(extension)) return "audio";
  return "unsupported";
}

export function validateReferenceImageCount(context: UploadRuleContext, count: number) {
  const maxCount = getAllowedImageCount(context);
  if (count > maxCount) return `当前模型最多支持 ${maxCount} 张参考图，不能上传更多图片`;
  return undefined;
}
