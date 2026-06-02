import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { promisify } from "node:util";
import type { ConversationModel, ModelName } from "@/lib/models";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, getExpectedImageDimensions, getImageModelRule, models, resolveImageSettingsForModel } from "@/lib/models";
import { getLocalImageDimensions, saveGeneratedAsset, type ImageDimensions } from "@/lib/local-assets";
import { toUserErrorMessage } from "@/lib/error-message";
import { getBytePlusBaseUrl, getBytePlusModelForRequest, getConfiguredBytePlusApiKey, getConfiguredOpenRouterApiKey, getModelProviderPreference, isTextModelEnabled } from "@/lib/system-settings";

export type ChatRequest = {
  model: ModelName;
  mode: "agent" | "chat" | "image" | "video";
  messages: Array<{ role: "user" | "assistant"; content: string; images?: string[] }>;
  originalPrompt?: string;
  settings?: {
    ratio?: string;
    resolution?: string;
    style?: string;
    duration?: string;
  };
};

export type IntentClassification = {
  intent: "agent" | "image" | "video" | "prompt" | "clarify";
  confidence: number;
  reason: string;
  usage?: UsageMeta;
};

export type UsageMeta = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  usd?: number;
};

export type AgentReplyIntent = "chat" | "film_knowledge" | "creative_consult" | "creative_structure" | "off_topic";
export type AssetTargetType = "character_image" | "scene_image" | "shot_image" | "shot_video" | "other";
export type SuggestionItem = {
  label: string;
  action?: string;
  assetTargetType?: AssetTargetType;
};
type SuggestionInput = string | SuggestionItem;

export type ChatResponse = {
  content: string;
  model?: string;
  intent?: AgentReplyIntent;
  suggestions?: SuggestionItem[];
  usage?: UsageMeta;
};

export type AgentPlan = {
  intent: "chat" | "image" | "video" | "clarify";
  needsClarification: boolean;
  clarifyQuestion?: string;
  displayText?: string;
  count?: number;
  subject?: string;
  quality?: "low" | "standard" | "high";
  ratio?: string;
  resolution?: string;
  duration?: string;
  prompt?: string;
  constraints?: string[];
  items?: Array<{ index?: number; prompt?: string; constraints?: string[]; duration?: string }>;
  suggestions?: SuggestionItem[];
  usage?: UsageMeta;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const execFileAsync = promisify(execFile);
const CHINA_MODEL_PREFIXES = [
  "qwen/",
  "deepseek/",
  "bytedance-seed/",
];
const MODELS_PER_PROVIDER = 3;

function getProviderId(modelId: string) {
  return modelId.split("/")[0] ?? modelId;
}

type OpenRouterImage = {
  image_url?: { url?: string };
  url?: string;
};

type OpenRouterChatCompletionResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    native_finish_reason?: string;
    message?: {
      content?: string;
      images?: OpenRouterImage[];
      refusal?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: number | string;
  };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
  };
  images?: Array<{ image_url?: { url?: string }; url?: string }>;
  data?: Array<{ url?: string; b64_json?: string }>;
};

type BytePlusImageGenerationResponse = {
  id?: string;
  model?: string;
  created?: number;
  data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string; size?: string; error?: { message?: string; code?: number | string } }>;
  error?: { message?: string; code?: number | string };
  usage?: {
    generated_images?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cost?: number;
    usd?: number;
  };
};

type OpenRouterMessageContent = string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type OpenRouterErrorResponse = {
  error?: {
    message?: string;
    code?: number | string;
  };
};

type OpenRouterModelResponse = {
  data?: Array<{
    id?: string;
    name?: string;
    pricing?: {
      prompt?: string;
      completion?: string;
    };
    architecture?: {
      modality?: string;
    };
  }>;
};

type StructuredAgentReply = {
  content?: string;
  intent?: AgentReplyIntent;
  suggestions?: SuggestionInput[];
};

const agentReplyIntents: AgentReplyIntent[] = ["chat", "film_knowledge", "creative_consult", "creative_structure", "off_topic"];

const assetTargetTypes: AssetTargetType[] = ["character_image", "scene_image", "shot_image", "shot_video", "other"];
const fallbackAgentSuggestions: SuggestionInput[] = ["让我写一个短剧故事", "讲讲电影是怎么做出来的", { label: "帮我拆一版分镜", assetTargetType: "shot_image" }];
let modelPricingCache: { expiresAt: number; prices: Record<string, { prompt: number; completion: number }> } | null = null;

const bytePlusTextPricing: Record<string, { prompt: number; completion: number; tiered?: boolean }> = {
  "seed-2-0-lite-260428": { prompt: 0.25, completion: 2, tiered: true },
  "ep-20260518173102-9mtk6": { prompt: 0.25, completion: 2, tiered: true },
  "seed-2-0-pro-260328": { prompt: 0.5, completion: 3, tiered: true },
  "ep-20260514173614-jbcb4": { prompt: 0.5, completion: 3, tiered: true },
  "glm-4-7-251222": { prompt: 0.6, completion: 2.2 },
  "ep-20260514175234-9ssvl": { prompt: 0.6, completion: 2.2 },
};

const bytePlusImagePricePerOutput: Record<string, number> = {
  "seedream-4-5-251128": 0.04,
  "ep-20260514174622-n9qfb": 0.04,
  "seedream-5-0-260128": 0.035,
  "ep-20260514142211-p2wdk": 0.035,
};

function getBytePlusTextUsageUsd(model: string | undefined, promptTokens: number, completionTokens: number) {
  const price = model ? bytePlusTextPricing[model] : undefined;
  if (!price) return undefined;
  const multiplier = price.tiered && promptTokens > 128_000 ? 2 : 1;
  return (promptTokens / 1_000_000) * price.prompt * multiplier + (completionTokens / 1_000_000) * price.completion * multiplier;
}

function getOpenRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "FlashMuse",
  };
}

function getCurlCommand() {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function toCurlHeaderArgs(headers: Record<string, string>) {
  return Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]);
}

