# StickySortable

`src/js/sortable.js` - drag-and-drop reordering with Pointer Events (not HTML5
drag-and-drop), so a custom placeholder and touch share one code path. The handle
needs `touch-action: none` in CSS. Needs the core (for the scroller it
autoscrolls); jQuery only for the `$.fn.stickySortable` plugin.

```html
<ul id="list">
    <li data-sortable-item><span class="grip">::</span> One</li>
    <li data-sortable-item><span class="grip">::</span> Two</li>
</ul>
```

```js
new StickySortable(document.getElementById('list'), {
    handle: '.grip',
    onChange: function (order, container) { /* order: the items, once, on drop */ }
});
$('#list').stickySortable({ handle: '.grip' });   // the same, with jQuery
```

On a handle, <kbd>ArrowUp</kbd> / <kbd>ArrowDown</kbd> move the item up or down
and call `onChange`.

## Options (`StickySortable.defaults`)

| Option | Default | Meaning |
| --- | --- | --- |
| `handle` | `null` | selector, relative to the item; `null` drags the whole item |
| `items` | `'[data-sortable-item]'` | the items |
| `axis` | `'y'` | |
| `dragThreshold` | `4` | px of pointer movement before a press is a drag, not a click |
| `autoscroll` | `true` | scroll the closest ancestor that scrolls down (`overflow-y: auto` or `scroll`), the page otherwise, when an item is dragged to its edge |
| `autoscrollEdge` | `40` | px from the edge that triggers it |
| `autoscrollInsetTop` | `null` | px of the top edge covered by something pinned; `null` measures it |
| `autoscrollSpeed` | `12` | px per frame at full deflection |
| `draggingClass` | `'is-dragging'` | |
| `placeholderClass` | `'is-sortable-placeholder'` | |
| `placeholderVerticalClass` | `'is-placeholder-vertical'` | marker between two cards of one row of a grid |
| `placeholderHorizontalClass` | `'is-placeholder-horizontal'` | marker between rows |
| `onChange` | `null` | `function(order, container)`, once on drop, if the order changed |
| `mergeable` | `false` | dropping in the inner zone of another item fires `onMerge` instead of reordering |
| `mergeInset` | `28` | px inset that counts as the merge zone |
| `mergeTargetClass` | `'is-merge-target'` | |
| `isMergeable` | `null` | `function(el)`: can the dragged item be a merge source |
| `isMergeTarget` | `null` | `function(el)`: can an item be a target; falls back to `isMergeable` |
| `onMerge` | `null` | `function(draggedEl, targetEl, container)`, on drop, instead of `onChange` |
