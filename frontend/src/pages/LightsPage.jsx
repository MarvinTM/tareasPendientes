import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

export default function LightsPage() {
  const socket = useSocket();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const fetchDevices = useCallback(async () => {
    try {
      const response = await api.get('/devices');
      setDevices(response.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar los dispositivos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (!socket) return;

    const handleDeviceUpdate = (data) => {
      setDevices(prev =>
        prev.map(d => (d.id === data.id ? { ...d, on: data.on } : d))
      );
    };

    socket.on('device:updated', handleDeviceUpdate);

    return () => {
      socket.off('device:updated', handleDeviceUpdate);
    };
  }, [socket]);

  useEffect(() => {
    const hasOffline = devices.some(d => d.online === false);
    if (!hasOffline) return;

    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, [devices, fetchDevices]);

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
    } catch (err) {
      setDevices(prev =>
        prev.map(d => (d.id === deviceId ? { ...d, toggling: false } : d))
      );
      setSnackbar('Error al cambiar el dispositivo');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LightbulbIcon fontSize="large" color="primary" /> Luces
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

      <Grid container spacing={2}>
        {devices.map(device => (
          <Grid item xs={12} sm={6} md={4} key={device.id}>
            <Card sx={{ opacity: device.online === false ? 0.7 : 1 }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={1.5} minWidth={0}>
                    {device.online === false ? (
                      <WarningAmberIcon color="warning" />
                    ) : (
                      <LightbulbIcon
                        sx={{ color: device.on ? '#fdd835' : 'text.secondary' }}
                      />
                    )}
                    <Box minWidth={0}>
                      <Typography
                        variant="subtitle1"
                        fontWeight="bold"
                        noWrap
                      >
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
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar}
      />
    </Box>
  );
}
