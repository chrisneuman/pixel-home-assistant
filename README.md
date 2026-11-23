# pixel-home-assistant

A top-down pixel art map of the house (think early Zelda / Pokemon) that shows and toggles Home Assistant devices.
Plan: a standalone web component that runs as a Home Assistant custom card first, with a standalone site possible later.

![Main floor on desktop](docs/preview-desktop.png)

## What's here so far

`maps/main-floor/`
- `main-floor.png` – the base art (888×704, 8 px per cell, 1 cell = 6 inches). Placeholder quality; repaint freely as long as the size stays the same.
- `main-floor.json` – the tile grid (walls, doors, windows, floors) and room rectangles. The renderer uses it so light never glows through walls or closed doors.
- `lights.yaml` – every light: name, room, map position (or several `fixtures` when one entity drives more than one) and a **placeholder** Home Assistant entity id. Replace the `entity:` values with your real ones.
- `preview.html` – self-contained interactive preview with mock state. Open it in a browser and tap a light.
- `build_map.py` – generates the PNG and JSON from the traced layout and sprite code.
- `build_preview.py` – inlines the PNG, JSON and YAML into `preview.html`.

Rebuild after changing anything:

```sh
cd maps/main-floor
python3 build_map.py      # needs Pillow
python3 build_preview.py  # needs PyYAML
```

## Controls

Tap a room to zoom into it. A panel lists everything in that room as big toggles: lights, fans, blinds, and color presets for RGB strips. It sits below the map on a phone and beside it on desktop. You can also tap fixtures directly on the zoomed map. On the overview, tapping a light (or blinds) toggles it right there, and tapping anywhere else in a room opens it. Long-press a room to toggle all its lights. The garage door only opens from inside the garage view, so a stray tap can't open it. Rooms are defined under `rooms:` in `lights.yaml`.

## How lights render

The house gets an ambient tint from the sun's elevation (HA `sun.sun`): clear in the day, orange at sunset, blue at dusk, navy at night. A light that is on cuts that tint away with a stepped (pixel-style) radial glow plus a warm overlay, clipped to the space it can actually reach.
It fades in and out over about half a second and flickers gently while on.

## Weather, the dog and the garage door

- **Rain:** when the weather entity under `sky:` in `lights.yaml` is rainy, rain falls on the yard, deck and driveway (never indoors) and the light goes grey. Thunderstorms add lightning flashes. Snow drifts down and builds up a white blanket outside that melts away slowly after it stops. Weather states map as: `rainy`/`pouring` = rain, `lightning`/`lightning-rainy` = storm, `snowy`/`snowy-rainy` = snow.
- **Dog:** wanders between the spots under `dog:` in `lights.yaml`, trots along real hallways and doors, and naps on its bed with floating z's.
- **Garage door:** a cover with `kind: garage`. It rolls open on the map, and once it has been open `alert_after_min` minutes (35) it blinks red with a "!" and a banner appears at the top of the panel. `ha/garage_door_alert.yaml` has the matching Home Assistant automation that sends a phone alert with a "Close it" button.

The preview's Time slider, Live button and Clear/Rain/Storm buttons fake the sun and weather. URL options: `?t=20.5` (time), `?weather=rain|storm|snow`, `?garage=40` (open 40 minutes).
