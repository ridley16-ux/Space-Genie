import { generateGalaxy, hexDistance } from './gen.js';
import { computeMarket, emergencyRecoveryCost } from './market.js';
import { createPlanetRenderer } from './planetCanvas.js';
import { hashStringToSeed, mulberry32 } from './rng.js';
import { loadState, saveState, resetState } from './state.js';
import { bindUIHandlers, marketHtml, moduleHtml, refreshTopBar, renderCollections, renderGalaxyView, renderJournal, renderRegionPanel } from './ui.js';

const RESOURCES_FALLBACK = JSON.parse('{"categories":[{"id":"metal","name":"Metal","tiers":[{"minGalaxy":1,"label":"Scrap Iron","baseYield":8,"baseValue":4,"waitSeconds":1},{"minGalaxy":15,"label":"Dense Alloy","baseYield":6,"baseValue":8,"waitSeconds":2},{"minGalaxy":35,"label":"Voidsteel","baseYield":4,"baseValue":14,"waitSeconds":3}]},{"id":"energy","name":"Energy","tiers":[{"minGalaxy":1,"label":"Ion Cells","baseYield":7,"baseValue":5,"waitSeconds":1},{"minGalaxy":15,"label":"Prism Cores","baseYield":5,"baseValue":10,"waitSeconds":2},{"minGalaxy":35,"label":"Singularity Charge","baseYield":3,"baseValue":18,"waitSeconds":3}]},{"id":"organic","name":"Organic","tiers":[{"minGalaxy":1,"label":"Microflora","baseYield":9,"baseValue":3,"waitSeconds":1},{"minGalaxy":15,"label":"Bio-Weave","baseYield":6,"baseValue":7,"waitSeconds":2},{"minGalaxy":35,"label":"Proto-Life Gel","baseYield":4,"baseValue":13,"waitSeconds":3}]}]}');
const ARTEFACTS_FALLBACK = JSON.parse('{"categories":[{"id":"DNA","rarity":"common","setBonusXp":40,"setSellBonus":1.35,"items":["Helix Fragment","Genome Coil","Spiral Marker","Gene Thread","Chromo Bead"]},{"id":"Fossil","rarity":"rare","setBonusXp":90,"setSellBonus":1.6,"items":["Bone Lattice","Amber Imprint","Shell Archive","Stone Rib"]},{"id":"Life","rarity":"ultra","setBonusXp":180,"setSellBonus":2.1,"items":["Living Spore","Echo Seed","Prime Cell"]}]}');

let state = loadState();
let resourcesData = RESOURCES_FALLBACK;
let artefactsData = ARTEFACTS_FALLBACK;
let market = null;
let selectedRegionId = null;

const canvas = document.getElementById('planetCanvas');
const renderer = createPlanetRenderer(canvas);

function gameRng(tag = 'tick') {
  return mulberry32(hashStringToSeed(`${state.currentGalaxy.seed}:${state.runtime.lastTick}:${tag}`));
}

function getPlanet() {
  return state.currentGalaxy.planets.find((p) => p.id === state.currentPlanetId) || state.currentGalaxy.planets[0];
}

function getRegion(planet, id) {
  return planet.regions.find((r) => r.id === id) || planet.regions[0];
}

function applyDecay(moduleName, base) {
  const m = state.player.modules[moduleName];
  m.durability -= base * m.decayRate;
  if (m.durability <= 0) {
    m.level = Math.max(1, m.level - 1);
    m.durability = m.durabilityMax;
  }
}

function recomputePlanetCompletion(planet) {
  planet.completedPct = Math.floor(planet.regions.reduce((a, r) => a + r.harvestedPct, 0) / planet.regions.length);
}

function updateHUD() {
  refreshTopBar(state);
  const planet = getPlanet();
  const region = getRegion(planet, selectedRegionId || planet.currentRegionId);
  selectedRegionId = region.id;
  renderRegionPanel(state, planet, region);
  renderGalaxyView(state, selectPlanet, jumpGalaxy);
  renderJournal(state);
  renderCollections(state);
}

function autoSave() {
  saveState(state);
}

function travelSelected() {
  const planet = getPlanet();
  const from = getRegion(planet, planet.currentRegionId);
  const to = getRegion(planet, selectedRegionId);
  const distance = hexDistance(from.coord, to.coord);
  const cost = Math.ceil((1 + distance * 2) * state.player.upgrades.fuelCostMultiplier);
  if (state.player.fuel < cost) return;
  if (to.hazard.type === 'shield' && state.player.modules.shield.level < to.hazard.required) return;

  state.player.fuel -= cost;
  applyDecay('shield', 0.9 + distance * 0.25);
  applyDecay('scanner', 0.35);
  planet.currentRegionId = to.id;
  to.discovered = true;
  if (to.hazard.type === 'time' && to.hazard.cooldownEnd < Date.now()) {
    to.hazard.cooldownEnd = Date.now() + to.hazard.seconds * 1000;
    applyDecay('shield', 1.4);
  }
  autoSave();
}

