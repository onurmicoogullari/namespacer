import * as vscode from 'vscode';
import * as path from 'path';
import { fixNamespaceInFile } from './fixNamespaceInFile';

export interface BulkFixOptions {
    scopeLabel: string;
    progressTitle: string;
    emptyMessage: string;
    csprojSelectionCache?: Map<string, string>;
    rootNamespaceCache?: Map<string, string>;
    slnSelectionCache?: Map<string, string>;
    stopAtSolution?: boolean;
    csprojResolver?: (uri: vscode.Uri) => Promise<string | null> | string | null;
}

const DEFAULT_EXCLUDE_GLOB = '**/{bin,obj,node_modules}/**';

export function getDefaultExcludeGlob(): string {
    return DEFAULT_EXCLUDE_GLOB;
}

export function findCSharpFiles(baseUri: vscode.Uri): Thenable<vscode.Uri[]> {
    const pattern = new vscode.RelativePattern(baseUri, '**/*.cs');
    return vscode.workspace.findFiles(pattern, DEFAULT_EXCLUDE_GLOB);
}

export async function runBulkFix(fileUris: vscode.Uri[], options: BulkFixOptions): Promise<void> {
    if (fileUris.length === 0) {
        vscode.window.showInformationMessage(options.emptyMessage);
        return;
    }

    const deduped = Array.from(
        new Map(fileUris.map(uri => [uri.fsPath, uri])).values()
    ).sort((a, b) => a.fsPath.localeCompare(b.fsPath));

    const selectionCache = options.csprojSelectionCache ?? new Map<string, string>();
    const slnSelectionCache = options.slnSelectionCache ?? new Map<string, string>();
    const rootNamespaceCache = options.rootNamespaceCache ?? new Map<string, string>();
    const updated: string[] = [];
    const failed: string[] = [];

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: options.progressTitle,
            cancellable: false,
        },
        async progress => {
            for (let i = 0; i < deduped.length; i++) {
                const uri = deduped[i];
                progress.report({
                    message: `${i + 1}/${deduped.length} ${path.basename(uri.fsPath)}`,
                });

                try {
                    const document = await vscode.workspace.openTextDocument(uri);
                    const csprojOverride = options.csprojResolver ? await options.csprojResolver(uri) : undefined;
                    const result = await fixNamespaceInFile(document, {
                        suppressNotifications: true,
                        csprojSelectionCache: selectionCache,
                        slnSelectionCache,
                        rootNamespaceCache,
                        stopAtSolution: options.stopAtSolution,
                        csprojOverride,
                    });
                    if (!result.success) {
                        failed.push(uri.fsPath);
                    } else if (result.updated) {
                        updated.push(uri.fsPath);
                    }
                } catch {
                    failed.push(uri.fsPath);
                }
            }
        }
    );

    const totalFixed = updated.length;
    const totalFailed = failed.length;
    const summaryBase = `Namespacer: Fixed ${totalFixed} file(s) in ${options.scopeLabel}.`;

    void vscode.window.showInformationMessage(summaryBase);

    if (totalFailed > 0) {
        void vscode.window.showErrorMessage(`Namespacer: Failed to fix ${totalFailed} file(s) in ${options.scopeLabel}.`);
    }
}
