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
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          padding: 20px;
        }
        .header {
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        h1 {
          font-size: 20px;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .project-name {
          color: var(--vscode-textLink-foreground);
          font-size: 14px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin: 20px 0;
        }
        .stat-card {
          padding: 16px 0;
          transition: background-color 0.1s ease;
        }
        .stat-card:hover {
          background-color: var(--vscode-list-hoverBackground);
          margin: 0 -12px;
          padding: 16px 12px;
        }
        .stat-label {
          color: var(--vscode-descriptionForeground);
          font-size: 11px;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-weight: 500;
          letter-spacing: 0.3px;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 600;
        }
        .technologies {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 12px;
        }
        .tech-badge {
          background-color: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          padding: 3px 8px;
          font-size: 11px;
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
        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }
        .empty-state p {
          color: var(--vscode-descriptionForeground);
          margin: 16px 0;
        }
        .findings-section {
          margin-top: 30px;
        }
        .finding-card {
          padding: 12px 0;
          margin-bottom: 8px;
          position: relative;
          transition: background-color 0.1s ease;
          cursor: pointer;
        }
        .finding-card:hover {
          background-color: var(--vscode-list-hoverBackground);
          margin: 0 -12px 8px -12px;
          padding: 12px;
        }
        .finding-card:not([onclick]) {
          cursor: default;
        }
        .finding-card.warning::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background-color: #f59e0b;
        }
        .finding-card.error::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background-color: #ef4444;
        }
        .finding-card.info::before {
          content: '';
          position: absolute;
          left: -12px;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 20px;
          background-color: #3b82f6;
        }
        .finding-title {
          font-weight: 500;
          margin-bottom: 4px;
        }
        .finding-meta {
          font-size: 11px;
          color: var(--vscode-descriptionForeground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>PROJECT DOCTOR</h1>
        <div class="project-name">Project: ${data.projectName}</div>
      </div>

      ${data.hasScans ? `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Files</div>
            <div class="stat-value">${data.statistics?.files || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Problems</div>
            <div class="stat-value">${data.statistics?.problems || 0}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Warnings</div>
            <div class="stat-value">${data.statistics?.warnings || 0}</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Technologies</div>
          <div class="technologies">
            ${(data.statistics?.technologies || []).map((tech: string) => 
              `<span class="tech-badge">${tech}</span>`
            ).join('')}
          </div>
        </div>

        ${data.findings && (data.findings as unknown[]).length > 0 ? `
          <div class="findings-section">
            <h2 style="margin-bottom: 15px;">Findings</h2>
            ${(data.findings as Array<{
              severity: string;
              title: string;
              description: string;
              filePath?: string;
              line?: number;
              column?: number;
              endLine?: number;
              endColumn?: number;
              category: string;
            }>).map(finding => `
              <div class="finding-card ${finding.severity.toLowerCase()}" ${finding.filePath ? `onclick="openFinding('${finding.filePath}', ${finding.line || 1}, ${finding.column || 1}, ${finding.endLine || finding.line || 1}, ${finding.endColumn || (finding.column || 1) + 10})"` : ''}>
                <div class="finding-title">${finding.title}</div>
                <div>${finding.description}</div>
                <div class="finding-meta">
                  ${finding.filePath ? `${finding.filePath}${finding.line ? `:${finding.line}` : ''}` : ''} ${finding.filePath ? '•' : ''} ${finding.category} • ${finding.severity}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="margin-top: 20px;">
          <button onclick="scan()">Scan Project Again</button>
        </div>
      ` : `
        <div class="empty-state">
          <h2>Status: Ready to scan</h2>
          <p>No scan results available yet. Click the button below to start analyzing your project.</p>
          <button onclick="scan()">Scan Project</button>
        </div>
      `}

      <script>
        const vscode = acquireVsCodeApi();
        
        function scan() {
          vscode.postMessage({ command: 'scan' });
        }

        function openFinding(filePath, line, column, endLine, endColumn) {
          vscode.postMessage({ 
            command: 'openFinding', 
            filePath: filePath,
            line: line,
            column: column,
            endLine: endLine,
            endColumn: endColumn
          });
        }
      </script>
    </body>
    </html>`;
  }
}
