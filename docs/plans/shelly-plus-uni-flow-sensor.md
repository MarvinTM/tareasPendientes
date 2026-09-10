# Plan: Shelly Plus Uni + caudalímetro (agua de entrada al depósito)

Estado: **implementado** (2026-09-10). Fases A–E completas en código y tests; queda el bloque 1 (hardware, sección 9) y el despliegue de la sección 8.

Resumen de lo entregado:

| Fase | Estado | Ficheros principales |
|---|---|---|
| A — tipo `sensor` | ✅ | `services/shelly.js` (`kind`, `getSensorDevice`, `getSensorDevices`, guardas en toggle/pulse/on/off), `routes/devices.js`, `routes/deviceActivation.js`, `services/deviceScheduler.js`, `config/shelly.example.json`, `localComponent/shelly.example.json` |
| B — ingesta | ✅ | `localComponent/src/shellyForwarder.js` (`Input.GetStatus` + POST `/flow`), `routes/ingestion.js`, `services/flowIngestion.js`, `services/flowStatus.js`, `prisma/schema.prisma` (`FlowReading`), `socket.js` (`emitFlowData`) |
| C — API de lectura | ✅ | `routes/flow.js` (`/sensors`, `/:id/history`, `/:id/daily`) |
| D — frontend | ✅ | `pages/AguaPage.jsx`, `components/FlowSensorCard.jsx`, `utils/flow.js`, cambios en `DevicesPage.jsx`, `PortadaPage.jsx`, `config/modules.js`, `utils/iconMap.js`, `App.jsx` |
| E — documentación | ✅ | `README.md`, `docs/technical/architecture.md`, `docs/technical/api-reference.md`, `docs/diagrams/system-overview.md`, `docs/diagrams/database.md`, `localComponent/README.md`, `localComponent/.env.example` |

Desviaciones respecto a la propuesta:

- El resumen del sensor viaja en `/api/devices` bajo `sensorStatus` (no `sensor`), para no colisionar con `sensor`, que es la configuración declarada (calibración, entrada).
- `flowStatus.js` es caché puramente en memoria, sin acceso a BD, igual que `shellyLocalStatus.js`. Tras reiniciar el backend el sensor aparece "sin conexión" durante un ciclo de sondeo en `/api/devices`; `/api/flow/*` lee de BD y no se ve afectado.
- `SHELLY_FLOW_POLL_EVERY_N_TICKS` por defecto `3` (30 s con el tick de 10 s de los relés), en lugar de un intervalo propio.
- Ninguna entrada nueva en `backend/config/shelly.json` ni `localComponent/shelly.json`: están en `.gitignore` y se editan en cada despliegue (sección 8, pasos 2 y 3). Los ejemplos sí incluyen el sensor.

## 1. Objetivo

Instalar un **Shelly Plus Uni** conectado a un **sensor de caudal de pulsos** en la tubería que llena el depósito principal, y que la aplicación:

1. Declare este nuevo tipo de dispositivo (un *sensor*, no un relé).
2. Reciba los pulsos en el backend, los consolide y los guarde en PostgreSQL.
3. Muestre en el frontend el caudal actual, los litros acumulados de hoy y el histórico.

## 2. Cómo expone el dato el Shelly Plus Uni

- El Plus Uni (Gen2) tiene `input:0`, `input:1` (digitales) y `input:2`, que es la **entrada contadora**. Con `type: "count"` el firmware cuenta pulsos por hardware.
- `GET http://<ip>/rpc/Input.GetStatus?id=2` devuelve, en modo `count`:
  - `counts.total`: pulsos acumulados (contador monótono; puede reiniciarse a 0 tras un reboot o un `Input.ResetCounters`).
  - `counts.by_minute`: pulsos de los últimos 3 minutos completos.
  - `counts.minute_ts`: inicio (UTC) del minuto en curso.
  - `freq`: frecuencia medida en Hz (calculada cada `freq_window` segundos) → caudal instantáneo.
  - `xtotal` / `xfreq`: valores transformados si se configura una expresión en el dispositivo. **No los usaremos**: la calibración vive en nuestra config, así el dato crudo en BD no depende del firmware.
