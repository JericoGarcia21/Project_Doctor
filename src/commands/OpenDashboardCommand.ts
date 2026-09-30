import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectDoctorDatabase } from '../database/Database';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { ScanRepository } from '../database/repositories/ScanRepository';
import { FindingRepository } from '../database/repositories/FindingRepository';

export class OpenDashboardCommand {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private context: vscode.ExtensionContext,
    private database: ProjectDoctorDatabase
  ) {}

  async execute(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace is currently open. Please open a project folder first.');
      return;
    }

    if (this.panel) {
      this.panel.reveal();
      this.updateDashboard();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'projectDoctorDashboard',
      'Project Doctor',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'scan':
            await vscode.commands.executeCommand('project-doctor.scanProject');
            break;
          case 'refresh':
            this.updateDashboard();
            break;
          case 'openFinding':
            await vscode.commands.executeCommand('project-doctor.openFinding',
              message.filePath, message.line, message.column, message.endLine, message.endColumn);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );

    this.updateDashboard();
  }

  private updateDashboard(): void {
    if (!this.panel) {
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const projectName = path.basename(workspacePath);

    try {
      const db = this.database.getDb();
      const projectRepo = new ProjectRepository(db);
      const scanRepo = new ScanRepository(db);
      const findingRepo = new FindingRepository(db);

      const project = projectRepo.findByPath(workspacePath);
      let dashboardData;

      if (project) {
        const latestScan = scanRepo.getLatest(project.id);
        
        if (latestScan) {
          const findings = findingRepo.findByScanId(latestScan.id);
          
          // Parse technologies safely
          let technologies: string[] = [];
          try {
            technologies = JSON.parse(latestScan.technologies);
          } catch (parseError) {
            console.error('[Dashboard] Error parsing technologies:', parseError);
            technologies = [];
          }
          
          dashboardData = {
            projectName: project.name,
            hasScans: true,
            lastScanned: latestScan.scan_timestamp,
            statistics: {
              files: latestScan.file_count,
              problems: latestScan.problem_count,
              warnings: latestScan.warning_count,
              technologies: technologies
            },
            findings: findings
          };
        } else {
          dashboardData = {
            projectName: project.name,
            hasScans: false,
            statistics: { files: 0, problems: 0, warnings: 0, technologies: [] }
          };
        }
      } else {
        dashboardData = {
          projectName: projectName,
          hasScans: false,
          statistics: { files: 0, problems: 0, warnings: 0, technologies: [] }
        };
      }

      this.panel.webview.html = this.getWebviewContent(dashboardData);
      console.log('[Dashboard] Updated successfully');
    } catch (error) {
      console.error('[Dashboard] Error updating dashboard:', error);
      this.panel.webview.html = this.getWebviewContent({
        projectName: projectName,
        hasScans: false,
        error: 'Failed to load scan data',
        statistics: { files: 0, problems: 0, warnings: 0, technologies: [] }
      });
    }
  }

  private getWebviewContent(data: { 
    projectName: string; 
    hasScans: boolean; 
    statistics?: { files: number; problems: number; warnings: number; technologies: string[] };
    [key: string]: unknown;
  }): string {
    const statistics = data.statistics ?? { files: 0, problems: 0, warnings: 0, technologies: [] };
    const findings = Array.isArray(data.findings) ? data.findings as Array<{
      severity: string;
      title: string;
      description: string;
      filePath?: string;
      line?: number;
      column?: number;
      endLine?: number;
      endColumn?: number;
      category: string;
    }> : [];
    const technologies = statistics.technologies.map(tech => this.escapeHtml(tech));
    const renderedFindings = findings.map(finding => {
      const severity = this.severityClass(finding.severity);
      const line = Math.max(1, Number(finding.line) || 1);
      const column = Math.max(1, Number(finding.column) || 1);
      const endLine = Math.max(1, Number(finding.endLine) || line);
      const endColumn = Math.max(1, Number(finding.endColumn) || column + 10);
      const filePath = finding.filePath ? this.escapeHtml(finding.filePath) : '';

      return `
        <article class="finding-card ${severity}" ${finding.filePath ? `role="button" tabindex="0" data-file-path="${filePath}" data-line="${line}" data-column="${column}" data-end-line="${endLine}" data-end-column="${endColumn}"` : ''}>
          <h3 class="finding-title">${this.escapeHtml(finding.title)}</h3>
          <p class="finding-description">${this.escapeHtml(finding.description)}</p>
          <div class="finding-meta">
            ${finding.filePath ? `<span>${filePath}${finding.line ? `:${line}` : ''}</span>` : ''}
            <span>${this.escapeHtml(finding.category)}</span>
            <span class="severity-label">${this.escapeHtml(finding.severity)}</span>
          </div>
        </article>`;
    }).join('');
    const lastScanned = typeof data.lastScanned === 'string'
      ? this.escapeHtml(new Date(data.lastScanned).toLocaleString())
      : '';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Doctor</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: var(--vscode-font-family);
          line-height: 1.45;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 24px;
        }
        .header {
          padding-bottom: 14px;
          margin-bottom: 18px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        h1 {
          font-size: 16px;
          margin-bottom: 4px;
          font-weight: 600;
        }
        .project-name {
          color: var(--vscode-foreground);
          font-size: 13px;
        }
        .last-scan {
          color: var(--vscode-descriptionForeground);
          font-size: 11px;
          margin-top: 2px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          margin: 18px 0 24px;
          border-block: 1px solid var(--vscode-panel-border);
        }
        .stat-card {
          padding: 10px 12px;
          border-right: 1px solid var(--vscode-panel-border);
        }
        .stat-label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--vscode-descriptionForeground);
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-weight: 500;
          letter-spacing: 0;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex: none;
          background: var(--vscode-descriptionForeground);
          opacity: 0.5;
        }
        .status-dot.error.active {
          background: var(--vscode-errorForeground);
          opacity: 1;
        }
        .status-dot.warning.active {
          background: var(--vscode-editorWarning-foreground);
          opacity: 1;
        }
        .stat-value {
          font-size: 22px;
          font-weight: 600;
        }
        .technologies {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .tech-badge {
          border: 1px solid var(--vscode-panel-border);
          color: var(--vscode-foreground);
          padding: 2px 6px;
          font-size: 11px;
        }
        h2 {
          margin-bottom: 8px;
          font-size: 13px;
          font-weight: 600;
        }
        .section {
          margin: 22px 0;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 13px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        button:focus-visible,
        .finding-card[data-file-path]:focus-visible {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: 2px;
        }
        .empty-state {
          padding: 28px 0;
        }
        .empty-state p {
          color: var(--vscode-descriptionForeground);
          margin: 0 0 16px;
        }
        .findings-section {
          margin-top: 24px;
        }
        .finding-card {
          padding: 12px 8px;
          border-bottom: 1px solid var(--vscode-panel-border);
          position: relative;
          transition: background-color 0.1s ease;
        }
        .finding-card[data-file-path] {
          cursor: pointer;
        }
        .finding-card:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        .finding-card.warning::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background-color: var(--vscode-editorWarning-foreground);
        }
        .finding-card.error::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background-color: var(--vscode-errorForeground);
        }
        .finding-card.info::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background-color: var(--vscode-editorInfo-foreground);
        }
        .finding-title {
          font-weight: 500;
          margin-bottom: 3px;
          font-size: 13px;
        }
        .finding-description {
          margin: 0;
          color: var(--vscode-descriptionForeground);
        }
        .finding-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 4px 12px;
          margin-top: 6px;
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
        }
        .severity-label {
          text-transform: uppercase;
        }
        .action-section {
          margin-top: 20px;
        }
        .empty-findings {
          color: var(--vscode-descriptionForeground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Project Doctor</h1>
        <div class="project-name">${this.escapeHtml(data.projectName)}</div>
        ${lastScanned ? `<div class="last-scan">Last scan: ${lastScanned}</div>` : ''}
      </div>

      ${data.hasScans ? `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Files</div>
            <div class="stat-value">${statistics.files}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label"><span class="status-dot error ${statistics.problems > 0 ? 'active' : ''}" aria-hidden="true"></span>Problems</div>
            <div class="stat-value">${statistics.problems}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label"><span class="status-dot warning ${statistics.warnings > 0 ? 'active' : ''}" aria-hidden="true"></span>Warnings</div>
            <div class="stat-value">${statistics.warnings}</div>
          </div>
        </div>

        <section class="section">
          <h2>Technologies</h2>
          <div class="technologies">
            ${technologies.map(tech => `<span class="tech-badge">${tech}</span>`).join('')}
          </div>
        </section>

        ${data.findings && (data.findings as unknown[]).length > 0 ? `
          <section class="findings-section">
            <h2>Findings</h2>
            ${renderedFindings}
          </section>
        ` : `<p class="empty-findings">No findings recorded for this scan.</p>`}

        <div class="action-section">
          <button data-action="scan">Scan project again</button>
        </div>
      ` : `
        <div class="empty-state">
          <h2>Ready to scan</h2>
          <p>No scan results are available yet.</p>
          <button data-action="scan">Scan workspace</button>
        </div>
      `}

      <script>
        const vscode = acquireVsCodeApi();
        document.querySelectorAll('[data-action="scan"]').forEach(button => {
          button.addEventListener('click', () => vscode.postMessage({ command: 'scan' }));
        });

        document.querySelectorAll('.finding-card[data-file-path]').forEach(item => {
          const openFinding = () => vscode.postMessage({
            command: 'openFinding',
            filePath: item.dataset.filePath,
            line: Number(item.dataset.line),
            column: Number(item.dataset.column),
            endLine: Number(item.dataset.endLine),
            endColumn: Number(item.dataset.endColumn)
          });
          item.addEventListener('click', openFinding);
          item.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openFinding();
            }
          });
        });
      </script>
    </body>
    </html>`;
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character] ?? character);
  }

  private severityClass(severity: string): string {
    const normalized = severity.toLowerCase();
    return ['error', 'warning', 'info'].includes(normalized) ? normalized : 'info';
  }
}
