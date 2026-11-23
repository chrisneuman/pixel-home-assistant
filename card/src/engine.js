// Pixel house engine: the map renderer + room UI, shared by the HA card and the offline preview.
// mountHouse(root, {CONFIG, LAYOUT, MAP_SRC}, bridge) draws into `root` (a shadow root).
// bridge: { demo, startRoom, init(api), call(domain, service, data), onRoom(id) }
export function mountHouse(root, { CONFIG, LAYOUT, MAP_SRC }, bridge = {}) {
const $id = id => root.querySelector('#' + id);
let stopped = false;
function act(kind, dev, on, extra) {                    // a user action: ask HA to do it
  if (!bridge.call || !dev.entity) return;
  const [domain] = dev.entity.split('.');
  if (kind === 'cover' && extra && extra.position !== undefined) return bridge.call('cover', 'set_cover_position', { entity_id: dev.entity, position: extra.position });
  if (kind === 'cover') return bridge.call('cover', on ? 'open_cover' : 'close_cover', { entity_id: dev.entity });
  bridge.call(domain, on ? 'turn_on' : 'turn_off', { entity_id: dev.entity, ...(on && extra && domain === 'light' ? extra : {}) });
}


const CELL = LAYOUT.cell_px, W = LAYOUT.width, H = LAYOUT.height;
const PW = W * CELL, PH = H * CELL;
const canvas = $id('c');
canvas.width = PW; canvas.height = PH;
const ctx = canvas.getContext('2d');
const tiles = LAYOUT.tiles;
// a light may drive several fixtures (e.g. two garage lanterns on one switch)
const lights = CONFIG.lights.map((l, i) => ({
  ...l, on: false, level: 0,
  fx: stripPoints(l) || (l.fixtures || [{ x: l.x, y: l.y }]).map((f, k) => ({ x: f.x, y: f.y, radius: f.radius || l.radius, phase: i * 1.7 + k * .9 })),
  tint: l.color ? `rgb(${l.color})` : 'rgb(255,190,80)',
}));
// an LED strip glows as a row of small lights spaced along it
function stripPoints(l) {
  if (!l.strip) return null;
  const { x0, y0, x1, y1 } = l.strip, len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len / 3));
  return Array.from({ length: n + 1 }, (_, k) => ({ x: x0 + (x1 - x0) * k / n, y: y0 + (y1 - y0) * k / n, radius: l.radius, phase: k * .5, strip: true }));
}
let showLabels = false, sel = null, focusMask = null;
const covers = (CONFIG.covers || []).map(c => ({ ...c, closed: c.kind === 'garage', pos: 100, level: 0, openSince: 0 }));
const garageDoors = covers.filter(c => c.kind === 'garage');
const fans = (CONFIG.fans || []).map((f, i) => ({ ...f, on: false, speed: 0, angle: i * .4 }));

// ---- glow zones: flood fill from each light, stopping at walls and closed doors
const INDOOR = new Set([' ', 'S']);
const OUTDOOR = new Set(['.', 'd', 'p', 'k']);
function tileAt(c, r) { return (r < 0 || r >= H || c < 0 || c >= W) ? '#' : tiles[r][c]; }
function buildZone(l) {
  const c0 = Math.floor(l.x), r0 = Math.floor(l.y);
  const start = tileAt(c0, r0);
  const pass = OUTDOOR.has(start) ? OUTDOOR : INDOOR;
  const R = l.radius + 1, seen = new Uint8Array(W * H), q = [[c0, r0]];
  seen[r0 * W + c0] = 1;
  while (q.length) {
    const [c, r] = q.pop();
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= W || nr >= H || seen[nr * W + nc]) continue;
      if (Math.hypot(nc + .5 - l.x, nr + .5 - l.y) > R) continue;
      if (!pass.has(tiles[nr][nc])) continue;
      seen[nr * W + nc] = 1; q.push([nc, nr]);
    }
  }
  // spill one cell onto bounding walls/doors so their edges catch the light
  const out = seen.slice();
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    if (!seen[r * W + c]) continue;
    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nr >= 0 && nc < W && nr < H && !pass.has(tiles[nr][nc])) out[nr * W + nc] = 1;
    }
  }
  const m = document.createElement('canvas'); m.width = PW; m.height = PH;
  const mc = m.getContext('2d'); mc.fillStyle = '#fff';
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (out[r * W + c]) mc.fillRect(c * CELL, r * CELL, CELL, CELL);
  return m;
}
lights.forEach(l => l.fx.forEach(f => { f.zone = buildZone(f); }));

// interior mask: where "night" darkness applies strongest (everything gets some)
const scratch = document.createElement('canvas'); scratch.width = PW; scratch.height = PH;
const sc = scratch.getContext('2d');
const dark = document.createElement('canvas'); dark.width = PW; dark.height = PH;
const dc = dark.getContext('2d');

// stepped radial light shape: hard bands read as pixel art
function lightShape(g, l, alpha, flick) {
  const x = l.x * CELL, y = l.y * CELL, R = l.radius * CELL * flick;
  const grad = g.createRadialGradient(x, y, 0, x, y, R);
  const bands = [[0, 1], [.35, .85], [.6, .6], [.8, .35], [1, 0]];
  for (let i = 0; i < bands.length - 1; i++) {
    const [p, a] = bands[i], [p2] = bands[i + 1];
    grad.addColorStop(p, `rgba(255,255,255,${a * alpha})`);
    grad.addColorStop(Math.max(p, p2 - .001), `rgba(255,255,255,${a * alpha})`);
  }
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(x - R, y - R, R * 2, R * 2);
}
function maskedLight(l, alpha, flick, tint) {
  sc.globalCompositeOperation = 'source-over';
  sc.clearRect(0, 0, PW, PH);
  lightShape(sc, l, alpha, flick);
  sc.globalCompositeOperation = 'destination-in';
  sc.drawImage(l.zone, 0, 0);
  if (tint) { sc.globalCompositeOperation = 'source-in'; sc.fillStyle = tint; sc.fillRect(0, 0, PW, PH); }
  return scratch;
}

