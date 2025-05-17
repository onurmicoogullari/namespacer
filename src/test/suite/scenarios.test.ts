import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';


const fixturesRoot = path.resolve(__dirname, '../../../src/test/fixtures');

function runScenario(workspaceFolderName: string, inputFile: string, expectedLines: string[]) {
	const workspacePath = path.join(fixturesRoot, workspaceFolderName);
	const filePath = path.join(workspacePath, inputFile);
	const fileUri = vscode.Uri.file(filePath);

	return async () => {
		vscode.workspace.updateWorkspaceFolders(0, null, {
			uri: vscode.Uri.file(workspacePath)
		});

		if (!fs.existsSync(filePath)) {
			throw new Error(`File does not exist: ${filePath}`);
		}

		const doc = await vscode.workspace.openTextDocument(fileUri);
		await vscode.languages.setTextDocumentLanguage(doc, 'csharp');
		await vscode.window.showTextDocument(doc);

		await vscode.commands.executeCommand('namespacer.fixNamespace');

		const resultAsText = (await vscode.workspace.openTextDocument(fileUri)).getText();
		const resultAsLines = resultAsText.split(/\r?\n/);

		

		expectedLines.forEach((expected, index) => {
			assert.strictEqual(resultAsLines[index], expected, `Line ${index + 1} mismatch`);
		});
	};
}

suite('Namespace insertion scenarios', function () {
	suite('Empty file', () => {
		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'Empty.cs', ['namespace Csproj.RootNamespace;'])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'Empty.cs', ['namespace DirectoryBuildProps.RootNamespace;'])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'Empty.cs', ['namespace NoRootNamespace;'])
		);
	});

	suite('Namespace only', () => {
		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'NamespaceOnly.cs', ['namespace Csproj.RootNamespace;'])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'NamespaceOnly.cs', ['namespace DirectoryBuildProps.RootNamespace;'])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'NamespaceOnly.cs', ['namespace NoRootNamespace;'])
		);
	});

	suite('No usings, with code', () => {
		const lines = [
			'',
			'public class TestClass',
			'{',
			'    ',
			'}',
		];

		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'NoUsingsWithCode.cs', ['namespace Csproj.RootNamespace;', ...lines])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'NoUsingsWithCode.cs', ['namespace DirectoryBuildProps.RootNamespace;', ...lines])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'NoUsingsWithCode.cs', ['namespace NoRootNamespace;', ...lines])
		);
	});

	suite('Usings, with code, with no blank lines', () => {
		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'UsingsWithCodeWithNoBlankLines.cs', [
				'using TestUsingOne;',
				'using TestUsingTwo;',
				'',
				'namespace Csproj.RootNamespace;',
				'',
				'public class TestClass',
				'{',
				'    ',
				'}',
			])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'UsingsWithCodeWithNoBlankLines.cs', [
				'using TestUsingOne;',
				'using TestUsingTwo;',
				'',
				'namespace DirectoryBuildProps.RootNamespace;',
				'',
				'public class TestClass',
				'{',
				'    ',
				'}',
			])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'UsingsWithCodeWithNoBlankLines.cs', [
				'using TestUsingOne;',
				'using TestUsingTwo;',
				'',
				'namespace NoRootNamespace;',
				'',
				'public class TestClass',
				'{',
				'    ',
				'}',
			])
		);
	});

	suite('Usings, with code', () => {
		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'UsingWithCode.cs', [
				'using TestUsing;',
				'',
				'namespace Csproj.RootNamespace;',
				'',
				'public class TestClass',
				'{',
				'    ',
				'}',
			])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'UsingWithCode.cs', [
				'using TestUsing;',
				'',
				'namespace DirectoryBuildProps.RootNamespace;',
				'',
				'public class TestClass',
				'{',
				'    ',
				'}',
			])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'UsingWithCode.cs', [
				'using TestUsing;',
				'',
				'namespace NoRootNamespace;',
				'',
				'public class TestClass',
				'{',
				'    ',
				'}',
			])
		);
	});

	suite('Usings, with no code', () => {
		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'UsingWithNoCode.cs', [
				'using TestUsing;',
				'',
				'namespace Csproj.RootNamespace;',
				'',
			])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'UsingWithNoCode.cs', [
				'using TestUsing;',
				'',
				'namespace DirectoryBuildProps.RootNamespace;',
				'',
			])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'UsingWithNoCode.cs', [
				'using TestUsing;',
				'',
				'namespace NoRootNamespace;',
				'',
			])
		);
	});

	suite('Usings, with no code, no blank lines', () => {
		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'UsingWithNoCodeNoBlankLine.cs', [
				'using TestUsing;',
				'',
				'namespace Csproj.RootNamespace;',
				'',
			])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'UsingWithNoCodeNoBlankLine.cs', [
				'using TestUsing;',
				'',
				'namespace DirectoryBuildProps.RootNamespace;',
				'',
			])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'UsingWithNoCodeNoBlankLine.cs', [
				'using TestUsing;',
				'',
				'namespace NoRootNamespace;',
				'',
			])
		);
	});
});
