# Cookie

`src/js/cookie.js` - what a site keeps in the visitor's browser, and the
visitor's say over it. The successor of `@glitchr/cookie` 1.0.53: the `Cookie`
global and its methods keep their names and their meaning (see
[From @glitchr/cookie](#from-glitchrcookie)). Needs the core; no jQuery.

```js
import '@glitchr/flowjs/cookie';      // the core and the Cookie global, no stylesheet
```

Three things are declared by the site, never by the library:

- **categories** of consent - a key, the site's words for it, whether it is on
  before any answer, whether it can be refused;
- **what is stored** - each cookie, `localStorage` or `sessionStorage` entry,
  by name or pattern, with its duration and its purpose, under a category;
- **features** - what to start when a category is granted and to stop when it
  is withdrawn: a function, or an inert element of the page.

The library keeps the answer, asks again when it has to, shows the banner and
the detailed section, and enforces the answer: nothing is read or written
through it under a refused category, and what a withdrawn category governed is
erased.

**No sentence is written in the library.** Every word the visitor reads comes
from the configuration (`texts`, the categories' `label` and `description`) or
from the site's own HTML.

## A site's configuration

```js
Cookie.ready({
    version: '2026-10',                       // of the categories: changed, the visitor is asked again
    position: 'bottom-left',                  // a word for the stylesheet (data-cookie-position)

    categories: {
        necessary: {
            label: 'Le fonctionnement du site',
            description: 'Votre session et votre panier.',
            required: true,                   // cannot be refused: its switch is locked on
            storage: [
                { type: 'cookie', name: 'PHPSESSID', duration: 'session', purpose: 'Votre session.' }
            ]
        },
        preferences: {
            label: 'Vos préférences',
            description: 'Votre langue, votre thème, votre fuseau horaire.',
            default: true,                    // on until refused
            storage: [
                { type: 'cookie', name: 'USER/*', duration: '30d', purpose: 'Langue, thème, fuseau horaire.' },
                { type: 'local', name: 'theme', purpose: 'Le thème choisi.' }
            ]
        },
        analytics: {
            label: 'La mesure d\'audience',
            description: 'Un identifiant anonyme pour compter les visites.',
            storage: [
                { type: 'cookie', name: '_pk_*', duration: '13mo', purpose: 'Matomo.' },
                { type: 'cookie', name: 'VISITOR_ID', duration: '1y', purpose: 'Un identifiant tiré au hasard.' }
            ]
        },
        location: {
            label: 'Votre position',
            description: 'Pour indiquer la boutique la plus proche.',
            storage: [
                { type: 'session', name: 'position', purpose: 'Votre position, le temps de la visite.' }
            ]
        }
    },

    countdown: { duration: '10s', action: 'default' },   // the site's choice; none by default

    texts: {
        label: 'Les cookies',
        text: { html: 'Le site ne garde que ce qui le fait marcher. <a href="/confidentialite">Confidentialité</a>.' },
        countdown: 'Sans réponse de votre part, ce choix est retenu dans {count} s.',
        accept: 'D\'accord',
        refuse: 'Refuser',
        customize: 'Personnaliser',
        detailsTitle: 'Vos choix',
        acceptAll: 'Tout accepter',
        refuseAll: 'Tout refuser',
        save: 'Enregistrer mes choix',
        close: 'Fermer',
        required: 'Toujours actif'
    }
});

// A measure of audience: started on a yes, stopped on a withdrawal.
Cookie.use('analytics', function () { startMatomo(); }, function () { stopMatomo(); });

// The time zone, remembered only under "preferences".
Cookie.use('preferences', function () {
    Cookie.cookies.set('USER/TIMEZONE', Intl.DateTimeFormat().resolvedOptions().timeZone);
});

// The position, read only under "location".
Cookie.use('location', function () {
    navigator.geolocation.getCurrentPosition(function (position) {
        Cookie.session.set('position', { lat: position.coords.latitude, lng: position.coords.longitude });
        showNearestShop(position);
    });
}, function () { hideNearestShop(); });
```

```html
<!-- An analysis script that waits for "analytics" -->
<script type="text/plain" data-cookie-category="analytics" data-src="https://stats.example.org/matomo.js"></script>

<!-- A map that waits for "location", and what is shown meanwhile -->
<template data-cookie-category="location"><div id="map"></div></template>
<p data-cookie-placeholder="location">La carte s'affiche une fois votre position autorisée.
    <button type="button" data-cookie-open>Cookies</button></p>

<!-- The footer's link: the detailed section, at any time -->
<a href="#" data-cookie-open>Cookies</a>
```

The same configuration can be handed by the page instead of a script - what a
server that translates its texts does:

```html
<script type="application/json" data-cookie-config>{"version": "2026-10", "categories": {...}, "texts": {...}}</script>
```

It is read when the page is loaded (and after every page the navigation swaps
in), as `Cookie.ready()` would be called with it.

## Categories

`categories` in the configuration (an object by key, or a list of
`{key: ...}`), or `Cookie.category(key, definition)` at any time.

| Field | Default | Meaning |
| --- | --- | --- |
| `key` | | the category's name: in the answer kept, in `Cookie.use()`, in `data-cookie-category`. Not case-sensitive |
| `label`, `description` | the key, nothing | the site's words, shown in the detailed section |
| `default` | `false` | its state before any answer: `true` is on until refused, `false` waits for a yes |
| `required` | `false` | cannot be refused: always granted, its switch locked on |
| `storage` | `[]` | what it stores, see below |
| `features` | `[]` | names (or `{name, label}`) of what it governs besides storage, for the detailed section; `Cookie.use()` with a `feature` adds to it |
| `onDemand` | `false` | known (its words are ready) but listed only once something uses it - `Cookie.use()`, an inert element - and never a reason by itself to ask the visitor again |

```js
Cookie.category('chat', { label: 'La messagerie', storage: [{ type: 'cookie', name: 'crisp-client*' }] });
Cookie.category('chat');     // {key, label, description, default, required, storage, features, state, granted}
Cookie.categories();         // every category listed, in order
Cookie.state('chat');        // true | false | null (no answer)
Cookie.granted('chat');      // what a script should do now: the answer, else the default
```

## What is stored

Each entry: `{type, name, category, duration, purpose, path, domain}` - under a
category's `storage`, in the configuration's `storage` list (with its
`category`), or by `Cookie.storage(entry)`.

| Field | Meaning |
| --- | --- |
| `type` | `cookie` (default), `local` (`localStorage`) or `session` (`sessionStorage`) |
| `name` | the name, or a pattern with `*` (`_pk_*`, `USER/*`); a `RegExp` in a script |
| `duration` | how long it is kept: seconds, or `"30d"`, `"12h"`, `"13mo"`, `"1y"`, `"session"`. The lifetime of a cookie written through the library; shown in the detailed section |
| `purpose` | the site's words for what it is for |
| `path`, `domain` | of the cookie, when it is not the site's default (needed to erase a third party's) |

Reading and writing through the library goes by the declaration:

```js
Cookie.cookies.set('VISITOR_ID', id);          // written for a year, if "analytics" is granted
Cookie.cookies.get('VISITOR_ID');              // null while it is not
Cookie.cookies.remove('VISITOR_ID');
Cookie.local.set('theme', 'dark');   Cookie.local.get('theme');   Cookie.local.remove('theme');
Cookie.session.set('position', {lat: 48.58, lng: 7.75});          // an object is kept as JSON
```

- Under a category that is not granted, `set` writes nothing and returns
  `false`, `get` returns `null`; with `debug: true` the console says which
  entry and which category.
- An entry that was not declared is refused the same way (`undeclared: 'deny'`,
  the default); `undeclared: 'allow'` lets it through.
- When a category is refused or withdrawn, everything it declares is erased:
  the cookies matching its names (on the declared path and domain, on `/`, and
  on the host's parent domains), the `localStorage` and `sessionStorage`
  entries.

A script that writes with `document.cookie` or `localStorage` itself is not
stopped by the library: have it wait for its category with `Cookie.use()`.

## Features

```js
var on = Cookie.use(category, [options], onGrant, onRevoke);
```

`onGrant` runs now if the category is granted, and each time it becomes so;
`onRevoke` each time it is withdrawn. Returns whether it is granted now. A
category that is not known yet is declared from `options` (`label`,
`description`, `default`, `required`, `storage`) as an on-demand one - the
shape of omnibase/consent's `Consent.use(name, options, onEnable, onDisable)`,
whose `implicit` (for `default`) and `erase` (name prefixes of cookies) are
understood too. `options.feature` (a name, or `{name, label}`) adds the
feature to the category's list, in the detailed section.
`Cookie.unuse(category, onGrant)` takes it back.

Elements of the page wait for a category too, inert until it is granted:

| Markup | At the grant | At the withdrawal |
| --- | --- | --- |
| `<script type="text/plain" data-cookie-category="k" [data-src] [data-type]>` | replaced by a script that runs (once) | nothing: a script that ran cannot be taken back - stop it in `onRevoke`, or reload |
| `<template data-cookie-category="k">` | its content is put in the page, before it | that content is removed |
| `<iframe data-cookie-category="k" data-cookie-src="...">` (any element with a `src`) | `src` is set | `src` is removed |
| `<... data-cookie-placeholder="k">` | hidden | shown |

They are looked for when the page is loaded, after every page the navigation
swaps in, at each answer, by `Cookie.scan(root)`, and continuously with
`observe: true` (a `MutationObserver`, for pages built by scripts).

## Events

On `window`:

| Event | When | `detail` |
| --- | --- | --- |
| `cookie:consent` | an answer was given or changed | `{categories: {key: bool}, granted: [keys], revoked: [keys], source, pending}` - `source`: `accept`, `refuse`, `save`, `countdown`, `dismiss`, `signal` or `api` |
| `cookie:grant`, `cookie:revoke` | one category went on, or off | `{category}` |
| `cookie:open`, `cookie:close` | the banner or the detailed section opened, closed | `{view}` - `banner` or `details` |
| `cookie:ready` | `Cookie.ready()` was called | as in `@glitchr/cookie` |
| `cookie:confirm`, `cookie:deny`, `cookie:check` | `Cookie.refresh()`, as in `@glitchr/cookie` | |

`Cookie.onConsent(fn)` listens to the first.

## The interface

A **banner** - the question, accept, refuse, and "customize" - and a
**detailed section** - one row per category with its switch, accept all,
refuse all, save. The banner shows by itself while an answer is wanted
(`Cookie.pending()`); anything with `data-cookie-open` opens the detailed
section at any time (`data-cookie-open="banner"` the banner).

The HTML is the site's, or the library's minimal one:

- an element with `data-cookie-banner` in the page is used as it is (a
  `<template data-cookie-banner>` is cloned into the page);
- or `template`: a selector, an element, HTML, or a function returning one;
- else a bare default is built - a `<div>` with the parts below whose words
  `texts` has (a button without its word is not made), the classes of
  `classes`, and no style. Its texts: `label` (the dialog's name), `title`,
  `text`, `countdown` (with `{count}` where the seconds go), `accept`,
  `refuse`, `customize`, `detailsTitle`, `detailsText`, `acceptAll`,
  `refuseAll` (else `accept` and `refuse`), `save`, `close`, `required`.

The parts are found by attribute, wherever they are in the banner:

| Attribute | Part |
| --- | --- |
| `data-cookie-banner` | the root; gets `data-cookie-position`, the state classes and the `variables` |
| `data-cookie-summary` | the question; hidden while the detailed section is open |
| `data-cookie-text="key"` | filled with `texts[key]` when the configuration has it (left as written otherwise) |
| `data-cookie-accept`, `data-cookie-refuse` | every category on / off (but the required ones) |
| `data-cookie-customize` | opens the detailed section |
| `data-cookie-details` | the detailed section (a modal dialog) |
| `data-cookie-categories` | where the rows go |
| `<template data-cookie-row>` | the site's row, cloned per category; else a default row |
| `data-cookie-toggle`, `data-cookie-label`, `data-cookie-description`, `data-cookie-required`, `data-cookie-entries`, `data-cookie-features` | in a row: the checkbox (`role="switch"`), the words, the mark of a required category (`texts.required`), the lists of what it stores (an item per entry, `data-cookie-entry="cookie"` with its `-name`, `-duration` and `-purpose`) and governs |
| `data-cookie-save` | keeps the switches as set |
| `data-cookie-close` | closes without answering |
| `data-cookie-countdown`, `data-cookie-count` | the countdown's sentence (shown only while it counts) and the seconds left |

The prefix is an option (`prefix: 'data-consent'`), and each name too
(`hooks: {category: 'data-consent-script'}`).

`src/css/cookie.scss` is an optional, minimal stylesheet (where the banner
sits for each `position`, the switches) drawn from `--cookie-*` properties;
it is not imported by any entry.

### The countdown

None by default: under the GDPR a silence is not a consent. A site that wants
one says so:

```js
countdown: { duration: '10s', action: 'default' }     // or countdown: '10s' - the action is then "default"
```

| `action` | When the time is up |
| --- | --- |
| `default` | each category takes its `default` (what omnibase/consent does today: the site's own on, the rest off) |
| `accept` | every category on |
| `refuse` | every category off, but the required ones |
| `none` | nothing: the countdown ends, the banner stays and waits |

It waits while the page is hidden (another tab), goes on across the pages the
navigation swaps in, and stops for good once the visitor opens the detailed
section or answers. `countdown: false`, `0` or
nothing: no countdown. `dismiss` gives a click outside the banner the same
choice of four (`none` by default).

A category covered by a privacy signal the site honours is never turned on by
a countdown or a click outside.

### Asking again

The visitor is asked again when `version` is not the one they answered, when
a category that is not on demand has no answer (a new one), or when the answer
is older than `record.lifetime`. With a new version or an expired answer, the
old answers no longer count: the categories are back to their `default`.
`Cookie.forget()` erases the answer. A banner the visitor closed without
answering (`data-cookie-close`, `Cookie.close()`) is not put again at each page
the navigation swaps in: it comes back at the next page loaded, or when there
is something new to ask.

### Privacy signals

```js
signals: { gpc: true, dnt: false }      // or a list of categories: {gpc: ['analytics', 'ads']}
```

Off by default. When the site asks for it and the browser sends the signal
(`navigator.globalPrivacyControl`, `navigator.doNotTrack`), the categories it
covers (`true`: every one that is not required) are off without asking; if
that leaves nothing to ask, the banner does not show and the refusal is kept
(`source: 'signal'`). The visitor can still open the detailed section and
decide otherwise: an explicit choice wins.

### Accessibility

The banner is a labelled dialog, announced politely when it shows, and does
not take the focus. The detailed section is a modal dialog: the focus goes
into it, <kbd>Tab</kbd> stays inside, <kbd>Escape</kbd> closes it, and the
focus goes back to what opened it. A switch is a checkbox with
`role="switch"`, operated with <kbd>Space</kbd>, described by its
category's description. With `prefers-reduced-motion`, the count does not
pulse (`classes.tick` is not set) and the root has `classes.reduced`.

## Options (`Cookie.defaults`)

| Option | Default | Meaning |
| --- | --- | --- |
| `debug` | `false` | the console says what is declared, refused, erased |
| `version` | `null` | of the categories; a change asks again |
| `categories` | `{}` | see [Categories](#categories) |
| `storage` | `[]` | entries with their `category`, see [What is stored](#what-is-stored) |
| `undeclared` | `'deny'` | an entry read or written through the library without a declaration: `deny` or `allow` |
| `record` | `{store: 'cookie', name: 'cookie-consent', lifetime: '180d'}` | where the answer is kept, and for how long. `store`: `cookie`, `local`, or `{read(), write(text), clear()}`. A cookie also takes `path`, `domain`, `sameSite`, `secure`, by default those of `cookie` |
| `cookie` | `{path: '/', domain: null, sameSite: 'Lax', secure: 'auto'}` | the attributes of every cookie the library writes; `secure: 'auto'` is `Secure` on https |
| `legacy` | `true` | keep `localStorage` `cookie/<KEY>` in step, as `@glitchr/cookie` kept its consents, and take the answers found there when there is no record yet |
| `countdown` | `false` | `{duration, action}`, see [The countdown](#the-countdown) |
| `dismiss` | `'none'` | what a click outside the banner answers: `none`, `default`, `accept`, `refuse` |
| `signals` | `{gpc: false, dnt: false}` | see [Privacy signals](#privacy-signals) |
| `autoOpen` | `true` | show the banner by itself while an answer is wanted |
| `reopen` | `'details'` | what `data-cookie-open` and `Cookie.open()` show once answered: `details` or `banner` |
| `position` | `null` | any word, written in `data-cookie-position` for the stylesheet |
| `container` | `null` | where a banner the library builds is put (a selector or an element); the end of `<body>` |
| `template` | `null` | the banner's HTML: a selector, an element, a string of HTML, a function |
| `prefix` | `'data-cookie'` | the prefix of every attribute above |
| `hooks` | `{}` | an attribute's full name, by part: `{open: 'data-consent-open'}` |
| `classes` | see the code | the class of each part of the default banner and of each state: `root`, `summary`, `text`, `actions`, `button`, `details`, `list`, `row`, `open`, `pending`, `customizing`, `counting`, `tick`, `reduced`... |
| `variables` | `{}` | CSS custom properties set on the banner: `{'--cookie-accent': '#24447c'}` |
| `texts` | `{}` | every word: a string, or `{html: '...'}` |
| `observe` | `false` | watch the page for inert elements added later |

## Methods

```js
Cookie.ready(options)            // configure and start; may be called again, the options add up
Cookie.category(key[, def])      Cookie.categories()      Cookie.storage(entry | list)
Cookie.state(key)                Cookie.granted(key)      Cookie.pending()      Cookie.answered()
Cookie.accept()                  Cookie.refuse()          Cookie.save({key: bool})
Cookie.grant(key | keys)         Cookie.revoke(key | keys)                      Cookie.forget()
Cookie.use(category, [options], onGrant, onRevoke)        Cookie.unuse(category, onGrant)
Cookie.cookies / Cookie.local / Cookie.session            // .get(name) .set(name, value[, options]) .remove(name)
Cookie.open([view])              Cookie.close()           Cookie.banner()       Cookie.scan([root])
Cookie.onConsent(fn)             Cookie.signals()         Cookie.reduced()
Cookie.destroy()                 // as loaded: no category, no declaration, no banner (the answer kept stays)
```

## From @glitchr/cookie

`package.json`: `"@glitchr/cookie"` gives way to `"@glitchr/flowjs"`; the import
`'@glitchr/cookie'` becomes `'@glitchr/flowjs/cookie'` (or nothing, with the
whole library). jQuery is no longer needed.

Everything 1.0.53 had is there, with the same meaning:

| | |
| --- | --- |
| `Cookie.ready(options)`, `Cookie.configure(options)`, `Cookie.options`, `getOption`, `setOption`, `addOption`, `removeOption` | as before; `ready()` without categories shows nothing |
| `Cookie.set(group, name, value, expires, reloadIfNotSet, path)` | writes the cookie `GROUP/NAME` (`SameSite=Strict; Secure`) unless the group is refused |
| `Cookie.get(group, name)`, `Cookie.delete(group, path)` | as before |
| `Cookie.checkConsent(group)`, `Cookie.setConsent(consent, group)`, `Cookie.hasConsents(group)`, `Cookie.getConsents()` | `localStorage` `cookie/<GROUP>`, as before |
| `Cookie.declare(group)`, `Cookie.addGroup(group)`, `Cookie.refresh()` | as before |
| `Cookie.onConfirm(fn)`, `Cookie.onDeny(fn)`, `Cookie.onCheck(fn)` | the events are native ones on `window` (`cookie:confirm`...); jQuery's `$(window).on()` hears them as before |
| `Cookie.reset(el)`, `Cookie.onLoad(el)` | as before, when jQuery is there |

A **group** whose name is a category's key is that category: `Cookie.set()`
writes when the category is granted (a category with `default: false` waits
for a yes, where a bare group was written until refused), `Cookie.get()`
returns `null` when it is refused, `checkConsent()` gives its state and
`setConsent()` answers for it. A group that is no category behaves exactly as
in 1.0.53.
