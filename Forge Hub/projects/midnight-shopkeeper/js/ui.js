import { Game, reputationTier, relationshipTier, REPUTATION_TIERS } from './state.js';
import { ITEMS, ITEM_LIST } from './data/items.js';
import { RECIPES } from './data/recipes.js';
import { UPGRADES, UPGRADE_LIST } from './data/upgrades.js';
import { NIGHTS, EVENTS } from './data/nights.js';
import { getSupplierOffer } from './data/supplier.js';
import { ENDINGS } from './data/endings.js';
import {
  startNight, currentEncounter, isNightOver, applySale, applyRefusal, applyStoryGift,
  applySellToShop, applyGift, finishNight, goToSupplier, buyItem, buyMysteryCrate,
  purchaseUpgrade, advanceToNextNight, currentNightDef,
} from './engine/gameFlow.js';
import { getModifiers, inventoryTotal, upgradeNextLevel } from './engine/shop.js';
import { formatShopTime } from './engine/time.js';
import { craft, availableRecipes, canCraft } from './engine/crafting.js';
import { getJournal } from './engine/journal.js';
import { computePrice, PRICE_CHOICES } from './engine/economy.js';
import { renderPortrait } from './portraits.js';
import { itemIcon } from './icons.js';
import { RainEffect } from './rain.js';
import * as Audio from './audio.js';

let root = null;
let screen = 'TITLE'; // TITLE | HOWTO | SETTINGS | GAME | JOURNAL
let previousScreen = 'TITLE';
let settingsReturn = 'TITLE';

let enc = null; // ephemeral dialogue state for the active encounter
let modal = null;
let offerMode = false;
let combineMode = false;
let combineSel = [];
let confirmBox = null;
let journalTab = 'customers';
let supplierTab = 'stock';
let categoryFilter = 'ALL';

const rainFX = {};

export function mount(rootEl) {
  root = rootEl;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal) { modal = null; render(); }
      else if (confirmBox) { confirmBox = null; render(); }
      else if (screen === 'JOURNAL') { screen = previousScreen; render(); }
    }
  });
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  render();
}

function announce(text) {
  const el = document.getElementById('sr-announcer');
  if (el) el.textContent = text;
}

function showSaved() {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => el.classList.remove('show'), 1200);
}

function doSave() { Game.save(); showSaved(); }

function applySfx(setting) {
  Audio.setVolumes(Game.settings.musicVolume, Game.settings.sfxVolume);
}

// ===================== Root render dispatcher =====================
function render() {
  if (!root) return;
  document.body.classList.toggle('reduced-motion', !!Game.settings?.reducedMotion);
  document.body.classList.toggle('high-contrast', !!Game.settings?.highContrast);

  let html = '';
  if (screen === 'TITLE') html = renderTitle();
  else if (screen === 'HOWTO') html = renderHowTo();
  else if (screen === 'SETTINGS') html = renderSettings();
  else if (screen === 'JOURNAL') html = renderJournal();
  else if (screen === 'GAME') html = renderGame();

  root.innerHTML = html + renderModals();
  afterRender();
}

function afterRender() {
  mountRain('title-rain', 110, screen === 'TITLE');
  mountRain('shop-rain', 46, screen === 'GAME' && Game.state?.nightPhase === 'SHOP');
  if (screen === 'GAME' && Game.state?.nightPhase === 'SHOP' && enc) {
    const t = document.querySelector('.dialogue-text');
    if (t) t.scrollTop = t.scrollHeight;
  }
}

function mountRain(id, count, shouldRun) {
  const canvas = document.getElementById(id);
  const existing = rainFX[id];
  if (!canvas) { if (existing) { existing.destroy(); delete rainFX[id]; } return; }
  if (existing && existing.canvas !== canvas) { existing.destroy(); delete rainFX[id]; }
  if (!rainFX[id]) rainFX[id] = new RainEffect(canvas, { count });
  rainFX[id].setReducedMotion(!!Game.settings?.reducedMotion);
  if (shouldRun && Game.settings?.rainEffects !== false) rainFX[id].start();
  else rainFX[id].stop();
}

// ===================== Title screen =====================
function renderTitle() {
  const hasSave = Game.hasSave();
  return `
  <div class="title-screen">
    <div class="title-bg">
      <div class="sky"></div>
      <div class="shop-silhouette">
        <div class="roofline"></div>
        <div class="building"></div>
        <div class="window"></div>
        <div class="door"></div>
        <div class="sign"><div class="post"></div><div class="board">THE MIDNIGHT SHOP</div></div>
      </div>
      <div class="silhouette-figure" style="animation-delay:-4s;"></div>
      <div class="silhouette-figure" style="animation-delay:-14s; bottom: 2px; opacity:0.35;"></div>
      <div class="fog-layer"></div>
      <canvas id="title-rain" class="rain-canvas"></canvas>
    </div>
    <div class="title-content">
      <div class="title-logo">
        <div class="subtitle">a shop that opens after midnight</div>
        <h1>Midnight Shopkeeper</h1>
      </div>
      <div class="title-menu">
        <button class="btn btn-primary" data-action="title:new-game">Open the Shop</button>
        <button class="btn" data-action="title:continue" ${hasSave ? '' : 'disabled aria-disabled="true"'}>Continue</button>
        <button class="btn" data-action="title:howto">How to Play</button>
        <button class="btn" data-action="title:settings">Settings</button>
      </div>
      <div class="title-footnote">Rain on the glass. A lantern still lit. Someone is always awake at this hour.</div>
    </div>
  </div>`;
}

