// The game itself: the state, the rules, and one fixed step of time. The renderer draws this
// state and the input layer calls its verbs; nothing else in the game mutates it.
import {
  TILE, COLS, ROWS, FIELD_W, FIELD_H, START_GOLD, START_LIVES, TOTAL_WAVES,
  SELL_RATE, WAVE_CLEAR_BONUS, EARLY_CALL_BONUS, PATH_POINTS, CORE_TILE, TOWERS,
} from './config.js';
import { makeRng } from './random.js';
import { buildWave, spawnInterval, isBossWave } from './waves.js';
import { makeEnemy, stepEnemy, healerTick, deathSpawns, applySlow } from './enemies.js';
import { makeTower, towerStats, upgradeCost, pickTarget, fireTower, stepTower } from './towers.js';
import { makeAudio } from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_VICTORY = 'victory';
export const SCREEN_DEFEAT = 'defeat';

// Every tile the path walks on, so nothing can be built there.
export function pathTiles() {
  const tiles = new Set();
  for (let i = 1; i < PATH_POINTS.length; i += 1) {
    const a = PATH_POINTS[i - 1];
    const b = PATH_POINTS[i];
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    let x = a.x;
    let y = a.y;
    tiles.add(`${x},${y}`);
    while (x !== b.x || y !== b.y) {
      if (x !== b.x) x += dx;
      else y += dy;
      tiles.add(`${x},${y}`);
    }
  }
  return tiles;
}

const PATH = pathTiles();

export function createWorld(seed) {
  const rng = makeRng(seed === undefined ? (Date.now() % 2147483647) : seed);
  const best = { wave: 0, score: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem('starfall-bastion-best') || 'null');
    if (saved) { best.wave = saved.wave || 0; best.score = saved.score || 0; }
  } catch { /* a fresh browser has no best yet */ }
  return {
    rng,
    audio: makeAudio(),
    screen: SCREEN_TITLE,
    time: 0,
    speed: 1,
    gold: START_GOLD,
    lives: START_LIVES,
    wave: 0,
    score: 0,
    kills: 0,
    goldEarned: 0,
    leaked: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveActive: false,
    betweenWaves: false,
    shake: 0,
    selected: null,
    buildType: 'pulse',
    hover: null,
    best,
    victoryStats: null,
  };
}

export function saveBest(world) {
  const wave = Math.max(world.best.wave, world.wave);
  const score = Math.max(world.best.score, world.score);
  world.best = { wave, score };
  try {
    localStorage.setItem('starfall-bastion-best', JSON.stringify(world.best));
  } catch { /* storage may be unavailable; the game plays on */ }
}

export function tileAt(px, py) {
  const col = Math.floor(px / TILE);
  const row = Math.floor(py / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row };
}

export function isBuildable(world, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  if (PATH.has(`${col},${row}`)) return false;
  if (col === CORE_TILE.x && row === CORE_TILE.y) return false;
  return !world.towers.some((t) => t.col === col && t.row === row);
}

export function towerAt(world, col, row) {
  return world.towers.find((t) => t.col === col && t.row === row) || null;
}

export function buildTower(world, type, col, row) {
  const def = TOWERS[type];
  if (!def) return 'no such tower';
  if (!isBuildable(world, col, row)) return 'nothing builds there';
  if (world.gold < def.cost) return 'not enough gold';
  world.gold -= def.cost;
  world.towers.push(makeTower(type, col, row));
  world.audio.build();
  return null;
}

export function upgradeTower(world, tower) {
  const cost = upgradeCost(tower.type, tower.level);
  if (cost === null) return 'already at its best';
  if (world.gold < cost) return 'not enough gold';
  world.gold -= cost;
  tower.invested += cost;
  tower.level += 1;
  world.audio.upgrade();
  addText(world, tower.x, tower.y - 30, `LEVEL ${tower.level}`, '#ffd94d');
  return null;
}

