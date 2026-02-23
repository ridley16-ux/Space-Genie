import { generateGalaxy } from './gen.js';

const KEY = 'galaxyHarvestSave_v1';

export function createDefaultSave() {
  const baseSeed = Math.floor(Math.random() * 1e9);
  return {
    version: '1.0.0',
    baseSeed,
    galaxyIndex: 1,
    currentGalaxy: generateGalaxy(baseSeed, 1),
    currentPlanetId: 'planet-1',
    player: {
      coins: 120,
      fuel: 60,
      maxFuel: 60,
      fuelRegenBase: 0.12,
      resources: { metal: 0, energy: 0, organic: 0 },
      upgrades: {
        fuelCostMultiplier: 1,
        marketSellBonus: 1,
        emergencyDiscount: 1,
        scannerInfoLevel: 0
      },
      modules: {
        scanner: { level: 1, durability: 100, durabilityMax: 100, decayRate: 1 },
        shield: { level: 1, durability: 100, durabilityMax: 100, decayRate: 1 },
        laser: { level: 1, durability: 100, durabilityMax: 100, decayRate: 1 }
      },
      artefacts: []
    },
    journal: [],
    collections: { DNA: [], Fossil: [], Life: [], claimedSetRewards: [] },
    chapter1: { target: 50 },
    settings: { audio: false },
    runtime: { lastTick: Date.now(), lastSave: Date.now() }
  };
}

export function loadState() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return createDefaultSave();
  try {
    return JSON.parse(raw);
  } catch {
    return createDefaultSave();
  }
}

export function saveState(state) {
  state.runtime.lastSave = Date.now();
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(KEY);
  return createDefaultSave();
}
