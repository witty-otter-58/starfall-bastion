// Starfall Bastion: every number the game runs on, in one place. Change a number here and the
// whole game retunes: towers, enemies, waves, the map and the economy all read from this file.
export const TILE = 60;
export const COLS = 16;
export const ROWS = 10;
export const FIELD_W = COLS * TILE;
export const FIELD_H = ROWS * TILE;

export const START_GOLD = 220;
export const START_LIVES = 20;
export const TOTAL_WAVES = 20;
export const SELL_RATE = 0.7;
export const WAVE_CLEAR_BONUS = 25;
export const EARLY_CALL_BONUS = 15;
export const MAX_SPEED = 3;

// The path the void creatures walk, in tile coordinates: in from the left, three turns, out
// through the Bastion's core on the right edge. The core is the tile the path ends on.
export const PATH_POINTS = [
  { x: -1, y: 1 },
  { x: 3, y: 1 },
  { x: 3, y: 4 },
  { x: 11, y: 4 },
  { x: 11, y: 7 },
  { x: 15, y: 7 },
];
export const CORE_TILE = { x: 15, y: 7 };

// One tower type: what it costs, how far it reaches, what it hits for, how fast, and what makes
// it different. Range is in tiles; damage and rate are per shot and per second.
export const TOWERS = {
  pulse: {
    name: 'Pulse Blaster', key: '1', cost: 50, range: 2.2, damage: 8, rate: 2.5,
    color: '#39d5ff', desc: 'Cheap and quick. Sprays bolts at anything close.',
  },
  cannon: {
    name: 'Ember Cannon', key: '2', cost: 110, range: 2.0, damage: 26, rate: 0.8,
    splash: 1.0, color: '#ff9a3d', desc: 'Slow shells that burst and hurt a crowd.',
  },
  frost: {
    name: 'Frost Spire', key: '3', cost: 80, range: 2.0, damage: 3, rate: 1.2,
    slow: 0.45, slowTime: 1.2, color: '#8fd8ff', desc: 'Chills enemies, cutting their speed nearly in half.',
  },
  rail: {
    name: 'Railgun', key: '4', cost: 160, range: 4.5, damage: 70, rate: 0.5,
    color: '#ff5df2', desc: 'One huge bolt across the map. Slow to reload.',
  },
  coil: {
    name: 'Storm Coil', key: '5', cost: 130, range: 2.4, damage: 14, rate: 1.0,
    chain: 3, color: '#ffd94d', desc: 'Lightning that jumps to nearby enemies.',
  },
};
export const TOWER_ORDER = ['pulse', 'cannon', 'frost', 'rail', 'coil'];

// Upgrades: each level multiplies damage and range and adds a little rate. Level 1 is the build.
export const UPGRADE_LEVELS = [
  null,
  { costMult: 0.8, damageMult: 1.5, rangeMult: 1.1, rateMult: 1.0 },
  { costMult: 1.2, damageMult: 2.4, rangeMult: 1.2, rateMult: 1.15 },
];

// One enemy type: base health, speed in tiles per second, gold for killing it, lives it costs
// when it reaches the core, and its size on the field.
export const ENEMIES = {
  grunt: { name: 'Grunt', hp: 30, speed: 1.2, bounty: 6, lives: 1, radius: 13, color: '#7d8db0' },
  swift: { name: 'Swift', hp: 18, speed: 2.2, bounty: 8, lives: 1, radius: 11, color: '#5fd68a' },
  armored: { name: 'Bulwark', hp: 120, speed: 0.8, bounty: 12, lives: 2, radius: 15, color: '#b8c0cc' },
  healer: { name: 'Mender', hp: 50, speed: 1.0, bounty: 14, lives: 1, radius: 12, color: '#ff8fd0', heal: 8 },
  splitter: { name: 'Splitter', hp: 60, speed: 1.1, bounty: 10, lives: 1, radius: 14, color: '#b78cff' },
  boss: { name: 'Void Tyrant', hp: 900, speed: 0.6, bounty: 150, lives: 5, radius: 24, color: '#ff4d5e' },
};
// Which enemies a wave may contain, by wave number. Bosses arrive every fifth wave.
export const WAVE_UNLOCKS = [
  { wave: 1, types: ['grunt'] },
  { wave: 3, types: ['swift'] },
  { wave: 4, types: ['armored'] },
  { wave: 6, types: ['healer'] },
  { wave: 8, types: ['splitter'] },
];

// The look: one dark cosmic palette, used by every draw call so the game reads as one scene.
export const COLORS = {
  background: '#0a0e1e',
  grid: '#141b33',
  gridLine: '#1d2748',
  path: '#2a3358',
  pathEdge: '#3a4570',
  core: '#ffd94d',
  coreRing: '#ff9a3d',
  panel: '#10162a',
  panelEdge: '#232c4d',
  text: '#dfe6ff',
  dim: '#8a94b8',
  gold: '#ffd94d',
  lives: '#ff5d73',
  ok: '#5fd68a',
  danger: '#ff4d5e',
};
