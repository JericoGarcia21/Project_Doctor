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
          <div class="icon">🏥</div>
          <h3>Welcome to Project Doctor</h3>
          <p>Open a project folder to start analyzing your code health.</p>
        </div>
        <div class="branding">
          Powered by Project Doctor
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
          <h2><span class="project-icon">🏥</span>${projectName}</h2>
        </div>
        
        <div class="empty-state">
          <div class="icon">🔍</div>
          <h3>Ready to Diagnose</h3>
          <p>Click the button below to start your project health check. We'll analyze your code, dependencies, and configurations.</p>
          <button class="scan-button" onclick="scan()">
            <span class="button-icon">🔍</span>
            Start Diagnosis
          </button>
        </div>

        <div class="branding">
          Powered by Project Doctor
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
          <h2><span class="project-icon">🏥</span>${projectName}</h2>
        </div>
        
        <div class="empty-state">
          <div class="icon">⚠️</div>
          <h3>Diagnosis Error</h3>
          <p>We encountered an issue while loading your scan results. Please try scanning again.</p>
          <button class="scan-button" onclick="scan()">
            <span class="button-icon">🔄</span>
            Retry Diagnosis
          </button>
        </div>

        <div class="branding">
          Powered by Project Doctor
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
          <h2><span class="project-icon">🏥</span>${projectName}</h2>
          <div class="last-scan">${formatDate(lastScanned)}</div>
        </div>

        <div class="stats-section">
          <div class="stat-card">
            <div class="stat-icon">📄</div>
            <div class="stat-info">
              <div class="stat-value">${stats.files}</div>
              <div class="stat-label">Total Files</div>
            </div>
          </div>

          <div class="stat-card ${stats.problems > 0 ? 'error' : 'success'}">
            <div class="stat-icon">${stats.problems > 0 ? '🔴' : '✅'}</div>
            <div class="stat-info">
              <div class="stat-value">${stats.problems}</div>
              <div class="stat-label">Errors Found</div>
            </div>
          </div>

          <div class="stat-card ${stats.warnings > 0 ? 'warning' : 'success'}">
            <div class="stat-icon">${stats.warnings > 0 ? '⚠️' : '✅'}</div>
            <div class="stat-info">
              <div class="stat-value">${stats.warnings}</div>
              <div class="stat-label">Warnings</div>
            </div>
          </div>
        </div>

        ${stats.technologies.length > 0 ? `
          <div class="section">
            <h3>Technologies Detected</h3>
            <div class="tech-badges">
              ${stats.technologies.map(tech => `<span class="tech-badge">${tech}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${findings.length > 0 ? `
          <div class="section">
            <h3>Issues & Recommendations</h3>
            <div class="findings-list">
              ${findings.slice(0, 10).map(finding => `
                <div class="finding-item ${finding.severity.toLowerCase()}" ${finding.filePath ? `onclick="openFinding('${finding.filePath}', ${finding.line || 1}, ${finding.column || 1}, ${finding.endLine || finding.line || 1}, ${finding.endColumn || (finding.column || 1) + 10})"` : ''}>
                  <div class="finding-header">
                    <span class="finding-severity">${finding.severity}</span>
                    <span class="finding-title">${finding.title}</span>
                  </div>
                  <div class="finding-description">${finding.description}</div>
                  ${finding.filePath ? `<div class="finding-file">📁 ${finding.filePath}${finding.line ? `:${finding.line}` : ''}</div>` : ''}
                </div>
              `).join('')}
              ${findings.length > 10 ? `<div class="more-findings">+ ${findings.length - 10} more issues to review</div>` : ''}
            </div>
          </div>
        ` : `
          <div class="section">
            <div class="success-message">
              <div class="icon">✨</div>
              <div>Perfect! No issues detected</div>
            </div>
          </div>
        `}

        <div class="action-section">
          <button class="scan-button" onclick="scan()">
            <span class="button-icon">🔍</span>
            Rescan Project
          </button>
        </div>

        <div class="branding">
          Powered by Project Doctor
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
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .project-icon {
        font-size: 16px;
        opacity: 0.8;
      }

      .last-scan {
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        padding-left: 22px;
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

      .stat-icon {
        font-size: 16px;
        margin-right: 8px;
        opacity: 0.7;
        width: 20px;
        text-align: center;
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
        font-size: 11px;
        color: var(--vscode-descriptionForeground);
        margin-top: 2px;
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
        letter-spacing: 0.3px;
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
        cursor: pointer;
      }

      .finding-item:hover {
        background: var(--vscode-list-hoverBackground);
        margin: 0 -8px;
        padding: 8px;
      }

      .finding-item:not([onclick]) {
        cursor: default;
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
        letter-spacing: 0.2px;
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

      .empty-state .icon {
        font-size: 32px;
        margin-bottom: 12px;
        opacity: 0.6;
      }

      .empty-state h3 {
        font-size: 13px;
        margin-bottom: 6px;
        font-weight: 500;
        text-transform: none;
        letter-spacing: normal;
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

      .success-message .icon {
        font-size: 16px;
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

      .button-icon {
        font-size: 14px;
      }

      /* Action Section */
      .action-section {
        margin-top: 16px;
        padding-top: 16px;
      }

      /* Minimal Branding */
      .branding {
        text-align: center;
        padding: 12px 0;
        margin-top: 16px;
        color: var(--vscode-descriptionForeground);
        font-size: 10px;
        opacity: 0.4;
      }
    </style>`;
  }

  private _getScripts(): string {
    return `<script>
      const vscode = acquireVsCodeApi();
      
      function scan() {
        vscode.postMessage({ type: 'scan' });
      }

      function refresh() {
        vscode.postMessage({ type: 'refresh' });
      }

      function openFinding(filePath, line, column, endLine, endColumn) {
        vscode.postMessage({ 
          type: 'openFinding', 
          filePath: filePath,
          line: line,
          column: column,
          endLine: endLine,
          endColumn: endColumn
        });
      }
    </script>`;
  }
}
