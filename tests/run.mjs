// npm test: tests/*.html opened in a headless Chrome (CHROME to name another), each page
// writing its verdict in #result - lines starting with "ok", or "FAIL ...". jQuery is read from
// the path in JQUERY (a jquery.js of any project), copied beside the pages for the run.
//
// The browser is driven over its DevTools protocol (a WebSocket, Node's own), not with
// --dump-dom and a virtual time budget: under virtual time the renderer produces frames only
// now and then, so requestAnimationFrame and the scroll events - everything the scroll modules
// are made of - stand still. Here the pages run in real time; a page has TIMEOUT ms (15000) to
// replace "pending" in #result.
import { spawn } from 'node:child_process';
import { copyFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const jquery = process.env.JQUERY;
const timeout = +(process.env.TIMEOUT || 15000);
const only = process.argv.slice(2);
if (!jquery) {
    console.error('JQUERY=<path to jquery.js> npm test [page.html ...]');
    process.exit(2);
}
copyFileSync(jquery, join(here, 'jquery.js'));

// A browser, and the protocol over its WebSocket: send(method, params, sessionId) answers with
// the result; events are handed to whoever waits for them.
function launch() {
    const profile = mkdtempSync(join(tmpdir(), 'flowjs-tests-'));
    const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files', '--remote-debugging-port=0', '--no-first-run', '--user-data-dir=' + profile, '--window-size=1280,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
    return new Promise((resolve, reject) => {
        let err = '';
        child.stderr.on('data', (chunk) => {
            err += chunk;
            const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
            if (m) resolve({ child, url: m[1], profile });
        });
        child.on('exit', () => reject(new Error('Chrome left: ' + err.slice(-400))));
        setTimeout(() => reject(new Error('Chrome did not say where it listens: ' + err.slice(-400))), 10000);
    });
}

function connect(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        let id = 0;
        const waiting = new Map();
        const listeners = [];
        ws.onmessage = (m) => {
            const msg = JSON.parse(m.data);
            if (msg.id && waiting.has(msg.id)) {
                const { resolve, reject } = waiting.get(msg.id);
                waiting.delete(msg.id);
                msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
            } else if (msg.method) {
                listeners.slice().forEach((fn) => fn(msg));
            }
        };
        ws.onerror = (e) => reject(new Error('WebSocket: ' + (e.message || 'error')));
        ws.onopen = () => resolve({
            send: (method, params = {}, sessionId) => new Promise((resolve, reject) => {
                waiting.set(++id, { resolve, reject });
                ws.send(JSON.stringify({ id, method, params, sessionId }));
            }),
            on: (fn) => listeners.push(fn),
            close: () => ws.close()
        });
    });
}

async function run(cdp, page) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    const console_ = [];
    cdp.on((msg) => {
        if (msg.sessionId !== sessionId) return;
        if (msg.method === 'Runtime.exceptionThrown') console_.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') console_.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
    });
    await cdp.send('Page.navigate', { url: 'file://' + join(here, page) }, sessionId);

    const began = Date.now();
    let result = 'FAIL no verdict';
    while (Date.now() - began < timeout) {
        const { result: r } = await cdp.send('Runtime.evaluate', { expression: '(document.getElementById("result") || {}).textContent', returnByValue: true }, sessionId);
        if (typeof r.value === 'string' && r.value !== 'pending') { result = r.value; break; }
        await new Promise((f) => setTimeout(f, 100));
    }
    if (result === 'FAIL no verdict') result = 'FAIL no verdict within ' + timeout + 'ms';
    await cdp.send('Target.closeTarget', { targetId });
    return result + (console_.length ? '\n' + console_.join('\n') : '');
}

let failed = 0;
let browser;
try {
    browser = await launch();
    const cdp = await connect(browser.url);
    const pages = readdirSync(here).filter((f) => f.endsWith('.html') && (!only.length || only.includes(f))).sort();
    for (const page of pages) {
        const result = await run(cdp, page);
        const ok = result.split('\n').every((line) => line.startsWith('ok'));
        failed += ok ? 0 : 1;
        console.log((ok ? 'PASS ' : 'FAIL ') + page + '\n  ' + result.split('\n').join('\n  '));
    }
    cdp.close();
} catch (e) {
    console.error(e.message);
    failed++;
} finally {
    if (browser) {
        await new Promise((f) => { browser.child.on('exit', f); browser.child.kill(); setTimeout(f, 3000); });
        try { rmSync(browser.profile, { recursive: true, force: true }); } catch (e) { /* Chrome still writing: the OS cleans its temp */ }
    }
    rmSync(join(here, 'jquery.js'), { force: true });
}
process.exit(failed ? 1 : 0);
