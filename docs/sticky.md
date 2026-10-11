# Sticky JS library

## The address follows the reading

With `replacehash` on (the default), the page's address carries the `#id` of
the headline being read: `.sticky-headlines[id]`, any `[id]` inside a
`.sticky-headlines`, or a `.sticky-magnet[id]` (`.sticky-headlines-skip` left
out). A headline is being read once it has reached where its own link would
land it - the scroller's `scroll-padding-top` plus the headline's
`scroll-margin-top` - and until it has scrolled out of sight. At the top, with
none reached, the address has no hash. The change is a `history.replaceState`:
it adds nothing to the history.

```html
<section id="menus" class="sticky-headlines" style="scroll-margin-top: 4rem">…</section>
```

## Scroll stops

`src/js/stops.js` - places on the page a scroll settles on, once it has come
to rest. Standalone: no jQuery, and `import '@glitchr/stickyjs/src/js/stops.js'`
brings in nothing else.

```html
<header class="sticky-stop" data-sticky-band-down="0">…</header>
<div id="site" class="sticky-stop" data-sticky-band-up="90" data-sticky-band-down="280"></div>
```

Each stop has a band above and below it, in px (`rem` and `em` work too).
Once a scroll comes to rest - trackpad momentum included:

- between two stops it glides on to the one it was heading for, unless it
  rests inside the band of the stop it just left: that was a nudge, and it
  settles back. So a band is the least a scroll must travel before the next
  stop takes;
- past the last stop (and before the first) it scrolls freely, except inside
  that stop's band: a scroll back towards the stop, or an overshoot past it,
  returns to it.

A stop taller than the screen is read freely, from its top until its bottom
meets the bottom of the screen; its band below counts from there, and coming
back up from the next stop settles on its last screen, not its top.

A band never reaches past halfway to the neighbouring stop. The glide is the
browser's smooth scroll, which any wheel, touch, key or click interrupts, and
a jump under `prefers-reduced-motion`.

Gentler stops, for a page that should be discovered rather than led:

- `reach` (px, or `"10rem"`, `"20vh"`; `Infinity` by default): the farthest a
  glide may go. When the stop a rest would glide to is farther than that, the
  page stays where it is - only a rest near a stop is completed, and what lies
  between two stops can be looked at. A band wider than the reach is pointless;
- `duration` (ms; `0` by default, the browser's smooth scroll): the glide is
  animated by the library over that time, on an ease-in-out curve (less for a
  glide under 100px, in proportion, down to 40%). Any wheel, touch, key or
  click stops it where it is, and it is not taken up again unless the reader
  scrolls on;
- `end` (`false` by default): the end of the scroll is a stop too - from the
  last section a glide goes down to the very bottom (a footer), and one back
  up, however far: `reach` does not bind it.
- `easing` (with a `duration`): the curve of the glide - a cubic Bezier as CSS
  writes it, `'cubic-bezier(.65, 0, .35, 1)'` by default (gathering speed,
  then slowing into the stop), its four numbers in an array, one of CSS's
  names (`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`), or a
  function of the time gone (0 to 1) giving the way made. Every glide follows
  it: the one finishing a scroll at rest, and the one a key asks for, down the
  page or along a row (`data-sticky-easing` on a row).
- `settle` (ms, `160` by default): how long the scroll must have been quiet
  before anything happens.

```js
StickyStops.attach(window, { reach: 140, settle: 320, duration: 700, bandUp: 140, bandDown: 140 });
```

### Keys (1.5)

`keys: true` lets the keyboard go from stop to stop, with the same glide:
<kbd>↓</kbd>, <kbd>PageDown</kbd> and <kbd>Space</kbd> to the next stop,
<kbd>↑</kbd>, <kbd>PageUp</kbd> and <kbd>Shift</kbd>+<kbd>Space</kbd> to the
previous one (a tall one: its last screen), <kbd>Home</kbd> / <kbd>End</kbd> to
the first / last stop.

- An arrow always goes to a stop: down to the next one, up to the top of the
  one being read and then to the one before - however tall the stop. A tall
  stop is read with the wheel, the finger or the page keys: a page key moves
  one screen inside it, never past its end or top, before going on.
- A key pressed during a key's glide goes on from where that glide was going:
  presses chain stop after stop. A key held down goes one stop at a time.
- A neighbour farther than a screen and a half away (past the last stop,
  before the first, a long way between two) is left to the browser's own
  scroll - a separator shorter than half a screen is glided over, which then rests where the key put it.
  `reach` does not apply to keys. Shift goes with Space only.
- Left alone: focus in a field, a frame, an open `<dialog>`, a widget with keys
  of its own (slider, tabs, menu, listbox, audio, video) or an element that
  scrolls by itself; Alt, Ctrl or Meta held; Space on a button or a link; and
  any key a handler of the page already took (`event.defaultPrevented`) - the
  library listens on the window in the bubble phase, after the document's
  handlers, so a music player's Space stays the player's.

```js
StickyStops.attach(window, { reach: 140, settle: 320, duration: 800, easing: 'cubic-bezier(.7, 0, .2, 1)', bandUp: 140, bandDown: 140, keys: true, end: true });
```

### Sideways (1.5)

`axis: 'x'` on an element scroller meets the stops by their left edge (its
`scroll-padding-left`) and glides its `scrollLeft`: the same rest, reach, bands
and wide-stop reading, along x - a horizontal wheel, trackpad or swipe settles
on the stop it was heading for. With `keys`, <kbd>←</kbd> / <kbd>→</kbd> go
from stop to stop while focus is inside the row or the pointer is over it.

A row marked `data-sticky-axis="x"` with `.sticky-stop` children is attached
by itself on load, keys on (`data-sticky-keys="false"` to keep them off), with
optional `data-sticky-duration`, `-settle`, `-reach` and `-tolerance`. Its
stops are its own: the page's stops never count them. Leave CSS scroll-snap off
the row - it pulls to the nearest item meanwhile.

```html
<div class="photos" data-sticky-axis="x" data-sticky-duration="500" style="overflow-x: auto; display: flex">
    <figure class="sticky-stop">…</figure>
    <figure class="sticky-stop">…</figure>
</div>
```

```js
StickyStops.attach(row, { axis: 'x', keys: true });
StickyStops.scan();  // attach the data-sticky-axis rows swapped in since
```

With two stops or more the scroller (`<html>` for the page) carries
`--sticky-stop` (the index of the stop above), `--sticky-progress` (0 at that
stop, 1 at the next) and `--sticky-progress-held` (the same, held still across
the bands), and dispatches `sticky:progress` with `{index, from, to, top,
progress, held}` in `event.detail` when they change, and `sticky:stop` with
`{stop, top, axis, key}` at each glide. Both bubble to the window.

The window attaches itself when the document has stops at `DOMContentLoaded`
or `load`. Otherwise, and for scrolling elements:

```js
StickyStops.attach(scroller, { settle: 160, tolerance: 3, reach: Infinity, duration: 0, easing: 'cubic-bezier(.65, 0, .35, 1)', bandUp: 0, bandDown: 0, progress: true, smooth: true, axis: 'y', keys: false });
StickyStops.get(scroller).state;      // the last progress, or null
StickyStops.get(scroller).refresh();  // after content moved
StickyStops.pause(); StickyStops.resume();  // while a script scrolls the page itself; nests
```

`Sticky.stops` is the same object when `sticky.js` is loaded.

## License

MIT since 2026-10-10; earlier versions remain published under LGPL-3.0-or-later.
