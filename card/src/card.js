// <pixel-house-card>: Home Assistant custom card wrapper around the shared engine.
//   type: custom:pixel-house-card
//   floor: main                  # optional, the only floor so far
//   entities: {kitchen: switch.kitchen_light}   # optional per-device overrides by map id
const CARD_VERSION = '__VERSION__';  // from VERSION

function loadFont() {
  if (document.getElementById('pixel-house-font')) return;
  const l = document.createElement('link');
  l.id = 'pixel-house-font'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&display=swap';
  document.head.appendChild(l);
}

class PixelHouseCard extends HTMLElement {
  setConfig(config) {
    const floor = (config && config.floor) || 'main';
    if (!FLOORS[floor]) throw new Error(`pixel-house-card: unknown floor "${floor}"`);
    this._config = { ...config, floor };
    if (this._api) { this._unmount(); this._mount(); }
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._api && this.isConnected) this._mount();
    if (!this._api) return;
    // only re-render when one of our entities actually changed (HA pushes every state change in the house)
    let changed = !this._seen;
    const seen = this._seen || {};
    for (const e of this._watch) if (hass.states[e] !== seen[e]) { seen[e] = hass.states[e]; changed = true; }
    this._seen = seen;
    if (changed) { this._api.setStates(hass.states, this._first); this._first = false; }
  }
  connectedCallback() { if (this._hass && !this._api) { this._mount(); this.hass = this._hass; } }
  disconnectedCallback() { this._unmount(); }
  _mount() {
    loadFont();
    const base = FLOORS[this._config.floor];
    const over = this._config.entities || {};
    const withIds = list => (list || []).map(d => over[d.id] ? { ...d, entity: over[d.id] } : d);
    const CONFIG = { ...base.CONFIG, lights: withIds(base.CONFIG.lights), covers: withIds(base.CONFIG.covers), fans: withIds(base.CONFIG.fans) };
    this._watch = [...CONFIG.lights, ...CONFIG.covers, ...CONFIG.fans].map(d => d.entity).filter(Boolean);
    for (const l of CONFIG.lights) for (const f of l.fixtures || []) if (f.color_entity) this._watch.push(f.color_entity);
    if (CONFIG.sky) this._watch.push(CONFIG.sky.sun || 'sun.sun', CONFIG.sky.weather);
    this._watch = this._watch.filter(Boolean);
    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><ha-card>${MARKUP}</ha-card>`;
    this._first = true; this._seen = null;
    this._api = mountHouse(root, { CONFIG, LAYOUT: base.LAYOUT, MAP_SRC: base.MAP_SRC }, {
      demo: false,
      call: (domain, service, data) => this._hass && this._hass.callService(domain, service, data),
    });
  }
  _unmount() { if (this._api) { this._api.destroy(); this._api = null; } }
  getCardSize() { return 12; }
  getGridOptions() { return { columns: 'full', min_columns: 6, rows: 'auto' }; }
  static getStubConfig() { return { floor: 'main' }; }
}

if (!customElements.get('pixel-house-card')) {
  customElements.define('pixel-house-card', PixelHouseCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'pixel-house-card', name: 'Pixel House', description: 'A 16-bit map of the house: tap lights, fans, blinds and the garage door.', preview: false });
  console.info(`%c PIXEL-HOUSE-CARD %c ${CARD_VERSION} `, 'background:#ffd95a;color:#2a1f08;font-weight:700', 'background:#251f31;color:#f2ead8');
}
