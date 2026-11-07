import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, parseFEN, toFEN, squareName, squareIndex, colorOf, cloneState } from '../js/engine/board.js';

const FENS = [
  START_FEN,
  'r1bqk2r/ppp2ppp/2n2n2/3p4/2BPP3/5N2/PP1N1PPP/R2QK2R w KQkq d6 0 9',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
];

test('FEN round trip', () => {
  for (const fen of FENS) assert.equal(toFEN(parseFEN(fen)), fen);
});

test('start position contents', () => {
  const s = parseFEN(START_FEN);
  assert.equal(s.board.length, 64);
  assert.equal(s.board[0], 'r');
  assert.equal(s.board[60], 'K');
  assert.equal(s.turn, 'w');
  assert.deepEqual(s.castling, { K: true, Q: true, k: true, q: true });
  assert.equal(s.ep, null);
});

test('square helpers', () => {
  assert.equal(squareName(0), 'a8');
  assert.equal(squareName(63), 'h1');
  assert.equal(squareIndex('e4'), 36);
  assert.equal(squareIndex('a1'), 56);
  for (let i = 0; i < 64; i++) assert.equal(squareIndex(squareName(i)), i);
  assert.equal(colorOf('N'), 'w');
  assert.equal(colorOf('q'), 'b');
  assert.equal(colorOf(null), null);
});

test('cloneState is deep enough', () => {
  const s = parseFEN(START_FEN);
  const c = cloneState(s);
  c.board[0] = null;
  c.castling.K = false;
  assert.equal(s.board[0], 'r');
  assert.equal(s.castling.K, true);
});

test('invalid FEN throws', () => {
  for (const bad of ['', 'foo', '8/8/8/8/8/8/8/8 w - - 0 1', 'rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR x KQkq - 0 1']) {
    assert.throws(() => parseFEN(bad));
  }
});
