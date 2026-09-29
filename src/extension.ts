import * as vscode from 'vscode';
import { ProjectDoctorDatabase } from './database/Database';
import { ScanProjectCommand } from './commands/ScanProjectCommand';
import { OpenDashboardCommand } from './commands/OpenDashboardCommand';
import { SidebarProvider } from './views/SidebarProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[Project Doctor] Extension is now active');

  const outputChannel = vscode.window.createOutputChannel('Project Doctor');
  
  // Initialize database
  const database = new ProjectDoctorDatabase(context.globalStorageUri.fsPath);
  await database.initialize();

  // Initialize sidebar provider
  const sidebarProvider = new SidebarProvider(context.extensionUri, database);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('project-doctor-overview', sidebarProvider)
  );

  // Register commands
  const scanCommand = new ScanProjectCommand(database, outputChannel);
  const dashboardCommand = new OpenDashboardCommand(context, database);

  context.subscriptions.push(
    vscode.commands.registerCommand('project-doctor.scanProject', () => {
      scanCommand.execute();
      sidebarProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('project-doctor.openDashboard', () => dashboardCommand.execute())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('project-doctor.refreshView', () => {
      sidebarProvider.refresh();
    })
  );

  // Register command for navigating to findings
  context.subscriptions.push(
    vscode.commands.registerCommand('project-doctor.openFinding', async (filePath: string, line?: number, column?: number, endLine?: number, endColumn?: number) => {
      if (!filePath) {
        return;
      }

      try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage('No workspace folder open');
          return;
        }

        // Resolve absolute path
        let absolutePath: string;
        if (vscode.Uri.parse(filePath).scheme) {
          absolutePath = filePath;
        } else {
          absolutePath = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath).fsPath;
        }

        const document = await vscode.workspace.openTextDocument(absolutePath);
        const editor = await vscode.window.showTextDocument(document);

        // Highlight the specific line/range if provided
        if (line !== undefined) {
          const startLine = Math.max(0, (line || 1) - 1); // Convert to 0-based indexing
          const startColumn = Math.max(0, (column || 1) - 1);
          const endLineNumber = endLine !== undefined ? Math.max(0, endLine - 1) : startLine;
          const endColumnNumber = endColumn !== undefined ? Math.max(0, endColumn - 1) : startColumn + 10;

          const range = new vscode.Range(
            new vscode.Position(startLine, startColumn),
            new vscode.Position(endLineNumber, endColumnNumber)
          );

          // Set selection and reveal the range
          editor.selection = new vscode.Selection(range.start, range.end);
          editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

          // Highlight the range temporarily
          const decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 255, 0, 0.3)',
            border: '1px solid rgba(255, 255, 0, 0.8)'
          });

          editor.setDecorations(decorationType, [range]);

          // Remove highlight after 3 seconds
          setTimeout(() => {
            decorationType.dispose();
          }, 3000);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Could not open file: ${error}`);
      }
    })
  );

  context.subscriptions.push(outputChannel);

  // Show welcome message if workspace is open
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    outputChannel.appendLine(`Project Doctor activated for workspace: ${workspaceFolders[0].uri.fsPath}`);
    outputChannel.appendLine('Run "Project Doctor: Scan Project" to analyze your project');
  } else {
    outputChannel.appendLine('Project Doctor activated. Open a workspace to start analyzing.');
  }

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose: () => {
      database.close();
    }
  });
}

export function deactivate(): void {
  console.log('[Project Doctor] Extension is now deactivated');
}
