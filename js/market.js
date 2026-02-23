import { hashStringToSeed, mulberry32, pick } from './rng.js';

const basePrices = { metal: 5, energy: 6, organic: 4, common: 35, rare: 90, ultra: 240 };

export function computeMarket(galaxy, sellBonus = 1) {
  const rng = mulberry32(hashStringToSeed(`${galaxy.seed}:${galaxy.planetVisitsCount}:market`));
  const multipliers = {
    metal: 0.7 + rng() * 1.1,
    energy: 0.7 + rng() * 1.1,
    organic: 0.7 + rng() * 1.1,
    common: 0.8 + rng() * 1.2,
    rare: 0.8 + rng() * 1.3,
    ultra: 0.8 + rng() * 1.4
  };

  let insaneBoost = null;
  if (rng() < 0.12) {
    insaneBoost = pick(rng, Object.keys(multipliers));
    multipliers[insaneBoost] *= 3;
  }

  const prices = Object.fromEntries(Object.entries(basePrices).map(([k, v]) => [k, Math.round(v * multipliers[k] * sellBonus)]));
  return { prices, multipliers, insaneBoost };
}

export function emergencyRecoveryCost(player) {
  return Math.round((90 + player.maxFuel * 4) * player.upgrades.emergencyDiscount);
}
