"use client";

import { Fragment, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { RiArrowDownSLine, RiArrowRightSLine, RiCloseLine, RiInformation2Line, RiQuillPenAiLine, RiSearchLine } from "react-icons/ri";
import { useBodyScrollLock } from "@/components/use-body-scroll-lock";
import { AdminHoverImagePreview } from "./admin-hover-image-preview";
import { fallbackAdminImageToOriginal, getAdminMediaSourceUrl, getAdminMediaThumbnailUrl } from "./admin-media-url";

function getLocalVideoPosterUrl(url: string) {
  const userVideoMatch = url.match(/^\/generated\/users\/([^/]+)\/videos\//);
  if (userVideoMatch) return url.replace(`/generated/users/${userVideoMatch[1]}/videos/`, `/generated/users/${userVideoMatch[1]}/video-posters/`).replace(/\.[^.]+$/, ".jpg");
  if (!url.startsWith("/generated/videos/")) return undefined;
  return url.replace("/generated/videos/", "/generated/video-posters/").replace(/\.[^.]+$/, ".jpg");
}

const PAGE_SIZE = 15;
const MIN_USD_TO_CNY_RATE = 1;
const MAX_USD_TO_CNY_RATE = 20;
const VALID_CREDITS_PER_CNY = [10, 100, 1000, 10000];

export type AdminCreditSettings = {
  usdToCnyRate: number;
  creditsPerCny: number;
  signupCredits: number;
  chargeText: boolean;
  chargeImage: boolean;
  chargeVideo: boolean;
  chargePromptTool: boolean;
};

export type AdminCreditUser = {
  id: string;
  userEmail: string;
  nickname: string | null;
  avatarUrl?: string | null;
  currentCredits: number;
  giftedCredits: number;
  signupGiftedCredits: number;
  adminAdjustedGiftedCredits: number;
  consumedCredits: number;
  consumedTokens: number;
  consumedUsd: number;
  consumedCny: number;
  conversationConsumedCredits: number;
  assetGenerationConsumedCredits: number;
  promptToolConsumedCredits: number;
  conversationCreditDetails: AdminCreditConversationDetail[];
  assetGenerationCreditDetails: AdminCreditCategoryDetail[];
  promptToolCreditDetails: AdminCreditCategoryDetail[];
  currentCreditDetails: AdminCreditBalanceItem[];
  lastActiveLabel: string;
};

export type AdminCreditBalanceItem = {
  id: string;
  reason: string;
  delta: number;
  balanceAfter: number;
  createdAtLabel: string;
  createdAtTs: number;
};

export type AdminCreditFlowItem = {
  id: string;
  requestId: string;
  kind: "image" | "video" | "file";
  systemName: string;
  displayName: string;
  mediaName?: string;
  url: string;
  status?: "success" | "failed";
  credits: number;
  expectedCredits?: number;
  totalTokens: number;
  usd: number;
  cny: number;
  count: number;
  model: string;
  parameters: string;
  errorText?: string;
  deletedAtLabel?: string;
  isUploadRecord?: boolean;
  isChargeDisabled?: boolean;
  isCreditMissing?: boolean;
  isCostUnavailable?: boolean;
  isReversePrompt?: boolean;
  promptText?: string;
  createdAtLabel: string;
  createdAtTs: number;
};

export type AdminCreditConversationDetail = {
  id: string;
  title: string;
  isDeleted?: boolean;
  deletedAtLabel?: string;
  conversationCode?: string;
  updatedAtLabel: string;
  updatedAtTs?: number;
  chatCredits: number;
  chatExpectedCredits?: number;
  chatUsd?: number;
  chatCny?: number;
  planCredits: number;
  planExpectedCredits?: number;
  planUsd?: number;
  planCny?: number;
  chatChargeDisabled?: boolean;
  planChargeDisabled?: boolean;
  mediaItems: AdminCreditFlowItem[];
};

export type AdminCreditCategoryDetail = {
  id: string;
  title: string;
  totalCredits: number;
  totalUsd: number;
  totalCny: number;
  items: AdminCreditFlowItem[];
};

export type AdminCreditStats = {
  totalUserCredits: number;
  increasedCredits: number;
};

type AdjustPopover = {
  user: AdminCreditUser;
  top: number;
  left: number;
};

function getCategorySummaryText(category: AdminCreditCategoryDetail, categories: AdminCreditCategoryDetail[] = [category]) {
  const conversationUploadImages = categories.find((item) => item.id === "conversation-upload-images");
  const conversationUploadFiles = categories.find((item) => item.id === "conversation-upload-files");
  const assetUploadImages = categories.find((item) => item.id === "asset-upload-images");
  if (conversationUploadImages || conversationUploadFiles || assetUploadImages) {
    return `对话流上传图片：${conversationUploadImages?.items.length ?? 0}　对话流上传文件：${conversationUploadFiles?.items.length ?? 0}　资产库上传图片：${assetUploadImages?.items.length ?? 0}`;
  }

  const conversationGeneratedImages = categories.find((item) => item.id === "conversation-generated-images");
  const conversationGeneratedVideos = categories.find((item) => item.id === "conversation-generated-videos");
  const assetGeneratedImages = categories.find((item) => item.id === "asset-generated-images");
  if (conversationGeneratedImages || conversationGeneratedVideos || assetGeneratedImages) {
    return `对话流图片：${conversationGeneratedImages?.items.length ?? 0}　对话流视频：${conversationGeneratedVideos?.items.length ?? 0}　资产库图片：${assetGeneratedImages?.items.length ?? 0}`;
  }

  if (category.id === "optimization") return `优化次数：${category.items.length}　消耗Token：${category.items.reduce((sum, item) => sum + item.totalTokens, 0).toLocaleString("en-US")}`;
  if (category.id === "reverse") return `反推图片：${category.items.filter((item) => item.kind === "image" && item.status !== "failed").length}`;

  const generatedImages = category.items.filter((item) => item.kind === "image" && !item.isUploadRecord && item.status !== "failed").length;
  const generatedVideos = category.items.filter((item) => item.kind === "video" && !item.isUploadRecord && item.status !== "failed").length;
  const uploadedImages = category.items.filter((item) => item.kind === "image" && item.isUploadRecord).length;
  return `生成图片：${generatedImages}　生成视频：${generatedVideos}　上传图片：${uploadedImages}`;
}

function getConversationSummaryText(conversation: AdminCreditConversationDetail) {
  const generatedImages = conversation.mediaItems.filter((item) => item.kind === "image" && !item.isUploadRecord && item.status !== "failed").length;
  const generatedVideos = conversation.mediaItems.filter((item) => item.kind === "video" && !item.isUploadRecord && item.status !== "failed").length;
  const uploadedImages = conversation.mediaItems.filter((item) => item.kind === "image" && item.isUploadRecord).length;
  const uploadedFiles = conversation.mediaItems.filter((item) => item.kind === "file" && item.isUploadRecord).length;
  return `生成图片：${generatedImages}　生成视频：${generatedVideos}　上传图片：${uploadedImages}　上传文件：${uploadedFiles}`;
}

function SettingSwitch({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function AdminInfoTooltip({ children, widthClass = "w-[250px]" }: { children: ReactNode; widthClass?: string }) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [horizontalAlign, setHorizontalAlign] = useState<"left" | "center" | "right">("center");
  const alignClass = horizontalAlign === "left" ? "left-0" : horizontalAlign === "right" ? "right-0" : "left-1/2 -translate-x-1/2";

  const updateTooltipAlign = () => {
    const wrapper = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!wrapper || !tooltip) return;

    const margin = 8;
    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const centeredLeft = wrapperRect.left + wrapperRect.width / 2 - tooltipWidth / 2;
    const centeredRight = centeredLeft + tooltipWidth;

    if (centeredLeft < margin) {
      setHorizontalAlign("left");
    } else if (centeredRight > window.innerWidth - margin) {
      setHorizontalAlign("right");
    } else {
      setHorizontalAlign("center");
    }
  };

  return (
    <span ref={wrapperRef} onMouseEnter={updateTooltipAlign} onFocus={updateTooltipAlign} className="group relative inline-flex h-4 w-4 items-center justify-center text-[#999999]">
      <RiInformation2Line className="h-4 w-4" aria-hidden="true" />
      <span ref={tooltipRef} className={`pointer-events-none absolute ${alignClass} top-6 z-20 ${widthClass} rounded-[7px] bg-[#111111] px-3 py-2 text-left text-[12px] leading-5 text-white opacity-0 shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition group-hover:opacity-100`}>
        {children}
      </span>
    </span>
  );
}

function SettingInput({ label, value, disabled, tooltip, onChange, onToggle }: { label: string; value: string; disabled: boolean; tooltip: string; onChange: (value: string) => void; onToggle: (checked: boolean) => void }) {
  return (
    <div className="flex w-[170px] flex-col gap-1 text-[12px] text-[#777777]">
      <div className="flex items-center gap-1.5">
        <span>{label}</span>
        <AdminInfoTooltip widthClass="w-[260px]">{tooltip}</AdminInfoTooltip>
      </div>
      <div className="flex items-center gap-2">
        <input type="text" inputMode="numeric" value={value} disabled={disabled} onChange={(event) => { const nextValue = event.target.value; if (/^\d*$/.test(nextValue)) onChange(nextValue); }} className="h-9 w-[124px] rounded-[8px] border border-[#e5e5e5] bg-white px-3 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]" />
        <SettingSwitch checked={disabled} onChange={onToggle} ariaLabel={`${label}开关`} />
      </div>
    </div>
  );
}

function RateInput({ value, disabled, lastValidValue, onChange, onToggle }: { value: string; disabled: boolean; lastValidValue: number; onChange: (value: string) => void; onToggle: (checked: boolean) => void }) {
  return (
    <div className="flex w-[170px] flex-col gap-1 text-[12px] text-[#777777]">
      <div className="flex items-center gap-1.5">
        <span>美元汇率</span>
        <AdminInfoTooltip widthClass="w-[230px]">美元汇率只允许输入 1.00 到 20.00。超出范围不会生效，会自动恢复上一次有效汇率。</AdminInfoTooltip>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (/^\d*(?:\.\d{0,2})?$/.test(nextValue)) onChange(nextValue);
          }}
          onBlur={() => {
            const numberValue = Number(value);
            onChange(Number.isFinite(numberValue) && numberValue >= MIN_USD_TO_CNY_RATE && numberValue <= MAX_USD_TO_CNY_RATE ? numberValue.toFixed(2) : lastValidValue.toFixed(2));
          }}
          className="h-9 w-[124px] rounded-[8px] border border-[#e5e5e5] bg-white px-3 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
        />
        <SettingSwitch checked={disabled} onChange={onToggle} ariaLabel="美元汇率开关" />
      </div>
    </div>
  );
}

function CreditStatCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "increase" | "consume" }) {
  const valueClass = tone === "increase" ? "text-[#18a058]" : tone === "consume" ? "text-red-500" : "text-[#111111]";

  return (
    <div className="flex min-h-[98px] flex-col rounded-[14px] border border-[#eeeeee] bg-white p-4">
      <div className="text-[12px] text-[#777777]">{label}</div>
      <div className={`mt-auto text-[22px] font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function CreditUserAvatar({ user }: { user: AdminCreditUser }) {
  if (user.avatarUrl) {
    return (
      <div className="h-9 w-9 overflow-hidden rounded-full bg-[#f1f1f1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={user.avatarUrl} alt={user.nickname || user.userEmail} className="h-full w-full object-cover" />
      </div>
    );
  }

  const initial = (user.nickname || user.userEmail || "用").trim().slice(0, 1).toUpperCase();
  return <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dfe7f4] bg-[#edf4ff] text-[13px] font-semibold text-[#367cee]">{initial}</div>;
}

function CreditAmountStatCard({ usd, cny }: { usd: number; cny: number }) {
  return (
    <div className="flex min-h-[98px] flex-col rounded-[14px] border border-[#eeeeee] bg-white p-4">
      <div className="text-[12px] text-[#777777]">消耗美元/折算人民币</div>
      <div className="mt-auto space-y-1 text-[18px] font-semibold text-red-500">
        <div>${usd.toFixed(4)}</div>
        <div>¥{cny.toFixed(2)}</div>
      </div>
    </div>
  );
}

function formatSignedCredits(value: number) {
  if (value > 0) return `+${value.toLocaleString("en-US")}`;
  if (value < 0) return `-${Math.abs(value).toLocaleString("en-US")}`;
  return "0";
}

function CreditDetailItem({ label, value, valueClassName = "text-[#333333]", underlined, marker, onClick }: { label: string; value: string; valueClassName?: string; underlined?: boolean; marker?: "dot" | "dash"; onClick?: () => void }) {
  const className = `flex min-h-9 items-center justify-between gap-4 bg-[#f2f2f2] px-3 py-2 ${onClick ? "w-full text-left transition hover:bg-[#e9eef8]" : ""}`;
  const shouldUnderline = underlined ?? Boolean(onClick);
  const markerLabel = marker === "dot" ? "·" : marker === "dash" ? "-" : "";
  const content = (
    <>
      <div className="shrink-0 text-[12px] text-[#888888]">
        {markerLabel ? <span className="mr-1 inline-flex w-2.5 justify-center text-[14px] font-black leading-none text-[#555555]">{markerLabel}</span> : null}
        <span className={shouldUnderline ? "underline underline-offset-2" : ""}>{label}</span>
      </div>
      <div className={`min-w-0 text-right text-[13px] ${valueClassName}`}>{value}</div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={(event) => { event.stopPropagation(); onClick(); }} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function CreditDetailChildItem({ label, value, marker, onClick }: { label: string; value: string; marker: "dot" | "dash"; onClick?: () => void }) {
  return <CreditDetailItem label={label} value={value} marker={marker} onClick={onClick} />;
}

export function CreditFlowDialog({ user, onClose }: { user: AdminCreditUser; onClose: () => void }) {
  useBodyScrollLock(true);

  const conversations = useMemo(() => [...user.conversationCreditDetails].sort((left, right) => (right.updatedAtTs ?? 0) - (left.updatedAtTs ?? 0)), [user.conversationCreditDetails]);
  const [activeConversationId, setActiveConversationId] = useState(() => conversations[0]?.id ?? "");
  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? conversations[0];
  const displayName = user.nickname || user.userEmail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/42 px-8 py-8 backdrop-blur-[4px]">
      <div className="flex h-[min(820px,calc(100vh-64px))] w-[min(1180px,calc(100vw-64px))] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <header className="relative flex h-[60px] shrink-0 items-center border-b border-[#eeeeee] px-6 pr-14">
          <div className="truncate text-[14px] font-semibold text-[#111111]">{displayName}对话流消耗积分详细</div>
          <button type="button" onClick={onClose} className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[9px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label="关闭对话流消耗积分详细">
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
                    <span>【{conversation.conversationCode || "--"}】{conversation.title || "新对话"}</span>
                    {conversation.isDeleted ? <span className="ml-1 text-red-500">用户已删除</span> : null}
                  </div>
                  {activeConversation?.id === conversation.id ? <div className="mt-1 truncate text-[11px] text-[#999999]">{conversation.updatedAtLabel}</div> : null}
                </button>
              )) : <div className="pt-8 text-center text-[13px] text-[#999999]">暂无对话流积分</div>}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-6">
              {activeConversation ? (
                <div className="mx-auto max-w-[920px]">
                  {activeConversation.isDeleted ? <div className="mb-2 text-center text-[12px] leading-5 text-red-500">用户已删除{activeConversation.deletedAtLabel ? ` ${activeConversation.deletedAtLabel}` : ""}</div> : null}
                  <div className="mb-3 flex items-center justify-between gap-4 text-[13px] text-[#777777]">
                    <div>{getConversationSummaryText(activeConversation)}</div>
                    <div className="shrink-0 text-right">积分扣除：-{(activeConversation.chatCredits + activeConversation.planCredits + activeConversation.mediaItems.reduce((sum, item) => sum + item.credits, 0)).toLocaleString("en-US")}</div>
                  </div>
                  <div className="overflow-hidden border-y border-[#eeeeee] bg-white">
                    <div className="grid grid-cols-[minmax(0,1.6fr)_110px_110px_110px] gap-0 border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
                      <div className="px-4 py-3">生成内容</div>
                      <div className="px-4 py-3 text-right">积分扣除</div>
                      <div className="px-4 py-3 text-right">消耗美元</div>
                      <div className="px-4 py-3 text-right">折算人民币</div>
                    </div>
                    <div className="divide-y divide-[#eeeeee]">
                      <CreditFlowRow label="对话积分" credits={activeConversation.chatCredits} expectedCredits={activeConversation.chatExpectedCredits} usd={activeConversation.chatUsd ?? 0} cny={activeConversation.chatCny ?? 0} isChargeDisabled={activeConversation.chatChargeDisabled} />
                      <CreditFlowRow label="规划积分" credits={activeConversation.planCredits} expectedCredits={activeConversation.planExpectedCredits} usd={activeConversation.planUsd ?? 0} cny={activeConversation.planCny ?? 0} isChargeDisabled={activeConversation.planChargeDisabled} />
                      {activeConversation.mediaItems.map((item) => (
                        <CreditFlowRow key={item.id} label={item.displayName} mediaName={item.mediaName} credits={item.credits} expectedCredits={item.expectedCredits} usd={item.usd} cny={item.cny} meta={formatMetaWithTime(item.parameters, item.createdAtLabel)} errorText={item.errorText} deletedAtLabel={item.deletedAtLabel} mediaUrl={item.url} mediaKind={item.kind} status={item.status} isUploadRecord={item.isUploadRecord} isChargeDisabled={item.isChargeDisabled} isCreditMissing={item.isCreditMissing} isCostUnavailable={item.isCostUnavailable} isReversePrompt={item.isReversePrompt} promptText={item.promptText} />
                      ))}
                      {activeConversation.mediaItems.length === 0 ? <div className="px-4 py-8 text-center text-[13px] text-[#999999]">该对话暂无图片或视频积分</div> : null}
                    </div>
                  </div>
                </div>
              ) : <div className="pt-20 text-center text-[13px] text-[#999999]">暂无对话流积分</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CreditFlowRow({ label, mediaName, credits, expectedCredits, usd, cny, meta, errorText, deletedAtLabel, mediaUrl, mediaKind, status = "success", isUploadRecord, isChargeDisabled, isCreditMissing, isCostUnavailable, isReversePrompt, promptText, showPromptCopyColumn }: { label: string; mediaName?: string; credits: number; expectedCredits?: number; usd: number; cny: number; meta?: string; errorText?: string; deletedAtLabel?: string; mediaUrl?: string; mediaKind?: "image" | "video" | "file"; status?: "success" | "failed"; isUploadRecord?: boolean; isChargeDisabled?: boolean; isCreditMissing?: boolean; isCostUnavailable?: boolean; isReversePrompt?: boolean; promptText?: string; showPromptCopyColumn?: boolean }) {
  const isDeleted = errorText === "用户已删除";
  const safeExpectedCredits = Math.max(0, Math.floor(expectedCredits ?? credits));
  const creditsLabel = isUploadRecord ? "--" : isChargeDisabled && credits === 0 ? "0（扣分关闭）" : isCreditMissing && credits === 0 ? "0（扣分异常）" : (isCostUnavailable || credits === 0) && status !== "failed" ? "0（未返回成本）" : credits === 0 ? "0" : `-${credits.toLocaleString("en-US")}${safeExpectedCredits > credits ? ` / 应扣${safeExpectedCredits.toLocaleString("en-US")}` : ""}`;
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const gridClassName = showPromptCopyColumn ? "grid-cols-[minmax(0,1.6fr)_110px_150px]" : "grid-cols-[minmax(0,1.6fr)_110px_110px_110px]";

  const copyPrompt = async () => {
    if (!promptText) return;
    await navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 1200);
  };

  return (
    <div className={`grid ${gridClassName} gap-0 bg-white`}>
      <div className="flex min-w-0 items-start gap-3 px-4 py-3">
        {mediaKind === "file" ? (
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-[6px] bg-[#ebebeb] text-[12px] font-medium text-[#777777]">
            文件
          </div>
        ) : mediaUrl ? (
          mediaKind === "video" ? (
            <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#e8e8e8]">
              {getLocalVideoPosterUrl(mediaUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getAdminMediaThumbnailUrl(getLocalVideoPosterUrl(mediaUrl) ?? mediaUrl)} onError={(event) => fallbackAdminImageToOriginal(event.currentTarget, mediaUrl)} alt={label} className="h-full w-full object-cover" />
              ) : <video src={getAdminMediaSourceUrl(mediaUrl)} className="h-full w-full object-cover" muted />}
            </div>
          ) : (
            <AdminHoverImagePreview src={mediaUrl} alt={label} wrapperClassName="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#e8e8e8]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAdminMediaThumbnailUrl(mediaUrl)} onError={(event) => fallbackAdminImageToOriginal(event.currentTarget, mediaUrl)} alt={label} className="h-full w-full object-cover" />
            </AdminHoverImagePreview>
          )
        ) : status === "failed" ? (
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-[6px] bg-[#ebebeb] text-[12px] font-medium text-[#777777]">
            生成失败
          </div>
        ) : null}
        <div className="min-w-0">
          {mediaName ? <div className="mb-1 whitespace-normal break-words text-[13px] font-medium leading-5 text-[#222222]">{mediaName}</div> : null}
          <div className="whitespace-normal break-words text-[13px] leading-5 text-[#333333]">
            <span>{label}</span>
            {isDeleted ? <span className="ml-2 text-red-500">用户已删除{deletedAtLabel ? ` ${deletedAtLabel}` : ""}</span> : null}
            {status === "failed" && errorText && !isDeleted ? <span className="text-red-500">{errorText}</span> : null}
          </div>
          {promptText ? (
            <div className="mt-1 whitespace-normal break-words text-[12px] leading-5 text-[#333333]">
              {isReversePrompt ? (
                <span className="mr-2 inline-flex h-5 align-[1px] items-center gap-1 rounded-[5px] border border-[#367cee] px-1.5 text-[11px] font-medium leading-none text-[#367cee]">
                  <RiQuillPenAiLine className="h-3 w-3" aria-hidden="true" />
                  <span>反推提示词</span>
                </span>
              ) : <span className="mr-2 text-[11px] font-medium text-[#999999]">提示词</span>}
              {promptText}
            </div>
          ) : null}
          {meta ? <div className="mt-1 whitespace-pre-line text-[11px] leading-5 text-[#999999]">{meta}</div> : null}
        </div>
      </div>
      <div className="px-4 py-3 text-right text-[13px] text-[#333333]">{creditsLabel}</div>
      {showPromptCopyColumn ? (
        <div className="px-4 py-3 text-right text-[13px] text-[#333333]">
          {promptText ? (
            <button type="button" onClick={copyPrompt} className="h-7 rounded-[7px] border border-[#e7e7e7] bg-white px-2.5 text-[12px] text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee]">
              {copiedPrompt ? "已复制" : "复制提示词"}
            </button>
          ) : "--"}
        </div>
      ) : (
        <>
          <div className="px-4 py-3 text-right text-[13px] text-[#333333]">{isUploadRecord ? "--" : `$${usd.toFixed(4)}`}</div>
          <div className="px-4 py-3 text-right text-[13px] text-[#333333]">{isUploadRecord ? "--" : `¥${cny.toFixed(2)}`}</div>
        </>
      )}
    </div>
  );
}

function formatMetaWithTime(parameters: string, createdAtLabel: string) {
  return `${parameters}${"\u00a0".repeat(12)}${createdAtLabel}`;
}

export function CreditCategoryDialog({ title, user, categories, initialCategoryId, showPromptCopyColumn, onClose }: { title: string; user: AdminCreditUser; categories: AdminCreditCategoryDetail[]; initialCategoryId?: string; showPromptCopyColumn?: boolean; onClose: () => void }) {
  useBodyScrollLock(true);

  const [activeCategoryId, setActiveCategoryId] = useState(() => initialCategoryId && categories.some((item) => item.id === initialCategoryId) ? initialCategoryId : categories[0]?.id ?? "");
  const activeCategory = categories.find((item) => item.id === activeCategoryId) ?? categories[0];
  const displayName = user.nickname || user.userEmail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/42 px-8 py-8 backdrop-blur-[4px]">
      <div className="flex h-[min(820px,calc(100vh-64px))] w-[min(1180px,calc(100vw-64px))] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <header className="relative flex h-[60px] shrink-0 items-center border-b border-[#eeeeee] px-6 pr-14">
          <div className="truncate text-[14px] font-semibold text-[#111111]">{displayName}{title}</div>
          <button type="button" onClick={onClose} className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[9px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label={`关闭${title}`}>
            <RiCloseLine className="h-5 w-5" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[270px] shrink-0 flex-col border-r border-[#eeeeee] bg-[#f8f8f8] pl-4 pt-4">
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pb-4 pr-2">
              {categories.length > 0 ? categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategoryId(category.id)}
                  className={`w-full rounded-[10px] px-3 text-left transition ${activeCategory?.id === category.id ? "bg-[#ececec] py-2 text-[#111111]" : "py-1.5 text-[#666666] hover:bg-[#eeeeee] hover:text-[#111111]"}`}
                >
                  <div className="truncate text-[13px] font-medium">{category.title}</div>
                </button>
              )) : <div className="pt-8 text-center text-[13px] text-[#999999]">暂无积分明细</div>}
            </div>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-6">
              {activeCategory ? (
                <div className="mx-auto max-w-[920px]">
                  <div className="mb-3 flex items-center justify-between gap-4 text-[13px] text-[#777777]">
                    <div>{getCategorySummaryText(activeCategory, categories)}</div>
                    <div className="shrink-0 text-right">积分扣除：-{activeCategory.items.reduce((sum, item) => sum + item.credits, 0).toLocaleString("en-US")}</div>
                  </div>
                  <div className="overflow-hidden border-y border-[#eeeeee] bg-white">
                    <div className={`grid ${showPromptCopyColumn ? "grid-cols-[minmax(0,1.6fr)_110px_150px]" : "grid-cols-[minmax(0,1.6fr)_110px_110px_110px]"} gap-0 border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]`}>
                      <div className="px-4 py-3">生成内容</div>
                      <div className="px-4 py-3 text-right">积分扣除</div>
                      {showPromptCopyColumn ? <div className="px-4 py-3 text-right">复制提示词</div> : <><div className="px-4 py-3 text-right">消耗美元</div><div className="px-4 py-3 text-right">折算人民币</div></>}
                    </div>
                    <div className="divide-y divide-[#eeeeee]">
                      {activeCategory.items.map((item) => (
                        <CreditFlowRow key={item.id} label={item.displayName} mediaName={item.mediaName} credits={item.credits} expectedCredits={item.expectedCredits} usd={item.usd} cny={item.cny} meta={formatMetaWithTime(item.parameters, item.createdAtLabel)} errorText={item.errorText} deletedAtLabel={item.deletedAtLabel} mediaUrl={item.url} mediaKind={item.kind} status={item.status} isUploadRecord={item.isUploadRecord} isChargeDisabled={item.isChargeDisabled} isCreditMissing={item.isCreditMissing} isCostUnavailable={item.isCostUnavailable} isReversePrompt={item.isReversePrompt} promptText={item.promptText} showPromptCopyColumn={showPromptCopyColumn} />
                      ))}
                      {activeCategory.items.length === 0 ? <div className="px-4 py-8 text-center text-[13px] text-[#999999]">当前分类暂无积分明细</div> : null}
                    </div>
                  </div>
                </div>
              ) : <div className="pt-20 text-center text-[13px] text-[#999999]">暂无积分明细</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CurrentCreditDialog({ user, onClose }: { user: AdminCreditUser; onClose: () => void }) {
  useBodyScrollLock(true);
  const displayName = user.nickname || user.userEmail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/42 px-8 py-8 backdrop-blur-[4px]">
      <div className="flex h-[min(760px,calc(100vh-64px))] w-[min(860px,calc(100vw-64px))] flex-col overflow-hidden rounded-[10px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <header className="relative flex h-[60px] shrink-0 items-center border-b border-[#eeeeee] px-6 pr-14">
          <div className="truncate text-[14px] font-semibold text-[#111111]">{displayName}当前积分变动明细</div>
          <button type="button" onClick={onClose} className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[9px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label="关闭当前积分变动明细">
            <RiCloseLine className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-8 py-6">
          <div className="mb-3 flex items-center justify-between text-[13px] text-[#777777]">
            <span>按时间最新排序</span>
            <span>当前积分：{user.currentCredits.toLocaleString("en-US")}</span>
          </div>
          <div className="overflow-hidden border-y border-[#eeeeee] bg-white">
            <div className="grid grid-cols-[minmax(0,1fr)_150px_150px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
              <div className="px-4 py-3">变动原因</div>
              <div className="px-4 py-3 text-right">积分变动</div>
              <div className="px-4 py-3 text-right">变动后剩余积分</div>
            </div>
            <div className="divide-y divide-[#eeeeee]">
              {user.currentCreditDetails.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_150px_150px] text-[13px] text-[#333333]">
                  <div className="min-w-0 px-4 py-3">
                    <div className="truncate font-medium text-[#222222]">{item.reason}</div>
                    <div className="mt-1 text-[11px] text-[#999999]">{item.createdAtLabel}</div>
                  </div>
                  <div className={`px-4 py-3 text-right font-medium ${item.delta >= 0 ? "text-[#18a058]" : "text-red-500"}`}>{formatSignedCredits(item.delta)}</div>
                  <div className="px-4 py-3 text-right font-medium text-[#222222]">{item.balanceAfter.toLocaleString("en-US")}</div>
                </div>
              ))}
              {user.currentCreditDetails.length === 0 ? <div className="px-4 py-10 text-center text-[13px] text-[#999999]">暂无积分变动记录</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCreditsPanel({ settings, stats, rows }: { settings: AdminCreditSettings; stats: AdminCreditStats; rows: AdminCreditUser[] }) {
  const [draft, setDraft] = useState(settings);
  const [rateInput, setRateInput] = useState(settings.usdToCnyRate.toFixed(2));
  const [creditsPerCnyInput, setCreditsPerCnyInput] = useState(String(settings.creditsPerCny));
  const [signupCreditsInput, setSignupCreditsInput] = useState(String(settings.signupCredits));
  const [lastEnabledRate, setLastEnabledRate] = useState(settings.usdToCnyRate);
  const [lastEnabledCreditsPerCny, setLastEnabledCreditsPerCny] = useState(settings.creditsPerCny);
  const [lastEnabledSignupCredits, setLastEnabledSignupCredits] = useState(settings.signupCredits);
  const [isRateLocked, setIsRateLocked] = useState(true);
  const [isCreditsPerCnyLocked, setIsCreditsPerCnyLocked] = useState(true);
  const [isSignupCreditsLocked, setIsSignupCreditsLocked] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [adjustPopover, setAdjustPopover] = useState<AdjustPopover | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(() => new Set());
  const [currentCreditDialogUser, setCurrentCreditDialogUser] = useState<AdminCreditUser | null>(null);
  const [creditFlowDialogUser, setCreditFlowDialogUser] = useState<AdminCreditUser | null>(null);
  const [assetGenerationDialogUser, setAssetGenerationDialogUser] = useState<AdminCreditUser | null>(null);
  const [promptToolDialogUser, setPromptToolDialogUser] = useState<AdminCreditUser | null>(null);
  const [isPending, startTransition] = useTransition();

  useBodyScrollLock(Boolean(adjustPopover));

  const toggleExpandedUser = (userId: string) => {
    setExpandedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter((row) => `${row.id} ${row.userEmail} ${row.nickname ?? ""}`.toLowerCase().includes(value));
  }, [query, rows]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filteredRows.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);
  const consumedCredits = rows.reduce((sum, row) => sum + row.consumedCredits, 0);
  const consumedTokens = rows.reduce((sum, row) => sum + row.consumedTokens, 0);
  const consumedUsd = rows.reduce((sum, row) => sum + row.consumedUsd, 0);
  const consumedCny = rows.reduce((sum, row) => sum + row.consumedCny, 0);

  const normalizeRateInput = (value: string, fallback = draft.usdToCnyRate) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= MIN_USD_TO_CNY_RATE && numberValue <= MAX_USD_TO_CNY_RATE ? numberValue : fallback;
  };

  const normalizeCreditsPerCnyInput = (value: string, fallback = lastEnabledCreditsPerCny) => {
    const numberValue = Number(value);
    return Number.isInteger(numberValue) && VALID_CREDITS_PER_CNY.includes(numberValue) ? numberValue : fallback;
  };

  const normalizeSignupCreditsInput = (value: string, creditsPerCny: number, fallback = lastEnabledSignupCredits) => {
    const numberValue = Number(value);
    const maxValue = creditsPerCny * 200;
    const fallbackValue = fallback <= maxValue ? fallback : Math.min(settings.signupCredits, maxValue);
    return Number.isInteger(numberValue) && numberValue >= 0 && numberValue <= maxValue ? numberValue : fallbackValue;
  };

  const saveSettings = (nextDraft = draft, nextRateInput = rateInput) => {
    startTransition(async () => {
      await fetch("/admin/api/credits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...nextDraft, usdToCnyRate: normalizeRateInput(nextRateInput, nextDraft.usdToCnyRate) }) });
    });
  };

  const toggleRateLocked = (checked: boolean) => {
    setIsRateLocked(checked);
    if (checked) {
      const inputRate = Number(rateInput);
      const nextRate = Number.isFinite(inputRate) && inputRate >= MIN_USD_TO_CNY_RATE && inputRate <= MAX_USD_TO_CNY_RATE ? inputRate : lastEnabledRate;
      const nextDraft = { ...draft, usdToCnyRate: nextRate };
      setRateInput(nextRate.toFixed(2));
      setLastEnabledRate(nextRate);
      setDraft(nextDraft);
      saveSettings(nextDraft, nextRate.toFixed(2));
    }
  };

  const toggleCreditsPerCnyLocked = (checked: boolean) => {
    setIsCreditsPerCnyLocked(checked);
    if (checked) {
      const nextCreditsPerCny = normalizeCreditsPerCnyInput(creditsPerCnyInput);
      const nextSignupCredits = normalizeSignupCreditsInput(signupCreditsInput, nextCreditsPerCny);
      const nextDraft = { ...draft, creditsPerCny: nextCreditsPerCny, signupCredits: nextSignupCredits };
      setCreditsPerCnyInput(String(nextCreditsPerCny));
      setSignupCreditsInput(String(nextSignupCredits));
      setLastEnabledCreditsPerCny(nextCreditsPerCny);
      setLastEnabledSignupCredits(nextSignupCredits);
      setDraft(nextDraft);
      saveSettings(nextDraft, rateInput);
    }
  };

  const toggleSignupCreditsLocked = (checked: boolean) => {
    setIsSignupCreditsLocked(checked);
    if (checked) {
      const nextSignupCredits = normalizeSignupCreditsInput(signupCreditsInput, draft.creditsPerCny);
      const nextDraft = { ...draft, signupCredits: nextSignupCredits };
      setSignupCreditsInput(String(nextSignupCredits));
      setLastEnabledSignupCredits(nextSignupCredits);
      setDraft(nextDraft);
      saveSettings(nextDraft, rateInput);
    }
  };

  const updateChargeSetting = (key: keyof AdminCreditSettings, value: boolean) => {
    const nextDraft = { ...draft, [key]: value };
    setDraft(nextDraft);
    saveSettings(nextDraft, rateInput);
  };

  const appendAdjustInput = (value: string) => {
    setAdjustAmount((current) => {
      if (value === "-") return current.startsWith("-") ? current.slice(1) : `-${current}`;
      if (value === "clear") return "";
      if (value === "backspace") return current.slice(0, -1);
      const next = `${current}${value}`.replace(/^(-?)0+(\d)/, "$1$2");
      return next.slice(0, 8);
    });
  };

  const submitAdjustCredits = () => {
    if (!adjustPopover) return;
    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount === 0) return;

    startTransition(async () => {
      const response = await fetch("/admin/api/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: adjustPopover.user.id, delta: amount }),
      });
      if (!response.ok) return;
      window.location.reload();
    });
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">积分管理</h1>
        <div className="flex h-9 w-[240px] items-center rounded-[9px] border border-[#e9e9e9] bg-white px-3">
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ID / 邮箱 / 昵称" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#222222] outline-none placeholder:text-[#b0b0b0]" />
          <RiSearchLine className="ml-2 h-4 w-4 shrink-0 text-[#999999]" aria-hidden="true" />
        </div>
      </div>

      <div className="mb-7 mt-2 flex min-w-[1180px] flex-nowrap items-stretch gap-0 py-3 text-[13px]">
        <div className="pr-5">
          <RateInput value={rateInput} disabled={isRateLocked} lastValidValue={lastEnabledRate} onToggle={toggleRateLocked} onChange={(value) => { setRateInput(value); }} />
        </div>
        <div className="border-l border-[#dddddd] px-5">
          <SettingInput label="1人民币兑换积分" value={creditsPerCnyInput} disabled={isCreditsPerCnyLocked} tooltip="只支持 10、100、1000、10000 四个整数值。其它数值不会生效，会恢复上一次启用过的有效值。" onToggle={toggleCreditsPerCnyLocked} onChange={setCreditsPerCnyInput} />
        </div>
        <div className="border-l border-[#dddddd] px-5">
          <SettingInput label="注册送积分" value={signupCreditsInput} disabled={isSignupCreditsLocked} tooltip="注册送积分按当前兑换比例折算后，价值不能超过 200 人民币。超过后不会生效，会恢复上一次启用过的有效值。" onToggle={toggleSignupCreditsLocked} onChange={setSignupCreditsInput} />
        </div>
        <div className="flex min-h-[58px] flex-col justify-end border-l border-[#dddddd] pl-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] text-[#777777]">
            <span>选择积分消耗项</span>
            <AdminInfoTooltip>
              对话/规划是 Agent 和对话模型产生的消耗<br />图片是平台里所有生成图片的消耗<br />视频是平台里所有生成视频的消耗<br />反推/优化提示词是平台里所有反推和优化提示词的消耗<br />打开表示要扣积分，关闭则不扣，但后台仍记录
            </AdminInfoTooltip>
          </div>
          <div className="flex items-end gap-3">
            {[
              ["chargeText", "对话/规划"],
              ["chargeImage", "图片"],
              ["chargeVideo", "视频"],
              ["chargePromptTool", "反推/优化提示词"],
            ].map(([key, label], index) => {
              const settingKey = key as keyof AdminCreditSettings;
              const checked = Boolean(draft[settingKey]);
              return (
                <div key={key} className={`flex h-9 items-center gap-2 rounded-[8px] bg-[#f7f7f7] pr-3 text-[#333333] ${index === 0 ? "pl-0" : "pl-3"}`}>
                  <span>{label}</span>
                  <SettingSwitch checked={checked} onChange={(value) => updateChargeSetting(settingKey, value)} ariaLabel={`${label}开关`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="mb-5 grid grid-cols-5 gap-4">
        <CreditStatCard label="总积分" value={stats.totalUserCredits.toLocaleString("en-US")} />
        <CreditStatCard label="赠送积分总数" value={formatSignedCredits(stats.increasedCredits)} tone="increase" />
        <CreditStatCard label="消耗积分总数" value={consumedCredits.toLocaleString("en-US")} tone="consume" />
        <CreditStatCard label="消耗 Token" value={consumedTokens.toLocaleString("en-US")} tone="consume" />
        <CreditAmountStatCard usd={consumedUsd} cny={consumedCny} />
      </section>

      <section className="mt-3 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-[13px]">
          <thead className="bg-[#fafafa] text-[#777777]"><tr><th className="w-[44px] border-b border-[#eeeeee] py-3 pl-6 pr-0 font-medium" /><th className="w-[135px] border-b border-[#eeeeee] py-3 pl-2 pr-4 font-medium">ID号</th><th className="w-[290px] border-b border-[#eeeeee] px-4 py-3 font-medium">用户</th><th className="w-[160px] border-b border-[#eeeeee] px-4 py-3 text-left font-medium">当前积分</th><th className="w-[160px] border-b border-[#eeeeee] px-4 py-3 text-left font-medium">已赠送积分</th><th className="w-[160px] border-b border-[#eeeeee] px-4 py-3 text-left font-medium">已消耗积分</th><th className="w-[170px] border-b border-[#eeeeee] px-4 py-3 text-left font-medium">最后积分变动时间</th><th className="w-[106px] border-b border-[#eeeeee] py-3 pl-4 pr-8 font-medium" /></tr></thead>
          <tbody>
            {pagedRows.map((row) => {
              const isExpanded = expandedUserIds.has(row.id);

              return (
                <Fragment key={row.id}>
                  <tr onClick={() => toggleExpandedUser(row.id)} className="cursor-pointer text-[#333333] transition hover:bg-[#fcfcfc]">
                    <td className="border-b border-[#f2f2f2] py-3 pl-6 pr-0 text-left">
                      <button type="button" onClick={(event) => { event.stopPropagation(); toggleExpandedUser(row.id); }} className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label={isExpanded ? "收起积分详情" : "展开积分详情"}>
                        {isExpanded ? <RiArrowDownSLine className="h-5 w-5" /> : <RiArrowRightSLine className="h-5 w-5" />}
                      </button>
                    </td>
                    <td className="border-b border-[#f2f2f2] py-3 pl-2 pr-4 font-mono text-[12px] text-[#777777]">{row.id}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3"><div className="flex items-center gap-3"><CreditUserAvatar user={row} /><div className="min-w-0"><div className="truncate text-[13px] font-medium text-[#222222]">{row.userEmail}</div><div className="mt-0.5 truncate text-[12px] text-[#888888]">{row.nickname || "未设置昵称"}</div></div></div></td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-left font-medium text-[#222222]">{row.currentCredits.toLocaleString("en-US")}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-left font-medium text-[#18a058]">{formatSignedCredits(row.giftedCredits)}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-left font-medium text-red-500">-{row.consumedCredits.toLocaleString("en-US")}</td>
                    <td className="border-b border-[#f2f2f2] px-4 py-3 text-left text-[#777777]">{row.lastActiveLabel}</td>
                    <td className="border-b border-[#f2f2f2] py-3 pl-3 pr-8 text-right">
                      <button type="button" onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setAdjustPopover({ user: row, top: rect.top + rect.height / 2, left: Math.max(12, rect.left - 240) }); setAdjustAmount(""); }} className="h-7 whitespace-nowrap rounded-[7px] border border-[#e7e7e7] bg-white px-2.5 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee]"><span style={{ fontSize: 12 }}>调积分</span></button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-[#fbfbfb]">
                      <td colSpan={8} className="border-b border-[#f2f2f2] px-4 py-4">
                        <div className="grid grid-cols-3 gap-[5px] px-1 py-1 text-left">
                          <div className="space-y-px">
                            <CreditDetailItem label="当前积分" value={row.currentCredits.toLocaleString("en-US")} onClick={() => setCurrentCreditDialogUser(row)} />
                            <CreditDetailItem label="已赠送积分" value={formatSignedCredits(row.giftedCredits)} />
                            <CreditDetailChildItem marker="dash" label="注册送积分" value={formatSignedCredits(row.signupGiftedCredits)} />
                            <CreditDetailChildItem marker="dash" label="后台调整赠送积分" value={formatSignedCredits(row.adminAdjustedGiftedCredits)} />
                          </div>
                          <div className="space-y-px">
                            <CreditDetailItem label="已消耗积分" value={`-${row.consumedCredits.toLocaleString("en-US")}`} />
                            <CreditDetailChildItem marker="dash" label="对话流消耗积分详细" value={`-${row.conversationConsumedCredits.toLocaleString("en-US")}`} onClick={() => setCreditFlowDialogUser(row)} />
                            <CreditDetailChildItem marker="dash" label="资产库消耗积分详细" value={`-${row.assetGenerationConsumedCredits.toLocaleString("en-US")}`} onClick={() => setAssetGenerationDialogUser(row)} />
                            <CreditDetailChildItem marker="dash" label="反推/优化提示词消耗积分详细" value={`-${row.promptToolConsumedCredits.toLocaleString("en-US")}`} onClick={() => setPromptToolDialogUser(row)} />
                          </div>
                          <div className="space-y-px">
                            <CreditDetailItem label="消耗Token" value={row.consumedTokens.toLocaleString("en-US")} />
                            <CreditDetailItem label="消耗美元" value={`$${row.consumedUsd.toFixed(4)}`} />
                            <CreditDetailItem label="折算人民币" value={`¥${row.consumedCny.toFixed(2)}`} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {pagedRows.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-[#999999]">暂无积分记录</td></tr> : null}
          </tbody>
        </table>
      </section>
      <div className="mt-4 flex min-w-[1180px] items-center justify-between px-1 py-1 text-[13px] text-[#777777]">
        <span>共 {filteredRows.length.toLocaleString("en-US")} 条，当前显示 {rangeStart}-{rangeEnd} 条</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]"><span style={{ fontSize: 13 }}>上一页</span></button>
          <div className="min-w-[72px] text-center text-[#333333]">{safePage} / {totalPages}</div>
          <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]"><span style={{ fontSize: 13 }}>下一页</span></button>
        </div>
      </div>
      {adjustPopover ? (
        <div className="fixed inset-0 z-50 overscroll-contain" onMouseDown={() => { setAdjustPopover(null); setAdjustAmount(""); }}>
          <div className="absolute flex h-[280px] w-[230px] -translate-y-1/2 flex-col rounded-[12px] bg-white p-4 shadow-[0_18px_54px_rgba(0,0,0,0.22)]" style={{ top: adjustPopover.top, left: adjustPopover.left }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-2 min-w-0 text-[12px] text-[#777777]">
              <div className="truncate font-medium text-[#222222]">{adjustPopover.user.userEmail}</div>
              <div className="mt-0.5 truncate">当前积分 {adjustPopover.user.currentCredits.toLocaleString("en-US")}</div>
            </div>
            <div className="mb-3 flex h-10 items-center justify-end rounded-[8px] bg-[#f5f5f5] px-3 text-[20px] font-semibold text-[#111111]">
              {adjustAmount || "0"}
            </div>
            <div className="grid flex-1 grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "0", "退"].map((item) => (
                <button key={item} type="button" onClick={() => appendAdjustInput(item === "退" ? "backspace" : item)} className="rounded-[7px] bg-[#f2f2f2] text-[15px] font-medium text-[#333333] transition hover:bg-[#e8e8e8]">
                  {item}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setAdjustPopover(null); setAdjustAmount(""); }} className="h-8 rounded-[7px] bg-[#f2f2f2] text-[12px] text-[#555555] transition hover:bg-[#e8e8e8]">取消</button>
              <button type="button" disabled={isPending || !Number.isFinite(Number(adjustAmount)) || Number(adjustAmount) === 0} onClick={submitAdjustCredits} className="h-8 rounded-[7px] bg-[#111111] text-[12px] font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#cfcfcf]">确定</button>
            </div>
          </div>
        </div>
      ) : null}
      {currentCreditDialogUser ? <CurrentCreditDialog user={currentCreditDialogUser} onClose={() => setCurrentCreditDialogUser(null)} /> : null}
      {creditFlowDialogUser ? <CreditFlowDialog user={creditFlowDialogUser} onClose={() => setCreditFlowDialogUser(null)} /> : null}
      {assetGenerationDialogUser ? <CreditCategoryDialog title="资产库消耗积分详细" user={assetGenerationDialogUser} categories={assetGenerationDialogUser.assetGenerationCreditDetails} onClose={() => setAssetGenerationDialogUser(null)} /> : null}
      {promptToolDialogUser ? <CreditCategoryDialog title="反推/优化提示词消耗积分详细" user={promptToolDialogUser} categories={promptToolDialogUser.promptToolCreditDetails} onClose={() => setPromptToolDialogUser(null)} /> : null}
    </>
  );
}