function harvest() {
  const planet = getPlanet();
  const region = getRegion(planet, planet.currentRegionId);
  if (region.harvested) return;
  if (region.hazard.type === 'time' && Date.now() < region.hazard.cooldownEnd) return;
  if (region.nextHarvestAt && Date.now() < region.nextHarvestAt) return;

  const rng = gameRng('harvest');
  const resourceKey = region.resources[Math.floor(rng() * region.resources.length)] || 'metal';
  const cat = resourcesData.categories.find((c) => c.id === resourceKey);
  const tier = [...cat.tiers].reverse().find((t) => state.currentGalaxy.index >= t.minGalaxy) || cat.tiers[0];
  const gain = tier.baseYield + state.player.modules.laser.level;

  state.player.resources[resourceKey] += gain;
  state.player.coins += Math.floor(gain * 0.15);
  region.harvestedPct = Math.min(100, region.harvestedPct + 8 + state.player.modules.laser.level * 0.8);
  region.nextHarvestAt = Date.now() + tier.waitSeconds * 1000;

  applyDecay('laser', 1.4);
  applyDecay('scanner', 0.7);

  if (region.harvestedPct >= 100) {
    region.harvested = true;
    state.player.fuel = Math.min(state.player.maxFuel, state.player.fuel + 8);
  }
  recomputePlanetCompletion(planet);
  autoSave();
}

function rarityRoll() {
  const r = gameRng('rarity')();
  if (r < 1 / 20) return 'ultra';
  if (r < 1 / 5) return 'rare';
  return 'common';
}

function unlockArtefact() {
  const region = getRegion(getPlanet(), selectedRegionId);
  if (!(region.hasArtefactUnknown && !region.artefactRevealed)) return;
  if (!region.artefactUnlockStart) region.artefactUnlockStart = Date.now();
  autoSave();
}

function finishArtefact(region) {
  const rarity = rarityRoll();
  const category = rarity === 'common' ? 'DNA' : (rarity === 'rare' ? 'Fossil' : 'Life');
  const pool = artefactsData.categories.find((c) => c.id === category).items;
  const item = pool[Math.floor(gameRng('artefact-item')() * pool.length)];
  region.artefactRevealed = `${category}:${item}`;
  state.player.artefacts.push({ category, rarity, item });
  if (!state.collections[category].includes(item)) state.collections[category].push(item);
  autoSave();
}

function selectPlanet(id) {
  state.currentPlanetId = id;
  state.currentGalaxy.planetVisitsCount += 1;
  market = computeMarket(state.currentGalaxy, state.player.upgrades.marketSellBonus);
  autoSave();
}

function computeGalaxyCompletion(galaxy) {
  const totalPct = galaxy.planets.reduce((a, p) => a + p.regions.reduce((ar, r) => ar + r.harvestedPct, 0), 0);
  return Math.floor(totalPct / galaxy.totalRegions);
}

function jumpGalaxy() {
  const completedPct = computeGalaxyCompletion(state.currentGalaxy);
  const artefacts = state.player.artefacts.reduce((a, x) => (a[x.rarity]++, a), { common: 0, rare: 0, ultra: 0 });
  const colonised = completedPct === 100 && state.currentGalaxy.planets.every((p) => p.regions.every((r) => !r.hasArtefactUnknown || r.artefactRevealed));

  state.journal.push({
    index: state.currentGalaxy.index,
    completedPct,
    colonised,
    artefacts,
    totalExtracted: Object.values(state.player.resources).reduce((a, v) => a + v, 0)
  });

  state.galaxyIndex += 1;
  state.currentGalaxy = generateGalaxy(state.baseSeed, state.galaxyIndex);
  state.currentPlanetId = state.currentGalaxy.planets[0].id;
  selectedRegionId = state.currentGalaxy.planets[0].regions[0].id;
  market = computeMarket(state.currentGalaxy, state.player.upgrades.marketSellBonus);
  autoSave();
}

function openModal(html, closeOnBg = false) {
  const modal = document.getElementById('modal');
  modal.classList.remove('hidden');
  document.getElementById('modalContent').innerHTML = html;
  if (closeOnBg) modal.onclick = (e) => { if (e.target.id === 'modal') modal.classList.add('hidden'); };
}

function openModule(name) {
  const m = state.player.modules[name];
  openModal(moduleHtml(name, m), true);
  document.querySelectorAll('#modalContent button[data-upg]').forEach((btn) => {
    btn.onclick = () => {
      const type = btn.dataset.upg;
      const cost = type === 'level' ? 80 * m.level : type === 'durability' ? 90 : 70;
      if (state.player.coins < cost) return;

      state.player.coins -= cost;
      if (type === 'level') m.level += 1;
      if (type === 'durability') {
        m.durabilityMax += 20;
        m.durability = m.durabilityMax;
      }
      if (type === 'decay') m.decayRate = Math.max(0.35, m.decayRate - 0.08);
      autoSave();
      openModule(name);
    };
  });
}

