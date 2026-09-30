import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectDoctorDatabase } from '../database/Database';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { ScanRepository } from '../database/repositories/ScanRepository';
import { FindingRepository } from '../database/repositories/FindingRepository';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private database: ProjectDoctorDatabase
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async data => {
      switch (data.type) {
        case 'scan':
          await vscode.commands.executeCommand('project-doctor.scanProject');
          // Refresh after scan completes
          setTimeout(() => this.refresh(), 1000);
          break;
        case 'refresh':
          this.refresh();
          break;
        case 'openFinding':
          await vscode.commands.executeCommand('project-doctor.openFinding', 
            data.filePath, data.line, data.column, data.endLine, data.endColumn);
          break;
      }
    });

    // Initial load
    this.refresh();
  }

  public refresh() {
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview);
    }
  }

  private _getHtmlForWebview(_webview: vscode.Webview) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return this._getNoWorkspaceHtml();
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const projectName = path.basename(workspacePath);

    try {
      const db = this.database.getDb();
      const projectRepo = new ProjectRepository(db);
      const scanRepo = new ScanRepository(db);
      const findingRepo = new FindingRepository(db);

      const project = projectRepo.findByPath(workspacePath);
      
      if (!project) {
        return this._getNoScanHtml(projectName);
      }

      const latestScan = scanRepo.getLatest(project.id);
      
      if (!latestScan) {
        return this._getNoScanHtml(projectName);
      }

      const findings = findingRepo.findByScanId(latestScan.id);
      
      // Parse technologies safely
      let technologies: string[] = [];
      try {
        technologies = JSON.parse(latestScan.technologies);
      } catch {
        technologies = [];
      }

      return this._getDashboardHtml(
        projectName,
        {
          files: latestScan.file_count,
          problems: latestScan.problem_count,
          warnings: latestScan.warning_count,
          technologies
        },
        findings,
        latestScan.scan_timestamp
      );
    } catch (error) {
      console.error('[Sidebar] Error loading data:', error);
      return this._getErrorHtml(projectName);
    }
  }

  private _getNoWorkspaceHtml(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Doctor</title>
      ${this._getStyles()}
    </head>
    <body>
      <div class="container">
        <div class="empty-state">
          <h2>Project Doctor</h2>
          <h3>No workspace open</h3>
          <p>Open a project folder to start analyzing your code health.</p>
        </div>
      </div>
    </body>
    </html>`;
  }

  private _getNoScanHtml(projectName: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Doctor</title>
      ${this._getStyles()}
    </head>
    <body>
      <div class="container">
        <div class="project-header">
          <h2>${this._escapeHtml(projectName)}</h2>
        </div>
        
        <div class="empty-state">
          <h3>Ready to scan</h3>
          <p>Analyze files, dependencies, and project configuration.</p>
          <button class="scan-button" data-action="scan">
            Scan workspace
          </button>
        </div>
      </div>
      ${this._getScripts()}
    </body>
    </html>`;
  }

  private _getErrorHtml(projectName: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Doctor</title>
      ${this._getStyles()}
    </head>
    <body>
      <div class="container">
        <div class="project-header">
          <h2>${this._escapeHtml(projectName)}</h2>
        </div>
        
        <div class="empty-state">
          <h3>Could not load scan results</h3>
          <p>Try scanning the workspace again.</p>
          <button class="scan-button" data-action="scan">
            Retry scan
          </button>
        </div>
      </div>
      ${this._getScripts()}
    </body>
    </html>`;
  }

  private _getDashboardHtml(
    projectName: string,
    stats: { files: number; problems: number; warnings: number; technologies: string[] },
    findings: Array<{ 
      severity: string; 
      title: string; 
      description: string; 
      category: string; 
      filePath?: string;
      line?: number;
      column?: number;
      endLine?: number;
      endColumn?: number;
    }>,
    lastScanned: string
  ): string {
    const formatDate = (timestamp: string) => {
      const date = new Date(timestamp);
      return date.toLocaleString();
    };
    const technologies = stats.technologies.map(tech => this._escapeHtml(tech));
    const renderedFindings = findings.slice(0, 10).map(finding => {
      const severity = this._severityClass(finding.severity);
      const line = Math.max(1, Number(finding.line) || 1);
      const column = Math.max(1, Number(finding.column) || 1);
      const endLine = Math.max(1, Number(finding.endLine) || line);
      const endColumn = Math.max(1, Number(finding.endColumn) || column + 10);
      const filePath = finding.filePath ? this._escapeHtml(finding.filePath) : '';

      return `
        <div class="finding-item ${severity}" ${finding.filePath ? `role="button" tabindex="0" data-file-path="${filePath}" data-line="${line}" data-column="${column}" data-end-line="${endLine}" data-end-column="${endColumn}"` : ''}>
          <div class="finding-header">
            <span class="finding-severity">${this._escapeHtml(finding.severity)}</span>
            <span class="finding-title">${this._escapeHtml(finding.title)}</span>
          </div>
          <div class="finding-description">${this._escapeHtml(finding.description)}</div>
          ${finding.filePath ? `<div class="finding-file">${filePath}${finding.line ? `:${line}` : ''}</div>` : ''}
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Project Doctor</title>
      ${this._getStyles()}
    </head>
    <body>
      <div class="container">
        <div class="project-header">
          <h2>${this._escapeHtml(projectName)}</h2>
          <div class="last-scan">Last scan: ${this._escapeHtml(formatDate(lastScanned))}</div>
        </div>

        <div class="stats-section">
          <div class="stat-card">
            <div class="stat-info">
              <div class="stat-value">${stats.files}</div>
              <div class="stat-label">Total Files</div>
            </div>
          </div>

          <div class="stat-card ${stats.problems > 0 ? 'error' : 'success'}">
            <div class="stat-info">
              <div class="stat-value">${stats.problems}</div>
              <div class="stat-label"><span class="status-dot error ${stats.problems > 0 ? 'active' : ''}" aria-hidden="true"></span>Errors Found</div>
            </div>
          </div>

          <div class="stat-card ${stats.warnings > 0 ? 'warning' : 'success'}">
            <div class="stat-info">
              <div class="stat-value">${stats.warnings}</div>
              <div class="stat-label"><span class="status-dot warning ${stats.warnings > 0 ? 'active' : ''}" aria-hidden="true"></span>Warnings</div>
            </div>
          </div>
        </div>

        ${stats.technologies.length > 0 ? `
          <div class="section">
            <h3>Technologies Detected</h3>
            <div class="tech-badges">
              ${technologies.map(tech => `<span class="tech-badge">${tech}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${findings.length > 0 ? `
          <div class="section">
            <h3>Issues & Recommendations</h3>
            <div class="findings-list">
              ${renderedFindings}
              ${findings.length > 10 ? `<div class="more-findings">+ ${findings.length - 10} more issues to review</div>` : ''}
            </div>
          </div>
        ` : `
          <div class="section">
            <div class="success-message">
              <div>Perfect! No issues detected</div>
            </div>
          </div>
        `}

        <div class="action-section">
          <button class="scan-button" data-action="scan">
            Scan project again
          </button>
        </div>

      </div>
      ${this._getScripts()}
    </body>
    </html>`;
  }

  private _getStyles(): string {
    return `<style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: var(--vscode-font-family);
        font-size: 13px;
        color: var(--vscode-foreground);
        background-color: var(--vscode-sideBar-background);
        padding: 0;
      }

      .container {
        padding: 12px;
      }

      /* Native Header */
      .project-header {
        margin-bottom: 16px;
        padding: 8px 0;
      }

      .project-header h2 {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 4px;
        color: var(--vscode-foreground);
      }

      .last-scan {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        padding-left: 0;
      }

      /* Native List-Style Statistics */
      .stats-section {
        margin-bottom: 16px;
      }

      .stat-card {
        display: flex;
        align-items: center;
        padding: 8px 0;
        transition: background-color 0.1s ease;
      }

      .stat-card:hover {
        background: var(--vscode-list-hoverBackground);
        margin: 0 -8px;
        padding: 8px;
      }

      .stat-info {
        flex: 1;
      }

      .stat-value {
        font-size: 18px;
        font-weight: 600;
        line-height: 1.2;
        color: var(--vscode-foreground);
      }

      .stat-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        margin-top: 2px;
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

      /* Native Sections */
      .section {
        margin-bottom: 16px;
      }

      .section h3 {
        font-size: 11px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0;
      }

      /* Native Technology List */
      .tech-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .tech-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 6px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        font-size: 11px;
        font-weight: 400;
      }

      /* Native Findings List */
      .findings-list {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .finding-item {
        padding: 8px 0;
        font-size: 12px;
        transition: background-color 0.1s ease;
        position: relative;
      }

      .finding-item[data-file-path] {
        cursor: pointer;
      }

      .finding-item[data-file-path]:hover {
        background: var(--vscode-list-hoverBackground);
        margin: 0 -8px;
        padding: 8px;
      }

      .finding-item[data-file-path]:focus-visible,
      .scan-button:focus-visible {
        outline: 1px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }

      .finding-item.error::before {
        content: '';
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 16px;
        background: var(--vscode-errorForeground);
      }

      .finding-item.warning::before {
        content: '';
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 16px;
        background: var(--vscode-editorWarning-foreground);
      }

      .finding-item.info::before {
        content: '';
        position: absolute;
        left: -8px;
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 16px;
        background: var(--vscode-editorInfo-foreground);
      }

      .finding-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }

      .finding-severity {
        font-size: 9px;
        text-transform: uppercase;
        font-weight: 500;
        padding: 1px 4px;
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        letter-spacing: 0;
      }

      .finding-title {
        font-weight: 500;
        flex: 1;
        color: var(--vscode-foreground);
      }

      .finding-description {
        color: var(--vscode-descriptionForeground);
        line-height: 1.4;
        margin-bottom: 4px;
      }

      .finding-file {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        font-family: var(--vscode-editor-font-family);
        opacity: 0.7;
      }

      .more-findings {
        text-align: center;
        padding: 8px;
        color: var(--vscode-descriptionForeground);
        font-size: 11px;
        font-weight: 400;
      }

      /* Native Empty States */
      .empty-state {
        text-align: center;
        padding: 32px 16px;
      }

      .empty-state h3 {
        font-size: 13px;
        margin-bottom: 6px;
        font-weight: 500;
        text-transform: none;
        letter-spacing: 0;
      }

      .empty-state p {
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        line-height: 1.5;
      }

      /* Native Success Message */
      .success-message {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px;
        color: var(--vscode-foreground);
        font-weight: 400;
        font-size: 12px;
      }

      /* Native Button */
      .scan-button {
        width: 100%;
        padding: 8px 16px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        font-size: 12px;
        font-weight: 400;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background-color 0.1s ease;
      }

      .scan-button:hover {
        background: var(--vscode-button-hoverBackground);
      }

      .scan-button:active {
        opacity: 0.95;
      }

      /* Action Section */
      .action-section {
        margin-top: 16px;
        padding-top: 16px;
      }

    </style>`;
  }

  private _getScripts(): string {
    return `<script>
      const vscode = acquireVsCodeApi();
      document.querySelectorAll('[data-action="scan"]').forEach(button => {
        button.addEventListener('click', () => vscode.postMessage({ type: 'scan' }));
      });

      document.querySelectorAll('.finding-item[data-file-path]').forEach(item => {
        const openFinding = () => vscode.postMessage({
          type: 'openFinding',
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
    </script>`;
  }

  private _escapeHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character] ?? character);
  }

  private _severityClass(severity: string): string {
    const normalized = severity.toLowerCase();
    return ['error', 'warning', 'info'].includes(normalized) ? normalized : 'info';
  }
}
