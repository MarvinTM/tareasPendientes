import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import { getGroupIcon } from '../utils/iconMap';

export default function DeviceShortcutButton({ device, onToggle }) {
  const GroupIcon = getGroupIcon(device.group) || LightbulbIcon;
  const isOffline = device.online === false;
  const isDisabled = isOffline || device.on === null || device.toggling;

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <Button
        fullWidth={false}
        variant={device.on ? 'contained' : 'outlined'}
        color={device.on ? 'warning' : 'primary'}
        disabled={isDisabled}
        onClick={() => onToggle(device.id)}
        aria-label={`${device.name}: ${device.on ? 'apagar' : 'encender'}`}
        sx={{
          width: { xs: 160, sm: '100%' },
          height: { xs: 160, sm: 'auto' },
          minHeight: { xs: 160, sm: 230 },
          aspectRatio: '1 / 1',
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 0.5, sm: 1 },
          justifyContent: 'center',
          textTransform: 'none',
        }}
      >
        {device.toggling ? <CircularProgress size={38} /> : device.on ? <CheckCircleIcon sx={{ fontSize: { xs: 48, sm: 52 } }} /> : <GroupIcon sx={{ fontSize: { xs: 48, sm: 58 } }} />}
        <Typography fontWeight="bold" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, lineHeight: 1.2, textAlign: 'center' }}>
          {device.toggling ? 'Actualizando…' : device.on ? 'Encendido' : 'Apagado'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2, textAlign: 'center' }}>
          {isOffline ? 'Sin conexión' : device.on ? 'Pulsa para apagar' : 'Pulsa para encender'}
        </Typography>
      </Button>
    </Box>
  );
}
