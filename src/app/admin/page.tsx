import { getAdminEmails, isAdminEmail } from "@/lib/admin";
import { getCurrentAdminEmail } from "@/lib/admin-auth";
import { bytePlusImageGenerationModels, bytePlusVideoGenerationModels, imageGenerationModels, videoGenerationModels } from "@/lib/models";
import { prisma } from "@/lib/prisma";
import { AdminLogoutButton } from "./admin-logout-button";
import { AdminLoginForm } from "./admin-login-form";
import { AdminCreditsPanel, type AdminCreditCategoryDetail, type AdminCreditConversationDetail, type AdminCreditFlowItem, type AdminCreditUser } from "./admin-credits-panel";
import { AdminRecordsPanel } from "./admin-records-panel";
import { AdminSystemSettingsPanel } from "./admin-system-settings-panel";
import { AdminUsersPanel, type AdminConversation, type AdminConversationMessage, type AdminMediaItem, type AdminUserRow } from "./admin-users-panel";
import { getCreditSettings } from "@/lib/credits";
import { getAdminSystemSettings } from "@/lib/system-settings";
import type { IconType } from "react-icons";
import { RiDashboardLine, RiFileList3Line, RiSettingsLine, RiUser3Line, RiVipDiamondLine } from "react-icons/ri";

export const dynamic = "force-dynamic";

type AdminTab = "overview" | "users" | "credits" | "records" | "settings";

const adminNavItems: Array<{ key: AdminTab; label: string; icon: IconType }> = [
  { key: "overview", label: "概览", icon: RiDashboardLine },
  { key: "users", label: "用户管理", icon: RiUser3Line },
  { key: "credits", label: "积分管理", icon: RiVipDiamondLine },
  { key: "records", label: "生成记录", icon: RiFileList3Line },
  { key: "settings", label: "系统设置", icon: RiSettingsLine },
];

function getAdminTab(value: string | string[] | undefined): AdminTab {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "users" || tab === "credits" || tab === "records" || tab === "settings") return tab;
  return "overview";
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatTimestamp(value: unknown) {
  const timestamp = finiteNumber(value);
  return timestamp > 0 ? formatDate(new Date(timestamp)) : "-";
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

function startOfLocalDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function dayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function dayLabel(value: Date) {
  return `${String(value.getMonth() + 1).padStart(2, "0")}/${String(value.getDate()).padStart(2, "0")}`;
}

function recentDays(count: number) {
  const today = startOfLocalDay();
  return Array.from({ length: count }, (_, index) => addDays(today, index - count + 1));
}

function getUserLastActiveTime(user: { lastLoginAt: Date | null; sessions: Array<{ lastSeenAt: Date }>; workspace: { updatedAt: Date } | null; createdAt: Date }) {
  return Math.max(user.lastLoginAt?.getTime() ?? 0, user.sessions[0]?.lastSeenAt?.getTime() ?? 0, user.workspace?.updatedAt?.getTime() ?? 0, user.createdAt.getTime());
}

function getProviderLabel(model?: string | null) {
  if (!model) return "未知";
  if (model.startsWith("byteplus:")) return "BytePlus";
  if (model.startsWith("openai/")) return "OpenAI";
  if (model.startsWith("google/")) return "Google";
  if (model.startsWith("bytedance") || model.includes("seedance") || model.includes("seedream")) return "ByteDance/OpenRouter";
  if (model.includes("kling")) return "Kling/OpenRouter";
  return "其它";
}

function getUserLatestLoginActivity(user: { lastLoginAt: Date | null; sessions: Array<{ lastSeenAt: Date }> }) {
  const times = [user.lastLoginAt?.getTime() ?? 0, user.sessions[0]?.lastSeenAt?.getTime() ?? 0].filter((time) => time > 0);
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function countStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length > 0).length : 0;
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function formatAdminMediaName(systemName: string | undefined, userName: string | undefined, fallback: string) {
  const system = (systemName ?? "").trim();
  const user = (userName ?? "").trim();
  if (system && user && user !== system) return `${system} / ${user}`;
  return system || user || fallback;
}

function normalizeMediaUrlForAdmin(value: string) {
  return value.split("?")[0].split("#")[0].replace(/^https?:\/\/[^/]+/, "");
}

function getLedgerMediaUrls(metadata: unknown) {
  if (!isRecord(metadata)) return [];
  return getStringArray(metadata.mediaUrls);
}

function getDimensionsLabel(value: unknown) {
  if (!isRecord(value)) return "-";
  const width = Math.max(0, Math.floor(finiteNumber(value.width)));
  const height = Math.max(0, Math.floor(finiteNumber(value.height)));
  return width > 0 && height > 0 ? `${width} × ${height}` : "-";
}

function getModelLabel(type: "image" | "video", modelId: string) {
  const models = type === "image" ? [...imageGenerationModels, ...bytePlusImageGenerationModels] : [...videoGenerationModels, ...bytePlusVideoGenerationModels];
  return models.find((model) => model.id === modelId)?.label ?? modelId;
}

function getRecordValue(record: unknown, key: string) {
  return isRecord(record) ? record[key] : undefined;
}

function getCreditSource(metadata: unknown) {
  if (!isRecord(metadata)) return "conversation";
  const source = metadata.creditSource;
  return typeof source === "string" ? source : "conversation";
}

function getCreditLedgerReason(kind: string, label: string | null, metadata: unknown) {
  if (kind === "signup") return "注册送积分";
  if (kind === "admin_adjust") return "后台调整赠送积分";

  const creditSource = getCreditSource(metadata);
  if (creditSource === "character_image_generation") return "资产库_角色图片";
  if (creditSource === "scene_image_generation") return "资产库_场景图片";
  if (creditSource === "shot_image_generation") return "资产库_分镜图片";
  if (creditSource === "image_prompt_reverse") return "图片反推提示词";
  if (creditSource === "prompt_optimization") return "优化提示词";

  if (kind === "text") return label || "对话/规划";
  if (kind === "image") return "对话流图片生成";
  if (kind === "video") return "对话流视频生成";
  return label || kind;
}

function getMetadataString(metadata: unknown, key: string) {
  if (!isRecord(metadata)) return "";
  return getString(metadata[key]).trim();
}

function getMetadataBoolean(metadata: unknown, key: string) {
  return isRecord(metadata) ? metadata[key] === true : false;
}

function getMediaPrompt(message: Record<string, unknown>, key: string) {
  const promptMap = getRecordValue(message, key);
  return isRecord(promptMap) ? promptMap : undefined;
}

function getDeletedAssetInfoMap(state: unknown) {
  const map = new Map<string, { deletedAtLabel?: string }>();
  if (!isRecord(state) || !Array.isArray(state.assets)) return map;

  for (const asset of state.assets.filter(isRecord)) {
    const url = getString(asset.url);
    const deletedAt = finiteNumber(asset.deletedAt);
    if (!url || asset.type !== "trash" && deletedAt <= 0) continue;
    const info = { deletedAtLabel: deletedAt > 0 ? formatTimestamp(deletedAt) : undefined };
    map.set(url, info);
    map.set(normalizeMediaUrlForAdmin(url), info);
  }

  return map;
}

function getMessageRole(value: unknown): AdminConversationMessage["role"] {
  return value === "user" || value === "assistant" || value === "system" ? value : "assistant";
}

function getConversationActivityTime(session: Record<string, unknown>, messages: Record<string, unknown>[]) {
  const messageTimes = messages.map((message) => finiteNumber(message.createdAt)).filter((time) => time > 0);
  if (messageTimes.length > 0) return Math.max(...messageTimes);
  return finiteNumber(session.createdAt) || finiteNumber(session.updatedAt);
}

function getWorkspaceConversations(state: unknown): AdminConversation[] {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return [];
  const assetDisplayNameMap = getWorkspaceAssetDisplayNameMap(state);

  return state.sessions
    .filter(isRecord)
    .map((session, index) => {
      const id = getString(session.id, `conversation-${index}`);
      const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
      const activityTime = getConversationActivityTime(session, messages);

      return {
        id,
        title: getString(session.title, "新对话") || "新对话",
        conversationCode: getString(session.conversationCode),
        updatedAtLabel: formatTimestamp(activityTime),
        updatedAtTs: activityTime,
        messages: messages.map((message, messageIndex): AdminConversationMessage => {
          const videos = getStringArray(message.videos);
          const videoUrl = getString(message.videoUrl);
          const images = getStringArray(message.images);
          const allVideos = videoUrl ? [...videos, videoUrl].filter((url, urlIndex, array) => array.indexOf(url) === urlIndex) : videos;
          const mediaSystemNames = isRecord(message.mediaSystemNames) ? message.mediaSystemNames : undefined;
          const mediaNames = new Map<string, string>();
          images.forEach((url, mediaIndex) => mediaNames.set(url, assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? formatAdminMediaName(getString(mediaSystemNames?.[url]), undefined, `图片${mediaIndex + 1}`)));
          allVideos.forEach((url, mediaIndex) => mediaNames.set(url, assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? formatAdminMediaName(getString(mediaSystemNames?.[url]), undefined, `视频${mediaIndex + 1}`)));

          return {
            id: getString(message.id, `${id}-message-${messageIndex}`),
            role: getMessageRole(message.role),
            content: getString(message.content),
            createdAtLabel: formatTimestamp(message.createdAt),
            images,
            videos: allVideos,
            mediaNames: Object.fromEntries(mediaNames),
            error: getString(message.error),
          };
        }),
      };
    });
}

function getDeletedConversationMessages(detail: AdminCreditConversationDetail): AdminConversationMessage[] {
  const messages = detail.mediaItems
    .filter((item) => item.url || item.promptText || item.displayName)
    .sort((left, right) => left.createdAtTs - right.createdAtTs)
    .map((item, index): AdminConversationMessage => ({
      id: `${detail.id}-deleted-media-${index}`,
      role: "assistant",
      content: [item.displayName, item.promptText].filter(Boolean).join("\n"),
      createdAtLabel: item.createdAtLabel,
      images: item.kind === "image" && item.url ? [item.url] : [],
      videos: item.kind === "video" && item.url ? [item.url] : [],
      mediaNames: item.url ? { [item.url]: item.displayName } : undefined,
    }));

  if (messages.length > 0) return messages;

  return [{
    id: `${detail.id}-deleted-empty`,
    role: "system",
    content: "该对话暂无可恢复消息",
    createdAtLabel: detail.updatedAtLabel,
    images: [],
    videos: [],
  }];
}

function getDeletedConversationMediaItems(details: AdminCreditConversationDetail[] | undefined, existingMediaItems: AdminMediaItem[]) {
  const seenUrls = new Set(existingMediaItems.map((item) => normalizeMediaUrlForAdmin(item.url)).filter(Boolean));
  const items: AdminMediaItem[] = [];

  for (const detail of details ?? []) {
    const operationTs = detail.updatedAtTs ?? 0;
    for (const media of [...detail.mediaItems].sort((left, right) => left.createdAtTs - right.createdAtTs)) {
      if (!media.url || media.kind === "file") continue;
      const normalizedUrl = normalizeMediaUrlForAdmin(media.url);
      if (seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);
      items.push({
        id: `${detail.id}-deleted-media-${media.id}`,
        type: media.kind,
        isDeleted: true,
        deletedAtLabel: detail.updatedAtLabel,
        name: media.displayName,
        url: media.url,
        prompt: media.promptText || media.displayName || "",
        model: media.model || "-",
        ratio: "-",
        resolution: "-",
        duration: media.kind === "video" ? "-" : "-",
        size: "-",
        style: "-",
        createdAtTs: operationTs || media.createdAtTs,
      });
    }
  }

  return items;
}

function getWorkspaceImageFailureCounts(state: unknown) {
  const map = new Map<string, number>();
  if (!isRecord(state) || !Array.isArray(state.sessions)) return map;

  for (const session of state.sessions.filter(isRecord)) {
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const baseRequestId = getString(message.requestId);
      if (!baseRequestId) continue;
      const failedCount = Math.max(0, finiteNumber(message.failedImageCount));
      if (failedCount > 0) map.set(baseRequestId, failedCount);
    }
  }

  return map;
}

