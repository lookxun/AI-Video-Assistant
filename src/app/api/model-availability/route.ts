import { NextResponse } from "next/server";
import { bytePlusVideoGenerationModels, frontendImageGenerationModels, videoGenerationModels } from "@/lib/models";
import { isAgentImageModelEnabled, isAgentVideoModelEnabled, isAssetImageModelEnabled, isConversationImageModelEnabled, isConversationVideoModelEnabled } from "@/lib/system-settings";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    imageModels: frontendImageGenerationModels.filter((model) => isConversationImageModelEnabled(model.id)).map((model) => model.id),
    assetImageModels: frontendImageGenerationModels.filter((model) => isAssetImageModelEnabled(model.id)).map((model) => model.id),
    videoModels: [...videoGenerationModels, ...bytePlusVideoGenerationModels].filter((model) => isConversationVideoModelEnabled(model.id)).map((model) => model.id),
    agentImageModels: frontendImageGenerationModels.filter((model) => isAgentImageModelEnabled(model.id)).map((model) => model.id),
    agentVideoModels: [...videoGenerationModels, ...bytePlusVideoGenerationModels].filter((model) => isAgentVideoModelEnabled(model.id)).map((model) => model.id),
  });
}
