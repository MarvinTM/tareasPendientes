# Huawei SUN2000 ModBus TCP Register Map

## System Overview

| Property | Value |
|---|---|
| **Inverter Model** | 2x SUN2000-4KTL-L1 |
| **Firmware** | V100R001C20B004 (Master) / V100R001C20B000 (Slave) |
| **Topology** | Two inverters daisy-chained via RS485, connected through a WiFi dongle (single Modbus connection at a time) |
| **Dongle IP** | `192.168.1.230` (house-WiFi). The configuration web UI is only reachable on the dongle's own AP `192.168.200.1`; on house-WiFi only port 502 is open (confirmed by nmap). |
| **ModBus Port** | `502` (TCP) |
| **Unit IDs** | `1` = Master, `2` = Slave |
| **Total Rated Power** | 8 KW (2 × 4 KW) |
| **Battery** | LUNA2000, connected to Master (unit 1) |
| **Smart Meter** | Single grid-connection meter, read via Master (unit 1) |
| **Protocol** | ModBus TCP, function code `0x03` (Read Holding Registers) |

## Data Types

| Type | Size | Encoding |
|---|---|---|
| `uint16` | 1 register (2 bytes) | Unsigned 16-bit integer, big-endian |
| `int16` | 1 register | Signed 16-bit two's complement |
| `uint32` | 2 consecutive registers | Unsigned 32-bit, high word first |
| `int32` | 2 consecutive registers | Signed 32-bit, high word first |
| `string` | N consecutive registers | ASCII, each register = 2 chars, null-padded |

All multi-register values use **big-endian** byte order (MSB first), both within each register and across register pairs.

## Connection Parameters

| Parameter | Value | Notes |
|---|---|---|
| Timeout | 8000 ms | Per-request timeout |
| Warm-up | Required | Read register `30070` first; first read after `setID()` often times out |
| Block size | 20–30 registers | Small, safe blocks that never cross exception boundaries |
| Function code | `0x03` | Read Holding Registers (Input Registers 0x04 are not supported on this firmware) |

---

## Register Map

### 1. Identity (30000–30099)

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `30000` | Model | string | 15 | — | — | e.g. `SUN2000-4KTL-L1` |
| `30015` | Serial Number | string | 10 | — | — | e.g. `HV2150061482` |
| `30070` | Running Time | uint16 | 1 | h | ×1 | Cumulative operating hours |
| `30071` | PV Strings | uint16 | 1 | — | ×1 | Number of PV strings |
| `30072` | MPPT Trackers | uint16 | 1 | — | ×1 | Number of MPPT inputs |
| `30074` | Rated Power (Pn) | uint16 | 1 | W | ×1 | Nominal active power (4000) |
| `30076` | Max Apparent Power | uint16 | 1 | VA | ×1 | Smax (4400) |
| `30078` | Max Active Power | uint16 | 1 | W | ×1 | Pmax (4400) |

### 2. Status (32000–32002)

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `32000` | Running State | uint16 | 1 | — | ×1 | `0`=Standby, `1`=Self-check, `6`=On-Grid |
| `32001` | Daily Start Count | uint16 | 1 | — | ×1 | Number of starts today |
| `32002` | Alarm Flags | uint16 | 1 | — | ×1 | Active alarm bitmask |

### 3. PV Strings (32016–32019)

Consecutive registers: V1, I1, V2, I2.

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `32016` | PV1 Voltage | uint16 | 1 | V | ×0.1 | PV string 1 voltage |
| `32017` | PV1 Current | uint16 | 1 | A | ×0.01 | PV string 1 current |
| `32018` | PV2 Voltage | uint16 | 1 | V | ×0.1 | PV string 2 voltage |
| `32019` | PV2 Current | uint16 | 1 | A | ×0.01 | PV string 2 current |

### 4. Yield (32064–32073)

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `32064`–`32065` | Daily Yield | uint32 | 2 | kWh | ×0.01 | Energy generated today |
| `32072`–`32073` | Total Yield | uint32 | 2 | kWh | ×0.01 | Lifetime energy |

