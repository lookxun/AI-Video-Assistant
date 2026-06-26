import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OPENROUTER_VIDEOS_URL = "https://openrouter.ai/api/v1/videos";
const OUTPUT_DIR = join(process.cwd(), "FlashMuse_Agent_Project Planning", "test");
const RESULTS_PATH = join(OUTPUT_DIR, "video-model-test-results.md");
const RAW_PATH = join(OUTPUT_DIR, "video-model-test-raw.json");

const tests = [
  {
    label: "Seedance 2.0 Fast",
    model: "bytedance/seedance-2.0-fast",
    duration: 5,
    sizes: {
      "480p": { "21:9": "1120x480", "16:9": "854x480", "4:3": "640x480", "1:1": "480x480", "3:4": "480x640", "9:16": "480x854", "9:21": "480x1120" },
      "720p": { "21:9": "1680x720", "16:9": "1280x720", "4:3": "960x720", "1:1": "720x720", "3:4": "720x960", "9:16": "720x1280", "9:21": "720x1680" },
    },
  },
  {
    label: "Seedance 2.0",
    model: "bytedance/seedance-2.0",
    duration: 5,
    sizes: {
      "480p": { "21:9": "1120x480", "16:9": "854x480", "4:3": "640x480", "1:1": "480x480", "3:4": "480x640", "9:16": "480x854", "9:21": "480x1120" },
      "720p": { "21:9": "1680x720", "16:9": "1280x720", "4:3": "960x720", "1:1": "720x720", "3:4": "720x960", "9:16": "720x1280", "9:21": "720x1680" },
      "1080p": { "21:9": "2520x1080", "16:9": "1920x1080", "4:3": "1440x1080", "1:1": "1080x1080", "3:4": "1080x1440", "9:16": "1080x1920" },
    },
  },
  {
    label: "Kling v3.0 Standard",
    model: "kwaivgi/kling-v3.0-std",
    duration: 5,
    sizes: { "720p": { "16:9": "1280x720", "1:1": "720x720", "9:16": "720x1280" } },
  },
  {
    label: "Kling v3.0 Pro",
    model: "kwaivgi/kling-v3.0-pro",
    duration: 5,
    sizes: { "720p": { "16:9": "1280x720", "1:1": "720x720", "9:16": "720x1280" } },
  },
  {
    label: "Kling Video O1",
    model: "kwaivgi/kling-video-o1",
    duration: 5,
    sizes: { "720p": { "16:9": "1280x720", "1:1": "720x720", "9:16": "720x1280" } },
  },
  {
    label: "Veo 3.1",
    model: "google/veo-3.1",
    duration: 4,
    sizes: {
      "720p": { "16:9": "1280x720", "9:16": "720x1280" },
      "1080p": { "16:9": "1920x1080", "9:16": "1080x1920" },
      "4K": { "16:9": "3840x2160", "9:16": "2160x3840" },
    },
  },
];

const promptSubjects = {
  "21:9": "an ultra-wide desert canyon chase with two small hoverbikes weaving between red stone arches, long dust trails, layered mountains on the horizon",
  "16:9": "a fictional young explorer in a red raincoat walking through a rainy neon alley with a small white robot dog beside her, reflections on wet pavement",
  "4:3": "a vintage steam train crossing a snowy mountain bridge at dusk, warm cabin lights glowing through drifting smoke",
  "1:1": "a tiny robot chef cooking glowing noodles in a cozy cyberpunk kitchen, steam rising from the bowl and moving neon reflections on metal props",
  "3:4": "a mechanical owl landing on a mossy stone pillar inside an ancient greenhouse, glass roof beams, swaying leaves, glowing eyes",
  "9:16": "a futuristic dancer in a silver jacket performing slow precise moves on a rooftop at sunrise, wind moving hair and fabric, city skyline behind",
  "9:21": "a tall fantasy elevator shaft with a glowing glass capsule rising past hanging gardens, drifting mist, tiny maintenance drones moving vertically",
};