export function sellTower(world, tower) {
  const refund = Math.round(tower.invested * SELL_RATE);
  world.gold += refund;
  world.towers = world.towers.filter((t) => t !== tower);
  if (world.selected === tower) world.selected = null;
  addText(world, tower.x, tower.y - 30, `+$${refund}`, '#ffd94d');
  world.audio.coin();
}

export function startWave(world) {
  if (world.waveActive || world.wave >= TOTAL_WAVES || world.screen !== SCREEN_PLAY) return false;
  const early = world.betweenWaves;
  world.wave += 1;
  world.spawnQueue = buildWave(world.wave, world.rng);
  world.spawnTimer = 0.5;
  world.waveActive = true;
  world.betweenWaves = false;
  if (early) {
    world.gold += EARLY_CALL_BONUS;
    addText(world, FIELD_W / 2, 40, `EARLY CALL +$${EARLY_CALL_BONUS}`, '#ffd94d');
  }
  world.audio.horn();
  return true;
}

function addText(world, x, y, text, color) {
  world.texts.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
}

function burst(world, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = world.rng() * Math.PI * 2;
    const v = (0.3 + world.rng() * 0.7) * (speed || 120);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 0.5 + world.rng() * 0.3, maxLife: 0.8,
      color, size: 2 + world.rng() * 3,
    });
  }
}

function damageEnemy(world, enemy, amount) {
  if (enemy.dead || enemy.leaked) return;
  enemy.hp -= amount;
  enemy.flash = 0.1;
  if (enemy.hp <= 0) killEnemy(world, enemy);
}

function killEnemy(world, enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  world.kills += 1;
  world.gold += enemy.bounty;
  world.goldEarned += enemy.bounty;
  world.score += enemy.bounty * 10;
  addText(world, enemy.x, enemy.y - 18, `+$${enemy.bounty}`, '#ffd94d');
  burst(world, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 26 : 10, 140);
  world.audio.coin();
  if (enemy.kind === 'boss') {
    world.shake = Math.max(world.shake, 8);
    world.audio.explosion();
  }
  for (const child of deathSpawns(enemy, world.wave)) world.enemies.push(child);
}

function hitProjectile(world, proj) {
  const target = world.enemies.find((e) => e.id === proj.targetId);
  if (!target || target.dead || target.leaked) return;
  if (proj.splash > 0) {
    burst(world, target.x, target.y, '#ff9a3d', 14, 160);
    world.audio.explosion();
    for (const enemy of world.enemies) {
      if (enemy.dead || enemy.leaked) continue;
      const d = Math.hypot(enemy.x - target.x, enemy.y - target.y);
      if (d <= proj.splash + enemy.radius) damageEnemy(world, enemy, proj.damage);
    }
    return;
  }
  if (proj.slow > 0) {
    applySlow(target, 1 - proj.slow, proj.slowTime, world.time);
    burst(world, target.x, target.y, '#8fd8ff', 5, 60);
  }
  damageEnemy(world, target, proj.damage);
  if (proj.chain > 0) {
    let from = target;
    let hits = 0;
    const hitIds = new Set([target.id]);
    while (hits < proj.chain - 1) {
      let next = null;
      let nextD = Infinity;
      for (const enemy of world.enemies) {
        if (enemy.dead || enemy.leaked || hitIds.has(enemy.id)) continue;
        const d = Math.hypot(enemy.x - from.x, enemy.y - from.y);
        if (d < TILE * 1.6 && d < nextD) { nextD = d; next = enemy; }
      }
      if (!next) break;
      hitIds.add(next.id);
      damageEnemy(world, next, proj.damage);
      burst(world, next.x, next.y, '#ffd94d', 4, 80);
      from = next;
      hits += 1;
    }
  }
}

