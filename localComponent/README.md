# localComponent

The on-site piece of the house-management app. Runs on a Raspberry Pi inside
the house, reads live telemetry from the Huawei solar installation, and forwards
it to the backend so the frontend can display it.

## Architecture (Phase 1)

Two processes, both supervised by **pm2** on the Pi, talking over a local
HTTP contract:

```
   Huawei WiFi dongle (.230:502 / RS485)          ┌───────────────────────┐
   flaky link, ONE connection at a time          │  GO POLLER            │  cross-compiled static binary
      ┌────────────────── single TCP conn ───────▶│  raw Modbus TCP client│  keepalive / heartbeat / reconnect FSM
      │                                           │  adaptive pacing      │  decodes + derives in-process
      │                                           └──────────┬────────────┘
      │                                                      │  GET /snapshot  (+ / /metrics /debug /dump /scan)
      │                        127.0.0.1:8765               │
      │                                           ┌──────────▼────────────┐
      │                                           │  NODE FORWARDER        │  src/forwarder.js
      │                                           │  fetch /snapshot       │  per-field staleness → null if > MAX_AGE
      │                                           │  shape → POST backend   │  backend never blocks on a dongle hang
      └──────────────────────────────────────────▶│                        │
                                                  └──────────┬────────────┘
                                                             │  POST /api/ingestion/inverter
                                                  ┌──────────▼────────────┐
                                                  │  BACKEND (Express)     │  unchanged in Phase 1
                                                  └───────────────────────┘
```

**Why two processes?** The fragile part of the system is the physical link:
Pi → WiFi → WiFi-dongle (a cheap TCP↔RTU gateway) → half-duplex RS485 → two
daisy-chained inverters. The dongle only allows **one Modbus client connection
at a time** (Huawei-confirmed; the FusionSolar cloud / app can steal it). The
poller's *entire job* is to keep that one connection healthy and serve a
last-known-good snapshot to whoever asks. The forwarder's job is to turn that
snapshot into backend POSTs — it never touches Modbus, so a 6-second dongle
hang no longer stops ingestion; the frontend always gets the freshest available
data plus its age.

### What the poller owns (the reliability core)

- **Raw Modbus TCP client** (`poller/internal/modbus/link.go`) — built directly
  on `net.TCPConn`, *not* on the flaky `modbus-serial` npm library. This is the
  single change that removes every workaround that used to exist in the old
  `ingest.js`:
  - `SetKeepAlive(true)` + `SetKeepAlivePeriod(15s)` → dead WiFi sockets are
    detected in ~seconds instead of hanging until the 8s request timeout.
  - `SetDeadline()` per request → **timeouts that actually fire** (the old
    library's didn't, which is why there was an external `Promise.race` hack).
  - `SetNoDelay(true)` → no Nagle-induced latency on the small Modbus frames.
- **Reconnect FSM** with exponential backoff (1s→2s→… capped 60s). Replaces the
  scattered warm-up rituals, `failCount>=5` circuit breakers, and the
  `REFRESH_MS=30min` periodic reconnect that used to live in `ingest.js`.
- **Heartbeat** — one cheap read of register `30070` at the start of every
  inverter cycle. If it fails, the connection is dead → reconnect. This also
  makes **connection-stealing by the FusionSolar cloud/app observable**: an
  unexpected EOF on a nominally-open socket increments `stolenEvents` in
  `/metrics`, a previously-invisible failure class.
- **Adaptive pacing** — instead of the fixed `500ms` inter-block sleep, the
  poller measures each block's RTT and paces the next read at `1.5×lastRTT`
  (floored at `BlockMinGap`). Faster *and* gentler on the single-connection
  RS485 bus.
- **Atomic last-known-good snapshot** (`poller/internal/snapshot/store.go`) —
  a read updates only that field's value+timestamp; a block failure leaves the
  previous value intact. **Partial reads no longer discard the whole cycle.**
  This is the single biggest data-availability improvement vs the old "skip
  entire reading if any of PV/battery/meter/balance fails".

### What the forwarder owns (`src/forwarder.js`, ~130 lines)

