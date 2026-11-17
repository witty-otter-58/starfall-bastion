// Starfall Bastion's shell: the page around the field. It builds the HUD and the screens, runs
// the loop, wires the input to the world, and stages the screenshot scenes (?shot=title|play|
// victory|defeat) for the maker's screenshots. The game rules live in world.js; this file is
// only the frame around them.
import { TILE, FIELD_W, FIELD_H, TOTAL_WAVES, TOWERS, TOWER_ORDER, COLORS } from './config.js';
import { createWorld, resetWorld, stepWorld, buildTower, upgradeTower, sellTower, startWave, towerAt, isBuildable, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_VICTORY, SCREEN_DEFEAT } from './world.js';
import { towerStats, upgradeCost } from './towers.js';
import { drawWorld } from './render.js';
import { bindInput } from './input.js';
import { stageShot } from './shots.js';
import { buildWave, unlockedTypes, isBossWave } from './waves.js';

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam === null ? undefined : Number(seedParam) || 0;
const shot = params.get('shot');

const world = createWorld(seed);
world.best = world.best || { wave: 0, score: 0 };

// --- The HUD and the screens, built once from the game's own numbers. ---
const el = {};
for (const id of ['gold', 'lives', 'wave', 'score', 'enemies', 'speed-btn', 'pause-btn', 'mute-btn', 'wave-btn', 'wave-preview', 'tower-bar', 'selected', 'title-screen', 'pause-screen', 'victory-screen', 'defeat-screen', 'victory-stats', 'defeat-stats', 'best-line', 'title-best']) {
  el[id] = document.getElementById(id);
}

function towerCard(type) {
  const def = TOWERS[type];
  const card = document.createElement('button');
  card.className = 'tower-card';
  card.dataset.type = type;
  card.innerHTML = `<span class="tower-dot" style="background:${def.color}"></span>
    <span class="tower-name">${def.name}</span>
    <span class="tower-cost">$${def.cost}</span>
    <span class="tower-key">${def.key}</span>
    <span class="tower-desc">${def.desc}</span>`;
  card.addEventListener('click', () => selectBuildType(type));
  return card;
}
for (const type of TOWER_ORDER) el['tower-bar'].appendChild(towerCard(type));

function selectBuildType(type) {
  world.buildType = type;
  world.selected = null;
  document.querySelectorAll('.tower-card').forEach((c) => c.classList.toggle('active', c.dataset.type === type));
  renderSelected();
}
selectBuildType('pulse');

function renderSelected() {
  const panel = el.selected;
  const tower = world.selected;
  if (!tower) {
    panel.innerHTML = `<h3>Build</h3><p>Pick a tower on the left, then click an empty tile on the field. Hotkeys 1–5 pick a tower, Space starts the next wave.</p>`;
    return;
  }
  const stats = towerStats(tower.type, tower.level);
  const cost = upgradeCost(tower.type, tower.level);
  const invested = Math.round(tower.invested * 0.7);
  panel.innerHTML = `<h3>${stats.name} <span class="lvl">Lv ${tower.level}</span></h3>
    <p>Damage ${Math.round(stats.damage)} · Range ${(stats.range / TILE).toFixed(1)} tiles · ${stats.rate.toFixed(1)} shots/s</p>
    <div class="row">
      <button id="upgrade-btn" ${cost === null ? 'disabled' : ''}>${cost === null ? 'Max level' : `Upgrade — $${cost}`}</button>
      <button id="sell-btn">Sell — $${invested}</button>
    </div>`;
  const upgradeBtn = document.getElementById('upgrade-btn');
  if (upgradeBtn) upgradeBtn.addEventListener('click', () => { upgradeTower(world, tower); renderSelected(); });
  document.getElementById('sell-btn').addEventListener('click', () => { sellTower(world, tower); renderSelected(); });
}

function wavePreviewText(wave) {
  if (wave > TOTAL_WAVES) return 'All waves cleared.';
  const list = buildWave(wave, () => 0.5);
  const counts = {};
  for (const kind of list) counts[kind] = (counts[kind] || 0) + 1;
  const parts = Object.entries(counts).map(([kind, n]) => `${n}× ${kind}`);
  return `Wave ${wave}${isBossWave(wave) ? ' — BOSS' : ''}: ${parts.join(', ')}`;
}

function showScreen(screen) {
  for (const [name, node] of [[SCREEN_TITLE, el['title-screen']], [SCREEN_PAUSE, el['pause-screen']], [SCREEN_VICTORY, el['victory-screen']], [SCREEN_DEFEAT, el['defeat-screen']]]) {
    node.classList.toggle('hidden', screen !== name);
  }
  if (screen === SCREEN_VICTORY && world.victoryStats) {
    const s = world.victoryStats;
    el['victory-stats'].innerHTML = `Score <b>${s.score}</b> · ${s.kills} creatures stopped · $${s.goldEarned} earned · ${s.leaked} leaked`;
  }
  if (screen === SCREEN_DEFEAT) {
    el['defeat-stats'].innerHTML = `The core fell on wave <b>${world.wave}</b> of ${TOTAL_WAVES} · Score <b>${world.score}</b> · ${world.kills} creatures stopped`;
  }
  if (screen === SCREEN_TITLE) {
    el['title-best'].textContent = world.best.score > 0
      ? `Best so far: wave ${world.best.wave} · score ${world.best.score}`
      : 'No bastion has held yet. Be the first.';
  }
}

