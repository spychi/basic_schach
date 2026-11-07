import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFEN, squareIndex as sq } from '../js/engine/board.js';
import { generateLegalMoves } from '../js/engine/moves.js';
import { toSAN, moveToUci, uciToMove } from '../js/engine/notation.js';
import { openingName } from '../js/engine/openings.js';

function san(fen, from, to, promo) {
  const s = parseFEN(fen);
  const m = generateLegalMoves(s).find((x) => x.from === sq(from) && x.to === sq(to) &&
    (!promo || x.promotion === promo));
  assert.ok(m, `move ${from}${to} legal`);
  return toSAN(s, m);
}

test('castling', () => {
  const f = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  assert.equal(san(f, 'e1', 'g1'), 'O-O');
  assert.equal(san(f, 'e1', 'c1'), 'O-O-O');
});

test('promotion with check and capture', () => {
  assert.equal(san('7k/4P3/8/8/8/8/8/K7 w - - 0 1', 'e7', 'e8', 'Q'), 'e8=D+');
  assert.equal(san('3r3k/4P3/8/8/8/8/8/K7 w - - 0 1', 'e7', 'd8', 'N'), 'exd8=S');
  assert.equal(san('8/8/8/8/8/8/4p3/K6k b - - 0 1', 'e2', 'e1', 'q'), 'e1=D+');
});

test('disambiguation by file, rank and both', () => {
  assert.equal(san('4k3/8/8/8/8/5N2/8/1N5K w - - 0 1', 'b1', 'd2'), 'Sbd2');
  assert.equal(san('4k3/8/8/8/8/8/4K3/R6R w - - 0 1', 'a1', 'd1'), 'Tad1');
  assert.equal(san('4k3/R7/8/8/8/8/8/R3K3 w - - 0 1', 'a1', 'a4'), 'T1a4');
});

test('three-way disambiguation uses full square', () => {
  // queens a1, a5, e5 -> target c3: a1 and e5 share nothing, a5 shares file with a1, rank with e5
  const f = '4k3/8/8/Q3Q3/8/8/8/Q3K3 w - - 0 1';
  const s = parseFEN(f);
  const m = generateLegalMoves(s).find((x) => x.from === sq('a5') && x.to === sq('c3'));
  assert.equal(toSAN(s, m), 'Da5c3+');
});

test('checkmate and check suffix', () => {
  assert.equal(san('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'a1', 'a8'), 'Ta8#');
  assert.equal(san('7k/8/8/8/8/8/8/R3K3 w - - 0 1', 'a1', 'a8'), 'Ta8+');
});

test('en passant and pawn capture', () => {
  assert.equal(san('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5', 'd6'), 'exd6');
});

test('UCI round trip', () => {
  const s = parseFEN('7k/4P3/8/8/8/8/8/K7 w - - 0 1');
  const m = uciToMove(s, 'e7e8q');
  assert.ok(m);
  assert.equal(m.promotion, 'Q');
  assert.equal(moveToUci(m), 'e7e8q');
  assert.equal(uciToMove(s, 'e7e8n').promotion, 'N');
  assert.equal(uciToMove(s, 'e7e7'), null);
  assert.equal(uciToMove(s, 'zz'), null);
});

test('opening names: longest prefix, ignoring check marks', () => {
  assert.equal(openingName(['e4', 'c5']), 'Sizilianische Verteidigung');
  assert.equal(openingName(['d4', 'd5', 'c4']), 'Damengambit');
  assert.equal(openingName(['d4', 'd5', 'c4', 'c6', 'Sf3']), 'Slawische Verteidigung');
  assert.equal(openingName(['e4', 'e5', 'Sf3', 'Sc6', 'Lc4', 'Lc5']), 'Italienische Partie');
  assert.equal(openingName(['a3']), null);
  assert.equal(openingName(['e4', 'e6+']), 'Französische Verteidigung');
});
