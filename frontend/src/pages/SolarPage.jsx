import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import PowerIcon from '@mui/icons-material/Power';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

function MetricCard({ icon: Icon, label, value, unit, subtitle, color }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Icon sx={{ color: color || 'primary.main', fontSize: 28 }} />
          <Typography variant="subtitle2" color="text.secondary">
            {label}
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight="bold">
          {value != null ? value.toLocaleString() : '—'} {unit && <Typography component="span" variant="h6" color="text.secondary">{unit}</Typography>}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" mt={1}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function SolarPage() {
  const socket = useSocket();
  const [readings, setReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await api.get('/ingestion/latest');
      if (res.data && res.data.length > 0) setReadings(res.data);
    } catch (e) {
      // socket will populate once connected
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (Array.isArray(data) && data.length > 0) {
        setReadings(data);
        setLoading(false);
      }
    };
    socket.on('inverter:data', handler);
    return () => socket.off('inverter:data', handler);
  }, [socket]);

  // Derive metrics from readings
  const master = readings.find(r => r.inverterId === 'master') || {};
  const slave  = readings.find(r => r.inverterId === 'slave')  || {};

  const solarProd = (master.pvPower || 0) + (slave.pvPower || 0);
  const totalAc = (master.activePower || 0) + (slave.activePower || 0);
  const meterPower = master.meterPower != null ? master.meterPower : null;
  const houseLoad = meterPower != null ? totalAc - meterPower : null;

  const battPower = master.battPower;
  const battSoc = master.battSoc;

  if (loading && readings.length === 0) {
    return (
      <Box display="flex" justifyContent="center" minHeight="50vh" alignItems="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Paneles Solares</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            icon={WbSunnyIcon}
            label="Producción Solar"
            value={solarProd > 0 ? solarProd : null}
            unit="W"
            subtitle={solarProd > 0 ? `Master: ${(master.pvPower || 0).toLocaleString()} W · Slave: ${(slave.pvPower || 0).toLocaleString()} W` : null}
            color="#f9a825"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            icon={ElectricBoltIcon}
            label="Consumo de la Casa"
            value={houseLoad != null ? houseLoad : null}
            unit="W"
            subtitle={meterPower != null ? `Generación total: ${totalAc.toLocaleString()} W` : 'Esperando datos del medidor…'}
            color="#e53935"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            icon={BatteryChargingFullIcon}
            label="Batería"
            value={battPower != null ? Math.abs(battPower) : null}
            unit="W"
            subtitle={
              battPower != null
                ? `${battPower < 0 ? 'Cargando' : battPower > 0 ? 'Descargando' : 'En reposo'} · ${battSoc != null ? battSoc.toFixed(1) + '%' : '—'}`
                : 'Sin datos de batería'
            }
            color="#43a047"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            icon={PowerIcon}
            label="Red Eléctrica"
            value={meterPower != null ? Math.abs(meterPower) : null}
            unit="W"
            subtitle={meterPower != null
              ? (meterPower > 0 ? 'Importando de la red' : meterPower < 0 ? 'Exportando a la red' : 'Balance cero')
              : 'Sin datos del medidor'}
            color={meterPower > 0 ? '#ef6c00' : meterPower < 0 ? '#1565c0' : 'text.secondary'}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <MetricCard
            icon={DeveloperBoardIcon}
            label="Inversores"
            value={
              (master.activePower != null || slave.activePower != null)
                ? `${totalAc.toLocaleString()}`
                : null
            }
            unit="W"
            subtitle={
              master.activePower != null || slave.activePower != null
                ? `Master: ${(master.activePower || 0).toLocaleString()} W · Slave: ${(slave.activePower || 0).toLocaleString()} W`
                : null
            }
          />
        </Grid>
      </Grid>
    </Box>
  );
}
