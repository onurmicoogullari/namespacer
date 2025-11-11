import * as vscode from 'vscode';
import * as path from 'path';
import { findCSharpFiles, runBulkFix } from './bulkFix';
import { getActiveCSharpDocumentOrShowError } from '../utils/editorUtils';

export async function fixNamespaceInDirectory(): Promise<void> {
	const document = getActiveCSharpDocumentOrShowError();
	if (!document) {
		return;
	}

    const directoryPath = path.dirname(document.uri.fsPath);
    const directoryUri = vscode.Uri.file(directoryPath);
    const files = await findCSharpFiles(directoryUri);

    const selectionCache = new Map<string, string>();
    const rootNamespaceCache = new Map<string, string>();
    const directoryName = path.basename(directoryPath) || directoryPath;

    await runBulkFix(files, {
        scopeLabel: `directory "${directoryName}"`,
        progressTitle: 'Namespacer: Fixing namespace(s) in directory',
        emptyMessage: `Namespacer: No C# files found in directory "${directoryName}".`,
        csprojSelectionCache: selectionCache,
        rootNamespaceCache,
    });
}
