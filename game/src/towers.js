// The towers: what one is, what it costs to build and raise, what it shoots, and how it picks
// its target. A tower's stats come from its type and its level; the world asks it to fire.
import { TOWERS, UPGRADE_LEVELS, TILE } from './config.js';

export function towerStats(type, level) {
  const base = TOWERS[type];
  const mult = UPGRADE_LEVELS[level - 1] || { damageMult: 1, rangeMult: 1, rateMult: 1 };
  return {
    name: base.name,
    color: base.color,
    cost: base.cost,
    range: base.range * TILE * (mult.rangeMult || 1),
    damage: base.damage * (mult.damageMult || 1),
    rate: base.rate * (mult.rateMult || 1),
    splash: (base.splash || 0) * TILE,
    slow: base.slow || 0,
    slowTime: base.slowTime || 0,
    chain: base.chain || 0,
  };
}

export function upgradeCost(type, level) {
  const base = TOWERS[type];
  const next = UPGRADE_LEVELS[level];
  if (!next) return null;
  return Math.round(base.cost * next.costMult);
}

export function makeTower(type, col, row) {
  return {
    type,
    col,
    row,
    x: (col + 0.5) * TILE,
    y: (row + 0.5) * TILE,
    level: 1,
    invested: TOWERS[type].cost,
    cooldown: 0,
    angle: -Math.PI / 2,
    flash: 0,
  };
}

// The enemy furthest along the path inside the tower's range, or null when none is in reach.
export function pickTarget(tower, enemies) {
  const stats = towerStats(tower.type, tower.level);
  let best = null;
  let bestDistance = -1;
  for (const enemy of enemies) {
    if (enemy.dead || enemy.leaked) continue;
    const d = Math.hypot(enemy.x - tower.x, enemy.y - tower.y);
    if (d > stats.range + enemy.radius) continue;
    if (enemy.distance > bestDistance) {
      bestDistance = enemy.distance;
      best = enemy;
    }
  }
  return best;
}

// One firing: the tower turns toward its target and hands the world a projectile to fly.
// Returns the projectile, or null when the tower is still cooling down.
export function fireTower(tower, target, dt) {
  tower.cooldown -= dt;
  if (tower.cooldown > 0 || !target) return null;
  const stats = towerStats(tower.type, tower.level);
  tower.cooldown = 1 / stats.rate;
  tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  tower.flash = 0.08;
  return {
    kind: tower.type,
    x: tower.x,
    y: tower.y,
    targetId: target.id,
    targetX: target.x,
    targetY: target.y,
    damage: stats.damage,
    splash: stats.splash,
    slow: stats.slow,
    slowTime: stats.slowTime,
    chain: stats.chain,
    speed: tower.type === 'rail' ? 1400 : 520,
    color: stats.color,
    dead: false,
  };
}

export function stepTower(tower, dt) {
  if (tower.flash > 0) tower.flash -= dt;
}
