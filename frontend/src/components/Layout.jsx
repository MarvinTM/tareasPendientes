import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import UserAvatar from './UserAvatar';
import AppLogo from './AppLogo';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1, cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            <AppLogo sx={{ fontSize: 32 }} />
            <Typography variant="h6" component="div">
              Tareas Pendientes
            </Typography>
          </Box>

          <Button color="inherit" onClick={() => navigate('/periodic')}>
            Tareas recurrentes
          </Button>

          <Button color="inherit" onClick={() => navigate('/scoreboard')}>
            Puntuación
          </Button>

          <Button color="inherit" onClick={() => navigate('/history')}>
            Historial
          </Button>

          {user?.isAdmin && (
            <>
              <Button color="inherit" onClick={() => navigate('/admin/categories')}>
                Categorías
              </Button>
              <Button color="inherit" onClick={() => navigate('/admin')}>
                Usuarios
              </Button>
            </>
          )}

          <IconButton onClick={handleMenu} sx={{ ml: 2, p: 0 }}>
            <UserAvatar user={user} sx={{ width: 44, height: 44 }} showTooltip={false} />
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem disabled>
              <Typography variant="body2">{user?.email}</Typography>
            </MenuItem>
            <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
