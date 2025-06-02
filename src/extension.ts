import * as vscode from 'vscode';
import { fixNamespace } from './commands/fixNamespace';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('namespacer.fixNamespace', async () => {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			await fixNamespace(editor.document);
		}
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
