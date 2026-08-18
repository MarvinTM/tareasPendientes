import { useEffect, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GarageIcon from '@mui/icons-material/Garage';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

const FEEDBACK_MS = 1800;

export default function PulseDeviceButton({ device, square = false, compact = false }) {
  const socket = useSocket();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  useEffect(() => {
    if (!socket) return undefined;

    const handlePulse = (data) => {
      if (data?.id !== device.id) return;
      setError(null);
      setStatus('sent');
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
    };

    socket.on('device:pulsed', handlePulse);
    return () => socket.off('device:pulsed', handlePulse);
  }, [device.id, socket]);

  const handlePulse = async () => {
    if (status === 'sending' || device.online === false) return;

    setError(null);
    setStatus('sending');
    try {
      await api.post(`/devices/${device.id}/pulse`);
      setStatus('sent');
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setStatus('idle'), FEEDBACK_MS);
    } catch (err) {
      setStatus('idle');
      setError(err.response?.data?.error || 'No se pudo accionar el dispositivo');
    }
  };

  const isOffline = device.online === false;
  const isSending = status === 'sending';
  const isSent = status === 'sent';
  const Icon = device.group === 'garaje' ? GarageIcon : ElectricBoltIcon;

  return (
    <Box sx={{
      width: '100%',
      display: square ? 'flex' : undefined,
      flexDirection: square ? 'column' : undefined,
      alignItems: square ? 'center' : undefined,
    }}>
      <Button
        fullWidth={!square}
        variant={isSent ? 'contained' : 'outlined'}
        color={isSent ? 'success' : 'primary'}
        disabled={isOffline || isSending}
        onClick={handlePulse}
        aria-label={`${device.name}: accionar`}
        sx={{
          width: square ? (compact ? 140 : { xs: 160, sm: '100%' }) : '100%',
          height: square ? (compact ? 140 : { xs: 160, sm: 'auto' }) : undefined,
          minHeight: square ? (compact ? 140 : { xs: 160, sm: 230 }) : 56,
          aspectRatio: square ? '1 / 1' : undefined,
          display: 'flex',
          flexDirection: square ? 'column' : 'row',
          gap: square ? (compact ? 0.25 : { xs: 0.5, sm: 1 }) : 0.75,
          justifyContent: 'center',
          textTransform: 'none',
          borderWidth: square ? 2 : undefined,
          '&:hover': { borderWidth: square ? 2 : undefined },
        }}
      >
        {isSending ? <CircularProgress size={compact ? 34 : square ? 38 : 22} /> : isSent ? <CheckCircleIcon sx={{ fontSize: square ? (compact ? 40 : { xs: 48, sm: 52 }) : 24 }} /> : <Icon sx={{ fontSize: square ? (compact ? 40 : { xs: 48, sm: 58 }) : 28 }} />}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {square && (
            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: compact ? '0.75rem' : undefined, lineHeight: 1.15, textAlign: 'center' }}>
              {device.name}
            </Typography>
          )}
          <Typography fontWeight="bold" sx={{ fontSize: square ? (compact ? '0.85rem' : { xs: '1rem', sm: '1.25rem' }) : undefined, lineHeight: square ? 1.15 : undefined, textAlign: 'center' }}>
            {isSending ? 'Enviando pulso…' : isSent ? 'Pulso enviado' : 'Accionar puerta'}
          </Typography>
          {square && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? '0.65rem' : undefined, lineHeight: 1.15, textAlign: 'center' }}>
              {isSending ? 'Un momento' : isSent ? 'Acción recibida' : 'Pulsa para abrir/cerrar'}
            </Typography>
          )}
        </Box>
      </Button>

      <Typography variant="caption" color={isOffline ? 'warning.main' : error ? 'error.main' : 'text.secondary'} sx={{ display: 'block', mt: 0.75, textAlign: square ? 'center' : 'left' }}>
        {isOffline ? 'Sin conexión' : error || 'Accionamiento momentáneo; no indica la posición de la puerta'}
      </Typography>
    </Box>
  );
}
