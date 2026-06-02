"use client";

import { useState, useTransition } from "react";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, DEFAULT_VIDEO_MODEL, imageGenerationModels, videoGenerationModels } from "@/lib/models";
import type { AdminSystemSettings } from "@/lib/system-settings";
import { BytePlusIcon } from "@/components/byteplus-icon";
import { RiGoogleFill, RiOpenaiFill, RiTiktokFill } from "react-icons/ri";

const DEFAULT_ASSET_IMAGE_MODEL = "openai/gpt-5.4-image-2";

const extraModelLabels: Record<string, string> = {
  "openai/gpt-5.5": "GPT-5.5",
};

function getModelLabel(id: string) {
  return extraModelLabels[id] ?? imageGenerationModels.find((model) => model.id === id)?.label ?? videoGenerationModels.find((model) => model.id === id)?.label ?? (id === DEFAULT_CHAT_MODEL ? "Seed 2.0 Lite" : id === ADVANCED_CHAT_MODEL ? "GPT-5.4" : id);
}

type ModelUsageItem = {
  badge: string;
  modelId: string;
  providerKey?: string;
  bytePlusOptions?: Array<{ label: string; endpointId: string }>;
  bytePlusStatic?: { label: string; endpointId: string };
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

const modelUsageGroups = [
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
    note: "图片生成模式和 Agent 自动生图都会用到。",
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
    note: "视频生成模式和 Agent 自动生视频都会用到。",
    models: videoGenerationModels.map((model) => ({ badge: "", modelId: model.id, ...(model.id === "bytedance/seedance-2.0-fast" ? { providerKey: "video.seedance-2-0-fast", bytePlusStatic: bytePlusVideoModels[0] } : model.id === "bytedance/seedance-2.0" ? { providerKey: "video.seedance-2-0", bytePlusStatic: bytePlusVideoModels[1] } : {}) })),
  },
  {
    title: "Agent 自动生成策略",
    note: "普通默认低成本；多次不满意或明确 4K 时会切换到更高规格模型。",
    models: uniqueModelItems([
      { badge: "默认图片", modelId: DEFAULT_IMAGE_MODEL, providerKey: "agent-image.seedream-4-5", bytePlusStatic: bytePlusImageModels[1] },
      { badge: "高质图片", modelId: "openai/gpt-5.4-image-2" },
      { badge: "快速图片", modelId: "google/gemini-3.1-flash-image-preview" },
      { badge: "默认视频", modelId: DEFAULT_VIDEO_MODEL, providerKey: "agent-video.seedance-2-0-fast", bytePlusStatic: bytePlusVideoModels[0] },
      { badge: "高质视频", modelId: "bytedance/seedance-2.0", providerKey: "agent-video.seedance-2-0", bytePlusStatic: bytePlusVideoModels[1] },
      { badge: "4K视频", modelId: "google/veo-3.1" },
    ]),
  },
];

function AiGenerate3dIcon({ className = "h-4 w-4 shrink-0 text-[#555555]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M15.1416 2.81836L13.1016 3.94824L12 3.31055L4.5 7.65234V7.6582L12 12V20.6895L19.5 16.3467V11.5L21.5 10.3291V17.5L12 23L2.5 17.5V6.5L12 1L15.1416 2.81836ZM18.5293 2.31934C18.7059 1.8935 19.2943 1.89349 19.4707 2.31934L19.7236 2.93066C20.1556 3.97346 20.9615 4.80618 21.9746 5.25684L22.6924 5.57617C23.1026 5.75901 23.1026 6.3562 22.6924 6.53906L21.9326 6.87695C20.9449 7.31624 20.1534 8.11944 19.7139 9.12793L19.4668 9.69336C19.2864 10.1075 18.7137 10.1075 18.5332 9.69336L18.2871 9.12793C17.8476 8.11929 17.0552 7.31628 16.0674 6.87695L15.3076 6.53906C14.8974 6.35622 14.8974 5.75899 15.3076 5.57617L16.0254 5.25684C17.0385 4.80618 17.8445 3.97348 18.2764 2.93066L18.5293 2.31934Z" />
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

    </>
  );
}
