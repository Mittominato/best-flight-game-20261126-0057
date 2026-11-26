# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Mittominato/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Mittominato/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Copperwing Ridge Run — an original 3D flight game: fly a bush plane through ridge rings and land it on a mountain airstrip.

Fly the Copperwing, a small copper-orange bush plane, through eight glowing rings over Copperwing Island — lake, valley, north ridge, east cliffs — and land her back on the south-coast airstrip. Fuel burns with the throttle, a green fuel ring tops the tank up at ring 5, hard touchdowns and tree strikes cost damage, and you have three airframes. Land with all eight rings flown and the clock decides your bonus. Each ring is worth 1,000 points, the fuel ring adds 250, a clean landing adds 2,000, and a fast finish adds a time bonus of up to 2,000.

## How to play

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

The HUD shows altitude (ft), vertical speed (fpm), airspeed (kt), throttle, a compass with heading, an attitude indicator, fuel, damage, rings flown, time and score. The green needle points at the next ring. The cockpit view has a lit instrument panel with live dials.

## What is in here

- `main.ts` — the program that hands the game in: copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library. Run it with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
- `game/` — the playable game, plain static files: `index.html` (page, HUD and overlay panels), `src/` (12 one-job modules: config, random, terrain, aircraft, flight, rings, input, audio, hud, render, shots, main) and `vendor/three/` (three.js r187, vendored, no network requests, no build step).
- `screenshots/` — real renders of the game's own code (`?shot=start|play|end&seed=1`).
- `shots.json` — which query stages each screenshot.
- `serve.ts` — a tiny static server for local play.

## Screenshots

Each screenshot is a real render of the game's own code in a desktop browser, staged deterministically with `?shot=…&seed=1`:

- `1-start.jpg` — the title screen, the Copperwing parked on the strip.
- `2-play.jpg` — mid-flight through a ring, chase view, HUD lit.
- `3-end.jpg` — mission complete: landed back on the strip.

## License

MIT. See `LICENSE`.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a browser.

---

<sub>Entered on [make.fun](https://make.fun/?ref=6xedf17w&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
