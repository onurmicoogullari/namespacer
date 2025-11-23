import * as vscode from 'vscode';
import * as path from 'path';
import { findClosestCsproj } from '../utils/csprojUtils';
import { findCSharpFiles, runBulkFix } from './bulkFix';
import { getActiveCSharpDocumentOrShowError } from '../utils/editorUtils';

export async function fixNamespaceInProject(): Promise<void> {
	const document = getActiveCSharpDocumentOrShowError();
	if (!document) {
		return;
	}

    const selectionCache = new Map<string, string>();
    const csprojPath = await findClosestCsproj(document.uri.fsPath, { selectionCache });
    if (!csprojPath) {
        vscode.window.showErrorMessage('Namespacer: Could not determine the project for this file.');
        return;
    }

    const projectDir = path.dirname(csprojPath);
    const projectUri = vscode.Uri.file(projectDir);
    const files = await findCSharpFiles(projectUri);

    const rootNamespaceCache = new Map<string, string>();
    const projectName = path.basename(csprojPath);

    await runBulkFix(files, {
        scopeLabel: `project "${projectName}"`,
        progressTitle: 'Namespacer: Fixing namespace(s) in project',
        emptyMessage: `Namespacer: No C# files found for project "${projectName}".`,
        csprojSelectionCache: selectionCache,
        rootNamespaceCache,
    });
}
