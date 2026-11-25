"""Build dist/pixel-house-card.js (the HA card) and maps/main-floor/preview.html (offline preview) from card/src.

    python3 card/build.py        # needs PyYAML
"""
import base64, json, os, yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'card', 'src')
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()

def png(path):
    return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()

def floor(name):
    d = os.path.join(ROOT, 'maps', f'{name}-floor')
    return {
        'CONFIG': yaml.safe_load(rd(d, 'lights.yaml')),
        'LAYOUT': json.loads(rd(d, f'{name}-floor.json')),
        # theme -> map art; the first one is the default
        'MAP_SRC': {t: png(os.path.join(d, f'{name}-floor{sfx}.png')) for t, sfx in (('adventure', '-adventure'), ('classic', ''))
                    if os.path.exists(os.path.join(d, f'{name}-floor{sfx}.png'))},
        # theme -> sprite atlas for the live dog, cat and fans (themes without one use the drawn sprites)
        'SPRITES': {t: png(os.path.join(d, 'art', f'sprites-{t}.png')) for t in ('adventure',)
                    if os.path.exists(os.path.join(d, 'art', f'sprites-{t}.png'))},
    }

def version():
    return rd(ROOT, 'VERSION').strip()

engine = rd(SRC, 'engine.js').replace('export function mountHouse', 'function mountHouse', 1)
css, markup = rd(SRC, 'style.css'), rd(SRC, 'markup.html')
floors = {'main': floor('main')}
shared = (f'const FLOORS = {json.dumps(floors, separators=(",", ":"))};\n'
          f'const CSS = {json.dumps(css)};\nconst MARKUP = {json.dumps(markup)};\n' + engine + '\n')

os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
card = ('// Pixel House card for Home Assistant. Built by card/build.py, do not edit by hand.\n'
        + shared + rd(SRC, 'card.js').replace('__VERSION__', version()))
open(os.path.join(ROOT, 'dist', 'pixel-house-card.js'), 'w', encoding='utf-8').write(card)

page = rd(SRC, 'preview.html').replace('/*SHARED*/', shared).replace('/*PREVIEW*/', rd(SRC, 'preview.js'))
open(os.path.join(ROOT, 'maps', 'main-floor', 'preview.html'), 'w', encoding='utf-8').write(page)
print('wrote dist/pixel-house-card.js', len(card), 'and maps/main-floor/preview.html', len(page))
