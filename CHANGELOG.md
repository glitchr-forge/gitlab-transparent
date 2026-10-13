# Changelog

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
