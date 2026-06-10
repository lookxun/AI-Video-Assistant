import { getCurrentUser, jsonError } from "@/lib/auth";
import { getCreditSettings } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CreditSource = "conversation" | "character_image_generation" | "scene_image_generation" | "shot_image_generation" | "image_prompt_reverse" | "prompt_optimization";
type CreditRowSource = CreditSource | "signup" | "admin_adjust" | "recharge" | "activity";

const generationSourceLabels: Record<Exclude<CreditSource, "conversation">, string> = {
  character_image_generation: "角色图片生成",
  scene_image_generation: "场景图片生成",
  shot_image_generation: "分镜图片生成",
  image_prompt_reverse: "图片反推提示词",
  prompt_optimization: "优化提示词",
};

const increaseSourceLabels: Record<Exclude<CreditRowSource, CreditSource>, string> = {
  signup: "注册送积分",
  admin_adjust: "后台调积分",
  recharge: "充值积分",
  activity: "活动赠送积分",
};

function getCreditSource(metadata: unknown): CreditSource {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "conversation";
  const source = (metadata as { creditSource?: unknown }).creditSource;
  if (source === "character_image_generation" || source === "scene_image_generation" || source === "shot_image_generation" || source === "image_prompt_reverse" || source === "prompt_optimization") return source;
  return "conversation";
}

function getWorkspaceSessionUsageMap(state: unknown) {
  const map = new Map<string, { totalTokens: number; credits: number; imageCount: number; videoCount: number }>();
  if (!state || typeof state !== "object" || Array.isArray(state)) return map;

  const sessions = (state as { sessions?: unknown }).sessions;
  if (!Array.isArray(sessions)) return map;

  for (const session of sessions) {
    if (!session || typeof session !== "object" || Array.isArray(session)) continue;
    const id = (session as { id?: unknown }).id;
    const usageSummary = (session as { usageSummary?: unknown }).usageSummary;
    if (typeof id !== "string" || !usageSummary || typeof usageSummary !== "object" || Array.isArray(usageSummary)) continue;

    const totalTokens = (usageSummary as { totalTokens?: unknown }).totalTokens;
    const credits = (usageSummary as { credits?: unknown }).credits;
    const safeTokens = typeof totalTokens === "number" && Number.isFinite(totalTokens) ? Math.max(0, Math.floor(totalTokens)) : 0;
    const safeCredits = typeof credits === "number" && Number.isFinite(credits) ? Math.max(0, Math.floor(credits)) : 0;
    const messages = (session as { messages?: unknown }).messages;
    const mediaCounts = getWorkspaceSessionMediaCounts(messages);
    if (safeTokens > 0 || safeCredits > 0 || mediaCounts.imageCount > 0 || mediaCounts.videoCount > 0) map.set(id, { totalTokens: safeTokens, credits: safeCredits, ...mediaCounts });
  }

  return map;
}

function getWorkspaceSessionMediaCounts(messages: unknown) {
  let imageCount = 0;
  let videoCount = 0;
  const imageUrls = new Set<string>();
  const videoUrls = new Set<string>();

  if (!Array.isArray(messages)) return { imageCount, videoCount };

  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) continue;
    const role = (message as { role?: unknown }).role;
    if (role !== "assistant") continue;

    const imageResultSlots = (message as { imageResultSlots?: unknown }).imageResultSlots;
    if (Array.isArray(imageResultSlots)) {
      for (const slot of imageResultSlots) {
        if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
        const type = (slot as { type?: unknown }).type;
        const url = (slot as { url?: unknown }).url;
        if (type === "image" && typeof url === "string" && url) imageUrls.add(url);
      }
    } else {
      const images = (message as { images?: unknown }).images;
      if (Array.isArray(images)) {
        for (const url of images) if (typeof url === "string" && url) imageUrls.add(url);
      }
    }

    const videos = (message as { videos?: unknown }).videos;
    if (Array.isArray(videos)) {
      for (const url of videos) if (typeof url === "string" && url) videoUrls.add(url);
    }

    const videoUrl = (message as { videoUrl?: unknown }).videoUrl;
    if (typeof videoUrl === "string" && videoUrl) videoUrls.add(videoUrl);
  }

  imageCount = imageUrls.size;
  videoCount = videoUrls.size;
  return { imageCount, videoCount };
}