// ---- sky: ambient light from the sun's elevation (HA: sun.sun attributes.elevation)
const SKY = CONFIG.sky || {};
let clockMode = 'live', clockHour = 21, weather = 'clear', liveElev = null;
function sunElevation(d, lat, lon) {                      // NOAA approximation, good to ~0.5 degrees
  const rad = Math.PI / 180, day = (d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5;
  const g = 2 * Math.PI / 365 * day;
  const decl = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g) - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  const eqt = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
  const tst = d.getUTCHours() * 60 + d.getUTCMinutes() + eqt + 4 * lon;
  const ha = (tst / 4 - 180) * rad, la = lat * rad;
  return 90 - Math.acos(Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha)) / rad;
}
function skyNow() {
  const d = new Date();
  if (clockMode !== 'live') d.setHours(Math.floor(clockHour), Math.round(clockHour % 1 * 60), 0, 0);
  if (clockMode === 'live' && liveElev !== null) return { date: d, elev: liveElev };
  return { date: d, elev: sunElevation(d, SKY.latitude ?? 39, SKY.longitude ?? -94.6) };
}
// elevation -> ambient tint. Night navy, blue hour, sunset orange, clear day.
const SKY_STOPS = [[-12, [14, 12, 44], .6], [-6, [26, 22, 74], .52], [-2, [70, 44, 110], .38], [2, [255, 120, 60], .26], [8, [255, 180, 110], .1], [14, [255, 255, 255], 0]];
function ambient(elev) {
  let a = SKY_STOPS[0], b = SKY_STOPS[SKY_STOPS.length - 1];
  if (elev <= a[0]) b = a; else if (elev >= b[0]) a = b;
  else for (let i = 0; i < SKY_STOPS.length - 1; i++) if (elev >= SKY_STOPS[i][0] && elev < SKY_STOPS[i + 1][0]) { a = SKY_STOPS[i]; b = SKY_STOPS[i + 1]; }
  const t = a === b ? 0 : (elev - a[0]) / (b[0] - a[0]);
  let col = a[1].map((v, k) => Math.round(v + (b[1][k] - v) * t)), alpha = a[2] + (b[2] - a[2]) * t;
  if (weather !== 'clear') {                               // overcast: greyer, a bit darker
    const m = (weather === 'storm' ? .6 : .45) * (1 - .7 * Math.min(1, alpha / .55)), grey = weather === 'snow' ? [150, 160, 182] : [60, 70, 92];
    col = col.map((v, k) => Math.round(v * (1 - m) + grey[k] * m)); alpha = Math.max(alpha, weather === 'storm' ? .34 : weather === 'snow' ? .18 : .24);
  }
  return { col, alpha, night: Math.min(1, alpha / .55) };
}
function skyLabel(elev) {
  return elev > 8 ? 'Day' : elev > 0 ? (skyNow().date.getHours() < 12 ? 'Sunrise' : 'Sunset') : elev > -6 ? 'Dusk' : 'Night';
}

// ---- rain: falls only on outdoor cells (yard, deck, driveway, porch)
const outdoorMask = document.createElement('canvas'); outdoorMask.width = PW; outdoorMask.height = PH;
{ const g = outdoorMask.getContext('2d'); g.fillStyle = '#fff';
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (OUTDOOR.has(tiles[r][c])) g.fillRect(c * CELL, r * CELL, CELL, CELL); }
const rainCv = document.createElement('canvas'); rainCv.width = PW; rainCv.height = PH;
const rc = rainCv.getContext('2d');
const drops = Array.from({ length: 700 }, () => ({ x: Math.random() * PW, y: Math.random() * PH, v: .5 + Math.random() * .4, z: 0 }));
const splashes = [];
let flash = 0;
function drawRain(dt) {
  const n = weather === 'storm' ? 700 : 380;
  rc.globalCompositeOperation = 'source-over'; rc.clearRect(0, 0, PW, PH);
  rc.fillStyle = 'rgba(40,56,90,.22)'; rc.fillRect(0, 0, PW, PH);          // wet ground
  rc.fillStyle = 'rgba(200,218,255,.8)';
  for (let i = 0; i < n; i++) {
    const p = drops[i];
    p.y += p.v * dt; p.x -= p.v * dt * .22;
    if (p.y > PH || p.x < 0 || Math.random() < .004 * dt / 16) {
      if (splashes.length < 160) splashes.push({ x: Math.round(p.x), y: Math.round(p.y), t: 0 });
      p.y = Math.random() * -40; p.x = Math.random() * (PW + 120);
    }
    const x = Math.round(p.x), y = Math.round(p.y);                         // a chunky 2-step streak
    rc.fillRect(x, y, 1, 3); rc.fillRect(x - 1, y + 3, 1, 3);
  }
  rc.fillStyle = 'rgba(210,226,255,.6)';
  for (let i = splashes.length - 1; i >= 0; i--) {
    const s = splashes[i]; s.t += dt;
    if (s.t > 260) { splashes.splice(i, 1); continue; }
    const k = s.t < 130 ? 1 : 2;                                            // tiny ring that widens
    rc.fillRect(s.x - k, s.y, 1, 1); rc.fillRect(s.x + k, s.y, 1, 1); rc.fillRect(s.x, s.y - 1, 1, 1);
  }
  rc.globalCompositeOperation = 'destination-in'; rc.drawImage(outdoorMask, 0, 0);
  ctx.drawImage(rainCv, 0, 0);
  if (weather === 'storm') {
    if (flash <= 0 && Math.random() < dt / 9000) flash = 380;
    if (flash > 0) { flash -= dt; ctx.fillStyle = `rgba(230,236,255,${(flash % 190 > 95 ? .35 : .12) * Math.min(1, flash / 120)})`; ctx.fillRect(0, 0, PW, PH); }
  }
}

// ---- snow: drifting flakes, and a white blanket that builds up on the yard, deck and driveway
let snowCover = 0;
const flakes = Array.from({ length: 320 }, () => ({ x: Math.random() * PW, y: Math.random() * PH, v: .018 + Math.random() * .03, ph: Math.random() * 6.3, big: Math.random() < .3 }));
const snowCv = document.createElement('canvas'); snowCv.width = PW; snowCv.height = PH;
{ const g = snowCv.getContext('2d');
  for (let y = 0; y < PH; y += 2) for (let x = 0; x < PW; x += 2) {          // soft drifts in 2px pixels
    const n = Math.sin(x * .05 + y * .03) + Math.sin(x * .013 - y * .041) + (Math.random() - .5) * .8;
    g.fillStyle = n > .9 ? '#ffffff' : n < -1.1 ? '#c8d4e6' : '#e8eef8'; g.fillRect(x, y, 2, 2);
  }
  g.globalCompositeOperation = 'destination-in'; g.drawImage(outdoorMask, 0, 0); }
function drawSnowGround(dt) {
  snowCover = Math.max(0, Math.min(1, snowCover + (weather === 'snow' ? dt / 8000 : -dt / 20000)));
  if (snowCover <= 0) return;
  ctx.globalAlpha = .9 * snowCover; ctx.drawImage(snowCv, 0, 0); ctx.globalAlpha = 1;
}
function drawSnowfall(dt, now) {
  rc.globalCompositeOperation = 'source-over'; rc.clearRect(0, 0, PW, PH);
  rc.fillStyle = 'rgba(255,255,255,.9)';
  for (const f of flakes) {
    f.y += f.v * dt; f.x += Math.sin(now / 900 + f.ph) * .015 * dt - .008 * dt;
    if (f.y > PH) { f.y = -4; f.x = Math.random() * (PW + 60); }
    if (f.x < -4) f.x = PW + 2;
    const k = f.big ? 2 : 1; rc.fillRect(Math.round(f.x), Math.round(f.y), k, k);
  }
  rc.globalCompositeOperation = 'destination-in'; rc.drawImage(outdoorMask, 0, 0);
  ctx.drawImage(rainCv, 0, 0);
}

