// Everything the eye sees on the field: the grid, the path, the core, the towers, the creatures,
// the shots they trade, and the sparks and numbers those shots leave behind. The HUD and the
// screens are HTML; this file owns the canvas alone.
import { TILE, COLS, ROWS, FIELD_W, FIELD_H, COLORS, PATH_POINTS, CORE_TILE, TOWERS } from './config.js';
import { towerStats } from './towers.js';
import { pathTiles } from './world.js';

const PATH = pathTiles();

function tileCenter(col, row) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

function drawGrid(ctx) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const key = `${col},${row}`;
      if (PATH.has(key)) continue;
      ctx.fillStyle = (col + row) % 2 === 0 ? COLORS.grid : COLORS.background;
      ctx.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, TILE - 2);
    }
  }
  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;
  for (let i = 0; i <= COLS; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * TILE + 0.5, 0);
    ctx.lineTo(i * TILE + 0.5, FIELD_H);
    ctx.stroke();
  }
  for (let i = 0; i <= ROWS; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, i * TILE + 0.5);
    ctx.lineTo(FIELD_W, i * TILE + 0.5);
    ctx.stroke();
  }
}

function drawPath(ctx) {
  ctx.fillStyle = COLORS.path;
  for (const key of PATH) {
    const [col, row] = key.split(',').map(Number);
    ctx.fillRect(col * TILE + 2, row * TILE + 2, TILE - 4, TILE - 4);
  }
  // Direction chevrons along the path, so the player reads which way the creatures walk.
  ctx.fillStyle = COLORS.pathEdge;
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 1; i < PATH_POINTS.length; i += 1) {
    const a = PATH_POINTS[i - 1];
    const b = PATH_POINTS[i];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    const arrow = dx > 0 ? '›' : dx < 0 ? '‹' : dy > 0 ? '⌄' : '⌃';
    let x = a.x;
    let y = a.y;
    while (x !== b.x || y !== b.y) {
      const c = tileCenter(x, y);
      ctx.fillText(arrow, c.x, c.y);
      if (x !== b.x) x += dx;
      else y += dy;
    }
  }
}

function drawCore(ctx, world) {
  const c = tileCenter(CORE_TILE.x, CORE_TILE.y);
  const pulse = 1 + Math.sin(world.time * 3) * 0.08;
  const r = 22 * pulse;
  const glow = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, r + 18);
  glow.addColorStop(0, 'rgba(255, 217, 77, 0.55)');
  glow.addColorStop(1, 'rgba(255, 217, 77, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r + 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.core;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = c.x + Math.cos(angle) * rad;
    const py = c.y + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.coreRing;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CORE', c.x, c.y + r + 14);
}

function drawTower(ctx, tower, selected) {
  const stats = towerStats(tower.type, tower.level);
  const c = { x: tower.x, y: tower.y };
  if (selected) {
    ctx.fillStyle = 'rgba(255, 217, 77, 0.10)';
    ctx.strokeStyle = 'rgba(255, 217, 77, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, stats.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Base and barrel, the barrel turning where the tower last shot.
  ctx.fillStyle = '#1b2340';
  ctx.strokeStyle = stats.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(tower.angle);
  ctx.fillStyle = stats.color;
  ctx.fillRect(0, -4, 22, 8);
  ctx.restore();
  ctx.fillStyle = stats.color;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
  ctx.fill();
  // Level pips under the tower.
  for (let i = 0; i < tower.level; i += 1) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(c.x - 10 + i * 10, c.y + 26, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (tower.flash > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemy(ctx, enemy) {
  const x = enemy.x;
  const y = enemy.y;
  const r = enemy.radius;
  ctx.save();
  if (enemy.slowFactor < 1) {
    ctx.shadowColor = '#8fd8ff';
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : enemy.color;
  ctx.beginPath();
  if (enemy.kind === 'swift') {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x - r * 0.8, y + r * 0.8);
    ctx.lineTo(x - r * 0.8, y - r * 0.8);
    ctx.closePath();
  } else if (enemy.kind === 'armored') {
    ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  } else if (enemy.kind === 'splitter') {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
  // Eyes, so the creatures read as alive, and a crown for the boss.
  ctx.fillStyle = '#0a0e1e';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.2, 2.5, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35, y - r * 0.2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (enemy.kind === 'boss') {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(x - 12, y - r - 2);
    ctx.lineTo(x - 6, y - r - 12);
    ctx.lineTo(x, y - r - 2);
    ctx.lineTo(x + 6, y - r - 12);
    ctx.lineTo(x + 12, y - r - 2);
    ctx.closePath();
    ctx.fill();
  }
  // Health bar above the creature.
  const w = r * 2;
  const pct = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x - w / 2, y - r - 9, w, 5);
  ctx.fillStyle = pct > 0.5 ? '#5fd68a' : pct > 0.25 ? '#ffd94d' : '#ff4d5e';
  ctx.fillRect(x - w / 2, y - r - 9, w * pct, 5);
}

function drawProjectiles(ctx, world) {
  for (const proj of world.projectiles) {
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.kind === 'rail' ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    if (proj.kind === 'rail') {
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(proj.x, proj.y);
      ctx.lineTo(proj.targetX, proj.targetY);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawParticles(ctx, world) {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTexts(ctx, world) {
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of world.texts) {
    ctx.globalAlpha = Math.min(1, t.life / 0.6);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawBuildGhost(ctx, world) {
  const hover = world.hover;
  if (!hover || world.screen !== 'play') return;
  const def = TOWERS[world.buildType];
  if (!def) return;
  const c = tileCenter(hover.col, hover.row);
  const ok = world.gold >= def.cost;
  const tile = world.towers.some((t) => t.col === hover.col && t.row === hover.row);
  ctx.fillStyle = ok && !tile ? 'rgba(95, 214, 138, 0.15)' : 'rgba(255, 77, 94, 0.15)';
  ctx.strokeStyle = ok && !tile ? '#5fd68a' : '#ff4d5e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c.x, c.y, def.range * TILE, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = def.color;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// The whole field, one frame. Shake offsets everything a few pixels when the core is hit.
export function drawWorld(ctx, world) {
  ctx.save();
  if (world.shake > 0) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawGrid(ctx);
  drawPath(ctx);
  drawCore(ctx, world);
  drawBuildGhost(ctx, world);
  for (const tower of world.towers) drawTower(ctx, tower, world.selected === tower);
  for (const enemy of world.enemies) drawEnemy(ctx, enemy);
  drawProjectiles(ctx, world);
  drawParticles(ctx, world);
  drawTexts(ctx, world);
  ctx.restore();
}
