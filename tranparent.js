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
        "headers": {}
    };

    var isReady = false;

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
            Transparent.showPage();

        isReady = true;
        dispatchEvent(new Event('transparent:ready'));

        return this;
    };

    Transparent.addLayout = function() {

        var name = $("#page")[0].getAttribute("name");
        var isKnown = knownLayout.indexOf(name) !== -1;
        if(!isKnown) knownLayout.push(name);

        return !isKnown;
    }

    Transparent.findNearestForm = function (el) {

        switch (el.tagName) {

            case "INPUT":
            case "BUTTON":
                var form = $(el).closest("form");
                return (form ? form.serializeObject() : null);
        }

        // Try to detect target element
        if (el.target) {

            if (el.target.tagName == "BUTTON" && el.target.getAttribute("type") == "submit")
                return Transparent.findNearestForm(el.target);

            if (el.target.tagName == "INPUT" && el.target.getAttribute("type") == "submit")
                return Transparent.findNearestForm(el.target);
        }

        return null;
    }

    window.popStateOld = document.location.pathname;
    Transparent.findLink = function (el) {

        if (el.type == "popstate") {

            if(!el.state)
                return (window.popStateNew != window.popStateOld ? history.go(-1) : null);

            return ["GET", el.state.urlPath];
        }

        switch (el.tagName) {

            case "A":
                return ["GET", el.getAttribute("href")];

            case "INPUT":
            case "BUTTON":
                var domainBaseURI = el.baseURI.split('/').slice(0, 3).join('/');
                var domainFormAction = el.formAction.split('/').slice(0, 3).join('/');
                var pathname = el.formAction.replace(domainFormAction, "");

                if (domainBaseURI == domainFormAction && el.getAttribute("type") == "submit")
                    return ["POST", pathname];
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
        if (el.target && el.target.getAttribute("href"))
            return ["GET", el.target.getAttribute("href")];
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

        var that = $(el).find("#page");
        for (var i = parents.length - 1, j = 0; i >= 0; i--) {

            if (j++ < from) continue;

            var that = that.children(parents[i].tagName);
            if (that.length != 1) return undefined;
        }

        return that;
    }

    Transparent.isValidResponse = function(htmlResponse, url) {

        // Check if page block found
        var page = $(htmlResponse).find("#page");
        if (!page.length) {
            window.location = url;
            return false;
        }

        return true;
    }

    var knownLayout = [];
    Transparent.isKnownLayout = function(htmlResponse)
    {
        var page = (htmlResponse ? $(htmlResponse).find("#page") : $("#page"));
        if (!page.length) return false;

        var name = $(page)[0].getAttribute("name");
        return knownLayout.indexOf(name) !== -1;
    }

    Transparent.showPage = function(callback = function() {}, delay = 250) {

        if(delay == 0) {

            $("#page").css("visibility", "visible");
            $("#page").css("opacity", 1);
            callback();

        } else {

            $("#page").animate({opacity:1}, delay);
            setTimeout(callback, delay);
        }
    }

    Transparent.hidePage = function(callback = function() {}, delay = 250) {

        if(delay == 0) {

            $("#page").css("visibility", "hidden");
            $("#page").css("opacity", 0);
            callback();

        } else {

            $("#page").animate({opacity:0}, delay);
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

    Transparent.onLoad = function(htmlResponse, callback = function() {}) {

        // Replace canvases
        Transparent.replaceCanvases(htmlResponse);

        // Remove bootstrap tooltip & popover
        $("div[id^='tooltip']").hide().remove();
        $("div[id^='popover']").hide().remove();

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
        var page = $(htmlResponse).find("#page");
        var oldPage = $("#page");

        $(page).insertBefore(oldPage);
        oldPage.remove();

        if(Transparent.addLayout()) {
            $(page).css("visibility", "hidden");
            $(page).css("opacity", 0);
        } else {
            $(page).css("visibility", "visible");
            $(page).css("opacity", 1);
        }

        $('head').append(function() {
            $('#page').append(function() {

                setTimeout(function() {
                    callback(); // Call for showPage if needed, or any other action
                    dispatchEvent(new Event('load'));
                });
            });
        });
    }

    function __main__(e) {

        window.popStateNew = document.location.pathname;

        // Determine link
        const link = Transparent.findLink(e);

        window.popStateOld = document.location.pathname;
        if (link == null) return;

        const type = link[0];
        const url = link[1];
        if (!url) return;

        // Wait for transparent window event to be triggered
        if (!isReady) return;

        // Symfony defaults rejected
        if (url.startsWith("/_profiler")) return;
        if (url.startsWith("/_wdt")) return;

        // Ressources files rejected
        if (url.startsWith("/css")) return;
        if (url.startsWith("/js")) return;
        if (url.startsWith("/images")) return;
        if (url.startsWith("/vendor")) return;

        // Absolute path rejected
        if (!url.startsWith("/")) return;

        dispatchEvent(new Event('onbeforeunload'));
        e.preventDefault();

        // This append on click when user request new state
        // (It is null when dev is pushing or replacing state)
        var addNewState = !e.state;
        if (addNewState) history.pushState({urlPath: url}, '', url);


        function handleResponse(xhr) {

            onHold = true;

            // Proces html response
            var htmlResponse = document.createElement("html");
            $(htmlResponse)[0].innerHTML = xhr.responseText;

            if(!Transparent.isValidResponse(htmlResponse, url))
                return;

            if (Transparent.isKnownLayout(htmlResponse))
                Transparent.onLoad(htmlResponse);
            else Transparent.hidePage(function() {
                 Transparent.onLoad(htmlResponse, Transparent.showPage);
            });
        }

        jQuery.ajax({
            url: url,
            type: type,
            data: Transparent.findNearestForm(e),
            dataType: 'html',
            headers: Settings["headers"] || {},
            success: function (data, status, xhr) {
                return handleResponse(xhr);
            },
            error: function (xhr, ajaxOptions, thrownError) {
                return handleResponse(xhr);
            }
        });
    }

    // Initial push state..
    history.pushState({urlPath: window.location.pathname}, '', window.location.pathname);


    window.onpopstate = __main__;
    document.addEventListener('click', __main__, false);

    return Transparent;
});
