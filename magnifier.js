// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Utils from './utils.js';
import * as Docking from './docking.js';

console.log('[Albert macOS Dock] Magnifier module loaded');

export const State = Object.freeze({
    IDLE: 'IDLE',
    ACTIVE: 'ACTIVE',
    SUSPENDED: 'SUSPENDED',
    DESTROYED: 'DESTROYED',
});

export const DockMagnifier = GObject.registerClass({
    GTypeName: 'AlbertDockMagnifier',
}, class DockMagnifier extends GObject.Object {
    _init(dockDash) {
        super._init();

        this._dockDash = dockDash;
        this._settings = Docking.DockManager.settings;
        this._signalsHandler = new Utils.GlobalSignalsHandler(this);
        this._state = State.IDLE;
        this._generation = 0;
        this._frameSourceId = 0;
        this._dockRect = null;
        this._records = new Map();

        console.log('[Albert macOS Dock] Magnifier constructed');

        if (this._dockDash._boxContainer) {
            this._dockDash._boxContainer.reactive = true;
            this._dockDash._boxContainer.track_hover = true;

            this._signalsHandler.add(
                this._dockDash._boxContainer,
                'enter-event',
                this._onEnterEvent.bind(this)
            );
            this._signalsHandler.add(
                this._dockDash._boxContainer,
                'leave-event',
                this._onLeaveEvent.bind(this)
            );
            this._signalsHandler.add(
                this._dockDash._boxContainer,
                'motion-event',
                this._onMotionEvent.bind(this)
            );
        }
    }

    _getVisualActor(item) {
        if (!item || !item.child)
            return null;
        const appIcon = item.child;
        if (appIcon.icon && appIcon.icon._iconBin)
            return appIcon.icon._iconBin;
        if (appIcon.icon && appIcon.icon.icon)
            return appIcon.icon.icon;
        if (appIcon.icon)
            return appIcon.icon;
        return appIcon;
    }

    _getPivotForOrientation() {
        const pos = Utils.getPosition();
        switch (pos) {
            case St.Side.TOP:
                return [0.5, 0.0];
            case St.Side.BOTTOM:
                return [0.5, 1.0];
            case St.Side.LEFT:
                return [0.0, 0.5];
            case St.Side.RIGHT:
                return [1.0, 0.5];
            default:
                return [0.5, 1.0];
        }
    }

    _captureBaselineGeometry() {
        this._records.clear();
        if (!this._dockDash._box)
            return;

        const children = this._dockDash._box.get_children();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const item of children) {
            if (!item.mapped || !item.visible)
                continue;
            const visualActor = this._getVisualActor(item);
            if (!visualActor)
                continue;

            const [x, y] = item.get_transformed_position();
            const [w, h] = item.get_transformed_size();
            if (w <= 0 || h <= 0)
                continue;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + w);
            maxY = Math.max(maxY, y + h);

            const record = {
                item,
                layoutActor: item,
                visualActor,

                baseItemStageRect: {
                    x1: x,
                    y1: y,
                    x2: x + w,
                    y2: y + h,
                    width: w,
                    height: h,
                    centerX: x + w / 2,
                    centerY: y + h / 2,
                },

                originalLayoutTransform: {
                    scaleX: item.scale_x,
                    scaleY: item.scale_y,
                    translationX: item.translation_x,
                    translationY: item.translation_y,
                    pivotX: item.pivot_point_x,
                    pivotY: item.pivot_point_y,
                    opacity: item.opacity,
                },

                originalVisualTransform: {
                    scaleX: visualActor.scale_x,
                    scaleY: visualActor.scale_y,
                    translationX: visualActor.translation_x,
                    translationY: visualActor.translation_y,
                    pivotX: visualActor.pivot_point_x,
                    pivotY: visualActor.pivot_point_y,
                    opacity: visualActor.opacity,
                },

                currentScale: 1.0,
                targetScale: 1.0,

                currentDisplacement: 0.0,
                targetDisplacement: 0.0,
            };

            this._records.set(item, record);
        }

        if (this._records.size > 0) {
            const maxScale = this._settings.magnificationMaxScale ?? 1.65;
            const pos = Utils.getPosition();
            const sampleHeight = Array.from(this._records.values())[0].baseItemStageRect.height;
            const overflowMargin = Math.ceil((maxScale - 1.0) * sampleHeight + 32);
            const primaryPadding = 32;

            let rectX1 = minX;
            let rectY1 = minY;
            let rectX2 = maxX;
            let rectY2 = maxY;

            if (pos === St.Side.BOTTOM) {
                rectY1 -= overflowMargin;
            } else if (pos === St.Side.TOP) {
                rectY2 += overflowMargin;
            } else if (pos === St.Side.RIGHT) {
                rectX1 -= overflowMargin;
            } else if (pos === St.Side.LEFT) {
                rectX2 += overflowMargin;
            }

            if (this._dockDash._isHorizontal) {
                rectX1 -= primaryPadding;
                rectX2 += primaryPadding;
            } else {
                rectY1 -= primaryPadding;
                rectY2 += primaryPadding;
            }

            this._dockRect = {
                x1: rectX1,
                y1: rectY1,
                x2: rectX2,
                y2: rectY2,
            };
        } else {
            this._dockRect = null;
        }
    }

    _onEnterEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        if (!this._settings.magnificationEnabled)
            return Clutter.EVENT_PROPAGATE;

        if (this._state === State.IDLE) {
            console.log('[Albert macOS Dock] Pointer entered dock');
            this._captureBaselineGeometry();
            if (this._records.size > 0) {
                this._state = State.ACTIVE;
                this._startFrameLoop();
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onLeaveEvent(actor, event) {
        if (this._state !== State.ACTIVE)
            return Clutter.EVENT_PROPAGATE;

        const [px, py] = global.get_pointer();
        if (this._dockRect) {
            if (px >= this._dockRect.x1 && px <= this._dockRect.x2 &&
                py >= this._dockRect.y1 && py <= this._dockRect.y2) {
                return Clutter.EVENT_PROPAGATE;
            }
        }

        console.log('[Albert macOS Dock] Pointer left dock');
        this._resetToBaseline('pointer-leave');
        return Clutter.EVENT_PROPAGATE;
    }

    _onMotionEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        return Clutter.EVENT_PROPAGATE;
    }

    _startFrameLoop() {
        if (this._frameSourceId > 0)
            return;

        const currentGen = ++this._generation;
        this._frameSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            if (this._state !== State.ACTIVE || this._generation !== currentGen) {
                this._frameSourceId = 0;
                return GLib.SOURCE_REMOVE;
            }

            this._onFrame();
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopFrameLoop() {
        if (this._frameSourceId > 0) {
            GLib.source_remove(this._frameSourceId);
            this._frameSourceId = 0;
        }
    }

    _onFrame() {
        if (this._state !== State.ACTIVE)
            return;

        if (!this._settings.magnificationEnabled) {
            this._resetToBaseline('settings-disabled');
            return;
        }

        const [px, py] = global.get_pointer();

        // Check if pointer is inside active dock rectangle
        if (this._dockRect) {
            if (px < this._dockRect.x1 || px > this._dockRect.x2 ||
                py < this._dockRect.y1 || py > this._dockRect.y2) {
                this._resetToBaseline('pointer-outside');
                return;
            }
        }

        const isHorizontal = this._dockDash._isHorizontal;
        const maxScale = this._settings.magnificationMaxScale ?? 1.65;
        const radiusFactor = this._settings.magnificationRadius ?? 2.5;
        const allowDisplacement = this._settings.magnificationDisplacement ?? true;
        const rawSmoothing = this._settings.magnificationSmoothing ?? 0.35;
        const smoothing = Math.min(Math.max(rawSmoothing, 0.10), 1.00);

        const pointerPrimary = isHorizontal ? px : py;
        const recordsList = Array.from(this._records.values());
        if (recordsList.length === 0)
            return;

        // 1. Compute cosine scale wave for each icon
        for (const record of recordsList) {
            const centerPrimary = isHorizontal ? record.baseItemStageRect.centerX : record.baseItemStageRect.centerY;
            const baseIconSize = isHorizontal ? record.baseItemStageRect.width : record.baseItemStageRect.height;
            const radius = radiusFactor * baseIconSize;
            const distance = Math.abs(pointerPrimary - centerPrimary);

            if (distance < radius && radius > 0) {
                const normalized = Math.min(Math.max(distance / radius, 0), 1);
                const influence = 0.5 * (1 + Math.cos(Math.PI * normalized));
                record.targetScale = 1 + influence * (maxScale - 1);
            } else {
                record.targetScale = 1.0;
            }
            if (Number.isNaN(record.targetScale) || !Number.isFinite(record.targetScale))
                record.targetScale = 1.0;
            record.targetScale = Math.min(Math.max(record.targetScale, 1.0), maxScale);
        }

        // 2. Compute non-overlapping displacement
        if (allowDisplacement) {
            const n = recordsList.length;
            const extraSize = new Float64Array(n);
            const cum = new Float64Array(n);

            for (let i = 0; i < n; i++) {
                const size = isHorizontal ? recordsList[i].baseItemStageRect.width : recordsList[i].baseItemStageRect.height;
                extraSize[i] = (recordsList[i].targetScale - 1.0) * size;
            }

            cum[0] = 0.5 * extraSize[0];
            for (let i = 1; i < n; i++) {
                cum[i] = cum[i - 1] + 0.5 * extraSize[i - 1] + 0.5 * extraSize[i];
            }

            let anchor = 0.0;
            const centers = recordsList.map(r => isHorizontal ? r.baseItemStageRect.centerX : r.baseItemStageRect.centerY);
            if (pointerPrimary <= centers[0]) {
                anchor = cum[0];
            } else if (pointerPrimary >= centers[n - 1]) {
                anchor = cum[n - 1];
            } else {
                for (let k = 0; k < n - 1; k++) {
                    if (pointerPrimary >= centers[k] && pointerPrimary <= centers[k + 1]) {
                        const span = centers[k + 1] - centers[k];
                        const t = span > 0 ? (pointerPrimary - centers[k]) / span : 0;
                        anchor = cum[k] + t * (cum[k + 1] - cum[k]);
                        break;
                    }
                }
            }

            for (let i = 0; i < n; i++) {
                recordsList[i].targetDisplacement = cum[i] - anchor;
                if (Number.isNaN(recordsList[i].targetDisplacement) || !Number.isFinite(recordsList[i].targetDisplacement))
                    recordsList[i].targetDisplacement = 0.0;
            }
        } else {
            for (const record of recordsList) {
                record.targetDisplacement = 0.0;
            }
        }

        // 3. Apply frame-based smoothing and update transforms
        const [pivotX, pivotY] = this._getPivotForOrientation();

        for (const record of recordsList) {
            // Scale smoothing
            record.currentScale += (record.targetScale - record.currentScale) * smoothing;
            if (Math.abs(record.targetScale - record.currentScale) < 0.001) {
                record.currentScale = record.targetScale;
            }
            if (Number.isNaN(record.currentScale) || !Number.isFinite(record.currentScale))
                record.currentScale = 1.0;

            // Displacement smoothing
            record.currentDisplacement += (record.targetDisplacement - record.currentDisplacement) * smoothing;
            if (Math.abs(record.targetDisplacement - record.currentDisplacement) < 0.01) {
                record.currentDisplacement = record.targetDisplacement;
            }
            if (Number.isNaN(record.currentDisplacement) || !Number.isFinite(record.currentDisplacement))
                record.currentDisplacement = 0.0;

            // Apply to visual actor (scaling)
            const visual = record.visualActor;
            visual.set_pivot_point(pivotX, pivotY);
            visual.set_scale(record.currentScale, record.currentScale);

            // Apply to layout actor (displacement)
            const layout = record.layoutActor;
            if (isHorizontal) {
                layout.translation_x = record.originalLayoutTransform.translationX + record.currentDisplacement;
                layout.translation_y = record.originalLayoutTransform.translationY;
            } else {
                layout.translation_x = record.originalLayoutTransform.translationX;
                layout.translation_y = record.originalLayoutTransform.translationY + record.currentDisplacement;
            }
        }
    }

    _resetToBaseline(reason, finalState = State.IDLE) {
        this._generation++;
        this._stopFrameLoop();
        this._state = State.SUSPENDED;

        const [pivotX, pivotY] = this._getPivotForOrientation();

        for (const record of this._records.values()) {
            const { layoutActor, visualActor, originalLayoutTransform } = record;

            if (visualActor) {
                visualActor.set_pivot_point(pivotX, pivotY);
                visualActor.set_scale(1.0, 1.0);
            }

            if (layoutActor) {
                layoutActor.translation_x = originalLayoutTransform.translationX;
                layoutActor.translation_y = originalLayoutTransform.translationY;
            }

            record.currentScale = 1.0;
            record.targetScale = 1.0;
            record.currentDisplacement = 0.0;
            record.targetDisplacement = 0.0;
        }

        this._verifyBaseline();
        this._records.clear();
        this._dockRect = null;
        this._state = finalState;
    }

    _verifyBaseline() {
        const [pivotX, pivotY] = this._getPivotForOrientation();
        for (const record of this._records.values()) {
            const { layoutActor, visualActor, originalLayoutTransform } = record;
            if (layoutActor && (
                layoutActor.translation_x !== originalLayoutTransform.translationX ||
                layoutActor.translation_y !== originalLayoutTransform.translationY
            )) {
                layoutActor.translation_x = originalLayoutTransform.translationX;
                layoutActor.translation_y = originalLayoutTransform.translationY;
            }
            if (visualActor) {
                visualActor.set_pivot_point(pivotX, pivotY);
                visualActor.set_scale(1.0, 1.0);
            }
        }
        return true;
    }

    destroy() {
        if (this._state === State.DESTROYED)
            return;

        this._resetToBaseline('destroy', State.DESTROYED);
        this._signalsHandler?.destroy();
        this._signalsHandler = null;
        this._dockDash = null;

        console.log('[Albert macOS Dock] Magnifier destroyed');
    }
});
