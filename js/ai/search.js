// Alpha-beta search (negamax) with quiescence search and iterative deepening.
// No DOM, no dependencies: runs in Node (tests) and inside the worker.

import { parseFEN } from '../engine/board.js';
import { generatePseudoMoves, makeMove, isSquareAttacked } from '../engine/moves.js';
import { evaluate, evaluateForSide } from './evaluate.js';

export { evaluate, evaluateForSide };

export const MATE = 100000;
const INF = 1000000;
const MAX_PLY = 64;

/**
 * Per level: maximum depth, time limit (ms) and randomness.
 *  margin  - root moves within this many centipawns of the best one are candidates
 *  blunder - probability of playing an arbitrary legal move instead
 */
export const LEVELS = {
  1: { depth: 1, timeMs: 200, margin: 150, blunder: 0.1 },
  2: { depth: 2, timeMs: 400, margin: 80, blunder: 0.03 },
  3: { depth: 3, timeMs: 800, margin: 25, blunder: 0 },
  4: { depth: 4, timeMs: 1500, margin: 0, blunder: 0 },
  5: { depth: 6, timeMs: 3000, margin: 0, blunder: 0 },
};

// ---- position hashing for repetition detection (board + side to move) ----

let seed = 0x9e3779b9;
function rnd32() { // xorshift32, deterministic table
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed;
}
const PIECE_INDEX = { P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5, p: 6, n: 7, b: 8, r: 9, q: 10, k: 11 };
const ZOBRIST = new Int32Array(12 * 64 * 2);
for (let i = 0; i < ZOBRIST.length; i++) ZOBRIST[i] = rnd32() | 0;
const ZOBRIST_TURN = [rnd32() | 0, rnd32() | 0];

function hashState(state) {
  const b = state.board;
  let h = state.turn === 'w' ? ZOBRIST_TURN[0] : ZOBRIST_TURN[1];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p !== null) h ^= ZOBRIST[PIECE_INDEX[p] * 64 + i];
  }
  return h | 0;
}

// ---- helpers ----

const ABORT = { aborted: true };
const VALUE = {
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000,
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
};

function kingIndex(board, king) {
  for (let i = 0; i < 64; i++) if (board[i] === king) return i;
  return -1;
}

function inCheckNow(state) {
  const white = state.turn === 'w';
  const k = kingIndex(state.board, white ? 'K' : 'k');
  return k >= 0 && isSquareAttacked(state, k, white ? 'b' : 'w');
}

/** True if the side that just moved (opposite of next.turn) left its own king attacked. */
function leavesKingInCheck(next) {
  const mover = next.turn === 'w' ? 'b' : 'w';
  const k = kingIndex(next.board, mover === 'w' ? 'K' : 'k');
  return k >= 0 && isSquareAttacked(next, k, next.turn);
}

function moveScore(m) {
  let s = 0;
  // MVV-LVA: valuable victim first, cheap attacker first.
  if (m.captured) s = 10000 + VALUE[m.captured] * 10 - VALUE[m.piece] / 100;
  if (m.promotion) s += 9000 + VALUE[m.promotion];
  return s;
}

function sameMove(a, b) {
  return a && b && a.from === b.from && a.to === b.to && a.promotion === b.promotion;
}

function insufficientMaterial(board) {
  let minor = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === null || p === 'K' || p === 'k') continue;
    if (p === 'N' || p === 'n' || p === 'B' || p === 'b') { if (++minor > 1) return false; } else return false;
  }
  return true;
}

/**
 * Searches `state` and returns the chosen move.
 * @param {object} state
 * @param {{level?:number, timeLimitMs?:number, maxDepth?:number, history?:string[], shouldStop?:()=>boolean, random?:()=>number}} [options]
 *   history: positionKeys (see rules.positionKey) of the game so far; repetitions score 0.
 * @returns {{move: object|null, score: number, depth: number, nodes: number}}
 *   score is in centipawns from the point of view of the side to move.
 */
