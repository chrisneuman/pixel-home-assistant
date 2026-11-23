"""Build the main-floor pixel art map from a hand-traced layout.

Grid: 1 cell = 6 inches (half a foot), traced from chris's Floorplanner export.
Outputs (next to this script):
  main-floor.png   base art, 8 px per cell, all lights drawn as "off" fixtures
  main-floor.json  tile grid + room rectangles (used by the card for glow clipping and labels)

Run:  python3 build_map.py
"""
import json, os, random
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 111, 88          # cells
CELL = 8                 # art pixels per cell

# ---------------------------------------------------------------- layout
# tile codes: '.' grass, '#' wall, ' ' floor, 'D' door, 'F' front door,
# 'Z' garage door, 'c' sliding closet door, 'R' porch railing, 'S' stairs,
# 'p' porch steps, 'd' driveway/path
grid = [['.'] * W for _ in range(H)]

def fill(c0, r0, c1, r1, t):
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            grid[r][c] = t

ROOMS = [  # id, label, floor material, rects (c0, r0, c1, r1) inclusive
    ("master",        "Master",        "carpet_tan",  [(10, 5, 32, 30), (28, 31, 32, 36)]),
    ("master_closet", "Master closet", "darkwood",    [(5, 5, 8, 30)]),
    ("master_bath",   "Master bath",   "tile_blue",   [(5, 32, 21, 39)]),
    ("front_closet",  "Front closet",  "darkwood",    [(23, 32, 26, 39)]),
    ("main_bath",     "Main bath",     "tile_white",   [(5, 41, 21, 48)]),
    ("living",        "Living",        "wood",        [(34, 5, 59, 37)]),
    ("dining",        "Dining room",   "wood",        [(60, 5, 80, 21), (60, 22, 78, 26)]),
    ("kitchen",       "Kitchen",       "tile_check",  [(81, 5, 105, 21)]),
    ("hall",          "Hall",          "wood",        [(28, 38, 59, 40), (23, 41, 32, 51), (51, 41, 59, 53)]),
    ("stairs",        "Stairs",        "darkwood",    [(60, 28, 81, 34), (80, 23, 81, 27)]),
    ("mud_room",      "Mud room",      "tile_check",  [(83, 23, 105, 34)]),
    ("garage",        "Garage",        "concrete",    [(61, 36, 104, 74)]),
    ("g_room",        "G room",        "carpet_pink", [(5, 53, 28, 68)]),
    ("g_closet",      "G room closet", "darkwood",    [(5, 50, 21, 51)]),
    ("m_bedroom",     "M bedroom",     "carpet_blue", [(34, 42, 44, 68), (45, 47, 49, 68), (30, 53, 33, 68)]),
    ("m_closet",      "M bedroom closet", "darkwood", [(46, 42, 49, 45)]),
    ("porch",         "Porch",         "slab",        [(51, 55, 59, 69), (24, 70, 59, 79)]),
]
for _, _, _, rects in ROOMS:
    for r in rects:
        fill(*r, ' ')

WALLS = [
    (4, 4, 106, 4), (4, 4, 4, 69), (106, 4, 106, 35), (4, 69, 50, 69),
    (9, 5, 9, 30), (33, 4, 33, 37), (4, 31, 27, 31), (27, 31, 27, 40), (27, 37, 33, 37),
    (22, 31, 22, 52), (4, 40, 27, 40), (4, 49, 22, 49), (4, 52, 5, 52), (21, 52, 29, 52),
    (29, 52, 29, 69), (29, 52, 33, 52), (33, 41, 33, 52), (33, 41, 50, 41),
    (45, 41, 45, 46), (45, 46, 50, 46), (50, 41, 50, 69), (50, 54, 60, 54),
    (60, 27, 60, 75), (60, 27, 79, 27), (79, 22, 79, 27), (79, 22, 106, 22),
    (82, 22, 82, 27), (60, 35, 106, 35), (105, 35, 105, 75), (60, 75, 105, 75),
]
for w in WALLS:
    fill(*w, '#')
fill(60, 28, 81, 34, 'S')          # stairs open to the living room on the left; wall on the mud room side
for r in range(23, 28):            # little nook beside the stairs
    fill(80, r, 81, r, ' ')
# doors
fill(13, 31, 16, 31, 'D')          # master -> master bath
fill(28, 37, 32, 37, 'D')          # master -> hall
fill(27, 38, 27, 39, 'D')          # front closet
fill(22, 44, 22, 47, 'D')          # main bath
fill(24, 52, 27, 52, 'D')          # G room
fill(30, 52, 32, 52, 'D')          # M bedroom
fill(46, 46, 48, 46, 'D')          # M bedroom closet
fill(96, 22, 100, 22, 'D')         # kitchen -> mud room
fill(95, 35, 99, 35, 'D')          # mud room -> garage
fill(52, 54, 57, 54, 'F')          # front door
fill(68, 75, 97, 75, 'Z')          # garage door
for r in list(range(7, 15)) + list(range(19, 29)):
    grid[r][9] = 'c'               # master closet sliders
fill(6, 52, 20, 52, 'c')           # G room closet sliders
fill(14, 69, 19, 69, 'W')          # G room window over the bench
fill(38, 69, 44, 69, 'W')          # M bedroom window
fill(18, 4, 25, 4, 'W')            # master window
fill(40, 4, 50, 4, 'B')            # living room window with blinds
# porch is an open slab; the front path runs straight down from the door side
fill(52, 80, 57, 87, 'd')
fill(64, 76, 101, 87, 'd')

room_of = [[None] * W for _ in range(H)]
for rid, _, mat, rects in ROOMS:
    for (c0, r0, c1, r1) in rects:
        for r in range(r0, r1 + 1):
            for c in range(c0, c1 + 1):
                room_of[r][c] = rid
MAT = {rid: mat for rid, _, mat, _ in ROOMS}

