// How a wave is built: how many enemies, which kinds, in what order, and how fast they come.
// Every wave is a list of enemy kinds; the count grows with the wave, new kinds unlock as the
// waves go on, and a boss leads the fifth, tenth, fifteenth and final waves.
import { ENEMIES, TOTAL_WAVES, WAVE_UNLOCKS } from './config.js';
import { shuffle } from './random.js';

export function unlockedTypes(wave) {
  const types = [];
  for (const unlock of WAVE_UNLOCKS) {
    if (wave >= unlock.wave) types.push(...unlock.types);
  }
  return types;
}

export function isBossWave(wave) {
  return wave % 5 === 0;
}

export function waveSize(wave) {
  return 8 + wave * 2;
}

export function spawnInterval(wave) {
  return Math.max(0.35, 1.0 - wave * 0.03);
}

// The scaled stats of one enemy kind on a wave: health and speed grow, and so does the bounty.
export function scaledStats(kind, wave) {
  const base = ENEMIES[kind];
  const hpMult = 1 + 0.2 * (wave - 1);
  const speedMult = Math.min(1.3, 1 + 0.02 * (wave - 1));
  const bountyMult = 1 + 0.05 * (wave - 1);
  return {
    kind,
    name: base.name,
    hp: Math.round(base.hp * hpMult),
    speed: base.speed * speedMult,
    bounty: Math.round(base.bounty * bountyMult),
    lives: base.lives,
    radius: base.radius,
    color: base.color,
    heal: base.heal || 0,
  };
}

// The wave's spawn list: a boss first on boss waves, then the mix, shuffled so the player
// cannot memorise the order, with the count from waveSize.
export function buildWave(wave, rng) {
  const types = unlockedTypes(wave);
  const list = [];
  if (isBossWave(wave)) {
    list.push('boss');
    if (wave === TOTAL_WAVES) list.push('boss');
  }
  const count = waveSize(wave);
  const weights = { grunt: 5, swift: 3, armored: 2, healer: 1, splitter: 2 };
  const bag = [];
  for (const type of types) {
    const w = weights[type] || 1;
    for (let i = 0; i < w; i += 1) bag.push(type);
  }
  for (let i = 0; i < count; i += 1) {
    list.push(bag[Math.floor(rng() * bag.length)]);
  }
  // Keep the boss at the front and shuffle only the rest.
  const head = isBossWave(wave) ? list.slice(0, wave === TOTAL_WAVES ? 2 : 1) : [];
  const rest = shuffle(rng, list.slice(head.length));
  return [...head, ...rest];
}