// ---- the dog: wanders between favourite spots, naps on its bed
const DOG = CONFIG.dog;
const DOG_WALK = new Set([' ', 'D']);
function sprite(w0, h0, paint, k = 1.8) {                 // pixel sprites drawn at k x their design grid, with an automatic outline
  const w = Math.ceil(w0 * k) + 2, h = Math.ceil(h0 * k) + 2;
  const px = Array.from({ length: h }, () => new Array(w).fill(null));
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y][x] = c; };
  const api = {
    ell(cx, cy, rx, ry, c) { cx = cx * k + 1; cy = cy * k + 1; rx *= k; ry *= k; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) put(x, y, c); },
    rect(x, y, ww, hh, c) { const x0 = Math.round(x * k) + 1, y0 = Math.round(y * k) + 1, x1 = Math.round((x + ww) * k) + 1, y1 = Math.round((y + hh) * k) + 1; for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) put(i, j, c); },
    dot(x, y, c) { api.rect(x, y, 1, 1, c); },
    px(x, y, c) { put(Math.round(x * k) + 1, Math.round(y * k) + 1, c); },
    outline(c) {
      const o = px.map(r => r.slice());
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!px[y][x] && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => px[y + dy]?.[x + dx])) o[y][x] = c;
      for (let y = 0; y < h; y++) px[y] = o[y];
    },
  };
  paint(api);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y][x]) { g.fillStyle = px[y][x]; g.fillRect(x, y, 1, 1); }
  return cv;
}
const FUR = '#d2a060', FUR_D = '#a87840', FUR_L = '#ecc890', INK = '#2a1e18';
const dogWalk = [0, 1].map(f => sprite(22, 14, s => {
  s.rect(f ? 6 : 5, 8, 2, 4, FUR_D); s.rect(f ? 9 : 10, 8, 2, 4, FUR_D);            // back legs
  s.rect(f ? 13 : 14, 8, 2, 4, FUR_D); s.rect(f ? 16 : 15, 8, 2, 4, FUR_D);          // front legs
  s.ell(11, 7, 6.5, 3.4, FUR); s.ell(11, 6, 5, 1.6, FUR_L);                         // body, sunny back
  s.ell(17, 4.6, 3.4, 3.1, FUR); s.rect(19, 4, 2, 3, FUR);                          // head, snout
  s.rect(15, 2, 2, 4, FUR_D);                                                       // ear
  if (f) { s.dot(4, 5, FUR); s.dot(3, 4, FUR); s.dot(2, 3, FUR); } else { s.dot(4, 6, FUR); s.dot(3, 6, FUR); s.dot(2, 5, FUR); }
  s.outline(INK);
  s.px(18, 4, INK); s.px(18.5, 4, INK); s.rect(20.4, 4, 1, 1.4, INK);                // eye, nose
}));
const dogNap = sprite(20, 15, s => {
  s.ell(9.5, 8, 7.5, 5.5, FUR); s.ell(9, 8.5, 4.5, 3, FUR_L);                       // curled body
  s.ell(14, 6.5, 3.6, 3.2, FUR); s.rect(16, 7, 2, 2, FUR);                          // head resting on paws
  s.rect(11, 4, 2, 3, FUR_D); s.rect(15, 4, 2, 2, FUR_D);                           // ears
  s.dot(4, 10, FUR_D); s.dot(5, 11, FUR_D); s.dot(6, 12, FUR_D); s.dot(8, 12, FUR_D); // tail tucked round
  s.outline(INK);
  s.px(13, 7, INK); s.px(13.6, 7, INK); s.px(15, 7, INK); s.px(15.6, 7, INK); s.rect(17.4, 7.4, 1, 1, INK);  // sleepy eyes, nose
});
const dog = DOG ? { x: DOG.bed.x, y: DOG.bed.y, path: [], wait: 4000 + Math.random() * 6000, face: 1, step: 0, napping: true, zz: 0 } : null;
function dogPath(fx, fy, tx, ty) {                         // BFS over floor cells, 8-way without cutting corners
  const ok = (c, r) => c >= 0 && r >= 0 && c < W && r < H && DOG_WALK.has(tiles[r][c]);
  const s = [Math.floor(fx), Math.floor(fy)], t = [Math.floor(tx), Math.floor(ty)];
  const prev = new Int32Array(W * H).fill(-1), q = [s[1] * W + s[0]]; prev[q[0]] = q[0];
  for (let i = 0; i < q.length; i++) {
    const c = q[i] % W, r = (q[i] / W) | 0;
    if (c === t[0] && r === t[1]) break;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const nc = c + dx, nr = r + dy, k = nr * W + nc;
      if (!ok(nc, nr) || prev[k] >= 0 || (dx && dy && (!ok(c + dx, r) || !ok(c, r + dy)))) continue;
      prev[k] = q[i]; q.push(k);
    }
  }
  const end = t[1] * W + t[0]; if (prev[end] < 0) return [];
  const out = []; for (let k = end; k !== prev[k]; k = prev[k]) out.push({ x: k % W + .5, y: ((k / W) | 0) + .5 });
  out.reverse();
  return out.filter((p, i) => i % 2 === 1 || i === out.length - 1);           // fewer, longer strides
}
function moveDog(dt) {
  if (!dog) return false;
  if (!dog.path.length) {
    dog.wait -= dt;
    if (dog.wait > 0) return false;
    const home = Math.random() < .3, spot = home ? DOG.bed : DOG.spots[(Math.random() * DOG.spots.length) | 0];
    dog.path = dogPath(dog.x, dog.y, spot.x, spot.y);
    if (home && dog.path.length) dog.path.push({ x: DOG.bed.x, y: DOG.bed.y });
    dog.home = home; dog.napping = false;
    dog.wait = home ? 25000 + Math.random() * 30000 : 5000 + Math.random() * 9000;
    return true;
  }
  const p = dog.path[0], dx = p.x - dog.x, dy = p.y - dog.y, d = Math.hypot(dx, dy), v = .0045 * dt;  // ~4.5 cells/s, a trot
  if (Math.abs(dx) > .05) dog.face = dx > 0 ? 1 : -1;
  dog.step += dt;
  if (d <= v) { dog.x = p.x; dog.y = p.y; dog.path.shift(); if (!dog.path.length) dog.napping = dog.home || Math.random() < .5; }
  else { dog.x += dx / d * v; dog.y += dy / d * v; }
  return true;
}
function drawDog(now) {
  if (!dog) return;
  const x = Math.round(dog.x * CELL), y = Math.round(dog.y * CELL);
  ctx.fillStyle = 'rgba(20,12,24,.28)';
  ctx.fillRect(x - 14, y + 8, 28, 4); ctx.fillRect(x - 11, y + 12, 22, 2);
  if (dog.napping || !dog.path.length) {
    ctx.drawImage(dogNap, x - (dogNap.width >> 1), y - (dogNap.height >> 1) - 2);
    if (dog.napping) {                                     // floating z's
      const t = (now / 900) % 3;
      ctx.fillStyle = 'rgba(255,248,220,.85)'; ctx.font = 'bold 7px ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('z', x + 14 + (t | 0), y - 12 - (t * 4 | 0));
    }
    return;
  }
  const img = dogWalk[(dog.step / 140 | 0) % 2];
  ctx.save(); ctx.translate(x, y);
  if (dog.face < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, -(img.width >> 1), -(img.height >> 1) - 4 + ((dog.step / 140 | 0) % 2 ? 0 : -1));
  ctx.restore();
}