- Polls `GET /snapshot` every `POLL_INTERVAL` (the old Modbus complexity is gone).
- For each unit (master, slave), builds the exact payload `POST
  /api/ingestion/inverter` expects. **Stale fields** (`ageMs > MAX_AGE_MS`)
  become `null` instead of being silently dropped — the backend gets a
  continuous record with explicit gaps.
- Retries backend POSTs with backoff (the only network failure surface left,
  and it's the backend, not the dongle).

## How to use it

### First-time setup (on your dev machine)

```bash
brew install go                 # one-time, to cross-compile the poller
cd localComponent
cp .env.example .env            # then edit .env (MODBUS_HOST, BACKEND_URL, API_KEY)
```

### Deploy to the Pi

From the repo root:

```bash
./deploy-local.sh
```

This cross-compiles the Go poller (`GOOS=linux GOARCH=arm64`) on your machine,
rsyncs the static binary + the Node app to the Pi (`tonete@192.168.1.240`),
installs Node deps on the Pi, and (re)starts both pm2 apps:

```
local-poller      → poller/bin/huawei-poller   (binds 127.0.0.1:8765)
local-forwarder   → src/forwarder.js            (polls /snapshot, POSTs backend)
```

### Check it's alive (on the Pi)

```bash
pm2 status
curl -s http://127.0.0.1:8765/          # human-readable summary
curl -s http://127.0.0.1:8765/snapshot  # full JSON ( machine-readable )
curl -s http://127.0.0.1:8765/metrics    # reconnects / stolen / readsOK / avgRTT
pm2 logs local-poller local-forwarder
```

The poller is bound to `127.0.0.1` only — it is never exposed beyond the Pi.

## Configuration

All knobs live in `localComponent/.env` (see `.env.example`).

| Variable | Default | Purpose |
|---|---|---|
| `MODBUS_HOST` / `MODBUS_PORT` | `192.168.1.230` / `502` | Huawei WiFi dongle address (read by the poller via its own env: `POLLER_HOST`/`POLLER_PORT`; the ecosystem sets these from MODBUS_* equivalents) |
| `POLLER_URL` | `http://127.0.0.1:8765` | where the forwarder reads the snapshot from |
| `BACKEND_URL` | — | backend base URL |
| `API_KEY` | — | shared secret for `POST /api/ingestion/inverter` |
| `POLL_INTERVAL` | `5000` | forwarder poll cadence, ms |
| `MAX_AGE_MS` | `60000` | fields older than this are sent as `null` (not dropped) |
| `BATTERY_POWER_MULTIPLIER` | `2.0` | see "Battery sign & power multiplier" below |
| `BATTERY_CURRENT_NEGATE` | `true` | see "Battery sign & power multiplier" below |
| `CADENCE_INVERTER_MS` | `15000` | poller: PV/status/grid/battery block cadence |
| `CADENCE_METER_MS` | `3000` | poller: smart-meter block cadence (faster-moving) |
| `LINK_DISABLED` | `0` | poller observe-only mode (opens no connection; used for A/B overlap) |
| `LINK_MAX_TIMEOUTS` | `3` | poller: consecutive-timeout circuit breaker. After this many `ErrTimeout`s in a row on the same connection with no successful read in between, force-close so the next read redials. 0 disables (legacy "keep alive forever" behaviour that caused the 2026-07-12 80-min hang). Warm-up reads are exempt by design. |
| `LINK_FRESHNESS_MS` | `45000` | poller: last-success watchdog. If no successful Modbus read has occurred in this duration, force-close the connection. Catches stalls the per-read breaker can't (slow-but-succeeding reads, scheduler goroutine death). Complements `LINK_MAX_TIMEOUTS`; does NOT replace it. |
| `POLLER_STALE_MS` | `120000` | forwarder: poller-watchdog trip #1. If `/snapshot` is reachable but `link.lastSuccess` is older than this for `POLLER_STALE_CYCLES` consecutive fetches, the forwarder runs `POLLER_RESTART_CMD` to restart the poller process. |
| `POLLER_STALE_CYCLES` | `2` | forwarder: number of consecutive stale snapshots required to trip the poller watchdog (avoids thrashing on a single missed update). |
| `POLLER_DOWN_CYCLES` | `6` | forwarder: poller-watchdog trip #2. If `/snapshot` itself is unreachable for this many consecutive fetches (poller HTTP server dead = process wedge), run `POLLER_RESTART_CMD`. |
| `POLLER_RESTART_COOLDOWN_MS` | `300000` | forwarder: minimum interval between poller restarts. One restart per cooldown regardless of which trip fired, so a stuck poller doesn't get hammered. |
| `POLLER_RESTART_CMD` | `pm2 restart local-poller --update-env` | forwarder: command the watchdog runs when it decides to restart the poller. Override if `pm2` is not on the default PATH (the forwarder runs it via `bash -lc` so the user's profile is sourced). |
| `SHELLY_CONFIG` | `./shelly.json` | Shelly forwarder: LAN device/sensor mapping |
| `SHELLY_POLL_INTERVAL_MS` | `10000` | Shelly forwarder: relay status poll cadence |
| `SHELLY_REQUEST_TIMEOUT_MS` | `3000` | Shelly forwarder: per-request LAN timeout (also `requestTimeoutMs` in `shelly.json`) |
| `SHELLY_BACKEND_PATH` | `/api/ingestion/device` | Shelly forwarder: relay status endpoint |
| `SHELLY_FLOW_BACKEND_PATH` | `/api/ingestion/flow` | Shelly forwarder: pulse-sensor endpoint — see "Pulse sensors" below |
| `SHELLY_FLOW_POLL_EVERY_N_TICKS` | `3` | Shelly forwarder: poll pulse counters once every N relay ticks (3 × 10 s = every 30 s) |
| `SHELLY_COMMAND_PATH` | `/api/ingestion/commands` | Shelly forwarder: backend path long-polled for relay commands to run over the LAN |
| `SHELLY_COMMAND_WAIT_MS` | `25000` | Shelly forwarder: how long the backend may hold each command poll open (keep below nginx's 60 s `proxy_read_timeout`) |

Poller-only knobs (`LINK_KEEPALIVE_MS`, `LINK_READ_TIMEOUT_MS`, etc.) can also
be set in the pm2 ecosystem env block.

### Polling cadence

PV/status/grid/battery values change slowly, so the poller reads them every
~15s. The smart meter is the only fast-moving value, so it's read every ~3s.
This deliberately relaxes the old flat-5s-everything schedule: less pressure on
the single-connection RS485 bus is a free reliability win, matching the wider
Huawei-solar community's practice (wlcrs/huawei_solar uses ~20s inverter /
~5s meter).

### Battery sign & power multiplier (important during cutover)

The `battCurrent` and `battPower` values the backend/frontend expect come from
the **old `ingest.js` conventions**, not the Huawei-native register convention:

- **`BATTERY_CURRENT_NEGATE=true` (default)**: Huawei's register `37002` is
  `-charge / +discharge`. The old `ingest.js` negated it before sending
  (so it stored `+charge / -discharge`). The forwarder defaults to negating
  too, so the frontend energy chart (`houseConsumption = solar + batt - meter`)
  keeps working unchanged during the A/B compare.
- **`BATTERY_POWER_MULTIPLIER=2.0` (default)**: the old `ingest.js` computed
  `battPower = round(current * voltage * 2)` with an **undocumented `*2`**.
  It is most likely a per-stack count for a 2-module LUNA2000 battery, but that
  was never confirmed against the hardware.

**These defaults preserve the old behavior so cutover is safe.** Fixing them is
a *deliberate, separate* step once you're confident the poller/forwarder are
working: validate the frontend `/today` math, then set
`BATTERY_POWER_MULTIPLIER=1.0` and `BATTERY_CURRENT_NEGATE=false` (the
physically-correct Huawei-native convention) and re-check the chart. The poller
itself always stores Huawei-native values in `/snapshot` — only the forwarder
shapes for the backend.

## Local relay control

Commands from the app (lights, pool pump, garage gate, scheduler, riego) are
sent to the Shellys **over the LAN first** and only go through the Shelly cloud
when the Pi is not connected. This keeps everything working through Shelly
cloud outages (e.g. 2026-10-24, ~40 min of HTTP 502/504 from
`shelly-263-eu.shelly.cloud`).

The backend cannot open connections to the Pi, so `shellyForwarder.js` keeps a
long-poll open on `GET /api/ingestion/commands`. The backend answers it the
moment a command is queued; the forwarder calls `Switch.Set` on the device
(Gen1 `/relay/N?turn=` on 404) and posts the outcome to
`POST /api/ingestion/commands/:id/result`.

Backend rules (`backend/src/services/localCommands.js`, `shelly.js`):

- The Pi counts as connected while a poll is held open or one ended < 5 s ago.
- On/off are sent as explicit states and read back; any local failure falls
  back to the cloud, which is safe because they are idempotent. A toggle is
  resolved to on/off from the last forwarder-reported state.
- A **pulse** (gate) only falls back to the cloud if the Pi never received the
  command. If it was delivered but no result arrived, the request fails rather
  than risk a second pulse that would stop or reverse the gate.

Backend log lines: `Shelly <action> for <device> done locally` /
`Shelly local <action> failed ... using cloud API`. Pi log lines:
`Shelly command <action> <shellyId>:<ch> ok|failed`.

## Pulse sensors (caudalímetro)

The Shelly forwarder (`src/shellyForwarder.js`, PM2 app `local-shelly-forwarder`)
polls Shelly relay state over the LAN and, on the same tick loop, reads pulse
counters from devices that declare an `inputs` array in `shelly.json`:

```json
{
  "pollIntervalMs": 10000,
  "requestTimeoutMs": 3000,
  "devices": [
    {
      "shellyId": "30c6f78a406c",
      "ip": "192.168.1.102",
      "channels": [0, 1],
      "name": "Luces Entrada + Focos Explanada"
    },
    {
      "shellyId": "<Shelly Plus Uni id>",
      "ip": "192.168.1.120",
      "name": "Caudal depósito",
      "inputs": [{ "id": 2, "type": "count" }]
    }
  ]
}
```

- `channels` and `inputs` are independent. A relay-only device keeps its current
  shape; a sensor-only device needs no `channels`; a device with both is polled
  for both.
- Each input is read with `GET /rpc/Input.GetStatus?id=<n>` and posted to
  `SHELLY_FLOW_BACKEND_PATH` as
  `{ timestamp, sensors: [{ shellyId, input, online, counts, freq }] }`,
  through the same retrying `postToBackend` and the same `API_KEY` as relay
  status. No new PM2 process.
- An unreachable device is posted with `online: false` and no `counts`, so the
  backend records "sin conexión" instead of an unexplained gap.
- Counter totals are forwarded **raw**. Calibration (`pulsesPerLitre`) lives in
  `backend/config/shelly.json` under the matching `kind: "sensor"` device, so
  the stored history never depends on device firmware settings and a
  recalibration recomputes the whole history.

### Device-side setup

The Shelly Plus Uni counts pulses in hardware once `input:2` is in `count` mode:

```bash
# Configure the counter input (once, or from the device web UI)
curl -X POST http://<ip>/rpc/Input.SetConfig \
  -H 'Content-Type: application/json' \
  -d '{"id":2,"config":{"type":"count","enable":true,"freq_window":10}}'

# Verify: counts.total must increase while water flows
curl http://<ip>/rpc/Input.GetStatus?id=2
```

Update the device firmware first — `counts.by_minute` and `freq` need a recent
version. Then calibrate `pulsesPerLitre` by noting `counts.total` before and
after filling a known volume (a 20 L bucket is enough). Hall-effect meters
typically report ~450 p/L (YF-S201) to ~660 p/L (YF-B series); industrial meters
are often 1–10 p/L. Check the sensor datasheet against the Uni's input
specification before wiring — many 5 V open-collector sensors need a pull-up.

## HTTP API (poller)

| Endpoint | Returns |
|---|---|
| `GET /snapshot` | full JSON: per-unit fields `{v, ageMs}`, derived, link state, stats |
| `GET /` | plain-text human summary (replaces the old `cli.js`) |
| `GET /metrics` | `reconnects`, `stolenEvents`, `readsOK`, `readsFail`, `heartbeatsOK`, `avgRttMs` (use `?format=prom` for Prometheus exposition) |
| `GET /debug` | per-field dump with ages (replaces the old raw-client diagnostics) |
| `GET /dump?unit=1&start=32000&count=100` | raw hex dump of a register range (replaces `dump.js`) |
| `GET /scan` | probe slave IDs 1–10 for model/serial (replaces `scanner.js`) |

All endpoints reuse the poller's single healthy Modbus connection — they never
open competing ones (the dongle only allows one at a time).

## Migration: parallel run + A/B compare + cutover

1. **Deploy the poller only.** Start `local-poller`; leave the old `local-ingest`
   running. **They cannot both hold the Modbus connection at once.** To observe
   both simultaneously during the overlap, run the new poller with
   `LINK_DISABLED=1` (observe-only, opens no connection) — its `/metrics` and
   `/snapshot` shape are then fully exercisable without fighting the old ingester
   for the single connection.
2. **Watch `/metrics` for a few days.** Confirm reconnect behaviour, that
   `stolenEvents` rises when FusionSolar/app connects, and that AVG RTT is sane.
3. **Cut the forwarder over.** Stop `local-ingest`, start `local-forwarder`
   against `/snapshot`. Compare `GET /api/ingestion/latest` and the frontend
   `/today` chart before/after.
4. **Cutover done.** The old `ingest.js` and the four diagnostic scripts are
   already deleted from the repo; the old code is one `git revert` away during
   the compare window.

## What this fixes vs the old single-process `ingest.js`

- Library timeouts that didn't fire → real `SetDeadline` timeouts.
- No TCP keepalive → diagnosed dead WiFi sockets in ~15s.
- "Skip entire reading on any partial failure" → per-field staleness + nulls.
- `40118` power-limit "always null" bug → the `40100–40129` block is now
  actually polled (the old `MASTER_BLOCKS` list omitted it, so the register was
  decoded from a cache key that was never populated).
- `balOk` rejecting valid nighttime readings → gone; per-field policy replaces it.
- Undocumented `*2` battery-power constant → explicit, documented, configurable.
- Silent battery-current sign flip → explicit, documented, configurable.
- Dead/duplicated code (`modbus-client.js`, the 4 copy-pasted decode blocks, the
  unused `Stats` class with a "placeholder" `stddev`) → one source of truth in
  `poller/internal/registers/registers.go`.

## What this does *not* fix

The physical transport — WiFi + a cheap TCP↔RTU gateway + half-duplex RS485 +
a single-connection-at-a-time dongle — is still fragile by nature. The poller
reacts to it better, detects failures faster, isolates them, and makes them
observable in `/metrics`. It cannot make WiFi/RS485 more reliable than physics
allow. The win is that **incidents stop cascading into lost/scrapped readings**
and become visible as numbers.

## Source layout

```
localComponent/
  src/
    forwarder.js            Node forwarder (polls /snapshot, POSTs backend)
    shellyForwarder.js      Node Shelly forwarder (LAN relay status + pulse sensors)
  poller/                   Go poller (cross-compiled to a static binary)
    cmd/huawei-poller/main.go          entry point (+ `-scan` subcommand)
    internal/config/config.go          env/flags
    internal/registers/registers.go     register map + decoders + derived  (source of truth)
    internal/modbus/link.go             raw Modbus TCP client + reconnect FSM + heartbeat
    internal/snapshot/store.go          atomic last-known-good snapshot
    internal/poll/scheduler.go          per-block adaptive scheduling
    internal/server/http.go             /snapshot /metrics /debug /dump /scan endpoints
    bin/                                build output (gitignored)
  docs/register-map.md     Huawei SUN2000 register reference
  shelly.example.json      Shelly LAN mapping (relay channels + sensor inputs)
  .env.example
```

The Modbus link, register map and all decoders live in the Go poller. The Node
side no longer contains any Modbus code.