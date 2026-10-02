# Seven Wonders — a continuous passage

A personal cinematic demo by Kenny Kline (`kkcandc`). One browser window, one take: a stylized flight across the seven wonders on a single stretch of terrain. The wall, gardens, canyon, amphitheater, jungle, cloud forest, and coastal peak are connected. The camera does not cut between them.

This is an original procedural scene. It is not a survey model, and it does not reuse footage or assets from any film, game, or attraction.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm test
npm run build
npm run preview
```

`npm run build` writes a static site to `dist/`. No server, no API keys, and no paid generation services are required.

## What you should see

The film starts on the Great Wall at dawn: ridgelines above a cloud deck, watchtowers, and the camera already moving. It then follows one route through

1. Great Wall
2. Taj Mahal
3. Petra
4. Colosseum
5. Chichén Itzá
6. Machu Picchu
7. Christ the Redeemer

Light, fog, vegetation, and the ground change along the way. Crowds are there for scale. The picture is the whole experience — sound is off until you turn it on.

## Controls

| Action | How |
| --- | --- |
| Play or pause the film | Pause button, or Space |
| Jump to a wonder and orbit it | Wonder chips, or keys 1–7 |
| Scrub the flight | Timeline |
| Fly freely | WASD, Shift to go faster, Q/E down/up |
| Look | Drag |
| Orbit after a chip jump | Drag, scroll or pinch to dolly |
| Resume the film from where you are | Resume, or Space |
| Sound | Sound button, or M. Off by default |
| Fullscreen | Full, or F |

On a phone, the film autoplays. Drag to look around, pinch to zoom, and tap a chip to visit that wonder.

## Deploy

The repo is ready for Vercel as a static Vite project (`vercel.json` points at `dist/`). Connect the repository and deploy. Nothing secret is read at build or runtime.

## Stack

Vite, TypeScript, Three.js, Vitest. Geometry, terrain, and the optional score are generated in the browser.