- Configuración necesaria en el dispositivo (UI web o RPC `Input.SetConfig`):
  `{ "id": 2, "config": { "type": "count", "enable": true, "freq_window": 10 } }`.
- Calibración: los sensores de efecto Hall típicos dan entre ~1 y ~660 pulsos/litro según modelo (YF‑S201 ≈ 450 p/L, YF‑B* ≈ 660 p/L, contadores industriales 1–10 p/L). Se mide llenando un volumen conocido (p. ej. cubo de 20 L) y anotando `counts.total` antes y después. Ese factor se guarda como `pulsesPerLitre` en la config.

Decisión: **sondeo por LAN desde la Raspberry Pi** (mismo patrón que `local-shelly-forwarder`), no webhooks del Shelly hacia el backend público. Motivos: no hay que poner el API key en el dispositivo, no depende de que el Shelly salga a internet, y encaja con la infraestructura de forwarders que ya existe y ya se despliega con `deploy-local.sh`.

## 3. Diseño de datos

### 3.1 Qué guardar

Una fila por sondeo (cada 15–30 s), con el dato crudo y el delta ya calculado para que las agregaciones sean un `SUM`:

```prisma
model FlowReading {
  id            String   @id @default(uuid())
  sensorId      String                    // id del dispositivo en shelly.json, p. ej. "caudal-deposito"
  timestamp     DateTime @default(now())
  pulsesTotal   Int                       // counts.total tal cual lo reporta el Shelly
  pulsesDelta   Int                       // pulsos desde la lectura anterior (>= 0)
  freqHz        Float?                    // freq del Shelly, null si no disponible
  counterReset  Boolean  @default(false)  // true si total < total anterior (reboot / reset)
  online        Boolean  @default(true)

  @@index([sensorId, timestamp])
  @@index([timestamp])
}
```

- `Int` de Prisma es de 32 bits (≈2,1·10⁹). A 450 p/L y 500 L/día son ~80 M pulsos/año, así que sobra durante décadas. Si se prefiere blindarlo, usar `BigInt`.
- Los litros **no** se guardan: se derivan en la API con `pulsesDelta / pulsesPerLitre`. Si se recalibra el sensor, el histórico se recalcula solo.
- Volumen: a un sondeo cada 30 s son ~2.900 filas/día, ~1 M/año. Inferior a `InverterReading` (que ya guarda cada 5 s). No hace falta rollup en esta fase; se deja anotado como mejora futura (tabla diaria + purga de crudos > 90 días).

### 3.2 Cálculo del delta (en el backend, al ingerir)

```
prev = última lectura del sensor (caché en memoria; si no hay, consulta a BD)
if prev == null            → delta = 0, reset = false   (primera lectura)
elif total >= prev.total   → delta = total - prev.total
else                       → delta = total, reset = true  (el contador arrancó de 0)
```

Guardas: si `delta / segundosTranscurridos` supera un máximo físico configurable (`maxLitresPerMinute`, p. ej. 200 L/min), se registra `delta = 0` y se loguea como lectura sospechosa. Es el mismo criterio de "plausibilidad" que ya aplica `forwarder.js` a los datos del inversor.

## 4. Fase A — Declarar el nuevo tipo de dispositivo

### 4.1 `backend/config/shelly.json` (y `shelly.example.json`)

Hoy los dispositivos se distinguen por `controlMode: "toggle" | "pulse"`. Un sensor no tiene control, así que se introduce un campo ortogonal `kind`:

```json
{
  "groups": [
    { "id": "lights", "name": "Luces", "icon": "Lightbulb" },
    { "id": "pool",   "name": "Piscina", "icon": "Pool" },
    { "id": "water",  "name": "Agua",    "icon": "Water" }
  ],
  "devices": [
    {
      "id": "caudal-deposito",
      "shellyId": "<id del Plus Uni>",
      "name": "Entrada de agua al depósito",
      "room": "Depósito",
      "group": "water",
      "kind": "sensor",
      "sensor": {
        "type": "flow",
        "input": 2,
        "pulsesPerLitre": 450,
        "maxLitresPerMinute": 200
      },
      "showOnHome": true
    }
  ]
}
```

