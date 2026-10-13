// The small site the navigation tests browse, served by tests/run.mjs under /site/: pages of one
// layout (#page is the block the navigation swaps), a form's answers, a page that fails, a
// connection that drops, pictures that arrive late without a size, and a back office that opens
// as a nest (it answers with the X-Transparent-Nest header).
const HEAD = '<meta charset="utf-8"><link rel="stylesheet" href="/tests/site.css">';

const sections = (n, prefix = 's') => Array.from({ length: n }, (_, i) => `<section id="${prefix}${i + 1}" class="block">${prefix}${i + 1}</section>`).join('\n');

const pages = {
    one: () => `<h1>One</h1>
        <nav>
            <a id="to-two" href="/site/page/two">two</a>
            <a id="to-two-deep" href="/site/page/two#deep">two, deep</a>
            <a id="to-long" href="/site/page/long">long</a>
            <a id="to-built" href="/site/page/built">built</a>
            <a id="to-waiting" href="/site/page/waiting">waiting</a>
            <a id="to-own" href="/site/page/own">own</a>
            <a id="to-slow" href="/site/slow?ms=400">slow</a>
            <a id="to-styled" href="/site/page/styled">styled</a>
            <a id="to-error" href="/site/error">error</a>
            <a id="to-drop" href="/site/drop">drop</a>
            <a id="to-except" href="/site/except/file">excepted</a>
            <a id="to-admin" href="/site/admin/home">admin</a>
            <a id="to-anchor" href="#s3">s3</a>
        </nav>
        <canvas id="kept-canvas" width="10" height="10"></canvas>
        ${sections(4)}
        <form id="search" method="get" action="/site/echo"><input name="q" value="rice"><button type="submit" id="search-go">go</button></form>
        <form id="post" method="post" action="/site/echo">
            <input name="title" value="hello">
            <input type="checkbox" name="ticked" value="yes" checked><input type="checkbox" name="unticked" value="no">
            <input type="radio" name="choice" value="a"><input type="radio" name="choice" value="b" checked>
            <button type="submit" name="action" value="save" id="post-save">save</button>
            <button type="submit" name="action" value="publish" id="post-publish"><span id="post-publish-icon">publish</span></button>
        </form>
        <form id="refused" method="post" action="/site/refuse"><input name="title" value="x"><button type="submit" id="refused-go">send</button></form>`,
    two: () => `<h1>Two</h1><a id="to-one" href="/site/page/one">one</a><canvas id="kept-canvas" width="10" height="10"></canvas>${sections(6)}<h2 id="deep">Deep</h2>${sections(3, 't')}`,
    styled: () => `<h1>Styled</h1><a id="to-one" href="/site/page/one">one</a>`,
    // A long page that is not whole when it comes in: each section gets its height a moment later, one after
    // the other, every time the page is put in (a controller that builds its layout, pictures without a size).
    long: () => `<h1>Long</h1><a id="to-two" href="/site/page/two">two</a>` + Array.from({ length: 12 }, (_, i) =>
        `<section id="l${i + 1}" class="block grow"><div class="late"></div><p>l${i + 1}</p></section>`).join('\n') + `
        <script>(function () {
            var late = document.querySelectorAll('.late');
            for (var i = 0; i < late.length; i++) late[i].style.height = '0px';
            [].forEach.call(late, function (el, i) { setTimeout(function () { el.style.height = '300px'; }, 80 + 25 * i); });
        })();</script>`,
    // A page as the sites make them, for the measurements (tests/perf/): forty sections, each a stop and a
    // headline with a block that fades in, under a header that hides.
    perf: () => `<header id="top" class="sticky sticky-top"><a id="to-perf" href="/site/page/perf?n=${Date.now()}${Math.random()}">again</a></header>` + Array.from({ length: 40 }, (_, i) =>
        `<section id="p${i + 1}" class="block sticky-stop sticky-headlines"><h2>p${i + 1}</h2><div class="sticky sticky-easein" data-sticky-easein="0">block</div><p><a href="#p${(i + 2) % 40 + 1}">on</a></p></section>`).join('\n'),
    // Pages with what waits for the visitor's consent (the cookie module): a script and a block that are
    // inert until "analytics" is granted, what is shown meanwhile, and a page that brings a banner of its own.
    waiting: () => `<h1>Waiting</h1><a id="to-one" href="/site/page/one">one</a><a id="to-own" href="/site/page/own">own</a>
        <script type="text/plain" data-cookie-category="analytics">window.__inert = (window.__inert || 0) + 1;</script>
        <template data-cookie-category="analytics"><p id="late">late</p></template>
        <p id="holder" data-cookie-placeholder="analytics">meanwhile</p>`,
    own: () => `<h1>Own</h1><a id="to-one" href="/site/page/one">one</a><a id="to-waiting" href="/site/page/waiting">waiting</a>
        <div id="own-banner" data-cookie-banner hidden><p id="own-words">the site's words</p><button type="button" id="own-accept" data-cookie-accept>yes</button></div>`,
    // A page a script finishes: its row scrolls sideways only a moment after the page is in, each time.
    built: () => `<h1>Built</h1><a id="to-two" href="/site/page/two">two</a>` + Array.from({ length: 8 }, (_, i) =>
        `<section id="b${i + 1}" class="block sticky-stop">b${i + 1}</section>`).join('\n') + `<div id="row" class="row"><div class="wide">wide</div></div>
        <script>(function () { var wide = document.querySelector('#row .wide'); wide.style.width = '10px'; setTimeout(function () { wide.style.width = ''; }, 150); })();</script>`,
};

