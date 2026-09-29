import Graph from 'graphology';
import { GraphNode, GraphEdge, RelationType } from './GraphNode';

export class ProjectGraph {
  private graph: Graph;

  constructor() {
    this.graph = new Graph();
  }

  addNode(node: GraphNode): void {
    if (!this.graph.hasNode(node.id)) {
      this.graph.addNode(node.id, node);
    }
  }

  addEdge(edge: GraphEdge): void {
    if (this.graph.hasNode(edge.source) && this.graph.hasNode(edge.target)) {
      if (!this.graph.hasEdge(edge.source, edge.target)) {
        this.graph.addDirectedEdge(edge.source, edge.target, edge);
      }
    }
  }

  getNode(id: string): GraphNode | undefined {
    if (this.graph.hasNode(id)) {
      return this.graph.getNodeAttributes(id) as GraphNode;
    }
    return undefined;
  }

  getNeighbors(nodeId: string): GraphNode[] {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const neighbors = this.graph.neighbors(nodeId);
    return neighbors.map(id => this.graph.getNodeAttributes(id) as GraphNode);
  }

  getRelationships(nodeId: string, type?: RelationType): GraphEdge[] {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    const edges = this.graph.outEdges(nodeId);
    const relationships = edges.map(edgeId => this.graph.getEdgeAttributes(edgeId) as GraphEdge);

    if (type) {
      return relationships.filter(r => r.type === type);
    }

    return relationships;
  }

  findPath(_sourceId: string, _targetId: string): string[] | null {
    // Placeholder - pathfinding will be implemented in Phase 3
    return null;
  }

  export(): object {
    return this.graph.export();
  }

  getNodeCount(): number {
    return this.graph.order;
  }

  getEdgeCount(): number {
    return this.graph.size;
  }

  clear(): void {
    this.graph.clear();
  }
}
