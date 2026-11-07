// Module worker for the computer opponent:
//   new Worker('js/ai/worker.js', { type: 'module' })
//
// Messages to the worker
//   { type: 'search', fen, level: 1..5, id, history?: string[] }   history = positionKeys of the game so far
//   { type: 'evaluate', fen, id }
//   { type: 'stop' }
// Replies
//   { type: 'bestmove', id, move: { from, to, promotion } | null, score }   score: centipawns, side to move
//   { type: 'evaluation', id, score }                                       score: centipawns, side to move
//
// NOTE on 'stop': the search runs synchronously, so the worker cannot receive a 'stop' message
// while it is searching (it is only handled between searches). To abort a running search the
// controller must call worker.terminate() and create a fresh Worker. Searches are time-limited
// (max. 3 s on level 5) anyway.

import { parseFEN } from '../engine/board.js';
import { findBestMove } from './search.js';
import { evaluate } from './evaluate.js';

self.onmessage = (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === 'search') {
      const state = parseFEN(msg.fen);
      const r = findBestMove(state, { level: msg.level, history: msg.history || [] });
      const move = r.move ? { from: r.move.from, to: r.move.to, promotion: r.move.promotion } : null;
      self.postMessage({ type: 'bestmove', id: msg.id, move, score: r.score });
    } else if (msg.type === 'evaluate') {
      self.postMessage({ type: 'evaluation', id: msg.id, score: evaluate(parseFEN(msg.fen)) });
    }
    // 'stop' is a no-op here, see the note above.
  } catch (err) {
    self.postMessage({ type: 'error', id: msg.id, message: String(err && err.message || err) });
  }
};
