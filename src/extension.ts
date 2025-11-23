import * as vscode from 'vscode';
import { registerFixNamespacesCommand } from './commands/fixNamespaces';

export function activate(context: vscode.ExtensionContext) {
	registerFixNamespacesCommand(context);
}

export function deactivate() {}
