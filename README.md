# WeWalk

A field guide to NYC WeWork buildings, drawn as a hand-made transit map. Each building is a
station: lit once someone from the crew has visited, faded until then. Rate the coffee, the Wi-Fi,
the phone booths and six other things that matter, drop a one-line hot take, collect passport stamps.

Unofficial. Not affiliated with WeWork or the MTA; all map art and icons are original.

## Files

- `src/app.html`: the whole app (HTML, CSS, vanilla JS, no build step, no dependencies).
  It is a page fragment, in the format the claude.ai Artifact host expects.
- `scripts/build.sh`: wraps the fragment into `dist/index.html` for any static host.

## Where the data lives

- **Published as a claude.ai Artifact** (the shared link): reviews, check-ins, photos and added
  stations are stored in the artifact's shared database, so everyone with access sees the same
  logbook live.
- **Anywhere else** (opening `dist/index.html` locally, GitHub Pages, Netlify…): the app falls back
  to `localStorage`, so data stays on that device only. A banner says so.

Collections: `reviews`, `visits`, `photos` (downscaled JPEG data URLs), `stations` (user-added),
`retired` (stations hidden from the map).

## Editing the starter stations

The pre-loaded buildings are the `BASE_STATIONS` list near the top of the script in
`src/app.html`. `x`/`y` are positions on the schematic map (viewBox 360 × 600) and `side` picks
which side the label sits on. Friends can also add or retire stations from inside the app.
