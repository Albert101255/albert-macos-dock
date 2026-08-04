// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
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
    }

    _onEnterEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        console.log('[Albert macOS Dock] Pointer entered dock');
        if (this._state === State.IDLE) {
            this._captureBaselineGeometry();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onLeaveEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        console.log('[Albert macOS Dock] Pointer left dock');
        this._resetToBaseline('pointer-leave');
        return Clutter.EVENT_PROPAGATE;
    }

    _onMotionEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        return Clutter.EVENT_PROPAGATE;
    }

    _resetToBaseline(reason, finalState = State.IDLE) {
        for (const record of this._records.values()) {
            const { layoutActor, visualActor, originalLayoutTransform, originalVisualTransform } = record;

            if (layoutActor) {
                layoutActor.set_pivot_point(originalLayoutTransform.pivotX, originalLayoutTransform.pivotY);
                layoutActor.set_scale(originalLayoutTransform.scaleX, originalLayoutTransform.scaleY);
                layoutActor.translation_x = originalLayoutTransform.translationX;
                layoutActor.translation_y = originalLayoutTransform.translationY;
                layoutActor.opacity = originalLayoutTransform.opacity;
            }

            if (visualActor) {
                visualActor.set_pivot_point(originalVisualTransform.pivotX, originalVisualTransform.pivotY);
                visualActor.set_scale(originalVisualTransform.scaleX, originalVisualTransform.scaleY);
                visualActor.translation_x = originalVisualTransform.translationX;
                visualActor.translation_y = originalVisualTransform.translationY;
                visualActor.opacity = originalVisualTransform.opacity;
            }
        }

        this._records.clear();
        this._state = finalState;
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
