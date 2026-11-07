import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, parseFEN, toFEN, squareIndex } from '../js/engine/board.js';
import { generateLegalMoves, legalMovesFrom, makeMove, isSquareAttacked, perft } from '../js/engine/moves.js';

const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const ENDGAME = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';

function find(state, from, to, promotion = null) {
  return generateLegalMoves(state).find((m) => m.from === squareIndex(from) && m.to === squareIndex(to) && m.promotion === promotion);
}
const play = (fen, from, to, promotion) => {
  const s = parseFEN(fen);
  const m = find(s, from, to, promotion);
  assert.ok(m, `${from}${to} should be legal`);
  return toFEN(makeMove(s, m));
};

test('perft start position', () => {
  const s = parseFEN(START_FEN);
  assert.equal(perft(s, 1), 20);
  assert.equal(perft(s, 2), 400);
  assert.equal(perft(s, 3), 8902);
});

test('perft start position depth 4 (under 3 s)', () => {
  const s = parseFEN(START_FEN);
  const t = Date.now();
  assert.equal(perft(s, 4), 197281);
  assert.ok(Date.now() - t < 3000, `took ${Date.now() - t} ms`);
});

test('perft kiwipete', () => {
  const s = parseFEN(KIWIPETE);
  assert.equal(perft(s, 1), 48);
  assert.equal(perft(s, 2), 2039);
  assert.equal(perft(s, 3), 97862);
});

test('perft endgame position', () => {
  const s = parseFEN(ENDGAME);
  assert.equal(perft(s, 1), 14);
  assert.equal(perft(s, 2), 191);
  assert.equal(perft(s, 3), 2812);
  assert.equal(perft(s, 4), 43238);
});

test('makeMove does not mutate the original', () => {
  const s = parseFEN(START_FEN);
  const before = toFEN(s);
  makeMove(s, find(s, 'e2', 'e4'));
  assert.equal(toFEN(s), before);
});

test('double push sets ep square, counters update', () => {
  assert.equal(play(START_FEN, 'e2', 'e4'), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  assert.equal(play(START_FEN, 'g1', 'f3'), 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1');
});

test('castling both sides and rights', () => {
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  assert.equal(play(fen, 'e1', 'g1'), 'r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1');
  assert.equal(play(fen, 'e1', 'c1'), 'r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1');
  assert.equal(play(fen, 'h1', 'h2'), 'r3k2r/8/8/8/8/8/7R/R3K3 b Qkq - 1 1');
});

test('castling blocked by check, attacked path, or occupied squares', () => {
  const hasCastle = (fen, flag) => generateLegalMoves(parseFEN(fen)).some((m) => m.flags === flag);
  assert.equal(hasCastle('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'castle-k'), true);
  assert.equal(hasCastle('4r2k/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'castle-k'), false); // in check
  assert.equal(hasCastle('5r1k/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'castle-k'), false); // f1 attacked
  assert.equal(hasCastle('k5r1/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'castle-k'), false); // g1 attacked
  assert.equal(hasCastle('kr6/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'castle-q'), true); // b1 attacked is fine
  assert.equal(hasCastle('k2r4/8/8/8/8/8/8/R3K2R w KQ - 0 1', 'castle-q'), false);
  assert.equal(hasCastle('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1', 'castle-q'), false);
  assert.equal(hasCastle('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1', 'castle-k'), false);
});

test('capturing a rook removes the castling right', () => {
  assert.equal(play('r3k2r/8/8/8/8/8/6B1/R3K2R w KQkq - 0 1', 'g2', 'a8'), 'B3k2r/8/8/8/8/8/8/R3K2R b KQk - 0 1');
});

test('en passant capture', () => {
  const s = parseFEN('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3');
  const m = find(s, 'd4', 'e3');
  assert.equal(m.flags, 'ep');
  assert.equal(m.captured, 'P');
  assert.equal(toFEN(makeMove(s, m)), 'rnbqkbnr/ppp1pppp/8/8/8/4p3/PPPP1PPP/RNBQKBNR w KQkq - 0 4');
});

test('en passant is illegal when it exposes the king on the rank', () => {
  const s = parseFEN('8/8/8/KPp4r/8/8/8/7k w - c6 0 1');
  assert.equal(generateLegalMoves(s).some((m) => m.flags === 'ep'), false);
});

test('promotion produces four moves in the mover colour', () => {
  const w = legalMovesFrom(parseFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1'), squareIndex('a7'));
  assert.deepEqual(w.map((m) => m.promotion).sort(), ['B', 'N', 'Q', 'R']);
  const b = legalMovesFrom(parseFEN('7k/8/8/8/8/8/p7/4K3 b - - 0 1'), squareIndex('a2'));
  assert.deepEqual(b.map((m) => m.promotion).sort(), ['b', 'n', 'q', 'r']);
  const s = parseFEN('8/P6k/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(toFEN(makeMove(s, find(s, 'a7', 'a8', 'Q'))), 'Q7/7k/8/8/8/8/8/K7 b - - 0 1');
});

test('pinned pieces and check evasion', () => {
  const s = parseFEN('4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1');
  assert.equal(legalMovesFrom(s, squareIndex('e2')).length, 0);
  const c = parseFEN('4r2k/8/8/8/8/8/8/4K3 w - - 0 1');
  assert.ok(generateLegalMoves(c).every((m) => m.piece === 'K'));
});

test('isSquareAttacked', () => {
  const s = parseFEN(START_FEN);
  assert.equal(isSquareAttacked(s, squareIndex('e3'), 'w'), true);
  assert.equal(isSquareAttacked(s, squareIndex('e4'), 'w'), false);
  assert.equal(isSquareAttacked(s, squareIndex('e6'), 'b'), true);
});