function stepProjectiles(world, dt) {
  for (const proj of world.projectiles) {
    if (proj.dead) continue;
    const target = world.enemies.find((e) => e.id === proj.targetId);
    if (target && !target.dead && !target.leaked) {
      proj.targetX = target.x;
      proj.targetY = target.y;
    }
    const dx = proj.targetX - proj.x;
    const dy = proj.targetY - proj.y;
    const dist = Math.hypot(dx, dy);
    const step = proj.speed * dt;
    if (dist <= step + 10) {
      proj.x = proj.targetX;
      proj.y = proj.targetY;
      hitProjectile(world, proj);
      proj.dead = true;
    } else {
      proj.x += (dx / dist) * step;
      proj.y += (dy / dist) * step;
    }
  }
  world.projectiles = world.projectiles.filter((p) => !p.dead);
}

function stepParticles(world, dt) {
  for (const p of world.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.life -= dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const t of world.texts) {
    t.y -= 30 * dt;
    t.life -= dt;
  }
  world.texts = world.texts.filter((t) => t.life > 0);
}

function endWave(world) {
  world.waveActive = false;
  const bonus = WAVE_CLEAR_BONUS + world.wave * 5;
  world.gold += bonus;
  world.score += 100 * world.wave;
  addText(world, FIELD_W / 2, 40, `WAVE ${world.wave} CLEAR +$${bonus}`, '#5fd68a');
  world.audio.coin();
  if (world.wave >= TOTAL_WAVES) {
    world.screen = SCREEN_VICTORY;
    world.victoryStats = {
      score: world.score, kills: world.kills, goldEarned: world.goldEarned, leaked: world.leaked,
    };
    saveBest(world);
    world.audio.win();
  } else {
    world.betweenWaves = true;
  }
}

// One fixed step of the game, dt seconds of real time, scaled by the speed the player chose.
export function stepWorld(world, dt) {
  if (world.screen !== SCREEN_PLAY) return;
  const scaled = dt * world.speed;
  world.time += scaled;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - 30 * scaled);

  if (world.waveActive && world.spawnQueue.length > 0) {
    world.spawnTimer -= scaled;
    if (world.spawnTimer <= 0) {
      const kind = world.spawnQueue.shift();
      world.enemies.push(makeEnemy(kind, world.wave));
      world.spawnTimer = spawnInterval(world.wave);
    }
  }

  for (const enemy of world.enemies) stepEnemy(enemy, scaled, world.time);
  for (const enemy of world.enemies) healerTick(enemy, world.enemies, scaled);

  for (const tower of world.towers) {
    stepTower(tower, scaled);
    const target = pickTarget(tower, world.enemies);
    const proj = fireTower(tower, target, scaled);
    if (proj) {
      world.projectiles.push(proj);
      world.audio.shoot(tower.type);
    }
  }
  stepProjectiles(world, scaled);

  // Leaks: whatever reaches the core costs lives, and a shaken core says so.
  for (const enemy of world.enemies) {
    if (enemy.leaked && !enemy.dead) {
      enemy.dead = true;
      world.lives -= enemy.lives;
      world.leaked += 1;
      world.shake = Math.max(world.shake, 10);
      world.audio.leak();
      addText(world, FIELD_W - 40, (CORE_TILE.y + 0.5) * TILE, `-${enemy.lives} ♥`, '#ff5d73');
    }
  }
  world.enemies = world.enemies.filter((e) => !e.dead);

  stepParticles(world, scaled);

  if (world.lives <= 0) {
    world.lives = 0;
    world.screen = SCREEN_DEFEAT;
    saveBest(world);
    world.audio.lose();
    return;
  }
  if (world.waveActive && world.spawnQueue.length === 0 && world.enemies.length === 0) {
    endWave(world);
  }
}

export function resetWorld(world, seed) {
  const fresh = createWorld(seed);
  fresh.best = world.best;
  Object.keys(world).forEach((k) => { delete world[k]; });
  Object.assign(world, fresh);
  world.screen = SCREEN_PLAY;
}
