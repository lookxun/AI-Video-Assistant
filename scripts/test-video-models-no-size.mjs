import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OPENROUTER_VIDEOS_URL = "https://openrouter.ai/api/v1/videos";
const OUTPUT_DIR = join(process.cwd(), "FlashMuse_Agent_Project Planning", "test");
const RESULTS_PATH = join(OUTPUT_DIR, "video-model-no-size-test-results.md");
const RAW_PATH = join(OUTPUT_DIR, "video-model-no-size-test-raw.json");

const tests = [
  {
    label: "Seedance 2.0",
    model: "bytedance/seedance-2.0",
    duration: 5,
    cases: {
      "480p": { "21:9": "992x432", "16:9": "864x496", "4:3": "752x560", "1:1": "640x640", "3:4": "560x752", "9:16": "496x864" },
      "720p": { "21:9": "1470x630", "16:9": "1280x720", "4:3": "1112x834", "1:1": "960x960", "3:4": "834x1112", "9:16": "720x1280" },
      "1080p": { "21:9": "2206x946", "16:9": "1920x1080", "4:3": "1664x1248", "1:1": "1440x1440", "3:4": "1248x1664", "9:16": "1080x1920" },
    },
  },
  {
    label: "Kling v3.0 Standard",
    model: "kwaivgi/kling-v3.0-std",
    duration: 5,
    cases: { "720p": { "16:9": "1280x720", "1:1": "960x960", "9:16": "720x1280" } },
  },
  {
    label: "Kling v3.0 Pro",
    model: "kwaivgi/kling-v3.0-pro",
    duration: 5,
    cases: { "720p": { "16:9": "1280x720", "1:1": "960x960", "9:16": "720x1280" } },
  },
  {
    label: "Kling Video O1",
    model: "kwaivgi/kling-video-o1",
    duration: 5,
    cases: { "1080p": { "16:9": "1920x1080", "1:1": "1440x1440", "9:16": "1080x1920" } },
  },
  {
    label: "Veo 3.1",
    model: "google/veo-3.1",
    duration: 4,
    cases: {
      "720p": { "16:9": "1280x720", "9:16": "720x1280" },
      "1080p": { "16:9": "1920x1080", "9:16": "1080x1920" },
      "4K": { "16:9": "3840x2160", "9:16": "2160x3840" },
    },
  },
];

const promptSubjects = {
  "21:9": "an ultra-wide desert canyon chase with two small hoverbikes weaving between red stone arches, long dust trails, layered mountains on the horizon",
  "16:9": "a silver mechanical fox running slowly through a rainy neon street, water splashing under its paws, blue and violet reflections on wet pavement",
  "4:3": "a vintage steam train crossing a snowy mountain bridge at dusk, warm cabin lights glowing through drifting smoke",
  "1:1": "a tiny robot chef cooking glowing noodles in a cozy cyberpunk kitchen, steam rising from the bowl and neon reflections on metal props",
  "3:4": "a mechanical owl landing on a mossy stone pillar inside an ancient greenhouse, glass roof beams, swaying leaves, glowing eyes",
  "9:16": "a futuristic dancer in a silver jacket performing slow precise moves on a rooftop at sunrise, wind moving hair and fabric, city skyline behind",
};

const resolutionDirectives = {
  "480p": "Prioritize clear silhouette, readable motion, stable subject identity, and clean composition despite low resolution.",
  "720p": "Balance detailed textures, natural camera movement, subject consistency, and background depth.",
  "1080p": "Show fine details, consistent small moving elements, realistic lighting transitions, and no object morphing.",
  "4K": "Emphasize high-detail surfaces, distant background detail, stable edges, natural motion blur, and cinematic lighting.",
};

function getPrompt(ratio, resolution) {
  return `Cinematic video test for ${resolution} ${ratio}: ${promptSubjects[ratio]}. ${resolutionDirectives[resolution]} Natural physical motion, stable geometry, consistent subject design, detailed environment, no text, no subtitles, no watermark.`;
}

function getEnvValue(name) {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return process.env[name];
  const line = readFileSync(envPath, "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
  return line?.split("=").slice(1).join("=").trim() || process.env[name];
}

function getHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Yinzao",
  };
}

