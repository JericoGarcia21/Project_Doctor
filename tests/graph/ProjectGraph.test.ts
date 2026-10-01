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

  it('should keep multiple relationship types between the same nodes', () => {
    const node1 = createNode('file1', NodeType.FILE, 'index.ts');
    const node2 = createNode('file2', NodeType.FILE, 'utils.ts');

    graph.addNode(node1);
    graph.addNode(node2);

    graph.addEdge(createEdge('file1', 'file2', RelationType.IMPORTS));
    graph.addEdge(createEdge('file1', 'file2', RelationType.CALLS));

    expect(graph.getEdgeCount()).toBe(2);

    const relationships = graph.getRelationships('file1');
    expect(relationships.map(r => r.type)).toEqual(expect.arrayContaining([
      RelationType.IMPORTS,
      RelationType.CALLS
    ]));
  });

  it('should clear graph', () => {
    graph.addNode(createNode('file1', NodeType.FILE, 'index.ts'));
    
    expect(graph.getNodeCount()).toBe(1);
    
    graph.clear();
    
    expect(graph.getNodeCount()).toBe(0);
  });

  it('should find a shortest path between connected nodes', () => {
    const a = createNode('A', NodeType.FILE, 'A.ts');
    const b = createNode('B', NodeType.FILE, 'B.ts');
    const c = createNode('C', NodeType.FILE, 'C.ts');

    graph.addNode(a);
    graph.addNode(b);
    graph.addNode(c);

    graph.addEdge(createEdge('A', 'B', RelationType.CALLS));
    graph.addEdge(createEdge('B', 'C', RelationType.CALLS));

    expect(graph.findPath('A', 'C')).toEqual(['A', 'B', 'C']);
  });

  it('should query dependencies and dependents', () => {
    const source = createNode('source', NodeType.FILE, 'source.ts');
    const dependency = createNode('dependency', NodeType.FILE, 'dependency.ts');
    const dependent = createNode('dependent', NodeType.FILE, 'dependent.ts');
    graph.addNode(source);
    graph.addNode(dependency);
    graph.addNode(dependent);
    graph.addEdge(createEdge('source', 'dependency', RelationType.IMPORTS));
    graph.addEdge(createEdge('dependent', 'source', RelationType.IMPORTS));

    expect(graph.getDependencies('source', RelationType.IMPORTS).map(node => node.id)).toEqual(['dependency']);
    expect(graph.getDependents('source', RelationType.IMPORTS).map(node => node.id)).toEqual(['dependent']);
  });

  it('should filter paths by relationship type', () => {
    graph.addNode(createNode('A', NodeType.FILE, 'A.ts'));
    graph.addNode(createNode('B', NodeType.FILE, 'B.ts'));
    graph.addNode(createNode('C', NodeType.FILE, 'C.ts'));
    graph.addEdge(createEdge('A', 'B', RelationType.IMPORTS));
    graph.addEdge(createEdge('B', 'C', RelationType.CALLS));

    expect(graph.findPath('A', 'C', RelationType.IMPORTS)).toBeNull();
    expect(graph.findPath('A', 'C')).toEqual(['A', 'B', 'C']);
  });
});
