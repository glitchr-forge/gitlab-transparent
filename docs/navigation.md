# Transparent (navigation)

`src/js/transparent.js` - links and forms load the next page in the background
and the page's block (`identifier`, `#page` by default) is swapped in place,
with the history, the scroll positions, the head and the scripts kept in step.
Needs jQuery and the core.

```js
import '@glitchr/flowjs/navigation';

Transparent.ready({ identifier: '#page', prefetch: true, nest: ['/admin/*'] });
```

After each swap the page announces `transparent:load` (the stops, the sticky
effects and the other modules attach themselves again to the new page through
the core). A link with `rel="prefetch"` is fetched when the pointer settles on it.

## Options (`Transparent.settings`)

Set with `Transparent.ready({...})` or `Transparent.configure({...})`.

| Option | Default | Meaning |
| --- | --- | --- |
| `identifier` | `"#page"` | the block swapped |
| `loader` | `"#loader"` | |
| `throttle` | `1000` | |
| `rescue_reload` | `5000` | |
| `lazyload` | `true` | |
| `exceptions` | `[]` | paths (RegExp or wildcard strings) left to the browser |
| `prefetch` | `true` | only anchors with `rel="prefetch"` are fetched ahead; `false` switches the mechanism off |
| `prefetch_delay` | `65` | ms the pointer dwells before the fetch |
| `prefetch_ttl` | `30000` | ms a prefetched page stays usable |
| `prefetch_max` | `15` | |
| `exit_duration` | `0` | ms `html.exiting` is held after the response arrives, before the swap (plain milliseconds) |
| `smoothscroll_duration` / `_speed` / `_easing` | `"200ms"` / `0` / `"swing"` | |
| `headlock` | `[]` | URL substrings or patterns kept in `<head>` across pages; `data-headlock="true"` / `"false"` on an element overrides |
| `use_view_transitions` | `false` | wrap the swap in `document.startViewTransition()` where supported |
| `skip_transition_for_cache` | `false` | cache hits skip the view transition |
| `progress_bar` | `true` | a native bar while `html.loading` is set; `false` or `'off'` for another indicator |
| `cache_version` | `null` | a value changing at each deploy purges the response cache on mismatch |
| `nest` | `[]` | path patterns opened as a nested website-in-website panel; the target must send the `X-Transparent-Nest` header |
| `nest_move`, `nest_resize`, `nest_snap` | `true` | drag the chrome bar, resize by the edges, magnetic snapping |
| `nest_snap_threshold` | `8` | px |
| `nest_dock` | `true` | docking against an edge; `nest_dock_target` (`null`) names an element to dock into |
| `nest_swipe` | `true` | small screens: drag the bar down to dismiss |
| `nest_keepalive` | `true` | closing parks the nested session, the next open resumes it |
| `nest_remember` | `true` | the panel's layout is kept in localStorage under `nest_remember_key` (`"transparent[nest][layout]"`) |
| `nest_esc_confirm` | `"Close this panel? Any unsaved changes may be lost."` | confirm before ESC closes a nest |
| `disable`, `debug` | `false` | |

The comments above each option in `src/js/transparent.js` give the reasoning.
