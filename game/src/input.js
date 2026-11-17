// The player's hands: the mouse over the field and the keyboard shortcuts. This file reads
// events and reports what they mean; the world decides what they do.
import { tileAt } from './world.js';

const KEYS = {
  1: 'pulse', 2: 'cannon', 3: 'frost', 4: 'rail', 5: 'coil',
};

// Wire a canvas and the keyboard to the game's verbs. Each handler gets plain facts, never
// event objects: which tile was clicked or hovered, and which named action a key means.
export function bindInput(canvas, handlers) {
  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener('mousemove', (event) => {
    const p = canvasPoint(event);
    handlers.onHover(tileAt(p.x, p.y));
  });
  canvas.addEventListener('mouseleave', () => handlers.onHover(null));
  canvas.addEventListener('click', (event) => {
    const p = canvasPoint(event);
    const tile = tileAt(p.x, p.y);
    if (tile) handlers.onTile(tile.col, tile.row);
  });
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    handlers.onDeselect();
  });

  window.addEventListener('keydown', (event) => {
    if (event.target && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) return;
    const key = event.key.toLowerCase();
    if (KEYS[event.key]) {
      handlers.onTowerKey(KEYS[event.key]);
      return;
    }
    if (key === ' ') { event.preventDefault(); handlers.onAction('wave'); }
    else if (key === 'p' || key === 'escape') handlers.onAction('pause');
    else if (key === 'f') handlers.onAction('speed');
    else if (key === 'm') handlers.onAction('mute');
    else if (key === 'r') handlers.onAction('restart');
    else if (key === 'u') handlers.onAction('upgrade');
    else if (key === 'x') handlers.onAction('sell');
  });
}
