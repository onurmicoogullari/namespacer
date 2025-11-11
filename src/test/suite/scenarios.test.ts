import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';


const fixturesRoot = path.resolve(__dirname, '../../../src/test/fixtures');

type ScopeSelection = 'file' | 'directory' | 'project' | 'solution';

type QuickPickSelector = (items: readonly vscode.QuickPickItem[]) => vscode.QuickPickItem | undefined;

async function withMockQuickPick(selectors: QuickPickSelector[], run: () => Promise<void>): Promise<void> {
	const originalQuickPick = vscode.window.showQuickPick;
	(vscode.window as any).showQuickPick = async (items: readonly vscode.QuickPickItem[] | PromiseLike<readonly vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions, token?: vscode.CancellationToken) => {
		const resolvedItems = Array.isArray(items) ? items : await items;
		const selector = selectors.shift();
		if (selector) {
			const result = selector(resolvedItems);
			if (result) {
				return result;
			}
		}

		const autoPick = autoPickItem(resolvedItems);
		if (autoPick) {
			return autoPick;
		}

		return originalQuickPick.call(vscode.window, items, options, token);
	};

	try {
		await run();
	} finally {
		(vscode.window as any).showQuickPick = originalQuickPick;
	}
}

function scopeSelector(scope: ScopeSelection): QuickPickSelector {
	return items => items.find(item => (item as any).scope === scope) ?? items.find(item => item.label.toLowerCase().includes(scope));
}

async function runFixNamespacesCommand(scope: ScopeSelection, extraSelectors: QuickPickSelector[] = []): Promise<void> {
	const selectors = [scopeSelector(scope), ...extraSelectors];
	await withMockQuickPick(selectors, async () => {
		await vscode.commands.executeCommand('namespacer.fixNamespaces');
	});
}

function selectSolutionByExtension(extension: string): QuickPickSelector {
	return items => items.find(item => item.label.endsWith(extension)) ?? items[0];
}

function autoPickItem(items: readonly vscode.QuickPickItem[]): vscode.QuickPickItem | undefined {
	const solutionPick = items.find(item => item.label?.endsWith('.slnx'));
	if (solutionPick) {
		return solutionPick;
	}
	return items[0];
}

async function prepareDocument(workspaceFolderName: string, inputFile: string): Promise<vscode.Uri> {
	const workspacePath = path.join(fixturesRoot, workspaceFolderName);
	const filePath = path.join(workspacePath, inputFile);
	const fileUri = vscode.Uri.file(filePath);

	vscode.workspace.updateWorkspaceFolders(0, null, {
		uri: vscode.Uri.file(workspacePath)
	});

	if (!fs.existsSync(filePath)) {
		throw new Error(`File does not exist: ${filePath}`);
	}

	const doc = await vscode.workspace.openTextDocument(fileUri);
	await vscode.languages.setTextDocumentLanguage(doc, 'csharp');
	await vscode.window.showTextDocument(doc);

	return fileUri;
}

async function readLines(fileUri: vscode.Uri): Promise<string[]> {
	const resultAsText = (await vscode.workspace.openTextDocument(fileUri)).getText();
	return resultAsText.split(/\r?\n/);
}

