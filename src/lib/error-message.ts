export function toUserErrorMessage(value: unknown, fallback = "请求失败，请稍后再试。") {
  const raw = typeof value === "string" ? value : value instanceof Error ? value.message : fallback;
  const text = raw.replace(/OpenRouter/gi, "平台").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();

  if (!text) return fallback;
  if (/413|request entity too large|content too large|payload too large|too large/.test(lower)) return "请求内容太大，请减少参考图数量或换用更小的图片后重试。";
  if (/401|unauthorized|user not found|invalid api key|api key/.test(lower)) return "API Key 无效或已过期，请更新密钥后重试。";
  if (/403|not available in your region|region/.test(lower)) return "当前模型在你的地区不可用，请换一个模型后重试。";
  if (/429|rate limit|too many requests|quota/.test(lower)) return "请求太频繁或额度不足，请稍后再试。";
  if (/timeout|timed out|etimedout|aborted/.test(lower)) return "请求超时，请稍后重试。";
  if (/network|fetch failed|econnreset|enotfound|socket|curl|schannel|closed abruptly|close_notify|command failed/.test(lower)) return "网络连接异常，请稍后重试。";
  if (/maximum call stack size exceeded|call stack|rangeerror|typeerror|referenceerror/.test(lower)) return "任务失败，请联系管理员！";
  if (/sensitive|privacyinformation|real person|privacy/.test(lower)) return "参考图可能包含真人或隐私敏感信息，平台拒绝生成。请换一张参考图后重试。";
  if (/unsupported size|invalid option|invalid parameter|not valid/.test(lower)) return "当前模型不支持这组参数，请换比例、分辨率或模型后重试。";
  if (/internal server error|server error|500/.test(lower)) return "平台服务临时异常，请稍后重试。";
  if (/no endpoints found/.test(lower)) return "当前模型不支持这类输出方式，请换一个模型后重试。";

  if (/[{}<>]|\bhtml\b|\bbody\b|\bhead\b|\btrace\b|\bstack\b/i.test(text)) return "任务失败，请联系管理员！";
  const maxLength = /没有返回图片/.test(text) ? 500 : 180;
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}