async function curlPostJson<T>(url: string, headers: Record<string, string>, body: unknown, fallback: string) {
  const bodyPath = join(tmpdir(), `yinzao-openrouter-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);

  await writeFile(bodyPath, JSON.stringify(body));

  try {
    const { stdout } = await execFileAsync(
      getCurlCommand(),
      ["-sS", "-L", "-X", "POST", ...toCurlHeaderArgs(headers), "--data-binary", `@${bodyPath}`, "-w", "\n%{http_code}", url],
      { encoding: "utf8", maxBuffer: 120 * 1024 * 1024 },
    );
    const separatorIndex = stdout.lastIndexOf("\n");
    const text = separatorIndex >= 0 ? stdout.slice(0, separatorIndex) : stdout;
    const status = Number(separatorIndex >= 0 ? stdout.slice(separatorIndex + 1).trim() : 0);

    if (status < 200 || status >= 300) {
      try {
        const data = JSON.parse(text) as OpenRouterErrorResponse;
          throw new Error(`${fallback}：${toUserErrorMessage(data.error?.message ?? text)}`);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith(fallback)) throw error;
          throw new Error(`${fallback}：${toUserErrorMessage(text)}`);
        }
    }

    return JSON.parse(text) as T;
  } finally {
    await unlink(bodyPath).catch(() => undefined);
  }
}

function getOpenRouterApiKey() {
  return getConfiguredOpenRouterApiKey();
}

function getBytePlusHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function getBytePlusImageModelName(modelId: string, providerKey?: string) {
  if ((modelId === "byteplus:conversation-image.seedream-4-5" || modelId === "byteplus:conversation-image.seedream-5-0") && providerKey) return getBytePlusModelForRequest(providerKey);
  if (modelId === "byteplus:conversation-image.seedream-4-5") return getBytePlusModelForRequest("conversation-image.seedream-4-5");
  if (modelId === "byteplus:conversation-image.seedream-5-0") return getBytePlusModelForRequest("conversation-image.seedream-5-0");
  return undefined;
}

function supportsBytePlusImageOutputFormat(modelName: string) {
  return modelName === "seedream-5-0-260128" || modelName === "ep-20260514142211-p2wdk";
}

function getTextProviderKey(model: string, mode?: ChatRequest["mode"]) {
  if (model === DEFAULT_CHAT_MODEL) return mode === "image" || mode === "video" ? "prompt.seed-2-0-lite" : "chat.seed-2-0-lite";
  if (model === ADVANCED_CHAT_MODEL) return mode === "image" || mode === "video" ? "prompt.second" : "chat.advanced";
  if (model === "openai/gpt-5.5") return "prompt.priority";
  return undefined;
}

function getTextProviderConfig(model: string, mode?: ChatRequest["mode"]) {
  const providerKey = getTextProviderKey(model, mode);
  const source = mode === "image" || mode === "video" ? "prompt" : "chat";
  if (!isTextModelEnabled(model, source)) throw new Error("连接不到模型，请联系管理员！");
  if (providerKey && getModelProviderPreference(providerKey) === "byteplus") {
    const apiKey = getConfiguredBytePlusApiKey();
    if (!apiKey) throw new Error("缺少 BytePlus API Key");
    return {
      url: `${getBytePlusBaseUrl()}/chat/completions`,
      headers: getBytePlusHeaders(apiKey),
      model: getBytePlusModelForRequest(providerKey),
      provider: "byteplus" as const,
    };
  }

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) throw new Error("缺少 API Key");
  return {
    url: OPENROUTER_URL,
    headers: getOpenRouterHeaders(apiKey),
    model,
    provider: "openrouter" as const,
  };
}

async function postChatCompletion(url: string, headers: Record<string, string>, body: Record<string, unknown>, fallback: string) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    try {
      return await curlPostJson<OpenRouterChatCompletionResponse>(url, headers, body, fallback);
    } catch {
      throw new Error(await getOpenRouterError(response, fallback));
    }
  }

  return (await response.json()) as OpenRouterChatCompletionResponse;
}

function getMimeType(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return "image/png";
}

function toDataUrlIfLocalPublicAsset(url: string) {
  if (!url.startsWith("/generated/")) return url;

  const filePath = join(process.cwd(), "public", url.replace(/^\//, ""));
  if (!existsSync(filePath)) return url;

  const data = readFileSync(filePath);
  return `data:${getMimeType(filePath)};base64,${data.toString("base64")}`;
}

function getReferenceImageDebugInfo(url: string, index: number) {
  if (url.startsWith("data:")) return { index, type: "data-url", exists: true };
  if (/^https?:\/\//i.test(url)) return { index, type: "remote-url", exists: true };
  if (url.startsWith("/generated/")) {
    const filePath = join(process.cwd(), "public", url.replace(/^\//, ""));
    return { index, type: "local-generated", exists: existsSync(filePath), path: url };
  }

  return { index, type: "unknown", exists: false, path: url.slice(0, 120) };
}

function toOpenRouterContent(text: string, images?: string[]): OpenRouterMessageContent {
  const safeImages = images?.filter(Boolean).map(toDataUrlIfLocalPublicAsset) ?? [];

  if (safeImages.length === 0) return text;

  return [
    { type: "text", text: text || "请分析这张图片。" },
    ...safeImages.map((url) => ({ type: "image_url" as const, image_url: { url } })),
  ];
}

function cleanModelText(value: string) {
  return value
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

function cleanAgentReplyContent(value: string) {
  const cleaned = cleanModelText(value);
  const parts = cleaned.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

  if (parts.length === 2 && Array.from(parts[0]).length <= 12 && !/^\s*(?:#{1,6}|[-*]|\d+[.、]|\[red\]|\[blue\])/.test(parts[1])) {
    return `${parts[0]}${/[。！？!?]$/.test(parts[0]) ? "" : "。"}${parts[1]}`;
  }

  return cleaned;
}

function normalizeSuggestionItem(item: SuggestionInput): SuggestionItem | null {
  if (typeof item === "string") {
    const label = cleanModelText(item).replace(/^[-\d.、\s]+/, "");
    return label ? { label } : null;
  }

  const label = item.label ? cleanModelText(item.label).replace(/^[-\d.、\s]+/, "") : "";
  if (!label) return null;

  return {
    label,
    action: typeof item.action === "string" ? cleanModelText(item.action) : undefined,
    assetTargetType: assetTargetTypes.includes(item.assetTargetType as AssetTargetType) ? item.assetTargetType : undefined,
  };
}

function normalizeSuggestions(items?: SuggestionInput[]) {
  const suggestions = (items ?? [])
    .map(normalizeSuggestionItem)
    .filter((item): item is SuggestionItem => Boolean(item))
    .filter((item, index, array) => array.findIndex((suggestion) => suggestion.label === item.label) === index)
    .slice(0, 5);

  return suggestions.length >= 3 ? suggestions : [...suggestions, ...fallbackAgentSuggestions.map(normalizeSuggestionItem).filter((item): item is SuggestionItem => Boolean(item))].filter((item, index, array) => array.findIndex((suggestion) => suggestion.label === item.label) === index).slice(0, 5);
}

function parseStructuredAgentReply(text: string): Required<Pick<ChatResponse, "content" | "intent" | "suggestions">> {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;

  try {
    const data = JSON.parse(jsonText) as StructuredAgentReply;
    const intent = data.intent && agentReplyIntents.includes(data.intent) ? data.intent : "chat";
    const content = typeof data.content === "string" && cleanAgentReplyContent(data.content) ? cleanAgentReplyContent(data.content) : cleanAgentReplyContent(text);

    return {
      content,
      intent,
      suggestions: normalizeSuggestions(data.suggestions),
    };
  } catch {
    return {
      content: cleanAgentReplyContent(text),
      intent: "chat",
      suggestions: normalizeSuggestions(),
    };
  }
}

async function getModelPrices() {
  const now = Date.now();
  if (modelPricingCache && modelPricingCache.expiresAt > now) return modelPricingCache.prices;

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, { cache: "no-store" });
    if (!response.ok) return {};

    const data = (await response.json()) as OpenRouterModelResponse;
    const prices = Object.fromEntries(
      (data.data ?? [])
        .map((model) => {
          const prompt = Number(model.pricing?.prompt);
          const completion = Number(model.pricing?.completion);
          if (!model.id || !Number.isFinite(prompt) || !Number.isFinite(completion)) return null;
          return [model.id, { prompt, completion }] as const;
        })
        .filter((item): item is readonly [string, { prompt: number; completion: number }] => Boolean(item)),
    );

    modelPricingCache = { expiresAt: now + 10 * 60 * 1000, prices };
    return prices;
  } catch {
    return {};
  }
}

async function getUsageMeta(data: Pick<OpenRouterChatCompletionResponse, "model" | "usage">, fallbackModel: string, estimatePricing = true): Promise<UsageMeta | undefined> {
  const usage = data.usage;
  if (!usage) return undefined;

  const promptTokens = Math.max(0, Math.floor(usage.prompt_tokens ?? 0));
  const completionTokens = Math.max(0, Math.floor(usage.completion_tokens ?? 0));
  const totalTokens = Math.max(0, Math.floor(usage?.total_tokens ?? promptTokens + completionTokens));
  const cost = typeof usage.cost === "number" && Number.isFinite(usage.cost) ? usage.cost : undefined;
  if (totalTokens === 0 && cost === undefined) return undefined;
  if (cost !== undefined) return { promptTokens, completionTokens, totalTokens, usd: cost };
  if (!estimatePricing) return { promptTokens, completionTokens, totalTokens, usd: getBytePlusTextUsageUsd(data.model ?? fallbackModel, promptTokens, completionTokens) };

  const prices = await getModelPrices();
  const price = prices[data.model ?? fallbackModel] ?? prices[fallbackModel];
  const usd = price ? promptTokens * price.prompt + completionTokens * price.completion : undefined;

  return { promptTokens, completionTokens, totalTokens, usd };
}

function addUsageMeta(current: UsageMeta | undefined, next: UsageMeta | undefined): UsageMeta | undefined {
  if (!next) return current;

  return {
    promptTokens: (current?.promptTokens ?? 0) + (next.promptTokens ?? 0),
    completionTokens: (current?.completionTokens ?? 0) + (next.completionTokens ?? 0),
    totalTokens: (current?.totalTokens ?? 0) + (next.totalTokens ?? 0),
    usd: (current?.usd ?? 0) + (next.usd ?? 0),
  };
}

async function getOpenRouterError(response: Response, fallback: string) {
  const text = await response.text();

  if (response.status === 413 || /Request Entity Too Large/i.test(text)) {
    return `${fallback}：${toUserErrorMessage(text)}`;
  }

  try {
    const data = JSON.parse(text) as OpenRouterErrorResponse;
    const message = data.error?.message ?? text;
    const code = data.error?.code ?? response.status;

    if (response.status === 401 || code === 401 || message.toLowerCase().includes("user not found")) {
      return "API Key 无效或已过期。请更新 .env.local 里的密钥，然后重新启动项目。";
    }

    if (response.status === 403 || code === 403 || message.toLowerCase().includes("not available in your region")) {
      return "当前模型在你的地区不可用，请切换普通/高级模式或更换模型后重试。";
    }

    return `${fallback}：${toUserErrorMessage(message)}`;
  } catch {
    return `${fallback}：${toUserErrorMessage(text)}`;
  }
}

export async function sendToOpenRouter(request: ChatRequest): Promise<ChatResponse> {
  const settingsText = request.settings
    ? [
        request.settings.ratio ? `比例：${request.settings.ratio}` : "",
        request.settings.resolution ? `分辨率：${request.settings.resolution}` : "",
        request.settings.style ? `风格：${request.settings.style}` : "",
        request.settings.duration ? `时长：${request.settings.duration}` : "",
      ]
        .filter(Boolean)
        .join("，")
    : "";
  const systemPrompt =
    request.mode === "agent"
      ? "你是闪念，一个影片/短剧创作 Agent。你的专业方向是电影知识、影片制作、短剧创作、剧本、人物、分镜、镜头、摄影、剪辑、提示词、生图和生视频。你要先满足用户当前问题，再通过建议按钮把用户自然引导到影片/短剧创作。如果用户消息包含“已读取文档内容如下”，必须把文档内容当作当前上下文；如果文档明显是智能体规则、角色设定、工作流说明、系统提示词或 Markdown agent 文件，并且用户说激活/启用/读取这个智能体，按普通长回复的排版方式回复：先用一级标题“XXX已激活”，再用自然短段、分隔线和短列表概括文档规则、能做什么、下一步怎么用。不要把很多规则塞进一个长 bullet；一条列表只讲一个重点。XXX 从文档标题/角色名/系统名提取。激活后要按文档规则继续对话。请判断回复类型：chat=普通聊天；film_knowledge=电影史、电影理论、影片制作知识、导演摄影剪辑等知识问答；creative_consult=创作咨询和方案建议；creative_structure=故事梗概、剧本、人物小传、分镜、镜头表、提示词整理；off_topic=明显偏离影片创作的问题。创作流程是：故事概念 -> 扩展故事 -> 改成文字分镜 -> 生成主角图片 -> 生成场景图片 -> 做成图片分镜 -> 做成视频。用户问知识时，suggestions 用 2-3 个当前问题延展 + 1-2 个转创作按钮。用户进入创作后，suggestions 用 2-3 个修改当前内容按钮 + 1-2 个下一步创作按钮。suggestions 必须是对象数组，每项包含 label，并在生成类按钮上加 assetTargetType：生成角色图=character_image，生成场景图=scene_image，生成分镜图片=shot_image，生成分镜视频/做成视频=shot_video，其它不确定=other。故事阶段按钮要能改冲突、人物出场、反转，并推进到文字分镜。文字分镜阶段必须按镜头编号写清画面、人物、动作、景别、镜头、氛围、时长；引导到生成角色、场景、第一镜图片。图片分镜必须一镜一张图，几个镜头就是几张图，建议逐镜生成：先第一镜，再下一镜。角色图生成后要引导生成三视图；场景图生成后要引导生成多角度参考。若上下文里有多版角色/场景，提醒用户用 @ 指定版本，例如 @男主第2版。普通聊天和偏离主题问题正文要短；文档激活、film_knowledge、creative_consult、creative_structure 必须详细且结构化。正文会由网页渲染，允许使用有限内部排版标记：一级标题用 #，二级标题用 ##，三级标题用 ###，重点用 **加粗**，列表用 -，分段横线用单独一行 ---，重要风险用 [red]...[/red]，可执行建议用 [blue]...[/blue]。不要使用 #### 或更多级标题，不要输出 Markdown 表格，不要把排版符号当正文解释。不要在正文里输出“下一步调整方向”。每次都必须给 3-5 个 suggestions，按钮文字 6-18 个中文左右，不要编号，尽量用动词开头。只返回 JSON，不要输出 JSON 之外的文字。"
      : request.mode === "chat"
        ? "你是闪念，一个中文 AI 创作助手。请像豆包一样自然对话，结合上下文回答用户问题。没有明确要求生成图片或视频时，不要输出生图或生视频提示词。输出要排版清楚，正文会由网页渲染，允许使用有限内部排版标记：一级标题用 #，二级标题用 ##，三级标题用 ###，重点用 **加粗**，列表用 -，分段横线用单独一行 ---。重要风险或必须注意的内容可用 [red]注意内容[/red]；可执行建议、下一步、推荐方案可用 [blue]建议内容[/blue]。不要使用 #### 或更多级标题，不要输出 Markdown 表格，不要整段染色。"
        : "你是一个中文创作助手。你要根据上下文和用户上传的图片，把口语需求整理成适合生图或生视频的提示词。图片模式下，把上传图片当作参考图，保留用户强调的主体、人物、构图或风格，并把带有视频、镜头、动画、运镜、时序等表达改写成适合单帧画面的描述，最终仍然只能输出图片提示词；视频模式下，把上传图片当作首帧或视觉参考，描述主体动作、镜头运动和画面变化，并把偏静态海报或单张图片需求改写成可执行的视频提示词。除 Agent 模式外，用户当前选择的模式优先级最高，不能因为原始文字里写了视频或图片就切换模式。请直接输出简短、清晰、可执行的中文结果，不要输出标题、说明、建议按钮或额外解释。";
  const finalInstruction =
    request.mode === "agent"
      ? "请基于上下文回复最新用户。返回严格 JSON：{\"intent\":\"chat|film_knowledge|creative_consult|creative_structure|off_topic\",\"content\":\"正文\",\"suggestions\":[{\"label\":\"按钮文字\",\"action\":\"可选动作\",\"assetTargetType\":\"character_image|scene_image|shot_image|shot_video|other\"}]}。如果最新用户消息包含已读取文档，必须明确使用文档内容；如果文档像智能体规则或工作流说明，并且用户说激活/启用/读取这个智能体，正文按普通长回复排版：标题、自然短段、分隔线、短列表。不要强制罗列太多规则，不要把大量规则塞进同一个 bullet。普通聊天简短且不要分段；文档激活、电影/影片制作知识、创作方案、剧本分镜提示词整理必须结构化且详细。正文不要出现“下一步调整方向”，不要输出字面量 \\n 或 \\t。只有长回答、列表、剧本、分镜、文档激活或知识讲解才使用换行。suggestions 必须 3-5 个，并符合：问答阶段=问题延展+转创作；创作阶段=修改当前内容+下一步创作；生成角色图用 character_image，生成场景图用 scene_image，生成图片分镜用 shot_image，生成分镜视频或做成视频用 shot_video。"
      : request.mode === "chat"
        ? "请基于上下文自然回答用户。"
      : request.mode === "video"
        ? `当前模式：视频${settingsText ? `。生成参数：${settingsText}` : ""}。用户当前是手动选择视频生成模式，这个模式优先级最高，不能改成图片模式。即使用户原话更像海报、封面、一张图、图片，也要把需求改写成视频提示词。请基于上下文，只输出最终可直接用于视频生成的完整提示词。必须包含：主体外貌/身份、场景、动作变化、镜头运动、光线氛围、画面风格；若用户原话偏静态，要补出合理的动作与镜头变化。控制在 80-160 个中文字符。不要解释，不能说自己无法生成，不能让用户复制到其它工具，不能输出标题或“视频提示词：”前缀。`
        : `当前模式：图片${settingsText ? `。生成参数：${settingsText}` : ""}。用户当前是手动选择图片生成模式，这个模式优先级最高，不能改成视频模式。即使用户原话里出现“视频”“一段”“镜头”“运镜”“动起来”“动画”等词，也必须把需求改写成适合单帧图片生成的提示词：保留主体、动作瞬间、场景、构图、氛围、风格，把时序和镜头语言改成定格画面表达。请基于上下文，只输出最终可直接用于图片生成的提示词，不要解释，不能说自己无法生成，不能让用户复制到其它工具，不能输出“通用生图提示词”之类的说明。`;

  const providerConfig = getTextProviderConfig(request.model, request.mode);
  const body = {
    model: providerConfig.model,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      ...request.messages.map((message) => ({
        role: message.role,
        content: toOpenRouterContent(message.content, message.images),
      })),
      {
        role: "user",
        content: finalInstruction,
      },
    ],
    temperature: 0.7,
  };
  const data = await postChatCompletion(providerConfig.url, providerConfig.headers, body, "请求失败");

  const rawContent = data.choices?.[0]?.message?.content ?? "";
  const usage = await getUsageMeta(data, providerConfig.provider === "openrouter" ? request.model : providerConfig.model, providerConfig.provider === "openrouter");

  if (request.mode === "agent") {
    const parsed = parseStructuredAgentReply(rawContent);

    return {
      ...parsed,
      model: data.model,
      usage,
    };
  }

  return {
    content: rawContent,
    model: data.model,
    usage,
  };
}

function parseIntentClassification(text: string): IntentClassification {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;

  try {
    const data = JSON.parse(jsonText) as Partial<IntentClassification>;
    const intent = data.intent === "image" || data.intent === "video" || data.intent === "prompt" || data.intent === "clarify" || data.intent === "agent" ? data.intent : "agent";
    const confidence = typeof data.confidence === "number" ? Math.min(1, Math.max(0, data.confidence)) : 0;

    return {
      intent,
      confidence,
      reason: typeof data.reason === "string" ? data.reason : "AI 未返回明确原因",
    };
  } catch {
    return { intent: "agent", confidence: 0, reason: "AI 意图分类解析失败" };
  }
}

function parseAgentPlan(text: string): Omit<AgentPlan, "usage"> {
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0] ?? text;

  try {
    const data = JSON.parse(jsonText) as Partial<AgentPlan>;
    const intent = data.intent === "image" || data.intent === "video" || data.intent === "clarify" || data.intent === "chat" ? data.intent : "chat";
    const count = typeof data.count === "number" && Number.isFinite(data.count) ? Math.max(1, Math.floor(data.count)) : undefined;
    const constraints = Array.isArray(data.constraints) ? data.constraints.map((item) => typeof item === "string" ? cleanModelText(item) : "").filter(Boolean).slice(0, 12) : undefined;
    const items = Array.isArray(data.items)
      ? data.items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const value = item as { index?: unknown; prompt?: unknown; constraints?: unknown; duration?: unknown };
          const prompt = typeof value.prompt === "string" ? cleanModelText(value.prompt) : "";
          if (!prompt) return null;
          return {
            index: typeof value.index === "number" && Number.isFinite(value.index) ? Math.max(1, Math.floor(value.index)) : undefined,
            prompt,
            duration: typeof value.duration === "string" ? cleanModelText(value.duration) : undefined,
            constraints: Array.isArray(value.constraints) ? value.constraints.map((entry) => typeof entry === "string" ? cleanModelText(entry) : "").filter(Boolean).slice(0, 8) : undefined,
          };
        })
        .filter((item): item is { index: number | undefined; prompt: string; duration: string | undefined; constraints: string[] | undefined } => Boolean(item))
        .slice(0, 20)
      : undefined;

    return {
      intent,
      needsClarification: Boolean(data.needsClarification) || intent === "clarify",
      clarifyQuestion: typeof data.clarifyQuestion === "string" ? cleanModelText(data.clarifyQuestion) : undefined,
      displayText: typeof data.displayText === "string" ? cleanModelText(data.displayText) : undefined,
      count,
      subject: typeof data.subject === "string" ? cleanModelText(data.subject) : undefined,
      quality: data.quality === "low" || data.quality === "standard" || data.quality === "high" ? data.quality : undefined,
      ratio: typeof data.ratio === "string" ? cleanModelText(data.ratio) : undefined,
      resolution: typeof data.resolution === "string" ? cleanModelText(data.resolution) : undefined,
      duration: typeof data.duration === "string" ? cleanModelText(data.duration) : undefined,
      prompt: typeof data.prompt === "string" ? cleanModelText(data.prompt) : undefined,
      constraints,
      items,
      suggestions: normalizeSuggestions(data.suggestions),
    };
  } catch {
    return {
      intent: "chat",
      needsClarification: false,
      displayText: "我先理解你的需求，再帮你继续推进。",
      suggestions: normalizeSuggestions(),
    };
  }
}

export async function planAgentTask(request: Pick<ChatRequest, "model" | "messages">): Promise<AgentPlan> {
  const providerConfig = getTextProviderConfig(request.model, "agent");
  const body = {
    model: providerConfig.model,
    messages: [
      {
        role: "system",
        content:
          "你是闪念的任务规划器，只返回 JSON，不要输出 JSON 之外的文字。你的任务是理解用户最新一句和上下文，决定是继续对话、追问、生成图片还是生成视频。原则：能从上下文和默认规则推断就不要追问；只有目标不清、图片/视频都可能、缺失信息会明显导致错误、用户要求互相冲突、或成本规格明显过高时才追问。如果用户消息包含“已读取文档内容如下”，必须把文档内容纳入判断；如果文档明显是智能体规则、角色设定、工作流说明、系统提示词或 Markdown agent 文件，intent 应优先为 chat，不要急着生成图片或视频，除非用户同时明确要求生成。用户最新一句是纠错或限制时必须覆盖旧上下文，例如“只要场景、不要人物、没有人物、纯场景、空镜”表示最终图片必须是无人物场景，prompt 和 items 里都不能出现 person、portrait、character、human、figure、silhouette、man、woman、人物、角色、行人、剪影等人物主体。若用户明确要生成图片/视频，直接给出可执行计划。必须把数量、单张/单段内容和画面约束分开，不要把“7张/十张/多张”写进单张图片画面里。多图独立生成时，count 等于图片张数，items 里每一项都是单张图片或单段视频的干净执行 prompt，不要写用户原话、不要写“每张都要/10张图片/彼此不同”等跨图规则。用户明确说“合并到一张、放在一张图上、一张展示图、排版展示、多款放一起、多个方案在同一画面”时，必须理解为生成一张合并展示图，count=1，不要拆成多张独立图片，prompt 要自然描述同一张画面里有多个方案/元素的排版。不要默认在 prompt 里写“禁止拼图、合集、九宫格、多宫格、分屏、照片墙”等负向词；只有用户明确说不要拼图/合集或纠正上次拼图错误时，才把这类约束放进 constraints，不要放进展示给用户的 displayText。用户要求每张不同人物/国家/性别/时代时，把差异拆到 items 的每条 prompt 中，例如第1张只写一个具体国家+一个性别+一个时代，第2张再换另一组；不要把“不同国家、不同性别、不同时代”作为一句话放进单张 prompt。用户要求把文字分镜/图片分镜/多个镜头做成视频时，count 必须等于镜头数，items 必须一镜一段视频；每个 item.duration 要按该镜头分镜内容、动作复杂度和剧本中写的时长判断，不能默认都用最低秒数。只有用户随便要求生成一个普通视频、没有分镜/镜头时，才用最低时长。普通缺省：图片数量 1，人物图比例 3:4，场景图比例 16:9，使用最低可用分辨率；用户说高品质/高清/质量好时 quality=high，可提升一档或保留高质量描述。视频普通单段缺省最低时长。所有字符串字段不要输出字面量 \\n 或 \\t。返回格式：{\"intent\":\"chat|image|video|clarify\",\"needsClarification\":false,\"clarifyQuestion\":\"需要追问时的问题\",\"displayText\":\"给用户看的简短执行说明，不要照抄用户原话，不要默认暴露内部禁止词\",\"count\":1,\"subject\":\"主体\",\"quality\":\"low|standard|high\",\"ratio\":\"智能比例|3:4|9:16|16:9|1:1|4:3|21:9\",\"resolution\":\"1K|2K|4K|480p|720p|1080p\",\"duration\":\"5秒\",\"prompt\":\"最终给生成模型的单张图片或单段视频提示词，不包含生成数量，不重复用户原话\",\"constraints\":[\"只保留给执行器参考的约束，不要把跨图规则当 prompt\"],\"items\":[{\"index\":1,\"prompt\":\"一条干净的单段视频提示词，只描述当前这一镜\",\"duration\":\"5秒\",\"constraints\":[\"只描述当前镜头\"]}],\"suggestions\":[{\"label\":\"按钮文字\",\"assetTargetType\":\"character_image|scene_image|shot_image|shot_video|other\"}]}。如果 intent=chat，displayText 可为空，suggestions 仍给 3-5 个，引导到故事、剧本、分镜、角色图、场景图、视频。",
      },
      ...request.messages.slice(-10).map((message) => ({
        role: message.role,
        content: message.images?.length ? `${message.content}\n\n用户本轮带了 ${message.images.length} 张参考图，规划时只理解文字需求，生成阶段再使用参考图。` : message.content,
      })),
      {
        role: "user",
        content: "请为最新用户消息生成结构化执行计划，只返回 JSON。",
      },
    ],
    temperature: 0.2,
  };
  const data = await postChatCompletion(providerConfig.url, providerConfig.headers, body, "Agent 规划失败");

  return { ...parseAgentPlan(data.choices?.[0]?.message?.content ?? ""), usage: await getUsageMeta(data, providerConfig.provider === "openrouter" ? request.model : providerConfig.model, providerConfig.provider === "openrouter") };
}

export async function classifyOpenRouterIntent(request: Pick<ChatRequest, "model" | "messages">): Promise<IntentClassification> {
  const providerConfig = getTextProviderConfig(request.model, "agent");
  const body = {
    model: providerConfig.model,
    messages: [
      {
        role: "system",
        content:
          "你是闪念的意图分类器，只返回 JSON，不要输出其它文字。根据用户最新一句和上下文判断下一步应该做什么。intent 只能是 agent、image、video、prompt、clarify。image 表示用户要生成图片；video 表示用户明确要生成视频、镜头、动画、让图中人物动起来、图生视频；prompt 表示用户只要提示词优化；agent 表示普通创作讨论、改文案、想方案、泛泛地说来一段；clarify 表示图片和视频都可能，需要追问。注意：单独的“来一段”“写一段”“搞一段”不是视频意图，除非同时明确说视频、镜头、动画、动起来。返回格式：{\"intent\":\"video\",\"confidence\":0.92,\"reason\":\"原因\"}。",
      },
      ...request.messages.slice(-8).map((message) => ({ role: message.role, content: message.content })),
      {
        role: "user",
        content: "请分类最新用户意图，只返回 JSON。",
      },
    ],
    temperature: 0,
  };
  const data = await postChatCompletion(providerConfig.url, providerConfig.headers, body, "意图分类失败");

  return { ...parseIntentClassification(data.choices?.[0]?.message?.content ?? ""), usage: await getUsageMeta(data, providerConfig.provider === "openrouter" ? request.model : providerConfig.model, providerConfig.provider === "openrouter") };
}

export async function getOpenRouterConversationModels(): Promise<ConversationModel[]> {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await getOpenRouterError(response, "模型列表获取失败"));
  }

  const data = (await response.json()) as OpenRouterModelResponse;
  const providerCounts = new Map<string, number>();
  const remoteModels =
    data.data
      ?.filter((model) => model.id && model.architecture?.modality?.includes("text") && CHINA_MODEL_PREFIXES.some((prefix) => model.id?.startsWith(prefix)))
      .filter((model) => {
        const providerId = getProviderId(model.id ?? "");
        const count = providerCounts.get(providerId) ?? 0;

        if (count >= MODELS_PER_PROVIDER) return false;

        providerCounts.set(providerId, count + 1);
        return true;
      })
      .map((model) => ({
        id: model.id ?? "",
        label: model.name || model.id || "未知模型",
      })) ?? [];

  return [...models, ...remoteModels.filter((model) => !models.some((item) => item.id === model.id))];
}

type ImageGenerationOptions = {
  model?: string;
  bytePlusProviderKey?: string;
  settings?: {
    ratio?: string;
    resolution?: string;
  };
  count?: number;
  candidateMode?: "all" | "best";
};

function getImageRequestConfig(model: string, settings?: ImageGenerationOptions["settings"]) {
  const rule = getImageModelRule(model);
  const { resolution, ratio: aspectRatio } = resolveImageSettingsForModel(model, settings);
  const dimensions = getExpectedImageDimensions(model, resolution, aspectRatio);

  return {
    modalities: rule.modalities,
    targetDimensions: dimensions,
    imageConfig: {
      aspect_ratio: aspectRatio,
      image_size: resolution,
    },
  };
}

function isTransientImageError(message: string) {
  return /Internal Server Error|没有返回图片|\b500\b|\b502\b|\b503\b|\b504\b/i.test(message);
}

function isImageConfigError(message: string) {
  return /image_config|aspect_ratio|size/i.test(message);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenRouterImageUrls(data: OpenRouterChatCompletionResponse) {
  const choiceImages = data.choices?.[0]?.message?.images?.map((image) => image.image_url?.url ?? image.url).filter((url): url is string => Boolean(url)) ?? [];
  if (choiceImages.length > 0) return choiceImages;

  const rootImages = data.images?.map((image) => image.image_url?.url ?? image.url).filter((url): url is string => Boolean(url)) ?? [];
  if (rootImages.length > 0) return rootImages;

  const dataImages = data.data?.map((item) => item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : undefined)).filter((url): url is string => Boolean(url)) ?? [];
  return dataImages;
}

function getBytePlusImageUrls(data: BytePlusImageGenerationResponse) {
  return data.data?.map((item) => item.url ?? (item.b64_json ? `data:image/png;base64,${item.b64_json}` : undefined)).filter((url): url is string => Boolean(url)) ?? [];
}

function getBytePlusImageFailureReasons(data: BytePlusImageGenerationResponse) {
  const itemReasons = data.data?.map((item) => cleanNoImageReason(item.error?.message)).filter((item): item is string => Boolean(item)) ?? [];
  const rootReason = cleanNoImageReason(data.error?.message);
  return Array.from(new Set([rootReason, ...itemReasons].filter((item): item is string => Boolean(item))));
}

function getBytePlusImageUsage(data: BytePlusImageGenerationResponse, model: string, outputImageCount: number): UsageMeta | undefined {
  const usage = data.usage;
  const promptTokens = Math.max(0, Math.floor(usage?.prompt_tokens ?? 0));
  const completionTokens = Math.max(0, Math.floor(usage?.completion_tokens ?? usage?.output_tokens ?? 0));
  const totalTokens = Math.max(0, Math.floor(usage?.total_tokens ?? promptTokens + completionTokens));
  const usd = typeof usage?.usd === "number" ? usage.usd : typeof usage?.cost === "number" ? usage.cost : bytePlusImagePricePerOutput[model] !== undefined ? bytePlusImagePricePerOutput[model] * Math.max(0, outputImageCount) : undefined;
  if (promptTokens <= 0 && completionTokens <= 0 && totalTokens <= 0 && usd === undefined) return undefined;
  return { promptTokens, completionTokens, totalTokens, usd };
}

function cleanNoImageReason(value: string | undefined) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getOpenRouterNoImageReason(data: OpenRouterChatCompletionResponse) {
  const choice = data.choices?.[0];
  const message = choice?.message;
  const parts = [
    cleanNoImageReason(data.error?.message),
    cleanNoImageReason(message?.refusal),
    cleanNoImageReason(message?.content),
    cleanNoImageReason(choice?.finish_reason ? `finish_reason: ${choice.finish_reason}` : undefined),
    cleanNoImageReason(choice?.native_finish_reason ? `native_finish_reason: ${choice.native_finish_reason}` : undefined),
  ].filter((item): item is string => Boolean(item));

  return Array.from(new Set(parts)).join("；");
}

function getImageDimensionScore(dimensions: ImageDimensions | undefined, target: ImageDimensions) {
  if (target.width <= 0 || target.height <= 0) return Number.POSITIVE_INFINITY;
  if (!dimensions) return Number.POSITIVE_INFINITY;
  const aspectScore = Math.abs(dimensions.width / dimensions.height - target.width / target.height) * 100000;
  const sizeScore = Math.abs(dimensions.width - target.width) + Math.abs(dimensions.height - target.height);
  return aspectScore + sizeScore;
}

function pickBestImageForTarget(images: string[], imageDimensions: Record<string, ImageDimensions>, target: ImageDimensions) {
  if (images.length <= 1) return images;
  if (target.width <= 0 || target.height <= 0) return [images[0]];

  const best = images.reduce((current, image) => {
    const score = getImageDimensionScore(imageDimensions[image], target);
    return score < current.score ? { image, score } : current;
  }, { image: images[0], score: getImageDimensionScore(imageDimensions[images[0]], target) });

  console.log("[image-generation] multiple images returned, selected best match", {
    target,
    selected: best.image,
    returned: images.map((image) => ({ image, dimensions: imageDimensions[image] })),
  });

  return [best.image];
}

async function generateBytePlusImage(prompt: string, referenceImages: string[] = [], options: ImageGenerationOptions = {}) {
  const apiKey = getConfiguredBytePlusApiKey();
  if (!apiKey) throw new Error("缺少 BytePlus API Key");

  const model = options.model || DEFAULT_IMAGE_MODEL;
  const bytePlusModel = getBytePlusImageModelName(model, options.bytePlusProviderKey);
  if (!bytePlusModel) throw new Error("连接不到模型，请联系管理员！");

  const count = Math.min(4, Math.max(1, Math.floor(options.count ?? 1)));
  const safeReferenceImages = referenceImages.filter(Boolean).slice(0, 10).map(toDataUrlIfLocalPublicAsset);
  const { resolution, ratio: aspectRatio } = resolveImageSettingsForModel(model, options.settings);
  const targetDimensions = getExpectedImageDimensions(model, resolution, aspectRatio);
  const bytePlusSize = targetDimensions.width > 0 && targetDimensions.height > 0 ? `${targetDimensions.width}x${targetDimensions.height}` : resolution;
  const headers = getBytePlusHeaders(apiKey);
  const url = `${getBytePlusBaseUrl()}/images/generations`;

  console.log("[image-generation] BytePlus request params", {
    model: bytePlusModel,
    selectedRatio: options.settings?.ratio,
    selectedResolution: options.settings?.resolution,
    size: bytePlusSize,
    expected_dimensions: targetDimensions,
    reference_count: safeReferenceImages.length,
    using_image_reference: safeReferenceImages.length > 0,
  });

  const createOne = async () => {
    const startedAt = Date.now();
    const body: Record<string, unknown> = {
      model: bytePlusModel,
      prompt,
      ...(safeReferenceImages.length === 1 ? { image: safeReferenceImages[0] } : safeReferenceImages.length > 1 ? { image: safeReferenceImages } : {}),
      ...(count > 1 ? { sequential_image_generation: "auto", sequential_image_generation_options: { max_images: count } } : safeReferenceImages.length > 1 ? { sequential_image_generation: "disabled" } : {}),
      size: bytePlusSize,
      watermark: false,
    };
    if (supportsBytePlusImageOutputFormat(bytePlusModel)) body.output_format = "jpeg";

    let providerDoneAt = startedAt;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    providerDoneAt = Date.now();

    let data: BytePlusImageGenerationResponse;
    if (!response.ok) {
      try {
        data = await curlPostJson<BytePlusImageGenerationResponse>(url, headers, body, "BytePlus 图片生成失败");
        providerDoneAt = Date.now();
      } catch (curlError) {
        const curlMessage = curlError instanceof Error ? curlError.message : "";
        if (/curl|schannel|closed abruptly|close_notify|command failed/i.test(curlMessage)) throw new Error("网络连接异常，请稍后重试。");
        if (curlMessage) throw new Error(curlMessage);
        throw new Error(await getOpenRouterError(response, "BytePlus 图片生成失败"));
      }
    } else {
      try {
        data = (await response.json()) as BytePlusImageGenerationResponse;
      } catch (parseError) {
        const parseMessage = parseError instanceof Error ? parseError.message : "图片平台返回解析失败";
        throw new Error(`BytePlus 图片平台响应解析失败：${parseMessage}`);
      }
    }

    const images = getBytePlusImageUrls(data);
    const failureReasons = getBytePlusImageFailureReasons(data);
    const localImages = await Promise.all(images.map((image) => saveGeneratedAsset(image, "image")));
    const saveDoneAt = Date.now();
    if (localImages.length === 0) {
      const reason = cleanNoImageReason(data.error?.message) || "empty image result";
      console.error("[image-generation] BytePlus no image returned", { model: bytePlusModel, responseId: data.id, reason });
      throw new Error(reason ? `BytePlus 图片平台没有返回图片：${reason}` : "BytePlus 图片平台没有返回图片，且没有返回可用原因。");
    }

    if (failureReasons.length > 0) {
      console.warn("[image-generation] BytePlus partial image failures", { model: bytePlusModel, responseId: data.id, failureReasons });
    }

    const allImageDimensions = Object.fromEntries(
      localImages
        .map((image) => [image, getLocalImageDimensions(image)] as const)
        .filter((item): item is readonly [string, ImageDimensions] => Boolean(item[1])),
    );
    const dimensionsDoneAt = Date.now();
    const selectedImages = options.candidateMode === "best" ? pickBestImageForTarget(localImages, allImageDimensions, targetDimensions) : localImages;
    const imageDimensions = Object.fromEntries(
      selectedImages
        .map((image) => [image, allImageDimensions[image]] as const)
        .filter((item): item is readonly [string, ImageDimensions] => Boolean(item[1])),
    );

    console.log("[image-generation] BytePlus timing", {
      model: bytePlusModel,
      size: bytePlusSize,
      returnedImages: images.length,
      localImages: localImages.length,
      providerMs: providerDoneAt - startedAt,
      saveMs: saveDoneAt - providerDoneAt,
      dimensionsMs: dimensionsDoneAt - saveDoneAt,
      totalMs: dimensionsDoneAt - startedAt,
    });

    return {
      content: data.data?.map((item) => item.revised_prompt).filter(Boolean).join("\n\n") ?? "",
      images: selectedImages,
      imageDimensions,
      failureReasons,
      usage: getBytePlusImageUsage(data, bytePlusModel, localImages.length),
    };
  };

  const createOneWithRetry = async () => {
    try {
      return await createOne();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!isTransientImageError(message)) throw error;
      await wait(1200);
      return createOne();
    }
  };

  const results = count > 1 ? [await createOneWithRetry()] : await Promise.all(Array.from({ length: count }).map(() => createOneWithRetry()));
  const usage = results.reduce<UsageMeta | undefined>((current, item) => addUsageMeta(current, item.usage), undefined);

  return {
    content: results.map((item) => item.content).filter(Boolean).join("\n\n"),
    images: results.flatMap((item) => item.images),
    imageDimensions: Object.assign({}, ...results.map((item) => item.imageDimensions)),
    failureReasons: Array.from(new Set(results.flatMap((item) => item.failureReasons ?? []))),
    usage,
  };
}

export async function generateOpenRouterImage(prompt: string, referenceImages: string[] = [], options: ImageGenerationOptions = {}) {
  const model = options.model || process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const bytePlusImageModel = getBytePlusImageModelName(model, options.bytePlusProviderKey);
  if (bytePlusImageModel) return generateBytePlusImage(prompt, referenceImages, { ...options, model });

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("缺少 API Key");
  }

  const safeReferenceImages = referenceImages.filter(Boolean).slice(0, 3);
  const count = Math.min(4, Math.max(1, Math.floor(options.count ?? 1)));
  const { modalities, imageConfig, targetDimensions } = getImageRequestConfig(model, options.settings);

  console.log("[image-generation] OpenRouter request params", {
    model,
    selectedRatio: options.settings?.ratio,
    selectedResolution: options.settings?.resolution,
    modalities,
    image_config: imageConfig,
    expected_dimensions: targetDimensions,
    reference_count: safeReferenceImages.length,
    references: safeReferenceImages.map(getReferenceImageDebugInfo),
  });

  const createOne = async (useImageConfig = true) => {
    const body = {
      model,
      messages: [
        {
          role: "user",
          content: toOpenRouterContent(prompt, safeReferenceImages),
        },
      ],
      modalities,
      ...(useImageConfig ? { image_config: imageConfig } : {}),
    };
    const headers = getOpenRouterHeaders(apiKey);
    const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    });

    let data: OpenRouterChatCompletionResponse;

    if (!response.ok) {
      try {
        data = await curlPostJson<OpenRouterChatCompletionResponse>(OPENROUTER_URL, headers, body, "图片生成失败");
      } catch (curlError) {
        const curlMessage = curlError instanceof Error ? curlError.message : "";
        if (/curl|schannel|closed abruptly|close_notify|command failed/i.test(curlMessage)) throw new Error("网络连接异常，请稍后重试。");
        if (curlMessage) throw new Error(curlMessage);
        throw new Error(await getOpenRouterError(response, "图片生成失败"));
      }
    } else {
      try {
        data = (await response.json()) as OpenRouterChatCompletionResponse;
      } catch (parseError) {
        const parseMessage = parseError instanceof Error ? parseError.message : "图片平台返回解析失败";
        throw new Error(`图片平台响应解析失败：${parseMessage}`);
      }
    }

    const images = getOpenRouterImageUrls(data);
    let localImages: string[] = [];

    try {
      localImages = await Promise.all(images.map(async (image) => {
        return saveGeneratedAsset(image, "image");
      }));
    } catch (saveError) {
      if (saveError instanceof Error) throw saveError;
      throw new Error("Image asset save failed");
    }

    if (localImages.length === 0) {
      const noImageReason = getOpenRouterNoImageReason(data);
      console.error("[image-generation] no image returned", {
        model,
        responseModel: data.model,
        responseId: data.id,
        reason: noImageReason || "empty image result",
        finishReason: data.choices?.[0]?.finish_reason,
        nativeFinishReason: data.choices?.[0]?.native_finish_reason,
      });
      throw new Error(noImageReason ? `图片平台没有返回图片：${noImageReason}` : "图片平台没有返回图片，且没有返回可用原因。");
    }

    const allImageDimensions = Object.fromEntries(
      localImages
        .map((image) => [image, getLocalImageDimensions(image)] as const)
        .filter((item): item is readonly [string, ImageDimensions] => Boolean(item[1])),
    );
    const selectedImages = options.candidateMode === "best" ? pickBestImageForTarget(localImages, allImageDimensions, targetDimensions) : localImages;
    const imageDimensions = Object.fromEntries(
      selectedImages
        .map((image) => [image, allImageDimensions[image]] as const)
        .filter((item): item is readonly [string, ImageDimensions] => Boolean(item[1])),
    );

    return {
      content: data.choices?.[0]?.message?.content ?? "",
      images: selectedImages,
      imageDimensions,
      usage: await getUsageMeta(data, model),
    };
  };

  const createOneWithRetry = async () => {
    try {
      return await createOne(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!isTransientImageError(message) || isImageConfigError(message)) throw error;

      await wait(1200);
      try {
        return await createOne(true);
      } catch (retryError) {
        const retryMessage = retryError instanceof Error ? retryError.message : "";
        if (!isTransientImageError(retryMessage) || isImageConfigError(retryMessage)) throw retryError;

        await wait(1600);
        return await createOne(true);
      }
    }
  };

  const results = await Promise.all(Array.from({ length: count }).map(() => createOneWithRetry()));
  const usage = results.reduce<UsageMeta | undefined>((current, item) => addUsageMeta(current, item.usage), undefined);

  return {
    content: results.map((item) => item.content).filter(Boolean).join("\n\n"),
    images: results.flatMap((item) => item.images),
    imageDimensions: Object.assign({}, ...results.map((item) => item.imageDimensions)),
    usage,
  };
}
