import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { getLocalEnvValue } from "@/lib/system-settings";

type BytePlusAssetAction = "CreateAssetGroup" | "CreateAsset" | "GetAsset" | "ListAssets";

export type BytePlusAssetStatus = "Processing" | "Active" | "Failed";

export type BytePlusAssetResult = {
  Id?: string;
  Name?: string;
  URL?: string;
  AssetType?: "Image" | "Video" | "Audio";
  GroupId?: string;
  Status?: BytePlusAssetStatus;
  Error?: { Code?: string; Message?: string };
  Moderation?: { Strategy?: "Default" | "Skip" };
  CreateTime?: string;
  UpdateTime?: string;
  ProjectName?: string;
};

const BYTEPLUS_ASSET_REGION = "ap-southeast-1";
const BYTEPLUS_ASSET_SERVICE = "ark";
const BYTEPLUS_ASSET_HOST = "ark.ap-southeast-1.byteplusapi.com";
const BYTEPLUS_ASSET_VERSION = "2024-01-01";
const ASSET_GROUP_CACHE_PATH = join(process.cwd(), ".runtime", "byteplus-asset-group.json");

function getCredential(name: string) {
  return getLocalEnvValue(name) ?? process.env[name] ?? "";
}

function getBytePlusAccessKey() {
  return getCredential("BYTEPLUS_ACCESS_KEY") || getCredential("BYTEPLUS_AK") || getCredential("BYTEPLUS_ASSET_ACCESS_KEY");
}

function getBytePlusSecretKey() {
  return getCredential("BYTEPLUS_SECRET_KEY") || getCredential("BYTEPLUS_SK") || getCredential("BYTEPLUS_TK") || getCredential("BYTEPLUS_ASSET_SECRET_KEY");
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getAmzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function signBytePlusAssetRequest(action: BytePlusAssetAction, bodyText: string) {
  const accessKey = getBytePlusAccessKey();
  const secretKey = getBytePlusSecretKey();
  if (!accessKey || !secretKey) throw new Error("缺少 BytePlus 素材库 AK/SK");

  const xDate = getAmzDate();
  const date = xDate.slice(0, 8);
  const query = `Action=${encodeURIComponent(action)}&Version=${encodeURIComponent(BYTEPLUS_ASSET_VERSION)}`;
  const payloadHash = sha256Hex(bodyText);
  const canonicalHeaders = [
    "content-type:application/json",
    `host:${BYTEPLUS_ASSET_HOST}`,
    `x-content-sha256:${payloadHash}`,
    `x-date:${xDate}`,
  ].join("\n");
  const signedHeaders = "content-type;host;x-content-sha256;x-date";
  const canonicalRequest = ["POST", "/", query, canonicalHeaders, "", signedHeaders, payloadHash].join("\n");
  const credentialScope = `${date}/${BYTEPLUS_ASSET_REGION}/${BYTEPLUS_ASSET_SERVICE}/request`;
  const stringToSign = ["HMAC-SHA256", xDate, credentialScope, sha256Hex(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(secretKey, date), BYTEPLUS_ASSET_REGION), BYTEPLUS_ASSET_SERVICE), "request");
  const signature = hmacHex(signingKey, stringToSign);

  return {
    url: `https://${BYTEPLUS_ASSET_HOST}/?${query}`,
    headers: {
      "Content-Type": "application/json",
      "Host": BYTEPLUS_ASSET_HOST,
      "X-Date": xDate,
      "X-Content-Sha256": payloadHash,
      "Authorization": `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

async function requestBytePlusAsset<T>(action: BytePlusAssetAction, body: Record<string, unknown>) {
  const bodyText = JSON.stringify(body);
  const signed = signBytePlusAssetRequest(action, bodyText);
  const response = await fetch(signed.url, { method: "POST", headers: signed.headers, body: bodyText, cache: "no-store" });
  const text = await response.text();
  const data = text ? JSON.parse(text) as { ResponseMetadata?: { Error?: { Code?: string; Message?: string } }; Result?: T } : {};
  const error = data.ResponseMetadata?.Error;
  if (!response.ok || error) throw new Error(error?.Message || `BytePlus 素材库接口失败：${response.status}`);
  return data.Result as T;
}

async function readCachedAssetGroupId() {
  const envGroupId = getCredential("BYTEPLUS_ASSET_GROUP_ID");
  if (envGroupId) return envGroupId;
  if (!existsSync(ASSET_GROUP_CACHE_PATH)) return undefined;
  try {
    const data = JSON.parse(await readFile(ASSET_GROUP_CACHE_PATH, "utf8")) as { groupId?: string };
    return data.groupId;
  } catch {
    return undefined;
  }
}

async function writeCachedAssetGroupId(groupId: string) {
  await mkdir(dirname(ASSET_GROUP_CACHE_PATH), { recursive: true });
  await writeFile(ASSET_GROUP_CACHE_PATH, JSON.stringify({ groupId, updatedAt: new Date().toISOString() }, null, 2));
}

export async function getOrCreateBytePlusAssetGroup() {
  const cached = await readCachedAssetGroupId();
  if (cached) return cached;

  const result = await requestBytePlusAsset<{ Id?: string }>("CreateAssetGroup", {
    Name: "FlashMuse Assets",
    Description: "FlashMuse generated and uploaded assets",
    GroupType: "AIGC",
    ProjectName: getCredential("BYTEPLUS_ASSET_PROJECT_NAME") || "default",
  });
  if (!result?.Id) throw new Error("BytePlus 没有返回素材组 ID");
  await writeCachedAssetGroupId(result.Id);
  return result.Id;
}

export async function createBytePlusAsset(input: { url: string; name?: string; assetType?: "Image" | "Video" | "Audio"; moderationStrategy?: "Default" | "Skip" }) {
  const groupId = await getOrCreateBytePlusAssetGroup();
  const result = await requestBytePlusAsset<{ Id?: string }>("CreateAsset", {
    GroupId: groupId,
    URL: input.url,
    Name: (input.name || "FlashMuse asset").slice(0, 64),
    AssetType: input.assetType ?? "Image",
    Moderation: { Strategy: input.moderationStrategy ?? "Skip" },
    ProjectName: getCredential("BYTEPLUS_ASSET_PROJECT_NAME") || "default",
  });
  if (!result?.Id) throw new Error("BytePlus 没有返回素材 ID");
  return { id: result.Id, groupId };
}

export async function getBytePlusAsset(id: string) {
  return requestBytePlusAsset<BytePlusAssetResult>("GetAsset", {
    Id: id,
    ProjectName: getCredential("BYTEPLUS_ASSET_PROJECT_NAME") || "default",
  });
}
