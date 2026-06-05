import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const BYTEPLUS_CONVERSATION_IMAGE_MODEL_KEYS: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "conversation-image.seedream-4-5",
  "byteplus:conversation-image.seedream-5-0": "conversation-image.seedream-5-0",
};

export const BYTEPLUS_ASSET_IMAGE_MODEL_KEYS: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "asset-image.seedream-4-5",
  "byteplus:conversation-image.seedream-5-0": "asset-image.seedream-5-0",
};

export const BYTEPLUS_CONVERSATION_VIDEO_MODEL_KEYS: Record<string, string> = {
  "byteplus:video.seedance-2-0-fast": "video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0": "video.seedance-2-0",
};

export const BYTEPLUS_AGENT_IMAGE_MODEL_KEYS: Record<string, string> = {
  "byteplus:conversation-image.seedream-4-5": "agent-image.seedream-4-5",
};

export const BYTEPLUS_AGENT_VIDEO_MODEL_KEYS: Record<string, string> = {
  "byteplus:video.seedance-2-0-fast": "agent-video.seedance-2-0-fast",
  "byteplus:video.seedance-2-0": "agent-video.seedance-2-0",
};

const ENV_PATH = join(process.cwd(), ".env.local");

export type AdminSystemSettings = {
  openRouterApiKey: string;
  openRouterApiKeyEnabled: boolean;
  bytePlusApiKey: string;
  bytePlusApiKeyEnabled: boolean;
  bytePlusUnlockLimits: boolean;
  bytePlusRegion: "ap-southeast-1" | "eu-west-1";
  modelProviderPreferences: Record<string, "openrouter" | "byteplus">;
  bytePlusModelSelections: Record<string, string>;
};

const DEFAULT_MODEL_PROVIDER_PREFERENCES: Record<string, "openrouter" | "byteplus"> = {
  "chat.seed-2-0-lite": "openrouter",
  "chat.advanced": "openrouter",
  "prompt.priority": "openrouter",
  "prompt.second": "openrouter",
  "prompt.seed-2-0-lite": "openrouter",
  "conversation-image.seedream-4-5": "openrouter",
  "conversation-image.seedream-5-0": "openrouter",
  "asset-image.seedream-4-5": "openrouter",
  "asset-image.seedream-5-0": "openrouter",
  "video.seedance-2-0-fast": "openrouter",
  "video.seedance-2-0": "openrouter",
  "agent-image.seedream-4-5": "openrouter",
  "agent-video.seedance-2-0-fast": "openrouter",
  "agent-video.seedance-2-0": "openrouter",
};

const DEFAULT_BYTEPLUS_MODEL_SELECTIONS: Record<string, string> = {
  "chat.seed-2-0-lite": "ep-20260518173102-9mtk6",
  "chat.advanced": "ep-20260514173614-jbcb4",
  "prompt.priority": "ep-20260514173614-jbcb4",
  "prompt.second": "ep-20260514173614-jbcb4",
  "prompt.seed-2-0-lite": "ep-20260518173102-9mtk6",
  "conversation-image.seedream-4-5": "ep-20260514174622-n9qfb",
  "conversation-image.seedream-5-0": "ep-20260514142211-p2wdk",
  "asset-image.seedream-4-5": "ep-20260514174622-n9qfb",
  "asset-image.seedream-5-0": "ep-20260514142211-p2wdk",
  "video.seedance-2-0-fast": "ep-20260521134040-vf2jf",
  "video.seedance-2-0": "ep-20260521133841-nn8bg",
  "agent-image.seedream-4-5": "ep-20260514174622-n9qfb",
  "agent-video.seedance-2-0-fast": "ep-20260521134040-vf2jf",
  "agent-video.seedance-2-0": "ep-20260521133841-nn8bg",
};

const BYTEPLUS_ENDPOINT_MODEL_NAMES: Record<string, string> = {
  "ep-20260521133841-nn8bg": "dreamina-seedance-2-0-260128",
  "ep-20260521134040-vf2jf": "dreamina-seedance-2-0-fast-260128",
  "ep-20260514175234-9ssvl": "glm-4-7-251222",
  "ep-20260514175425-cd8jn": "seed-1-8-251228",
  "ep-20260518173102-9mtk6": "seed-2-0-lite-260428",
  "ep-20260514175015-ptwrh": "seed-2-0-mini-260215",
  "ep-20260514173614-jbcb4": "seed-2-0-pro-260328",
  "ep-20260518173019-br5vg": "seed-sc-260215",
  "ep-20260515121509-mvr84": "seedream-4-0-250828",
  "ep-20260514174622-n9qfb": "seedream-4-5-251128",
  "ep-20260514142211-p2wdk": "seedream-5-0-260128",
};

function parseEnvValue(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    } catch {}
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

function getLocalEnvLines() {
  if (!existsSync(ENV_PATH)) return [];
  return readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
}

export function getLocalEnvValue(name: string) {
  const line = getLocalEnvLines().find((item) => item.startsWith(`${name}=`));
  return parseEnvValue(line?.split("=").slice(1).join("="));
}

