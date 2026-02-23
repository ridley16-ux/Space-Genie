import { hexDistance } from './gen.js';

export function createPlanetRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const state = { rot: 0, hitRegions: [] };

  function drawHex(x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i + Math.PI / 6;
      const px = x + Math.cos(a) * size;
      const py = y + Math.sin(a) * size;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function project(coord, radius, offset) {
    const x0 = coord.q * 1.1 + coord.r * 0.55;
    const y0 = coord.r * 0.95;
    const x = x0 * radius * 0.16 + Math.sin(offset) * 3;
    const squash = 0.65 + 0.35 * Math.cos((x / radius) + offset);
    const y = y0 * radius * 0.14 * squash;
    return { x, y, visible: squash > 0.06, alpha: squash };
  }

  function render(game, currentPlanet, selectedRegionId) {
    const { width, height } = canvas;
    const radius = Math.min(width, height) * 0.38;
    const cx = width / 2;
    const cy = height / 2 - 8;
    state.rot += 0.004;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(cx, cy);

    const grad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.35, radius * 0.2, 0, 0, radius * 1.1);
    grad.addColorStop(0, '#2f4f74');
    grad.addColorStop(1, '#0a1220');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(79,179,255,0.2)';
    ctx.lineWidth = 8;
    ctx.shadowColor = 'rgba(79,179,255,0.4)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();

    const scannerLow = game.player.modules.scanner.durability / game.player.modules.scanner.durabilityMax < 0.25;
    const shieldLow = game.player.modules.shield.durability / game.player.modules.shield.durabilityMax < 0.25;
    if (scannerLow && Math.random() > 0.5) ctx.filter = 'blur(1px)';

    state.hitRegions = [];
    currentPlanet.regions.forEach((region) => {
      const p = project(region.coord, radius, state.rot);
      if (!p.visible) return;
      const px = p.x;
      const py = p.y;
      const hSize = Math.max(12, radius * 0.055);
      drawHex(px, py, hSize);
      ctx.fillStyle = region.harvested ? 'rgba(63,226,132,0.45)' : 'rgba(18,33,56,0.35)';
      ctx.fill();
      ctx.lineWidth = region.id === selectedRegionId ? 2.6 : 1;
      ctx.strokeStyle = region.id === selectedRegionId ? '#8ad5ff' : `rgba(120,170,220,${0.35 * p.alpha})`;
      ctx.stroke();

      if (region.hasArtefactUnknown && !region.artefactRevealed) {
        ctx.fillStyle = '#ffce5a';
        ctx.beginPath();
        ctx.arc(px, py - hSize * 0.75, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (shieldLow && region.hazard.type !== 'none' && Math.random() > 0.7) {
        ctx.strokeStyle = 'rgba(255,114,132,0.65)';
        ctx.beginPath();
        ctx.moveTo(px - 8, py - 8);
        ctx.lineTo(px + 6, py + 7);
        ctx.stroke();
      }

      state.hitRegions.push({ regionId: region.id, x: px + cx, y: py + cy, size: hSize });
    });
    ctx.filter = 'none';

    const light = ctx.createRadialGradient(-radius * 0.4, -radius * 0.6, radius * 0.05, 0, 0, radius);
    light.addColorStop(0, 'rgba(255,255,255,0.23)');
    light.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = light;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

    ctx.restore();
  }

  function pickRegionFromCanvas(x, y) {
    return state.hitRegions
      .map((hit) => ({ ...hit, d: Math.hypot(hit.x - x, hit.y - y) }))
      .filter((h) => h.d <= h.size)
      .sort((a, b) => a.d - b.d)[0]?.regionId || null;
  }

  return { render, pickRegionFromCanvas, hexDistance };
}
