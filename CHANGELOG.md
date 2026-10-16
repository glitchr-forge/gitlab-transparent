# Changelog

## 1.3.1 - 2026-10-16

- **cookie** - the `ignore` option: the elements whose clicks are not on the
  page (`[data-cookie-ignore]` by default; a selector, an element or a list of
  them, `false` for none). A click inside one is no click outside the banner:
  it answers nothing by `dismiss` and does not count as leaving the question.
  A site that set `dismiss` to an answer had it given, and the question
  closed, by a click on a developer's toolbar (Symfony's web debug toolbar),
  the visitor never knowing what was kept. `Cookie.ignored(element)` says it
  for a site's own script. Nothing changes for a site that does not use it.
  tests/cookie-countdown.html.

## 1.3.0 - 2026-10-16

- **stops** - each way on its own: the `up` and `down` options (`true` by
  default, so nothing changes until a site asks). With `up: false` a scroll
  heading up comes to rest where the reader left it - not carried on to the
  stop above, not settled back down - while a scroll heading down still goes
  on to its stop; `down: false` the other way round. A stop says it for itself
  with `data-sticky-up` / `data-sticky-down` (`"false"`, or `"true"` against
  the option: a full sky that keeps its pull upwards on a page where going
  back up is free); a sideways row takes the same two attributes. The keys go
  from stop to stop whatever the options. tests/stops-ways.html.

## 1.2.1 - 2026-10-14

What plugging the cookie module under a site's own consent panel showed, and
a navigation that takes a refused form for what it is.

