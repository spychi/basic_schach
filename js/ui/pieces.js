// SVG chess pieces (viewBox 0 0 100 100). Colours come from CSS tokens via inline style.
// White: fill --paper, stroke --ink. Black: fill --ink, stroke --paper.

const NAMES = {
  K: 'König', Q: 'Dame', R: 'Turm', B: 'Läufer', N: 'Springer', P: 'Bauer',
};

/** 'N' -> 'Springer Weiß', 'n' -> 'Springer Schwarz' */
export function pieceName(piece) {
  const base = NAMES[piece.toUpperCase()];
  if (!base) throw new Error(`Invalid piece: ${piece}`);
  return `${base} ${piece === piece.toUpperCase() ? 'Weiß' : 'Schwarz'}`;
}

/**
 * @param {string} piece 'P','N','B','R','Q','K' (white) or lowercase (black)
 * @param {{decorative?: boolean}} [options] decorative: aria-hidden instead of role="img"
 * @returns {string} SVG markup
 */
export function pieceSVG(piece, { decorative = false } = {}) {
  const type = piece.toUpperCase();
  if (!NAMES[type]) throw new Error(`Invalid piece: ${piece}`);
  const white = piece === type;
  const fill = white ? 'var(--paper)' : 'var(--ink)';
  const line = white ? 'var(--ink)' : 'var(--paper)';
  const main = `fill:${fill};stroke:${line};stroke-width:3.5;stroke-linejoin:miter`;
  const accent = `fill:${line};stroke:none`;

  let shapes;
  switch (type) {
    case 'K':
      shapes = `<polygon style="${main}" points="44,10 56,10 56,20 66,20 66,32 56,32 56,46 72,46 72,86 28,86 28,46 44,46 44,32 34,32 34,20 44,20"/>`;
      break;
    case 'Q':
      shapes = `<circle style="${main}" cx="50" cy="59" r="27"/>`
        + `<circle style="${main}" cx="50" cy="20" r="9"/>`
        + `<circle style="${accent}" cx="50" cy="59" r="8"/>`;
      break;
    case 'R':
      shapes = `<rect style="${main}" x="26" y="30" width="48" height="56"/>`
        + `<rect style="${accent}" x="26" y="30" width="48" height="12"/>`;
      break;
    case 'B':
      shapes = `<polygon style="${main}" points="50,12 78,86 22,86"/>`
        + `<line style="fill:none;stroke:${line};stroke-width:4" x1="42" y1="50" x2="60" y2="68"/>`;
      break;
    case 'N':
      shapes = `<polygon style="${main}" points="26,86 26,14 76,14 76,42 52,42 52,86"/>`
        + `<circle style="${accent}" cx="40" cy="28" r="5"/>`;
      break;
    default: // 'P'
      shapes = `<circle style="${main}" cx="50" cy="44" r="16"/>`
        + `<rect style="${main}" x="32" y="64" width="36" height="22"/>`;
  }

  const a11y = decorative
    ? 'aria-hidden="true" focusable="false"'
    : `role="img" aria-label="${pieceName(piece)}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="piece" viewBox="0 0 100 100" ${a11y}>${shapes}</svg>`;
}
