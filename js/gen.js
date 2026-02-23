import { hashStringToSeed, intInRange, mulberry32, pick } from './rng.js';

const PLANET_SIZE_RULES = [
  { size: 'tiny', min: 2, max: 4 },
  { size: 'small', min: 5, max: 8 },
  { size: 'medium', min: 9, max: 14 },
  { size: 'large', min: 15, max: 20 },
  { size: 'massive', min: 21, max: 24 }
];

function getDifficulty(index) {
  const t = Math.min(1, (index - 1) / 49);
  return {
    planetMin: 2 + Math.floor(t * 2),
    planetMax: 4 + Math.floor(t * 3),
    hazardFrequency: 0.15 + t * 0.35
  };
}

function makeHexSpiral(count) {
  const dirs = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
  const out = [{ q: 0, r: 0 }];
  if (count === 1) return out;
  let radius = 1;
  while (out.length < count) {
    let q = -radius, r = radius;
    for (let d = 0; d < 6 && out.length < count; d++) {
      for (let i = 0; i < radius && out.length < count; i++) {
        out.push({ q, r });
        q += dirs[d][0];
        r += dirs[d][1];
      }
    }
    radius++;
  }
  return out;
}

function artefactTargets(rng, totalRegions) {
  const total = intInRange(rng, 3, 5);
  const picks = new Set();
  while (picks.size < Math.min(total, totalRegions)) picks.add(intInRange(rng, 0, totalRegions - 1));
  return [...picks];
}

export function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (-a.q - a.r) - (-b.q - b.r);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

export function generateGalaxy(baseSeed, galaxyIndex) {
  const seed = hashStringToSeed(`${baseSeed}:${galaxyIndex}`);
  const rng = mulberry32(seed);
  const difficulty = getDifficulty(galaxyIndex);
  const planetCount = intInRange(rng, difficulty.planetMin, difficulty.planetMax);
  const planets = [];
  let regionGlobalCount = 0;

  for (let p = 0; p < planetCount; p++) {
    const startTier = Math.min(PLANET_SIZE_RULES.length - 1, Math.floor((galaxyIndex - 1) / 12));
    const allowedSizes = PLANET_SIZE_RULES.slice(0, startTier + 1);
    const sizeRule = pick(rng, allowedSizes);
    const regionCount = intInRange(rng, sizeRule.min, sizeRule.max);
    const coords = makeHexSpiral(regionCount);
    const regions = coords.map((coord, i) => {
      const isHazard = rng() < difficulty.hazardFrequency;
      const hazardType = isHazard ? (rng() < 0.5 ? 'time' : 'shield') : 'none';
      return {
        id: `P${p + 1}-R${i + 1}`,
        coord,
        harvestedPct: 0,
        harvested: false,
        discovered: i === 0,
        resources: ['metal', 'energy', 'organic'].filter(() => rng() > 0.2),
        hazard: hazardType === 'none' ? { type: 'none' } : (hazardType === 'time'
          ? { type: 'time', seconds: intInRange(rng, 60, 300), cooldownEnd: 0 }
          : { type: 'shield', required: intInRange(rng, 1, 5) }),
        hasArtefactUnknown: false,
        artefactUnlockSeconds: intInRange(rng, 20, 75),
        artefactUnlockStart: 0,
        artefactRevealed: null
      };
    });
    planets.push({
      id: `planet-${p + 1}`,
      name: `Planet ${p + 1}`,
      size: sizeRule.size,
      regionCount,
      regions,
      currentRegionId: regions[0].id,
      completedPct: 0
    });
    regionGlobalCount += regionCount;
  }

  const flat = planets.flatMap((planet) => planet.regions.map((region) => ({ planet, region })));
  for (const idx of artefactTargets(rng, flat.length)) flat[idx].region.hasArtefactUnknown = true;

  return {
    galaxyId: `G-${galaxyIndex}`,
    index: galaxyIndex,
    seed,
    expectedArtefactCount: [3, 5],
    hazardFrequency: difficulty.hazardFrequency,
    planetVisitsCount: 0,
    planets,
    totalRegions: regionGlobalCount,
    startedAt: Date.now()
  };
}
