(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Ajaxer = factory();
    }

})(this, function () {

    $.fn.serializeObject = function () {

        const o = {};
        const a = this.serializeArray();
        $.each(a, function () {
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

    const Ajaxer = window.Ajaxer = {};
          Ajaxer.version = '0.1.0';

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

    Ajaxer.parseTime = function(str) {

        const array = String(str).split(", ");
        const mapped = array.map(function (t) {

            if (String(t).endsWith("ms")) return parseFloat(String(t)) / 1000;
            return parseFloat(String(t));
        });

        return Math.max(...mapped);
    }

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

            timeout = Ajaxer.parseTime(timeout ?? Ajaxer.get("debounce["+name+"]") ?? Ajaxer.get("debounce"));
            if(timeout < 1) func.apply(this, args)
            else {

                if(typeof debounceTimer[name] !== "undefined") clearTimeout(debounceTimer[name]);
                debounceTimer[name] = setTimeout(() => { func.apply(this, args); }, timeout);
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
                let loaderTimeout = setTimeout(() => $(loader).addClass("ajaxer-call"), loaderDebounceTime);

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

                            $(loader).removeClass("ajaxer-call");
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