function updateHud() {
  el.gold.textContent = `$${world.gold}`;
  el.lives.textContent = `♥ ${world.lives}`;
  el.lives.classList.toggle('low', world.lives <= 5);
  el.wave.textContent = `Wave ${Math.min(world.wave, TOTAL_WAVES)}/${TOTAL_WAVES}`;
  el.score.textContent = `Score ${world.score}`;
  const remaining = world.spawnQueue.length + world.enemies.length;
  el.enemies.textContent = world.waveActive ? `${remaining} left` : '—';
  el['speed-btn'].textContent = `${world.speed}×`;
  el['wave-btn'].disabled = world.waveActive || world.wave >= TOTAL_WAVES || world.screen !== SCREEN_PLAY;
  el['wave-btn'].textContent = world.wave >= TOTAL_WAVES ? 'All waves cleared' : world.waveActive ? 'Wave in progress…' : `Start wave ${world.wave + 1}`;
  el['wave-preview'].textContent = world.wave >= TOTAL_WAVES ? 'The bastion stands.' : wavePreviewText(world.wave + 1);
  el['best-line'].textContent = `Best: wave ${world.best.wave} · score ${world.best.score}`;
}

// --- The verbs: what a click or a key does to the world. ---
function doBuild(col, row) {
  const tower = towerAt(world, col, row);
  if (tower) {
    world.selected = tower;
    renderSelected();
    return;
  }
  const problem = buildTower(world, world.buildType, col, row);
  if (problem === null) renderSelected();
  else world.selected = null;
}

function doWave() {
  if (world.screen !== SCREEN_PLAY) return;
  startWave(world);
}

function doPause() {
  if (world.screen === SCREEN_PLAY) { world.screen = SCREEN_PAUSE; showScreen(SCREEN_PAUSE); }
  else if (world.screen === SCREEN_PAUSE) { world.screen = SCREEN_PLAY; showScreen(SCREEN_PLAY); }
}

function doSpeed() {
  world.speed = world.speed >= 3 ? 1 : world.speed + 1;
}

function doMute() {
  world.audio.setMuted(!world.audio.isMuted());
  el['mute-btn'].textContent = world.audio.isMuted() ? '🔇' : '🔊';
}

function doRestart() {
  resetWorld(world, seed);
  selectBuildType('pulse');
  showScreen(SCREEN_PLAY);
  updateHud();
}

bindInput(canvas, {
  onHover: (tile) => { world.hover = tile; },
  onTile: (col, row) => { if (world.screen === SCREEN_PLAY) doBuild(col, row); },
  onDeselect: () => { world.selected = null; renderSelected(); },
  onTowerKey: (type) => selectBuildType(type),
  onAction: (action) => {
    if (action === 'wave') doWave();
    else if (action === 'pause') doPause();
    else if (action === 'speed') doSpeed();
    else if (action === 'mute') doMute();
    else if (action === 'restart') doRestart();
    else if (action === 'upgrade' && world.selected) { upgradeTower(world, world.selected); renderSelected(); }
    else if (action === 'sell' && world.selected) { sellTower(world, world.selected); renderSelected(); }
  },
});

el['wave-btn'].addEventListener('click', () => { world.audio.unlock(); doWave(); });
el['speed-btn'].addEventListener('click', doSpeed);
el['pause-btn'].addEventListener('click', doPause);
el['mute-btn'].addEventListener('click', () => { world.audio.unlock(); doMute(); });
document.getElementById('start-btn').addEventListener('click', () => {
  world.audio.unlock();
  world.screen = SCREEN_PLAY;
  showScreen(SCREEN_PLAY);
});
document.getElementById('resume-btn').addEventListener('click', doPause);
document.getElementById('restart-btn').addEventListener('click', doRestart);
document.getElementById('victory-again-btn').addEventListener('click', doRestart);
document.getElementById('defeat-again-btn').addEventListener('click', doRestart);

// --- The loop: step the world, draw it, keep the HUD honest. ---
let last = performance.now();
let lastScreen = world.screen;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stepWorld(world, dt);
  drawWorld(ctx, world);
  if (world.screen !== lastScreen) {
    lastScreen = world.screen;
    showScreen(world.screen);
  }
  updateHud();
  requestAnimationFrame(frame);
}

if (shot) {
  // A staged screenshot: play the scene, draw one frame, and stop. The frame is the game.
  const staged = stageShot(shot, world);
  world.screen = staged.screen;
  if (staged.screen === SCREEN_PLAY && world.wave === 0) world.screen = SCREEN_PLAY;
  drawWorld(ctx, world);
  showScreen(staged.screen);
  updateHud();
} else {
  showScreen(SCREEN_TITLE);
  updateHud();
  requestAnimationFrame(frame);
}
