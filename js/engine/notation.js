// German short algebraic notation (K D T L S) and UCI helpers. No DOM.

import { squareName, squareIndex, fileOf, rankOf } from './board.js';
import { generateLegalMoves, makeMove } from './moves.js';
import { isInCheck } from './rules.js';

const LETTER = { K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' };

/** SAN of a legal move in the given (pre-move) state. */
export function toSAN(state, move) {
  const type = move.piece.toUpperCase();
  let san;
  if (move.flags === 'castle-k') san = 'O-O';
  else if (move.flags === 'castle-q') san = 'O-O-O';
  else {
    const target = squareName(move.to);
    const capture = move.captured || move.flags === 'ep';
    if (type === 'P') {
      san = (capture ? squareName(move.from)[0] + 'x' : '') + target;
    } else {
      const others = generateLegalMoves(state).filter(
        (m) => m.piece === move.piece && m.to === move.to && m.from !== move.from);
      let dis = '';
      if (others.length) {
        const sameFile = others.some((m) => fileOf(m.from) === fileOf(move.from));
        const sameRank = others.some((m) => rankOf(m.from) === rankOf(move.from));
        if (!sameFile) dis = squareName(move.from)[0];
        else if (!sameRank) dis = squareName(move.from)[1];
        else dis = squareName(move.from);
      }
      san = LETTER[type] + dis + (capture ? 'x' : '') + target;
    }
    if (move.promotion) san += '=' + LETTER[move.promotion.toUpperCase()];
  }
  const next = makeMove(state, move);
  if (isInCheck(next, next.turn)) {
    san += generateLegalMoves(next).length === 0 ? '#' : '+';
  }
  return san;
}

/** UCI string, promotion in lower case: 'e7e8q'. */
export function moveToUci(move) {
  return squareName(move.from) + squareName(move.to) +
    (move.promotion ? move.promotion.toLowerCase() : '');
}

/** Legal move matching the UCI string, or null. */
export function uciToMove(state, uci) {
  if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(uci)) return null;
  const from = squareIndex(uci.slice(0, 2));
  const to = squareIndex(uci.slice(2, 4));
  const promo = uci.length > 4 ? uci[4].toLowerCase() : null;
  return generateLegalMoves(state).find((m) =>
    m.from === from && m.to === to &&
    (m.promotion ? m.promotion.toLowerCase() : null) === promo) || null;
}
