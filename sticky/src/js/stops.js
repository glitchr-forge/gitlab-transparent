// StickyStops - scroll stops that act once the scroll has come to rest.
//
// Mark the stops with .sticky-stop, in the page or inside any scrolling
// element. Once a scroll comes to rest - momentum included - the scroller
// glides on to the stop the reader was heading for, or back to the one they
// had barely left:
//
//  - between two stops, heading down: the lower stop - unless the scroll rests
//    inside the upper stop's band below it (data-sticky-band-down), in which
//    case it was a nudge and the page settles back up;
//  - between two stops, heading up: the upper stop - unless inside the lower
//    stop's band above it (data-sticky-band-up), which settles back down. So a
//    band is also the least a scroll must travel before the next stop takes;
//  - past the last stop: free scrolling, from the first pixel, except that a
//    scroll up that rests inside the last stop's band below it goes back to
//    the stop - and so does a scroll down that started above the stop and
//    overshot into that band (a trackpad flick past a stop near the top);
//  - before the first stop: the mirror image.
//
// A stop taller than the screen is read freely: from its top to where its
// bottom meets the bottom of the screen, nothing pulls. Its band below counts
// from that end, and a scroll heading up into it from the next stop settles
// at its end (its last screen), not back at its top - so a long section
// keeps the stops on either side of it without being skipped over.
//
// Reach (the `reach` option, px - or "10rem", "20vh"): how far a glide may
// carry the page. Infinite by default: every rest between two stops is
// completed, however far the stop. With a reach, only a rest NEAR a stop is:
// when the stop the rules above point to (or a tall stop's end) is farther
// than the reach from where the scroll rests, the page is left where it is.
// So the long way between two stops - a separator, a picture - can be looked
// at, at rest, and no glide is ever longer than the reach. A band wider than
// the reach is cut down to it by that same rule.
//
// A band never reaches past halfway to the neighbouring stop, so every stop
// stays reachable however the bands are set. Two stops at the same place are
// one stop. A stop past the end of the scroll (a footer shorter than the
// screen) is at the end of the scroll.
//
// Nothing happens during the scroll. Acting at the first movement fights
// trackpad momentum, which keeps pushing during and after the glide; and the
// browser's own scroll-snap is blind to direction and pulls to the NEAREST
// stop, so a small scroll down from the top jumps straight back up. Here the
// glide is the browser's smooth scroll, which any wheel, touch, key or click
// interrupts, so the reader always keeps control: the stops only complete, or
// undo, a movement the reader started. With prefers-reduced-motion the glide
// is a jump.
//
// A slower glide (the `duration` option, ms): the browser's smooth scroll has
// its own, brisk, pace. With a duration the glide is animated here instead,
// frame by frame over that time - less for a glide shorter than 100px, in
// proportion, down to 40% of it - along the `easing` curve: a cubic Bezier as
// CSS writes it, "cubic-bezier(.65, 0, .35, 1)" (the default: gathering speed,
// then slowing into the stop), its four numbers in an array, one of CSS's
// names (linear, ease, ease-in, ease-out, ease-in-out), or a function of the
// time gone, 0 to 1, giving the way made. The same curve carries every glide:
// the one that finishes a scroll at rest and the one a key asks for, down the
// page or along a row. The same wheel,
// touch, key or click stops it where it is, and so does the page being moved
// by anything else meanwhile (the scrollbar dragged); a reader who stopped
// it and did not scroll on is not taken up again. `settle` is how long the
// scroll must have been quiet before anything is done: raise it for stops
// that wait a little longer.
//
// Nor does a scroll the browser makes to bring a focused field into view: an
// invalid form submission revealing its first empty field, or Tab. Heading up
// from the text, that scroll was taken for the reader's and carried the page
// on to the stop above - the form gone from the screen it had just asked for.
//
// The end of the scroll (the `end` option, off by default) is a stop too: past
// the last section, what is left - a footer - is one glide away, down to the
// very bottom, and one glide back up; `reach` does not bind that glide.
//
// Keys (the `keys` option, off by default): the keyboard goes from stop to
// stop, with the same glide. On the page, ArrowDown, PageDown and Space go to
// the next stop below, ArrowUp, PageUp and Shift+Space to the one above (for
// the page keys, a tall one's end, its last screen), Home and End to the first and the last
// stop. An arrow always goes on to the next stop (down) or back to the top of
// the stop being read, then to the one before (up), however tall the stop:
// a tall stop is read with the wheel, the finger or the page keys - a page
// key moves a screen inside it, never past its
// end or top. A key pressed during a key's glide goes on from where that glide
// was going, so presses chain stop after stop; a key held down goes one stop
// at a time, each glide finished first. For a page key, a neighbour farther than a screen and
// a half away (past the last stop, before the first, a long way between two -
// a separator less than that is glided over) is not glided to: the browser
// scrolls, as without stops, and where a key's scroll rests is
// never settled - the reach does not apply either: a key is asked for. Shift
// goes with Space alone (Shift+arrow selects text).
//
// The keys are left alone - to the browser, or to the page - when focus is in
// a field (input, textarea, select, contenteditable), in a frame, in an open
// <dialog> (or a modal one is open), on a widget with keys of its own (a
// slider, tabs, a menu, a listbox, audio, video), inside an element that
// scrolls by itself along the axis, with Alt, Ctrl or Meta held, and for Space
// on something Space presses (a button, a link, a summary). And so are keys a
// handler of the page has already taken: the library listens on the window,
// in the bubble phase, after the document's own handlers, and a key one of
// them took (preventDefault) is theirs - a music player's Space, say.
//
// Sideways (the `axis: 'x'` option, for an element scroller): the stops are
// met by their left edge (the scroller's scroll-padding-left) and the glide
// is a scrollLeft - the same rest, reach, bands and wide-stop reading as
// above, along x: a horizontal wheel, a trackpad or a swipe that comes to rest
// settles to the stop it was heading for. With `keys`, ArrowLeft and
// ArrowRight go from stop to stop while focus is inside the scroller or the
// pointer is over it. A row marked data-sticky-axis="x", holding .sticky-stop
// children, is attached by itself on load, with keys (data-sticky-keys="false"
// to keep them off) and its own data-sticky-duration, -settle, -reach and
// -tolerance; StickyStops.scan() looks again after content was swapped in. A
// row's stops are its own: the page's stops never count the ones inside it.
// Leave CSS scroll-snap off such a row: it would pull to the nearest item
// meanwhile.
//
// Progress: with two stops or more, the scroller (the <html> element for the
// page) carries three custom properties - --sticky-stop, the index of the stop
// above the scroll; --sticky-progress, 0 at that stop and 1 at the next; and
// --sticky-progress-held, the same but held at 0 across the upper stop's band
// below it and at 1 across the lower stop's band above it, so that whatever it
// drives does not move for a nudge that will settle back. A sticky:progress
// event on the scroller (it bubbles to the window) carries the same numbers
// for scripts, and a sticky:stop event announces each glide.
//
// Standalone: no jQuery and no sticky.js, and only the window's own scroll
// listener until a stop exists. Attached to the window by itself when the
// document has stops; StickyStops.attach(scroller) for a scrolling element,
// or for stops added after the page loaded. Sticky.stops is the same object
// when sticky.js is loaded.
(function (root, factory) {

    var api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.StickyStops = api;
    if (root.Sticky) root.Sticky.stops = api;

})(typeof window !== 'undefined' ? window : this, function (window) {

    var document = window.document;

    var defaults = {
        selector: '.sticky-stop',
        settle: 160,     // ms of quiet that counts as "at rest": longer than the gap between momentum events
        tolerance: 3,    // px: within this of a stop is at it
        reach: Infinity, // px ("10rem", "20vh"): the farthest a glide may go; a rest farther from its stop stays
        duration: 0,     // ms: the glide animated here over that time; 0 is the browser's smooth scroll
        easing: 'cubic-bezier(.65, 0, .35, 1)', // the curve of that glide: a CSS cubic-bezier(), its four numbers, a CSS name, or a function
        bandUp: 0,       // px, for a stop without data-sticky-band-up
        bandDown: 0,     // px, for a stop without data-sticky-band-down
        progress: true,  // the custom properties and sticky:progress events
        smooth: true,    // glide, rather than jump, to a stop
        axis: 'y',       // 'x': the stops are met sideways, by their left edge (an element scroller)
        keys: false,     // the keyboard goes from stop to stop (see "Keys" above)
        end: false       // the end of the scroll is a stop too: from the last section, on to the very bottom (the footer)
    };

    // The reader taking over ends a glide; the browser has already stopped it.
    // (keydown too, heard once for every scroller - see onKeydown.)
    var INTERRUPT = ['wheel', 'touchstart', 'mousedown'];

    // px: about the browser's own step for an arrow key. Inside a tall stop an
    // arrow is left to the browser while two of them still fit before its end.
    var LINE = 40;

    // A page key moves this much of the screen below the header: the
    // browser's own share, a strip of the last screen still in sight.
    var PAGE = 0.875;

    // Screens: the farthest a key glides to a neighbouring stop. Past one
    // screen, what lies between is only seen in passing - a separator between
    // two sections; past this, it is content, and the browser scrolls to it.
    var NEAR = 1.5;

    // The keys, per axis: [key, shift] -> [direction, kind].
    function keyMove(event, horizontal) {
        var key = event.key;
        var space = key === ' ' || key === 'Spacebar';
        // Shift belongs to Space alone (Shift+Space goes up); Shift with an
        // arrow or a page key extends a selection, the browser's.
        if (event.shiftKey && !space) return null;
        if (horizontal) {
            if (key === 'ArrowRight') return [1, 'line'];
            if (key === 'ArrowLeft') return [-1, 'line'];
            return null;
        }
        if (key === 'ArrowDown' || key === 'Down') return [1, 'line'];
        if (key === 'ArrowUp' || key === 'Up') return [-1, 'line'];
        if (key === 'PageDown') return [1, 'page'];
        if (key === 'PageUp') return [-1, 'page'];
        if (space) return [event.shiftKey ? -1 : 1, 'page'];
        if (key === 'Home') return [-1, 'edge'];
        if (key === 'End') return [1, 'edge'];
        return null;
    }

    // Keys pressed on their own before another one: no move of the reader's.
    var MODIFIER = { Shift: 1, Control: 1, Alt: 1, AltGraph: 1, Meta: 1, OS: 1, CapsLock: 1, Fn: 1 };

    // Where the keys belong to something else: typing, a widget of its own.
    var TYPING = 'input, textarea, select, iframe, [contenteditable]:not([contenteditable="false"])';
    var WIDGET = '[role="slider"], [role="spinbutton"], [role="scrollbar"], [role="tab"], [role="tablist"], [role="menu"], [role="menubar"], [role="menuitem"], [role="listbox"], [role="option"], [role="radiogroup"], [role="radio"], [role="grid"], [role="tree"], [role="textbox"], [role="combobox"], audio, video';
    // Space presses these.
    var PRESSABLE = 'button, a[href], summary, label, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="menuitemcheckbox"], [role="menuitemradio"]';

    // ms after a focus change in which a scroll starting is the browser
    // revealing the focused field, not the reader.
    var REVEAL = 250;

    function now() { return window.performance ? performance.now() : Date.now(); }

    function extend(target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            if (!source) continue;
            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) target[key] = source[key];
            }
        }
        return target;
    }

    function clamp(x, low, high) { return Math.min(high, Math.max(low, x)); }

    // "90", "90px", "2rem" or "1.5em" to px; anything else is the fallback.
    function toPixels(value, el, fallback) {
        if (value === undefined || value === null || value === '') return fallback;
        var text = String(value).trim();
        var number = parseFloat(text);
        if (isNaN(number)) return fallback;
        if (text.slice(-3) === 'rem') return number * parseFloat(getComputedStyle(document.documentElement).fontSize);
        if (text.slice(-2) === 'em') return number * parseFloat(getComputedStyle(el).fontSize);
        return number;
    }

    // A cubic Bezier from (0, 0) to (1, 1), as CSS's: the way made (y) for the
    // time gone (x), x solved for its parameter by Newton's steps, then halving.
    function bezier(x1, y1, x2, y2) {
        x1 = clamp(x1, 0, 1); x2 = clamp(x2, 0, 1);
        var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
        var cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
        function sx(t) { return ((ax * t + bx) * t + cx) * t; }
        function sy(t) { return ((ay * t + by) * t + cy) * t; }
        function dx(t) { return (3 * ax * t + 2 * bx) * t + cx; }
        return function (x) {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            var t = x, i, d, low = 0, high = 1;
            for (i = 0; i < 8; i++) {
                d = sx(t) - x;
                if (Math.abs(d) < 1e-5) return sy(t);
                var slope = dx(t);
                if (Math.abs(slope) < 1e-6) break;
                t -= d / slope;
            }
            t = x;
            for (i = 0; i < 32; i++) {
                d = sx(t);
                if (Math.abs(d - x) < 1e-5) break;
                if (x > d) low = t; else high = t;
                t = (low + high) / 2;
            }
            return sy(t);
        };
    }

    var NAMED = {
        'linear': [0, 0, 1, 1], 'ease': [0.25, 0.1, 0.25, 1], 'ease-in': [0.42, 0, 1, 1],
        'ease-out': [0, 0, 0.58, 1], 'ease-in-out': [0.42, 0, 0.58, 1]
    };
    var curves = {};

    /** The `easing` option as a function of the time gone (0..1); the default curve for anything unreadable. */
    function easing(value) {
        if (typeof value === 'function') return value;
        var points = null;
        if (value && typeof value === 'object' && value.length === 4) points = [].slice.call(value).map(Number);
        else if (typeof value === 'string') {
            var text = value.trim().toLowerCase();
            if (curves[text]) return curves[text];
            var match = /^cubic-bezier\(([^)]+)\)$/.exec(text);
            points = NAMED[text] || (match ? match[1].split(',').map(Number) : null);
        }
        if (!points || points.length !== 4 || points.some(isNaN)) points = [0.65, 0, 0.35, 1];
        var made = bezier(points[0], points[1], points[2], points[3]);
        if (typeof value === 'string') curves[value.trim().toLowerCase()] = made;
        return made;
    }

    // px under which a glide takes less than the whole duration.
    var SHORT = 100;

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function Stops(scroller, options) {
        this.scroller = scroller;
        this.isWindow = scroller === window;
        // Carries the custom properties and dispatches the events.
        this.root = this.isWindow ? document.documentElement : scroller;
        this.options = extend({}, defaults, options);
        // Fixed at birth: the axis the stops are met along.
        this.horizontal = this.options.axis === 'x';
        // Where a glide asked for by a key is going: a key pressed meanwhile
        // goes on from there, not from where the glide happens to be.
        this.aim = null;

        this.stops = [];
        this.state = null;
        this.last = this.top();
        // Where the current gesture began: the position before its first event.
        this.start = this.last;
        this.direction = 0;
        this.gliding = false;
        this.paused = 0;
        this.timer = null;
        this.glideTimer = null;
        this.frame = null;
        // Our own animated glide: its frame, and where it last put the scroll.
        this.animation = null;
        this.put = null;
        // Where it arrived, until the scroll has rested there.
        this.arrived = null;
        // Where the reader stopped a glide: not to be taken up from there.
        this.stopped = null;
        this.focusedAt = -Infinity;
        // When a key was last left to the browser to scroll with.
        this.keyedAt = -Infinity;
        this.aimElement = null;
        this.revealing = false;

        this.onScroll = this.onScroll.bind(this);
        this.onInterrupt = this.onInterrupt.bind(this);
        this.onFocus = this.onFocus.bind(this);
        this.onResize = this.onResize.bind(this);
        this.settle = this.settle.bind(this);
        this.tick = this.tick.bind(this);
        this.release = this.release.bind(this);

        // focusin bubbles, so the scroller hears its own fields; the window
        // does not, so the page's are heard on the document.
        this.focusTarget = this.isWindow ? document : this.scroller;

        this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
        for (var i = 0; i < INTERRUPT.length; i++) {
            this.scroller.addEventListener(INTERRUPT[i], this.onInterrupt, { passive: true });
        }
        this.focusTarget.addEventListener('focusin', this.onFocus, true);
        window.addEventListener('resize', this.onResize);

        this.refresh();
    }

    Stops.prototype.detach = function () {
        this.scroller.removeEventListener('scroll', this.onScroll);
        for (var i = 0; i < INTERRUPT.length; i++) {
            this.scroller.removeEventListener(INTERRUPT[i], this.onInterrupt);
        }
        this.focusTarget.removeEventListener('focusin', this.onFocus, true);
        window.removeEventListener('resize', this.onResize);
        clearTimeout(this.timer);
        clearTimeout(this.glideTimer);
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.cancel();

        var style = this.root.style;
        style.removeProperty('--sticky-stop');
        style.removeProperty('--sticky-progress');
        style.removeProperty('--sticky-progress-held');

        var at = instances.indexOf(this);
        if (at !== -1) instances.splice(at, 1);
        return this;
    };

    /** Hold the stops off, e.g. while a script scrolls the page itself. Nests. */
    Stops.prototype.pause = function () { this.paused++; return this; };
    Stops.prototype.resume = function () { this.paused = Math.max(0, this.paused - 1); return this; };

    /** The scroll position along the axis: scrollTop, or scrollLeft for 'x'. */
    Stops.prototype.top = function () {
        if (this.horizontal) return this.isWindow ? (window.scrollX || window.pageXOffset || 0) : this.scroller.scrollLeft;
        return this.isWindow ? (window.scrollY || window.pageYOffset || 0) : this.scroller.scrollTop;
    };

    /** The furthest the scroller can scroll. */
    Stops.prototype.max = function () {
        var html = document.documentElement;
        if (this.horizontal) {
            return Math.max(0, this.isWindow ? html.scrollWidth - window.innerWidth : this.scroller.scrollWidth - this.scroller.clientWidth);
        }
        return Math.max(0, this.isWindow ? html.scrollHeight - window.innerHeight : this.scroller.scrollHeight - this.scroller.clientHeight);
    };

    /** The height the scroller shows - its width for 'x'. */
    Stops.prototype.viewport = function () {
        if (this.horizontal) return this.isWindow ? window.innerWidth : this.scroller.clientWidth;
        return this.isWindow ? window.innerHeight : this.scroller.clientHeight;
    };

    /** The scroller's scroll-padding-top (-left): where a stop should rest from its edge. */
    Stops.prototype.padding = function () {
        var style = getComputedStyle(this.root);
        var value = parseFloat(this.horizontal ? style.scrollPaddingLeft : style.scrollPaddingTop);
        return isNaN(value) ? 0 : value;
    };

    /** An element's near edge (top, or left) on screen, and its size along the axis. */
    Stops.prototype.edge = function (el) {
        var rect = el.getBoundingClientRect();
        return this.horizontal ? rect.left : rect.top;
    };
    Stops.prototype.size = function (el) {
        var rect = el.getBoundingClientRect();
        return this.horizontal ? rect.width : rect.height;
    };

    /** A stop's scroll position: where it is on screen now, not its layout box. */
    Stops.prototype.position = function (el) {
        var origin = this.isWindow ? 0 : this.edge(this.scroller);
        return this.edge(el) - origin + this.top() - this.padding();
    };

    /**
     * Whether a stop is this scroller's, not one of a scroller inside it (a
     * row of data-sticky-axis="x" in the page, or any attached scroller).
     */
    Stops.prototype.owns = function (el) {
        for (var node = el.parentElement; node && node !== this.root; node = node.parentElement) {
            if (node.hasAttribute('data-sticky-axis')) return false;
            for (var i = 0; i < instances.length; i++) {
                if (instances[i].root === node) return false;
            }
        }
        return true;
    };

    Stops.prototype.measure = function () {
        var options = this.options;
        var elements = this.root.querySelectorAll(options.selector);
        var max = this.max();
        var stops = [];
        var i;

        for (i = 0; i < elements.length; i++) {
            var el = elements[i];
            if (!el.getClientRects().length) continue; // display: none
            if (!this.owns(el)) continue;
            var position = this.position(el);
            var top = clamp(Math.round(position), 0, max);
            stops.push({
                element: el,
                // A stop the scroll cannot bring to the top (a footer shorter
                // than the screen) rests where the scroll ends. Taken as out
                // of reach, it made every scroll up from the very bottom -
                // Safari's bounce included - glide away to the stop above.
                // And one above the start (a hero under a fixed header) is
                // at the start: Home or a key up glided to a place the scroll
                // cannot go, and a key up from the top went nowhere.
                top: top,
                // Where its bottom meets the bottom of the screen: the end of
                // its free reading. The top itself for a stop the screen holds.
                end: Math.min(Math.max(top, Math.round(position + this.padding() + this.size(el) - this.viewport())), max),
                bandUp: Math.max(0, toPixels(el.dataset.stickyBandUp, el, options.bandUp)),
                bandDown: Math.max(0, toPixels(el.dataset.stickyBandDown, el, options.bandDown))
            });
        }
        stops.sort(function (a, b) { return a.top - b.top; });

        // The end of the scroll as a last stop (the `end` option): what follows the last section - a
        // footer - is reached in one glide, and left in one, wherever it is. Not bound by `reach`.
        if (options.end && max > 0 && (!stops.length || max - stops[stops.length - 1].top > options.tolerance)) {
            stops.push({ element: this.root, top: max, end: max, bandUp: Math.max(0, toPixels(undefined, this.root, options.bandUp)), bandDown: 0, bottom: true });
        }

        // Two stops at the same place are one stop.
        var unique = [];
        for (i = 0; i < stops.length; i++) {
            if (unique.length && stops[i].top - unique[unique.length - 1].top <= options.tolerance) continue;
            unique.push(stops[i]);
        }

        // A tall stop's reading ends where the next one begins, at the latest.
        for (i = 0; i < unique.length - 1; i++) unique[i].end = Math.min(unique[i].end, unique[i + 1].top);

        // A band reaches at most halfway to the neighbouring stop, so both
        // stay reachable however the bands are set.
        for (i = 0; i < unique.length; i++) {
            if (i > 0) unique[i].bandUp = Math.min(unique[i].bandUp, (unique[i].top - unique[i - 1].end) / 2);
            if (i < unique.length - 1) unique[i].bandDown = Math.min(unique[i].bandDown, (unique[i + 1].top - unique[i].end) / 2);
        }

        this.stops = unique;
        return unique;
    };

    /** A tall stop's last screen, as a place to glide to. */
    function ending(stop) {
        return stop.end === stop.top ? stop : { element: stop.element, top: stop.end, end: stop.end };
    }

    /** The farthest a glide may go, in px. */
    Stops.prototype.reach = function () {
        var value = this.options.reach;
        if (typeof value === 'number') return value >= 0 ? value : Infinity;
        if (value === undefined || value === null || value === '') return Infinity;
        var text = String(value).trim();
        var number = parseFloat(text);
        if (isNaN(number)) return Infinity;
        if (text.slice(-2) === 'vh' || text.slice(-1) === '%') return number * this.viewport() / 100;
        return Math.max(0, toPixels(text, this.root, Infinity));
    };

    /** Put the scroll somewhere at once, whatever the page's scroll-behavior. */
    Stops.prototype.jump = function (top) {
        try {
            this.scroller.scrollTo(this.to(top, 'instant'));
        } catch (e) {
            this.scroller.scrollTo(this.to(top, 'auto'));
        }
    };

    /** scrollTo's options for a position along the axis. */
    Stops.prototype.to = function (position, behavior) {
        return this.horizontal ? { left: position, behavior: behavior } : { top: position, behavior: behavior };
    };

    /** Stop our own animated glide where it is. True when one was running. */
    Stops.prototype.cancel = function () {
        if (this.animation === null) return false;
        cancelAnimationFrame(this.animation);
        this.animation = null;
        this.put = null;
        return true;
    };

    // The end of a glide that fired no scroll event to end it.
    Stops.prototype.release = function () {
        this.glideTimer = null;
        if (this.animation === null) this.gliding = false;
    };

    /** Glide to a position over a duration, along the `easing` curve. */
    Stops.prototype.animate = function (to, duration) {
        var self = this;
        var from = this.top();
        var distance = to - from;
        var began = null;

        this.cancel();
        this.arrived = null;
        duration = duration * clamp(Math.abs(distance) / SHORT, 0.4, 1);
        var ease = easing(this.options.easing);

        function frame(time) {
            self.animation = null;

            // Moved by anything but us since the last frame (the scrollbar
            // dragged, a script): theirs now.
            if (self.put !== null && Math.abs(self.top() - self.put) > 2) {
                self.put = null;
                self.gliding = false;
                return;
            }

            if (began === null) began = time;
            var t = clamp((time - began) / duration, 0, 1);

            self.jump(t < 1 ? from + distance * ease(t) : to);
            self.put = self.top();

            if (t < 1) {
                self.animation = requestAnimationFrame(frame);
                return;
            }
            self.put = null;
            self.arrived = self.top();
            // Arrived without a scroll event to say so (nowhere to go).
            if (self.timer === null) self.gliding = false;
        }

        this.animation = requestAnimationFrame(frame);
    };

    Stops.prototype.glide = function (stop) {
        var smooth = this.options.smooth && !reducedMotion();
        var duration = Number(this.options.duration) || 0;

        this.gliding = true;
        this.aim = stop.key ? stop.top : null;
        this.aimElement = stop.key ? stop.element : null;
        // A stop the scroller cannot reach (past its end) fires no scroll
        // event: do not stay "gliding" waiting for one.
        clearTimeout(this.glideTimer);
        this.glideTimer = setTimeout(this.release, 2 * this.options.settle);

        this.root.dispatchEvent(new CustomEvent('sticky:stop', {
            bubbles: true,
            detail: { scroller: this.scroller, stop: stop.element, top: stop.top, axis: this.horizontal ? 'x' : 'y', key: !!stop.key }
        }));

        if (smooth && duration > 0) this.animate(stop.top, duration);
        else {
            this.cancel();
            this.scroller.scrollTo(this.to(stop.top, smooth ? 'smooth' : 'auto'));
        }
    };

    /** Glide to a stop if it is within reach of where the scroll rests. */
    Stops.prototype.approach = function (stop) {
        // Within reach - or the end of the scroll, from the last stop: a glide however far.
        if (!stop.bottom && Math.abs(stop.top - this.top()) > this.reach()) return false;
        this.glide(stop);
        return true;
    };

    Stops.prototype.settle = function () {
        this.timer = null;

        // A glide of ours has just arrived (or been interrupted): let go.
        this.arrived = null;
        if (this.gliding) {
            // Unless it is still on its way, between two of its own steps.
            if (this.animation === null) this.gliding = false;
            return;
        }
        // The browser bringing a focused field into view: it rests where the
        // field is, wherever that falls between the stops.
        if (this.revealing) {
            this.revealing = false;
            return;
        }
        if (this.paused || api.paused) return;

        var stops = this.measure();
        if (!stops.length) return;

        var tolerance = this.options.tolerance;
        var y = this.top();
        var direction = this.direction;
        var from = this.start;
        var i;

        // The reader stopped a glide and did not scroll on: it stays there.
        var stopped = this.stopped;
        this.stopped = null;
        if (stopped !== null && Math.abs(y - stopped) <= tolerance) return;

        // At a stop already, or reading a tall one: nothing to finish.
        for (i = 0; i < stops.length; i++) {
            if (y >= stops[i].top - tolerance && y <= stops[i].end + tolerance) return;
        }

        var first = stops[0];
        var last = stops[stops.length - 1];

        // Before the first stop: inside its band above it, heading down - or
        // an overshoot from below - goes to the stop. Otherwise free.
        if (y < first.top) {
            var overshotUp = from > first.top + tolerance;
            if (y > first.top - first.bandUp && (direction > 0 || overshotUp)) this.approach(first);
            return;
        }

        // Past the last stop: inside its band below it, heading up - or an
        // overshoot from above - goes back to the stop. Otherwise free.
        if (y > last.end) {
            var overshotDown = from < last.end - tolerance;
            if (y < last.end + last.bandDown && (direction < 0 || overshotDown)) this.approach(ending(last));
            return;
        }

        // Between two stops: on to the one the reader was heading for, unless
        // the scroll barely left the other, in which case back to it.
        for (i = 0; i < stops.length - 1; i++) {
            var upper = stops[i];
            var lower = stops[i + 1];
            if (y <= upper.end || y >= lower.top) continue;

            if (direction > 0) this.approach(y < upper.end + upper.bandDown ? ending(upper) : lower);
            else if (direction < 0) this.approach(y > lower.top - lower.bandUp ? lower : ending(upper));
            return;
        }
    };

    Stops.prototype.onScroll = function () {
        var y = this.top();
        var step = y > this.last ? 1 : (y < this.last ? -1 : 0);

        clearTimeout(this.glideTimer);

        // Our glide has arrived and the page moves away from there: the
        // reader again, before the scroll had rested.
        if (this.gliding && this.animation === null && this.arrived !== null && Math.abs(y - this.arrived) > 2) {
            this.gliding = false;
            this.arrived = null;
        }

        // The first event after a rest starts a new gesture.
        if (this.timer === null && !this.gliding) {
            this.start = this.last;
            // Or a key left to the browser (an arrow inside a tall stop, a
            // neighbour more than a screen away): asked for, so it rests
            // where the key put it - a settle pulled an arrow's step back to
            // the stop it had just left, and the arrows could not leave it.
            this.revealing = now() - this.focusedAt < REVEAL || now() - this.keyedAt < REVEAL;
        }
        this.last = y;

        // Which way the READER is going, not our own glide.
        if (!this.gliding && step) this.direction = step;

        clearTimeout(this.timer);
        this.timer = setTimeout(this.settle, this.options.settle);

        if (this.options.progress) this.queue();
    };

    /** Whether an element scrolls by itself along this axis (and so keeps its keys). */
    Stops.prototype.scrolls = function (el) {
        var style = getComputedStyle(el);
        var overflow = this.horizontal ? style.overflowX : style.overflowY;
        if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') return false;
        return this.horizontal ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1;
    };

    /**
     * Where a key sends the scroll: a stop to glide to ({top, element, key}),
     * or null to leave the key to the browser (and to anyone else).
     */
    Stops.prototype.keyed = function (event) {
        if (!this.options.keys || this.paused || api.paused) return null;
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return null;

        var move = keyMove(event, this.horizontal);
        if (!move) return null;
        var direction = move[0];
        var kind = move[1];

        var target = event.target instanceof Element ? event.target : null;
        var active = document.activeElement;
        // Focus in a frame: its keys never reach here, but be sure.
        if (active && active.tagName === 'IFRAME') return null;
        if (target) {
            if (target.closest(TYPING)) return null;
            if (target.closest(WIDGET)) return null;
            if (target.closest('dialog[open]')) return null;
            if (kind === 'page' && (event.key === ' ' || event.key === 'Spacebar') && target.closest(PRESSABLE)) return null;
        }
        // A modal dialog over the page: the page is not the reader's.
        try { if (document.querySelector('dialog:modal')) return null; } catch (e) { /* :modal unknown */ }

        if (this.isWindow) {
            // Something between the focus and the page scrolls by itself.
            for (var node = target; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
                if (this.scrolls(node)) return null;
            }
        } else {
            // An element scroller: the focus inside it, or the pointer over it.
            var hovered = false;
            try { hovered = this.scroller.matches(':hover'); } catch (e) { /* no :hover */ }
            if (!(target && this.scroller.contains(target)) && !hovered) return null;
            for (var inner = target; inner && inner !== this.scroller; inner = inner.parentElement) {
                if (this.scrolls(inner)) return null;
            }
        }

        var stops = this.measure();
        if (!stops.length) return null;

        // The key is the reader's: whatever scroll follows, ours or the
        // browser's, is not one to settle.
        this.keyedAt = now();

        var tolerance = this.options.tolerance;
        // A key pressed during a key's glide goes on from where that glide goes.
        var chained = this.aim !== null && (this.animation !== null || this.gliding);
        var y = chained ? this.aim : this.top();
        var screen = this.viewport() - (this.horizontal ? 0 : this.padding());
        var page = Math.max(LINE, Math.round(screen * PAGE));
        var near = screen * NEAR + tolerance;
        var first = stops[0];
        var last = stops[stops.length - 1];
        var i, stop;

        function at(top, element) { return { top: Math.round(top), element: element, key: true }; }

        if (kind === 'edge') {
            if (direction < 0) return y > first.top + tolerance ? at(first.top, first.element) : null;
            return y < last.top - tolerance ? at(last.top, last.element) : null;
        }

        // An arrow goes from stop to stop, wherever it is pressed: down to the
        // next stop's top, up to the top of the one being read, then to the
        // one before - a tall stop is not read line by line (the wheel, the
        // finger and the page keys read it). Past the last stop, the browser.
        if (kind === 'line') {
            if (direction > 0) {
                for (i = 0; i < stops.length; i++) {
                    if (stops[i].top > y + tolerance) return at(stops[i].top, stops[i].element);
                }
                return null;
            }
            for (i = stops.length - 1; i >= 0; i--) {
                if (stops[i].top < y - tolerance) return at(stops[i].top, stops[i].element);
            }
            return null;
        }

        // Reading a tall stop: a page key reads it, a screen at a time,
        // up to its end (its top) - and only from there on to the next stop.
        // A stop less than a line taller than the screen is not read: it took
        // two presses to leave, the first for a few pixels.
        for (i = 0; i < stops.length; i++) {
            stop = stops[i];
            if (stop.end <= stop.top || y < stop.top - tolerance || y > stop.end + tolerance) continue;
            var left = direction > 0 ? stop.end - y : y - stop.top;
            if (left <= tolerance) continue;
            if (stop.end - stop.top <= LINE) {
                // On from its end (its top), as if there already.
                y = direction > 0 ? stop.end : stop.top;
                break;
            }
            var step = kind === 'line' ? LINE : (kind === 'page' ? page : 0);
            if (!step) break;
            // Far from the end, an arrow is the browser's own step.
            if (kind === 'line' && !chained && left > 2 * LINE) return false;
            // The end itself when the step would leave less than half a
            // line before it: 2px short of it counted as there, and the
            // section rested 2px off.
            if (left <= step + LINE / 2) step = left;
            return at(direction > 0 ? y + step : y - step, stop.element);
        }

        // Otherwise on to the neighbouring stop - its end, for a tall one
        // above - unless it is farther than a screen and a half away (the free
        // scroll before the first stop, past the last one, a long way between
        // two): there the browser scrolls, as it would without stops. Up to
        // that, what lies between (a separator) is glided over.
        if (direction > 0) {
            for (i = 0; i < stops.length; i++) {
                if (stops[i].top > y + tolerance) {
                    return stops[i].top - y <= near ? at(stops[i].top, stops[i].element) : null;
                }
            }
            return null;
        }
        for (i = stops.length - 1; i >= 0; i--) {
            var end = stops[i].end;
            if (end < y - tolerance) return y - end <= near ? at(end, stops[i].element) : null;
        }
        return null;
    };

    Stops.prototype.onInterrupt = function () {
        this.gliding = false;
        if (this.cancel()) this.stopped = this.top();
    };

    Stops.prototype.onFocus = function () {
        this.focusedAt = now();
    };

    Stops.prototype.onResize = function () {
        this.refresh();
    };

    /** Re-measure the stops and report the progress. For content that moved. */
    Stops.prototype.refresh = function () {
        this.measure();
        if (this.options.progress) this.progress();
        return this;
    };

    Stops.prototype.queue = function () {
        if (this.frame !== null) return;
        this.frame = requestAnimationFrame(this.tick);
    };

    Stops.prototype.tick = function () {
        this.frame = null;
        this.progress();
    };

    /**
     * Where the scroll is between its two nearest stops: {index, from, to,
     * top, progress, held}, also written to the custom properties and sent as
     * sticky:progress when it changed. null with fewer than two stops.
     */
    Stops.prototype.progress = function () {
        var stops = this.measure();
        var style = this.root.style;

        if (stops.length < 2) {
            if (this.state) {
                style.removeProperty('--sticky-stop');
                style.removeProperty('--sticky-progress');
                style.removeProperty('--sticky-progress-held');
            }
            this.state = null;
            return null;
        }

        var y = this.top();
        var i = 0;
        while (i < stops.length - 2 && y >= stops[i + 1].top) i++;

        var upper = stops[i];
        var lower = stops[i + 1];
        var progress = clamp((y - upper.top) / (lower.top - upper.top), 0, 1);

        // Held across the bands: still until the scroll has cleared them.
        var a = upper.top + upper.bandDown;
        var b = lower.top - lower.bandUp;
        var held = b > a ? clamp((y - a) / (b - a), 0, 1) : (y < b ? 0 : 1);

        var previous = this.state;
        var state = {
            scroller: this.scroller,
            index: i,
            from: upper.element,
            to: lower.element,
            top: y,
            progress: progress,
            held: held
        };
        this.state = state;

        if (previous && previous.index === i && previous.progress === progress && previous.held === held) return state;

        style.setProperty('--sticky-stop', String(i));
        style.setProperty('--sticky-progress', progress.toFixed(4));
        style.setProperty('--sticky-progress-held', held.toFixed(4));
        this.root.dispatchEvent(new CustomEvent('sticky:progress', { bubbles: true, detail: state }));

        return state;
    };

    var instances = [];

    // One keydown listener for every scroller, on the window and in the bubble
    // phase: the page's own handlers (on the document, on elements) have had
    // the key first, and one that took it (preventDefault) keeps it. The
    // innermost scroller is asked first; a key none of them takes is the
    // reader's and stops their glides, as a wheel would.
    var listening = false;
    function onKeydown(event) {
        if (MODIFIER[event.key]) return;
        var ordered = instances.slice().sort(function (a, b) { return (a.isWindow ? 1 : 0) - (b.isWindow ? 1 : 0); });
        var taken = null;
        var i;
        for (i = 0; i < ordered.length && !taken; i++) {
            var self = ordered[i];
            var chained = self.aim !== null && (self.animation !== null || self.gliding);
            var stop = self.keyed(event);
            if (stop) {
                taken = self;
                event.preventDefault();
                // A key held down: one stop at a time, each glide finished
                // before the next - the auto-repeat ran through every stop
                // of the page in a second. Lines inside a tall stop go on.
                if (event.repeat && chained && stop.element !== self.aimElement) continue;
                self.glide(stop);
            } else if (stop === false) {
                // The browser's own step, inside a tall stop: theirs, not a glide.
                break;
            }
        }
        for (i = 0; i < instances.length; i++) {
            var other = instances[i];
            if (other === taken) continue;
            if (other.isWindow || (event.target instanceof Node && other.scroller.contains(event.target))) other.onInterrupt();
        }
    }
    function listen() {
        if (listening) return;
        listening = true;
        window.addEventListener('keydown', onKeydown);
    }

    function normalize(scroller) {
        if (!scroller || scroller === document || scroller === document.documentElement || scroller === document.body) return window;
        return scroller;
    }

    var api = {
        defaults: defaults,
        Stops: Stops,
        paused: 0,

        /** The stops of a scroller (the window by default); made if needed. */
        attach: function (scroller, options) {
            scroller = normalize(scroller);
            var found = api.get(scroller);
            if (found) {
                if (options) extend(found.options, options);
                return found.refresh();
            }
            var made = new Stops(scroller, options);
            instances.push(made);
            listen();
            return made;
        },

        get: function (scroller) {
            scroller = normalize(scroller);
            for (var i = 0; i < instances.length; i++) {
                if (instances[i].scroller === scroller) return instances[i];
            }
            return null;
        },

        /** Hold every scroller's stops off, e.g. while a script scrolls the page. Nests. */
        pause: function () { api.paused++; return api; },
        resume: function () { api.paused = Math.max(0, api.paused - 1); return api; },

        refresh: function () {
            for (var i = 0; i < instances.length; i++) instances[i].refresh();
            return api;
        },

        /**
         * Attach every [data-sticky-axis] element of the document (or of an
         * element) that holds stops, and detach the scrollers no longer in it.
         */
        scan: function (within) {
            var i;
            for (i = instances.length - 1; i >= 0; i--) {
                if (!instances[i].isWindow && !document.documentElement.contains(instances[i].scroller)) instances[i].detach();
            }
            var rows = (within || document).querySelectorAll('[data-sticky-axis]');
            for (i = 0; i < rows.length; i++) {
                if (!api.get(rows[i]) && rows[i].querySelector(defaults.selector)) api.attach(rows[i], rowOptions(rows[i]));
            }
            return api;
        }
    };

    // The rows marked data-sticky-axis="x" (or "y"), with their options from
    // data-sticky-keys / -duration / -easing / -settle / -reach / -tolerance.
    function rowOptions(el) {
        var data = el.dataset;
        var options = { axis: data.stickyAxis === 'x' ? 'x' : 'y', keys: data.stickyKeys !== 'false' };
        ['duration', 'settle', 'tolerance'].forEach(function (name) {
            var key = 'sticky' + name.charAt(0).toUpperCase() + name.slice(1);
            if (data[key] !== undefined && !isNaN(parseFloat(data[key]))) options[name] = parseFloat(data[key]);
        });
        if (data.stickyReach !== undefined) options.reach = data.stickyReach;
        if (data.stickyEasing) options.easing = data.stickyEasing;
        return options;
    }

    // The page's own stops, and its marked rows, without being asked - and
    // again on load, for a page swapped in place that re-dispatches it. A
    // scroller gone from the page with it lets go.
    function auto() {
        api.scan();
        if (document.querySelector(defaults.selector)) api.attach(window);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
    else auto();
    window.addEventListener('load', auto);

    return api;
});
