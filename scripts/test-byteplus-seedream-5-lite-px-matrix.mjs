import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/images/generations";
const OUTPUT_DIR = join(process.cwd(), "FlashMuse_Agent_Project Planning", "test");
const IMAGE_DIR = join(OUTPUT_DIR, "byteplus-seedream-5-lite-px-images");
const MD_OUTPUT = join(OUTPUT_DIR, "byteplus-seedream-5-lite-px-size-test-results.md");
const RAW_OUTPUT = join(OUTPUT_DIR, "byteplus-seedream-5-lite-px-size-test-raw.json");

const MODEL_LABEL = "BytePlus Seedream 5.0 Lite";
const MODEL = "seedream-5-0-260128";
const OUTPUT_FORMAT = "jpeg";

const sizeMatrix = [
  { ratio: "16:9", resolution: "2K", size: "2848x1600" },
  { ratio: "16:9", resolution: "4K", size: "5504x3040" },
  { ratio: "9:16", resolution: "2K", size: "1600x2848" },
  { ratio: "9:16", resolution: "4K", size: "3040x5504" },
  { ratio: "1:1", resolution: "2K", size: "2048x2048" },
  { ratio: "1:1", resolution: "4K", size: "4096x4096" },
  { ratio: "4:3", resolution: "2K", size: "2304x1728" },
  { ratio: "4:3", resolution: "4K", size: "4704x3520" },
  { ratio: "3:4", resolution: "2K", size: "1728x2304" },
  { ratio: "3:4", resolution: "4K", size: "3520x4704" },
  { ratio: "21:9", resolution: "2K", size: "3136x1344" },
  { ratio: "21:9", resolution: "4K", size: "6240x2656" },
];

function parseEnvValue(value) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    } catch {}
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

function readEnvValue(name) {
  for (const file of [".env.local", ".env"]) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    const line = readFileSync(path, "utf8").split(/\r?\n/).find((item) => item.startsWith(`${name}=`));
    const value = parseEnvValue(line?.split("=").slice(1).join("="));
    if (value) return value;
  }
  return process.env[name];
}

function readBytePlusKey() {
  const envKey = readEnvValue("BYTEPLUS_API_KEY") ?? readEnvValue("ARK_API_KEY");
  if (envKey) return envKey;

  const docPath = "E:\\project\\【1】Api key\\Byteplus\\Byteplus.md";
  if (!existsSync(docPath)) return undefined;
  return readFileSync(docPath, "utf8").match(/ark-[a-z0-9-]+/i)?.[0];
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return undefined;
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5)];
    offset += 2 + length;
  }
  return undefined;
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return undefined;
  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X") return [1 + buffer.readUIntLE(24, 3), 1 + buffer.readUIntLE(27, 3)];
  if (format === "VP8 ") return [buffer.readUInt16LE(26) & 0x3fff, buffer.readUInt16LE(28) & 0x3fff];
  if (format === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return undefined;
}

function extensionForBuffer(buffer, contentType) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpg";
  if (buffer.toString("ascii", 1, 4) === "PNG") return "png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) return "jpg";
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  return "bin";
}

