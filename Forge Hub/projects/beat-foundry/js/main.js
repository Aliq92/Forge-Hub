import { initApp } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
  try {
    initApp();
  } catch (err) {
    // Never surface raw Web Audio / DOM errors to the user — fail as quietly as possible.
    // eslint-disable-next-line no-console
    console.error('Beat Foundry failed to initialize:', err);
    const gate = document.getElementById('audioGate');
    if (gate) {
      const card = gate.querySelector('.audio-gate-card p');
      if (card) card.textContent = 'Something went wrong loading Beat Foundry. Try reloading the page.';
    }
  }
});