function getBooleanEnvValue(name: string, fallback: boolean) {
  const value = getLocalEnvValue(name) ?? process.env[name];
  if (value === undefined) return fallback;
  return !/^(false|0|off|no)$/i.test(value.trim());
}

function getJsonEnvValue<T>(name: string, fallback: T): T {
  const value = getLocalEnvValue(name) ?? process.env[name];
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function getBytePlusRegion() {
  const value = getLocalEnvValue("BYTEPLUS_REGION") ?? process.env.BYTEPLUS_REGION;
  return value === "eu-west-1" ? "eu-west-1" : "ap-southeast-1";
}

export function getAdminSystemSettings(): AdminSystemSettings {
  return {
    openRouterApiKey: getLocalEnvValue("OPENROUTER_API_KEY") ?? process.env.OPENROUTER_API_KEY ?? "",
    openRouterApiKeyEnabled: getBooleanEnvValue("OPENROUTER_API_KEY_ENABLED", true),
    bytePlusApiKey: getLocalEnvValue("BYTEPLUS_API_KEY") ?? process.env.BYTEPLUS_API_KEY ?? getLocalEnvValue("ARK_API_KEY") ?? process.env.ARK_API_KEY ?? "",
    bytePlusApiKeyEnabled: getBooleanEnvValue("BYTEPLUS_API_KEY_ENABLED", false),
    bytePlusUnlockLimits: getBooleanEnvValue("BYTEPLUS_UNLOCK_LIMITS", false),
    bytePlusRegion: getBytePlusRegion(),
    modelProviderPreferences: { ...DEFAULT_MODEL_PROVIDER_PREFERENCES, ...getJsonEnvValue<Record<string, "openrouter" | "byteplus">>("MODEL_PROVIDER_PREFERENCES", {}) },
    bytePlusModelSelections: { ...DEFAULT_BYTEPLUS_MODEL_SELECTIONS, ...getJsonEnvValue<Record<string, string>>("BYTEPLUS_MODEL_SELECTIONS", {}) },
  };
}

export function getConfiguredOpenRouterApiKey() {
  const settings = getAdminSystemSettings();
  return settings.openRouterApiKeyEnabled ? settings.openRouterApiKey.trim() : undefined;
}

export function getConfiguredBytePlusApiKey() {
  const settings = getAdminSystemSettings();
  return settings.bytePlusApiKeyEnabled ? settings.bytePlusApiKey.trim() : undefined;
}

export function getBytePlusBaseUrl(region = getAdminSystemSettings().bytePlusRegion) {
  return region === "eu-west-1" ? "https://ark.eu-west.bytepluses.com/api/v3" : "https://ark.ap-southeast.bytepluses.com/api/v3";
}

export function getModelProviderPreference(key: string) {
  const settings = getAdminSystemSettings();
  return settings.modelProviderPreferences[key] === "byteplus" ? "byteplus" : "openrouter";
}

export function getBytePlusModelSelection(key: string) {
  const settings = getAdminSystemSettings();
  return settings.bytePlusModelSelections[key] || DEFAULT_BYTEPLUS_MODEL_SELECTIONS[key];
}

export function getBytePlusModelForRequest(key: string) {
  const endpointId = getBytePlusModelSelection(key);
  if (getAdminSystemSettings().bytePlusUnlockLimits) return endpointId;
  return BYTEPLUS_ENDPOINT_MODEL_NAMES[endpointId] ?? endpointId;
}

export function isOpenRouterPreferenceEnabled(key: string) {
  return getModelProviderPreference(key) === "openrouter";
}

export function isBytePlusPreferenceEnabled(key: string) {
  const settings = getAdminSystemSettings();
  return settings.bytePlusApiKeyEnabled && settings.modelProviderPreferences[key] === "byteplus";
}

function isOpenRouterOnlyDisabled(groupTitle: string, badge: string, modelId: string) {
  const settings = getAdminSystemSettings();
  return settings.modelProviderPreferences[`openrouter-only:${groupTitle}:${badge}:${modelId}`] === "byteplus";
}

export function isConversationImageModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_CONVERSATION_IMAGE_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  if (modelId === "bytedance-seed/seedream-4.5") return isOpenRouterPreferenceEnabled("conversation-image.seedream-4-5");
  return !isOpenRouterOnlyDisabled("对话流图片生成", "", modelId);
}

export function isAssetImageModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_ASSET_IMAGE_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  if (modelId === "bytedance-seed/seedream-4.5") return isOpenRouterPreferenceEnabled("asset-image.seedream-4-5");
  return !isOpenRouterOnlyDisabled("资产库图片生成", "", modelId);
}

export function isConversationVideoModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_CONVERSATION_VIDEO_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  if (modelId === "bytedance/seedance-2.0-fast") return isOpenRouterPreferenceEnabled("video.seedance-2-0-fast");
  if (modelId === "bytedance/seedance-2.0") return isOpenRouterPreferenceEnabled("video.seedance-2-0");
  return !isOpenRouterOnlyDisabled("对话流视频生成", "", modelId);
}

