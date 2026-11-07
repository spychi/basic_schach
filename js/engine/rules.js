// Check, checkmate, stalemate and draw rules. No DOM, no dependencies.

import { squareName, fileOf, rankOf } from './board.js';
import { generateLegalMoves, isSquareAttacked } from './moves.js';

export function kingSquare(state, color) {
  const king = color === 'w' ? 'K' : 'k';
  for (let i = 0; i < 64; i++) if (state.board[i] === king) return i;
  throw new Error(`No ${color} king on board`);
}

export function isInCheck(state, color) {
  return isSquareAttacked(state, kingSquare(state, color), color === 'w' ? 'b' : 'w');
}

/** FEN without move counters; en passant square only when an ep capture is legal. */
export function positionKey(state) {
  let placement = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[r * 8 + c];
      if (p) { if (empty) { placement += empty; empty = 0; } placement += p; } else empty++;
    }
    if (empty) placement += empty;
    if (r < 7) placement += '/';
  }
  const c = state.castling;
  const castling = (c.K ? 'K' : '') + (c.Q ? 'Q' : '') + (c.k ? 'k' : '') + (c.q ? 'q' : '') || '-';
  let ep = '-';
  if (state.ep !== null && generateLegalMoves(state).some((m) => m.flags === 'ep')) {
    ep = squareName(state.ep);
  }
  return `${placement} ${state.turn} ${castling} ${ep}`;
}

function insufficientMaterial(state) {
  const bishops = [];
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p || p === 'K' || p === 'k') continue;
    if (p === 'B' || p === 'b') bishops.push((fileOf(i) + rankOf(i)) % 2);
    else if (p === 'N' || p === 'n') {
      // A lone knight (and nothing else) cannot mate.
      if (bishops.length === 0 && countNonKings(state) === 1) return true;
      return false;
    } else return false;
  }
  return bishops.every((x) => x === bishops[0]);
}

function countNonKings(state) {
  let n = 0;
  for (const p of state.board) if (p && p !== 'K' && p !== 'k') n++;
  return n;
}

export function getStatus(state, positionKeys = []) {
  if (generateLegalMoves(state).length === 0) {
    return isInCheck(state, state.turn)
      ? { type: 'checkmate', winner: state.turn === 'w' ? 'b' : 'w' }
      : { type: 'stalemate' };
  }
  if (state.halfmove >= 100) return { type: 'draw', reason: 'fifty-move' };
  const key = positionKey(state);
  let count = 0;
  for (const k of positionKeys) if (k === key) count++;
  if (count >= 3) return { type: 'draw', reason: 'threefold' };
  if (insufficientMaterial(state)) return { type: 'draw', reason: 'insufficient-material' };
  return { type: 'playing' };
}