# ---------------------------------------------------------------- palette
PAL = dict(
    grass=(88, 168, 64), grass_d=(48, 120, 48), grass_l=(144, 208, 96),
    flower_r=(232, 96, 96), flower_y=(250, 220, 90), flower_w=(240, 240, 240),
    wall=(92, 70, 98), wall_top=(150, 122, 156), wall_d=(40, 26, 46),
    face=(236, 214, 172), face_d=(206, 180, 140), face_l=(250, 236, 204), base=(124, 82, 52),
    brick=(184, 100, 72), brick_d=(132, 64, 48), brick_l=(214, 140, 104),
    wood=(206, 138, 76), wood_d=(150, 92, 48), wood_l=(232, 172, 108),
    dwood=(132, 90, 58), dwood_d=(104, 70, 44),
    carpet_tan=(214, 190, 150), carpet_tan_d=(198, 172, 132),
    carpet_pink=(232, 168, 176), carpet_pink_d=(214, 148, 160),
    carpet_blue=(146, 168, 214), carpet_blue_d=(126, 148, 196),
    tile_a=(236, 236, 228), tile_b=(200, 206, 214),
    tile_blue=(176, 214, 230), tile_blue_d=(150, 192, 214),
    concrete=(168, 168, 170), concrete_d=(148, 148, 152), concrete_l=(184, 184, 186),
    stone=(186, 176, 160), stone_d=(156, 146, 130),
    drive=(150, 146, 140), drive_d=(132, 128, 124),
    door=(150, 100, 54), door_d=(110, 70, 36), outline=(30, 24, 34),
)

rng = random.Random(42)
img = Image.new('RGB', (W * CELL, H * CELL), PAL['grass'])
px = img.load()
d = ImageDraw.Draw(img)

def h(x, y, s=0):
    return ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff

