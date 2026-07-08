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
  house: '#e53935',
  battery: '#43a047',
  grid: '#1565c0',
  gridImport: '#ef6c00',
};

// ── System Diagram ──────────────────────────────────────────────
function SystemDiagram({ master: m, slave: s }) {
  const master = m || {};
  const slave = s || {};

  const solarProd = Math.round((master.pvPower || 0) + (slave.pvPower || 0));
  const totalAc = (master.activePower || 0) + (slave.activePower || 0);
  const meterPower = master.meterPower != null ? master.meterPower : null;
  const houseLoad = meterPower != null ? totalAc - meterPower : null;
  const battPower = master.battPower != null ? master.battPower : null;
  const battSoc = master.battSoc != null ? master.battSoc : null;
  const maxPower = 8000;

  const arrow = (visible, color, x1, y1, x2, y2, power, label) => {
    if (!visible) return null;
    const opacity = Math.min(1, Math.max(0.15, 0.25 + Math.abs(power) / maxPower * 0.75));
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return (
      <g key={label} opacity={opacity}>
        <defs>
          <marker id={`arrow-${label}`} viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill={color} />
          </marker>
        </defs>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} markerEnd={`url(#arrow-${label})`} />
        <rect x={midX - 30} y={midY - 10} width={60} height={16} rx={3} fill="rgba(255,255,255,0.85)" />
        <text x={midX} y={midY + 2} textAnchor="middle" fontSize={10} fill={color}>
          {Math.round(Math.abs(power)).toLocaleString()} W
        </text>
      </g>
    );
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4/3', maxHeight: 380 }}>
      <svg viewBox="0 0 600 400" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {/* Solar → House */}
        {arrow(solarProd > 0, COLORS.solar, 300, 85, 470, 185, solarProd, 'sh')}
        {/* Solar → Battery (charging) */}
        {arrow(battPower != null && battPower < -10, COLORS.battery, 280, 85, 150, 190, battPower || 0, 'sb')}
        {/* Solar → Grid (exporting) */}
        {arrow(meterPower != null && meterPower < -10, COLORS.grid, 300, 85, 280, 340, meterPower || 0, 'sg')}
        {/* Battery → House (discharging) */}
        {arrow(battPower != null && battPower > 10, COLORS.house, 150, 220, 420, 215, battPower || 0, 'bh')}
        {/* Grid → House (importing) */}
        {arrow(meterPower != null && meterPower > 10, COLORS.gridImport, 310, 315, 460, 220, meterPower || 0, 'gh')}
      </svg>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr 1fr', height: '100%', gap: 1, p: 1 }}>
        {/* Row 1: Solar (col 2) */}
        <Box sx={{ gridRow: 1, gridColumn: 2, display: 'flex' }}>
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <CardContent sx={{ textAlign: 'center', py: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}>
              <BatteryChargingFullIcon sx={{ color: COLORS.battery, fontSize: { xs: 24, sm: 32 } }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Batería</Typography>
              <Typography variant="h6" fontWeight="bold" color={battPower != null && battPower > 0 ? 'error.main' : 'success.main'} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {battPower != null
                  ? `${battPower > 0 ? '+' : ''}${Math.round(Math.abs(battPower)).toLocaleString()}`
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
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
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
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <CardContent sx={{ textAlign: 'center', py: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}>
              <PowerIcon sx={{ color: meterPower != null ? (meterPower > 0 ? COLORS.gridImport : COLORS.grid) : 'text.secondary', fontSize: { xs: 24, sm: 32 } }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>Red</Typography>
              <Typography variant="h6" fontWeight="bold" color={meterPower != null ? (meterPower > 0 ? 'warning.main' : 'info.main') : 'text.primary'} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                {meterPower != null ? Math.abs(meterPower).toLocaleString() : '—'} <Typography component="span" variant="caption">W</Typography>
              </Typography>
              <Typography variant="caption" color={meterPower != null ? (meterPower > 0 ? 'warning.main' : 'info.main') : 'text.secondary'} sx={{ display: 'block' }}>
                {meterPower != null ? (meterPower > 0 ? 'Importando' : 'Exportando') : ''}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
}

// ── Daily Chart ──────────────────────────────────────────────────

function DailyChart({ data }) {
  if (!data || data.length === 0) {
    return <Box display="flex" justifyContent="center" alignItems="center" height={350}><CircularProgress size={30} /></Box>;
  }

  const fmtTime = (t) => {
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={fmtTime} fontSize={11} interval={Math.max(0, Math.floor(data.length / 8))} />
        <YAxis tickFormatter={v => `${(v / 1000).toFixed(1)}kW`} fontSize={11} width={50} />
        <Tooltip labelFormatter={fmtTime} formatter={(v, name) => [`${v?.toLocaleString()} W`, name]} />
        <Legend />
        <Line type="monotone" dataKey="solarProduction" name="Solar" stroke={COLORS.solar} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="houseConsumption" name="Casa" stroke={COLORS.house} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="batteryPower" name="Batería" stroke={COLORS.battery} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="gridPower" name="Red" stroke={COLORS.grid} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Daily Table ──────────────────────────────────────────────────

function DailyTable({ data, loadMoreRef, pageSize }) {
  if (!data || data.length === 0) return null;

  const visibleRows = data.slice(0, pageSize).reverse();
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
                <Typography component="span" variant="body2" color={row.batteryPower >= 0 ? 'error.main' : 'success.main'}>
                  {row.batteryPower != null ? `${row.batteryPower > 0 ? '+' : ''}${row.batteryPower.toLocaleString()}` : '—'}
                </Typography>
              </TableCell>
              <TableCell align="right">{row.batterySoc != null ? row.batterySoc.toFixed(1) : '—'}</TableCell>
              <TableCell align="right">
                <Typography component="span" variant="body2" color={row.gridPower > 0 ? 'warning.main' : 'info.main'}>
                  {row.gridPower != null ? `${row.gridPower.toLocaleString()} ${row.gridPower > 0 ? 'imp' : 'exp'}` : '—'}
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
  const [todayData, setTodayData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(50);
  const [lastUpdate, setLastUpdate] = useState(null);
  const loadMoreRef = useRef(null);

  // Fetch today's aggregated data
  const fetchToday = useCallback(async () => {
    try {
      const res = await api.get('/ingestion/today');
      if (Array.isArray(res.data)) setTodayData(res.data);
    } catch (e) {
      // socket will provide live data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  // Socket for live data
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (!Array.isArray(data) || data.length === 0) return;
      setLatest({
        master: data.find(r => r.inverterId === 'master') || {},
        slave:  data.find(r => r.inverterId === 'slave')  || {},
      });
      setLastUpdate(new Date().toISOString());
      setLoading(false);
    };
    socket.on('inverter:data', handler);
    return () => socket.off('inverter:data', handler);
  }, [socket]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setPageSize(p => Math.min(p + 50, todayData.length)); },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [todayData.length]);

  const { master, slave } = latest;

  if (loading && todayData.length === 0) {
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
          <SystemDiagram master={master} slave={slave} />
        </Grid>
        <Grid item md={6} xs={12}>
          <Typography variant="h6" gutterBottom>Últimas 24 horas</Typography>
          <DailyChart data={todayData} />
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Datos (Últimas 24 horas)</Typography>
      <DailyTable data={todayData} loadMoreRef={loadMoreRef} pageSize={pageSize} />
    </Box>
  );
}
