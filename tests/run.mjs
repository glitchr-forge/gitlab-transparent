// npm test: tests/*.html opened in a headless Chrome (CHROME to name another), each page
// writing its verdict in #result - lines starting with "ok", or "FAIL ...". jQuery is read from
// the path in JQUERY (a jquery.js of any project), copied beside the pages for the run.
//
// The browser is driven over its DevTools protocol (a WebSocket, Node's own), not with
// --dump-dom and a virtual time budget: under virtual time the renderer produces frames only
// now and then, so requestAnimationFrame and the scroll events - everything the scroll modules
// are made of - stand still. Here the pages run in real time; a page has TIMEOUT ms (15000) to
// replace "pending" in #result.
//
// The pages are served over HTTP (a server of this script's, on a free port of 127.0.0.1): the
// navigation needs an origin - a history it may push to, requests it may send - and tests/site.mjs
// answers under /site/ as a small site would (pages, a form's answers, a failure, a nest). A page
// that expects a console error says so in window.__expectedErrors (strings the message contains).
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync, readdirSync, rmSync, mkdtempSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { handle as site } from './site.mjs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const chrome = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const jquery = process.env.JQUERY;
const timeout = +(process.env.TIMEOUT || 15000);
const only = process.argv.slice(2);
if (!jquery) {
    console.error('JQUERY=<path to jquery.js> npm test [page.html ...]');
    process.exit(2);
}
if (!existsSync(jquery)) {
    console.error('JQUERY names no file: ' + jquery);
    process.exit(2);
}

// The repository served as it is (/tests/..., /src/...), jQuery at /tests/jquery.js, the site under /site/.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serve() {
    const server = createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        if (url.pathname.startsWith('/site/')) {
            Promise.resolve(site(req, res, url)).catch((e) => { try { res.writeHead(500); res.end(String(e && e.stack || e)); } catch (x) { /* already answered */ } });
            return;
        }
        const file = url.pathname === '/tests/jquery.js' ? jquery : join(root, normalize(decodeURIComponent(url.pathname)));
        if (file !== jquery && !file.startsWith(root + '/')) { res.writeHead(403); res.end(); return; }
        if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        createReadStream(file).pipe(res);
    });
    return new Promise((f) => server.listen(0, '127.0.0.1', () => f(server)));
}

// A browser, and the protocol over its WebSocket: send(method, params, sessionId) answers with
// the result; events are handed to whoever waits for them.
function launch() {
    const profile = mkdtempSync(join(tmpdir(), 'flowjs-tests-'));
    const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--no-first-run', '--user-data-dir=' + profile, '--window-size=1280,900', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
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

async function run(cdp, page, origin) {
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    // In front: a tab behind another draws no frame, and the scroll modules are made of frames.
    await cdp.send('Page.bringToFront', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    const console_ = [];
    cdp.on((msg) => {
        if (msg.sessionId !== sessionId) return;
        if (msg.method === 'Runtime.exceptionThrown') console_.push('exception: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') console_.push('console.error: ' + msg.params.args.map((a) => a.value ?? a.description).join(' '));
    });
    await cdp.send('Page.navigate', { url: origin + '/tests/' + page }, sessionId);

    const began = Date.now();
    let result = 'FAIL no verdict';
    while (Date.now() - began < timeout) {
        const { result: r } = await cdp.send('Runtime.evaluate', { expression: '(document.getElementById("result") || {}).textContent', returnByValue: true }, sessionId);
        if (typeof r.value === 'string' && r.value !== 'pending') { result = r.value; break; }
        await new Promise((f) => setTimeout(f, 100));
    }
    if (result === 'FAIL no verdict') result = 'FAIL no verdict within ' + timeout + 'ms';
    // The errors a page said it would raise (a failed request shown to the reader) are not failures.
    let expected = [];
    try {
        const { result: e } = await cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(window.__expectedErrors || [])', returnByValue: true }, sessionId);
        expected = JSON.parse(e.value || '[]');
    } catch (e) { /* the page is gone: nothing expected */ }
    const unexpected = console_.filter((line) => !expected.some((text) => line.includes(text)));
    await cdp.send('Target.closeTarget', { targetId });
    return result + (unexpected.length ? '\n' + unexpected.join('\n') : '');
}

let failed = 0;
let browser;
let server;
try {
    server = await serve();
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await launch();
    const cdp = await connect(browser.url);
    const pages = readdirSync(here).filter((f) => f.endsWith('.html') && (!only.length || only.includes(f))).sort();
    for (const page of pages) {
        const result = await run(cdp, page, origin);
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
    if (server) { server.closeAllConnections(); server.close(); }
}
process.exit(failed ? 1 : 0);
