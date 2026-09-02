// Modern browser: use passive event listeners where appropriate for better performance
jQuery.event.special.touchstart = { setup: function( _, ns, handle ) { this.addEventListener("touchstart", handle, { passive: !ns.includes("noPreventDefault") }); } };
jQuery.event.special.touchmove  = { setup: function( _, ns, handle ) { this.addEventListener("touchmove", handle, { passive: !ns.includes("noPreventDefault") }); } };
jQuery.event.special.wheel      = { setup: function( _, ns, handle ) { this.addEventListener("wheel", handle, { passive: true }); } };
jQuery.event.special.mousewheel = { setup: function( _, ns, handle ) { this.addEventListener("mousewheel", handle, { passive: true }); } };

// Transparent.js
(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Transparent = factory();
    }

})(this, function () {

    window.replaceHash = function(newHash, triggerHashChange = true, skipIfEmptyIdentifier = true) {

        var oldHash = location.hash;
        var oldURL = location.origin+location.pathname+location.hash;
        var oldHashElement = $(oldHash);

        if(!newHash) newHash = "";
        if (newHash !== "" && (''+newHash).charAt(0) !== '#')
            newHash = '#' + newHash;

        var newURL = location.origin+location.pathname+newHash;
        var newHashElement = $(newHash);

        var fallback  = $(newHash).length === 0;
        fallback |= newHashElement.has(oldHashElement).length > 0;

        if((skipIfEmptyIdentifier && !newHash) || fallback){

            dispatchEvent(new HashChangeEvent("hashfallback", {oldURL:oldURL, newURL:newURL}));
            newHash = skipIfEmptyIdentifier && !newHash ? "" : (newHashElement.length == 0 ? "" : oldHash);

            oldURL = location.origin+location.pathname+location.hash;
            newURL = location.origin+location.pathname+newHash;
        }

        if(oldURL == newURL) return false;

        var state = Object.assign({}, history.state, {href: newURL});
        // Same srcdoc-iframe restriction as the pushState() call in
        // handleResponse() - see its comment for the full explanation.
        try { history.replaceState(state, '', newURL); } catch (e) {}

        if(triggerHashChange)
            dispatchEvent(new HashChangeEvent("hashchange", {oldURL:oldURL, newURL:newURL}));

        return true;
    };

    $.fn.serializeObject = function() {
        var o = {};
        var a = this.serializeArray();
        $.each(a, function() {
            if (o[this.name]) {
                if (!o[this.name].push) {
                    o[this.name] = [o[this.name]];
                }
                o[this.name].push(this.value || '');
            } else {
                o[this.name] = this.value || '';
            }
        });
        return o;
    };

    /* Scroll test for ONE node, no jQuery wrapper. The jQuery plugins below
       are the public API and keep working exactly as before, but they cost a
       $() allocation (two, since isScrollable calls both X and Y) for every
       element they touch - which is fine per element and ruinous for
       getScrollableElement, whose whole job is to test every element in the
       document. Sharing one implementation here rather than open-coding it
       there keeps the two from drifting apart.

       Same short-circuit as the plugins: the cheap layout comparison decides
       the answer for nearly every element, so getComputedStyle - by far the
       expensive half - is only reached for the few that could actually
       qualify. */
    function isScrollableNode(node)
    {
        if (node === window || node === document) node = document.documentElement;
        if (!node || node.nodeType !== 1) return false;

        var isDom = node === document.documentElement;

        if (node.scrollWidth > node.clientWidth
            && (isDom || window.getComputedStyle(node).overflowX.indexOf('scroll') !== -1)) return true;

        if (node.scrollHeight > node.clientHeight
            && (isDom || window.getComputedStyle(node).overflowY.indexOf('scroll') !== -1)) return true;

        return false;
    }

    $.fn.isScrollable  = function()
    {
        for (let el of $(this).isScrollableX())
            if(el) return true;

        for (let el of $(this).isScrollableY())
            if(el) return true;

        return false;
    }

    $.fn.isScrollableX = function() {

        return $(this).map(function(i) {

            var el = this[i] === window ? document.documentElement : this[i];
            var isDom = el == document.documentElement;

            // Cheap test first, and bail on it. The result is
            // `hasScrollableContent && (isOverflowScroll || isDom)`, so an
            // element with nothing to scroll can never qualify however it is
            // styled - yet getComputedStyle() was being called for every one
            // of them anyway.
            //
            // That matters because of who calls this: getScrollableElement()
            // runs `$(el).find('*')` over the WHOLE document and tests every
            // element, immediately after a page swap has inserted a fresh
            // subtree. At ~1600 elements that was ~3200 getComputedStyle
            // calls plus the layout flush they force, measured at 136.6ms of
            // the swap's blocking task - the single most expensive phase in
            // it, larger than every piece of transparentJS's own work
            // combined. Almost none of those elements scroll.
            //
            // Same short-circuit for isDom: the documentElement qualifies on
            // that flag alone, so its overflow never needed reading either.
            if (!(el.scrollWidth > el.clientWidth)) return false;
            if (isDom) return true;

            return window.getComputedStyle(el).overflowX.indexOf('scroll') !== -1;

        }.bind(this));
    }

    $.fn.isScrollableY = function() {

        return $(this).map(function(i) {

            var el = this[i] === window ? document.documentElement : this[i];
            var isDom = el == document.documentElement;

            // Same short-circuit as isScrollableX above - see that comment
            // for why this one call site dominated the swap.
            if (!(el.scrollHeight > el.clientHeight)) return false;
            if (isDom) return true;

            return window.getComputedStyle(el).overflowY.indexOf('scroll') !== -1;

        }.bind(this));
    }

    $.fn.closestScrollable = function()
    {
        return $(this).map((i) => {

            var target = this[i] === window ? document.documentElement : this[i];
            if (target === undefined) target = document.documentElement;

            while (target !== document.documentElement) {

                if($(target).isScrollable()) return target;

                if(target.parentElement === undefined) return undefined;
                if(target.parentElement === null) return null;

                target = target.parentElement;
            }

            return $(target).isScrollable() ? target : undefined;
        });
    }

    $.fn.repaint = function(duration = 1000, reiteration=5) {

        var time = 0;
        var interval = undefined;
        var fn = function () {

            $(this).each(function (_, el) {

                var displayBak = el.style.display;

                el.style.display = "none";
                el.style.display = displayBak;
                el.offsetHeight;
            });

            if (time > duration) clearInterval(interval);
            time += duration/reiteration;

        }.bind(this);

        fn();
        if(reiteration > 0)
            interval = setInterval(fn, duration/reiteration);
    };

    var Transparent = window.Transparent = {};
    Transparent.version = '3.0.0';
    
    var Settings = Transparent.settings = {
        "headers": {},
        "data": {},
        "disable": false,
        "global_code": true,
        "debug": false,
        "lazyload": true,
        "response_text": {},
        "response_limit": 25,
        "throttle": 1000,
        "rescue_reload": 5000,
        // ── Prefetch on intent ───────────────────────────────────────────
        // Fetch a link's HTML when the pointer settles on it, so the server
        // round-trip is already done (or well underway) by the time it is
        // clicked. The existing response cache only ever helped Back: it is
        // keyed by history uuid, so returning to a page you had already
        // visited cost full price again - measured 2360ms for a first visit
        // and 2301ms for a second visit to the SAME url, against 877ms for
        // Back. Server time dominates a navigation, and this is the only
        // lever that removes it rather than shortening what comes after.
        //
        // prefetch_delay is a dwell, not a debounce: sweeping the pointer
        // across a list of links should not fire a request per link. 65ms is
        // long enough to mean "aiming at this" and far shorter than the
        // reaction time between deciding and clicking.
        //
        // prefetch_ttl bounds staleness. A prefetched page is HTML rendered
        // before the click, so it can be out of date by the time it is used;
        // short is safer, and a miss only costs a normal navigation.
        "prefetch": true,
        "prefetch_delay": 65,
        "prefetch_ttl": 30000,
        "prefetch_max": 15,
        // Milliseconds to hold `html.exiting` after the response arrives and
        // before the DOM is swapped, so the outgoing page can animate away.
        //
        // 0 (off) by default, which is the behaviour every consumer had
        // before this existed: the swap happens the moment the response
        // lands. Turning it on trades that much added latency per navigation
        // for an exit animation - and it is the ONLY window in which one can
        // run, because the swap itself is a single blocking task and a
        // transition started against it never gets a style commit.
        //
        // Plain milliseconds, not parseDuration(): that helper returns
        // seconds for "200ms" but milliseconds for a bare 5000, which is not
        // a distinction to hang a timing API on.
        "exit_duration": 0,
        "identifier": "#page",
        "loader": "#loader",
        "smoothscroll_duration": "200ms",
        "smoothscroll_speed"   : 0,
        "smoothscroll_easing"  : "swing",
        "exceptions": [],
        // nest: list of path patterns (RegExp objects or wildcard strings,
        // same syntax as `exceptions`) whose links open as a nested
        // website-in-website overlay (Transparent.nest) instead of
        // navigating. Purely config-driven - no HTML attribute needed on
        // the links themselves; the target must still opt in via the
        // X-Transparent-Nest response header (server-side safety net).
        "nest": [],
        // nest panel interactions (all opt-out): drag the chrome bar to
        // move the panel, drag its edges/corners to resize, and magnetic
        // snapping of the panel against the viewport's sides/corners
        // while moving or resizing.
        "nest_move": true,
        "nest_resize": true,
        "nest_snap": true,
        // For resize (its own separate flush-to-edge clamp): how close
        // counts as close enough. For dock (see nest_dock below): how far
        // PAST the viewport boundary counts as genuinely "pushed out" -
        // small on purpose, so it responds promptly without a 1px
        // overshoot mis-triggering it.
        "nest_snap_threshold": 8,
        // dock: any move/resize away from the pristine centered default
        // drops the modal backdrop and lets the host page behind become
        // interactive again ("docked") - a chrome-bar dock button triggers
        // the same thing on demand, without dragging anywhere first.
        // Dragging far enough to push the panel OUT of the viewport docks
        // it flush against that edge instead, stretched to fill the whole
        // dimension (full height for left/right, full width for top/
        // bottom) and collapsed to a small grab-tab-only chrome. Double-
        // click the chrome bar (or the dock button again) to restore the
        // centered default (full backdrop). Set false to forbid docking
        // entirely (both the floating and nest_dock_target mechanisms).
        // swipe: on small screens (<=768px, where the panel is always
        // fullscreen) drag the chrome bar down to dismiss, iOS sheet style.
        "nest_dock": true,
        // nest_dock_target: a CSS selector naming ONE host-page element to
        // dock INTO instead of floating a panel at a viewport edge -
        // "dockerize on demand". That element's existing children are
        // stashed (removed, kept in memory) and the nest panel is moved
        // inside it directly; undocking (restore, close, or the dock
        // button again) puts them back exactly as found. Only engaged by
        // the dock button/enterPassthrough path, not by drag-to-edge
        // (dragging to an edge always uses the floating dock). null (the
        // default) disables this - docking then always floats.
        "nest_dock_target": null,
        "nest_swipe": true,
        // nest_keepalive: closing the overlay PARKS the nested session
        // (hidden, still mounted) instead of destroying it, and the next
        // open of that same page resumes it exactly as it was left - a
        // half-filled form, an editor mid-edit, the scroll position. Only
        // one session is ever parked; opening a different page discards it.
        // Set false to go back to tearing the iframe down on every close.
        "nest_keepalive": true,
        // headlock: list of URL substrings or regex patterns to preserve in
        // <head> across page transitions (e.g. third-party widgets that
        // inject <style>/<link> dynamically). Anything matching is treated
        // as "locked" and never removed during the head merge.
        //
        // In addition, head nodes injected dynamically AFTER initial
        // DOMContentLoaded are auto-preserved (snapshotted on load → not
        // in the set → preserved).
        //
        // Per-element overrides:
        //   <link data-headlock="false"> → opt-out (allow normal removal)
        //   <link data-headlock="true">  → opt-in (always preserve)
        //
        // Ported from upstream 1.0.82's `headlock` design (cleaner API than
        // the previous hardcoded SCRIPT/STYLE-never-remove heuristic).
        "headlock": [],
        // ── View Transitions API ────────────────────────────────────────────
        // When true, the DOM swap is wrapped in document.startViewTransition()
        // so the browser captures an OLD snapshot, applies the swap callback,
        // then crossfades to the NEW state natively. Falls back transparently
        // to the CSS-only transition path on browsers without VT support
        // (Firefox < 144, Safari < 18.2, old Chromium). Per-element morph
        // is opt-in via CSS:
        //
        //   #page { view-transition-name: page; }
        //   .article-hero img { view-transition-name: article-hero; }
        //
        // Pairs the named element across the swap so the browser animates
        // its position/size change instead of crossfading the snapshots.
        //
        // skip_transition_for_cache: when true, in-DOM cache hits bypass VT
        // entirely (for Turbo-style instant-back UX). Default false because
        // VT's 200ms crossfade is fast enough that the consistency win
        // outweighs the saved frames.
        "use_view_transitions": false,
        "skip_transition_for_cache": false,
        // Native top progress bar, shown automatically via CSS whenever
        // `html.loading` is set (i.e. for the ENTIRE duration of any page
        // transition - real navigation, SPA swap, or a nested overlay open/
        // navigate - not just the nest module's own open flow). This was
        // long an opt-OUT-only config: consumers already passed
        // `progress_bar: 'off'` in anticipation of a "native bar" that was
        // never actually implemented - the old content just sat there with
        // no visual feedback for however long the fetch took ("blank space
        // and dead time"). true here means every consumer gets a working
        // indicator by default; set to false/'off' to keep using a
        // different indicator (e.g. nprogress) instead, matching how the
        // public site's app-defer.js already opts out.
        "progress_bar": true,

        // confirm() prompt shown before ESC closes an open nest overlay -
        // overridable via Transparent.ready({nest_esc_confirm: '...'}) for
        // localization, same as any other consumer-facing string here.
        "nest_esc_confirm": "Close this panel? Any unsaved changes may be lost.",

        // The response cache (sessionStorage + the in-memory live-DOM
        // cache) has no built-in freshness check - it's keyed purely by
        // page path/uuid, so a deploy that changes server-rendered HTML/
        // CSS leaves any tab that had a page cached replaying that stale
        // copy indefinitely (sessionStorage survives normal reloads).
        // Passing a value here that changes on every real deploy (a git
        // commit SHA, a build id, ...) makes checkCacheVersion() purge
        // the whole cache on mismatch. null (the default) skips the
        // check entirely - existing consumers who never opt in see no
        // behavior change.
        "cache_version": null
    };

    const State = Transparent.state = {

        ROOT       : "transparent",

        SWITCH     : "X-to-Y",
        SAME       : "same",
        READY      : "ready",
        RELOAD     : "reload",
        DISABLE    : "disable",
        LOADING    : "loading",
        NEW        : "new",
        FIRST      : "first",
        SUBMIT     : "submit",
        POPSTATE   : "popstate",
        HASHCHANGE : "hashchange",
        CLICK      : "click",

        // Set once the response is in hand but BEFORE the DOM is swapped, and
        // held for Settings.exit_duration so the outgoing page has a window in
        // which it can still animate. Off (0) by default - see exit_duration.
        //
        // Deliberately its own state rather than reusing `new`: `new` is only
        // added when isKnownLayout() is false, i.e. the first time a layout is
        // seen in a session, so CSS keyed on it animates once and then quietly
        // stops. That is a trap worth naming - it looks correct in testing and
        // fails on the second visit.
        EXITING    : "exiting",

        PREACTIVE  : "pre-active",
        ACTIVEIN   : "active-in",
        ACTIVE     : "active",
        ACTIVEOUT  : "active-out",
        POSTACTIVE : "post-active",

        NOTIFICATION: "notification"
    };

    /* Classes this library (or a consumer) puts on <html> at RUNTIME, which
       the server never renders.

       The page-swap reconciliation (see the removeHtmlClass filter further
       down) rebuilds <html>'s class list by diffing the live one against the
       INCOMING document's, and drops anything the incoming markup doesn't
       carry. State classes are exempted there because they are transient by
       definition - but a runtime class like progress-bar-native is neither
       transient nor server-rendered, so the very first navigation silently
       deleted it and nothing ever put it back (configure() runs once, at
       ready()). The native progress bar animated on the first navigation and
       never again: .progress-bar-active kept being added on every click, but
       its CSS is gated on html.progress-bar-native, which had gone.

       Anything registered here survives a swap. */
    const Persist = Transparent.persistentClasses = new Set(["progress-bar-native"]);

    var isReady    = false;
    var rescueMode = false;

    Transparent.html = $($(document).find("html")[0]);
    Transparent.html.addClass(Transparent.state.ROOT+ " " + Transparent.state.LOADING + " " + Transparent.state.FIRST);

    if(!Transparent.html.hasClass(Transparent.state.ACTIVE)) {
        Transparent.html.addClass(Transparent.state.ACTIVE);
        dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVE));
    }

    // ── Server-rendered element tracking ───────────────────────────────────
    //
    // SPA head/body merging removes elements not present in the new page's
    // HTML response — correct for server-rendered tags (per-page CSS,
    // <meta>, page-specific <script>), but it ALSO nukes anything that a
    // third-party loader injected at runtime: Brevo's chat widget <style>
    // and <div>, Google Analytics tags, Intercom, Crisp, Hotjar, etc.
    // These elements are never in any page's HTML response, so the merge
    // removes them on every nav → user sees the chat widget lose all its
    // CSS and explode to full screen (visible in the user's screenshot of
    // navigating /articles → /).
    //
    // Fix: maintain a WeakSet of elements known to be server-rendered. The
    // initial document's head + body children are server-rendered. Anything
    // we ADD via the SPA merge later is also server-rendered (it came from
    // a server HTML response). Anything else — third-party script
    // injections that happen AFTER snapshot — is never added to the set
    // and is therefore preserved across navs.
    //
    // WeakSet means removed elements get garbage-collected → no leak.
    //
    // MutationObserver auto-tags elements added by ANY route, so even
    // body-script appends or head-script appends elsewhere in this library
    // stay correctly classified.
    // Ported from upstream 1.0.82 — `headlock` design.
    //
    // Replaces the previous hardcoded "never remove SCRIPT/STYLE" rule
    // with a finer-grained API: snapshot the initial head children, then
    // on the next swap, *preserve* anything that's either (a) not in the
    // snapshot (= dynamically injected after load), or (b) matches a
    // configured URL pattern in Settings.headlock, or (c) has a
    // data-headlock attribute (true/non-empty = lock, "false" = unlock).
    //
    // Two key wins over the previous local impl:
    //   1. The previous impl never removed any <script>/<style> at all,
    //      which caused per-page stylesheets to leak across navigations
    //      (e.g. layout1's inline <style> persisting on layout2). The new
    //      design only locks dynamically-injected ones.
    //   2. Project code can pass `headlock: ["brevo.com", "googletag", /hotjar/]`
    //      in Transparent.ready({...}) to explicitly opt-in third-party
    //      URLs by substring or regex.
    var originalHeadNodes = new WeakSet();
    function snapshotHeadNodes() {
        if (document.head) {
            for (var i = 0; i < document.head.children.length; i++) {
                originalHeadNodes.add(document.head.children[i]);
            }
        }
    }
    // Snapshot synchronously at module-eval time. Defer scripts run after
    // the parser has built the <head> but before async third-party loaders
    // execute, so the snapshot captures the server-rendered <head> cleanly.
    // The DOMContentLoaded fallback handles the rare case where the script
    // ran before <head> was complete (e.g. in-head non-defer placement).
    snapshotHeadNodes();
    if (!document.head) {
        document.addEventListener("DOMContentLoaded", snapshotHeadNodes, { once: true });
    }

    Transparent.isHeadlocked = function(el) {
        if (!el || el.nodeType !== 1) return false;
        // Explicit attribute opt-out wins over everything else.
        var attr = el.getAttribute && el.getAttribute("data-headlock");
        if (attr === "false") return false;
        // Explicit attribute opt-in (any non-"false" value).
        if (attr !== null && attr !== undefined) return true;
        // Auto-lock anything injected after the initial snapshot — by
        // definition, third-party widgets and their CSS.
        if (!originalHeadNodes.has(el)) return true;
        // URL-pattern matching: src for <script>/<link>/<iframe>, href for
        // <link>, or full textContent for inline <style> blocks. Substring
        // matches on strings; .test() matches on RegExp.
        var patterns = Settings["headlock"] || [];
        if (!patterns.length) return false;
        var url = el.getAttribute && (el.getAttribute("src") || el.getAttribute("href"));
        if (!url && el.tagName === 'STYLE') url = el.textContent || '';
        if (!url) return false;
        for (var i = 0; i < patterns.length; i++) {
            var p = patterns[i];
            if (p instanceof RegExp) { if (p.test(url)) return true; }
            else if (typeof p === "string" && p.length && url.indexOf(p) !== -1) return true;
        }
        return false;
    };

    window.addEventListener("DOMContentLoaded", function()
    {
        Transparent.loader = $($(document).find(Settings.loader)[0] ?? Transparent.html);
        Transparent.lazyLoad();
    });

    Transparent.isRescueMode = function() { return rescueMode; }
    Transparent.getData = function(uuid)
    {
        return (Settings["data"][uuid] ? Settings["data"][uuid] : {});
    }

    Transparent.setData = function(uuid, data)
    {
        Settings["data"][uuid] = data;
        return this;
    }

    Transparent.getResponseText = function(uuid)
    {
        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];

        // Bubble up the most recent uuid
        var index = array.indexOf(uuid);
        if (index > -1) {
            array.splice(index, 1);
            array.push(uuid);
        }

        // If no response refresh page based on the requested url
        return sessionStorage.getItem('transparent[response]['+uuid+']') || null;
    }

    Transparent.getResponsePosition = function(uuid)
    {
        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];

        // Bubble up the most recent uuid
        var index = array.indexOf(uuid);
        if (index > -1) {
            array.splice(index, 1);
            array.push(uuid);
        }

        // If no response refresh page based on the requested url
        var position = sessionStorage.getItem('transparent[position]['+uuid+']');
        return position != "undefined" ? (JSON.parse(position) || []) : [];
    }

    Transparent.getResponse = function(uuid)
    {
        return [ Transparent.getResponseText(uuid), Transparent.getResponsePosition(uuid) ];
    }

    function isDomEntity(entity)
    {
        return typeof entity  === 'object' && entity.nodeType !== undefined;
    }

    Transparent.setResponse = function(uuid, responseText, scrollableXY = [], exceptionRaised = false)
    {
        if(isDomEntity(responseText))
            responseText = responseText.outerHTML;

        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        array.push(uuid);

        while(array.length > Settings["response_limit"])
            sessionStorage.removeItem('transparent['+array.shift()+']');

        try {

            if(isLocalStorageNameSupported()) {

                sessionStorage.setItem('transparent', JSON.stringify(array));
                sessionStorage.setItem('transparent[response]['+uuid+']', responseText);
                sessionStorage.setItem('transparent[position]['+uuid+']', JSON.stringify(scrollableXY));
            }

        } catch(e) {

            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return exceptionRaised === false ? Transparent.setResponse(uuid, responseText, scrollableXY, true) : this;
        }

        return this;
    }

    // ── In-memory live-DOM cache ────────────────────────────────────────────
    //
    // Turbo-style: store cloned <html> Element nodes per uuid so popstate
    // (back/forward) can short-circuit the XHR + sessionStorage round-trip
    // + DOMParser.parseFromString cycle. Result: back/forward feels instant.
    //
    // Key vs sessionStorage flow:
    //   - sessionStorage: outerHTML serialize (slow) → string (5-10MB
    //     quota) → JSON read → DOMParser parse (slow). Whole cycle on
    //     every popstate. Used as the fallback when the live cache misses.
    //   - liveDomCache: cloneNode(true) of the rendered <html> element
    //     stored in a Map<uuid, {node, scroll, ts}>. Bounded with LRU.
    //     No serialization, no parsing — just the live DOM node ready
    //     for the swap to consume.
    //
    // setResponse populates BOTH (live cache + sessionStorage). The
    // sessionStorage write is kept so tab reloads and cross-process
    // restores keep working. getLiveResponse() is the new fast-path API
    // used by handleResponse before the DOMParser fallback.
    Transparent._liveDomCache = new Map();
    Transparent.liveDomCacheMax = 25;
    Transparent.liveDomCacheTTL = 5 * 60 * 1000; // 5 min

    Transparent.getLiveResponse = function(uuid) {
        var entry = Transparent._liveDomCache.get(uuid);
        if (!entry) return null;
        if (Date.now() - entry.ts > Transparent.liveDomCacheTTL) {
            Transparent._liveDomCache.delete(uuid);
            return null;
        }
        // LRU bump: re-insert to move to the back of the iteration order.
        Transparent._liveDomCache.delete(uuid);
        Transparent._liveDomCache.set(uuid, entry);
        // Return a CLONE so the caller's swap mutations don't poison
        // the cache for future popstate hits. The clone is detached
        // from any document so it's safe to pass to the swap.
        return entry.node.cloneNode(true);
    };

    Transparent.setLiveResponse = function(uuid, htmlEl, scrollableXY) {
        if (!htmlEl || htmlEl.nodeType !== 1) return;
        Transparent._liveDomCache.set(uuid, {
            node: htmlEl.cloneNode(true),
            scroll: scrollableXY || [],
            ts: Date.now()
        });
        // LRU evict — Map iteration order is insertion order.
        while (Transparent._liveDomCache.size > Transparent.liveDomCacheMax) {
            var firstKey = Transparent._liveDomCache.keys().next().value;
            Transparent._liveDomCache.delete(firstKey);
        }
    };

    Transparent.clearLiveResponse = function() {
        Transparent._liveDomCache.clear();
    };

    // ── Prefetch cache, keyed by URL ────────────────────────────────────
    // Deliberately separate from the uuid-keyed caches above. Those answer
    // "what did THIS history entry look like", which is the right question
    // for Back and the wrong one for "am I about to be asked for this page".
    // A url key is what lets a prefetch started on hover be claimed by the
    // click that follows, and what lets a second visit to a page skip the
    // server entirely.
    Transparent._prefetchCache = new Map();
    Transparent._prefetchInFlight = new Set();

    Transparent.getPrefetched = function(href) {

        var entry = Transparent._prefetchCache.get(href);
        if (!entry) return null;

        var ttl = parseInt(Settings["prefetch_ttl"], 10) || 0;
        if (ttl > 0 && Date.now() - entry.ts > ttl) {
            Transparent._prefetchCache.delete(href);
            return null;
        }

        return entry.text;
    };

    Transparent.setPrefetched = function(href, text) {

        if (!href || !text) return;
        Transparent._prefetchCache.set(href, { text: text, ts: Date.now() });

        var max = parseInt(Settings["prefetch_max"], 10) || 15;
        while (Transparent._prefetchCache.size > max) {
            var oldest = Transparent._prefetchCache.keys().next().value;
            Transparent._prefetchCache.delete(oldest);
        }
    };

    Transparent.clearPrefetched = function() {
        Transparent._prefetchCache.clear();
    };

    // GET a page in the background and park its HTML under its url. Never
    // throws and never reports: a prefetch that fails is simply a click that
    // pays full price later, which is the behaviour without prefetch at all.
    Transparent.prefetch = function(href) {

        if (Settings["prefetch"] === false) return;
        if (!href) return;
        if (Transparent._prefetchCache.has(href)) return;
        if (Transparent._prefetchInFlight.has(href)) return;
        // Two at a time. A slow backend is exactly the case prefetch helps
        // most and also the one where a hover-storm could pile requests onto
        // an already-struggling server.
        if (Transparent._prefetchInFlight.size >= 2) return;

        Transparent._prefetchInFlight.add(href);

        var request = new XMLHttpRequest();
        request.open("GET", href, true);
        // Marks it as a speculative fetch so a backend can tell it apart from
        // a real navigation (skip write-side effects, analytics, etc.).
        request.setRequestHeader("X-Purpose", "prefetch");
        request.setRequestHeader("Purpose", "prefetch");

        request.onreadystatechange = function() {

            if (request.readyState !== 4) return;
            Transparent._prefetchInFlight.delete(href);

            if (request.status >= 200 && request.status < 300 && request.responseText)
                Transparent.setPrefetched(href, request.responseText);
        };

        try { request.send(); }
        catch (e) { Transparent._prefetchInFlight.delete(href); }
    };

    // Would clicking this anchor actually be an in-page navigation? Kept
    // conservative on purpose - a wrong "yes" costs a pointless request to
    // the server, and for anything with a side effect (a logout link, a
    // form action) it could cost far more than that. Anything not clearly a
    // plain GET navigation to another page of this site is left alone.
    function isPrefetchable(a) {

        if (!a || !a.getAttribute) return false;
        if (a.hasAttribute("download")) return false;
        if (a.getAttribute("data-no-prefetch") !== null) return false;

        var target = a.getAttribute("target");
        if (target && target !== "_self") return false;

        var href = a.getAttribute("href");
        if (!href || href.charAt(0) === "#") return false;

        var url;
        try { url = new URL(a.href, location.href); } catch (e) { return false; }

        if (url.origin !== location.origin) return false;
        if (url.protocol !== "http:" && url.protocol !== "https:") return false;
        // Same page - nothing to fetch.
        if (url.href.split("#")[0] === location.href.split("#")[0]) return false;

        var exceptions = Settings["exceptions"] || [];
        if (exceptions.length && matchesPatternList(url.pathname, exceptions)) return false;

        // Nest links open as an overlay through their own path; the main
        // navigation cache is not what serves them.
        var nest = Settings["nest"] || [];
        if (nest.length && matchesPatternList(url.pathname, nest)) return false;

        return true;
    }

    var prefetchTimer = null;

    function onPrefetchIntent(e) {

        if (Settings["prefetch"] === false) return;

        var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (!isPrefetchable(a)) return;

        var href = new URL(a.href, location.href).href;

        clearTimeout(prefetchTimer);
        prefetchTimer = setTimeout(function() { Transparent.prefetch(href); },
                                   parseInt(Settings["prefetch_delay"], 10) || 0);
    }

    document.addEventListener("mouseover", onPrefetchIntent, true);
    document.addEventListener("mouseout", function() { clearTimeout(prefetchTimer); }, true);
    // Touch has no hover, but touchstart still lands ~100ms before the click
    // it becomes - enough to overlap the request with the tap. No dwell here:
    // a finger already on the link IS the intent.
    document.addEventListener("touchstart", function(e) {
        if (Settings["prefetch"] === false) return;
        var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
        if (isPrefetchable(a)) Transparent.prefetch(new URL(a.href, location.href).href);
    }, { capture: true, passive: true });

    Transparent.setResponse = function(uuid, responseText, scrollableXY, exceptionRaised = false)
    {
        // Populate live-DOM cache FIRST while we still have the node.
        // The outerHTML conversion below loses the node identity.
        if (isDomEntity(responseText)) {
            Transparent.setLiveResponse(uuid, responseText, scrollableXY);
            responseText = responseText.outerHTML;
        }

        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        if (!array.includes(uuid)) {

            array.push(uuid);
            // Enforce the LRU cap. NB: entries are stored under
            // `transparent[response][<uuid>]` / `transparent[position][<uuid>]`,
            // so eviction must remove THOSE keys — the previous code removed
            // `transparent[<uuid>]`, which never existed, leaving the real
            // response/position blobs orphaned. They then accumulated past the
            // cap until QuotaExceededError forced a full sessionStorage.clear().
            while(array.length > Settings["response_limit"])
                removeResponseEntry(array.shift());
        }

        try {

            if(isLocalStorageNameSupported()) {

                sessionStorage.setItem('transparent', JSON.stringify(array));
                sessionStorage.setItem('transparent[response]['+uuid+']', responseText);
                sessionStorage.setItem('transparent[position]['+uuid+']', JSON.stringify(scrollableXY));
            }

        } catch(e) {

            // On quota, evict the oldest cached pages (targeted) and retry
            // once, instead of nuking ALL sessionStorage — sessionStorage.clear()
            // also wipes unrelated app state and the entire page cache.
            if (e.name === 'QuotaExceededError' && exceptionRaised === false) {
                evictOldestResponses(Math.max(1, Math.ceil(array.length / 2)));
                return Transparent.setResponse(uuid, responseText, scrollableXY, true);
            }
            // Last resort if a single page is itself too big to ever fit.
            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return this;
        }

        return this;
    }

    // Remove both blobs for a cached page uuid (response HTML + scroll position).
    function removeResponseEntry(uuid) {
        try {
            sessionStorage.removeItem('transparent[response]['+uuid+']');
            sessionStorage.removeItem('transparent[position]['+uuid+']');
        } catch (e) {}
    }

    // Drop the N oldest cached pages and rewrite the index. Used to recover
    // from a QuotaExceededError without discarding the whole cache.
    function evictOldestResponses(count) {
        try {
            var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
            for (var i = 0; i < count && array.length; i++)
                removeResponseEntry(array.shift());
            sessionStorage.setItem('transparent', JSON.stringify(array));
        } catch (e) {}
    }

    Transparent.setResponseText = function(uuid, responseText, exceptionRaised = false)
    {
        if(isDomEntity(responseText))
            responseText = responseText.outerHTML;

        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        if( ! (uuid in array) ) {

            array.push(uuid);
            while(array.length > Settings["response_limit"])
                sessionStorage.removeItem('transparent['+array.shift()+']');
        }

        try {

            if(isLocalStorageNameSupported()) {

                sessionStorage.setItem('transparent', JSON.stringify(array));
                sessionStorage.setItem('transparent[response]['+uuid+']', responseText);
            }

        } catch(e) {

            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return exceptionRaised === false ? Transparent.setResponseText(uuid, responseText, true) : this;
        }

        return this;
    }

    Transparent.setResponsePosition = function(uuid, scrollableXY, exceptionRaised = false)
    {
        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        if( ! (uuid in array) ) {

            array.push(uuid);
            while(array.length > Settings["response_limit"])
                sessionStorage.removeItem('transparent['+array.shift()+']');
        }

        try {

            if(isLocalStorageNameSupported()) {

                sessionStorage.setItem('transparent', JSON.stringify(array));
                sessionStorage.setItem('transparent[position]['+uuid+']', JSON.stringify(scrollableXY));
            }

        } catch(e) {

            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return exceptionRaised === false ? Transparent.setResponsePosition(uuid, scrollableXY, true) : this;
        }

        return this;
    }

    Transparent.hasResponse = function(uuid)
    {
        if(isLocalStorageNameSupported())
            return 'transparent[response]['+uuid+']' in sessionStorage;

        return false;
    }

    // Purges every cached page (targeted per-key removal, same as the
    // quota-eviction path above - never a blanket sessionStorage.clear(),
    // which would also wipe unrelated app state) plus the in-memory
    // live-DOM cache, whenever Settings["cache_version"] doesn't match
    // what was stored on a previous visit. A no-op if cache_version was
    // never configured. Called once per page load from ready()'s
    // first-run path, before anything else touches the cache.
    function checkCacheVersion() {
        var version = Settings["cache_version"];
        if (null === version || undefined === version) return;
        if (!isLocalStorageNameSupported()) return;

        if (sessionStorage.getItem('transparent[version]') === String(version)) return;

        try {
            var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
            array.forEach(removeResponseEntry);
            sessionStorage.removeItem('transparent');
        } catch (e) {}

        Transparent.clearLiveResponse();

        try {
            sessionStorage.setItem('transparent[version]', String(version));
        } catch (e) {}
    }

    Transparent.configure = function (options) {

        var key, value;
        for (key in options) {
            value = options[key];
            if (value !== undefined && options.hasOwnProperty(key)) Settings[key] = value;
        }

        // CSS can't read Settings directly - mirror progress_bar onto a
        // class so `html.progress-bar-native.loading` can gate the native
        // bar in index.scss. Kept in sync on every configure() call (not
        // just the initial ready()) in case a consumer flips it at runtime.
        var progressBarEnabled = Settings["progress_bar"] !== false && Settings["progress_bar"] !== "off";
        Transparent.html.toggleClass("progress-bar-native", progressBarEnabled);

        return this;
    };

    Transparent.ready = function (options = {}) {

        Transparent.configure({'x-ajax-request': true});
        Transparent.configure(options);

        if(Settings.debug) {

            if (Settings.disable) console.debug("Transparent is disabled..");
            else console.debug("Transparent is running..");
        }

        if(!isReady) {
            checkCacheVersion();
            dispatchEvent(new Event('transparent:'+Transparent.state.FIRST));

            // __main__'s own checkCacheVersion() call (see there) only
            // fires on a real navigation - a tab left open and genuinely
            // idle (no clicks, nothing to navigate to) across a deploy
            // would still miss it. Re-checking on tab refocus catches
            // that case too, at effectively zero cost (visibilitychange
            // fires rarely compared to clicks). Registered once here
            // (inside the !isReady branch), not per ready() call.
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'visible') checkCacheVersion();
            });
        }

        isReady = true;

        dispatchEvent(new Event('transparent:'+Transparent.state.READY));
        Transparent.html.addClass(Transparent.state.READY);

        Transparent.addLayout();
        Transparent.lazyLoad();

        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
        window.previousScroll = {top: scrollTop, left: scrollLeft};

        if($(Transparent.html).hasClass(Transparent.state.FIRST)) {
            Transparent.scrollToHash(location.hash, {}, function() {
                Transparent.activeOut(() => Transparent.html.removeClass(Transparent.state.FIRST));
            });
        }
        
        return this;
    };

    Transparent.addLayout = function() {

        var id = Transparent.getLayout();
        if(id === undefined) return false;

        var isKnown = knownLayout.indexOf(id) !== -1;
        if(!isKnown) knownLayout.push(id);

        return !isKnown;
    }

    Transparent.getLayout = function(dom = null) {

        var layout = dom !== null ? $(dom).find(Settings.identifier) : $(Settings.identifier);
        if(!layout.length) return undefined;

        return layout.data("layout");
    }

    Transparent.findNearestForm = function (el) {

        switch (el.tagName) {
            case "FORM":
                var form = $(el);
                return (form.length ? form[0] : undefined);
            case "INPUT":
            case "BUTTON":
                var form = $(el).closest("form");
                if (form.length) return form[0];

                var formName = $(el).attr("name").split("[")[0];
                form = $("form[name="+formName+"]");
                return (form.length ? form[0] : undefined);
        }

        // Try to detect target element
        if (el.target) {

            if (el.target.tagName == "FORM")
                return Transparent.findNearestForm(el.target);

            if (el.target.tagName == "BUTTON" && el.target.getAttribute("type") == "submit")
                return Transparent.findNearestForm(el.target);

            if (el.target.tagName == "INPUT" && el.target.getAttribute("type") == "submit")
                return Transparent.findNearestForm(el.target);

            var form = $(el.target).closest("form");
            return (form.length ? form[0] : undefined);
        }

        return null;
    }

    window.previousLocation = window.location.toString();
    /* currentOrigin()/currentPathname(), never plain location.* below:
       inside a `srcdoc` iframe - which is exactly how Transparent.nest
       mounts the website-in-website overlay - location.origin is the
       literal string "null". `new URL(path, "null")` THROWS ("Invalid
       URL"), so every link and every form submission resolved here died
       with a TypeError the moment it ran inside the overlay. Reported
       live: saving a form from the nested site did nothing at all.
       __main__'s same-origin guard was already fixed this way; this is the
       same fix for the URLs findLink() builds. */
    Transparent.findLink = function (el) {

        if (el.type == Transparent.state.HASHCHANGE) {

            var href = el.newURL;
            if(!href) return null;

            if (href.startsWith("#")) href = location.pathname + href;
            if (href.endsWith  ("#")) href = href.slice(0, -1);

            var data = history.state ? Transparent.getData(history.state.uuid) : {};
            return ["GET", new URL(el.newURL), data];

        } else if (el.type == Transparent.state.POPSTATE) {

            if(!el.state) return;

            var href = el.state.href;
            if (href.startsWith("#")) href = location.pathname + href;
            if (href.endsWith  ("#")) href = href.slice(0, -1);

            var type = el.state.type;
            var data = Transparent.getData(el.state.uuid);

            var https  = /^https?:\/\//i;
            if (https.test(href)) return [type, new URL(href), data];

            var hash  = /^\#\w*/i;
            if (hash.test(href)) return [type, new URL(currentOrigin()+currentPathname()+href), data];

            return [type, new URL(href, currentOrigin()), data];

        } else if(el.type == Transparent.state.SUBMIT) {

            if(el.target && el.target.tagName == "FORM") {

                var href = el.target.getAttribute("action");
                if(!href) href = location.pathname + href;


                if (href.startsWith("#")) href = location.pathname + href;
                if (href.endsWith  ("#")) href = href.slice(0, -1);

                var method = el.target.getAttribute("method") || "GET";
                method = method.toUpperCase();

                var form = Transparent.findNearestForm(el);
                if (form == null) {
                    console.error("No form found upstream of ", el);
                    return null;
                }

                if(!$(el).hasClass("skip-validation") && !form.checkValidity()) {
                    console.error("Invalid form submission.", el);
                    form.classList.add('was-validated');
                    return null;
                }

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return [method, new URL(href), form];
                return [method, new URL(href, currentOrigin()), form];
            }
        }

        closestEl = $(el).closest("a");
        if(!closestEl.length) closestEl = $(el).closest("button");
        if(!closestEl.length) closestEl = $(el).closest("input");
        if (closestEl.length) el = closestEl[0];
        switch (el.tagName) {

            case "A":
                var href = el.href;
                if(!href) return null;

                if (href.startsWith("#")) href = location.pathname + href;
                if (href.endsWith  ("#")) href = href.slice(0, -1);

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return ["GET", new URL(href), el];

                return ["GET", new URL(href, currentOrigin()), el];

            case "INPUT":
            case "BUTTON":
                var domainBaseURI = el.baseURI.split('/').slice(0, 3).join('/');
                var domainFormAction = el.formAction.split('/').slice(0, 3).join('/');

                var pathname = el.formAction.replace(domainFormAction, "");
                if(!pathname) return null;

                if (domainBaseURI == domainFormAction && el.getAttribute("type") == "submit") {

                    var form = Transparent.findNearestForm(el);
                    if (form == null) {
                        console.error("No form found upstream of ", el);
                        return null;
                    }

                    if(!$(el).hasClass("skip-validation") && !form.checkValidity()) {
                        console.error("Invalid form submission.", el);
                        form.classList.add('was-validated');
                        return null;
                    }

                    var pat  = /^https?:\/\//i;
                    if (pat.test(href)) return ["POST", new URL(pathname), form];
                    return ["POST", new URL(pathname, currentOrigin()), form];
                }
        }

        // Try to detect target element
        if (el.target) {

            if (el.target.tagName == "A" && el.target.href)
                return Transparent.findLink(el.target);

            if (el.target.tagName == "BUTTON" && el.target.getAttribute("type") == "submit")
                return Transparent.findLink(el.target);

            if (el.target.tagName == "INPUT" && el.target.getAttribute("type") == "submit")
                return Transparent.findLink(el.target);
        }

        // Try to catch a custom href attribute without "A" tag
        if (el.target && $(el.target).attr("href")) {

            var href = $(el.target).attr("href");
            if(!href) return null;

            if (href.startsWith("#")) href = location.pathname + href;
            if (href.endsWith  ("#")) href = href.slice(0, -1);

            var form = Transparent.findNearestForm(el);
            if (form == null) return null;

            var pat  = /^https?:\/\//i;
            if (pat.test(href)) return ["GET", new URL(href), form];
            return ["GET", new URL(href, currentOrigin()), form];
        }

        if (el.target && el.target.parentElement)
            return  Transparent.findLink(el.target.parentElement);

        return null;
    };


    Transparent.preload = function (link, callback = function(preload = []) {}) {

        var nPreload = 0;
        for (var as in link) {

            link[as] = link[as].filter(url => url !== null && url.length > 0);
            nPreload += link[as].length;
        }

        if(nPreload == 0)
            return callback();

        var preloads = [];
        var nPreloaded = 0;
        for (var as in link) {

            for (var i = 0; i < link[as].length; i++) {

                var url = link[as][i];
                if(url === null || url === "") continue;

                var preload = document.createElement("link");
                preloads.push(preload);

                preload.onload = function () {

                    if (++nPreloaded == nPreload)
                        return callback(preloads);
                };

                preload.setAttribute("rel", "preload");
                preload.setAttribute("as", as);
                preload.setAttribute("crossorigin","");
                preload.href = url;

                document.head.append(preload);
            }
        }
    }

    Transparent.findElementFromParents = function(el, parents, from = -1) {

        var that = $(el).find(Settings.identifier);
        for (var i = parents.length - 1, j = 0; i >= 0; i--) {

            if (j++ < from) continue;

            var that = that.children(parents[i].tagName);
            if (that.length != 1) return undefined;
        }

        return that;
    }

    Transparent.isPage = function(dom) {

        // Check if page block found
        var page = $(dom).find(Settings.identifier)[0] || undefined;
        if (page === undefined) return false;

        return true;
    }

    var knownLayout = [];
    Transparent.isKnownLayout = function(dom)
    {
        var page = (dom ? $(dom).find(Settings.identifier) : $(Settings.identifier))[0];
        if (page === undefined) return false;

        var layout = $(page).data("layout");
        return knownLayout.indexOf(layout) !== -1;
    }

    Transparent.isCompatiblePage = function(dom, method = null, data = null)
    {
        // If no html response.. skip
        if(!dom) return false;

        // An exception applies here..
        // in case the page contains data transferred to the server
        if(method == "POST" && !jQuery.isEmptyObject(data)) return true;

        var page = $(dom).find(Settings.identifier)[0] || undefined;
        if (page === undefined) return false;

        var currentPage = $(Settings.identifier)[0] || undefined;
        if (currentPage === undefined) return false;

        var name  = currentPage.getAttribute("data-name") || "default";
        var newName = page.getAttribute("data-name") || "default";

        return name == newName;
    }

    Transparent.parseDuration = function(str) {

        var array = String(str).split(", ");
        array = array.map(function(t) {

            if(String(t).endsWith("ms")) return parseFloat(String(t))/1000;
            return parseFloat(String(t));
        });

        return Math.max(...array);
    }

    Transparent.callback = function(fn = function() {}, delay = 0) {

        if(delay == 0) fn();
        else setTimeout(fn, delay);
    }

    Transparent.activeTime = function(el = undefined) {

        var delay = 0, duration = 0;
        if(el === undefined)
            // Transparent.loader is only assigned on DOMContentLoaded; a
            // consumer calling Transparent.ready() inline during parsing
            // can reach here first via ready()'s FIRST-branch scrollToHash
            // (1ms setTimeout) - an intermittent, timing-dependent crash
            // that left html stuck with first/loading/active-out classes.
            // Fall back to <html> itself, same as the loader default when
            // the Settings.loader selector matches nothing.
            el = Transparent.loader ? Transparent.loader[0] : Transparent.html[0];

        var style = window.getComputedStyle(el);
        delay     = Math.max(delay, 1000*Math.max(Transparent.parseDuration(style["animation-delay"]),    Transparent.parseDuration(style["transition-delay"])));
        duration  = Math.max(duration, 1000*Math.max(Transparent.parseDuration(style["animation-duration"]), Transparent.parseDuration(style["transition-duration"])));

        var style = window.getComputedStyle(el, ":before");
        delay     = Math.max(delay, 1000*Math.max(Transparent.parseDuration(style["animation-delay"]),    Transparent.parseDuration(style["transition-delay"])));
        duration  = Math.max(duration, 1000*Math.max(Transparent.parseDuration(style["animation-duration"]), Transparent.parseDuration(style["transition-duration"])));

        var style = window.getComputedStyle(el, ":after");
        delay     = Math.max(delay, 1000*Math.max(Transparent.parseDuration(style["animation-delay"]),    Transparent.parseDuration(style["transition-delay"])));
        duration  = Math.max(duration, 1000*Math.max(Transparent.parseDuration(style["animation-duration"]), Transparent.parseDuration(style["transition-duration"])));

        return {delay:delay, duration:duration};
    }
    var activeInTime = 0;
    var activeInRemainingTime = 0;
    Transparent.activeIn = function(activeCallback = function() {}) {

        if(!Transparent.html.hasClass(Transparent.state.PREACTIVE)) {
            Transparent.html.addClass(Transparent.state.PREACTIVE);
            dispatchEvent(new Event('transparent:'+Transparent.state.PREACTIVE));
        }

        var active = Transparent.activeTime();
        activeInTime = Date.now();
        activeInRemainingTime = active.delay+active.duration;

        Transparent.html.removeClass(Transparent.state.PREACTIVE);
        if(!Transparent.html.hasClass(Transparent.state.ACTIVEIN)) {
            Transparent.html.addClass(Transparent.state.ACTIVEIN);
            dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVEIN));
        }

        Transparent.callback(function() {

            Transparent.html.removeClass(Transparent.state.ACTIVEIN);
            if(!Transparent.html.hasClass(Transparent.state.ACTIVE)) {
                Transparent.html.addClass(Transparent.state.ACTIVE);
                dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVE));
            }

            var active = Transparent.activeTime();
            Transparent.callback(function() {

                activeCallback();
                activeInRemainingTime = 0;

            }.bind(this), active.duration);

        }.bind(this), active.delay);
    }

    Transparent.activeOut = function(activeCallback = function() {}) {

        if(!Transparent.html.hasClass(Transparent.state.ACTIVE)) {
            Transparent.html.addClass(Transparent.state.ACTIVE);
            dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVE));
        }

        if(!Transparent.html.hasClass(Transparent.state.ACTIVEOUT)) {
            Transparent.html.addClass(Transparent.state.ACTIVEOUT);
            dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVEOUT));
        }

        var active = Transparent.activeTime();
        Transparent.callback(function() {

            activeCallback();
            Transparent.html.removeClass(Transparent.state.ACTIVE);

            var active = Transparent.activeTime();
            Transparent.callback(function() {

                Transparent.html.removeClass(Transparent.state.ACTIVEOUT);
                if(Transparent.html.hasClass(Transparent.state.LOADING)) {

                    dispatchEvent(new Event('transparent:'+Transparent.state.LOADING));

                    Object.values(Transparent.state).forEach(e => Transparent.html.removeClass(e));
                    Transparent.html.addClass(Transparent.state.ROOT + " " + Transparent.state.READY);
                }
                
                Transparent.html.addClass(Transparent.state.POSTACTIVE);
               
                var active = Transparent.activeTime();
                Transparent.callback(function() {
                    
                    Transparent.html.removeClass(Transparent.state.POSTACTIVE);
                    dispatchEvent(new Event('transparent:'+Transparent.state.POSTACTIVE));

                }, active.duration+active.delay);
            
            }, active.duration);

        }.bind(this), active.delay);
    }

    Transparent.replaceCanvases = function(dom) {

        // Extract existing canvas to avoid redrawing them.. (time consuming)
        $.each($('html').find("canvas"), function () {

            var parent = $(this).parent();
            if(!parent.length) return;

            var id = this.getAttribute("id");
            if (id) {

                var canvas = $(dom).find("#page #" + id);
                canvas.replaceWith(this);

            } else {

                if(dom === undefined)
                    console.alert("Response missing..");

                var parent = Transparent.findElementFromParents(dom, $(this).parents(), 3);
                if (parent === undefined) {
                    console.error("Unexpected canvas without ID found..", this)
                    return false;
                }

                parent.append(this);
            }
        });
    }

    Transparent.evalScript = function(el)
    {
        function scriptCloneEl(el){
            var script  = document.createElement("script");
            script.text = el.innerHTML;

            var i = -1, attrs = el.attributes, attr;
            var N = attrs.length;
            while ( ++i < N ) {
                script.setAttribute( (attr = attrs[i]).name, attr.value );
            }

            eval($(script).text());
            return script;
        }

        if (el.tagName === 'SCRIPT' ) el.parentNode.replaceChild( scriptCloneEl(el) , el );
        else if (typeof el.querySelectorAll === 'function') {

            // One native query instead of recursing the entire node tree.
            // This walked childNodes and called itself for every node - text
            // and comment nodes included - which after a page swap meant 618
            // recursive calls costing 33.5ms to locate FOUR <script> tags.
            //
            // querySelectorAll returns the same elements in the same document
            // order, and as a STATIC list, so replacing each script as we go
            // cannot disturb the iteration the way a live childNodes walk
            // would. Non-Element nodes keep the old path below rather than
            // throwing on the missing method.
            var scripts = el.querySelectorAll('script');
            for (var s = 0; s < scripts.length; s++)
                Transparent.evalScript( scripts[s] );

        } else {

            var i = -1, children = el.childNodes;
            var N = children.length;
            while ( ++i < N ) {
                Transparent.evalScript( children[i] );
            }
        }

        return el;
    }

    Transparent.rescue = function(dom)
    {
        console.error("Rescue mode.. called");
        rescueMode = true;

        var head = $(dom).find("head").html();
        var body = $(dom).find("body").html();

        if(head == undefined || body == "undefined") {

            $(Settings.identifier).html("<div class='error'></div>");

            setTimeout(function() { window.location.reload(); }, Transparent.parseDuration(Settings["rescue_reload"]));

        } else {

            document.head.innerHTML = $(dom).find("head").html();
            document.body.innerHTML = $(dom).find("body").html();
            Transparent.evalScript($("head")[0]);
            Transparent.evalScript($("body")[0]);
        }

        Transparent.activeOut();
    }

    Transparent.userScroll = function(el = undefined) { return $(el === undefined ? document.documentElement : el).closestScrollable().prop("user-scroll") ?? true; }
    Transparent.scrollTo = function(dict, el = window, callback = function() {})
    {
        setTimeout(function() {

            el = $(el).length ? $(el)[0] : window;
            if (el === window  )
                el = document.documentElement;
            if (el === document)
                el = document.documentElement;

            var maxScrollX = $(el).prop("scrollWidth") - Math.round($(el).prop("clientWidth"));
            if (maxScrollX == 0) maxScrollX = Math.round($(el).prop("clientWidth"));
            var maxScrollY = $(el).prop("scrollHeight") - Math.round($(el).prop("clientHeight"));
            if (maxScrollY == 0) maxScrollY = Math.round($(el).prop("clientHeight"));

            scrollTop  = Math.max(0, Math.min(dict["top"] ?? $(el).prop("scrollTop"), maxScrollY));
            scrollLeft = Math.max(0, Math.min(dict["left"] ?? $(el).prop("scrollLeft"), maxScrollX));

            speed    = parseFloat(dict["speed"] ?? 0);
            easing   = dict["easing"] ?? "swing";
            debounce = dict["debounce"] ?? 0;

            duration  = 1000*Transparent.parseDuration(dict["duration"] ?? 0);
            durationX = 1000*Transparent.parseDuration(dict["duration-x"] ?? dict["duration"] ?? 0);
            durationY = 1000*Transparent.parseDuration(dict["duration-y"] ?? dict["duration"] ?? 0);

            if(speed) {

                var currentScrollX = $(el)[0].scrollLeft;
                if(currentScrollX < scrollLeft || scrollLeft == 0) // Going to the right
                    distanceX = Math.abs(scrollLeft - currentScrollX);
                else // Going back to 0 position
                    distanceX = currentScrollX;

                var currentScrollY = $(el)[0].scrollTop;
                if(currentScrollY <= scrollTop || scrollTop == 0) // Going to the right
                    distanceY = Math.abs(scrollTop - currentScrollY);
                else // Going back to 0 position
                    distanceY = currentScrollY;

                durationX = speed ? 1000*distanceX/speed : durationX;
                durationY = speed ? 1000*distanceY/speed : durationY;
                duration = durationX+durationY;
            }

            var callbackWrapper = function() {

                el.dispatchEvent(new Event('scroll'));
                callback();

                $(el).prop("user-scroll", true);
            };

            if(duration == 0) {

                el.scrollTo(scrollLeft, scrollTop);
                el.dispatchEvent(new Event('scroll'));
                callback();

                $(el).prop("user-scroll", true);

            } else {

                $(el).stop(true).animate({scrollTop: scrollTop}, durationY, easing,
                    () => $(el).stop(true).animate({scrollLeft: scrollLeft}, durationX, easing, Transparent.debounce(callbackWrapper, debounce))
                );
            }

        }.bind(this), 1);

        return this;
    }

    Transparent.debounce = function(func, wait, immediate) {

        var timeout;

        return function() {

            var context = this, args = arguments;
            var later = function() {

                timeout = null;
                if (!immediate) func.apply(context, args);
            };

            var callNow = immediate && !timeout;
            clearTimeout(timeout);

            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };


    Transparent.findImages = function () {

        var doc = document.documentElement;
        const srcChecker = /url\(\s*?['"]?\s*?(\S+?)\s*?["']?\s*?\)/i
        return Array.from(doc.querySelectorAll('*'))
            .reduce((collection, node) => {

                let prop = window.getComputedStyle(node, null).getPropertyValue('background-image')
                let match = srcChecker.exec(prop);
                if (match) collection.add(match[1]);

                if (/^img$/i.test(node.tagName)) collection.add(node.src)
                else if (/^frame$/i.test(node.tagName)) {

                    try {
                        searchDOM(node.contentDocument || node.contentWindow.document)
                            .forEach(img => { if (img) collection.add(img); })
                    } catch (e) {}
                }

                return collection;

            }, new Set());
    }

    Transparent.lazyLoad = function (lazyloadImages = undefined)
    {
        lazyloadImages = lazyloadImages || document.querySelectorAll("img[data-src]:not(.loaded)");
        if ("IntersectionObserver" in window) {

            var imageObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        var image = entry.target;
                        var lazybox = image.closest(".lazybox");

                        image.onload = function() {
                            this.classList.add("loaded");
                            this.classList.remove("loading");
                            this.classList.remove("error");
                            if(lazybox) lazybox.classList.add("loaded");
                            if(lazybox) lazybox.classList.remove("loading");
                            if(lazybox) lazybox.classList.remove("error");
                        };

                        // Error handler for broken / missing images (404, ACL,
                        // DNS failure, malformed URL). Without this, lazy-loaded
                        // images that fail just stay invisible. The .error
                        // class lets project CSS render a placeholder.
                        image.onerror = function() {
                            this.classList.add("error");
                            this.classList.remove("loading");
                            this.classList.remove("loaded");
                            if(lazybox) lazybox.classList.add("error");
                            if(lazybox) lazybox.classList.remove("loading");
                            if(lazybox) lazybox.classList.remove("loaded");
                        };

                        if(lazybox) lazybox.classList.add("loading");
                        image.classList.add("loading");
                        image.src = image.dataset.src;

                        imageObserver.unobserve(image);
                    }
                });
            });

            lazyloadImages.forEach(function (image) {
                imageObserver.observe(image);
            });

        } else {

            var lazyloadThrottleTimeout;

            function lazyload() {
                if (lazyloadThrottleTimeout) {
                    clearTimeout(lazyloadThrottleTimeout);
                }

                lazyloadThrottleTimeout = setTimeout(function () {
                    var scrollTop = window.pageYOffset;
                    lazyloadImages.forEach(function (img) {
                        if (img.offsetTop < (window.innerHeight + scrollTop)) {
                            img.src = img.dataset.src;
                            img.classList.add('loaded');
                        }
                    });
                    if (lazyloadImages.length == 0) {
                        document.removeEventListener("scroll", lazyload);
                        window.removeEventListener("resize", lazyload);
                        window.removeEventListener("orientationChange", lazyload);
                    }
                }, 20);
            }

            document.addEventListener("scroll", lazyload);
            window.addEventListener("resize", lazyload);
            window.addEventListener("orientationChange", lazyload);
        }
    }

    Transparent.loadImages = function()
    {
        function loadImg (src, timeout = 500) {
            var imgPromise = new Promise((resolve, reject) => {

                let img = new Image()
                img.onload = () => {
                    resolve({
                        src: src,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    })
                }

                img.onerror = reject
                img.src = src
            })

            var timer = new Promise((resolve, reject) => { setTimeout(reject, timeout) })
            return Promise.race([imgPromise, timer])
        }

        function loadImgAll (imgList, timeout = 500) {
            return new Promise((resolve, reject) => {
                Promise.all(imgList
                    .map(src => loadImg(src, timeout))
                    .map(p => p.catch(e => false))
                ).then(results => resolve(results.filter(r => r)))
            })
        }

        return new Promise((resolve, reject) => {
            loadImgAll(Array.from(Transparent.findImages(document.documentElement))).then(resolve, reject)
        })
    }

    Transparent.transferAttributes = function(dom) {

        var html = $(dom).find("html");
        $($("html")[0].attributes).each(function(i, attr) {
            if(attr.name == "class") return;
            $("html").removeAttr(attr.name);
        });

        $($(html)[0].attributes).each(function(i, attr) {
            if(attr.name == "class") return;
            $("html").attr(attr.name, attr.value);
        });

        var head = $(dom).find("head");
        $($("head")[0].attributes).each(function(i, attr) {
            $("head").removeAttr(attr.name);
        });

        $($(head)[0].attributes).each(function(i, attr) {
            $("head").attr(attr.name, attr.value);
        });

        var body = $(dom).find("body");
        $($("body")[0].attributes).each(function(i, attr) {
            $("body").removeAttr(attr.name);
        });
        $($(body)[0].attributes).each(function(i, attr) {
            $("body").attr(attr.name, attr.value);
        });
    }

    Transparent.onLoad = function(uuid, dom, callback = null, scrollTo = false) {

        window.previousHash     = window.location.hash;
        window.previousLocation = window.location.toString();
        if(callback === null) callback = function() {};

        $(Transparent.html).data("autoscroll-prevent", false);
        $(Transparent.html).off("wheel.autoscroll DOMMouseScroll.autoscroll mousewheel.autoscroll touchstart.autoscroll");
        $(Transparent.html).on("wheel.autoscroll DOMMouseScroll.autoscroll mousewheel.autoscroll touchstart.autoscroll", function(e) {

            $(this).prop("user-scroll", true);
            $(this).stop();
        });

        activeInRemainingTime = activeInRemainingTime - (Date.now() - activeInTime);

        // Whole-swap body extracted so we can dispatch it either through
        // document.startViewTransition() for browsers that support it (with
        // Settings.use_view_transitions on), or directly for the legacy path.
        // Identical behavior in both branches — VT just wraps it so the
        // browser captures OLD/NEW snapshots and crossfades natively.
        var _doSwapBody = function() {

            // Transfert attributes
            Transparent.transferAttributes(dom);

            // ── Track-reload check ──────────────────────────────────────
            // Mirrors Turbo's <... data-turbo-track="reload"> mechanism.
            // Put `data-track="reload"` on critical <script> / <link>
            // bundles in <head>. On nav, if the set of tracked URLs
            // differs between current and new HTML, force a full reload
            // instead of an SPA swap — because the user's loaded JS/CSS
            // no longer matches what the server is serving (e.g. after
            // a deploy that bumped asset hashes). The browser then
            // re-downloads everything cleanly.
            //
            // Match key: tagName + src/href (or textContent for inline).
            // Same logic as Turbo: the SET of tracked URLs must match.
            (function checkTrackedReload() {
                function trackedSrcs(root) {
                    var srcs = [];
                    var els = root.querySelectorAll('[data-track="reload"]');
                    for (var i = 0; i < els.length; i++) {
                        var el = els[i];
                        var src = el.getAttribute('src') || el.getAttribute('href') ||
                                  (el.textContent || '').slice(0, 200);
                        if (src) srcs.push(el.tagName + ':' + src);
                    }
                    return srcs.sort();
                }
                var currentSrcs = trackedSrcs(document.head);
                if (!currentSrcs.length) return; // nothing tracked → skip
                var newDoc = dom.documentElement ? dom : (dom[0] || dom);
                var newHead = newDoc.head || newDoc.querySelector('head');
                if (!newHead) return;
                var newSrcs = trackedSrcs(newHead);
                // Compare as JSON of sorted arrays — order-independent.
                if (JSON.stringify(currentSrcs) === JSON.stringify(newSrcs)) return;
                if (Settings.debug) {
                    console.log('Transparent track-reload: asset mismatch, forcing reload',
                                { current: currentSrcs, new: newSrcs });
                }
                // Full reload to the requested URL.
                window.location.href = window.location.toString();
            })();

            // Replace head..
            var head = $(dom).find("head");
            $("head").children().each(function() {

                var el   = this;
                var found = false;

                head.children().each(function() {

                    found = this.isEqualNode(el);
                    return !found;
                });

                // Preserve headlocked nodes: anything injected dynamically
                // after initial load (auto), URL-pattern matches in
                // Settings.headlock, or explicit data-headlock="true".
                // This is the win over the previous "never remove SCRIPT/
                // STYLE" rule — per-page server-rendered <style> blocks
                // (e.g. layout1 inline CSS) still get swapped, only
                // third-party / dynamically-injected ones are locked.
                if(!found && Transparent.isHeadlocked(el)) found = true;
                if(!found) this.remove();
            });

            head.children().each(function() {

                var el   = this;
                var found = false;

                $("head").children().each(function() { found |= this.isEqualNode(el); });
                if(!found) {


                    if(this.tagName != "SCRIPT" || Settings["global_code"] == true) {

                        var clone = this.cloneNode(true);
                        $("head").append(clone);
                        // Register the new node as "original" so it falls
                        // through to URL-pattern matching on the next swap
                        // (and isn't auto-locked as third-party content).
                        originalHeadNodes.add(clone);

                    } else {

                        $("head").append(this);
                        originalHeadNodes.add(this);
                    }
                }
            });

            var bodyScript = $(dom).find("body > script");
            bodyScript.each(function() {

                var el   = this;
                var found = false;

                $("body").children().each(function() { found |= this.isEqualNode(el); });
                if(!found) {

                    if(this.tagName != "SCRIPT" || Settings["global_code"] == true) {
                        $("body").append(this.cloneNode(true));
                    } else {
                        $("body").append(this);
                    }
                }
            });

            // Replace canvases..
            Transparent.replaceCanvases(dom);

            // Extract page block to be loaded
            var page = $(dom).find(Settings.identifier);
            if(dom == undefined || page == undefined) window.reload(); // Error a posteriori

            var oldPage = $(Settings.identifier);

            // Make sure name/layout keep the same after a page change (tolerance for POST or GET requests)
            if(oldPage.attr("data-layout") != undefined && page.attr("data-layout") != undefined) {

                var switchLayout = Transparent.state.SWITCH.replace("X", page.attr("data-layout")).replace("Y", oldPage.attr("data-layout"));
                page.attr("data-layout-prev", oldPage.attr("data-layout"));
            }

            var states = Object.values(Transparent.state);
            var     htmlClass = Array.from(($(dom).find("html").attr("class") || "").split(" ")).filter(x => !states.includes(x));
            var  oldHtmlClass = Array.from(($(Transparent.html).attr("class") || "").split(" "));
            var removeHtmlClass = oldHtmlClass.filter(x => !htmlClass.includes(x) && switchLayout != x && !states.includes(x) && !Persist.has(x));

            Transparent.html.removeClass(removeHtmlClass).addClass(htmlClass);
            $(page).insertBefore(oldPage);

            oldPage.remove();

            if(Settings["global_code"] == true) Transparent.evalScript($(page)[0]);
            document.dispatchEvent(new Event('DOMContentLoaded'));
              window.dispatchEvent(new Event('DOMContentLoaded'));

            Transparent.addLayout();

            // Deferred a frame ON PURPOSE. Everything above has just inserted
            // a freshly parsed page and removed the old one, leaving style and
            // layout dirty for the whole document. getScrollableElement() then
            // reads scrollWidth/scrollHeight off every element, and the first
            // of those reads forces the browser to compute all of it
            // synchronously, inside this task - measured at 136.6ms before the
            // short-circuit in isScrollableX/Y, and still ~80ms after it,
            // because the flush itself is the cost, not the per-element work.
            //
            // rAF *then setTimeout*, not rAF alone. requestAnimationFrame
            // callbacks run BEFORE the frame's style and layout pass, so a
            // layout-forcing read inside one still forces layout synchronously
            // - it just moves the cost into the rAF task instead of removing
            // it. Measured exactly that: 88.5ms inside rAF, barely better than
            // doing it inline. (The wavejs fix in this same stack hit the
            // identical trap; worth remembering that "defer it to rAF" is not
            // the same as "let the browser lay out first".)
            //
            // The setTimeout inside the frame callback runs after the browser
            // has done style, layout and paint, so the reads land on CLEAN
            // layout and cost close to nothing.
            //
            // Nothing visible shifts: Transparent.scrollTo already defers its
            // own work with setTimeout, so only the MEASUREMENT was ever
            // synchronous, and the page is still hidden (.active-out) across
            // these frames.
            requestAnimationFrame(function() { setTimeout(function() {

            if(scrollTo) {

                // Go back to top of the page..
                var scrollableElements   = Transparent.getScrollableElement();
                var scrollableElementsXY = Transparent.getResponsePosition(uuid);

                for(i = 0; i < scrollableElements.length; i++) {

                    var el = scrollableElements[i];
                    var positionXY = undefined;

                    if(scrollableElementsXY.length == scrollableElements.length)
                        positionXY = scrollableElementsXY[i] || undefined;

                    if(el == window || el == document.documentElement) {

                        if(positionXY != undefined) Transparent.scrollTo({top:positionXY[0], left:positionXY[1], duration:0});
                        else if (location.hash) Transparent.scrollToHash(location.hash, {duration:0});
                        else Transparent.scrollTo({top:0, left:0, duration:0});

                    } else {

                        if(positionXY != undefined) Transparent.scrollTo({top:positionXY[0], left:positionXY[1], duration:0}, el);
                        else Transparent.scrollTo({top:0, left:0, duration:0}, el);
                    }
                }
            }

            }, 0); }); /* end rAF + setTimeout - see the comment above it */

            $('head').append(function() {

                $(Settings.identifier).append(function() {

                        // Callback if needed, or any other actions
                        callback();

                        // Trigger onload event
                        dispatchEvent(new Event('transparent:load'));
                        dispatchEvent(new Event('load'));
                });
            });

        }.bind(this);

        // Dispatch the swap. With VT enabled AND supported, wrap in
        // document.startViewTransition() so the browser captures OLD/NEW
        // snapshots and crossfades natively. The setTimeout wait is for
        // the CSS fade-out to complete BEFORE VT begins, so VT captures
        // the already-faded state cleanly. Errors inside the callback
        // don't abort the swap — fall back to direct execution.
        var _vtEnabled = Settings["use_view_transitions"]
                         && typeof document.startViewTransition === "function";
        setTimeout(function() {
            if (_vtEnabled) {
                try {
                    document.startViewTransition(_doSwapBody);
                } catch (e) {
                    if (Settings.debug) console.warn("Transparent VT failed, falling back:", e);
                    _doSwapBody();
                }
            } else {
                _doSwapBody();
            }
        }, activeInRemainingTime > 0 ? activeInRemainingTime : 1);
    }

    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function isLocalStorageNameSupported() {

        var testKey = 'test', storage = window.localStorage;
        try {

            storage.setItem(testKey, '1');
            storage.removeItem(testKey);
            return true;

        } catch (error) { return false; }
    }

    Transparent.remToPixel     = function(rem)     { return parseFloat(rem) * parseFloat(getComputedStyle(document.documentElement).fontSize); }
    Transparent.emToPixel      = function(em, el)  { return parseFloat(em ) * parseFloat(getComputedStyle(el.parentElement).fontSize); }
    Transparent.percentToPixel = function(p , el)  { return parseFloat(p  ) * $(el).outerWidth(); }
    Transparent.parseToPixel   = function(str, el) {

        if(str === undefined) return undefined;

        var array = String(str).split(", ");
        array = array.map(function(s) {

            if(s.endsWith("rem")) return Transparent.remToPixel    (s);
            else if(s.endsWith("em") ) return Transparent.emToPixel     (s, el);
            else if(s.endsWith("%")  ) return Transparent.percentToPixel(s, el);
            return parseFloat(s);
        });

        return Math.max(...array);
    }

    Transparent.getScrollPadding = function(el = document.documentElement) {

        var style  = window.getComputedStyle(el);
        var dict = {};
        dict["top"   ] = Transparent.parseToPixel(style["scroll-padding-top"   ] || 0, el);
        dict["left"  ] = Transparent.parseToPixel(style["scroll-padding-left"  ] || 0, el);
        dict["right" ] = Transparent.parseToPixel(style["scroll-padding-right" ] || 0, el);
        dict["bottom"] = Transparent.parseToPixel(style["scroll-padding-bottom"] || 0, el);

        if(isNaN(dict["top"   ])) dict["top"]    = 0;
        if(isNaN(dict["left"  ])) dict["left"]   = 0;
        if(isNaN(dict["right" ])) dict["right"]  = 0;
        if(isNaN(dict["bottom"])) dict["bottom"] = 0;

        return dict;
    }

    Transparent.scrollToHash = function(hash = window.location.hash, options = {}, callback = function() {}, el = window)
    {
        setTimeout(function() {

            if (hash !== "") {

                if ((''+hash).charAt(0) !== '#')
                    hash = '#' + hash;

                var hashElement = $(hash)[0] ?? undefined;
                if (hashElement !== undefined) {

                    var scrollTop  = hashElement.getBoundingClientRect().top  + document.documentElement.scrollTop - Transparent.getScrollPadding().top;
                    var scrollLeft = hashElement.getBoundingClientRect().left + document.documentElement.scrollLeft - Transparent.getScrollPadding().left;

                    options = Object.assign({duration: Settings["smoothscroll_duration"], speed: Settings["smoothscroll_speed"]}, options, {left:scrollLeft, top:scrollTop});
                }

                var bottomReach = document.body.scrollHeight - (window.scrollY + window.innerHeight) < 1;
                var bottomOverflow = scrollTop > window.scrollY + window.innerHeight;
            }

            if(hash === "" || (bottomReach && bottomOverflow)) callback({}, el);
            else Transparent.scrollTo(options, el, callback);
        
        }.bind(this), 1); // minimal delay to ensure the element is rendered

        return this;
    }

    Transparent.isElement = function(obj){
        try { return Boolean(obj.constructor.__proto__.prototype.constructor.name); }
        catch(e) { return false; }
    };

    Transparent.getScrollableElement = function(el = document.documentElement)
    {
        // Was: $(el).find('*').add(el).filter(fn) with the filter calling
        // $(this).isScrollable() - which wraps EVERY element in jQuery twice
        // (isScrollable calls isScrollableX and isScrollableY, each doing its
        // own $(this).map()). Across a whole document that is ~3200 jQuery
        // allocations to answer a question that is two property reads for
        // almost every element. Measured at 88.5ms on this site's ~1600
        // elements even after the reads themselves were short-circuited, and
        // this runs on every page swap.
        //
        // Plain loop over the same nodes, same predicate (isScrollableNode,
        // shared with the plugins above), wrapped in jQuery once at the end so
        // callers still get a jQuery set.
        //
        // Order is preserved deliberately: .add() returned document order,
        // which put the root ancestor first, and getScrollableElementXY zips
        // its saved positions against this list BY INDEX - reordering here
        // would restore each container's scroll position onto a different
        // container.
        var root = (el && el.nodeType === 1) ? el : ($(el)[0] || document.documentElement);

        var out = [];
        if (isScrollableNode(root)) out.push(root);

        var all = root.querySelectorAll('*');
        for (var i = 0; i < all.length; i++)
            if (isScrollableNode(all[i])) out.push(all[i]);

        return $(out);
    };

    Transparent.getScrollableElementXY = function() {

        var elementsXY = [];
        var elements = Transparent.getScrollableElement();

        for(i = 0; i < elements.length; i++)
            elementsXY.push([$(elements[i]).scrollTop(), $(elements[i]).scrollLeft()]);

        return elementsXY;
    }

    // The in-flight navigation XHR, if any. A newer navigation aborts this
    // one instead of being dropped - see __main__ and handleResponse.
    var currentXhr = null;
    // uuid of the most recently started navigation. A response whose uuid
    // doesn't match this is stale (superseded by a newer click) and gets
    // discarded in handleResponse, instead of overwriting what the user's
    // more recent click already requested.
    var currentNavUuid = null;
    var formSubmission = false;

    // ── User-typed form dirty tracking ──────────────────────────────────────
    //
    // True if the user has modified any form input via a real keystroke /
    // click / select. False after a fresh navigation OR after a form submit.
    // Used by onbeforeunload to decide whether to confirm.
    //
    // `e.isTrusted` filters out programmatic value mutations from JS init
    // code (Select2 setting the hidden field after dropdown selection,
    // Editor.js syncing JSON to a hidden <textarea>, datepicker init writing
    // a normalized value, etc.). Without this filter, the previous value-
    // comparison logic (formDataBefore vs formDataAfter) flagged every
    // page-with-form as "dirty" by the time the user hit Ctrl+W, even
    // when they hadn't typed anything.
    var formDirty = false;
    document.addEventListener('input', function(e) {
        if (!e.isTrusted) return;
        if (!e.target || !e.target.form) return;
        formDirty = true;
    }, true);
    document.addEventListener('change', function(e) {
        if (!e.isTrusted) return;
        if (!e.target || !e.target.form) return;
        formDirty = true;
    }, true);
    // Reset on user-initiated submit so the post-submit redirect doesn't
    // double-prompt. The existing `formSubmission` flag already handles
    // the synchronous prompt path; this clears state for any follow-up.
    document.addEventListener('submit', function() { formDirty = false; }, true);
    // Reset on every navigation. transparent.js re-dispatches DOMContentLoaded
    // after each SPA swap (see _doSwap, ~line 1567), so this fires on the
    // initial load AND on each in-place navigation. Without it the flag leaks
    // across SPA navigations: typing on page A, then navigating to a form
    // page B, would leave formDirty=true and wrongly prompt on reload of B
    // even though the user never touched B. A freshly-loaded page is never
    // dirty until the user types on it (any restored draft is already saved).
    document.addEventListener('DOMContentLoaded', function() { formDirty = false; });

    // ── Transparent.formMemory ──────────────────────────────────────────────
    //
    // Persistent draft store for forms — survives accidental close, refresh,
    // power loss, browser crash. Keyed by URL + form identity (name or id).
    //
    // Save triggers:
    //   - debounced (500ms) on user `input`/`change` events
    //   - synchronously on beforeunload (last-resort capture for fields
    //     mutated by JS like Editor.js / Select2 that don't fire trusted
    //     `input` events)
    //
    // Restore: silently on initial DOMContentLoaded AND after each SPA swap
    // (transparent.js re-dispatches DOMContentLoaded post-swap, line ~1375).
    // Restored fields get `data-restored-from-draft=""` for optional
    // project-level toast / styling.
    //
    // Clear: on form submit + on TTL expiry (7 days) + manually via
    // `Transparent.formMemory.clear(form)`.
    //
    // Opt-out:
    //   - `<form data-no-persist>` — entire form skipped
    //   - `<input data-no-persist>` — single field skipped
    //   - Auto-skipped: type="password", type="file", type="submit"/button,
    //     and any hidden field whose name contains `_token` or `csrf`
    //     (Symfony CSRF token field). These are never persisted.
    //
    // Editor.js compatibility: Editor.js reads its initial JSON from
    // `data-edjs` attribute (not `.value`). On restore, if the field is a
    // <textarea data-edjs>, we mirror the restored value into `data-edjs`
    // too so Editor.js renders the draft when its init pass runs.
    Transparent.formMemory = (function() {
        var KEY_PREFIX  = 'tx-form-memory:';
        var DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
        var DEBOUNCE    = 500;

        var saveTimers = new WeakMap();
        var api = {
            enabled : true,
            ttl     : DEFAULT_TTL,
            debounce: DEBOUNCE,
        };

        function shouldSkipField(field) {
            if (!field.name) return true;
            var type = (field.type || '').toLowerCase();
            if (type === 'password' || type === 'file') return true;
            if (type === 'submit' || type === 'button' || type === 'reset') return true;
            if (field.hasAttribute && field.hasAttribute('data-no-persist')) return true;
            // CSRF tokens — never persist. Matches Symfony's `_token` and
            // any other token-named hidden input (`csrf`, `_csrf_token`, ...).
            if (type === 'hidden') {
                var n = field.name.toLowerCase();
                if (n.indexOf('_token') !== -1 || n.indexOf('csrf') !== -1) return true;
            }
            return false;
        }

        function shouldSkipForm(form) {
            if (!form) return true;
            if (form.hasAttribute && form.hasAttribute('data-no-persist')) return true;
            if (!form.name && !form.id) return true; // need identity for key
            return false;
        }

        function getKey(form) {
            return KEY_PREFIX + location.pathname + ':' + (form.name || form.id);
        }

        function readLS(key) {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        }
        function writeLS(key, val) {
            try { localStorage.setItem(key, val); } catch (e) {
                // Quota exceeded or storage disabled — fail silent. The
                // user keeps their work in memory, just loses persistence.
            }
        }
        function removeLS(key) {
            try { localStorage.removeItem(key); } catch (e) {}
        }

        api.save = function(form) {
            if (!api.enabled) return;
            if (shouldSkipForm(form)) return;

            var data = {};
            var elements = form.elements;
            for (var i = 0; i < elements.length; i++) {
                var field = elements[i];
                if (shouldSkipField(field)) continue;

                var type = (field.type || '').toLowerCase();
                if (type === 'checkbox' || type === 'radio') {
                    if (!field.checked) continue;
                    if (data[field.name] === undefined) {
                        data[field.name] = field.value;
                    } else if (Array.isArray(data[field.name])) {
                        data[field.name].push(field.value);
                    } else {
                        data[field.name] = [data[field.name], field.value];
                    }
                } else if (field.tagName === 'SELECT' && field.multiple) {
                    var sel = [];
                    for (var j = 0; j < field.options.length; j++) {
                        if (field.options[j].selected) sel.push(field.options[j].value);
                    }
                    data[field.name] = sel;
                } else {
                    data[field.name] = field.value;
                }
            }

            if (Object.keys(data).length === 0) {
                // No persistable fields with data — clear any stale entry
                // rather than write an empty record (avoids restoring "all
                // empty" later and overwriting newly-pre-filled fields).
                removeLS(getKey(form));
                return;
            }

            writeLS(getKey(form), JSON.stringify({ t: Date.now(), d: data }));
        };

        api.restore = function(form) {
            if (!api.enabled) return;
            if (shouldSkipForm(form)) return;

            var key = getKey(form);
            var raw = readLS(key);
            if (!raw) return;

            var entry;
            try { entry = JSON.parse(raw); }
            catch (e) { removeLS(key); return; }

            if (!entry || !entry.t || !entry.d) { removeLS(key); return; }
            if (Date.now() - entry.t > api.ttl) { removeLS(key); return; }

            Object.keys(entry.d).forEach(function(name) {
                var value = entry.d[name];
                // Use attr-selector with CSS.escape to handle names like
                // `Article[content]` that contain brackets.
                var sel = '[name="' + (typeof CSS !== 'undefined' && CSS.escape
                                       ? CSS.escape(name)
                                       : name.replace(/(["\\\[\]])/g, '\\$1')) + '"]';
                var fields = form.querySelectorAll(sel);
                if (fields.length === 0) return;

                for (var k = 0; k < fields.length; k++) {
                    var field = fields[k];
                    if (shouldSkipField(field)) continue;

                    var type = (field.type || '').toLowerCase();
                    if (type === 'checkbox' || type === 'radio') {
                        field.checked = Array.isArray(value)
                            ? (value.indexOf(field.value) !== -1)
                            : (field.value === value);
                    } else if (field.tagName === 'SELECT' && field.multiple) {
                        if (Array.isArray(value)) {
                            for (var m = 0; m < field.options.length; m++) {
                                field.options[m].selected = (value.indexOf(field.options[m].value) !== -1);
                            }
                        }
                    } else {
                        field.value = value;
                        // Editor.js mirrors: Editor.js reads its initial JSON
                        // from the `data-edjs` attribute, not from .value. So
                        // we have to mirror the restored value into the attr
                        // for the upcoming Editor.js init pass to pick it up.
                        if (field.tagName === 'TEXTAREA' && field.hasAttribute('data-edjs')) {
                            field.setAttribute('data-edjs', value);
                        }
                    }
                    field.setAttribute('data-restored-from-draft', '');
                }
            });
        };

        api.clear = function(form) {
            if (!form) return;
            if (shouldSkipForm(form)) return;
            removeLS(getKey(form));
        };

        api.restoreAll = function() {
            var forms = document.querySelectorAll('form');
            for (var i = 0; i < forms.length; i++) api.restore(forms[i]);
        };

        api.saveAll = function() {
            var forms = document.querySelectorAll('form');
            for (var i = 0; i < forms.length; i++) api.save(forms[i]);
        };

        api.clearExpired = function() {
            var ttl = api.ttl;
            var now = Date.now();
            try {
                for (var i = localStorage.length - 1; i >= 0; i--) {
                    var key = localStorage.key(i);
                    if (!key || key.indexOf(KEY_PREFIX) !== 0) continue;
                    var raw;
                    try { raw = localStorage.getItem(key); }
                    catch (e) { continue; }
                    var entry = null;
                    try { entry = JSON.parse(raw); } catch (e) {}
                    if (!entry || !entry.t || (now - entry.t > ttl)) {
                        removeLS(key);
                    }
                }
            } catch (e) {}
        };

        // Debounced per-form save scheduler. WeakMap → no leak when forms
        // get removed from the DOM (e.g., on SPA swap).
        function debouncedSave(form) {
            if (!form || shouldSkipForm(form)) return;
            var existing = saveTimers.get(form);
            if (existing) clearTimeout(existing);
            saveTimers.set(form, setTimeout(function() {
                api.save(form);
            }, api.debounce));
        }

        // Event wiring. Capture phase + isTrusted gate matches the
        // formDirty pattern above — programmatic field mutations from
        // Select2/Editor.js init code don't trigger a save here, which is
        // correct (those are not "user changes"; saving them would persist
        // server-rendered defaults as if they were user input).
        document.addEventListener('input', function(e) {
            if (!e.isTrusted) return;
            if (!e.target || !e.target.form) return;
            debouncedSave(e.target.form);
        }, true);
        document.addEventListener('change', function(e) {
            if (!e.isTrusted) return;
            if (!e.target || !e.target.form) return;
            debouncedSave(e.target.form);
        }, true);

        // Successful submit clears the draft. We listen in capture so we
        // run before any user-side submit handler that might cancel.
        document.addEventListener('submit', function(e) {
            if (e.target && e.target.tagName === 'FORM') {
                api.clear(e.target);
            }
        }, true);

        // Last-resort save on page exit. Catches state mutated only by JS
        // (Editor.js content syncs, Select2 hidden-field writes) that
        // never fired trusted input/change events. Synchronous because
        // beforeunload doesn't await microtasks.
        window.addEventListener('beforeunload', function() {
            if (!api.enabled) return;
            // Only save if the user has actually typed something — same
            // gate as the unload-confirm prompt above. If formDirty is
            // false, drafts written from the debounced handler are stale
            // and we don't want to refresh them on every page-close.
            if (formDirty) api.saveAll();
        });

        // Initial restore. If we're already past DOMContentLoaded (defer
        // scripts run after parsing but before DCL), run synchronously.
        // For SPA navs, transparent.js re-dispatches DOMContentLoaded in
        // _doSwap (around line 1375), so this same listener fires again
        // on every swap — no extra wiring needed.
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', api.restoreAll);
        } else {
            api.restoreAll();
        }
        document.addEventListener('DOMContentLoaded', api.restoreAll);

        // Cleanup expired entries — once at startup, deferred so it
        // doesn't block first paint.
        setTimeout(api.clearExpired, 2000);

        return api;
    })();

    // `location.origin` is the literal string "null" inside a `srcdoc`
    // iframe (location.href there is "about:srcdoc", an opaque-origin
    // marker) - EVEN THOUGH the document is otherwise fully same-origin
    // with its parent (script access, cookies, XHR/fetch CORS all work
    // normally; this is purely a quirk of how srcdoc documents report
    // their own location). Any same-origin check built on a plain
    // `x.origin != location.origin` comparison is always true inside such
    // a frame, no matter what x is - which silently broke the "is this a
    // safe link to AJAX-fetch" guard in __main__: every same-origin link
    // failed the check and fell through to a real, hard browser
    // navigation instead of the AJAX swap. `Transparent.nest` mounts its
    // overlay content via exactly this kind of iframe, so this bug fired
    // on every single in-admin click. Falls back to the parent's origin
    // when we're in this opaque-origin state and same-origin access to it
    // is available (it always is for a non-sandboxed srcdoc iframe, which
    // is the only kind this library ever creates) - otherwise behaves
    // exactly like plain `location.origin`.
    function currentOrigin() {
        if (location.origin !== 'null') return location.origin;
        try { return parent.location.origin; } catch (e) { return location.origin; }
    }

    // Same opaque-srcdoc problem as currentOrigin(), for pathname/search
    // instead of origin - and NOT fixable the same way (parent.location is
    // the HOST page's own URL, e.g. the public site's "/", not the nested
    // admin page's real path; Transparent.nest deliberately never commits
    // the address bar to it - see fetchNested's own comment). document.
    // baseURI is the right source instead: it's exactly "what URL does
    // this document consider itself to be at", and defaults to location.
    // href when no <base> tag is present - so this is a no-op everywhere
    // except inside a nest iframe, where mount() injects a <base href>
    // pointing at the page's real URL specifically so this resolves
    // correctly. Without this, "is this link just a same-page #hash
    // scroll" (__main__) always compared the real resolved pathname
    // against the opaque "srcdoc" and never matched - falling through to
    // a real fetch-and-remount of the SAME page on every single click.
    function currentPathname() { return new URL(document.baseURI).pathname; }
    function currentSearch() { return new URL(document.baseURI).search; }

    // Shared by Settings.exceptions (__main__) and Settings.nest
    // (Transparent.nest) - both are lists of RegExp objects or wildcard
    // strings ('*' matches any sequence, everything else literal), tested
    // against a URL's origin-relative pathname only (no query/hash).
    function matchesPatternList(pathname, patterns) {
        for (let i = 0; i < patterns.length; i++) {
            let pattern = patterns[i];
            if (pattern instanceof RegExp) {
                if (pattern.test(pathname)) return true;
            } else {
                let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                if (new RegExp('^' + escaped + '$').test(pathname)) return true;
            }
        }
        return false;
    }

    function __main__(e) {

        // Disable transparent JS (e.g. during development..)
        if(Settings.disable) return;

        // Respect a preventDefault() already issued by other code (inline
        // onclick handlers returning false, other listeners, ...). Without
        // this, a click whose default action was already handled elsewhere
        // still fell through into findLink()+the full navigation pipeline -
        // e.g. the admin overlay's close button (onclick returns false to
        // call Transparent.closeNest()) was ALSO being treated as a click on
        // its href="/" fallback link by the SAME transparentJS instance
        // running inside the iframe, firing a redundant/conflicting
        // in-iframe navigation to "/" right as the overlay was closing.
        // Transparent.nest's own click listener already had this guard;
        // __main__ (the general page-swap handler) didn't.
        if (e.defaultPrevented) return;

        // Nested-overlay navigation owns its events (see Transparent.nest):
        // while an overlay is open (or the state targets one), the host page
        // underneath must not be swapped
        if (Transparent.nest && Transparent.nest.owns(e)) return;

        // Determine link
        const link = Transparent.findLink(e);
        if (link == null) {

            // findLink() returning null means "this click is not a navigation".
            // preventDefault()ing it anyway suppressed the DEFAULT ACTION of
            // every non-link interactive element on the page - and for anything
            // whose default action IS its behaviour, that is the behaviour gone.
            //
            // Buttons are the sharpest case: a <button> inside a form submits by
            // default, but findLink() only recognises one when it carries an
            // explicit type="submit" ATTRIBUTE. Markup that relies on the HTML
            // default (very common) is therefore unrecognised here, and the
            // click was swallowed - no request, no submit event, no error. This
            // was confirmed live in a consuming admin, where every datagrid row
            // delete button was dead, along with the confirmation dialog that
            // listens for the submit event those buttons never fired.
            //
            // The others in the list have the same problem: <summary>/<details>
            // never toggled, checkboxes and radios never ticked, <select> never
            // opened. For all of these transparentJS has nothing to do in the
            // first place - there is no link to follow - so the default must be
            // left alone.
            const t = e.target;
            if (t && t.closest && t.closest('summary, details, input, select, textarea, option, label, [contenteditable], button')) return;

            e.preventDefault();
            return;
        }

        dispatchEvent(new CustomEvent('transparent:link', {link:link}));

        const uuid   = uuidv4();
        const type   = link[0];
        const url    = link[1];

        var target = Transparent.isElement(link[2]) ? link[2] : undefined;
        var data   = Transparent.isElement(link[2]) ? undefined : link[2];

        // Wait for transparent window event to be triggered
        if (!isReady) return;

        // checkCacheVersion() otherwise only runs once, from ready()'s
        // first-run branch - fine for a fresh page load, but a tab that
        // stays open and navigates ONLY through this SPA layer (never a
        // real reload) would keep isReady true for its whole life and
        // never notice a deploy changed cache_version. Re-checking here
        // (every real navigation funnels through __main__) closes that
        // gap for free: it's two sessionStorage reads that return
        // immediately in the normal (no mismatch) case, and only pays the
        // purge cost once, right after a real deploy.
        checkCacheVersion();

        if (e.type != Transparent.state.POPSTATE   &&
            e.type != Transparent.state.HASHCHANGE && !$(this).find(Settings.identifier).length) return;

        var form   = target != undefined && target.tagName == "FORM" ? target : undefined;
        var formTrigger = undefined;
        formSubmission = false;

        if (form) {

            data = new FormData();
            var formAmbiguity = $("form[name='"+form.name+"']").length > 1;
            
            var formInput = undefined; // In case of form ambiguity (two form with same name, restrict the data to the target form, if not extends it to each element with standard name)
            if(formAmbiguity) formInput = $(form).find(":input, [name^='"+form.name+"\[']");
            else formInput = $("form[name='"+form.name+"'] :input, [name^='"+form.name+"\[']");

            formInput.each(function() {

                if(this.tagName == "BUTTON") {

                    if(this == e.target) data.append(this.name, this.value);

                } else if(this.type == "file") {

                    for(var i = 0; i < this.files.length; i++)
                        data.append(this.name, this.files[i]);

                } else data.append(this.name, this.value);
            });

            // Force page reload
            formSubmission = true; // mark as form submission
            formTrigger = e.target;
            if ($(e.target).hasClass(Transparent.state.RELOAD)) return;
            if ($(form).hasClass(Transparent.state.RELOAD)) return;

            if(e.type == "submit") // NB: This doesn't work if a button is generated afterward.. 
                $(form).find(':submit').attr('disabled', 'disabled');
        }

        // Specific page exception
        if (matchesPatternList(url.pathname, Settings.exceptions)) return;

        // Ressources files rejected
        if (url.pathname.startsWith("/css")) return;
        if (url.pathname.startsWith("/js")) return;
        if (url.pathname.startsWith("/images")) return;
        if (url.pathname.startsWith("/vendor")) return;

        // Unsecure url
        if (url.origin != currentOrigin()) return;

        // Inside a nest iframe (Transparent.nest's overlay), a link whose
        // target falls OUTSIDE the nest's own configured scope
        // (Settings.nest, e.g. "/admin*") isn't a page the nest should ever
        // render itself - it's the user leaving the nested app back toward
        // the host site. Close the overlay and let the HOST page navigate
        // there for real, instead of AJAX-swapping the iframe's own content
        // to something it was never scoped for (previously: a link back to
        // "/" rendered the public homepage INSIDE the admin overlay).
        if (location.origin === 'null' && Settings.nest && Settings.nest.length && !matchesPatternList(url.pathname, Settings.nest)) {
            e.preventDefault();
            try {
                if (parent.Transparent && parent.Transparent.nest) {
                    parent.Transparent.nest.close(false);
                    parent.window.location.href = url.href;
                } else {
                    window.top.location.href = url.href;
                }
            } catch (err) {
                window.top.location.href = url.href;
            }
            return;
        }

        // A modifier key (new-tab/new-window intent) or an explicit
        // target="_blank" means the user wants the browser's own handling,
        // not the SPA swap - bail out BEFORE preventDefault() so native
        // behaviour (new tab, new window, background tab, ...) fires
        // exactly as the browser/OS decides for that modifier combination,
        // instead of this code re-implementing a handful of combinations
        // by hand via window.open() further below - which used to cover
        // Cmd+Click but never Ctrl+Click or a plain Shift+Click, so those
        // silently fell through into an in-place SPA navigation instead of
        // opening a new tab. A real form submission has no "open in new
        // tab" convention, so this only applies to a plain link click.
        if (!form && e.type == Transparent.state.CLICK &&
            (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || $(target).attr("target") == "_blank")) {
            return;
        }

        e.preventDefault();

        if (url == location) return;

        if((e.type == Transparent.state.CLICK || e.type == Transparent.state.HASHCHANGE) && url.pathname == currentPathname() && url.search == currentSearch() && type != "POST") {

            if(!url.hash) return;
            Transparent.scrollToHash(url.hash ?? "", {easing:Settings["smoothscroll_easing"], duration:Settings["smoothscroll_duration"], speed:Settings["smoothscroll_speed"]}, function() {

                if (e.target != undefined && $(e.target).data("skip-hash") != true)
                    window.location.hash = url.hash;

            }, $(e.target).closestScrollable());

            return;
        }

        // right (still limited by browser policy):
        dispatchEvent(new Event('transparent:beforeunload'));
        dispatchEvent(new Event('beforeunload', { cancelable: true }));

        $(Transparent.html).prop("user-scroll", true);
        $(Transparent.html).stop();

        Transparent.html.addClass(Transparent.state.LOADING);
        Transparent.activeIn();

        function isJsonResponse(str) {
            try { JSON.parse(str); return true; }
            catch (e) { return false; }
        }

        function handleResponse(uuid, status = 200, method = null, data = null, xhr = null, request = null) {

            // A newer navigation has since started and superseded this one
            // (see the abort() call below). This response is stale -
            // discard it instead of overwriting what the user's more
            // recent click already requested. This was the reported bug:
            // clicking a second link before the first request resolved
            // showed the FIRST (slower) link's content, because nothing
            // here checked whether a response still matched the latest
            // navigation before applying it.
            if (uuid !== currentNavUuid) return;
            if (currentXhr === xhr) currentXhr = null;

            var responseURL;
            responseURL = xhr !== null ? xhr.responseURL : url.href;

            responseText  = Transparent.getResponseText(uuid);

            var fragmentPos = responseURL.indexOf("#");
            var strippedResponseUrl = (fragmentPos < 0 ? responseURL : responseURL.substring(0, fragmentPos)).trimEnd("/");

            var fragmentPos = url.href.indexOf("#");
            var strippedUrlHref = (fragmentPos < 0 ? url.href : url.href.substring(0, fragmentPos)).trimEnd("/");
            if( strippedUrlHref == strippedResponseUrl )
                responseURL = url.href; // NB: xhr.responseURL strips away #fragments

            if(!responseText) {

                if(!request && responseText === null) {

                    setTimeout(function() { window.location.href = responseURL; }, Settings["throttle"]);
                    return;
                }

                responseText = request.responseText;
                if(status >= 500) {

                    console.error("Unexpected XHR response from "+uuid+": error code "+request.status);
                    console.error(sessionStorage);
                }

                if(!Transparent.hasResponse(uuid))
                    Transparent.setResponse(uuid, responseText);
            }

            // Try the in-memory live-DOM cache first. On popstate (back/forward)
            // we just stored the outgoing page node via setLiveResponse, so the
            // round-trip is: snapshot → cache → instant retrieve. No serialize,
            // no DOMParser cost. Falls back to the parse path on miss (first-
            // time nav, cache eviction, expired entry, etc.).
            var dom = null;
            if (Transparent.getLiveResponse) {
                var liveNode = Transparent.getLiveResponse(uuid);
                if (liveNode) {
                    // The cache stores the full <html> element. Wrap it in a
                    // minimal Document-shaped object that the swap path can
                    // navigate the same way it navigates a DOMParser result.
                    var docShell = document.implementation.createHTMLDocument('');
                    docShell.replaceChild(liveNode, docShell.documentElement);
                    dom = docShell;
                }
            }
            if (!dom) {
                dom = new DOMParser().parseFromString(responseText, "text/html");
            }
            if(request && request.getResponseHeader("Content-Type") == "application/json") {

                if(!isJsonResponse(responseText)) {
                    console.error("Invalid response received for "+ responseURL);
                    if(Settings.debug) return Transparent.rescue(dom);
                }

                if(form) {
                    
                    $(form).find(':submit').removeAttr('disabled');
                    form.reset();
                }

                var response = JSON.parse(responseText);
                if(Settings.debug) console.debug(response);

                if(response.code == "302") {

                    if(response.target) location.href = response.target;
                    else location.reload();
                }

                return dispatchEvent(new Event('load'));
            }

            // Invalid html page returned
            if(request && request.getResponseHeader("Content-Type") == "text/html") {

                if (!responseText.includes("<html") && !responseText.includes("<body") && !responseText.includes("<head"))
                    return Transparent.rescue(dom);
            }

            if(status == 302) {

                if(responseURL) location.href = responseURL;
                else location.reload();

            } else if(status != 200) {

                // Blatant error received..
                return Transparent.rescue(dom);
            }

            // From here the page is valid..
            // so the new page is added to history..
            //
            // Guarded: inside a `srcdoc` iframe (exactly how Transparent.nest
            // mounts overlay content) the document's actual URL is the opaque
            // "about:srcdoc" - the browser unconditionally refuses ANY
            // pushState() whose target is a real http(s) URL from that
            // context, no matter how well-formed, throwing synchronously.
            // Left unguarded (this is a DIFFERENT call site than the one
            // fixed for the initial-load case), that uncaught exception
            // aborted every remaining statement in this response handler -
            // including the code just below that swaps the DOM in and clears
            // the .loading state - so every in-admin navigation fetched
            // successfully, then silently got stuck forever: spinner/progress
            // bar frozen on screen, old content never replaced. A srcdoc
            // iframe has no user-visible address bar of its own anyway, so
            // simply not tracking history for it is both safe and correct -
            // the host's own URL (tracking the overlay's open state) is what
            // actually matters for bookmarking.
            if(xhr) {
                try {
                    history.pushState({uuid: uuid, status:status, method: method, data: {}, href: responseURL}, '', responseURL);
                } catch (e) {
                    if (Settings.debug) console.error('Transparent: pushState failed (likely a srcdoc iframe) - continuing without it', e);
                }

                // The srcdoc iframe's own history (immediately above) is a
                // dead end either way - it has no visible address bar of its
                // own to drive Back/Forward through even on engines where
                // the pushState() doesn't outright throw. Redirect internal
                // nest-scope navigation onto the HOST's real, addressable
                // history instead: each admin page visited while the
                // overlay is open gets its own entry there. The host-side
                // popstate listener (Transparent.nest) re-fetches and
                // re-mounts the matching href when Back/Forward lands on
                // one of these - see its own comment for why a fresh fetch
                // rather than a cheaper client-side restore.
                if (location.origin === 'null') {
                    try {
                        var stillWithinNestScope = !Settings.nest || !Settings.nest.length || matchesPatternList(new URL(responseURL).pathname, Settings.nest);
                        if (parent.Transparent && parent.Transparent.nest && parent.Transparent.nest.isOpen() && stillWithinNestScope) {
                            parent.history.pushState({ nest: { href: responseURL } }, '', parent.location.href);
                        }
                    } catch (err) {
                        if (Settings.debug) console.error('Transparent: parent.history.pushState failed from inside nest', err);
                    }
                }
            }

            // Page not recognized.. just go fetch by yourself.. no POST information transmitted..
            if(!Transparent.isPage(dom))
                return window.location.href = url;

            // Layout not compatible.. needs to be reloaded (exception when POST is detected..)
            if(!Transparent.isCompatiblePage(dom, method, data))
                return window.location.href = url;

            // Mark layout as known
            if(!Transparent.isKnownLayout(dom)) {

                Transparent.html.addClass(Transparent.state.NEW);
                dispatchEvent(new Event('transparent:'+Transparent.state.NEW));
            }

            // Mark active as popstate or submit
            if(e.type == Transparent.state.POPSTATE) {

                Transparent.html.addClass(Transparent.state.POPSTATE);
                dispatchEvent(new Event('transparent:'+Transparent.state.POPSTATE));

            } else if(e.type == Transparent.state.SUBMIT) {

                Transparent.html.addClass(Transparent.state.SUBMIT);
                dispatchEvent(new Event('transparent:'+Transparent.state.SUBMIT));
            }

            // Callback active
            var prevLayout = Transparent.getLayout();
            var newLayout = Transparent.getLayout(dom);
            if(prevLayout == newLayout)
                Transparent.html.addClass(Transparent.state.SAME);

            var switchLayout = Transparent.state.SWITCH.replace("X", prevLayout).replace("Y", newLayout);
            Transparent.html.addClass(switchLayout);

            dispatchEvent(new Event('transparent:'+switchLayout));

            if($(dom).find("html").hasClass(Transparent.state.RELOAD) || $(dom).find("html").hasClass(Transparent.state.DISABLE))
                return window.location.reload();

            var swap = function() {

                return Transparent.onLoad(uuid, dom, function() {

                    Transparent.activeOut(function() {

                        Transparent.html
                            .removeClass(switchLayout)
                            .removeClass(Transparent.state.SUBMIT)
                            .removeClass(Transparent.state.POPSTATE)
                            .removeClass(Transparent.state.EXITING)
                            .removeClass(Transparent.state.NEW);
                    });

                }, type != "POST");
            };

            // Give the outgoing page a window to animate away in, if the host
            // asked for one. This is the only place such a window can exist:
            // before this point we are waiting on the server with no idea when
            // the response lands, and after it the swap is one long blocking
            // task in which a newly-started transition never gets a style
            // commit. Measured: a transition begun against the swap had ~1ms
            // of free time in a 412ms window.
            //
            // `exiting` is dropped in the activeOut callback above, not here,
            // so it hands over to `active-out` without a frame in between
            // where neither is set - that gap would flash the swapped-in page
            // before its own entrance.
            var exitMs = parseInt(Settings["exit_duration"], 10) || 0;
            if (exitMs > 0) {

                Transparent.html.addClass(Transparent.state.EXITING);

                // Force the style change to be committed NOW. Adding a class
                // only schedules a recalc, and the browser is free to defer it
                // - which it does, because this moment is busy: measured 70ms
                // of a 120ms window elapsing before the transition produced
                // any movement at all, leaving ~50ms of visible slide that
                // was then cut off at 75% of its travel. Reported, fairly, as
                // the menu not sliding out.
                //
                // Reading a layout property flushes pending style and starts
                // the transition in this frame, so the window that follows is
                // animation time rather than mostly waiting. It costs one
                // forced layout on a document that is about to be replaced
                // anyway.
                void Transparent.html[0].offsetHeight;

                dispatchEvent(new Event('transparent:' + Transparent.state.EXITING));

                setTimeout(swap, exitMs);
                return;
            }

            return swap();
        }

        if(history.state && !Transparent.hasResponse(history.state.uuid))
            Transparent.setResponse(history.state.uuid, Transparent.html[0], Transparent.getScrollableElementXY());

        // This append on user click (e.g. when user push a link)
        // It is null when dev is pushing or replacing state
        var addNewState = !e.state;
        if (addNewState) {

            if(history.state)
                Transparent.setResponse(history.state.uuid, Transparent.html[0], Transparent.getScrollableElementXY());

            $(Transparent.html).prop("user-scroll", false); // make sure to avoid page jump during transition (cancelled in activeIn callback)

            // Submit ajax request..
            if(form) form.dispatchEvent(new SubmitEvent("submit", { submitter: formTrigger }));

            // A navigation already in flight is now stale - the user's
            // most recent click always wins. Abort it (best-effort; a
            // request already past its final byte can't be un-sent, but
            // its response is still discarded in handleResponse via the
            // uuid check) rather than silently dropping THIS click the way
            // the old semaphore guard did, which let whichever request
            // happened to be in flight first win over the user's actual,
            // more recent intent.
            //
            // currentNavUuid/currentXhr are reassigned to THIS navigation
            // BEFORE the old one is aborted, not after - jQuery's error
            // callback for an aborted XHR can fire synchronously, inside
            // this very abort() call, and handleResponse's staleness
            // check compares against currentNavUuid at the moment IT
            // runs. Aborting first left currentNavUuid still pointing at
            // the OLD navigation during that synchronous callback, so the
            // guard passed it through as if it were still current -
            // confirmed live: the aborted request's error response was
            // reaching Transparent.rescue() instead of being discarded.
            // Already fetched on hover (or on an earlier visit)? Feed it
            // through the same path popstate uses - park the HTML under this
            // navigation's uuid and call handleResponse with no xhr - so the
            // click costs a swap and nothing else. GET only: a POST is a
            // write and must never be answered from a cache.
            if (type !== "POST") {

                var prefetched = Transparent.getPrefetched(url.href);
                if (prefetched) {

                    currentNavUuid = uuid;
                    Transparent.setResponseText(uuid, prefetched);

                    // Passing a stand-in rather than null for `xhr`, and the
                    // reason is load-bearing: handleResponse gates
                    // history.pushState on `if (xhr)`. That is right for the
                    // popstate path it was written for - the browser has
                    // already moved history, so pushing again would corrupt
                    // it - but this is a FORWARD navigation that still has to
                    // push. With null the swap ran and the URL never changed,
                    // so the click appeared to do nothing at all.
                    //
                    // responseURL is the only property read off it (twice),
                    // so a one-field stand-in is the whole contract.
                    return handleResponse(uuid, 200, type, data, { responseURL: url.href });
                }
            }

            var previousXhr = currentXhr;

            var xhr = new XMLHttpRequest();
            currentXhr = xhr;
            currentNavUuid = uuid;

            if (previousXhr) {
                try { previousXhr.abort(); } catch (err) {}
            }

            return jQuery.ajax({
                url: url.href,
                type: type,
                data: data,
                contentType: false,
                processData: false,
                headers: Settings["headers"] || {},
                xhr: function () { return xhr; },
                success: function (html, status, request) { return handleResponse(uuid, request.status, type, data, xhr, request); },
                error:   function (request, ajaxOptions, thrownError) { return handleResponse(uuid, request.status, type, data, xhr, request); }
            });
        }

        // This branch replays an already-cached response (e.g. popstate
        // Back/Forward) synchronously, with no network round-trip - so
        // there's no actual staleness race here, but handleResponse's
        // uuid check would still spuriously discard this if
        // currentNavUuid weren't also updated for this path.
        currentNavUuid = history.state.uuid;
        return handleResponse(history.state.uuid, history.state.status, history.state.method, history.state.data);
    }

    // Update history if not refreshing page or different page (avoid double pushState)
    //
    // Guarded: inside a `srcdoc` iframe (used by Transparent.nest to mount
    // the overlay's content) the document's actual URL is "about:srcdoc",
    // and Chrome refuses a replaceState() whose target URL doesn't resolve
    // against that - it throws synchronously. Left unguarded, that
    // uncaught exception aborted every remaining top-level statement in
    // this module, including the __main__ click/popstate/submit listener
    // registrations and the entire Transparent.nest definition further
    // down - so transparentJS silently never wired up ANY interactivity
    // inside the admin overlay; every click there fell through to a real
    // full-page reload of the iframe instead of an SPA swap.
    try {
        var href = history.state ? history.state.href : null;
        if (href != location.origin + location.pathname + location.hash)
            history.replaceState({uuid: uuidv4(), status: history.state ? history.state.status : 200, data:{}, method: history.state ? history.state.method : "GET", href: location.origin + location.pathname + location.hash}, '', location.origin + location.pathname + location.hash);
    } catch (e) {
        if (Settings.debug) console.error('Transparent: initial replaceState failed (likely a srcdoc iframe) - continuing without it', e);
    }

    if($("html").hasClass(Transparent.state.DISABLE))
        Settings.disable = true;

    // Overload onpopstate
    if(Settings.disable) {

        if(Settings.debug) console.debug("Transparent is disabled..");

        var states    = Object.values(Transparent.state);
        var htmlClass = Array.from(($("html").attr("class") || "").split(" ")).filter(x => !states.includes(x));
        Transparent.html.removeClass(states).addClass(htmlClass.join(" ")+" "+Transparent.state.ROOT+" "+Transparent.state.READY+" "+Transparent.state.DISABLE);

    } else {

        if(Settings.debug) console.debug("Transparent is running..");

        window.onpopstate   = __main__; // Onpopstate pop out straight to previous page.. this creates a jump while changing pages with hash..
        window.onhashchange = __main__;

        // onbeforeunload confirmation REMOVED. It produced spurious "are you
        // sure you want to leave?" blocks on any page with a form even when the
        // user never typed: the dirty flag was flipped by any trusted change
        // event (a <select>/checkbox toggle, Select2/datepicker init firing a
        // real change, browser autofill, …), and the `e.currentTarget == window`
        // guard below is unreliable across browsers. More importantly it's now
        // obsolete: Transparent.formMemory persists every form's content to
        // localStorage (debounced on input + saved synchronously on unload) and
        // restores it on the next load, so reloading or closing the tab never
        // loses typed input. The draft save on beforeunload (in the formMemory
        // IIFE above) is kept; only the blocking confirmation is gone.
        var __onbeforeunload_disabled = function(e) {
            if(Settings.debug) console.log("Transparent onbeforeunload (no-op; drafts auto-saved)");
            if(formSubmission) return;
            if(Settings.disable) return;
            // No return value → browser never shows the leave/reload confirmation.
        };

        // Legacy snapshot-and-compare confirm (formDataBefore vs formDataAfter)
        // gave
        // false positives because JS init code mutates form values after
        // load — Select2 writes selected text to hidden fields, Editor.js
        // serializes its JSON to a <textarea>, datepicker normalizes
        // formats, etc. — so by the time the user hit Ctrl+W the snapshot
        // and the current state always differed, and the browser always
        // prompted even on read-only pages.
        //
        // false positives because JS init code mutated form values after load.
        // Both that and the formDirty replacement are gone: the content is
        // already in localStorage (saved on input + on unload), so leaving the
        // page never loses it and a confirmation only gets in the way.
        window.onbeforeunload = __onbeforeunload_disabled;

        document.addEventListener('click', __main__, false);

        $("form").on("submit", __main__);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Nested navigation ("website within website").
    //
    // Purely config-driven, no HTML markup on links: any plain <a href>
    // whose pathname matches a `Settings.nest` pattern (same RegExp-or-
    // wildcard-string list syntax as `Settings.exceptions`, configured once
    // via Transparent.ready({nest: [...]})) is a nest trigger. The TARGET
    // page still opts in by answering with an `X-Transparent-Nest` response
    // header - only when BOTH agree is the page fetched and mounted into a
    // fixed overlay container ABOVE the still-live host DOM (nothing is
    // detached: closing is instant, no re-fetch). The address bar stays on
    // the HOST page's URL the whole time (a same-URL modal history entry
    // keeps Back working as "close the overlay"); the chrome's share
    // button is the explicit gesture that commits to the nested page's own
    // URL as a full, real navigation.
    // (The old per-link data-transparent-nest attribute is GONE as of 3.0 -
    // transparentJS's whole point is promoting a multi-page site to feel
    // single-page transparently, without touching how links are authored.)
    //
    // Every other case falls through to a regular <a href> navigation:
    // transparent disabled, header missing, fetch failure, direct visit.
    // Forms inside the overlay deliberately submit natively (full page):
    // the nested app keeps working, just not overlaid anymore.
    // ─────────────────────────────────────────────────────────────────────
    Transparent.nest = (function() {

        var api = {};

        var HEADER = 'X-Transparent-Nest';
        var CONTAINER_ID = 'transparent-nest';
        var HTML_CLASS = 'nested';

        var hostTitle = null;      // host document title backup
        var hostOverflow = null;   // body overflow backup
        var closing = false;       // reentrance guard (closeNest vs popstate)
        // The one closed-but-still-mounted session, if any - see closeShell
        // and resume() at the bottom of this module.
        var parked = null;

        api.isOpen = function() {
            var el = document.getElementById(CONTAINER_ID);
            // a container mid-close-fade doesn't count as "open" - a fast
            // re-open must be treated as fresh, not folded into the dying
            // one - and neither does a parked one: it IS closed, it just
            // still exists (hidden) so its nested page keeps its state.
            return el != null
                && !el.classList.contains('is-closing')
                && !el.classList.contains('is-parked');
        };

        // Deliberately blind to a parked container, so that everything
        // reaching for "the overlay" (esc, retry, mount, close) treats a
        // parked session as gone. resume() below is the only way back to
        // it, through the `parked` reference.
        api.getContainer = function() {
            var el = document.getElementById(CONTAINER_ID);
            return el != null && !el.classList.contains('is-parked') ? el : null;
        };

        // __main__ consults this before acting: popstate traffic related to
        // an overlay belongs to the nest module, never to the page swapper
        api.owns = function(e) {
            if (e.type != 'popstate') return false;
            return closing || api.isOpen() || (e.state && e.state.nest) != null;
        };

        // The nested page renders inside a same-origin IFRAME: full CSS/JS
        // isolation in both directions (the host's observers and global
        // styles never touch the nested app and vice versa), its scripts
        // run naturally, and closing is instant. srcdoc reuses the already
        // fetched HTML - no second request; same-origin, so the nested page
        // may reach window.parent.Transparent to close itself.
        // Creates the overlay shell (backdrop + a fixed-size centered panel,
        // its own chrome bar with retry/close buttons, and a spinner) and
        // attaches it to the DOM SYNCHRONOUSLY on click, before the HTML
        // round-trip even starts. Without this, the host page stayed
        // visually static for the whole fetch (only a slim top progress bar
        // hinted anything was happening) and the blur/dim backdrop only
        // appeared once content was ready - on a cold, un-prefetched open
        // this reads as "nothing happens, then suddenly a blurry panel pops
        // in a second later".
        // Close/retry live HERE, in the host document, not in whatever page
        // gets nested - a consumer page never needs to render its own close
        // button (and the stopPropagation() dance that previously required,
        // since a nested page's own click handler would otherwise race the
        // host's) simply no longer exists as a problem.
        function openShell(href) {

            // a fast re-open racing an in-flight close animation wins:
            // drop the dying node rather than leaving two #transparent-nest
            // elements in the document at once. A PARKED session is dropped
            // here too - reaching this point means the caller asked for a
            // page that session isn't on (resume() already declined it), and
            // only one nested document is ever kept alive.
            var stale = document.getElementById(CONTAINER_ID);
            if (stale) stale.remove();
            if (parked) parked = null;

            var container = document.createElement('div');
            container.id = CONTAINER_ID;
            // known from the very first tick (reveal() later refines it to
            // the response URL) so share/esc/backdrop event details and the
            // share navigation always have something meaningful to use
            container._currentHref = href;
            // the page this session was opened WITH, kept alongside the one
            // it has since navigated to - resume() accepts either
            container._openHref = href;

            // Standard modal convention: clicking the dimmed backdrop
            // (outside the panel) closes the nest. `e.target !== container`
            // is sufficient - the panel fully covers its own subtree, so
            // any click inside it targets a descendant, never the container
            // itself; clicks inside the iframe never reach the host
            // document at all. Deliberately no confirm() here (unlike ESC):
            // a backdrop click is a deliberate outside-dismiss gesture.
            container.addEventListener('click', function(e) {
                if (e.target !== container) return;
                dispatchEvent(new CustomEvent('transparent:nest:backdrop', { detail: { href: container._currentHref } }));
                api.close();
            });

            var panel = document.createElement('div');
            panel.className = 'transparent-nest-panel';
            // role/aria-modal live on the panel (the actual dialog surface),
            // not the backdrop - the backdrop is just a scrim
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'true');
            container.appendChild(panel);

            var chromeBar = document.createElement('div');
            chromeBar.className = 'transparent-nest-chrome';
            panel.appendChild(chromeBar);

            // Small loading indicator next to the chrome buttons: visible
            // during nest-level loads (.is-loading) AND while the nested
            // page's OWN transparentJS instance is mid-navigation
            // (.is-busy, mirrored from the iframe's html.loading class by
            // the observer wired in mount()) - the host-side replacement
            // for the old in-admin .admin-nav-spinner.
            var busySpinner = document.createElement('span');
            busySpinner.className = 'transparent-nest-busy';
            busySpinner.setAttribute('aria-hidden', 'true');
            chromeBar.appendChild(busySpinner);

            // resets the panel to its pristine centered default geometry -
            // shared by the dock/restore/share state switches so freed
            // (moved/resized) inline px never leaks between modes
            function resetGeometry() {
                panel.classList.remove('is-free');
                panel.style.left = panel.style.top = panel.style.width = panel.style.height = '';
                updateChromePlacement();
            }

            // Re-parents the WHOLE panel (chrome + body, so close/dock-
            // toggle/etc keep working from wherever it ends up) into a
            // designated host-page element (Settings.nest_dock_target, a
            // CSS selector) instead of floating it at a viewport edge -
            // "dockerize on demand": that element's own original content is
            // stashed (removed, not destroyed) and put back by
            // undockFromContainer(). No-op (returns false) if the setting
            // isn't configured or the target isn't found in the DOM -
            // callers fall back to the normal floating dock in that case.
            function containerDock() {
                if (container._dockedTarget) return true;
                var sel = Settings["nest_dock_target"];
                if (!sel) return false;
                var target = document.querySelector(sel);
                if (!target) return false;
                container._dockStash = Array.prototype.slice.call(target.childNodes);
                container._dockStash.forEach(function(n) { target.removeChild(n); });
                resetGeometry();
                target.appendChild(panel);
                container._dockedTarget = target;
                container.classList.add('is-docked', 'is-container-docked');
                Transparent.html.addClass('nest-docked');
                document.body.style.overflow = hostOverflow || '';
                dispatchEvent(new CustomEvent('transparent:nest:dock', { detail: { href: container._currentHref, edge: null, target: sel } }));
                return true;
            }

            // Reverses containerDock(): moves the panel back under the
            // normal overlay shell and restores the host container's
            // original children exactly as found. Safe to call whenever -
            // no-op if never container-docked. Called by clearDock() (so
            // restore/double-click/dock-toggle-off all clean it up the same
            // way) AND wired onto the container itself (see below) so
            // closeShell() can guarantee reintegration even when the nest
            // closes outright instead of merely undocking.
            function undockFromContainer() {
                if (!container._dockedTarget) return;
                var target = container._dockedTarget;
                target.removeChild(panel);
                container.appendChild(panel);
                (container._dockStash || []).forEach(function(n) { target.appendChild(n); });
                container._dockedTarget = null;
                container._dockStash = null;
                container.classList.remove('is-container-docked');
            }
            container._teardownDock = function() { undockFromContainer(); };

            // Lightweight "docked" entry with no viewport edge attached -
            // just removes the modal backdrop/blocking so the host page is
            // interactive again, wherever the panel happens to be sitting.
            // applyDock(edge) below is the fuller version of this (also
            // stretches the panel to fill that edge) - this is what a plain
            // move/resize that DOESN'T reach any edge falls back to, per
            // "if it's not in its default position we should go into
            // docking mode".
            function enterPassthrough() {
                if (Settings["nest_dock"] === false) return; // forbids docking entirely, including this lightweight form
                if (container.classList.contains('is-docked')) return;
                // Snapshot the panel's CURRENT (flex-centered) position/size
                // into explicit inline px BEFORE switching to
                // position:absolute (the .is-docked CSS below) - without
                // this, a dock triggered from the dock button (as opposed
                // to a drag, which already calls toFree() itself) had no
                // left/top to fall back on, and browsers resolve an
                // absolutely-positioned box with no offsets to its "static
                // position" - which collapses to the top-left corner for a
                // removed flex item in practice, not wherever it visually
                // was. toFree() is a no-op if a drag already froze it.
                toFree();
                container.classList.add('is-docked');
                Transparent.html.addClass('nest-docked');
                document.body.style.overflow = hostOverflow || '';
                updateChromePlacement();
                dispatchEvent(new CustomEvent('transparent:nest:dock', { detail: { href: container._currentHref, edge: null } }));
            }

            // Docking's host-page concessions (scroll unlock, scrim removal
            // are pure CSS off .is-docked) plus, if applicable, reversing a
            // container-dock - used by restore, by share-while-docked, and
            // by the dock-toggle button's "undock" branch.
            function clearDock() {
                if (!container.classList.contains('is-docked')) return;
                undockFromContainer();
                container.classList.remove('is-docked', 'is-hidden', 'is-container-docked');
                delete container.dataset.dockEdge;
                Transparent.html.removeClass('nest-docked');
                document.body.style.overflow = 'hidden';
                updateChromePlacement();
            }

            function restoreDefault() {
                clearDock();
                container.classList.remove('is-full');
                resetGeometry();
                dispatchEvent(new CustomEvent('transparent:nest:restore', { detail: { href: container._currentHref } }));
            }

            // A plain click on the grab tab (while genuinely docked flush
            // against a viewport edge - not just "freed" mid-screen, and not
            // container-docked) tucks the panel fully out of view - only
            // the tab itself stays put, the host page reclaims the rest of
            // that edge. Clicking again brings it back. Distinct from
            // double-click (restoreDefault, jumps all the way back to the
            // centered default) and from drag (move/undock) - see the
            // pointerdown handler below for how the three are told apart.
            function toggleHidden() {
                if (!container.dataset.dockEdge) return;
                var hidden = container.classList.toggle('is-hidden');
                dispatchEvent(new CustomEvent('transparent:nest:' + (hidden ? 'hide' : 'show'), { detail: { href: container._currentHref, edge: container.dataset.dockEdge } }));
            }

            // The collapsed docked chrome's only visible control once flush
            // against a viewport edge: a small grab tab on the panel's
            // inner edge (the one bordering the still-visible host page),
            // styled to match the same toolbar it replaces rather than a
            // separate floating pill. Drag it like the normal chrome bar
            // (same pointerdown target, chromeBar itself) to move/undock,
            // click it to tuck the panel away, double-click the bar to
            // restore. While merely "freed" (moved/resized but not pushed
            // against an edge) the full button row stays visible instead -
            // see the [data-dock-edge] gating in index.scss.
            var grabTab = document.createElement('div');
            grabTab.className = 'transparent-nest-grab';
            grabTab.setAttribute('aria-hidden', 'true');
            chromeBar.appendChild(grabTab);

            // Address bar snapshot taken the instant share() commits the
            // nested URL - restored by collapseBtn below so "exit full
            // page" is a true inverse of share, not just a visual undo.
            var preShareHref = null;

            var shareBtn = document.createElement('button');
            shareBtn.type = 'button';
            shareBtn.className = 'transparent-nest-btn transparent-nest-share';
            shareBtn.setAttribute('aria-label', 'Expand to full page');
            shareBtn.setAttribute('title', 'Expand to full page');
            shareBtn.innerHTML = '&#8599;';
            shareBtn.addEventListener('click', function(e) {
                e.preventDefault();
                var target = container._currentHref;
                if (!target) return;
                dispatchEvent(new CustomEvent('transparent:nest:share', { detail: { href: target } }));
                preShareHref = location.href;
                // clear any freed (moved/resized) geometry and docked state
                // so the fullscreen CSS state applies cleanly
                clearDock();
                resetGeometry();
                container.classList.add('is-full');
                // commit the URL. Normally the open pushed a nest-marked
                // same-URL entry - replace it in place. If share is hit
                // while the very first fetch is still in flight (no entry
                // pushed yet), push one now instead - replacing there
                // would destroy the HOST's own entry.
                try {
                    if (history.state && history.state.nest) history.replaceState({ nest: { href: target } }, '', target);
                    else history.pushState({ nest: { href: target } }, '', target);
                } catch (err) {}
            });
            chromeBar.appendChild(shareBtn);

            // Fullscreen (shared) is otherwise a dead end - close was the
            // only way out. This mirrors share exactly: drops back to the
            // default panel AND reverts the address bar to whatever it was
            // right before share committed it (not just "no history.back(),
            // which would exit the nest entirely per the existing Back
            // contract - see drive6 scenario 3).
            var collapseBtn = document.createElement('button');
            collapseBtn.type = 'button';
            collapseBtn.className = 'transparent-nest-btn transparent-nest-collapse';
            collapseBtn.setAttribute('aria-label', 'Exit full page');
            collapseBtn.setAttribute('title', 'Exit full page');
            collapseBtn.innerHTML = '&#8601;';
            collapseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (preShareHref) {
                    try { history.replaceState({ nest: { href: container._currentHref } }, '', preShareHref); } catch (err) {}
                    preShareHref = null;
                }
                restoreDefault();
            });
            chromeBar.appendChild(collapseBtn);

            // Explicit manual trigger for the same non-modal "docked" state
            // a drag/resize away from default now falls into on its own
            // (see enterPassthrough/applyDock and the move/resize handlers
            // below) - lets a user dock without having to drag anywhere
            // first. Prefers Settings.nest_dock_target (re-parent into a
            // host container) when configured, otherwise falls back to the
            // plain floating passthrough. Toggling it back off restores.
            var dockBtn = document.createElement('button');
            dockBtn.type = 'button';
            dockBtn.className = 'transparent-nest-btn transparent-nest-dock-toggle';
            dockBtn.setAttribute('aria-label', 'Dock');
            dockBtn.setAttribute('title', 'Dock (interact with the page behind)');
            dockBtn.innerHTML = '<span class="transparent-nest-dock-icon" aria-hidden="true"></span>';
            dockBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (container.classList.contains('is-docked')) {
                    clearDock();
                    resetGeometry();
                    dispatchEvent(new CustomEvent('transparent:nest:restore', { detail: { href: container._currentHref } }));
                } else if (Settings["nest_dock"] !== false) {
                    if (!containerDock()) enterPassthrough();
                }
            });
            chromeBar.appendChild(dockBtn);

            var retryBtn = document.createElement('button');
            retryBtn.type = 'button';
            retryBtn.className = 'transparent-nest-btn transparent-nest-retry';
            retryBtn.setAttribute('aria-label', 'Retry');
            retryBtn.innerHTML = '&#8635;';
            // only ever visible while .is-error/.is-retrying - see index.scss
            retryBtn.addEventListener('click', function(e) {
                e.preventDefault();
                retryClicked();
            });
            chromeBar.appendChild(retryBtn);

            var closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'transparent-nest-btn transparent-nest-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                api.close();
            });
            chromeBar.appendChild(closeBtn);

            // ── Chrome placement ─────────────────────────────────────────
            // The cluster floats in the backdrop gap ABOVE the panel (see
            // index.scss) - which only works while there IS a gap. A panel
            // dragged flush against the top of the viewport would push its
            // own chrome off-screen, so below that much room it falls back
            // inside the panel's corner. Recomputed on every move/resize/
            // dock and, cheaply, from the pointer tracking below.
            var CHROME_ROOM = 46;   // cluster height (34) + its 6px gap + slack

            function applyChromeRoom(r) {

                var inside = r.top < CHROME_ROOM;
                if (inside === container.classList.contains('is-chrome-inside')) return;
                container.classList.toggle('is-chrome-inside', inside);
            }

            function updateChromePlacement() { applyChromeRoom(panel.getBoundingClientRect()); }
            container._updateChromePlacement = updateChromePlacement;

            // ── Corner peek ──────────────────────────────────────────────
            // IN FULLSCREEN ONLY, the cluster is hidden (and click-through)
            // until the pointer dwells in the panel's top-right corner.
            // That is the one state where it has no backdrop gap to float
            // in and sits inside the corner instead, on top of whatever the
            // nested page keeps there - in the consuming admin, that page's
            // own controls - where a permanently visible pill both hides
            // them and eats their clicks. Every other state floats it clear
            // of the page and simply leaves it visible (see index.scss), so
            // everything below is a no-op there.
            //
            // The trigger is deliberately small: a corner, not the whole
            // top-right quadrant. A generous zone made the pill appear while
            // the pointer was merely on its way to one of the NESTED page's
            // own top-right controls, and the pill then covered the very
            // button being reached for. The cluster's own (always
            // measurable, even at opacity 0) rect is unioned in below, so
            // shrinking this box can never strand the pointer outside the
            // zone while it is on the pill itself.
            var PEEK_W = 104, PEEK_ABOVE = 60, PEEK_BELOW = 36, PEEK_PAD = 10;
            // PEEK_SHOW_MS is a dwell, not a debounce: "keep the mouse in
            // the corner". Passing through on the way somewhere else must
            // not flash the pill, so it is long enough to sit out a normal
            // traverse. PEEK_HIDE_MS is the opposite - leaving must be
            // forgiving, or the pill vanishes in the gap between the corner
            // zone and the button the user is reaching for inside it.
            // PEEK_YIELD_MS is that same exit taken in a hurry: the pointer
            // has landed on a control the pill is covering, and every ms it
            // stays up is a ms that control cannot be clicked.
            var PEEK_SHOW_MS = 340, PEEK_HIDE_MS = 340, PEEK_YIELD_MS = 90;
            var peekShowTimer = null, peekHideTimer = null, peekHideDelay = 0;

            // Anything the pointer could be aiming AT rather than merely
            // passing over. Matched against the element under the pointer -
            // in the host document and, forwarded from the mount below, in
            // the nested one.
            var PEEK_CONTROL_SEL = 'a[href],button,input,select,textarea,summary,label,'
                + '[role="button"],[role="link"],[role="tab"],[contenteditable=""],[contenteditable="true"]';

            function isControl(target) {

                if (!target || target.nodeType !== 1 || !target.closest) return false;
                var hit = target.closest(PEEK_CONTROL_SEL);
                // the cluster's own buttons are not a conflict with itself
                return !!hit && !chromeBar.contains(hit);
            }
            container._peekIsControl = isControl;

            function clearPeek() {

                if (peekShowTimer) { clearTimeout(peekShowTimer); peekShowTimer = null; }
                if (peekHideTimer) { clearTimeout(peekHideTimer); peekHideTimer = null; }
                container.classList.remove('is-chrome-peek');
            }

            function setPeek(on, urgent) {

                if (on) {
                    if (peekHideTimer) { clearTimeout(peekHideTimer); peekHideTimer = null; }
                    if (container.classList.contains('is-chrome-peek') || peekShowTimer) return;
                    peekShowTimer = setTimeout(function() {
                        peekShowTimer = null;
                        container.classList.add('is-chrome-peek');
                    }, PEEK_SHOW_MS);
                    return;
                }

                if (peekShowTimer) { clearTimeout(peekShowTimer); peekShowTimer = null; }
                if (!container.classList.contains('is-chrome-peek')) return;
                // A pending leave already counting down is left alone -
                // restarting it on every mousemove would turn the delay into
                // a debounce and it would never fire. Switching from the
                // forgiving leave to the urgent yield (or back) IS a
                // restart: the shorter deadline has to win.
                var delay = urgent ? PEEK_YIELD_MS : PEEK_HIDE_MS;
                if (peekHideTimer) {
                    if (peekHideDelay === delay) return;
                    clearTimeout(peekHideTimer);
                }
                peekHideDelay = delay;
                peekHideTimer = setTimeout(function() {
                    peekHideTimer = null;
                    container.classList.remove('is-chrome-peek');
                }, delay);
            }

            // Host-viewport coordinates. The zone hugs the panel's top-right
            // corner and deliberately reaches ABOVE the panel as well: in the
            // default windowed state the cluster floats in the backdrop gap
            // up there, outside the panel box entirely, so a zone clipped to
            // the panel would never cover the pill the user is aiming at.
            // The cluster's own rect is unioned in for the same reason - it
            // grows and moves with the state (fullscreen, docked, error) and
            // must stay hoverable whatever the fixed box above covers.
            function peekFromPoint(x, y, overControl) {

                // a parked session still has these listeners attached, and
                // measures as a zero rect while hidden - nothing here means
                // anything until it is resumed
                if (container.classList.contains('is-parked')) return;

                var r = panel.getBoundingClientRect();
                // free ride: this is the one callback that already runs on
                // every pointer move, so the placement stays right even
                // after a viewport change nothing else hooked
                applyChromeRoom(r);

                // Outside fullscreen the cluster is simply always visible -
                // nothing to peek at, and a stale .is-chrome-peek left on
                // here would make the next fullscreen start out showing it.
                if (!container.classList.contains('is-full')) { clearPeek(); return; }

                // A control under the pointer OWNS that pointer, wherever it
                // is. The pill is opaque and, once shown, click-eating: put
                // it over a button somebody is already hovering and it both
                // hides the target and swallows the click meant for it. So
                // this is a veto, not a longer dwell - an earlier version
                // merely stretched the wait to a second and the pill still
                // turned up on top of the control being used. Keyboard users
                // are unaffected (:focus-within shows it) and Escape still
                // closes the nest outright, so no state is unreachable.
                if (overControl) { setPeek(false, true); return; }

                var inCorner = x >= r.right - PEEK_W && x <= r.right + PEEK_PAD
                            && y >= r.top - PEEK_ABOVE && y <= r.top + PEEK_BELOW;

                if (!inCorner) {
                    var c = chromeBar.getBoundingClientRect();
                    inCorner = x >= c.left - PEEK_PAD && x <= c.right + PEEK_PAD
                            && y >= c.top - PEEK_PAD && y <= c.bottom + PEEK_PAD;
                }

                setPeek(inCorner);
            }
            container._peekFromPoint = peekFromPoint;

            document.addEventListener('mousemove', function(e) {
                peekFromPoint(e.clientX, e.clientY, isControl(e.target));
            });
            // Pointer gone from the host document entirely - drop it rather
            // than leaving the pill stranded on screen.
            document.addEventListener('mouseleave', function() { setPeek(false); });

            var body = document.createElement('div');
            body.className = 'transparent-nest-body';
            panel.appendChild(body);

            var spinner = document.createElement('div');
            spinner.className = 'transparent-nest-spinner';
            body.appendChild(spinner);

            var error = document.createElement('div');
            error.className = 'transparent-nest-error';
            error.innerHTML = '<div class="transparent-nest-error-icon">&#9888;</div>'
                + '<div class="transparent-nest-error-message">Something went wrong loading this content.</div>';
            body.appendChild(error);

            // ── Host drag shield ─────────────────────────────────────────
            // The iframe swallows every mouse event over the pixels it
            // covers, so a drag implemented the usual way - listeners on the
            // HOST document, no pointer capture - dies the moment the
            // pointer crosses the panel: no more mousemove, and no mouseup
            // either, which typically leaves whatever was being dragged
            // stuck to the pointer afterwards. Reported live against
            // Symfony's dev toolbar, which is draggable and sits above the
            // overlay (z-index 9999999): dragging it froze the instant it
            // reached the panel and never let go.
            //
            // The panel's OWN drags already solve this by making the frame
            // inert while .is-dragging (see index.scss). A host-page widget
            // cannot reach for that class, so arm the same shield on its
            // behalf: a pointerdown landing on the host document makes the
            // frame inert until the button comes back up. It costs the
            // nested page nothing - the pointer is by definition NOT over
            // the iframe at the moment a host pointerdown happens (one
            // inside it never crosses the boundary at all, so it can never
            // arm this), and press/release/click still works normally.
            function shieldOff() {

                if (container.classList.contains('is-host-dragging')) {
                    container.classList.remove('is-host-dragging');
                }
            }

            document.addEventListener('pointerdown', function(e) {
                if (e.button !== 0) return;
                if (container.classList.contains('is-parked')) return;
                container.classList.add('is-host-dragging');
            }, true);
            // Captured on window so a release the page swallows still lifts
            // the shield, plus the ways a drag can end without a pointerup
            // reaching us at all (cancelled, released outside the window and
            // noticed only on the next buttonless move, tabbed away).
            window.addEventListener('pointerup', shieldOff, true);
            window.addEventListener('pointercancel', shieldOff, true);
            window.addEventListener('blur', shieldOff);
            document.addEventListener('pointermove', function(e) {
                if (e.buttons === 0) shieldOff();
            }, true);

            // ── Panel interactions: move (drag the chrome bar), resize
            // (drag edges/corners), magnetic snap against viewport
            // sides/corners. All gated by Settings (nest_move/nest_resize/
            // nest_snap, opt-out defaults). The panel starts flex-centered
            // at its default size; the FIRST interaction "frees" it:
            // position:absolute + explicit px geometry (is-free), after
            // which it goes wherever the user puts it. is-dragging on the
            // container disables the iframe's pointer-events for the whole
            // gesture - without that shield the drag dies the instant the
            // pointer crosses into the iframe (its document eats the
            // events; pointer capture alone doesn't cross that boundary
            // reliably in every engine, so both are used).
            var MIN_W = 320, MIN_H = 240;
            var MOBILE_QUERY = '(max-width: 768px)';
            // Below this breakpoint the panel is ALWAYS fullscreen (see
            // index.scss) - move/resize/dock don't apply there, only the
            // swipe-down-to-dismiss gesture does.
            function isMobile() {
                return window.matchMedia && window.matchMedia(MOBILE_QUERY).matches;
            }

            function toFree() {
                if (panel.classList.contains('is-free')) return;
                var r = panel.getBoundingClientRect();
                panel.classList.add('is-free');
                panel.style.left = r.left + 'px';
                panel.style.top = r.top + 'px';
                panel.style.width = r.width + 'px';
                panel.style.height = r.height + 'px';
            }

            // Live drag tracks the pointer 1:1, no clamping mid-drag - the
            // dock decision below is made once, on release, same spirit as
            // OS-level window snap (a live outline preview would be nicer
            // but isn't implemented here).
            //
            // Docking is purely POSITIONAL now (no button): drop the panel
            // and it docks THERE, stretched to fill that whole dimension
            // ("snapping and perfectly fitting the screen") - full height
            // for left/right, full width for top/bottom. Checked in this
            // fixed order so a corner drop (overflowing two edges at once)
            // resolves to one side, not an undefined blend.
            //
            // Deliberately triggers on genuine OVERFLOW past the viewport
            // boundary, not mere proximity to it: an earlier version
            // docked as soon as an edge came within a small zone of the
            // viewport edge, so it kicked in constantly while the panel
            // was still comfortably fully on-screen. Docking should only
            // become visible once the panel is actually being pushed OUT
            // of the window - nest_snap_threshold is now "how far past the
            // boundary counts as pushed out" (a small tolerance so a
            // 1-pixel overshoot doesn't mis-trigger), not "how close is
            // close enough".
            function pushedOutEdge(rect) {
                if (Settings["nest_dock"] === false || Settings["nest_snap"] === false) return null;
                var t = Settings["nest_snap_threshold"];
                var vw = window.innerWidth, vh = window.innerHeight;
                if (rect.left <= -t) return 'left';
                if (rect.left + rect.width >= vw + t) return 'right';
                if (rect.top <= -t) return 'top';
                if (rect.top + rect.height >= vh + t) return 'bottom';
                return null;
            }

            function applyDock(edge) {
                var rect = panel.getBoundingClientRect();
                container.classList.add('is-docked');
                container.dataset.dockEdge = edge;
                Transparent.html.addClass('nest-docked');
                document.body.style.overflow = hostOverflow || ''; // host scrolls again
                // The SPAN dimension (height for left/right, width for
                // top/bottom) is fully CSS-driven (100vh/100vw) - clear any
                // inline px so it stays responsive to viewport resizes. The
                // DEPTH dimension keeps an explicit, clamped inline px:
                // left/right/top/bottom clearing it out would let the
                // panel's own base CSS width (92vw) or height (88vh) leak
                // through, turning every dock into a near-fullscreen slab
                // instead of a real sidebar/bar. Starts from whatever depth
                // the panel already had (respects a prior resize) clamped
                // to a sane range - the resize handle can adjust it further
                // once docked.
                if (edge === 'left' || edge === 'right') {
                    panel.style.width = Math.min(Math.max(rect.width, MIN_W), Math.round(window.innerWidth * 0.5), 480) + 'px';
                    panel.style.height = '';
                } else {
                    panel.style.height = Math.min(Math.max(rect.height, MIN_H), Math.round(window.innerHeight * 0.5), 360) + 'px';
                    panel.style.width = '';
                }
                panel.style.left = panel.style.top = '';
                updateChromePlacement();
                dispatchEvent(new CustomEvent('transparent:nest:dock', { detail: { href: container._currentHref, edge: edge } }));
            }

            if (Settings["nest_move"] !== false) {
                container.classList.add('is-movable');
                // Manual double-click detection, NOT a native 'dblclick'
                // listener: this same pointerdown handler calls
                // e.preventDefault() to own the drag gesture, and several
                // engines (WebKit/Safari notably) suppress the synthetic
                // click/dblclick events a pointer interaction would
                // otherwise generate once its pointerdown's default action
                // is prevented - a native dblclick listener here could
                // simply never fire. Tracking timestamp + position of the
                // last pointerdown ourselves sidesteps that entirely.
                var lastDownAt = 0, lastDownX = 0, lastDownY = 0;
                var DBLCLICK_MS = 400, DBLCLICK_PX = 10;
                // A plain click's hide/show toggle can't fire immediately on
                // pointerup - it has to wait out the double-click window
                // first, since the SAME click is also candidate #1 of a
                // pending double-click (which means "restore", not "hide").
                // Whichever click resolves the ambiguity (the double-click
                // branch above) cancels this timer.
                var pendingClickTimer = null;
                chromeBar.addEventListener('pointerdown', function(e) {
                    if (e.button !== 0) return;
                    if (container.classList.contains('is-full')) return; // fullscreen (shared) isn't draggable
                    if (isMobile()) return; // always-fullscreen breakpoint - swipe handles dismissal instead
                    if (e.target.closest && e.target.closest('button')) return;

                    var now = Date.now();
                    var isDoubleClick = (now - lastDownAt) < DBLCLICK_MS
                        && Math.abs(e.clientX - lastDownX) < DBLCLICK_PX
                        && Math.abs(e.clientY - lastDownY) < DBLCLICK_PX;
                    lastDownAt = now; lastDownX = e.clientX; lastDownY = e.clientY;
                    if (isDoubleClick) {
                        lastDownAt = 0; // consumed - a third rapid click starts fresh, isn't a triple-trigger
                        if (pendingClickTimer) { clearTimeout(pendingClickTimer); pendingClickTimer = null; }
                        restoreDefault();
                        return;
                    }

                    var sx = e.clientX, sy = e.clientY;
                    var sl, st, started = false;
                    container.classList.add('is-dragging');
                    try { chromeBar.setPointerCapture(e.pointerId); } catch (err) {}

                    // Picking a docked panel up needs its own snapshot, NOT
                    // plain toFree(): a docked panel's SPAN dimension is
                    // deliberately oversized (100vh for left/right,
                    // 100vw for top/bottom) as part of what docking means -
                    // carrying that straight into a free-floating box would
                    // hand the drag a panel whose height/width already
                    // reaches (or exceeds, given the move itself shifts
                    // top/left too) the opposite viewport edge, so the
                    // edge-proximity check at release would false-positive
                    // "still touching" almost immediately, regardless of
                    // where it's actually dropped. Undocking gives the span
                    // dimension a normal, moderate size instead - only the
                    // depth (the dimension that was actually meaningful
                    // while docked) carries over.
                    var beginDrag = function() {
                        started = true;
                        var wasDocked = container.classList.contains('is-docked');
                        if (wasDocked) {
                            var edgeAtPickup = container.dataset.dockEdge;
                            // drop is-hidden BEFORE measuring - its
                            // transform pushes the panel fully off-screen,
                            // so a rect taken while it's still applied would
                            // hand the drag garbage (translated, not true)
                            // coordinates
                            container.classList.remove('is-hidden');
                            var rect = panel.getBoundingClientRect();
                            clearDock();
                            panel.classList.add('is-free');
                            if (edgeAtPickup === 'left' || edgeAtPickup === 'right') {
                                panel.style.width = rect.width + 'px';
                                panel.style.height = Math.round(window.innerHeight * 0.7) + 'px';
                            } else {
                                panel.style.height = rect.height + 'px';
                                panel.style.width = Math.round(window.innerWidth * 0.7) + 'px';
                            }
                            panel.style.left = rect.left + 'px';
                            panel.style.top = rect.top + 'px';
                        } else {
                            toFree();
                        }
                        // "if it's not in its default position we should go
                        // into docking mode" - a genuine drag starting (or
                        // resuming from a prior dock) drops the modal
                        // backdrop immediately, not just once it happens to
                        // land pushed against an edge
                        enterPassthrough();
                        sl = parseFloat(panel.style.left);
                        st = parseFloat(panel.style.top);
                    };

                    var onMove = function(ev) {
                        // A plain click - pointerdown then pointerup with
                        // essentially no movement - must be a complete
                        // no-op for dock state: committing to beginDrag()
                        // on every click (as an earlier version did) picks
                        // the panel up and immediately re-evaluates docking
                        // even for a single stationary click, which can
                        // shift the grab tab's exact pixel position by the
                        // time a SECOND click of an intended double-click
                        // lands - occasionally missing the tab entirely and
                        // landing on the host page underneath instead
                        // (once observed live: the "second click" of a
                        // double-click hit an unrelated host link and
                        // navigated away). Small jitter tolerance, not 0,
                        // since real pointer input is never perfectly still.
                        if (!started) {
                            if (Math.abs(ev.clientX - sx) < 4 && Math.abs(ev.clientY - sy) < 4) return;
                            // real movement - this was a drag, not a click;
                            // a hide/show toggle scheduled by an earlier,
                            // still-pending click on this same tab no longer
                            // applies
                            if (pendingClickTimer) { clearTimeout(pendingClickTimer); pendingClickTimer = null; }
                            beginDrag();
                        }
                        panel.style.left = (sl + ev.clientX - sx) + 'px';
                        panel.style.top = (st + ev.clientY - sy) + 'px';
                        updateChromePlacement();
                    };
                    var onUp = function() {
                        chromeBar.removeEventListener('pointermove', onMove);
                        chromeBar.removeEventListener('pointerup', onUp);
                        chromeBar.removeEventListener('pointercancel', onUp);
                        container.classList.remove('is-dragging');
                        if (started) {
                            var edge = pushedOutEdge(panel.getBoundingClientRect());
                            // Pushed past an edge -> full edge-fit dock.
                            // Otherwise it STAYS docked/passthrough right
                            // where it was dropped (enterPassthrough()
                            // already applied that in beginDrag) - dropping
                            // it somewhere fully on-screen no longer snaps
                            // all the way back to the full modal by itself;
                            // only an explicit restore (double-click / the
                            // dock button) does that.
                            if (edge) applyDock(edge);
                            else delete container.dataset.dockEdge;
                            dispatchEvent(new CustomEvent('transparent:nest:move', { detail: { href: container._currentHref, rect: panel.getBoundingClientRect() } }));
                        } else if (container.classList.contains('is-docked')) {
                            // genuine click (no movement) on a docked panel's
                            // grab tab - defer the hide/show toggle until the
                            // double-click window has passed with no second
                            // click; if one arrives, the branch above cancels
                            // this and restores instead
                            if (pendingClickTimer) clearTimeout(pendingClickTimer);
                            pendingClickTimer = setTimeout(function() {
                                pendingClickTimer = null;
                                toggleHidden();
                            }, DBLCLICK_MS);
                        }
                    };
                    chromeBar.addEventListener('pointermove', onMove);
                    chromeBar.addEventListener('pointerup', onUp);
                    chromeBar.addEventListener('pointercancel', onUp);
                    e.preventDefault();
                });
            }

            if (Settings["nest_resize"] !== false) {
                var startResize = function(e, dir, handle) {
                    if (e.button !== 0) return;
                    if (container.classList.contains('is-full')) return; // fullscreen (shared) isn't resizable
                    if (isMobile()) return; // always-fullscreen breakpoint
                    toFree();
                    // resizing away from the pristine default is just as
                    // much "not in its default position" as moving it - see
                    // the move handler's beginDrag for the same call
                    enterPassthrough();
                    var sx = e.clientX, sy = e.clientY;
                    var sl = parseFloat(panel.style.left), st = parseFloat(panel.style.top);
                    var sw = panel.offsetWidth, sh = panel.offsetHeight;
                    container.classList.add('is-dragging');
                    try { handle.setPointerCapture(e.pointerId); } catch (err) {}
                    var t = Settings["nest_snap"] === false ? -1 : Settings["nest_snap_threshold"];
                    var onMove = function(ev) {
                        var dx = ev.clientX - sx, dy = ev.clientY - sy;
                        var left = sl, top = st, w = sw, h = sh;
                        // the dragged edge is the one that snaps
                        if (dir.indexOf('e') !== -1) {
                            w = sw + dx;
                            if (t > 0 && Math.abs(window.innerWidth - (left + w)) < t) w = window.innerWidth - left;
                        }
                        if (dir.indexOf('s') !== -1) {
                            h = sh + dy;
                            if (t > 0 && Math.abs(window.innerHeight - (top + h)) < t) h = window.innerHeight - top;
                        }
                        if (dir.indexOf('w') !== -1) {
                            left = sl + dx; w = sw - dx;
                            if (t > 0 && Math.abs(left) < t) { w += left; left = 0; }
                        }
                        if (dir.indexOf('n') !== -1) {
                            top = st + dy; h = sh - dy;
                            if (t > 0 && Math.abs(top) < t) { h += top; top = 0; }
                        }
                        if (w < MIN_W) { if (dir.indexOf('w') !== -1) left -= (MIN_W - w); w = MIN_W; }
                        if (h < MIN_H) { if (dir.indexOf('n') !== -1) top -= (MIN_H - h); h = MIN_H; }
                        panel.style.left = left + 'px';
                        panel.style.top = top + 'px';
                        panel.style.width = w + 'px';
                        panel.style.height = h + 'px';
                        updateChromePlacement();
                    };
                    var onUp = function() {
                        handle.removeEventListener('pointermove', onMove);
                        handle.removeEventListener('pointerup', onUp);
                        handle.removeEventListener('pointercancel', onUp);
                        container.classList.remove('is-dragging');
                        dispatchEvent(new CustomEvent('transparent:nest:resize', { detail: { href: container._currentHref, rect: panel.getBoundingClientRect() } }));
                    };
                    handle.addEventListener('pointermove', onMove);
                    handle.addEventListener('pointerup', onUp);
                    handle.addEventListener('pointercancel', onUp);
                    e.preventDefault();
                    e.stopPropagation();
                };
                ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach(function(dir) {
                    var handle = document.createElement('div');
                    handle.className = 'transparent-nest-handle transparent-nest-handle-' + dir;
                    handle.addEventListener('pointerdown', function(e) { startResize(e, dir, handle); });
                    panel.appendChild(handle);
                });
            }

            // Swipe-down-to-dismiss (iOS sheet style) - mobile only (the
            // panel is always fullscreen below the breakpoint, see
            // index.scss, so there's no move/resize/dock there, only this).
            // Drag the chrome bar down past a distance OR flick it with
            // enough velocity to close; otherwise it snaps back.
            if (Settings["nest_swipe"] !== false) {
                var SWIPE_CLOSE_DISTANCE = 120;
                var SWIPE_CLOSE_VELOCITY = 0.5; // px/ms
                chromeBar.addEventListener('pointerdown', function(e) {
                    if (e.button !== 0) return;
                    if (!isMobile()) return;
                    if (e.target.closest && e.target.closest('button')) return;
                    var startY = e.clientY, startTime = Date.now(), dy = 0;
                    panel.classList.add('is-swiping');
                    container.classList.add('is-swiping');
                    try { chromeBar.setPointerCapture(e.pointerId); } catch (err) {}
                    var onMove = function(ev) {
                        dy = Math.max(0, ev.clientY - startY); // downward only
                        panel.style.transform = 'translateY(' + dy + 'px)';
                        var damp = Math.max(0, 1 - dy / (window.innerHeight * 0.6));
                        container.style.setProperty('--transparent-nest-swipe-fade', damp);
                    };
                    var onUp = function() {
                        chromeBar.removeEventListener('pointermove', onMove);
                        chromeBar.removeEventListener('pointerup', onUp);
                        chromeBar.removeEventListener('pointercancel', onUp);
                        panel.classList.remove('is-swiping');
                        container.classList.remove('is-swiping');
                        var velocity = dy / Math.max(1, Date.now() - startTime);
                        if (dy > SWIPE_CLOSE_DISTANCE || velocity > SWIPE_CLOSE_VELOCITY) {
                            dispatchEvent(new CustomEvent('transparent:nest:swipe-close', { detail: { href: container._currentHref } }));
                            panel.style.transform = ''; // is-closing's own transform takes over
                            container.style.removeProperty('--transparent-nest-swipe-fade');
                            api.close();
                        } else {
                            panel.style.transform = '';
                            container.style.removeProperty('--transparent-nest-swipe-fade');
                        }
                    };
                    chromeBar.addEventListener('pointermove', onMove);
                    chromeBar.addEventListener('pointerup', onUp);
                    chromeBar.addEventListener('pointercancel', onUp);
                });
            }

            hostTitle = document.title;
            hostOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            document.body.appendChild(container);
            Transparent.html.addClass(HTML_CLASS);

            // Force a SYNCHRONOUS style flush (reading a layout-dependent
            // property forces the browser to commit the base opacity:0
            // state to the render tree right now, in this same tick) so
            // .is-loading's opacity:1 has an observable "before" frame
            // to transition from - same goal the previous double-rAF
            // version had, but bounded. A double requestAnimationFrame
            // delay is UNBOUNDED under real main-thread contention: on a
            // busy page (heavy JS/rendering work already in flight, e.g.
            // the host page's own map), two animation frames can take over
            // a second to actually fire - confirmed independently in this
            // session's own headless testing (the equivalent .is-error
            // path stalled similarly). For the ENTIRE gap before those
            // frames land, the container sits at the base rule's
            // opacity:0 - genuinely, completely invisible - "truly flat,
            // nothing at all" is exactly what opacity:0 looks like. This
            // is what a real user reported live: an extended blank/flat
            // period with no spinner, no dimming, nothing.
            void container.offsetHeight;
            container.classList.add('is-loading');
            dispatchEvent(new CustomEvent('transparent:nest:fade-in-start', { detail: { href: href } }));
            // The entrance fade (0 -> 1) runs and COMPLETES during
            // .is-loading (loading is full opacity now, the frosted-glass
            // panel is the loading look) - so fade-in-end must be armed
            // here, where the fade starts, not in reveal() (by reveal time
            // opacity is already 1 -> 1, no transition, the event would
            // never fire).
            container.addEventListener('transitionend', function onFadeInEnd(e) {
                if (e.target !== container || e.propertyName !== 'opacity') return;
                container.removeEventListener('transitionend', onFadeInEnd);
                dispatchEvent(new CustomEvent('transparent:nest:fade-in-end', { detail: { href: href } }));
            });

            return container;
        }

        // Gives the nested document a real base URL. A srcdoc document's own
        // location.href is otherwise the opaque "about:srcdoc" - EXACTLY the
        // same quirk currentOrigin() exists to work around for origin checks
        // (see its comment), except this half of it isn't fixable from the
        // OUTSIDE: the browser's own href-resolution algorithm (what a bare
        // `<a href="#stats">`'s .href property resolves to, what a relative
        // form action posts to, etc.) runs INSIDE the nested document and
        // has no notion of currentOrigin(). Without a <base> tag, a bare-
        // fragment link resolves against "about:srcdoc" instead of the real
        // admin page - clicking it fell through every "is this just a
        // same-page scroll" check and reached a real, broken navigation
        // instead. A <base href> is the standard fix for embedding arbitrary
        // HTML via srcdoc while keeping normal relative-URL semantics; only
        // path-relative and fragment-only references were ever affected
        // (absolute `/...` paths, which this app uses almost everywhere,
        // resolve identically with or without one).
        function injectBaseTag(html, href) {
            var baseTag = '<base href="' + String(href).replace(/"/g, '&quot;') + '">';
            if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, function (m) { return m + baseTag; });
            if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, function (m) { return m + baseTag; });
            return baseTag + html;
        }

        function mount(html, href, fresh) {

            html = injectBaseTag(html, href);

            var container = api.getContainer();

            var title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];

            var body = container.querySelector('.transparent-nest-body');
            var frame = body.querySelector('iframe');
            if (frame == null) {
                frame = document.createElement('iframe');
                frame.setAttribute('title', title || 'nested');
                body.appendChild(frame);
            }

            // Reveal only once the iframe has actually finished loading -
            // NOT the instant srcdoc is assigned. srcdoc is just a string;
            // the nested document still has to parse and fetch its own
            // <script src>/<link> (Encore bundles, the admin package's own
            // CSS, etc.), which can easily take longer than the initial
            // HTML fetch this function is called from. Revealing early
            // showed the iframe's own (opaque, per the earlier background-
            // bleed-through fix) white background while that was still in
            // flight - "the page goes white before the nested site finishes
            // loading".
            var revealed = false;
            var reveal = function() {
                if (revealed) return;
                revealed = true;
                container._pendingReveal = null;
                // there is now a real nested document worth keeping alive
                // across a close (see canPark)
                container._mounted = true;
                // backs the `href` on esc/close-adjacent events without
                // inventing separate per-event tracking
                container._currentHref = href;

                // The spinner element is PERMANENT (not removed here): CSS
                // gates it on .is-loading, so every subsequent in-overlay
                // load (navigate/retry) gets the glass+spinner treatment
                // too, not just the very first open.

                // Reveal the content: while .is-loading the panel is
                // frosted glass with the spinner on top (see index.scss);
                // swapping to .is-entering turns the panel opaque white and
                // unhides the iframe. .is-entering is deliberately left on
                // afterwards - it's just opacity:1, the correct resting
                // state, not a one-shot animation trigger - removing it
                // would fall through to the base rule's opacity:0 (needed
                // for the very first open's transition-in) and make
                // fully-loaded content invisible again. A subsequent
                // navigate() call clears it before re-adding .is-loading
                // (see fetchNested) so the glass state applies each time.
                container.classList.remove('is-loading');
                // defensive: a stale reveal (e.g. a very late notifyNestReady
                // from a document that's since been replaced) shouldn't be
                // able to leave a previously-shown error state stuck on
                container.classList.remove('is-error');
                container.classList.add('is-entering');
                var retryBtn = container.querySelector('.transparent-nest-retry');
                if (retryBtn) { retryBtn.classList.remove('is-retrying'); retryBtn.disabled = false; }

                dispatchEvent(new CustomEvent('transparent:nest:' + (fresh ? 'open' : 'navigate'), { detail: { href: href } }));
            };

            // Authoritative fast path: a nested page can call
            // `parent.Transparent.notifyNestReady()` once IT knows it's
            // visually complete (e.g. after its own deferred widget bundle's
            // load promise resolves) - only the page itself truly knows
            // when that is. api.notifyReady() (below) looks this up via
            // container._pendingReveal and, if set, reveals immediately,
            // pre-empting the heuristic fallback.
            container._pendingReveal = reveal;

            // Fallback for pages that don't call notifyNestReady(): the
            // 'load' event fires once the document and the resources it
            // DECLARED UP FRONT (script/link tags present in the initial
            // HTML) are done - it does NOT wait for anything a page's own
            // JS fetches or injects afterwards (dynamic import()/code-
            // splitting, a lazy-loaded widget bundle, style-loader
            // injecting <style> tags at runtime, etc.). So: after 'load',
            // also watch the nested document for further DOM mutations (a
            // MutationObserver) and only reveal once it's gone quiet for
            // SETTLE_MS - catches MOST late content without needing an
            // explicit signal, though content that arrives on its own
            // delayed timer (not itself the direct result of a mutation
            // burst right after load) can still slip through this specific
            // heuristic - that's exactly what notifyNestReady() is for.
            var SETTLE_MS = 250;
            var MAX_WAIT_AFTER_LOAD_MS = 3000;
            frame.addEventListener('load', function() {
                var settleTimer = null;
                var observer = null;
                var finish = function() {
                    if (observer) { try { observer.disconnect(); } catch (e) {} }
                    clearTimeout(settleTimer);
                    reveal();
                };
                var scheduleSettle = function() {
                    clearTimeout(settleTimer);
                    settleTimer = setTimeout(finish, SETTLE_MS);
                };
                try {
                    var doc = frame.contentDocument;
                    observer = new MutationObserver(scheduleSettle);
                    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true });
                    scheduleSettle();
                    setTimeout(finish, MAX_WAIT_AFTER_LOAD_MS); // hard cap regardless of ongoing mutations
                    // redundant with the attach right after srcdoc is set
                    // below - identical (type, listener, capture) triples
                    // dedupe per spec, so this is a harmless no-op unless
                    // that earlier attach's contentDocument timing
                    // assumption turns out not to hold in some engine
                    try { doc.addEventListener('keydown', handleEscKeydown, true); } catch (e) {}

                    // The iframe swallows the host's mousemove for every
                    // pixel it covers - which, now that the chrome bar no
                    // longer reserves a strip, is the whole panel. Without
                    // this the corner peek could only ever trigger from the
                    // backdrop around the panel, i.e. never at all in
                    // fullscreen or when docked. Coordinates are relative to
                    // the iframe's own viewport, so shift them into host
                    // space by its rect. Re-attached per mount() like the
                    // keydown above: srcdoc replaces the whole Document.
                    try {
                        doc.addEventListener('mousemove', function(e) {
                            if (!container._peekFromPoint) return;
                            var fr = frame.getBoundingClientRect();
                            // Whether the pointer sits on one of the NESTED
                            // page's own controls travels with the point:
                            // the host cannot see through the iframe to ask,
                            // and it is exactly the case the peek has to
                            // stay out of the way for.
                            var onControl = container._peekIsControl
                                && container._peekIsControl(e.target);
                            container._peekFromPoint(e.clientX + fr.left, e.clientY + fr.top, onControl);
                        }, true);
                    } catch (e) {}

                    // Mirror the nested page's own transparentJS loading
                    // state (its html.loading class, set for every in-iframe
                    // SPA navigation) onto the container as .is-busy - this
                    // drives the small chrome loading indicator next to the
                    // close button. Persistent for the document's lifetime
                    // (unlike the settle observer above); re-created on
                    // every mount since srcdoc replaces the whole document.
                    if (container._busyObserver) { try { container._busyObserver.disconnect(); } catch (e) {} }
                    var innerHtml = doc.documentElement;
                    container._busyObserver = new MutationObserver(function() {
                        var busy = innerHtml.classList.contains('loading');
                        var had = container.classList.contains('is-busy');
                        if (busy && !had) {
                            container.classList.add('is-busy');
                            dispatchEvent(new CustomEvent('transparent:nest:busy', { detail: { href: container._currentHref } }));
                        } else if (!busy && had) {
                            container.classList.remove('is-busy');
                            dispatchEvent(new CustomEvent('transparent:nest:idle', { detail: { href: container._currentHref } }));
                        }
                    });
                    container._busyObserver.observe(innerHtml, { attributes: true, attributeFilter: ['class'] });
                } catch (e) {
                    // cross-origin or any other access failure - fall back
                    // to revealing right on 'load' rather than hanging
                    reveal();
                }
            }, { once: true });
            // safety net: don't leave the user staring at a spinner forever
            // if 'load' never fires at all for some edge case
            setTimeout(reveal, 4000 + MAX_WAIT_AFTER_LOAD_MS);

            // a leftover busy flag from the PREVIOUS document (it may have
            // been mid-navigation when this mount replaced it) must not
            // survive into the new one
            container.classList.remove('is-busy');

            frame.srcdoc = html;
            if (title) document.title = title;
            // reassigning srcdoc replaces the ENTIRE inner Document (new
            // listener registry) every time - a one-time host-side keydown
            // listener can never see ESC presses focused inside the iframe
            // (keydown doesn't cross the iframe/parent boundary), so this
            // must be re-attached on every mount(), not just once at setup.
            // Same-origin srcdoc means contentDocument is synchronously
            // available immediately, before 'load' even fires.
            try { frame.contentDocument.addEventListener('keydown', handleEscKeydown, true); } catch (e) {}
        }

        // Called by the nested page itself - `parent.Transparent.notifyNestReady()`
        // - once it knows it's visually complete. Authoritative: pre-empts
        // the automatic load+settle heuristic in mount(). A no-op if there's
        // no pending reveal (already revealed, or called outside a mount
        // cycle), so it's always safe to call defensively.
        api.notifyReady = function() {
            var container = api.getContainer();
            if (container && container._pendingReveal) container._pendingReveal();
        };

        // hover-prefetch cache: href -> {text, url, at}; entries are young
        // (TTL) so an admin list never goes stale behind an edit
        var prefetched = {};
        var PREFETCH_TTL = 15000;

        // Two structurally different failure modes, routed separately:
        // - onIneligible: the target responded but isn't nest-eligible
        //   (missing/wrong header, non-2xx, or a malformed body that threw
        //   inside onHit) - retrying changes nothing, falling back to a
        //   real navigation is correct (unchanged behavior).
        // - onNetworkError: the request itself never completed (onerror/
        //   ontimeout) - a transient problem retrying CAN fix, so this
        //   routes to the error+retry UI instead of silently navigating away.
        function fetchRaw(href, onHit, onIneligible, onNetworkError) {

            var request = new XMLHttpRequest();
            request.open('GET', href, true);
            request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            request.timeout = 20000;

            request.onload = function() {

                var nestable = request.status < 400 && request.getResponseHeader(HEADER) != null;
                if (!nestable) return onIneligible();

                // any mounting failure must never leave a dead click
                try { onHit(request.responseText, request.responseURL || href); }
                catch (err) {
                    if (Settings.debug) console.error('Transparent.nest mount failed', err);
                    onIneligible();
                }
            };
            request.onerror = onNetworkError;
            request.ontimeout = onNetworkError;
            request.send();
        }

        api.prefetch = function(href) {

            var entry = prefetched[href];
            if (entry && (Date.now() - entry.at) < PREFETCH_TTL) return;

            // background hover-prefetch must never surface UI on failure -
            // both failure modes are no-ops here
            fetchRaw(href, function(text, url) {
                prefetched[href] = { text: text, url: url, at: Date.now() };
            }, function() {}, function() {});
        };

        function fetchNested(href, onIneligible) {

            var fresh = !api.isOpen();
            // shell first, content later: the backdrop/spinner appears the
            // instant the click lands, the round-trip only fills it in
            var container = fresh ? openShell(href) : api.getContainer();
            // .is-entering is left on permanently after a successful mount
            // (see mount()) - clear it here so the loading dim is visible
            // again for this subsequent in-overlay navigation, instead of
            // .is-entering's later-in-stylesheet opacity:1 winning the
            // cascade tie over .is-loading's opacity:0.55 while both are
            // briefly present together. Also clear any error left over from
            // a previous failed attempt on this same open overlay.
            if (!fresh) {
                container.classList.remove('is-entering');
                container.classList.remove('is-error');
                container.classList.add('is-loading');
            }
            // host-side feedback while the page is fetched (slim top bar)
            document.documentElement.classList.add('nest-loading');
            dispatchEvent(new CustomEvent('transparent:nest:loading', { detail: { href: href, fresh: fresh } }));

            var done = function() { document.documentElement.classList.remove('nest-loading'); };

            var settle = function(text, url) {

                delete prefetched[href];

                mount(text, url, fresh);
                // A same-URL modal history entry: the address bar stays
                // on the HOST page's URL (clicking a nest link should
                // not feel like leaving the page), while Back still
                // closes the overlay via the popstate handler below
                // (the nest-marked state is what it keys on, not the
                // URL). Committing to the nested page's own URL is the
                // share button's job (in-place fullscreen promote). The
                // history.state guard covers share-during-loading, which
                // already pushed the nest entry itself - pushing a second
                // one here would strand an extra Back press.
                if (fresh && !(history.state && history.state.nest)) {
                    history.pushState({ nest: { href: url } }, '', location.href);
                }
                done();
            };

            var ineligible = function() {
                // fresh: no content was ever shown, tear the shell down.
                // !fresh: falling back to onIneligible() (a real navigation)
                // shortly, but restore .is-entering so the still-valid
                // previous content doesn't sit at the base rule's opacity:0
                // in the meantime.
                if (fresh) closeShell(container);
                else { container.classList.remove('is-loading'); container.classList.add('is-entering'); }
                done();
                onIneligible();
            };

            // genuine network failure (not "target isn't nest-eligible") -
            // show the error+retry UI instead of falling back to a real
            // navigation. Applies the same whether this is a fresh open
            // (empty body, nothing to preserve) or a mid-overlay navigate()
            // (the previous iframe content is untouched underneath - mount()
            // never ran, so srcdoc was never reassigned - the opaque error
            // panel simply covers it until retry succeeds).
            var networkError = function() {
                done();
                showError(container, href, fresh);
            };

            var entry = prefetched[href];
            if (entry && (Date.now() - entry.at) < PREFETCH_TTL) {
                try { return settle(entry.text, entry.url); }   // instant: already fetched on hover
                catch (err) {
                    if (Settings.debug) console.error('Transparent.nest mount failed', err);
                    return ineligible();
                }
            }

            fetchRaw(href, settle, ineligible, networkError);
        }

        // container._retryHref stashed by showError(); reused by the retry
        // button's click handler below
        function showError(container, href, fresh) {

            container._retryHref = href;

            container.classList.remove('is-loading');
            // full opacity, not the dimmed .is-loading state - the error
            // message must be legible, not half-transparent
            container.classList.add('is-entering');
            container.classList.add('is-error');

            var retryBtn = container.querySelector('.transparent-nest-retry');
            if (retryBtn) { retryBtn.classList.remove('is-retrying'); retryBtn.disabled = false; }

            if (Settings.debug) console.error('Transparent.nest: network error loading', href);
            dispatchEvent(new CustomEvent('transparent:nest:error', { detail: { href: href, fresh: fresh } }));
        }

        // At click time api.isOpen() is always true (the container exists,
        // isn't .is-closing) regardless of whether the original failure was
        // a fresh open or a mid-overlay navigate - so api.navigate()'s own
        // fresh = !api.isOpen() naturally evaluates false here, reusing the
        // existing shell/settle/ineligible plumbing with no new code paths.
        function retryClicked() {

            var container = api.getContainer();
            if (!container || !container._retryHref) return;
            var href = container._retryHref;

            var retryBtn = container.querySelector('.transparent-nest-retry');
            if (retryBtn) { retryBtn.classList.add('is-retrying'); retryBtn.disabled = true; }

            dispatchEvent(new CustomEvent('transparent:nest:retry', { detail: { href: href } }));
            api.navigate(href);
        }

        // Same target, whether or not either side is absolute: the click
        // that reopens a nest is usually a bare "/admin" while the parked
        // session records the response URL it actually landed on.
        function sameTarget(a, b) {

            if (!a || !b) return false;
            try { return new URL(a, location.href).href === new URL(b, location.href).href; }
            catch (e) { return a === b; }
        }

        // Bring the parked session back instead of fetching the page again.
        // Accepted for the page it was opened with AS WELL AS the one it has
        // navigated to since: the common flow is opening /admin, walking
        // into some edit form inside the overlay, closing it, and then
        // clicking that same /admin link again - meaning "give me back what
        // I had", not "load the dashboard fresh". A link to any OTHER page
        // is a deliberate request for that page and falls through to a
        // normal open, which discards the parked session (see openShell).
        function resume(href) {

            if (!parked) return false;
            if (!sameTarget(href, parked._currentHref) && !sameTarget(href, parked._openHref)) return false;

            var container = parked;
            parked = null;
            container.classList.remove('is-parked', 'is-closing');

            hostTitle = document.title;
            hostOverflow = document.body.style.overflow;
            Transparent.html.addClass(HTML_CLASS);
            // restore the host-page concessions this session was closed in,
            // not the pristine modal ones: a docked panel left the host
            // scrollable and interactive, and still does
            if (container.classList.contains('is-docked')) Transparent.html.addClass('nest-docked');
            else document.body.style.overflow = 'hidden';

            // the nest history entry was popped by the close - put an
            // equivalent one back so Back still closes the overlay
            if (!(history.state && history.state.nest)) {
                try { history.pushState({ nest: { href: container._currentHref } }, '', location.href); } catch (e) {}
            }

            if (container._updateChromePlacement) container._updateChromePlacement();
            dispatchEvent(new CustomEvent('transparent:nest:resume', { detail: { href: container._currentHref } }));
            return true;
        }

        api.open = function(href) {

            if (api.isOpen()) return api.navigate(href);
            if (resume(href)) return;

            fetchNested(href, function() { window.location.href = href; });
        };

        api.navigate = function(href) {
            fetchNested(href, function() { window.location.href = href; });
        };

        // Detaches the overlay after letting its opacity transition finish,
        // instead of yanking it out mid-frame. A `backdrop-filter: blur()`
        // layer removed in one synchronous DOM mutation can make the
        // browser's compositor visibly "pop"/un-blur the revealed page over
        // the next couple of frames - reads to the user as the host page
        // itself fading, even though nothing about the host ever changed.
        // Fading the overlay's opacity to 0 first (existing
        // `#transparent-nest { transition: opacity .3s }` rule) and only
        // then removing it keeps the visual change fully inside the overlay.
        var CLOSE_TRANSITION_MS = 300; // keep in sync with index.scss's #transparent-nest transition-duration

        // Whether this session is worth parking rather than destroying.
        // A shell that never mounted anything (an ineligible target torn
        // down mid-open) has nothing to preserve, and an error panel would
        // come back as an error.
        function canPark(container) {

            if (Settings['nest_keepalive'] === false) return false;
            if (!container._mounted) return false;
            if (container.classList.contains('is-error')) return false;
            return true;
        }

        function closeShell(container) {
            var href = container._currentHref;
            var park = canPark(container);
            // if the panel was re-parented into a host container
            // (nest_dock_target), pull it back under this shell FIRST - it
            // lives outside `container` while docked that way, so removing
            // `container` alone would silently orphan it in the host page
            // instead of actually closing it
            if (container._teardownDock) container._teardownDock();
            container.classList.add('is-closing');
            dispatchEvent(new CustomEvent('transparent:nest:fade-out-start', { detail: { href: href } }));
            setTimeout(function() {
                // Parked, not destroyed: the node STAYS in the document and
                // is merely hidden (index.scss, .is-parked). Removing it
                // instead would tear the iframe's browsing context down -
                // that is what made every close start the nested page over
                // from scratch, losing anything half-typed in it - and
                // re-inserting the same element reloads it just the same,
                // so "detach and put it back" is not an option.
                if (park) {
                    parked = container;
                    container.classList.add('is-parked');
                    container.classList.remove('is-closing');
                } else if (container.parentNode) container.remove();
                dispatchEvent(new CustomEvent('transparent:nest:fade-out-end', { detail: { href: href, parked: park } }));
            }, CLOSE_TRANSITION_MS);
        }

        // ESC closes the overlay, but only after confirmation - attached
        // both on the host document (below) and, freshly on every mount(),
        // on the nested iframe's own contentDocument: keydown doesn't cross
        // the iframe/parent boundary, and almost every ESC press happens
        // while focus is inside the iframe (that's the entire interactive
        // surface). window.confirm() blocks the JS thread synchronously, so
        // a second ESC pressed while a confirm dialog is already open simply
        // queues and gets reprocessed after the first resolves - by then
        // either isOpen() is already false (confirmed -> closed, the guard
        // below short-circuits it) or the overlay is still open and it's a
        // perfectly legitimate new attempt.
        function handleEscKeydown(e) {

            if (Settings.disable) return;
            if (e.key !== 'Escape') return;
            if (!api.isOpen()) return;
            if (e.defaultPrevented) return;

            var container = api.getContainer();
            var href = container ? container._currentHref : null;

            dispatchEvent(new CustomEvent('transparent:nest:esc', { detail: { href: href } }));

            var confirmed = window.confirm(Settings['nest_esc_confirm']);
            if (confirmed) {
                dispatchEvent(new CustomEvent('transparent:nest:esc-confirmed', { detail: { href: href } }));
                api.close();
            } else {
                dispatchEvent(new CustomEvent('transparent:nest:esc-cancelled', { detail: { href: href } }));
            }
        }

        api.close = function(goBack) {

            var container = api.getContainer();
            if (container == null) return;

            closing = true;

            closeShell(container);
            document.body.style.overflow = hostOverflow || '';
            document.title = hostTitle || document.title;
            Transparent.html.removeClass(HTML_CLASS);
            Transparent.html.removeClass('nest-docked'); // no-op if never docked

            // pop the nested history entry; the host page is live underneath
            if (goBack !== false && history.state && history.state.nest) {
                history.back();          // closing stays armed until that popstate lands
                // Backstop only - the popstate handler below is what normally
                // clears `closing`. 500ms was cutting it close on a page with
                // real weight (host page's own JS/CSS doing other work on the
                // same event loop can delay when the browser actually fires
                // the popstate). If the backstop fires FIRST, `closing`
                // clears prematurely and the delayed popstate then reaches
                // __main__ unguarded - treated as a real navigation, i.e.
                // the host page does a full AJAX reload+fade right as the
                // overlay closes. 3s is still far short of "stuck forever"
                // but gives real pages much more headroom.
                setTimeout(function() { closing = false; }, 3000);
            } else {
                closing = false;
            }

            dispatchEvent(new CustomEvent('transparent:nest:close'));
        };

        // host-side half of the ESC handler - see handleEscKeydown's own
        // comment for why the iframe-side half is attached separately,
        // inside mount(), on every single mount rather than once here
        document.addEventListener('keydown', handleEscKeydown, true);

        // hover prefetch: by the time the click lands the page is usually
        // already in the cache, so the overlay opens instantly
        document.addEventListener('mouseover', function(e) {

            if (Settings.disable || !e.target.closest) return;
            if (location.origin === 'null') return; // inside a nest iframe - see the click handler's nest-within-nest guard

            var anchor = e.target.closest('a[href]');
            if (anchor == null) return;

            try {
                var url = new URL(anchor.href, location.origin);
                if (url.origin == location.origin && matchesPatternList(url.pathname, Settings.nest)) api.prefetch(url.href);
            } catch (_) {}
        }, true);

        // capture phase: runs before __main__'s bubble-phase handler and
        // before any click handler of the host page. Links INSIDE the
        // nested iframe belong to the iframe's own document - the host
        // never sees them, the nested app navigates itself.
        // Every same-origin <a href> is a candidate now (no attribute);
        // non-matching links return before preventDefault() with zero side
        // effects, so __main__ still processes them normally afterwards.
        document.addEventListener('click', function(e) {

            if (Settings.disable) return;
            // HARD guard against nest-within-nest: this same code also runs
            // in the nested page's OWN transparentJS instance inside the
            // srcdoc iframe (where location.origin is the literal "null" -
            // see currentOrigin()). A nested document must never open a
            // second overlay level, regardless of how a consumer configures
            // Settings.nest inside it.
            if (location.origin === 'null') return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (e.defaultPrevented) return;

            var anchor = e.target.closest ? e.target.closest('a[href]') : null;
            if (anchor == null || anchor.target == '_blank') return;

            var url;
            try { url = new URL(anchor.href, currentOrigin()); } catch (_) { return; }
            if (url.origin != currentOrigin()) return;
            if (!matchesPatternList(url.pathname, Settings.nest)) return;

            e.preventDefault();
            e.stopImmediatePropagation();
            try { api.open(url.href); }
            catch (err) {
                if (Settings.debug) console.error('Transparent.nest open failed', err);
                window.location.href = url.href;
            }
        }, true);

        // Back closes the overlay; __main__ defers to api.owns() for every
        // popstate the overlay is involved in
        window.addEventListener('popstate', function(e) {

            // `closing` must stay true for the FULL synchronous dispatch of
            // THIS popstate to every listener, not just until this listener
            // has run. window.onpopstate (__main__) and this addEventListener
            // handler both fire for the same event; which one the browser
            // invokes first is not guaranteed to be consistent across engines
            // (confirmed differs between Chromium and WebKit - Safari runs
            // this listener BEFORE __main__'s check). If `closing` is reset
            // synchronously here, a __main__ that runs after this listener
            // (same event, WebKit's actual order) sees an already-cleared
            // flag and processes the close-induced popstate as a real
            // navigation - the host page does a full AJAX reload+fade right
            // as the overlay closes. Deferring the reset to a fresh task
            // lets every listener registered for this one event see
            // `closing===true` during their synchronous handling, regardless
            // of relative order; only after the event has fully finished
            // dispatching does the flag actually clear.
            if (closing) { setTimeout(function() { closing = false; }, 0); return; }

            if (api.isOpen()) {
                if (!(e.state && e.state.nest)) {
                    api.close(false);                  // back onto the host entry
                    return;
                }
                // Back/Forward landed on a DIFFERENT internal nest page
                // (pushed by the iframe-side xhr success handler above) -
                // re-fetch and re-mount it. A fresh fetch rather than
                // restoring some cached DOM: srcdoc replaces the whole
                // inner Document on every mount anyway (nothing durable to
                // restore across that), and the target page may have
                // changed server-side since it was last shown regardless.
                // fetchNested's own settle() naturally skips re-pushing a
                // duplicate entry here (fresh=false, and history.state.nest
                // is already this exact entry).
                var container = api.getContainer();
                var target = e.state.nest.href;
                if (container && container._currentHref !== target) {
                    fetchNested(target, function () { window.location.href = target; });
                }
                return;
            }

            if (e.state && e.state.nest) {
                // forward into a nested entry with no overlay mounted
                // (e.g. after a reload): fall back to a real navigation
                window.location.href = e.state.nest.href;
            }
        }, true);

        return api;
    })();

    Transparent.openNest = Transparent.nest.open;
    Transparent.closeNest = Transparent.nest.close;
    Transparent.isNested = Transparent.nest.isOpen;
    // called from INSIDE the nested iframe: parent.Transparent.notifyNestReady()
    Transparent.notifyNestReady = Transparent.nest.notifyReady;

    return Transparent;
});