const map = new Image();
map.src = MAP_SRC;

// four-blade ceiling fan; motion-blur ring when spinning fast
function drawFan(f) {
  const cx = f.x * CELL, cy = f.y * CELL, len = 22, w = 4;
  const blade = f.blade || [70, 52, 44];
  if (f.speed > .6) {
    ctx.fillStyle = `rgba(${blade},.22)`;
    ctx.beginPath(); ctx.arc(cx, cy, len, 0, Math.PI * 2); ctx.fill();
  }
  // snap the angle to 16 steps so the spin reads as pixel animation frames
  const a = Math.round(f.angle / (Math.PI / 8)) * (Math.PI / 8);
  ctx.fillStyle = `rgb(${blade})`; ctx.strokeStyle = '#1e1826'; ctx.lineWidth = 1;
  for (let k = 0; k < 4; k++) {
    const t = a + k * Math.PI / 2, dx = Math.cos(t), dy = Math.sin(t);
    ctx.beginPath();
    ctx.moveTo(cx - dy * w, cy + dx * w * .6);
    ctx.lineTo(cx + dx * len - dy * w, cy + dy * len + dx * w);
    ctx.lineTo(cx + dx * len + dy * w, cy + dy * len - dx * w);
    ctx.lineTo(cx + dy * w, cy - dx * w * .6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#3a3036'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
}

function drawStrip(l, t, now) {
  const { x0, y0, x1, y1 } = l.strip;
  const ax = Math.round(x0 * CELL), ay = Math.round(y0 * CELL), bx = Math.round(x1 * CELL), by = Math.round(y1 * CELL);
  const horiz = Math.abs(bx - ax) >= Math.abs(by - ay);
  ctx.fillStyle = '#1e1826';
  if (horiz) ctx.fillRect(Math.min(ax, bx) - 1, ay - 2, Math.abs(bx - ax) + 2, 4); else ctx.fillRect(ax - 2, Math.min(ay, by) - 1, 4, Math.abs(by - ay) + 2);
  const off = [150, 146, 160], on = l.color || [255, 220, 90];
  const n = Math.round(Math.hypot(bx - ax, by - ay) / 3);
  for (let k = 0; k <= n; k++) {                                     // individual LEDs, chasing shimmer when on
    const px = Math.round(ax + (bx - ax) * k / n), py = Math.round(ay + (by - ay) * k / n);
    const tw = t > .5 ? .75 + .25 * Math.sin(now / 180 - k * .6) : 1;
    const c = off.map((v, i) => Math.round(v + (on[i] * tw - v) * t));
    ctx.fillStyle = `rgb(${c})`;
    ctx.fillRect(px - 1, py - 1, 2, 2);
  }
}

// brass chandelier: a sweeping arm with white globes that warm up when on
function globe(x, y, r, t) {
  const off = [228, 228, 222], on = [255, 236, 170];
  ctx.fillStyle = '#1e1826'; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgb(${off.map((v, i) => Math.round(v + (on[i] - v) * t))})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = t > .5 ? '#fffdf2' : '#ffffff'; ctx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), 2, 2);
}
function drawGlobes(f, t) {
  const cx = f.x * CELL, cy = f.y * CELL;
  const pts = [[-14, -8], [-4, -12], [8, -6], [14, 8]];
  ctx.strokeStyle = '#b8902e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx + pts[0][0], cy + pts[0][1]);
  ctx.quadraticCurveTo(cx + 2, cy - 18, cx + pts[2][0], cy + pts[2][1]); ctx.quadraticCurveTo(cx + 16, cy - 2, cx + pts[3][0], cy + pts[3][1]); ctx.stroke();
  ctx.fillStyle = '#d8b04a'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
  for (const [dx, dy] of pts) globe(cx + dx, cy + dy, 4, t);
}
function drawPendants(f, t) {
  for (const dy of [-9, 9]) {
    const x = Math.round(f.x * CELL), y = Math.round(f.y * CELL + dy);
    ctx.fillStyle = '#1e1826'; ctx.fillRect(x - 3, y - 4, 6, 8);
    ctx.fillStyle = t > .5 ? '#ffe6a0' : '#c9c6bc'; ctx.fillRect(x - 2, y - 3, 4, 6);
    ctx.fillStyle = t > .5 ? '#fffbe6' : '#ecebe6'; ctx.fillRect(x - 1, y - 2, 1, 3);
  }
}

function drawBulb(l, t, now) {
  const x = Math.round(l.x * CELL), y = Math.round(l.y * CELL);
  ctx.fillStyle = '#1e1826'; ctx.fillRect(x - 4, y - 3, 8, 6); ctx.fillRect(x - 3, y - 4, 6, 8);
  const off = [176, 172, 186], on = [255, 220, 90];
  const mix = off.map((v, i) => Math.round(v + (on[i] - v) * t));
  ctx.fillStyle = `rgb(${mix})`; ctx.fillRect(x - 3, y - 2, 6, 4); ctx.fillRect(x - 2, y - 3, 4, 6);
  ctx.fillStyle = t > .5 ? '#fffbe6' : '#e4e2ea'; ctx.fillRect(x - 2, y - 2, 2, 2);
  if (t > .5) { // twinkle pixels
    const k = Math.floor(now / 250 + l.phase) % 4;
    ctx.fillStyle = 'rgba(255,248,200,.9)';
    const s = [[0,-7],[7,0],[0,7],[-7,0]][k]; ctx.fillRect(x + s[0] - 1, y + s[1] - 1, 2, 2);
  }
}

// blinds roll down over the window glass (wall-top band and the 3/4 face below it)
function drawBlinds(cv) {
  if (cv.level <= 0) return;
  const x0 = cv.c0 * CELL, x1 = (cv.c1 + 1) * CELL;
  for (const [y, hgt] of [[cv.row * CELL + 2, 4], [(cv.row + 1) * CELL + 1, 3]]) {
    const hh = Math.max(1, Math.round(hgt * cv.level));
    ctx.fillStyle = '#eee8d8'; ctx.fillRect(x0 + 1, y, x1 - x0 - 2, hh);
    ctx.fillStyle = '#c4bcaa';
    for (let yy = y + 1; yy < y + hh; yy += 2) ctx.fillRect(x0 + 1, yy, x1 - x0 - 2, 1);
  }
  ctx.fillStyle = '#8a7a64';                                    // pull cord
  ctx.fillRect(x1 - 4, (cv.row + 1) * CELL + 1, 1, Math.round(3 * cv.level) + 1);
}

