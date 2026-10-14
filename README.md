# Flow

Scroll and navigation for pages that are server-rendered: links and forms that
load the next page in the background, scroll effects, scroll stops, sortable
lists, named AJAX channels, and the cookies with the visitor's consent. One library, one module per feature, one shared
core. The modules are independent of each other: import what a page needs.

| Module | Global | Entry | What it does | Needs |
| --- | --- | --- | --- | --- |
| core | `Flow` | loaded by every entry | units and durations, scrollers, one scroll/resize/interrupt listener per scroller, one animation frame for the measurements, programmatic scroll, the address hash, page-loaded moments, the jQuery plugins | nothing |
| navigation | `Transparent` | `navigation` | links and forms load in the background and swap the page in place; history, scroll positions, head and scripts kept in step; nested panels, prefetch, form memory, lazy loading | jQuery |
| sticky | `Sticky` | `sticky` | scroll effects: hiding header, bottom bar, widgets, fading blocks, the address following the headline read, magnets, scroll-percent triggers, swipes, autoscroll | jQuery |
| stops | `StickyStops` | `stops` | places on the page that a scroll settles on once it comes to rest, with keys and sideways rows | nothing |
| sortable | `StickySortable` | `sortable` | drag-and-drop reordering with pointer events | nothing (jQuery only for the `$.fn.stickySortable` plugin) |
| ajaxer | `Ajaxer` | `ajaxer` | named AJAX channels over `$.ajax`: throttle, debounce, loader, retry, request limit | jQuery |
| cookie | `Cookie` | `cookie` | what a site stores in the browser and the visitor's consent to it: categories the site declares, the cookies and storage entries under each, features started at a grant and stopped at a withdrawal, a banner and a detailed section in the site's words | nothing |

Per module: [navigation](docs/navigation.md), [sticky and stops](docs/sticky.md),
[sortable](docs/sortable.md), [ajaxer](docs/ajaxer.md), [cookie](docs/cookie.md).

## Use

