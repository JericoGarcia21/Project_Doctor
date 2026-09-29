import { Database } from 'sql.js';

export interface Project {
  id: number;
  path: string;
  name: string;
  created_at: string;
  last_scanned_at: string | null;
}

export class ProjectRepository {
  constructor(private db: Database) {}

  create(path: string, name: string): Project {
    const now = new Date().toISOString();
    
    this.db.run(
      'INSERT INTO projects (path, name, created_at) VALUES (?, ?, ?)',
      [path, name, now]
    );
    
    const result = this.db.exec('SELECT last_insert_rowid() as id')[0];
    const id = result.values[0][0] as number;
    
    return {
      id,
      path,
      name,
      created_at: now,
      last_scanned_at: null
    };
  }

  findByPath(path: string): Project | undefined {
    const result = this.db.exec('SELECT * FROM projects WHERE path = ?', [path]);
    
    if (result.length === 0 || result[0].values.length === 0) {
      return undefined;
    }
    
    const row = result[0].values[0];
    return {
      id: row[0] as number,
      path: row[1] as string,
      name: row[2] as string,
      created_at: row[3] as string,
      last_scanned_at: row[4] as string | null
    };
  }

  upsert(path: string, name: string): Project {
    const existing = this.findByPath(path);
    if (existing) {
      return existing;
    }
    return this.create(path, name);
  }

  updateLastScanned(id: number): void {
    const now = new Date().toISOString();
    this.db.run('UPDATE projects SET last_scanned_at = ? WHERE id = ?', [now, id]);
  }

  getAll(): Project[] {
    const result = this.db.exec('SELECT * FROM projects ORDER BY last_scanned_at DESC');
    
    if (result.length === 0) {
      return [];
    }
    
    return result[0].values.map((row: unknown[]) => ({
      id: row[0] as number,
      path: row[1] as string,
      name: row[2] as string,
      created_at: row[3] as string,
      last_scanned_at: row[4] as string | null
    }));
  }
}
