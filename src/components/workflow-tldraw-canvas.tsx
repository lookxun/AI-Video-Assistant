"use client";

import dynamic from "next/dynamic";
import type { ModelName } from "@/lib/models";
import type { WorkflowCanvasState, WorkflowNode, WorkflowNodeData, WorkflowEdge, WorkflowNodeKind } from "@/components/workflow-tldraw-canvas-inner";

export type { WorkflowCanvasState, WorkflowNode, WorkflowNodeData, WorkflowEdge, WorkflowNodeKind };

type CreditResult = {
  skipped?: boolean;
  balance?: number;
  chargedCredits?: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    usd?: number;
    cny?: number;
    credits?: number;
  };
};

type WorkflowCanvasProps = {
  workflowId: string;
  value?: WorkflowCanvasState;
  onChange: (next: WorkflowCanvasState) => void;
  workflowTitle: string;
  onCredit?: (credit?: CreditResult) => void;
  onGeneratedMedia?: (media: { nodeId: string; kind: "image" | "video"; urls: string[]; posterUrl?: string; sourcePrompt: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: Record<string, { width: number; height: number }> }) => void;
  onPreviewMedia?: (media: { nodeId: string; kind: "image" | "video"; url: string; posterUrl?: string; name: string; sourcePrompt?: string; model?: ModelName; ratio?: string; resolution?: string; duration?: string; dimensions?: { width: number; height: number } }) => void;
  getImageDisplayUrl?: (url: string) => string;
  getVideoPosterDisplayUrl?: (url: string, posterUrl?: string) => string | undefined;
  enabledImageModelIds?: string[];
  enabledVideoModelIds?: string[];
  leftSidebarVisible?: boolean;
  onToggleLeftSidebar?: () => void;
  workflowAssets?: Array<{ id: string; name: string; url: string; posterUrl?: string; kind: "image" | "video"; nodeId?: string }>;
};

export const WorkflowCanvas = dynamic<WorkflowCanvasProps>(
  () => import("@/components/workflow-tldraw-canvas-inner").then((mod) => mod.WorkflowCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#f3f3f3]" />,
  },
);
