// Chess clock based on performance.now(). Emits 'tick' (detail: { w, b, running })
// and 'timeout' (detail: color).
const TICK_MS = 100;

export class Clock extends EventTarget {
  constructor({ initialMs, incrementMs = 0 }) {
    super();
    this.initialMs = initialMs;
    this.incrementMs = incrementMs;
    this._ms = { w: initialMs, b: initialMs };
    this._running = null;   // color or null
    this._since = 0;        // performance.now() when the running color started
    this._timer = null;
  }

  /** Color whose clock is running, or null. */
  get running() { return this._running; }

  start(color) {
    this._commit();
    this._running = color;
    this._since = performance.now();
    this._schedule();
    this._emitTick();
  }

  /** The player who just moved gets the increment; the other clock starts. */
  switchTo(color) {
    const mover = this._running;
    this._commit();
    if (mover && mover !== color) this._ms[mover] += this.incrementMs;
    this._running = color;
    this._since = performance.now();
    this._schedule();
    this._emitTick();
  }

  pause() {
    this._commit();
    this._running = null;
    this._unschedule();
    this._emitTick();
  }

  remaining(color) {
    let ms = this._ms[color];
    if (this._running === color) ms -= performance.now() - this._since;
    return Math.max(0, ms);
  }

  /** Restore times, e.g. after loading a saved game. Keeps the running state. */
  setTimes({ w, b }) {
    this._commit();
    if (typeof w === 'number') this._ms.w = w;
    if (typeof b === 'number') this._ms.b = b;
    if (this._running) this._since = performance.now();
    this._emitTick();
  }

  /** >= 10 s: 'mm:ss'; below: 'S:T' with tenths, e.g. '0:08.4' -> shown as '0:08.4'. */
  static format(ms) {
    ms = Math.max(0, ms);
    if (ms >= 10000) {
      const total = Math.floor(ms / 1000);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    const tenths = Math.floor(ms / 100);
    const s = Math.floor(tenths / 10);
    return '0:' + String(s).padStart(2, '0') + '.' + (tenths % 10);
  }

  // --- internals ---
  _commit() {
    if (this._running) {
      const now = performance.now();
      this._ms[this._running] = Math.max(0, this._ms[this._running] - (now - this._since));
      this._since = now;
    }
  }

  _schedule() {
    if (this._timer == null) this._timer = setInterval(() => this._onTick(), TICK_MS);
  }

  _unschedule() {
    if (this._timer != null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _onTick() {
    if (!this._running) return;
    const color = this._running;
    if (this.remaining(color) <= 0) {
      this._ms[color] = 0;
      this._running = null;
      this._unschedule();
      this._emitTick();
      this.dispatchEvent(new CustomEvent('timeout', { detail: color }));
      return;
    }
    this._emitTick();
  }

  _emitTick() {
    this.dispatchEvent(new CustomEvent('tick', {
      detail: { w: this.remaining('w'), b: this.remaining('b'), running: this._running },
    }));
  }
}
