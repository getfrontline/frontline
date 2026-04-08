export function tierFromScore(score: number): string {
  if (score < 560) return "Recovering";
  if (score < 620) return "Fair";
  if (score < 680) return "Good";
  if (score < 740) return "Strong";
  return "Elite";
}

export function tierHint(tier: string): string {
  switch (tier) {
    case "Recovering":
      return "Focus on on-time repayments to unlock higher lines.";
    case "Fair":
      return "Eligible for standard BNPL limits; keep streaks clean.";
    case "Good":
      return "Competitive rates and higher merchant acceptance.";
    case "Strong":
      return "Priority routing and elevated exposure caps.";
    case "Elite":
      return "Top decile portable credit; partner perks unlocked.";
    default:
      return "";
  }
}

export function clampScore(n: number): number {
  return Math.min(850, Math.max(300, Math.round(n)));
}