Everything, with the stylesheets (bundler with Sass and jQuery provided, e.g.
webpack's `ProvidePlugin`):

```js
import '@glitchr/flowjs';
```

One module (its stylesheet when it has one, and the core):

```js
import '@glitchr/flowjs/navigation';   // Transparent
import '@glitchr/flowjs/sticky';       // Sticky
import '@glitchr/flowjs/stops';        // StickyStops
import '@glitchr/flowjs/sortable';     // StickySortable
import '@glitchr/flowjs/ajaxer';       // Ajaxer
import '@glitchr/flowjs/cookie';       // Cookie
```

Without a bundler, the files of `src/js/` in a page, `core.js` first:

```html
<script src="jquery.js"></script>
<script src="src/js/core.js"></script>
<script src="src/js/stops.js"></script>
```

Each module sets its global (`window.Transparent`, ...) and registers itself on
the core (`Flow.navigation`, `Flow.sticky`, `Flow.stops`, `Flow.sortable`,
`Flow.ajaxer`, `Flow.cookie`). The stylesheets are `src/css/navigation.scss`,
`sticky.scss`, `ajaxer.scss`, and `index.scss` for all of them; `cookie.scss`,
a minimal look for the cookie banner, is imported by no entry - a site asks for
it (`@glitchr/flowjs/src/css/cookie.scss`) or styles its banner itself.

## Options

Each module is configured through its own global; the defaults are in the
source, listed here for the ones that matter. The other options of a module are
commented where its settings object starts (`src/js/<module>.js`).

**Transparent** - `Transparent.ready({...})`, defaults in `Transparent.settings`:
`identifier` (`"#page"`, the block swapped), `loader` (`"#loader"`), `throttle`
(`1000`), `prefetch` (`true`; only links with `rel="prefetch"`),
`prefetch_delay` (`65`), `prefetch_ttl` (`30000`), `prefetch_max` (`15`),
`exit_duration` (`0`), `exceptions` (`[]`, paths left to the browser), `nest`
(`[]`, path patterns opened as a nested panel), `headlock` (`[]`),
`use_view_transitions` (`false`), `progress_bar` (`true`), `cache_version`
(`null`), `lazyload` (`true`), `smoothscroll_duration` (`"200ms"`),
`disable` (`false`), `debug` (`false`). The `nest_*` options (move, resize, snap,
dock, swipe, keepalive, remember) are all on by default. Details in
[docs/navigation.md](docs/navigation.md).

**Sticky** - `Sticky.ready({...})`, defaults in `Sticky.settings`: `easein`
(`"100px"`), `easeout` (`"50px"`), `easetime` (`"250ms"`), `easedelay`,
`replacehash` (`true`), `scrollhide` (`true`), `scrolllock` (`true`),
`scrollsnap` (`true`; `scrollsnap_hold` `true`: the way to a magnet holds the
scroll, `scrollsnap_keys` `false`: the arrows go from magnet to magnet),
`swipe` (`true`), `swipehint` (`true`), `autoscroll`
(`true`, with `autoscroll_speed` 100 px/s, `autoscroll_delay` `"2s"`,
`autoscroll_minwidth` 200, `autoscroll_minheight` 400, `autoscroll_reverse`),
`smoothscroll_duration` (`"250ms"`), `debug`, `disable`. Classes: `.sticky-top`,
`.sticky-bottom`, `.sticky-widget`, `.sticky-easein`, `.sticky-easeout`,
`.sticky-headlines`, `.sticky-magnet`, `.sticky-autoscroll`.

**StickyStops** - `StickyStops.attach(scroller, {...})`, defaults in
`StickyStops.defaults`: `selector` (`".sticky-stop"`), `settle` (160), `tolerance`
(3), `reach` (`Infinity`), `duration` (0), `easing`, `bandUp`/`bandDown` (0),
`progress` (`true`), `smooth` (`true`), `axis` (`"y"`), `keys` (`false`), `end`
(`false`). Full description in [docs/sticky.md](docs/sticky.md).

**StickySortable** - `new StickySortable(container, {...})` or
`$(container).stickySortable({...})`; defaults in `StickySortable.defaults`:
`handle`, `items` (`"[data-sortable-item]"`), `axis` (`"y"`), `dragThreshold`
(4), `autoscroll` (`true`), `onChange`, and the merge options. See
[docs/sortable.md](docs/sortable.md).

**Ajaxer** - per-channel setters (`Ajaxer.setUrl(name, url)`, ...); defaults
`method` `"POST"`, `output` `"json"`, `throttle` 1000, `retry_limit` 1,
`loader_debounce` 1500. See [docs/ajaxer.md](docs/ajaxer.md).

**Cookie** - `Cookie.ready({...})`, or a `<script type="application/json"
data-cookie-config>` in the page; defaults in `Cookie.defaults`: `version`
(`null`; changed, the visitor is asked again), `categories` (`{}`: `label`,
`description`, `default`, `required`, `storage`, `features`, `onDemand`),
`storage` (`[]`), `undeclared` (`"deny"`), `record` (`{store: "cookie", name:
"cookie-consent", lifetime: "180d"}`), `cookie` (`{path: "/", domain: null,
sameSite: "Lax", secure: "auto"}`), `countdown` (`false`; `{duration, action}`
with `action` `"default"`, `"accept"`, `"refuse"` or `"none"`), `dismiss`
(`"none"`), `signals` (`{gpc: false, dnt: false}`), `autoOpen` (`true`),
`reopen` (`"details"`), `position`, `container`, `template`, `root` (which
element is the banner, of several places), `bare` (`"auto"`: the default banner
for a site that has none), `config` (a selector of the page's configuration),
`prefix` (`"data-cookie"`), `hooks`, `classes`, `variables`, `texts` (`{}`:
every word the visitor reads), `durations` (`{}`: the words for `"30d"`),
`observe` (`false`), `legacy` (`true`), `debug`. The
methods of `@glitchr/cookie` are kept. See [docs/cookie.md](docs/cookie.md).

## Tests

```sh
JQUERY=path/to/jquery.js npm test                      # tests/*.html in a headless Chrome
JQUERY=path/to/jquery.js npm test ajaxer.html          # one page
JQUERY=path/to/jquery.js CPU=4 node tests/run.mjs perf/scroll.html   # the measurements
```

`tests/run.mjs` needs Node 22 or later (its own WebSocket) and Chrome
(`CHROME=...` to name another; `TIMEOUT` in ms per page, 15000 by default). It
serves the repository over HTTP on a free port of 127.0.0.1 - `tests/site.mjs`
answers under `/site/` as a small site would, for the navigation to browse -
drives the browser over the DevTools protocol, in real time, and opens each
page, which writes its verdict in `#result`. Any console error or uncaught
exception a page did not say it expects (`Harness.expect`) fails it.
`tests/perf/scroll.html` measures what a scroll costs (script time, style and
box reads per frame, listeners) and is run by name only. See
[CHANGELOG.md](CHANGELOG.md) for what each version changed.

## License

MIT since 2026-10-10; earlier versions remain published under LGPL-3.0-or-later.
