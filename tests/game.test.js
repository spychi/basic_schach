import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/engine/game.js';
import { squareIndex as sq } from '../js/engine/board.js';

const mv = (g, s) => g.play({ from: sq(s.slice(0, 2)), to: sq(s.slice(2, 4)), promotion: s[4] });
const playAll = (g, list) => list.forEach((s) => assert.ok(mv(g, s), s));

const ITALIAN = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'c2c3', 'g8f6', 'd2d4', 'e5d4',
  'c3d4', 'c5b4', 'c1d2', 'b4d2', 'b1d2', 'd7d5'];

test('example game', () => {
  const g = new Game();
  playAll(g, ITALIAN);
  assert.equal(g.history.map((h) => h.san).join(' '),
    'e4 e5 Sf3 Sc6 Lc4 Lc5 c3 Sf6 d4 exd4 cxd4 Lb4+ Ld2 Lxd2+ Sbxd2 d5');
  assert.equal(g.history.at(-1).fenAfter, 'r1bqk2r/ppp2ppp/2n2n2/3p4/2BPP3/5N2/PP1N1PPP/R2QK2R w KQkq d6 0 9');
  assert.equal(g.openingName(), 'Italienische Partie');
  assert.equal(g.turn, 'w');
  assert.equal(g.result, '*');
});

test('illegal move and events', () => {
  const g = new Game();
  let n = 0;
  g.addEventListener('change', () => n++);
  assert.equal(mv(g, 'e2e5'), null);
  assert.equal(n, 0);
  mv(g, 'e2e4');
  g.undo();
  assert.equal(n, 2);
  assert.equal(g.undo(), null);
});

test('undo restores state and repetition keys', () => {
  const g = new Game();
  playAll(g, ['e2e4', 'e7e5']);
  const e = g.undo();
  assert.equal(e.san, 'e5');
  assert.equal(g.turn, 'b');
  assert.equal(g.history.length, 1);
  assert.equal(g.lastMove.to, sq('e4'));
});

test('fool\'s mate', () => {
  const g = new Game();
  playAll(g, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  assert.equal(g.history.at(-1).san, 'Dh4#');
  assert.deepEqual(g.status(), { type: 'checkmate', winner: 'b' });
  assert.equal(g.result, '0-1');
  assert.equal(mv(g, 'a2a3'), null);
  assert.equal(g.undo(), null);
});

test('promotion handling', () => {
  const g = new Game('7k/4P3/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(g.needsPromotion(sq('e7'), sq('e8')), true);
  assert.equal(g.needsPromotion(sq('a1'), sq('a2')), false);
  const e = g.play({ from: sq('e7'), to: sq('e8'), promotion: 'n' });
  assert.equal(e.move.promotion, 'N');
  assert.equal(e.san, 'e8=S');
  const h = new Game('7k/4P3/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(h.play({ from: sq('e7'), to: sq('e8') }).san, 'e8=D+');
  const k = new Game('7k/4P3/8/8/8/8/8/K7 w - - 0 1');
  assert.equal(k.play({ from: sq('e7'), to: sq('e8'), promotion: 'Q' }).move.promotion, 'Q');
});

test('stateAt and captured', () => {
  const g = new Game();
  playAll(g, ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5']);
  assert.equal(g.stateAt(0).board[sq('e2')], 'P');
  assert.equal(g.stateAt(1).board[sq('e4')], 'P');
  assert.equal(g.stateAt(99), g.state);
  assert.deepEqual(g.captured(), { w: ['p'], b: ['P'] });
  playAll(g, ['c3e4', 'a5e5', 'd2d3', 'e5e4']);
  assert.deepEqual(g.captured(), { w: ['p'], b: ['N', 'P'] });
});

test('JSON round trip', () => {
  const g = new Game();
  playAll(g, ITALIAN);
  const data = JSON.parse(JSON.stringify(g.toJSON()));
  assert.equal(data.result, null);
  assert.equal(data.moves[0], 'e2e4');
  const h = Game.fromJSON(data);
  assert.equal(h.history.map((x) => x.san).join(' '), g.history.map((x) => x.san).join(' '));
  assert.equal(h.history.at(-1).fenAfter, g.history.at(-1).fenAfter);
  g.resign('b');
  const r = Game.fromJSON(JSON.parse(JSON.stringify(g.toJSON())));
  assert.deepEqual(r.status(), { type: 'resigned', winner: 'w' });
});

test('threefold repetition', () => {
  const g = new Game();
  playAll(g, ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1']);
  assert.equal(g.status().type, 'playing');
  mv(g, 'f6g8');
  assert.deepEqual(g.status(), { type: 'draw', reason: 'threefold' });
  assert.equal(g.result, '1/2-1/2');
  assert.equal(mv(g, 'a2a3'), null);
});

test('resign, agreed draw, undo lock', () => {
  const g = new Game();
  mv(g, 'e2e4');
  g.resign('w');
  assert.deepEqual(g.status(), { type: 'resigned', winner: 'b' });
  assert.equal(g.result, '0-1');
  assert.equal(mv(g, 'e7e5'), null);
  assert.equal(g.undo(), null);
  assert.equal(g.history.length, 1);
  const d = new Game();
  d.agreeDraw();
  assert.deepEqual(d.status(), { type: 'agreed-draw' });
  assert.equal(d.result, '1/2-1/2');
});

test('timeout and insufficient material special case', () => {
  const g = new Game();
  g.timeout('w');
  assert.deepEqual(g.status(), { type: 'timeout', winner: 'b' });
  assert.equal(g.result, '0-1');
  // black has king + knight only: white flagging -> draw
  const a = new Game('4k3/8/8/8/8/8/PPPP4/n3K3 w - - 0 1');
  a.timeout('b');
  assert.deepEqual(a.status(), { type: 'timeout', winner: 'w' });
  const b = new Game('4k1n1/8/8/8/8/8/PPPP4/4K3 w - - 0 1');
  b.timeout('w');
  assert.deepEqual(b.status(), { type: 'draw', reason: 'timeout-insufficient' });
  const c = new Game('4k3/8/8/8/8/8/PPPP4/4K3 w - - 0 1');
  c.timeout('b');
  assert.deepEqual(c.status(), { type: 'timeout', winner: 'w' });
  const d = new Game('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  d.timeout('b');
  assert.equal(d.status().type, 'draw');
});
