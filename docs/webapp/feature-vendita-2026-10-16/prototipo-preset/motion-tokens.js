/* Copia letterale di /Users/manuel/Documents/brain/design/menusmart/motion.tokens.json (v1.0)
   più i due ritardi delle ricette M06 (contenuto +60ms) e M01 (testo +40ms) di DESIGN.md.
   Unica fonte di tempi/curve del prototipo: CSS e JS leggono solo da qui. */
window.TakoMenuMotion = {
  version: '1.0',
  durationMs: { instant: 0, press: 90, micro: 140, fast: 180, standard: 280, surface: 340, reveal: 420, data: 600, exit: 220 },
  easing: { out: [0.22, 1, 0.36, 1], inOut: [0.65, 0, 0.35, 1], exit: [0.4, 0, 1, 1] },
  distancePx: { micro: 6, panel: 12, reveal: 24 },
  scale: { pressed: 0.98, enter: 0.98 },
  blurPx: { textSwap: 3, maxTransient: 4 },
  staggerMs: { list: 24, cards: 50, maximumItems: 5, totalBudget: 650 },
  recipeDelayMs: { contentAfterSurface: 60, textSwap: 40 }
};