function getWorkspaceFailureErrorMap(state: unknown) {
  const map = new Map<string, string>();
  if (!isRecord(state) || !Array.isArray(state.sessions)) return map;

  for (const session of state.sessions.filter(isRecord)) {
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const baseRequestId = getString(message.requestId);
      const error = getString(message.error);
      if (baseRequestId && error) map.set(baseRequestId, error);
    }
  }

  return map;
}

function getWorkspaceMediaItems(state: unknown): AdminMediaItem[] {
  if (!isRecord(state) || !Array.isArray(state.sessions)) return [];

  const items: AdminMediaItem[] = [];
  const deletedAssetInfoMap = getDeletedAssetInfoMap(state);
  const assetDisplayNameMap = getWorkspaceAssetDisplayNameMap(state);

  for (const session of state.sessions.filter(isRecord)) {
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      const baseRequestId = getString(message.requestId, getString(message.id, "message"));
      const meta = isRecord(message.generationMeta) ? message.generationMeta : undefined;
      const settings = isRecord(meta?.settings) ? meta.settings : undefined;
      const modelId = getString(meta?.model, "-");
      const ratio = getString(settings?.ratio, "-");
      const resolution = getString(settings?.resolution, "-");
      const duration = getString(settings?.duration, "-");
      const style = getString(settings?.style, "-");
      const originalPrompt = getString(meta?.originalPrompt, getString(message.content));
      const imagePrompts = getMediaPrompt(message, "imagePrompts");
      const videoPrompts = getMediaPrompt(message, "videoPrompts");
      const imageDimensions = isRecord(message.imageDimensions) ? message.imageDimensions : undefined;
      const videoDimensionsMap = isRecord(message.videoDimensionsMap) ? message.videoDimensionsMap : undefined;
      const mediaSystemNames = isRecord(message.mediaSystemNames) ? message.mediaSystemNames : undefined;

      const imageSlotUrls = Array.isArray(message.imageResultSlots)
        ? message.imageResultSlots.filter(isRecord).filter((slot) => slot.type === "image").map((slot) => getString(slot.url)).filter(Boolean)
        : [];
      const imageUrls = imageSlotUrls.length > 0 ? imageSlotUrls : getStringArray(message.images);

      imageUrls.forEach((url, index) => {
        const deletedInfo = deletedAssetInfoMap.get(url) ?? deletedAssetInfoMap.get(normalizeMediaUrlForAdmin(url));
        const systemName = getString(mediaSystemNames?.[url]);
        const displayName = assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? formatAdminMediaName(systemName, undefined, `图片${index + 1}`);
        items.push({
          id: `${getString(message.id, "message")}-image-${index}`,
          requestId: `${baseRequestId}:image:${index}`,
          type: "image",
          systemName,
          isDeleted: Boolean(deletedInfo),
          deletedAtLabel: deletedInfo?.deletedAtLabel,
          name: displayName,
          url,
          prompt: /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(normalizeMediaUrlForAdmin(url)) ? getString(imagePrompts?.[url]) : getString(imagePrompts?.[url], originalPrompt),
          model: getModelLabel("image", modelId),
          ratio,
          resolution,
          duration: "-",
          size: getDimensionsLabel(imageDimensions?.[url]),
          style,
          createdAtTs: finiteNumber(message.createdAt),
        });
      });

      const videoUrl = getString(message.videoUrl);
      const videoUrls = videoUrl ? [...getStringArray(message.videos), videoUrl].filter((url, index, array) => array.indexOf(url) === index) : getStringArray(message.videos);

      videoUrls.forEach((url, index) => {
        const deletedInfo = deletedAssetInfoMap.get(url) ?? deletedAssetInfoMap.get(normalizeMediaUrlForAdmin(url));
        const systemName = getString(mediaSystemNames?.[url]);
        const displayName = assetDisplayNameMap.get(url) ?? assetDisplayNameMap.get(normalizeMediaUrlForAdmin(url)) ?? formatAdminMediaName(systemName, undefined, `视频${index + 1}`);
        items.push({
          id: `${getString(message.id, "message")}-video-${index}`,
          requestId: `${baseRequestId}:video:${index}`,
          type: "video",
          systemName,
          isDeleted: Boolean(deletedInfo),
          deletedAtLabel: deletedInfo?.deletedAtLabel,
          name: displayName,
          url,
          prompt: getString(videoPrompts?.[url], originalPrompt),
          model: getModelLabel("video", modelId),
          ratio,
          resolution,
          duration,
          size: getDimensionsLabel(videoDimensionsMap?.[url] ?? message.videoDimensions),
          style: "-",
          createdAtTs: finiteNumber(message.createdAt),
        });
      });
    }
  }

  return items;
}

function getWorkspaceMediaUrlMap(state: unknown) {
  const map = new Map<string, string>();
  if (!isRecord(state) || !Array.isArray(state.sessions)) return map;

  for (const session of state.sessions.filter(isRecord)) {
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      const baseRequestId = getString(message.requestId);
      if (!baseRequestId) continue;

      const imageSlotUrls = Array.isArray(message.imageResultSlots)
        ? message.imageResultSlots.filter(isRecord).filter((slot) => slot.type === "image").map((slot) => getString(slot.url)).filter(Boolean)
        : [];
      const imageUrls = imageSlotUrls.length > 0 ? imageSlotUrls : getStringArray(message.images);
      imageUrls.forEach((url, index) => {
        map.set(`${baseRequestId}:image:${index}`, url);
      });
      if (imageUrls[0]) {
        map.set(baseRequestId, imageUrls[0]);
        map.set(`${baseRequestId}:image`, imageUrls[0]);
      }

      const videoUrl = getString(message.videoUrl);
      const videoUrls = videoUrl ? [...getStringArray(message.videos), videoUrl].filter((url, index, array) => array.indexOf(url) === index) : getStringArray(message.videos);
      videoUrls.forEach((url, index) => {
        map.set(`${baseRequestId}:video:${index}`, url);
      });
      if (videoUrls[0]) {
        map.set(baseRequestId, videoUrls[0]);
        map.set(`${baseRequestId}:video`, videoUrls[0]);
      }

      const imageResultSlots = Array.isArray(message.imageResultSlots) ? message.imageResultSlots.filter(isRecord) : [];
      let imageOrdinal = 0;
      let failedOrdinal = 0;
      for (const slot of imageResultSlots) {
        if (slot.type === "image") {
          const url = getString(slot.url);
          if (url) map.set(`${baseRequestId}:image:${imageOrdinal}`, url);
          imageOrdinal += 1;
        }
        if (slot.type === "failed") {
          map.set(`${baseRequestId}:image:failed:${failedOrdinal}`, "__FAILED__");
          failedOrdinal += 1;
        }
      }
    }
  }

  return map;
}

function getWorkspaceMediaSystemNameMap(state: unknown) {
  const map = new Map<string, string>();
  if (!isRecord(state) || !Array.isArray(state.sessions)) return map;

  for (const session of state.sessions.filter(isRecord)) {
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      if (!isRecord(message.mediaSystemNames)) continue;
      for (const [url, systemName] of Object.entries(message.mediaSystemNames)) {
        if (typeof url === "string" && url && typeof systemName === "string" && systemName) {
          map.set(url, systemName);
          map.set(normalizeMediaUrlForAdmin(url), systemName);
        }
      }
    }
  }

  return map;
}

function getWorkspaceAssetDisplayNameMap(state: unknown) {
  const map = new Map<string, string>();
  if (!isRecord(state) || !Array.isArray(state.assets)) return map;

  for (const asset of state.assets.filter(isRecord)) {
    const url = getString(asset.url);
    if (!url) continue;
    const systemName = getString(asset.systemName) || getString(asset.name);
    const userName = getString(asset.userName) || (getString(asset.name) && getString(asset.name) !== systemName ? getString(asset.name) : "");
    const displayName = formatAdminMediaName(systemName, userName, userName || systemName || "媒体");
    map.set(url, displayName);
    map.set(normalizeMediaUrlForAdmin(url), displayName);
  }

  return map;
}

