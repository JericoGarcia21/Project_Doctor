import Graph from 'graphology';
import { GraphNode, GraphEdge, RelationType } from './GraphNode';

export class ProjectGraph {
  private graph: Graph;

  constructor() {
    this.graph = new Graph({ multi: true });
  }

  addNode(node: GraphNode): void {
    if (!this.graph.hasNode(node.id)) {
      this.graph.addNode(node.id, node);
    }
  }

  addEdge(edge: GraphEdge): void {
    if (this.graph.hasNode(edge.source) && this.graph.hasNode(edge.target)) {
      const hasSameRelationship = this.graph.outEdges(edge.source).some((edgeId) => {
        const existingEdge = this.graph.getEdgeAttributes(edgeId) as GraphEdge | undefined;
        return existingEdge?.target === edge.target && existingEdge?.type === edge.type;
      });

      if (!hasSameRelationship) {
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

  getDependencies(nodeId: string, type?: RelationType): GraphNode[] {
    return this.getRelationships(nodeId, type)
      .map(relationship => this.getNode(relationship.target))
      .filter((node): node is GraphNode => node !== undefined);
  }

  getDependents(nodeId: string, type?: RelationType): GraphNode[] {
    if (!this.graph.hasNode(nodeId)) {
      return [];
    }

    return this.graph.inEdges(nodeId)
      .map(edgeId => this.graph.getEdgeAttributes(edgeId) as GraphEdge)
      .filter(relationship => !type || relationship.type === type)
      .map(relationship => this.getNode(relationship.source))
      .filter((node): node is GraphNode => node !== undefined);
  }

  findPath(sourceId: string, targetId: string, type?: RelationType): string[] | null {
    if (!this.graph.hasNode(sourceId) || !this.graph.hasNode(targetId)) {
      return null;
    }

    if (sourceId === targetId) {
      return [sourceId];
    }

    const queue: string[] = [sourceId];
    const visited = new Set<string>([sourceId]);
    const previous = new Map<string, string | null>();
    previous.set(sourceId, null);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }

      if (current === targetId) {
        break;
      }

      const neighbors = this.graph.outEdges(current)
        .map(edgeId => ({
          edge: this.graph.getEdgeAttributes(edgeId) as GraphEdge,
          target: this.graph.target(edgeId)
        }))
        .filter(({ edge }) => !type || edge.type === type);
      for (const { target: neighbor } of neighbors) {
        if (visited.has(neighbor)) {
          continue;
        }

        visited.add(neighbor);
        previous.set(neighbor, current);
        queue.push(neighbor);
      }
    }

    if (!previous.has(targetId)) {
      return null;
    }

    const path: string[] = [];
    let current: string | null = targetId;

    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) ?? null;
    }

    return path;
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
