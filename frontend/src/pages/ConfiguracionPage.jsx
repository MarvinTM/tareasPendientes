import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import SettingsIcon from '@mui/icons-material/Settings';

export default function ConfiguracionPage() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon fontSize="large" color="primary" /> Configuración
      </Typography>

      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary" variant="h6" gutterBottom>
          Próximamente
        </Typography>
        <Typography color="text.secondary">
          Ajustes personales y preferencias de usuario.
        </Typography>
      </Paper>
    </Box>
  );
}