function layout(title, body, { htmlClass = '', extra = '' } = {}) {
    return `<!doctype html><html class="${htmlClass}"><head>${HEAD}<title>${title}</title>${extra}</head><body><div id="page" data-layout="main">${body}</div></body></html>`;
}

function send(res, status, body, headers = {}) {
    res.writeHead(status, Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
}

// The fields of a multipart or urlencoded body, as [name, value] pairs.
function fields(body, type = '') {
    if (type.includes('multipart/form-data')) {
        return [...body.matchAll(/name="([^"]*)"\r\n\r\n([\s\S]*?)\r\n--/g)].map((m) => [m[1], m[2]]);
    }
    return [...new URLSearchParams(body)];
}

const escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function handle(req, res, url) {
    const path = url.pathname;
    let m;

    if ((m = path.match(/^\/site\/page\/(\w+)$/)) && pages[m[1]]) {
        const name = m[1];
        return send(res, 200, layout('Page ' + name, pages[name](), name === 'styled' ? { htmlClass: 'from-server', extra: '<style id="styled-sheet">h1 { color: rgb(1, 2, 3); }</style>' } : {}));
    }
    if (path === '/site/echo') {
        const sent = req.method === 'POST' ? fields(await readBody(req), req.headers['content-type']) : [...url.searchParams];
        return send(res, 200, layout('Echo', `<h1>Echo</h1><pre id="echo" data-method="${req.method}">${escape(JSON.stringify(sent))}</pre><a id="to-one" href="/site/page/one">one</a>`));
    }
    if (path === '/site/refuse') {
        // A form the server refuses: the page it was sent from comes back, at that page's address.
        await readBody(req);
        return send(res, 200, layout('Refused', `<h1>Refused</h1><a id="to-one" href="/site/page/one">one</a>${sections(6)}<p id="refusal">no</p><form id="refused" method="post" action="/site/refuse"><input name="title" value="x"><button type="submit" id="refused-go">send</button></form>${sections(3, 'r')}`));
    }
    if (path === '/site/error') return send(res, 500, layout('Error', '<h1 id="failure">It failed</h1>'));
    if (path === '/site/drop') return req.socket.destroy();
    if (path === '/site/slow') {
        await new Promise((f) => setTimeout(f, +url.searchParams.get('ms') || 300));
        return send(res, 200, layout('Slow', '<h1 id="slow">Slow</h1>'));
    }
    if (path === '/site/api') {
        // An AJAX channel's answer: what was sent, after ?ms, or a failure with its reason (?fail=500).
        const sent = req.method === 'POST' ? fields(await readBody(req), req.headers['content-type']) : [...url.searchParams];
        await new Promise((f) => setTimeout(f, +url.searchParams.get('ms') || 0));
        const fail = +url.searchParams.get('fail') || 0;
        res.writeHead(fail || 200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(fail ? { response: 'refused' } : { method: req.method, sent: sent }));
    }
    if (path === '/site/img') {
        await new Promise((f) => setTimeout(f, +url.searchParams.get('ms') || 0));
        const h = +url.searchParams.get('h') || 100;
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' });
        return res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="${h}"><rect width="200" height="${h}" fill="#ccc"/></svg>`);
    }
    if ((m = path.match(/^\/site\/admin\/(\w+)$/))) {
        // The back office: a page of its own, with the library, that says it may be nested.
        const body = `<!doctype html><html><head>${HEAD}<title>Admin ${m[1]}</title></head><body><div id="page" data-layout="admin"><h1 id="admin-title">Admin ${m[1]}</h1><a id="admin-next" href="/site/admin/next">next</a><a id="admin-out" href="/site/page/two">out</a></div>
<script src="/tests/jquery.js"></script><script src="/src/js/core.js"></script><script src="/src/js/transparent.js"></script>
<script>window.addEventListener('load', function () { Transparent.ready({ identifier: '#page', nest: ['/site/admin/*'], progress_bar: 'off' }); }, { once: true });</script></body></html>`;
        return send(res, 200, body, { 'X-Transparent-Nest': '1' });
    }
    return send(res, 404, layout('Not found', '<h1>Not found</h1>'));
}
