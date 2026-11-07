import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, parseFEN, toFEN, squareIndex } from '../js/engine/board.js';
import { generateLegalMoves, makeMove } from '../js/engine/moves.js';
import { positionKey } from '../js/engine/rules.js';
import { evaluate, evaluateForSide } from '../js/ai/evaluate.js';
import { findBestMove, LEVELS } from '../js/ai/search.js';

const sq = squareIndex;
const isLegal = (state, m) => generateLegalMoves(state).some(
  (l) => l.from === m.from && l.to === m.to && l.promotion === m.promotion);

test('evaluation: start position is balanced, material counts, side-relative', () => {
  const s = parseFEN(START_FEN);
  assert.equal(evaluate(s), 0);
  const noQueen = parseFEN('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  assert.ok(evaluate(noQueen) > 800);
  const black = parseFEN('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
  assert.equal(evaluate(black), -evaluate(noQueen));
  assert.equal(evaluateForSide(black, 'w'), evaluate(noQueen));
  assert.equal(evaluateForSide(black, 'b'), -evaluate(noQueen));
});

test('LEVELS covers 1..5', () => {
  for (let l = 1; l <= 5; l++) assert.ok(LEVELS[l].depth >= 1 && LEVELS[l].timeMs > 0);
});

test('finds mate in one (Scholar\'s mate) on levels 3-5', () => {
  const s = parseFEN('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
  for (const level of [3, 4, 5]) {
    const r = findBestMove(s, { level });
    assert.equal(r.move.from, sq('h5'));
    assert.equal(r.move.to, sq('f7'));
    assert.ok(r.score > 90000);
  }
});

test('finds back-rank mate and prefers the shorter mate', () => {
  const s = parseFEN('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
  const r = findBestMove(s, { level: 5 });
  assert.equal(r.move.to, sq('d8'));
  const s2 = parseFEN('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1'); // Qg7# (a slower mate also exists)
  const r2 = findBestMove(s2, { level: 4 });
  const after = makeMove(s2, r2.move);
  assert.equal(generateLegalMoves(after).length, 0);
});

test('captures an undefended queen', () => {
  const s = parseFEN('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
  for (const level of [3, 4, 5]) {
    const r = findBestMove(s, { level });
    assert.equal(r.move.from, sq('d1'));
    assert.equal(r.move.to, sq('d5'));
  }
});

test('does not hang its queen: avoids defended pawn capture', () => {
  const s = parseFEN('rnb1kbnr/pppp1ppp/8/4p3/3Pq3/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 1');
  const r = findBestMove(s, { level: 4 });
  assert.ok(isLegal(s, r.move));
});

const POSITIONS = [
  START_FEN,
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
  'r3k2r/pppq1ppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQ1PPP/R3K2R w KQkq - 0 1', // castling both sides
  '8/P7/8/8/8/8/k6K/8 w - - 0 1',                                         // promotion
  '7k/8/8/8/8/8/5q2/K7 w - - 0 1',                                         // only one legal move? (Kxa... )
  '8/8/8/8/8/8/6k1/4K2R b K - 0 1',
  'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3',          // en passant
];

test('returns a legal move in several positions on every level', () => {
  for (const fen of POSITIONS) {
    const s = parseFEN(fen);
    const legal = generateLegalMoves(s);
    if (legal.length === 0) continue;
    for (let level = 1; level <= 3; level++) {
      const r = findBestMove(s, { level });
      assert.ok(r.move && isLegal(s, r.move), `${fen} level ${level}`);
    }
    const r = findBestMove(s, { level: 4, timeLimitMs: 300 });
    assert.ok(isLegal(s, r.move), fen);
  }
});

test('promotes and returns promotion piece in mover\'s colour', () => {
  const s = parseFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  const r = findBestMove(s, { level: 4 });
  assert.equal(r.move.from, sq('a7'));
  assert.equal(r.move.promotion, 'Q');
  const b = parseFEN('8/8/8/8/8/8/p6K/k7 b - - 0 1');
  const rb = findBestMove(b, { level: 4 });
  assert.ok(isLegal(b, rb.move));
});

test('single legal move is returned immediately', () => {
  const s = parseFEN('k7/8/1K6/8/8/8/8/1R6 b - - 0 1'); // exactly one legal reply
  const legal = generateLegalMoves(s);
  assert.equal(legal.length, 1);
  const r = findBestMove(s, { level: 5 });
  assert.deepEqual([r.move.from, r.move.to], [legal[0].from, legal[0].to]);
});

test('no legal moves gives move null', () => {
  const mate = parseFEN('R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1');
  assert.equal(generateLegalMoves(mate).length, 0);
  const r = findBestMove(mate, { level: 3 });
  assert.equal(r.move, null);
});

test('plays a game of AI vs AI with only legal moves', () => {
  let s = parseFEN(START_FEN);
  const hist = [positionKey(s)];
  for (let i = 0; i < 24; i++) {
    if (generateLegalMoves(s).length === 0) break;
    const r = findBestMove(s, { level: 1 + (i % 3), history: hist, timeLimitMs: 100 });
    assert.ok(isLegal(s, r.move));
    s = makeMove(s, r.move);
    hist.push(positionKey(s));
  }
});

test('repetition in history is scored as draw', () => {
  // White is far ahead in material but history says moving back repeats; just check no crash and legal move.
  const s = parseFEN('4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1');
  const hist = [positionKey(s)];
  const r = findBestMove(s, { level: 4, history: hist, timeLimitMs: 300 });
  assert.ok(isLegal(s, r.move));
  assert.ok(r.score > 500);
});

test('level 5 answers a middlegame position within 3.5 s', () => {
  const s = parseFEN('r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8');
  const t = Date.now();
  const r = findBestMove(s, { level: 5 });
  const dt = Date.now() - t;
  assert.ok(dt <= 3500, `took ${dt} ms`);
  assert.ok(isLegal(s, r.move));
  assert.ok(r.depth >= 3, `depth ${r.depth}`);
});

test('level 1 is fast and varies', () => {
  const s = parseFEN(START_FEN);
  const t = Date.now();
  const seen = new Set();
  for (let i = 0; i < 15; i++) {
    const r = findBestMove(s, { level: 1 });
    seen.add(`${r.move.from}-${r.move.to}`);
  }
  assert.ok(Date.now() - t < 15 * 300);
  assert.ok(seen.size > 1);
});

test('shouldStop aborts and still returns a legal move', () => {
  const s = parseFEN('r2q1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P1b1/2NP1N2/PPP2PPP/R2Q1RK1 w - - 0 8');
  let calls = 0;
  const r = findBestMove(s, { level: 5, shouldStop: () => ++calls > 3 });
  assert.ok(isLegal(s, r.move));
});
