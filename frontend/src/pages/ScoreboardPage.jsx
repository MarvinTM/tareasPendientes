import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DateRangeIcon from '@mui/icons-material/DateRange';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import UserAvatar from '../components/UserAvatar';

const medalColors = {
  0: '#FFD700', // Gold
  1: '#C0C0C0', // Silver
  2: '#CD7F32'  // Bronze
};

const getMonthName = () => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[new Date().getMonth()];
};

const periodConfig = {
  week: { label: 'Esta Semana', icon: CalendarTodayIcon, color: '#2196f3' },
  month: { label: getMonthName(), icon: DateRangeIcon, color: '#9c27b0' },
  year: { label: `${new Date().getFullYear()}`, icon: CalendarMonthIcon, color: '#ff9800' }
};

export default function ScoreboardPage() {
  const [scoresByPeriod, setScoresByPeriod] = useState({
    week: [],
    month: [],
    year: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const socket = useSocket();

  const fetchAllScores = useCallback(async () => {
    try {
      const [weekRes, monthRes, yearRes] = await Promise.all([
        api.get('/users/scores?period=week'),
        api.get('/users/scores?period=month'),
        api.get('/users/scores?period=year')
      ]);
      setScoresByPeriod({
        week: weekRes.data,
        month: monthRes.data,
        year: yearRes.data
      });
      setError(null);
    } catch (err) {
      setError('Error al cargar la puntuación');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllScores();
  }, [fetchAllScores]);

  // Listen for real-time task updates
  useEffect(() => {
    if (!socket) return;

    socket.on('task:updated', fetchAllScores);
    socket.on('task:deleted', fetchAllScores);

    return () => {
      socket.off('task:updated', fetchAllScores);
      socket.off('task:deleted', fetchAllScores);
    };
  }, [socket, fetchAllScores]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const renderScoreTable = (period) => {
    const scores = scoresByPeriod[period];
    const config = periodConfig[period];
    const IconComponent = config.icon;

    return (
      <Paper sx={{ height: '100%' }}>
        <Box
          sx={{
            p: 2,
            backgroundColor: `${config.color}15`,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}
        >
          <IconComponent sx={{ color: config.color }} />
          <Typography variant="h6" fontWeight="medium">
            {config.label}
          </Typography>
        </Box>
        {scores.length === 0 || scores.every(s => s.totalPoints === 0) ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">
              Sin puntuaciones
            </Typography>
          </Box>
        ) : (
          <List dense>
            {scores.filter(user => user.totalPoints > 0).map((user, index) => (
              <ListItem
                key={user.id}
                sx={{
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: index < 3 ? `${medalColors[index]}15` : 'transparent',
                  py: 1
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: 1.5
                  }}
                >
                  {index < 3 ? (
                    <EmojiEventsIcon sx={{ color: medalColors[index], fontSize: 24 }} />
                  ) : (
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">
                      {index + 1}
                    </Typography>
                  )}
                </Box>
                <ListItemAvatar sx={{ minWidth: 50 }}>
                  <UserAvatar user={user} sx={{ width: 40, height: 40, fontSize: '0.875rem' }} showTooltip={false} />
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" fontWeight="medium">
                      {user.name}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      {user.taskCount} tarea{user.taskCount !== 1 ? 's' : ''}
                    </Typography>
                  }
                />
                <Chip
                  label={`${user.totalPoints} pts`}
                  size="small"
                  color={index === 0 ? 'primary' : 'default'}
                  sx={{
                    fontWeight: 'bold',
                    minWidth: 60
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    );
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={3}>
        <EmojiEventsIcon sx={{ fontSize: 32, color: '#FFD700' }} />
        <Typography variant="h4" component="h1">
          Puntuación
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: 'grey.100',
          borderRadius: 2
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Puntos por tarea completada: <strong>S</strong> = 1 punto, <strong>M</strong> = 2 puntos, <strong>L</strong> = 3 puntos
        </Typography>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          {renderScoreTable('week')}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderScoreTable('month')}
        </Grid>
        <Grid item xs={12} md={4}>
          {renderScoreTable('year')}
        </Grid>
      </Grid>
    </Box>
  );
}
