import * as vscode from 'vscode';
import { fixNamespaceInFile } from '../handlers/fixNamespaceInFile';
import { fixNamespaceInDirectory } from '../handlers/fixNamespaceInDirectory';
import { fixNamespaceInProject } from '../handlers/fixNamespaceInProject';
import { fixNamespaceInSolution } from '../handlers/fixNamespaceInSolution';
import { getActiveCSharpDocumentOrShowError } from '../utils/editorUtils';

export type ScopeSelection = 'file' | 'directory' | 'project' | 'solution';

interface ScopePickItem extends vscode.QuickPickItem {
	scope: ScopeSelection;
}

export function registerFixNamespacesCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand('namespacer.fixNamespaces', async () => {
		const scopeItems: ScopePickItem[] = [
			{ label: 'File', description: 'Fix only the active C# file', scope: 'file' },
			{ label: 'Directory', description: 'Fix all files in the active file’s directory tree', scope: 'directory' },
			{ label: 'Project', description: 'Fix every file within the current project', scope: 'project' },
			{ label: 'Solution', description: 'Pick a solution and fix every file within it', scope: 'solution' },
		];

		const selection = await vscode.window.showQuickPick(scopeItems, {
			placeHolder: 'Select which scope that you want to fix namespace(s) for',
		});

		if (!selection) {
			return;
		}

		await handleScopeSelection(selection.scope);
	});

	context.subscriptions.push(disposable);
}

async function handleScopeSelection(scope: ScopeSelection): Promise<void> {
	switch (scope) {
		case 'file': {
			const document = getActiveCSharpDocumentOrShowError();
			if (!document) {
				return;
			}
			await fixNamespaceInFile(document);
			break;
		}
		case 'directory':
			await fixNamespaceInDirectory();
			break;
		case 'project':
			await fixNamespaceInProject();
			break;
		case 'solution':
			await fixNamespaceInSolution();
			break;
	}
}
