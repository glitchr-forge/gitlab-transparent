// StickySortable - drag-and-drop reordering, standing alone: it needs the
// core (Flow) for the scroller to autoscroll, and jQuery for its $.fn plugin
// only, so a consumer who only wants sorting pays for none of the scroll
// effects. Pointer Events (not HTML5 drag-and-drop) so a custom placeholder
// and touch both work with one code path - requires touch-action: none on
// the handle in CSS.
(function (root, factory) {

    var core = root.Flow && root.Flow.core === true ? root.Flow : (typeof require === 'function' ? require('./core.js') : null);
    if (!core) throw new Error('sortable.js: load core.js first');

    var api = factory(root, core, core.jquery());
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.StickySortable = api;
    core.sortable = api;

})(typeof window !== 'undefined' ? window : this, function (window, Flow, $) {

    var document = window.document;

    var defaults = {
        handle: null,          // selector, relative to the item, or null to drag the whole item
        items: '[data-sortable-item]',
        axis: 'y',
        dragThreshold: 4,      // px of pointer movement before a press counts as a drag, not a click
        autoscroll: true,
        autoscrollEdge: 40,    // px from the scroll container's edge that triggers scrolling
        autoscrollInsetTop: null, // px of the top edge already covered by something pinned over it; null = measure it
        autoscrollSpeed: 12,   // px per animation frame at full deflection
        draggingClass: 'is-dragging',
        placeholderClass: 'is-sortable-placeholder',
        // Orientation of the drop marker, set per move. A grid wraps items
        // onto rows, so "insert here" is a vertical line BETWEEN two cards on
        // one row but a horizontal line between rows - the same marker read
        // one way in both places was telling you the welcome banner would slot
        // in beside a card when it was actually about to take a row of its own.
        placeholderVerticalClass: 'is-placeholder-vertical',
        placeholderHorizontalClass: 'is-placeholder-horizontal',
        onChange: null,        // function(order, container) - fires once, on drop, if the order changed
        mergeable: false,      // opt-in: dropping in the INNER zone of another item fires onMerge instead of reordering
        mergeInset: 28,        // px inset from an item's edges that counts as its "merge zone" rather than its "reorder edge"
        mergeTargetClass: 'is-merge-target',
        isMergeable: null,     // function(el): bool - gates the item being DRAGGED (can it be a merge source at all); null = anything can
        isMergeTarget: null,   // function(el): bool - gates merge TARGET candidates; null = falls back to isMergeable (same rule both ways)
        onMerge: null,         // function(draggedEl, targetEl, container) - fires on drop instead of onChange, only when armed
    };

    // The scroller the list autoscrolls while an item is dragged to its edge:
    // the closest ancestor that scrolls (the core's), the page otherwise.
    function closestScrollable(el) {
        var node = el.parentElement ? Flow.closestScrollable(el.parentElement) : undefined;
        if (!node || node === document.documentElement) return document.scrollingElement || document.documentElement;
        return node;
    }

    function StickySortable(container, options) {
        this.container = container;
        this.options = Object.assign({}, defaults, options);
        this.scroller = closestScrollable(container);
        this.dragging = null;
        this.placeholder = null;
        this.startY = 0;
        this.startIndex = -1;
        this.pointerId = null;
        this.autoscrollFrame = null;
        this.autoscrollDirection = 0;
        this.mergeTarget = null;

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        container.addEventListener('pointerdown', this.onPointerDown);
        container.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    StickySortable.prototype.items = function () {
        return Array.prototype.slice.call(this.container.querySelectorAll(this.options.items))
            .filter(function (el) { return el.parentElement === this.container; }.bind(this));
    };

    StickySortable.prototype.onPointerDown = function (e) {
        if (this.dragging || e.button !== undefined && e.button !== 0) {
            return;
        }

        var handle = this.options.handle ? e.target.closest(this.options.handle) : e.target;
        if (!handle) {
            return;
        }

        var item = e.target.closest(this.options.items);
        if (!item || item.parentElement !== this.container) {
            return;
        }

        this.pendingItem = item;
        this.pendingPointerId = e.pointerId;
        this.pendingStartX = e.clientX;
        this.pendingStartY = e.clientY;

        this.container.addEventListener('pointermove', this.onPendingMove = function (moveEvent) {
            if (moveEvent.pointerId !== this.pendingPointerId) {
                return;
            }
            var dx = moveEvent.clientX - this.pendingStartX;
            var dy = moveEvent.clientY - this.pendingStartY;
            if (Math.sqrt(dx * dx + dy * dy) >= this.options.dragThreshold) {
                this.beginDrag(this.pendingItem, this.pendingPointerId, moveEvent);
            }
        }.bind(this));

        this.container.addEventListener('pointerup', this.onPendingUp = function () {
            this.container.removeEventListener('pointermove', this.onPendingMove);
            this.container.removeEventListener('pointerup', this.onPendingUp);
        }.bind(this), { once: true });
    };

    StickySortable.prototype.beginDrag = function (item, pointerId, e) {
        this.container.removeEventListener('pointermove', this.onPendingMove);

        this.dragging = item;
        this.pointerId = pointerId;
        this.startIndex = this.items().indexOf(item);

        item.setPointerCapture(pointerId);
        item.classList.add(this.options.draggingClass);

        this.placeholder = document.createElement(item.tagName);
        this.placeholder.className = this.options.placeholderClass;
        // Published as a custom property, not as height: the marker is a line
        // whose thickness is the stylesheet's business, but it still needs the
        // dragged item's measurements to know how LONG to be along the axis it
        // ends up on. Setting height here instead would be an inline style the
        // orientation rules could only beat with !important.
        this.placeholder.style.setProperty('--sortable-item-height', item.offsetHeight + 'px');
        this.placeholder.style.setProperty('--sortable-item-width', item.offsetWidth + 'px');
        item.parentElement.insertBefore(this.placeholder, item.nextSibling);

        var rect = item.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        item.style.position = 'fixed';
        item.style.width = rect.width + 'px';
        item.style.zIndex = 1000;
        item.style.pointerEvents = 'none';
        this.moveItemTo(e.clientX, e.clientY);

        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp);
    };

    // axis:'y' locks left to wherever the drag started (a single-column
    // list has nothing to gain from tracking x, and this keeps that case's
    // behavior byte-for-byte unchanged) - any other axis value follows the
    // pointer on both axes, needed for a multi-column grid like the
    // dashboard's widget grid.
    StickySortable.prototype.moveItemTo = function (clientX, clientY) {
        this.dragging.style.top = (clientY - this.offsetY) + 'px';
        this.dragging.style.left = 'y' === this.options.axis
            ? this.dragging.getBoundingClientRect().left + 'px'
            : (clientX - this.offsetX) + 'px';
    };

    // Single-column mode (axis:'y'): unchanged from before - compare only
    // vertical midpoints, in DOM order. Free/grid mode: "nearest sibling
    // wins" alone doesn't say which SIDE to drop on (a grid has more than
    // one neighbor at similar distance), so whichever axis has the larger
    // offset from that sibling's center decides before-vs-after.

    /**
     * Do these two boxes sit on the same visual row?
     *
     * Overlap of more than half the shorter box, not "same top": widgets on a
     * row are stretched to the tallest of them but a shorter neighbour that
     * has not stretched still shares the row, and an exact-top test would
     * call that a different one.
     */
    StickySortable.prototype.sharesRow = function (a, b) {
        if (!a || !b) {
            return false;
        }
        var ra = a.getBoundingClientRect();
        var rb = b.getBoundingClientRect();
        if (!ra.height || !rb.height) {
            return false;
        }

        return Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > Math.min(ra.height, rb.height) / 2;
    };

    /**
     * Which way the drop marker should read, from where it has just landed.
     *
     * Decided from the NEIGHBOURS rather than the placeholder itself: the
     * placeholder is styled as a thin line, so it has no footprint of its own
     * left to compare against anything.
     *
     *   between two cards sharing a row  -> vertical, it goes between them
     *   nothing before it                -> horizontal, it starts a new row
     *   neighbours on different rows     -> horizontal, it goes between rows
     *   last position, room left on the row -> vertical
     *
     * A plain vertical list (the sidebar menu uses this same sortable) never
     * has two neighbours sharing a row, so it always reads horizontal, which
     * is the right answer there without a special case.
     */
    StickySortable.prototype.orientPlaceholder = function () {
        if (!this.placeholder) {
            return;
        }

        var isItem = function (el) {
            return el && el !== this.dragging && el.matches(this.options.items);
        }.bind(this);

        var prev = this.placeholder.previousElementSibling;
        while (prev && !isItem(prev)) {
            prev = prev.previousElementSibling;
        }
        var next = this.placeholder.nextElementSibling;
        while (next && !isItem(next)) {
            next = next.nextElementSibling;
        }

        var vertical;
        if (!prev) {
            vertical = false;
        } else if (next) {
            vertical = this.sharesRow(prev, next);
        } else {
            // Nothing after it, so there is no pair to read a row from. The
            // question becomes whether the dragged item still fits beside the
            // last one, which is what decides if it joins that row or starts
            // the next.
            var prevRect = prev.getBoundingClientRect();
            var containerRect = this.container.getBoundingClientRect();
            var draggedWidth = this.dragging ? this.dragging.getBoundingClientRect().width : 0;
            vertical = (prevRect.right + draggedWidth) <= containerRect.right;
        }

        this.placeholder.classList.toggle(this.options.placeholderVerticalClass, vertical);
        this.placeholder.classList.toggle(this.options.placeholderHorizontalClass, !vertical);
    };

    StickySortable.prototype.findDropTarget = function (siblings, x, y) {
        if ('y' === this.options.axis) {
            for (var i = 0; i < siblings.length; i++) {
                var rect = siblings[i].getBoundingClientRect();
                if (y < rect.top + rect.height / 2) {
                    return { el: siblings[i], before: true };
                }
            }
            return null;
        }

        // Distance to the nearest point ON EACH RECT (clamped to its
        // edges), not to its center. A wide/tall item (e.g. a 3-of-5-
        // column chart card) has empty grid space free in its OWN row -
        // center-to-center distance made that empty space attract to
        // whatever smaller item happened to sit directly above/below it
        // in a different row instead, since a small item's center can be
        // numerically closer than a big item's center even though the
        // big item's actual edge is right there. Rect-distance is 0 for
        // any point already alongside the item (same row, past its edge),
        // so the item you're visually next to wins regardless of size.
        var closest = null;
        var closestDist = Infinity;
        siblings.forEach(function (el) {
            var r = el.getBoundingClientRect();
            var nearestX = Math.max(r.left, Math.min(x, r.right));
            var nearestY = Math.max(r.top, Math.min(y, r.bottom));
            var dist = Math.pow(x - nearestX, 2) + Math.pow(y - nearestY, 2);
            if (dist < closestDist) {
                closestDist = dist;
                closest = { el: el, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
            }
        });
        if (!closest) {
            return null;
        }

        var dx = x - closest.cx;
        var dy = y - closest.cy;
        var before = Math.abs(dx) > Math.abs(dy) ? dx < 0 : dy < 0;
        return { el: closest.el, before: before };
    };

    // Only relevant when options.mergeable - an inset "inner zone" of a
    // sibling's own rect, distinct from findDropTarget()'s reorder logic
    // above (which reacts to nearest EDGE/point, not containment). A
    // point can be simultaneously "nearest" a sibling for reorder purposes
    // and inside its merge zone; onPointerMove checks merge FIRST and
    // short-circuits reorder entirely while a merge target is armed, so
    // there's never a conflict between the two at drop time.
    StickySortable.prototype.findMergeTarget = function (siblings, x, y) {
        var inset = this.options.mergeInset;
        // isMergeTarget, not isMergeable, for the CANDIDATE side - a
        // composite can be a valid drop target (gains a pane) without
        // being draggable to merge further itself; falls back to
        // isMergeable when the two aren't meant to differ.
        var isTarget = this.options.isMergeTarget || this.options.isMergeable;
        for (var i = 0; i < siblings.length; i++) {
            var el = siblings[i];
            if (isTarget && !isTarget(el)) {
                continue;
            }
            var r = el.getBoundingClientRect();
            if (x >= r.left + inset && x <= r.right - inset && y >= r.top + inset && y <= r.bottom - inset) {
                return el;
            }
        }
        return null;
    };

    StickySortable.prototype.onPointerMove = function (e) {
        if (!this.dragging || e.pointerId !== this.pointerId) {
            return;
        }

        this.moveItemTo(e.clientX, e.clientY);

        var siblings = Array.prototype.slice.call(this.container.children).filter(function (el) {
            return el !== this.dragging && el !== this.placeholder && el.matches(this.options.items);
        }.bind(this));

        if (this.options.mergeable) {
            var mergeCandidate = this.options.isMergeable && !this.options.isMergeable(this.dragging)
                ? null // the item being dragged isn't itself a valid merge source (e.g. a composite) - never arm a merge for it, only allow it to reorder
                : this.findMergeTarget(siblings, e.clientX, e.clientY);
            if (mergeCandidate !== this.mergeTarget) {
                if (this.mergeTarget) {
                    this.mergeTarget.classList.remove(this.options.mergeTargetClass);
                }
                this.mergeTarget = mergeCandidate;
                if (this.mergeTarget) {
                    this.mergeTarget.classList.add(this.options.mergeTargetClass);
                }
            }
            if (this.mergeTarget) {
                // Armed: leave the placeholder exactly where it is - the
                // dragged item's eventual REORDER position is moot, it's
                // about to be replaced (along with the target) by onMerge.
                if (this.options.autoscroll) {
                    this.updateAutoscroll(e.clientY);
                }
                return;
            }
        }

        var target = this.findDropTarget(siblings, e.clientX, e.clientY);
        if (target) {
            this.container.insertBefore(this.placeholder, target.before ? target.el : target.el.nextSibling);
        } else if (siblings.length) {
            this.container.insertBefore(this.placeholder, null);
        }

        this.orientPlaceholder();

        if (this.options.autoscroll) {
            this.updateAutoscroll(e.clientY);
        }
    };

    // How much of the scroller's top edge is hidden under something pinned
    // across it. A sticky header covers exactly the band that triggers upward
    // scrolling, so the pointer can never reach it and dragging a card upwards
    // simply refuses to scroll - reported on the dashboard, whose topbar is
    // sticky and ~53px tall against a 40px band. Measured once per drag.
    StickySortable.prototype.topInset = function (rect) {

        if (this._topInset !== undefined && this._topInset !== null) return this._topInset;
        if (this.options.autoscrollInsetTop !== null && this.options.autoscrollInsetTop !== undefined) {
            this._topInset = this.options.autoscrollInsetTop;
            return this._topInset;
        }

        var inset = 0;
        try {
            var probe = document.elementFromPoint(Math.max(1, Math.round(window.innerWidth / 2)), Math.round(rect.top) + 1);
            while (probe && probe !== document.body) {
                var position = getComputedStyle(probe).position;
                if (position === 'sticky' || position === 'fixed') {
                    var bottom = probe.getBoundingClientRect().bottom;
                    if (bottom > rect.top) inset = Math.max(inset, bottom - rect.top);
                    break;
                }
                probe = probe.parentElement;
            }
        } catch (e) {}

        this._topInset = inset;
        return inset;
    };

    StickySortable.prototype.updateAutoscroll = function (clientY) {
        var rect = this.scroller === document.scrollingElement || this.scroller === document.documentElement
            ? { top: 0, bottom: window.innerHeight }
            : this.scroller.getBoundingClientRect();

        var edge = this.options.autoscrollEdge;
        // A finger needs a wider target than a pointer, and on a phone the
        // outermost pixels belong to the browser's own edge gestures.
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
            edge = Math.max(edge, 90);
        }

        if (clientY < rect.top + this.topInset(rect) + edge) {
            this.autoscrollDirection = -1;
        } else if (clientY > rect.bottom - edge) {
            this.autoscrollDirection = 1;
        } else {
            this.autoscrollDirection = 0;
        }

        if (this.autoscrollDirection !== 0 && !this.autoscrollFrame) {
            this.runAutoscroll();
        }
    };

    StickySortable.prototype.runAutoscroll = function () {
        if (!this.dragging || this.autoscrollDirection === 0) {
            this.autoscrollFrame = null;
            return;
        }
        this.scroller.scrollTop += this.autoscrollDirection * this.options.autoscrollSpeed;
        this.autoscrollFrame = requestAnimationFrame(this.runAutoscroll.bind(this));
    };

    StickySortable.prototype.onPointerUp = function (e) {

        // Measured per drag: a swap or a resize can move the sticky header.
        this._topInset = undefined;
        if (!this.dragging || e.pointerId !== this.pointerId) {
            return;
        }

        var item = this.dragging;
        item.releasePointerCapture(this.pointerId);
        item.classList.remove(this.options.draggingClass);
        item.style.position = '';
        item.style.top = '';
        item.style.left = '';
        item.style.width = '';
        item.style.zIndex = '';
        item.style.pointerEvents = '';

        this.container.insertBefore(item, this.placeholder);
        this.placeholder.remove();
        this.placeholder = null;

        this.autoscrollDirection = 0;
        if (this.autoscrollFrame) {
            cancelAnimationFrame(this.autoscrollFrame);
            this.autoscrollFrame = null;
        }

        document.removeEventListener('pointermove', this.onPointerMove);
        document.removeEventListener('pointerup', this.onPointerUp);

        var mergeTarget = this.mergeTarget;
        if (mergeTarget) {
            mergeTarget.classList.remove(this.options.mergeTargetClass);
            this.mergeTarget = null;
        }

        var newIndex = this.items().indexOf(item);
        this.dragging = null;
        this.pointerId = null;

        if (mergeTarget) {
            if (typeof this.options.onMerge === 'function') {
                this.options.onMerge(item, mergeTarget, this.container);
            }
            return;
        }

        if (newIndex !== this.startIndex && typeof this.options.onChange === 'function') {
            this.options.onChange(this.items(), this.container);
        }
    };

    /** Keyboard fallback: focus a handle, ArrowUp/ArrowDown moves its item, no pointer needed. */
    StickySortable.prototype.onKeyDown = function (e) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
            return;
        }

        var handle = this.options.handle ? e.target.closest(this.options.handle) : null;
        if (!handle) {
            return;
        }

        var item = e.target.closest(this.options.items);
        if (!item || item.parentElement !== this.container) {
            return;
        }

        var items = this.items();
        var index = items.indexOf(item);
        var swapWith = e.key === 'ArrowUp' ? items[index - 1] : items[index + 1];
        if (!swapWith) {
            return;
        }

        e.preventDefault();
        if (e.key === 'ArrowUp') {
            this.container.insertBefore(item, swapWith);
        } else {
            this.container.insertBefore(item, swapWith.nextSibling);
        }
        handle.focus();

        if (typeof this.options.onChange === 'function') {
            this.options.onChange(this.items(), this.container);
        }
    };

    if ($) {
        $.fn.stickySortable = function (options) {
            return this.each(function () {
                if (!this._stickySortable) {
                    this._stickySortable = new StickySortable(this, options);
                }
            });
        };
    }

    StickySortable.defaults = defaults;

    return StickySortable;
});
