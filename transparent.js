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
        "debug": false,
        "response_text": {},
        "response_limit": 25,
        "throttle": 1000,
        "identifier": "#page",
        "loader": "#loader",
        
        "smoothscroll": 500,

        "exceptions": []
    };

    const State = Transparent.state = {

        READY      : "ready",
        LOADING    : "loading",
        NEW        : "new",
        FIRST      : "first",
        SUBMIT     : "submit",
        POPSTATE   : "popstate",

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


    function isDomEntity(entity) {
        if(typeof entity  === 'object' && entity.nodeType !== undefined){
           return true;
        }
        else{
           return false;
        }
    }

    Transparent.setResponseText = function(uuid, responseText)
    {
        if(isDomEntity(responseText))
            responseText = responseText.outerHTML;

        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
            array.push(uuid);

        while(array.length > Settings["response_limit"])
            sessionStorage.removeItem('transparent['+array.shift()+']');

        if(isLocalStorageNameSupported()) {

            sessionStorage.setItem('transparent', JSON.stringify(array));
            sessionStorage.setItem('transparent['+uuid+']', responseText);
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

        Transparent.activeOut(function() {
            Transparent.html.removeClass(Transparent.state.FIRST);
        });

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
                return (form ? form.serialize() : {});
            case "INPUT":
            case "BUTTON":
                var form = $(el).closest("form");
                return (form ? form.serialize() : {});
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
            return (form ? form.serialize() : {});
        }

        return {};
    }

    window.popStateOld = document.location.pathname;
    Transparent.findLink = function (el) {

        if (el.type == Transparent.state.POPSTATE) {
            
            // Custom action when manipulating user history
            if(!el.state)
                return (window.popStateNew != window.popStateOld ? history.go(-1) : null);

            var href = el.state.href;
            var type = el.state.type;
            var data = Transparent.getData(el.state.uuid);

            var https  = /^https?:\/\//i;
            if (https.test(href)) return [type, new URL(href), data];

            var hash  = /^\#\w*/i;
            if (hash.test(href)) return [type, new URL(location.origin+location.pathname+href), data];

            return [type, new URL(href, location.origin), data];

        } else if(el.type == "submit") {

            if(el.target && el.target.tagName == "FORM") {

                // Action must be prevented here
                // This is specific to form submission
                el.preventDefault();

                var href = el.target.getAttribute("action");
                if(href == null) href = location.pathname;
                if(href.startsWith("#")) href = location.pathname + href;

                var method = el.target.getAttribute("method") || "GET";
                    method = method.toUpperCase();

                var data = Transparent.findNearestForm(el);

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return [method, new URL(href), data];
                return [method, new URL(href, location.origin), data];
            }
        }

        switch (el.tagName) {

            case "A":
                var href = el.getAttribute("href");
                if(href == null) return null;
                if(href.startsWith("#")) href = location.pathname + href;

                var pat  = /^https?:\/\//i;
                if (pat.test(href)) return ["GET", new URL(href), Transparent.findNearestForm(el)];

                return ["GET", new URL(href, location.origin), Transparent.findNearestForm(el)];

            case "INPUT":
            case "BUTTON":
                var domainBaseURI = el.baseURI.split('/').slice(0, 3).join('/');
                var domainFormAction = el.formAction.split('/').slice(0, 3).join('/');
                var pathname = el.formAction.replace(domainFormAction, "");
                if(pathname == null) return null;

                if (domainBaseURI == domainFormAction && el.getAttribute("type") == "submit") {

                    var pat  = /^https?:\/\//i;
                    if (pat.test(href)) return ["POST", new URL(pathname), Transparent.findNearestForm(el)];
                    return ["POST", new URL(pathname, location.origin), Transparent.findNearestForm(el)];
                }
        }

        // Try to detect target element
        if (el.target) {

            if (el.target.tagName == "A" && el.target.getAttribute("href"))
                return Transparent.findLink(el.target);

            if (el.target.tagName == "BUTTON" && el.target.getAttribute("type") == "submit")
                return Transparent.findLink(el.target);

            if (el.target.tagName == "INPUT" && el.target.getAttribute("type") == "submit")
                return Transparent.findLink(el.target);
        }

        // Try to catch a custom href attribute without "A" tag
        if (el.target && el.target.getAttribute("href")) {

            var href = el.target.getAttribute("href");
            if(href == null) return null;
            if(href.startsWith("#")) href = location.pathname + href;

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

        var layout = currentPage.dataset.layout;
        var prevLayout = page.dataset.prevLayout || layout;
        return layout == prevLayout;
    }

    Transparent.parseDuration = function(str) { 

        if(String(str).endsWith("ms")) return parseFloat(String(str))/1000;
        return parseFloat(String(str));
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
        Transparent.callback(function() { 

            Transparent.html.removeClass(Transparent.state.PREACTIVE);
            if(!Transparent.html.hasClass(Transparent.state.ACTIVEIN)) {
                Transparent.html.addClass(Transparent.state.ACTIVEIN);
                dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVEIN));
            }
    
            var active = Transparent.activeTime();
            Transparent.callback(function() { 

                activeCallback(); 
                Transparent.html.removeClass(Transparent.state.ACTIVEIN);
                if(!Transparent.html.hasClass(Transparent.state.ACTIVE)) {
                    Transparent.html.addClass(Transparent.state.ACTIVE);
                    dispatchEvent(new Event('transparent:'+Transparent.state.ACTIVE));
                }
        
        
            }, active.duration);

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

    Transparent.scrollTo = function(dict, callback = function() {})
    {
        scrollTop = dict["top"] ?? window.scrollY;
        scrollLeft = dict["left"] ?? window.scrollX;
        speed = dict["speed"] ?? 0;

        $("html, body").animate({scrollTop: scrollTop, scrollLeft:scrollLeft}, speed, function() {
            
            callback();
            if(speed > 0)
                dispatchEvent(new Event('scroll'));
        });
    }

    Transparent.onLoad = function(identifier, htmlResponse, callback = null, scrollTo = true) {

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

        // Make sure name keeps the same, after a page change when POST or GET called
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

                // Go back to top of the page..
                if(scrollTo) Transparent.scrollTo({top: 0, left:0});
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

    function getElementOffset(el) {
        
        const rect = el.getBoundingClientRect();
        return {left: rect.left + window.scrollX, top: rect.top + window.scrollY};
    }

    function getScrollPadding() {

        var style  = window.getComputedStyle($("html")[0]);

        var dict = {};
            dict["top"] = parseInt(style["scroll-padding-top"]);
            dict["left"] = parseInt(style["scroll-padding-left"]);
        
        if(isNaN(dict["top"])) dict["top"] = 0;
        if(isNaN(dict["left"])) dict["left"] = 0;

        return dict;
    }

    Transparent.scrollToHash = function(hash = window.location.hash)
    {
        if (hash === "") return this;
        if ((''+hash).charAt(0) !== '#') 
            hash = '#' + hash;

        if (hash && $(hash)[0] !== undefined) {

            var scrollTop = getElementOffset($(hash)[0]).top - getScrollPadding().top;
            var scrollLeft = getElementOffset($(hash)[0]).left - getScrollPadding().left;

            Transparent.scrollTo(
                {top:Math.ceil(scrollTop), left:Math.ceil(scrollLeft), speed: Settings["smoothscroll"]}, 
                function() { window.location.hash = hash; }
            );
        }

        return this;
    }

    function __main__(e) {

        // Disable transparent JS for development..
        if(Settings.debug) return;

        // Prevent double transitions..
        if(Transparent.html.hasClass(Transparent.state.LOADING))
            return e.preventDefault();

        // Determine link and popState
        window.popStateNew = document.location.pathname;

        const link = Transparent.findLink(e);
        dispatchEvent(new Event('transparent:link', {link:link}));

        window.popStateOld = document.location.pathname;
        if (link == null) return;

        const uuid = uuidv4();
        const type = link[0];
        const url  = link[1];
        const data = link[2];
        if  (!url) return;

        // Wait for transparent window event to be triggered
        if (!isReady) return;

        if(e.type != Transparent.state.POPSTATE && !$(this).find(Settings.identifier).length) return;

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

        if(url.pathname == location.pathname && (url.hash || window.location.hash) && type != "POST") {

            history.replaceState(history.state, ' ');
            Transparent.scrollToHash(url.hash);
            return;
        }

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
            if (!Transparent.isKnownLayout(htmlResponse)) {
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

                    Transparent.activeOut(function() {

                        console.log("prevLayout", prevLayout, newLayout);
                        Transparent.html
                            .removeClass(prevLayout+"-to-"+newLayout)
                            .removeClass(Transparent.state.SUBMIT)
                            .removeClass(Transparent.state.POPSTATE)
                            .removeClass(Transparent.state.NEW);
                    });

                }, addNewState && method != "POST");
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
                success: function (html, status, request) {
                    return handleResponse(uuid, request.status, type, data, xhr, request);
                },
                error:   function (request, ajaxOptions, thrownError) { 
                    return handleResponse(uuid, request.status, type, data, xhr, request);
                }
            });
        }

        return handleResponse(history.state.uuid, history.state.status, history.state.method, history.state.data);
    }

    // Update history if not refreshing page or different page (avoid double pushState)
    var href = history.state ? history.state.href : null;
    if (href != location.pathname+location.hash)
        history.replaceState({uuid: uuidv4(), status: history.state ? history.state.status : 200, data:{}, method: history.state ? history.state.method : "GET", href: location.pathname+location.hash}, '', location.pathname+location.hash);

    // Overload onpopstate
    if(!Settings.debug) {

        window.onpopstate = __main__;
        document.addEventListener('click', __main__, false);        
        $("form").submit(__main__);
    }

    return Transparent;
});
