import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as path from 'path';
import * as fs from 'fs';

export class ProjectDoctorDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

  constructor(storagePath: string) {
    this.dbPath = path.join(storagePath, 'project-doctor.sqlite');
  }

  async initialize(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize SQL.js
    this.SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }

    this.runMigrations();
  }

  private runMigrations(): void {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Create tables
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_scanned_at TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        scan_timestamp TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        file_count INTEGER NOT NULL,
        problem_count INTEGER NOT NULL,
        warning_count INTEGER NOT NULL,
        technologies TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        scan_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        file_path TEXT,
        line_number INTEGER,
        evidence TEXT,
        suggested_action TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (scan_id) REFERENCES scans(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        source_node TEXT NOT NULL,
        target_node TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Create indexes
    this.db.run('CREATE INDEX IF NOT EXISTS idx_findings_scan_id ON findings(scan_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_scans_project_id ON scans(project_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_relationships_project_id ON relationships(project_id)');

    console.log('[Database] Migrations complete');
    this.save();
  }

  getDb(): SqlJsDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  save(): void {
    if (this.db) {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    }
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}
