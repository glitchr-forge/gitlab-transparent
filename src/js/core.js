// Flow - the shared core of the modules (navigation, sticky, stops, sortable).
//
// What the modules used to carry each on their own, once: the units ("250ms",
// "2rem", "15%"), the scroll padding, the scrollers (which element scrolls, the
// closest one that does), the listeners a scroller needs (scroll, resize, the
// reader taking over with a wheel, a finger or a click), the one animation
// frame in which every measurement is made, the programmatic scroll (and the
// "user-scroll" flag the modules read to know whether the page is being moved
// by a script or by the reader), the hash of the address, the moments the
// page is (re)loaded - a navigation swapping the page in place included - and
// the jQuery plugins the modules install when jQuery is there.
//
// Loaded first, by every entry point: a module asks for it as require('./core.js')
// under a bundler, or finds it as window.Flow when loaded by a <script>. No
// jQuery needed by itself: the plugins are installed when a module asks for
// jQuery (Flow.jquery()) and jQuery is loaded.
(function (root, factory) {

    var api = root.Flow && root.Flow.core === true ? root.Flow : factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.Flow = api;

})(typeof window !== 'undefined' ? window : this, function (window) {

    var document = window.document;

    var Flow = { core: true, version: '1.0.0' };

    // ── jQuery ───────────────────────────────────────────────────────────
    // A bundler's ProvidePlugin gives the bare `jQuery` identifier; a page
    // gives window.jQuery. Found when first asked for, so that a jQuery loaded
    // after this file is still found. The plugins go on once.
    var $ = null;
    var plugged = false;

    Flow.jquery = function () {
        if (!$) {
            try { $ = jQuery; } catch (e) { $ = window.jQuery || null; }
            if (!$ || !$.fn) $ = null;
        }
        if ($ && !plugged) { plugged = true; plug($); }
        return $;
    };

    // ── Time ─────────────────────────────────────────────────────────────
    Flow.now = function () { return window.performance ? performance.now() : Date.now(); };

    /** "250ms", "1s", "0.3", or several ("1s, 250ms"): the longest, in seconds. */
    Flow.parseDuration = function (str) {
        var array = String(str).split(', ').map(function (t) {
            if (String(t).endsWith('ms')) return parseFloat(String(t)) / 1000;
            return parseFloat(String(t));
        });
        return Math.max.apply(Math, array);
    };

    Flow.debounce = function (func, wait, immediate) {
        var timeout;
        return function () {
            var context = this, args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };

    // ── Units ────────────────────────────────────────────────────────────
    Flow.remToPixel = function (rem) { return parseFloat(rem) * parseFloat(getComputedStyle(document.documentElement).fontSize); };
    Flow.emToPixel = function (em, el) { return parseFloat(em) * parseFloat(getComputedStyle(el && el.parentElement ? el.parentElement : document.documentElement).fontSize); };
    Flow.percentToPixel = function (p, el) {
        var width = el && el.getBoundingClientRect ? el.getBoundingClientRect().width : window.innerWidth;
        return parseFloat(p) * width;
    };

    /** "90", "90px", "2rem", "1.5em", "15%", or several ("2rem, 90px"): the largest, in px. undefined for undefined. */
    Flow.parseToPixel = function (str, el) {
        if (str === undefined) return undefined;
        var array = String(str).split(', ').map(function (s) {
            if (s.endsWith('rem')) return Flow.remToPixel(s);
            if (s.endsWith('em')) return Flow.emToPixel(s, el);
            if (s.endsWith('%')) return Flow.percentToPixel(s, el);
            return parseFloat(s);
        });
        return Math.max.apply(Math, array);
    };

    /** One value to px ("90", "90px", "2rem", "1.5em"); anything unreadable is the fallback. */
    Flow.toPixels = function (value, el, fallback) {
        if (value === undefined || value === null || value === '') return fallback;
        var text = String(value).trim();
        var number = parseFloat(text);
        if (isNaN(number)) return fallback;
        if (text.slice(-3) === 'rem') return Flow.remToPixel(text);
        if (text.slice(-2) === 'em') return number * parseFloat(getComputedStyle(el || document.documentElement).fontSize);
        return number;
    };

    /** The scroll-padding of an element (the <html> element by default), in px: {top, left, right, bottom}. */
    Flow.scrollPadding = function (el) {
        if (el === window || el === document || !el) el = document.documentElement;
        var style = el instanceof Element ? getComputedStyle(el) : {};
        var dict = {};
        ['top', 'left', 'right', 'bottom'].forEach(function (side) {
            var value = Flow.parseToPixel(style['scroll-padding-' + side] || 0, el);
            dict[side] = isNaN(value) ? 0 : value;
        });
        return dict;
    };

    // ── Scrollers ────────────────────────────────────────────────────────
    /** Whether ONE node scrolls (content larger than its box, and overflow that
     *  scrolls - or the <html> element, which always may). The cheap layout
     *  comparison first: getComputedStyle, the expensive half, is only reached
     *  for the few elements that could qualify. */
    Flow.isScrollableNode = function (node) {
        if (node === window || node === document) node = document.documentElement;
        if (!node || node.nodeType !== 1) return false;
        var isDom = node === document.documentElement;
        if (node.scrollWidth > node.clientWidth && (isDom || getComputedStyle(node).overflowX.indexOf('scroll') !== -1)) return true;
        if (node.scrollHeight > node.clientHeight && (isDom || getComputedStyle(node).overflowY.indexOf('scroll') !== -1)) return true;
        return false;
    };

    /** The element itself if it scrolls, else the closest ancestor that does; the <html> element if it scrolls; undefined otherwise. */
    Flow.closestScrollable = function (el) {
        var target = el === window || el === document || el === undefined || el === null ? document.documentElement : el;
        while (target && target !== document.documentElement) {
            if (Flow.isScrollableNode(target)) return target;
            target = target.parentElement;
        }
        return Flow.isScrollableNode(document.documentElement) ? document.documentElement : undefined;
    };

    /** The window for the document, <html> or <body> (or nothing); the element otherwise. */
    Flow.normalize = function (scroller) {
        if (!scroller || scroller === document || scroller === document.documentElement || scroller === document.body) return window;
        return scroller;
    };

    /** The element to read scrollTop from and to scroll: <html> for the window. */
    Flow.element = function (scroller) {
        return scroller === window || scroller === document || !scroller ? document.documentElement : scroller;
    };

    var viewportCache = null;
    /** The viewport's size, {width, height}, read once per frame. */
    Flow.viewport = function () {
        if (!viewportCache) {
            viewportCache = {
                width: Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0),
                height: Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
            };
            Flow.frame(forgetViewport);
        }
        return viewportCache;
    };
    function forgetViewport() { viewportCache = null; }

    // ── The frame ────────────────────────────────────────────────────────
    // One requestAnimationFrame for everything the modules measure: the
    // functions queued run together in the next frame, each once, in the
    // order they were queued.
    var queued = [];
    var frameId = null;

    Flow.frame = function (fn) {
        if (queued.indexOf(fn) === -1) queued.push(fn);
        if (frameId === null) frameId = requestAnimationFrame(runFrame);
        return fn;
    };

    Flow.cancelFrame = function (fn) {
        var at = queued.indexOf(fn);
        if (at !== -1) queued.splice(at, 1);
    };

    function runFrame(time) {
        frameId = null;
        var batch = queued;
        queued = [];
        viewportCache = null;
        for (var i = 0; i < batch.length; i++) {
            try { batch[i](time); } catch (e) { setTimeout(function () { throw e; }, 0); }
        }
    }

    // ── Listeners ────────────────────────────────────────────────────────
    // One native listener per scroller and per kind, however many modules
    // listen. Scroll and resize callbacks run in the frame, together, after
    // the browser has laid the page out; a reader's interruption is told at
    // once, so that a glide stops under their finger.
    function Channel(target, types, options, coalesce) {
        this.target = target;
        this.types = types;
        this.options = options;
        this.fns = [];
        this.pending = [];
        this.bound = false;
        var self = this;
        this.handler = function (event) {
            if (!coalesce) {
                self.fns.slice().forEach(function (fn) { fn.call(target, event, target); });
                return;
            }
            self.pending[self.pending.length] = event;
            Flow.frame(self.flush);
        };
        this.flush = function () {
            var events = self.pending;
            self.pending = [];
            var last = events[events.length - 1];
            self.fns.slice().forEach(function (fn) { fn.call(target, last, target); });
        };
    }
    Channel.prototype.add = function (fn) {
        if (this.fns.indexOf(fn) !== -1) return;
        this.fns.push(fn);
        if (this.bound) return;
        this.bound = true;
        for (var i = 0; i < this.types.length; i++) this.target.addEventListener(this.types[i], this.handler, this.options);
    };
    Channel.prototype.remove = function (fn) {
        var at = this.fns.indexOf(fn);
        if (at !== -1) this.fns.splice(at, 1);
        if (this.fns.length || !this.bound) return;
        this.bound = false;
        for (var i = 0; i < this.types.length; i++) this.target.removeEventListener(this.types[i], this.handler, this.options);
        Flow.cancelFrame(this.flush);
    };

    var channels = { scroll: [], interrupt: [] };
    function channel(kind, scroller, types, options, coalesce) {
        var list = channels[kind];
        for (var i = 0; i < list.length; i++) if (list[i].target === scroller) return list[i];
        var made = new Channel(scroller, types, options, coalesce);
        list.push(made);
        return made;
    }

    /** fn(event, scroller) once per frame in which the scroller scrolled. The window for the page. */
    Flow.onScroll = function (scroller, fn) {
        channel('scroll', Flow.normalize(scroller), ['scroll'], { passive: true }, true).add(fn);
        return fn;
    };
    Flow.offScroll = function (scroller, fn) {
        channel('scroll', Flow.normalize(scroller), ['scroll'], { passive: true }, true).remove(fn);
    };

    // The reader taking the scroll over: a wheel, a finger, a press.
    Flow.INTERRUPT = ['wheel', 'touchstart', 'mousedown'];

    /** fn(event, scroller) at once when the reader takes over on the scroller. */
    Flow.onInterrupt = function (scroller, fn) {
        channel('interrupt', Flow.normalize(scroller), Flow.INTERRUPT, { passive: true }, false).add(fn);
        return fn;
    };
    Flow.offInterrupt = function (scroller, fn) {
        channel('interrupt', Flow.normalize(scroller), Flow.INTERRUPT, { passive: true }, false).remove(fn);
    };

    var resize = new Channel(window, ['resize', 'orientationchange'], undefined, true);
    /** fn(event) once per frame in which the window was resized. */
    Flow.onResize = function (fn) { resize.add(fn); return fn; };
    Flow.offResize = function (fn) { resize.remove(fn); };

    // ── The page ─────────────────────────────────────────────────────────
    // The moments a page is in: the document parsed (DOMContentLoaded, or at
    // once when it already is), loaded (load), and every page the navigation
    // swaps in place (transparent:load). A module that needs the page's
    // elements attaches here, and is attached again after every navigation
    // without knowing there was one.
    var pageFns = [];
    function pageLoaded(event) {
        pageFns.slice().forEach(function (fn) { fn(event ? event.type : 'ready'); });
    }
    /** fn(moment) at each of those moments; now too when the document is parsed. */
    Flow.onPage = function (fn) {
        if (pageFns.indexOf(fn) === -1) pageFns.push(fn);
        if (document.readyState !== 'loading') fn('ready');
        return fn;
    };
    Flow.offPage = function (fn) {
        var at = pageFns.indexOf(fn);
        if (at !== -1) pageFns.splice(at, 1);
    };
    document.addEventListener('DOMContentLoaded', pageLoaded);
    window.addEventListener('load', pageLoaded);
    window.addEventListener('transparent:load', pageLoaded);

    // ── Programmatic scroll ──────────────────────────────────────────────
    // The modules tell a scroll of their own from the reader's by the
    // "user-scroll" flag on the scroller (false while a script moves it) and
    // by Flow.scripted(scroller), true while a script moves it and for a
    // moment after - the scroll events it causes arrive a frame later.
    var SCRIPTED = 250; // ms after a scroll of ours in which a scroll event is still ours
    var scripted = typeof WeakMap === 'function' ? new WeakMap() : null;
    var scriptedList = [];

    function record(el) {
        if (scripted) {
            var entry = scripted.get(el);
            if (!entry) scripted.set(el, entry = {});
            return entry;
        }
        for (var i = 0; i < scriptedList.length; i++) if (scriptedList[i].el === el) return scriptedList[i];
        var made = { el: el };
        scriptedList.push(made);
        return made;
    }

    function mark(el, running) {
        var entry = record(el);
        entry.running = running;
        entry.until = Flow.now() + SCRIPTED;
    }

    /** Whether a script is scrolling the scroller, or did within the last moment. */
    Flow.scripted = function (scroller) {
        var entry = record(Flow.element(scroller));
        return !!entry.running || (entry.until !== undefined && Flow.now() < entry.until);
    };

    function prop(el, name, value) {
        var jq = Flow.jquery();
        if (arguments.length === 3) {
            if (jq) jq(el).prop(name, value); else el[name] = value;
            return value;
        }
        return jq ? jq(el).prop(name) : el[name];
    }

    /** Whether the reader has the scroll of the element's scroller (true unless a script took it). */
    Flow.userScroll = function (el) {
        try {
            var scroller = Flow.closestScrollable(el === undefined ? document.documentElement : el);
            if (!scroller) return true;
            var value = prop(scroller, 'user-scroll');
            return value === undefined || value === null ? true : value;
        } catch (e) { return true; }
    };

    /** Put the scroller somewhere at once, whatever the page's scroll-behavior. A script's move. */
    Flow.jump = function (scroller, top, left) {
        var el = Flow.element(scroller);
        var target = el === document.documentElement ? window : el;
        var options = { behavior: 'instant' };
        if (top !== undefined && top !== null) options.top = top;
        if (left !== undefined && left !== null) options.left = left;
        mark(el, false);
        try { target.scrollTo(options); } catch (e) { options.behavior = 'auto'; target.scrollTo(options); }
    };

    /**
     * Scroll an element (the window by default) to {top, left}, at once or
     * over a duration ("250ms"; or "duration-x", "duration-y"), or at a speed
     * (px/s), along a jQuery easing ("swing"), then call back. The scroller's
     * "user-scroll" is false meanwhile, and a wheel, a finger or a press stops
     * the movement where it is and gives the scroll back to the reader.
     */
    Flow.scrollTo = function (scroller, dict, callback) {
        var jq = Flow.jquery();
        var el = Flow.element(jq && jq(scroller).length ? jq(scroller)[0] : scroller);
        dict = dict || {};
        callback = callback || function () {};

        var maxScrollX = el.scrollWidth - Math.round(el.clientWidth);
        if (maxScrollX === 0) maxScrollX = Math.round(el.clientWidth);
        var maxScrollY = el.scrollHeight - Math.round(el.clientHeight);
        if (maxScrollY === 0) maxScrollY = Math.round(el.clientHeight);

        var scrollTop = Math.max(0, Math.min(dict.top !== undefined && dict.top !== null ? dict.top : el.scrollTop, maxScrollY));
        var scrollLeft = Math.max(0, Math.min(dict.left !== undefined && dict.left !== null ? dict.left : el.scrollLeft, maxScrollX));

        var speed = parseFloat(dict.speed || 0);
        var easing = dict.easing || 'swing';
        var debounce = dict.debounce || 0;

        var duration = 1000 * Flow.parseDuration(dict.duration || 0);
        var durationX = 1000 * Flow.parseDuration(dict['duration-x'] || dict.duration || 0);
        var durationY = 1000 * Flow.parseDuration(dict['duration-y'] || dict.duration || 0);

        if (speed) {
            var distanceX = el.scrollLeft < scrollLeft || scrollLeft === 0 ? Math.abs(scrollLeft - el.scrollLeft) : el.scrollLeft;
            var distanceY = el.scrollTop <= scrollTop || scrollTop === 0 ? Math.abs(scrollTop - el.scrollTop) : el.scrollTop;
            durationX = 1000 * distanceX / speed;
            durationY = 1000 * distanceY / speed;
            duration = durationX + durationY;
        }

        prop(el, 'user-scroll', false);
        mark(el, true);

        var done = function () {
            mark(el, false);
            el.dispatchEvent(new Event('scroll'));
            callback();
            prop(el, 'user-scroll', true);
        };

        if (!duration || !jq) {
            el.scrollTo(scrollLeft, scrollTop);
            done();
            return;
        }

        jq(el).stop(true).animate({ scrollTop: scrollTop }, durationY, easing, function () {
            jq(el).stop(true).animate({ scrollLeft: scrollLeft }, durationX, easing, debounce ? Flow.debounce(done, debounce) : done);
        });
    };

    // The reader taking over gives the scroll back, on the page and on every
    // scroller a script animated: the flag, and jQuery's animation stopped.
    function release(event, scroller) {
        var el = Flow.element(scroller);
        var jq = Flow.jquery();
        if (jq) jq(el).stop(true);
        prop(el, 'user-scroll', true);
    }
    Flow.release = release;
    Flow.onInterrupt(window, release);

    // ── The hash ─────────────────────────────────────────────────────────
    function byHash(hash) {
        if (!hash || hash === '#') return null;
        try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { return null; }
    }

    /**
     * Change the address's #hash without a history entry (history.replaceState),
     * keeping the query string. No element with that id: "hashfallback" is
     * dispatched and the hash is left (or emptied). "hashchange" is dispatched
     * unless told not to. True when the address changed.
     */
    Flow.replaceHash = function (newHash, triggerHashChange, skipIfEmptyIdentifier) {
        if (triggerHashChange === undefined) triggerHashChange = true;
        if (skipIfEmptyIdentifier === undefined) skipIfEmptyIdentifier = true;

        var location = window.location;
        var base = location.origin + location.pathname + location.search;

        var oldHash = location.hash;
        var oldURL = base + location.hash;
        var oldHashElement = byHash(oldHash);

        if (!newHash) newHash = '';
        if (newHash !== '' && ('' + newHash).charAt(0) !== '#') newHash = '#' + newHash;

        var newURL = base + newHash;
        var newHashElement = byHash(newHash);

        var fallback = newHashElement === null;
        fallback = fallback || (newHashElement && oldHashElement && newHashElement !== oldHashElement && newHashElement.contains(oldHashElement));

        if ((skipIfEmptyIdentifier && !newHash) || fallback) {
            window.dispatchEvent(new HashChangeEvent('hashfallback', { oldURL: oldURL, newURL: newURL }));
            newHash = skipIfEmptyIdentifier && !newHash ? '' : (newHashElement === null ? '' : oldHash);
            oldURL = base + location.hash;
            newURL = base + newHash;
        }

        if (oldURL === newURL) return false;

        var state = Object.assign({}, window.history.state, { href: newURL });
        // A document in a srcdoc frame (a nest) may not replace its state.
        try { window.history.replaceState(state, '', newURL); } catch (e) {}

        if (triggerHashChange) window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: oldURL, newURL: newURL }));
        return true;
    };
    window.replaceHash = Flow.replaceHash;

    // ── jQuery plugins ───────────────────────────────────────────────────
    function plug($) {

        // Passive listeners where the handlers never prevent the default.
        $.event.special.touchstart = { setup: function (_, ns, handle) { this.addEventListener('touchstart', handle, { passive: !ns.includes('noPreventDefault') }); } };
        $.event.special.touchmove = { setup: function (_, ns, handle) { this.addEventListener('touchmove', handle, { passive: !ns.includes('noPreventDefault') }); } };
        $.event.special.wheel = { setup: function (_, ns, handle) { this.addEventListener('wheel', handle, { passive: true }); } };
        $.event.special.mousewheel = { setup: function (_, ns, handle) { this.addEventListener('mousewheel', handle, { passive: true }); } };

        $.fn.serializeObject = function () {
            var o = {};
            $.each(this.serializeArray(), function () {
                if (o[this.name]) {
                    if (!o[this.name].push) o[this.name] = [o[this.name]];
                    o[this.name].push(this.value || '');
                } else {
                    o[this.name] = this.value || '';
                }
            });
            return o;
        };

        $.fn.isScrollable = function () {
            for (var i = 0; i < this.length; i++) if (Flow.isScrollableNode(this[i])) return true;
            return false;
        };

        $.fn.isScrollableX = function () {
            return this.map(function () {
                var el = this === window ? document.documentElement : this;
                if (!(el.scrollWidth > el.clientWidth)) return false;
                if (el === document.documentElement) return true;
                return getComputedStyle(el).overflowX.indexOf('scroll') !== -1;
            });
        };

        $.fn.isScrollableY = function () {
            return this.map(function () {
                var el = this === window ? document.documentElement : this;
                if (!(el.scrollHeight > el.clientHeight)) return false;
                if (el === document.documentElement) return true;
                return getComputedStyle(el).overflowY.indexOf('scroll') !== -1;
            });
        };

        $.fn.closestScrollable = function () {
            return this.map(function () { return Flow.closestScrollable(this); });
        };

        $.fn.closestScrollableWindow = function () {
            return this.closestScrollable().map(function () {
                return this === document.documentElement || this === document || this === undefined ? window : this;
            });
        };

        $.fn.repaint = function (duration, reiteration) {
            if (duration === undefined) duration = 1000;
            if (reiteration === undefined) reiteration = 5;
            var time = 0;
            var interval;
            var fn = function () {
                this.each(function (_, el) {
                    var displayBak = el.style.display;
                    el.style.display = 'none';
                    el.style.display = displayBak;
                    void el.offsetHeight;
                });
                if (time > duration) clearInterval(interval);
                time += duration / reiteration;
            }.bind(this);
            fn();
            if (reiteration > 0) interval = setInterval(fn, duration / reiteration);
        };
    }

    return Flow;
});
