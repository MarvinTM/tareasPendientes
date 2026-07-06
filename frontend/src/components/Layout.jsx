import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Drawer from '@mui/material/Drawer';
import { useState, useCallback } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import UserAvatar from './UserAvatar';
import AppLogo from './AppLogo';
import { modules } from '../config/modules';

const DRAWER_COLLAPSED = 56;
const DRAWER_EXPANDED = 200;

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);

  const activeModule = modules.find(m =>
    location.pathname === m.path || location.pathname.startsWith(m.path + '/')
  );

  const isActiveModuleAccessible = activeModule
    ? !activeModule.adminOnly || user?.isAdmin
    : false;

  const userModules = modules.filter(m => !m.adminOnly);
  const adminModules = modules.filter(m => m.adminOnly);
  const visibleModules = modules.filter(m => !m.adminOnly || user?.isAdmin);

  const navigateToModule = useCallback((mod) => {
    const target = mod.subNav.length > 0 ? mod.subNav[0].path : mod.path;
    navigate(target);
  }, [navigate]);

  const handleDrawerModuleClick = (mod) => {
    setDrawerExpanded(prev => !prev);
    navigateToModule(mod);
  };

  const handleToggleDrawer = () => {
    setDrawerExpanded(prev => !prev);
  };

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

  const handleMobileDrawerToggle = () => {
    setMobileDrawerOpen(prev => !prev);
  };

  const handleMobileDrawerClose = () => {
    setMobileDrawerOpen(false);
  };

  const handleBottomNavChange = (event, newValue) => {
    const mod = modules.find(m => m.id === newValue);
    if (mod) navigateToModule(mod);
  };

  const drawerWidth = drawerExpanded ? DRAWER_EXPANDED : DRAWER_COLLAPSED;

  const renderDrawerItem = (mod) => (
    <ListItemButton
      key={mod.id}
      selected={activeModule?.id === mod.id}
      onClick={() => handleDrawerModuleClick(mod)}
      sx={{
        minHeight: 48,
        px: 1.5,
        justifyContent: drawerExpanded ? 'initial' : 'center',
      }}
    >
      <ListItemIcon sx={{
        minWidth: 0,
        mr: drawerExpanded ? 1.5 : 'auto',
        justifyContent: 'center',
      }}>
        <mod.icon />
      </ListItemIcon>
      {drawerExpanded && <ListItemText primary={mod.label} />}
    </ListItemButton>
  );

  const userMenu = (
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
  );

  if (isMobile) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        '@supports (-webkit-touch-callout: none)': {
          height: '-webkit-fill-available'
        },
        overflow: 'hidden'
      }}>
        <AppBar position="static" sx={{ flexShrink: 0 }}>
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1, sm: 2 } }}>
            <IconButton color="inherit" edge="start" onClick={handleMobileDrawerToggle} sx={{ mr: 1 }}>
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, whiteSpace: 'nowrap' }}>
              {activeModule?.label || 'Tareas Pendientes'}
            </Typography>
            <IconButton onClick={handleMenu} sx={{ p: 0 }}>
              <UserAvatar user={user} sx={{ width: 40, height: 40 }} showTooltip={false} />
            </IconButton>
          </Toolbar>
        </AppBar>

        {userMenu}

        <Box component="main" sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 3 },
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          overscrollBehavior: 'none',
          pb: 7
        }}>
          <Outlet />
        </Box>

        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }} elevation={3}>
          <BottomNavigation value={activeModule?.id || ''} onChange={handleBottomNavChange} showLabels>
            {visibleModules.map(mod => (
              <BottomNavigationAction
                key={mod.id}
                value={mod.id}
                icon={<mod.icon />}
                label={mod.label}
              />
            ))}
          </BottomNavigation>
        </Paper>

        <Drawer
          anchor="left"
          open={mobileDrawerOpen}
          onClose={handleMobileDrawerClose}
        >
          <Box sx={{ width: 260, pt: 1 }}>
            <Typography variant="subtitle1" sx={{ px: 2, py: 1, fontWeight: 'bold', color: 'text.secondary' }}>
              {activeModule?.label || 'Navegación'}
            </Typography>
            <Divider />
            {activeModule?.subNav.map(item => (
              <ListItemButton
                key={item.path}
                selected={location.pathname === item.path}
                onClick={() => { navigate(item.path); handleMobileDrawerClose(); }}
                sx={{ pl: 4 }}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
            {user?.isAdmin && (
              <>
                <Divider sx={{ mt: 1 }} />
                <Typography variant="subtitle2" sx={{ px: 2, py: 1, color: 'text.secondary' }}>
                  Administración
                </Typography>
                {adminModules.map(mod => (
                  <ListItemButton
                    key={mod.id}
                    selected={activeModule?.id === mod.id}
                    onClick={() => { navigateToModule(mod); handleMobileDrawerClose(); }}
                    sx={{ pl: 4 }}
                  >
                    <ListItemIcon><mod.icon fontSize="small" /></ListItemIcon>
                    <ListItemText primary={mod.label} />
                  </ListItemButton>
                ))}
              </>
            )}
            <Divider sx={{ mt: 1 }} />
            <ListItemButton onClick={() => { handleLogout(); handleMobileDrawerClose(); }}>
              <ListItemText primary="Cerrar sesión" />
            </ListItemButton>
          </Box>
        </Drawer>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          whiteSpace: 'nowrap',
          transition: 'width 0.2s ease-in-out',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            transition: 'width 0.2s ease-in-out',
            overflowX: 'hidden',
            boxSizing: 'border-box',
          },
        }}
      >
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          pt: 1,
        }}>
          <Box sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: drawerExpanded ? 'space-between' : 'center',
            py: 1,
            px: drawerExpanded ? 1 : 0,
            mb: 1,
            minHeight: 48,
          }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: drawerExpanded ? 1 : 0,
                cursor: 'pointer',
                minWidth: 0,
              }}
              onClick={() => navigate('/tareas')}
            >
              <AppLogo sx={{ fontSize: 28, flexShrink: 0 }} />
              {drawerExpanded && (
                <Typography variant="subtitle2" fontWeight="bold" noWrap color="primary.main">
                  Tareas Pendientes
                </Typography>
              )}
            </Box>
            <IconButton size="small" onClick={handleToggleDrawer} sx={{ flexShrink: 0, p: drawerExpanded ? undefined : 0 }}>
              {drawerExpanded ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Divider />

          <List sx={{ flexGrow: 1 }}>
            {userModules.map(mod => renderDrawerItem(mod))}
          </List>

          {user?.isAdmin && (
            <>
              <Divider />
              <List>
                {adminModules.map(mod => renderDrawerItem(mod))}
              </List>
            </>
          )}
        </Box>
      </Drawer>

      <Box sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>
        <AppBar position="static" sx={{ flexShrink: 0 }}>
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 1, sm: 2 } }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 0, cursor: 'pointer', minWidth: 0, mr: 2 }}
              onClick={() => navigate('/tareas')}
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

            <Box sx={{ display: 'flex', flexGrow: 1, gap: 0.5 }}>
              {isActiveModuleAccessible && activeModule?.subNav.map(item => (
                <Button
                  key={item.path}
                  color="inherit"
                  onClick={() => navigate(item.path)}
                  sx={{
                    whiteSpace: 'nowrap',
                    minWidth: 'auto',
                    px: 1.5,
                    borderBottom: location.pathname === item.path ? '3px solid white' : '3px solid transparent',
                    borderRadius: 0,
                    fontWeight: location.pathname === item.path ? 'bold' : 'normal',
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>

            <IconButton onClick={handleMenu} sx={{ ml: 1, p: 0 }}>
              <UserAvatar user={user} sx={{ width: 40, height: 40 }} showTooltip={false} />
            </IconButton>
          </Toolbar>
        </AppBar>

        {userMenu}

        <Box component="main" sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 3 },
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          overscrollBehavior: 'none'
        }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
