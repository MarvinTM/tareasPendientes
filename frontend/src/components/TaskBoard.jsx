import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import AssignmentIcon from '@mui/icons-material/Assignment';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { DragDropContext } from '@hello-pangea/dnd';
import TaskColumn from './TaskColumn';
import UserAvatar from './UserAvatar';

const STATUSES = ['Nueva', 'EnProgreso', 'Completada'];

const medalColors = {
  0: '#FFD700', // Gold
  1: '#C0C0C0', // Silver
  2: '#CD7F32'  // Bronze
};

export default function TaskBoard({ tasks, users, categories, weeklyScores, onDragEnd, onEdit, onDelete, onAssign, onSizeChange, newFilter, onNewFilterChange, categoryFilter, onCategoryFilterChange, completedFilter, onCompletedFilterChange, numColumns = 1 }) {
  // Track which tasks are expanded (for compact mode)
  const [expandedTaskIds, setExpandedTaskIds] = useState(new Set());

  const handleToggleExpanded = useCallback((taskId) => {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  // Calculate total pending tasks across all dynamic columns
  const pendingCount = Array.from({ length: numColumns }).reduce((acc, _, idx) => {
    return acc + (tasks[`Pendientes_${idx}`]?.length || 0);
  }, 0);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flexDirection: 'column',
          '@media (min-width: 700px)': { flexDirection: 'row' },
          flex: 1,
          minHeight: 0, // Critical for flex child to respect parent height
          overflow: 'hidden'
        }}
      >
        {/* Main Grid Area - Pendientes (Unified Header) */}
        <Paper
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fafafa',
            overflow: 'hidden'
          }}
        >
          {/* ... (Header and columns logic) ... */}
          {/* Unified Header */}
          <Box
            sx={{
              p: numColumns === 1 ? 1.5 : 2,
              height: numColumns === 1 ? 70 : 160, // Compact on mobile
              display: 'flex',
              flexDirection: numColumns === 1 ? 'row' : 'column', // Single row on mobile
              justifyContent: 'space-between',
              alignItems: numColumns === 1 ? 'center' : 'flex-start',
              borderBottom: 3,
              borderColor: '#1976d2',
              backgroundColor: '#1976d218',
              flexShrink: 0,
              gap: numColumns === 1 ? 1 : 0
            }}
          >
            {/* Title and count */}
            <Box>
              <Typography variant={numColumns === 1 ? 'h6' : 'h5'} fontWeight="bold">
                Pendientes
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {pendingCount} tarea{pendingCount !== 1 ? 's' : ''}
              </Typography>
            </Box>

            {/* Filters Area */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end', alignSelf: numColumns === 1 ? 'auto' : 'flex-end' }}>
              {/* Main Filter */}
              <ToggleButtonGroup
                value={newFilter}
                exclusive
                onChange={(e, newValue) => newValue && onNewFilterChange(newValue)}
                size="small"
              >
                <ToggleButton
                  value="all"
                  sx={{
                    px: 1,
                    py: 0.25,
                    fontSize: '0.7rem',
                    '&.Mui-selected': {
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      '&:hover': { backgroundColor: '#bbdefb' }
                    }
                  }}
                >
                  Todas
                </ToggleButton>
                <ToggleButton
                  value="mine"
                  sx={{
                    px: 1,
                    py: 0.25,
                    fontSize: '0.7rem',
                    '&.Mui-selected': {
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      '&:hover': { backgroundColor: '#bbdefb' }
                    }
                  }}
                >
                  Mías
                </ToggleButton>
                <ToggleButton
                  value="unassigned"
                  sx={{
                    px: 1,
                    py: 0.25,
                    fontSize: '0.7rem',
                    '&.Mui-selected': {
                      backgroundColor: '#e3f2fd',
                      color: '#1976d2',
                      '&:hover': { backgroundColor: '#bbdefb' }
                    }
                  }}
                >
                  Sin asignar
                </ToggleButton>
              </ToggleButtonGroup>

              {/* Category Filter - Hide on mobile (single column) */}
              {categories && categories.length > 0 && categoryFilter && onCategoryFilterChange && numColumns > 1 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Tooltip title="Todas las categorías">
                    <ToggleButton
                      value="all"
                      selected={categoryFilter === 'all'}
                      onClick={() => onCategoryFilterChange('all')}
                      size="small"
                      sx={{
                        px: 1,
                        py: 0.25,
                        minWidth: 32,
                        height: 32,
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                        borderRadius: 1,
                        '&.Mui-selected': {
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          '&:hover': { backgroundColor: '#bbdefb' }
                        }
                      }}
                    >
                      <AssignmentIcon sx={{ fontSize: 18 }} />
                    </ToggleButton>
                  </Tooltip>
                  
                  {categories.map((cat) => (
                    <Tooltip key={cat.id} title={cat.name}>
                      <ToggleButton
                        value={cat.id}
                        selected={categoryFilter === cat.id}
                        onClick={() => onCategoryFilterChange(categoryFilter === cat.id ? 'all' : cat.id)}
                        size="small"
                        sx={{
                          px: 1,
                          py: 0.25,
                          minWidth: 32,
                          height: 32,
                          fontSize: '1.2rem',
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          borderRadius: 1,
                          '&.Mui-selected': {
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2',
                            '&:hover': { backgroundColor: '#bbdefb' }
                          }
                        }}
                      >
                        {cat.emoji}
                      </ToggleButton>
                    </Tooltip>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

          {/* Split Columns Content */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'row', minWidth: 0, overflow: 'hidden', gap: 0.0, p: 0.2 }}>
            {Array.from({ length: numColumns }).map((_, index) => (
              <TaskColumn
                key={`Pendientes_${index}`}
                status={`Pendientes_${index}`}
                tasks={tasks[`Pendientes_${index}`] || []}
                users={users}
                categories={categories}
                onEdit={onEdit}
                onDelete={onDelete}
                onAssign={onAssign}
                onSizeChange={onSizeChange}
                hideHeader={true}
                fluidWidth={true}
                compactMode={numColumns <= 2}
                expandedTaskIds={expandedTaskIds}
                onToggleExpanded={handleToggleExpanded}
              />
            ))}
          </Box>
        </Paper>

        {/* Sidebar Area - Completadas & Weekly Score */}
        <Box sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          flexShrink: 0,
          minHeight: numColumns === 1 ? 200 : 200, // Increased on mobile due to compact header
          flexBasis: '40%',
          '@media (min-width: 700px)': {
            width: 320,
            flexBasis: 'auto',
            minHeight: 0
          }
        }}>
          
          {/* Completed Column - Set to flex: 1 to fill available space */}
          <Box sx={{
            flex: 1,
            minHeight: numColumns === 1 ? 180 : 150, // Increased on mobile due to compact header
            display: 'flex',
            flexDirection: 'column'
          }}>
            <TaskColumn
              key="Completada"
              status="Completada"
              title="Completadas"
              tasks={tasks['Completada'] || []}
              users={users}
              onEdit={onEdit}
              onDelete={onDelete}
              onAssign={onAssign}
              onSizeChange={onSizeChange}
              completedFilter={completedFilter}
              onCompletedFilterChange={onCompletedFilterChange}
              isGrid={false}
              fluidWidth={numColumns === 1}
              numColumns={numColumns}
              compactMode={numColumns <= 2}
              expandedTaskIds={expandedTaskIds}
              onToggleExpanded={handleToggleExpanded}
            />
          </Box>

          {/* Weekly Scoreboard - Hide on mobile (single column) to save space */}
          {numColumns > 1 && (
            <Paper
              sx={{
                backgroundColor: '#fff8e1',
                flexShrink: 0
              }}
            >
            <Box
              sx={{
                p: 1.5,
                backgroundColor: '#ffecb3',
                borderBottom: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <EmojiEventsIcon sx={{ color: '#ff8f00', fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight="bold">
                Esta Semana
              </Typography>
            </Box>
            {weeklyScores.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Sin puntos
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ py: 0.5 }}>
                {weeklyScores.slice(0, 5).map((user, index) => (
                  <ListItem
                    key={user.id}
                    sx={{
                      py: 0.5,
                      backgroundColor: index < 3 ? `${medalColors[index]}20` : 'transparent'
                    }}
                  >
                    <Box
                      sx={{
                        width: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 1
                      }}
                    >
                      {index < 3 ? (
                        <EmojiEventsIcon sx={{ color: medalColors[index], fontSize: 18 }} />
                      ) : (
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">
                          {index + 1}
                        </Typography>
                      )}
                    </Box>
                    <ListItemAvatar sx={{ minWidth: 38 }}>
                      <UserAvatar user={user} sx={{ width: 30, height: 30 }} showTooltip={false} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography variant="body2" noWrap sx={{ maxWidth: 80 }}>
                          {user.name?.split(' ')[0]}
                        </Typography>
                      }
                    />
                    <Chip
                      label={user.totalPoints}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        backgroundColor: index === 0 ? '#ff8f00' : 'default',
                        color: index === 0 ? 'white' : 'inherit'
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
          )}
        </Box>
      </Box>
    </DragDropContext>
  );
}
