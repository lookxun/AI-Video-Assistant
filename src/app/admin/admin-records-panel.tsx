"use client";

import { Fragment, useMemo, useState } from "react";
import { RiArrowDownSLine, RiArrowRightSLine, RiSearchLine } from "react-icons/ri";
import { AdminHistoryDialog, AdminMediaDialog, DetailItem, SmallStat, UserAvatar, type AdminMediaItem, type AdminUserRow } from "./admin-users-panel";
import { CreditCategoryDialog, CreditFlowDialog, type AdminCreditCategoryDetail, type AdminCreditFlowItem, type AdminCreditUser } from "./admin-credits-panel";

const PAGE_SIZE = 15;

function formatNumber(value: number) {
  return value.toLocaleString("en-US");
}

function generatedAssetImageCount(user: AdminUserRow) {
  return user.assetMediaItems.filter((item) => !item.isUploadedAsset).length;
}

function conversationImageCount(user: AdminUserRow) {
  return user.mediaItems.filter((item) => item.type === "image").length;
}

function assetUploadImageCount(user: AdminUserRow) {
  return user.assetMediaItems.filter((item) => item.isUploadedAsset).length;
}

function conversationUploadItems(creditUser: AdminCreditUser | undefined, kind: "image" | "file") {
  return (creditUser?.conversationCreditDetails ?? []).flatMap((conversation) => conversation.mediaItems.filter((item) => item.isUploadRecord && item.kind === kind));
}

function assetUploadItems(creditUser: AdminCreditUser | undefined) {
  return (creditUser?.assetGenerationCreditDetails ?? []).flatMap((category) => category.items.filter((item) => item.isUploadRecord && item.kind === "image"));
}

function makeUploadCategory(id: string, title: string, items: AdminCreditFlowItem[]): AdminCreditCategoryDetail[] {
  return [{ id, title, totalCredits: 0, totalUsd: 0, totalCny: 0, items: [...items].sort((left, right) => right.createdAtTs - left.createdAtTs) }];
}

function mediaItemToFlowItem(item: AdminMediaItem, index: number): AdminCreditFlowItem {
  const isUpload = Boolean(item.isUploadedAsset);
  return {
    id: item.id || `${item.url}-${index}`,
    requestId: item.id || `${item.url}-${index}`,
    kind: item.type,
    systemName: item.name || "",
    displayName: item.name || (item.type === "video" ? `视频${index + 1}` : `图片${index + 1}`),
    url: item.url,
    status: item.isDeleted ? "failed" : "success",
    errorText: item.isDeleted ? "用户已删除" : undefined,
    deletedAtLabel: item.deletedAtLabel,
    credits: 0,
    totalTokens: 0,
    usd: 0,
    cny: 0,
    count: 1,
    model: item.model,
    parameters: isUpload ? item.type === "image" ? "对话流上传" : "对话流上传文件" : [item.model, item.ratio, [item.size, item.resolution].filter((value) => value && value !== "-").join(" "), item.type === "video" ? item.duration : ""].filter((value) => value && value !== "-").join(" | "),
    isUploadRecord: isUpload,
    isReversePrompt: item.isReversePrompt,
    promptText: item.prompt,
    createdAtLabel: item.createdAtTs ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(item.createdAtTs)) : "-",
    createdAtTs: item.createdAtTs ?? 0,
  };
}

function workspaceConversationGeneratedItems(user: AdminUserRow, kind: "image" | "video") {
  return user.mediaItems.filter((item) => item.type === kind && !item.isUploadedAsset).map(mediaItemToFlowItem);
}

function workspaceAssetGeneratedImageItems(user: AdminUserRow) {
  return user.assetMediaItems.filter((item) => item.type === "image" && !item.isUploadedAsset).map(mediaItemToFlowItem);
}

function latestRecordTime(user: AdminUserRow, creditUser: AdminCreditUser | undefined) {
  const historyTimes = user.conversations.map((item) => item.updatedAtTs ?? 0);
  const generatedImageTimes = [...user.mediaItems, ...user.assetMediaItems].filter((item) => item.type === "image" && !item.isUploadedAsset).map((item) => item.createdAtTs ?? 0);
  const generatedVideoTimes = user.mediaItems.filter((item) => item.type === "video").map((item) => item.createdAtTs ?? 0);
  const uploadImageTimes = [...conversationUploadItems(creditUser, "image"), ...assetUploadItems(creditUser)].map((item) => item.createdAtTs);
  const uploadFileTimes = conversationUploadItems(creditUser, "file").map((item) => item.createdAtTs);
  return Math.max(0, ...historyTimes, ...generatedImageTimes, ...generatedVideoTimes, ...uploadImageTimes, ...uploadFileTimes);
}

