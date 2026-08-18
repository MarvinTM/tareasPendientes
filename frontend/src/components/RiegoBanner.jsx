import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import StopIcon from '@mui/icons-material/Stop';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import api from '../services/api';
import { formatRemaining } from '../utils/riego';

export default function RiegoBanner({ current }) {
  const [localTick, setLocalTick] = useState(0);

  // Reset local tick whenever the server sends fresh remaining (new socket data)
  useEffect(() => {
    setLocalTick(0);
  }, [current?.remaining]);

  // Countdown tick every second while running
  useEffect(() => {
    if (!current || current.status !== 'running') return;
    const interval = setInterval(() => {
      setLocalTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [current?.queueId, current?.status]);

  // Derive effective remaining from prop (always up-to-date) minus local ticks
  const displayRemaining = Math.max(0, (current?.remaining ?? 0) - localTick);

  const handleStop = async () => {
    try {
      await api.post('/riego/stop');
    } catch {
      // silently fail
    }
  };

  const isRunning = current?.status === 'running';
  const isConnecting = current?.status === 'connecting';
  const isDisconnecting = current?.status === 'disconnecting';
  const totalSeconds = current ? current.durationMin * 60 : 0;
  const progress = isRunning
    ? Math.max(0, Math.min(1, 1 - (displayRemaining / Math.max(1, totalSeconds))))
    : isDisconnecting ? 1 : 0;

  const showStop = isRunning || isConnecting;

  return (
    <Collapse in={current !== null}>
      <Box
        data-testid="riego-banner"
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 0.75,
          gap: 1.5,
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <WaterDropIcon sx={{ color: 'primary.main', fontSize: 18, flexShrink: 0 }} />

        <Typography
          variant="body2"
          fontWeight="medium"
          sx={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {current?.name}
        </Typography>

        {(isRunning || isDisconnecting) && (
          <Box
            sx={{
              flexGrow: 1,
              height: 6,
              borderRadius: 3,
              bgcolor: 'grey.200',
              overflow: 'hidden',
              position: 'relative',
              minWidth: 40,
            }}
          >
            <Box
              key={current?.queueId}
              data-testid="riego-banner-fill"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${Math.round(progress * 100)}%`,
                bgcolor: 'primary.main',
                transition: 'width 1s linear',
                borderRadius: 3,
              }}
            />
          </Box>
        )}

        {isRunning && (
          <>
            <AccessTimeIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {formatRemaining(displayRemaining)}
            </Typography>
          </>
        )}

        {isConnecting && (
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Conectando...
          </Typography>
        )}

        {showStop && (
          <IconButton
            data-testid="riego-banner-stop"
            onClick={handleStop}
            size="small"
            sx={{ ml: 0.5, flexShrink: 0 }}
          >
            <StopIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Collapse>
  );
}