function runScenario(workspaceFolderName: string, inputFile: string, expectedLines: string[]) {
	return async () => {
		const fileUri = await prepareDocument(workspaceFolderName, inputFile);

		await runFixNamespacesCommand('file');

		const resultAsLines = await readLines(fileUri);

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

	suite('Header comment before usings', () => {
		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'CommentBeforeUsings.cs', [
				'// Sample header comment',
				'using System;',
				'',
				'namespace Csproj.RootNamespace;',
				'',
				'public class CommentBeforeUsings',
				'{',
				'}',
			])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'CommentBeforeUsings.cs', [
				'// Sample header comment',
				'using System;',
				'',
				'namespace DirectoryBuildProps.RootNamespace;',
				'',
				'public class CommentBeforeUsings',
				'{',
				'}',
			])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'CommentBeforeUsings.cs', [
				'// Sample header comment',
				'using System;',
				'',
				'namespace NoRootNamespace;',
				'',
				'public class CommentBeforeUsings',
				'{',
				'}',
			])
		);
	});

	suite('Assembly attributes (no namespace)', () => {
		const lines = [
			'using System.Runtime.CompilerServices;',
			'',
			'[assembly: InternalsVisibleTo("Diml.Pseudonymization.Tests")]',
			'',
			'// Needed for NSubstitute',
			'[assembly: InternalsVisibleTo("DynamicProxyGenAssembly2")]',
		];

		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'AssemblyInfo.cs', lines)
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'AssemblyInfo.cs', lines)
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'AssemblyInfo.cs', lines)
		);
	});

	suite('Global using files', () => {
		const lines = [
			'global using System;',
			'global using System.Threading.Tasks;',
		];

		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'GlobalUsings.cs', lines)
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'GlobalUsings.cs', lines)
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'GlobalUsings.cs', lines)
		);
	});

	suite('Block namespaces', () => {
		test('With RootNamespace in .csproj',
			runScenario('RootNamespace', 'BlockNamespace.cs', [
				'using System;',
				'',
				'namespace Csproj.RootNamespace',
				'{',
				'    public class BlockNamespace',
				'    {',
				'        ',
				'    }',
				'}',
			])
		);

		test('With RootNamespace in Directory.Build.props',
			runScenario('DirectoryBuildProps', 'BlockNamespace.cs', [
				'using System;',
				'',
				'namespace DirectoryBuildProps.RootNamespace',
				'{',
				'    public class BlockNamespace',
				'    {',
				'        ',
				'    }',
				'}',
			])
		);

		test('Without RootNamespace',
			runScenario('NoRootNamespace', 'BlockNamespace.cs', [
				'using System;',
				'',
				'namespace NoRootNamespace',
				'{',
				'    public class BlockNamespace',
				'    {',
				'        ',
				'    }',
				'}',
			])
		);
	});
});

suite('Bulk commands', () => {
	test('Fix namespace in directory updates files within the active folder only', async () => {
		const alphaUri = await prepareDocument('BulkDirectory', 'DirOne/Alpha.cs');
		const workspacePath = path.join(fixturesRoot, 'BulkDirectory');
		const betaUri = vscode.Uri.file(path.join(workspacePath, 'DirOne/Beta.cs'));
		const gammaUri = vscode.Uri.file(path.join(workspacePath, 'DirTwo/Gamma.cs'));

		await runFixNamespacesCommand('directory');

		const alphaLines = await readLines(alphaUri);
		assert.strictEqual(alphaLines[0], 'using System;');
		assert.strictEqual(alphaLines[2], 'namespace BulkDirectory.DirOne;');
		assert.strictEqual(alphaLines[4], 'public class Alpha');

		const betaLines = await readLines(betaUri);
		assert.strictEqual(betaLines[0], 'namespace BulkDirectory.DirOne;');
		assert.strictEqual(betaLines[2], 'public class Beta');

		const gammaLines = await readLines(gammaUri);
		assert.strictEqual(gammaLines[0], 'public class Gamma');
		assert.ok(!gammaLines.some(line => line.startsWith('namespace BulkDirectory.DirTwo')), 'Gamma.cs should remain untouched.');
	});

	test('Fix namespace in project updates every file under the project root', async () => {
		const alphaUri = await prepareDocument('BulkProject', 'DirA/Alpha.cs');
		const workspacePath = path.join(fixturesRoot, 'BulkProject');
		const betaUri = vscode.Uri.file(path.join(workspacePath, 'DirB/Sub/Beta.cs'));

		await runFixNamespacesCommand('project');

		const alphaLines = await readLines(alphaUri);
		assert.strictEqual(alphaLines[0], 'namespace BulkProject.DirA;');
		assert.strictEqual(alphaLines[2], 'public class Alpha');

		const betaLines = await readLines(betaUri);
		assert.strictEqual(betaLines[0], 'using System;');
		assert.strictEqual(betaLines[2], 'namespace BulkProject.DirB.Sub;');
		assert.strictEqual(betaLines[4], 'public class Beta');
	});

	test('Fix namespace in solution prompts for selection and updates all files', async () => {
		const alphaUri = await prepareDocument('BulkSolution', 'Dir/Alpha.cs');

		await runFixNamespacesCommand('solution', [selectSolutionByExtension('.slnx')]);

		const alphaLines = await readLines(alphaUri);
		assert.strictEqual(alphaLines[0], 'using System;');
		assert.strictEqual(alphaLines[2], 'namespace BulkSolution.Dir;');
		assert.strictEqual(alphaLines[4], 'public class Alpha');
	});
});
