# Sheets 4 & 5 — Pixel-Exact Lossless Sprite Sheets (`#FF00FF`)

Both sheets were built locally at **exact 1× native pixel dimensions** (plus crisp **2× nearest-neighbor** copies) on flat solid `RGB(255, 0, 255)` (`#FF00FF`) magenta with ≥10 px empty padding around every sprite, zero anti-aliasing, zero blur, and zero text/UI.

---

## Sheet 4: Garage, Mud Room & Outside

![Sheet 4 — Garage, mud room, and outdoor sprites on #FF00FF magenta (2x crisp nearest-neighbor scale)](/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/9e0bc403-f40e-4347-b878-3e5fe546fc81/sheet4_garage_mudroom_outside_2x.png)

- **Native 1× (`352 × 266 px`):** [sheet4_garage_mudroom_outside_1x.png](file:///home/antigravity/chrisneuman/pixel-home-assistant/maps/main-floor/sprites/sheet4_garage_mudroom_outside_1x.png)
- **Crisp 2× (`704 × 532 px`):** [sheet4_garage_mudroom_outside_2x.png](file:///home/antigravity/chrisneuman/pixel-home-assistant/maps/main-floor/sprites/sheet4_garage_mudroom_outside_2x.png)

### Sheet 4 Exact 1× Slicing Rects `(x, y, w, h)` *(multiply by 2 for 2× PNG)*

| Sprite | `x` | `y` | `w × h` |
| :--- | :---: | :---: | :---: |
| Tan 2-door Bronco (matching hardtop + 2 black roof panels + spare tire, nose down) | 10 | 10 | `104 × 244` |
| Bicycle — Red / Blue / Green / Yellow / Purple | 130 | 10, 36, 62, 88, 114 | `40 × 16` |
| Metal storage shelf w/ bins & boxes | 186 | 10 | `37 × 128` |
| Long wooden workbench w/ tools | 186 | 154 | `144 × 20` |
| Mud room wooden bench w/ shoe cubbies | 186 | 190 | `64 × 20` |
| Stacked washer & dryer | 239 | 10 | `37 × 64` |
| Wooden porch bench | 186 | 226 | `48 × 16` |
| Outdoor wall lantern (unlit, plain glass) | 250 | 228 | `8 × 10` |
| Mailbox on post | 272 | 224 | `12 × 16` |
| Round leafy tree | 292 | 10 | `48 × 48` |
| Round shrub | 292 | 74 | `24 × 24` |
| Red-capped mushroom | 300 | 114 | `8 × 8` |
| Flower clusters — White / Red / Yellow / Blue | 292, 312, 292, 312 | 192, 192, 212, 212 | `8 × 8` |

---

## Sheet 5: Animated Sprites (14 Rows, Exact Baselines)

![Sheet 5 — 14 animated sprite rows on #FF00FF magenta (2x crisp nearest-neighbor scale)](/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p_devbox/9e0bc403-f40e-4347-b878-3e5fe546fc81/sheet5_animated_2x.png)

- **Native 1× (`780 × 578 px`):** [sheet5_animated_1x.png](file:///home/antigravity/chrisneuman/pixel-home-assistant/maps/main-floor/sprites/sheet5_animated_1x.png)
- **Crisp 2× (`1560 × 1156 px`):** [sheet5_animated_2x.png](file:///home/antigravity/chrisneuman/pixel-home-assistant/maps/main-floor/sprites/sheet5_animated_2x.png)

### Sheet 5 Exact 1× Row Slicing Table *(multiply by 2 for 2× PNG)*

| Row | Animation | `x0` | `y0` | Frame `w × h` | Frames | `stride_x` |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| 1 | Golden dog walking DOWN | 10 | 10 | `24 × 24` | 4 | 34 |
| 2 | Golden dog walking UP | 10 | 44 | `24 × 24` | 4 | 34 |
| 3 | Golden dog walking LEFT *(mirror for right)* | 10 | 78 | `24 × 24` | 4 | 34 |
| 4 | Golden dog sleeping curled up (breathing) | 10 | 112 | `24 × 24` | 2 | 34 |
| 5 | Dog bed (round cushion) | 10 | 146 | `24 × 24` | 1 | 34 |
| 6 | Grey tabby cat sitting (tail flick) | 10 | 180 | `16 × 16` | 2 | 26 |
| 7 | Grey tabby cat sleeping curled up | 10 | 206 | `16 × 16` | 2 | 26 |
| 8 | 5-blade wood ceiling fan (18° steps) | 10 | 232 | `40 × 40` | 4 | 50 |
| 9 | Round ceiling light (OFF / ON) | 10 | 282 | `8 × 8` | 2 | 18 |
| 10 | Window blinds (OPEN → CLOSED) | 10 | 300 | `80 × 12` | 5 | 90 |
| 11 | Garage door (CLOSED → OPEN) | 10 | 322 | `144 × 24` | 5 | 154 |
| 12 | Tileable falling rain streaks | 10 | 356 | `64 × 64` | 3 | 74 |
| 13 | Tileable falling snowflakes | 10 | 430 | `64 × 64` | 3 | 74 |
| 14 | Lightning bolt | 10 | 504 | `32 × 64` | 2 | 42 |
