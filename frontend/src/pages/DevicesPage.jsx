import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { getGroupIcon } from '../utils/iconMap';
import PulseDeviceButton from '../components/PulseDeviceButton';

function formatPlanLabel(plan) {
  const actMode = plan.activationMode || 'fixed';
  const deactMode = plan.deactivationMode || 'fixed';
  const actLabel = actMode === 'sunrise' ? 'Amanecer' : actMode === 'sunset' ? 'Anochecer' : plan.activationTime;
  const deactLabel = deactMode === 'sunrise' ? 'Amanecer' : deactMode === 'sunset' ? 'Anochecer' : plan.deactivationTime;
  return `${plan.name} (${actLabel} — ${deactLabel})`;
}

const sourceColor = {
  local: '#4caf50',
  cloud: '#ff9800',
  unknown: '#9e9e9e',
};

const sourceLabel = {
  local: 'Datos del dispositivo local (localComponent)',
  cloud: 'Datos de la nube (Shelly Cloud)',
  unknown: 'Origen de datos desconocido',
};

export default function DevicesPage() {
  const socket = useSocket();
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activationStatus, setActivationStatus] = useState({});
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [devicesRes, groupsRes, statusRes, plansRes] = await Promise.all([
        api.get('/devices'),
        api.get('/devices/groups'),
        api.get('/devices/activation-status'),
        api.get('/devices/activation-plans'),
      ]);
      setDevices(devicesRes.data);
      setGroups(groupsRes.data);
      setActivationStatus(statusRes.data);
      setPlans(plansRes.data);
      setError(null);
    } catch {
      setError('Error al cargar los dispositivos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;

    const handleDeviceUpdate = (data) => {
      setDevices(prev =>
        prev.map(d => (d.id === data.id ? { ...d, on: data.on, online: data.online !== undefined ? data.online : d.online, source: data.source !== undefined ? data.source : d.source } : d))
      );
    };

    socket.on('device:updated', handleDeviceUpdate);
    return () => socket.off('device:updated', handleDeviceUpdate);
  }, [socket]);

  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleToggle = async (deviceId) => {
    setDevices(prev =>
      prev.map(d => (d.id === deviceId ? { ...d, toggling: true } : d))
    );

    try {
      const response = await api.post(`/devices/${deviceId}/toggle`);
      setDevices(prev =>
        prev.map(d =>
          d.id === deviceId ? { ...d, on: response.data.on, toggling: false } : d
        )
      );
    } catch {
      setDevices(prev =>
        prev.map(d => (d.id === deviceId ? { ...d, toggling: false } : d))
      );
      setSnackbar('Error al cambiar el dispositivo');
    }
  };

  const handleAssign = async (deviceId, planId) => {
    try {
      if (planId) {
        const res = await api.post(`/devices/${deviceId}/activation`, { planId });
        setActivationStatus(prev => ({
          ...prev,
          [deviceId]: { planId: res.data.planId, planName: res.data.plan.name },
        }));
      } else {
        await api.delete(`/devices/${deviceId}/activation`);
        setActivationStatus(prev => {
          const updated = { ...prev };
          delete updated[deviceId];
          return updated;
        });
      }
    } catch {
      setSnackbar('Error al asignar el plan');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const groupedDevices = groups.map(g => ({
    ...g,
    devices: devices.filter(d => d.group === g.id),
  }));

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, pb: { xs: 2, md: 0 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        Dispositivos
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {devices.length === 0 && !loading && (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No hay dispositivos configurados.
          </Typography>
        </Card>
      )}

      {groupedDevices.filter(g => g.devices.length > 0).map(group => {
        const GroupIcon = getGroupIcon(group.icon);

        return (
          <Box key={group.id} sx={{ mb: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {GroupIcon && <GroupIcon color="primary" />}
              {group.name}
            </Typography>

            <Grid container spacing={2}>
              {group.devices.map(device => (
                <Grid item xs={12} sm={6} md={4} key={device.id}>
                  <Card sx={{ opacity: device.online === false ? 0.7 : 1 }}>
                    <CardContent>
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box display="flex" alignItems="center" gap={1.5} minWidth={0} flex={1}>
                          {device.online === false ? (
                            <WarningAmberIcon color="warning" />
                          ) : GroupIcon ? (
                            <GroupIcon
                              sx={{ color: device.on ? '#fdd835' : 'text.secondary' }}
                            />
                          ) : null}
                          <Tooltip title={sourceLabel[device.source] || sourceLabel.unknown} arrow>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: '50%',
                                backgroundColor: sourceColor[device.source] || sourceColor.unknown,
                                flexShrink: 0,
                              }}
                            />
                          </Tooltip>
                          <Box minWidth={0} flex={1}>
                            <Typography variant="subtitle1" fontWeight="bold" noWrap>
                              {device.name}
                            </Typography>
                            {device.room && (
                              <Typography variant="body2" color="text.secondary" noWrap>
                                {device.room}
                              </Typography>
                            )}
                            {device.online === false && (
                              <Typography variant="caption" color="warning.main">
                                Sin conexión
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {device.controlMode === 'pulse' ? (
                          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', maxWidth: 120 }}>
                            Accionamiento momentáneo
                          </Typography>
                        ) : (
                          <Box display="flex" alignItems="center">
                            {device.toggling ? (
                              <CircularProgress size={24} />
                            ) : (
                              <Switch
                                checked={device.on === true}
                                disabled={device.online === false || device.on === null}
                                onChange={() => handleToggle(device.id)}
                              />
                            )}
                          </Box>
                        )}
                      </Box>

                      {device.controlMode === 'pulse' ? (
                        <Box sx={{ mt: 1.5 }}>
                          <PulseDeviceButton device={device} />
                        </Box>
                      ) : plans.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <FormControl size="small" fullWidth>
                            <Select
                              value={activationStatus[device.id]?.planId || ''}
                              onChange={(e) => handleAssign(device.id, e.target.value)}
                              displayEmpty
                              disabled={device.online === false}
                            >
                              <MenuItem value="">Sin plan</MenuItem>
                              {plans.map(p => (
                                <MenuItem key={p.id} value={p.id}>
                                  {formatPlanLabel(p)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
  );
}