function openMarket() {
  market = computeMarket(state.currentGalaxy, state.player.upgrades.marketSellBonus);
  openModal(marketHtml(state, market), true);

  document.querySelectorAll('#modalContent button[data-sell]').forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.sell;
      if (key === 'artefacts') {
        const a = state.player.artefacts.shift();
        if (!a) return;
        state.player.coins += market.prices[a.rarity];
      } else {
        const qty = state.player.resources[key];
        if (!qty) return;
        state.player.coins += qty * market.prices[key];
        state.player.resources[key] = 0;
      }
      autoSave();
      openMarket();
    };
  });

  document.querySelectorAll('#modalContent button[data-buy]').forEach((btn) => {
    btn.onclick = () => {
      const kind = btn.dataset.buy;
      if (kind === 'recovery') {
        const c = emergencyRecoveryCost(state.player);
        if (state.player.coins >= c) {
          state.player.coins -= c;
          state.player.fuel = state.player.maxFuel;
        }
      }
      if (kind === 'tank' && state.player.coins >= 150) {
        state.player.coins -= 150;
        state.player.maxFuel += 12;
        state.player.fuel = state.player.maxFuel;
      }
      if (kind === 'eff' && state.player.coins >= 140) {
        state.player.coins -= 140;
        state.player.upgrades.fuelCostMultiplier = Math.max(0.6, state.player.upgrades.fuelCostMultiplier - 0.08);
      }
      if (kind === 'market' && state.player.coins >= 170) {
        state.player.coins -= 170;
        state.player.upgrades.marketSellBonus += 0.05;
        state.player.upgrades.emergencyDiscount = Math.max(0.75, state.player.upgrades.emergencyDiscount - 0.05);
      }
      if (kind === 'scannerInfo' && state.player.coins >= 120 && state.player.upgrades.scannerInfoLevel < 2) {
        state.player.coins -= 120;
        state.player.upgrades.scannerInfoLevel += 1;
      }
      autoSave();
      openMarket();
    };
  });
}

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'journalView') {
    const reset = document.getElementById('resetSaveBtn');
    if (reset) reset.onclick = () => { if (confirm('Reset save permanently?')) { state = resetState(); init(); } };
  }
}

function loop() {
  const now = Date.now();
  const dt = (now - state.runtime.lastTick) / 1000;
  state.runtime.lastTick = now;

  const colonisedCount = state.journal.filter((j) => j.colonised).length;
  state.player.coins += dt * colonisedCount * 0.5;
  state.player.fuel = Math.min(state.player.maxFuel, state.player.fuel + (state.player.fuelRegenBase + colonisedCount * 0.02) * dt);

  const region = getRegion(getPlanet(), selectedRegionId || getPlanet().currentRegionId);
  if (region.artefactUnlockStart && !region.artefactRevealed) {
    const elapsed = (now - region.artefactUnlockStart) / 1000;
    if (elapsed >= region.artefactUnlockSeconds) finishArtefact(region);
  }

  if (now - state.runtime.lastSave > 10000) autoSave();
  renderer.render(state, getPlanet(), selectedRegionId);
  updateHUD();
  requestAnimationFrame(loop);
}

async function safeLoadJson(path, fallback) {
  try {
    if (!location.protocol.startsWith('http')) return fallback;
    const response = await fetch(path);
    if (!response.ok) return fallback;
    return await response.json();
  } catch {
    return fallback;
  }
}

async function mountFooter() {
  const mount = document.getElementById('footerMount');
  if (!mount) return;
  try {
    if (!location.protocol.startsWith('http')) {
      mount.innerHTML = '<footer class="app-footer">Galaxy Harvest v1.1.0</footer>';
      return;
    }
    const html = await fetch('./assets/footer.html').then((r) => r.text());
    mount.innerHTML = html;
  } catch {
    mount.innerHTML = '<footer class="app-footer">Galaxy Harvest v1.1.0</footer>';
  }
}

async function init() {
  state.runtime.lastTick = Date.now();
  resourcesData = await safeLoadJson('./assets/data/resources.json', RESOURCES_FALLBACK);
  artefactsData = await safeLoadJson('./assets/data/artefacts.json', ARTEFACTS_FALLBACK);

  const planet = getPlanet();
  selectedRegionId = planet.currentRegionId;
  market = computeMarket(state.currentGalaxy, state.player.upgrades.marketSellBonus);

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = renderer.pickRegionFromCanvas(x, y);
    if (hit) selectedRegionId = hit;
  });

  bindUIHandlers({ showView, openMarket, openModal, harvest, travelSelected, unlockArtefact, openModule });
  await mountFooter();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => null);
  }
  requestAnimationFrame(loop);
}

init();