function getWorkspaceAssetGenerationCounts(state: unknown) {
  const counts: Record<"character_image_generation" | "scene_image_generation" | "shot_image_generation", number> = {
    character_image_generation: 0,
    scene_image_generation: 0,
    shot_image_generation: 0,
  };

  if (!state || typeof state !== "object" || Array.isArray(state)) return counts;
  const assets = (state as { assets?: unknown }).assets;
  if (!Array.isArray(assets)) return counts;

  const urls = {
    character_image_generation: new Set<string>(),
    scene_image_generation: new Set<string>(),
    shot_image_generation: new Set<string>(),
  };

  for (const asset of assets) {
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) continue;
    const librarySource = (asset as { librarySource?: unknown }).librarySource;
    const type = (asset as { type?: unknown }).type;
    const url = (asset as { url?: unknown }).url;
    if (librarySource !== "asset_generation" || typeof url !== "string" || !url) continue;
    if (type === "character_image") urls.character_image_generation.add(url);
    if (type === "scene_image") urls.scene_image_generation.add(url);
    if (type === "shot_image") urls.shot_image_generation.add(url);
  }

  counts.character_image_generation = urls.character_image_generation.size;
  counts.scene_image_generation = urls.scene_image_generation.size;
  counts.shot_image_generation = urls.shot_image_generation.size;
  return counts;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const [settings, ledgers, increaseTotal, workspace] = await Promise.all([
    getCreditSettings(),
    prisma.creditLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.creditLedger.aggregate({
      where: { userId: user.id, direction: "increase" },
      _sum: { credits: true },
    }),
    prisma.userWorkspaceState.findUnique({
      where: { userId: user.id },
      select: { state: true },
    }),
  ]);

  const workspaceSessionUsageMap = getWorkspaceSessionUsageMap(workspace?.state);
  const workspaceAssetGenerationCounts = getWorkspaceAssetGenerationCounts(workspace?.state);

  const map = new Map<string, {
    conversationId: string;
    source: CreditRowSource;
    direction: "consume" | "increase";
    title: string;
    credits: number;
    totalTokens: number;
    imageCount: number;
    videoCount: number;
    lastActiveAt: string;
  }>();
  const increaseRows: Array<{
    conversationId: string;
    source: CreditRowSource;
    direction: "increase";
    title: string;
    credits: number;
    totalTokens: number;
    imageCount: number;
    videoCount: number;
    lastActiveAt: string;
  }> = [];

  for (const item of ledgers) {
    if (item.direction === "increase") {
      if (item.credits <= 0) continue;
      const source = item.kind === "signup" || item.kind === "admin_adjust" || item.kind === "recharge" || item.kind === "activity" ? item.kind : "admin_adjust";
      increaseRows.push({
        conversationId: item.id,
        source,
        direction: "increase",
        title: item.label || increaseSourceLabels[source],
        credits: item.credits,
        totalTokens: 0,
        imageCount: 0,
        videoCount: 0,
        lastActiveAt: item.createdAt.toISOString(),
      });
      continue;
    }

    const source = getCreditSource(item.metadata);
    const key = source === "conversation" ? item.conversationId || "unknown" : `source:${source}`;
    const current = map.get(key) ?? {
      conversationId: key,
      source,
      direction: "consume",
      title: source === "conversation" ? item.conversationTitle || "未命名对话" : generationSourceLabels[source],
      credits: 0,
      totalTokens: 0,
      imageCount: 0,
      videoCount: 0,
      lastActiveAt: item.createdAt.toISOString(),
    };

    current.credits += item.credits;
    current.totalTokens += item.totalTokens;
    current.imageCount += item.imageCount;
    current.videoCount += item.videoCount;
    if (item.createdAt > new Date(current.lastActiveAt)) current.lastActiveAt = item.createdAt.toISOString();
    map.set(key, current);
  }

  for (const item of map.values()) {
    if (item.source === "character_image_generation" || item.source === "scene_image_generation" || item.source === "shot_image_generation") {
      item.imageCount = workspaceAssetGenerationCounts[item.source];
      item.videoCount = 0;
      continue;
    }
    if (item.source !== "conversation") continue;
    const workspaceUsage = workspaceSessionUsageMap.get(item.conversationId);
    if (!workspaceUsage) continue;
    if (workspaceUsage.totalTokens > item.totalTokens) item.totalTokens = workspaceUsage.totalTokens;
    item.imageCount = workspaceUsage.imageCount;
    item.videoCount = workspaceUsage.videoCount;
  }

  return Response.json({
    credits: user.credits,
    giftedCredits: increaseTotal._sum.credits ?? 0,
    settings: {
      usdToCnyRate: settings.usdToCnyRate,
      creditsPerCny: settings.creditsPerCny,
    },
    conversations: [...Array.from(map.values()), ...increaseRows].sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()),
  });
}
