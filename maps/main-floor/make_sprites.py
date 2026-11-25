"""Cut the live sprites (dog, cat, fan) out of chris's Gemini sheet 5 and key the magenta to transparent.

Sheet 5 at 2x (art/sheets/sheet5_animated_2x.png); slicing table in art/sheets/sheets_4_and_5.md.
The atlas keeps the sheet's own coordinates (rows 1-8 only), so the engine slices with that table.
    python3 make_sprites.py   -> art/sprites-adventure.png
"""
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
src = Image.open(os.path.join(HERE, 'art', 'sheets', 'sheet5_animated_2x.png')).convert('RGBA')
atlas = src.crop((0, 0, 420, 564))                       # dog rows, cat rows, fan row
px = atlas.load()
for y in range(atlas.height):
    for x in range(atlas.width):
        r, g, b, a = px[x, y]
        if r > 200 and g < 60 and b > 200: px[x, y] = (0, 0, 0, 0)
atlas.save(os.path.join(HERE, 'art', 'sprites-adventure.png'), optimize=True)
print('wrote art/sprites-adventure.png', atlas.size)
