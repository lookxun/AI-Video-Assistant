import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API_URL = "https://ark.ap-southeast.bytepluses.com/api/v3/images/generations";
const OUTPUT_DIR = join(process.cwd(), "AI-Video-Assistant_Project Planning", "test");
const MD_OUTPUT = join(OUTPUT_DIR, "byteplus-image-size-test-results.md");
const RAW_OUTPUT = join(OUTPUT_DIR, "byteplus-image-size-test-raw.json");

const models = [
  { label: "BytePlus Seedream 4.5", model: "seedream-4-5-251128" },
  { label: "BytePlus Seedream 5.0", model: "seedream-5-0-260128" },
];

const sizes = ["1K", "2K", "4K"];
const ratios = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];

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

async function dimensionsFromUrl(url) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`download ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return pngDimensions(buffer) ?? jpegDimensions(buffer) ?? webpDimensions(buffer);
}

function promptForRatio(ratio) {
  return `Generate a clean product photo of one red apple centered on a plain light gray background. The final image composition must be ${ratio} aspect ratio. No text, no watermark, no border.`;
}

function shouldUseOutputFormat(model) {
  return model.model === "seedream-5-0-260128";
}

async function generateOne(apiKey, model, size, ratio) {
  const body = {
    model: model.model,
    prompt: promptForRatio(ratio),
    size,
    watermark: false,
  };
  if (shouldUseOutputFormat(model)) body.output_format = "png";
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!response.ok) throw new Error(data.error?.message ?? text.slice(0, 500));

  const item = data.data?.[0];
  const url = item?.url;
  if (!url) throw new Error(`no image returned: ${JSON.stringify(data).slice(0, 500)}`);
  const actual = await dimensionsFromUrl(url);
  return {
    request: body,
    response: {
      model: data.model,
      created: data.created,
      size: item.size,
      url,
      usage: data.usage,
    },
    actual,
  };
}

function markdownRow(cells) {
  return `| ${cells.map((cell) => String(cell ?? "").replace(/\n/g, " ").replace(/\|/g, "\\|")).join(" | ")} |`;
}

function writeOutputs(records) {
  const rows = [];
  rows.push("# BytePlus 图片模型尺寸实测结果");
  rows.push("");
  rows.push(`测试时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`);
  rows.push("");
  rows.push("说明：BytePlus 图片接口文档未提供单独比例字段，本测试只传 `model / prompt / size / watermark`，Seedream 5.0 额外传 `output_format=png`。比例仅写入提示词，用于观察模型是否按提示词输出对应比例。");
  rows.push("");
  rows.push(markdownRow(["模型", "提示比例", "请求 size", "响应 size", "实读尺寸", "输出比例", "usage", "结果"]));
  rows.push(markdownRow(["---", "---", "---", "---", "---", "---", "---", "---"]));

  for (const item of records) {
    const actualText = item.actual ? `${item.actual[0]}×${item.actual[1]}` : "--";
    const outputRatio = item.actual ? (item.actual[0] / item.actual[1]).toFixed(4) : "--";
    const usage = item.response?.usage ? `total=${item.response.usage.total_tokens ?? "--"}; output=${item.response.usage.output_tokens ?? "--"}; images=${item.response.usage.generated_images ?? "--"}` : "--";
    rows.push(markdownRow([item.modelLabel, item.ratio, item.size, item.response?.size ?? "--", actualText, outputRatio, usage, item.error ? `失败：${item.error}` : "成功"]));
  }

  writeFileSync(MD_OUTPUT, `${rows.join("\n")}\n`, "utf8");
  writeFileSync(RAW_OUTPUT, `${JSON.stringify(records, null, 2)}\n`, "utf8");
}

const apiKey = readBytePlusKey();
if (!apiKey) throw new Error("Missing BYTEPLUS_API_KEY / ARK_API_KEY");

const records = existsSync(RAW_OUTPUT) ? JSON.parse(readFileSync(RAW_OUTPUT, "utf8")) : [];
const recordMap = new Map(records.map((record, index) => [`${record.model}:${record.ratio}:${record.size}`, { record, index }]));
writeOutputs(records);

function shouldSkipExisting(record) {
  if (!record) return false;
  if (!record.error) return true;
  if (record.model === "seedream-4-5-251128" && /output_format/i.test(record.error)) return false;
  return true;
}

for (const model of models) {
  for (const ratio of ratios) {
    for (const size of sizes) {
      const key = `${model.model}:${ratio}:${size}`;
      const existing = recordMap.get(key);
      if (shouldSkipExisting(existing?.record)) {
        console.log(`Skipping ${model.label} ${ratio} ${size}`);
        continue;
      }

      process.stdout.write(`Testing ${model.label} ${ratio} ${size} ... `);
      const record = { modelLabel: model.label, model: model.model, ratio, size, prompt: promptForRatio(ratio) };
      try {
        const result = await generateOne(apiKey, model, size, ratio);
        Object.assign(record, result);
        console.log(record.actual ? `${record.actual[0]}x${record.actual[1]}` : "ok");
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
  }
}

console.log(`Wrote ${MD_OUTPUT}`);