export function isAgentImageModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_AGENT_IMAGE_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  if (modelId === "bytedance-seed/seedream-4.5") return isOpenRouterPreferenceEnabled("agent-image.seedream-4-5");
  if (modelId === "openai/gpt-5.4-image-2") return !isOpenRouterOnlyDisabled("Agent 自动生成策略", "高质图片", modelId);
  if (modelId === "google/gemini-3.1-flash-image-preview") return !isOpenRouterOnlyDisabled("Agent 自动生成策略", "快速图片", modelId);
  return false;
}

export function isAgentVideoModelEnabled(modelId: string) {
  const bytePlusKey = BYTEPLUS_AGENT_VIDEO_MODEL_KEYS[modelId];
  if (bytePlusKey) return isBytePlusPreferenceEnabled(bytePlusKey);
  if (modelId === "bytedance/seedance-2.0-fast") return isOpenRouterPreferenceEnabled("agent-video.seedance-2-0-fast");
  if (modelId === "bytedance/seedance-2.0") return isOpenRouterPreferenceEnabled("agent-video.seedance-2-0");
  if (modelId === "google/veo-3.1") return !isOpenRouterOnlyDisabled("Agent 自动生成策略", "4K视频", modelId);
  return false;
}

export function isTextModelEnabled(modelId: string, source: "chat" | "prompt" = "chat") {
  if (modelId === "bytedance-seed/seed-2.0-lite") return getModelProviderPreference(source === "prompt" ? "prompt.seed-2-0-lite" : "chat.seed-2-0-lite") === "openrouter" || isBytePlusPreferenceEnabled(source === "prompt" ? "prompt.seed-2-0-lite" : "chat.seed-2-0-lite");
  if (modelId === "openai/gpt-5.4") return getModelProviderPreference(source === "prompt" ? "prompt.second" : "chat.advanced") === "openrouter" || isBytePlusPreferenceEnabled(source === "prompt" ? "prompt.second" : "chat.advanced");
  if (modelId === "openai/gpt-5.5") return getModelProviderPreference("prompt.priority") === "openrouter" || isBytePlusPreferenceEnabled("prompt.priority");
  return true;
}

function formatEnvValue(value: string) {
  if (!value) return "";
  if (/\s|#|"|'/.test(value)) return JSON.stringify(value);
  return value;
}

export async function updateAdminSystemSettings(settings: AdminSystemSettings) {
  const nextValues = new Map<string, string>([
    ["OPENROUTER_API_KEY", formatEnvValue(settings.openRouterApiKey.trim())],
    ["OPENROUTER_API_KEY_ENABLED", settings.openRouterApiKeyEnabled ? "true" : "false"],
    ["BYTEPLUS_API_KEY", formatEnvValue(settings.bytePlusApiKey.trim())],
    ["BYTEPLUS_API_KEY_ENABLED", settings.bytePlusApiKeyEnabled ? "true" : "false"],
    ["BYTEPLUS_UNLOCK_LIMITS", settings.bytePlusUnlockLimits ? "true" : "false"],
    ["BYTEPLUS_REGION", settings.bytePlusRegion],
    ["MODEL_PROVIDER_PREFERENCES", formatEnvValue(JSON.stringify(settings.modelProviderPreferences))],
    ["BYTEPLUS_MODEL_SELECTIONS", formatEnvValue(JSON.stringify(settings.bytePlusModelSelections))],
  ]);
  const seen = new Set<string>();
  const nextLines = getLocalEnvLines().map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    const key = match?.[1];
    if (!key || !nextValues.has(key)) return line;
    seen.add(key);
    return `${key}=${nextValues.get(key) ?? ""}`;
  });

  for (const [key, value] of nextValues) {
    if (!seen.has(key)) nextLines.push(`${key}=${value}`);
  }

  await mkdir(dirname(ENV_PATH), { recursive: true });
  await writeFile(ENV_PATH, `${nextLines.join("\n").replace(/\n+$/, "")}\n`, "utf8");

  process.env.OPENROUTER_API_KEY = settings.openRouterApiKey.trim();
  process.env.OPENROUTER_API_KEY_ENABLED = settings.openRouterApiKeyEnabled ? "true" : "false";
  process.env.BYTEPLUS_API_KEY = settings.bytePlusApiKey.trim();
  process.env.ARK_API_KEY = settings.bytePlusApiKey.trim();
  process.env.BYTEPLUS_API_KEY_ENABLED = settings.bytePlusApiKeyEnabled ? "true" : "false";
  process.env.BYTEPLUS_UNLOCK_LIMITS = settings.bytePlusUnlockLimits ? "true" : "false";
  process.env.BYTEPLUS_REGION = settings.bytePlusRegion;
  process.env.MODEL_PROVIDER_PREFERENCES = JSON.stringify(settings.modelProviderPreferences);
  process.env.BYTEPLUS_MODEL_SELECTIONS = JSON.stringify(settings.bytePlusModelSelections);

  return getAdminSystemSettings();
}
