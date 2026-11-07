// Move generation, legality, make-move and perft. No DOM, no dependencies.
// Index 0 = a8, 63 = h1. White pawns move towards lower indices.


const KNIGHT_D = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG_D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTHO_D = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function step(sq, dr, df) {
  const r = (sq >> 3) + dr;
  const f = (sq & 7) + df;
  return r < 0 || r > 7 || f < 0 || f > 7 ? -1 : r * 8 + f;
}

function buildJumps(deltas) {
  const t = [];
  for (let s = 0; s < 64; s++) {
    const list = [];
    for (const [dr, df] of deltas) { const n = step(s, dr, df); if (n >= 0) list.push(n); }
    t.push(list);
  }
  return t;
}

function buildRays(deltas) {
  const t = [];
  for (let s = 0; s < 64; s++) {
    const rays = [];
    for (const [dr, df] of deltas) {
      const ray = [];
      let n = step(s, dr, df);
      while (n >= 0) { ray.push(n); n = step(n, dr, df); }
      if (ray.length) rays.push(ray);
    }
    t.push(rays);
  }
  return t;
}

const KNIGHT = buildJumps(KNIGHT_D);
const KING = buildJumps(KING_D);
const DIAG = buildRays(DIAG_D);
const ORTHO = buildRays(ORTHO_D);
// Squares from which a pawn of the given colour attacks square s.
const PAWN_ATTACKERS = {
  w: buildJumps([[1, -1], [1, 1]]),
  b: buildJumps([[-1, -1], [-1, 1]]),
};
// Squares a pawn of the given colour attacks from square s.
const PAWN_CAPTURES = {
  w: buildJumps([[-1, -1], [-1, 1]]),
  b: buildJumps([[1, -1], [1, 1]]),
};

const isWhite = (p) => p === 'P' || p === 'N' || p === 'B' || p === 'R' || p === 'Q' || p === 'K';

function boardAttacked(board, sq, by) {
  const white = by === 'w';
  const pawn = white ? 'P' : 'p';
  const pa = PAWN_ATTACKERS[by][sq];
  for (let i = 0; i < pa.length; i++) if (board[pa[i]] === pawn) return true;
  const knight = white ? 'N' : 'n';
  const kn = KNIGHT[sq];
  for (let i = 0; i < kn.length; i++) if (board[kn[i]] === knight) return true;
  const king = white ? 'K' : 'k';
  const kg = KING[sq];
  for (let i = 0; i < kg.length; i++) if (board[kg[i]] === king) return true;
  const bishop = white ? 'B' : 'b';
  const rook = white ? 'R' : 'r';
  const queen = white ? 'Q' : 'q';
  const dr = DIAG[sq];
  for (let i = 0; i < dr.length; i++) {
    const ray = dr[i];
    for (let j = 0; j < ray.length; j++) {
      const p = board[ray[j]];
      if (p === null) continue;
      if (p === bishop || p === queen) return true;
      break;
    }
  }
  const or = ORTHO[sq];
  for (let i = 0; i < or.length; i++) {
    const ray = or[i];
    for (let j = 0; j < ray.length; j++) {
      const p = board[ray[j]];
      if (p === null) continue;
      if (p === rook || p === queen) return true;
      break;
    }
  }
  return false;
}

export function isSquareAttacked(state, square, byColor) {
  return boardAttacked(state.board, square, byColor);
}

function mv(from, to, piece, captured, promotion, flags) {
  return { from, to, piece, captured, promotion, flags };
}

