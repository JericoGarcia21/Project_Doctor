import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectGraph } from '../../src/graph/ProjectGraph';
import { createNode, createEdge, NodeType, RelationType } from '../../src/graph/GraphNode';

describe('ProjectGraph', () => {
  let graph: ProjectGraph;

  beforeEach(() => {
    graph = new ProjectGraph();
  });

  it('should add nodes', () => {
    const node = createNode('file1', NodeType.FILE, 'index.ts');
    
    graph.addNode(node);
    
    expect(graph.getNodeCount()).toBe(1);
    expect(graph.getNode('file1')).toEqual(node);
  });

  it('should add edges between nodes', () => {
    const node1 = createNode('file1', NodeType.FILE, 'index.ts');
    const node2 = createNode('file2', NodeType.FILE, 'utils.ts');
    
    graph.addNode(node1);
    graph.addNode(node2);
    
    const edge = createEdge('file1', 'file2', RelationType.IMPORTS);
    graph.addEdge(edge);
    
    expect(graph.getEdgeCount()).toBe(1);
  });

  it('should get neighbors of a node', () => {
    const node1 = createNode('file1', NodeType.FILE, 'index.ts');
    const node2 = createNode('file2', NodeType.FILE, 'utils.ts');
    const node3 = createNode('file3', NodeType.FILE, 'types.ts');
    
    graph.addNode(node1);
    graph.addNode(node2);
    graph.addNode(node3);
    
    graph.addEdge(createEdge('file1', 'file2', RelationType.IMPORTS));
    graph.addEdge(createEdge('file1', 'file3', RelationType.IMPORTS));
    
    const neighbors = graph.getNeighbors('file1');
    
    expect(neighbors).toHaveLength(2);
  });

  it('should get relationships by type', () => {
    const node1 = createNode('file1', NodeType.FILE, 'index.ts');
    const node2 = createNode('file2', NodeType.FILE, 'utils.ts');
    
    graph.addNode(node1);
    graph.addNode(node2);
    
    graph.addEdge(createEdge('file1', 'file2', RelationType.IMPORTS));
    
    const imports = graph.getRelationships('file1', RelationType.IMPORTS);
    
    expect(imports).toHaveLength(1);
    expect(imports[0].type).toBe(RelationType.IMPORTS);
  });

  it('should clear graph', () => {
    graph.addNode(createNode('file1', NodeType.FILE, 'index.ts'));
    
    expect(graph.getNodeCount()).toBe(1);
    
    graph.clear();
    
    expect(graph.getNodeCount()).toBe(0);
  });
});