function getWorkspaceMediaDetailMap(state: unknown) {
  const map = new Map<string, AdminMediaItem>();
  for (const item of getWorkspaceMediaItems(state)) {
    map.set(item.url, item);
    map.set(normalizeMediaUrlForAdmin(item.url), item);
  }
  return map;
}

function formatAdminMediaParameterLine(media: AdminMediaItem | undefined, kind: "image" | "video", fallbackModel: string, fallbackLabel: string) {
  if (!media) return [getModelLabel(kind, fallbackModel || "-"), fallbackLabel || "-"].join(" | ");
  const sizeAndResolution = [media.size, media.resolution].filter((item) => item && item !== "-").join(" ");
  return [media.model, media.ratio, sizeAndResolution, kind === "video" && media.duration !== "-" ? media.duration : ""].filter((item) => item && item !== "-").join(" | ");
}

function getWorkspaceConversationMediaItems(state: unknown) {
  const map = new Map<string, AdminCreditFlowItem[]>();
  if (!isRecord(state) || !Array.isArray(state.sessions)) return map;

  for (const session of state.sessions.filter(isRecord)) {
    const conversationId = getString(session.id);
    if (!conversationId) continue;
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    const items: AdminCreditFlowItem[] = [];

    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const messageId = getString(message.id, "message");
      const requestId = getString(message.requestId, messageId);
      const meta = isRecord(message.generationMeta) ? message.generationMeta : undefined;
      const settings = isRecord(meta?.settings) ? meta.settings : undefined;
      const modelId = getString(meta?.model, "-");
      const ratio = getString(settings?.ratio, "-");
      const resolution = getString(settings?.resolution, "-");
      const duration = getString(settings?.duration, "-");
      const mediaSystemNames = isRecord(message.mediaSystemNames) ? message.mediaSystemNames : undefined;
      const imageDimensions = isRecord(message.imageDimensions) ? message.imageDimensions : undefined;
      const videoDimensionsMap = isRecord(message.videoDimensionsMap) ? message.videoDimensionsMap : undefined;
      const createdAtLabel = formatTimestamp(message.createdAt);
      const createdAtTs = finiteNumber(message.createdAt);

      const imageSlotUrls = Array.isArray(message.imageResultSlots)
        ? message.imageResultSlots.filter(isRecord).filter((slot) => slot.type === "image").map((slot) => getString(slot.url)).filter(Boolean)
        : [];
      const imageUrls = imageSlotUrls.length > 0 ? imageSlotUrls : getStringArray(message.images);
      imageUrls.forEach((url, index) => {
        const systemName = getString(mediaSystemNames?.[url]);
        const media: AdminMediaItem = { id: `${messageId}-image-${index}`, type: "image", url, prompt: "", model: getModelLabel("image", modelId), ratio, resolution, duration: "-", size: getDimensionsLabel(imageDimensions?.[url]) };
        items.push({
          id: `${messageId}-zero-image-${index}`,
          requestId: `${requestId}:image:${index}`,
          kind: "image",
          systemName,
          displayName: systemName || "image",
          url,
          status: "success",
          credits: 0,
          totalTokens: 0,
          usd: 0,
          cny: 0,
          count: 0,
          model: modelId,
          parameters: formatAdminMediaParameterLine(media, "image", modelId, "图片生成"),
          createdAtLabel,
          createdAtTs,
        });
      });

      const videoUrl = getString(message.videoUrl);
      const videoUrls = videoUrl ? [...getStringArray(message.videos), videoUrl].filter((url, index, array) => array.indexOf(url) === index) : getStringArray(message.videos);
      videoUrls.forEach((url, index) => {
        const systemName = getString(mediaSystemNames?.[url]);
        const media: AdminMediaItem = { id: `${messageId}-video-${index}`, type: "video", url, prompt: "", model: getModelLabel("video", modelId), ratio, resolution, duration, size: getDimensionsLabel(videoDimensionsMap?.[url] ?? message.videoDimensions) };
        items.push({
          id: `${messageId}-zero-video-${index}`,
          requestId: `${requestId}:video:${index}`,
          kind: "video",
          systemName,
          displayName: systemName || "video",
          url,
          status: "success",
          credits: 0,
          totalTokens: 0,
          usd: 0,
          cny: 0,
          count: 0,
          model: modelId,
          parameters: formatAdminMediaParameterLine(media, "video", modelId, "视频生成"),
          createdAtLabel,
          createdAtTs,
        });
      });
    }

    map.set(conversationId, items);
  }

  return map;
}

function getUploadedFileName(file: unknown, index: number) {
  if (typeof file === "string") return file || `上传文件${index + 1}`;
  if (!isRecord(file)) return `上传文件${index + 1}`;
  return getString(file.name) || getString(file.storageName) || `上传文件${index + 1}`;
}