function sanitizeFilePart(value) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function curlJson(url, headers) {
  const args = ["-sS", "-L", ...Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]), url];
  const { stdout } = await execFileAsync(process.platform === "win32" ? "curl.exe" : "curl", args, { maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function postVideoTask(apiKey, test, generateAudio = true) {
  const body = {
    model: test.model,
    prompt: test.prompt,
    duration: test.duration,
    resolution: test.resolution,
    aspect_ratio: test.ratio,
    generate_audio: generateAudio,
  };

  const response = await fetch(OPENROUTER_VIDEOS_URL, {
    method: "POST",
    headers: getHeaders(apiKey),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return { task: data, requestBody: body };
}

function getTaskId(task) {
  return task.polling_url || task.pollingUrl || task.id || task.generation_id || task.job_id;
}

function normalizeStatus(task) {
  const status = String(task.status || task.data?.status || "").toLowerCase();
  if (["succeeded", "success", "completed", "complete"].includes(status)) return "succeeded";
  if (["failed", "error", "expired", "cancelled", "canceled"].includes(status)) return "failed";
  return status || "running";
}

function findVideoUrl(value) {
  if (!value) return undefined;
  if (typeof value === "string" && (/\.(mp4|webm|mov)(\?|$)/i.test(value) || /^https?:\/\//i.test(value))) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findVideoUrl(item);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value !== "object") return undefined;
  for (const key of ["unsigned_urls", "video_url", "remote_video_url", "download_url", "output_url", "url"]) {
    const found = findVideoUrl(value[key]);
    if (found) return found;
  }
  for (const item of Object.values(value)) {
    const found = findVideoUrl(item);
    if (found) return found;
  }
  return undefined;
}

async function pollTask(apiKey, taskId, label) {
  const headers = getHeaders(apiKey);
  const url = /^https?:\/\//.test(taskId)
    ? taskId
    : taskId.startsWith("/api/")
      ? `https://openrouter.ai${taskId}`
      : `${OPENROUTER_VIDEOS_URL}/${encodeURIComponent(taskId)}`;

  for (let attempt = 1; attempt <= 180; attempt += 1) {
    let task;
    try {
      const response = await fetch(url, { headers, cache: "no-store" });
      task = response.status === 404 ? await curlJson(url, headers) : await response.json();
    } catch {
      task = await curlJson(url, headers);
    }

    const status = normalizeStatus(task);
    const videoUrl = findVideoUrl(task);
    if (status === "succeeded" && videoUrl) return { task, videoUrl };
    if (status === "failed") throw new Error(task?.error?.message || task?.error || JSON.stringify(task));

    console.log(`  ${label} polling ${attempt}: ${status}`);
    await sleep(attempt <= 12 ? 5000 : 15000);
  }
  throw new Error("轮询超过 90 分钟仍未完成");
}

async function downloadVideo(url, filePath, apiKey) {
  const headers = url.startsWith("https://openrouter.ai/api/v1/videos/") ? { Authorization: `Bearer ${apiKey}`, Accept: "video/mp4" } : {};
  const args = ["-sS", "-L", ...Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]), "-o", filePath, url];
  await execFileAsync(process.platform === "win32" ? "curl.exe" : "curl", args, { maxBuffer: 50 * 1024 * 1024 });
}

function readUInt64BE(buffer, offset) {
  return Number(buffer.readBigUInt64BE(offset));
}

function readBoxes(buffer, start, end) {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1 && offset + 16 <= end) {
      size = readUInt64BE(buffer, offset + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) break;
    boxes.push({ type, start: offset, headerSize, end: offset + size });
    offset += size;
  }
  return boxes;
}

function getChild(buffer, box, type) {
  return readBoxes(buffer, box.start + box.headerSize, box.end).find((item) => item.type === type);
}

function isVideoTrack(buffer, trak) {
  const mdia = getChild(buffer, trak, "mdia");
  const hdlr = mdia ? getChild(buffer, mdia, "hdlr") : undefined;
  if (!hdlr) return false;
  const handlerOffset = hdlr.start + hdlr.headerSize + 8;
  return buffer.toString("ascii", handlerOffset, handlerOffset + 4) === "vide";
}

function getVideoDimensions(filePath) {
  const buffer = readFileSync(filePath);
  for (const codec of ["avc1", "hvc1", "hev1", "vp09"]) {
    const codecIndex = buffer.indexOf(codec, 0, "ascii");
    if (codecIndex > 0 && codecIndex + 28 <= buffer.length) {
      const width = buffer.readUInt16BE(codecIndex + 24);
      const height = buffer.readUInt16BE(codecIndex + 26);
      if (width > 0 && height > 0 && width <= 8192 && height <= 8192) return { width, height };
    }
  }
  const moov = readBoxes(buffer, 0, buffer.length).find((box) => box.type === "moov");
  if (!moov) return undefined;
  const traks = readBoxes(buffer, moov.start + moov.headerSize, moov.end).filter((box) => box.type === "trak");
  for (const trak of traks) {
    if (!isVideoTrack(buffer, trak)) continue;
    const tkhd = getChild(buffer, trak, "tkhd");
    if (!tkhd || tkhd.end - tkhd.start < 16) continue;
    const width = buffer.readUInt32BE(tkhd.end - 8) / 65536;
    const height = buffer.readUInt32BE(tkhd.end - 4) / 65536;
    if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) };
  }
  return undefined;
}

function actualRatio(dimensions) {
  if (!dimensions) return "未知";
  const value = dimensions.width / dimensions.height;
  if (Math.abs(value - 16 / 9) <= 0.03) return "16:9";
  if (Math.abs(value - 9 / 16) <= 0.03) return "9:16";
  if (Math.abs(value - 21 / 9) <= 0.03) return "21:9";
  if (Math.abs(value - 3 / 4) <= 0.03) return "3:4";
  if (Math.abs(value - 4 / 3) <= 0.03) return "4:3";
  if (Math.abs(value - 1) <= 0.03) return "1:1";
  return `${dimensions.width}:${dimensions.height}`;
}

function sameSize(actual, expected) {
  if (!actual) return false;
  const [width, height] = expected.split("x").map(Number);
  return Math.abs(actual.width - width) <= 24 && Math.abs(actual.height - height) <= 24;
}

function buildMarkdown(results) {
  const lines = [
    "# 视频模型不传 size 测试结果",
    "",
    `测试时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    "",
    "请求体只传 `resolution + aspect_ratio`，不传 `size`。对照尺寸为上一轮全量测试得到的实际输出尺寸。",
    "",
    "| 模型 | 分辨率 | 比例 | 对照尺寸 | 本轮输出 | 输出比例 | 是否相同 | 文件 | 错误 |",
    "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const result of results) {
    lines.push(`| ${result.label} | ${result.resolution} | ${result.ratio} | ${result.expectedSize} | ${result.outputSize || "失败"} | ${result.outputRatio || "失败"} | ${result.sameAsPrevious || "失败"} | ${result.fileName || ""} | ${result.error || ""} |`);
  }
  lines.push("");
  return lines.join("\n");
}

async function runSingleTest(apiKey, test) {
  const fileName = `${sanitizeFilePart(test.label)}_no-size_${test.ratio.replace(":", "-")}_${test.resolution}.mp4`;
  const filePath = join(OUTPUT_DIR, fileName);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    console.log(`\nTesting ${test.label} no-size attempt ${attempt}/2 -> ${fileName}`);
    try {
      const created = await postVideoTask(apiKey, test, attempt === 1);
      const taskId = getTaskId(created.task);
      if (!taskId) throw new Error("创建成功但没有返回 task id");
      const completed = await pollTask(apiKey, taskId, test.label);
      await downloadVideo(completed.videoUrl, filePath, apiKey);
      const dimensions = getVideoDimensions(filePath);
      const outputSize = dimensions ? `${dimensions.width}x${dimensions.height}` : "无法读取";
      return {
        ...test,
        request: created.requestBody,
        outputSize,
        outputRatio: actualRatio(dimensions),
        sameAsPrevious: sameSize(dimensions, test.expectedSize) ? "一致" : "不一致",
        fileName,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ${test.label} failed attempt ${attempt}: ${message}`);
      if (attempt === 2) return { ...test, error: message };
    }
  }
}

async function main() {
  const apiKey = getEnvValue("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("缺少 OPENROUTER_API_KEY");
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const testCases = tests.flatMap((model) => Object.entries(model.cases).flatMap(([resolution, ratios]) => Object.entries(ratios).map(([ratio, expectedSize]) => ({
    label: model.label,
    model: model.model,
    duration: model.duration,
    resolution,
    ratio,
    expectedSize,
    prompt: getPrompt(ratio, resolution),
  }))));
  const results = await Promise.all(testCases.map((test) => runSingleTest(apiKey, test)));
  writeFileSync(RAW_PATH, JSON.stringify(results, null, 2));
  writeFileSync(RESULTS_PATH, buildMarkdown(results));
  console.log(`\nResults: ${RESULTS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
