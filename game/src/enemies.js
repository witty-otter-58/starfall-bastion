// The creatures that walk the path: what one is, how it moves from waypoint to waypoint, what
// slows it, what heals it, and what happens when it dies or reaches the core.
import { PATH_POINTS, TILE } from './config.js';
import { scaledStats } from './waves.js';

let nextId = 1;

export function pathLengthPx() {
  let total = 0;
  for (let i = 1; i < PATH_POINTS.length; i += 1) {
    const dx = (PATH_POINTS[i].x - PATH_POINTS[i - 1].x) * TILE;
    const dy = (PATH_POINTS[i].y - PATH_POINTS[i - 1].y) * TILE;
    total += Math.hypot(dx, dy);
  }
  return total;
}

// Waypoint centres in pixels, with the first one just off the left edge.
export function pathPixels() {
  return PATH_POINTS.map((p) => ({ x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE }));
}

export function makeEnemy(kind, wave) {
  const stats = scaledStats(kind, wave);
  const points = pathPixels();
  return {
    id: nextId += 1,
    kind,
    name: stats.name,
    x: points[0].x,
    y: points[0].y,
    waypoint: 1,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed * TILE,
    bounty: stats.bounty,
    lives: stats.lives,
    radius: stats.radius,
    color: stats.color,
    heal: stats.heal,
    slowUntil: 0,
    slowFactor: 1,
    distance: 0,
    dead: false,
    leaked: false,
    flash: 0,
  };
}

// How far along the path this enemy has walked, in pixels: the towers shoot the one furthest in.
export function enemyProgress(enemy) {
  return enemy.distance;
}

export function applySlow(enemy, factor, seconds, now) {
  enemy.slowFactor = Math.min(enemy.slowFactor, factor);
  enemy.slowUntil = Math.max(enemy.slowUntil, now + seconds);
}

export function stepEnemy(enemy, dt, now) {
  if (enemy.dead || enemy.leaked) return;
  if (enemy.flash > 0) enemy.flash -= dt;
  if (now > enemy.slowUntil) enemy.slowFactor = 1;
  const points = pathPixels();
  let remaining = enemy.speed * enemy.slowFactor * dt;
  while (remaining > 0 && enemy.waypoint < points.length) {
    const target = points[enemy.waypoint];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= remaining) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.distance += dist;
      remaining -= dist;
      enemy.waypoint += 1;
    } else {
      enemy.x += (dx / dist) * remaining;
      enemy.y += (dy / dist) * remaining;
      enemy.distance += remaining;
      remaining = 0;
    }
  }
  if (enemy.waypoint >= points.length) enemy.leaked = true;
}

// Healers mend the wounded around them; called once per tick for every live healer.
export function healerTick(healer, enemies, dt) {
  if (healer.dead || healer.leaked || healer.heal <= 0) return;
  for (const other of enemies) {
    if (other === healer || other.dead || other.leaked) continue;
    const d = Math.hypot(other.x - healer.x, other.y - healer.y);
    if (d < TILE * 1.5 && other.hp < other.maxHp) {
      other.hp = Math.min(other.maxHp, other.hp + healer.heal * dt);
    }
  }
}

// What a death leaves behind: a splitter breaks into two grunts at the same spot.
export function deathSpawns(enemy, wave) {
  if (enemy.kind !== 'splitter') return [];
  const children = [];
  for (let i = 0; i < 2; i += 1) {
    const child = makeEnemy('grunt', wave);
    child.x = enemy.x + (i === 0 ? -10 : 10);
    child.y = enemy.y;
    child.waypoint = enemy.waypoint;
    child.distance = enemy.distance;
    children.push(child);
  }
  return children;
}
