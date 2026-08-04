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
        this._targetActor = null;
        this._originalTransform = null;

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

    _onEnterEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        console.log('[Albert macOS Dock] Pointer entered dock');

        if (!this._targetActor && this._dockDash._box) {
            const children = this._dockDash._box.get_children();
            for (const item of children) {
                const visual = this._getVisualActor(item);
                if (visual) {
                    this._targetActor = visual;
                    this._originalTransform = {
                        scale_x: visual.scale_x,
                        scale_y: visual.scale_y,
                        translation_x: visual.translation_x,
                        translation_y: visual.translation_y,
                        pivot_x: visual.pivot_point_x,
                        pivot_y: visual.pivot_point_y,
                        opacity: visual.opacity,
                    };
                    const [px, py] = this._getPivotForOrientation();
                    visual.set_pivot_point(px, py);
                    visual.set_scale(1.25, 1.25);
                    break;
                }
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onLeaveEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        console.log('[Albert macOS Dock] Pointer left dock');
        this._resetSingleIcon();
        return Clutter.EVENT_PROPAGATE;
    }

    _onMotionEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        return Clutter.EVENT_PROPAGATE;
    }

    _resetSingleIcon() {
        if (this._targetActor && this._originalTransform) {
            this._targetActor.set_pivot_point(
                this._originalTransform.pivot_x,
                this._originalTransform.pivot_y
            );
            this._targetActor.set_scale(
                this._originalTransform.scale_x,
                this._originalTransform.scale_y
            );
            this._targetActor.translation_x = this._originalTransform.translation_x;
            this._targetActor.translation_y = this._originalTransform.translation_y;
            this._targetActor.opacity = this._originalTransform.opacity;
            this._targetActor = null;
            this._originalTransform = null;
        }
    }

    destroy() {
        if (this._state === State.DESTROYED)
            return;

        this._resetSingleIcon();
        this._state = State.DESTROYED;
        this._signalsHandler?.destroy();
        this._signalsHandler = null;
        this._dockDash = null;

        console.log('[Albert macOS Dock] Magnifier destroyed');
    }
});