// garage door: the panel rolls up under the ceiling; blinks once open past the alert time
const garageAlert = cv => cv.kind === 'garage' && !cv.closed && cv.openSince && Date.now() - cv.openSince >= (cv.alert_after_min ?? 35) * 60000;
const openMins = cv => Math.max(0, Math.floor((Date.now() - cv.openSince) / 60000));
function drawGarage(cv, now) {
  const x0 = cv.c0 * CELL, x1 = (cv.c1 + 1) * CELL, y = cv.row * CELL, o = cv.level, w = x1 - x0;
  if (o > 0) {
    ctx.drawImage(map, x0, y - CELL, w, CELL, x0, y, w, CELL);              // doorway shows floor
    const shut = Math.round(CELL * (1 - o));
    if (shut > 0) {
      ctx.fillStyle = '#dcdcd6'; ctx.fillRect(x0, y + CELL - shut, w, shut);
      ctx.fillStyle = '#aaaaa6'; ctx.fillRect(x0, y + CELL - shut, w, 1);
    }
    const len = Math.round(o * 13 * CELL);                                    // overhead panel, seen through the roof
    ctx.fillStyle = 'rgba(236,236,230,.22)'; ctx.fillRect(x0 + 2, y - len, w - 4, len);
    ctx.fillStyle = 'rgba(250,250,246,.5)';
    for (let yy = y - len; yy < y; yy += 6) ctx.fillRect(x0 + 2, yy, w - 4, 1);
    ctx.fillRect(x0 + 2, y - len, 1, len); ctx.fillRect(x1 - 3, y - len, 1, len);
    ctx.fillStyle = 'rgba(40,40,44,.5)'; ctx.fillRect((x0 + x1) / 2 - 1, y - 13 * CELL - 6, 2, 13 * CELL + 6 - len); // opener rail
  }
  if (garageAlert(cv) && Math.floor(now / 450) % 2 === 0) {
    ctx.fillStyle = '#ff4a5a';
    ctx.fillRect(x0 - 2, y - 2, w + 4, 2); ctx.fillRect(x0 - 2, y + CELL, w + 4, 2);
    ctx.fillRect(x0 - 2, y, 2, CELL); ctx.fillRect(x1, y, 2, CELL);
    const bx = Math.round((x0 + x1) / 2), by = y - 26;                     // "!" bubble
    ctx.fillStyle = '#1a1420'; ctx.fillRect(bx - 7, by - 1, 14, 16); ctx.fillRect(bx - 2, by + 15, 4, 3);
    ctx.fillStyle = '#ff4a5a'; ctx.fillRect(bx - 6, by, 12, 14); ctx.fillRect(bx - 1, by + 14, 2, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 1, by + 2, 2, 7); ctx.fillRect(bx - 1, by + 10, 2, 2);
  }
}

function drawLabels() {
  ctx.font = 'bold 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const room of LAYOUT.rooms) {
    const [c0, r0, c1, r1] = room.rects[0];
    const x = (c0 + c1 + 1) / 2 * CELL, y = (r0 + r1 + 1) / 2 * CELL;
    const w = ctx.measureText(room.name).width + 6;
    ctx.fillStyle = 'rgba(18,14,24,.8)'; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 7), Math.round(w), 13);
    ctx.fillStyle = '#ffe9a8'; ctx.fillText(room.name, x, y);
  }
}

let last = performance.now(), lastPaint = 0, lastClock = 0;
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  let animating = false;
  for (const cv of covers) {
    const target = cv.kind === 'garage' ? (cv.closed ? 0 : 1) : 1 - cv.pos / 100;   // garage level = how open; blinds level = how far down
    const ms = cv.kind === 'garage' ? 2600 : 700;
    if (cv.level !== target) { cv.level = Math.max(0, Math.min(1, cv.level + Math.sign(target - cv.level) * dt / ms)); animating = true; }
  }
  const dogMoving = moveDog(dt);
  for (const l of lights) {
    const target = l.on ? 1 : 0;
    if (l.level !== target) {
      l.level += Math.sign(target - l.level) * dt / 450;
      l.level = Math.max(0, Math.min(1, l.level));
      animating = true;
    }
  }
  for (const f of fans) {                                         // spin up / coast down
    f.speed += ((f.on ? 1 : 0) - f.speed) * Math.min(1, dt / 900);
    if (f.speed < .002 && !f.on) f.speed = 0;
    f.angle += f.speed * dt / 90;
  }
  const anyOn = lights.some(l => l.level > 0) || fans.some(f => f.speed > 0) || dogMoving || weather !== 'clear' || snowCover > 0 || garageDoors.some(garageAlert) || (dog && dog.napping);
  // repaint every frame while fading, ~12 fps for idle motion (chunky, retro)
  if (animating || (anyOn && now - lastPaint > 80) || now - lastPaint > 1000) { paint(now, now - lastPaint); lastPaint = now; }
  if (now - lastClock > 30000) { lastClock = now; if (!sel) { const st = side.querySelector('#skyst'); if (st) st.textContent = skyText(); } garageDoors.forEach(g => { if (!g.closed) render(); }); }
  if (!stopped) raf = requestAnimationFrame(frame);
}

function paint(now, dt = 16) {
  if (!map.complete) return;
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(map, 0, 0);
  for (const cv of garageDoors) drawGarage(cv, now);
  drawSnowGround(Math.min(100, dt));
  drawDog(now);
  for (const f of fans) drawFan(f);
  const amb = ambient(skyNow().elev);
  // night layer, with light cut out of it
  dc.globalCompositeOperation = 'source-over';
  dc.clearRect(0, 0, PW, PH);
  dc.fillStyle = `rgba(${amb.col},${amb.alpha})`;
  dc.fillRect(0, 0, PW, PH);
  for (const l of lights) {
    if (l.level <= 0) continue;
    const e = l.level * l.level * (3 - 2 * l.level);
    for (const f of l.fx) {
      const flick = 1 + 0.025 * Math.sin(now / 420 + f.phase) + 0.012 * Math.sin(now / 97 + f.phase * 3);
      dc.globalCompositeOperation = 'destination-out';
      dc.drawImage(maskedLight(f, f.strip ? e * .7 : e, flick), 0, 0);
    }
  }
  ctx.drawImage(dark, 0, 0);
  // warm glow on top
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    if (l.level <= 0) continue;
    const e = l.level * l.level * (3 - 2 * l.level);
    ctx.globalAlpha = (l.strip ? 0.16 : 0.24) * (.35 + .65 * amb.night);   // glow reads less in daylight
    for (const f of l.fx) {
      const flick = 1 + 0.025 * Math.sin(now / 420 + f.phase);
      ctx.drawImage(maskedLight(f, e, flick * .85, l.tint), 0, 0);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const l of lights) {
    if (l.strip) drawStrip(l, l.level, now);
    else if (l.style === 'globes') drawGlobes(l.fx[0], l.level);
    else if (l.style === 'pendants') drawPendants(l.fx[0], l.level);
    else for (const f of l.fx) drawBulb(f, l.level, now);
  }
  for (const cv of covers) if (cv.kind !== 'garage') drawBlinds(cv);
  if (weather === 'snow') drawSnowfall(Math.min(100, dt), now);
  else if (weather !== 'clear') drawRain(Math.min(100, dt));
  for (const cv of garageDoors) if (garageAlert(cv)) drawGarage({ ...cv, level: 0 }, now);   // alert stays visible over the rain
  if (sel && focusMask) ctx.drawImage(focusMask, 0, 0);
  if (showLabels) drawLabels();
}


