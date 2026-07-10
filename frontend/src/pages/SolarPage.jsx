import { useState, useEffect, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import HomeIcon from '@mui/icons-material/Home';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import PowerIcon from '@mui/icons-material/Power';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

const COLORS = {
  solar: '#f9a825',
  house: '#1565c0',
  battery: '#43a047',
  grid: '#e53935',
  gridImport: '#ef6c00',
  gridExport: '#00897b',
};

// ── System Diagram ──────────────────────────────────────────────
function SystemDiagram({ master: m, slave: s, visibility, onToggle }) {
  const master = m || {};
  const slave = s || {};

  const solarProd = Math.round((master.pvPower || 0) + (slave.pvPower || 0));
  const meterPower = master.meterPower != null ? master.meterPower : null;
  const battPower = master.battPower != null ? master.battPower : null;
  const battSoc = master.battSoc != null ? master.battSoc : null;
  const houseLoad = meterPower != null
    ? Math.max(0, Math.round(solarProd + (battPower || 0) - (meterPower || 0)))
    : null;

  const maxPower = 8000;
  const fill = (value, max) => Math.min(100, ((value || 0) / max) * 100);
  const gradient = (color, pct) => `linear-gradient(to top, ${color}40 0%, ${color}40 ${pct}%, transparent ${pct}%)`;

  const solarFill = gradient(COLORS.solar, fill(solarProd, maxPower));
  const houseFill = gradient(COLORS.house, fill(houseLoad, maxPower));
  const battFill = gradient(COLORS.battery, battSoc || 0);
  const gridColor = meterPower != null && meterPower < 0 ? COLORS.gridImport : COLORS.gridExport;
  const gridFill = gradient(gridColor, fill(Math.abs(meterPower || 0), maxPower));

  return (
    <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4/3', maxHeight: 380 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', height: '100%', gap: 1, p: 1 }}>
        {/* Row 1: Solar (col 2) */}
        <Box sx={{ gridRow: 1, gridColumn: 2, display: 'flex' }}>
          <Card
            onClick={() => onToggle('solar')}
            sx={{
              flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
              cursor: 'pointer', opacity: visibility.solar ? 1 : 0.45, transition: 'opacity 0.2s',
              outline: visibility.solar ? `2px solid ${COLORS.solar}` : 'none',
              background: solarFill,
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}>
              <WbSunnyIcon sx={{ color: COLORS.solar, fontSize: { xs: 24, sm: 32 } }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Solar</Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {solarProd > 0 ? solarProd.toLocaleString() : '—'} <Typography component="span" variant="caption">W</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Row 2: Battery (col 1) */}
        <Box sx={{ gridRow: 2, gridColumn: 1, display: 'flex' }}>
          <Card
            onClick={() => onToggle('battery')}
            sx={{
              flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
              cursor: 'pointer', opacity: visibility.battery ? 1 : 0.45, transition: 'opacity 0.2s',
              outline: visibility.battery ? `2px solid ${COLORS.battery}` : 'none',
              background: battFill,
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}>
              <BatteryChargingFullIcon sx={{ color: COLORS.battery, fontSize: { xs: 24, sm: 32 } }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Batería</Typography>
              <Typography variant="h6" fontWeight="bold" color={battPower != null && battPower > 0 ? 'error.main' : 'success.main'} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {battPower != null
                  ? `${battPower > 0 ? '−' : '+'}${Math.round(Math.abs(battPower)).toLocaleString()}`
                  : '—'} <Typography component="span" variant="caption">W</Typography>
              </Typography>
              {battSoc != null && (
                <Typography variant="caption" sx={{ display: 'block' }}>{battSoc.toFixed(1)}%</Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Row 2: House (col 3) */}
        <Box sx={{ gridRow: 2, gridColumn: 3, display: 'flex' }}>
          <Card
            onClick={() => onToggle('casa')}
            sx={{
              flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
              cursor: 'pointer', opacity: visibility.casa ? 1 : 0.45, transition: 'opacity 0.2s',
              outline: visibility.casa ? `2px solid ${COLORS.house}` : 'none',
              background: houseFill,
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}>
              <HomeIcon sx={{ color: COLORS.house, fontSize: { xs: 24, sm: 32 } }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Casa</Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {houseLoad != null ? houseLoad.toLocaleString() : '—'} <Typography component="span" variant="caption">W</Typography>
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Row 3: Grid (col 2) */}
        <Box sx={{ gridRow: 3, gridColumn: 2, display: 'flex' }}>
          <Card
            onClick={() => onToggle('grid')}
            sx={{
              flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
              cursor: 'pointer', opacity: visibility.grid ? 1 : 0.45, transition: 'opacity 0.2s',
              outline: visibility.grid ? `2px solid ${COLORS.grid}` : 'none',
              background: gridFill,
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}>
              <PowerIcon sx={{ color: meterPower != null ? (meterPower < 0 ? COLORS.gridImport : COLORS.grid) : 'text.secondary', fontSize: { xs: 24, sm: 32 } }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Red</Typography>
              <Typography variant="h6" fontWeight="bold" color={meterPower != null ? (meterPower < 0 ? 'warning.main' : 'info.main') : 'text.primary'} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {meterPower != null ? meterPower.toLocaleString() : '—'} <Typography component="span" variant="caption">W</Typography>
              </Typography>
              <Typography variant="caption" color={meterPower != null ? (meterPower < 0 ? 'warning.main' : 'info.main') : 'text.secondary'} sx={{ display: 'block' }}>
                {meterPower != null ? (meterPower > 0 ? 'Exportando' : 'Importando') : ''}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

// ── Daily Chart ──────────────────────────────────────────────────

function DailyChart({ data, visibility }) {
  if (!data || data.length === 0) {
    return <Box display="flex" justifyContent="center" alignItems="center" height={350}><CircularProgress size={30} /></Box>;
  }

  const fmtTime = (t) => {
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const chartData = data.map(d => ({ ...d, batteryPower: -(d.batteryPower || 0) }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={fmtTime} fontSize={11} interval={Math.max(0, Math.floor(data.length / 8))} />
        <YAxis tickFormatter={v => `${(v / 1000).toFixed(1)}kW`} fontSize={11} width={50} />
        <Tooltip labelFormatter={fmtTime} formatter={(v, name) => [`${v?.toLocaleString()} W`, name]} />
        <Legend />
        {visibility.solar && <Line type="monotone" dataKey="solarProduction" name="Solar" stroke={COLORS.solar} strokeWidth={2} dot={false} />}
        {visibility.casa && <Line type="monotone" dataKey="houseConsumption" name="Casa" stroke={COLORS.house} strokeWidth={2} dot={false} />}
        {visibility.battery && <Line type="monotone" dataKey="batteryPower" name="Batería" stroke={COLORS.battery} strokeWidth={2} dot={false} />}
        {visibility.grid && <Line type="monotone" dataKey="gridPower" name="Red" stroke={COLORS.grid} strokeWidth={2} dot={false} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Daily Table ──────────────────────────────────────────────────

function DailyTable({ data, loadMoreRef, pageSize }) {
  if (!data || data.length === 0) return null;

  const visibleRows = data.slice(0, pageSize);
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <TableContainer component={Paper} sx={{ mt: 3, maxHeight: 520 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 'bold' }}>Hora</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Solar (W)</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Casa (W)</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Batería (W)</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Batería (%)</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Red (W)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow key={row.time} hover>
              <TableCell>{fmtTime(row.time)}</TableCell>
              <TableCell align="right">{row.solarProduction?.toLocaleString() || '—'}</TableCell>
              <TableCell align="right">{row.houseConsumption?.toLocaleString() || '—'}</TableCell>
              <TableCell align="right">
                <Typography component="span" variant="body2" color={row.batteryPower > 0 ? 'error.main' : 'success.main'}>
                  {row.batteryPower != null ? `${row.batteryPower > 0 ? '−' : '+'}${Math.abs(row.batteryPower).toLocaleString()}` : '—'}
                </Typography>
              </TableCell>
              <TableCell align="right">{row.batterySoc != null ? row.batterySoc.toFixed(1) : '—'}</TableCell>
              <TableCell align="right">
                <Typography component="span" variant="body2" color={row.gridPower < 0 ? 'warning.main' : 'info.main'}>
                  {row.gridPower != null ? `${row.gridPower.toLocaleString()} ${row.gridPower > 0 ? 'exp' : 'imp'}` : '—'}
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageSize < data.length && (
        <Box ref={loadMoreRef} display="flex" justifyContent="center" py={1}>
          <CircularProgress size={20} />
        </Box>
      )}
    </TableContainer>
  );
}

// ── Main Page ────────────────────────────────────────────────────

export default function SolarPage() {
  const socket = useSocket();
  const [latest, setLatest] = useState({});
  const [todayData, setTodayData] = useState([]);   // aggregated (5-min) for chart
  const [rawData, setRawData] = useState([]);       // raw individual readings for table
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(50);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lineVisibility, setLineVisibility] = useState({ solar: true, casa: true, battery: true, grid: true });
  const loadMoreRef = useRef(null);

  const toggleLine = (key) => setLineVisibility(prev => ({ ...prev, [key]: !prev[key] }));

  // Fetch today's data (both aggregated for chart + raw for table)
  const fetchData = useCallback(async () => {
    try {
      const [aggRes, rawRes] = await Promise.all([
        api.get('/ingestion/today'),
        api.get('/ingestion/today/raw'),
      ]);
      if (Array.isArray(aggRes.data)) setTodayData(aggRes.data);
      if (Array.isArray(rawRes.data)) setRawData(rawRes.data);
    } catch (e) {
      // socket will provide live data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Socket for live data
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (!Array.isArray(data) || data.length === 0) return;
      const m = data.find(r => r.inverterId === 'master') || {};
      const s = data.find(r => r.inverterId === 'slave')  || {};

      setLatest({ master: m, slave: s });
      setLastUpdate(new Date().toISOString());
      setLoading(false);

      // Prepend new row to table
      const solarProd = (m.pvPower || 0) + (s.pvPower || 0);
      const battPower = m.battPower != null ? m.battPower : 0;
      const meterPower = m.meterPower != null ? m.meterPower : 0;
      const ts = data[0].timestamp || new Date().toISOString();
      const newRow = {
        time: ts,
        solarProduction: Math.round(solarProd),
        houseConsumption: Math.max(0, Math.round(solarProd + battPower - meterPower)),
        batteryPower: battPower,
        batterySoc: m.battSoc != null ? m.battSoc : 0,
        gridPower: meterPower,
      };
      setRawData(prev => {
        // Avoid duplicates with same timestamp
        if (prev.length > 0 && prev[0].time === ts) return prev;
        return [newRow, ...prev];
      });
    };
    socket.on('inverter:data', handler);
    return () => socket.off('inverter:data', handler);
  }, [socket]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setPageSize(p => Math.min(p + 50, rawData.length)); },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [rawData.length]);

  const { master, slave } = latest;

  if (loading && todayData.length === 0 && rawData.length === 0) {
    return (
      <Box display="flex" justifyContent="center" minHeight="50vh" alignItems="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" mb={2}>
        <Typography variant="h4">Paneles Solares</Typography>
        {lastUpdate && (
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ScheduleIcon fontSize="small" />
            {new Date(lastUpdate).toLocaleTimeString()}
          </Typography>
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid item md={6} xs={12}>
          <SystemDiagram master={master} slave={slave} visibility={lineVisibility} onToggle={toggleLine} />
        </Grid>
        <Grid item md={6} xs={12}>
          <Typography variant="h6" gutterBottom>Últimas 24 horas</Typography>
          <DailyChart data={todayData} visibility={lineVisibility} />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Datos (Últimas 24 horas)</Typography>
      <DailyTable data={rawData} loadMoreRef={loadMoreRef} pageSize={pageSize} />
    </Box>
  );
}