const resolutionDirectives = {
  "480p": "Prioritize clear silhouette, readable motion, stable subject identity, and clean composition despite low resolution.",
  "720p": "Balance detailed textures, natural camera movement, subject consistency, and background depth.",
  "1080p": "Show fine details, consistent small moving elements, realistic lighting transitions, and no object morphing.",
  "4K": "Emphasize high-detail surfaces, distant background detail, stable edges, natural motion blur, and cinematic lighting.",
};

function getPrompt(ratio, resolution) {
  return `Cinematic video test for ${resolution} ${ratio}: ${promptSubjects[ratio]}. ${resolutionDirectives[resolution]} Camera movement should match the frame: ${ratio === "21:9" ? "slow horizontal pan" : ratio === "9:21" ? "smooth vertical crane movement" : ratio === "9:16" || ratio === "3:4" ? "slow upward tilt" : ratio === "4:3" ? "side tracking shot" : ratio === "1:1" ? "slow centered push-in" : "slow dolly backward"}. Natural physical motion, stable geometry, consistent subject design, detailed environment, no text, no subtitles, no watermark.`;
}

const MAX_RETRIES = 2;

const testCases = tests.flatMap((model) =>
  Object.entries(model.sizes).flatMap(([resolution, ratios]) =>
    Object.entries(ratios).map(([ratio, size]) => ({
      label: model.label,
      model: model.model,
      duration: model.duration,
      resolution,
      ratio,
      size,
      prompt: getPrompt(ratio, resolution),
    })),
  ),
);

function getEnvValue(name) {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return process.env[name];

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((item) => item.startsWith(`${name}=`));

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

  if (!response.ok) {
    const message = data?.error?.message || text;
    if (generateAudio && test.model !== "openai/sora-2-pro" && /audio|generate_audio|sound|voice/i.test(message)) {
      return postVideoTask(apiKey, test, false);
    }
    throw new Error(message);
  }

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
      if (response.status === 404) {
        task = await curlJson(url, headers);
      } else {
        task = await response.json();
      }
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
  if (Object.keys(headers).length > 0) {
    const args = ["-sS", "-L", ...Object.entries(headers).flatMap(([key, value]) => ["-H", `${key}: ${value}`]), "-o", filePath, url];
    await execFileAsync(process.platform === "win32" ? "curl.exe" : "curl", args, { maxBuffer: 50 * 1024 * 1024 });
    return;
  }

  const response = await fetch(url, { headers });
  if (response.ok) {
    const arrayBuffer = await response.arrayBuffer();
    writeFileSync(filePath, Buffer.from(arrayBuffer));
    return;
  }

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
  if (Math.abs(value - 9 / 21) <= 0.03) return "9:21";
  if (Math.abs(value - 3 / 4) <= 0.03) return "3:4";
  if (Math.abs(value - 4 / 3) <= 0.03) return "4:3";
  if (Math.abs(value - 1) <= 0.03) return "1:1";
  return `${dimensions.width}:${dimensions.height}`;
}

function isSizeMatch(dimensions, requestedSize) {
  if (!dimensions) return false;
  const [width, height] = requestedSize.split("x").map(Number);
  return Math.abs(dimensions.width - width) <= 24 && Math.abs(dimensions.height - height) <= 24;
}

function yesNo(value) {
  return value ? "一致" : "不一致";
}

function buildMarkdown(results) {
  const lines = [
    "# 视频模型测试结果",
    "",
    `测试时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    "",
    "## 分辨率 + 比例提示词",
    "",
    ...Array.from(new Map(testCases.map((item) => [`${item.resolution} ${item.ratio}`, item])).values()).flatMap((item) => [`### ${item.resolution} ${item.ratio}`, "", item.prompt, ""]),
    "## 参数一致性",
    "",
    "| 模型 | 请求比例 | 请求分辨率 | 请求尺寸 | 请求时长 | 输出尺寸 | 输出比例 | 比例是否一致 | 尺寸是否一致 | 文件 | 错误 |",
    "|---|---|---|---|---:|---|---|---|---|---|---|",
  ];

  for (const result of results) {
    lines.push(
      `| ${result.label} | ${result.request.ratio} | ${result.request.resolution} | ${result.request.size || ""} | ${result.request.duration}秒 | ${result.outputSize || "失败"} | ${result.outputRatio || "失败"} | ${result.ratioMatch || "失败"} | ${result.sizeMatch || "失败"} | ${result.fileName || ""} | ${result.error || ""} |`,
    );
  }

  lines.push("", "说明：Windows 文件名不能包含 `:` 和 `/`，所以比例文件名使用 `16-9`。", "");
  return lines.join("\n");
}

