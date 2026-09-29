import * as vscode from 'vscode';
import { ProjectScanner } from '../core/ProjectScanner';
import { DependencyAnalyzer } from '../analyzers/DependencyAnalyzer';
import { ImportAnalyzer } from '../analyzers/ImportAnalyzer';
import { FileAnalyzer } from '../analyzers/FileAnalyzer';
import { SecurityAnalyzer } from '../analyzers/SecurityAnalyzer';
import { DependencyTreeAnalyzer } from '../analyzers/DependencyTreeAnalyzer';
import { ConfigurationAnalyzer } from '../analyzers/ConfigurationAnalyzer';
import { ProjectDoctorDatabase } from '../database/Database';
import { ProjectRepository } from '../database/repositories/ProjectRepository';
import { ScanRepository } from '../database/repositories/ScanRepository';
import { FindingRepository } from '../database/repositories/FindingRepository';

export class ScanProjectCommand {
  constructor(
    private database: ProjectDoctorDatabase,
    private outputChannel: vscode.OutputChannel
  ) {}

  async execute(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace is currently open. Please open a project folder first.');
      return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    this.outputChannel.appendLine(`Starting Project Doctor scan of: ${workspacePath}`);
    this.outputChannel.show();

    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Project Doctor',
          cancellable: false
        },
        async (progress) => {
          progress.report({ message: 'Scanning project...' });

          // Create scanner with analyzers
          const analyzers = [
            new DependencyAnalyzer(),
            new ImportAnalyzer(),
            new FileAnalyzer(),
            new SecurityAnalyzer(),
            new DependencyTreeAnalyzer(),
            new ConfigurationAnalyzer()
          ];

          const scanner = new ProjectScanner(analyzers);
          const scanResult = await scanner.scan(workspacePath);

          this.outputChannel.appendLine(`\nScan completed in ${scanResult.scanDuration}ms`);
          this.outputChannel.appendLine(`Files scanned: ${scanResult.statistics.totalFiles}`);
          this.outputChannel.appendLine(`Technologies detected: ${scanResult.statistics.technologies.join(', ')}`);
          this.outputChannel.appendLine(`Warnings: ${scanResult.getWarningCount()}`);
          this.outputChannel.appendLine(`Errors: ${scanResult.getErrorCount()}`);

          // Save to database
          progress.report({ message: 'Saving results...' });
          const db = this.database.getDb();
          const projectRepo = new ProjectRepository(db);
          const scanRepo = new ScanRepository(db);
          const findingRepo = new FindingRepository(db);

          const project = projectRepo.upsert(workspacePath, scanResult.context.projectName);
          const scanId = scanRepo.create(project.id, scanResult);
          findingRepo.createMany(scanId, scanResult.findings);
          projectRepo.updateLastScanned(project.id);
          
          // Save database changes
          this.database.save();

          this.outputChannel.appendLine(`\nResults saved to database (scan ID: ${scanId})`);

          // Show summary
          if (scanResult.hasErrors()) {
            vscode.window.showWarningMessage(
              `Project Doctor found ${scanResult.getErrorCount()} error(s) and ${scanResult.getWarningCount()} warning(s)`,
              'View Results'
            ).then(selection => {
              if (selection === 'View Results') {
                vscode.commands.executeCommand('project-doctor.openDashboard');
              }
            });
          } else if (scanResult.hasWarnings()) {
            vscode.window.showInformationMessage(
              `Project Doctor found ${scanResult.getWarningCount()} warning(s)`,
              'View Results'
            ).then(selection => {
              if (selection === 'View Results') {
                vscode.commands.executeCommand('project-doctor.openDashboard');
              }
            });
          } else {
            vscode.window.showInformationMessage('Project Doctor scan completed successfully! No issues found.');
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`\nError during scan: ${errorMessage}`);
      vscode.window.showErrorMessage(`Project Doctor scan failed: ${errorMessage}`);
    }
  }
}
