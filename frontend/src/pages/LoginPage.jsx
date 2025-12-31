import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import GoogleIcon from '@mui/icons-material/Google';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default'
      }}
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 400, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Tareas Pendientes
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Inicia sesión para gestionar las tareas de tu familia
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={login}
          fullWidth
        >
          Iniciar sesión con Google
        </Button>
      </Paper>
    </Box>
  );
}