### 5. Grid & Internal (32069–32087)

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `32069` | Grid Voltage | uint16 | 1 | V | ×0.1 | Phase A voltage |
| `32079` | DC Bus Voltage | uint16 | 1 | V | ×0.1 | Internal DC bus |
| `32080`–`32081` | Active Power | int32 | 2 | W | ×1 | Inverter AC output power |
| `32085` | Grid Frequency | uint16 | 1 | Hz | ×0.01 | ~50 Hz |
| `32087` | Temperature | uint16 | 1 | °C | ×0.1 | Internal heat sink temperature |

### 6. Smart Meter — Master only (37113–37114)

The smart meter is a single device at the grid connection point measuring the net balance of the entire house. It is read via Master (unit 1) only. Slave (unit 2) does not have an independent meter.

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `37113`–`37114` | Meter Active Power | int32 | 2 | W | ×1 | Grid meter: +import, −export |

### 7. Power Limiting (40118)

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `40118` | Grid Pwr Limit | uint16 | 1 | W | ×1 | Active power export cap. If ~3000W on a 4000W inverter, export is being limited. |

### 8. Battery — LUNA2000, Master only (37000–37007 + 47000–47499)

The battery is physically connected to the Master inverter. Battery data is split into two ranges:

**Live telemetry (37000–37007):**

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `37000` | Batt Status | uint16 | 1 | — | ×1 | Operating status |
| `37002` | Batt Current | int16 | 1 | A | ×0.01 | −charge / +discharge |
| `37003` | Batt Voltage | uint16 | 1 | V | ×0.01 | Battery stack voltage |
| `37004` | Batt SOC | uint16 | 1 | % | ×0.1 | State of charge (1000 = 100.0%) |
| `37005` | Batt SOH | uint16 | 1 | % | ×0.1 | State of health |
| `37007` | Batt Temperature | uint16 | 1 | °C | ×0.1 | Battery temperature |

**Configuration/Settings (47000–47499):**

| Register | Label | Type | Count | Unit | Scale | Description |
|---|---|---|---|---|---|---|
| `47080` | Batt Max Chg Power | uint16 | 1 | W | ×1 | Maximum charge power |
| `47088` | Batt Max Dis Power | uint16 | 1 | W | ×1 | Maximum discharge power |
| `47150` | Batt Work Mode | uint16 | 1 | — | ×1 | Battery work mode |
| `47152` | Batt Chg/Dis St | uint16 | 1 | — | ×1 | Charge/discharge state |
| `47420` | Batt Min SOC | uint16 | 1 | % | ×1 | Discharge cutoff threshold |
| `47421` | Batt Max SOC | uint16 | 1 | % | ×1 | Charge cutoff threshold |
| `47423` | Batt Backup SOC | uint16 | 1 | % | ×1 | Backup reserve level |
| `47428` | Batt Max Chg Cur | uint16 | 1 | A | ×0.1 | Maximum charge current |
| `47429` | Batt Max Dis Cur | uint16 | 1 | A | ×0.1 | Maximum discharge current |

---

## Derived Computations

### Per-Inverter (Energy Balance section)

| Computation | Formula |
|---|---|
| MPPT1 Power | PV1 Voltage × PV1 Current |
| MPPT2 Power | PV2 Voltage × PV2 Current |
| Total PV DC | MPPT1 + MPPT2 |
| Efficiency | Active Power ÷ Total PV DC × 100 |

### System-Wide (System Summary section, after both inverters)

| Computation | Formula |
|---|---|
| Total AC Generation | Master Active Power + Slave Active Power |
| Net Grid Interaction | Meter Active Power (Master only) — positive = import, negative = export |
| House Consumption | Total AC Generation − Net Grid Interaction |
| System Efficiency | Total AC Generation ÷ Total PV DC (both inverters) × 100 |

---

## Block Read Strategy

Register reads are performed in small, safe blocks of 20–30 registers covering only known valid ranges. This avoids `Modbus Exception 2` (Illegal Data Address) that aborts entire bulk reads when a gap in the register map is encountered.

**Common blocks (both inverters):**

