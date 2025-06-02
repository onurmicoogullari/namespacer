import Mocha from 'mocha';
import * as path from 'path';

export function run(): Promise<void> {
    const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 10000 });

    mocha.addFile(path.resolve(__dirname, './scenarios.test.js'));

    return new Promise((resolve, reject) => {
        mocha.run(failures => {
            if (failures > 0) {
                console.error(`❌ Mocha run failed with ${failures} failure(s).`);
                reject(new Error(`${failures} test(s) failed.`));
            } else {
                console.log('✅ All tests passed.');
                resolve();
            }
        });
    });
}