// ---- rooms: groups of layout rooms that act as tap targets
const ROOMS = (CONFIG.rooms || LAYOUT.rooms.map(r => ({ id: r.id, name: r.name, includes: [r.id] })));
const groupOf = {};                       // layout room id -> group id
for (const g of ROOMS) for (const r of g.includes) groupOf[r] = g.id;
const roomGrid = new Array(W * H).fill(null);
for (const r of LAYOUT.rooms) for (const [c0, r0, c1, r1] of r.rects)
  for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) roomGrid[y * W + x] = groupOf[r.id] || null;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
  if (!roomGrid[y * W + x] && OUTDOOR.has(tiles[y][x]) && groupOf.outside !== undefined) roomGrid[y * W + x] = 'outside';
const devRoom = d => groupOf[d.room] || d.room;
const inRoom = id => ({
  lights: lights.filter(l => devRoom(l) === id),
  fans: fans.filter(f => devRoom(f) === id),
  covers: covers.filter(c => devRoom(c) === id),
});
function roomAt(x, y) {                   // map cell -> room group (walls snap to the nearest room)
  const cx = Math.floor(x), cy = Math.floor(y);
  for (let rad = 0; rad <= 2; rad++)
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const g = roomGrid[(cy + dy) * W + (cx + dx)];
      if (g && cy + dy >= 0 && cy + dy < H && cx + dx >= 0 && cx + dx < W) return g;
    }
  return null;
}
function roomBox(id) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const grow = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
  const g = ROOMS.find(r => r.id === id);
  if (id !== 'outside') for (const r of LAYOUT.rooms) if (g.includes.includes(r.id)) for (const [c0, r0, c1, r1] of r.rects) grow(c0, r0, c1 + 1, r1 + 1);
  const d = inRoom(id);
  for (const l of d.lights) for (const f of l.fx) grow(f.x - 2, f.y - 2, f.x + 2, f.y + 2);
  for (const f of d.fans) grow(f.x - 3, f.y - 3, f.x + 3, f.y + 3);
  for (const c of d.covers) grow(c.c0, c.row - 1, c.c1 + 1, c.row + 2);
  const pad = 3;
  return [Math.max(0, x0 - pad), Math.max(0, y0 - pad), Math.min(W, x1 + pad), Math.min(H, y1 + pad)];
}
function buildFocus(id) {                 // dims everything outside the chosen room
  const m = document.createElement('canvas'); m.width = PW; m.height = PH;
  const g = m.getContext('2d');
  g.fillStyle = 'rgba(8,6,16,.55)'; g.fillRect(0, 0, PW, PH);
  g.globalCompositeOperation = 'destination-out';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (roomGrid[y * W + x] === id) g.fillRect(x * CELL - CELL, y * CELL - CELL, CELL * 3, CELL * 3);
  }
  return m;
}

// ---- camera: CSS transform on the canvas keeps pixels crisp
const stage = $id('stage');
function applyCamera() {
  if (!sel || sel === 'outside') { canvas.style.transform = 'none'; return; }   // outside wraps the whole house: show it all
  const [x0, y0, x1, y1] = roomBox(sel);
  const s = Math.min(W / (x1 - x0), H / (y1 - y0), 5);
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const tx = -x0 / W * sw * s + (sw - (x1 - x0) / W * sw * s) / 2;
  const ty = -y0 / H * sh * s + (sh - (y1 - y0) / H * sh * s) / 2;
  canvas.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
}
new ResizeObserver(applyCamera).observe(stage);
function openRoom(id) {
  sel = id; focusMask = id ? buildFocus(id) : null;
  $id('crumb').style.display = id ? 'block' : 'none';
  $id('hint').textContent = id ? 'Tap outside the room to go back' : 'Tap a light to toggle it, or a room to open it';
  applyCamera(); render(); paint(performance.now());
  bridge.onRoom?.(id);
}
$id('back').onclick = () => openRoom(null);

