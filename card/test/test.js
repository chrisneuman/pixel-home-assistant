// Drives the built card in a fake HA (harness.html) and checks taps become the right service calls.
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.json') ? 'application/json' : 'text/html' }); r.end(d); }); });
const OUT = process.argv[2] || '.';
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
srv.listen(0, async () => {
  const url = `http://localhost:${srv.address().port}/card/test/harness.html`;
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: 'America/Chicago' });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(url); await p.waitForFunction('window.ready'); await p.waitForTimeout(1200);
  const sh = s => p.locator('pixel-house-card').locator(s);
  ok((await sh('.room').count()) >= 8, 'house panel lists rooms');
  ok(/Kitchen|Living/.test(await sh('.side').innerText()), 'living/kitchen room shown');
  await p.screenshot({ path: `${OUT}/card-house.png` });
  // overview tap on the kitchen light -> switch.kitchen_light off (it starts on)
  const box = await sh('canvas').boundingBox();
  const at = (x, y) => p.mouse.click(box.x + x / 111 * box.width, box.y + y / 88 * box.height);
  await at(94.9, 15.0); await p.waitForTimeout(400);
  let calls = await p.evaluate('window.calls');
  ok(JSON.stringify(calls.at(-1)) === JSON.stringify(['switch', 'turn_off', { entity_id: 'switch.kitchen_light' }]), 'overview tap turns kitchen switch off: ' + JSON.stringify(calls.at(-1)));
  // open the master room from the list, toggle the fan from the panel
  await sh('[data-room="master"]').click(); await p.waitForTimeout(600);
  await sh('[data-fan="master_fan"]').click(); await p.waitForTimeout(300);
  calls = await p.evaluate('window.calls');
  ok(JSON.stringify(calls.at(-1)) === JSON.stringify(['fan', 'turn_off', { entity_id: 'fan.master_bedroom_master_bedroom_fan_fan' }]), 'master fan off: ' + JSON.stringify(calls.at(-1)));
  await sh('[data-cover="master_blinds"][data-v="close"]').click(); await p.waitForTimeout(300);
  calls = await p.evaluate('window.calls');
  ok(JSON.stringify(calls.at(-1)) === JSON.stringify(['cover', 'close_cover', { entity_id: 'cover.master_blinds_cover' }]), 'master blinds close');
  await sh('[data-pos="master_blinds"]').fill('40'); await sh('[data-pos="master_blinds"]').dispatchEvent('change'); await p.waitForTimeout(300);
  calls = await p.evaluate('window.calls');
  ok(JSON.stringify(calls.at(-1)) === JSON.stringify(['cover', 'set_cover_position', { entity_id: 'cover.master_blinds_cover', position: 40 }]), 'blinds slider -> set_cover_position 40: ' + JSON.stringify(calls.at(-1)));
  await sh('[data-color="master_closet"]').first().click(); await p.waitForTimeout(300);
  calls = await p.evaluate('window.calls');
  ok(calls.at(-1)[1] === 'turn_on' && Array.isArray(calls.at(-1)[2].rgb_color), 'closet strip color -> light.turn_on rgb_color');
  await p.screenshot({ path: `${OUT}/card-master.png` });
  // unavailable device: sink light can't be toggled
  await sh('#back').click(); await p.waitForTimeout(500);
  await sh('[data-room="living"]').click(); await p.waitForTimeout(600);
  const n0 = (await p.evaluate('window.calls')).length;
  ok((await sh('.dev.na').count()) >= 1, 'sink light shows unavailable');
  await sh('[data-light="kitchen_sink"]').click({ force: true }).catch(() => {}); await p.waitForTimeout(200);
  ok((await p.evaluate('window.calls')).length === n0, 'no call for unavailable light');
  // garage door open 40 min -> alert banner
  await sh('#back').click(); await p.waitForTimeout(400);
  await p.evaluate(() => setState('cover.garage_door', { state: 'open', last_changed: new Date(Date.now() - 40 * 60000).toISOString() }));
  await p.waitForTimeout(600);
  ok(/Garage door open 4\d min/.test(await sh('.alert').innerText().catch(() => '')), 'garage alert banner after 40 min');
  // weather + sun from HA
  await p.evaluate(() => { setState('weather.home', { state: 'snowy' }); setState('sun.sun', { state: 'below_horizon', attributes: { elevation: -14 } }); });
  await p.waitForTimeout(1500);
  ok(/Night/.test(await sh('#skyst').innerText()), 'sky label follows sun.sun');
  await p.screenshot({ path: `${OUT}/card-snow-night-garage.png` });
  // unrelated state churn should not rebuild the panel
  await p.evaluate(() => { window._p = document.querySelector('pixel-house-card').shadowRoot.querySelector('.room'); setState('sensor.random', { state: '1' }); });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => window._p === document.querySelector('pixel-house-card').shadowRoot.querySelector('.room')), 'ignores unrelated entity updates');
  // phone
  const c2 = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'America/Chicago' }); const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto(url); await q.waitForFunction('window.ready'); await q.waitForTimeout(1200);
  await q.screenshot({ path: `${OUT}/card-phone.png`, fullPage: true });
  // the offline preview uses the same engine with sample data
  const pv = await c2.newPage(); pv.on('pageerror', e => errs.push('preview: ' + e.message));
  await pv.goto(`http://localhost:${srv.address().port}/maps/main-floor/preview.html#m-bedroom`); await pv.waitForTimeout(1000);
  ok(/M.s room/.test(await pv.locator('#house').locator('h2').innerText().catch(() => '')), 'preview opens a room from the URL');
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  console.log(fails ? `${fails} failed` : 'all passed');
  await b.close(); srv.close(); process.exit(fails ? 1 : 0);
});
