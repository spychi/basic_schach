// Board rendering and input (click, drag & drop, keyboard).
// Selection and target squares are owned by the controller; this view only reports input.

import { colorOf, squareName } from '../engine/board.js';
import { pieceSVG, pieceName } from './pieces.js';

const ANIM_MS = 150;
const DRAG_THRESHOLD = 4;
const noop = () => {};

/**
 * @typedef {Object} BoardRenderData
 * @property {import('../engine/board.js').State} state
 * @property {number|null} [selected]
 * @property {{square:number, capture:boolean}[]} [targets]
 * @property {{from:number, to:number}|null} [lastMove]
 * @property {number|null} [checkSquare]
 * @property {boolean} [flipped]       Black at the bottom
 * @property {boolean} [interactive]   false while the computer thinks or after game end
 */

export class BoardView {
  /**
   * @param {HTMLElement} container
   * @param {{onMoveIntent?: (m:{from:number,to:number})=>void, onSquareClick?: (sq:number)=>void}} [options]
   *   onSquareClick is also called when a drag starts on an own piece (before onMoveIntent).
   */
  constructor(container, { onMoveIntent, onSquareClick } = {}) {
    this.container = container;
    this.onMoveIntent = onMoveIntent || noop;
    this.onSquareClick = onSquareClick || noop;

    this.state = null;
    this.interactive = true;
    this._prev = null;            // { board, flipped } of previous render
    this._cells = [];             // by visual position 0..63
    this._bySquare = new Array(64).fill(null);
    this._focusPos = 52;          // roving tabindex (visual position)
    this._drag = null;
    this._skipClick = false;
    this._skipAnimUntil = 0;
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.el = document.createElement('div');
    this.el.className = 'board';
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', 'Schachbrett');

    for (let pos = 0; pos < 64; pos++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sq';
      btn.tabIndex = pos === this._focusPos ? 0 : -1;
      btn._pos = pos;
      const rank = document.createElement('span');
      rank.className = 'sq__rank';
      rank.setAttribute('aria-hidden', 'true');
      const file = document.createElement('span');
      file.className = 'sq__file';
      file.setAttribute('aria-hidden', 'true');
      const piece = document.createElement('span');
      piece.className = 'sq__piece';
      const mark = document.createElement('span');
      mark.className = 'sq__mark';
      mark.setAttribute('aria-hidden', 'true');
      btn.append(piece, mark, rank, file);
      this.el.append(btn);
      this._cells.push({
        btn, rank, file, piece, square: -1, pieceChar: undefined, cls: '', label: '',
        showRank: pos % 8 === 0, showFile: pos >= 56,
      });
    }
    container.append(this.el);

    this._onMove = (e) => this._pointerMove(e);
    this._onUp = (e) => this._pointerUp(e);
    this.el.addEventListener('pointerdown', (e) => this._pointerDown(e));
    this.el.addEventListener('click', (e) => this._click(e));
    this.el.addEventListener('keydown', (e) => this._keydown(e));
    this.el.addEventListener('focusin', (e) => {
      const btn = e.target.closest('.sq');
      if (btn) this._setFocusPos(btn._pos, false);
    });
  }

  /** @param {BoardRenderData} data */
  render(data) {
    const {
      state, selected = null, targets = [], lastMove = null,
      checkSquare = null, flipped = false, interactive = true,
    } = data;
    const targetMap = new Map(targets.map((t) => [t.square, !!t.capture]));
    const prev = this._prev;
    this.state = state;
    this.interactive = interactive;
    this.el.classList.toggle('is-locked', !interactive);
    this.el.classList.toggle('is-flipped', !!flipped);

    for (let pos = 0; pos < 64; pos++) {
      const cell = this._cells[pos];
      const sq = flipped ? 63 - pos : pos;
      if (cell.square !== sq) {
        cell.square = sq;
        cell.btn.dataset.square = String(sq);
        if (cell.showRank) cell.rank.textContent = String(8 - Math.floor(sq / 8));
        if (cell.showFile) cell.file.textContent = 'abcdefgh'[sq % 8];
      }
      this._bySquare[sq] = cell;

      const p = state.board[sq];
      if (cell.pieceChar !== p) {
        cell.pieceChar = p;
        cell.piece.innerHTML = p ? pieceSVG(p, { decorative: true }) : '';
      }

      const dark = (Math.floor(sq / 8) + (sq % 8)) % 2 === 1;
      const isTarget = targetMap.has(sq);
      const isCapture = isTarget && targetMap.get(sq);
      const cls = 'sq ' + (dark ? 'sq--dark' : 'sq--light')
        + (sq === selected ? ' is-selected' : '')
        + (lastMove && (sq === lastMove.from || sq === lastMove.to) ? ' is-last' : '')
        + (sq === checkSquare ? ' is-check' : '')
        + (isTarget && !isCapture ? ' has-target' : '')
        + (isCapture ? ' has-capture' : '')
        + (interactive && p && colorOf(p) === state.turn ? ' has-own' : '');
      if (cell.cls !== cls) {
        cell.cls = cls;
        cell.btn.className = cls;
      }

      let label = `${squareName(sq)}, ${p ? pieceName(p) : 'leer'}`;
      if (sq === selected) label += ', ausgewählt';
      if (isCapture) label += ', Schlagen möglich';
      else if (isTarget) label += ', Zug möglich';
      if (sq === checkSquare) label += ', Schach';
      if (cell.label !== label) {
        cell.label = label;
        cell.btn.setAttribute('aria-label', label);
      }
    }

    this._maybeAnimate(prev, state, lastMove, !!flipped);
    this._prev = { board: state.board.slice(), flipped: !!flipped };
  }