- `kind` por defecto `"relay"` (retrocompatible con todo lo existente).
- `controlMode` se ignora cuando `kind === "sensor"`.

### 4.2 `backend/src/services/shelly.js`

- `getDevices()`: devolver también `kind` y `sensor` (sin exponer nada secreto).
- `getDeviceById()`: idem.
- `_doFetchAllStatuses()`: para `kind === "sensor"` **no** mirar relés. Devolver `{ ...device, online, source, sensor: { rateLpm, todayLitres, lastReadingAt } }` a partir del último `FlowReading` (un pequeño servicio `flowStatus.js` con caché en memoria, análogo a `shellyLocalStatus.js`).
- `toggleDevice`, `pulseDevice`, `turnDeviceOn/Off`: lanzar error si el dispositivo es sensor.

### 4.3 Rutas y servicios que deben rechazar sensores

- `routes/devices.js`: `/:deviceId/toggle` y `/:deviceId/pulse` → 400 si `kind === "sensor"`.
- `routes/deviceActivation.js:217` y `services/deviceScheduler.js:87`: extender la comprobación de `pulse` a `kind === "sensor"` (no pueden tener plan de activación).

### 4.4 `localComponent/shelly.example.json`

Nueva forma de entrada para sensores (los relés siguen igual):

```json
{
  "shellyId": "<id del Plus Uni>",
  "ip": "192.168.1.1xx",
  "name": "Caudal depósito",
  "inputs": [{ "id": 2, "type": "count" }]
}
```

### 4.5 Tests

- `services/shelly.test.js`: `getDevices()` expone `kind`/`sensor`; `toggleDevice` falla con sensor; `fetchAllStatuses` no consulta relés para sensores.
- `routes/devices.test.js`: toggle/pulse sobre sensor → 400.
- `routes/deviceActivation.test.js`: asignar plan a sensor → 400.

## 5. Fase B — Recibir y almacenar los datos

### 5.1 Raspberry Pi: `localComponent/src/shellyForwarder.js`

- En cada `tick`, además de `Switch.GetStatus` por canal, para cada dispositivo con `inputs` llamar a `GET /rpc/Input.GetStatus?id=<n>` (mismo timeout y misma tolerancia a fallos que ahora).
- Enviar un **segundo POST** a `/api/ingestion/flow` con:

```json
{
  "timestamp": "2026-09-10T10:00:00.000Z",
  "sensors": [
    {
      "shellyId": "<id>",
      "input": 2,
      "online": true,
      "counts": { "total": 123456, "by_minute": [12, 15, 14], "minute_ts": 1757498400 },
      "freq": 3.2
    }
  ]
}
```

- Un dispositivo inalcanzable se envía con `online: false` y sin `counts`, para que el backend pueda marcarlo como "sin conexión" en lugar de simplemente no saber nada.
- Nueva variable `SHELLY_FLOW_BACKEND_PATH` (default `/api/ingestion/flow`) en `.env.example`. Se reutiliza `API_KEY`, `BACKEND_URL` y el mismo `postToBackend` con reintentos.
- No hace falta un nuevo proceso PM2: sigue siendo `local-shelly-forwarder`. Si se quiere una cadencia distinta para el caudal (p. ej. 30 s frente a 10 s de los relés), añadir `SHELLY_FLOW_POLL_EVERY_N_TICKS`.

### 5.2 Backend: `POST /api/ingestion/flow`

En `routes/ingestion.js`, protegido con `apiKeyAuth`:

1. Validar `sensors` (array no vacío).
2. Cargar config con `loadConfig()`; para cada entrada resolver el dispositivo por `shellyId` + `sensor.input`. Entradas sin dispositivo declarado se ignoran con un `warn`.
3. Delegar en `services/flowIngestion.js`:
   - calcular `pulsesDelta`/`counterReset` (sección 3.2),
   - `prisma.flowReading.create(...)`,
   - actualizar la caché de estado (`flowStatus.js`) con `lastTotal`, `lastReadingAt`, `online`, `freqHz`,
   - devolver el resumen `{ sensorId, rateLpm, todayLitres, lastReadingAt, online }`.
