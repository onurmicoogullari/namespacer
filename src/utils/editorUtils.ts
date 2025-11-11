import * as vscode from 'vscode';

function getActiveEditorOrShowError(): vscode.TextEditor | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showErrorMessage('Namespacer: No active text editor.');
		return undefined;
	}
	return editor;
}

export function getActiveCSharpDocumentOrShowError(): vscode.TextDocument | undefined {
	const editor = getActiveEditorOrShowError();
	if (!editor) {
		return undefined;
	}

	const document = editor.document;
	if (document.languageId !== 'csharp') {
		vscode.window.showErrorMessage('Namespacer: Active file is not a C# document.');
		return undefined;
	}

	return document;
}