  // ---- animation ----------------------------------------------------------

  _maybeAnimate(prev, state, lastMove, flipped) {
    const skip = performance.now() < this._skipAnimUntil;
    this._skipAnimUntil = 0;
    if (skip || !prev || !lastMove || prev.flipped !== flipped || this._reducedMotion.matches) return;
    const { from, to } = lastMove;
    const before = prev.board;
    const after = state.board;
    if (!before[from] || after[from] || !after[to] || before[to] === after[to]) return;
    if (colorOf(before[from]) !== colorOf(after[to])) return;
    const fromCell = this._bySquare[from];
    const toCell = this._bySquare[to];
    const a = fromCell.btn.getBoundingClientRect();
    const b = toCell.btn.getBoundingClientRect();
    const host = toCell.piece;
    const btn = toCell.btn;
    host.style.transition = 'none';
    host.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px)`;
    btn.style.zIndex = '3';
    void host.offsetWidth; // force reflow
    host.style.transition = `transform ${ANIM_MS}ms ease-out`;
    host.style.transform = '';
    setTimeout(() => {
      host.style.transition = '';
      btn.style.zIndex = '';
    }, ANIM_MS + 50);
  }

  // ---- pointer input ------------------------------------------------------

  _pointerDown(e) {
    this._skipClick = false;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (this._drag) this._endDrag(null);
    const btn = e.target.closest('.sq');
    if (!btn || !this.interactive || !this.state) return;
    const sq = Number(btn.dataset.square);
    const piece = this.state.board[sq];
    if (!piece || colorOf(piece) !== this.state.turn) return;
    this._skipClick = true; // selection happens now, so the following click must not repeat it
    this.onSquareClick(sq);
    this._drag = {
      from: sq, x: e.clientX, y: e.clientY, pointerId: e.pointerId,
      active: false, ghost: null, size: 0,
    };
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  }

  _pointerMove(e) {
    const d = this._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.active) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return;
      const cell = this._bySquare[d.from];
      const rect = cell.btn.getBoundingClientRect();
      d.size = rect.width * 0.86;
      d.active = true;
      const ghost = document.createElement('div');
      ghost.className = 'board-ghost';
      ghost.style.width = ghost.style.height = `${d.size}px`;
      ghost.innerHTML = pieceSVG(cell.pieceChar, { decorative: true });
      document.body.append(ghost);
      d.ghost = ghost;
      cell.piece.classList.add('is-dragging');
    }
    d.ghost.style.transform = `translate(${e.clientX - d.size / 2}px, ${e.clientY - d.size / 2}px)`;
  }

  _pointerUp(e) {
    const d = this._drag;
    if (!d || e.pointerId !== d.pointerId) return;
    let to = null;
    if (d.active && e.type === 'pointerup') {
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const btn = hit && hit.closest ? hit.closest('.sq') : null;
      if (btn && this.el.contains(btn)) to = Number(btn.dataset.square);
    }
    const from = d.from;
    const wasActive = d.active;
    this._endDrag();
    if (wasActive && to !== null && to !== from) {
      this._skipAnimUntil = performance.now() + 2000; // the piece was already moved by hand
      this.onMoveIntent({ from, to });
    }
  }

  _endDrag() {
    const d = this._drag;
    if (!d) return;
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
    if (d.ghost) d.ghost.remove();
    const cell = this._bySquare[d.from];
    if (cell) cell.piece.classList.remove('is-dragging');
    this._drag = null;
  }

  _click(e) {
    const btn = e.target.closest('.sq');
    if (!btn || !this.interactive) return;
    // detail === 0: keyboard-triggered click, never skipped
    if (this._skipClick && e.detail !== 0) {
      this._skipClick = false;
      return;
    }
    this.onSquareClick(Number(btn.dataset.square));
  }

  // ---- keyboard -----------------------------------------------------------

  _setFocusPos(pos, focus) {
    if (pos !== this._focusPos) {
      this._cells[this._focusPos].btn.tabIndex = -1;
      this._focusPos = pos;
    }
    const btn = this._cells[pos].btn;
    btn.tabIndex = 0;
    if (focus) btn.focus();
  }

  _keydown(e) {
    const btn = e.target.closest('.sq');
    if (!btn) return;
    const delta = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!delta) return;
    e.preventDefault();
    const col = Math.min(7, Math.max(0, (btn._pos % 8) + delta[0]));
    const row = Math.min(7, Math.max(0, Math.floor(btn._pos / 8) + delta[1]));
    this._setFocusPos(row * 8 + col, true);
  }
}
