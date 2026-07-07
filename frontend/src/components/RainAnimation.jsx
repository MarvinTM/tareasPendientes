import { keyframes } from '@emotion/react';
import Box from '@mui/material/Box';

const fall = keyframes`
  0% { transform: translateY(-12px); opacity: 0; }
  10% { opacity: 0.35; }
  90% { opacity: 0.35; }
  100% { transform: translateY(40px); opacity: 0; }
`;

const DROPS = [
  { left: -6, delay: '0s', duration: '1.1s' },
  { left: 2, delay: '0.12s', duration: '0.9s' },
  { left: 8, delay: '0.25s', duration: '1.2s' },
  { left: 14, delay: '0.08s', duration: '1.0s' },
  { left: 20, delay: '0.35s', duration: '1.3s' },
  { left: 26, delay: '0.18s', duration: '0.8s' },
  { left: 30, delay: '0.5s', duration: '1.15s' },
  { left: 34, delay: '0.22s', duration: '0.95s' },
  { left: -2, delay: '0.42s', duration: '1.1s' },
  { left: 5, delay: '0.55s', duration: '0.95s' },
  { left: 11, delay: '0.3s', duration: '1.25s' },
  { left: 17, delay: '0.48s', duration: '1.05s' },
  { left: 23, delay: '0.05s', duration: '0.85s' },
  { left: 28, delay: '0.62s', duration: '1.1s' },
  { left: 36, delay: '0.14s', duration: '1.0s' },
  { left: 0, delay: '0.38s', duration: '1.15s' },
  { left: 9, delay: '0.6s', duration: '0.9s' },
  { left: 15, delay: '0.15s', duration: '1.35s' },
  { left: 22, delay: '0.5s', duration: '1.0s' },
  { left: 32, delay: '0.28s', duration: '0.85s' },
];

export default function RainAnimation() {
  return (
    <Box sx={{
      position: 'absolute',
      top: -6,
      left: -10,
      right: -10,
      bottom: 4,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0,
    }}>
      {DROPS.map((drop, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: -8,
            left: `${drop.left}px`,
            width: 1.5,
            height: 6,
            borderRadius: '0 0 1px 1px',
            background: 'linear-gradient(to bottom, rgba(13,71,161,0.7), rgba(30,136,229,0.08))',
            animation: `${fall} ${drop.duration} ${drop.delay} infinite linear`,
          }}
        />
      ))}
    </Box>
  );
}
