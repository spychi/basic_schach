// Static evaluation in centipawns. No DOM, no dependencies.
// Board index 0 = a8 .. 63 = h1, so the tables below read like a board seen from
// White's side (first row = rank 8). Black uses the mirrored index (i ^ 56).

export const PIECE_VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

const PST = {
  P: [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  N: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  B: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  R: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0,
  ],
  Q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  K_MG: [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20,
  ],
  K_EG: [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50,
  ],
};

const BISHOP_PAIR = 30;
// Non-pawn material (both sides) at which the endgame king table is fully used / not used.
const PHASE_FULL = 5200;

/** Evaluation from White's point of view, in centipawns. */
export function evaluateWhite(state) {
  const board = state.board;
  let mg = 0; // material + piece tables without kings
  let kmgW = 0, kegW = 0, kmgB = 0, kegB = 0;
  let npm = 0;
  let wBishops = 0, bBishops = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === null) continue;
    switch (p) {
      case 'P': mg += 100 + PST.P[i]; break;
      case 'p': mg -= 100 + PST.P[i ^ 56]; break;
      case 'N': mg += 320 + PST.N[i]; npm += 320; break;
      case 'n': mg -= 320 + PST.N[i ^ 56]; npm += 320; break;
      case 'B': mg += 330 + PST.B[i]; npm += 330; wBishops++; break;
      case 'b': mg -= 330 + PST.B[i ^ 56]; npm += 330; bBishops++; break;
      case 'R': mg += 500 + PST.R[i]; npm += 500; break;
      case 'r': mg -= 500 + PST.R[i ^ 56]; npm += 500; break;
      case 'Q': mg += 900 + PST.Q[i]; npm += 900; break;
      case 'q': mg -= 900 + PST.Q[i ^ 56]; npm += 900; break;
      case 'K': kmgW = PST.K_MG[i]; kegW = PST.K_EG[i]; break;
      case 'k': kmgB = PST.K_MG[i ^ 56]; kegB = PST.K_EG[i ^ 56]; break;
    }
  }
  if (wBishops >= 2) mg += BISHOP_PAIR;
  if (bBishops >= 2) mg -= BISHOP_PAIR;
  const phase = Math.min(npm, PHASE_FULL); // 0 = pure endgame, PHASE_FULL = middlegame
  const king = ((kmgW - kmgB) * phase + (kegW - kegB) * (PHASE_FULL - phase)) / PHASE_FULL;
  return Math.round(mg + king);
}

/** Evaluation in centipawns from the point of view of the side to move (for negamax). */
export function evaluate(state) {
  const w = evaluateWhite(state);
  return state.turn === 'w' ? w : -w;
}

/** Evaluation in centipawns from the point of view of `color` ('w' | 'b'). */
export function evaluateForSide(state, color) {
  const w = evaluateWhite(state);
  return color === 'w' ? w : -w;
}
