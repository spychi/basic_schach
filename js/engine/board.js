// Board representation, FEN parsing/serialisation and square helpers.
// Index 0 = a8, 7 = h8, 56 = a1, 63 = h1.

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FILES = 'abcdefgh';
const PIECES = 'PNBRQKpnbrqk';

export function squareName(index) {
  return FILES[index % 8] + (8 - Math.floor(index / 8));
}

export function squareIndex(name) {
  if (typeof name !== 'string' || name.length !== 2) throw new Error(`Invalid square: ${name}`);
  const file = FILES.indexOf(name[0]);
  const rank = Number(name[1]);
  if (file < 0 || !(rank >= 1 && rank <= 8)) throw new Error(`Invalid square: ${name}`);
  return (8 - rank) * 8 + file;
}

export function fileOf(index) { return index % 8; }
export function rankOf(index) { return 8 - Math.floor(index / 8); } // 1..8

export function colorOf(piece) {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

export function cloneState(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    castling: { ...state.castling },
    ep: state.ep,
    halfmove: state.halfmove,
    fullmove: state.fullmove,
  };
}

export function parseFEN(fen) {
  if (typeof fen !== 'string') throw new Error('FEN must be a string');
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error(`Invalid FEN: ${fen}`);
  const [placement, turn, castling, ep, halfmove = '0', fullmove = '1'] = parts;

  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error(`Invalid FEN placement: ${placement}`);
  const board = [];
  for (const row of rows) {
    let count = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        const n = Number(ch);
        for (let i = 0; i < n; i++) board.push(null);
        count += n;
      } else if (PIECES.includes(ch)) {
        board.push(ch);
        count += 1;
      } else {
        throw new Error(`Invalid FEN character: ${ch}`);
      }
    }
    if (count !== 8) throw new Error(`Invalid FEN row: ${row}`);
  }

  if (turn !== 'w' && turn !== 'b') throw new Error(`Invalid FEN turn: ${turn}`);
  if (!/^(-|[KQkq]{1,4})$/.test(castling)) throw new Error(`Invalid FEN castling: ${castling}`);
  let epIndex = null;
  if (ep !== '-') {
    if (!/^[a-h][36]$/.test(ep)) throw new Error(`Invalid FEN en passant: ${ep}`);
    epIndex = squareIndex(ep);
  }
  const hm = Number(halfmove);
  const fm = Number(fullmove);
  if (!Number.isInteger(hm) || hm < 0 || !Number.isInteger(fm) || fm < 1) {
    throw new Error(`Invalid FEN counters: ${halfmove} ${fullmove}`);
  }
  if (board.filter((p) => p === 'K').length !== 1 || board.filter((p) => p === 'k').length !== 1) {
    throw new Error('FEN must contain exactly one king per side');
  }

  return {
    board,
    turn,
    castling: {
      K: castling.includes('K'),
      Q: castling.includes('Q'),
      k: castling.includes('k'),
      q: castling.includes('q'),
    },
    ep: epIndex,
    halfmove: hm,
    fullmove: fm,
  };
}

export function toFEN(state) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = state.board[r * 8 + c];
      if (p) {
        if (empty) { row += empty; empty = 0; }
        row += p;
      } else {
        empty++;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  const c = state.castling;
  const castling = (c.K ? 'K' : '') + (c.Q ? 'Q' : '') + (c.k ? 'k' : '') + (c.q ? 'q' : '') || '-';
  const ep = state.ep === null ? '-' : squareName(state.ep);
  return `${rows.join('/')} ${state.turn} ${castling} ${ep} ${state.halfmove} ${state.fullmove}`;
}