4. `emitFlowData(summaries)` → evento Socket.IO `flow:data` (nuevo helper en `socket.js`).
5. Responder `201 { stored: n }`.

`rateLpm` se calcula como `freqHz * 60 / pulsesPerLitre` si `freq` viene; si no, `pulsesDelta / pulsesPerLitre / minutosTranscurridos`.

### 5.3 Prisma

- Añadir `FlowReading` (sección 3.1) en `schema.prisma`.
- Despliegue: `npm run db:generate && npm run db:push` (el proyecto no usa migraciones versionadas; mantener el mismo procedimiento que en el README).

### 5.4 Tests

- `routes/ingestion.test.js`: 401 sin key; 400 sin `sensors`; primera lectura → delta 0; segunda lectura → delta correcto; total menor → `counterReset` y delta = total; `online:false` guarda fila con `online:false` y `pulsesDelta: 0`; se emite `flow:data`.
- `services/flowIngestion.test.js`: descarte por `maxLitresPerMinute`.

## 6. Fase C — API de lectura para el frontend

Nuevo router `routes/flow.js` montado en `/api/flow`, con `authenticateToken`:

| Endpoint | Devuelve |
|---|---|
| `GET /api/flow/sensors` | Lista de sensores declarados con su estado actual: `{ id, name, room, online, rateLpm, todayLitres, lastReadingAt, pulsesPerLitre }`. |
| `GET /api/flow/:sensorId/history?range=24h\|7d\|30d` | Litros por intervalo (5 min para 24h, 1 h para 7d, 1 día para 30d) usando `date_trunc` + `SUM(pulsesDelta)/pulsesPerLitre`, mismo estilo que `/api/ingestion/today`. Incluye `avgRateLpm` por intervalo. |
| `GET /api/flow/:sensorId/daily?days=30` | Litros por día natural (`Europe/Madrid`) para el gráfico de barras y el total del mes. |

Los intervalos sin lecturas devuelven `null` (no `0`), igual que hace hoy el gráfico solar para evitar "picos a cero" falsos.

## 7. Fase D — Frontend

### 7.1 Navegación

- Nuevo módulo en `frontend/src/config/modules.js`: `{ id: 'agua', label: 'Agua', icon: WaterIcon, path: '/agua', subNav: [{ label: 'Depósito', path: '/agua' }] }`. (Alternativa más barata: una pestaña "Depósito" dentro del módulo Riego; se propone módulo propio porque el agua de entrada no es riego y la sección crecerá si se añaden más sensores.)
- Ruta `agua` → `pages/AguaPage.jsx` en `App.jsx`.
- Añadir `Water` a `utils/iconMap.js` para el icono del grupo.

### 7.2 `AguaPage.jsx`

Sigue la estructura de `SolarPage.jsx` (carga inicial, refresco cada 30 s, suscripción a socket):

1. Cabecera con estado: chip "En línea / Sin conexión" y hora de la última lectura.
2. Tarjetas de métricas: **Caudal actual** (L/min), **Hoy** (litros), **Últimos 7 días**, **Este mes**.
3. Gráfico de las últimas 24 h (Recharts `BarChart`, litros por 5 min, con eje secundario opcional de L/min).
4. Gráfico de barras de 30 días (litros/día).
5. Al recibir `flow:data` por socket, actualizar caudal actual y litros de hoy sin refetch; el histórico se refresca en el intervalo.
6. Estados vacío/error en español, consistentes con el resto de páginas ("No hay lecturas del caudalímetro todavía").

### 7.3 `DevicesPage.jsx`

Los dispositivos con `kind === "sensor"` se pintan en su grupo como **tarjeta de solo lectura**: icono, nombre, sala, indicador de origen (verde local, como ahora), y en lugar de `Switch`/`Select` el valor `X L/min · Y L hoy` con un enlace a `/agua`. Sin plan de activación.

