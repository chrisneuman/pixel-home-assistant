"""Inline main-floor.png, main-floor.json and lights.yaml into preview.html (one self-contained file)."""
import base64, json, os, yaml
HERE = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: open(os.path.join(HERE, n), 'rb').read()
html = rd('preview.src.html').decode()
html = html.replace('/*LAYOUT*/null', json.dumps(json.loads(rd('main-floor.json')), separators=(',', ':')))
html = html.replace('/*CONFIG*/null', json.dumps(yaml.safe_load(rd('lights.yaml')), separators=(',', ':')))
html = html.replace('/*MAP*/', 'data:image/png;base64,' + base64.b64encode(rd('main-floor.png')).decode())
open(os.path.join(HERE, 'preview.html'), 'w').write(html)
print('wrote preview.html', len(html))
