"use client";

import { useState, useTransition } from "react";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, imageGenerationModels, models, videoGenerationModels } from "@/lib/models";
import type { AdminSystemSettings } from "@/lib/system-settings";
import { getUploadRule, type UploadKindRule, type UploadRule } from "@/lib/upload-rules";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { RiGoogleFill, RiOpenaiFill, RiTiktokFill } from "react-icons/ri";

const DEFAULT_ASSET_IMAGE_MODEL = "openai/gpt-5.4-image-2";

const extraModelLabels: Record<string, string> = {
  "openai/gpt-5.5": "GPT-5.5",
  "byteplus:chat.seed-2-0-pro": "BytePlus Seed 2.0 Pro",
  "byteplus:conversation-image.seedream-4-5": "BytePlus Seedream 4.5",
  "byteplus:conversation-image.seedream-5-0": "BytePlus Seedream 5.0 Lite",
  "byteplus:video.seedance-2-0-fast": "BytePlus Seedance 2.0 Fast",
  "byteplus:video.seedance-2-0": "BytePlus Seedance 2.0",
};

function getModelLabel(id: string) {
  return extraModelLabels[id] ?? models.find((model) => model.id === id)?.label ?? imageGenerationModels.find((model) => model.id === id)?.label ?? videoGenerationModels.find((model) => model.id === id)?.label ?? (id === DEFAULT_CHAT_MODEL ? "Seed 2.0 Lite" : id === ADVANCED_CHAT_MODEL ? "GPT-5.4" : id);
}

type ModelUsageItem = {
  badge: string;
  modelId: string;
  providerKey?: string;
  bytePlusOptions?: Array<{ label: string; endpointId: string }>;
  bytePlusStatic?: { label: string; endpointId: string };
};

type ModelUsageGroup = {
  title: string;
  note: string;
  models: ModelUsageItem[];
};

const bytePlusChatModels = [
  { label: "Seed 2.0 Lite", endpointId: "ep-20260518173102-9mtk6" },
  { label: "Seed 2.0 Pro", endpointId: "ep-20260514173614-jbcb4" },
  { label: "GLM-4.7", endpointId: "ep-20260514175234-9ssvl" },
];

const bytePlusImageModels = [
  { label: "Seedream 4.0", endpointId: "ep-20260515121509-mvr84" },
  { label: "Seedream 4.5", endpointId: "ep-20260514174622-n9qfb" },
  { label: "Seedream 5.0 Lite", endpointId: "ep-20260514142211-p2wdk" },
];

const bytePlusVideoModels = [
  { label: "Seedance 2.0 Fast", endpointId: "ep-20260521134040-vf2jf" },
  { label: "Seedance 2.0", endpointId: "ep-20260521133841-nn8bg" },
];

const agentBackupImageModelIds = imageGenerationModels
  .map((model) => model.id)
  .filter((modelId) => modelId !== DEFAULT_IMAGE_MODEL && modelId !== "openai/gpt-5.4-image-2");

const agentBackupVideoModelIds = videoGenerationModels
  .map((model) => model.id)
  .filter((modelId) => modelId !== DEFAULT_VIDEO_MODEL && modelId !== "bytedance/seedance-2.0");

