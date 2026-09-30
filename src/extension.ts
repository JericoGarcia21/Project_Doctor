import * as fs from 'fs';
import * as vscode from 'vscode';
import { ProjectDoctorDatabase } from './database/Database';
import { ScanProjectCommand } from './commands/ScanProjectCommand';
import { OpenDashboardCommand } from './commands/OpenDashboardCommand';
import { SidebarProvider } from './views/SidebarProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const outputChannel = vscode.window.createOutputChannel('Project Doctor');

	try {
		console.log('[Project Doctor] Extension is now active');

		const storagePath = context.globalStorageUri?.fsPath ?? context.storageUri?.fsPath ?? vscode.Uri.joinPath(context.extensionUri, '..').fsPath;

		const database = new ProjectDoctorDatabase(storagePath);
		await database.initialize();

		const sidebarProvider = new SidebarProvider(context.extensionUri, database);
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider('project-doctor-overview', sidebarProvider)
		);

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

					let absolutePath: string;
					const normalizedPath = decodeURIComponent(filePath.trim());

					if (normalizedPath.startsWith('file:')) {
						absolutePath = vscode.Uri.parse(normalizedPath).fsPath;
					} else if (/^[a-zA-Z]:[\\/]/.test(normalizedPath) || normalizedPath.startsWith('\\\\')) {
						absolutePath = normalizedPath.replace(/\//g, '\\');
					} else {
						absolutePath = vscode.Uri.joinPath(workspaceFolders[0].uri, normalizedPath).fsPath;
					}

					if (!fs.existsSync(absolutePath)) {
						vscode.window.showWarningMessage(`The file no longer exists and cannot be opened: ${absolutePath}`);
						return;
					}

					const document = await vscode.workspace.openTextDocument(absolutePath);
					const editor = await vscode.window.showTextDocument(document);

					if (line !== undefined) {
						const startLine = Math.max(0, (line || 1) - 1);
						const startColumn = Math.max(0, (column || 1) - 1);
						const endLineNumber = endLine !== undefined ? Math.max(0, endLine - 1) : startLine;
						const endColumnNumber = endColumn !== undefined ? Math.max(0, endColumn - 1) : startColumn + 10;

						const range = new vscode.Range(
							new vscode.Position(startLine, startColumn),
							new vscode.Position(endLineNumber, endColumnNumber)
						);

						editor.selection = new vscode.Selection(range.start, range.end);
						editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);

						const decorationType = vscode.window.createTextEditorDecorationType({
							backgroundColor: 'rgba(255, 255, 0, 0.3)',
							border: '1px solid rgba(255, 255, 0, 0.8)'
						});

						editor.setDecorations(decorationType, [range]);
						setTimeout(() => decorationType.dispose(), 3000);
					}
				} catch (error) {
					vscode.window.showErrorMessage(`Could not open file: ${error}`);
				}
			})
		);

		context.subscriptions.push(outputChannel);

		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders && workspaceFolders.length > 0) {
			outputChannel.appendLine(`Project Doctor activated for workspace: ${workspaceFolders[0].uri.fsPath}`);
			outputChannel.appendLine('Run "Project Doctor: Scan Project" to analyze your project');
		} else {
			outputChannel.appendLine('Project Doctor activated. Open a workspace to start analyzing.');
		}

		context.subscriptions.push({
			dispose: () => {
				database.close();
			}
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('[Project Doctor] Activation failed:', error);
		outputChannel.appendLine(`Activation failed: ${message}`);
		vscode.window.showErrorMessage(`Project Doctor failed to activate: ${message}`);
		throw error;
	}
}

export function deactivate(): void {
	console.log('[Project Doctor] Extension is now deactivated');
}