// ---- canvas input
function cellOf(ev) {
  const rect = canvas.getBoundingClientRect();
  return [(ev.clientX - rect.left) / rect.width * W, (ev.clientY - rect.top) / rect.height * H];
}
function deviceAt(x, y) {
  const overview = !sel;
  if (!overview) for (const f of fans) {               // fan blades vs hub is too fine to aim at on the overview
    if (devRoom(f) !== sel) continue;
    const dd = Math.hypot(f.x - x, f.y - y);
    if (dd > 1.1 && dd < 3.4) return { fan: f };
  }
  // on the overview a light's tap target is at least ~18 screen px across, so it works on a phone too
  const cellPx = canvas.getBoundingClientRect().width / W;
  let best = null, bd = overview ? Math.max(2, 9 / cellPx) : 2.6;
  for (const l of lights) { if (!overview && devRoom(l) !== sel) continue; for (const f of l.fx) { const dd = Math.hypot(f.x - x, f.y - y); if (dd < bd) { bd = dd; best = { light: l }; } } }
  if (best) return best;
  for (const c of covers) {
    if (overview && c.kind === 'garage') continue;      // never open the garage from a stray overview tap
    if (!overview && devRoom(c) !== sel) continue;
    if (x >= c.c0 - 1 && x <= c.c1 + 2 && Math.abs(y - (c.row + .5)) < (c.kind === 'garage' ? 3.5 : 2.2)) return { cover: c };
  }
  return null;
}
let press = null;
const toastEl = $id('toast');
function toast(t) { toastEl.textContent = t; toastEl.style.opacity = 1; clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.style.opacity = 0, 1400); }
canvas.addEventListener('pointerdown', ev => {
  const [x, y] = cellOf(ev);
  press = { x, y, long: false, timer: null };
  if (!sel) press.timer = setTimeout(() => {           // long-press a room on the overview: toggle its lights
    const id = roomAt(x, y); if (!id) return;
    const ls = inRoom(id).lights; if (!ls.length) return;
    const any = ls.some(l => l.on); ls.forEach(l => { if (!l.na) { l.on = !any; act('light', l, !any); } });
    press.long = true; render();
    toast(`${ROOMS.find(r => r.id === id).name}: lights ${any ? 'off' : 'on'}`);
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
  }, 500);
});
canvas.addEventListener('pointerup', ev => {
  if (!press) return;
  clearTimeout(press.timer);
  if (press.long) { press = null; return; }
  const [x, y] = cellOf(ev); press = null;
  const d = deviceAt(x, y);
  if (d) {
    const it = d.light || d.fan || d.cover; if (it.na) { toast(`${it.name} is unavailable`); return; }
    if (d.light) { d.light.on = !d.light.on; act('light', d.light, d.light.on); } if (d.fan) { d.fan.on = !d.fan.on; act('fan', d.fan, d.fan.on); } if (d.cover) { setCover(d.cover, !d.cover.closed); act('cover', d.cover, !d.cover.closed); }
    render();
    if (!sel) { const it = d.light || d.cover; toast(`${it.name}: ${d.light ? (it.on ? 'on' : 'off') : it.closed ? 'closed' : 'open'}`); }
    return;
  }
  if (!sel) { const id = roomAt(x, y); if (id) openRoom(id); return; }
  const id = roomAt(x, y);
  openRoom(id && id !== sel ? id : null);
});
canvas.addEventListener('pointercancel', () => { if (press) clearTimeout(press.timer); press = null; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---- side panel
const ICON = {
  bulb: '<svg class="ico" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="2" y="0" width="4" height="1" fill="C"/><rect x="1" y="1" width="6" height="3" fill="C"/><rect x="2" y="4" width="4" height="1" fill="C"/><rect x="3" y="5" width="2" height="1" fill="#8a8296"/><rect x="2" y="6" width="4" height="1" fill="#6d6578"/><rect x="2" y="1" width="1" height="1" fill="#fff8"/></svg>',
  strip: '<svg class="ico" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="0" y="3" width="8" height="2" fill="#120e18"/><rect x="0" y="3" width="1" height="1" fill="C"/><rect x="2" y="4" width="1" height="1" fill="C"/><rect x="4" y="3" width="1" height="1" fill="C"/><rect x="6" y="4" width="1" height="1" fill="C"/></svg>',
  fan: '<svg class="ico" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="3" y="0" width="2" height="3" fill="C"/><rect x="5" y="3" width="3" height="2" fill="C"/><rect x="3" y="5" width="2" height="3" fill="C"/><rect x="0" y="3" width="3" height="2" fill="C"/><rect x="3" y="3" width="2" height="2" fill="#120e18"/></svg>',
  garage: '<svg class="ico" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="0" y="1" width="8" height="7" fill="#3a3046"/><rect x="0" y="0" width="8" height="1" fill="#8a7e9a"/><rect x="1" y="1" width="6" height="H" fill="#dcdcd6"/><rect x="1" y="3" width="6" height="1" fill="#aaaaa6" opacity=".8"/><rect x="1" y="5" width="6" height="1" fill="#aaaaa6" opacity=".8"/></svg>',
  blinds: '<svg class="ico" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect x="0" y="0" width="8" height="8" fill="#82c0e6"/><rect x="0" y="0" width="8" height="H" fill="#eee8d8"/><rect x="0" y="1" width="8" height="1" fill="#c4bcaa" opacity="O"/><rect x="0" y="3" width="8" height="1" fill="#c4bcaa" opacity="O"/><rect x="0" y="0" width="1" height="8" fill="#f6f2e8"/><rect x="7" y="0" width="1" height="8" fill="#f6f2e8"/></svg>',
};
const PRESETS = [[255, 190, 90], [255, 90, 120], [190, 110, 255], [90, 150, 255], [90, 230, 190], [250, 250, 240]];
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
const side = $id('side');
function countOn(id) { const d = inRoom(id); return d.lights.filter(l => l.on).length + d.fans.filter(f => f.on).length; }
function render() {
  side.innerHTML = sel ? roomPanel(sel) : housePanel();
  bindPanel();
}
function housePanel() {
  const on = lights.filter(l => l.on).length;
  const rows = ROOMS.map(r => {
    const d = inRoom(r.id), n = d.lights.length + d.fans.length + d.covers.length;
    if (!n) return '';
    const k = countOn(r.id), gd = d.covers.find(c => c.kind === 'garage' && !c.closed);
    const st = gd ? `door open${k ? ', ' + k + ' on' : ''}` : k ? k + ' on' : 'all off';
    return `<button class="room${k || gd ? ' lit' : ''}${gd && garageAlert(gd) ? ' warn' : ''}" data-room="${r.id}"><span>${r.name}</span><span class="st">${st} &rsaquo;</span></button>`;
  }).join('');
  const alerts = garageDoors.filter(garageAlert).map(g => `<div class="alert"><span>${g.name} open ${openMins(g)} min</span><button data-cover="${g.id}" data-v="close">Close</button></div>`).join('');
  return `${alerts}<div class="top"><div><h1>Main floor</h1><div class="sub">${on} of ${lights.length} lights on · <span id="skyst">${skyText()}</span></div></div>
</div>
    <div class="list rooms">${rows}</div>
    ${bridge.demo ? `<div class="row2"><label>Time <input id="clock" type="range" min="0" max="24" step="0.25" value="${clockMode === 'live' ? nowHour() : clockHour}"></label>
    <button id="live" aria-pressed="${clockMode === 'live'}">Live</button></div>
    <div class="row2"><div class="seg">${['clear', 'rain', 'storm', 'snow'].map(w => `<button aria-pressed="${weather === w}" data-weather="${w}">${w[0].toUpperCase() + w.slice(1)}</button>`).join('')}</div>
    <label><input id="labels" type="checkbox" ${showLabels ? 'checked' : ''}> Labels</label></div>
    <div class="note">Preview with sample state. In Home Assistant each control reads and sets the real device, the light follows sun.sun and rain and snow follow your weather entity.</div>` : ''}`;
}
const nowHour = () => { const d = new Date(); return Math.round((d.getHours() + d.getMinutes() / 60) * 4) / 4; };
function skyText() {
  const { date, elev } = skyNow();
  return `${skyLabel(elev)}, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${weather === 'clear' ? '' : ({ rain: ', raining', storm: ', storming', snow: ', snowing' })[weather]}`;
}
function roomPanel(id) {
  const r = ROOMS.find(x => x.id === id), d = inRoom(id), k = countOn(id);
  const rows = [];
  for (const l of d.lights) {
    const col = l.color ? `rgb(${l.color})` : '#ffd95a';
    rows.push(`<div class="dev${l.on ? ' on' : ''}${l.na ? ' na' : ''}">${ICON[l.strip ? 'strip' : 'bulb'].replaceAll('fill="C"', `fill="${l.on ? col : '#77708a'}"`)}
      <div class="nm">${l.name}<small>${l.na ? 'Unavailable' : l.on ? 'On' : 'Off'}${l.rgb ? ' · color strip' : ''}</small></div>
      <button class="sw" aria-label="${l.name}" aria-pressed="${l.on}" data-light="${l.id}"></button>
      ${l.rgb ? `<div class="chips">${PRESETS.map(p => `<button class="chip" style="background:${hex(p)}" aria-label="Set ${l.name} color" aria-pressed="${hex(p) === hex(l.color || [])}" data-color="${l.id}" data-v="${hex(p)}"></button>`).join('')}
        <input type="color" aria-label="Custom color" value="${hex(l.color || [255, 220, 90])}" data-pick="${l.id}"></div>` : ''}
    </div>`);
  }
  for (const f of d.fans) rows.push(`<div class="dev${f.on ? ' on' : ''}${f.na ? ' na' : ''}">${ICON.fan.replaceAll('fill="C"', `fill="${f.on ? '#ffd95a' : '#77708a'}"`)}
      <div class="nm">${f.name}<small>${f.na ? 'Unavailable' : f.on ? 'Spinning' : 'Off'}</small></div>
      <button class="sw" aria-label="${f.name}" aria-pressed="${f.on}" data-fan="${f.id}"></button></div>`);
  for (const c of d.covers.filter(c => c.kind === 'garage')) rows.push(`<div class="dev${c.closed ? '' : ' on'}${garageAlert(c) ? ' warn' : ''}${c.na ? ' na' : ''}">${ICON.garage.replace('height="H"', `height="${c.closed ? 7 : 2}"`)}
      <div class="nm">${c.name}<small>${c.na ? 'Unavailable' : c.closed ? 'Closed' : `Open · ${openMins(c)} min${garageAlert(c) ? ' · close it?' : ''}`}</small></div>
      <div class="seg"><button aria-pressed="${!c.closed}" data-cover="${c.id}" data-v="open">Open</button><button aria-pressed="${c.closed}" data-cover="${c.id}" data-v="close">Close</button></div>
      ${bridge.demo && !c.closed && !garageAlert(c) ? `<div class="chips"><button class="mini" data-skip="${c.id}">Preview: skip ahead ${c.alert_after_min ?? 35} min</button></div>` : ''}</div>`);
  for (const c of d.covers.filter(c => c.kind !== 'garage')) rows.push(`<div class="dev${c.na ? ' na' : ''}">${ICON.blinds.replace('height="H"', `height="${Math.max(1, Math.round(8 * (1 - c.pos / 100)))}"`).replaceAll('opacity="O"', `opacity="${c.pos < 60 ? 1 : 0}"`)}
      <div class="nm">${c.name}<small data-poslabel="${c.id}">${c.na ? 'Unavailable' : blindsText(c.pos)}</small></div>
      <div class="seg"><button aria-pressed="${c.pos === 100}" data-cover="${c.id}" data-v="open">Open</button><button aria-pressed="${c.pos === 0}" data-cover="${c.id}" data-v="close">Close</button></div>
      <label class="pos"><span>Closed</span><input type="range" min="0" max="100" step="5" value="${c.pos}" aria-label="${c.name} position, percent open" data-pos="${c.id}"><span>Open</span></label></div>`);
  return `<div class="top"><div><h2>${r.name}</h2><div class="sub">${[k ? k + ' on' : '', ...d.covers.filter(c => c.kind === 'garage' && !c.closed).map(c => c.name + ' open')].filter(Boolean).join(' · ') || 'Everything off'}</div></div>
</div>
    <div class="list">${rows.join('') || '<div class="empty">Nothing to control here yet.</div>'}</div>`;
}
function setCover(c, closed) {
  if (c.closed !== closed && !closed) c.openSince = Date.now();
  c.closed = closed; c.pos = closed ? 0 : 100;
}
const blindsText = p => p >= 100 ? 'Open' : p <= 0 ? 'Closed' : `${p}% open`;
function bindPanel() {
  const $ = q => side.querySelectorAll(q);
  $('[data-room]').forEach(b => b.onclick = () => openRoom(b.dataset.room));
  $('[data-light]').forEach(b => b.onclick = () => { const l = lights.find(x => x.id === b.dataset.light); l.on = !l.on; act('light', l, l.on); render(); });
  $('[data-fan]').forEach(b => b.onclick = () => { const f = fans.find(x => x.id === b.dataset.fan); f.on = !f.on; act('fan', f, f.on); render(); });
  $('[data-cover]').forEach(b => b.onclick = () => { const c = covers.find(x => x.id === b.dataset.cover); setCover(c, b.dataset.v === 'close'); act('cover', c, b.dataset.v !== 'close'); render(); });
  $('[data-pos]').forEach(i => {
    const c = covers.find(x => x.id === i.dataset.pos);
    i.oninput = () => { c.pos = +i.value; c.closed = c.pos === 0; side.querySelector(`[data-poslabel="${c.id}"]`).textContent = blindsText(c.pos); };
    i.onchange = () => { act('cover', c, c.pos > 0, { position: c.pos }); render(); };
  });
  $('[data-skip]').forEach(b => b.onclick = () => { const c = covers.find(x => x.id === b.dataset.skip); c.openSince -= (c.alert_after_min ?? 35) * 60000; render(); });
  $('[data-weather]').forEach(b => b.onclick = () => { weather = b.dataset.weather; render(); });
  const ck = side.querySelector('#clock'); if (ck) ck.oninput = e => { clockMode = 'set'; clockHour = +e.target.value; side.querySelector('#skyst').textContent = skyText(); side.querySelector('#live').setAttribute('aria-pressed', 'false'); paint(performance.now()); };
  const lv = side.querySelector('#live'); if (lv) lv.onclick = () => { clockMode = 'live'; render(); };
  const setColor = (id, v, send) => { const l = lights.find(x => x.id === id); l.color = [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)); l.tint = `rgb(${l.color})`; l.on = true; if (send) act('light', l, true, { rgb_color: l.color }); };
  $('[data-color]').forEach(b => b.onclick = () => { setColor(b.dataset.color, b.dataset.v, true); render(); });
  $('[data-pick]').forEach(i => { i.oninput = () => setColor(i.dataset.pick, i.value); i.onchange = () => { setColor(i.dataset.pick, i.value, true); render(); }; });
  const lb = side.querySelector('#labels'); if (lb) lb.onchange = e => { showLabels = e.target.checked; paint(performance.now()); };
}

let raf = 0;

// ---- api the bridge uses to push state in
const WEATHER = { rainy: 'rain', pouring: 'rain', 'lightning-rainy': 'storm', lightning: 'storm', snowy: 'snow', 'snowy-rainy': 'snow', hail: 'snow' };
function setStates(states, first) {
  const st = e => e && states[e];
  for (const l of lights) {
    const s = st(l.entity); l.na = !s || s.state === 'unavailable';
    l.on = !!s && s.state === 'on';
    const rgb = s && s.attributes && s.attributes.rgb_color; if (rgb && l.rgb) { l.color = rgb; l.tint = `rgb(${rgb})`; }
    if (first) l.level = l.on ? 1 : 0;
  }
  for (const f of fans) { const s = st(f.entity); f.na = !s || s.state === 'unavailable'; f.on = !!s && s.state === 'on'; if (first) f.speed = f.on ? 1 : 0; }
  for (const c of covers) {
    const s = st(c.entity); c.na = !s || s.state === 'unavailable';
    if (!s || c.na) continue;
    const closed = s.state === 'closed' || s.state === 'closing';
    if (c.kind === 'garage') { c.closed = closed; c.openSince = closed ? 0 : Date.parse(s.last_changed); if (first) c.level = closed ? 0 : 1; }
    else { const p = s.attributes && s.attributes.current_position; c.pos = typeof p === 'number' ? p : closed ? 0 : 100; c.closed = c.pos === 0; if (first) c.level = 1 - c.pos / 100; }
  }
  const sun = st(SKY.sun || 'sun.sun'); liveElev = sun && sun.attributes && typeof sun.attributes.elevation === 'number' ? sun.attributes.elevation : null;
  const w = st(SKY.weather); weather = (w && WEATHER[w.state]) || 'clear';
  render();
}
const api = {
  lights, fans, covers, garageDoors, dog,
  setStates,
  set(k, v) { ({ clockMode: () => clockMode = v, clockHour: () => clockHour = v, weather: () => weather = v, snowCover: () => snowCover = v })[k](); },
  openRoom, render,
  destroy() { stopped = true; cancelAnimationFrame(raf); },
};
// ---- boot: the bridge seeds state (sample data in the preview, live states in HA)
bridge.init?.(api);
render();
map.onload = () => { openRoom(bridge.startRoom && ROOMS.some(r => r.id === bridge.startRoom) ? bridge.startRoom : null); };
raf = requestAnimationFrame(frame);
return api;
}