def floor_px(mat, x, y):
    if mat == 'wood':  # horizontal planks, staggered seams
        row = y // 6
        if y % 6 == 5: return PAL['wood_d']
        off = (row * 13) % 24
        if (x + off) % 24 == 0: return PAL['wood_d']
        if y % 6 == 0 or (x + off) % 24 == 1: return PAL['wood_l']
        if (x + off) % 24 == 23: return (186, 120, 64)
        return PAL['wood']
    if mat == 'darkwood':
        row = y // 5
        if y % 5 == 4 or (x + row * 7) % 16 == 0: return PAL['dwood_d']
        return PAL['dwood']
    if mat.startswith('carpet'):
        base = PAL[mat]; dk = PAL[mat + '_d']
        if (x % 4 == 0 and y % 4 == 0) or (x % 4 == 2 and y % 4 == 2): return dk
        return base
    if mat == 'tile_check':
        a = ((x // 8) + (y // 8)) % 2 == 0
        base = PAL['tile_a'] if a else PAL['tile_b']
        if x % 8 == 0 or y % 8 == 0: return tuple(min(255, v + 14) for v in base)
        if x % 8 == 7 or y % 8 == 7: return tuple(int(v * .84) for v in base)
        return base
    if mat == 'tile_white':
        if x % 8 == 7 or y % 8 == 7: return (200, 202, 212)
        if x % 8 == 0 or y % 8 == 0: return (255, 255, 255)
        return (240, 240, 238)
    if mat == 'tile_blue':
        return PAL['tile_blue_d'] if x % 6 == 0 or y % 6 == 0 else PAL['tile_blue']
    if mat == 'concrete':
        v = h(x, y) % 23
        if x % 64 == 0 or y % 64 == 0: return PAL['concrete_d']
        return PAL['concrete_d'] if v == 0 else PAL['concrete_l'] if v == 1 else PAL['concrete']
    if mat == 'slab':
        if x % 48 == 0 or y % 48 == 0: return PAL['stone_d']
        v = h(x, y, 5) % 31
        return PAL['stone_d'] if v == 0 else (204, 198, 186) if v == 1 else (190, 184, 172)
    if mat == 'stone':
        row = y // 8; off = 6 if row % 2 else 0
        if y % 8 == 0 or (x + off) % 12 == 0: return PAL['stone_d']
        return PAL['stone']
    return (255, 0, 255)

GRASS_TILE = [
    "................",
    "..l.............",
    ".d.d............",
    "................",
    "................",
    "..........l.....",
    ".........d.d....",
    "................",
    "................",
    "....l...........",
    "...d.d..........",
    "................",
    "................",
    ".............l..",
    "............d.d.",
    "................",
]
def grass_px(x, y):
    # big 32px blocks alternate the tuft layout so the tiling doesn't read as a grid
    flip = h(x // 32, y // 32, 9) % 2
    t = GRASS_TILE[y % 16][(15 - x % 16) if flip else x % 16]
    if t == 'd': return PAL['grass_d']
    if t == 'l': return PAL['grass_l']
    return PAL['grass']

# base layer
for r in range(H):
    for c in range(W):
        t = grid[r][c]
        for y in range(r * CELL, r * CELL + CELL):
            for x in range(c * CELL, c * CELL + CELL):
                if t == '.':
                    col = grass_px(x, y)
                elif t == 'd' or t == 'p':
                    col = PAL['drive_d'] if (x % 16 == 0 or y % 16 == 0 or h(x, y) % 29 == 0) else PAL['drive']
                elif t in ' S':
                    col = floor_px(MAT[room_of[r][c]], x, y)
                elif t in 'DFcZR#WB':
                    col = PAL['wall']
                px[x, y] = col

# grass tufts and flowers
def flower(x, y, petal):
    for dx, dy in [(0, -2), (-2, 0), (2, 0), (0, 2), (-1, -1), (1, -1), (-1, 1), (1, 1)]:
        px[x + dx, y + dy] = petal
    px[x, y] = PAL['flower_y'] if petal != PAL['flower_y'] else PAL['flower_r']
    px[x - 1, y + 3] = px[x, y + 3] = px[x + 1, y + 3] = PAL['grass_d']
for ty in range(0, H * CELL - 16, 16):
    for tx in range(0, W * CELL - 16, 16):
        if any(grid[(ty + k) // CELL][(tx + j) // CELL] != '.' for k in (0, 15) for j in (0, 15)): continue
        if h(tx, ty, 11) % 23 != 0: continue
        petal = [PAL['flower_w'], PAL['flower_r'], PAL['flower_w'], PAL['flower_y']][h(tx, ty, 12) % 4]
        flower(tx + 4, ty + 4, petal); flower(tx + 11, ty + 10, petal)

def is_wallish(c, r):
    return 0 <= c < W and 0 <= r < H and grid[r][c] in '#DFcZWB'

# walls: dark body, light top edge, floor drop shadow below
for r in range(H):
    for c in range(W):
        t = grid[r][c]
        x0, y0 = c * CELL, r * CELL
        if t == '#':
            d.rectangle([x0, y0, x0 + 7, y0 + 7], fill=PAL['wall'])
            if (c + r) % 2 == 0: d.point([(x0 + 3, y0 + 3), (x0 + 5, y0 + 5)], fill=(104, 82, 110))
            if not is_wallish(c, r - 1): d.line([x0, y0, x0 + 7, y0], fill=PAL['wall_d']); d.line([x0, y0 + 1, x0 + 7, y0 + 1], fill=PAL['wall_top'])
            if not is_wallish(c, r + 1): d.line([x0, y0 + 7, x0 + 7, y0 + 7], fill=PAL['wall_d'])
            if not is_wallish(c - 1, r): d.line([x0, y0, x0, y0 + 7], fill=PAL['wall_d'])
            if not is_wallish(c + 1, r): d.line([x0 + 7, y0, x0 + 7, y0 + 7], fill=PAL['wall_d'])
        elif t in 'DF':
            under = None
            for nc, nr in [(c, r - 1), (c, r + 1), (c - 1, r), (c + 1, r)]:
                if 0 <= nr < H and 0 <= nc < W and grid[nr][nc] == ' ':
                    under = room_of[nr][nc]; break
            for y in range(y0, y0 + 8):
                for x in range(x0, x0 + 8):
                    px[x, y] = floor_px(MAT[under] if under else 'wood', x, y)
            col = PAL['door'] if t == 'D' else (176, 60, 52)
            horiz = is_wallish(c - 1, r) or is_wallish(c + 1, r)
            if horiz:
                d.rectangle([x0, y0 + 2, x0 + 7, y0 + 5], fill=col)
                d.line([x0, y0 + 5, x0 + 7, y0 + 5], fill=PAL['door_d'])
            else:
                d.rectangle([x0 + 2, y0, x0 + 5, y0 + 7], fill=col)
                d.line([x0 + 5, y0, x0 + 5, y0 + 7], fill=PAL['door_d'])
        elif t == 'c':
            d.rectangle([x0, y0, x0 + 7, y0 + 7], fill=(200, 196, 188))
            vertical = is_wallish(c, r - 1) or is_wallish(c, r + 1) or grid[r - 1][c] == 'c'
            if vertical:
                d.line([x0 + 3, y0, x0 + 3, y0 + 7], fill=(140, 136, 130))
            else:
                d.line([x0, y0 + 3, x0 + 7, y0 + 3], fill=(140, 136, 130))
        elif t in 'WB':
            d.rectangle([x0, y0, x0 + 7, y0 + 7], fill=PAL['wall'])
            d.rectangle([x0, y0 + 2, x0 + 7, y0 + 5], fill=(150, 206, 236))
            d.line([x0, y0 + 3, x0 + 7, y0 + 3], fill=(214, 240, 252))
            if c % 2 == 0: d.line([x0, y0 + 2, x0, y0 + 5], fill=(240, 236, 224))
        elif t == 'Z':
            d.rectangle([x0, y0, x0 + 7, y0 + 7], fill=(220, 220, 214))
            d.line([x0, y0 + 2, x0 + 7, y0 + 2], fill=(170, 170, 166))
            d.line([x0, y0 + 5, x0 + 7, y0 + 5], fill=(170, 170, 166))
        elif t == 'R':
            for y in range(y0, y0 + 8):
                for x in range(x0, x0 + 8):
                    px[x, y] = grass_px(x, y)
            horiz = grid[r][c - 1] in 'Rp' if c > 0 else False
            horiz = horiz or (c + 1 < W and grid[r][c + 1] in 'Rp')
            if horiz:
                d.rectangle([x0, y0 + 2, x0 + 7, y0 + 4], fill=(240, 236, 224))
                d.line([x0, y0 + 5, x0 + 7, y0 + 5], fill=(150, 140, 120))
                if c % 3 == 0: d.rectangle([x0 + 2, y0 + 1, x0 + 4, y0 + 6], fill=(250, 248, 240))
            else:
                d.rectangle([x0 + 2, y0, x0 + 4, y0 + 7], fill=(240, 236, 224))
                d.line([x0 + 5, y0, x0 + 5, y0 + 7], fill=(150, 140, 120))
                if r % 3 == 0: d.rectangle([x0 + 1, y0 + 2, x0 + 6, y0 + 4], fill=(250, 248, 240))
        elif t == 'S':
            # treads run vertical (stairs descend left to right toward the mud room)
            shade = 214 - int(70 * (c - 60) / 21)   # top step on the left, descending right
            d.rectangle([x0, y0, x0 + 7, y0 + 7], fill=(shade, int(shade * .72), int(shade * .5)))
            if c % 2 == 0: d.line([x0, y0, x0, y0 + 7], fill=(80, 56, 40))
        elif t == 'p':
            d.rectangle([x0, y0, x0 + 7, y0 + 7], fill=(196, 188, 172))
            d.line([x0, y0 + 4, x0 + 7, y0 + 4], fill=(150, 142, 128))

# 3/4 view: every wall shows its front face on the cell below it.
# Inside: plaster with a baseboard. Outside: brick.
for r in range(1, H):
    for c in range(W):
        if grid[r - 1][c] not in '#WB' or grid[r][c] in '#DFcZWB': continue
        x0, y0 = c * CELL, r * CELL
        outside = grid[r][c] in '.dp' or room_of[r][c] == 'porch'
        win = grid[r - 1][c] in 'WB'
        for y in range(y0, y0 + 6):
            for x in range(x0, x0 + 8):
                k = y - y0
                if outside:
                    if k == 5: col = PAL['brick_d']
                    elif k == 2 or (x + (4 if k > 2 else 0)) % 8 == 0: col = PAL['brick_d']
                    elif k in (0, 3): col = PAL['brick_l']
                    else: col = PAL['brick']
                else:
                    col = PAL['face_l'] if k == 0 else PAL['base'] if k >= 4 else PAL['face_d'] if k == 3 else PAL['face']
                if win and 1 <= k <= 3:                                # window pane on the wall face
                    edge = grid[r - 1][c - 1] not in 'WB' and x == x0 or grid[r - 1][c + 1] not in 'WB' and x == x0 + 7
                    if edge: col = (246, 242, 232)
                    elif grid[r - 1][c] == 'B': col = (238, 232, 216) if k != 2 else (196, 188, 170)   # blinds
                    else: col = (214, 240, 252) if (x + k) % 7 == 0 else (130, 192, 230)
                if win and k == 4: col = (250, 248, 240)                  # sill
                px[x, y] = col
        for x in range(x0, x0 + 8):                                   # soft shadow under the face
            for y in (y0 + 6, y0 + 7):
                rr, gg, bb = px[x, y]
                f = .72 if y == y0 + 6 else .86
                px[x, y] = (int(rr * f), int(gg * f), int(bb * f * 1.05))

# furniture goes on its own layer so it can cast a 16-bit style drop shadow
dbase = d
layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
d = ImageDraw.Draw(layer)

# ---------------------------------------------------------------- furniture sprites
def P(v): return int(round(v * CELL))
def box(c0, r0, c1, r1, fill, out=PAL['outline'], hi=None):
    d.rectangle([P(c0), P(r0), P(c1) - 1, P(r1) - 1], fill=fill, outline=out)
    hi = hi or tuple(min(255, int(v * 1.18) + 8) for v in fill)
    d.line([P(c0) + 1, P(r0) + 1, P(c1) - 2, P(r0) + 1], fill=hi)
    if P(r1) - P(r0) >= 10:                                               # front face
        dk = tuple(int(v * .72) for v in fill)
        d.rectangle([P(c0) + 1, P(r1) - 3, P(c1) - 2, P(r1) - 2], fill=dk)

def bed(c0, r0, c1, r1, blanket, blanket_d):
    box(c0, r0, c1, r1, (120, 80, 50))                       # frame
    box(c0 + .3, r0 + .3, c1 - .3, r1 - .3, blanket, hi=tuple(min(255, v + 30) for v in blanket))
    for i in range(int((c1 - c0) // 4)):
        pc = c0 + .8 + i * ((c1 - c0 - 1.6) / max(1, int((c1 - c0) // 4)))
        box(pc, r0 + .6, pc + 3, r0 + 2.4, (246, 246, 240))   # pillows
    d.line([P(c0) + 2, P(r0 + 3.2), P(c1) - 3, P(r0 + 3.2)], fill=blanket_d)
    d.rectangle([P(c0) + 2, P(r0 + 3.2) + 1, P(c1) - 3, P(r0 + 4.2)], fill=(250, 250, 246))

def rug(c0, r0, c1, r1, col, border):
    d = dbase                                                            # rugs lie flat: no shadow
    d.rectangle([P(c0), P(r0), P(c1) - 1, P(r1) - 1], fill=border)
    d.rectangle([P(c0) + 3, P(r0) + 3, P(c1) - 4, P(r1) - 4], fill=col)
    for y in range(P(r0) + 5, P(r1) - 5, 6):
        d.line([P(c0) + 5, y, P(c1) - 6, y], fill=border)

def plant(c, r):
    d.ellipse([P(c) - 6, P(r) - 6, P(c) + 6, P(r) + 6], fill=(56, 122, 64), outline=PAL['outline'])
    d.ellipse([P(c) - 3, P(r) - 4, P(c) + 2, P(r) + 1], fill=(92, 170, 90))

def tree(c, r):
    x, y = P(c), P(r)
    dark, mid, light, rim = (24, 72, 40), (40, 120, 56), (88, 176, 72), (152, 216, 104)
    d.rectangle([x - 5, y + 10, x + 5, y + 24], fill=(120, 76, 40), outline=PAL['outline'])
    d.line([x - 3, y + 12, x - 3, y + 22], fill=(160, 108, 60))
    blobs = [(-14, -2), (14, -2), (0, -14), (-8, 10), (8, 10), (0, 0)]
    for bx, by in blobs:
        d.ellipse([x + bx - 14, y + by - 13, x + bx + 14, y + by + 13], fill=dark)
    for bx, by in blobs:
        d.ellipse([x + bx - 12, y + by - 11, x + bx + 12, y + by + 11], fill=mid)
    for bx, by in blobs[:4]:
        d.ellipse([x + bx - 8, y + by - 9, x + bx + 4, y + by + 1], fill=light)
        d.point([(x + bx - 4, y + by - 6), (x + bx - 3, y + by - 6), (x + bx - 4, y + by - 5)], fill=rim)

def bush(c, r):
    x, y = P(c), P(r)
    d.ellipse([x - 9, y - 7, x + 9, y + 8], fill=(24, 72, 40))
    d.ellipse([x - 8, y - 7, x + 8, y + 6], fill=(48, 136, 64))
    d.ellipse([x - 6, y - 6, x + 1, y], fill=(104, 188, 80))
    d.point([(x - 4, y - 4), (x - 3, y - 4)], fill=(168, 224, 112))
    d.point([(x + 3, y + 1), (x - 1, y + 3), (x + 5, y - 2)], fill=(32, 96, 48))

def toilet(c, r):
    box(c, r, c + 2, r + 1, (240, 240, 244))
    d.ellipse([P(c) + 1, P(r + 1), P(c + 2) - 2, P(r + 3)], fill=(250, 250, 252), outline=PAL['outline'])

def vanity(c0, r0, c1, r1, basin='top'):
    box(c0, r0, c1, r1, (150, 108, 72), hi=(180, 136, 96))
    cx = (c0 + c1) / 2
    d.ellipse([P(cx) - 6, P(r0) + 2, P(cx) + 6, P(r1) - 3], fill=(230, 240, 246), outline=(110, 120, 130))
    fy = P(r0) + 1 if basin == 'top' else P(r1) - 3                      # faucet on the wall side
    d.rectangle([P(cx) - 1, fy, P(cx) + 1, fy + 1], fill=(170, 176, 186))

def toilet_up(c, r):
    """Toilet flipped 180: tank against the bottom wall, bowl facing up."""
    box(c, r + 2, c + 2, r + 3, (240, 240, 244))
    d.ellipse([P(c) + 1, P(r), P(c + 2) - 2, P(r + 2)], fill=(250, 250, 252), outline=PAL['outline'])

def shower(c0, r0, c1, r1):
    box(c0, r0, c1, r1, (214, 232, 240))
    for x in range(P(c0) + 4, P(c1) - 2, 5):
        d.line([x, P(r0) + 2, x, P(r1) - 3], fill=(190, 214, 226))
    for y in range(P(r0) + 4, P(r1) - 2, 5):
        d.line([P(c0) + 2, y, P(c1) - 3, y], fill=(190, 214, 226))
    d.line([P(c0), P(r0) + 1, P(c0), P(r1) - 2], fill=(150, 200, 230), width=2)   # glass
    cx, cy = P((c0 + c1) / 2), P((r0 + r1) / 2)
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=(120, 130, 140))      # drain
    d.ellipse([P(c1) - 8, P(r0) + 3, P(c1) - 3, P(r0) + 8], fill=(180, 186, 196), outline=PAL['outline'])  # head

def bed_side(c0, r0, c1, r1, blanket, blanket_d, head='right'):
    """Bed turned sideways with its headboard against a left or right wall."""
    box(c0, r0, c1, r1, (120, 80, 50))
    box(c0 + .3, r0 + .3, c1 - .3, r1 - .3, blanket, hi=tuple(min(255, v + 30) for v in blanket))
    n = max(1, int((r1 - r0) // 4))
    hx0 = c1 - 2.6 if head == 'right' else c0 + .6
    for i in range(n):
        pr = r0 + .8 + i * ((r1 - r0 - 1.6) / n)
        box(hx0, pr, hx0 + 2, pr + (r1 - r0 - 1.6) / n - .3, (246, 246, 240))
    sx = P(c1 - 3.2) if head == 'right' else P(c0 + 3.2)
    sw = -P(1) if head == 'right' else P(1)
    d.rectangle([min(sx, sx + sw), P(r0) + 2, max(sx, sx + sw), P(r1) - 3], fill=(250, 250, 246))
    d.line([sx, P(r0) + 2, sx, P(r1) - 3], fill=blanket_d)

def dog(c, r):
    """Dog curled up on a round bed."""
    x, y = P(c), P(r)
    d.ellipse([x - 13, y - 10, x + 13, y + 10], fill=(120, 80, 60), outline=PAL['outline'])
    d.ellipse([x - 10, y - 7, x + 10, y + 7], fill=(170, 130, 100))
    fur, fur_d = (210, 160, 96), (170, 120, 64)
    d.ellipse([x - 9, y - 6, x + 6, y + 6], fill=fur, outline=PAL['outline'])          # body
    d.ellipse([x + 1, y - 7, x + 10, y + 2], fill=fur, outline=PAL['outline'])         # head
    d.ellipse([x + 1, y - 7, x + 4, y - 1], fill=fur_d)                               # ears
    d.ellipse([x + 7, y - 7, x + 10, y - 1], fill=fur_d)
    d.point([(x + 4, y - 3), (x + 7, y - 3)], fill=(30, 24, 20))
    d.rectangle([x + 5, y, x + 6, y + 1], fill=(40, 30, 26))                           # nose
    d.arc([x - 12, y - 2, x - 2, y + 8], 90, 240, fill=fur_d, width=2)                # tail

def tub(c0, r0, c1, r1):
    box(c0, r0, c1, r1, (244, 244, 248))
    d.rounded_rectangle([P(c0) + 3, P(r0) + 3, P(c1) - 4, P(r1) - 4], radius=4, fill=(170, 214, 236))

def car(c0, r0, c1, r1, body, body_d):
    d.rounded_rectangle([P(c0), P(r0), P(c1) - 1, P(r1) - 1], radius=10, fill=body, outline=PAL['outline'])
    d.rounded_rectangle([P(c0) + 6, P(r0 + 5), P(c1) - 7, P(r0 + 8)], radius=3, fill=(120, 170, 210), outline=PAL['outline'])
    d.rectangle([P(c0) + 8, P(r0 + 8) + 1, P(c1) - 9, P(r1 - 6)], fill=body_d)
    d.rounded_rectangle([P(c0) + 6, P(r1 - 6), P(c1) - 7, P(r1 - 4)], radius=3, fill=(120, 170, 210), outline=PAL['outline'])
    for (x, y) in [(P(c0) - 2, P(r0 + 3)), (P(c1) - 2, P(r0 + 3)), (P(c0) - 2, P(r1 - 5)), (P(c1) - 2, P(r1 - 5))]:
        d.rectangle([x, y, x + 3, y + 12], fill=(30, 30, 34))
    d.rectangle([P(c0) + 4, P(r1) - 4, P(c0) + 10, P(r1) - 2], fill=(250, 230, 140))
    d.rectangle([P(c1) - 11, P(r1) - 4, P(c1) - 5, P(r1) - 2], fill=(250, 230, 140))

def fan(c, r, blade=(70, 52, 44)):
    cx, cy = P(c), P(r)
    for dx, dy in [(0, -1), (1, 0), (0, 1), (-1, 0)]:
        x1, y1 = cx + dx * 22, cy + dy * 22
        w = 4
        d.polygon([(cx + dy * w, cy - dx * w), (x1 + dy * w, y1 - dx * w), (x1 - dy * w, y1 + dx * w), (cx - dy * w, cy + dx * w)], fill=blade, outline=PAL['outline'])


def builtins(c0, r0, c1, r1):
    """Bookshelf built-ins against a wall, seen from above with book tops showing."""
    box(c0, r0, c1, r1, (236, 230, 216), hi=(250, 248, 240))
    cols = [(200, 70, 70), (70, 120, 190), (240, 200, 80), (90, 160, 100), (160, 100, 170), (230, 140, 60)]
    x = P(c0) + 2; i = 0
    while x < P(c1) - 3:
        w = 2 + (i * 7) % 3
        d.rectangle([x, P(r0) + 4, min(x + w - 1, P(c1) - 3), P(r1) - 4], fill=cols[(i * 5) % len(cols)])
        x += w + 1; i += 1
    d.line([P(c0) + 1, P(r0) + 3, P(c1) - 2, P(r0) + 3], fill=(200, 190, 170))

def window_bench(c0, r0, c1, r1):
    box(c0, r0, c1, r1, (150, 100, 60), hi=(180, 130, 90))
    d.rectangle([P(c0) + 2, P(r0) + 3, P(c1) - 3, P(r1) - 3], fill=(120, 150, 210))
    d.line([P(c0) + 2, P(r0) + 3, P(c1) - 3, P(r0) + 3], fill=(160, 190, 236))
    box(c0 + .6, r0 + .5, c0 + 2.4, r0 + 2.2, (250, 220, 120)); box(c1 - 2.4, r0 + .5, c1 - .6, r0 + 2.2, (240, 150, 170))

def castle_bed(c0, r0, c1, r1):
    """Castle bed: stone walls with crenellations, round towers with pink roofs, flags."""
    stone, stone_d, stone_l = (176, 172, 184), (130, 126, 140), (204, 200, 212)
    box(c0, r0, c1, r1, stone)
    for y in range(P(r0) + 3, P(r1) - 2, 6):                               # brick courses
        d.line([P(c0) + 1, y, P(c1) - 2, y], fill=stone_d)
        off = 0 if (y // 6) % 2 else 4
        for x in range(P(c0) + 1 + off, P(c1) - 2, 8):
            d.line([x, y - 5, x, y], fill=stone_d)
    for x in range(P(c0) + 2, P(c1) - 4, 8):                               # crenellations
        d.rectangle([x, P(r0) + 1, x + 3, P(r0) + 3], fill=stone_l, outline=stone_d)
    for y in range(P(r0) + 2, P(r1) - 4, 8):
        d.rectangle([P(c0) + 1, y, P(c0) + 3, y + 3], fill=stone_l, outline=stone_d)
    # mattress inside the walls
    mc0, mr0, mc1, mr1 = c0 + 1.6, r0 + 4.5, c1 - .6, r1 - 1.2
    box(mc0, mr0, mc1, mr1, (240, 150, 190), hi=(255, 190, 220))
    box(mc0 + .8, mr0 + .6, mc0 + 3.8, mr0 + 2.4, (250, 250, 246)); box(mc1 - 3.8, mr0 + .6, mc1 - .8, mr0 + 2.4, (250, 250, 246))
    d.rectangle([P(mc0) + 2, P(mr0 + 3.2), P(mc1) - 3, P(mr0 + 4.2)], fill=(255, 236, 246))
    for y in range(P(mr0 + 6), P(mr1) - 4, 10):                            # heart quilt
        for x in range(P(mc0) + 6, P(mc1) - 6, 12):
            d.point([(x, y), (x + 2, y), (x - 1, y + 1), (x + 1, y + 1), (x + 3, y + 1), (x, y + 2), (x + 2, y + 2), (x + 1, y + 3)], fill=(210, 80, 130))
    # gate on the room side
    gx, gy = P(c0), P((r0 + r1) / 2)
    d.rectangle([gx - 1, gy - 10, gx + 5, gy + 10], fill=(110, 76, 50), outline=PAL['outline'])
    for yy in range(gy - 8, gy + 9, 3): d.line([gx, yy, gx + 4, yy], fill=(70, 48, 32))
    # towers + roofs + flags
    for (tx, ty) in [(c0 + 1, r0 + 1.2), (c1 - 1.5, r0 + 1.2), (c0 + 1, r1 - 1.2)]:
        cx, cy = P(tx), P(ty)
        d.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=stone, outline=PAL['outline'])
        d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(214, 96, 150), outline=(150, 50, 100))
        d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(236, 130, 180))
        d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=(255, 200, 230))
        d.line([cx, cy, cx, cy - 16], fill=(60, 50, 50))
        d.polygon([(cx + 1, cy - 16), (cx + 9, cy - 13), (cx + 1, cy - 10)], fill=(250, 220, 90), outline=(170, 120, 40))

def bronco(c0, r0, c1, r1):
    """Marsh-grey (warm taupe-brown) Bronco, nose toward the garage door, spare tire on the back.
    Rounded body, chunky black fender flares, black hardtop, round headlights in a black grille."""
    body, body_d, body_l = (138, 118, 94), (104, 86, 66), (172, 152, 124)
    black, black_l = (34, 32, 34), (70, 66, 66)
    x0, y0, x1, y1 = P(c0), P(r0), P(c1) - 1, P(r1) - 1
    # tires + rounded fender flares sticking out past the body
    for wy in (y0 + 30, y1 - 52):
        for wx in (x0 - 4, x1 - 6):
            d.rounded_rectangle([wx, wy, wx + 10, wy + 36], radius=4, fill=black, outline=PAL['outline'])
            d.line([wx + 2, wy + 4, wx + 2, wy + 32], fill=black_l)
    # body
    d.rounded_rectangle([x0, y0 + 6, x1, y1], radius=9, fill=body, outline=PAL['outline'])
    d.rounded_rectangle([x0 + 2, y0 + 8, x1 - 2, y1 - 2], radius=8, outline=body_l)
    # hood: rounded, with a soft highlight and two creases
    hood = y1 - 84
    d.rounded_rectangle([x0 + 5, hood, x1 - 5, y1 - 14], radius=6, fill=body_l, outline=body_d)
    d.rounded_rectangle([x0 + 10, hood + 4, x1 - 28, hood + 12], radius=3, fill=(190, 172, 146))
    d.line([x0 + 30, hood + 3, x0 + 30, y1 - 17], fill=body_d)
    d.line([x1 - 30, hood + 3, x1 - 30, y1 - 17], fill=body_d)
    # black grille with big round headlights
    d.rounded_rectangle([x0 + 3, y1 - 13, x1 - 3, y1 - 3], radius=3, fill=black)
    for hx in (x0 + 7, x1 - 17):
        d.ellipse([hx, y1 - 13, hx + 10, y1 - 3], fill=(250, 244, 200), outline=PAL['outline'])
        d.ellipse([hx + 3, y1 - 10, hx + 6, y1 - 7], fill=(255, 255, 240))
    for gx in range(x0 + 22, x1 - 21, 5):
        d.line([gx, y1 - 11, gx, y1 - 5], fill=black_l)
    d.rounded_rectangle([x0 - 2, y1 - 2, x1 + 2, y1 + 3], radius=2, fill=black, outline=PAL['outline'])   # bumper
    # windshield, black hardtop, rear glass
    ws = hood - 14
    d.rounded_rectangle([x0 + 6, ws, x1 - 6, hood - 2], radius=3, fill=(120, 168, 200), outline=PAL['outline'])
    d.line([x0 + 9, ws + 3, x0 + 24, ws + 3], fill=(210, 236, 250))
    # color-matched hardtop with two black removable roof panels over the front seats
    d.rounded_rectangle([x0 + 5, y0 + 14, x1 - 5, ws - 2], radius=5, fill=body_d, outline=PAL['outline'])
    d.line([x0 + 8, y0 + 16, x1 - 8, y0 + 16], fill=body)
    mid = (x0 + x1) // 2
    d.rounded_rectangle([x0 + 9, ws - 44, mid - 2, ws - 6], radius=3, fill=black, outline=PAL['outline'])
    d.rounded_rectangle([mid + 2, ws - 44, x1 - 9, ws - 6], radius=3, fill=black, outline=PAL['outline'])
    d.line([x0 + 11, ws - 42, mid - 5, ws - 42], fill=black_l); d.line([mid + 4, ws - 42, x1 - 12, ws - 42], fill=black_l)
    for ry in range(y0 + 24, ws - 52, 10):                                 # rear roof ribs
        d.line([x0 + 9, ry, x1 - 9, ry], fill=(92, 76, 58))
    d.rounded_rectangle([x0 + 8, y0 + 8, x1 - 8, y0 + 13], radius=2, fill=(120, 168, 200))
    # mirrors
    for mx in (x0 - 6, x1 + 2):
        d.rounded_rectangle([mx, hood - 12, mx + 4, hood - 5], radius=1, fill=black)
    # spare tire on the back
    cx = (x0 + x1) // 2
    d.ellipse([cx - 13, y0 - 6, cx + 13, y0 + 12], fill=black, outline=PAL['outline'])
    d.ellipse([cx - 7, y0 - 1, cx + 7, y0 + 7], fill=(150, 146, 140))
    d.ellipse([cx - 2, y0 + 1, cx + 2, y0 + 5], fill=black)

def bike(c, r, frame):
    x, y = P(c), P(r)
    d.ellipse([x - 5, y - 28, x + 5, y - 12], outline=(30, 30, 34), width=3)
    d.ellipse([x - 5, y + 12, x + 5, y + 28], outline=(30, 30, 34), width=3)
    d.line([x, y - 18, x, y + 18], fill=frame, width=4)
    d.line([x - 10, y - 18, x + 10, y - 18], fill=(30, 30, 34), width=3)
    d.rectangle([x - 3, y + 2, x + 3, y + 9], fill=(60, 50, 40))

def washer_dryer_stack(c0, r0, c1, r1):
    """Stacked pair in the corner, drawn front-on (Pokemon 3/4 style)."""
    box(c0, r0, c1, r1, (238, 238, 242))
    mid = P((r0 + r1) / 2)
    d.line([P(c0) + 1, mid, P(c1) - 2, mid], fill=(150, 150, 160))
    for top in (P(r0), mid):
        d.rectangle([P(c0) + 2, top + 2, P(c1) - 3, top + 5], fill=(190, 194, 204))
        d.point([(P(c1) - 6, top + 3), (P(c1) - 9, top + 3)], fill=(90, 200, 120))
        cx, cy = P((c0 + c1) / 2), top + 17
        d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(170, 180, 196), outline=PAL['outline'])
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(140, 196, 230))
        d.arc([cx - 4, cy - 4, cx + 4, cy + 4], 200, 300, fill=(240, 250, 255))

def cat(c, r):
    """Small grey cat napping in a curl."""
    x, y = P(c), P(r)
    d.ellipse([x - 7, y - 5, x + 7, y + 5], fill=(110, 110, 120), outline=PAL['outline'])
    d.ellipse([x + 2, y - 6, x + 9, y + 1], fill=(120, 120, 130), outline=PAL['outline'])
    d.polygon([(x + 3, y - 5), (x + 4, y - 9), (x + 6, y - 6)], fill=(120, 120, 130), outline=PAL['outline'])
    d.polygon([(x + 6, y - 6), (x + 8, y - 9), (x + 9, y - 5)], fill=(120, 120, 130), outline=PAL['outline'])
    d.arc([x - 9, y - 2, x + 1, y + 8], 60, 200, fill=(80, 80, 90), width=2)
    d.point([(x + 5, y - 3), (x + 7, y - 3)], fill=(30, 30, 34))

def mailbox(c, r):
    x, y = P(c), P(r)
    d.rectangle([x - 1, y, x + 1, y + 8], fill=(110, 80, 50))
    d.rounded_rectangle([x - 5, y - 6, x + 5, y + 1], radius=3, fill=(70, 100, 170), outline=PAL['outline'])
    d.rectangle([x + 5, y - 6, x + 7, y - 3], fill=(220, 60, 60))

def mushroom(c, r):
    x, y = P(c), P(r)
    d.rectangle([x - 1, y, x + 1, y + 3], fill=(240, 232, 214))
    d.ellipse([x - 4, y - 3, x + 4, y + 2], fill=(220, 60, 60), outline=PAL['outline'])
    d.point([(x - 2, y - 1), (x + 1, y - 2), (x + 2, y)], fill=(255, 255, 255))

# living room
rug(37, 12, 46, 24, (176, 74, 66), (226, 190, 120))
box(34, 13.5, 35, 22.5, (32, 32, 40), hi=(80, 80, 96))                  # wall TV
box(47.5, 11, 53, 27, (220, 150, 40), hi=(244, 190, 90))                # sofa, 3 ft off the wall to the stairs
box(51.3, 11, 53, 27, (190, 120, 30))
box(47.5, 11, 53, 12.4, (190, 120, 30)); box(47.5, 25.6, 53, 27, (190, 120, 30))
for y in (12.4, 16.8, 21.2):                                              # seat cushions
    d.line([P(47.5) + 1, P(y + 4.4), P(51.3) - 1, P(y + 4.4)], fill=(176, 108, 28))
box(41, 26, 45, 29, (150, 100, 60), hi=(180, 130, 90))                  # side table
plant(35.5, 6.5); plant(58, 33.5)
# record player credenza with a lamp, under the window wall
box(52.5, 5, 60, 8.6, (126, 84, 52), hi=(160, 112, 72))
tx, ty = P(55), P(6.7)
d.rectangle([tx - 11, ty - 10, tx + 11, ty + 9], fill=(70, 50, 36), outline=PAL['outline'])   # turntable plinth
d.ellipse([tx - 9, ty - 8, tx + 7, ty + 8], fill=(24, 22, 26), outline=(10, 8, 12))            # vinyl
d.ellipse([tx - 6, ty - 5, tx + 4, ty + 5], outline=(52, 48, 56))
d.ellipse([tx - 3, ty - 2, tx + 1, ty + 2], fill=(214, 70, 60))                                # label
d.line([tx + 9, ty - 8, tx + 9, ty + 2, tx + 3, ty + 5], fill=(200, 200, 206), width=1)       # tonearm
lx, ly = P(58.6), P(6.6)
d.ellipse([lx - 8, ly - 8, lx + 8, ly + 8], fill=(244, 228, 186), outline=(150, 120, 80))     # lamp shade
d.ellipse([lx - 4, ly - 4, lx + 4, ly + 4], fill=(252, 240, 210))
# dining
d.ellipse([P(64.5), P(10.5), P(71.5), P(17.5)], fill=(150, 98, 58), outline=PAL['outline'])
d.ellipse([P(65.2), P(11.2), P(70.8), P(16.8)], fill=(176, 120, 74))
for ang in range(0, 360, 90):
    import math
    x = 68 + 4.6 * math.cos(math.radians(ang)); y = 14 + 4.6 * math.sin(math.radians(ang))
    box(x - .9, y - .9, x + .9, y + .9, (110, 76, 50))
# kitchen
# one L-shaped counter: along the top wall and down as the peninsula
box(82, 5, 106, 8, (96, 96, 104), hi=(140, 140, 150))
box(82, 5, 87, 14, (96, 96, 104), hi=(140, 140, 150))
d.rectangle([P(82) + 1, P(5) + 2, P(87) - 2, P(8)], fill=(96, 96, 104))   # hide the seam
box(90.5, 5.5, 95, 7.5, (190, 200, 210)); d.line([P(92.75), P(5.5), P(92.75), P(7.5)], fill=(120, 130, 140))
box(101, 5, 106, 9.5, (226, 226, 230), hi=(250, 250, 250))             # fridge
box(102, 9.5, 106, 22, (96, 96, 104), hi=(140, 140, 150))            # counter along the right wall
box(102.4, 12, 106, 16.5, (60, 60, 66))                                # stove
for (x, y) in [(103.5, 13.2), (105, 13.2), (103.5, 15.2), (105, 15.2)]:
    d.ellipse([P(x) - 4, P(y) - 4, P(x) + 4, P(y) + 4], outline=(200, 80, 60))
for y in (6.5, 9.5, 12.5):
    d.ellipse([P(80) - 1, P(y) - 5, P(81.4), P(y) + 6], fill=(60, 40, 30), outline=PAL['outline'])
# master: bed centered on the right wall, headboard against it
bed_side(21, 12, 33, 24, (110, 130, 170), (80, 100, 140), head='right')
box(30.5, 9.5, 33, 11.8, (150, 100, 60), hi=(180, 130, 90)); box(30.5, 24.2, 33, 26.5, (150, 100, 60), hi=(180, 130, 90))
box(12, 5, 20, 7.5, (150, 100, 60), hi=(180, 130, 90))                  # dresser
fan(19.7, 16.8)
# bathrooms
# master bath: shower on the right, toilet beside it facing up, sink bottom-left
shower(17, 32, 22, 40); toilet_up(14.4, 37); vanity(5, 38, 11, 40, basin='bottom')
# main bath: tub/shower left, toilet on the top wall, sink against the right wall
tub(5, 41.2, 10.5, 48.8); toilet(12.4, 41); vanity(15.5, 41, 22, 43)
# G room: bed, built-ins flanking a window bench on the bottom wall
bed_side(5, 54.5, 15, 63.5, (110, 170, 120), (80, 140, 96), head='left')
rug(18, 55, 27, 62, (250, 236, 190), (120, 170, 150))
builtins(5, 66, 13, 69)
builtins(20, 66, 29, 69)
window_bench(13, 66.4, 20, 69)
fan(15.4, 63, blade=(196, 182, 170))
# M bedroom: castle bed in the bottom-right corner along the right wall
castle_bed(40.5, 49, 50, 69)
box(34, 42, 40, 44.2, (150, 100, 60), hi=(180, 130, 90))                  # dresser
rug(34.5, 55, 39.8, 66, (240, 220, 160), (200, 160, 110))
# hall runner + entry mat
rug(24, 42, 28, 50, (90, 110, 150), (60, 76, 110))
box(53, 52.3, 57, 53.8, (120, 84, 60))
# garage
bronco(76.25, 42, 89.25, 72.5)
bike(99, 65, (60, 150, 200)); bike(102.5, 67, (230, 120, 60))
box(100, 40, 104.6, 56, (120, 120, 126), hi=(150, 150, 156))             # storage shelf
for y in (41, 45, 49, 53):
    box(100.6, y, 102.4, y + 2.4, (200, 160, 80)); box(102.6, y + .6, 104, y + 2.6, (90, 140, 200))
box(62, 36, 80, 38.5, (130, 92, 60), hi=(160, 120, 84))                 # workbench
for x in range(63, 79, 3):
    box(x, 36.3, x + 1.5, 37.2, (100, 100, 110))
# mud room
box(84, 23, 92, 25.5, (150, 100, 60), hi=(180, 130, 90))                # bench
for x in (85, 87.5, 90):                                                  # boots under the bench
    box(x, 25.6, x + 1, 26.6, (90, 60, 40)); box(x + 1.1, 25.6, x + 2.1, 26.6, (90, 60, 40))
washer_dryer_stack(101.4, 27, 106, 35)
# porch
box(53, 55.2, 57, 56.6, (150, 110, 70))                                 # door mat
box(26, 71, 32, 73, (150, 100, 60), hi=(180, 130, 90))                   # porch bench
plant(25, 78.5); plant(58.5, 78.5); plant(52, 68)
dog(41.5, 18)
# yard
mailbox(62.5, 84)
for (c, r) in [(15, 81), (17, 82.5), (100, 4), (30, 2)]:
    mushroom(c, r)
for (c, r) in [(10, 76), (104, 84), (8, 84)]:
    tree(c, r)
for c in range(6, 22, 4):
    bush(c, 71.5)
for c in range(26, 37, 4):
    bush(c, 82)
for c in (45, 49):
    bush(c, 82)

# composite: drop shadow (down-right), then the furniture layer
alpha = layer.split()[3].point(lambda a: 96 if a > 0 else 0)
shadow = Image.new('RGBA', img.size, (22, 10, 40, 0))
shadow.putalpha(Image.new('L', img.size, 0))
shadow.paste((22, 10, 40, 255), (3, 4), alpha.crop((0, 0, img.width - 3, img.height - 4)))
sh_alpha = Image.new('L', img.size, 0); sh_alpha.paste(alpha.crop((0, 0, img.width - 3, img.height - 4)), (3, 4))
shadow.putalpha(sh_alpha)
img = Image.alpha_composite(Image.alpha_composite(img.convert('RGBA'), shadow), layer).convert('RGB')
img.save(os.path.join(HERE, 'main-floor.png'))
with open(os.path.join(HERE, 'main-floor.json'), 'w') as f:
    json.dump({
        "cell_px": CELL, "cell_feet": 0.5, "width": W, "height": H,
        "legend": {".": "grass", "#": "wall", " ": "floor", "D": "door", "F": "front door",
                   "Z": "garage door", "c": "closet slider", "R": "porch railing", "W": "window", "B": "window with blinds",
                   "S": "stairs", "p": "porch steps", "d": "driveway"},
        "tiles": [''.join(row) for row in grid],
        "rooms": [{"id": rid, "name": name, "floor": mat, "rects": rects}
                  for rid, name, mat, rects in ROOMS],
    }, f, indent=1)
print('wrote main-floor.png', img.size)
