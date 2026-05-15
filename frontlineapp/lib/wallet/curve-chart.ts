export const INITIAL_LAUNCH_SUPPLY = 1_000_000_000; // FLT
export const TOKEN_SCALE = 1e8;
export const WAD = 1e18;

export type CurvePoint = {
  soldFlt: number;
  priceHbar: number;
};

function expWad(xWad: number): number {
  const x = xWad / WAD;
  return Math.exp(x);
}

export function generateCurvePoints(
  basePriceWei: bigint,
  steepnessWad: bigint,
  steps = 60,
): CurvePoint[] {
  const basePrice = Number(basePriceWei) / 1e8; // tinybar -> HBAR
  const steepness = Number(steepnessWad) / WAD;
  const totalSupply = INITIAL_LAUNCH_SUPPLY;

  const points: CurvePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const soldFlt = (totalSupply * i) / steps;
    const exponent = (soldFlt * steepness) / totalSupply;
    const priceHbar = basePrice * Math.exp(exponent);
    points.push({ soldFlt, priceHbar });
  }
  return points;
}

export function computeMarketCap(soldSupplyFlt: number, spotPriceHbar: number): number {
  return soldSupplyFlt * spotPriceHbar;
}
