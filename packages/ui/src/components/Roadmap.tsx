import { Background, ReactFlow, type Edge, type Node, type NodeMouseHandler } from "@xyflow/react";
import type { StudentDashboardDto } from "../types/dashboard";

type RoadmapNode = StudentDashboardDto["roadmap"]["nodes"][number];

const colorByType: Record<string, string> = {
  gap: "road-node gap-node",
  course: "road-node course-node",
  project: "road-node project-node",
  evidence: "road-node evidence-node",
};

const labelByType: Record<string, string> = {
  gap: "Gap",
  course: "Learn",
  project: "Build",
  evidence: "Document",
};

export function Roadmap({
  data,
  onNodeClick,
}: {
  data: StudentDashboardDto;
  onNodeClick?: (node: RoadmapNode) => void;
}) {
  const nodes: Node[] = data.roadmap.nodes.map((node) => ({
    id: node.id,
    position: { x: node.x, y: node.y },
    data: {
      label: (
        <div className={colorByType[node.type] ?? "road-node"}>
          <em>{labelByType[node.type]}</em>
          <strong>{node.label}</strong>
          <span>{node.detail}</span>
        </div>
      ),
    },
    type: "default",
  }));
  const edges: Edge[] = data.roadmap.edges.map((edge) => ({ ...edge, animated: true, style: { stroke: "#0f766e", strokeWidth: 2 } }));
  const nodesById = new Map(data.roadmap.nodes.map((node) => [node.id, node] as const));
  const handleNodeClick: NodeMouseHandler = (_, node) => {
    const source = nodesById.get(node.id);
    if (source) onNodeClick?.(source);
  };

  return (
    <section className="panel roadmap-panel">
      <div className="section-heading">
        <div>
          <div className="section-kicker">Action Plan</div>
          <h2>Gap to evidence roadmap</h2>
        </div>
        <p>Each row turns one weak competency into a course, portfolio task, and documented artifact. Click any node to view goals, objectives, and recommended courses.</p>
      </div>
      <div className="roadmap-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          zoomOnScroll={false}
          panOnScroll
          onNodeClick={handleNodeClick}
        >
          <Background color="#dbe3ea" gap={28} />
        </ReactFlow>
      </div>
      {onNodeClick && (
        <div className="roadmap-details-list" aria-label="Roadmap details">
          {data.roadmap.nodes.map((node) => (
            <button key={node.id} type="button" onClick={() => onNodeClick(node)}>
              <span>{labelByType[node.type]}</span>
              <strong>{node.label}</strong>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