function createSuccessResult(test, request, dimensions, fileName, attempts, rawTask) {
  const outputSize = dimensions ? `${dimensions.width}x${dimensions.height}` : "无法读取";
  const outputRatio = actualRatio(dimensions);
  const ratioMatch = yesNo(outputRatio === test.ratio);
  const sizeMatch = yesNo(isSizeMatch(dimensions, test.size));

  return {
    label: test.label,
    model: test.model,
    request,
    outputSize,
    outputRatio,
    ratioMatch,
    sizeMatch,
    fileName,
    attempts,
    rawTask,
  };
}

async function runSingleTest(apiKey, test, results, previousResults) {
  const fileName = `${sanitizeFilePart(test.label)}_${test.ratio.replace(":", "-")}_${test.resolution}.mp4`;
  const filePath = join(OUTPUT_DIR, fileName);
  const previous = previousResults.find((item) => item.label === test.label && item.request?.ratio === test.ratio && item.request?.resolution === test.resolution && item.rawTask);

  if (previous) {
    const previousUrl = findVideoUrl(previous.rawTask);
    if (previousUrl) {
      try {
        console.log(`\nRe-downloading ${test.label} -> ${fileName}`);
        await downloadVideo(previousUrl, filePath, apiKey);
        const dimensions = getVideoDimensions(filePath);
      const result = createSuccessResult(test, previous.request, dimensions, fileName, previous.attempts ?? 1, previous.rawTask);
        results.push(result);
        writeFileSync(RAW_PATH, JSON.stringify(results, null, 2));
        writeFileSync(RESULTS_PATH, buildMarkdown(results));
        return result;
      } catch (error) {
        console.log(`  ${test.label} re-download failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    console.log(`\nTesting ${test.label} attempt ${attempt}/${MAX_RETRIES + 1} -> ${fileName}`);

    try {
      const created = await postVideoTask(apiKey, test, true);
      const taskId = getTaskId(created.task);
      if (!taskId) throw new Error("创建成功但没有返回 task id");

      const completed = await pollTask(apiKey, taskId, test.label);
      await downloadVideo(completed.videoUrl, filePath, apiKey);

      const dimensions = getVideoDimensions(filePath);
      const result = createSuccessResult(test, { ratio: test.ratio, resolution: test.resolution, size: test.size, duration: created.requestBody.duration, generateAudio: created.requestBody.generate_audio }, dimensions, fileName, attempt, completed.task);
      results.push(result);
      writeFileSync(RAW_PATH, JSON.stringify(results, null, 2));
      writeFileSync(RESULTS_PATH, buildMarkdown(results));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ${test.label} failed attempt ${attempt}: ${message}`);

      if (attempt > MAX_RETRIES) {
        const result = {
          label: test.label,
          model: test.model,
          request: { ratio: test.ratio, resolution: test.resolution, size: test.size, duration: test.duration },
          attempts: attempt,
          error: message,
        };
        results.push(result);
        writeFileSync(RAW_PATH, JSON.stringify(results, null, 2));
        writeFileSync(RESULTS_PATH, buildMarkdown(results));
        return result;
      }
    }
  }
}

async function main() {
  const apiKey = getEnvValue("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("缺少 OPENROUTER_API_KEY");
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results = [];
  await Promise.all(testCases.map((test) => runSingleTest(apiKey, test, results, [])));

  console.log(`\nResults: ${RESULTS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
