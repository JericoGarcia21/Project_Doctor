export enum NodeType {
  FILE = 'FILE',
  COMPONENT = 'COMPONENT',
  FUNCTION = 'FUNCTION',
  CLASS = 'CLASS',
  API_ROUTE = 'API_ROUTE',
  CONTROLLER = 'CONTROLLER',
  MODEL = 'MODEL',
  DATABASE_TABLE = 'DATABASE_TABLE',
  SERVICE = 'SERVICE'
}

export enum RelationType {
  IMPORTS = 'IMPORTS',
  EXPORTS = 'EXPORTS',
  CALLS = 'CALLS',
  HANDLES = 'HANDLES',
  USES = 'USES',
  MAPS_TO = 'MAPS_TO',
  EXTENDS = 'EXTENDS',
  IMPLEMENTS = 'IMPLEMENTS'
}

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: RelationType;
  metadata?: Record<string, unknown>;
}

export function createNode(
  id: string,
  type: NodeType,
  label: string,
  options?: { filePath?: string; metadata?: Record<string, unknown> }
): GraphNode {
  return {
    id,
    type,
    label,
    ...options
  };
}

export function createEdge(
  source: string,
  target: string,
  type: RelationType,
  metadata?: Record<string, unknown>
): GraphEdge {
  return {
    source,
    target,
    type,
    metadata
  };
}
