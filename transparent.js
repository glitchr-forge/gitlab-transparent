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
        "linkExceptions": ["/_wdt", "/_profiler"]
    };

    var isReady    = false;
    var rescueMode = false;

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
        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];

        // Bubble up the most recent uuid
        var index = array.indexOf(uuid);
        if (index > -1) {
            array.splice(index, 1);
            array.push(uuid);
        }

        // If no response refresh page based on the requested url
        return sessionStorage.getItem('transparent['+uuid+']') || null;
    }

    Transparent.setResponseText = function(uuid, responseText)
    {
        // Remove older uuid response in the limit of the response buffer..
        var array = JSON.parse(sessionStorage.getItem('transparent')) || [];
        if(!array.length)
            Object.keys(sessionStorage) .filter(function(k) { return /transparent\[.*\]/.test(k); })
                  .forEach(function(k) { sessionStorage.removeItem(k); });

        array.push(uuid);
        while(array.length > Settings["response_limit"])
            sessionStorage.removeItem('transparent['+array.shift()+']');

        if(isLocalStorageNameSupported()) {
            sessionStorage.setItem('transparent', JSON.stringify(array));
            sessionStorage.setItem('transparent['+uuid+']', responseText);
        }
        return this;
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

        if(Transparent.addLayout()) // Return true if layout is added
            Transparent.transitionIn();

        isReady = true;
        dispatchEvent(new Event('transparent:ready'));

        return this;
    };

    Transparent.addLayout = function() {

        var layout = $(Settings.identifier);
        if(!layout.length) return false;

        var id = layout.data("layout");
        
        var isKnown = knownLayout.indexOf(id) !== -1;
        if(!isKnown) knownLayout.push(id);

        return !isKnown;
    }

    Transparent.findNearestForm = function (el) {

        switch (el.tagName) {
            case "FORM":
                var form = $(el);
                return (form ? form.serializeObject() : {});
            case "INPUT":
            case "BUTTON":
                var form = $(el).closest("form");
                return (form ? form.serializeObject() : {});
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
            return (form ? form.serializeObject() : {});
        }

        return {};
    }

    window.popStateOld = document.location.pathname;
    Transparent.findLink = function (el) {

        if (el.type == "popstate") {
            
            // Custom action when manipulating user history
            if(!el.state)
                return (window.popStateNew != window.popStateOld ? history.go(-1) : null);

            var href = el.state.href;
            var type = el.state.type;
            var data = Transparent.getData(el.state.uuid);

            var pat  = /^https?:\/\//i;
            if (pat.test(href)) return [type, new URL(href), data];
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

    Transparent.transitionIn = function(callback = function() {}, delay = 250) {

        if(delay == 0) {

            $(Settings.identifier).css("visibility", "visible");
            $(Settings.identifier).css("opacity", 1);
            callback();

        } else {

            $(Settings.identifier).animate({opacity:1}, delay);
            setTimeout(callback, delay);
        }
    }

    Transparent.transitionOut = function(callback = function() {}, delay = 250) {

        if(delay == 0) {

            $(Settings.identifier).css("visibility", "hidden");
            $(Settings.identifier).css("opacity", 0);
            callback();

        } else {

            $(Settings.identifier).animate({opacity:0}, delay);
            setTimeout(callback, delay);
        }
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
                    console.alert("htmlResponse missing..");

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

    Transparent.onLoad = function(identifier, htmlResponse, callback = null, scrollTo = true) {

        if(callback === null) callback = function() {};

        // Replace canvases
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
        if  (page.data.layout == oldPage.data.layout) delete page.data.prevLayout;
        else page.data.prevLayout  = oldPage.data.layout;

        // Apply changes
        $(page).insertBefore(oldPage);
        oldPage.remove();

        if(Transparent.addLayout()) {
            $(page).css("visibility", "hidden");
            $(page).css("opacity", 0);
        } else {
            $(page).css("visibility", "visible");
            $(page).css("opacity", 1);
        }

        var currentScroll = window.scrollY;
        $('head').append(function() {
            $(identifier).append(function() {

                // Callback if needed, or any other action (e.g. call for transitionIn..)
                callback();

                // Trigger onload event
                dispatchEvent(new Event('load'));

                // Go back to top of the page..
                if(scrollTo && window.location.hash === "") {

                    if(currentScroll == window.scrollY)
                        window.scrollTo({top: 0, behavior: 'auto'});
                }
            });
        });
    }

    function uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    }

    function isLocalStorageNameSupported() 
    {
        var testKey = 'test', storage = window.sessionStorage;
        try 
        {
            storage.setItem(testKey, '1');
            storage.removeItem(testKey);
            return localStorageName in win && win[localStorageName];
        } 
        catch (error) 
        {
            return false;
        }
    }

    function __main__(e) {

        // Determine link and popState
        window.popStateNew = document.location.pathname;
        const link = Transparent.findLink(e);
        window.popStateOld = document.location.pathname;
        if (link == null || Settings.debug) return;
        
        const uuid = uuidv4();
        const type = link[0];
        const url  = link[1];
        const data = link[2];
        if  (!url) return;

        // Wait for transparent window event to be triggered
        if (!isReady) return;

        if(e.type != "popstate" && ! $(this).find(Settings.identifier).length) return;

        // Symfony defaults rejected
        for(i = 0; i < Settings.linkExceptions.length; i++) {

            linkException = Settings.linkExceptions[i];
            if (url.pathname.startsWith(linkException)) return;
        }

        // Ressources files rejected
        if (url.pathname.startsWith("/css")) return;
        if (url.pathname.startsWith("/js")) return;
        if (url.pathname.startsWith("/images")) return;
        if (url.pathname.startsWith("/vendor")) return;

        // Unsecure url
        if (url.origin != location.origin) return;
        e.preventDefault();

        if(url.pathname == location.pathname && (url.hash || window.location.hash) && e.type != "popstate" && type != "POST") {
            
            history.replaceState(history.state, ' ');
            if (url.hash) window.location.hash = url.hash;
            return;
        }

        dispatchEvent(new Event('onbeforeunload'));

        function handleResponse(uuid, status = 200, method = null, data = null, xhr = null, request = null) {

            var htmlResponse = document.createElement("html");
            var responseText = Transparent.getResponseText(uuid);

            if(!responseText) {

                if(!request) {

                    console.error("No XHR response from "+uuid+" : missing request.");
                    console.error(sessionStorage);

                    setTimeout(function() { window.location.href = url.href; }, Settings["throttle"]);
                    return;
                }

                responseText = request.responseText;
                if(status >= 500) {

                    console.error("Unexpected XHR response from "+uuid+": error code "+request.status);
                    console.error(sessionStorage);
                }

                Transparent.setResponseText(uuid, responseText);
            }

            $(htmlResponse)[0].innerHTML = responseText;

            // Error detected..
            if(status >= 500) {

                // Add new page to history..
                if(xhr) history.pushState({uuid: uuid, status:status, method: method, data: data, href: xhr.responseURL}, '', xhr.responseURL);

                // Call rescue..
                return Transparent.rescue(htmlResponse);
            }

            // Page not recognized.. just go there.. no POST information transmitted.. 
            if(!Transparent.isPage(htmlResponse))
                return window.location.href = url.href;

            // Layout not compatible.. needs to be reloaded (exception when POST is detected..)
            if(!Transparent.isCompatibleLayout(htmlResponse, method, data))
                return window.location.href = url.href;

            // From here the page is valid.. 
            // so new page added to history..
            if(xhr) history.pushState({uuid: uuid, status:status, method: method, data: data, href: xhr.responseURL}, '', xhr.responseURL);

            if (Transparent.isKnownLayout(htmlResponse))
                return Transparent.onLoad(Settings.identifier, htmlResponse, null, addNewState && method != "POST");

            return Transparent.transitionOut(function() {
                Transparent.onLoad(Settings.identifier, htmlResponse, Transparent.transitionIn, addNewState && method != "POST");
            });
        }

        if(history.state && !Transparent.getResponseText(history.state.uuid))
            Transparent.setResponseText(history.state.uuid, $("html")[0].innerHTML);

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
