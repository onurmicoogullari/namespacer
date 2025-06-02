import * as vscode from 'vscode';
import * as path from 'path';
import { Parser } from 'xml2js';

export async function findClosestCsproj(filePath: string): Promise<string | null> {
    let dir = path.dirname(filePath);

    while (true) {
        const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
        const csprojFiles = files.filter(([name, _]) => name.endsWith('.csproj'));

        if (csprojFiles.length === 1) {
            return path.join(dir, csprojFiles[0][0]);
        } else if (csprojFiles.length > 1) {
            const picked = await vscode.window.showQuickPick(
                csprojFiles.map(([name, _]) => ({
                    label: name,
                    description: path.join(dir, name),
                })),
                {
                    placeHolder: 'Multiple .csproj files found. Select the project to use for namespace.'
                }
            );

            if (picked) {
                return picked.description ?? null;
            } else {
                return null;
            }
        }

        const slnFiles = files.filter(([name, _]) => name.endsWith('.sln'));

        if (slnFiles.length > 0) {
            return null;
        }

        const parentDir = path.dirname(dir);
        if (parentDir === dir) {
            return null;
        }
        dir = parentDir;
    }
}

export async function findRootNamespace(csprojPath: string, slnPath?: string): Promise<string> {
    const csprojRootNamespace = await readRootNamespace(csprojPath);
    if (csprojRootNamespace) {
        return csprojRootNamespace;
    }

    let dir = path.dirname(csprojPath);
    const solutionDir = slnPath ? path.dirname(slnPath) : undefined;

    while (true) {
        const propsPath = path.join(dir, 'Directory.Build.props');
        if (await fileExists(propsPath)) {
            const propsRootNamespace = await readRootNamespace(propsPath);
            if (propsRootNamespace) {
                return propsRootNamespace;
            }
        }

        if (solutionDir && dir === solutionDir) {
            break;
        }

        const parentDir = path.dirname(dir);
        if (parentDir === dir) {
            break;
        }
        dir = parentDir;
    }

    return path.basename(csprojPath, '.csproj');
}

async function readRootNamespace(filePath: string): Promise<string | null> {
    try {
        const uri = vscode.Uri.file(filePath);
        const contentBuffer = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(contentBuffer).toString('utf8');

        const parser = new Parser({ explicitArray: false });
        const parsedContent = await parser.parseStringPromise(content);

        const project = parsedContent?.Project;
        if (project?.PropertyGroup) {
            const propertyGroups = project.PropertyGroup;
            if (Array.isArray(propertyGroups)) {
                for (const group of propertyGroups) {
                    if (group?.RootNamespace) {
                        return group.RootNamespace;
                    }
                }
            } else {
                if (propertyGroups.RootNamespace) {
                    return propertyGroups.RootNamespace;
                }
            }
        }
    } catch (error) {
        // Silently fail, since it's totally fine and even expected in many scenarios.
    }
    return null;
}

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
        return true;
    } catch {
        return false;
    }
}

export function calculateNamespace(csprojPath: string, rootNamespace: string, filePath: string): string {
    const csprojDir = path.dirname(csprojPath);
    const relativePath = path.relative(csprojDir, path.dirname(filePath));

    // Normalize path for cross-platform (Windows/Linux/Mac)
    const namespaceSuffix = relativePath
        .split(path.sep)
        .filter(part => part.length > 0)
        .map(part => part.replace(/[^a-zA-Z0-9_]/g, '')) // Remove invalid characters
        .join('.');

    if (namespaceSuffix.length > 0) {
        return `${rootNamespace}.${namespaceSuffix}`;
    } else {
        return rootNamespace;
    }
}