// npm test: tests/*.html opened in a headless Chrome (CHROME to name another); each page writes
// its verdict in #result - lines starting with "ok", or "FAIL ...". jQuery is read from the
// path in JQUERY (a jquery.js of any project), copied beside the pages for the run.
import { execFileSync } from 'node:child_process';
import { copyFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const jquery = process.env.JQUERY;
if (!jquery) {
    console.error('JQUERY=<path to jquery.js> npm test');
    process.exit(2);
}
copyFileSync(jquery, join(here, 'jquery.js'));

let failed = 0;
try {
    for (const page of readdirSync(here).filter((f) => f.endsWith('.html'))) {
        const html = execFileSync(chrome, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=2000', '--dump-dom', 'file://' + join(here, page)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const result = (html.match(/<pre id="result">([\s\S]*?)<\/pre>/) || [, 'FAIL no verdict'])[1];
        const ok = result.split('\n').every((line) => line.startsWith('ok'));
        failed += ok ? 0 : 1;
        console.log((ok ? 'PASS ' : 'FAIL ') + page + '\n  ' + result.split('\n').join('\n  '));
    }
} finally {
    rmSync(join(here, 'jquery.js'), { force: true });
}
process.exit(failed ? 1 : 0);
