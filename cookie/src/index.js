(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.Cookie = factory();
    }

})(this, function () {

    const Cookie = window.Cookie = {};
    Cookie.version = '0.1.0';

    const Options = Cookie.options = {
        "groups" : [],
    };

    let debug = false;
    let ready = false;

    Cookie.reset = function(el = undefined) {

        const targetData = jQuery.data(el || document.documentElement);
        Object.keys(targetData).forEach((key) => delete targetData[key]);

        $(window).off("cookie");
        return this;
    }

    Cookie.ready = function (options = {})
    {
        if("debug" in options)
            debug = options["debug"];

        Cookie.configure(options);
        ready = true;

        if (debug) console.log("Cookie is ready.");
        dispatchEvent(new Event('cookie:ready'));

        Cookie.refresh();
        return this;
    };

    Cookie.hasConsents = function(groupname = undefined)
    {
        let N = 0;

        const groups = this.getOption("groups") || [];
            groups.forEach(function (_groupname) {

                if(groupname !== undefined && groupname !== _groupname) return;

                const consent = Cookie.checkConsent(_groupname);
                if (consent === true || consent === null) N++;
            });

        return N;
    }

    Cookie.refresh = function(defaultConsentDisplayed = false)
    {
        const groups = this.getOption("groups") || [];

        // Check out global consent
        let consent;
        if(this.hasConsents() > 0) consent = true;
        else consent = defaultConsentDisplayed;

        // Display new state
        switch(consent) {

            case null: return $(window).trigger("cookie:check");
            case true: return $(window).trigger("cookie:confirm");
            case false: return $(window).trigger("cookie:deny");
        }
    };

    Cookie.getOption = function(key) {

        if(key in Cookie.options)
            return Cookie.options[key];

        return null;
    };

    Cookie.setOption = function(key, value) {

        Cookie.options[key] = value;
        return this;
    };

    Cookie.addOption = function(key, value) {

        if(! (key in Cookie.options))
            Cookie.options[key] = [];

        if (Cookie.options[key].indexOf(value) === -1)
            Cookie.options[key].push(value);

        return this;
    };

    Cookie.removeOption = function(key, value) {

        if(key in Cookie.options) {

            Cookie.options[key] = Cookie.options[key].filter(function(option, index, arr){
                return value !== option;
            });

            return Cookie.options[key];
        }

        return null;
    };

    Cookie.configure = function (options) {

        let key, value;
        for (key in options) {
            value = options[key];
            if (value !== undefined && options.hasOwnProperty(key)) Options[key] = value;
        }

        if (debug) console.log("Cookie configuration: ", Options);

        return this;
    }

    Cookie.onConfirm = function(onConfirm)
    {
        $(window).on("cookie:confirm", onConfirm);
        return this;
    }

    Cookie.onDeny = function(onDeny)
    {
        $(window).on("cookie:deny", onDeny);
        return this;
    }

    Cookie.onCheck = function(onCheck)
    {
        $(window).on("cookie:check", onCheck);
        return this;
    }

    Cookie.onLoad = function (el = window)
    {
        Cookie.reset(el);
        return this;
    }

    Cookie.getConsents  = function() {

        const consents = [];

        for (let i = 0; i < localStorage.length; i++) {

            if (localStorage.key(i).indexOf('cookie/') >= 0)
                consents.push(localStorage.key(i));
        }

        return consents;
    }

    Cookie.declare = function(groupname) {

        this.addGroup(groupname);
        this.refresh();
    }

    Cookie.checkConsent = function(groupname) { return JSON.parse(localStorage.getItem("cookie/" + groupname)) ?? null; }
    Cookie.setConsent = function(consent, groupname = undefined)
    {
        consent = Boolean(consent)
        this.addGroup(groupname);

        const groups = this.getOption("groups") || [];
            groups.forEach(function (_groupname) {

                if (Array.isArray(groupname) && !groupname.includes(_groupname)) return;
                if(!Array.isArray(groupname) && groupname !== _groupname && groupname !== undefined) return;

                localStorage.setItem("cookie/" + _groupname, consent);
                if(consent === false) Cookie.delete(_groupname);
            });

        this.refresh();
    }

    Cookie.get = function(groupname, name)
    {
        groupname = groupname.toUpperCase();
        name      = name.toUpperCase();

        const dc = document.cookie;
        const prefix = groupname+"/"+name + "=";

        let begin = dc.indexOf("; " + prefix);
        if (begin === -1) {

            begin = dc.indexOf(prefix);
            if (begin !== 0) return null;

        } else {

            begin += 2;

        }

        let end = document.cookie.indexOf(";", begin);
        if (end === -1) end = dc.length;

        return decodeURI(dc.substring(begin + prefix.length, end));
    }

    Cookie.addGroup  = function(groupname)
    {
        if(groupname === undefined)
            return this;
        if(Options.groups.indexOf(groupname) >= 0)
            return this;

        Options.groups.push(groupname);
        return this;
    }

    Cookie.set = function(groupname, name, value, expires, reloadIfNotSet = false, path = "/")
    {
        groupname = groupname.toUpperCase();
        name      = name.toUpperCase();

        let reload = false;
        if (!(expires instanceof Date)) {

            switch(typeof expires) {

                case "string":
                    expires = new Date(expires);
                    break;

                default:
                    let date = new Date();
                    date.setTime(date.getTime() + Number(expires) * 1000);
                    expires = date;
            }
        }

        if(this.checkConsent(groupname) === false)
            return;

        // Already came here..
        const cookie = this.get(groupname, name);
        if (cookie === null) reload = reloadIfNotSet;

        if(typeof value === "object")
            value = JSON.stringify(value);

        try {

            document.cookie = groupname + "/" + name + "=" + value +
                ";path=" + path +
                ";expires = " + expires.toUTCString() + "; SameSite=Strict; secure";

        } catch (e) {

            try {

                document.cookie = groupname + "/" + name + "=" + value +
                    ";path=" + path +
                    ";expires = " + expires.toUTCString() + "; SameSite=Strict;";

            } catch (e) {

                console.error(e);
                reload = false;
            }
        }

        if(reload) location.reload();
    }

    Cookie.delete = function(groupname = "",  path = "/") {

        groupname = groupname.toUpperCase();

        const cookieList = document.cookie.split(";");
        for(let i = 0; i < cookieList.length; i++) {

            const cookie = cookieList[i].trim();
            const cookieName = cookie.split("=")[0];

            // If the prefix of the cookie's name matches the one specified, remove it
            if(cookieName.indexOf(groupname ? groupname+"/" : "") === 0)
                document.cookie = cookieName + "=null;expires=Thu, 01 Jan 1970 00:00:00 GMT; path="+path;
        }
    }

    $(window).on("load", () => Cookie.onLoad());
    return Cookie;
});
