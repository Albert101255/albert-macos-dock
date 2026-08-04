// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
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
                'motion-event',
                this._onMotionEvent.bind(this)
            );
        }
    }

    _onEnterEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        console.log('[Albert macOS Dock] Pointer entered dock');
        return Clutter.EVENT_PROPAGATE;
    }

    _onMotionEvent(actor, event) {
        if (this._state === State.DESTROYED)
            return Clutter.EVENT_PROPAGATE;

        return Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        if (this._state === State.DESTROYED)
            return;

        this._state = State.DESTROYED;
        this._signalsHandler?.destroy();
        this._signalsHandler = null;
        this._dockDash = null;

        console.log('[Albert macOS Dock] Magnifier destroyed');
    }
});
