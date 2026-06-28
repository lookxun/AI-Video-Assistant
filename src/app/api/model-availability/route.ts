import { NextResponse } from "next/server";
import { ADVANCED_CHAT_MODEL, DEFAULT_CHAT_MODEL, bytePlusVideoGenerationModels, frontendConversationModels, frontendImageGenerationModels, videoGenerationModels } from "@/lib/models";
import { getModelProviderPreference, isAgentImageModelEnabled, isAgentVideoModelEnabled, isAssetImageModelEnabled, isConversationImageModelEnabled, isConversationVideoModelEnabled, isGeneralTextModelEnabled, isTextModelEnabled } from "@/lib/system-settings";

export const runtime = "nodejs";

export async function GET() {
  const generalModels = frontendConversationModels.filter((model) => isGeneralTextModelEnabled(model.id)).map((model) => model.id);
  const chatModels = [DEFAULT_CHAT_MODEL, ADVANCED_CHAT_MODEL].filter((modelId) => isTextModelEnabled(modelId, "chat"));

  return NextResponse.json({
    generalModels,
    generalModelProviders: Object.fromEntries(generalModels.map((modelId) => [modelId, modelId === "bytedance-seed/seed-2.0-lite" ? getModelProviderPreference("general.seed-2-0-lite") : modelId.startsWith("byteplus:") ? "byteplus" : "openrouter"])),
    chatModels,
    chatModelProviders: Object.fromEntries(chatModels.map((modelId) => [modelId, getModelProviderPreference(modelId === DEFAULT_CHAT_MODEL ? "chat.seed-2-0-lite" : "chat.advanced")])),
    imageModels: frontendImageGenerationModels.filter((model) => isConversationImageModelEnabled(model.id)).map((model) => model.id),
    assetImageModels: frontendImageGenerationModels.filter((model) => isAssetImageModelEnabled(model.id)).map((model) => model.id),
    videoModels: [...videoGenerationModels, ...bytePlusVideoGenerationModels].filter((model) => isConversationVideoModelEnabled(model.id)).map((model) => model.id),
    agentImageModels: frontendImageGenerationModels.filter((model) => isAgentImageModelEnabled(model.id)).map((model) => model.id),
    agentVideoModels: [...videoGenerationModels, ...bytePlusVideoGenerationModels].filter((model) => isAgentVideoModelEnabled(model.id)).map((model) => model.id),
  });
}
