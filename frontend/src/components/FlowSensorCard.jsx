import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import WaterIcon from '@mui/icons-material/Water';
import { formatLitres, formatRate } from '../utils/flow';

// Read-only counterpart of DeviceShortcutButton: a flow sensor has nothing to
// switch, so the square tile shows the current rate and today's litres and
// opens the Agua module instead of toggling anything.
export default function FlowSensorCard({ device, onOpen, compact = false }) {
  const isOffline = device.online === false;
  const status = device.sensorStatus || {};

  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <Card
        sx={{
          width: compact ? 140 : { xs: 160, sm: '100%' },
          height: compact ? 140 : { xs: 160, sm: 'auto' },
          minHeight: compact ? 140 : { xs: 160, sm: 230 },
          aspectRatio: '1 / 1',
          opacity: isOffline ? 0.7 : 1,
        }}
      >
        <CardActionArea
          onClick={() => onOpen(device.id)}
          aria-label={`${device.name}: ver histórico de agua`}
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: compact ? 0.25 : { xs: 0.5, sm: 1 },
            justifyContent: 'center',
            textAlign: 'center',
            px: 1,
          }}
        >
          <WaterIcon color="primary" sx={{ fontSize: compact ? 40 : { xs: 48, sm: 58 } }} />
          <Typography fontWeight="bold" sx={{ fontSize: compact ? '0.85rem' : { xs: '1rem', sm: '1.25rem' }, lineHeight: 1.15 }}>
            {formatRate(isOffline ? null : status.rateLpm)}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: compact ? '0.75rem' : undefined, lineHeight: 1.15 }}>
            {formatLitres(status.todayLitres)} hoy
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: compact ? '0.65rem' : undefined, lineHeight: 1.15 }}>
            {isOffline ? 'Sin conexión' : device.name}
          </Typography>
        </CardActionArea>
      </Card>
    </Box>
  );
}
