"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { RiArrowDownSLine, RiArrowRightSLine, RiCloseLine, RiQuillPenAiLine, RiSearchLine } from "react-icons/ri";
import { useBodyScrollLock } from "@/components/use-body-scroll-lock";
import { AdminHoverImagePreview } from "./admin-hover-image-preview";
import { fallbackAdminImageToOriginal, getAdminMediaSourceUrl, getAdminMediaThumbnailUrl, normalizeAdminMediaUrl } from "./admin-media-url";

function getLocalVideoPosterUrl(url: string) {
  const userVideoMatch = url.match(/^\/generated\/users\/([^/]+)\/videos\//);
  if (userVideoMatch) return url.replace(`/generated/users/${userVideoMatch[1]}/videos/`, `/generated/users/${userVideoMatch[1]}/video-posters/`).replace(/\.[^.]+$/, ".jpg");
  if (!url.startsWith("/generated/videos/")) return undefined;
  return url.replace("/generated/videos/", "/generated/video-posters/").replace(/\.[^.]+$/, ".jpg");
}

export type AdminConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAtLabel: string;
  images: string[];
  videos: string[];
  mediaNames?: Record<string, string>;
  error?: string;
};

export type AdminConversation = {
  id: string;
  title: string;
  isDeleted?: boolean;
  deletedAtLabel?: string;
  conversationCode?: string;
  updatedAtLabel: string;
  updatedAtTs?: number;
  messages: AdminConversationMessage[];
};

export type AdminMediaItem = {
  id: string;
  requestId?: string;
  type: "image" | "video";
  systemName?: string;
  assetType?: "character_image" | "scene_image" | "shot_image";
  isUploadedAsset?: boolean;
  isReversePrompt?: boolean;
  isDeleted?: boolean;
  deletedAtLabel?: string;
  name?: string;
  userName?: string;
  url: string;
  prompt: string;
  model: string;
  ratio: string;
  resolution: string;
  duration: string;
  size: string;
  style?: string;
  createdAtTs?: number;
};

export type AdminUserRow = {
  id: string;
  email: string;
  nickname: string | null;
  phone: string | null;
  avatarUrl: string | null;
  language: string;
  credits: number;
  disabled: boolean;
  generalModeEnabled: boolean;
  generatedImageCount: number;
  generatedVideoCount: number;
  conversationCount: number;
  consumedCredits: number;
  consumedTokens: number;
  consumedAmountLabel: string;
  notifyOnGenerationComplete: boolean;
  autoSaveHistory: boolean;
  previewWheelZoom: boolean;
  previewWheelFlip: boolean;
  hasPassword: boolean;
  createdAtLabel: string;
  updatedAtLabel: string;
  lastLoginAtLabel: string;
  lastLoginIp: string | null;
  lastLoginLocation: string | null;
  lastLoginUserAgent: string | null;
  workspaceSaved: boolean;
  workspaceUpdatedAtLabel: string;
  sessionCount: number;
  lastSessionSeenAtLabel: string;
  conversations: AdminConversation[];
  mediaItems: AdminMediaItem[];
  assetMediaItems: AdminMediaItem[];
};

type AdminUserStats = {
  totalUsers: number;
  todayUsers: number;
  normalUsers: number;
  disabledUsers: number;
  totalCredits: number;
};

const PAGE_SIZE = 15;

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

export function UserAvatar({ user }: { user: AdminUserRow }) {
  if (user.avatarUrl) {
    return (
      <div className="h-9 w-9 overflow-hidden rounded-full bg-[#f1f1f1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatarUrl} alt={user.nickname || user.email} className="h-full w-full object-cover" />
      </div>
    );
  }

  const initial = user.email.endsWith("@flashmuse.test") ? "?" : (user.nickname || user.email || "用").trim().slice(0, 1).toUpperCase();

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfe7f4] bg-[#edf4ff] text-[13px] font-semibold text-[#367cee]">
      {initial}
    </div>
  );
}

