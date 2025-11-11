import * as vscode from 'vscode';
import * as path from 'path';

export interface SlnSearchOptions {
    selectionCache?: Map<string, string>;
}

export async function findClosestSln(filePath: string, options?: SlnSearchOptions): Promise<string | null> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    const workspacePath = workspaceFolder?.uri.fsPath;

    let dir = path.dirname(filePath);

    while (true) {
        const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
        const slnFiles = files.filter(([name, _]) => name.endsWith('.sln') || name.endsWith('.slnx'));

        if (slnFiles.length > 0) {
            const cached = options?.selectionCache?.get(dir);
            if (cached) {
                return cached;
            }

            if (slnFiles.length === 1) {
                const resolvedPath = path.join(dir, slnFiles[0][0]);
                options?.selectionCache?.set(dir, resolvedPath);
                return resolvedPath;
            }

            const picked = await vscode.window.showQuickPick(
                slnFiles.map(([name, _]) => ({
                    label: name,
                    description: path.join(dir, name),
                })),
                {
                    placeHolder: 'Multiple solution files found. Select the solution to use for namespace resolution.',
                }
            );

            if (picked?.description) {
                options?.selectionCache?.set(dir, picked.description);
                return picked.description;
            }

            return null;
        }

        if (workspacePath && dir === workspacePath) {
            break; // Reached workspace root, stop
        }

        const parentDir = path.dirname(dir);
        if (parentDir === dir) {
            break; // Reached filesystem root (fallback safety), stop
        }
        dir = parentDir;
    }

    return null;
}

export async function listSolutionProjects(solutionUri: vscode.Uri): Promise<string[]> {
    const solutionDir = path.dirname(solutionUri.fsPath);
    const contentBuffer = await vscode.workspace.fs.readFile(solutionUri);
    const content = Buffer.from(contentBuffer).toString('utf8');

    if (solutionUri.fsPath.endsWith('.slnx')) {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed?.projects)) {
                return parsed.projects
                    .filter((entry: unknown): entry is string => typeof entry === 'string')
                    .map((projectPath: string) => path.resolve(solutionDir, normalizeRelativePath(projectPath)));
            }
        } catch {
            return [];
        }
        return [];
    }

    const regex = /^Project\(".*"\)\s*=\s*".*?",\s*"(.*?)",/;
    const results: string[] = [];

    for (const line of content.split(/\r?\n/)) {
        const match = line.match(regex);
        if (match?.[1]) {
            const relativePath = normalizeRelativePath(match[1]);
            results.push(path.resolve(solutionDir, relativePath));
        }
    }

    return results;
}

function normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, path.sep);
}