### 7.4 `PortadaPage.jsx`

- Nuevo componente `FlowSensorCard` (misma familia que `DeviceShortcutButton`), usado cuando `device.kind === 'sensor'` y `showOnHome`. Muestra caudal actual y litros de hoy; al pulsar navega a `/agua`.
- Suscripción a `flow:data` para mantenerlo vivo.

### 7.5 Tests

- `__tests__/pages/AguaPage.test.jsx`: render con datos, sin datos, actualización por socket.
- `__tests__/pages/DevicesPage.test.jsx`: un sensor no muestra `Switch` ni selector de plan.
- `__tests__/pages/PortadaPage.test.jsx`: sensor destacado se muestra con su valor.

## 8. Fase E — Documentación y despliegue

- README: ampliar "Shelly device behavior" con `kind: "sensor"` y los campos de `sensor`.
- `docs/technical/architecture.md`, `docs/diagrams/system-overview.md` y `docs/diagrams/database.md`: añadir el Plus Uni, el POST `/api/ingestion/flow` y la tabla `FlowReading`.
- `docs/technical/api-reference.md`: documentar `/api/ingestion/flow` y `/api/flow/*`.
- `localComponent/README.md`: sección "Sensores de pulsos".
- Despliegue, en este orden: (1) backend con `db:push`, (2) editar `backend/config/shelly.json` en el servidor, (3) editar `localComponent/shelly.json` en la Pi y `./deploy-local.sh`, (4) frontend. El backend debe ir antes que la Pi para que el nuevo POST no devuelva 404 (el forwarder reintentaría pero llenaría logs).

## 9. Preparación del hardware (fuera del código, pero bloqueante)

1. Alimentar el Plus Uni y darle IP fija (reserva DHCP) en la LAN de la Pi.
2. Conectar el sensor a la entrada contadora (`input:2`). Verificar que el nivel de salida del sensor es compatible con la entrada del Uni (muchos sensores Hall son 5 V con salida en colector abierto → puede hacer falta resistencia de pull-up). Revisar la ficha del sensor y la del Uni antes de cablear.
3. Configurar `input:2` como `count` (sección 2) y comprobar con `curl http://<ip>/rpc/Input.GetStatus?id=2` que `counts.total` sube al pasar agua.
4. Calibrar `pulsesPerLitre` con un volumen conocido.
5. Actualizar el firmware del Uni antes de empezar (los campos `by_minute`/`freq` dependen de versiones recientes).

## 10. Orden de trabajo y estimación

| # | Bloque | Depende de | Tamaño |
|---|---|---|---|
| 1 | Hardware + config del Shelly + calibración (sección 9) | — | 1–2 h en sitio |
| 2 | Fase A: declarar tipo `sensor` en config/servicio/rutas + tests | — | S |
| 3 | Fase B: forwarder en la Pi + `POST /ingestion/flow` + Prisma + tests | 2 | M |
| 4 | Fase C: `/api/flow/*` + tests | 3 | S |
| 5 | Fase D: AguaPage, tarjetas en Dispositivos y Portada + tests | 2, 4 | M |
| 6 | Fase E: docs + despliegue | 3, 5 | S |

Los bloques 2, 3 y 4 se pueden implementar y probar sin el hardware, simulando el POST con `curl`. El bloque 5 se puede maquetar con datos de prueba y validar de verdad cuando el sensor esté instalado.

## 11. Decisiones abiertas

- **Nombre y ubicación del módulo**: "Agua / Depósito" como módulo propio (propuesto) frente a una pestaña dentro de Riego.
- **Cadencia de sondeo del caudal**: 30 s propuesta. Bajar a 10 s da más resolución en el gráfico de 24 h a cambio de 3× filas.
- **Retención**: sin purga en esta fase. Revisar cuando `FlowReading` supere ~5 M filas.
- **Alertas** (fuera de alcance): "no ha entrado agua en N horas" o "caudal continuo > X min" (posible fuga) encajarían más adelante sobre la misma tabla, con notificación por email usando `services/email.js`.
