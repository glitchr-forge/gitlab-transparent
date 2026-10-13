# Ajaxer

`src/js/ajaxer.js` - named AJAX channels over jQuery's `$.ajax`. Global `Ajaxer`
(version 1.0.56 of `@glitchr/ajaxer`, whose options and methods are unchanged).
Needs jQuery and the core (`src/js/core.js`, loaded first), which provides the
durations (`"250ms"`, `"1s"`) and `$.fn.serializeObject`.

```js
import '@glitchr/flowjs/ajaxer';   // the module, with its stylesheet

Ajaxer.setUrl('search', '/search');
Ajaxer.setMethod('search', 'GET');
Ajaxer.setTarget('search', '#results');      // gets the ajaxer-* classes and the loader
Ajaxer.setThrottle('search', 400);          // milliseconds, see below

Ajaxer.send('search', { q: 'miso' },
    function (data) { /* success */ },
    function (data) { /* error: an answer that is not an object */ },
    function ()     { /* complete */ });
```

A channel is a name. `Ajaxer.send(name, data, success, error, complete)` sends
for that channel (`Ajaxer.xhr` is the same function); the callbacks are called
with the target as `this`.

## Per-channel settings

Each has a setter taking the channel's name; a value set without a name
(`Ajaxer.set(key, value)`, `Ajaxer.configure({...})`, `Ajaxer.ready(list, options)`)
is the default for every channel.

| Setter | Key | Default | Meaning |
| --- | --- | --- | --- |
| `setUrl(name, url)` | `url` | none | where to send; without it nothing is sent |
| `setMethod(name, type)` | `method` | `"POST"` | HTTP method |
| `setOutput(name, dataType)` | `output` | `"json"` | jQuery's `dataType` |
| `setTarget(name, el)` | `target` | the caller (`this`) | the element marked while the call is out |
| `setLoaderContainer(name, el)` | `loader_container` | the target | where the `.ajaxer-loader` is put |
| `setThrottle(name, d)` | `throttle` | `1000` | a send within this duration of the last is dropped; `0` for none |
| `setDebounce(name, d)` | `debounce` | `0` | wait this long after the last call |
| `setLoaderDebounce(name, d)` | `loader_debounce` | `1500` | the loader appears only after this long |
| `setRetryLimit(name, n)` | `retry_limit` | `1` | tries after a failure |
| `setQueryLimit(name, n)` | `query_limit` | none | requests in flight at most |
| `cancelable(name, bool)` | `cancelable` | `false` | at the limit, abort the oldest (true) or refuse the new one |
| `setLoaderThrottle(name, d)` | `loader_throttle` | none | once shown, the loader stays at least that long |

A duration (`throttle`, `debounce`, `loader_debounce`) is a number of
milliseconds, or a string with its unit, and is worth what it says: `400` and
`"400"` are 400 ms, `"250ms"` is 250 ms, `"1s"` is one second, `"1s, 250ms"` the
longest of the two. `0` (or anything unreadable) is off. `Ajaxer.parseTime(v)`
returns the value in milliseconds. (Up to 1.0.0 the value went through the
core's `Flow.parseDuration`, in seconds, and was then taken for milliseconds:
`"250ms"` switched the throttle off and `"1s"` made it 1 ms. Plain numbers, the
only form that worked, mean what they did.)

`loader_debounce` is how long a call must be out before the loader shows;
`loader_throttle` (a duration as the others; none by default) is how long the
loader stays once it is shown, so that an answer arriving right after it
appeared does not make it blink. Without it the loader goes the moment the
answer is in. (Up to 1.0.2 the value was stored and nothing read it.)

## States

On the target: `ajaxer-call` while the call is out, then `ajaxer-success` or
`ajaxer-error`. The loader (`.ajaxer-loader`, with an `.ajaxer-status` text) is
created in the container on the first send, shown after the loader debounce,
hidden on success; on failure it shows the status (`404 Error: ...`, or
`Unexpected error`) and a click or touch on it retries.

## Other methods

`Ajaxer.ready(list, options)` (fires `Ajaxer:ready` on the window; also on window
load), `get`, `set`, `add`, `remove`, `configure`, `abort(name, n)`, `abortAll()`,
`register(name, xhr)`, `unregister(xhr)`, `clear()` (settings back to the defaults,
requests aborted; done on `beforeunload`), `debounce(name, fn, timeout)`,
`throttle(name, fn, timeout)`, `isJson(str)`, `isDict(v)`.

## Notes

The module shares with the core the durations and `$.fn.serializeObject`, which
it used to define itself. It listens to no scroll: the infinite-scroll case in
its comments is a caller's, which calls `Ajaxer.send` from a scroll handler
(`Flow.onScroll` is there for it). `Ajaxer.settings` is the object of defaults
itself, not a copy: `clear()` assigns it again without copying, so settings set
before survive it (kept as in 1.0.56).
