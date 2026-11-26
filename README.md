# Copperwing Ridge Run

An original 3D flight game for the make.fun bounty
**best-flight-game-20261126-0057** — "Make the best flight game".

Fly the Copperwing, a small copper-orange bush plane, through eight glowing
rings over Copperwing Island — lake, valley, north ridge, east cliffs — and
land her back on the south-coast airstrip. Fuel burns with the throttle, a
green fuel ring tops the tank up at ring 5, hard touchdowns and tree strikes
cost damage, and you have three airframes. Land with all eight rings flown
and the clock decides your bonus.

## How to play

Open `game/index.html` from any static server (no build step, no network):

```
node serve.ts   # then open http://localhost:8080
```

| Control | What it does |
| --- | --- |
| ↑ / ↓ | Pitch (up = climb) |
| ← / → | Bank and turn |
| Mouse | Steer like a stick (move the pointer) |
| W / S or Shift / Ctrl | Throttle up / down |
| Mouse wheel | Throttle trim |
| Space | Airbrake |
| Click or C | Chase view / cockpit view |
| P | Pause |
| R | Restart the sortie |
| M | Sound on / off |

The HUD shows altitude (ft), vertical speed (fpm), airspeed (kt), throttle,
a compass with heading, an attitude indicator, fuel, damage, rings flown,
time and score. The green needle points at the next ring. The cockpit view
has a lit instrument panel with live dials.

## What is in here

- `main.ts` — the program that hands the game in: copies `game/` and
  `screenshots/` to `/output` and writes `/output/dossier.json` with the
  vendored make.fun library. Run it with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
- `game/` — the playable game, plain static files:
  - `index.html` — page, HUD and overlay panels
  - `src/config.js` — tuning numbers, the ring course, the palette
  - `src/random.js` — seeded RNG and value noise
  - `src/terrain.js` — the island: heightfield, lake, trees, runway, lighthouse, clouds
  - `src/aircraft.js` — the Copperwing model, built from primitives
  - `src/flight.js` — the flight model: lift, stall, banking turns, landings, crashes
  - `src/rings.js` — the ring course, sequencing and scoring
  - `src/input.js` — keyboard and mouse
  - `src/audio.js` — synthesised engine, wind and cue sounds (WebAudio, no files)
  - `src/hud.js` — the lit instruments: altitude, speed, compass, attitude, fuel
  - `src/render.js` — three.js scene, sky, sun, chase and cockpit cameras
  - `src/shots.js` — the deterministic screenshot scenes
  - `src/main.js` — boot, the fixed-step loop, screens and the mission flow
  - `vendor/three/three.module.min.js` — three.js r187, vendored
- `screenshots/` — real renders of the game's own code (`?shot=start|play|end&seed=1`).
- `shots.json` — which query stages each screenshot.
- `serve.ts` — a tiny static server for local play.

## Screenshots

Each screenshot is a real render of the game's own code in a desktop browser,
staged deterministically with `?shot=…&seed=1`:

- `1-start.jpg` — the title screen, the Copperwing parked on the strip.
- `2-play.jpg` — mid-flight through a ring, chase view, HUD lit.
- `3-end.jpg` — mission complete: landed back on the strip.

## License

MIT. See `LICENSE`.