| Block | Range |
|---|---|
| Identity | 30000–30029 |
| Parameters | 30070–30089 |
| Firmware | 31000–31019 |
| Status + PV | 32000–32029 |
| Yield | 32060–32089 |
| Grid/Power | 32080–32099 |
| Meter | 37100–37129 |
| Power Limit | 40100–40129 |

**Battery blocks (Master only):**

| Block | Range |
|---|---|
| Battery Telemetry | 37000–37019 |
| Battery Config | 47000–47029, 47030–47059, 47070–47099, 47100–47129, 47140–47169, 47400–47439 |

---

## Sample Readings

Recorded on a sunny July day (~1 PM, Spain):

| Register | Master (unit 1) | Slave (unit 2) |
|---|---|---|
| Running State | 6 (On-Grid) | 6 (On-Grid) |
| PV1 Voltage | ~300 V | ~300 V |
| PV1 Current | ~9.4 A | ~9.1 A |
| PV2 Voltage | 0 V | 0 V |
| PV2 Current | 0 A | 0 A |
| Active Power | ~3,000 W | ~2,800 W |
| Daily Yield | ~30 kWh | ~29 kWh |
| Total Yield | ~120 kWh | ~118 kWh |
| Grid Voltage | ~245 V | ~216 V |
| DC Bus Voltage | ~332 V | ~292 V |
| Temperature | ~47 °C | ~45 °C |
| Grid Frequency | 50.00 Hz | 49.99 Hz |
| Meter Active Power | ~3,048 W import | (not polled) |
| Grid Pwr Limit | (TBD) | (TBD) |
| Battery SOC | 100% | (not polled) |
| Battery SOH | 100% | (not polled) |

---

## Implementation Reference

The register map is implemented in:

- **`localComponent/poller/internal/registers/registers.go`** — the single source of truth. Register definitions (address, type, scale, unit), per-unit block lists, typed decoders (uint16/int16/uint32/int32/string), and `ComputeDerived()` (MPPT1/2 Power, Total PV DC, Efficiency, pvPower, battPower).
- **`localComponent/poller/internal/modbus/link.go`** — raw Modbus TCP client (built on `net.TCPConn`, with keepalive + real per-request deadlines + reconnect FSM + heartbeat).
- **`localComponent/src/forwarder.js`** — Node forwarder that reshapes `/snapshot` into the backend `POST /api/ingestion/inverter` payload.

See `localComponent/README.md` for the full two-process architecture, the HTTP contract, deployment, and the battery sign/multiplier conventions.

### Running it

```bash
./deploy-local.sh                    # builds + deploys both poller + forwarder to the Pi
# or, locally for testing:
go run ./localComponent/poller/cmd/huawei-poller -scan     # probe slave IDs and exit
LINK_DISABLED=1 ./localComponent/poller/bin/huawei-poller-darwin  # observe-only HTTP server
```

### Key implementation details

1. **Heartbeat + keepalive**: the poller reads register `30070` at the start of each inverter cycle; on failure it reconnects with exponential backoff. TCP keepalive (~15s) detects dead WiFi sockets.
2. **Per-cadence block reads**: inverter blocks (~15s cadence) and the meter block (~3s cadence, master only). Blocks are 20–90 registers covering only known valid ranges — no gap-scanning, no exception-2 aborts.
3. **32-bit parsing**: Active Power (32080–32081) and Meter Active Power (37113–37114) are `int32` combining high+low words.
4. **Per-unit filtering**: Slave (unit 2) polls only the inverter block; battery + meter + power-limit blocks are master-only.
5. **Power-limit fix**: block `40100–40129` is now polled (the old `MASTER_BLOCKS` list omitted it, so `40118` was always null). `gridPwrLimit` is now actually populated.
6. **Per-field staleness**: a failed block read leaves the previous value in `/snapshot` with an increasing `ageMs`; the forwarder sends `null` for fields older than `MAX_AGE_MS` instead of discarding the whole reading.
7. **Battery topology**: the battery is on Master (unit 1); live telemetry at 37000–37007, configuration at 47000–47499. Slave has no battery data. Sign/multiplier shaping for the backend payload is controlled in the forwarder via `BATTERY_CURRENT_NEGATE` and `BATTERY_POWER_MULTIPLIER` (see README).
