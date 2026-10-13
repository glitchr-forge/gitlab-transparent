// Cookie - what a site keeps in the visitor's browser, and the visitor's say
// over it.
//
// The site declares, the library never does: the CATEGORIES of consent (a key,
// the site's words, on or off before any answer, refusable or not), WHAT IS
// STORED under each (cookies, localStorage and sessionStorage entries, by name
// or pattern, with a duration and a purpose) and the FEATURES that start when
// a category is granted and stop when it is withdrawn - a function
// (Cookie.use(category, onGrant, onRevoke)) or an inert element of the page
// (<script type="text/plain" data-cookie-category="...">, <template>, an
// iframe with data-cookie-src).
//
// The library keeps the answer (a record: version, date, one yes or no per
// category), asks again when the version or the categories change or the
// answer is too old, shows the banner (accept, refuse, customize) and the
// detailed section (a switch per category), counts down if the site asks for
// it, and enforces the answer: nothing is read or written through it under a
// category that is not granted, and what a refused category declared is erased.
//
// Not one word the visitor reads is written here: the texts come from the
// configuration (`texts`, the categories' label and description) or from the
// site's own HTML, found by its data-cookie-* attributes - whose prefix and
// names are options too, like the classes, the consent cookie's name and
// attributes, where the answer is kept, the position, the countdown.
//
// The successor of @glitchr/cookie 1.0.53: its global, its methods, its
// localStorage keys ("cookie/<GROUP>") and its cookies ("GROUP/NAME") are kept
// with their meaning. A group whose name is a category's key is that category.
//
// What it shares with the other modules is the core's: the moments a page is
// in - the navigation's swaps included -, the durations, the frame, jQuery
// when it is there (none is needed).
(function (root, factory) {

    var core = root.Flow && root.Flow.core === true ? root.Flow : (typeof require === 'function' ? require('./core.js') : null);
    if (!core) throw new Error('cookie.js: load core.js first');

    var api = root.Cookie && root.Cookie.flow === true ? root.Cookie : factory(root, core);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.Cookie = api;
    core.cookie = api;

})(typeof window !== 'undefined' ? window : this, function (window, Flow) {

    var document = window.document;

    var Cookie = { flow: true };
    Cookie.version = Flow.version;

    // @glitchr/cookie's localStorage keys: "cookie/<GROUP>" = true | false.
    var LEGACY = 'cookie/';
    // Where the seconds left go in the countdown's sentence.
    var COUNT = '{count}';

    Cookie.defaults = {
        groups: [],
        debug: false,
        version: null,
        categories: {},
        storage: [],
        undeclared: 'deny',
        record: { store: 'cookie', name: 'cookie-consent', lifetime: '180d' },
        cookie: { path: '/', domain: null, sameSite: 'Lax', secure: 'auto' },
        legacy: true,
        countdown: false,
        dismiss: 'none',
        signals: { gpc: false, dnt: false },
        autoOpen: true,
        reopen: 'details',
        position: null,
        container: null,
        template: null,
        prefix: 'data-cookie',
        hooks: {},
        classes: {
            root: 'cookie-banner', summary: 'cookie-summary', title: 'cookie-title', text: 'cookie-text',
            countdown: 'cookie-countdown', count: 'cookie-count', actions: 'cookie-actions', button: 'cookie-button',
            accept: 'cookie-accept', refuse: 'cookie-refuse', customize: 'cookie-customize', save: 'cookie-save', close: 'cookie-close',
            details: 'cookie-details', list: 'cookie-categories', row: 'cookie-category', label: 'cookie-label', toggle: 'cookie-toggle',
            required: 'cookie-required', description: 'cookie-description', entries: 'cookie-entries', entry: 'cookie-entry', features: 'cookie-features',
            open: 'is-open', pending: 'is-pending', customizing: 'is-customizing', counting: 'is-counting', tick: 'is-tick', reduced: 'is-reduced'
        },
        variables: {},
        texts: {},
        observe: false
    };

    // The options that are maps: given twice, they add up.
    var MAPS = ['record', 'cookie', 'signals', 'hooks', 'classes', 'variables', 'texts'];

    var Options = Cookie.options = { groups: [] };

    var ready = false;

    function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof RegExp) && !value.nodeType; }

    /** An option as it stands: what was configured over the default. */
    function setting(key) {
        var base = Cookie.defaults[key];
        var given = Options[key];
        if (given === undefined) return base;
        if (MAPS.indexOf(key) !== -1 && plain(base) && plain(given)) return Object.assign({}, base, given);
        return given;
    }

    function log() {
        if (!setting('debug') || !window.console) return;
        console.log.apply(console, ['Cookie:'].concat(Array.prototype.slice.call(arguments)));
    }

    function run(fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }, 0); } }

    function emit(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail: detail })); }

    function web(type) {
        try { return type === 'session' ? window.sessionStorage : window.localStorage; } catch (e) { return null; }
    }

    /** A duration in seconds: a number of them, "30d", "12h", "13mo", "1y", "45min", "10s", "250ms"; null for none ("session"). */
    var UNITS = { m: 60, min: 60, h: 3600, d: 86400, w: 604800, mo: 2592000, y: 31536000 };
    function seconds(value) {
        if (value === undefined || value === null || value === '' || value === false) return null;
        if (typeof value === 'number') return value;
        var match = /^\s*([\d.]+)\s*([a-z]*)\s*$/i.exec(String(value));
        if (!match) return null;
        var unit = match[2].toLowerCase();
        if (unit in UNITS) return parseFloat(match[1]) * UNITS[unit];
        var parsed = Flow.parseDuration(match[1] + unit);
        return isNaN(parsed) ? null : parsed;
    }
    Cookie.seconds = seconds;

    // ── Categories ───────────────────────────────────────────────────────
    var cats = {};      // ID -> category
    var order = [];     // the IDs, as declared

    function id(key) { return key === undefined || key === null ? '' : String(key).trim().toUpperCase(); }

    function category(key) { return cats[id(key)] || null; }

    /** Declare a category, or add to it. fill: only what it does not have yet (a script's words never replace the site's). */
    function declare(key, definition, fill, runtime) {
        var ID = id(key);
        if (!ID) return null;
        definition = definition || {};
        var cat = cats[ID];
        if (!cat) {
            cat = cats[ID] = { id: ID, key: String(key).trim(), label: null, description: null, default: false, required: false, onDemand: !!runtime, used: false, features: [], on: [], off: [] };
            order.push(ID);
            Cookie.addGroup(ID);
            fill = false;
            log('category', cat.key);
        }
        ['label', 'description'].forEach(function (field) {
            if (definition[field] === undefined || definition[field] === null) return;
            if (!fill || cat[field] === null) cat[field] = definition[field];
        });
        if (!fill) {
            // `implicit` is omnibase/consent's word for a category on until refused.
            if (typeof definition.default === 'boolean') cat.default = definition.default;
            else if (typeof definition.implicit === 'boolean') cat.default = definition.implicit;
            if (typeof definition.required === 'boolean') cat.required = definition.required;
            // Declared by the site, a category first met in a script or an element is no longer there on demand only.
            if (!runtime) cat.onDemand = definition.onDemand === true;
        }
        (definition.storage || []).forEach(function (entry) { store(Object.assign({}, typeof entry === 'string' ? { name: entry } : entry, { category: ID })); });
        // `erase`: omnibase/consent's name prefixes of a third party's cookies.
        (definition.erase || []).forEach(function (prefix) { store({ type: 'cookie', name: prefix + '*', category: ID }); });
        (definition.features || []).forEach(function (feature) { addFeature(cat, feature); });
        return cat;
    }

    function addFeature(cat, feature) {
        if (!feature) return;
        if (typeof feature === 'string') feature = { name: feature };
        if (!feature.name) return;
        for (var i = 0; i < cat.features.length; i++) if (cat.features[i].name === feature.name) return;
        cat.features.push({ name: String(feature.name), label: feature.label === undefined ? null : feature.label });
    }

    /** In the detailed section: every category but an on-demand one nothing uses yet. */
    function listed(cat) { return !cat.onDemand || cat.used; }

    function listedCategories() {
        return order.map(function (ID) { return cats[ID]; }).filter(listed);
    }

    /** The categories whose answer is wanted: listed, refusable, and not there on demand only. */
    function asked() {
        return order.map(function (ID) { return cats[ID]; }).filter(function (cat) { return !cat.required && !cat.onDemand; });
    }

    // ── What is stored ───────────────────────────────────────────────────
    var entries = [];

    function matcher(name) {
        if (name instanceof RegExp) return function (text) { name.lastIndex = 0; return name.test(text); };
        var text = String(name);
        if (text.indexOf('*') === -1) return function (other) { return other === text; };
        var pattern = new RegExp('^' + text.split('*').map(function (piece) { return piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('.*') + '$');
        return function (other) { return pattern.test(other); };
    }

    function store(entry) {
        if (!entry || entry.name === undefined || entry.name === null || entry.name === '') return null;
        var type = entry.type === 'local' || entry.type === 'session' ? entry.type : 'cookie';
        var ID = id(entry.category);
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].type === type && String(entries[i].name) === String(entry.name) && entries[i].category === ID) return Object.assign(entries[i], entry, { type: type, category: ID });
        }
        var made = Object.assign({}, entry, { type: type, category: ID, match: matcher(entry.name) });
        entries.push(made);
        return made;
    }

    function declared(type, name) {
        for (var i = 0; i < entries.length; i++) if (entries[i].type === type && entries[i].match(name)) return entries[i];
        return null;
    }

    /** Whether the library may read or write this entry now: {entry} (null when undeclared and let through), or false. */
    function allowed(type, name, verb) {
        var entry = declared(type, name);
        if (!entry) {
            if (setting('undeclared') === 'allow') return { entry: null };
            log(verb, type, name, '- not declared, left alone');
            return false;
        }
        var cat = cats[entry.category];
        if (!cat || !granted(cat)) {
            log(verb, type, name, '- category', cat ? cat.key : entry.category, cat ? 'is not granted' : 'is not declared', '- left alone');
            return false;
        }
        return { entry: entry };
    }

    function text(value) { return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value); }

    // Cookies, as document.cookie has them.
    function cookieNames() {
        return (document.cookie ? document.cookie.split(';') : []).map(function (pair) { return pair.trim().split('=')[0]; }).filter(Boolean);
    }

    function readCookie(name) {
        var pairs = document.cookie ? document.cookie.split(';') : [];
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i].trim();
            var at = pair.indexOf('=');
            if ((at === -1 ? pair : pair.slice(0, at)) !== name) continue;
            var value = at === -1 ? '' : pair.slice(at + 1);
            try { return decodeURIComponent(value); } catch (e) { return value; }
        }
        return null;
    }

    function writeCookie(name, value, attributes) {
        var line = name + '=' + encodeURIComponent(value) + '; path=' + (attributes.path || '/');
        if (attributes.domain) line += '; domain=' + attributes.domain;
        if (attributes.age !== null && attributes.age !== undefined) {
            line += '; max-age=' + Math.round(attributes.age) + '; expires=' + new Date(Date.now() + attributes.age * 1000).toUTCString();
        }
        if (attributes.sameSite) line += '; SameSite=' + attributes.sameSite;
        if (attributes.secure === true || (attributes.secure === 'auto' && window.location.protocol === 'https:')) line += '; Secure';
        document.cookie = line;
    }

    // A cookie is erased where it was written: on the path and domain it was
    // declared with, on "/" and the page's path, on the host and its parents.
    function eraseCookie(name, path, domain) {
        var paths = [path, '/', null];
        var host = window.location.hostname || '';
        var domains = [domain, null];
        var labels = host.split('.');
        if (!/^[\d.]+$/.test(host)) for (var i = 0; i < labels.length - 1; i++) domains.push('.' + labels.slice(i).join('.'));
        var done = {};
        paths.forEach(function (p) {
            domains.forEach(function (d) {
                var key = (p || '') + ' ' + (d || '');
                if (done[key]) return;
                done[key] = true;
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0' + (p ? '; path=' + p : '') + (d ? '; domain=' + d : '');
            });
        });
    }

    function cookieAttributes(entry, options) {
        var base = setting('cookie');
        var out = {};
        ['path', 'domain', 'sameSite', 'secure'].forEach(function (key) {
            out[key] = options && options[key] !== undefined ? options[key] : (entry && entry[key] !== undefined ? entry[key] : base[key]);
        });
        var duration = options && options.duration !== undefined ? options.duration : (entry ? entry.duration : undefined);
        out.age = seconds(duration);
        return out;
    }

    /** The cookies, by their declaration: nothing is read or written under a category that is not granted. */
    Cookie.cookies = {
        get: function (name) { return allowed('cookie', name, 'read') ? readCookie(name) : null; },
        set: function (name, value, options) {
            var may = allowed('cookie', name, 'write');
            if (!may) return false;
            writeCookie(name, text(value), cookieAttributes(may.entry, options));
            return true;
        },
        remove: function (name, options) {
            var entry = declared('cookie', name);
            eraseCookie(name, options && options.path || (entry && entry.path), options && options.domain || (entry && entry.domain));
            return true;
        }
    };

    function area(type) {
        return {
            get: function (name) {
                var s = web(type);
                if (!s || !allowed(type, name, 'read')) return null;
                try { return s.getItem(name); } catch (e) { return null; }
            },
            set: function (name, value) {
                var s = web(type);
                if (!s || !allowed(type, name, 'write')) return false;
                try { s.setItem(name, text(value)); } catch (e) { return false; }
                return true;
            },
            remove: function (name) {
                var s = web(type);
                try { if (s) s.removeItem(name); } catch (e) { return false; }
                return true;
            }
        };
    }
    /** localStorage and sessionStorage, by their declaration. */
    Cookie.local = area('local');
    Cookie.session = area('session');

    /** Everything a category declares, erased - the answer's own record excepted. */
    function eraseCategory(cat) {
        var kept = recordName();
        entries.forEach(function (entry) {
            if (entry.category !== cat.id) return;
            if (entry.type === 'cookie') {
                cookieNames().filter(entry.match).forEach(function (name) {
                    if (name === kept) return;
                    log('erase cookie', name, '(' + cat.key + ')');
                    eraseCookie(name, entry.path, entry.domain);
                });
                return;
            }
            var s = web(entry.type);
            if (!s) return;
            var names = [];
            try { for (var i = 0; i < s.length; i++) names.push(s.key(i)); } catch (e) { return; }
            names.filter(entry.match).forEach(function (name) {
                if (entry.type === 'local' && (name === kept || name.indexOf(LEGACY) === 0)) return;
                log('erase', entry.type, name, '(' + cat.key + ')');
                try { s.removeItem(name); } catch (e) { /* storage closed: nothing to erase */ }
            });
        });
        // The group's own cookies, as @glitchr/cookie erased them.
        Cookie.delete(cat.id);
    }

    // ── The answer ───────────────────────────────────────────────────────
    // A record: {v: the categories' version, t: when (s), c: {ID: 1 | 0}, s: the source}.
    var record;     // undefined: not read yet; null: none

    function recordName() {
        var options = setting('record');
        return options.store === 'cookie' || options.store === 'local' ? options.name : null;
    }

    function recordStore() {
        var options = setting('record');
        if (plain(options.store) && typeof options.store.read === 'function') return options.store;
        if (options.store === 'local') {
            return {
                read: function () { var s = web('local'); return s ? s.getItem(options.name) : null; },
                write: function (value) { var s = web('local'); if (s) s.setItem(options.name, value); },
                clear: function () { var s = web('local'); if (s) s.removeItem(options.name); }
            };
        }
        var attributes = cookieAttributes(null, options);
        attributes.age = seconds(options.lifetime);
        return {
            read: function () { return readCookie(options.name); },
            write: function (value) { writeCookie(options.name, value, attributes); },
            clear: function () { eraseCookie(options.name, attributes.path, attributes.domain); }
        };
    }

    function load() {
        if (record !== undefined) return record;
        record = null;
        try {
            var kept = recordStore().read();
            var parsed = kept ? JSON.parse(kept) : null;
            if (plain(parsed) && plain(parsed.c)) record = parsed;
        } catch (e) { record = null; }
        return record;
    }

    function persist() {
        try { recordStore().write(JSON.stringify(record)); } catch (e) { log('the answer could not be kept', e); }
    }

    /** The record is of this version of the categories, and not too old. */
    function valid() {
        var kept = load();
        if (!kept) return false;
        var version = setting('version');
        if (version !== null && version !== undefined && String(kept.v) !== String(version)) return false;
        var lifetime = seconds(setting('record').lifetime);
        if (lifetime !== null && kept.t && Date.now() / 1000 - kept.t > lifetime) return false;
        return true;
    }

    function legacyRead(group) {
        var s = web('local');
        if (!s) return null;
        try {
            var value = JSON.parse(s.getItem(LEGACY + group));
            return value === undefined || value === null ? null : !!value;
        } catch (e) { return null; }
    }

    function fresh(source) {
        var version = setting('version');
        return { v: version === null || version === undefined ? null : String(version), t: Math.floor(Date.now() / 1000), c: {}, s: source };
    }

    /** true | false | null: what the visitor answered for this category. */
    function answer(cat) {
        if (cat.required) return true;
        var kept = load();
        var counts = kept ? valid() : true;
        if (!counts) return null;
        if (kept && cat.id in kept.c) return !!kept.c[cat.id];
        // An answer @glitchr/cookie kept (localStorage "cookie/<GROUP>") is taken over, once.
        if (setting('legacy')) {
            var old = legacyRead(cat.id);
            if (old !== null) {
                if (!record) record = fresh('legacy');
                record.c[cat.id] = old ? 1 : 0;
                persist();
                return old;
            }
        }
        return null;
    }

    /** The privacy signals of the browser: {gpc, dnt}. */
    Cookie.signals = function () {
        var nav = window.navigator || {};
        return {
            gpc: nav.globalPrivacyControl === true || nav.globalPrivacyControl === '1',
            dnt: nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || window.doNotTrack === '1'
        };
    };

    /** Whether a signal the site honours, and the browser sends, covers this category. */
    function signalled(cat) {
        if (cat.required) return false;
        var honoured = setting('signals');
        var sent = null;
        return ['gpc', 'dnt'].some(function (name) {
            var scope = honoured[name];
            if (!scope) return false;
            sent = sent || Cookie.signals();
            if (!sent[name]) return false;
            return scope === true || (Array.isArray(scope) && scope.map(id).indexOf(cat.id) !== -1);
        });
    }

    /** What a script should do now: the answer, else the category's default - off under a signal. */
    function granted(cat) {
        var said = answer(cat);
        if (said !== null) return said;
        return signalled(cat) ? false : !!cat.default;
    }

    function pending() { return asked().some(function (cat) { return answer(cat) === null; }); }

    /** A choice for every category listed: "accept", "refuse" or "default". implicit: nobody clicked - a signalled category stays off. */
    function choice(action, implicit) {
        var map = {};
        listedCategories().forEach(function (cat) {
            if (cat.required) map[cat.id] = true;
            else if (action === 'accept') map[cat.id] = !(implicit && signalled(cat));
            else if (action === 'refuse') map[cat.id] = false;
            else map[cat.id] = !!cat.default && !signalled(cat);
        });
        return map;
    }

    function states() {
        var map = {};
        order.forEach(function (ID) { map[ID] = granted(cats[ID]); });
        return map;
    }

    /** Keep an answer ({ID: bool}), then do what follows from it. */
    function decide(map, source) {
        var before = states();

        if (!load() || !valid()) {
            // What an older answer left in @glitchr/cookie's keys no longer counts either.
            if (record && setting('legacy')) {
                var s = web('local');
                var old = [];
                try { for (var i = 0; s && i < s.length; i++) if (s.key(i).indexOf(LEGACY) === 0) old.push(s.key(i)); } catch (e) { old = []; }
                old.forEach(function (name) { try { s.removeItem(name); } catch (e) { /* closed */ } });
            }
            record = fresh(source);
        }
        var version = setting('version');
        record.v = version === null || version === undefined ? null : String(version);
        record.t = Math.floor(Date.now() / 1000);
        record.s = source;

        var said = [];
        Object.keys(map).forEach(function (key) {
            var cat = category(key);
            if (!cat) return;
            record.c[cat.id] = cat.required || map[key] ? 1 : 0;
            said.push(cat.id);
            if (setting('legacy')) {
                var s = web('local');
                try { if (s) s.setItem(LEGACY + cat.id, String(!!record.c[cat.id])); } catch (e) { /* closed */ }
            }
        });
        persist();
        stopCountdown();
        log('answer', source, record.c);

        follow(before, said, source);
    }

    /** What follows from a change of the answer: what the categories now off declared is erased, the features told, the page's elements, the events, the banner. */
    function follow(before, said, source) {
        var now = {};
        var on = [];
        var off = [];
        order.forEach(function (ID) {
            var cat = cats[ID];
            var is = granted(cat);
            now[cat.key] = is;
            if (!is && said.indexOf(ID) !== -1) eraseCategory(cat);
            if (is !== before[ID]) (is ? on : off).push(cat);
        });
        on.forEach(function (cat) {
            cat.on.slice().forEach(run);
            emit('cookie:grant', { category: cat.key });
        });
        off.forEach(function (cat) {
            cat.off.slice().forEach(run);
            emit('cookie:revoke', { category: cat.key });
        });
        scan();
        emit('cookie:consent', {
            categories: now,
            granted: on.map(function (cat) { return cat.key; }),
            revoked: off.map(function (cat) { return cat.key; }),
            source: source,
            pending: pending()
        });
        Cookie.refresh();
        settle();
    }

    // ── Features ─────────────────────────────────────────────────────────

    /**
     * Run onGrant now if the category is granted and each time it becomes so,
     * onRevoke each time it is withdrawn; whether it is granted now. A
     * category not known yet is declared from the options, on demand.
     * (omnibase/consent's Consent.use(name, options, onEnable, onDisable).)
     */
    Cookie.use = function (key, options, onGrant, onRevoke) {
        if (typeof options === 'function') { onRevoke = onGrant; onGrant = options; options = {}; }
        options = options || {};
        var cat = declare(key, options, true, true);
        if (!cat) return false;
        if (options.feature) addFeature(cat, options.feature);
        if (typeof onGrant === 'function') cat.on.push(onGrant);
        if (typeof onRevoke === 'function') cat.off.push(onRevoke);
        var first = !cat.used;
        cat.used = true;
        if (ui.root && (first || options.feature)) rows();
        var is = granted(cat);
        if (is && typeof onGrant === 'function') run(onGrant);
        return is;
    };

    Cookie.unuse = function (key, onGrant, onRevoke) {
        var cat = category(key);
        if (!cat) return this;
        [[cat.on, onGrant], [cat.off, onRevoke]].forEach(function (pair) {
            var at = pair[0].indexOf(pair[1]);
            if (at !== -1) pair[0].splice(at, 1);
        });
        return this;
    };

    // The elements that wait for a category.
    var inserted = typeof WeakMap === 'function' ? new WeakMap() : null;

    function wake(el) {
        var active = hook('active');
        if (el.hasAttribute(active)) return;
        if (el.tagName === 'SCRIPT') {
            var script = document.createElement('script');
            Array.prototype.forEach.call(el.attributes, function (attribute) {
                if (attribute.name !== 'type' && attribute.name !== 'data-src' && attribute.name !== 'data-type') script.setAttribute(attribute.name, attribute.value);
            });
            if (el.getAttribute('data-type')) script.type = el.getAttribute('data-type');
            if (el.getAttribute('data-src')) script.src = el.getAttribute('data-src');
            script.text = el.text;
            script.setAttribute(active, '');
            el.parentNode.replaceChild(script, el);
            return;
        }
        el.setAttribute(active, '');
        if (el.tagName === 'TEMPLATE') {
            var content = document.importNode(el.content, true);
            var nodes = Array.prototype.slice.call(content.childNodes);
            if (inserted) inserted.set(el, nodes);
            el.parentNode.insertBefore(content, el);
            return;
        }
        var src = el.getAttribute(hook('src'));
        if (src) el.setAttribute('src', src);
    }

    function sleep(el) {
        var active = hook('active');
        if (!el.hasAttribute(active) || el.tagName === 'SCRIPT') return;
        el.removeAttribute(active);
        if (el.tagName === 'TEMPLATE') {
            var nodes = inserted ? inserted.get(el) : null;
            (nodes || []).forEach(function (node) { if (node.parentNode) node.parentNode.removeChild(node); });
            if (inserted) inserted.delete(el);
            return;
        }
        if (el.hasAttribute(hook('src'))) el.removeAttribute('src');
    }

    /** The inert elements of the page (or of one of its parts): awake under a granted category, asleep otherwise. */
    function scan(rootNode) {
        if (!order.length && !document.querySelector('[' + hook('category') + ']')) return;
        var within = rootNode && rootNode.querySelectorAll ? rootNode : document;
        var name = hook('category');
        var met = false;
        Array.prototype.forEach.call(within.querySelectorAll('[' + name + ']'), function (el) {
            var cat = declare(el.getAttribute(name), null, true, true);
            if (!cat) return;
            if (!cat.used) { cat.used = true; met = true; }
            if (granted(cat)) wake(el); else sleep(el);
        });
        var holder = hook('placeholder');
        Array.prototype.forEach.call(within.querySelectorAll('[' + holder + ']'), function (el) {
            var cat = category(el.getAttribute(holder));
            el.hidden = !!cat && granted(cat);
        });
        if (met && ui.root) rows();
    }
    Cookie.scan = function (rootNode) { scan(rootNode); return this; };

    // ── The interface ────────────────────────────────────────────────────
    var ui = { root: null, built: false, view: null, opener: null, closed: false, auto: false, timer: null, left: 0, last: 0, action: null, bound: false, observer: null };

    function hook(name) {
        var hooks = setting('hooks');
        return hooks[name] || setting('prefix') + '-' + name;
    }
    function quote(value) { return String(value).replace(/["\\]/g, '\\$&'); }
    function sel(name, value) { return '[' + hook(name) + (value === undefined ? '' : '="' + quote(value) + '"') + ']'; }

    /** A part of the banner, by its attribute: in the banner, else in the page (a detailed section kept elsewhere). */
    function part(name) {
        if (!ui.root) return null;
        if (ui.root.matches(sel(name))) return ui.root;
        return ui.root.querySelector(sel(name)) || document.querySelector(sel(name));
    }
    function parts(name) {
        if (!ui.root) return [];
        var found = Array.prototype.slice.call(ui.root.querySelectorAll(sel(name)));
        var details = part('details');
        if (details && !ui.root.contains(details)) found = found.concat(Array.prototype.slice.call(details.querySelectorAll(sel(name))));
        return found;
    }

    function inside(el) {
        if (!ui.root) return false;
        var details = part('details');
        return ui.root.contains(el) || (!!details && details.contains(el));
    }

    /** Whether the visitor asked for less motion. */
    Cookie.reduced = function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); };

    function make(tag, name, className, value) {
        var el = document.createElement(tag);
        if (name) el.setAttribute(hook(name), value === undefined ? '' : value);
        if (className) el.className = className;
        return el;
    }

    function write(el, words) {
        if (words === undefined || words === null) return false;
        if (plain(words)) { if (words.html === undefined) return false; el.innerHTML = words.html; } else el.textContent = String(words);
        return true;
    }

    function words(key) {
        var value = setting('texts')[key];
        return value === undefined || value === null || value === '' ? null : value;
    }

    // The banner nobody wrote: the parts whose words the site gave, and no style.
    function build() {
        var classes = setting('classes');
        var rootEl = make('div', 'banner', classes.root);
        var summary = make('div', 'summary', classes.summary);
        var worded = function (tag, key, className, into, as) {
            if (words(key) === null) return null;
            var el = make(tag, as || 'text', className, as ? undefined : key);
            if (as) el.setAttribute(hook('text'), key);
            if (tag === 'button') el.type = 'button';
            into.appendChild(el);
            return el;
        };
        worded('p', 'title', classes.title, summary);
        worded('p', 'text', classes.text, summary);
        if (words('countdown') !== null) {
            var counting = make('p', 'countdown', classes.countdown);
            counting.hidden = true;
            summary.appendChild(counting);
        }
        var actions = make('div', null, classes.actions);
        worded('button', 'accept', classes.button + ' ' + classes.accept, actions, 'accept');
        worded('button', 'refuse', classes.button + ' ' + classes.refuse, actions, 'refuse');
        worded('button', 'customize', classes.button + ' ' + classes.customize, actions, 'customize');
        summary.appendChild(actions);
        rootEl.appendChild(summary);

        var details = make('div', 'details', classes.details);
        details.hidden = true;
        worded('p', 'detailsTitle', classes.title, details);
        worded('p', 'detailsText', classes.text, details);
        details.appendChild(make('ul', 'categories', classes.list));
        var more = make('div', null, classes.actions);
        worded('button', words('acceptAll') === null ? 'accept' : 'acceptAll', classes.button + ' ' + classes.accept, more, 'accept');
        worded('button', words('refuseAll') === null ? 'refuse' : 'refuseAll', classes.button + ' ' + classes.refuse, more, 'refuse');
        worded('button', 'save', classes.button + ' ' + classes.save, more, 'save');
        worded('button', 'close', classes.button + ' ' + classes.close, more, 'close');
        details.appendChild(more);
        rootEl.appendChild(details);
        return rootEl;
    }

    function place(el) {
        var container = setting('container');
        if (typeof container === 'string') container = document.querySelector(container);
        (container && container.nodeType === 1 ? container : document.body).appendChild(el);
    }

    /** The banner: the site's (an element or a <template> with data-cookie-banner, or the `template` option), else a bare one. */
    function ensure() {
        if (ui.root && ui.root.isConnected) return ui.root;
        if (!document.body) return null;
        var found = null;
        var built = false;
        var template = setting('template');
        if (typeof template === 'function') template = template(Cookie);
        if (typeof template === 'string') {
            if (/^\s*</.test(template)) {
                var holder = document.createElement('template');
                holder.innerHTML = template;
                found = holder.content.firstElementChild;
            } else {
                template = document.querySelector(template);
            }
        }
        if (!found && template && template.nodeType === 1) found = template;
        if (!found) found = document.querySelector(sel('banner'));
        if (found && found.tagName === 'TEMPLATE') found = document.importNode(found.content, true).firstElementChild;
        if (!found) found = build();
        // Put in the page here, it is taken out by destroy(); found in the page, it is the page's.
        if (!found.isConnected) { place(found); built = true; }
        found.setAttribute(hook('banner'), '');

        ui.root = found;
        ui.built = built;
        dress();
        return found;
    }

    /** The banner made ready: its state, its words, its rows, what a screen reader is told. */
    function dress() {
        var rootEl = ui.root;
        var classes = setting('classes');
        var texts = setting('texts');
        if (classes.root) rootEl.classList.add.apply(rootEl.classList, classes.root.split(/\s+/).filter(Boolean));
        var position = setting('position');
        if (position) rootEl.setAttribute(hook('position'), position);
        var variables = setting('variables');
        Object.keys(variables).forEach(function (name) { rootEl.style.setProperty(name, variables[name]); });
        if (classes.reduced) rootEl.classList.toggle(classes.reduced, Cookie.reduced());

        parts('text').concat(rootEl.matches(sel('text')) ? [rootEl] : []).forEach(function (el) {
            write(el, texts[el.getAttribute(hook('text'))]);
        });
        parts('countdown').forEach(function (el) {
            if (el.querySelector(sel('count'))) return;
            var sentence = texts.countdown;
            if (sentence === undefined || sentence === null) return;
            var count = '<span ' + hook('count') + (classes.count ? ' class="' + classes.count + '"' : '') + '></span>';
            if (plain(sentence)) { el.innerHTML = String(sentence.html).split(COUNT).join(count); return; }
            el.textContent = '';
            String(sentence).split(COUNT).forEach(function (piece, i) {
                if (i > 0) {
                    var holder = document.createElement('template');
                    holder.innerHTML = count;
                    el.appendChild(holder.content);
                }
                el.appendChild(document.createTextNode(piece));
            });
        });

        var summary = part('summary') || rootEl;
        var details = part('details');
        if (details === summary) details = null;
        var label = function (el, wording) {
            if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
            if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby') && typeof wording === 'string') el.setAttribute('aria-label', wording);
        };
        label(summary, texts.label);
        if (!summary.hasAttribute('aria-live')) summary.setAttribute('aria-live', 'polite');
        if (details) {
            label(details, texts.detailsLabel || texts.detailsTitle || texts.label);
            details.setAttribute('aria-modal', 'true');
            if (!details.hasAttribute('tabindex')) details.setAttribute('tabindex', '-1');
        }
        parts('customize').forEach(function (el) { el.setAttribute('aria-expanded', 'false'); });
        rows();
        paint();
    }

    var serial = 0;

    function row(cat, list) {
        var classes = setting('classes');
        var own = ui.root.querySelector('template' + sel('row'));
        if (!own) {
            var details = part('details');
            own = details ? details.querySelector('template' + sel('row')) : null;
        }
        var el;
        if (own) {
            el = document.importNode(own.content, true).firstElementChild;
        } else {
            el = make('li', null, classes.row);
            var label = make('label', null, classes.label);
            var input = make('input', 'toggle', classes.toggle);
            input.type = 'checkbox';
            label.appendChild(input);
            label.appendChild(make('span', 'label'));
            el.appendChild(label);
            el.appendChild(make('span', 'required', classes.required));
            el.appendChild(make('p', 'description', classes.description));
            el.appendChild(make('ul', 'entries', classes.entries));
            el.appendChild(make('ul', 'features', classes.features));
        }
        el.setAttribute(hook('row'), cat.key);
        list.appendChild(el);
        return el;
    }

    /** One row per category listed; the switches follow the answer unless the visitor is setting them. */
    function rows() {
        var list = part('categories');
        if (!list) return;
        var classes = setting('classes');
        var texts = setting('texts');
        var keep = {};
        listedCategories().forEach(function (cat) {
            keep[cat.key] = true;
            var el = list.querySelector(sel('row', cat.key));
            var made = !el;
            if (made) el = row(cat, list);
            var one = function (name) { return el.querySelector(sel(name)); };

            var description = one('description');
            if (description) {
                description.textContent = cat.description || '';
                description.hidden = !cat.description;
                if (!description.id) description.id = setting('prefix') + '-description-' + (++serial);
            }
            var input = one('toggle');
            if (input) {
                input.setAttribute(hook('toggle'), cat.key);
                if (!input.hasAttribute('role')) input.setAttribute('role', 'switch');
                if (description && cat.description) input.setAttribute('aria-describedby', description.id);
                input.disabled = cat.required;
                if (made || ui.view !== 'details' || cat.required) input.checked = granted(cat);
            }
            var label = one('label');
            if (label) label.textContent = cat.label === null ? cat.key : cat.label;
            var required = one('required');
            if (required) {
                required.hidden = !cat.required;
                write(required, texts.required);
            }
            var stored = one('entries');
            if (stored) {
                var mine = entries.filter(function (entry) { return entry.category === cat.id; });
                stored.textContent = '';
                stored.hidden = !mine.length;
                mine.forEach(function (entry) {
                    var item = make('li', 'entry', classes.entry, entry.type);
                    [['name', entry.label === undefined ? String(entry.name) : entry.label], ['duration', entry.duration], ['purpose', entry.purpose]].forEach(function (pair) {
                        if (pair[1] === undefined || pair[1] === null || pair[1] === '') return;
                        var span = make('span', 'entry-' + pair[0]);
                        span.textContent = String(pair[1]);
                        item.appendChild(span);
                    });
                    stored.appendChild(item);
                });
            }
            var governed = one('features');
            if (governed) {
                governed.textContent = '';
                governed.hidden = !cat.features.length;
                cat.features.forEach(function (feature) {
                    var item = document.createElement('li');
                    item.textContent = feature.label === null ? feature.name : feature.label;
                    governed.appendChild(item);
                });
            }
        });
        Array.prototype.forEach.call(list.querySelectorAll(sel('row')), function (el) {
            if (el.tagName !== 'TEMPLATE' && !keep[el.getAttribute(hook('row'))]) el.parentNode.removeChild(el);
        });
    }

    /** The banner as its state says: shown or not, which part, the countdown. */
    function paint() {
        var rootEl = ui.root;
        if (!rootEl) return;
        var classes = setting('classes');
        var open = ui.view !== null;
        var details = part('details');
        var summary = part('summary');
        if (details === rootEl) details = null;
        var detailed = ui.view === 'details' && !!details;

        rootEl.hidden = !open;
        if (classes.open) rootEl.classList.toggle(classes.open, open);
        if (classes.pending) rootEl.classList.toggle(classes.pending, pending());
        if (classes.customizing) rootEl.classList.toggle(classes.customizing, detailed);
        if (details) {
            details.hidden = !detailed;
            // Kept outside the banner, it is shown and hidden for itself.
            if (!rootEl.contains(details) && classes.open) details.classList.toggle(classes.open, detailed);
        }
        if (summary && summary !== rootEl) summary.hidden = detailed;
        parts('customize').forEach(function (el) { el.setAttribute('aria-expanded', detailed ? 'true' : 'false'); });

        var counting = ui.timer !== null;
        if (classes.counting) rootEl.classList.toggle(classes.counting, counting);
        parts('countdown').forEach(function (el) { el.hidden = !counting; });
        if (counting) {
            var left = String(Math.max(0, Math.ceil(ui.left / 1000)));
            parts('count').forEach(function (el) {
                if (el.textContent === left) return;
                el.textContent = left;
                if (!classes.tick || Cookie.reduced()) return;
                el.classList.remove(classes.tick);
                void el.offsetWidth;    // the number pulses at each second
                el.classList.add(classes.tick);
            });
        }
    }

    function focusable(within) {
        return Array.prototype.filter.call(within.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'), function (el) {
            return !el.disabled && el.getAttribute('tabindex') !== '-1' && !el.hidden && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        });
    }

    function show(view, opener) {
        if (!ensure()) return;
        if (view !== 'banner' && view !== 'details') view = setting('reopen') === 'banner' ? 'banner' : 'details';
        var details = part('details');
        if (view === 'details' && (!details || details === ui.root)) view = 'banner';
        var was = ui.view;
        ui.view = view;
        ui.closed = false;
        if (view === 'details') ui.auto = false;
        if (view === 'details') {
            // Choosing is answering: no countdown behind the visitor's back.
            stopCountdown();
            if (was !== 'details') ui.opener = opener || document.activeElement;
        }
        if (was !== 'details') {
            ui.view = was === 'details' ? null : was;   // the rows as declared, the switches as answered
            rows();
            ui.view = view;
        }
        paint();
        if (view === 'details' && was !== 'details') {
            var first = focusable(details)[0] || details;
            try { first.focus(); } catch (e) { /* not focusable: the dialog itself was */ }
        }
        if (was !== view) emit('cookie:open', { view: view });
    }

    function back(to) {
        var opener = ui.opener;
        ui.opener = null;
        if (to !== 'details' && opener && opener.isConnected && typeof opener.focus === 'function') {
            try { opener.focus(); } catch (e) { /* gone */ }
        }
    }

    function hide(byVisitor) {
        var was = ui.view;
        if (was === null) return;
        ui.view = null;
        ui.auto = false;
        // Closed without an answer, the question is not put again at each page of the visit.
        ui.closed = !!byVisitor && pending();
        stopCountdown();
        paint();
        if (was === 'details') back(null);
        emit('cookie:close', { view: was });
    }

    /** Leave the detailed section without an answer: back to the question while one is wanted, closed otherwise. */
    function leave() {
        if (ui.view !== 'details') return hide(true);
        if (!pending()) return hide(true);
        ui.view = 'banner';
        paint();
        back('banner');
        emit('cookie:close', { view: 'details' });
    }

    /** After an answer: the switches as answered, the banner closed once nothing is left to ask. */
    function settle() {
        ui.closed = false;
        if (!ui.root) return;
        if (pending()) { rows(); paint(); return; }
        var was = ui.view;
        ui.view = null;
        ui.auto = false;
        rows();
        paint();
        if (was !== null) {
            if (was === 'details') back(null);
            emit('cookie:close', { view: was });
        }
    }

    // The countdown: the time left runs only while the question can be read.
    function startCountdown() {
        stopCountdown();
        var options = setting('countdown');
        if (!options) return;
        if (!plain(options)) options = { duration: options };
        var total = seconds(options.duration);
        if (!total || total <= 0) return;
        ui.left = total * 1000;
        ui.last = Date.now();
        ui.action = options.action || 'default';
        ui.timer = setTimeout(tick, 0);
        paint();
    }

    function stopCountdown() {
        if (ui.timer === null) return;
        clearTimeout(ui.timer);
        ui.timer = null;
        paint();
    }

    function tick() {
        var now = Date.now();
        if (!document.hidden) ui.left -= now - ui.last;
        ui.last = now;
        if (ui.left <= 0) {
            var action = ui.action;
            stopCountdown();
            log('countdown over:', action);
            if (action !== 'none' && pending()) decide(choice(action, true), 'countdown');
            return;
        }
        // Until the next whole second, so that the number shown is the time left.
        var next = ui.left - (Math.ceil(ui.left / 1000) - 1) * 1000;
        ui.timer = setTimeout(tick, Math.max(20, Math.min(1000, next)));
        paint();
    }

    function onClick(event) {
        var target = event.target instanceof Element ? event.target : null;
        if (!target || !order.length) return;
        var opener = target.closest(sel('open'));
        if (opener) {
            event.preventDefault();
            show(opener.getAttribute(hook('open')) || setting('reopen'), opener);
            return;
        }
        if (target.closest(sel('accept'))) return decide(choice('accept'), 'accept');
        if (target.closest(sel('refuse'))) return decide(choice('refuse'), 'refuse');
        var customize = target.closest(sel('customize'));
        if (customize) return ui.view === 'details' ? leave() : show('details', customize);
        if (target.closest(sel('save'))) return Cookie.save();
        if (target.closest(sel('close'))) return leave();
        if (inside(target)) return;
        // A click elsewhere, the question left without a word.
        var dismiss = setting('dismiss');
        if (ui.view === 'banner' && dismiss && dismiss !== 'none' && pending()) decide(choice(dismiss, true), 'dismiss');
    }

    function onKey(event) {
        if (ui.view !== 'details') return;
        var details = part('details');
        if (!details) return;
        if (event.key === 'Escape') { event.preventDefault(); leave(); return; }
        if (event.key !== 'Tab') return;
        // The focus stays in the detailed section.
        var list = focusable(details);
        if (!list.length) { event.preventDefault(); details.focus(); return; }
        var first = list[0];
        var last = list[list.length - 1];
        var at = document.activeElement;
        if (!details.contains(at)) { event.preventDefault(); first.focus(); return; }
        if (event.shiftKey && (at === first || at === details)) { event.preventDefault(); last.focus(); return; }
        if (!event.shiftKey && at === last) { event.preventDefault(); first.focus(); }
    }

    var queued = false;
    function observed() { queued = false; scan(); }

    /** Start, or start again: the signals, the inert elements, the banner while an answer is wanted. */
    function start() {
        if (!document.body) return;
        scan();
        if (!order.length) return;
        if (!ui.bound) {
            ui.bound = true;
            document.addEventListener('click', onClick);
            document.addEventListener('keydown', onKey);
        }
        if (setting('observe') && !ui.observer && typeof MutationObserver === 'function') {
            ui.observer = new MutationObserver(function () {
                if (queued) return;
                queued = true;
                Flow.frame(observed);
            });
            ui.observer.observe(document.body, { childList: true, subtree: true });
        }

        // A signal the site honours is a refusal already given: nothing left to ask, it is kept.
        var open = asked().filter(function (cat) { return answer(cat) === null; });
        if (open.length && open.every(signalled)) {
            var map = {};
            open.forEach(function (cat) { map[cat.id] = false; });
            return decide(map, 'signal');
        }

        // A banner the navigation swapped out with its page: the new page's takes its place, as it was.
        if (ui.root && !ui.root.isConnected) {
            ui.root = null;
            if (ui.view !== null && ensure()) paint();
        }
        if (open.length && ui.view === null && !ui.closed && setting('autoOpen')) {
            show('banner');
            ui.auto = true;
            startCountdown();
        } else if (!open.length && ui.view === 'banner' && ui.auto) {
            // The question it put by itself has its answer (a configuration that came after it).
            hide();
        } else if (ui.root) {
            rows();
            paint();
        }
    }

    /** At each moment a page is in: a configuration the page hands over, then the rest. */
    function page() {
        var name = hook('config');
        Array.prototype.forEach.call(document.querySelectorAll('script[type="application/json"][' + name + ']'), function (el) {
            if (el.__cookieRead) return;
            el.__cookieRead = true;
            try { Cookie.ready(JSON.parse(el.textContent)); } catch (e) { setTimeout(function () { throw e; }, 0); }
        });
        if (ready) start();
    }

    // ── For scripts ──────────────────────────────────────────────────────

    function snapshot(cat) {
        return {
            key: cat.key, label: cat.label === null ? cat.key : cat.label, description: cat.description,
            default: cat.default, required: cat.required, onDemand: cat.onDemand,
            storage: entries.filter(function (entry) { return entry.category === cat.id; }).map(function (entry) {
                return { type: entry.type, name: entry.name, duration: entry.duration, purpose: entry.purpose };
            }),
            features: cat.features.slice(),
            state: answer(cat), granted: granted(cat)
        };
    }

    /** Declare a category (or add to it), or read one: {key, label, description, default, required, storage, features, state, granted}. */
    Cookie.category = function (key, definition) {
        if (definition !== undefined) {
            var made = declare(key, definition, false, false);
            if (ready) start();
            return made ? snapshot(made) : null;
        }
        var cat = category(key);
        return cat ? snapshot(cat) : null;
    };

    /** The categories listed, in the order they were declared. */
    Cookie.categories = function () { return listedCategories().map(snapshot); };

    /** Declare what is stored: an entry {type, name, category, duration, purpose, path, domain}, or a list of them. */
    Cookie.storage = function (entry) {
        (Array.isArray(entry) ? entry : [entry]).forEach(store);
        if (ui.root) rows();
        return this;
    };

    /** true | false | null (no answer) for a category; null for one that is not declared. */
    Cookie.state = function (key) { var cat = category(key); return cat ? answer(cat) : null; };
    /** What a script should do now: the answer, else the category's default. */
    Cookie.granted = function (key) { var cat = category(key); return cat ? granted(cat) : false; };
    /** Whether an answer is wanted: a category without one, a new version, an answer too old. */
    Cookie.pending = function () { return pending(); };
    /** Whether an answer that still counts was given. */
    Cookie.answered = function () { return valid(); };

    function keyed(keys, value) {
        var map = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(function (key) { if (category(key)) map[id(key)] = value; });
        return map;
    }
    Cookie.accept = function () { decide(choice('accept'), 'accept'); return this; };
    Cookie.refuse = function () { decide(choice('refuse'), 'refuse'); return this; };
    /** Keep a choice {key: bool}; without one, the switches as the visitor set them (a category without a switch keeps its state). */
    Cookie.save = function (map) {
        var said = {};
        if (plain(map)) {
            Object.keys(map).forEach(function (key) { if (category(key)) said[id(key)] = !!map[key]; });
            decide(said, 'api');
            return this;
        }
        listedCategories().forEach(function (cat) { said[cat.id] = granted(cat); });
        parts('toggle').forEach(function (input) {
            var cat = category(input.getAttribute(hook('toggle')));
            if (cat) said[cat.id] = !!input.checked || cat.required;
        });
        decide(said, 'save');
        return this;
    };
    Cookie.grant = function (keys) { decide(keys === undefined ? choice('accept') : keyed(keys, true), 'api'); return this; };
    Cookie.revoke = function (keys) { decide(keys === undefined ? choice('refuse') : keyed(keys, false), 'api'); return this; };

    /** Erase the answer: the visitor is asked again. */
    Cookie.forget = function () {
        var before = states();
        try { recordStore().clear(); } catch (e) { /* nothing kept */ }
        if (setting('legacy')) {
            var s = web('local');
            order.forEach(function (ID) { try { if (s) s.removeItem(LEGACY + ID); } catch (e) { /* closed */ } });
        }
        record = undefined;
        ui.closed = false;
        follow(before, order.slice(), 'api');
        if (ready) start();
        return this;
    };

    /** Open the banner ("banner") or the detailed section ("details"); the `reopen` option's by default. */
    Cookie.open = function (view, opener) {
        if (order.length) show(view || setting('reopen'), opener);
        return this;
    };
    Cookie.close = function () { hide(true); return this; };
    /** The banner's element, once there is one. */
    Cookie.banner = function () { return ui.root; };
    /** fn(detail) at each answer. */
    Cookie.onConsent = function (fn) {
        window.addEventListener('cookie:consent', function (event) { fn(event.detail, event); });
        return this;
    };

    /** As loaded: no category, no declaration, no feature, no banner. The answer kept stays where it is. */
    Cookie.destroy = function () {
        stopCountdown();
        if (ui.observer) ui.observer.disconnect();
        if (ui.root) {
            var details = part('details');
            if (ui.built && ui.root.parentNode) ui.root.parentNode.removeChild(ui.root);
            else { ui.root.hidden = true; if (details) details.hidden = true; }
        }
        if (ui.bound) {
            document.removeEventListener('click', onClick);
            document.removeEventListener('keydown', onKey);
        }
        ui = { root: null, built: false, view: null, opener: null, closed: false, auto: false, timer: null, left: 0, last: 0, action: null, bound: false, observer: null };
        cats = {};
        order = [];
        entries = [];
        record = undefined;
        ready = false;
        Object.keys(Options).forEach(function (key) { delete Options[key]; });
        Options.groups = [];
        return this;
    };

    // ── @glitchr/cookie ──────────────────────────────────────────────────
    // Its methods, with their meaning. The events it triggered through jQuery
    // on window are native ones: $(window).on("cookie:confirm") hears them.

    Cookie.reset = function (el) {
        var $ = Flow.jquery();
        if ($) {
            var targetData = $.data(el || document.documentElement);
            Object.keys(targetData).forEach(function (key) { delete targetData[key]; });
            $(window).off('cookie');
        }
        return this;
    };

    Cookie.ready = function (options) {
        Cookie.configure(options || {});
        ready = true;

        log('ready');
        window.dispatchEvent(new Event('cookie:ready'));

        start();
        Cookie.refresh();
        return this;
    };

    Cookie.hasConsents = function (groupname) {
        var N = 0;
        (this.getOption('groups') || []).forEach(function (_groupname) {
            if (groupname !== undefined && groupname !== _groupname) return;
            var consent = Cookie.checkConsent(_groupname);
            if (consent === true || consent === null) N++;
        });
        return N;
    };

    Cookie.refresh = function (defaultConsentDisplayed) {
        if (defaultConsentDisplayed === undefined) defaultConsentDisplayed = false;
        var consent = this.hasConsents() > 0 ? true : defaultConsentDisplayed;
        switch (consent) {
            case null: window.dispatchEvent(new CustomEvent('cookie:check')); break;
            case true: window.dispatchEvent(new CustomEvent('cookie:confirm')); break;
            case false: window.dispatchEvent(new CustomEvent('cookie:deny')); break;
        }
        return this;
    };

    Cookie.getOption = function (key) {
        if (key in Cookie.options) return Cookie.options[key];
        return null;
    };

    Cookie.setOption = function (key, value) {
        Cookie.options[key] = value;
        return this;
    };

    Cookie.addOption = function (key, value) {
        if (!(key in Cookie.options)) Cookie.options[key] = [];
        if (Cookie.options[key].indexOf(value) === -1) Cookie.options[key].push(value);
        return this;
    };

    Cookie.removeOption = function (key, value) {
        if (key in Cookie.options) {
            Cookie.options[key] = Cookie.options[key].filter(function (option) { return value !== option; });
            return Cookie.options[key];
        }
        return null;
    };

    Cookie.configure = function (options) {
        for (var key in options) {
            if (!Object.prototype.hasOwnProperty.call(options, key)) continue;
            var value = options[key];
            if (value === undefined) continue;
            if (key === 'categories') {
                if (Array.isArray(value)) value.forEach(function (definition) { declare(definition.key, definition, false, false); });
                else if (plain(value)) Object.keys(value).forEach(function (name) { declare(name, value[name] || {}, false, false); });
                continue;
            }
            if (key === 'storage') { (Array.isArray(value) ? value : [value]).forEach(store); continue; }
            if (MAPS.indexOf(key) !== -1 && plain(value) && plain(Options[key])) Options[key] = Object.assign({}, Options[key], value);
            else Options[key] = value;
        }
        // Where the answer is kept may have changed: read again when next asked.
        record = undefined;
        log('configuration', Options);
        return this;
    };

    Cookie.onConfirm = function (onConfirm) { window.addEventListener('cookie:confirm', onConfirm); return this; };
    Cookie.onDeny = function (onDeny) { window.addEventListener('cookie:deny', onDeny); return this; };
    Cookie.onCheck = function (onCheck) { window.addEventListener('cookie:check', onCheck); return this; };

    Cookie.onLoad = function (el) {
        Cookie.reset(el === undefined ? window : el);
        return this;
    };

    Cookie.getConsents = function () {
        var consents = [];
        var s = web('local');
        for (var i = 0; s && i < s.length; i++) {
            if (s.key(i).indexOf(LEGACY) >= 0) consents.push(s.key(i));
        }
        return consents;
    };

    Cookie.declare = function (groupname) {
        this.addGroup(groupname);
        this.refresh();
    };

    /** true | false | null: a category's answer, else what localStorage "cookie/<GROUP>" holds. */
    Cookie.checkConsent = function (groupname) {
        var cat = category(groupname);
        if (cat) return answer(cat);
        var s = web('local');
        try { var value = JSON.parse(s.getItem(LEGACY + groupname)); return value === undefined || value === null ? null : value; } catch (e) { return null; }
    };

    Cookie.setConsent = function (consent, groupname) {
        consent = Boolean(consent);
        (Array.isArray(groupname) ? groupname : [groupname]).forEach(function (name) { Cookie.addGroup(name); });

        var map = {};
        var some = false;
        (this.getOption('groups') || []).forEach(function (_groupname) {
            if (Array.isArray(groupname) && !groupname.includes(_groupname)) return;
            if (!Array.isArray(groupname) && groupname !== _groupname && groupname !== undefined) return;

            var cat = category(_groupname);
            if (cat) { map[cat.id] = consent; some = true; return; }

            var s = web('local');
            try { if (s) s.setItem(LEGACY + _groupname, consent); } catch (e) { /* closed */ }
            if (consent === false) Cookie.delete(_groupname);
        });

        if (some) decide(map, 'api'); else this.refresh();
    };

    // The category of a cookie written the old way, "GROUP/NAME": the one that
    // declares it, else the one whose key is the group.
    function legacyCategory(groupname, name) {
        var entry = declared('cookie', groupname + '/' + name);
        if (entry) return cats[entry.category] || false;
        return cats[groupname] || null;
    }

    Cookie.get = function (groupname, name) {
        groupname = groupname.toUpperCase();
        name = name.toUpperCase();

        var cat = legacyCategory(groupname, name);
        if (cat === false || (cat && !granted(cat))) {
            log('read cookie', groupname + '/' + name, '- its category is not granted - left alone');
            return null;
        }

        var dc = document.cookie;
        var prefix = groupname + '/' + name + '=';

        var begin = dc.indexOf('; ' + prefix);
        if (begin === -1) {
            begin = dc.indexOf(prefix);
            if (begin !== 0) return null;
        } else {
            begin += 2;
        }

        var end = document.cookie.indexOf(';', begin);
        if (end === -1) end = dc.length;

        return decodeURI(dc.substring(begin + prefix.length, end));
    };

    Cookie.addGroup = function (groupname) {
        if (groupname === undefined) return this;
        if (!Array.isArray(Options.groups)) Options.groups = [];
        if (Options.groups.indexOf(groupname) >= 0) return this;

        Options.groups.push(groupname);
        return this;
    };

    Cookie.set = function (groupname, name, value, expires, reloadIfNotSet, path) {
        if (reloadIfNotSet === undefined) reloadIfNotSet = false;
        if (path === undefined) path = '/';
        groupname = groupname.toUpperCase();
        name = name.toUpperCase();

        var reload = false;
        if (!(expires instanceof Date)) {
            switch (typeof expires) {
                case 'string':
                    expires = new Date(expires);
                    break;
                default:
                    var date = new Date();
                    date.setTime(date.getTime() + Number(expires) * 1000);
                    expires = date;
            }
        }

        // A category answers for its group; a bare group is written until refused.
        var cat = legacyCategory(groupname, name);
        if (cat === false || (cat ? !granted(cat) : this.checkConsent(groupname) === false)) {
            log('write cookie', groupname + '/' + name, '- refused - left alone');
            return;
        }

        // Already came here..
        var cookie = this.get(groupname, name);
        if (cookie === null) reload = reloadIfNotSet;

        if (typeof value === 'object') value = JSON.stringify(value);

        try {
            document.cookie = groupname + '/' + name + '=' + value +
                ';path=' + path +
                ';expires = ' + expires.toUTCString() + '; SameSite=Strict; secure';
        } catch (e) {
            try {
                document.cookie = groupname + '/' + name + '=' + value +
                    ';path=' + path +
                    ';expires = ' + expires.toUTCString() + '; SameSite=Strict;';
            } catch (e2) {
                console.error(e2);
                reload = false;
            }
        }

        if (reload) window.location.reload();
    };

    Cookie.delete = function (groupname, path) {
        if (groupname === undefined) groupname = '';
        if (path === undefined) path = '/';
        groupname = groupname.toUpperCase();

        var cookieList = document.cookie.split(';');
        for (var i = 0; i < cookieList.length; i++) {
            var cookie = cookieList[i].trim();
            var cookieName = cookie.split('=')[0];

            // If the prefix of the cookie's name matches the one specified, remove it
            if (cookieName.indexOf(groupname ? groupname + '/' : '') === 0) {
                document.cookie = cookieName + '=null;expires=Thu, 01 Jan 1970 00:00:00 GMT; path=' + path;
            }
        }
    };

    window.addEventListener('load', function () { Cookie.onLoad(); });
    Flow.onPage(page);

    return Cookie;
});
