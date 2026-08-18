import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HomeIcon from '@mui/icons-material/Home';
import PowerIcon from '@mui/icons-material/Power';
import SolarPowerIcon from '@mui/icons-material/SolarPower';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import PulseDeviceButton from '../components/PulseDeviceButton';
import DeviceShortcutButton from '../components/DeviceShortcutButton';
import RainAnimation from '../components/RainAnimation';
import { getSolarMetrics, SOLAR_COLORS, formatWatts } from '../utils/solarMetrics';
import { formatRemaining, getRiegoDisplay } from '../utils/riego';

function SectionHeader({ title, icon, onOpen }) {
  return (
    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={1.5}>
      <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon}
        {title}
      </Typography>
      <Button size="small" onClick={onOpen} sx={{ textTransform: 'none', flexShrink: 0 }}>
        Ver detalles
      </Button>
    </Box>
  );
}

function SolarMetricCard({ icon, label, value, color, secondary }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
          {icon}
          <Typography variant="body2" color="text.secondary" noWrap>{label}</Typography>
        </Box>
        <Typography variant="h6" fontWeight="bold" sx={{ color }}>
          {value}
        </Typography>
        {secondary && (
          <Typography variant="caption" color="text.secondary">{secondary}</Typography>
        )}
      </CardContent>
    </Card>
  );
}

