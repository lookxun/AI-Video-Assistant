import { prisma } from "@/lib/prisma";

export const supportedUserLanguages = ["简体中文", "繁体中文"] as const;
export type SupportedUserLanguage = (typeof supportedUserLanguages)[number];

export type UserProfilePayload = {
  nickname?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  language?: string | null;
  notifyOnGenerationComplete?: boolean | null;
  autoSaveHistory?: boolean | null;
  previewWheelZoom?: boolean | null;
  previewWheelFlip?: boolean | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeUserLanguage(value: unknown): SupportedUserLanguage {
  return supportedUserLanguages.includes(value as SupportedUserLanguage) ? value as SupportedUserLanguage : "简体中文";
}

export function getUserProfileFromUser(user: {
  id: string;
  email: string;
  passwordHash?: string | null;
  nickname?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  language?: string | null;
  notifyOnGenerationComplete?: boolean | null;
  autoSaveHistory?: boolean | null;
  previewWheelZoom?: boolean | null;
  previewWheelFlip?: boolean | null;
  credits?: number | null;
  generatedImageCount?: number | null;
  generatedVideoCount?: number | null;
}) {
  return {
    id: user.id,
    email: user.email,
    hasPassword: Boolean(user.passwordHash),
    nickname: user.nickname?.trim() || user.email,
    phone: user.phone?.trim() || "",
    avatarUrl: user.avatarUrl?.trim() || "",
    language: normalizeUserLanguage(user.language),
    notifyOnGenerationComplete: user.notifyOnGenerationComplete ?? true,
    autoSaveHistory: user.autoSaveHistory ?? true,
    previewWheelZoom: user.previewWheelZoom ?? true,
    previewWheelFlip: user.previewWheelFlip ?? true,
    credits: user.credits ?? 0,
    generatedImageCount: user.generatedImageCount ?? 0,
    generatedVideoCount: user.generatedVideoCount ?? 0,
  };
}

export function normalizeUserProfileInput(input: UserProfilePayload) {
  const nickname = Array.from(cleanText(input.nickname)).slice(0, 8).join("");
  const phone = cleanText(input.phone).slice(0, 40);
  const avatarUrl = cleanText(input.avatarUrl).slice(0, 1000);

  return {
    nickname: nickname || null,
    phone: phone || null,
    avatarUrl: avatarUrl || null,
    language: normalizeUserLanguage(input.language),
    notifyOnGenerationComplete: typeof input.notifyOnGenerationComplete === "boolean" ? input.notifyOnGenerationComplete : true,
    autoSaveHistory: typeof input.autoSaveHistory === "boolean" ? input.autoSaveHistory : true,
    previewWheelZoom: typeof input.previewWheelZoom === "boolean" ? input.previewWheelZoom : true,
    previewWheelFlip: typeof input.previewWheelFlip === "boolean" ? input.previewWheelFlip : true,
  };
}

export function extractLegacyUserProfileFromWorkspaceState(state: unknown): UserProfilePayload | null {
  if (!state || typeof state !== "object") return null;

  const source = state as Record<string, unknown>;
  const profile: UserProfilePayload = {};

  if (typeof source.userNickname === "string") profile.nickname = source.userNickname;
  if (typeof source.userPhone === "string") profile.phone = source.userPhone;
  if (typeof source.userAvatarUrl === "string") profile.avatarUrl = source.userAvatarUrl;
  if (typeof source.userLanguage === "string") profile.language = source.userLanguage;
  if (typeof source.notifyOnGenerationComplete === "boolean") profile.notifyOnGenerationComplete = source.notifyOnGenerationComplete;
  if (typeof source.autoSaveHistory === "boolean") profile.autoSaveHistory = source.autoSaveHistory;
  if (typeof source.previewWheelZoom === "boolean") profile.previewWheelZoom = source.previewWheelZoom;
  if (typeof source.previewWheelFlip === "boolean") profile.previewWheelFlip = source.previewWheelFlip;

  return Object.keys(profile).length > 0 ? profile : null;
}

export function stripUserProfileFromWorkspaceState(state: unknown) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;

  const nextState = { ...(state as Record<string, unknown>) };
  delete nextState.userNickname;
  delete nextState.userPhone;
  delete nextState.userAvatarUrl;
  delete nextState.userLanguage;
  delete nextState.notifyOnGenerationComplete;
  delete nextState.autoSaveHistory;
  delete nextState.previewWheelZoom;
  delete nextState.previewWheelFlip;
  return nextState;
}

export async function migrateLegacyUserProfileFromWorkspace(userId: string, state: unknown) {
  const legacyProfile = extractLegacyUserProfileFromWorkspaceState(state);
  if (!legacyProfile) return;

  const data = normalizeUserProfileInput(legacyProfile);
  await prisma.user.update({ where: { id: userId }, data });
}
