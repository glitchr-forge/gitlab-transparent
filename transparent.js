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

(function(namespace) {

    namespace.replaceHash = function(newhash, triggerHashChange = true, skipIfEmptyIdentifier = true) {

        if (!newhash) newhash = "";
        if (newhash !== "" && (''+newhash).charAt(0) !== '#')
            newhash = '#' + newhash;

        var oldURL = location.origin+location.pathname+location.hash;
        var newURL = location.origin+location.pathname+newhash;
        if(oldURL == newURL) return false;

        if(skipIfEmptyIdentifier && $(newhash).length === 0)
        {
            dispatchEvent(new HashChangeEvent("hashfallback", {oldURL:oldURL, newURL:newURL}));
            newHash = "";

            oldURL = location.origin+location.pathname+location.hash;
            newURL = location.origin+location.pathname+newhash;
            return oldURL != newURL;
        }

        var state = Object.assign({}, history.state, {href: newURL});
        history.replaceState(state, '', newURL);

        if(triggerHashChange)
            dispatchEvent(new HashChangeEvent("hashchange", {oldURL:oldURL, newURL:newURL}));


        return true;
    }

})(window);

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

;(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Transparent = factory();
    }

})(this, function () {

    var Transparent = {};
        Transparent.version = '0.1.0';

    var Settings = Transparent.settings = {
        "headers": {},
        "data": {},
        "disable":false,
        "debug": false,
        "response_text": {},
        "response_limit": 25,
        "throttle": 1000,
        "identifier": "#page",
        "loader": "#loader",
        "smoothscroll_duration": "200ms",
        "smoothscroll_speed"   : 0,
        "smoothscroll_easing"  : "swing",
        "exceptions": []
    };

    const State = Transparent.state = {

        READY      : "ready",
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
    };

    var isReady    = false;
    var rescueMode = false;

    Transparent.html = $($(document).find("html")[0]);
    Transparent.html.addClass("transparent " + Transparent.state.LOADING + " " + Transparent.state.FIRST);

    if(!Transparent.html.hasClass(Transparent.state.ACTIVE)) {
        Transparent.html.addClass(Transparent.state.ACTIVE);
        dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVE));
    }

    window.addEventListener("DOMContentLoaded", function()
    {
        Transparent.loader = $($(document).find(Settings.loader)[0] ?? Transparent.html);
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
        return sessionStorage.getItem('transparent['+uuid+']') || null;
    }

    function isDomEntity(entity)
    {
        return typeof entity  === 'object' && entity.nodeType !== undefined;
    }

    Transparent.setResponseText = function(uuid, responseText, exceptionRaised = false)
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
                sessionStorage.setItem('transparent['+uuid+']', responseText);
            }

        } catch(e) {

            if (e.name === 'QuotaExceededError')
                sessionStorage.clear();

            return exceptionRaised === false ? Transparent.setResponseText(uuid, responseText, true) : this;
        }

        return this;
    }


    Transparent.hasResponseText = function(uuid)
    {
        if(isLocalStorageNameSupported())
            return 'transparent['+uuid+']' in sessionStorage;

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

        isReady = true;

        dispatchEvent(new Event('transparent:'+Transparent.state.READY));
        Transparent.html.addClass(Transparent.state.READY);

        Transparent.addLayout();

        Transparent.scrollToHash(location.hash);
        Transparent.activeOut(() => Transparent.html.removeClass(Transparent.state.FIRST));

        return this;
    };

    Transparent.addLayout = function() {

        var id = Transparent.getLayout();
        if(id === undefined) return false;

        var isKnown = knownLayout.indexOf(id) !== -1;
        if(!isKnown) knownLayout.push(id);

        return !isKnown;
    }

    Transparent.getLayout = function(htmlResponse = null) {

        var layout = htmlResponse !== null ? $(htmlResponse).find(Settings.identifier) : $(Settings.identifier);
        if(!layout.length) return undefined;

        return layout.data("layout");
    }

    Transparent.findNearestForm = function (el) {

        switch (el.tagName) {
            case "FORM":
                var form = $(el);
                return (form.length ? form.serialize() : null);
            case "INPUT":
            case "BUTTON":
                var form = $(el).closest("form");
                return (form.length ? form.serialize() : null);
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
            return (form.length ? form.serialize() : null);
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

                // Action must be prevented here
                // This is specific to form submission
                el.preventDefault();

                var href = el.target.getAttribute("action");
                if(!href) href = location.pathname + href;

                if (href.startsWith("#")) href = location.pathname + href;
                if (href.endsWith  ("#")) href = href.slice(0, -1);

                var method = el.target.getAttribute("method") || "GET";
                    method = method.toUpperCase();

                var data = Transparent.findNearestForm(el);
                if (data == null) return null;

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return [method, new URL(href), data];
                return [method, new URL(href, location.origin), data];
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

                var data = Transparent.findNearestForm(el);
                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return ["GET", new URL(href),];

                return ["GET", new URL(href, location.origin), data];

            case "INPUT":
            case "BUTTON":
                var domainBaseURI = el.baseURI.split('/').slice(0, 3).join('/');
                var domainFormAction = el.formAction.split('/').slice(0, 3).join('/');
                var pathname = el.formAction.replace(domainFormAction, "");
                if(!pathname) return null;

                if (domainBaseURI == domainFormAction && el.getAttribute("type") == "submit") {

                    var data = Transparent.findNearestForm(el);
                    if (data == null) {
                        console.error("No form found upstream of ", el);
                        return null;
                    }

                    var data = Transparent.findNearestForm(el);
                    if (data == null) {
                        console.error("No form found upstream of ", el);
                        return null;
                    }

                    var pat  = /^https?:\/\//i;
                    if (pat.test(href)) return ["POST", new URL(pathname), data];
                    return ["POST", new URL(pathname, location.origin), data];
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

            var pat  = /^https?:\/\//i;
            if (pat.test(href)) return ["GET", new URL(href), Transparent.findNearestForm(el)];
            return ["GET", new URL(href, location.origin), Transparent.findNearestForm(el)];
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

    Transparent.isPage = function(htmlResponse) {

        // Check if page block found
        var page = $(htmlResponse).find(Settings.identifier)[0] || undefined;
        if (page === undefined) return false;

        return true;
    }

    var knownLayout = [];
    Transparent.isKnownLayout = function(htmlResponse)
    {
        var page = (htmlResponse ? $(htmlResponse).find(Settings.identifier) : $(Settings.identifier))[0];
        if (page === undefined) return false;

        var layout = page.dataset.layout;

        return knownLayout.indexOf(layout) !== -1;
    }

    Transparent.isCompatibleLayout = function(htmlResponse, method = null, data = null)
    {
        // If no html response.. skip
        if(!htmlResponse) return false;

        // An exception applies here..
        // in case the page contains data transferred to the server
        if(method == "POST" && !jQuery.isEmptyObject(data)) return true;

        var page = $(htmlResponse).find(Settings.identifier)[0] || undefined;
        if (page === undefined) return false;

        var currentPage = $(Settings.identifier)[0] || undefined;
        if (currentPage === undefined) return false;

        var name  = currentPage.dataset.name || "default";
        var prevName = page.dataset.prevName || name;

        var layout = currentPage.dataset.layout;
        var prevLayout = page.dataset.prevLayout || layout;

        return name == prevName && layout == prevLayout;
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

    Transparent.activeIn = function(activeCallback = function() {}) {

        if(!Transparent.html.hasClass(Transparent.state.PREACTIVE)) {
            Transparent.html.addClass(Transparent.state.PREACTIVE);
            dispatchEvent(new Event('transparent:'+Transparent.state.PREACTIVE));
        }

        var active = Transparent.activeTime();

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
                if(!Transparent.html.hasClass(Transparent.state.POSTACTIVE)){

                    Transparent.html.removeClass(Transparent.state.POSTACTIVE);
                    dispatchEvent(new Event('transparent:'+Transparent.state.POSTACTIVE));
                }

                if(Transparent.html.hasClass(Transparent.state.LOADING)) {

                    dispatchEvent(new Event('transparent:load'));

                    Object.values(Transparent.state).forEach(e => Transparent.html.removeClass(e));
                    Transparent.html.addClass(Transparent.state.READY);

                } else {

                    Transparent.html.removeClass(Transparent.state.POSTACTIVE);
                }

            }, active.duration);

        }.bind(this), active.delay);
    }

    Transparent.replaceCanvases = function(htmlResponse) {

        // Extract existing canvas to avoid redrawing them.. (time consuming)
        $.each($('html').find("canvas"), function () {

            var parent = $(this).parent();
            if(!parent.length) return;

            var id = this.getAttribute("id");
            if (id) {

                var canvas = $(htmlResponse).find("#page #" + id);
                canvas.replaceWith(this);

            } else {

                if(htmlResponse === undefined)
                    console.alert("Response missing..");

                var parent = Transparent.findElementFromParents(htmlResponse, $(this).parents(), 3);
                if (parent === undefined) {
                    console.error("Unexpected canvas without ID found..", this)
                    return false;
                }

                parent.append(this);
            }
        });
    }

    Transparent.rescue = function(htmlResponse)
    {
        console.error("Rescue mode.. called");
        rescueMode = true;

        function nodeScriptReplace(node) {
            if ( nodeScriptIs(node) === true ) {
                    node.parentNode.replaceChild( nodeScriptClone(node) , node );
            }
            else {
                    var i = -1, children = node.childNodes;
                    while ( ++i < children.length ) {
                          nodeScriptReplace( children[i] );
                    }
            }

            return node;
        }

        function nodeScriptClone(node){
                var script  = document.createElement("script");
                script.text = node.innerHTML;

                var i = -1, attrs = node.attributes, attr;
                while ( ++i < attrs.length ) {
                    script.setAttribute( (attr = attrs[i]).name, attr.value );
                }
                return script;
        }

        function nodeScriptIs(node) {
                return node.tagName === 'SCRIPT';
        }

        document.head.innerHTML = $(htmlResponse).find("head").html();
        document.body.innerHTML = $(htmlResponse).find("body").html();
        nodeScriptReplace($("head")[0]);
        nodeScriptReplace($("body")[0]);
    }

    Transparent.userScroll = function(el = window) { return $(el).prop("userscroll"); }
    Transparent.scrollTo = function(dict, callback = function() {}, el = window)
    {
        var origin = el;
        if (el === window  )
            el = document.documentElement;
        if (el === document)
            el = document.documentElement;

        var cancelable = dict["cancelable"] ?? false;
        if(cancelable && $(el).prop("cancel")) $(el).stop();

        if(Transparent.userScroll(el)) {

            if(cancelable) {

                $(el).prop("cancel", true);
                $(el).on("scroll.userscroll mousedown.userscroll wheel.userscroll DOMMouseScroll.userscroll mousewheel.userscroll touchmove.userscroll", function(e) {
                    $(this).prop("user-scroll", true);
                });
            }

        } else {

            $(el).prop("user-scroll", false);
        }

        scrollTop  = dict["top"] ?? el.scrollTop;
        scrollLeft = dict["left"] ?? el.scrollLeft;

        speed    = parseFloat(dict["speed"] ?? 0);
        easing   = dict["easing"] ?? "swing";
        debounce = dict["debounce"] ?? 0;
        duration = 1000*Transparent.parseDuration(dict["duration"] ?? 0);
        if(speed) {

            var distance = scrollTop - window.offsetTop - window.scrollY;
            duration = speed ? 1000*distance/speed : duration;
        }

        if(duration == 0) {

            $(el).scrollTop = scrollTop;
            $(el).scrollLeft = scrollLeft;

            origin.dispatchEvent(new Event('scroll'));
            callback();

            $(el).prop("user-scroll", true);

        } else {

            $(el).animate({scrollTop: scrollTop}, duration, easing, Transparent.debounce(function() {

                if(cancelable)
                    $(el).off("scroll.user mousedown.user wheel.user DOMMouseScroll.user mousewheel.user touchmove.user", () => null);

                origin.dispatchEvent(new Event('scroll'));
                callback();

                $(el).prop("user-scroll", true);

            }, debounce));
        }

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

    var memory = [];
    Transparent.fileLoaded =
    Transparent.inMemory = function(el) {

        // TO BE DONE. (PRELOAD IMAGES ON PRIORITY)
        if(element in memory) return true;

        $(el).each(function() {

            var isImage = this.tagName == "IMG";
            console.log(isImage);

            $(this).addClass('fadein');
            $(this).on('load.transparent', function() {

                $(this).removeClass('fadein');

                iImages++;
                console.log(this.src, iImages, nImages);
                if(iImages >= nImages) {
                    console.log("YAY !");
                }
            });
        });
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

    Transparent.onLoad = function(identifier, htmlResponse, callback = null) {

        window.previousLocation = window.location.toString();
        if(callback === null) callback = function() {};

        // Replace canvases..
        Transparent.replaceCanvases(htmlResponse);

        // Replace head..
        var head = $(htmlResponse).find("head");
        $("head").children().each(function() {

            var el   = this;
            var found = false;

            head.children().each(function() {

                found = this.isEqualNode(el);
                return !found;
            });

            if(!found) this.remove();
        });

        head.children().each(function() {

            var el   = this;
            var found = false;

            $("head").children().each(function() {
                found = this.isEqualNode(el);
                return !found;
            });

            if(!found) $("head").append(this);
        });

        // Extract page block to be loaded
        var page = $(htmlResponse).find(identifier);
        var oldPage = $(identifier);

        // Make sure name/layout keep the same after a page change (tolerance for POST or GET requests)
        if  (page.data("name") == oldPage.data("name")) delete page.removeData("prevName");
        else page.data("prevName", oldPage.data("name"));

        if  (page.data("layout") == oldPage.data("layout")) delete page.removeData("prevLayout");
        else page.data("prevLayout", oldPage.data("layout"));

        // Apply changes
        $(page).insertBefore(oldPage);

        oldPage.remove();

        Transparent.addLayout();

        $('head').append(function() {

            $(identifier).append(function() {

                // Callback if needed, or any other actions
                callback();

                // Trigger onload event
                dispatchEvent(new Event('transparent:load'));
                dispatchEvent(new Event('load'));
            });
        });
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
    Transparent.percentToPixel = function(p , el)  { return parseFloat(p  ) * el.outerWidth(); }
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

    Transparent.scrollToHash = function(hash = window.location.hash, options = {}, callback = function() {})
    {
        if (hash === "") options = Object.assign({duration: Settings["smoothscroll_duration"], speed: Settings["smoothscroll_speed"]}, options, {left:0, top:0});
        else {

            if ((''+hash).charAt(0) !== '#')
                hash = '#' + hash;

            var hashElement = $(hash)[0] ?? undefined;
            if (hashElement !== undefined) {

                var scrollTop  = hashElement.getBoundingClientRect().top  + document.documentElement.scrollTop - Transparent.getScrollPadding().top;
                var scrollLeft = hashElement.getBoundingClientRect().left + document.documentElement.scrollTop - Transparent.getScrollPadding().left;

                options = Object.assign({duration: Settings["smoothscroll_duration"], speed: Settings["smoothscroll_speed"]}, options, {left:scrollLeft, top:scrollTop});
            }
        }

        var bottomReach = document.body.scrollHeight - (window.scrollY + window.innerHeight) < 1;
        var bottomOverflow = scrollTop > window.scrollY + window.innerHeight;

        if(bottomReach && bottomOverflow) callback();
        else Transparent.scrollTo(options, callback);

        return this;
    }

    function __main__(e) {

        // Disable transparent JS (e.g. during development..)
        if(Settings.disable) return;

        // Determine link
        const link = Transparent.findLink(e);
        if   (link == null) return;

        dispatchEvent(new CustomEvent('transparent:link', {link:link}));

        const uuid = uuidv4();
        const type = link[0];
        const url  = link[1];
        const data = link[2];
        if  (!url) return;

        // Wait for transparent window event to be triggered
        if (!isReady) return;

        if (e.type != Transparent.state.POPSTATE   &&
            e.type != Transparent.state.HASHCHANGE && !$(this).find(Settings.identifier).length) return;

        // Specific page exception
        for(i = 0; i < Settings.exceptions.length; i++) {

            exception = Settings.exceptions[i];
            if (url.pathname.startsWith(exception)) return;
        }

        // Ressources files rejected
        if (url.pathname.startsWith("/css")) return;
        if (url.pathname.startsWith("/js")) return;
        if (url.pathname.startsWith("/images")) return;
        if (url.pathname.startsWith("/vendor")) return;

        // Unsecure url
        if (url.origin != location.origin) return;

        e.preventDefault();
        if (url == location) return;

        if((e.type == Transparent.state.CLICK || e.type == Transparent.state.HASHCHANGE) && url.pathname == location.pathname && type != "POST") {

            Transparent.scrollToHash(url.hash ?? "", {easing:Settings["smoothscroll_easing"], duration:Settings["smoothscroll_duration"], speed:Settings["smoothscroll_speed"]}, function() {
                
                if (e.target !== undefined && $(e.target).data("skip-hash") !== true)
                    window.replaceHash(url.hash);
            });

            return;
        }
        
        console.log("OKKK", url);

        if(e.metaKey && e.altKey) return window.open(url).focus();
        if(e.metaKey && e.shiftKey) return window.open(url, '_blank').focus(); // Safari not focusing..
        if(e.metaKey) return window.open(url, '_blank');

        dispatchEvent(new Event('transparent:onbeforeunload'));
        dispatchEvent(new Event('onbeforeunload'));

        function handleResponse(uuid, status = 200, method = null, data = null, xhr = null, request = null) {

            var htmlResponse = document.createElement("html");
            var responseText = Transparent.getResponseText(uuid);
            var responseURL  = (xhr ? xhr.responseURL : null) || url.href;
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

                if(!Transparent.hasResponseText(uuid))
                    Transparent.setResponseText(uuid, responseText);
            }

            if(!responseText) {
                console.error("No response found.");
                return window.location.href = responseURL;
            }

            var matches = responseText.match(/<html (.*)>/);
            if (matches !== null) {

                var objectResponse = document.createElement("html");
                $(objectResponse)[0].innerHTML = "<object " + matches[1] + "></object>";

                Object.values(Transparent.state).forEach(e => Transparent.html.removeClass(e));

                var addClass = $(objectResponse).find("object").attr("class");
                var removeClass = $("html").attr("class").replace(/transparent.*/i, "");
                Object.values(Transparent.state).forEach(e => removeClass.replace(e, ""));

                Transparent.html
                    .removeClass(removeClass)
                    .addClass(addClass)
                    .addClass(Transparent.state.READY);
            }

            $(htmlResponse)[0].innerHTML = responseText;

            // Error detected..
            if(status >= 500) {

                // Add new page to history..
                if(xhr) history.pushState({uuid: uuid, status:status, method: method, data: data, href: responseURL}, '', responseURL);

                // Call rescue..
                return Transparent.rescue(htmlResponse);
            }

            // Page not recognized.. just go there.. no POST information transmitted..
            if(!Transparent.isPage(htmlResponse))
                return window.location.href = responseURL;

            // Layout not compatible.. needs to be reloaded (exception when POST is detected..)
            if(!Transparent.isCompatibleLayout(htmlResponse, method, data))
                return window.location.href = responseURL;

            // From here the page is valid..
            // so new page added to history..
            if(xhr) history.pushState({uuid: uuid, status:status, method: method, data: data, href: responseURL}, '', responseURL);

            // Mark layout as known
            if(!Transparent.isKnownLayout(htmlResponse)) {

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
            var newLayout = Transparent.getLayout(htmlResponse);
            Transparent.html.addClass(prevLayout+"-to-"+newLayout);
            dispatchEvent(new Event('transparent:'+prevLayout+'-to-'+newLayout));

            Transparent.html.addClass(Transparent.state.LOADING);

            return Transparent.activeIn(function() {

                Transparent.onLoad(Settings.identifier, htmlResponse, function() {

                    // Go back to top of the page..
                    Transparent.scrollToHash(location.hash, {duration:0});
                    Transparent.activeOut(function() {

                        Transparent.html
                            .removeClass(prevLayout+"-to-"+newLayout)
                            .removeClass(Transparent.state.SUBMIT)
                            .removeClass(Transparent.state.POPSTATE)
                            .removeClass(Transparent.state.NEW);
                    });

                }, method != "POST" /* avoid to return to top of page when submitting form */);
            });
        }

        if(history.state && !Transparent.hasResponseText(history.state.uuid))
            Transparent.setResponseText(history.state.uuid, $("html")[0]);

        // This append on user click (e.g. when user push a link)
        // It is null when dev is pushing or replacing state
        var addNewState = !e.state;
        if (addNewState) {

            // Submit ajax request..
            var xhr = new XMLHttpRequest();
            return jQuery.ajax({
                url: url.href,
                type: type,
                data: data,
                dataType: 'html',
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

    // Overload onpopstate
    if(Settings.disable) {

        var removeClass = $(Transparent.html).attr("class").replace(/transparent.*/i, "");
        Transparent.html.removeClass(removeClass).addClass(Transparent.state.READY+" "+Transparent.state.DISABLE);

    } else {

        window.onpopstate   = __main__; // Onpopstate pop out straight to previous page.. this creates a jump while changing pages with hash..
        window.onhashchange = __main__;
        document.addEventListener('click', __main__, false);
        $("form").submit(__main__);
    }

    return Transparent;
});
