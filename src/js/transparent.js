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
        history.replaceState(state, '', newURL);

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

            var hasScrollableContent = el.scrollWidth > el.clientWidth;

            var overflowStyle   = window.getComputedStyle(el).overflowX;
            var isOverflowScroll = overflowStyle.indexOf('scroll') !== -1;

            return hasScrollableContent && (isOverflowScroll || isDom);

        }.bind(this));
    }

    $.fn.isScrollableY = function() {

        return $(this).map(function(i) {

            var el = this[i] === window ? document.documentElement : this[i];
            var isDom = el == document.documentElement;

            var hasScrollableContent = el.scrollHeight > el.clientHeight;

            var overflowStyle   = window.getComputedStyle(el).overflowY;
            var isOverflowScroll = overflowStyle.indexOf('scroll') !== -1;

            return hasScrollableContent && (isOverflowScroll || isDom);

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
    Transparent.version = '0.1.0';
    
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
        "identifier": "#page",
        "loader": "#loader",
        "smoothscroll_duration": "200ms",
        "smoothscroll_speed"   : 0,
        "smoothscroll_easing"  : "swing",
        "exceptions": [],
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
        "skip_transition_for_cache": false
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

        PREACTIVE  : "pre-active",
        ACTIVEIN   : "active-in",
        ACTIVE     : "active",
        ACTIVEOUT  : "active-out",
        POSTACTIVE : "post-active",

        NOTIFICATION: "notification"
    };

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

    Transparent.setResponse = function(uuid, responseText, scrollableXY, exceptionRaised = false)
    {
        if(isDomEntity(responseText))
            responseText = responseText.outerHTML;

        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        if (!array.includes(uuid)) {

            array.push(uuid);
            while(array.length > Settings["response_limit"])
                sessionStorage.removeItem('transparent['+array.shift()+']');
        }

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

    Transparent.configure = function (options) {

        var key, value;
        for (key in options) {
            value = options[key];
            if (value !== undefined && options.hasOwnProperty(key)) Settings[key] = value;
        }

        return this;
    };

    Transparent.ready = function (options = {}) {

        Transparent.configure({'x-ajax-request': true});
        Transparent.configure(options);

        if(Settings.debug) {

            if (Settings.disable) console.debug("Transparent is disabled..");
            else console.debug("Transparent is running..");
        }

        if(!isReady) dispatchEvent(new Event('transparent:'+Transparent.state.FIRST));

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
            if (hash.test(href)) return [type, new URL(location.origin+location.pathname+href), data];

            return [type, new URL(href, location.origin), data];

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
                return [method, new URL(href, location.origin), form];
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

                return ["GET", new URL(href, location.origin), el];

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
                    return ["POST", new URL(pathname, location.origin), form];
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
            return ["GET", new URL(href, location.origin), form];
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
            el = Transparent.loader[0];

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
        else {

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
            var removeHtmlClass = oldHtmlClass.filter(x => !htmlClass.includes(x) && switchLayout != x && !states.includes(x));

            Transparent.html.removeClass(removeHtmlClass).addClass(htmlClass);
            $(page).insertBefore(oldPage);

            oldPage.remove();

            if(Settings["global_code"] == true) Transparent.evalScript($(page)[0]);
            document.dispatchEvent(new Event('DOMContentLoaded'));
              window.dispatchEvent(new Event('DOMContentLoaded'));

            Transparent.addLayout();

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
        return $(el).find('*').add(el).filter(function() { return $(this).isScrollable(); });
    };

    Transparent.getScrollableElementXY = function() {

        var elementsXY = [];
        var elements = Transparent.getScrollableElement();

        for(i = 0; i < elements.length; i++)
            elementsXY.push([$(elements[i]).scrollTop(), $(elements[i]).scrollLeft()]);

        return elementsXY;
    }

    var ajaxSemaphore = false;
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

    function __main__(e) {

        // Disable transparent JS (e.g. during development..)
        if(Settings.disable) return;

        // Determine link
        const link = Transparent.findLink(e);
        if (link == null) {
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
        for (let i = 0; i < Settings.exceptions.length; i++) {
            let exception = Settings.exceptions[i];
            if (exception instanceof RegExp) {
                if (exception.test(url.pathname)) return;
            } else {
                // Simple wildcard support: * matches any sequence of characters
                let pattern = exception.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                let regex = new RegExp('^' + pattern + '$');
                if (regex.test(url.pathname)) {
                    return;
                }
            }
        }

        // Ressources files rejected
        if (url.pathname.startsWith("/css")) return;
        if (url.pathname.startsWith("/js")) return;
        if (url.pathname.startsWith("/images")) return;
        if (url.pathname.startsWith("/vendor")) return;

        // Unsecure url
        if (url.origin != location.origin) return;

        e.preventDefault();

        if (ajaxSemaphore) return;
        if (url == location) return;

        if((e.type == Transparent.state.CLICK || e.type == Transparent.state.HASHCHANGE) && url.pathname == location.pathname && url.search == location.search && type != "POST") {

            if(!url.hash) return;
            Transparent.scrollToHash(url.hash ?? "", {easing:Settings["smoothscroll_easing"], duration:Settings["smoothscroll_duration"], speed:Settings["smoothscroll_speed"]}, function() {

                if (e.target != undefined && $(e.target).data("skip-hash") != true)
                    window.location.hash = url.hash;

            }, $(e.target).closestScrollable());

            return;
        }

        if(e.metaKey && e.altKey) return window.open(url).focus();
        if(e.metaKey && e.shiftKey) return window.open(url, '_blank').focus(); // Safari not focusing..
        if(e.metaKey || $(target).attr("target") == "_blank") return window.open(url, '_blank');

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

            ajaxSemaphore = false;
            
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

            var dom = new DOMParser().parseFromString(responseText, "text/html");
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
            if(xhr)
                history.pushState({uuid: uuid, status:status, method: method, data: {}, href: responseURL}, '', responseURL);

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

            return Transparent.onLoad(uuid, dom, function() {

                Transparent.activeOut(function() {

                    Transparent.html
                        .removeClass(switchLayout)
                        .removeClass(Transparent.state.SUBMIT)
                        .removeClass(Transparent.state.POPSTATE)
                        .removeClass(Transparent.state.NEW);
                });

            }, type != "POST");
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
            var xhr = new XMLHttpRequest();

            ajaxSemaphore = true;
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

        return handleResponse(history.state.uuid, history.state.status, history.state.method, history.state.data);
    }

    // Update history if not refreshing page or different page (avoid double pushState)
    var href = history.state ? history.state.href : null;
    if (href != location.origin + location.pathname + location.hash)
        history.replaceState({uuid: uuidv4(), status: history.state ? history.state.status : 200, data:{}, method: history.state ? history.state.method : "GET", href: location.origin + location.pathname + location.hash}, '', location.origin + location.pathname + location.hash);

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

        // onbeforeunload: confirm only if the user has actually typed/edited
        // a form input on this page. Pre-Turbo this used a snapshot-and-
        // compare approach (formDataBefore vs formDataAfter) which gave
        // false positives because JS init code mutates form values after
        // load — Select2 writes selected text to hidden fields, Editor.js
        // serializes its JSON to a <textarea>, datepicker normalizes
        // formats, etc. — so by the time the user hit Ctrl+W the snapshot
        // and the current state always differed, and the browser always
        // prompted even on read-only pages.
        //
        // The replacement is the `formDirty` flag declared above, which is
        // set only by trusted (user-originated) `input`/`change` events.
        // No prompt unless the user genuinely typed something.
        window.onbeforeunload = function(e) {

            if(Settings.debug) console.log("Transparent onbeforeunload event called..");

            if(formSubmission) return; // Do not display on form submission
            if(Settings.disable) return;
            if(e.currentTarget == window) return;
            if(!formDirty) return; // ← user hasn't modified anything; no prompt

            Transparent.html.addClass(Transparent.state.READY);
            Transparent.activeOut();
            dispatchEvent(new Event('load'));

            return "Dude, are you sure you want to leave? Think of the kittens!";
        }

        document.addEventListener('click', __main__, false);

        $("form").on("submit", __main__);
    }


    return Transparent;
});