function uniqueModelItems(items: ModelUsageItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.badge}:${item.modelId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getOpenRouterOnlyProviderKey(groupTitle: string, item: ModelUsageItem) {
  return item.providerKey ?? `openrouter-only:${groupTitle}:${item.badge}:${item.modelId}`;
}

const modelUsageGroups: ModelUsageGroup[] = [
  {
    title: "通用模式 / Agent 规划 / 意图识别",
    note: "通用模式使用这组对话模型；Seed 2.0 Lite 可在 OpenRouter 和 BytePlus 间互斥，BytePlus Seed 2.0 Pro 独立开关。",
    models: [
      { badge: "", modelId: DEFAULT_CHAT_MODEL, providerKey: "general.seed-2-0-lite", bytePlusStatic: bytePlusChatModels[0] },
      { badge: "独立", modelId: "", providerKey: "general.seed-2-0-pro", bytePlusStatic: bytePlusChatModels[1] },
      ...models.filter((model) => model.id !== DEFAULT_CHAT_MODEL).map((model) => ({ badge: "", modelId: model.id })),
    ],
  },
  {
    title: "对话 / Agent 规划 / 意图识别",
    note: "普通 Agent 默认用普通对话模型，高级 Agent 用高级对话模型。",
    models: [
      { badge: "普通", modelId: DEFAULT_CHAT_MODEL, providerKey: "chat.seed-2-0-lite", bytePlusOptions: bytePlusChatModels },
      { badge: "高级", modelId: ADVANCED_CHAT_MODEL, providerKey: "chat.advanced", bytePlusOptions: bytePlusChatModels },
    ],
  },
  {
    title: "反推提示词 / 优化提示词",
    note: "按顺序兜底，前一个失败再用下一个。",
    models: [
      { badge: "优先", modelId: "openai/gpt-5.5", providerKey: "prompt.priority", bytePlusOptions: bytePlusChatModels },
      { badge: "第二", modelId: ADVANCED_CHAT_MODEL, providerKey: "prompt.second", bytePlusOptions: bytePlusChatModels },
      { badge: "第三", modelId: DEFAULT_CHAT_MODEL, providerKey: "prompt.seed-2-0-lite", bytePlusOptions: bytePlusChatModels },
    ],
  },
  {
    title: "对话流图片生成",
    note: "图片生成专业模式使用。Agent 自动生图有单独策略。",
    models: [
      ...imageGenerationModels.map((model) => ({ badge: "", modelId: model.id, ...(model.id === "bytedance-seed/seedream-4.5" ? { providerKey: "conversation-image.seedream-4-5", bytePlusStatic: bytePlusImageModels[1] } : {}) })),
      { badge: "", modelId: "", providerKey: "conversation-image.seedream-5-0", bytePlusStatic: bytePlusImageModels[2] },
    ],
  },
  {
    title: "资产库图片生成",
    note: "角色 / 场景 / 分镜生成使用同一组图片模型，默认 GPT-5.4 Image 2。",
    models: [
      ...uniqueModelItems([DEFAULT_ASSET_IMAGE_MODEL, ...imageGenerationModels.map((model) => model.id)].map((modelId) => ({ badge: "", modelId, ...(modelId === "bytedance-seed/seedream-4.5" ? { providerKey: "asset-image.seedream-4-5", bytePlusStatic: bytePlusImageModels[1] } : {}) }))),
      { badge: "", modelId: "", providerKey: "asset-image.seedream-5-0", bytePlusStatic: bytePlusImageModels[2] },
    ],
  },
  {
    title: "对话流视频生成",
    note: "视频生成专业模式使用。Agent 自动生视频有单独策略。",
    models: videoGenerationModels.map((model) => ({ badge: "", modelId: model.id, ...(model.id === "bytedance/seedance-2.0-fast" ? { providerKey: "video.seedance-2-0-fast", bytePlusStatic: bytePlusVideoModels[0] } : model.id === "bytedance/seedance-2.0" ? { providerKey: "video.seedance-2-0", bytePlusStatic: bytePlusVideoModels[1] } : {}) })),
  },
  {
    title: "Agent 自动生成策略",
    note: "普通/高级 Agent 优先使用对应首选模型；首选不可用时，才使用下方已开启的备选图片或备选视频。",
    models: uniqueModelItems([
      { badge: "普通图片", modelId: DEFAULT_IMAGE_MODEL, providerKey: "agent-image.seedream-4-5", bytePlusStatic: bytePlusImageModels[1] },
      { badge: "高级图片", modelId: "openai/gpt-5.4-image-2" },
      { badge: "普通视频", modelId: DEFAULT_VIDEO_MODEL, providerKey: "agent-video.seedance-2-0-fast", bytePlusStatic: bytePlusVideoModels[0] },
      { badge: "高级视频", modelId: "bytedance/seedance-2.0", providerKey: "agent-video.seedance-2-0", bytePlusStatic: bytePlusVideoModels[1] },
      ...agentBackupImageModelIds.map((modelId) => ({ badge: "备选图片", modelId })),
      ...agentBackupVideoModelIds.map((modelId) => ({ badge: "备选视频", modelId })),
    ]),
  },
];

type UploadRuleRow = {
  scene: string;
  model: string;
  rule: UploadRule;
  note: string;
  incomplete?: Partial<Record<"image" | "document" | "video" | "audio", string>>;
};

const uploadRuleRows: UploadRuleRow[] = [
  {
    scene: "通用模式",
    model: "通用 Agent 规则",
    rule: getUploadRule({ mode: "general", transportMode: "local-base64" }),
    note: "用于通用问答、任务规划、看图理解和后续生图/生视频规划；当前入口允许图片和文档，不开放视频/音频上传。",
  },
  {
    scene: "Agent 模式",
    model: "通用安全规则",
    rule: getUploadRule({ mode: "agent", transportMode: "local-base64" }),
    note: "用于普通对话、规划、理解上传内容。",
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "OpenRouter 图片模型",
    rule: getUploadRule({ mode: "image", modelId: DEFAULT_IMAGE_MODEL, transportMode: "local-base64" }),
    note: "Seedream / Gemini / GPT 图片模型统一保守限制；GPT-5.4 Image 2 额外允许 1 个文件。",
    incomplete: { document: "GPT 文件输入未做实；当前文档仅读取文本拼入提示词。" },
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "BytePlus 图片模型（本地测试）",
    rule: getUploadRule({ mode: "image", modelId: "byteplus:conversation-image.seedream-4-5", transportMode: "local-base64" }),
    note: "当前本地继续 Base64 打包测试，先限制 6 张。",
    incomplete: { image: "特殊格式 heic/heif/tiff/bmp/gif 仅规则记录，浏览器预览未完整做实。" },
  },
  {
    scene: "对话流图片 / 资产库图片",
    model: "BytePlus 图片模型（服务器 URL）",
    rule: getUploadRule({ mode: "image", modelId: "byteplus:conversation-image.seedream-4-5", transportMode: "server-url" }),
    note: "部署到公网服务器后，上传文件生成服务器 URL，可按官方 14 张上限。",
    incomplete: { image: "服务器 URL 传模型链路未做实。" },
  },
  {
    scene: "对话流视频",
    model: "OpenRouter Seedance 视频",
    rule: getUploadRule({ mode: "video", modelId: "bytedance/seedance-2.0-fast", transportMode: "local-base64" }),
    note: "当前仅开放图片参考。",
  },
  {
    scene: "对话流视频",
    model: "OpenRouter Kling / Veo",
    rule: getUploadRule({ mode: "video", modelId: "kwaivgi/kling-v3.0-std", transportMode: "local-base64" }),
    note: "Kling 和 Veo 统一保守限制，当前仅开放图片参考。",
  },
  {
    scene: "对话流视频",
    model: "BytePlus Seedance 2.0 系列",
    rule: getUploadRule({ mode: "video", modelId: "byteplus:video.seedance-2-0", transportMode: "server-url" }),
    note: "视频/音频参考需要服务器公网 URL；本地环境会提示暂不支持。",
    incomplete: { video: "参考视频上传未做实。", audio: "参考音频上传未做实。" },
  },
];

function formatKindRule(rule: UploadKindRule, label: string) {
  if (!rule.enabled) return "不支持";
  const parts = [`最多${rule.maxCount}${label}`];
  if (rule.maxSizeMb > 0) parts.push(`单个≤${rule.maxSizeMb}MB`);
  if (rule.minSeconds !== undefined && rule.maxSeconds !== undefined) parts.push(`${rule.minSeconds}-${rule.maxSeconds}秒`);
  if (rule.maxTotalSeconds !== undefined) parts.push(`总≤${rule.maxTotalSeconds}秒`);
  if (rule.requiresServerUrl) parts.push("需服务器URL");
  parts.push(rule.formats.join("/"));
  return parts.join("，");
}

function UploadRuleCell({ rule, label, incomplete }: { rule: UploadKindRule; label: string; incomplete?: string }) {
  return (
    <div className="break-words px-4 py-3">
      <div>{formatKindRule(rule, label)}</div>
      {incomplete ? <div className="mt-1 text-[12px] leading-5 text-red-500">{incomplete}</div> : null}
    </div>
  );
}

function AiGenerate3dIcon({ className = "h-4 w-4 shrink-0 text-[#555555]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M15.1416 2.81836L13.1016 3.94824L12 3.31055L4.5 7.65234V7.6582L12 12V20.6895L19.5 16.3467V11.5L21.5 10.3291V17.5L12 23L2.5 17.5V6.5L12 1L15.1416 2.81836ZM18.5293 2.31934C18.7059 1.8935 19.2943 1.89349 19.4707 2.31934L19.7236 2.93066C20.1556 3.97346 20.9615 4.80618 21.9746 5.25684L22.6924 5.57617C23.1026 5.75901 23.1026 6.3562 22.6924 6.53906L21.9326 6.87695C20.9449 7.31624 20.1534 8.11944 19.7139 9.12793L19.4668 9.69336C19.2864 10.1075 18.7137 10.1075 18.5332 9.69336L18.2871 9.12793C17.8476 8.11929 17.0552 7.31628 16.0674 6.87695L15.3076 6.53906C14.8974 6.35622 14.8974 5.75899 15.3076 5.57617L16.0254 5.25684C17.0385 4.80618 17.8445 3.97348 18.2764 2.93066L18.5293 2.31934Z" />
    </svg>
  );
}

function DeepSeekIcon({ className = "h-4 w-4 shrink-0 text-[#555555]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M19.7486 6.70266C20.3482 6.09168 21.0251 5.88487 21.8216 5.88487 22.4994 5.88487 22.8772 5.51788 23.1687 5.23481 23.3841 5.0256 23.5423 4.86223 23.7495 4.9267 23.9849 4.99995 24.0039 5.27202 23.9849 5.49211 23.8092 7.48319 22.5352 9.10375 20.5089 9.33432 20.3217 9.35326 20.2848 9.41777 20.2886 9.58097 20.2886 12.135 19.3023 14.3682 17.7413 16.3177 17.3773 16.7723 17.4617 17.397 18.0099 17.5934 18.2913 17.6942 18.6306 17.8197 19.0629 18.0261 19.3173 18.1475 19.3664 18.8022 18.6619 18.952 18.2141 19.0446 17.728 19.1012 17.2409 19.0989 16.0407 19.0932 14.7567 19.2619 13.6741 19.7802 12.5444 20.3211 11.5023 20.4276 10.5351 20.4832 6.05234 20.7487 1.91959 17.3891 1.14577 12.9829.4786 9.18832 2.57147 5.07162 6.66325 4.61173 7.14737 4.55719 7.62089 4.53981 8.0848 4.55739 8.87454 4.58733 9.6213 4.41281 10.366 4.23877 11.0506 4.07878 11.7335 3.9192 12.4464 3.9192 13.289 3.9192 13.4518 4.23796 13.1926 4.33093 12.9459 4.42011 12.0002 5.5 12.8219 6.09927 13.5751 6.5753 14.217 7.22865 14.859 7.88213 15.7004 8.73861 16.542 9.59533 17.6349 10.0534 17.8183 10.1293 17.8968 10.0914 17.9488 9.91865 17.984 9.80487 18.021 9.69242 18.0579 9.58018 18.1084 9.42668 18.1588 9.27358 18.2041 9.11798 18.2458 8.98703 18.2118 8.896 18.0803 8.80682 16.5019 7.7348 15.7807 5.49544 16.7241 3.7693 16.9257 3.40591 17.2152 3.45676 17.3454 3.8414 17.5002 4.5 17.6793 4.81997 18.5532 5.2113 19.1972 5.4997 19.6209 5.94937 19.7486 6.70266ZM12.2889 8.15848C10.7532 7.02012 8.79874 6.38384 6.88727 6.59919 5.50456 6.7546 4.48708 7.51265 3.84434 8.54596 4.06732 8.56243 4.31508 8.58934 4.58987 8.62966 6.85894 8.96265 8.79097 9.98777 10.3898 11.5802 11.3587 12.5454 12.1238 13.6898 12.8253 14.6671 13.4051 15.4748 13.9559 16.1921 14.5951 16.7793 15.8396 15.7081 16.6794 14.4169 17.0503 13.8 17.8977 12.3908 17.6928 12.2942 16.853 11.898 16.316 11.6446 15.5193 11.2687 14.5722 10.3488 13.5602 9.36588 13.0771 8.7451 12.2889 8.15848ZM3.11574 12.637C3.70717 16 6.70788 18.473 10.417 18.4867 11.3223 18.4901 12.1492 18.2666 12.8906 17.9119 12.2402 17.2517 11.6978 16.526 11.2006 15.8333 10.4412 14.7753 9.79818 13.8139 8.97846 12.9972 7.66251 11.6866 6.11607 10.8751 4.29954 10.6085 3.72541 10.5242 3.34242 10.5175 3.11076 10.5295 2.99297 11.2236 2.99407 11.9452 3.11574 12.637ZM15.1938 11.1427C14.7189 10.6785 13.9006 9.95702 13.1369 10.3762 12.0002 11 14.354 13.4813 15.472 13.4291 17.254 13.3458 15.7214 11.7533 15.1938 11.1427Z" />
    </svg>
  );
}

function SettingSwitch({ checked, disabled, onChange, ariaLabel }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-[#367cee]" : "bg-[#d8d8d8]"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function ModelIcon({ modelId }: { modelId: string }) {
  if (modelId.startsWith("byteplus:")) return <BytePlusIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />;
  if (modelId.startsWith("deepseek/")) return <DeepSeekIcon />;
  if (modelId.startsWith("openai/")) return <RiOpenaiFill className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />;
  if (modelId.startsWith("google/")) return <RiGoogleFill className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />;
  if (modelId.startsWith("bytedance/") || modelId.startsWith("bytedance-seed/")) return <RiTiktokFill className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />;
  return <AiGenerate3dIcon />;
}

function ProviderSwitch({ checked, disabled, onChange, ariaLabel }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void; ariaLabel: string }) {
  return <SettingSwitch checked={checked} disabled={disabled} onChange={onChange} ariaLabel={ariaLabel} />;
}

function OpenRouterModelTag({ item, checked, onToggle }: { item: ModelUsageItem; checked: boolean; onToggle: (checked: boolean) => void }) {
  if (!item.modelId) return <span className="inline-flex h-8 w-full rounded-[7px] bg-[#f4f6fb]" />;
  return (
    <span className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <ModelIcon modelId={item.modelId} />
        <span className="min-w-0 truncate font-medium">{getModelLabel(item.modelId)}</span>
      </span>
      <ProviderSwitch checked={checked} onChange={onToggle} ariaLabel="启用 OpenRouter" />
    </span>
  );
}

function BytePlusModelTag({ item, selectedEndpointId, selectedProvider, onToggle, onChange }: { item: ModelUsageItem; selectedEndpointId: string; selectedProvider: "openrouter" | "byteplus"; onToggle: (checked: boolean) => void; onChange: (endpointId: string) => void }) {
  if (!item.bytePlusOptions?.length && !item.bytePlusStatic) return <span className="inline-flex h-8 w-full rounded-[7px] bg-[#f4f6fb]" />;
  if (item.bytePlusStatic) {
    return (
      <span className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
        <BytePlusIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium">{item.bytePlusStatic.label}</span>
        <ProviderSwitch checked={selectedProvider === "byteplus"} onChange={onToggle} ariaLabel="启用 BytePlus" />
      </span>
    );
  }
  const bytePlusOptions = item.bytePlusOptions ?? [];
  const selectedOption = bytePlusOptions.find((option) => option.endpointId === selectedEndpointId) ?? bytePlusOptions[0];
  const isBytePlusSelected = selectedProvider === "byteplus";

  return (
    <span className="inline-flex h-8 w-full items-center gap-2 rounded-[7px] bg-[#f4f6fb] px-2.5 text-[12px] text-[#333333]">
      <BytePlusIcon className="h-4 w-4 shrink-0 text-[#555555]" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate font-medium">{selectedOption.label}</span>
      <select value={selectedOption.endpointId} disabled={isBytePlusSelected} onChange={(event) => onChange(event.target.value)} className="h-6 w-[128px] rounded-[6px] border border-[#e3e5eb] bg-white px-2 text-[12px] text-[#555555] outline-none disabled:cursor-not-allowed disabled:bg-[#eeeeee] disabled:text-[#999999]">
        {bytePlusOptions.map((option) => <option key={option.endpointId} value={option.endpointId}>{option.label}</option>)}
      </select>
      <ProviderSwitch checked={isBytePlusSelected} onChange={onToggle} ariaLabel="启用 BytePlus" />
    </span>
  );
}

export function AdminSystemSettingsPanel({ settings, adminEmailCount }: { settings: AdminSystemSettings; adminEmailCount: number }) {
  const [apiKeyInput, setApiKeyInput] = useState(settings.openRouterApiKey);
  const [enabled, setEnabled] = useState(settings.openRouterApiKeyEnabled);
  const [bytePlusApiKeyInput, setBytePlusApiKeyInput] = useState(settings.bytePlusApiKey);
  const [bytePlusEnabled, setBytePlusEnabled] = useState(settings.bytePlusApiKeyEnabled);
  const [bytePlusUnlockLimits, setBytePlusUnlockLimits] = useState(settings.bytePlusUnlockLimits);
  const [bytePlusRegion, setBytePlusRegion] = useState<"ap-southeast-1" | "eu-west-1">(settings.bytePlusRegion);
  const [modelProviderPreferences, setModelProviderPreferences] = useState(settings.modelProviderPreferences);
  const [bytePlusModelSelections, setBytePlusModelSelections] = useState(settings.bytePlusModelSelections);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const saveSettings = (nextSettings?: Partial<AdminSystemSettings>) => {
    const nextOpenRouterKey = nextSettings?.openRouterApiKey ?? apiKeyInput.trim();
    const nextOpenRouterEnabled = nextSettings?.openRouterApiKeyEnabled ?? enabled;
    const nextBytePlusKey = nextSettings?.bytePlusApiKey ?? bytePlusApiKeyInput.trim();
    const nextBytePlusEnabled = nextSettings?.bytePlusApiKeyEnabled ?? bytePlusEnabled;
    const nextBytePlusUnlockLimits = nextSettings?.bytePlusUnlockLimits ?? bytePlusUnlockLimits;
    const nextBytePlusRegion = nextSettings?.bytePlusRegion ?? bytePlusRegion;
    const nextModelProviderPreferences = nextSettings?.modelProviderPreferences ?? modelProviderPreferences;
    const nextBytePlusModelSelections = nextSettings?.bytePlusModelSelections ?? bytePlusModelSelections;
    if (nextOpenRouterEnabled && !nextOpenRouterKey) {
      setMessage("请输入 OpenRouter API Key");
      return;
    }
    if (nextBytePlusEnabled && !nextBytePlusKey) {
      setMessage("请输入 BytePlus API Key");
      return;
    }

    setEnabled(nextOpenRouterEnabled);
    setBytePlusEnabled(nextBytePlusEnabled);
    setBytePlusUnlockLimits(nextBytePlusUnlockLimits);
    setBytePlusRegion(nextBytePlusRegion);
    setModelProviderPreferences(nextModelProviderPreferences);
    setBytePlusModelSelections(nextBytePlusModelSelections);
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/admin/api/system-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openRouterApiKey: nextOpenRouterKey, openRouterApiKeyEnabled: nextOpenRouterEnabled, bytePlusApiKey: nextBytePlusKey, bytePlusApiKeyEnabled: nextBytePlusEnabled, bytePlusUnlockLimits: nextBytePlusUnlockLimits, bytePlusRegion: nextBytePlusRegion, modelProviderPreferences: nextModelProviderPreferences, bytePlusModelSelections: nextBytePlusModelSelections }),
        });
        const data = (await response.json().catch(() => ({}))) as { error?: string; settings?: AdminSystemSettings };
        if (!response.ok || !data.settings) throw new Error(data.error || "保存失败");
        setApiKeyInput(data.settings.openRouterApiKey);
        setEnabled(data.settings.openRouterApiKeyEnabled);
        setBytePlusApiKeyInput(data.settings.bytePlusApiKey);
        setBytePlusEnabled(data.settings.bytePlusApiKeyEnabled);
        setBytePlusUnlockLimits(data.settings.bytePlusUnlockLimits);
        setBytePlusRegion(data.settings.bytePlusRegion);
        setModelProviderPreferences(data.settings.modelProviderPreferences);
        setBytePlusModelSelections(data.settings.bytePlusModelSelections);
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  const updateProvider = (key: string, provider: "openrouter" | "byteplus") => {
    const next: Record<string, "openrouter" | "byteplus"> = { ...modelProviderPreferences, [key]: provider };
    saveSettings({ modelProviderPreferences: next });
  };

  const updateOpenRouterOnlyProvider = (key: string, checked: boolean) => {
    const next: Record<string, "openrouter" | "byteplus"> = { ...modelProviderPreferences, [key]: checked ? "openrouter" : "byteplus" };
    saveSettings({ modelProviderPreferences: next });
  };

  const updateBytePlusModel = (key: string, endpointId: string) => {
    const next = { ...bytePlusModelSelections, [key]: endpointId };
    saveSettings({ bytePlusModelSelections: next });
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[24px] font-semibold tracking-[-0.03em]">系统设置</h1>
        <div className="text-[13px] text-[#777777]">管理员白名单：{adminEmailCount} 个邮箱</div>
      </div>

      <section className="min-w-[1090px]">
        <div className="grid w-[1090px] grid-cols-[620px_450px] items-start gap-5">
        <div className="flex w-full flex-col gap-1 text-[12px] text-[#777777]">
          <div className="flex items-center gap-2">
            <span>OpenRouter API</span>
            <SettingSwitch checked={enabled} disabled={isPending} onChange={(value) => saveSettings({ openRouterApiKeyEnabled: value })} ariaLabel="OpenRouter API 开关" />
          </div>
          <div className="relative">
            <input
              type="text"
              value={apiKeyInput}
              disabled={enabled || isPending}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder="请输入 OpenRouter API Key"
              className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white py-0 pl-3 pr-20 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
            />
            <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${enabled ? "text-[#367cee]" : "text-[#999999]"}`}>{enabled ? "已启用" : "已关闭"}</span>
          </div>
        </div>
        <div className="flex w-full flex-col gap-1 text-[12px] text-[#777777]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2">
              <span>BytePlus API</span>
              <SettingSwitch checked={bytePlusEnabled} disabled={isPending} onChange={(value) => saveSettings({ bytePlusApiKeyEnabled: value })} ariaLabel="BytePlus API 开关" />
            </span>
            <span className="inline-flex items-center gap-2">
              <span>解除限制</span>
              <SettingSwitch checked={bytePlusUnlockLimits} disabled={isPending} onChange={(value) => saveSettings({ bytePlusUnlockLimits: value })} ariaLabel="BytePlus 解除限制开关" />
            </span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={bytePlusApiKeyInput}
              disabled={bytePlusEnabled || isPending}
              onChange={(event) => setBytePlusApiKeyInput(event.target.value)}
              placeholder="请输入 BytePlus API Key"
              className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white py-0 pl-3 pr-20 text-[13px] text-[#222222] outline-none transition focus:border-[#367cee] disabled:bg-[#f3f3f3] disabled:text-[#999999]"
            />
            <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] ${bytePlusEnabled ? "text-[#367cee]" : "text-[#999999]"}`}>{bytePlusEnabled ? "已启用" : "已关闭"}</span>
          </div>
        </div>
        </div>
        {message ? <div className={`mt-2 text-[12px] ${message.includes("失败") || message.includes("请输入") ? "text-red-500" : "text-[#367cee]"}`}>{message}</div> : null}
      </section>

      <section className="mt-8 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="grid grid-cols-[260px_360px_70px_360px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] text-[#777777]">
          <div className="px-5 py-3 font-medium">使用位置</div>
          <div className="px-5 py-3 font-medium">OpenRouter</div>
          <div className="px-2 py-3 text-center font-medium">说明</div>
          <div className="px-5 py-3 font-medium">BytePlus</div>
        </div>
        {modelUsageGroups.map((group) => (
          <div key={group.title} className="grid grid-cols-[260px_360px_70px_360px] border-b border-[#f2f2f2] last:border-b-0">
            <div className="px-5 py-4">
              <div className="font-medium text-[#222222]">{group.title}</div>
              <div className="mt-1 text-[12px] leading-5 text-[#888888]">{group.note}</div>
            </div>
            <div className="flex flex-col gap-2 px-5 py-4">
              {group.models.map((model) => {
                const providerKey = getOpenRouterOnlyProviderKey(group.title, model);
                const checked = model.providerKey ? modelProviderPreferences[model.providerKey] !== "byteplus" : modelProviderPreferences[providerKey] !== "byteplus";
                return <OpenRouterModelTag key={`${group.title}-${model.badge}-${model.modelId}`} item={model} checked={checked} onToggle={(value) => model.providerKey ? updateProvider(model.providerKey, value ? "openrouter" : "byteplus") : updateOpenRouterOnlyProvider(providerKey, value)} />;
              })}
            </div>
            <div className="flex flex-col gap-2 px-2 py-4">
              {group.models.map((model) => <span key={`${group.title}-${model.badge}-${model.modelId}-badge`} className="flex h-8 items-center justify-center text-[12px] text-[#888888]">{model.badge}</span>)}
            </div>
            <div className="flex flex-col gap-2 px-5 py-4">
              {group.models.map((model) => <BytePlusModelTag key={`${group.title}-${model.badge}-${model.modelId}`} item={model} selectedEndpointId={model.providerKey ? bytePlusModelSelections[model.providerKey] : ""} selectedProvider={model.providerKey ? modelProviderPreferences[model.providerKey] ?? "openrouter" : "openrouter"} onToggle={(value) => model.providerKey && updateProvider(model.providerKey, value ? "byteplus" : "openrouter")} onChange={(endpointId) => model.providerKey && updateBytePlusModel(model.providerKey, endpointId)} />)}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 min-w-[1180px] overflow-hidden rounded-[10px] border border-[#eeeeee] bg-white text-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
        <div className="border-b border-[#eeeeee] bg-[#fafafa] px-5 py-4">
          <div className="text-[15px] font-medium text-[#222222]">上传规则</div>
          <div className="mt-1 text-[12px] leading-5 text-[#888888]">对话流生成和资产库生成共用同一套规则；上传图片和 @资产引用都会计入参考图数量。</div>
        </div>
        <div className="grid grid-cols-[210px_170px_240px_150px_220px_180px] border-b border-[#eeeeee] bg-[#fafafa] text-[12px] font-medium text-[#777777]">
          <div className="px-4 py-3">使用场景</div>
          <div className="px-4 py-3">模型范围</div>
          <div className="px-4 py-3">图片</div>
          <div className="px-4 py-3">文件</div>
          <div className="px-4 py-3">视频</div>
          <div className="px-4 py-3">音频</div>
        </div>
        {uploadRuleRows.map((row) => (
          <div key={`${row.scene}-${row.model}`} className="grid grid-cols-[210px_170px_240px_150px_220px_180px] border-b border-[#f2f2f2] text-[12px] leading-5 text-[#444444] last:border-b-0">
            <div className="px-4 py-3">
              <div className="font-medium text-[#222222]">{row.scene}</div>
              <div className="mt-1 text-[12px] leading-5 text-[#888888]">{row.note}</div>
            </div>
            <div className="break-words px-4 py-3 text-[#333333]">{row.model}</div>
            <UploadRuleCell rule={row.rule.image} label="张" incomplete={row.incomplete?.image} />
            <UploadRuleCell rule={row.rule.document} label="个" incomplete={row.incomplete?.document} />
            <UploadRuleCell rule={row.rule.video} label="个" incomplete={row.incomplete?.video} />
            <UploadRuleCell rule={row.rule.audio} label="个" incomplete={row.incomplete?.audio} />
          </div>
        ))}
      </section>

    </>
  );
}
