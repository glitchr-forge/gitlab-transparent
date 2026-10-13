// Ajaxer - named AJAX channels over jQuery's $.ajax: a channel has its url,
// method, output and target set once (Ajaxer.setUrl('search', '/search'), ...),
// then Ajaxer.send('search', data, success, error, complete) sends, throttled
// and debounced per channel, with a loader (.ajaxer-loader, after a delay) in
// the target, the "ajaxer-call" / "ajaxer-success" / "ajaxer-error" classes on
// it, a retry on failure and a limit of requests in flight (the oldest aborted,
// or the new one refused, as `cancelable` says). What it shares with the other
// modules - the durations ("250ms"), $.fn.serializeObject - is the core's.
(function (root, factory) {

    var core = root.Flow && root.Flow.core === true ? root.Flow : (typeof require === 'function' ? require('./core.js') : null);
    if (!core) throw new Error('ajaxer.js: load core.js first');

    var api = factory(root, core, core.jquery());
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.Ajaxer = api;
    core.ajaxer = api;

})(typeof window !== 'undefined' ? window : this, function (window, Flow, $) {

    if (!$) throw new Error('ajaxer.js: jQuery is needed');
    var document = window.document;

    const Ajaxer = window.Ajaxer = {};
          Ajaxer.version = '1.0.56';

    const defaultAjaxer  = {
        method:"POST",
        output: "json",
        cancelable: false,
        retry_limit:1,
        throttle:1000,
        debounce:0,
        loader_debounce:1500,
    };

    Ajaxer.settings = defaultAjaxer;

    let debug = false;
    let ready = false;

    Ajaxer.clear = function() {

        Ajaxer.settings = defaultAjaxer;
        Ajaxer.abortAll();
    }

    // A duration in milliseconds. A number is milliseconds as it stands; a string with a
    // unit is what it says ("250ms", "1s", or several, "1s, 250ms": the longest); a string
    // without one ("250") is milliseconds too. Anything unreadable is 0 (off).
    Ajaxer.parseTime = function (value) {

        if (typeof value === "number") return isFinite(value) ? value : 0;
        if (value === undefined || value === null) return 0;

        const list = String(value).trim().split(/\s*,\s*/).map(function (t) {
            if (/ms$/.test(t)) return parseFloat(t);
            if (/s$/.test(t)) return 1000 * parseFloat(t);
            return parseFloat(t);
        });
        const longest = Math.max.apply(Math, list);
        return isFinite(longest) ? longest : 0;
    };

    Ajaxer.ready = function (list = {}, options = {}) {

        if("debug" in options)
            debug = options["debug"];

        Ajaxer.configure(options);
        if(Array.isArray(list) && list.length)
            Ajaxer.configure({list: list});

        ready = true;

        if (debug) console.debug("Ajaxer is ready.");
        dispatchEvent(new Event('Ajaxer:ready'));

        return this;
    };

    Ajaxer.get = function(key) {

        if(key in Ajaxer.settings)
            return Ajaxer.settings[key];

        return null;
    };

    Ajaxer.set = function(key, value) {

        Ajaxer.settings[key] = value;
        return this;
    };

    Ajaxer.add = function(key, value) {

        if(! (key in Ajaxer.settings))
            Ajaxer.settings[key] = [];

        if (Ajaxer.settings[key].indexOf(value) === -1)
            Ajaxer.settings[key].push(value);

        return this;
    };

    Ajaxer.remove = function(key, value) {

        if(key in Ajaxer.settings) {

            Ajaxer.settings[key] = Ajaxer.settings[key].filter(function(setting) {
                return value !== setting;
            });

            return Ajaxer.settings[key];
        }

        return null;
    };

    Ajaxer.configure = function (options) {

        let key, value;
        for (key in options) {
            value = options[key];
            if (value !== undefined && options.hasOwnProperty(key)) Ajaxer.settings[key] = value;
        }

        if (debug) console.debug("Ajaxer configuration: ", Ajaxer.settings);

        return this;
    };

    Ajaxer.onLoad = function ()
    {
        Ajaxer.ready();
    }

    Ajaxer.setMethod = function(name, type)
    {
        Ajaxer.set("method["+name+"]", type);
    }

    Ajaxer.setUrl = function(name, url)
    {
        Ajaxer.set("url["+name+"]", url);
    }

    Ajaxer.setOutput = function(name, dataType)
    {
        Ajaxer.set("output["+name+"]", dataType);
    }

    Ajaxer.getTarget = function(name)
    {
        return Ajaxer.get("target["+name+"]");
    }

    Ajaxer.setTarget = function(name, el)
    {
        Ajaxer.set("target["+name+"]", el);
    }

    Ajaxer.cancelable = function(name, cancelable = true)
    {
        Ajaxer.set("cancelable["+name+"]", cancelable);
    }

    Ajaxer.setDebounce = function(name, debounce)
    {
        Ajaxer.set("debounce["+name+"]", debounce)
    }
    Ajaxer.setLoaderDebounce = function(name, debounce)
    {
        Ajaxer.set("loader_debounce["+name+"]", debounce)
    }

    Ajaxer.setThrottle = function(name, throttle)
    {
        Ajaxer.set("throttle["+name+"]", throttle)
    }
    Ajaxer.setLoaderThrottle = function(name, throttle)
    {
        Ajaxer.set("loader_throttle["+name+"]", throttle)
    }

    Ajaxer.setLoaderContainer = function(name, el)
    {
        Ajaxer.set("loader_container["+name+"]", el);
    }

    Ajaxer.setRetryLimit = function(name, retryLimit)
    {
        Ajaxer.set("retry_limit["+name+"]", retryLimit)
    }

    Ajaxer.setQueryLimit = function(name, queryLimit)
    {
        Ajaxer.set("query_limit["+name+"]", queryLimit);
    }

    const debounceTimer = {};
    Ajaxer.debounce = function (name, func, timeout = null){

        if( ! (name in debounceTimer) )
            debounceTimer[name] = undefined;

        return (...args) => {

            const wait = Ajaxer.parseTime(timeout ?? Ajaxer.get("debounce["+name+"]") ?? Ajaxer.get("debounce"));
            if(wait < 1) func.apply(this, args)
            else {

                if(typeof debounceTimer[name] !== "undefined") clearTimeout(debounceTimer[name]);
                debounceTimer[name] = setTimeout(() => { func.apply(this, args); }, wait);
            }
        };
    }

    const throttleTimer = {};
    Ajaxer.throttle = function (name, func, timeout = null){

        if( ! (name in throttleTimer) )
            throttleTimer[name] = undefined;

        return (...args) => {

            // Resolve the throttle BEFORE consulting the open window.
            //
            // The window is keyed by channel name, and one channel is routinely shared
            // by call sites that want different throttles - e.g. a "searchbar" channel
            // driven by an unthrottled keystroke handler, a 400ms infinite-scroll
            // handler, and an initial page load on the global default. Checking the
            // window first meant whoever armed it silently swallowed the next call from
            // any other call site, including one that had just asked, via
            // setThrottle(name, 0), for no throttling at all. That call was dropped
            // outright: no request, no error, the caller none the wiser.
            //
            // Resolved into a local rather than reassigning the closed-over `timeout`,
            // so a wrapper that is retained and invoked more than once keeps reading
            // current settings instead of freezing the first value it ever saw.
            const wait = Ajaxer.parseTime(timeout ?? Ajaxer.get("throttle["+name+"]") ?? Ajaxer.get("throttle"));

            // Throttling explicitly off for this call: run it, and clear any window a
            // previous throttled call left standing so it cannot outlive its purpose.
            if (wait < 1) {

                if (typeof throttleTimer[name] !== "undefined") clearTimeout(throttleTimer[name]);
                throttleTimer[name] = undefined;

                func.apply(this, args);
                return;
            }

            if (typeof throttleTimer[name] !== "undefined") return;

            func.apply(this, args);
            throttleTimer[name] = setTimeout(() => { throttleTimer[name] = undefined; }, wait);
        };
    }

    const queryList = {};

    Ajaxer.abortAll = function()
    {
        Object.keys(queryList).forEach((name) => {
            Ajaxer.abort(name);
        });
    }

    Ajaxer.abort = function (name, nKill = -1)
    {
        if(!(name in queryList))
            queryList[name] = [];

        let iKill = 0;
        while (queryList[name].length > 0 && (iKill++ < nKill || nKill < 0))
        {
            const xhr = queryList[name].shift(); // @TODO: implement mutex with unregister
                  xhr.abort();
        }
    }

    Ajaxer.register = function(name, xhr)
    {
        if(!(name in queryList))
            queryList[name] = [];

        queryList[name].push(xhr);
    }

    Ajaxer.unregister = function(xhr)
    {
        Object.entries(queryList).forEach(([_name, xhrList]) => {

            const index = xhrList.indexOf(xhr);
            if(index > -1) xhrList.splice(index, 1);
        });
    }

    Ajaxer.isJson = function(str)
    {
        try { JSON.parse(str); }
        catch (e) { return false; }

        return true;
    }

    Ajaxer.isDict = function(v) {
        return typeof v === 'object' && v !== null && !(v instanceof Array) && !(v instanceof Date);
    }

    Ajaxer.send = Ajaxer.xhr = function(name, data = {}, success = function() {}, error = function() {}, complete = function() {})
    {
        if( typeof name !== "string" )
            console.error("Unexpected ajax request name received.");

        return Ajaxer.throttle(name, () => Ajaxer.debounce(name, () => function() {

            if (Ajaxer.get("url[" + name + "]") === undefined) console.error("No target URL provided.");
            else {

                const target = $(Ajaxer.get("target[" + name + "]") || this);
                const loaderContainer = Ajaxer.get("loader_container[" + name + "]")
                        ?? (Ajaxer.get("target[" + name + "]") || this);

                let loader = $(loaderContainer).find(" .ajaxer-loader");
                if (loader.length === 0) {

                    loader = $(document.createElement("div"));
                    loader.addClass("ajaxer-loader");
                    loader.append("<span class='ajaxer-status'></span>")

                    $(loaderContainer).append(loader);
                    loader = $(loaderContainer).find(" .ajaxer-loader");
                }

                loader = loader[0];
                target.removeClass(function (index, className) {
                    return (className.match(/(^|\s)ajaxer-\S+/g) || []).join(' ');
                });

                if (!(name in queryList))
                    queryList[name] = [];

                const queryLimit = parseInt(Ajaxer.get("query_limit[" + name + "]"));
                if (queryList[name].length >= queryLimit && !isNaN(queryLimit)) {

                    const cancelable = Ajaxer.get("cancelable["+name+"]") ?? Ajaxer.get("cancelable");
                    if (!cancelable) return;

                    Ajaxer.abort(name, queryList[name].length - queryLimit + 1);
                }

                $(target).addClass("ajaxer-call");
                const loaderDebounceTime = Ajaxer.parseTime(Ajaxer.get("loader_debounce["+name+"]") ?? Ajaxer.get("loader_debounce"));

                // loader_throttle: once shown, the loader stays at least that long (0, the default: it
                // goes the moment the answer is in) - an answer arriving right after the loader_debounce
                // made it blink. The setter stored the value from the start and nothing read it.
                const loaderThrottleTime = Ajaxer.parseTime(Ajaxer.get("loader_throttle["+name+"]") ?? Ajaxer.get("loader_throttle"));
                let loaderShownAt = null;
                const showLoader = function () {
                    clearTimeout(loader.ajaxerHide);
                    loaderShownAt = Date.now();
                    $(loader).addClass("ajaxer-call");
                };
                const hideLoader = function () {
                    const left = loaderShownAt === null ? 0 : loaderThrottleTime - (Date.now() - loaderShownAt);
                    clearTimeout(loader.ajaxerHide);
                    if (left > 0) loader.ajaxerHide = setTimeout(() => $(loader).removeClass("ajaxer-call"), left);
                    else $(loader).removeClass("ajaxer-call");
                };
                let loaderTimeout = setTimeout(showLoader, loaderDebounceTime);

                const response = $.ajax({
                    url: Ajaxer.get("url[" + name + "]"),
                    type: Ajaxer.get("method[" + name + "]") ?? Ajaxer.get("method"),
                    dataType: Ajaxer.get("output[" + name + "]") ?? Ajaxer.get("output"),
                    data: data,
                    tryCount : 0,
                    retryLimit : Ajaxer.get("retry_limit[" + name + "]") ?? Ajaxer.get("retry_limit"),
                    success: function (...args) {

                        const status = args[0];
                        if(typeof status !== 'object' ) {

                            $(loader).find(".ajaxer-status").html(status);

                            $(loader).addClass("ajaxer-call");
                            $(loader).addClass("ajaxer-error");
                            $(target).each(function () {

                                $(target).addClass("ajaxer-error");
                                error.call(target, ...args);
                            });

                        } else {

                            hideLoader();
                            $(loader).addClass("ajaxer-success");
                            $(loader).removeClass("ajaxer-error");
                            $(target).each(function () {

                                $(target).addClass("ajaxer-success");
                                success.call(target, ...args);
                            });
                        }

                        Ajaxer.unregister(response);
                    },

                    error: function (...args) {

                        const xhr = args[0];
                        clearTimeout(loaderTimeout);

                        let ret = undefined;
                        if(xhr.responseJSON !== undefined) {
                            ret = Ajaxer.isDict(xhr.responseJSON) && "response" in xhr.responseJSON ? xhr.responseJSON["response"] : xhr.responseJSON;
                        }

                        if (xhr.status >= 400) ret = xhr.status + " Error" + (ret ? ': ' + ret : "");
		                else if (!ret && xhr.statusText === "error") ret = "Unexpected error";

                        if(ret) $(loader).addClass("ajaxer-call");
                        $(loader).find(".ajaxer-status").html(ret);
                        $(loader).one("click touchstart", function () {

                            $(loader).addClass("ajaxer-call");
                            $(loader).find(".ajaxer-status").html("");
                            $(loader).removeClass("ajaxer-error");
                            $.ajax(this);

                        }.bind(this));

                        if(queryList[name].indexOf(response) > 0) {

                            if (++this.tryCount < this.retryLimit) {
                                $.ajax(this);
                                return;
                            }
                        }

                        if(ret) {

                            $(loader).addClass("ajaxer-error");
                            $(target).each(function () {

                                $(target).addClass("ajaxer-error");
                            });
                        }

                        Ajaxer.unregister(response);
                    },

                    complete: function (...args) {

                        clearTimeout(loaderTimeout);
                        $(target).each(function () {

                            $(target).removeClass("ajaxer-call");
                            complete.call(target, ...args);
                        });
                    }
                });

                Ajaxer.register(name, response);
            }

        }.bind(this)())())();
    }

    $(window).on("load", function() { Ajaxer.onLoad(); });
    $(window).on("beforeunload", function() { Ajaxer.clear(); });

    return Ajaxer;
});