function getWorkspaceConversationUploadItems(state: unknown) {
  const map = new Map<string, AdminCreditFlowItem[]>();
  if (!isRecord(state) || !Array.isArray(state.sessions)) return map;

  for (const session of state.sessions.filter(isRecord)) {
    const conversationId = getString(session.id);
    if (!conversationId) continue;
    const messages = Array.isArray(session.messages) ? session.messages.filter(isRecord) : [];
    const items: AdminCreditFlowItem[] = [];

    for (const message of messages) {
      if (message.role !== "user") continue;
      const messageId = getString(message.id, "message");
      const createdAtLabel = formatTimestamp(message.createdAt);
      const createdAtTs = finiteNumber(message.createdAt);
      const imageReferences = Array.isArray(message.imageReferences) ? message.imageReferences.filter(isRecord) : [];
      const imageNames = new Map(imageReferences.map((reference) => [getString(reference.url), getString(reference.name)]));
      const uploadedImages = getStringArray(message.images).filter((url) => /\/generated\/(?:users\/[^/]+\/)?upload_image\//.test(normalizeMediaUrlForAdmin(url)));

      uploadedImages.forEach((url, index) => {
        items.push({
          id: `${messageId}-uploaded-image-${index}`,
          requestId: `${messageId}-uploaded-image-${index}`,
          kind: "image",
          systemName: imageNames.get(url) || "",
          displayName: imageNames.get(url) || `上传图片${index + 1}`,
          url,
          status: "success",
          credits: 0,
          totalTokens: 0,
          usd: 0,
          cny: 0,
          count: 1,
          model: "-",
          parameters: "对话流上传",
          isUploadRecord: true,
          createdAtLabel,
          createdAtTs,
        });
      });

      const uploadedFiles = Array.isArray(message.uploadedFiles) ? message.uploadedFiles : [];
      uploadedFiles.forEach((file, index) => {
        items.push({
          id: `${messageId}-uploaded-file-${index}`,
          requestId: `${messageId}-uploaded-file-${index}`,
          kind: "file",
          systemName: "",
          displayName: getUploadedFileName(file, index),
          url: "",
          status: "success",
          credits: 0,
          totalTokens: 0,
          usd: 0,
          cny: 0,
          count: 1,
          model: "-",
          parameters: "对话流上传文件",
          isUploadRecord: true,
          createdAtLabel,
          createdAtTs,
        });
      });
    }

    map.set(conversationId, items);
  }

  return map;
}

function getAssetGenerationCategory(source: string) {
  if (source === "character_image_generation") return { id: "character", title: "角色" };
  if (source === "scene_image_generation") return { id: "scene", title: "场景" };
  return { id: "shot", title: "分镜" };
}

function getAssetTypeForCreditCategory(categoryId: string) {
  if (categoryId === "character") return "character_image";
  if (categoryId === "scene") return "scene_image";
  return "shot_image";
}

function getAssetUploadCreditCategory(assetType: string | undefined) {
  if (assetType === "character_image") return { id: "character", title: "角色" };
  if (assetType === "scene_image") return { id: "scene", title: "场景" };
  if (assetType === "shot_image") return { id: "shot", title: "分镜" };
  return undefined;
}

function findClosestAssetMedia(assetMediaMap: Map<string, AdminMediaItem> | undefined, categoryId: string, createdAt: Date) {
  const targetType = getAssetTypeForCreditCategory(categoryId);
  const targetTime = createdAt.getTime();
  return Array.from(new Set(Array.from(assetMediaMap?.values() ?? [])))
    .filter((asset) => asset.assetType === targetType && asset.createdAtTs)
    .sort((left, right) => Math.abs((left.createdAtTs ?? 0) - targetTime) - Math.abs((right.createdAtTs ?? 0) - targetTime))[0];
}

function isReversePromptAssetMedia(media: AdminMediaItem | undefined) {
  return Boolean(media?.isUploadedAsset);
}

function enrichUploadCreditItem(item: AdminCreditFlowItem, assetMediaMap: Map<string, AdminMediaItem> | undefined) {
  if (item.kind !== "image" || !item.url) return item;
  const asset = assetMediaMap?.get(item.url) ?? assetMediaMap?.get(normalizeMediaUrlForAdmin(item.url));
  if (!asset) return item;
  return {
    ...item,
    status: item.status,
    errorText: asset.isDeleted ? "用户已删除" : item.errorText,
    deletedAtLabel: asset.deletedAtLabel ?? item.deletedAtLabel,
    isReversePrompt: asset.isReversePrompt,
    promptText: asset.isReversePrompt ? asset.prompt : undefined,
  };
}

function getPromptToolCategory(source: string) {
  if (source === "image_prompt_reverse") return { id: "reverse", title: "反推提示词" };
  return { id: "optimization", title: "优化提示词" };
}

function getWorkspaceAssetMediaItems(state: unknown): AdminMediaItem[] {
  if (!isRecord(state) || !Array.isArray(state.assets)) return [];

  return state.assets.filter(isRecord).flatMap((asset, index): AdminMediaItem[] => {
    const assetType = getString(asset.type);
    if (asset.librarySource !== "asset_generation") return [];
    if (assetType !== "character_image" && assetType !== "scene_image" && assetType !== "shot_image" && assetType !== "trash") return [];
    const url = getString(asset.url);
    if (!url) return [];

    const previewMeta = isRecord(asset.previewMeta) ? asset.previewMeta : undefined;
    const prompt = getString(asset.sourcePrompt);
    const isUploadedAsset = !previewMeta;
    const systemName = getString(asset.systemName) || getString(asset.name);
    const userName = getString(asset.userName) || (getString(asset.name) && getString(asset.name) !== systemName ? getString(asset.name) : "");

    return [{
      id: getString(asset.id, `asset-image-${index}`),
      type: "image",
      assetType: assetType === "trash" ? undefined : assetType,
      isDeleted: assetType === "trash" || Boolean(asset.deletedAt),
      deletedAtLabel: finiteNumber(asset.deletedAt) > 0 ? formatTimestamp(asset.deletedAt) : undefined,
      isUploadedAsset,
      isReversePrompt: isUploadedAsset && Boolean(prompt.trim()) && prompt !== "资产库上传",
      systemName,
      userName,
      name: formatAdminMediaName(systemName, userName, `资产${index + 1}`),
      url,
      prompt: prompt === "资产库上传" ? "" : prompt,
      model: getString(previewMeta?.modelLabel, "-"),
      ratio: getString(previewMeta?.ratio, "-"),
      resolution: getString(previewMeta?.resolution, "-"),
      duration: "-",
      size: getString(previewMeta?.sizeText, "-"),
      style: getString(previewMeta?.styleLabel, "-"),
      createdAtTs: finiteNumber(asset.createdAt),
    }];
  });
}

function getWorkspaceAssetMediaMap(state: unknown) {
  const map = new Map<string, AdminMediaItem>();
  for (const item of getWorkspaceAssetMediaItems(state)) {
    map.set(item.id, item);
    map.set(item.url, item);
    map.set(normalizeMediaUrlForAdmin(item.url), item);
  }
  return map;
}

function getWorkspaceSummary(state: unknown) {
  const summary = { conversationCount: 0, generatedImageCount: 0, generatedVideoCount: 0, savedAssetCount: 0, totalTokens: 0, usd: 0 };
  if (!isRecord(state)) return summary;
  summary.savedAssetCount = Array.isArray(state.assets) ? state.assets.filter(isRecord).filter((asset) => !asset.deletedAt && asset.type !== "trash").length : 0;
  if (!Array.isArray(state.sessions)) return summary;

  summary.conversationCount = state.sessions.length;

  for (const session of state.sessions) {
    if (!isRecord(session)) continue;

    if (isRecord(session.usageSummary)) {
      summary.totalTokens += Math.max(0, Math.floor(finiteNumber(session.usageSummary.totalTokens)));
      summary.usd += Math.max(0, finiteNumber(session.usageSummary.usd));
    }

    if (!Array.isArray(session.messages)) continue;

    for (const message of session.messages) {
      if (!isRecord(message) || message.role !== "assistant") continue;

      const imageSlotCount = Array.isArray(message.imageResultSlots)
        ? message.imageResultSlots.filter((slot) => isRecord(slot) && slot.type === "image").length
        : 0;

      summary.generatedImageCount += imageSlotCount > 0 ? imageSlotCount : countStringArray(message.images);
      summary.generatedVideoCount += countStringArray(message.videos) || (typeof message.videoUrl === "string" && message.videoUrl.length > 0 ? 1 : 0);
    }
  }

  return summary;
}

function AdminShell({ adminEmail, activeTab, children }: { adminEmail: string; activeTab: AdminTab; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] text-[#111111]">
      <div className="grid min-h-screen min-w-[1464px] grid-cols-[220px_minmax(0,1fr)]">
        <aside className="sticky top-0 flex h-screen flex-col border-r border-[#e6e6e6] bg-white px-4 py-5">
          <div>
            <div className="mb-8 flex items-center gap-2 px-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/home-assets/logo.png" alt="闪念" className="h-9 w-9 rounded-[9px] object-contain" />
              <div>
                <div className="text-[15px] font-semibold leading-5">闪念后台</div>
                <div className="text-[11px] text-[#8a8a8a]">FlashMuse Admin</div>
              </div>
            </div>
            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const Icon = item.icon;

                return (
                  <a key={item.key} href={item.key === "overview" ? "/admin" : `/admin?tab=${item.key}`} className={`flex h-9 items-center gap-2 rounded-[9px] px-3 text-[13px] font-medium transition ${activeTab === item.key ? "bg-[#111111] text-white" : "text-[#555555] hover:bg-[#f1f1f1] hover:text-[#111111]"}`}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </nav>
          </div>
          <div className="mt-auto rounded-[14px] border border-[#eeeeee] bg-[#fafafa] p-3">
            <div className="text-[12px] text-[#999999]">当前管理员</div>
            <div className="mt-1 truncate text-[13px] font-medium text-[#333333]">{adminEmail}</div>
            <AdminLogoutButton />
          </div>
        </aside>
        <section className="min-w-0 px-8 py-6">
          {children}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-[16px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <div className="text-[13px] text-[#777777]">{label}</div>
      <div className="mt-3 text-[26px] font-semibold tracking-[-0.03em] text-[#111111]">{value}</div>
      {note ? <div className="mt-2 text-[12px] text-[#9a9a9a]">{note}</div> : null}
    </div>
  );
}

type ChartPoint = { label: string; value: number; secondaryValue?: number };
type RankItem = { label: string; value: string; note?: string };

function MiniLineChart({ title, points, secondaryLabel }: { title: string; points: ChartPoint[]; secondaryLabel?: string }) {
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.value, point.secondaryValue ?? 0]));
  const width = 520;
  const height = 170;
  const xStep = points.length > 1 ? width / (points.length - 1) : width;
  const toPoint = (value: number, index: number) => `${index * xStep},${height - (value / maxValue) * (height - 18) - 8}`;
  const primaryPath = points.map((point, index) => toPoint(point.value, index)).join(" ");
  const secondaryPath = points.map((point, index) => toPoint(point.secondaryValue ?? 0, index)).join(" ");

  return (
    <section className="rounded-[18px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[#111111]">{title}</h2>
        {secondaryLabel ? <div className="text-[12px] text-[#888888]"><span className="text-[#367cee]">●</span> 主指标　<span className="text-[#f59f00]">●</span> {secondaryLabel}</div> : null}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[170px] w-full overflow-visible">
        <polyline points={primaryPath} fill="none" stroke="#367cee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {secondaryLabel ? <polyline points={secondaryPath} fill="none" stroke="#f59f00" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </svg>
      <div className="mt-3 grid grid-cols-7 text-center text-[11px] text-[#999999]">
        {points.slice(-7).map((point) => <span key={point.label}>{point.label}</span>)}
      </div>
    </section>
  );
}

