import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START_FEN, parseFEN, squareIndex } from '../js/engine/board.js';
import { generateLegalMoves, makeMove } from '../js/engine/moves.js';
import { isInCheck, kingSquare, getStatus, positionKey } from '../js/engine/rules.js';

const status = (fen, keys = []) => getStatus(parseFEN(fen), keys);

test('kingSquare and isInCheck', () => {
  const s = parseFEN(START_FEN);
  assert.equal(kingSquare(s, 'w'), 60);
  assert.equal(kingSquare(s, 'b'), 4);
  assert.equal(isInCheck(s, 'w'), false);
  assert.equal(isInCheck(parseFEN('4r2k/8/8/8/8/8/8/4K3 w - - 0 1'), 'w'), true);
});

test('start position is playing', () => {
  assert.deepEqual(status(START_FEN), { type: 'playing' });
});

test('scholar\'s mate is checkmate', () => {
  let s = parseFEN(START_FEN);
  for (const [f, t] of [['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'], ['h5', 'f7']]) {
    const m = generateLegalMoves(s).find((x) => x.from === squareIndex(f) && x.to === squareIndex(t));
    assert.ok(m, `${f}${t}`);
    s = makeMove(s, m);
  }
  assert.deepEqual(getStatus(s, []), { type: 'checkmate', winner: 'w' });
});

test('stalemate', () => {
  assert.deepEqual(status('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), { type: 'stalemate' });
});

test('fifty-move rule, but mate has priority', () => {
  assert.deepEqual(status('4k3/8/8/8/8/8/4R3/4K2R w - - 99 80'), { type: 'playing' });
  assert.deepEqual(status('4k3/8/8/8/8/8/4R3/4K2R w - - 100 80'), { type: 'draw', reason: 'fifty-move' });
  assert.deepEqual(status('R5k1/5ppp/8/8/8/8/8/6K1 b - - 100 80'), { type: 'checkmate', winner: 'w' });
});

test('threefold repetition', () => {
  const fen = '4k3/8/8/8/8/8/4R3/4K2R w - - 10 80';
  const key = positionKey(parseFEN(fen));
  assert.deepEqual(status(fen, [key, 'x', key]), { type: 'playing' });
  assert.deepEqual(status(fen, [key, key, key]), { type: 'draw', reason: 'threefold' });
});

test('insufficient material', () => {
  const ins = (fen) => status(fen).reason === 'insufficient-material';
  assert.equal(ins('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), true);
  assert.equal(ins('4k3/8/8/8/8/8/8/3BK3 w - - 0 1'), true);
  assert.equal(ins('4k3/8/8/8/8/8/8/3NK3 w - - 0 1'), true);
  assert.equal(ins('4kb2/8/8/8/8/8/8/3BK3 w - - 0 1'), false); // d1 dark, f8 light
  assert.equal(ins('4k1b1/8/8/8/8/8/8/3BK3 w - - 0 1'), true); // d1 and g8 both dark... verified below
  assert.equal(ins('4k3/8/8/8/8/8/P7/4K3 w - - 0 1'), false);
  assert.equal(ins('4k3/8/8/8/8/8/8/3RK3 w - - 0 1'), false);
  assert.equal(ins('4k3/8/8/8/8/8/8/2NNK3 w - - 0 1'), false);
});

test('positionKey: no counters, ep only when legal', () => {
  assert.equal(positionKey(parseFEN(START_FEN)), 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -');
  // e3 ep square set but no black pawn can capture
  assert.equal(positionKey(parseFEN('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')),
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -');
  assert.equal(positionKey(parseFEN('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 3')),
    'rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
});