async function downloadImage(url, filenameBase) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(300000) });
  if (!response.ok) throw new Error(`download ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const actual = pngDimensions(buffer) ?? jpegDimensions(buffer) ?? webpDimensions(buffer);
  const extension = extensionForBuffer(buffer, response.headers.get("content-type"));
  const relativeImagePath = join("byteplus-seedream-5-lite-px-images", `${filenameBase}.${extension}`).replaceAll("\\", "/");
  writeFileSync(join(OUTPUT_DIR, relativeImagePath), buffer);
  return { actual, relativeImagePath, bytes: buffer.length, contentType: response.headers.get("content-type") };
}

function promptForRatio(ratio) {
  return `Generate a clean product photo of one red apple centered on a plain light gray background. The final image composition must be ${ratio} aspect ratio. No text, no watermark, no border.`;
}

async function generateOne(apiKey, item) {
  const body = {
    model: MODEL,
    prompt: promptForRatio(item.ratio),
    size: item.size,
    watermark: false,
    output_format: OUTPUT_FORMAT,
  };
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(900000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(data.error?.message ?? text.slice(0, 500));

  const image = data.data?.[0];
  const url = image?.url;
  if (!url) throw new Error(`no image returned: ${JSON.stringify(data).slice(0, 500)}`);

  const filenameBase = `${MODEL}_${item.ratio.replace(":", "x")}_${item.resolution}_${item.size}`;
  const downloaded = await downloadImage(url, filenameBase);
  return {
    request: body,
    response: {
      model: data.model,
      created: data.created,
      size: image.size,
      url,
      usage: data.usage,
    },
    ...downloaded,
  };
}

function markdownRow(cells) {
  return `| ${cells.map((cell) => String(cell ?? "").replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`;
}

function writeOutputs(records) {
  const rows = [];
  rows.push("# BytePlus Seedream 5.0 Lite px 尺寸实测结果");
  rows.push("");
  rows.push(`测试时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`);
  rows.push("");
  rows.push(`模型：\`${MODEL}\``);
  rows.push(`请求格式：\`output_format=${OUTPUT_FORMAT}\``);
  rows.push("请求方式：`size` 直接传具体 `WIDTHxHEIGHT` px，不传单独 `aspect_ratio`。");
  rows.push(`图片目录：\`${IMAGE_DIR}\``);
  rows.push("");
  rows.push(markdownRow(["比例", "档位", "请求 size", "响应 size", "实读尺寸", "输出比例", "本地图片", "usage", "结果"]));
  rows.push(markdownRow(["---", "---", "---", "---", "---", "---", "---", "---", "---"]));

  for (const item of records) {
    const actualText = item.actual ? `${item.actual[0]}×${item.actual[1]}` : "--";
    const outputRatio = item.actual ? (item.actual[0] / item.actual[1]).toFixed(4) : "--";
    const usage = item.response?.usage ? `total=${item.response.usage.total_tokens ?? "--"}; output=${item.response.usage.output_tokens ?? "--"}; images=${item.response.usage.generated_images ?? "--"}` : "--";
    rows.push(markdownRow([item.ratio, item.resolution, item.size, item.response?.size ?? "--", actualText, outputRatio, item.relativeImagePath ?? "--", usage, item.error ? `失败：${item.error}` : "成功"]));
  }

  writeFileSync(MD_OUTPUT, `${rows.join("\n")}\n`, "utf8");
  writeFileSync(RAW_OUTPUT, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

const apiKey = readBytePlusKey();
if (!apiKey) throw new Error("Missing BYTEPLUS_API_KEY / ARK_API_KEY");
mkdirSync(IMAGE_DIR, { recursive: true });

const records = existsSync(RAW_OUTPUT) ? JSON.parse(readFileSync(RAW_OUTPUT, "utf8")) : [];
const recordMap = new Map(records.map((record, index) => [`${record.ratio}:${record.resolution}:${record.size}`, { record, index }]));
writeOutputs(records);

for (const item of sizeMatrix) {
  const key = `${item.ratio}:${item.resolution}:${item.size}`;
  const existing = recordMap.get(key);
  if (existing?.record && !existing.record.error) {
    console.log(`Skipping ${MODEL_LABEL} ${item.ratio} ${item.resolution} ${item.size}`);
    continue;
  }

  process.stdout.write(`Testing ${MODEL_LABEL} ${item.ratio} ${item.resolution} ${item.size} ... `);
  const record = { modelLabel: MODEL_LABEL, model: MODEL, ...item, prompt: promptForRatio(item.ratio) };
  try {
    const result = await generateOne(apiKey, item);
    Object.assign(record, result);
    console.log(record.actual ? `${record.actual[0]}x${record.actual[1]} -> ${record.relativeImagePath}` : `ok -> ${record.relativeImagePath}`);
  } catch (error) {
    record.error = error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
    console.log("FAILED", record.error.slice(0, 160));
  }
  if (existing) {
    records[existing.index] = record;
  } else {
    recordMap.set(key, { record, index: records.length });
    records.push(record);
  }
  writeOutputs(records);
}

console.log(`Wrote ${MD_OUTPUT}`);