function MiniBarChart({ title, points, tone = "blue" }: { title: string; points: ChartPoint[]; tone?: "blue" | "red" | "green" }) {
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const color = tone === "red" ? "bg-red-400" : tone === "green" ? "bg-[#18a058]" : "bg-[#367cee]";

  return (
    <section className="rounded-[18px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <h2 className="mb-4 text-[16px] font-semibold text-[#111111]">{title}</h2>
      <div className="flex h-[180px] items-end gap-2 border-b border-[#eeeeee] pb-2">
        {points.map((point) => (
          <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="text-[11px] text-[#777777]">{point.value}</div>
            <div className={`w-full rounded-t-[6px] ${color}`} style={{ height: `${Math.max(4, (point.value / maxValue) * 130)}px` }} />
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-[11px] text-[#999999]">
        {points.slice(-7).map((point) => <span key={point.label}>{point.label}</span>)}
      </div>
    </section>
  );
}

function OverviewTable({ title, items }: { title: string; items: RankItem[] }) {
  return (
    <section className="rounded-[18px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <h2 className="mb-4 text-[16px] font-semibold text-[#111111]">{title}</h2>
      <div className="space-y-2">
        {items.length > 0 ? items.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex items-center justify-between gap-3 rounded-[10px] bg-[#f8f8f8] px-3 py-2 text-[13px]">
            <div className="min-w-0"><div className="truncate font-medium text-[#333333]">{index + 1}. {item.label}</div>{item.note ? <div className="mt-0.5 truncate text-[11px] text-[#999999]">{item.note}</div> : null}</div>
            <div className="shrink-0 font-semibold text-[#111111]">{item.value}</div>
          </div>
        )) : <div className="py-8 text-center text-[13px] text-[#999999]">暂无数据</div>}
      </div>
    </section>
  );
}

function OverviewPillGrid({ title, items }: { title: string; items: RankItem[] }) {
  return (
    <section className="rounded-[18px] border border-[#eeeeee] bg-white p-5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <h2 className="mb-4 text-[16px] font-semibold text-[#111111]">{title}</h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => <div key={item.label} className="rounded-[12px] bg-[#f8f8f8] p-3"><div className="text-[12px] text-[#777777]">{item.label}</div><div className="mt-2 text-[18px] font-semibold text-[#111111]">{item.value}</div>{item.note ? <div className="mt-1 text-[11px] text-[#999999]">{item.note}</div> : null}</div>)}
      </div>
    </section>
  );
}

function PageHeader({ title }: { title: string }) {
  return (
    <div className="mb-12 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">{title}</h1>
      </div>
    </div>
  );
}

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ tab?: string | string[] }> }) {
  const adminEmails = getAdminEmails();
  const currentAdminEmail = await getCurrentAdminEmail();
  const activeTab = getAdminTab((await searchParams)?.tab);

  if (!currentAdminEmail) {
    return <AdminLoginForm hasAdminEmails={adminEmails.length > 0} />;
  }

  if (!isAdminEmail(currentAdminEmail)) {
    return <AdminLoginForm hasAdminEmails={adminEmails.length > 0} initialMessage={`当前账号 ${currentAdminEmail} 不在后台白名单中，请使用管理员邮箱登录`} />;
  }

  const [users, totalUsers, todayUsers, disabledUsers, userTotals, creditSettings, creditLedgers, systemSettings] = await Promise.all([
    prisma.user.findMany({
      orderBy: { updatedAt: "desc" },
      take: 1000,
      include: {
        workspace: { select: { state: true, updatedAt: true } },
        sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
        _count: { select: { sessions: true } },
      },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.user.count({ where: { disabled: true } }),
    prisma.user.aggregate({ _sum: { generatedImageCount: true, generatedVideoCount: true, credits: true } }),
    getCreditSettings(),
    prisma.creditLedger.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { email: true, nickname: true } } } }),
    Promise.resolve(getAdminSystemSettings()),
  ]);

  const totalImages = userTotals._sum.generatedImageCount || 0;
  const totalVideos = userTotals._sum.generatedVideoCount || 0;
  const totalCredits = userTotals._sum.credits || 0;
  const increasedCredits = creditLedgers.filter((item) => item.direction === "increase").reduce((sum, item) => sum + item.credits, 0);
  const normalUsers = totalUsers - disabledUsers;
  const userIncreaseMap = new Map<string, number>();
  const userSignupIncreaseMap = new Map<string, number>();
  const userAdminAdjustIncreaseMap = new Map<string, number>();
  const userCreditLastActiveMap = new Map<string, Date>();
  const userConsumeMap = new Map<string, { credits: number; totalTokens: number; usd: number; cny: number }>();
  const userConversationConsumeMap = new Map<string, number>();
  const userAssetGenerationConsumeMap = new Map<string, number>();
  const userPromptToolConsumeMap = new Map<string, number>();
  const userConversationCreditDetailMap = new Map<string, Map<string, AdminCreditConversationDetail>>();
  const userAssetGenerationCreditDetailMap = new Map<string, Map<string, AdminCreditCategoryDetail>>();
  const userPromptToolCreditDetailMap = new Map<string, Map<string, AdminCreditCategoryDetail>>();
  const userCreditBalanceDetailMap = new Map<string, AdminCreditUser["currentCreditDetails"]>();
  const userWorkspaceMediaUrlMaps = new Map<string, Map<string, string>>();
  const userWorkspaceMediaSystemNameMaps = new Map<string, Map<string, string>>();
  const userWorkspaceMediaDetailMaps = new Map<string, Map<string, AdminMediaItem>>();
  const userWorkspaceAssetMediaMaps = new Map<string, Map<string, AdminMediaItem>>();
  const userWorkspaceDeletedAssetInfoMaps = new Map<string, Map<string, { deletedAtLabel?: string }>>();
  const userWorkspaceConversationMediaItemMaps = new Map<string, Map<string, AdminCreditFlowItem[]>>();
  const userWorkspaceConversationUploadItemMaps = new Map<string, Map<string, AdminCreditFlowItem[]>>();
  const userWorkspaceImageFailureMaps = new Map<string, Map<string, number>>();
  const userWorkspaceFailureErrorMaps = new Map<string, Map<string, string>>();

  for (const user of users) {
    userWorkspaceMediaUrlMaps.set(user.id, getWorkspaceMediaUrlMap(user.workspace?.state));
    userWorkspaceMediaSystemNameMaps.set(user.id, getWorkspaceMediaSystemNameMap(user.workspace?.state));
    userWorkspaceMediaDetailMaps.set(user.id, getWorkspaceMediaDetailMap(user.workspace?.state));
    userWorkspaceAssetMediaMaps.set(user.id, getWorkspaceAssetMediaMap(user.workspace?.state));
    userWorkspaceDeletedAssetInfoMaps.set(user.id, getDeletedAssetInfoMap(user.workspace?.state));
    userWorkspaceConversationMediaItemMaps.set(user.id, getWorkspaceConversationMediaItems(user.workspace?.state));
    userWorkspaceConversationUploadItemMaps.set(user.id, getWorkspaceConversationUploadItems(user.workspace?.state));
    userWorkspaceImageFailureMaps.set(user.id, getWorkspaceImageFailureCounts(user.workspace?.state));
    userWorkspaceFailureErrorMaps.set(user.id, getWorkspaceFailureErrorMap(user.workspace?.state));
  }

  for (const item of creditLedgers) {
    const latest = userCreditLastActiveMap.get(item.userId);
    if (!latest || item.createdAt > latest) userCreditLastActiveMap.set(item.userId, item.createdAt);
    if (item.direction === "increase") {
      userIncreaseMap.set(item.userId, (userIncreaseMap.get(item.userId) ?? 0) + item.credits);
      if (item.kind === "signup") userSignupIncreaseMap.set(item.userId, (userSignupIncreaseMap.get(item.userId) ?? 0) + item.credits);
      if (item.kind === "admin_adjust") userAdminAdjustIncreaseMap.set(item.userId, (userAdminAdjustIncreaseMap.get(item.userId) ?? 0) + item.credits);
    }
  }

  for (const user of users) {
    const userLedgers = creditLedgers.filter((item) => item.userId === user.id).sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const totalDelta = userLedgers.reduce((sum, item) => sum + (item.direction === "increase" ? item.credits : -item.credits), 0);
    let balance = user.credits - totalDelta;
    const details: AdminCreditUser["currentCreditDetails"] = [];

    for (const item of userLedgers) {
      const delta = item.direction === "increase" ? item.credits : -item.credits;
      balance += delta;
      details.push({
        id: item.id,
        reason: getCreditLedgerReason(item.kind, item.label, item.metadata),
        delta,
        balanceAfter: balance,
        createdAtLabel: formatShortDate(item.createdAt),
        createdAtTs: item.createdAt.getTime(),
      });
    }

    userCreditBalanceDetailMap.set(user.id, details.sort((left, right) => right.createdAtTs - left.createdAtTs));
  }

  for (const item of creditLedgers.filter((ledger) => ledger.direction === "consume")) {
    const userConsume = userConsumeMap.get(item.userId) ?? { credits: 0, totalTokens: 0, usd: 0, cny: 0 };
    userConsume.credits += item.credits;
    userConsume.totalTokens += item.totalTokens;
    userConsume.usd += item.usd;
    userConsume.cny += item.cny;
    userConsumeMap.set(item.userId, userConsume);

    const creditSource = getCreditSource(item.metadata);

    if (creditSource === "character_image_generation" || creditSource === "scene_image_generation" || creditSource === "shot_image_generation") {
      userAssetGenerationConsumeMap.set(item.userId, (userAssetGenerationConsumeMap.get(item.userId) ?? 0) + item.credits);
      const category = getAssetGenerationCategory(creditSource);
      const userDetails = userAssetGenerationCreditDetailMap.get(item.userId) ?? new Map<string, AdminCreditCategoryDetail>();
      const assetMediaMap = userWorkspaceAssetMediaMaps.get(item.userId);
      const assetLedgerUrl = getLedgerMediaUrls(item.metadata)[0] ?? "";
      const exactAssetMedia = assetLedgerUrl ? assetMediaMap?.get(assetLedgerUrl) ?? assetMediaMap?.get(normalizeMediaUrlForAdmin(assetLedgerUrl)) : undefined;
      const assetMedia = assetLedgerUrl ? exactAssetMedia : findClosestAssetMedia(assetMediaMap, category.id, item.createdAt);
      const isDeletedAssetMedia = Boolean(assetMedia?.isDeleted);
      const detail = userDetails.get(category.id) ?? { id: category.id, title: category.title, totalCredits: 0, totalUsd: 0, totalCny: 0, items: [] };
      detail.totalCredits += item.credits;
      detail.totalUsd += item.usd;
      detail.totalCny += item.cny;
      detail.items.push({ id: item.id, requestId: item.requestId ?? item.id, kind: "image", systemName: "", displayName: assetMedia?.name || item.label || category.title, url: assetMedia?.url || assetLedgerUrl, status: "success", errorText: isDeletedAssetMedia || assetMedia?.isDeleted ? "用户已删除" : undefined, deletedAtLabel: assetMedia?.deletedAtLabel, credits: item.credits, totalTokens: item.totalTokens, usd: item.usd, cny: item.cny, count: item.imageCount, model: item.model || "-", parameters: formatAdminMediaParameterLine(assetMedia, "image", item.model || "-", item.label || category.title), isChargeDisabled: getMetadataBoolean(item.metadata, "creditChargeDisabled"), promptText: assetMedia?.prompt, createdAtLabel: formatShortDate(item.createdAt), createdAtTs: item.createdAt.getTime() });
      userDetails.set(category.id, detail);
      userAssetGenerationCreditDetailMap.set(item.userId, userDetails);
    } else if (creditSource === "image_prompt_reverse" || creditSource === "prompt_optimization") {
      userPromptToolConsumeMap.set(item.userId, (userPromptToolConsumeMap.get(item.userId) ?? 0) + item.credits);
      const category = getPromptToolCategory(creditSource);
      const userDetails = userPromptToolCreditDetailMap.get(item.userId) ?? new Map<string, AdminCreditCategoryDetail>();
      const mediaDetailMap = userWorkspaceMediaDetailMaps.get(item.userId);
      const assetMediaMap = userWorkspaceAssetMediaMaps.get(item.userId);
      const matchedUrl = getLedgerMediaUrls(item.metadata)[0] ?? "";
      const exactPromptMedia = matchedUrl ? assetMediaMap?.get(matchedUrl) ?? assetMediaMap?.get(normalizeMediaUrlForAdmin(matchedUrl)) ?? (creditSource === "prompt_optimization" ? mediaDetailMap?.get(matchedUrl) ?? mediaDetailMap?.get(normalizeMediaUrlForAdmin(matchedUrl)) : undefined) : undefined;
      const promptMedia = creditSource === "image_prompt_reverse" && exactPromptMedia && !isReversePromptAssetMedia(exactPromptMedia) ? undefined : exactPromptMedia;
      const detail = userDetails.get(category.id) ?? { id: category.id, title: category.title, totalCredits: 0, totalUsd: 0, totalCny: 0, items: [] };
      detail.totalCredits += item.credits;
      detail.totalUsd += item.usd;
      detail.totalCny += item.cny;
      const outputPrompt = getMetadataString(item.metadata, "outputPrompt") || (creditSource === "image_prompt_reverse" ? promptMedia?.prompt || "" : "");
      const failureReason = getMetadataString(item.metadata, "failureReason");
      const isFailedPromptTool = getMetadataString(item.metadata, "status") === "failed" || Boolean(failureReason);
      if (creditSource === "image_prompt_reverse" && (!matchedUrl || (!outputPrompt && !isFailedPromptTool))) continue;
      if (creditSource === "prompt_optimization" && !outputPrompt && !isFailedPromptTool) continue;
      detail.items.push({ id: item.id, requestId: item.requestId ?? item.id, kind: "image", systemName: "", displayName: isFailedPromptTool ? creditSource === "image_prompt_reverse" ? "反推失败" : "优化失败" : outputPrompt, mediaName: creditSource === "image_prompt_reverse" ? promptMedia?.name : undefined, url: promptMedia?.url || "", status: isFailedPromptTool ? "failed" : "success", errorText: isFailedPromptTool ? failureReason || "服务器繁忙，请稍候再试！" : undefined, credits: item.credits, totalTokens: item.totalTokens, usd: item.usd, cny: item.cny, count: item.imageCount, model: item.model || "-", parameters: getModelLabel("image", item.model || "-"), isChargeDisabled: getMetadataBoolean(item.metadata, "creditChargeDisabled"), createdAtLabel: formatShortDate(item.createdAt), createdAtTs: item.createdAt.getTime() });
      userDetails.set(category.id, detail);
      userPromptToolCreditDetailMap.set(item.userId, userDetails);
    } else {
      const conversationId = item.conversationId || `unknown-${item.userId}`;
      const userDetails = userConversationCreditDetailMap.get(item.userId) ?? new Map<string, AdminCreditConversationDetail>();
        const detail = userDetails.get(conversationId) ?? {
          id: conversationId,
          title: item.conversationTitle || "未命名对话",
          updatedAtLabel: formatShortDate(item.createdAt),
          updatedAtTs: item.createdAt.getTime(),
          chatCredits: 0,
          chatUsd: 0,
          chatCny: 0,
          planCredits: 0,
          planUsd: 0,
          planCny: 0,
          chatChargeDisabled: false,
          planChargeDisabled: false,
          mediaItems: [],
        };

      if (item.conversationTitle) detail.title = item.conversationTitle;
      if (item.createdAt.getTime() >= (detail.updatedAtTs ?? 0)) {
        detail.updatedAtLabel = formatShortDate(item.createdAt);
        detail.updatedAtTs = item.createdAt.getTime();
      }

        if (item.kind === "text") {
          if (item.label === "Agent 规划" || item.requestId?.endsWith(":plan")) {
            detail.planCredits += item.credits;
            detail.planUsd = (detail.planUsd ?? 0) + item.usd;
            detail.planCny = (detail.planCny ?? 0) + item.cny;
            detail.planChargeDisabled = detail.planChargeDisabled || getMetadataBoolean(item.metadata, "creditChargeDisabled");
          } else {
            detail.chatCredits += item.credits;
            detail.chatUsd = (detail.chatUsd ?? 0) + item.usd;
            detail.chatCny = (detail.chatCny ?? 0) + item.cny;
            detail.chatChargeDisabled = detail.chatChargeDisabled || getMetadataBoolean(item.metadata, "creditChargeDisabled");
          }
        userConversationConsumeMap.set(item.userId, (userConversationConsumeMap.get(item.userId) ?? 0) + item.credits);
      } else if (item.kind === "image" || item.kind === "video") {
        const mediaUrlMap = userWorkspaceMediaUrlMaps.get(item.userId);
        const mediaDetailMap = userWorkspaceMediaDetailMaps.get(item.userId);
        const deletedAssetInfoMap = userWorkspaceDeletedAssetInfoMaps.get(item.userId);
        const requestId = item.requestId ?? "";
        const baseRequestId = requestId.replace(/:(image|video):\d+$/, "");
        const hasIndexedMediaRequestId = /:(image|video):\d+$/.test(requestId);
        const ledgerMediaUrls = getLedgerMediaUrls(item.metadata);
        const workspaceUrl = mediaUrlMap?.get(requestId) ?? (!hasIndexedMediaRequestId ? mediaUrlMap?.get(baseRequestId) ?? mediaUrlMap?.get(`${baseRequestId}:${item.kind}`) : "") ?? "";
        const resolvedUrl = workspaceUrl || ledgerMediaUrls[0] || "";
        const deletedAssetInfoUrl = ledgerMediaUrls[0] || resolvedUrl;
        const deletedAssetInfo = deletedAssetInfoUrl ? deletedAssetInfoMap?.get(deletedAssetInfoUrl) ?? deletedAssetInfoMap?.get(normalizeMediaUrlForAdmin(deletedAssetInfoUrl)) : undefined;
        const isDeletedMedia = Boolean(deletedAssetInfo);
        if (!resolvedUrl) continue;
        const mediaDetail = mediaDetailMap?.get(resolvedUrl) ?? mediaDetailMap?.get(normalizeMediaUrlForAdmin(resolvedUrl));
        const workspaceMediaSystemNameMap = userWorkspaceMediaSystemNameMaps.get(item.userId);
        const rawSystemName = typeof item.metadata === "object" && item.metadata && "systemName" in item.metadata ? String(item.metadata.systemName || "") : (mediaDetail?.systemName || workspaceMediaSystemNameMap?.get(resolvedUrl) || "");
        const rawUserName = typeof item.metadata === "object" && item.metadata && "assetName" in item.metadata ? String(item.metadata.assetName || "") : "";
        const displayName = mediaDetail?.name || formatAdminMediaName(rawSystemName, rawUserName, resolvedUrl === "__FAILED__" ? "生成失败" : item.kind === "video" ? "video" : "image");
        const parameterLine = formatAdminMediaParameterLine(mediaDetail, item.kind, item.model || "-", item.label || "-");
        const mediaItem: AdminCreditFlowItem = {
          id: item.id,
          requestId,
          kind: item.kind,
          systemName: rawSystemName,
          displayName,
          url: resolvedUrl === "__FAILED__" ? "" : resolvedUrl,
          status: resolvedUrl === "__FAILED__" ? "failed" : "success",
          errorText: isDeletedMedia ? "用户已删除" : undefined,
          deletedAtLabel: isDeletedMedia ? deletedAssetInfo?.deletedAtLabel ?? formatShortDate(item.createdAt) : undefined,
          credits: item.credits,
          totalTokens: item.totalTokens,
          usd: item.usd,
          cny: item.cny,
          count: item.kind === "video" ? item.videoCount : item.imageCount,
          model: item.model || "-",
          parameters: parameterLine,
          isChargeDisabled: getMetadataBoolean(item.metadata, "creditChargeDisabled"),
          promptText: mediaDetail?.prompt,
          createdAtLabel: formatShortDate(item.createdAt),
          createdAtTs: item.createdAt.getTime(),
        };
        detail.mediaItems.push(mediaItem);
        userConversationConsumeMap.set(item.userId, (userConversationConsumeMap.get(item.userId) ?? 0) + item.credits);
      }

      userDetails.set(conversationId, detail);
      userConversationCreditDetailMap.set(item.userId, userDetails);
    }
  }

  const creditRows: AdminCreditUser[] = users.map((user) => {
    const creditSummary = userConsumeMap.get(user.id) ?? { credits: 0, totalTokens: 0, usd: 0, cny: 0 };
    const lastActiveAt = userCreditLastActiveMap.get(user.id);
    const workspaceConversations = getWorkspaceConversations(user.workspace?.state);
    const ledgerConversationDetails = userConversationCreditDetailMap.get(user.id);
    const imageFailureMap = userWorkspaceImageFailureMaps.get(user.id);
    const failureErrorMap = userWorkspaceFailureErrorMaps.get(user.id);
    const conversationMediaItemMap = userWorkspaceConversationMediaItemMaps.get(user.id);
    const conversationUploadItemMap = userWorkspaceConversationUploadItemMaps.get(user.id);
    const workspaceConversationIds = new Set(workspaceConversations.map((conversation) => conversation.id));
    const conversationCreditDetails = workspaceConversations
      .map((conversation) => {
        const detail = ledgerConversationDetails?.get(conversation.id);
        const assetMediaMapForUploads = userWorkspaceAssetMediaMaps.get(user.id);
        const uploadItems = (conversationUploadItemMap?.get(conversation.id) ?? []).map((item) => enrichUploadCreditItem(item, assetMediaMapForUploads));
        if (!detail && uploadItems.length === 0) return undefined;

        const nextDetail: AdminCreditConversationDetail = detail ? { ...detail, title: conversation.title, conversationCode: conversation.conversationCode, updatedAtLabel: conversation.updatedAtLabel, updatedAtTs: conversation.updatedAtTs, mediaItems: [...detail.mediaItems] } : { id: conversation.id, title: conversation.title, conversationCode: conversation.conversationCode, updatedAtLabel: conversation.updatedAtLabel, updatedAtTs: conversation.updatedAtTs, chatCredits: 0, chatUsd: 0, chatCny: 0, planCredits: 0, planUsd: 0, planCny: 0, mediaItems: [] };

        for (const [baseRequestId, failedCount] of imageFailureMap ?? []) {
          const hasMatchingMedia = nextDetail.mediaItems.some((item) => item.kind === "image" && item.requestId.startsWith(baseRequestId));
          if (!hasMatchingMedia) continue;
          for (let index = 0; index < failedCount; index += 1) {
            nextDetail.mediaItems.push({
              id: `${baseRequestId}:failed:${index}`,
              requestId: `${baseRequestId}:failed:${index}`,
              kind: "image",
              systemName: "",
              displayName: "生成失败",
              url: "",
              status: "failed",
              credits: 0,
              totalTokens: 0,
              usd: 0,
              cny: 0,
              count: 0,
              model: "-",
              parameters: "-",
              errorText: failureErrorMap?.get(baseRequestId) || "服务器繁忙，请稍候再试.....",
              createdAtLabel: conversation.updatedAtLabel,
              createdAtTs: new Date(conversation.updatedAtLabel).getTime() || 0,
            });
          }
        }

        const existingMediaUrls = new Set(nextDetail.mediaItems.map((item) => item.url).filter(Boolean).flatMap((url) => [url, normalizeMediaUrlForAdmin(url)]));
        const existingItemIds = new Set(nextDetail.mediaItems.map((item) => item.id));
        for (const item of uploadItems) {
          if (existingItemIds.has(item.id)) continue;
          if (item.url && (existingMediaUrls.has(item.url) || existingMediaUrls.has(normalizeMediaUrlForAdmin(item.url)))) continue;
          nextDetail.mediaItems.push(item);
          existingItemIds.add(item.id);
          if (item.url) {
            existingMediaUrls.add(item.url);
            existingMediaUrls.add(normalizeMediaUrlForAdmin(item.url));
          }
        }
        for (const item of conversationMediaItemMap?.get(conversation.id) ?? []) {
          if (existingMediaUrls.has(item.url) || existingMediaUrls.has(normalizeMediaUrlForAdmin(item.url))) continue;
          nextDetail.mediaItems.push(item);
          existingMediaUrls.add(item.url);
          existingMediaUrls.add(normalizeMediaUrlForAdmin(item.url));
        }

        nextDetail.mediaItems.sort((left, right) => right.createdAtTs - left.createdAtTs);

        return nextDetail;
      })
      .filter((item): item is AdminCreditConversationDetail => Boolean(item));
    const deletedConversationCreditDetails = Array.from(ledgerConversationDetails?.values() ?? [])
      .filter((detail) => !workspaceConversationIds.has(detail.id))
      .map((detail) => ({
        ...detail,
        title: detail.title || "已删除对话",
        isDeleted: true,
        deletedAtLabel: detail.updatedAtLabel,
        mediaItems: detail.mediaItems.map((media) => ({ ...media, errorText: "用户已删除" })),
      }));
    const assetGenerationDetailMap = new Map<string, AdminCreditCategoryDetail>(Array.from(userAssetGenerationCreditDetailMap.get(user.id)?.entries() ?? []).map(([id, detail]) => [id, { ...detail, items: [...detail.items] }]));
    const uploadedAssetUrls = new Set(Array.from(assetGenerationDetailMap.values()).flatMap((detail) => detail.items.map((item) => normalizeMediaUrlForAdmin(item.url)).filter(Boolean)));

    for (const asset of Array.from(new Set(Array.from(userWorkspaceAssetMediaMaps.get(user.id)?.values() ?? [])))) {
      if (!asset.isUploadedAsset) continue;
      if (uploadedAssetUrls.has(normalizeMediaUrlForAdmin(asset.url))) continue;
      const category = getAssetUploadCreditCategory(asset.assetType);
      if (!category) continue;
      const detail = assetGenerationDetailMap.get(category.id) ?? { id: category.id, title: category.title, totalCredits: 0, totalUsd: 0, totalCny: 0, items: [] };
      detail.items.push({
        id: `${asset.id}-upload-record`,
        requestId: `${asset.id}-upload-record`,
        kind: "image",
        systemName: asset.name || "",
        displayName: asset.name || "上传图片",
        url: asset.url,
        status: "success",
        errorText: asset.isDeleted ? "用户已删除" : undefined,
        deletedAtLabel: asset.deletedAtLabel,
        credits: 0,
        totalTokens: 0,
        usd: 0,
        cny: 0,
        count: 1,
        model: "-",
        parameters: "资产库上传",
        isUploadRecord: true,
        isReversePrompt: asset.isReversePrompt,
        promptText: asset.isReversePrompt ? asset.prompt : undefined,
        createdAtLabel: asset.createdAtTs ? formatShortDate(new Date(asset.createdAtTs)) : "-",
        createdAtTs: asset.createdAtTs ?? 0,
      });
      uploadedAssetUrls.add(normalizeMediaUrlForAdmin(asset.url));
      assetGenerationDetailMap.set(category.id, detail);
    }

    return {
      id: user.id,
      userEmail: user.email,
      nickname: user.nickname,
      currentCredits: user.credits,
      giftedCredits: userIncreaseMap.get(user.id) ?? 0,
      signupGiftedCredits: userSignupIncreaseMap.get(user.id) ?? 0,
      adminAdjustedGiftedCredits: userAdminAdjustIncreaseMap.get(user.id) ?? 0,
      consumedCredits: creditSummary.credits,
      consumedTokens: creditSummary.totalTokens,
      consumedUsd: creditSummary.usd,
      consumedCny: creditSummary.cny,
      conversationConsumedCredits: userConversationConsumeMap.get(user.id) ?? 0,
      assetGenerationConsumedCredits: userAssetGenerationConsumeMap.get(user.id) ?? 0,
      promptToolConsumedCredits: userPromptToolConsumeMap.get(user.id) ?? 0,
      conversationCreditDetails: [...conversationCreditDetails, ...deletedConversationCreditDetails],
      assetGenerationCreditDetails: Array.from(assetGenerationDetailMap.values())
        .sort((left, right) => ["character", "scene", "shot"].indexOf(left.id) - ["character", "scene", "shot"].indexOf(right.id))
        .map((detail) => ({ ...detail, items: [...detail.items].sort((left, right) => right.createdAtTs - left.createdAtTs) })),
      promptToolCreditDetails: Array.from(userPromptToolCreditDetailMap.get(user.id)?.values() ?? [])
        .sort((left, right) => ["reverse", "optimization"].indexOf(left.id) - ["reverse", "optimization"].indexOf(right.id))
        .map((detail) => ({ ...detail, items: [...detail.items].sort((left, right) => right.createdAtTs - left.createdAtTs) })),
      currentCreditDetails: userCreditBalanceDetailMap.get(user.id) ?? [],
      lastActiveLabel: lastActiveAt ? formatShortDate(lastActiveAt) : "-",
    };
  }).sort((left, right) => {
    const leftTime = userCreditLastActiveMap.get(left.id)?.getTime() ?? 0;
    const rightTime = userCreditLastActiveMap.get(right.id)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
  const adminUserRows: AdminUserRow[] = users.sort((left, right) => getUserLastActiveTime(right) - getUserLastActiveTime(left)).map((user) => {
    const workspaceSummary = getWorkspaceSummary(user.workspace?.state);
    const ledgerConversationDetailsForUser = userConversationCreditDetailMap.get(user.id);
    const workspaceConversationsForUser = getWorkspaceConversations(user.workspace?.state);
    const workspaceConversationIdsForUser = new Set(workspaceConversationsForUser.map((conversation) => conversation.id));
    const deletedConversations = Array.from(ledgerConversationDetailsForUser?.values() ?? [])
      .filter((detail) => !workspaceConversationIdsForUser.has(detail.id))
      .map((detail): AdminConversation => ({
        id: `${detail.id}-deleted`,
        title: detail.title || "已删除对话",
        isDeleted: true,
        deletedAtLabel: detail.updatedAtLabel,
        updatedAtLabel: detail.updatedAtLabel,
        updatedAtTs: detail.updatedAtTs ?? 0,
        messages: getDeletedConversationMessages(detail),
      }));
    const conversations = [...workspaceConversationsForUser, ...deletedConversations];
    const assetMediaMapForUser = userWorkspaceAssetMediaMaps.get(user.id);
    const conversationUploadedImageMediaItems = Array.from(userWorkspaceConversationUploadItemMaps.get(user.id)?.values() ?? []).flatMap((items) => items.filter((item) => item.kind === "image" && item.url).map((item): AdminMediaItem => {
      const asset = assetMediaMapForUser?.get(item.url) ?? assetMediaMapForUser?.get(normalizeMediaUrlForAdmin(item.url));
      return {
        id: item.id,
        type: "image",
        isUploadedAsset: true,
        isReversePrompt: asset?.isReversePrompt,
        isDeleted: item.status === "failed" || asset?.isDeleted,
        deletedAtLabel: item.deletedAtLabel ?? asset?.deletedAtLabel,
        name: item.displayName,
        url: item.url,
        prompt: asset?.isReversePrompt ? asset.prompt : "",
        model: "-",
        ratio: "-",
        resolution: "-",
        duration: "-",
        size: "-",
        style: "-",
        createdAtTs: item.createdAtTs,
      };
    }));
    const baseMediaItems = [...getWorkspaceMediaItems(user.workspace?.state), ...conversationUploadedImageMediaItems];
    const deletedConversationDetailsForUser = Array.from(ledgerConversationDetailsForUser?.values() ?? []).filter((detail) => !workspaceConversationIdsForUser.has(detail.id));
    const mediaItems = [...getDeletedConversationMediaItems(deletedConversationDetailsForUser, baseMediaItems), ...baseMediaItems];
    const assetMediaItems = getWorkspaceAssetMediaItems(user.workspace?.state);
    const creditSummary = userConsumeMap.get(user.id) ?? { credits: 0, totalTokens: 0, usd: 0, cny: 0 };

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      language: user.language,
      credits: user.credits,
      disabled: user.disabled,
      generatedImageCount: Math.max(user.generatedImageCount, workspaceSummary.generatedImageCount),
      generatedVideoCount: Math.max(user.generatedVideoCount, workspaceSummary.generatedVideoCount),
      conversationCount: workspaceSummary.conversationCount,
      consumedCredits: creditSummary.credits,
      consumedTokens: creditSummary.totalTokens,
      consumedAmountLabel: `$${creditSummary.usd.toFixed(4)} / ¥${creditSummary.cny.toFixed(2)}`,
      notifyOnGenerationComplete: user.notifyOnGenerationComplete,
      autoSaveHistory: user.autoSaveHistory,
      previewWheelZoom: user.previewWheelZoom,
      previewWheelFlip: user.previewWheelFlip,
      hasPassword: Boolean(user.passwordHash),
      createdAtLabel: formatDate(user.createdAt),
      updatedAtLabel: formatDate(user.updatedAt),
      lastLoginAtLabel: formatDate(getUserLatestLoginActivity(user)),
      workspaceSaved: Boolean(user.workspace),
      workspaceUpdatedAtLabel: formatDate(user.workspace?.updatedAt),
      sessionCount: user._count.sessions,
      lastSessionSeenAtLabel: formatDate(user.sessions[0]?.lastSeenAt),
      conversations,
      mediaItems,
      assetMediaItems,
    };
  });

  const days7 = recentDays(7);
  const days30 = recentDays(30);
  const todayStart = startOfLocalDay();
  const sevenDaysAgo = addDays(todayStart, -6).getTime();
  const thirtyDaysAgo = addDays(todayStart, -29).getTime();
  const activeTimeByUser = new Map(users.map((user) => [user.id, getUserLastActiveTime(user)]));
  const todayActiveUsers = users.filter((user) => getUserLastActiveTime(user) >= todayStart.getTime()).length;
  const wau = users.filter((user) => getUserLastActiveTime(user) >= sevenDaysAgo).length;
  const mau = users.filter((user) => getUserLastActiveTime(user) >= thirtyDaysAgo).length;
  const todayLedgers = creditLedgers.filter((ledger) => ledger.createdAt >= todayStart);
  const todayConsumedCredits = todayLedgers.filter((ledger) => ledger.direction === "consume").reduce((sum, ledger) => sum + ledger.credits, 0);
  const todayGenerationTasks = todayLedgers.filter((ledger) => ledger.kind === "image" || ledger.kind === "video").length;
  const totalWorkspaceSummary = users.reduce((summary, user) => {
    const item = getWorkspaceSummary(user.workspace?.state);
    summary.conversationCount += item.conversationCount;
    summary.generatedImageCount += item.generatedImageCount;
    summary.generatedVideoCount += item.generatedVideoCount;
    summary.savedAssetCount += item.savedAssetCount;
    return summary;
  }, { conversationCount: 0, generatedImageCount: 0, generatedVideoCount: 0, savedAssetCount: 0 });
  const dailyActivePoints = days30.map((day) => {
    const key = dayKey(day);
    const activeUsers = new Set<string>();
    for (const user of users) {
      if (dayKey(new Date(getUserLastActiveTime(user))) === key) activeUsers.add(user.id);
    }
    for (const ledger of creditLedgers) {
      if (dayKey(ledger.createdAt) === key) activeUsers.add(ledger.userId);
    }
    return { label: dayLabel(day), value: activeUsers.size, secondaryValue: users.filter((user) => dayKey(user.createdAt) === key).length };
  });
  const dailyGenerationPoints = days7.map((day) => {
    const key = dayKey(day);
    const ledgers = creditLedgers.filter((ledger) => dayKey(ledger.createdAt) === key);
    return {
      label: dayLabel(day),
      value: ledgers.reduce((sum, ledger) => sum + (ledger.kind === "image" ? Math.max(ledger.imageCount, 1) : ledger.kind === "video" ? Math.max(ledger.videoCount, 1) : 0), 0),
      secondaryValue: ledgers.filter((ledger) => ledger.kind === "text").length,
    };
  });
  const dailyCostPoints = days7.map((day) => {
    const key = dayKey(day);
    const ledgers = creditLedgers.filter((ledger) => ledger.direction === "consume" && dayKey(ledger.createdAt) === key);
    return { label: dayLabel(day), value: ledgers.reduce((sum, ledger) => sum + ledger.credits, 0), secondaryValue: Number(ledgers.reduce((sum, ledger) => sum + ledger.usd, 0).toFixed(4)) };
  });
  const modelUsage = Array.from(creditLedgers.reduce((map, ledger) => {
    if (!ledger.model || ledger.direction !== "consume") return map;
    const label = ledger.kind === "video" ? getModelLabel("video", ledger.model) : ledger.kind === "image" ? getModelLabel("image", ledger.model) : ledger.model;
    map.set(label, (map.get(label) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value: value.toLocaleString("en-US"), note: "调用次数" }));
  const providerUsage = Array.from(creditLedgers.reduce((map, ledger) => {
    if (ledger.direction !== "consume") return map;
    const label = getProviderLabel(ledger.model);
    map.set(label, (map.get(label) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value: value.toLocaleString("en-US") }));
  const failureTop = Array.from(creditLedgers.reduce((map, ledger) => {
    const reason = getMetadataString(ledger.metadata, "failureReason") || (getMetadataString(ledger.metadata, "status") === "failed" ? ledger.label || "任务失败" : "");
    if (!reason) return map;
    const safeReason = reason.slice(0, 60);
    map.set(safeReason, (map.get(safeReason) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value: value.toLocaleString("en-US") }));
  const retentionItems = [1, 3, 7].map((days) => {
    const cohortDay = addDays(todayStart, -days);
    const cohort = users.filter((user) => dayKey(user.createdAt) === dayKey(cohortDay));
    const retained = cohort.filter((user) => (activeTimeByUser.get(user.id) ?? 0) >= addDays(cohortDay, days).getTime()).length;
    const rate = cohort.length > 0 ? Math.round((retained / cohort.length) * 100) : 0;
    return { label: `${days}日留存`, value: `${rate}%`, note: `${retained}/${cohort.length}` };
  });
  const activeUserTop = users.slice().sort((left, right) => getUserLastActiveTime(right) - getUserLastActiveTime(left)).slice(0, 10).map((user) => ({ label: user.nickname || user.email, value: formatShortDate(new Date(getUserLastActiveTime(user))), note: user.id }));
  const creditConsumeTop = creditRows.slice().sort((left, right) => right.consumedCredits - left.consumedCredits).slice(0, 10).map((user) => ({ label: user.nickname || user.userEmail, value: user.consumedCredits.toLocaleString("en-US"), note: user.id }));
  const systemStatusItems = [
    { label: "OpenRouter API", value: systemSettings.openRouterApiKeyEnabled ? "已启用" : "已关闭" },
    { label: "BytePlus API", value: systemSettings.bytePlusApiKeyEnabled ? "已启用" : "已关闭" },
    { label: "BytePlus 解除限制", value: systemSettings.bytePlusUnlockLimits ? "已开启" : "已关闭" },
    { label: "图片扣费", value: creditSettings.chargeImage ? "已开启" : "已关闭" },
    { label: "视频扣费", value: creditSettings.chargeVideo ? "已开启" : "已关闭" },
    { label: "反推/优化扣费", value: creditSettings.chargePromptTool ? "已开启" : "已关闭" },
  ];

  return (
    <AdminShell adminEmail={currentAdminEmail} activeTab={activeTab}>
      {activeTab === "overview" ? (
        <>
          <PageHeader title="后台概览" />

          <section className="grid grid-cols-4 gap-4">
            <StatCard label="注册用户总数" value={totalUsers.toLocaleString("en-US")} note={`今日新增 ${todayUsers}`} />
            <StatCard label="今日活跃 DAU" value={todayActiveUsers.toLocaleString("en-US")} note={`WAU ${wau} / MAU ${mau}`} />
            <StatCard label="当前总积分余额" value={totalCredits.toLocaleString("en-US")} note={`今日消耗 ${todayConsumedCredits.toLocaleString("en-US")}`} />
            <StatCard label="今日生成任务" value={todayGenerationTasks.toLocaleString("en-US")} note={`图片 ${totalImages} / 视频 ${totalVideos}`} />
          </section>

          <section className="mt-4 grid grid-cols-4 gap-4">
            <StatCard label="历史对话总数" value={totalWorkspaceSummary.conversationCount.toLocaleString("en-US")} note="来自工作区记录" />
            <StatCard label="工作区图片总数" value={Math.max(totalImages, totalWorkspaceSummary.generatedImageCount).toLocaleString("en-US")} note="生成与工作区综合" />
            <StatCard label="工作区视频总数" value={Math.max(totalVideos, totalWorkspaceSummary.generatedVideoCount).toLocaleString("en-US")} note="生成与工作区综合" />
            <StatCard label="资产保存总数" value={totalWorkspaceSummary.savedAssetCount.toLocaleString("en-US")} note={`管理员 ${adminEmails.length} 个`} />
          </section>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <MiniLineChart title="近 30 日活跃 / 新增趋势" points={dailyActivePoints} secondaryLabel="新增用户" />
            <MiniLineChart title="近 7 日积分 / 美元消耗趋势" points={dailyCostPoints} secondaryLabel="美元" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <MiniBarChart title="近 7 日生成任务趋势" points={dailyGenerationPoints.map((point) => ({ label: point.label, value: point.value }))} />
            <OverviewPillGrid title="留存与系统状态" items={[...retentionItems, ...systemStatusItems]} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <OverviewTable title="模型使用占比 Top 8" items={modelUsage} />
            <OverviewTable title="供应商使用占比" items={providerUsage} />
            <OverviewTable title="失败原因 Top 10" items={failureTop} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <OverviewTable title="最近活跃用户 Top 10" items={activeUserTop} />
            <OverviewTable title="消耗积分用户 Top 10" items={creditConsumeTop} />
          </div>
        </>
      ) : null}

      {activeTab === "users" ? <AdminUsersPanel users={adminUserRows} stats={{ totalUsers, todayUsers, normalUsers, disabledUsers, totalCredits }} /> : null}

      {activeTab === "credits" ? (
        <AdminCreditsPanel settings={{ usdToCnyRate: creditSettings.usdToCnyRate, creditsPerCny: creditSettings.creditsPerCny, signupCredits: creditSettings.signupCredits, chargeText: creditSettings.chargeText, chargeImage: creditSettings.chargeImage, chargeVideo: creditSettings.chargeVideo, chargePromptTool: creditSettings.chargePromptTool }} stats={{ totalUserCredits: totalCredits, increasedCredits }} rows={creditRows} />
      ) : null}

      {activeTab === "records" ? (
        <AdminRecordsPanel users={adminUserRows} creditRows={creditRows} />
      ) : null}

      {activeTab === "settings" ? <AdminSystemSettingsPanel settings={systemSettings} adminEmailCount={adminEmails.length} /> : null}
    </AdminShell>
  );
}
