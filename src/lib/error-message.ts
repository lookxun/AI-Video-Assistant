export const GENERIC_MEDIA_ERROR_MESSAGE = "服务器繁忙，请稍候再试.....";

export function toUserErrorMessage(value: unknown, fallback = "请求失败，请稍后再试。") {
  const raw = typeof value === "string" ? value : value instanceof Error ? value.message : fallback;
  const errorCodePrefix = raw.match(/^\(B_\d+\)\s*/)?.[0] ?? "";
  const withErrorCode = (message: string) => `${errorCodePrefix}${message}`;
  const text = raw
    .replace(/^\(B_\d+\)\s*/, "")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ")
    .replace(/\b(?:OpenRouter|BytePlus|ModelArk|OpenAI|Gemini|Google)\b\s*/gi, "")
    .replace(/^(?:图片|视频)?(?:平台|模型|供应商)?(?:图片|视频)?(?:生成|任务|请求)?失败[：:]\s*/i, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\bfinish_reason\s*:\s*\w+/gi, " ")
    .replace(/\bnative_finish_reason\s*:\s*\w+/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/^[：:；;，,\s]+|[：:；;，,\s]+$/g, "")
    .trim();
  const lower = text.toLowerCase();

  if (!text) return withErrorCode(fallback);
  if (/system-reminder|operational mode|plan to build|read-only mode|file changes|shell commands/i.test(lower)) return withErrorCode(fallback);
  if (/413|request entity too large|content too large|payload too large|too large/.test(lower)) return withErrorCode("请求内容太大，请减少参考图数量或换用更小的图片后重试。");
  if (/401|unauthorized|user not found|invalid api key|api key/.test(lower)) return withErrorCode("API Key 无效或已过期，请更新密钥后重试。");
  if (/403|not available in your region|region/.test(lower)) return withErrorCode("当前模型在你的地区不可用，请换一个模型后重试。");
  if (/429|rate limit|too many requests|quota/.test(lower)) return withErrorCode("请求太频繁或额度不足，请稍后再试。");
  if (/timeout|timed out|etimedout|aborted/.test(lower)) return withErrorCode("请求超时，请稍后重试。");
  if (/network|fetch failed|econnreset|enotfound|socket|curl|schannel|closed abruptly|close_notify|command failed/.test(lower)) return withErrorCode("网络连接异常，请稍后重试。");
  if (/maximum call stack size exceeded|call stack|rangeerror|typeerror|referenceerror/.test(lower)) return withErrorCode("任务失败，请联系管理员！");
  if (/sensitive|privacyinformation|real person|privacy|真人|隐私|敏感/.test(lower)) return withErrorCode("参考图可能包含真人或隐私敏感信息，平台拒绝生成。请换一张参考图后重试。");
  if (/unsupported size|invalid option|invalid parameter|not valid/.test(lower)) return withErrorCode("当前模型不支持这组参数，请换比例、分辨率或模型后重试。");
  if (/internal server error|server error|500/.test(lower)) return withErrorCode("平台服务临时异常，请稍后重试。");
  if (/no endpoints found/.test(lower)) return withErrorCode("当前模型不支持这类输出方式，请换一个模型后重试。");
  if (/没有返回图片/.test(text) && /没有返回可用原因|没有返回可用的原因|没有可用原因|没有返回原因|且没有/.test(text)) return withErrorCode(fallback);

  if (/[{}<>]|\bhtml\b|\bbody\b|\bhead\b|\btrace\b|\bstack\b/i.test(text)) return withErrorCode(fallback);
  if (!/[\u4e00-\u9fff]/.test(text)) return withErrorCode(fallback);
  const maxLength = /没有返回图片/.test(text) ? 500 : 180;
  return withErrorCode(text.length > maxLength ? `${text.slice(0, maxLength)}...` : text);
}

export function isGenericMediaErrorMessage(message: string, fallback = GENERIC_MEDIA_ERROR_MESSAGE) {
  return message === fallback || [
    "请求失败，请稍后再试。",
    "图片生成失败，请稍后再试。",
    "视频生成失败，请稍后再试。",
    "请求超时，请稍后重试。",
    "网络连接异常，请稍后重试。",
    "平台服务临时异常，请稍后重试。",
    "任务失败，请联系管理员！",
  ].includes(message);
}