function makeUploadCategories(creditUser: AdminCreditUser | undefined) {
  return [
    makeUploadCategory("conversation-upload-images", "对话流上传图片列表", conversationUploadItems(creditUser, "image"))[0],
    makeUploadCategory("conversation-upload-files", "对话流上传文件列表", conversationUploadItems(creditUser, "file"))[0],
    makeUploadCategory("asset-upload-images", "资产库上传图片列表", assetUploadItems(creditUser))[0],
  ];
}

function makeGeneratedCategories(user: AdminUserRow) {
  return [
    makeUploadCategory("conversation-generated-images", "对话流生成图片列表", workspaceConversationGeneratedItems(user, "image"))[0],
    makeUploadCategory("conversation-generated-videos", "对话流生成视频列表", workspaceConversationGeneratedItems(user, "video"))[0],
    makeUploadCategory("asset-generated-images", "资产库生成图片列表", workspaceAssetGeneratedImageItems(user))[0],
  ];
}

export function AdminRecordsPanel({ users, creditRows }: { users: AdminUserRow[]; creditRows: AdminCreditUser[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(() => new Set());
  const [historyUser, setHistoryUser] = useState<AdminUserRow | null>(null);
  const [mediaDialog, setMediaDialog] = useState<{ user: AdminUserRow; mediaType: "image" | "video" | "asset_image" } | null>(null);
  const [creditFlowUser, setCreditFlowUser] = useState<AdminCreditUser | null>(null);
  const [assetCreditUser, setAssetCreditUser] = useState<AdminCreditUser | null>(null);
  const [promptToolUser, setPromptToolUser] = useState<AdminCreditUser | null>(null);
  const [generatedListDialog, setGeneratedListDialog] = useState<{ user: AdminCreditUser; categories: AdminCreditCategoryDetail[]; initialCategoryId: string } | null>(null);
  const [uploadDialog, setUploadDialog] = useState<{ user: AdminCreditUser; categories: AdminCreditCategoryDetail[]; initialCategoryId: string } | null>(null);

  const creditUserMap = useMemo(() => new Map(creditRows.map((row) => [row.id, row])), [creditRows]);
  const rows = useMemo(() => users.map((user) => {
    const creditUser = creditUserMap.get(user.id);
    const conversationUploadImageCount = conversationUploadItems(creditUser, "image").length;
    const conversationUploadFileCount = conversationUploadItems(creditUser, "file").length;
    const assetUploadedImages = assetUploadImageCount(user);
    return {
      user,
      creditUser,
      imageGenerationCount: user.generatedImageCount + generatedAssetImageCount(user),
      videoGenerationCount: user.generatedVideoCount,
      uploadImageCount: conversationUploadImageCount + assetUploadedImages,
      uploadFileCount: conversationUploadFileCount,
      latestRecordTs: latestRecordTime(user, creditUser),
    };
  }).sort((left, right) => right.latestRecordTs - left.latestRecordTs), [creditUserMap, users]);

  const filteredRows = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return rows;
    return rows.filter(({ user }) => `${user.id} ${user.email} ${user.nickname ?? ""}`.toLowerCase().includes(value));
  }, [query, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filteredRows.length > 0 ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length);
  const stats = {
    conversations: users.reduce((sum, user) => sum + user.conversationCount, 0),
    images: rows.reduce((sum, row) => sum + row.imageGenerationCount, 0),
    videos: rows.reduce((sum, row) => sum + row.videoGenerationCount, 0),
    uploadImages: rows.reduce((sum, row) => sum + row.uploadImageCount, 0),
    uploadFiles: rows.reduce((sum, row) => sum + row.uploadFileCount, 0),
  };

  const toggleExpandedUser = (userId: string) => {
    setExpandedUserIds((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const openUploadDialog = (creditUser: AdminCreditUser | undefined, initialCategoryId: string) => {
    if (!creditUser) return;
    setUploadDialog({ user: creditUser, categories: makeUploadCategories(creditUser), initialCategoryId });
  };

  const openGeneratedListDialog = (user: AdminUserRow, creditUser: AdminCreditUser | undefined, initialCategoryId: string) => {
    if (!creditUser) return;
    setGeneratedListDialog({ user: creditUser, categories: makeGeneratedCategories(user), initialCategoryId });
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">生成记录</h1>
        <div className="flex h-9 w-[240px] items-center rounded-[9px] border border-[#e9e9e9] bg-white px-3">
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="ID / 邮箱 / 昵称" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#222222] outline-none placeholder:text-[#b0b0b0]" />
          <RiSearchLine className="ml-2 h-4 w-4 shrink-0 text-[#999999]" aria-hidden="true" />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <SmallStat label="历史对话总数" value={formatNumber(stats.conversations)} tone="blue" />
        <SmallStat label="图片生成总数" value={formatNumber(stats.images)} />
        <SmallStat label="视频生成总数" value={formatNumber(stats.videos)} />
        <SmallStat label="上传图片总数" value={formatNumber(stats.uploadImages)} />
        <SmallStat label="上传文件总数" value={formatNumber(stats.uploadFiles)} />
      </div>

      <section className="mt-3 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-[13px]">
          <thead className="bg-[#fafafa] text-[#777777]">
            <tr>
              <th className="w-[44px] border-b border-[#eeeeee] py-3 pl-6 pr-0 font-medium" />
              <th className="w-[135px] border-b border-[#eeeeee] py-3 pl-2 pr-3 font-medium">ID号</th>
              <th className="border-b border-[#eeeeee] px-3 py-3 font-medium">用户</th>
              <th className="w-[152px] border-b border-[#eeeeee] px-3 py-3 text-right font-medium">历史对话</th>
              <th className="w-[152px] border-b border-[#eeeeee] px-3 py-3 text-right font-medium">图片生成</th>
              <th className="w-[152px] border-b border-[#eeeeee] px-3 py-3 text-right font-medium">视频生成</th>
              <th className="w-[152px] border-b border-[#eeeeee] px-3 py-3 text-right font-medium">上传图片</th>
              <th className="w-[152px] border-b border-[#eeeeee] py-3 pl-3 pr-8 text-right font-medium">上传文件</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map(({ user, creditUser, imageGenerationCount, videoGenerationCount, uploadImageCount, uploadFileCount }) => {
              const isExpanded = expandedUserIds.has(user.id);
              const conversationImages = conversationUploadItems(creditUser, "image");
              const conversationFiles = conversationUploadItems(creditUser, "file");
              const assetImages = assetUploadItems(creditUser);
              const generatedConversationImages = workspaceConversationGeneratedItems(user, "image");
              const generatedConversationVideos = workspaceConversationGeneratedItems(user, "video");
              const generatedAssetImages = workspaceAssetGeneratedImageItems(user);
              return (
                <Fragment key={user.id}>
                  <tr onClick={() => toggleExpandedUser(user.id)} className="cursor-pointer text-[#333333] transition hover:bg-[#fcfcfc]">
                    <td className="border-b border-[#f2f2f2] py-3 pl-6 pr-0 text-left">
                      <button type="button" onClick={(event) => { event.stopPropagation(); toggleExpandedUser(user.id); }} className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] text-[#777777] transition hover:bg-[#f2f2f2] hover:text-[#111111]" aria-label={isExpanded ? "收起生成记录" : "展开生成记录"}>
                        {isExpanded ? <RiArrowDownSLine className="h-5 w-5" /> : <RiArrowRightSLine className="h-5 w-5" />}
                      </button>
                    </td>
                    <td className="border-b border-[#f2f2f2] py-3 pl-2 pr-3 font-mono text-[12px] text-[#777777]">{user.id}</td>
                    <td className="border-b border-[#f2f2f2] px-3 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-[#222222]">{user.email}</div>
                          <div className="mt-0.5 truncate text-[12px] text-[#888888]">{user.nickname || "未设置昵称"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-[#f2f2f2] px-3 py-3 text-right font-medium">{formatNumber(user.conversationCount)}</td>
                    <td className="border-b border-[#f2f2f2] px-3 py-3 text-right font-medium">{formatNumber(imageGenerationCount)}</td>
                    <td className="border-b border-[#f2f2f2] px-3 py-3 text-right font-medium">{formatNumber(videoGenerationCount)}</td>
                    <td className="border-b border-[#f2f2f2] px-3 py-3 text-right font-medium">{formatNumber(uploadImageCount)}</td>
                    <td className="border-b border-[#f2f2f2] py-3 pl-3 pr-8 text-right font-medium">{formatNumber(uploadFileCount)}</td>
                  </tr>
                  {isExpanded ? (
                    <tr className="bg-[#fbfbfb]">
                      <td colSpan={8} className="border-b border-[#f2f2f2] px-4 py-4">
                        <div className="grid grid-cols-4 gap-[5px] px-1 py-1 text-left">
                          <div className="space-y-px">
                            <DetailItem label="对话流图片" value={formatNumber(conversationImageCount(user))} onClick={() => setMediaDialog({ user, mediaType: "image" })} />
                            <DetailItem label="对话流视频" value={formatNumber(user.generatedVideoCount)} onClick={() => setMediaDialog({ user, mediaType: "video" })} />
                            <DetailItem label="资产库图片" value={formatNumber(user.assetMediaItems.length)} onClick={() => setMediaDialog({ user, mediaType: "asset_image" })} />
                            <DetailItem label="历史对话" value={formatNumber(user.conversationCount)} onClick={() => setHistoryUser(user)} />
                            <DetailItem label="工作区保存" value={user.workspaceSaved ? user.workspaceUpdatedAtLabel : "未保存"} />
                          </div>
                          <div className="space-y-px">
                            <DetailItem label="对话流生成图片列表" value={formatNumber(generatedConversationImages.length)} onClick={() => openGeneratedListDialog(user, creditUser, "conversation-generated-images")} />
                            <DetailItem label="对话流生成视频列表" value={formatNumber(generatedConversationVideos.length)} onClick={() => openGeneratedListDialog(user, creditUser, "conversation-generated-videos")} />
                            <DetailItem label="资产库生成图片列表" value={formatNumber(generatedAssetImages.length)} onClick={() => openGeneratedListDialog(user, creditUser, "asset-generated-images")} />
                          </div>
                          <div className="space-y-px">
                            <DetailItem label="对话流上传图片列表" value={formatNumber(conversationImages.length)} onClick={() => openUploadDialog(creditUser, "conversation-upload-images")} />
                            <DetailItem label="对话流上传文件列表" value={formatNumber(conversationFiles.length)} onClick={() => openUploadDialog(creditUser, "conversation-upload-files")} />
                            <DetailItem label="资产库上传图片列表" value={formatNumber(assetImages.length)} onClick={() => openUploadDialog(creditUser, "asset-upload-images")} />
                          </div>
                          <div className="space-y-px">
                            <DetailItem label="已消耗积分" value={creditUser ? `-${formatNumber(creditUser.consumedCredits)}` : "-0"} />
                            <DetailItem label="对话流消耗积分详细" value={creditUser ? `-${formatNumber(creditUser.conversationConsumedCredits)}` : "-0"} onClick={() => creditUser && setCreditFlowUser(creditUser)} />
                            <DetailItem label="资产库消耗积分详细" value={creditUser ? `-${formatNumber(creditUser.assetGenerationConsumedCredits)}` : "-0"} onClick={() => creditUser && setAssetCreditUser(creditUser)} />
                            <DetailItem label="反推/优化提示词消耗积分详细" value={creditUser ? `-${formatNumber(creditUser.promptToolConsumedCredits)}` : "-0"} onClick={() => creditUser && setPromptToolUser(creditUser)} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {pagedRows.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-[#999999]">暂无生成记录</td></tr> : null}
          </tbody>
        </table>
      </section>

      <div className="mt-4 flex min-w-[1180px] items-center justify-between px-1 py-1 text-[13px] text-[#777777]">
        <span>共 {formatNumber(filteredRows.length)} 条，当前显示 {rangeStart}-{rangeEnd} 条</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]"><span style={{ fontSize: 13 }}>上一页</span></button>
          <div className="min-w-[72px] text-center text-[#333333]">{safePage} / {totalPages}</div>
          <button type="button" disabled={safePage >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-8 rounded-[8px] border border-[#e7e7e7] bg-white px-3 text-[#555555] transition hover:border-[#367cee] hover:text-[#367cee] disabled:cursor-not-allowed disabled:text-[#c5c5c5] disabled:hover:border-[#e7e7e7]"><span style={{ fontSize: 13 }}>下一页</span></button>
        </div>
      </div>

      {historyUser ? <AdminHistoryDialog user={historyUser} onClose={() => setHistoryUser(null)} /> : null}
      {mediaDialog ? <AdminMediaDialog user={mediaDialog.user} mediaType={mediaDialog.mediaType} onClose={() => setMediaDialog(null)} /> : null}
      {creditFlowUser ? <CreditFlowDialog user={creditFlowUser} onClose={() => setCreditFlowUser(null)} /> : null}
      {assetCreditUser ? <CreditCategoryDialog title="资产库消耗积分详细" user={assetCreditUser} categories={assetCreditUser.assetGenerationCreditDetails} onClose={() => setAssetCreditUser(null)} /> : null}
      {promptToolUser ? <CreditCategoryDialog title="反推/优化提示词消耗积分详细" user={promptToolUser} categories={promptToolUser.promptToolCreditDetails} onClose={() => setPromptToolUser(null)} /> : null}
      {generatedListDialog ? <CreditCategoryDialog title="生成列表" user={generatedListDialog.user} categories={generatedListDialog.categories} initialCategoryId={generatedListDialog.initialCategoryId} showPromptCopyColumn onClose={() => setGeneratedListDialog(null)} /> : null}
      {uploadDialog ? <CreditCategoryDialog title="上传记录" user={uploadDialog.user} categories={uploadDialog.categories} initialCategoryId={uploadDialog.initialCategoryId} showPromptCopyColumn onClose={() => setUploadDialog(null)} /> : null}
    </>
  );
}
