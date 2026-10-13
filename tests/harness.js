// The pages' common ground, loaded first: the verdict in #result (lines
// starting with "ok", or "FAIL ..."), uncaught errors as failures, the native
// listeners counted by type and target (addEventListener wrapped before the
// library loads, so that a page can say how many a module costs), and the
// waits a scroll test needs (a frame, a few ms - the runner fast-forwards
// virtual time, so these take no real time).
(function () {
    var lines = [];
    var errors = [];

    // Errors a page says it expects (Harness.expect(/text/)) are not failures.
    var expected = [];
    function known(text) { return expected.some(function (pattern) { return pattern.test(text); }); }
    window.addEventListener('error', function (e) { if (!known(String(e.message || e))) errors.push(String(e.message || e)); });
    window.addEventListener('unhandledrejection', function (e) { errors.push('rejection: ' + String(e.reason && e.reason.stack || e.reason)); });

    // Listeners added, by "<target> <type>": window scroll, document keydown...
    var listeners = {};
    var addEventListener = EventTarget.prototype.addEventListener;
    var removeEventListener = EventTarget.prototype.removeEventListener;
    function name(target) {
        if (target === window) return 'window';
        if (target === document) return 'document';
        if (target === document.documentElement) return 'html';
        if (target === document.body) return 'body';
        return target && target.tagName ? target.tagName.toLowerCase() + (target.id ? '#' + target.id : '') : String(target);
    }
    EventTarget.prototype.addEventListener = function (type, fn, options) {
        if (fn) {
            var key = name(this) + ' ' + type;
            listeners[key] = (listeners[key] || 0) + 1;
        }
        return addEventListener.call(this, type, fn, options);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, options) {
        if (fn) {
            var key = name(this) + ' ' + type;
            if (listeners[key]) listeners[key]--;
        }
        return removeEventListener.call(this, type, fn, options);
    };

    window.Harness = {
        /** An uncaught error (or, for the runner, a console error) matching this is expected. */
        expect: function (pattern) {
            expected.push(pattern);
            window.__expectedErrors = (window.__expectedErrors || []).concat([pattern.source.replace(/\\(.)/g, '$1')]);
        },
        /** The listeners currently added, {"<target> <type>": count}, those matching a RegExp only when given. */
        listeners: function (match) {
            var out = {};
            Object.keys(listeners).sort().forEach(function (key) {
                if (listeners[key] > 0 && (!match || match.test(key))) out[key] = listeners[key];
            });
            return out;
        },
        /** One verdict line: "ok <what>" or "FAIL <what>: <detail>". */
        check: function (condition, what, detail) {
            lines.push(condition ? 'ok ' + what : 'FAIL ' + what + (detail !== undefined ? ': ' + detail : ''));
            return condition;
        },
        /** A line of information (counts as ok). */
        note: function (text) { lines.push('ok ' + text); },
        /** Write the verdict, the uncaught errors included. */
        done: function () {
            if (errors.length) lines.push('FAIL errors: ' + errors.join(' | '));
            if (!lines.length) lines.push('FAIL no checks');
            // A page the navigation replaced whole (its rescue of a failed request) lost the element.
            var result = document.getElementById('result');
            if (!result) {
                result = document.createElement('pre');
                result.id = 'result';
                document.body.appendChild(result);
            }
            result.textContent = lines.join('\n');
        },
        /** ms from the next frame on: a scroll just made is heard in that frame, and what it starts (a rest's timer) has the whole wait. */
        after: function (ms) { return new Promise(function (resolve) { requestAnimationFrame(function () { setTimeout(resolve, ms); }); }); },
        /** Wait until fn() is truthy, ms at most (2000): what it gave last. For what takes a few frames, however slow they come. */
        until: function (fn, ms) {
            var end = performance.now() + (ms === undefined ? 2000 : ms);
            return new Promise(function (resolve) {
                (function poll() {
                    var value;
                    try { value = fn(); } catch (e) { value = false; }
                    if (value || performance.now() > end) return resolve(value);
                    requestAnimationFrame(function () {});
                    setTimeout(poll, 15);
                })();
            });
        },
        frame: function () { return new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); }); },
        /** A key pressed on the page (on an element when given). */
        key: function (key, init, target) {
            var event = new KeyboardEvent('keydown', Object.assign({ key: key, bubbles: true, cancelable: true }, init || {}));
            (target || document.body).dispatchEvent(event);
            return event;
        },
        /** The reader's scroll: the window moved as a wheel would, instantly. */
        scroll: function (top) {
            window.scrollTo({ top: top, behavior: 'instant' });
            // A frame asked for: a headless browser draws none for a scroll that changes no pixel (empty
            // sections), and the scroll event waits for the next frame.
            requestAnimationFrame(function () {});
        },
        near: function (a, b, tolerance) { return Math.abs(a - b) <= (tolerance === undefined ? 4 : tolerance); }
    };
})();
