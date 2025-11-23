import * as vscode from 'vscode';
import { findClosestCsproj, findRootNamespace, calculateNamespace } from '../utils/csprojUtils';
import { findClosestSln } from '../utils/slnUtils';

export interface FixNamespaceOptions {
    suppressNotifications?: boolean;
    csprojSelectionCache?: Map<string, string>;
    rootNamespaceCache?: Map<string, string>;
    slnSelectionCache?: Map<string, string>;
    stopAtSolution?: boolean;
    csprojOverride?: string | null;
}

export interface FixNamespaceResult {
    success: boolean;
    updated: boolean;
}

interface NamespaceMatch {
    line: number;
    range: vscode.Range;
    style: 'file' | 'block';
}

export async function fixNamespaceInFile(document: vscode.TextDocument, options?: FixNamespaceOptions): Promise<FixNamespaceResult> {
    const filePath = document.uri.fsPath;
    const csprojPath = options?.csprojOverride ?? await findClosestCsproj(filePath, {
        selectionCache: options?.csprojSelectionCache,
        stopAtSolution: options?.stopAtSolution !== undefined ? options.stopAtSolution : true,
    });
    if (!csprojPath) {
        if (!options?.suppressNotifications) {
            vscode.window.showErrorMessage('Could not find a .csproj file.');
        }
        return { success: false, updated: false };
    }

    const slnPath = await findClosestSln(csprojPath, { selectionCache: options?.slnSelectionCache });
    const rootNamespace = await findRootNamespace(
        csprojPath,
        slnPath ?? undefined,
        options?.rootNamespaceCache
    );
    if (!rootNamespace) {
        if (!options?.suppressNotifications) {
            vscode.window.showErrorMessage('Failed to determine root namespace.');
        }
        return { success: false, updated: false };
    }

    const namespaceName = calculateNamespace(csprojPath, rootNamespace, filePath);
    const namespaceLine = `namespace ${namespaceName};`;
    const edit = new vscode.WorkspaceEdit();
    const doc = document;
    const originalText = doc.getText();

    if (containsAssemblyOrModuleAttribute(doc) || containsGlobalUsing(doc)) {
        return { success: true, updated: false };
    }

    // Empty or whitespace-only file -> insert at top
    if (originalText.trim().length === 0) {
        edit.insert(doc.uri, new vscode.Position(0, 0), namespaceLine + '\n');
        return await applyAndReport(edit, doc, originalText);
    }

    // Locate last using and first content
    const lastUsingLine = findLastUsingLine(doc);
    const firstContentLine = findFirstContentLine(doc);
    const firstNonUsingLine = findFirstNonUsingLineIncludingBlank(doc);

    const namespaceMatch = findNamespaceDeclaration(doc);
    if (namespaceMatch && hasOnlyTrivialContentBeforeLine(doc, namespaceMatch.line)) {
        const newLine = buildNamespaceLine(doc.lineAt(namespaceMatch.line).text, namespaceName, namespaceMatch.style);
        if (doc.lineAt(namespaceMatch.line).text.trim() === newLine.trim()) {
            return { success: true, updated: false };
        }

        edit.replace(doc.uri, namespaceMatch.range, newLine);

        removeBlankLineBeforeBraceIfNeeded(doc, edit, namespaceMatch);

        return await applyAndReport(edit, doc, originalText);
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
        if (firstNonUsingLine === -1) {
            textToInsert += '\n';
        }

        textToInsert += '\n';
    }

    textToInsert += namespaceLine;

    if (firstContentLine >= 0) {
        textToInsert += '\n';
    }

    textToInsert += '\n';

    edit.insert(doc.uri, startPos, textToInsert);
    return await applyAndReport(edit, doc, originalText);
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

function findNamespaceDeclaration(doc: vscode.TextDocument): NamespaceMatch | undefined {
    const fileRegex = /^\s*namespace\s+[\w.]+\s*;\s*$/;
    const blockRegex = /^\s*namespace\s+[^{;]+$/;

    for (let i = 0; i < doc.lineCount; i++) {
        const text = doc.lineAt(i).text;
        if (fileRegex.test(text)) {
            return { line: i, range: doc.lineAt(i).range, style: 'file' };
        }
        if (blockRegex.test(text)) {
            return { line: i, range: doc.lineAt(i).range, style: 'block' };
        }
    }

    return undefined;
}

function buildNamespaceLine(existingLine: string, namespaceName: string, style: 'file' | 'block'): string {
    const indentMatch = existingLine.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : '';

    if (style === 'block') {
        return `${indent}namespace ${namespaceName}`;
    }

    return `${indent}namespace ${namespaceName};`;
}

function containsAssemblyOrModuleAttribute(doc: vscode.TextDocument): boolean {
    const attributeRegex = /^\s*\[(assembly|module)\s*:/i;
    for (let i = 0; i < doc.lineCount; i++) {
        if (attributeRegex.test(doc.lineAt(i).text)) {
            return true;
        }
    }
    return false;
}

function containsGlobalUsing(doc: vscode.TextDocument): boolean {
    const globalUsingRegex = /^\s*global\s+using\b/i;
    for (let i = 0; i < doc.lineCount; i++) {
        if (globalUsingRegex.test(doc.lineAt(i).text)) {
            return true;
        }
    }

    return false;
}

function removeBlankLineBeforeBraceIfNeeded(doc: vscode.TextDocument, edit: vscode.WorkspaceEdit, match: NamespaceMatch): void {
    if (match.style !== 'block') {
        return;
    }

    const blankLineIndex = match.line + 1;
    if (blankLineIndex >= doc.lineCount) {
        return;
    }

    const blankLine = doc.lineAt(blankLineIndex);
    if (blankLine.text.trim() !== '') {
        return;
    }

    const braceLineIndex = blankLineIndex + 1;
    if (braceLineIndex >= doc.lineCount) {
        return;
    }

    const braceLine = doc.lineAt(braceLineIndex);
    if (braceLine.text.trim().startsWith('{')) {
        edit.delete(doc.uri, blankLine.rangeIncludingLineBreak);
    }
}

function hasOnlyTrivialContentBeforeLine(doc: vscode.TextDocument, targetLine: number): boolean {
    for (let i = 0; i < targetLine; i++) {
        const text = doc.lineAt(i).text.trim();
        if (
            text === '' ||
            text.startsWith('using') ||
            text.startsWith('//') ||
            text.startsWith('/*') ||
            text.startsWith('*') ||
            text.startsWith('*/') ||
            text.startsWith('#')
        ) {
            continue;
        }

        return false;
    }

    return true;
}

async function applyAndReport(edit: vscode.WorkspaceEdit, doc: vscode.TextDocument, originalText: string): Promise<FixNamespaceResult> {
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
        return { success: false, updated: false };
    }

    const updatedText = doc.getText();
    return {
        success: true,
        updated: updatedText !== originalText,
    };
}
