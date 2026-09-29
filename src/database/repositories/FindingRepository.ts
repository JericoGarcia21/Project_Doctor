import { Database } from 'sql.js';
import { Finding } from '../../diagnostics/Finding';
import { Severity } from '../../core/types';

export class FindingRepository {
  constructor(private db: Database) {}

  createMany(scanId: number, findings: Finding[]): void {
    for (const finding of findings) {
      this.db.run(
        `INSERT INTO findings (
          id, scan_id, title, description, severity, category,
          file_path, line_number, evidence, suggested_action, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finding.id,
          scanId,
          finding.title,
          finding.description,
          finding.severity,
          finding.category,
          finding.filePath || null,
          finding.line || null,
          finding.evidence || null,
          finding.suggestedAction || null,
          finding.timestamp.toISOString()
        ]
      );
    }
  }

  findByScanId(scanId: number): Finding[] {
    const result = this.db.exec('SELECT * FROM findings WHERE scan_id = ?', [scanId]);
    
    if (result.length === 0) {
      return [];
    }

    return result[0].values.map((row: unknown[]) => ({
      id: row[0] as string,
      title: row[2] as string,
      description: row[3] as string,
      severity: row[4] as Severity,
      category: row[5] as string,
      filePath: row[6] as string | undefined,
      line: row[7] as number | undefined,
      evidence: row[8] as string | undefined,
      suggestedAction: row[9] as string | undefined,
      timestamp: new Date(row[10] as string)
    }));
  }
}
