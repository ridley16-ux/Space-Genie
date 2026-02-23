import { emergencyRecoveryCost } from './market.js';

export function bindUIHandlers(ctrl) {
  document.querySelectorAll('.bottom-nav [data-view]').forEach((btn) => btn.addEventListener('click', () => ctrl.showView(btn.dataset.view)));
  document.getElementById('marketOpenBtn').addEventListener('click', ctrl.openMarket);
  document.getElementById('helpBtn').addEventListener('click', () => ctrl.openModal(helpHtml(), true));
  document.getElementById('harvestBtn').addEventListener('click', ctrl.harvest);
  document.getElementById('travelBtn').addEventListener('click', ctrl.travelSelected);
  document.getElementById('unlockArtefactBtn').addEventListener('click', ctrl.unlockArtefact);
  document.querySelectorAll('.module-btn').forEach((btn) => btn.addEventListener('click', () => ctrl.openModule(btn.dataset.module)));
}

export function refreshTopBar(state) {
  document.getElementById('fuelText').textContent = `${Math.floor(state.player.fuel)}/${state.player.maxFuel}`;
  document.getElementById('coinText').textContent = `${Math.floor(state.player.coins)}`;
}

export function renderRegionPanel(state, planet, region) {
  const hazard = region.hazard.type === 'none' ? 'None' : (region.hazard.type === 'time' ? `Time wait ${Math.ceil(Math.max(0, region.hazard.cooldownEnd - Date.now()) / 1000)}s` : `Shield L${region.hazard.required}`);
  const unknown = region.hasArtefactUnknown && !region.artefactRevealed ? 'Unknown artefact detected' : 'No unknown artefact signals';
  const btn = document.getElementById('unlockArtefactBtn');
  btn.disabled = !(region.hasArtefactUnknown && !region.artefactRevealed);
  btn.textContent = region.artefactUnlockStart ? `Unlocking... ${Math.max(0, region.artefactUnlockSeconds - Math.floor((Date.now() - region.artefactUnlockStart) / 1000))}s` : 'Unlock Artefact';

  document.getElementById('regionPanel').innerHTML = `
    <strong>${planet.name} · ${region.id}</strong>
    <div>Harvested: ${Math.floor(region.harvestedPct)}%</div>
    <div>Hazard: ${hazard}</div>
    <div>Resources: ${region.resources.join(', ')}</div>
    <div>${unknown}</div>
  `;
}

export function renderGalaxyView(state, onSelectPlanet, onJumpGalaxy) {
  const root = document.getElementById('galaxyView');
  const scannerInfo = state.player.upgrades.scannerInfoLevel;
  root.innerHTML = `
    <div class="card"><strong>Galaxy ${state.currentGalaxy.index}</strong><div>Expected artefacts: ${state.currentGalaxy.expectedArtefactCount[0]}-${state.currentGalaxy.expectedArtefactCount[1]}</div></div>
    ${state.currentGalaxy.planets.map((p) => `
      <div class="card">
        <strong>${p.name}</strong> ${scannerInfo > 0 ? `<div>Size ${p.size} · Regions ${p.regionCount}</div>` : '<div>Upgrade scanner for planet detail</div>'}
        ${scannerInfo > 1 ? `<div>Hazards: ${p.regions.filter((r) => r.hazard.type !== 'none').length}</div>` : ''}
        <button data-planet-id="${p.id}">Visit (+market refresh)</button>
      </div>
    `).join('')}
    <div class="card"><button id="jumpGalaxyBtn">Jump to Next Galaxy (one-way)</button></div>
  `;
  root.querySelectorAll('button[data-planet-id]').forEach((btn) => btn.addEventListener('click', () => onSelectPlanet(btn.dataset.planetId)));
  root.querySelector('#jumpGalaxyBtn').addEventListener('click', onJumpGalaxy);
}

export function renderJournal(state) {
  const root = document.getElementById('journalView');
  root.innerHTML = `
    <div class="card"><strong>Chapter 1: Find Life</strong><div>Galaxy ${state.currentGalaxy.index}/50 explored</div></div>
    ${state.journal.length ? state.journal.map((j) => `
      <div class="card">
        <strong>Galaxy ${j.index}</strong>
        <div class="${j.completedPct === 100 ? 'good' : 'bad'}">Completion ${j.completedPct}%</div>
        <div>Colonised: ${j.colonised ? 'Yes' : 'No'}</div>
        <div>Artefacts C/R/U: ${j.artefacts.common}/${j.artefacts.rare}/${j.artefacts.ultra}</div>
        <div>Total extracted: ${j.totalExtracted}</div>
      </div>
    `).join('') : '<div class="card">No previous galaxies.</div>'}
    <div class="card"><button id="resetSaveBtn">Reset Save</button></div>
  `;
}

export function renderCollections(state) {
  const root = document.getElementById('collectionView');
  root.innerHTML = ['DNA', 'Fossil', 'Life'].map((cat) => {
    const items = state.collections[cat];
    return `<div class="card"><strong>${cat}</strong><div>Stickers: ${items.length}</div><div>${items.join(', ') || 'None yet'}</div></div>`;
  }).join('');
}

export function helpHtml() {
  return `
    <h3>How to play</h3>
    <ul>
      <li>Tap a hex region to select it and travel there using fuel.</li>
      <li>Harvest regions to 100% to turn them green and gain one-time fuel boosts.</li>
      <li>Unknown artefacts appear only by entering regions. Unlock over time to reveal rarity.</li>
      <li>Hazards can delay you (wait timer) or require shield level.</li>
      <li>Use the living market to sell resources, buy upgrades, or emergency recovery when stranded.</li>
      <li>Jump to the next galaxy anytime, but you cannot return.</li>
    </ul>
  `;
}

export function moduleHtml(name, module) {
  const pct = Math.floor((module.durability / module.durabilityMax) * 100);
  return `
    <h3>${name.toUpperCase()}</h3>
    <div>Level ${module.level}</div>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <div>Durability ${pct}% (${module.durability.toFixed(1)}/${module.durabilityMax})</div>
    <button data-upg="level">Upgrade level</button>
    <button data-upg="durability">Upgrade durability cap</button>
    <button data-upg="decay">Improve decay rate</button>
  `;
}

export function marketHtml(state, market) {
  const emergency = emergencyRecoveryCost(state.player);
  return `
    <h3>Living Market</h3>
    ${market.insaneBoost ? `<div class="good">Insane boost: ${market.insaneBoost} +200%</div>` : ''}
    <div class="card">Metal: ${market.prices.metal} | Energy: ${market.prices.energy} | Organic: ${market.prices.organic}</div>
    <div class="card">Artefacts C:${market.prices.common} R:${market.prices.rare} U:${market.prices.ultra}</div>
    <button data-sell="metal">Sell Metal</button>
    <button data-sell="energy">Sell Energy</button>
    <button data-sell="organic">Sell Organic</button>
    <button data-sell="artefacts">Sell one artefact</button>
    <hr/>
    <button data-buy="tank">Fuel tank upgrade</button>
    <button data-buy="eff">Fuel efficiency upgrade</button>
    <button data-buy="market">Market bonus upgrade</button>
    <button data-buy="scannerInfo">Scanner visibility upgrade</button>
    <button data-buy="recovery">Emergency Recovery (${emergency})</button>
  `;
}