// ===================== How to play =====================
function renderHowTo() {
  return `
  <div class="overlay-screen">
    <div class="overlay-header">
      <h2>How to Play</h2>
      <button class="btn btn-sm" data-action="nav:back">Close</button>
    </div>
    <div class="overlay-body">
      <div class="card">
        <h3>The Shop</h3>
        <p>You keep a small shop that only opens after midnight. Strange customers arrive asking for things in roundabout, emotional, or oddly specific ways. Your job is to figure out what they actually need.</p>
      </div>
      <div class="card">
        <h3>Reading a Request</h3>
        <p>Listen to what a customer says, then ask up to a couple of follow-up questions if any are offered. Their words are the clue — pay attention to feelings, situations, and specifics. Then inspect your shelves: every item's description and tags hint at what it's good for.</p>
      </div>
      <div class="card">
        <h3>Making the Sale</h3>
        <p>Tap an item to inspect it, then offer it to the customer and choose a price — Cheap, Fair, or Expensive. A well-matched item and a fair price make for happy customers, better tips, and a stronger reputation. A poor match, or an unreasonable price, can cost you both.</p>
        <p>You can also simply let a customer go without buying anything, if nothing on your shelves feels right — or if something feels wrong about the request.</p>
      </div>
      <div class="card">
        <h3>Combining Items</h3>
        <p>Some items can be combined into something new. Use the Combine tool on your shelves to try pairing two items together — some recipes you'll know already, others you'll only discover by trying.</p>
      </div>
      <div class="card">
        <h3>Reputation, Relationships, and the Journal</h3>
        <p>Reputation grows with good matches and fair dealing. Recurring visitors remember what you sold them and how you treated them — build trust, and their stories deepen. Your journal automatically records everyone you meet, everything you learn about your stock, and rumors you overhear.</p>
      </div>
      <div class="card">
        <h3>Restocking</h3>
        <p>At the end of each night, a supplier can restock your shelves — common goods, rarer curios, a mystery crate, and sometimes a special order worth thinking ahead about. You can also spend your earnings on shop upgrades.</p>
      </div>
      <div class="center-text" style="margin-top:1rem;">
        <button class="btn btn-primary" data-action="nav:back">Got it</button>
      </div>
    </div>
  </div>`;
}

