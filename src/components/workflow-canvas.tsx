"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import { RiAddLine, RiArrowRightLine, RiCloseLine, RiCursorLine, RiFocus3Line, RiHand, RiImageAiLine, RiLoader4Line, RiPlayLine, RiTBoxLine, RiVideoLine, RiZoomInLine, RiZoomOutLine } from "react-icons/ri";
import { DEFAULT_IMAGE_MODEL, getSupportedImageResolutions, imageGenerationModels, normalizeImageResolutionForModel, type ModelName } from "@/lib/models";
import { toUserErrorMessage } from "@/lib/error-message";

export type WorkflowNodeKind = "text" | "image" | "video";

export type WorkflowNodeData = {
  text?: string;
  prompt?: string;
  model?: ModelName;
  ratio?: string;
  resolution?: string;
  images?: string[];
  videoUrl?: string;
  error?: string;
  isRunning?: boolean;
};

export type WorkflowNode = {
  id: string;
  kind: WorkflowNodeKind;
  title: string;
  x: number;
  y: number;
  data: WorkflowNodeData;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
};

export type WorkflowCanvasState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
};

type CreditResult = {
  skipped?: boolean;
  balance?: number;
  chargedCredits?: number;
};

type WorkflowCanvasProps = {
  workflowId: string;
  value?: WorkflowCanvasState;
  onChange: (next: WorkflowCanvasState) => void;
  workflowTitle: string;
  onCredit?: (credit?: CreditResult) => void;
};

