import * as path from 'path';
import { runTests, downloadAndUnzipVSCode } from '@vscode/test-electron';

async function main() {
    try {
        const vscodeExecutablePath = await downloadAndUnzipVSCode('stable');
        const fixturesRoot = path.resolve(__dirname, '../../../src/test/fixtures');

        await runTests({
            vscodeExecutablePath: vscodeExecutablePath,
            extensionDevelopmentPath: path.resolve(__dirname, '../'),
            extensionTestsPath: path.resolve(__dirname, 'suite', 'index.js'),
            launchArgs: [fixturesRoot]
                .concat(['--skip-welcome'])
                .concat(['--disable-extensions'])
                .concat(['--skip-release-notes'])
                .concat(['--enable-proposed-api'])
                .concat(['--no-cached-data'])
                .concat(['--disable-workspace-trust'])
        });
    } catch (error) {
        console.error('Failed to run tests');
        if (error instanceof Error) {
            console.error('error message: ' + error.message);
            console.error('error name: ' + error.name);
            console.error('error stack: ' + error.stack);
        } else {
            console.error('No error object: ' + JSON.stringify(error));
        }
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});