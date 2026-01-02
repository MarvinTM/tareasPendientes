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
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import { useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import MenuIcon from '@mui/icons-material/Menu';
import RepeatIcon from '@mui/icons-material/Repeat';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HistoryIcon from '@mui/icons-material/History';
import CategoryIcon from '@mui/icons-material/Category';
import PeopleIcon from '@mui/icons-material/People';
import UserAvatar from './UserAvatar';
import AppLogo from './AppLogo';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [navMenuAnchor, setNavMenuAnchor] = useState(null);

  // Responsive breakpoints
  const isSmallScreen = useMediaQuery('(max-width:850px)');

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNavMenu = (event) => {
    setNavMenuAnchor(event.currentTarget);
  };

  const handleNavMenuClose = () => {
    setNavMenuAnchor(null);
  };

  const handleNavigation = (path) => {
    navigate(path);
    handleNavMenuClose();
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Recurrentes', path: '/periodic', icon: <RepeatIcon fontSize="small" /> },
    { label: 'Puntuación', path: '/scoreboard', icon: <EmojiEventsIcon fontSize="small" /> },
    { label: 'Historial', path: '/history', icon: <HistoryIcon fontSize="small" /> },
  ];

  const adminItems = [
    { label: 'Categorías', path: '/admin/categories', icon: <CategoryIcon fontSize="small" /> },
    { label: 'Usuarios', path: '/admin', icon: <PeopleIcon fontSize="small" /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppBar position="static" sx={{ flexShrink: 0 }}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1, sm: 2 } }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1, cursor: 'pointer', minWidth: 0 }}
            onClick={() => navigate('/')}
          >
            <AppLogo sx={{ fontSize: { xs: 28, sm: 32 }, flexShrink: 0 }} />
            <Typography
              variant="h6"
              component="div"
              sx={{ whiteSpace: 'nowrap' }}
            >
              Tareas Pendientes
            </Typography>
          </Box>

          {/* Desktop navigation */}
          {!isSmallScreen && (
            <>
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  color="inherit"
                  onClick={() => navigate(item.path)}
                  sx={{ whiteSpace: 'nowrap', minWidth: 'auto', px: 1.5 }}
                >
                  {item.label}
                </Button>
              ))}

              {user?.isAdmin && adminItems.map((item) => (
                <Button
                  key={item.path}
                  color="inherit"
                  onClick={() => navigate(item.path)}
                  sx={{ whiteSpace: 'nowrap', minWidth: 'auto', px: 1.5 }}
                >
                  {item.label}
                </Button>
              ))}
            </>
          )}

          {/* Mobile hamburger menu */}
          {isSmallScreen && (
            <>
              <IconButton color="inherit" onClick={handleNavMenu}>
                <MenuIcon />
              </IconButton>
              <Menu
                anchorEl={navMenuAnchor}
                open={Boolean(navMenuAnchor)}
                onClose={handleNavMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                {navItems.map((item) => (
                  <MenuItem key={item.path} onClick={() => handleNavigation(item.path)}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    {item.label}
                  </MenuItem>
                ))}
                {user?.isAdmin && (
                  <>
                    <Divider />
                    {adminItems.map((item) => (
                      <MenuItem key={item.path} onClick={() => handleNavigation(item.path)}>
                        <ListItemIcon>{item.icon}</ListItemIcon>
                        {item.label}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Menu>
            </>
          )}

          <IconButton onClick={handleMenu} sx={{ ml: 1, p: 0 }}>
            <UserAvatar user={user} sx={{ width: 40, height: 40 }} showTooltip={false} />
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

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 1.5, sm: 3 }, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
