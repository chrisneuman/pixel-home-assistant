// Offline preview: the same engine as the card, driven by sample state instead of Home Assistant.
// URL options: #<room-id> opens a room, #off / #all-on, ?t=20.5 time, ?weather=rain|storm|snow, ?garage=40 (open 40 min),
// ?dog=60,22 (start the dog there), ?states=live (seed from card/test/states.json-style data in window.HA_STATES).
(function () {
  const host = document.getElementById('house');
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>${CSS}</style>${MARKUP}`;
  const tag = location.hash.slice(1), qs = new URLSearchParams(location.search);
  const SAMPLE = ['dining', 'kitchen', 'kitchen_counter', 'upper_cabinet', 'hall_accent', 'm_bedroom', 'castle_lights', 'porch', 'garage_front', 'master_fan_light', 'back_door', 'master_closet', 'kitchen_sink'];
  const calls = window.HA_CALLS = [];
  mountHouse(root, FLOORS.main, {
    demo: true,
    startRoom: tag.replace(/-/g, '_'),
    call: (domain, service, data) => calls.push([domain, service, data]),
    onRoom: id => { try { history.replaceState(null, '', (id ? '#' + id.replace(/_/g, '-') : location.pathname) + location.search); } catch (e) {} },
    init(api) {
      if (window.HA_STATES) { api.setStates(window.HA_STATES, true); return; }
      if (qs.has('t')) { api.set('clockMode', 'set'); api.set('clockHour', +qs.get('t')); }
      if (qs.has('weather')) { api.set('weather', qs.get('weather')); if (qs.get('weather') === 'snow') api.set('snowCover', 1); }
      if (qs.has('garage')) api.garageDoors.forEach(g => { g.closed = false; g.level = 1; g.openSince = Date.now() - +qs.get('garage') * 60000; });
      if (qs.has('dog') && api.dog) { const [x, y] = qs.get('dog').split(',').map(Number); Object.assign(api.dog, { x, y, napping: false, wait: 0 }); }
      if (tag === 'all-on') api.lights.forEach(l => { l.on = true; l.level = 1; });
      else if (tag !== 'off') {
        api.lights.forEach(l => { l.on = SAMPLE.includes(l.id); l.level = l.on ? 1 : 0; });
        api.covers.forEach(c => { if (c.kind === 'garage') return; c.closed = c.id === 'm_bedroom_blinds'; c.level = c.closed ? 1 : 0; });
        api.fans.forEach(f => { f.on = f.id === 'master_fan'; f.speed = f.on ? 1 : 0; });
      }
    },
  });
})();
