import type { PipelineEdge, PipelineFlow, PipelineNode } from "../types";

export const emptyPipelineFlow = (): PipelineFlow => ({
  nodes: [],
  edges: [],
});

// biome-ignore lint/suspicious/noExplicitAny: pipeline node configs are heterogeneous JSON blobs
export type PipelineNodeConfig = Record<string, any>;

export function parseNodeConfig(config: PipelineNode["config"]): PipelineNodeConfig {
  if (!config) {
    return {};
  }
  if (typeof config === "string") {
    try {
      return JSON.parse(config) as PipelineNodeConfig;
    } catch {
      return {};
    }
  }
  return config as unknown as PipelineNodeConfig;
}

export function flowToReactFlow(flow: PipelineFlow) {
  const nodes = (flow.nodes ?? []).map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position ?? { x: Math.random() * 200 + 100, y: Math.random() * 150 + 100 },
    data: {
      label: node.label || "",
      config: parseNodeConfig(node.config),
      isRunning: false,
      isSuccess: false,
      isError: false,
      elapsedMs: null as number | null,
    },
  }));

  const edges = (flow.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));

  return { nodes, edges };
}

export function reactFlowToFlow(
  nodes: Array<{
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: { label?: string; config?: unknown };
  }>,
  edges: Array<{ id: string; source: string; target: string }>,
): PipelineFlow {
  return {
    nodes: nodes.map(
      (node) =>
        ({
          id: node.id,
          label: node.data.label ?? "",
          type: node.type as PipelineNode["type"],
          config: JSON.stringify(node.data.config ?? {}),
          position: node.position,
        }) satisfies PipelineNode,
    ),
    edges: edges.map(
      (edge) =>
        ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
        }) satisfies PipelineEdge,
    ),
  };
}
