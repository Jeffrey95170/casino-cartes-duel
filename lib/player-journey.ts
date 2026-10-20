export const ACHIEVEMENT_CATALOG = [
  { code: "PREMIERE_PRISE", name: "Première prise", description: "Réaliser sa première capture.", icon: "✦" },
  { code: "CALCULATEUR", name: "Calculateur", description: "Capturer au moins 4 cartes en une action.", icon: "∑" },
  { code: "BRAQUAGE", name: "Braquage", description: "Capturer au moins 30 cartes dans une partie.", icon: "♛" },
  { code: "INVAINCU", name: "Invaincu", description: "Gagner 5 parties consécutives.", icon: "🔥" },
  { code: "CENTURION", name: "Centurion", description: "Terminer 100 parties vérifiées.", icon: "C" },
  { code: "PIEGE_PARFAIT", name: "Piège parfait", description: "Capturer une construction créée par le Rival IA.", icon: "◇" },
] as const;

export function playerTitle(level: number): string {
  if (level >= 10) return "Maître des cartes";
  if (level >= 7) return "Expert";
  if (level >= 4) return "Stratège";
  if (level >= 2) return "Tacticien";
  return "Recrue";
}

export function careerGoals(stats: { games_completed: number; wins: number; total_cards_captured: number }) {
  return [
    { label: "Duels terminés", value: stats.games_completed, steps: [3, 10, 25, 50, 100, 250] },
    { label: "Victoires", value: stats.wins, steps: [1, 5, 10, 25, 50, 100] },
    { label: "Cartes capturées", value: stats.total_cards_captured, steps: [52, 130, 260, 520, 1040, 2600] },
  ].map(({ label, value, steps }) => {
    const target = steps.find((step) => step > value) ?? steps[steps.length - 1];
    return { label, value, target, complete: value >= target, percent: Math.min(100, Math.max(0, value / target * 100)) };
  });
}