export function SmallStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "blue" | "red" }) {
  const toneClass = tone === "blue" ? "text-[#367cee]" : tone === "red" ? "text-[#e5484d]" : "text-[#111111]";

  return (
    <div className="rounded-[14px] border border-[#eeeeee] bg-white px-5 py-[10px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <div className="text-[13px] text-[#777777]">{label}</div>
      <div className={`mt-2 text-[22px] font-semibold tracking-[-0.03em] ${toneClass}`}>{value}</div>
    </div>
  );
}

export function DetailItem({ label, value, onClick }: { label: string; value: string; onClick?: () => void }) {
  const className = `flex min-h-9 items-center justify-between gap-4 bg-[#f2f2f2] px-3 py-2 ${onClick ? "w-full text-left transition hover:bg-[#e9eef8]" : ""}`;

  const content = (
    <>
      <div className={`shrink-0 text-[12px] text-[#888888] ${onClick ? "underline underline-offset-2" : ""}`}>{label}</div>
      <div className="min-w-0 text-right text-[13px] text-[#333333]">{value}</div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

export function AdminHistoryDialog({ user, onClose }: { user: AdminUserRow; onClose: () => void }) {
  useBodyScrollLock(true);

  const conversations = useMemo(() => [...user.conversations].sort((left, right) => (right.updatedAtTs ?? 0) - (left.updatedAtTs ?? 0)), [user.conversations]);
  const [activeConversationId, setActiveConversationId] = useState(() => conversations[0]?.id ?? "");
  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? conversations[0];
  const displayName = user.nickname || user.email;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/42 px-8 py-8 backdrop-blur-[4px]">
      <div className="flex h-[min(820px,calc(100vh-64px))] w-[min(1180px,calc(100vw-64px))] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <header className="relative flex h-[60px] shrink-0 items-center border-b border-[#eeeeee] px-6 pr-14">
          <div className="truncate text-[14px] font-semibold text-[#111111]">{displayName}历史对话</div>
          <button type="button" onClick={onClose} className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[9px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label="关闭历史对话">
            <RiCloseLine className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[270px] shrink-0 flex-col border-r border-[#eeeeee] bg-[#f8f8f8] pl-4 pt-4">
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pb-4 pr-2">
              {conversations.length > 0 ? conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={`w-full rounded-[10px] px-3 text-left transition ${activeConversation?.id === conversation.id ? "bg-[#ececec] py-2 text-[#111111]" : "py-1.5 text-[#666666] hover:bg-[#eeeeee] hover:text-[#111111]"}`}
                >
                  <div className="truncate text-[13px] font-medium">
                    <span>{conversation.title || "新对话"}</span>
                    {conversation.isDeleted ? <span className="ml-1 text-red-500">用户已删除</span> : null}
                  </div>
                  {activeConversation?.id === conversation.id ? <div className="mt-1 truncate text-[11px] text-[#999999]">{conversation.updatedAtLabel}</div> : null}
                </button>
              )) : <div className="pt-8 text-center text-[13px] text-[#999999]">暂无历史对话</div>}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-6">
              {activeConversation ? (
                <div className="mx-auto max-w-[860px] space-y-5">
                  {activeConversation.isDeleted ? <div className="text-center text-[12px] leading-5 text-red-500">用户已删除{activeConversation.deletedAtLabel ? ` ${activeConversation.deletedAtLabel}` : ""}</div> : null}
                  {activeConversation.messages.length > 0 ? activeConversation.messages.map((message) => <AdminHistoryMessage key={message.id} message={message} />) : <div className="pt-20 text-center text-[13px] text-[#999999]">该对话暂无消息</div>}
                </div>
              ) : <div className="pt-20 text-center text-[13px] text-[#999999]">暂无历史对话</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function AdminMediaDialog({ user, mediaType, onClose }: { user: AdminUserRow; mediaType: "image" | "upload_image" | "video" | "asset_image"; onClose: () => void }) {
  useBodyScrollLock(true);

  const [assetFilter, setAssetFilter] = useState<"character_image" | "scene_image" | "shot_image">("character_image");
  const isAssetImage = mediaType === "asset_image";
  const mediaItems = isAssetImage
    ? user.assetMediaItems.filter((item) => item.assetType === assetFilter)
    : mediaType === "upload_image"
      ? user.mediaItems.filter((item) => item.type === "image" && item.isUploadedAsset)
      : user.mediaItems.filter((item) => item.type === mediaType && !item.isUploadedAsset);
  const [activeMediaId, setActiveMediaId] = useState(() => mediaItems[0]?.id ?? "");
  const activeMedia = mediaItems.find((item) => item.id === activeMediaId) ?? mediaItems[0];
  const title = `${user.nickname || user.email}${isAssetImage ? "资产库图片" : mediaType === "upload_image" ? "对话流上传图片" : mediaType === "image" ? "对话流图片" : "对话流视频"}`;
  const activeMediaName = activeMedia?.name || activeMedia?.systemName || (activeMedia?.type === "video" ? "视频" : "图片");
  const assetFilterItems: Array<{ key: "character_image" | "scene_image" | "shot_image"; label: string }> = [
    { key: "character_image", label: "角色" },
    { key: "scene_image", label: "场景" },
    { key: "shot_image", label: "分镜" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/42 px-8 py-8 backdrop-blur-[4px]">
      <div className="flex h-[min(820px,calc(100vh-64px))] w-[min(1180px,calc(100vw-64px))] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <header className="relative flex h-[60px] shrink-0 items-center border-b border-[#eeeeee] px-6 pr-14">
          <div className="truncate text-[14px] font-semibold text-[#111111]">{title}</div>
          <button type="button" onClick={onClose} className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[9px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label="关闭媒体预览">
            <RiCloseLine className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto bg-white p-6">
              {activeMedia ? (
                <div className="flex min-h-full flex-col">
                  <div className="relative flex min-h-[480px] flex-1 items-center justify-center bg-[#f5f5f5]">
                    {activeMedia.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getAdminMediaSourceUrl(activeMedia.url)} alt="生成图片" className="max-h-[560px] max-w-full object-contain" />
                    ) : (
                      <video src={getAdminMediaSourceUrl(activeMedia.url)} controls className="max-h-[560px] max-w-full bg-black" />
                    )}
                  </div>

                  <div className="mt-4 max-w-[1006px] pb-2">
                    {activeMedia.isUploadedAsset ? (
                      <div className="flex flex-wrap items-center gap-2 text-[12px] leading-5 text-[#9a9a9a]">
                        <span className="mr-2 truncate font-medium text-[#111111]">{activeMediaName}</span>
                        <span>{isAssetImage ? "资产库上传" : "对话流上传"}</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-[12px] leading-5 text-[#9a9a9a]">
                        <span className="mr-2 truncate font-medium text-[#111111]">{activeMediaName}</span>
                        <span className="truncate">{activeMedia.model}</span>
                        <span className="text-[#d0d0d0]">|</span>
                        <span>{activeMedia.ratio}</span>
                        <span className="text-[#d0d0d0]">|</span>
                        <span className="inline-flex items-center gap-1.5">
                          <span>{activeMedia.size}</span>
                          <AdminCompactResolutionIcon option={activeMedia.resolution} mode={activeMedia.type} />
                        </span>
                        {activeMedia.type === "video" && activeMedia.duration && activeMedia.duration !== "-" ? (
                          <>
                            <span className="text-[#d0d0d0]">|</span>
                            <span>{activeMedia.duration}</span>
                          </>
                        ) : null}
                        {isAssetImage && activeMedia.style && activeMedia.style !== "-" ? (
                          <>
                            <span className="text-[#d0d0d0]">|</span>
                            <span>{activeMedia.style}</span>
                          </>
                        ) : null}
                      </div>
                    )}
                    {activeMedia.isDeleted ? (
                      <div className="mt-2 text-[12px] leading-5 text-red-500">用户已删除{activeMedia.deletedAtLabel ? ` ${activeMedia.deletedAtLabel}` : ""}</div>
                    ) : null}
                    <div className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-7 text-[#111111]">
                      {activeMedia.isReversePrompt ? (
                        <span className="mr-2 inline-flex h-6 align-[1px] items-center gap-1.5 rounded-[6px] border border-[#367cee] px-2 text-[12px] font-medium leading-none text-[#367cee]">
                          <RiQuillPenAiLine className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>反推提示词</span>
                        </span>
                      ) : null}
                      {activeMedia.prompt || "暂无提示词"}
                    </div>
                  </div>
                </div>
              ) : <div className="pt-20 text-center text-[13px] text-[#999999]">暂无{mediaType === "video" ? "视频" : "图片"}</div>}
            </div>
          </section>

          <aside className="flex w-[270px] shrink-0 flex-col border-l border-[#eeeeee] bg-[#f8f8f8] pl-4 pt-4">
            {isAssetImage ? (
              <div className="mb-4 shrink-0 pr-4">
                <div className="grid grid-cols-3 gap-1 rounded-[9px] bg-[#eeeeee] p-1">
                  {assetFilterItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setAssetFilter(item.key);
                        setActiveMediaId("");
                      }}
                      className={`h-8 rounded-[7px] text-[12px] transition ${assetFilter === item.key ? "bg-white text-[#111111] shadow-[0_2px_8px_rgba(0,0,0,0.08)]" : "text-[#777777] hover:text-[#111111]"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : <div className="mb-4 shrink-0 truncate pr-4 text-[13px] font-semibold text-[#111111]">{mediaType === "upload_image" ? "上传图片" : mediaType === "video" ? "生成视频" : "生成图片"}列表</div>}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-4 pr-2">
              {mediaItems.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMediaId(item.id)}
                  className={`block w-full overflow-hidden rounded-[8px] border-2 bg-white transition ${activeMedia?.id === item.id ? "border-[#367cee]" : "border-transparent hover:border-[#d6d6d6]"}`}
                >
                  <div className="relative flex h-[118px] items-center justify-center bg-[#eeeeee]">
                    {item.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                        <img src={getAdminMediaThumbnailUrl(item.url)} onError={(event) => fallbackAdminImageToOriginal(event.currentTarget, item.url)} alt="图片缩略图" className="h-full w-full object-contain" />
                    ) : (
                      getLocalVideoPosterUrl(item.url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getAdminMediaThumbnailUrl(getLocalVideoPosterUrl(item.url) ?? item.url)} onError={(event) => fallbackAdminImageToOriginal(event.currentTarget, item.url)} alt="视频封面" className="h-full w-full object-cover" />
                      ) : <video src={getAdminMediaSourceUrl(item.url)} className="h-full w-full object-cover" muted />
                    )}
                    {item.isDeleted ? <div className="absolute inset-x-0 bottom-0 bg-red-500/88 py-1 text-center text-[12px] font-medium text-white">用户已删除</div> : null}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-8 text-left text-[11px] font-medium text-white">
                      <span className="block truncate">{item.name || `${mediaType === "video" ? "视频" : "图片"}${index + 1}`}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function AdminCompactResolutionIcon({ option, mode }: { option?: string; mode: "image" | "video" }) {
  if (mode === "video") {
    return (
      <span className="inline-flex h-4 min-w-6 items-center justify-center rounded-[3px] bg-[#111111] px-1 text-[9px] font-bold leading-none text-white">
        {option === "480p" ? "SD" : option === "1080p" ? "FHD" : option === "4K" ? "4K" : "HD"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex h-4 min-w-5 items-center justify-center rounded-[3px] border border-[#d5d5d5] px-1 text-[9px] font-bold leading-none text-[#777777]">{option && option !== "-" ? option : "1K"}</span>
      {option === "4K" ? <span className="text-[12px] font-semibold leading-none text-[#b8860b]">超清4K</span> : null}
    </span>
  );
}

function AdminHistoryMessage({ message }: { message: AdminConversationMessage }) {
  if (message.role === "system") {
    return <div className={`mx-auto max-w-[680px] border-t border-[#eeeeee] pt-3 text-center text-[12px] ${message.error ? "text-red-500" : "text-[#888888]"}`}>{message.error || message.content}</div>;
  }

  const isUser = message.role === "user";
  const videos = message.videos;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={isUser ? "max-w-[78%]" : "max-w-full"}>
        {message.content ? (
          <div className={isUser ? "rounded-[14px] bg-[#f3f3f3] px-4 py-3 text-[14px] leading-7 text-[#222222]" : "text-[14px] leading-7 text-[#222222]"}>
            {isUser ? message.content.split("\n").map((line, index) => <p key={`${message.id}-${index}`} className={index > 0 ? "mt-2" : undefined}>{line}</p>) : <AdminFormattedMessage content={message.content} />}
          </div>
        ) : null}

        {message.images.length > 0 ? (
          <div className="mt-3 grid max-w-[520px] grid-cols-2 gap-1">
            {message.images.map((url, index) => (
              <AdminHoverImagePreview key={`${url}-${index}`} src={url} alt="历史图片" wrapperClassName="relative block overflow-hidden rounded-[10px] bg-[#f2f2f2]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAdminMediaThumbnailUrl(url)} onError={(event) => fallbackAdminImageToOriginal(event.currentTarget, url)} alt="历史图片" className="h-full max-h-[260px] w-full object-contain" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-8 text-left text-[11px] font-medium text-white">
                  <span className="block truncate">{message.mediaNames?.[url] || `图片${index + 1}`}</span>
                </div>
              </AdminHoverImagePreview>
            ))}
          </div>
        ) : null}

        {videos.length > 0 ? (
          <div className="mt-3 space-y-2">
            {videos.map((url, index) => (
              <div key={`${url}-${index}`} className="relative w-[520px] max-w-full overflow-hidden rounded-[10px] bg-[#f2f2f2]">
                <video src={getAdminMediaSourceUrl(url)} controls className="w-full bg-[#f2f2f2]" />
                <div className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-16px)] rounded bg-black/62 px-2 py-1 text-[11px] font-medium text-white">{message.mediaNames?.[url] || `视频${index + 1}`}</div>
              </div>
            ))}
          </div>
        ) : null}

        {message.createdAtLabel !== "-" ? <div className={`mt-1 text-[11px] text-[#aaaaaa] ${isUser ? "text-right" : "text-left"}`}>{message.createdAtLabel}</div> : null}
      </div>
    </div>
  );
}

function AdminFormattedMessage({ content }: { content: string }) {
  const lines = content.replace(/\\r\\n|\\n|\\r/g, "\n").replace(/\\t/g, " ").split("\n");

  return (
    <div className="space-y-3">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <div key={index} className="h-1" />;
        if (/^-{3,}$/.test(line)) return <div key={index} className="my-3 border-t border-[#eeeeee]" />;

        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        if (heading) {
          const level = Math.min(heading[1].length, 3);
          const className = level === 1 ? "text-[17px] font-semibold text-[#111111]" : level === 2 ? "text-[15px] font-semibold text-[#111111]" : "text-[14px] font-semibold text-[#111111]";
          return <div key={index} className={className}>{renderInlineMarkdown(heading[2])}</div>;
        }

        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          return <div key={index} className="flex gap-2"><span className="mt-[10px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#555555]" /><div>{renderInlineMarkdown(bullet[1])}</div></div>;
        }

        const ordered = line.match(/^\d+[.)]\s+(.+)$/);
        if (ordered) {
          return <div key={index} className="flex gap-2"><span className="text-[#777777]">{line.match(/^\d+/)?.[0]}.</span><div>{renderInlineMarkdown(ordered[1])}</div></div>;
        }

        return <p key={index}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-[#111111]">{part.slice(2, -2).trim()}</strong>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function yesNo(value: boolean) {
  return value ? "开启" : "关闭";
}

function getLoginPlace(user: AdminUserRow) {
  if (user.lastLoginIp || user.lastLoginLocation) {
    return { ip: user.lastLoginIp || "未知", place: formatLoginLocation(user.lastLoginLocation || "未知") };
  }

  if (!user.email.endsWith("@flashmuse.test")) {
    return { ip: "未记录", place: "未记录" };
  }

  const match = user.email.match(/testuser(\d+)@flashmuse\.test$/);
  const index = match ? Number(match[1]) : 1;
  const places = ["北京 / 北京", "上海 / 上海", "广东 / 深圳", "广东 / 广州", "浙江 / 杭州", "江苏 / 南京", "四川 / 成都", "湖北 / 武汉", "陕西 / 西安", "福建 / 厦门"];

  return {
    ip: `10.${(index * 17) % 255}.${(index * 31) % 255}.${((index * 47) % 253) + 1}`,
    place: places[(index - 1) % places.length],
  };
}

function formatLoginLocation(location: string) {
  const parts = location.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return location || "未知";
  if (parts[0] === "中国") return Array.from(new Set(parts.slice(1))).join(" ") || "中国";
  return Array.from(new Set(parts)).join(" ");
}

export function AdminUsersPanel({ users, stats }: { users: AdminUserRow[]; stats: AdminUserStats }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "normal" | "disabled">("all");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(() => new Set());
  const [historyUser, setHistoryUser] = useState<AdminUserRow | null>(null);
  const [mediaDialog, setMediaDialog] = useState<{ user: AdminUserRow; mediaType: "image" | "upload_image" | "video" | "asset_image" } | null>(null);

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return users.filter((user) => {
      if (status === "normal" && user.disabled) return false;
      if (status === "disabled" && !user.disabled) return false;
      if (!keyword) return true;

      return [user.id, user.email, user.nickname, user.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [query, status, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filteredUsers.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredUsers.length);

  const statusItems: Array<{ key: "all" | "normal" | "disabled"; label: string }> = [
    { key: "all", label: "全部" },
    { key: "normal", label: "正常" },
    { key: "disabled", label: "禁用" },
  ];

  function toggleExpandedUser(userId: string) {
    setExpandedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  function toggleUserDisabled(user: AdminUserRow) {
    startTransition(async () => {
      const response = await fetch("/admin/api/users/disabled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, disabled: !user.disabled }),
      });
      if (!response.ok) return;
      window.location.reload();
    });
  }

  function toggleUserGeneralMode(user: AdminUserRow) {
    startTransition(async () => {
      const response = await fetch("/admin/api/users/general-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, generalModeEnabled: !user.generalModeEnabled }),
      });
      if (!response.ok) return;
      window.location.reload();
    });
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">用户管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-[240px] items-center rounded-[9px] border border-[#e9e9e9] bg-white px-3">
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="ID / 邮箱 / 昵称 / 手机"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#222222] outline-none placeholder:text-[#b0b0b0]"
            />
            <RiSearchLine className="ml-2 h-4 w-4 shrink-0 text-[#999999]" />
          </div>
          <div className="flex h-9 rounded-[9px] bg-[#eeeeee] p-1">
            {statusItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setStatus(item.key);
                  setPage(1);
                }}
                className={`min-w-[62px] rounded-[7px] px-2.5 transition ${status === item.key ? "bg-white text-[#111111] shadow-[0_2px_8px_rgba(0,0,0,0.08)]" : "text-[#777777] hover:text-[#111111]"}`}
              >
                <span style={{ fontSize: 12 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <SmallStat label="总用户" value={formatNumber(stats.totalUsers)} tone="blue" />
        <SmallStat label="今日新增" value={formatNumber(stats.todayUsers)} />
        <SmallStat label="正常用户" value={formatNumber(stats.normalUsers)} />
        <SmallStat label="禁用用户" value={formatNumber(stats.disabledUsers)} tone={stats.disabledUsers > 0 ? "red" : "default"} />
        <SmallStat label="总积分余额" value={formatNumber(stats.totalCredits)} />
      </div>

      <div className="mt-3 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div>
          <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-[13px]">
            <thead className="bg-[#fafafa] text-[#777777]">
              <tr>
                {[
                  "",
                  "用户ID",
                  "用户",
                  "积分",
                  "最近登录 IP / 归属地",
                  "最后登录时间",
                  "通用模式",
                  "状态",
                ].map((item, index) => (
                  <th key={`${item}-${index}`} className={`border-b border-[#eeeeee] py-3 font-medium ${index === 0 ? "w-[44px] pl-6 pr-0" : index === 1 ? "w-[135px] pl-2 pr-4" : index === 2 ? "w-[290px] px-4" : index === 3 ? "w-[120px] px-4" : "px-4"}`}>
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                pagedUsers.map((user) => {
                  const isExpanded = expandedUserIds.has(user.id);
                  const loginPlace = getLoginPlace(user);

                  return (
                    <Fragment key={user.id}>
                      <tr className="cursor-pointer text-[#333333] transition hover:bg-[#fcfcfc]" onClick={() => toggleExpandedUser(user.id)}>
                        <td className="border-b border-[#f2f2f2] py-3 pl-6 pr-0 text-left">
                          <button type="button" onClick={(event) => { event.stopPropagation(); toggleExpandedUser(user.id); }} className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label={isExpanded ? "收起用户详情" : "展开用户详情"}>
                            {isExpanded ? <RiArrowDownSLine className="h-5 w-5" /> : <RiArrowRightSLine className="h-5 w-5" />}
                          </button>
                        </td>
                        <td className="border-b border-[#f2f2f2] py-3 pl-2 pr-4 font-mono text-[12px] text-[#777777]">{user.id}</td>
                        <td className="border-b border-[#f2f2f2] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar user={user} />
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-medium text-[#222222]">{user.email}</div>
                              <div className="mt-0.5 truncate text-[12px] text-[#888888]">{user.nickname || "未设置昵称"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-[#f2f2f2] px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatNumber(user.credits)}</span>
                          </div>
                        </td>
                        <td className="border-b border-[#f2f2f2] px-4 py-3 text-[#777777]">
                          <div className="leading-5">{loginPlace.ip}</div>
                          <div className="mt-0.5 leading-5 text-[#999999]">{loginPlace.place}</div>
                        </td>
                        <td className="border-b border-[#f2f2f2] px-4 py-3 text-[#777777]">{user.lastLoginAtLabel}</td>
                        <td className="border-b border-[#f2f2f2] px-4 py-3">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={(event) => { event.stopPropagation(); toggleUserGeneralMode(user); }}
                            className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${user.generalModeEnabled ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}
                            aria-label="通用模式开关"
                          >
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${user.generalModeEnabled ? "left-[18px]" : "left-0.5"}`} />
                          </button>
                        </td>
                        <td className="border-b border-[#f2f2f2] px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2.5 py-1 text-[12px] ${user.disabled ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>{user.disabled ? "禁用" : "正常"}</span>
                            <button type="button" disabled={isPending} onClick={(event) => { event.stopPropagation(); toggleUserDisabled(user); }} className="h-7 rounded-[7px] border border-[#e7e7e7] bg-white px-2.5 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:opacity-50">
                              <span style={{ fontSize: 12 }}>{user.disabled ? "启用" : "禁用"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="bg-[#fbfbfb]">
                          <td colSpan={8} className="border-b border-[#f2f2f2] px-4 py-4">
                            <div className="grid grid-cols-4 gap-[5px] px-1 py-1 text-left">
                              <div className="space-y-px">
                                <DetailItem label="登录帐号" value={user.email} />
                                <DetailItem label="昵称" value={user.nickname || "未设置"} />
                                <DetailItem label="手机号" value={user.phone || "未绑定"} />
                                <DetailItem label="密码" value={user.hasPassword ? "已设置" : "未设置"} />
                                <DetailItem label="语言" value={user.language} />
                                <DetailItem label="注册时间" value={user.createdAtLabel} />
                                <DetailItem label="资料更新时间" value={user.updatedAtLabel} />
                              </div>
                              <div className="space-y-px">
                                <DetailItem label="最近登录 IP" value={loginPlace.ip} />
                                <DetailItem label="最近登录归属地" value={loginPlace.place} />
                                <DetailItem label="登录设备" value={user.lastLoginUserAgent || "未记录"} />
                                <DetailItem label="Session 数" value={formatNumber(user.sessionCount)} />
                                <DetailItem label="Session 活跃" value={user.lastSessionSeenAtLabel} />
                                <DetailItem label="生成完成提醒" value={yesNo(user.notifyOnGenerationComplete)} />
                                <DetailItem label="自动收入资产库" value={yesNo(user.autoSaveHistory)} />
                                <DetailItem label="通用模式" value={user.generalModeEnabled ? "已开启" : "未开启"} />
                                <DetailItem label="预览滚轮" value={`缩放${yesNo(user.previewWheelZoom)} / 翻页${yesNo(user.previewWheelFlip)}`} />
                              </div>
                              <div className="space-y-px">
                                <DetailItem label="历史对话" value={formatNumber(user.conversationCount)} onClick={() => setHistoryUser(user)} />
                                <DetailItem label="对话流图片" value={formatNumber(user.mediaItems.filter((item) => item.type === "image").length)} onClick={() => setMediaDialog({ user, mediaType: "image" })} />
                                <DetailItem label="对话流视频" value={formatNumber(user.generatedVideoCount)} onClick={() => setMediaDialog({ user, mediaType: "video" })} />
                                <DetailItem label="资产库图片" value={formatNumber(user.assetMediaItems.length)} onClick={() => setMediaDialog({ user, mediaType: "asset_image" })} />
                                <DetailItem label="工作区保存" value={user.workspaceSaved ? user.workspaceUpdatedAtLabel : "未保存"} />
                              </div>
                              <div className="space-y-px">
                                <DetailItem label="积分" value={formatNumber(user.credits)} />
                                <DetailItem label="已消耗积分" value={formatNumber(user.consumedCredits)} />
                                <DetailItem label="已消耗Token" value={formatNumber(user.consumedTokens)} />
                                <DetailItem label="已消耗金额" value={user.consumedAmountLabel} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[13px] text-[#999999]">
                    当前没有匹配用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex min-w-[1180px] items-center justify-between px-1 py-1 text-[13px] text-[#777777]">
        <div>
          共 {formatNumber(filteredUsers.length)} 条，当前显示 {rangeStart}-{rangeEnd} 条
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]">
            <span style={{ fontSize: 13 }}>上一页</span>
          </button>
          <div className="min-w-[72px] text-center text-[#333333]">
            {currentPage} / {totalPages}
          </div>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]">
            <span style={{ fontSize: 13 }}>下一页</span>
          </button>
        </div>
      </div>

      {historyUser ? <AdminHistoryDialog user={historyUser} onClose={() => setHistoryUser(null)} /> : null}
      {mediaDialog ? <AdminMediaDialog user={mediaDialog.user} mediaType={mediaDialog.mediaType} onClose={() => setMediaDialog(null)} /> : null}
    </>
  );
}
