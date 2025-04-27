import * as vscode from 'vscode';
import * as path from 'path';

export async function findClosestSln(filePath: string): Promise<string | null> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
    const workspacePath = workspaceFolder?.uri.fsPath;

    let dir = path.dirname(filePath);

    while (true) {
        const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
        const slnFiles = files.filter(([name, _]) => name.endsWith('.sln'));

        if (slnFiles.length > 0) {
            return path.join(dir, slnFiles[0][0]);
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
