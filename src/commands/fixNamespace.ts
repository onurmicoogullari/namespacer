import * as vscode from 'vscode';
import { findClosestCsproj, findRootNamespace, calculateNamespace } from '../utils/csprojUtils';
import { findClosestSln } from '../utils/slnUtils';

export async function fixNamespace(document: vscode.TextDocument): Promise<void> {
    const filePath = document.uri.fsPath;
    const csprojPath = await findClosestCsproj(filePath);
    if (!csprojPath) {
        vscode.window.showErrorMessage('Could not find a .csproj file.');
        return;
    }
    const slnPath = await findClosestSln(csprojPath);
    const rootNamespace = await findRootNamespace(csprojPath, slnPath ?? undefined);
    if (!rootNamespace) {
        vscode.window.showErrorMessage('Failed to determine root namespace.');
        return;
    }

    const namespace = `namespace ${calculateNamespace(csprojPath, rootNamespace, filePath)};`;
    const edit = new vscode.WorkspaceEdit();
    const doc = document;

    // Empty or whitespace-only file -> insert at top
    if (doc.getText().trim().length === 0) {
        edit.insert(doc.uri, new vscode.Position(0, 0), namespace + '\n');
        await vscode.workspace.applyEdit(edit);
        return;
    }

    // Locate last using and first content
    const lastUsingLine = findLastUsingLine(doc);
    const firstContentLine = findFirstContentLine(doc);
    const firstNonUsingLine = findFirstNonUsingLineIncludingBlank(doc);

    // Single-namespace-only file -> replace existing namespace
    const existingRange = findExistingNamespaceRange(doc);
    if (existingRange && firstContentLine === existingRange.start.line) {
        edit.replace(doc.uri, existingRange, namespace);
        await vscode.workspace.applyEdit(edit);
        return;
    }

    // Remove blank lines between usings (or top) and first content
    const startLine = lastUsingLine >= 0 ? lastUsingLine + 1 : 0;
    const endLine = firstContentLine >= 0 ? firstContentLine : startLine;
    const lineCount = doc.lineCount;

    const startPos = startLine < lineCount
        ? doc.lineAt(startLine).range.start
        : new vscode.Position(lineCount, 0);
    
    const endPos = endLine < lineCount
        ? doc.lineAt(endLine).range.start
        : new vscode.Position(lineCount, 0);

    if (startPos.isBefore(endPos)) {
        edit.delete(doc.uri, new vscode.Range(startPos, endPos));
    }

    let textToInsert = '';

    if (lastUsingLine >= 0) {
        if (firstNonUsingLine === -1)
        {
            textToInsert += '\n';
        }

        textToInsert += '\n';
    }

    textToInsert += namespace;

    if (firstContentLine >= 0) {
        textToInsert += '\n';
    }

    textToInsert += '\n';

    edit.insert(doc.uri, startPos, textToInsert);
    await vscode.workspace.applyEdit(edit);
}

function findLastUsingLine(doc: vscode.TextDocument): number {
    for (let i = doc.lineCount - 1; i >= 0; i--) {
        if (doc.lineAt(i).text.trim().startsWith('using')) {
            return i;
        }
    }
    return -1;
}

function findFirstNonUsingLineIncludingBlank(doc: vscode.TextDocument): number {
    for (let i = 0; i < doc.lineCount; i++) {
        if (!doc.lineAt(i).text.trim().startsWith('using')) {
            return i;
        }
    }
    return -1;
}

function findFirstContentLine(doc: vscode.TextDocument): number {
    for (let i = 0; i < doc.lineCount; i++) {
        const t = doc.lineAt(i).text.trim();
        if (t === '' || t.startsWith('using')) {
            continue;
        }
        return i;
    }
    return -1;
}

function findExistingNamespaceRange(doc: vscode.TextDocument): vscode.Range | undefined {
    const namespaceRegex = /^\s*namespace\s+[\w.]+;?\s*$/;
    for (let i = 0; i < doc.lineCount; i++) {
        if (namespaceRegex.test(doc.lineAt(i).text)) {
            return doc.lineAt(i).range;
        }
    }
    return undefined;
}