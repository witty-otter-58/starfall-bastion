// The screenshot scenes behind ?shot=title|play|victory|defeat. Each one plays the real rules
// forward from a fresh world with a simple autopilot that builds towers, starts waves and
// upgrades, so the frame is what a real game looks like and the same seed always gives the
// same frame. No state is faked: every tower on the field was bought with earned gold.
import { TILE, COLS, ROWS, TOTAL_WAVES, TOWERS, TOWER_ORDER } from './config.js';
import { pathTiles, isBuildable, buildTower, upgradeTower, startWave, stepWorld, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY, SCREEN_DEFEAT } from './world.js';
import { makeEnemy, stepEnemy } from './enemies.js';

const STEP = 1 / 60;
const PLAY_WAVE = 5;
const MAX_STEPS = 60 * 900;

// The tiles worth building on, best first: those with the most path in a pulse tower's reach.
export function goodTiles() {
  const path = pathTiles();
  const scored = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (path.has(`${col},${row}`)) continue;
      const cx = (col + 0.5) * TILE;
      const cy = (row + 0.5) * TILE;
      let cover = 0;
      for (const key of path) {
        const [pc, pr] = key.split(',').map(Number);
        const d = Math.hypot((pc + 0.5) * TILE - cx, (pr + 0.5) * TILE - cy);
        if (d <= 2.2 * TILE) cover += 1;
      }
      if (cover > 0) scored.push({ col, row, cover });
    }
  }
  scored.sort((a, b) => b.cover - a.cover || a.row - b.row || a.col - b.col);
  return scored;
}

// One autopilot decision per step: spend gold on the next good tile, upgrade what is built,
// and call the next wave when there is nothing left to buy.
function autopilot(world, tiles, next) {
  if (!world.waveActive && world.wave < TOTAL_WAVES) {
    const type = TOWER_ORDER[next.type % TOWER_ORDER.length];
    const spot = tiles[next.tile];
    if (spot && world.gold >= TOWERS[type].cost && isBuildable(world, spot.col, spot.row)) {
      if (buildTower(world, type, spot.col, spot.row) === null) {
        next.tile += 1;
        next.type += 1;
        return;
      }
    }
    // Nothing to build on the next tile: upgrade the weakest tower instead.
    const upgradable = world.towers.filter((t) => t.level < 3).sort((a, b) => a.level - b.level);
    for (const tower of upgradable) {
      if (upgradeTower(world, tower) === null) return;
    }
    startWave(world);
  }
}

function runUntil(world, stop, tiles) {
  const next = { tile: 0, type: 0 };
  world.audio.setMuted(true);
  for (let i = 0; i < MAX_STEPS; i += 1) {
    autopilot(world, tiles, next);
    stepWorld(world, STEP);
    if (stop(world)) break;
  }
  world.audio.setMuted(false);
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * title: a few creatures walking behind the title card. play: a mid-wave fight on wave 5.
 * victory: the autopilot's full game, won. defeat: no defence at all, the core overrun.
 */
export function stageShot(name, world) {
  world.screen = SCREEN_PLAY;
  const tiles = goodTiles();
  if (name === 'play') {
    // Wait until the wave is properly under way: most of it spawned and spread along the path.
    runUntil(world, (w) => w.wave >= PLAY_WAVE && (w.enemies.length >= 8 || w.spawnQueue.length <= 3), tiles);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'victory') {
    runUntil(world, (w) => w.screen === SCREEN_VICTORY || w.screen === SCREEN_DEFEAT, tiles);
    return { screen: world.screen === SCREEN_VICTORY ? SCREEN_VICTORY : SCREEN_DEFEAT };
  }
  if (name === 'defeat') {
    // No towers at all: the first waves walk straight through the core.
    world.audio.setMuted(true);
    for (let i = 0; i < MAX_STEPS; i += 1) {
      if (!world.waveActive && world.wave < TOTAL_WAVES) startWave(world);
      stepWorld(world, STEP);
      if (world.screen === SCREEN_DEFEAT) break;
    }
    world.audio.setMuted(false);
    return { screen: world.screen };
  }
  // title: a few creatures wander the path behind the title card, as ambience, not a wave:
  // no wave starts, no gold moves, no lives are lost — the HUD stays at wave 0.
  world.audio.setMuted(true);
  for (let i = 0; i < 6; i += 1) {
    const wanderer = makeEnemy(i % 2 === 0 ? 'grunt' : 'swift', 1);
    world.enemies.push(wanderer);
    for (let s = 0; s < (i + 1) * 90; s += 1) stepEnemy(wanderer, STEP, world.time);
  }
  world.audio.setMuted(false);
  return { screen: SCREEN_TITLE };
}
