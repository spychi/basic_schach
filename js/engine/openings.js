// Small opening table: SAN sequence (German notation) -> name.

export const OPENINGS = [
  [['e4', 'e5', 'Sf3', 'Sc6', 'Lc4'], 'Italienische Partie'],
  [['e4', 'e5', 'Sf3', 'Sc6', 'Lc4', 'Sf6'], 'Zweispringerspiel im Nachzug'],
  [['e4', 'e5', 'Sf3', 'Sc6', 'Lb5'], 'Spanische Partie'],
  [['e4', 'e5', 'Sf3', 'Sc6', 'Lb5', 'a6'], 'Spanische Partie, Morphy-Verteidigung'],
  [['e4', 'e5', 'Sf3', 'Sc6', 'd4'], 'Schottische Partie'],
  [['e4', 'e5', 'Sf3', 'Sc6', 'Sc3'], 'Dreispringerspiel'],
  [['e4', 'e5', 'Sf3', 'Sf6'], 'Russische Verteidigung (Petrow)'],
  [['e4', 'e5', 'Sf3', 'd6'], 'Philidor-Verteidigung'],
  [['e4', 'e5', 'f4'], 'Königsgambit'],
  [['e4', 'e5', 'Sc3'], 'Wiener Partie'],
  [['e4', 'e5', 'Lc4'], 'Läuferspiel'],
  [['e4', 'c5'], 'Sizilianische Verteidigung'],
  [['e4', 'c5', 'Sf3', 'd6', 'd4', 'cxd4', 'Sxd4', 'Sf6', 'Sc3', 'a6'], 'Sizilianisch, Najdorf-Variante'],
  [['e4', 'e6'], 'Französische Verteidigung'],
  [['e4', 'c6'], 'Caro-Kann-Verteidigung'],
  [['e4', 'd5'], 'Skandinavische Verteidigung'],
  [['e4', 'd6', 'd4', 'Sf6', 'Sc3'], 'Pirc-Verteidigung'],
  [['e4', 'Sf6'], 'Aljechin-Verteidigung'],
  [['d4', 'd5', 'c4'], 'Damengambit'],
  [['d4', 'd5', 'c4', 'c6'], 'Slawische Verteidigung'],
  [['d4', 'd5', 'c4', 'e6'], 'Damengambit, abgelehnt'],
  [['d4', 'd5', 'c4', 'dxc4'], 'Damengambit, angenommen'],
  [['d4', 'd5', 'Lf4'], 'Londoner System'],
  [['d4', 'Sf6', 'c4', 'g6'], 'Indische Verteidigung (Königsindisch)'],
  [['d4', 'Sf6', 'c4', 'g6', 'Sc3', 'Lg7'], 'Königsindische Verteidigung'],
  [['d4', 'Sf6', 'c4', 'g6', 'Sc3', 'd5'], 'Grünfeld-Indisch'],
  [['d4', 'Sf6', 'c4', 'e6', 'Sc3', 'Lb4'], 'Nimzo-Indische Verteidigung'],
  [['d4', 'Sf6', 'c4', 'e6', 'Sf3', 'b6'], 'Damenindische Verteidigung'],
  [['d4', 'Sf6', 'c4', 'e6', 'g3'], 'Katalanische Eröffnung'],
  [['d4', 'Sf6', 'c4', 'c5', 'd5'], 'Benoni-Verteidigung'],
  [['d4', 'f5'], 'Holländische Verteidigung'],
  [['c4'], 'Englische Eröffnung'],
  [['Sf3', 'd5', 'c4'], 'Réti-Eröffnung'],
  [['Sf3'], 'Réti-Eröffnung'],
];

const strip = (s) => s.replace(/[+#]/g, '');

/** Name of the longest opening whose moves are a prefix of sanList, or null. */
export function openingName(sanList) {
  const list = sanList.map(strip);
  let best = null;
  let bestLen = 0;
  for (const [moves, name] of OPENINGS) {
    if (moves.length > list.length || moves.length <= bestLen) continue;
    if (moves.every((m, i) => m === list[i])) { best = name; bestLen = moves.length; }
  }
  return best;
}