type DragState = {
  nodeId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type PanState = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

const NODE_WIDTH = 280;
const NODE_HEIGHT_ESTIMATE = 260;
const NODE_HEADER_HEIGHT = 42;
const DEFAULT_STATE: WorkflowCanvasState = { nodes: [], edges: [] };
const ratioOptions = ["智能比例", "16:9", "4:3", "1:1", "3:4", "9:16", "21:9"];

function normalizeZoom(value: number) {
  const clamped = Math.min(1.8, Math.max(0.4, value));
  if (Math.abs(clamped - 1) <= 0.04) return 1;
  return Number(clamped.toFixed(2));
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeState(value?: WorkflowCanvasState): WorkflowCanvasState {
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return DEFAULT_STATE;
  const nodes = value.nodes
    .filter((node) => node && typeof node.id === "string" && (node.kind === "text" || node.kind === "image" || node.kind === "video"))
    .map((node) => ({
      ...node,
      title: typeof node.title === "string" && node.title.trim() ? node.title : getNodeLabel(node.kind),
      x: Number.isFinite(node.x) ? node.x : 160,
      y: Number.isFinite(node.y) ? node.y : 120,
      data: node.data && typeof node.data === "object" ? node.data : {},
    }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = value.edges.filter((edge) => edge && nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const viewport = value.viewport && typeof value.viewport === "object"
    ? {
        x: Number.isFinite(value.viewport.x) ? value.viewport.x : 0,
        y: Number.isFinite(value.viewport.y) ? value.viewport.y : 0,
        zoom: normalizeZoom(Number.isFinite(value.viewport.zoom) ? value.viewport.zoom : 1),
      }
    : undefined;
  return { nodes, edges, viewport };
}

function getNodeLabel(kind: WorkflowNodeKind) {
  if (kind === "text") return "文本节点";
  if (kind === "image") return "图片生成";
  return "视频生成";
}

function getNodeIcon(kind: WorkflowNodeKind) {
  if (kind === "text") return RiTBoxLine;
  if (kind === "image") return RiImageAiLine;
  return RiVideoLine;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw data;
  return data as T;
}

export function WorkflowCanvas({ workflowId, value, onChange, workflowTitle, onCredit }: WorkflowCanvasProps) {
  const state = useMemo(() => normalizeState(value), [value]);
  const [tool, setTool] = useState<"select" | "pan">("select");
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const [pan, setPan] = useState(() => ({ x: state.viewport?.x ?? 0, y: state.viewport?.y ?? 0 }));
  const [zoom, setZoom] = useState(() => state.viewport?.zoom ?? 1);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string>("");
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const effectiveTool = isSpaceDown ? "pan" : tool;

  useEffect(() => {
    setPan({ x: state.viewport?.x ?? 0, y: state.viewport?.y ?? 0 });
    setZoom(state.viewport?.zoom ?? 1);
  }, [workflowId]);

  useEffect(() => {
    const current = state.viewport ?? { x: 0, y: 0, zoom: 1 };
    if (current.x === pan.x && current.y === pan.y && current.zoom === zoom) return;
    onChange({ ...state, viewport: { x: pan.x, y: pan.y, zoom } });
  }, [pan.x, pan.y, zoom]);

  const updateState = (updater: (current: WorkflowCanvasState) => WorkflowCanvasState) => {
    onChange(updater(state));
  };

  const addNode = (kind: WorkflowNodeKind) => {
    const index = state.nodes.length;
    const defaultModel = imageGenerationModels.some((model) => model.id === DEFAULT_IMAGE_MODEL) ? DEFAULT_IMAGE_MODEL : imageGenerationModels[0]?.id ?? DEFAULT_IMAGE_MODEL;
    const resolution = normalizeImageResolutionForModel(defaultModel, getSupportedImageResolutions(defaultModel)[0]);
    const node: WorkflowNode = {
      id: createId("workflow_node"),
      kind,
      title: getNodeLabel(kind),
      x: 160 + (index % 3) * 340,
      y: 120 + Math.floor(index / 3) * 220,
      data: kind === "image" ? { model: defaultModel, ratio: "智能比例", resolution, prompt: "" } : kind === "text" ? { text: "" } : { prompt: "" },
    };
    updateState((current) => ({ ...current, nodes: [...current.nodes, node] }));
  };

  const updateNode = (nodeId: string, patch: Partial<WorkflowNodeData>) => {
    updateState((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)),
    }));
  };

  const deleteNode = (nodeId: string) => {
    updateState((current) => ({
      nodes: current.nodes.filter((node) => node.id !== nodeId),
      edges: current.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    }));
    if (connectingFrom === nodeId) setConnectingFrom("");
  };

  const connectTo = (targetId: string) => {
    if (!connectingFrom || connectingFrom === targetId) return;
    updateState((current) => {
      if (current.edges.some((edge) => edge.source === connectingFrom && edge.target === targetId)) return current;
      return { ...current, edges: [...current.edges, { id: createId("workflow_edge"), source: connectingFrom, target: targetId }] };
    });
    setConnectingFrom("");
  };

  const startDrag = (node: WorkflowNode, event: ReactPointerEvent<HTMLDivElement>) => {
    if (effectiveTool === "pan") return;
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ nodeId: node.id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y });
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panState) {
      setPan({ x: panState.originX + event.clientX - panState.startX, y: panState.originY + event.clientY - panState.startY });
      return;
    }
    if (!dragState) return;
    const nextX = dragState.originX + (event.clientX - dragState.startX) / zoom;
    const nextY = dragState.originY + (event.clientY - dragState.startY) / zoom;
    updateState((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === dragState.nodeId ? { ...node, x: nextX, y: nextY } : node)),
    }));
  };

  const endDrag = () => {
    setDragState(null);
    setPanState(null);
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (effectiveTool !== "pan") return;
    if ((event.target as HTMLElement).closest("button,input,textarea,select")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanState({ startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y });
  };

  const setZoomFromCenter = (nextZoom: number) => {
    const clamped = normalizeZoom(nextZoom);
    if (clamped === zoom) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const centerX = rect ? rect.width / 2 : window.innerWidth / 2;
    const centerY = rect ? rect.height / 2 : window.innerHeight / 2;
    const worldX = (centerX - pan.x) / zoom;
    const worldY = (centerY - pan.y) / zoom;
    setZoom(clamped);
    setPan({ x: centerX - worldX * clamped, y: centerY - worldY * clamped });
  };

  const fitNodesToView = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || state.nodes.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const padding = 120;
    const minX = Math.min(...state.nodes.map((node) => node.x));
    const minY = Math.min(...state.nodes.map((node) => node.y));
    const maxX = Math.max(...state.nodes.map((node) => node.x + NODE_WIDTH));
    const maxY = Math.max(...state.nodes.map((node) => node.y + NODE_HEIGHT_ESTIMATE));
    const contentWidth = Math.max(1, maxX - minX);
    const contentHeight = Math.max(1, maxY - minY);
    const nextZoom = normalizeZoom(Math.min(1, Math.max(0.4, Math.min((rect.width - padding) / contentWidth, (rect.height - padding) / contentHeight))));
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    setZoom(nextZoom);
    setPan({
      x: rect.width / 2 - contentCenterX * nextZoom,
      y: rect.height / 2 - contentCenterY * nextZoom,
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable='true']")) return;
      if (event.key.toLowerCase() === "v") {
        setTool("select");
        return;
      }
      if (event.key.toLowerCase() === "f") {
        fitNodesToView();
        return;
      }
      if (event.code !== "Space") return;
      event.preventDefault();
      setIsSpaceDown(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setIsSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextZoom = normalizeZoom(zoom * (event.deltaY > 0 ? 0.9 : 1.1));
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const worldX = (mouseX - pan.x) / zoom;
    const worldY = (mouseY - pan.y) / zoom;
    setZoom(nextZoom);
    setPan({ x: mouseX - worldX * nextZoom, y: mouseY - worldY * nextZoom });
  };

  const getInputText = (nodeId: string) => {
    const incoming = state.edges.filter((edge) => edge.target === nodeId).map((edge) => state.nodes.find((node) => node.id === edge.source)).filter(Boolean) as WorkflowNode[];
    return incoming
      .map((node) => {
        if (node.kind === "text") return node.data.text?.trim() ?? "";
        if (node.kind === "image") return node.data.prompt?.trim() ?? "";
        return "";
      })
      .filter(Boolean)
      .join("\n\n");
  };

  const getReferenceImages = (nodeId: string) => {
    const urls: string[] = [];
    for (const edge of state.edges.filter((item) => item.target === nodeId)) {
      const source = state.nodes.find((node) => node.id === edge.source);
      if (source?.kind !== "image") continue;
      for (const url of source.data.images ?? []) {
        if (url && !urls.includes(url)) urls.push(url);
      }
    }
    return urls;
  };

  const runImageNode = async (node: WorkflowNode) => {
    const upstreamPrompt = getInputText(node.id);
    const ownPrompt = node.data.prompt?.trim() ?? "";
    const prompt = [upstreamPrompt, ownPrompt].filter(Boolean).join("\n\n").trim();
    if (!prompt) {
      updateNode(node.id, { error: "请先输入提示词，或连接一个文本节点。" });
      return;
    }

    const model = node.data.model ?? DEFAULT_IMAGE_MODEL;
    const settings = {
      ratio: node.data.ratio ?? "智能比例",
      resolution: node.data.resolution ?? normalizeImageResolutionForModel(model, getSupportedImageResolutions(model)[0]),
    };
    updateNode(node.id, { isRunning: true, error: undefined });
    try {
      const data = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model,
          settings,
          referenceImages: getReferenceImages(node.id),
          count: 1,
          requestId: createId("workflow_image"),
          metadata: { creditSource: "workflow_image_generation" },
        }),
      }).then((response) => readJson<{ images?: string[]; credit?: CreditResult }>(response));
      updateNode(node.id, { images: data.images ?? [], isRunning: false, error: undefined });
      onCredit?.(data.credit);
    } catch (error) {
      updateNode(node.id, { isRunning: false, error: toUserErrorMessage(error) });
    }
  };

  const nodeById = new Map(state.nodes.map((node) => [node.id, node]));

  return (
    <div className="relative h-full min-h-full overflow-hidden bg-[#f3f3f3] text-[#111111]">
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#d8d8d8_1px,transparent_1px),linear-gradient(to_bottom,#d8d8d8_1px,transparent_1px),linear-gradient(to_right,#e9e9e9_1px,transparent_1px),linear-gradient(to_bottom,#e9e9e9_1px,transparent_1px)]"
        style={{
          backgroundSize: `${120 * zoom}px ${120 * zoom}px, ${120 * zoom}px ${120 * zoom}px, ${24 * zoom}px ${24 * zoom}px, ${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-[12px] border border-[#e5e5e5] bg-white/90 px-3 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mr-1 max-w-[220px] truncate text-[13px] font-semibold text-[#111111]">{workflowTitle}</div>
        <ToolbarButton onClick={() => addNode("text")} icon={<RiTBoxLine className="h-4 w-4" />} label="文本" />
        <ToolbarButton onClick={() => addNode("image")} icon={<RiImageAiLine className="h-4 w-4" />} label="图片" />
        <ToolbarButton onClick={() => addNode("video")} icon={<RiVideoLine className="h-4 w-4" />} label="视频" disabled />
      </div>

      {connectingFrom ? (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-[#111111] px-4 py-2 text-[12px] font-medium text-white shadow-lg">
          选择一个节点的“输入”完成连接
          <button type="button" onClick={() => setConnectingFrom("")} className="ml-3 text-white/70 hover:text-white">取消</button>
        </div>
      ) : null}

      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 rounded-[12px] border border-[#e5e5e5] bg-white/92 p-1 shadow-[0_10px_30px_rgba(15,23,42,0.10)] backdrop-blur">
        <button type="button" onClick={() => setTool("select")} className={tool === "select" && !isSpaceDown ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[#367cee] text-white outline-none focus:outline-none" : "flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none"} title="选择节点（V）">
          <RiCursorLine className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setTool("pan")} className={effectiveTool === "pan" ? "flex h-9 w-9 items-center justify-center rounded-lg bg-[#367cee] text-white outline-none focus:outline-none" : "flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none"} title="移动画布（空格）">
          <RiHand className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="mx-1 h-5 w-px bg-[#e5e5e5]" />
        <button type="button" onClick={() => setZoomFromCenter(zoom - 0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none" title="缩小">
          <RiZoomOutLine className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setZoomFromCenter(1)} className="h-9 min-w-12 rounded-lg px-2 text-[12px] font-semibold text-[#333333] outline-none hover:bg-[#f2f2f2] focus:outline-none" title="重置缩放">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={() => setZoomFromCenter(zoom + 0.1)} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none" title="放大">
          <RiZoomInLine className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="mx-1 h-5 w-px bg-[#e5e5e5]" />
        <button type="button" onClick={fitNodesToView} className="flex h-9 w-9 items-center justify-center rounded-lg text-[#555555] outline-none hover:bg-[#f2f2f2] focus:outline-none" title="定位全部节点">
          <RiFocus3Line className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={canvasRef}
        className={effectiveTool === "pan" ? "absolute inset-0 z-10 cursor-grab active:cursor-grabbing" : "absolute inset-0 z-10"}
        onPointerDown={startPan}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={handleWheel}
      >
        {state.nodes.length === 0 ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e5e5e5] bg-white text-[#367cee] shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
              <RiGitLikeIcon />
            </div>
            <div className="text-[16px] font-semibold text-[#111111]">从一个节点开始</div>
            <div className="mt-2 text-[13px] text-[#8a8a8a]">第一版支持文本节点连接图片节点，生成仍走闪念现有扣费链路。</div>
            <button type="button" onClick={() => addNode("text")} className="pointer-events-auto mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#367cee] px-4 text-[13px] font-semibold text-white transition hover:bg-[#286fe0]">
              <RiAddLine className="h-4 w-4" /> 添加文本节点
            </button>
          </div>
        ) : null}
        <div className="absolute left-0 top-0 h-[4000px] w-[4000px] origin-top-left" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="pointer-events-none absolute left-0 top-0 h-[4000px] w-[4000px] overflow-visible">
          {state.edges.map((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) return null;
            const x1 = source.x + NODE_WIDTH;
            const y1 = source.y + NODE_HEADER_HEIGHT;
            const x2 = target.x;
            const y2 = target.y + NODE_HEADER_HEIGHT;
            const mid = Math.max(60, Math.abs(x2 - x1) / 2);
            return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`} fill="none" stroke="#367cee" strokeWidth="2" strokeLinecap="round" />;
          })}
        </svg>

        {state.nodes.map((node) => {
          const Icon = getNodeIcon(node.kind);
          return (
            <div
              key={node.id}
              onPointerDown={(event) => startDrag(node, event)}
              className="workflow-node absolute flex w-[280px] flex-col overflow-hidden rounded-[14px] border border-[#e1e1e1] bg-white shadow-[0_12px_34px_rgba(15,23,42,0.10)]"
              style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            >
              <div className="flex h-[42px] cursor-grab items-center gap-2 border-b border-[#eeeeee] bg-[#fbfbfb] px-3 active:cursor-grabbing">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff] text-[#367cee]"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#111111]">{node.title}</span>
                <button type="button" onClick={() => deleteNode(node.id)} className="flex h-7 w-7 items-center justify-center rounded-md text-[#8a8a8a] hover:bg-[#eeeeee] hover:text-[#111111]" aria-label="删除节点">
                  <RiCloseLine className="h-4 w-4" />
                </button>
              </div>

              <div className="relative flex flex-col gap-3 p-3">
                <button type="button" onClick={() => connectTo(node.id)} className="absolute -left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#a7a7a7] text-white shadow" title="输入">
                  <RiAddLine className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => setConnectingFrom(node.id)} className="absolute -right-3 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#367cee] text-white shadow" title="连接输出">
                  <RiArrowRightLine className="h-3.5 w-3.5" />
                </button>

                {node.kind === "text" ? <TextNodeBody node={node} onChange={updateNode} /> : null}
                {node.kind === "image" ? <ImageNodeBody node={node} onChange={updateNode} onRun={() => void runImageNode(node)} /> : null}
                {node.kind === "video" ? <VideoNodeBody /> : null}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e7e7e7] bg-white px-2.5 text-[12px] font-medium text-[#333333] transition hover:border-[#d8d8d8] hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-45">
      {icon}
      {label}
    </button>
  );
}

function TextNodeBody({ node, onChange }: { node: WorkflowNode; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void }) {
  return (
    <textarea
      value={node.data.text ?? ""}
      onChange={(event) => onChange(node.id, { text: event.target.value })}
      placeholder="输入提示词、分镜、人物或场景描述..."
      className="min-h-[136px] resize-none rounded-[10px] border border-[#e5e5e5] bg-[#fafafa] p-3 text-[13px] leading-6 text-[#111111] outline-none transition placeholder:text-[#b0b0b0] focus:border-[#367cee] focus:bg-white"
    />
  );
}

function ImageNodeBody({ node, onChange, onRun }: { node: WorkflowNode; onChange: (nodeId: string, patch: Partial<WorkflowNodeData>) => void; onRun: () => void }) {
  const model = node.data.model ?? DEFAULT_IMAGE_MODEL;
  const supportedResolutions = getSupportedImageResolutions(model);
  return (
    <>
      <textarea
        value={node.data.prompt ?? ""}
        onChange={(event) => onChange(node.id, { prompt: event.target.value })}
        placeholder="补充图片生成要求；也可以连接文本节点提供主提示词。"
        className="min-h-[96px] resize-none rounded-[10px] border border-[#e5e5e5] bg-[#fafafa] p-3 text-[13px] leading-6 text-[#111111] outline-none transition placeholder:text-[#b0b0b0] focus:border-[#367cee] focus:bg-white"
      />
      <div className="grid grid-cols-2 gap-2">
        <select value={node.data.ratio ?? "智能比例"} onChange={(event) => onChange(node.id, { ratio: event.target.value })} className="h-9 rounded-lg border border-[#e5e5e5] bg-white px-2 text-[12px] text-[#333333] outline-none focus:border-[#367cee]">
          {ratioOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={node.data.resolution ?? supportedResolutions[0]} onChange={(event) => onChange(node.id, { resolution: event.target.value })} className="h-9 rounded-lg border border-[#e5e5e5] bg-white px-2 text-[12px] text-[#333333] outline-none focus:border-[#367cee]">
          {supportedResolutions.map((item) => <option key={item} value={item}>{item === "4K" ? "超清4K" : item}</option>)}
        </select>
      </div>
      <select value={model} onChange={(event) => {
        const nextModel = event.target.value as ModelName;
        onChange(node.id, { model: nextModel, resolution: normalizeImageResolutionForModel(nextModel, node.data.resolution) });
      }} className="h-9 rounded-lg border border-[#e5e5e5] bg-white px-2 text-[12px] text-[#333333] outline-none focus:border-[#367cee]">
        {imageGenerationModels.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      {node.data.error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-500">{node.data.error}</div> : null}
      {node.data.images && node.data.images.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {node.data.images.map((url) => <img key={url} src={url} alt="生成图片" className="aspect-square rounded-lg border border-[#eeeeee] object-cover" />)}
        </div>
      ) : null}
      <button type="button" disabled={node.data.isRunning} onClick={onRun} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#367cee] text-[13px] font-semibold text-white transition hover:bg-[#286fe0] disabled:cursor-not-allowed disabled:opacity-70">
        {node.data.isRunning ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiPlayLine className="h-4 w-4" />}
        {node.data.isRunning ? "生成中..." : "生成图片"}
      </button>
    </>
  );
}

function VideoNodeBody() {
  return (
    <div className="rounded-[10px] border border-dashed border-[#d8d8d8] bg-[#fafafa] p-4 text-center text-[12px] leading-5 text-[#8a8a8a]">
      视频节点第一版先占位，下一步接入当前 `/api/video` 轮询和积分扣除。
    </div>
  );
}

function RiGitLikeIcon() {
  return <RiImageAiLine className="h-7 w-7" aria-hidden="true" />;
}
