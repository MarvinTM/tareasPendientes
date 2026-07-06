import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LightbulbIcon from '@mui/icons-material/Lightbulb';

export default function LightsPage() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LightbulbIcon fontSize="large" color="primary" /> Luces
      </Typography>

      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary" variant="h6" gutterBottom>
          Próximamente
        </Typography>
        <Typography color="text.secondary">
          Control de luces conectadas con dispositivos Shelly.
        </Typography>
      </Paper>
    </Box>
  );
}