/** Pseudo-legal moves for the side to move (own king may be left in check). */
export function generatePseudoMoves(state) {
  const { board, turn, castling, ep } = state;
  const white = turn === 'w';
  const moves = [];
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (piece === null || isWhite(piece) !== white) continue;
    const type = piece.toUpperCase();
    if (type === 'P') {
      const dir = white ? -8 : 8;
      const startRank = white ? 6 : 1;
      const lastRank = white ? 0 : 7;
      const to = from + dir;
      const promos = white ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];
      if (board[to] === null) {
        if ((to >> 3) === lastRank) {
          for (const p of promos) moves.push(mv(from, to, piece, null, p, ''));
        } else {
          moves.push(mv(from, to, piece, null, null, ''));
          if ((from >> 3) === startRank && board[to + dir] === null) {
            moves.push(mv(from, to + dir, piece, null, null, 'double'));
          }
        }
      }
      const caps = PAWN_CAPTURES[turn][from];
      for (let i = 0; i < caps.length; i++) {
        const t = caps[i];
        const target = board[t];
        if (target !== null) {
          if (isWhite(target) === white) continue;
          if ((t >> 3) === lastRank) {
            for (const p of promos) moves.push(mv(from, t, piece, target, p, ''));
          } else {
            moves.push(mv(from, t, piece, target, null, ''));
          }
        } else if (t === ep) {
          moves.push(mv(from, t, piece, white ? 'p' : 'P', null, 'ep'));
        }
      }
    } else if (type === 'N' || type === 'K') {
      const list = type === 'N' ? KNIGHT[from] : KING[from];
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        const target = board[t];
        if (target === null) moves.push(mv(from, t, piece, null, null, ''));
        else if (isWhite(target) !== white) moves.push(mv(from, t, piece, target, null, ''));
      }
      if (type === 'K') {
        const home = white ? 60 : 4;
        if (from === home) {
          const enemy = white ? 'b' : 'w';
          const rook = white ? 'R' : 'r';
          if ((white ? castling.K : castling.k) && board[home + 3] === rook &&
              board[home + 1] === null && board[home + 2] === null &&
              !boardAttacked(board, home, enemy) && !boardAttacked(board, home + 1, enemy) &&
              !boardAttacked(board, home + 2, enemy)) {
            moves.push(mv(from, home + 2, piece, null, null, 'castle-k'));
          }
          if ((white ? castling.Q : castling.q) && board[home - 4] === rook &&
              board[home - 1] === null && board[home - 2] === null && board[home - 3] === null &&
              !boardAttacked(board, home, enemy) && !boardAttacked(board, home - 1, enemy) &&
              !boardAttacked(board, home - 2, enemy)) {
            moves.push(mv(from, home - 2, piece, null, null, 'castle-q'));
          }
        }
      }
    } else {
      const rays = type === 'B' ? DIAG[from] : type === 'R' ? ORTHO[from] : null;
      const sets = rays ? [rays] : [DIAG[from], ORTHO[from]];
      for (const set of sets) {
        for (let i = 0; i < set.length; i++) {
          const ray = set[i];
          for (let j = 0; j < ray.length; j++) {
            const t = ray[j];
            const target = board[t];
            if (target === null) { moves.push(mv(from, t, piece, null, null, '')); continue; }
            if (isWhite(target) !== white) moves.push(mv(from, t, piece, target, null, ''));
            break;
          }
        }
      }
    }
  }
  return moves;
}

// Apply a move to a board array in place.
function applyToBoard(board, move) {
  const { from, to, flags } = move;
  board[to] = move.promotion || move.piece;
  board[from] = null;
  if (flags === 'ep') board[to + (move.piece === 'P' ? 8 : -8)] = null;
  else if (flags === 'castle-k') { board[to - 1] = board[to + 1]; board[to + 1] = null; }
  else if (flags === 'castle-q') { board[to + 1] = board[to - 2]; board[to - 2] = null; }
}

function findKing(board, king) {
  for (let i = 0; i < 64; i++) if (board[i] === king) return i;
  return -1;
}

function isLegal(state, move) {
  const board = state.board.slice();
  applyToBoard(board, move);
  const white = state.turn === 'w';
  const k = move.piece === 'K' || move.piece === 'k' ? move.to : findKing(board, white ? 'K' : 'k');
  return !boardAttacked(board, k, white ? 'b' : 'w');
}

export function generateLegalMoves(state) {
  const pseudo = generatePseudoMoves(state);
  const out = [];
  for (let i = 0; i < pseudo.length; i++) if (isLegal(state, pseudo[i])) out.push(pseudo[i]);
  return out;
}

export function legalMovesFrom(state, square) {
  return generateLegalMoves(state).filter((m) => m.from === square);
}

export function makeMove(state, move) {
  const board = state.board.slice();
  applyToBoard(board, move);
  const castling = { ...state.castling };
  const { from, to, piece } = move;
  if (piece === 'K') { castling.K = false; castling.Q = false; }
  else if (piece === 'k') { castling.k = false; castling.q = false; }
  for (const sq of [from, to]) {
    if (sq === 63) castling.K = false;
    else if (sq === 56) castling.Q = false;
    else if (sq === 7) castling.k = false;
    else if (sq === 0) castling.q = false;
  }
  const white = state.turn === 'w';
  return {
    board,
    turn: white ? 'b' : 'w',
    castling,
    ep: move.flags === 'double' ? (from + to) >> 1 : null,
    halfmove: piece === 'P' || piece === 'p' || move.captured ? 0 : state.halfmove + 1,
    fullmove: state.fullmove + (white ? 0 : 1),
  };
}

export function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = generateLegalMoves(state);
  if (depth === 1) return moves.length;
  let n = 0;
  for (let i = 0; i < moves.length; i++) n += perft(makeMove(state, moves[i]), depth - 1);
  return n;
}

