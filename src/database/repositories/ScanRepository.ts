import { Database } from 'sql.js';
import { ScanResult } from '../../core/ScanResult';

export interface ScanRecord {
  id: number;
  project_id: number;
  scan_timestamp: string;
  duration_ms: number;
  file_count: number;
  problem_count: number;
  warning_count: number;
  technologies: string;
}

export class ScanRepository {
  constructor(private db: Database) {}

  create(projectId: number, scanResult: ScanResult): number {
    this.db.run(
      `INSERT INTO scans (
        project_id, scan_timestamp, duration_ms, file_count, 
        problem_count, warning_count, technologies
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        scanResult.context.scanTimestamp.toISOString(),
        scanResult.scanDuration,
        scanResult.statistics.totalFiles,
        scanResult.getErrorCount(),
        scanResult.getWarningCount(),
        JSON.stringify(scanResult.statistics.technologies)
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id')[0];
    return result.values[0][0] as number;
  }

  findByProjectId(projectId: number, limit: number = 10): ScanRecord[] {
    const result = this.db.exec(
      `SELECT * FROM scans 
       WHERE project_id = ? 
       ORDER BY scan_timestamp DESC 
       LIMIT ?`,
      [projectId, limit]
    );

    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row: unknown[]) => ({
      id: row[0] as number,
      project_id: row[1] as number,
      scan_timestamp: row[2] as string,
      duration_ms: row[3] as number,
      file_count: row[4] as number,
      problem_count: row[5] as number,
      warning_count: row[6] as number,
      technologies: row[7] as string
    }));
  }

  getLatest(projectId: number): ScanRecord | undefined {
    const result = this.db.exec(
      `SELECT * FROM scans 
       WHERE project_id = ? 
       ORDER BY scan_timestamp DESC 
       LIMIT 1`,
      [projectId]
    );

    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }

    const row = result[0].values[0];
    return {
      id: row[0] as number,
      project_id: row[1] as number,
      scan_timestamp: row[2] as string,
      duration_ms: row[3] as number,
      file_count: row[4] as number,
      problem_count: row[5] as number,
      warning_count: row[6] as number,
      technologies: row[7] as string
    };
  }
}
