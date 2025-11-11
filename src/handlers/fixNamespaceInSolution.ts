import * as vscode from 'vscode';
import * as path from 'path';
import { findCSharpFiles, getDefaultExcludeGlob, runBulkFix } from './bulkFix';
import { listSolutionProjects } from '../utils/slnUtils';

interface SolutionPickItem extends vscode.QuickPickItem {
    uri: vscode.Uri;
}

export async function fixNamespaceInSolution(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('Namespacer: Open a workspace before running this command.');
        return;
    }

    const solutionFiles = await findSolutionFiles(workspaceFolders);

    if (solutionFiles.length === 0) {
        vscode.window.showInformationMessage('Namespacer: No solution files (.sln or .slnx) found in this workspace.');
        return;
    }

    const pickItems: SolutionPickItem[] = solutionFiles
        .sort((a, b) => a.fsPath.localeCompare(b.fsPath))
        .map(uri => {
            const label = path.basename(uri.fsPath);
            const description = path.dirname(uri.fsPath);
            return { label, description, uri };
        });

    const selection = await vscode.window.showQuickPick(pickItems, {
        placeHolder: 'Select a solution to fix namespaces for.',
        canPickMany: false,
    });

    if (!selection) {
        return;
    }

    const solutionUri = selection.uri;
    const baseUri = vscode.Uri.file(path.dirname(solutionUri.fsPath));
    const files = await findCSharpFiles(baseUri);
    const selectionCache = new Map<string, string>();
    const rootNamespaceCache = new Map<string, string>();
    const solutionName = path.basename(solutionUri.fsPath);
    const slnSelectionCache = new Map<string, string>();
    slnSelectionCache.set(path.dirname(solutionUri.fsPath), solutionUri.fsPath);
    const projectPaths = await listSolutionProjects(solutionUri);
    const resolver = (uri: vscode.Uri): string | null => {
        const filePath = uri.fsPath;
        let selectedProject: string | null = null;
        let longestMatch = -1;

        for (const project of projectPaths) {
            const projectDir = path.dirname(project);
            if (filePath.startsWith(projectDir + path.sep)) {
                if (projectDir.length > longestMatch) {
                    longestMatch = projectDir.length;
                    selectedProject = project;
                }
            }
        }

        return selectedProject;
    };

    await runBulkFix(files, {
        scopeLabel: `solution "${solutionName}"`,
        progressTitle: 'Namespacer: Fixing namespace(s) in solution',
        emptyMessage: `Namespacer: No C# files found for solution "${solutionName}".`,
        csprojSelectionCache: selectionCache,
        rootNamespaceCache,
        slnSelectionCache,
        stopAtSolution: false,
        csprojResolver: resolver,
    });
}

async function findSolutionFiles(workspaceFolders: readonly vscode.WorkspaceFolder[]): Promise<vscode.Uri[]> {
    const exclude = getDefaultExcludeGlob();
    const discovered: vscode.Uri[] = [];

    for (const folder of workspaceFolders) {
        const pattern = new vscode.RelativePattern(folder, '**/*.{sln,slnx}');
        const matches = await vscode.workspace.findFiles(pattern, exclude);
        discovered.push(...matches);
    }

    const deduped = new Map<string, vscode.Uri>();
    for (const uri of discovered) {
        deduped.set(uri.fsPath, uri);
    }

    return Array.from(deduped.values()).sort((a, b) => a.fsPath.localeCompare(b.fsPath));
}
