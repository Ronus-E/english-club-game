/**
 * Unified input: keyboard, on-screen joystick and the action button.
 * The controller exposes one normalised screen-space axis plus an action event.
 */
const MOVE_KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
  KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0],
};

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export class InputController {
  constructor({ joystick, knob, actionBtn, onAction, onPause, isEnabled = () => true }) {
    this.joystick = joystick;
    this.knob = knob;
    this.actionBtn = actionBtn;
    this.onAction = onAction || (() => {});
    this.onPause = onPause || (() => {});
    this.isEnabled = isEnabled;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.activePointer = null;
    this._bind();
  }

  _bind() {
    this._onKeyDown = (event) => {
      const target = event.target;
      if (target && TYPING_TAGS.has(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === 'Escape') {
        event.preventDefault();
        this.onPause();
        return;
      }
      if (!this.isEnabled()) return;
      if (event.code === 'KeyE' || event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) this.onAction();
        return;
      }
      if (MOVE_KEYS[event.code]) {
        event.preventDefault();
        this.keys.add(event.code);
      }
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onBlur = () => {
      this.keys.clear();
      this._releaseJoy();
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);

    if (this.joystick) {
      this._onPointerDown = (event) => {
        if (!this.isEnabled()) return;
        event.preventDefault();
        this.activePointer = event.pointerId;
        this.joystick.setPointerCapture?.(event.pointerId);
        this._moveJoy(event);
      };
      this._onPointerMove = (event) => {
        if (this.activePointer !== event.pointerId) return;
        event.preventDefault();
        this._moveJoy(event);
      };
      this._onPointerUp = (event) => {
        if (this.activePointer !== event.pointerId) return;
        this.activePointer = null;
        this._releaseJoy();
      };
      this.joystick.addEventListener('pointerdown', this._onPointerDown);
      this.joystick.addEventListener('pointermove', this._onPointerMove);
      this.joystick.addEventListener('pointerup', this._onPointerUp);
      this.joystick.addEventListener('pointercancel', this._onPointerUp);
    }

    if (this.actionBtn) {
      this._onActionClick = (event) => {
        event.preventDefault();
        if (this.isEnabled()) this.onAction();
      };
      this.actionBtn.addEventListener('click', this._onActionClick);
    }
  }

  _moveJoy(event) {
    const rect = this.joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.max(24, rect.width / 2 - 6);
    let dx = event.clientX - cx;
    let dy = event.clientY - cy;
    const length = Math.hypot(dx, dy);
    if (length > radius) {
      dx = (dx / length) * radius;
      dy = (dy / length) * radius;
    }
    this.joy.x = dx / radius;
    this.joy.y = dy / radius;
    if (this.knob) {
      this.knob.style.transform = `translate(-50%, -50%) translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    }
  }

  _releaseJoy() {
    this.joy.x = 0;
    this.joy.y = 0;
    this.activePointer = null;
    if (this.knob) this.knob.style.transform = 'translate(-50%, -50%)';
  }

  /** Screen-space input, x right / y down, length ≤ 1. */
  axis() {
    let x = this.joy.x;
    let y = this.joy.y;
    for (const code of this.keys) {
      const v = MOVE_KEYS[code];
      if (v) { x += v[0]; y += v[1]; }
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  /** Convert screen input to isometric world direction. */
  worldAxis() {
    const { x, y } = this.axis();
    const wx = x + y;
    const wy = y - x;
    const len = Math.hypot(wx, wy);
    if (len < 0.001) return { x: 0, y: 0, active: false };
    return { x: wx / len, y: wy / len, active: true };
  }

  reset() {
    this.keys.clear();
    this._releaseJoy();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    if (this.joystick) {
      this.joystick.removeEventListener('pointerdown', this._onPointerDown);
      this.joystick.removeEventListener('pointermove', this._onPointerMove);
      this.joystick.removeEventListener('pointerup', this._onPointerUp);
      this.joystick.removeEventListener('pointercancel', this._onPointerUp);
    }
    if (this.actionBtn) this.actionBtn.removeEventListener('click', this._onActionClick);
  }
}