export function findBestMove(state, options = {}) {
  const level = Math.min(5, Math.max(1, options.level ?? 5));
  const cfg = LEVELS[level];
  const maxDepth = Math.min(MAX_PLY - 8, options.maxDepth ?? cfg.depth);
  const timeLimit = options.timeLimitMs ?? cfg.timeMs;
  const shouldStop = options.shouldStop ?? null;
  const random = options.random ?? Math.random;
  const history = options.history ?? [];

  const start = Date.now();
  const deadline = start + timeLimit;
  let nodes = 0;

  // Hashes of positions that occurred before (game history) and of the current search path.
  const seen = new Map(); // hash -> count (history)
  for (const key of history) {
    let h;
    try { h = hashState(parseFEN(key)); } catch { continue; }
    seen.set(h, (seen.get(h) ?? 0) + 1);
  }
  const path = new Int32Array(MAX_PLY + 4);
  let pathLen = 0;

  const killers = [];
  for (let i = 0; i < MAX_PLY + 2; i++) killers.push([null, null]);

  function checkTime() {
    if ((nodes & 2047) === 0) {
      if (Date.now() >= deadline || (shouldStop && shouldStop())) throw ABORT;
    }
  }

  function isRepetition(h) {
    // path[0] is the root position; the node itself sits at path[pathLen-1].
    for (let i = pathLen - 3; i >= 0; i -= 2) if (path[i] === h) return true;
    return seen.has(h);
  }

  function quiesce(st, alpha, beta, ply) {
    nodes++;
    checkTime();
    const inCheck = ply < MAX_PLY && inCheckNow(st);
    let best = -INF;
    if (!inCheck) {
      best = evaluate(st);
      if (best >= beta) return best;
      if (best > alpha) alpha = best;
    }
    if (ply >= MAX_PLY) return best === -INF ? evaluate(st) : best;
    const pseudo = generatePseudoMoves(st);
    const list = [];
    for (let i = 0; i < pseudo.length; i++) {
      const m = pseudo[i];
      if (inCheck || m.captured || m.promotion) list.push(m);
    }
    list.sort((a, b) => moveScore(b) - moveScore(a));
    let legal = 0;
    for (let i = 0; i < list.length; i++) {
      const next = makeMove(st, list[i]);
      if (leavesKingInCheck(next)) continue;
      legal++;
      const score = -quiesce(next, -beta, -alpha, ply + 1);
      if (score > best) {
        best = score;
        if (score > alpha) {
          alpha = score;
          if (alpha >= beta) break;
        }
      }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    return best;
  }

  function negamax(st, depth, alpha, beta, ply, h) {
    nodes++;
    checkTime();
    path[pathLen++] = h;
    try {
      if (st.halfmove >= 100 || isRepetition(h) || insufficientMaterial(st.board)) {
        // A real draw by the 50 move rule still allows a mate on the 100th half-move; ignore that edge case.
        return 0;
      }
      const inCheck = inCheckNow(st);
      if (inCheck && ply < MAX_PLY - 8) depth++;
      if (depth <= 0) return quiesce(st, alpha, beta, ply);

      const pseudo = generatePseudoMoves(st);
      const k = killers[ply];
      for (let i = 0; i < pseudo.length; i++) {
        const m = pseudo[i];
        let s = moveScore(m);
        if (s === 0) s = sameMove(m, k[0]) ? 5000 : sameMove(m, k[1]) ? 4000 : 0;
        m.order = s;
      }
      pseudo.sort((a, b) => b.order - a.order);

      let best = -INF;
      let legal = 0;
      for (let i = 0; i < pseudo.length; i++) {
        const m = pseudo[i];
        const next = makeMove(st, m);
        if (leavesKingInCheck(next)) continue;
        legal++;
        const score = -negamax(next, depth - 1, -beta, -alpha, ply + 1, hashState(next));
        if (score > best) {
          best = score;
          if (score > alpha) {
            alpha = score;
            if (alpha >= beta) {
              if (!m.captured && !m.promotion && !sameMove(m, k[0])) { k[1] = k[0]; k[0] = m; }
              break;
            }
          }
        }
      }
      if (legal === 0) return inCheck ? -MATE + ply : 0;
      return best;
    } finally {
      pathLen--;
    }
  }

  // ---- root ----
  const rootHash = hashState(state);
  const rootMoves = [];
  {
    const pseudo = generatePseudoMoves(state);
    for (const m of pseudo) {
      const next = makeMove(state, m);
      if (!leavesKingInCheck(next)) rootMoves.push({ move: m, next, hash: hashState(next), score: -INF });
    }
  }
  if (rootMoves.length === 0) return { move: null, score: inCheckNow(state) ? -MATE : 0, depth: 0, nodes: 0 };
  rootMoves.sort((a, b) => moveScore(b.move) - moveScore(a.move));

  let result = { move: rootMoves[0].move, score: 0, depth: 0, nodes: 0 };
  let finalScores = null; // [{move, score}] of the last complete iteration (exact for moves within margin)

  if (rootMoves.length === 1) {
    return { move: rootMoves[0].move, score: evaluate(state), depth: 0, nodes: 0 };
  }

  const margin = cfg.margin;
  try {
    for (let depth = 1; depth <= maxDepth; depth++) {
      path.fill(0);
      pathLen = 0;
      path[pathLen++] = rootHash;
      let alpha = -INF;
      let bestIdx = -1;
      let bestScore = -INF;
      let completed = 0;
      const scores = [];
      try {
        for (let i = 0; i < rootMoves.length; i++) {
          const rm = rootMoves[i];
          // With randomness we need exact scores for every move within `margin` of the best.
          const lo = margin > 0 ? bestScore - margin - 1 : alpha;
          const a = margin > 0 ? Math.max(lo, -INF) : alpha;
          const score = -negamax(rm.next, depth - 1, -INF, -a, 1, rm.hash);
          rm.score = score;
          scores.push({ move: rm.move, score });
          completed++;
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
            if (margin === 0) alpha = score;
          }
        }
      } catch (e) {
        if (e !== ABORT) throw e;
        // Partial iteration: the previous best move was searched first, so a better move found
        // now is at least as good. Use it if it is better than the first (previous best).
        if (completed > 0 && depth > 1 && bestIdx > 0) {
          result = { move: rootMoves[bestIdx].move, score: bestScore, depth: depth - 1, nodes };
        }
        throw ABORT;
      }
      result = { move: rootMoves[bestIdx].move, score: bestScore, depth, nodes };
      finalScores = scores;
      // Order for next iteration: best first, then by score.
      rootMoves.sort((a, b) => b.score - a.score);
      if (Math.abs(bestScore) > MATE - MAX_PLY && margin === 0) break; // forced mate found
      if (Date.now() >= deadline) break;
    }
  } catch (e) {
    if (e !== ABORT) throw e;
  }
  result.nodes = nodes;

  // Weaker levels: pick randomly among near-best moves, sometimes any legal move.
  if (margin > 0 || cfg.blunder > 0) {
    if (cfg.blunder > 0 && random() < cfg.blunder) {
      const pick = rootMoves[Math.floor(random() * rootMoves.length)];
      return { ...result, move: pick.move };
    }
    if (finalScores && margin > 0 && !(Math.abs(result.score) > MATE - MAX_PLY)) {
      const top = result.score;
      const cands = finalScores.filter((c) => c.score >= top - margin);
      const pick = cands[Math.floor(random() * cands.length)];
      return { ...result, move: pick.move, score: pick.score };
    }
  }
  return result;
}
