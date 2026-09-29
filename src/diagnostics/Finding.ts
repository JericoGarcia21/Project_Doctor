import { Severity } from '../core/types';

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  filePath?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  evidence?: string;
  relatedFiles?: string[];
  suggestedAction?: string;
  timestamp: Date;
}

export function createFinding(
  title: string,
  description: string,
  severity: Severity,
  category: string,
  options?: Partial<Omit<Finding, 'id' | 'title' | 'description' | 'severity' | 'category' | 'timestamp'>>
): Finding {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    description,
    severity,
    category,
    timestamp: new Date(),
    ...options
  };
}
