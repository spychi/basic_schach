// Game: move history, undo, status, JSON. No DOM.

import { START_FEN, parseFEN, toFEN } from './board.js';
import { generateLegalMoves, legalMovesFrom, makeMove } from './moves.js';
import { getStatus, positionKey } from './rules.js';
import { toSAN, moveToUci, uciToMove } from './notation.js';
import { openingName } from './openings.js';

const ORDER = ['Q', 'R', 'B', 'N', 'P'];
const EXPLICIT = new Set(['resigned', 'timeout', 'agreed-draw', 'draw']);

/** True if the side owning `color` pieces cannot deliver mate (K, or K + one B/N). */
function lacksMatingMaterial(state, color) {
  const own = [];
  for (const p of state.board) {
    if (!p || p === 'K' || p === 'k') continue;
    if ((p === p.toUpperCase()) === (color === 'w')) own.push(p.toUpperCase());
  }
  return own.length === 0 || (own.length === 1 && (own[0] === 'B' || own[0] === 'N'));
}

export class Game extends EventTarget {
  constructor(fen = START_FEN) {
    super();
    this._init(fen);
  }

  _init(fen) {
    this._startFen = fen;
    const s = parseFEN(fen);
    this._states = [s];
    this._keys = [positionKey(s)];
    this._history = [];
    this._result = null;
  }

  _emit() { this.dispatchEvent(new Event('change')); }

  get state() { return this._states[this._states.length - 1]; }
  get turn() { return this.state.turn; }
  get history() { return this._history; }
  get lastMove() { return this._history.length ? this._history[this._history.length - 1].move : null; }
  get startFen() { return this._startFen; }

  legalMoves() { return generateLegalMoves(this.state); }
  legalMovesFrom(square) { return legalMovesFrom(this.state, square); }

  _over() { return this.status().type !== 'playing'; }

  needsPromotion(from, to) {
    return legalMovesFrom(this.state, from).some((m) => m.to === to && m.promotion);
  }

  play({ from, to, promotion } = {}) {
    if (this._over()) return null;
    const cands = legalMovesFrom(this.state, from).filter((m) => m.to === to);
    if (!cands.length) return null;
    let move;
    if (cands[0].promotion) {
      const want = (promotion || 'q').toLowerCase();
      move = cands.find((m) => m.promotion.toLowerCase() === want);
      if (!move) return null;
    } else move = cands[0];
    const before = this.state;
    const next = makeMove(before, move);
    const entry = { move, san: toSAN(before, move), fenBefore: toFEN(before), fenAfter: toFEN(next) };
    this._states.push(next);
    this._keys.push(positionKey(next));
    this._history.push(entry);
    this._emit();
    return entry;
  }

  undo() {
    if (this._result || this._over() || !this._history.length) return null;
    const entry = this._history.pop();
    this._states.pop();
    this._keys.pop();
    this._emit();
    return entry;
  }

  status() {
    if (this._result) return this._result;
    return getStatus(this.state, this._keys);
  }

  get result() {
    const s = this.status();
    if (s.type === 'playing') return '*';
    if (s.winner) return s.winner === 'w' ? '1-0' : '0-1';
    return '1/2-1/2';
  }

  _end(result) {
    if (this._over()) return;
    this._result = result;
    this._emit();
  }

  resign(color) { this._end({ type: 'resigned', winner: color === 'w' ? 'b' : 'w' }); }
  agreeDraw() { this._end({ type: 'agreed-draw' }); }
  timeout(color) {
    const winner = color === 'w' ? 'b' : 'w';
    this._end(lacksMatingMaterial(this.state, winner)
      ? { type: 'draw', reason: 'timeout-insufficient' }
      : { type: 'timeout', winner });
  }

  stateAt(ply) {
    const i = Math.max(0, Math.min(ply, this._states.length - 1));
    return this._states[i];
  }

  captured() {
    const out = { w: [], b: [] };
    this._history.forEach((h, i) => {
      const piece = h.move.captured || (h.move.flags === 'ep' ? (h.move.piece === 'P' ? 'p' : 'P') : null);
      if (piece) out[i % 2 === 0 ? 'w' : 'b'].push(piece);
    });
    // Note: side to move at ply 0 may be black for custom FENs.
    if (this._states[0].turn === 'b') {
      const w = out.b; out.b = out.w; out.w = w;
    }
    const rank = (p) => ORDER.indexOf(p.toUpperCase());
    out.w.sort((a, b) => rank(a) - rank(b));
    out.b.sort((a, b) => rank(a) - rank(b));
    return out;
  }

  openingName() {
    if (this._startFen !== START_FEN) return null;
    return openingName(this._history.map((h) => h.san));
  }

  toJSON() {
    const s = this.status();
    return {
      startFen: this._startFen,
      moves: this._history.map((h) => moveToUci(h.move)),
      result: s.type === 'playing' ? null : { ...s },
    };
  }

  load(data) {
    this._init(data.startFen || START_FEN);
    for (const uci of data.moves || []) {
      const move = uciToMove(this.state, uci);
      if (!move) throw new Error(`Illegal move in saved game: ${uci}`);
      const before = this.state;
      const next = makeMove(before, move);
      this._history.push({ move, san: toSAN(before, move), fenBefore: toFEN(before), fenAfter: toFEN(next) });
      this._states.push(next);
      this._keys.push(positionKey(next));
    }
    const r = data.result;
    if (r && EXPLICIT.has(r.type) && getStatus(this.state, this._keys).type === 'playing') {
      this._result = { ...r };
    }
    this._emit();
    return this;
  }

  static fromJSON(data) {
    return new Game(data.startFen || START_FEN).load(data);
  }
}
