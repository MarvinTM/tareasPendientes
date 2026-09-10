import { useState, useEffect, useCallback } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DateRangeIcon from '@mui/icons-material/DateRange';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SpeedIcon from '@mui/icons-material/Speed';
import WaterIcon from '@mui/icons-material/Water';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { currentMonthRows, formatLitres, formatRate, lastDays, totalLitres } from '../utils/flow';

const COLORS = {
  litres: '#0288d1',
  rate: '#f9a825',
};

const REFRESH_MS = 30000;

function MetricCard({ icon, label, value, secondary }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
          {icon}
          <Typography variant="body2" color="text.secondary" noWrap>{label}</Typography>
        </Box>
        <Typography variant="h6" fontWeight="bold">{value}</Typography>
        {secondary && <Typography variant="caption" color="text.secondary">{secondary}</Typography>}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message }) {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" height={280}>
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}

function HistoryChart({ data }) {
  if (!data || data.length === 0) {
    return <EmptyChart message="No hay lecturas del caudalímetro todavía" />;
  }

  const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={fmtTime} fontSize={11} interval={Math.max(0, Math.floor(data.length / 8))} />
        <YAxis yAxisId="litres" fontSize={11} width={50} tickFormatter={v => `${v} L`} />
        <YAxis yAxisId="rate" orientation="right" fontSize={11} width={50} tickFormatter={v => `${v}`} />
        <Tooltip
          labelFormatter={fmtTime}
          formatter={(v, name) => [
            v == null ? '— (sin lectura)' : name === 'Caudal' ? `${v} L/min` : `${v} L`,
            name,
          ]}
        />
        <Legend />
        <Bar yAxisId="litres" dataKey="litres" name="Litros" fill={COLORS.litres} />
        <Line
          yAxisId="rate"
          type="monotone"
          dataKey="avgRateLpm"
          name="Caudal"
          stroke={COLORS.rate}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function DailyChart({ data }) {
  if (!data || data.length === 0) {
    return <EmptyChart message="No hay lecturas del caudalímetro todavía" />;
  }

  const fmtDay = (d) => (typeof d === 'string' ? d.slice(8, 10) + '/' + d.slice(5, 7) : '');

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={fmtDay} fontSize={11} interval={Math.max(0, Math.floor(data.length / 10))} />
        <YAxis fontSize={11} width={50} tickFormatter={v => `${v} L`} />
        <Tooltip
          labelFormatter={fmtDay}
          formatter={(v) => [v == null ? '— (sin lectura)' : `${v} L`, 'Litros']}
        />
        <Bar dataKey="litres" name="Litros" fill={COLORS.litres} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AguaPage() {
  const socket = useSocket();
  const [sensors, setSensors] = useState([]);
  const [sensorId, setSensorId] = useState(null);
  const [history, setHistory] = useState([]);
  const [daily, setDaily] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSensors = useCallback(async () => {
    try {
      const response = await api.get('/flow/sensors');
      const data = Array.isArray(response.data) ? response.data : [];
      setSensors(data);
      setSensorId(previous => (previous && data.some(s => s.id === previous) ? previous : data[0]?.id ?? null));
      setError(null);
      return data;
    } catch {
      setError('No se pudieron cargar los sensores de agua');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSeries = useCallback(async (id) => {
    if (!id) {
      setHistory([]);
      setDaily([]);
      return;
    }
    try {
      const [historyRes, dailyRes] = await Promise.all([
        api.get(`/flow/${id}/history?range=24h`),
        api.get(`/flow/${id}/daily?days=30`),
      ]);
      if (Array.isArray(historyRes.data)) setHistory(historyRes.data);
      if (Array.isArray(dailyRes.data)) setDaily(dailyRes.data);
    } catch {
      setError('No se pudo cargar el histórico del caudalímetro');
    }
  }, []);

  useEffect(() => { fetchSensors(); }, [fetchSensors]);

  useEffect(() => { fetchSeries(sensorId); }, [fetchSeries, sensorId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchSensors();
      fetchSeries(sensorId);
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchSensors, fetchSeries, sensorId]);

  // Live rate and today's total come straight from the ingestion event, so the
  // header stays current between the 30 s history refreshes.
  useEffect(() => {
    if (!socket) return undefined;

    const handleFlowData = (summaries) => {
      if (!Array.isArray(summaries) || summaries.length === 0) return;
      setSensors(previous => previous.map(sensor => {
        const update = summaries.find(s => s.sensorId === sensor.id);
        if (!update) return sensor;
        return {
          ...sensor,
          online: update.online ?? sensor.online,
          rateLpm: update.rateLpm ?? null,
          todayLitres: update.todayLitres ?? sensor.todayLitres,
          lastReadingAt: update.lastReadingAt ?? sensor.lastReadingAt,
        };
      }));
    };

    socket.on('flow:data', handleFlowData);
    return () => socket.off('flow:data', handleFlowData);
  }, [socket]);

  const sensor = sensors.find(s => s.id === sensorId) || null;
  const weekLitres = totalLitres(lastDays(daily, 7));
  const monthLitres = totalLitres(currentMonthRows(daily));
  const lastReading = sensor?.lastReadingAt ? new Date(sensor.lastReadingAt).toLocaleString() : null;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, pb: { xs: 2, md: 0 } }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} mb={2}>
        <Typography variant="h4" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WaterIcon color="primary" /> Agua
        </Typography>
        {sensor && (
          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Chip
              size="small"
              color={sensor.online ? 'success' : 'warning'}
              variant={sensor.online ? 'filled' : 'outlined'}
              label={sensor.online ? 'En línea' : 'Sin conexión'}
            />
            {lastReading && (
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ScheduleIcon fontSize="small" />
                {lastReading}
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {!sensor && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No hay caudalímetros configurados.
          </Typography>
        </Card>
      )}

      {sensor && (
        <>
          {sensors.length > 1 && (
            <FormControl size="small" sx={{ mb: 2, minWidth: 220 }}>
              <Select value={sensorId} onChange={(e) => setSensorId(e.target.value)}>
                {sensors.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Typography variant="h6" gutterBottom>{sensor.name}</Typography>
          {sensor.room && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{sensor.room}</Typography>
          )}

          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <MetricCard
                icon={<SpeedIcon sx={{ color: COLORS.rate }} />}
                label="Caudal actual"
                value={formatRate(sensor.online ? sensor.rateLpm : null)}
                secondary={sensor.online ? undefined : 'Sin conexión'}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                icon={<WaterIcon sx={{ color: COLORS.litres }} />}
                label="Hoy"
                value={formatLitres(sensor.todayLitres)}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                icon={<DateRangeIcon sx={{ color: COLORS.litres }} />}
                label="Últimos 7 días"
                value={formatLitres(weekLitres)}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricCard
                icon={<CalendarMonthIcon sx={{ color: COLORS.litres }} />}
                label="Este mes"
                value={formatLitres(monthLitres)}
              />
            </Grid>
          </Grid>

          <Typography variant="h6" sx={{ mb: 1 }}>Últimas 24 horas</Typography>
          <HistoryChart data={history} />

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Últimos 30 días</Typography>
          <DailyChart data={daily} />
        </>
      )}
    </Box>
  );
}