// ===================== Settings =====================
function renderSettings() {
  const s = Game.settings;
  return `
  <div class="overlay-screen">
    <div class="overlay-header">
      <h2>Settings</h2>
      <button class="btn btn-sm" data-action="nav:back">Close</button>
    </div>
    <div class="overlay-body">
      <div class="card">
        <div class="setting-row"><label for="musicVolume">Music &amp; Ambience Volume</label>
          <input type="range" id="musicVolume" min="0" max="1" step="0.05" value="${s.musicVolume}" data-setting="musicVolume"></div>
        <div class="setting-row"><label for="sfxVolume">Sound Effects Volume</label>
          <input type="range" id="sfxVolume" min="0" max="1" step="0.05" value="${s.sfxVolume}" data-setting="sfxVolume"></div>
        <div class="setting-row"><label for="textSpeed">Text Speed</label>
          <select id="textSpeed" data-setting="textSpeed">
            ${['instant', 'fast', 'normal', 'slow'].map(v => `<option value="${v}" ${s.textSpeed === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}
          </select></div>
      </div>
      <div class="card">
        ${toggleRow('reducedMotion', 'Reduced Motion', s.reducedMotion)}
        ${toggleRow('rainEffects', 'Rain Effects', s.rainEffects)}
        ${toggleRow('screenEffects', 'Screen Effects (flicker, fog)', s.screenEffects)}
        ${toggleRow('tooltips', 'Show Tooltips', s.tooltips)}
        ${toggleRow('highContrast', 'High Contrast', s.highContrast)}
      </div>
      <div class="card">
        <h3>Save Data</h3>
        <p class="muted small">Your progress saves automatically as you play.</p>
        <button class="btn btn-danger" data-action="settings:reset">Erase Save &amp; Start Over</button>
      </div>
    </div>
  </div>`;
}
function toggleRow(key, label, val) {
  return `<div class="setting-row"><label>${label}</label>
    <button class="toggle" role="switch" aria-checked="${!!val}" data-action="settings:toggle" data-toggle="${key}"><span class="knob"></span></button></div>`;
}

// ===================== Journal =====================
function renderJournal() {
  const j = getJournal(Game.state);
  const tabs = [['customers', 'Customers'], ['items', 'Items'], ['recipes', 'Recipes'], ['rumors', 'Rumors']];
  let body = '';
  if (journalTab === 'customers') {
    body = j.customers.map(c => `
      <div class="card journal-entry">
        <div class="thumb">${c.met ? renderPortrait(c.portrait, 'neutral') : ''}</div>
        <div>
          <h3>${c.met ? c.name : '???'}</h3>
          ${c.met ? `<p class="muted small">${c.title} · ${c.tier.label} (${c.appearancesSeen}/${c.totalAppearances} visits)</p>` : '<p class="muted small">Not yet met.</p>'}
        </div>
      </div>`).join('');
  } else if (journalTab === 'items') {
    const sorted = [...j.items].sort((a, b) => a.name.localeCompare(b.name));
    body = sorted.length ? sorted.map(it => `
      <div class="card journal-entry">
        <div class="thumb">${itemIcon(it)}</div>
        <div>
          <h3>${it.name}</h3>
          <p class="small">${it.desc}</p>
          <div class="tag-list">${(it.tags || []).map(t => `<span class="tag-chip ${it.confirmed ? '' : 'unknown'}">${t}</span>`).join('')}</div>
        </div>
      </div>`).join('') : '<p class="muted">Nothing discovered yet.</p>';
  } else if (journalTab === 'recipes') {
    body = j.recipes.map(r => `
      <div class="card">
        <h3>${r.known ? ITEMS[r.result].name : (r.hinted ? '??? (hinted)' : '???')}</h3>
        ${r.known ? `<p class="small">${ITEMS[r.result].desc}</p><div class="tag-list">${r.inputs.map(i => `<span class="tag-chip">${ITEMS[i].name}</span>`).join(' + ')}</div>`
          : r.hinted ? `<p class="small muted">${r.hint}</p>` : '<p class="small muted">Undiscovered.</p>'}
      </div>`).join('');
  } else if (journalTab === 'rumors') {
    body = j.rumors.length ? j.rumors.map(r => `<div class="card"><p>${r.text}</p></div>`).join('') : '<p class="muted">No rumors overheard yet.</p>';
  }
  return `
  <div class="overlay-screen">
    <div class="overlay-header">
      <h2>Journal</h2>
      <button class="btn btn-sm" data-action="nav:back">Close</button>
    </div>
    <div class="overlay-body">
      <div class="tab-row">${tabs.map(([id, label]) => `<button class="tab-btn ${journalTab === id ? 'active' : ''}" data-action="journal:tab" data-tab="${id}">${label}</button>`).join('')}</div>
      <div class="stack">${body}</div>
    </div>
  </div>`;
}

// ===================== Game (dispatch by nightPhase) =====================
function renderGame() {
  const st = Game.state;
  if (!st) { screen = 'TITLE'; return renderTitle(); }
  if (st.nightPhase === 'INTRO') return renderNightIntro();
  if (st.nightPhase === 'SUMMARY') return renderNightSummary();
  if (st.nightPhase === 'SUPPLIER') return renderSupplier();
  if (st.nightPhase === 'ENDED') return renderEnding();
  return renderShop();
}

function shopHeader() {
  const st = Game.state;
  const repTier = reputationTier(st.reputation);
  const def = currentNightDef(st);
  return `
  <div class="shop-header">
    <div class="stat-group">
      <div class="stat-chip">Wicks: <strong>&nbsp;${st.money}</strong></div>
      <div class="stat-chip">Reputation: <strong>&nbsp;${repTier.label}</strong></div>
      <div class="stat-chip">Night ${st.night} of ${NIGHTS.length - 1}</div>
      <div class="stat-chip">${formatShopTime(st.time)}</div>
    </div>
    <div class="header-actions">
      <button class="btn btn-sm" data-action="journal:open">Journal</button>
      <button class="btn btn-sm" data-action="settings:open-ingame">Settings</button>
    </div>
  </div>`;
}

function renderNightIntro() {
  const st = Game.state;
  const def = currentNightDef(st);
  const ev = def.event ? EVENTS[def.event] : null;
  return `<div class="shop-screen">${shopHeader()}
    <div class="center-screen">
      <div class="intro-card card">
        <div class="night-banner">Night ${def.n} — ${def.title}</div>
        <h2>${def.n === 1 ? 'The Shop Opens' : 'The Rain Returns'}</h2>
        <p>${def.intro}</p>
        ${ev ? `<p class="muted" style="font-style:italic;">${ev.banner}</p>` : ''}
        ${def.tutorial ? `<p class="muted small">Customers will arrive one at a time. Listen to what they ask for, inspect your shelves, and offer whatever seems right. There's always a reasonable answer somewhere on your shelves.</p>` : ''}
        <button class="btn btn-primary" data-action="night:begin">Unlock the Door</button>
      </div>
    </div>
  </div>`;
}

// ===================== Shop / dialogue =====================
function setupEncounter() {
  const e = currentEncounter(Game.state);
  if (!e) { enc = null; return; }
  enc = { encounter: e, stage: 'GREETING', transcript: [{ type: 'greeting', text: e.greeting }], askedFollowups: [], expression: 'neutral' };
  offerMode = false;
  if (e.storyItem?.give) {
    applyStoryGift(Game.state, e);
    enc.transcript.push({ type: 'system', text: e.giftNote });
  }
}

function maxFollowups() {
  const mods = getModifiers(Game.state);
  return 2 + (mods.extraFollowup || 0);
}

function renderShop() {
  const st = Game.state;
  if (!enc) setupEncounter();
  const e = enc?.encounter;
  const def = currentNightDef(st);

  return `<div class="shop-screen">
    ${shopHeader()}
    <div class="shop-main"><div class="shop-interior">
      <div class="shop-window">
        <div class="win-fog"></div>
        <canvas id="shop-rain" class="rain-canvas"></canvas>
        <div class="streetlamp"></div>
      </div>
      <div class="counter-zone">
        ${e ? renderCustomerPanel(e) : renderNoCustomer()}
      </div>
      ${renderShelves()}
    </div></div>
  </div>`;
}

function renderNoCustomer() {
  return `<div class="customer-panel"><div class="customer-meta">
    <h3 class="customer-name">The shop is quiet.</h3>
    <p class="muted">No one at the door just now.</p>
    <button class="btn btn-primary" data-action="night:finish">Close Up for the Night</button>
  </div></div>`;
}

function renderCustomerPanel(e) {
  const st = Game.state;
  const mods = getModifiers(st);
  const relBadge = e.source === 'recurring'
    ? `<div class="relationship-badge">${relationshipTier(st.relationships[e.charId].points).label}</div>` : '';
  const budgetPill = mods.showBudgetHint ? `<span class="pill">${e.budget < 9 ? 'Modest budget' : e.budget > 16 ? 'Generous budget' : 'Comfortable budget'}</span>` : '';
  const tolerancePill = mods.showToleranceHint ? `<span class="pill">${e.isTeachingBeat ? 'Forgiving of mistakes' : e.isTrapBeat ? 'Seems uncertain themself' : 'Hard to read'}</span>` : '';

  return `
  <div class="customer-panel">
    <div class="portrait-frame">${renderPortrait(e.portrait, enc.expression)}</div>
    <div class="customer-meta">
      <div class="customer-name">${e.name}</div>
      <div class="customer-title">${e.title}</div>
      ${budgetPill || tolerancePill ? `<div class="btn-row" style="margin-bottom:0.5em;">${budgetPill}${tolerancePill}</div>` : ''}
      <div class="dialogue-text" aria-live="polite">
        ${enc.transcript.map(lineHtml).join('')}
      </div>
      ${relBadge}
      ${renderDialogueControls(e)}
    </div>
  </div>`;
}

function lineHtml(line) {
  const speed = Game.settings?.textSpeed || 'normal';
  const dur = { instant: 0, fast: 0.12, normal: 0.28, slow: 0.55 }[speed];
  const style = `animation-duration:${dur}s`;
  if (line.type === 'greeting') return `<p class="dlg-enter" style="${style}; font-style:italic;">${line.text}</p>`;
  if (line.type === 'system') return `<p class="dlg-enter" style="${style}; color:var(--amber-soft);">${line.text}</p>`;
  if (line.type === 'followup') return `<p class="dlg-enter" style="${style}"><strong>You ask:</strong> ${line.q}<br>${line.a}</p>`;
  if (line.type === 'reaction') return `<p class="dlg-enter" style="${style}">${line.text}</p>`;
  return `<p class="dlg-enter" style="${style}">${line.text}</p>`;
}

function renderDialogueControls(e) {
  if (enc.stage === 'GREETING') {
    return `<div class="action-bar"><button class="btn btn-primary" data-action="dlg:continue-greeting">Continue</button></div>`;
  }
  if (enc.stage === 'OUTCOME') {
    return `<div class="action-bar"><button class="btn btn-primary" data-action="dlg:continue-outcome">Continue</button></div>`;
  }
  // INTERACT stage
  const remaining = maxFollowups() - enc.askedFollowups.length;
  const followupBtns = (e.followups || []).map((f, i) => {
    if (enc.askedFollowups.includes(i)) return '';
    return `<button class="btn btn-sm" data-action="dlg:ask" data-idx="${i}" ${remaining <= 0 ? 'disabled' : ''}>${f.q}</button>`;
  }).join('');

  let mainActions = '';
  if (e.isSellToShop) {
    mainActions = `<button class="btn btn-primary" data-action="dlg:sell-accept">Buy for ${e.sellPrice} wicks</button>
      <button class="btn" data-action="dlg:sell-decline">Not tonight</button>`;
  } else if (e.isCompanion || e.alwaysAccept) {
    mainActions = `<button class="btn btn-primary" data-action="dlg:companion-continue">Continue</button>`;
  } else {
    mainActions = offerMode
      ? `<span class="pill">Choose an item on your shelves below</span> <button class="btn btn-sm" data-action="dlg:offer-cancel">Cancel</button>`
      : `<button class="btn btn-primary" data-action="dlg:offer-start">Offer an Item</button>
         <button class="btn btn-ghost" data-action="dlg:refuse">Let them go</button>`;
  }

  return `
    ${followupBtns ? `<div class="followup-row">${followupBtns}</div><div class="followups-used">${remaining} question${remaining === 1 ? '' : 's'} left to ask</div>` : ''}
    <div class="action-bar">${mainActions}</div>
  `;
}

// ===================== Shelves =====================
const CATEGORIES = ['ALL', 'CHARMS', 'HERBS', 'CURIOS', 'LIGHTS', 'TONICS', 'MEMORIES', 'TOOLS', 'BOOKS', 'ODDITIES', 'PROTECTION'];

function renderShelves() {
  const st = Game.state;
  const owned = ITEM_LIST.filter(it => (st.inventory[it.id] || 0) > 0);
  const filtered = categoryFilter === 'ALL' ? owned : owned.filter(it => it.category === categoryFilter);
  filtered.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const cap = getModifiers(st).capacity;

  return `
  <div class="shelves-wrap">
    <div class="shelves-title">
      <h3 style="margin:0;">Your Shelves <span class="muted small">(${inventoryTotal(st.inventory)}/${cap})</span></h3>
      <div class="btn-row">
        <button class="btn btn-sm ${combineMode ? 'btn-primary' : ''}" data-action="combine:toggle">${combineMode ? 'Cancel Combine' : 'Combine Items'}</button>
      </div>
    </div>
    <div class="btn-row" style="margin-bottom:0.4em;">
      ${CATEGORIES.map(c => `<button class="btn btn-sm ${categoryFilter === c ? 'btn-primary' : ''}" data-action="shelf:filter" data-cat="${c}">${c[0] + c.slice(1).toLowerCase()}</button>`).join('')}
    </div>
    ${combineMode ? `<p class="muted small">Select two items to try combining them. ${combineSel.length === 2 ? '' : `(${combineSel.length}/2 selected)`}</p>` : ''}
    <div class="shelf-row">
      ${filtered.length ? filtered.map(it => itemCardHtml(it, st.inventory[it.id])).join('') : '<p class="muted">Nothing here yet.</p>'}
    </div>
    ${combineMode && combineSel.length === 2 ? `<div class="action-bar"><button class="btn btn-primary" data-action="combine:confirm">Combine ${ITEMS[combineSel[0]].name} + ${ITEMS[combineSel[1]].name}</button></div>` : ''}
  </div>`;
}

function itemCardHtml(item, qty) {
  const selected = combineMode && combineSel.includes(item.id);
  return `
  <button class="item-card rarity-${item.rarity} ${selected ? 'selected' : ''}" data-action="item:click" data-item="${item.id}" aria-label="${item.name}, quantity ${qty}">
    <div class="item-icon">${itemIcon(item)}</div>
    <div class="item-name"><span class="rarity-dot"></span>${item.name}</div>
    <div class="item-qty">×${qty}</div>
  </button>`;
}

// ===================== Item modal =====================
function itemModalHtml(itemId) {
  const item = ITEMS[itemId];
  const st = Game.state;
  const confirmed = !!st.discoveredItems[itemId];
  const canOffer = offerMode && enc && enc.stage === 'INTERACT' && !enc.encounter.isSellToShop && !enc.encounter.isCompanion;
  return `
  <div class="modal-sheet" role="dialog" aria-modal="true" aria-label="${item.name}">
    <div class="spread"><h3>${item.name}</h3><button class="btn btn-sm btn-ghost" data-action="modal:close">Close</button></div>
    <p class="muted small">${item.category} · ${item.rarity}${item.risky ? ' · unpredictable with repeated use' : ''}</p>
    <p>${item.desc}</p>
    <div class="tag-list">${(item.tags || []).map(t => `<span class="tag-chip ${confirmed ? '' : 'unknown'}">${t}</span>`).join('')}</div>
    <p class="small muted">You have ${st.inventory[itemId] || 0}. Typical value: ${item.value} wicks.</p>
    ${canOffer ? priceButtonsHtml(item) : ''}
  </div>`;
}

function priceButtonsHtml(item) {
  const st = Game.state;
  const def = currentNightDef(st);
  const mods = getModifiers(st, def.event);
  return `
  <hr class="sep">
  <p class="small">Offer to <strong>${enc.encounter.name}</strong> for:</p>
  <div class="btn-row">
    ${Object.values(PRICE_CHOICES).map(p => `<button class="btn" data-action="modal:offer" data-item="${item.id}" data-price="${p.id}">${p.label} — ${computePrice(item, p.id, mods)}</button>`).join('')}
  </div>`;
}

function purchaseFailModal(reason) {
  const msg = reason === 'capacity'
    ? 'Your shelves are full. Sell or use something before buying more — or upgrade your shelving.'
    : reason === 'maxed'
      ? 'This upgrade is already at its highest level.'
      : "You don't have enough wicks for that tonight.";
  modal = `<div class="modal-sheet"><div class="spread"><h3>Can't Buy That</h3>
    <button class="btn btn-sm btn-ghost" data-action="modal:close">Close</button></div>
    <p>${msg}</p></div>`;
}

function renderModals() {
  let html = '';
  if (modal) html += `<div class="modal-backdrop" data-action="modal:backdrop">${modal}</div>`;
  if (confirmBox) {
    html += `<div class="modal-backdrop" data-action="confirm:backdrop">
      <div class="modal-sheet confirm-box">
        <h3>${confirmBox.title}</h3>
        <p>${confirmBox.message}</p>
        <div class="btn-row"><button class="btn btn-danger" data-action="confirm:yes">${confirmBox.yesLabel || 'Confirm'}</button>
        <button class="btn" data-action="confirm:no">Cancel</button></div>
      </div></div>`;
  }
  return html;
}

// ===================== Night summary =====================
function renderNightSummary() {
  const st = Game.state;
  const def = currentNightDef(st);
  const ns = st.nightStats;
  return `<div class="shop-screen">${shopHeader()}
    <div class="center-screen">
      <div class="summary-card card">
        <div class="night-banner">Dawn Approaches</div>
        <h2>Night ${def.n} Complete</h2>
        <div class="summary-stats">
          <div class="summary-stat"><div class="val">${ns.customersServed}</div><div class="lbl">Customers Served</div></div>
          <div class="summary-stat"><div class="val">${ns.perfect + ns.good}</div><div class="lbl">Successful Matches</div></div>
          <div class="summary-stat"><div class="val">${ns.poor + ns.refused}</div><div class="lbl">Poor Matches</div></div>
          <div class="summary-stat"><div class="val">${ns.moneyEarned}</div><div class="lbl">Wicks Earned</div></div>
          <div class="summary-stat"><div class="val">${ns.tips}</div><div class="lbl">Tips</div></div>
          <div class="summary-stat"><div class="val">${ns.reputationDelta >= 0 ? '+' : ''}${ns.reputationDelta}</div><div class="lbl">Reputation Change</div></div>
        </div>
        ${ns.storyEvents.length ? `<div class="story-events">${ns.storyEvents.map(s => `<p>${s}</p>`).join('')}</div>` : ''}
        <div class="btn-row" style="justify-content:center;">
          ${def.finale
            ? `<button class="btn btn-primary" data-action="summary:finale">See What Comes Next</button>`
            : `<button class="btn btn-primary" data-action="summary:restock">Restock</button>
               <button class="btn" data-action="summary:skip">Skip Restocking</button>`}
        </div>
      </div>
    </div>
  </div>`;
}

// ===================== Supplier =====================
function renderSupplier() {
  const st = Game.state;
  const nextNightNum = Math.min(st.night + 1, NIGHTS.length - 1);
  const nextDef = NIGHTS[nextNightNum];
  const offer = getSupplierOffer(nextNightNum, nextDef?.event);
  const mods = getModifiers(st);

  const tabs = `<div class="tab-row">
    <button class="tab-btn ${supplierTab === 'stock' ? 'active' : ''}" data-action="supplier:tab" data-tab="stock">Stock</button>
    <button class="tab-btn ${supplierTab === 'upgrades' ? 'active' : ''}" data-action="supplier:tab" data-tab="upgrades">Shop Upgrades</button>
  </div>`;

  let body = '';
  if (supplierTab === 'stock') {
    body = `<div class="supplier-grid">
      <div class="supplier-section card">
        <h3>Common Stock</h3>
        <div class="supplier-items">${offer.common.map(o => supplierItemHtml(o)).join('')}</div>
      </div>
      <div class="supplier-section card">
        <h3>Rare Curios</h3>
        <div class="supplier-items">${offer.rare.map(o => supplierItemHtml(o)).join('')}</div>
      </div>
      <div class="supplier-section card crate-card">
        <h3>Mystery Crate</h3>
        <p class="small muted">Three items, sight unseen, at a discount.</p>
        <p class="price">${offer.mysteryCrate.cost} wicks</p>
        <button class="btn btn-primary" data-action="supplier:crate" data-cost="${offer.mysteryCrate.cost}" data-ids="${offer.mysteryCrate.ids.join(',')}">Buy Crate</button>
      </div>
      ${offer.special ? `<div class="supplier-section card special-card">
        <h3>Special Order</h3>
        <p class="small">${offer.special.note}</p>
        <p class="price">${ITEMS[offer.special.item].name} — ${offer.special.cost} wicks</p>
        <button class="btn btn-primary" data-action="supplier:buy" data-item="${offer.special.item}" data-cost="${offer.special.cost}">Order It</button>
      </div>` : ''}
    </div>`;
  } else {
    body = `<div class="supplier-grid">${UPGRADE_LIST.map(u => upgradeCardHtml(u)).join('')}</div>`;
  }

  return `<div class="shop-screen">${shopHeader()}
    <div class="overlay-body" style="max-width:1000px;">
      <h2>The Supplier's Cart</h2>
      <p class="muted small">Stocking up for Night ${nextNightNum}. Wicks: ${st.money}.</p>
      ${tabs}
      ${body}
      <div class="btn-row" style="justify-content:center; margin-top:1.4rem;">
        <button class="btn btn-primary" data-action="supplier:done">Continue to Night ${nextNightNum}</button>
      </div>
    </div>
  </div>`;
}

function supplierItemHtml(o) {
  const item = ITEMS[o.id];
  return `<div class="supplier-item">
    <div class="item-icon">${itemIcon(item)}</div>
    <div class="item-name small">${item.name}</div>
    <div class="price">${o.cost} wicks</div>
    <button class="btn btn-sm" data-action="supplier:buy" data-item="${o.id}" data-cost="${o.cost}" aria-label="Buy ${item.name} for ${o.cost} wicks">Buy</button>
  </div>`;
}

function upgradeCardHtml(u) {
  const st = Game.state;
  const level = st.upgrades[u.id] || 0;
  const next = upgradeNextLevel(st, u.id);
  return `<div class="supplier-section card">
    <h3>${u.name} <span class="muted small">(Level ${level}/${u.levels.length})</span></h3>
    <p class="small">${u.desc}</p>
    ${next ? `<p class="small muted">${next.note}</p><p class="price">${next.cost} wicks</p>
      <button class="btn btn-primary" data-action="upgrade:buy" data-upgrade="${u.id}">Upgrade</button>`
      : `<p class="small muted">Fully upgraded.</p>`}
  </div>`;
}

// ===================== Ending =====================
function renderEnding() {
  const st = Game.state;
  const ending = ENDINGS[st.endingId] || ENDINGS.NEW_KEEPER;
  const t = st.totals;
  return `<div class="ending-screen"><div class="ending-card">
    <div class="night-banner">The Story Ends</div>
    <h2>${ending.title}</h2>
    <div class="subtitle">${ending.subtitle}</div>
    ${ending.body.map(p => `<p>${p}</p>`).join('')}
    <div class="summary-stats" style="text-align:left;">
      <div class="summary-stat"><div class="val">${NIGHTS.length - 1}</div><div class="lbl">Nights Open</div></div>
      <div class="summary-stat"><div class="val">${t.customersServed}</div><div class="lbl">Customers Served</div></div>
      <div class="summary-stat"><div class="val">${t.perfect}</div><div class="lbl">Perfect Matches</div></div>
      <div class="summary-stat"><div class="val">${reputationTier(st.reputation).label}</div><div class="lbl">Final Reputation</div></div>
      <div class="summary-stat"><div class="val">${st.money}</div><div class="lbl">Wicks Earned</div></div>
      <div class="summary-stat"><div class="val">${st.knownRecipes.length}</div><div class="lbl">Recipes Discovered</div></div>
    </div>
    <div class="btn-row" style="justify-content:center; margin-top:1rem;">
      <button class="btn" data-action="journal:open">View Journal</button>
      <button class="btn btn-primary" data-action="ending:new-game">Start a New Game</button>
    </div>
  </div></div>`;
}

// ===================== Event delegation =====================
function onInput(e) {
  const t = e.target;
  if (t.dataset.setting) {
    const key = t.dataset.setting;
    let val = t.value;
    if (t.type === 'range') val = parseFloat(val);
    Game.settings[key] = val;
    Game.saveSettings();
    if (key === 'musicVolume' || key === 'sfxVolume') applySfx();
    if (key === 'rainEffects') afterRender();
  }
}

function onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  Audio.unlockAudio();

  switch (action) {
    case 'title:new-game':
      Game.newGame();
      applySfx(); Audio.startAmbience();
      screen = 'GAME';
      render();
      return;
    case 'title:continue':
      if (Game.continueGame()) { applySfx(); Audio.startAmbience(); screen = 'GAME'; }
      render();
      return;
    case 'title:howto': previousScreen = 'TITLE'; screen = 'HOWTO'; render(); return;
    case 'title:settings':
      settingsReturn = 'TITLE'; screen = 'SETTINGS'; render(); return;
    case 'settings:open-ingame': settingsReturn = 'GAME'; screen = 'SETTINGS'; render(); return;
    case 'nav:back':
      screen = screen === 'SETTINGS' ? settingsReturn : previousScreen;
      render(); return;
    case 'settings:reset':
      confirmBox = { title: 'Erase your save?', message: 'This will permanently delete your current shop, all progress, and cannot be undone.', yesLabel: 'Erase Everything', onYes: () => { Game.eraseSave(); screen = 'TITLE'; } };
      render(); return;
    case 'confirm:yes':
      if (confirmBox?.onYes) confirmBox.onYes();
      confirmBox = null; render(); return;
    case 'confirm:no': case 'confirm:backdrop':
      if (e.target === btn) { confirmBox = null; render(); } return;

    case 'journal:open': previousScreen = 'GAME'; journalTab = 'customers'; screen = 'JOURNAL'; render(); return;
    case 'journal:tab': journalTab = btn.dataset.tab; render(); return;

    case 'night:begin': startNight(Game.state); setupEncounter(); doSave(); render(); return;
    case 'night:finish': finishNight(Game.state); render(); return;

    case 'dlg:continue-greeting':
      Audio.playPlace();
      enc.transcript.push({ type: 'opening', text: enc.encounter.opening });
      enc.stage = 'INTERACT'; enc.expression = 'curious';
      render(); return;
    case 'dlg:ask': {
      const idx = parseInt(btn.dataset.idx, 10);
      const f = enc.encounter.followups[idx];
      enc.askedFollowups.push(idx);
      enc.transcript.push({ type: 'followup', q: f.q, a: f.a });
      Audio.playPage();
      render(); return;
    }
    case 'dlg:offer-start': offerMode = true; render(); return;
    case 'dlg:offer-cancel': offerMode = false; modal = null; render(); return;
    case 'dlg:refuse':
      applyRefusal(Game.state, enc.encounter);
      enc.transcript.push({ type: 'system', text: 'You decide not to sell anything tonight. They nod, and step back out into the rain.' });
      enc.stage = 'OUTCOME'; enc.expression = 'worried';
      doSave(); render(); return;
    case 'dlg:sell-accept':
      applySellToShop(Game.state, enc.encounter, true);
      enc.transcript.push({ type: 'reaction', text: enc.encounter.reactions.perfect?.[0] || 'They hand it over gladly.' });
      enc.stage = 'OUTCOME'; enc.expression = 'pleased';
      doSave(); render(); return;
    case 'dlg:sell-decline':
      applySellToShop(Game.state, enc.encounter, false);
      enc.transcript.push({ type: 'system', text: 'You decide not to buy it. They tuck it back away, unbothered.' });
      enc.stage = 'OUTCOME'; enc.expression = 'neutral';
      doSave(); render(); return;
    case 'dlg:companion-continue':
      applyGift(Game.state, enc.encounter);
      enc.transcript.push({ type: 'reaction', text: enc.encounter.reactions.perfect?.[0] || '' });
      enc.stage = 'OUTCOME'; enc.expression = 'pleased';
      doSave(); render(); return;
    case 'dlg:continue-outcome':
      if (isNightOver(Game.state)) { finishNight(Game.state); }
      else { setupEncounter(); }
      render(); return;

    case 'shelf:filter': categoryFilter = btn.dataset.cat; render(); return;
    case 'combine:toggle': combineMode = !combineMode; combineSel = []; render(); return;
    case 'combine:confirm': {
      const [a, b] = combineSel;
      const result = craft(Game.state, a, b);
      combineMode = false; combineSel = [];
      if (result.ok) {
        Audio.playChime();
        modal = `<div class="modal-sheet"><div class="spread"><h3>${result.newlyDiscovered ? 'Recipe Discovered!' : 'Combined!'}</h3>
          <button class="btn btn-sm btn-ghost" data-action="modal:close">Close</button></div>
          <div class="item-icon" style="width:96px;">${itemIcon(result.resultItem)}</div>
          <h3>${result.resultItem.name}</h3><p>${result.resultItem.desc}</p></div>`;
      } else {
        modal = `<div class="modal-sheet"><div class="spread"><h3>Nothing Happens</h3>
          <button class="btn btn-sm btn-ghost" data-action="modal:close">Close</button></div>
          <p>These two don't seem to belong together. Maybe something else would work.</p></div>`;
      }
      doSave(); render(); return;
    }

    case 'item:click': {
      const id = btn.dataset.item;
      if (combineMode) {
        if (combineSel.includes(id)) combineSel = combineSel.filter(x => x !== id);
        else if (combineSel.length < 2) combineSel.push(id);
        render(); return;
      }
      Audio.playPage();
      modal = itemModalHtml(id);
      render(); return;
    }
    case 'modal:close': modal = null; render(); return;
    case 'modal:backdrop': if (e.target === btn) { modal = null; render(); } return;
    case 'modal:offer': {
      const itemId = btn.dataset.item;
      const price = btn.dataset.price;
      const result = applySale(Game.state, enc.encounter, ITEMS[itemId], price);
      modal = null; offerMode = false;
      enc.transcript.push({ type: 'reaction', text: result.reactionText });
      if (result.riskyNote) enc.transcript.push({ type: 'system', text: result.riskyNote });
      const deltaBits = [];
      if (result.isSale) deltaBits.push(`+${result.price + result.tip} wicks${result.tip ? ' (with tip)' : ''}`);
      if (result.reputationDelta) deltaBits.push(`Reputation ${result.reputationDelta > 0 ? '+' : ''}${result.reputationDelta}`);
      enc.transcript.push({ type: 'system', text: `${result.tier.label}. ${deltaBits.join(' · ')}` });
      enc.stage = 'OUTCOME';
      enc.expression = { PERFECT: 'pleased', GOOD: 'pleased', ACCEPTABLE: 'curious', POOR: 'annoyed', REFUSED: 'worried' }[result.tier.id];
      if (result.tier.id === 'PERFECT') Audio.playCoin(); else if (result.tier.id === 'REFUSED') Audio.playDrawer();
      doSave(); render(); return;
    }

    case 'supplier:tab': supplierTab = btn.dataset.tab; render(); return;
    case 'supplier:buy': {
      const id = btn.dataset.item; const cost = parseInt(btn.dataset.cost, 10);
      const r = buyItem(Game.state, id, cost, 1);
      if (r.ok) Audio.playCoin(); else purchaseFailModal(r.reason);
      render(); return;
    }
    case 'supplier:crate': {
      const ids = btn.dataset.ids.split(',');
      const cost = parseInt(btn.dataset.cost, 10);
      const r = buyMysteryCrate(Game.state, { ids, cost });
      if (r.ok) Audio.playChime(); else purchaseFailModal(r.reason);
      render(); return;
    }
    case 'upgrade:buy': {
      const id = btn.dataset.upgrade;
      const r = purchaseUpgrade(Game.state, id, UPGRADES[id]);
      if (r.ok) Audio.playChime(); else purchaseFailModal(r.reason);
      render(); return;
    }
    case 'summary:restock': goToSupplier(Game.state); render(); return;
    case 'summary:skip': advanceToNextNight(Game.state); render(); return;
    case 'summary:finale': advanceToNextNight(Game.state); render(); return;
    case 'supplier:done': advanceToNextNight(Game.state); render(); return;

    case 'ending:new-game':
      Game.eraseSave(); screen = 'TITLE'; render(); return;

    case 'settings:toggle': {
      const key = btn.dataset.toggle;
      Game.settings[key] = !Game.settings[key];
      Game.saveSettings();
      render(); return;
    }
  }
}