- **navigation** - a page of the site is shown whatever its status. A form
  the server refuses comes back with its errors under 422 (what Symfony
  answers for an invalid form): it was handed to `Transparent.rescue()` -
  `Rescue mode.. called` in the console, the whole document replaced - like
  every answer that was not a 200. Now an answer in which the navigation
  finds the page's block, in a layout it can swap, is swapped in like any
  other, at its address, without a word in the console: 422, 201, the site's
  own page for a 404, a 403, a 500 or a 503. An answer that is no page of the
  site (a proxy's 502, a debug trace) is rescued and said as before.
  **changes**: `Transparent.isRescueMode()` stays `false` after such a page.
- **cookie**
  - **How long an entry is kept is said in the site's words**: an entry's
    `durationLabel`, else the new `durations` option - a table by duration as
    declared (`{"30d": "30 jours"}`) or a function `(duration, entry,
    seconds)`. The detailed section printed `30d` as declared. The element
    keeps the declared duration in `data-cookie-entry-duration`.
  - **An answer that expired is asked again with `legacy: true`** (the
    default). The record's cookie gone at the end of its `lifetime`, the
    answer was taken back from the `localStorage` `cookie/<KEY>` the module
    keeps in step, and the visitor was never asked again. Those keys are now
    an answer to take over only for a visitor the module has no record of
    yet (`localStorage` `<record.name>.seen` says it has had one); they are
    erased once the record is gone, too old or of another `version`.
  - **`Cookie.use()` before the category is declared**: a category declared
    afterwards as `default: true` or `required: true` starts the feature
    (`onGrant`, `cookie:grant`), one declared off stops it. The options of a
    configuration are applied before its categories.
  - **Several places for the banner in a page**: of several
    `[data-cookie-banner]`, the first whose parent the visitor can see is
    taken, not the first of the document. `Cookie.mount(target)` puts the one
    live banner in the place of another (which takes the place it leaves) or
    at the end of any element, as it is; the `root` option names the banner
    (an element, a selector, a function asked again at each opening). A
    banner left where it cannot be seen opens in a place that can.
  - **No banner where the site put none**: a site that has a banner of its
    own (found in a page, or named by `root` or `template`) no longer gets
    the bare default on a page without one - the question waits for the next
    page that has. `bare: true` asks for the default there, `bare: false`
    never builds it; `"auto"`, the default, builds it for a site that has no
    banner at all, as before.
  - **The countdown waits while the banner cannot be seen** - a parent that
    is `display: none`, `hidden`, `visibility: hidden` or transparent, a page
    that shows no banner - and not only while the tab is hidden.
  - **A page's configuration** (`<script type="application/json"
    data-cookie-config>`) is found under the library's prefix whatever the
    site's - a page can announce its prefix there -, under the site's, and
    where the new `config` option (a selector) says.

`tests/navigation-status.html` and `tests/cookie-places.html` are new;
`tests/cookie.html`, `cookie-banner.html`, `cookie-countdown.html` and
`cookie-navigation.html` have the rest. Suite green (22 pages).

## 1.2.0 - 2026-10-14

A sixth module: the cookies and the visitor's consent, `@glitchr/cookie`
1.0.53 brought in with its history. Nothing changes for a page that does not
load it; it is in the whole library's entry and has one of its own.

- **cookie** (new) - `@glitchr/flowjs/cookie`, the `Cookie` global, on the
  core, without jQuery. [docs/cookie.md](docs/cookie.md).
  - **Categories** of consent are the site's to declare (`categories`,
    `Cookie.category()`): a key, a label and a description in the site's
    words, on or off before any answer (`default`), refusable or not
    (`required`), what each stores and governs. None is written in the
    library.
  - **What is stored** is declared under a category - cookies, `localStorage`
    and `sessionStorage` entries, by name or pattern, with a duration and a
    purpose. `Cookie.cookies`, `Cookie.local` and `Cookie.session` read and
    write by that declaration: nothing under a category that is not granted
    (said in the console with `debug`), nothing undeclared unless `undeclared:
    "allow"`, and everything a category declares is erased when it is refused
    or withdrawn.
  - **Features** start at a grant and stop at a withdrawal:
    `Cookie.use(category, [options], onGrant, onRevoke)` (the shape of
    omnibase/consent's `Consent.use()`), or inert elements of the page -
    `<script type="text/plain" data-cookie-category>`, `<template>`, anything
    with `data-cookie-src`, `data-cookie-placeholder`. Events on `window`:
    `cookie:consent`, `cookie:grant`, `cookie:revoke`, `cookie:open`,
    `cookie:close`.
  - **The interface**: a banner (accept, refuse, customize) and a detailed
    section (a switch per category, accept all, refuse all, save), opened
    again at any time by anything with `data-cookie-open`. Its HTML is the
    site's (an element or a `<template>` found by its `data-cookie-*`
    attributes, or the `template` option) or a bare default; the attributes'
    prefix and names, the classes, the CSS variables, the position and every
    word (`texts`) are options. The detailed section is a modal dialog: focus
    kept inside, Escape, focus given back; `prefers-reduced-motion` is
    followed.
  - **The countdown is an option**, off by default - a silence is not a
    consent: `countdown: {duration, action}` with `action` `"default"`,
    `"accept"`, `"refuse"` or `"none"`. `dismiss` does the same for a click
    outside the banner.
  - **The answer** is a record (version, date, a yes or no per category) kept
    in a cookie whose name, lifetime, path, domain, `SameSite` and `Secure`
    are options, or in `localStorage`, or in a store of the site's. The
    visitor is asked again when `version` changes, when a category is new, or
    when the answer is older than its lifetime. `signals: {gpc, dnt}` makes
    Global Privacy Control and Do Not Track a refusal, if the site asks.
  - A configuration can be handed by the page (`<script
    type="application/json" data-cookie-config>`), read at each page the
    navigation swaps in; the banner stays across those pages and their inert
    elements are woken or left asleep as they arrive.
  - **From `@glitchr/cookie`**: every method of 1.0.53 keeps its name and its
    meaning (`ready`, `configure`, `set`, `get`, `delete`, `checkConsent`,
    `setConsent`, `hasConsents`, `getConsents`, `declare`, `addGroup`,
    `refresh`, `onConfirm`, `onDeny`, `onCheck`, the option accessors), the
    consents stay in `localStorage` `cookie/<GROUP>` and the cookies are
    `GROUP/NAME`. **changes**: jQuery is no longer needed - `cookie:confirm`,
    `cookie:deny` and `cookie:check` are native events on `window`, which
    `$(window).on()` hears as before; a group whose name is a declared
    category's key follows that category (written only while it is granted,
    where a bare group is written until refused).
- `src/css/cookie.scss` - an optional, minimal look for the banner, drawn from
  `--cookie-*` properties; no entry imports it.

`tests/cookie.html` (the 1.0.53 methods, categories, storage, features, inert
elements, the record), `tests/cookie-banner.html` (the banner, the detailed
section, the keyboard, asking again, signals, the site's own HTML, no sentence
in the module), `tests/cookie-countdown.html` (none, and its four endings),
`tests/cookie-navigation.html` (with the navigation).

## 1.1.0 - 2026-10-14

Two options for the magnets (`.sticky-magnet`), both leaving a site as it was
until it sets them.

- **sticky** - `scrollsnap_hold` (`true`): the way to a magnet holds the
  scroll, as in 1.0.4. `false` makes it the reader's to take: nothing is set
  on `<html>` (no `.sticky-prevent-scroll`), a wheel, a finger, a press or a
  key on the way stops the page where it is, and the snap waits for the scroll
  to have been quiet for `debounce` before it acts again - it does not start
  against the gesture that stopped it.
- **sticky** - `scrollsnap_keys` (`false`): the arrow keys go from magnet to
  magnet, down the page (ArrowDown, ArrowUp) and along a row that scrolls
  sideways (ArrowRight, ArrowLeft, pressed in the row or with the pointer over
  it), under the scroller's `scroll-padding`. Left to the browser past the
  last magnet, along an axis without magnets, in a field, on a widget, in a
  dialog, with a modifier, inside an element that scrolls by itself, and when
  the page took the key - the rules of the stops' `keys`. A key held down goes
  one magnet at a time; two presses lead two magnets further. A key's way
  follows `scrollsnap_hold`.
- **sticky** - new: `Sticky.toMagnet(scroller, {top, left})`, the way both
  take, and `Sticky.getMagnetPositions(scroller, axis)`. One keydown listener
  on the window.
- The stops already went from stop to stop along a `data-sticky-axis="x"` row
  with ArrowLeft and ArrowRight (`keys`); `tests/stops-row-keys.html` now says
  so.

`tests/sticky-magnets-interruptible.html` (a wheel, a key, a finger on the
way: stopped in place, nothing held, no restart against the reader, the snap
back after a rest; a modifier alone stops nothing), `tests/sticky-magnet-keys.html`
(down and up the page, along a row, the bounds, what is left alone, a key
held, two presses, the held and the taken way), `tests/stops-row-keys.html`.
The held way of 1.0.4 is unchanged: `tests/sticky-magnets.html` as it was.

## 1.0.4 - 2026-10-14

### A page that stopped answering, fixed

- **core, sticky** - with `scrollsnap` and `.sticky-magnet` sections, a wheel
  froze the page: the way to a magnet sets `.sticky-prevent-scroll`
  (`overflow: hidden`) on `<html>` and lifted it in the callback of its
  scroll, and a wheel on the way stopped the animation without calling back.
  (1.0.2 did not show it: its magnets went nowhere. 1.0.3 listed it as a
  callback lost on interruption, left as it was.) Two things now:
  - `Flow.scrollTo` always ends and calls back once, with
    `{completed, reason, top, left}` - `"arrived"` (also with no way to go),
    `"interrupted"` (the reader took over), `"replaced"` (another scroll of
    the same scroller began); an animation stopped from outside (a site's own
    `.stop()`) is put where it was going a second past its time.
    `Sticky.scrollTo` calls back with `"refused"` when a script has the scroll
    already, where it returned without a word.
  - the way to a magnet holds the scroll (`{hold: true}`, new), as in stickyjs
    where the hidden overflow swallowed the wheel: the page lands on the
    magnet, a quick gesture leads one magnet further and not two, and the
    class is lifted however the movement ended.
- **changes** for a callback of `Flow.scrollTo` / `Sticky.scrollTo` /
  `Transparent.scrollTo`: it is now called when the movement was interrupted
  or replaced too - check `outcome.completed` before doing what belongs to an
  arrival. The library's own callers read again: the autoscroll does not
  bounce back or start over against a reader who took the scroll; a link to
  an anchor of the page writes the hash on arrival only (written after an
  interruption, it would jump the page there); the first page's scroll to its
  hash takes `transparent-first` off even when the reader interrupts it (it
  stayed for ever).
- **core** - `user-scroll` stays `false` while a movement started from a
  callback runs (the autoscroll's way back): it was given back to the reader
  as that movement began.

`tests/sticky-magnets.html`: a trackpad gesture (40 x 25px), three quick
notches down and up, a wheel during a magnet button's scroll - no
`.sticky-prevent-scroll` left and the page answers afterwards - and the
callback's four endings.

## 1.0.3 - 2026-10-13

The merge read again, module by module, against stickyjs 1.7.0, transparentjs
3.0.31 and ajaxer 1.0.56. No public name changes; what behaves differently is
marked **changes**.

### Lost in the merge (1.0.0 - 1.0.2), given back

- **core** - a jQuery object where an element is meant is unwrapped
  (`Sticky.userScroll($el)`, `Sticky.getScrollPadding($scroller)` - Sticky
  hands itself some at every scroll - read the page's scroller instead of the
  object's); an element out of the page has no scroller again;
  `$.fn.isScrollableX` / `isScrollableY` count `overflow: auto`.
- **core** - the reader stopping an animated scroll of a script (a wheel, a
  press, a second click on an anchor) left it "running" for ever:
  `Flow.scripted()` stayed true and the stops never settled again on that
  page.
- **core, stops** - what a scroll draws is drawn in the frame of the scroll:
  the progress (`--sticky-progress`, `sticky:progress`) was written one frame
  late.
- **sortable** - a list inside a box that scrolls sideways only (a table in an
  `overflow-x` wrapper) autoscrolls the page again while an item is dragged.

### Defects the originals shipped, fixed

- **sticky** - **changes**: `.sticky-top` hides as the page scrolls down and
  shows on the way up. Every scroll wrote `aria-scrollhide="false"` on it
  first (since 2022), so no header ever hid. A site that counts on its header
  staying sets `scrollhide: false` or `aria-scrollhide="false"`.
- **sticky** - `Sticky.getMagnets()` and the snaps read each magnet off `this`
  in an `Array.map` callback (the window): the magnets are the magnets,
  `.sticky-magnet-next/-prev/-first/-last` go where they say.
- **sticky** - `.sticky-autoscroll` no longer adds a `mouseleave` handler per
  page loaded.
- **navigation** - Back to a long page gives it back where it was left: the
  window's position is kept on its own (it was dropped, with all the others,
  when the page had one scroller less than when it was left) and held while
  the page grows (it was clamped to what the page had a frame after the swap).
  See docs/navigation.md.
- **navigation** - Forward gives a page back where it was left, and Back a
  second time where it was last read: the page left by Back or Forward is
  kept.
- **navigation** - **changes**: a request that gets no answer (status 0)
  leaves the page as it is and announces it again (`DOMContentLoaded`,
  `transparent:load`, `load`); it replaced the document with an empty one.
- **navigation** - `replaceCanvases()` keeps a canvas with an id in the block
  the site named (`identifier`), not only under `#page`.
- **ajaxer** - `loader_throttle` (`setLoaderThrottle`) is read: once shown,
  the loader stays at least that long. None by default, as before.

### Between the modules

- A script's scroll rests where it was put even when its scroll event is
  heard late (a heavy page just swapped in) or lands in the middle of the
  reader's own scroll: the stops no longer glide off a position the
  navigation has just given back.
- Scrollers that left the page with it let go of the core's listeners at
  `transparent:load`.
- `Flow.scrollTo` animates only the axes that move: the callback of a scroll
  down the page (an anchor's hash) no longer waits the sideways duration out.

### Cost

On a page of forty sections (tests/perf/scroll.html, processor slowed four
times), per scroll frame: the stops and the navigation alone, 1.55 ms of
script, 159 `getComputedStyle` and 79 `getBoundingClientRect` -> 0.14 ms, 0
and 2; with the sticky effects, 2.9 ms, 202 and 124 -> 1.5 ms, 5 and 46. The
window's stops are measured once and kept while the page keeps its shape
(`stops.measure(true)`; `measure()` always measures).

### Tests

Served over HTTP by the runner, against a small site (tests/site.mjs): the
navigation browsed (links, anchors, Back and Forward, forms, the head and the
classes, a canvas, an overtaken navigation, a dropped connection, a failing
page), Back to a page that is not whole yet, the nest; a page without jQuery;
the sortable's scroller, autoscroll, grid and merge; Ajaxer's debounce,
loader, limits and failures. 11 pages where there were 7.

## 1.0.2 - 2026-10-13

- A `.sticky-autoscroll` element initialises (it handed `Flow.onInterrupt` a
  jQuery object: a TypeError per element).
- Scrollers with `overflow: auto` count again (`Flow.isScrollableNode`).
- A stop rests under its own `scroll-margin-top`, added to the scroller's
  `scroll-padding-top`.
- The swipe hint's and the reverse autoscroll's delays are read as durations.

## 1.0.1 - 2026-10-13

- Ajaxer's durations say what they mean: `throttle`, `debounce` and
  `loader_debounce` take a number of milliseconds, or a string with its unit
  (`"250ms"`, `"1s"`); `Ajaxer.parseTime` returns milliseconds. (`"250ms"`
  switched the throttle off, `"1s"` made it 1 ms.)

## 1.0.0 - 2026-10-12

`@glitchr/flowjs`, successor of `@glitchr/transparentjs` 3.0.31,
`@glitchr/stickyjs` 1.7.0 and `@glitchr/ajaxer` 1.0.56: one library, one
module per feature (`/navigation`, `/sticky`, `/stops`, `/sortable`,
`/ajaxer`) on a shared core (`Flow`). The globals, options, CSS classes and
`data-*` attributes keep their names.

- One native listener per scroller and kind for all modules; the sticky
  effects computed once per frame, bound once however many pages the
  navigation swaps in.
- The stops attach themselves again after every page swapped in; a scroll the
  navigation makes rests where it was put.
- The sticky effects run once when the page is loaded, without waiting for a
  first scroll.
- The sortable is the back office's evolved copy: the drop marker oriented to
  the grid (its size as `--sortable-item-height` / `-width`, no inline
  height), the autoscroll band under a sticky header, a wider band for a
  finger; its jQuery plugin optional.