function RiegoSummary({ state, onOpen }) {
  const current = state?.current || null;
  const [localTick, setLocalTick] = useState(0);

  useEffect(() => {
    setLocalTick(0);
  }, [current?.queueId, current?.remaining]);

  useEffect(() => {
    if (!current || current.status !== 'running') return undefined;
    const interval = setInterval(() => setLocalTick(tick => tick + 1), 1000);
    return () => clearInterval(interval);
  }, [current?.queueId, current?.status]);

  const { displayRemaining, progress, isRunning, isDisconnecting } = getRiegoDisplay(current, localTick);
  const isConnecting = current?.status === 'connecting';

  return (
    <Card>
      <CardActionArea onClick={onOpen} sx={{ height: '100%' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              {current && <RainAnimation />}
              <WaterDropIcon color="primary" sx={{ position: 'relative', zIndex: 1 }} />
            </Box>
            <Typography variant="h6" fontWeight="bold">
              {current ? current.name : 'Riego apagado'}
            </Typography>
          </Box>

          {!current && (
            <Typography color="text.secondary">
              No hay ninguna fase activa.
            </Typography>
          )}

          {isConnecting && (
            <Typography color="text.secondary">Conectando con el dispositivo…</Typography>
          )}

          {isDisconnecting && (
            <Typography color="text.secondary">Desconectando…</Typography>
          )}

          {isRunning && (
            <>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <AccessTimeIcon fontSize="small" color="action" />
                <Typography variant="h5" fontWeight="bold">
                  {formatRemaining(displayRemaining)}
                </Typography>
                <Typography variant="body2" color="text.secondary">restantes</Typography>
              </Box>
              <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'grey.200', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${Math.round(progress * 100)}%`, bgcolor: 'primary.main', transition: 'width 1s linear', borderRadius: 4 }} />
              </Box>
            </>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Pulsa para abrir el control de riego
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function TasksSummary({ tasks, loading, error, onOpen }) {
  const visibleTasks = tasks.slice(0, 4);

  return (
    <Card>
      <CardActionArea onClick={onOpen} sx={{ height: '100%' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          {loading && (
            <Box display="flex" justifyContent="center" py={1}>
              <CircularProgress size={24} />
            </Box>
          )}

          {error && <Alert severity="warning">{error}</Alert>}

          {!loading && !error && tasks.length === 0 && (
            <Box display="flex" alignItems="center" gap={1}>
              <CheckCircleOutlineIcon color="success" />
              <Typography color="text.secondary" fontWeight="medium">
                No tienes tareas pendientes.
              </Typography>
            </Box>
          )}

          {!loading && !error && tasks.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Tienes {tasks.length} tarea{tasks.length !== 1 ? 's' : ''} pendiente{tasks.length !== 1 ? 's' : ''}.
              </Typography>
              <Box display="flex" flexDirection="column" gap={0.75}>
                {visibleTasks.map(task => (
                  <Box key={task.id} display="flex" alignItems="center" gap={1} minWidth={0}>
                    <Typography component="span" sx={{ fontSize: '1.1rem', flexShrink: 0 }}>
                      {task.category?.emoji || '📋'}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {task.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {task.status === 'EnProgreso' ? 'En progreso' : 'Nueva'}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {tasks.length > visibleTasks.length && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Y {tasks.length - visibleTasks.length} más…
                </Typography>
              )}
            </>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Pulsa para abrir el tablero de tareas
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function PortadaPage() {
  const navigate = useNavigate();
  const socket = useSocket();
  const outletContext = useOutletContext() || {};
  const theme = useTheme();
  const isLandscape = useMediaQuery(theme.breakpoints.up('md'));
  const user = outletContext.user;
  const riegoState = outletContext.riegoState || { current: null, queue: [] };
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState(null);
  const [deviceActionError, setDeviceActionError] = useState(null);
  const [latest, setLatest] = useState({ master: {}, slave: {} });
  const [solarLoading, setSolarLoading] = useState(true);
  const [solarError, setSolarError] = useState(null);
  const [lastSolarUpdate, setLastSolarUpdate] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await api.get('/devices');
      setDevices(response.data);
      setDevicesError(null);
    } catch {
      setDevicesError('Error al cargar los dispositivos destacados');
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const fetchSolar = useCallback(async () => {
    try {
      const response = await api.get('/ingestion/latest');
      if (Array.isArray(response.data) && response.data.length > 0) {
        const master = response.data.find(reading => reading.inverterId === 'master') || {};
        const slave = response.data.find(reading => reading.inverterId === 'slave') || {};
        setLatest({ master, slave });
        setLastSolarUpdate(response.data.reduce((latestTime, reading) => {
          if (!reading.timestamp) return latestTime;
          return !latestTime || reading.timestamp > latestTime ? reading.timestamp : latestTime;
        }, null));
      }
      setSolarError(null);
    } catch {
      setSolarError('No se pudieron cargar los datos solares');
    } finally {
      setSolarLoading(false);
    }
  }, []);

  const fetchMyTasks = useCallback(async () => {
    if (!isLandscape || !user?.id) return;

    setTasksLoading(true);
    try {
      const response = await api.get('/tasks');
      const data = response.data || {};
      const pendingTasks = [...(data.Nueva || []), ...(data.EnProgreso || [])];
      setMyTasks(pendingTasks.filter(task => task.assignedTo?.id === user.id));
      setTasksError(null);
    } catch {
      setTasksError('No se pudieron cargar tus tareas');
    } finally {
      setTasksLoading(false);
    }
  }, [isLandscape, user?.id]);

  useEffect(() => {
    fetchDevices();
    fetchSolar();
  }, [fetchDevices, fetchSolar]);

  useEffect(() => {
    if (!isLandscape || !user?.id) {
      setMyTasks([]);
      setTasksLoading(false);
      setTasksError(null);
      return;
    }
    fetchMyTasks();
  }, [fetchMyTasks, isLandscape, user?.id]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleDeviceUpdate = (data) => {
      setDevices(previous => previous.map(device => device.id === data.id
        ? { ...device, on: data.on ?? device.on, online: data.online ?? device.online, source: data.source ?? device.source }
        : device));
    };
    const handleInverterData = (data) => {
      if (!Array.isArray(data) || data.length === 0) return;
      const master = data.find(reading => reading.inverterId === 'master') || {};
      const slave = data.find(reading => reading.inverterId === 'slave') || {};
      setLatest({ master, slave });
      setLastSolarUpdate(data[0].timestamp || new Date().toISOString());
      setSolarLoading(false);
    };

    socket.on('device:updated', handleDeviceUpdate);
    socket.on('inverter:data', handleInverterData);
    return () => {
      socket.off('device:updated', handleDeviceUpdate);
      socket.off('inverter:data', handleInverterData);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !isLandscape || !user?.id) return undefined;

    const handleTaskUpdate = () => fetchMyTasks();
    socket.on('task:created', handleTaskUpdate);
    socket.on('task:updated', handleTaskUpdate);
    socket.on('task:deleted', handleTaskUpdate);
    return () => {
      socket.off('task:created', handleTaskUpdate);
      socket.off('task:updated', handleTaskUpdate);
      socket.off('task:deleted', handleTaskUpdate);
    };
  }, [fetchMyTasks, isLandscape, socket, user?.id]);

  const handleFeaturedToggle = async (deviceId) => {
    setDevices(previous => previous.map(device => device.id === deviceId ? { ...device, toggling: true } : device));
    try {
      const response = await api.post(`/devices/${deviceId}/toggle`);
      setDevices(previous => previous.map(device => device.id === deviceId
        ? { ...device, on: response.data.on, toggling: false }
        : device));
    } catch {
      setDevices(previous => previous.map(device => device.id === deviceId ? { ...device, toggling: false } : device));
      setDeviceActionError('No se pudo cambiar el dispositivo');
    }
  };

  const featuredDevices = devices.filter(device => device.showOnHome === true);
  const metrics = getSolarMetrics(latest.master, latest.slave);
  const hasSolarData = Boolean(latest.master?.timestamp || latest.slave?.timestamp);
  const solarTimestamp = lastSolarUpdate ? new Date(lastSolarUpdate).toLocaleTimeString() : null;

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, pb: { xs: 2, md: 0 } }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h4" component="h1">Portada</Typography>
        {solarTimestamp && (
          <Typography variant="caption" color="text.secondary">Datos solares: {solarTimestamp}</Typography>
        )}
      </Box>

      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <SectionHeader title="Dispositivos" icon={<HomeIcon color="primary" />} onOpen={() => navigate('/dispositivos')} />
        {devicesError && <Alert severity="error" sx={{ mb: 2 }}>{devicesError}</Alert>}
        {deviceActionError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDeviceActionError(null)}>{deviceActionError}</Alert>}
        {devicesLoading ? (
          <Box display="flex" justifyContent="center" py={3}><CircularProgress size={28} /></Box>
        ) : featuredDevices.length === 0 ? (
          <Card sx={{ p: 2 }}><Typography color="text.secondary">No hay dispositivos destacados.</Typography></Card>
        ) : (
          <Grid container spacing={2}>
            {featuredDevices.map(device => (
              <Grid item xs={12} sm={6} md={3} key={device.id}>
                {device.controlMode === 'pulse'
                  ? <PulseDeviceButton device={device} square compact={isLandscape} />
                  : <DeviceShortcutButton device={device} onToggle={handleFeaturedToggle} compact={isLandscape} />}
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {isLandscape && (
        <Box sx={{ mb: { xs: 3, md: 4 } }}>
          <SectionHeader title="Tus tareas" icon={<AssignmentIcon color="primary" />} onOpen={() => navigate('/tareas')} />
          <TasksSummary tasks={myTasks} loading={tasksLoading} error={tasksError} onOpen={() => navigate('/tareas')} />
        </Box>
      )}

      <Box sx={{ mb: { xs: 3, md: 4 } }}>
        <SectionHeader title="Paneles Solares" icon={<SolarPowerIcon sx={{ color: SOLAR_COLORS.solar }} />} onOpen={() => navigate('/solar')} />
        {solarError && <Alert severity="warning" sx={{ mb: 2 }}>{solarError}</Alert>}
        {solarLoading ? (
          <Box display="flex" justifyContent="center" py={3}><CircularProgress size={28} /></Box>
        ) : (
          <Grid container spacing={1.5}>
            <Grid item xs={6} sm={3}>
              <SolarMetricCard icon={<SolarPowerIcon sx={{ color: SOLAR_COLORS.solar }} />} label="Producción" value={formatWatts(hasSolarData ? metrics.solarProduction : null)} color={SOLAR_COLORS.solar} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SolarMetricCard icon={<BatteryChargingFullIcon sx={{ color: SOLAR_COLORS.battery }} />} label="Batería" value={formatWatts(hasSolarData ? metrics.batteryPower : null)} color={metrics.batteryPower != null && metrics.batteryPower > 0 ? 'error.main' : 'success.main'} secondary={hasSolarData && metrics.batterySoc != null ? `${metrics.batterySoc.toFixed(1)}%` : undefined} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SolarMetricCard icon={<HomeIcon sx={{ color: SOLAR_COLORS.house }} />} label="Casa" value={formatWatts(hasSolarData ? metrics.houseConsumption : null)} color={SOLAR_COLORS.house} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <SolarMetricCard icon={<PowerIcon sx={{ color: metrics.gridPower != null && metrics.gridPower < 0 ? SOLAR_COLORS.gridImport : SOLAR_COLORS.grid }} />} label="Red" value={formatWatts(hasSolarData ? metrics.gridPower : null)} color={metrics.gridPower != null && metrics.gridPower < 0 ? 'warning.main' : 'info.main'} secondary={hasSolarData && metrics.gridPower != null ? (metrics.gridPower > 0 ? 'Exportando' : 'Importando') : undefined} />
            </Grid>
          </Grid>
        )}
      </Box>

      <Box>
        <SectionHeader title="Riego" icon={<WaterDropIcon color="primary" />} onOpen={() => navigate('/riego')} />
        <RiegoSummary state={riegoState} onOpen={() => navigate('/riego')} />
      </Box>
    </Box>
  );
}
