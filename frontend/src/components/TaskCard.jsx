import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Draggable } from '@hello-pangea/dnd';
import UserAvatar from './UserAvatar';

const sizeConfig = {
  Pequena: { label: 'S', color: '#4caf50', tooltip: 'Pequeña - menos de 1 hora' },
  Mediana: { label: 'M', color: '#ff9800', tooltip: 'Mediana - entre 1 y 2 horas' },
  Grande: { label: 'L', color: '#f44336', tooltip: 'Grande - más de 2 horas' }
};

export default function TaskCard({ task, index, users, onEdit, onDelete, onAssign, onSizeChange, compactMode = false, isExpanded = false, onToggleExpanded }) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const isCompleted = task.status === 'Completada';
  const isUnassignedNew = task.status === 'Nueva' && !task.assignedTo;

  // In compact mode, show minimal view unless expanded
  const showCompact = compactMode && !isExpanded;

  const handleOpenMenu = (event) => {
    if (isCompleted) return;
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleAssign = (userId) => {
    onAssign(task.id, userId);
    handleCloseMenu();
  };

  const handleSizeChange = (event, newSize) => {
    event.stopPropagation();
    if (newSize && newSize !== task.size) {
      onSizeChange(task.id, newSize);
    }
  };

  const handleCardClick = (e) => {
    // Only toggle in compact mode, and don't toggle if clicking on interactive elements
    if (compactMode && !e.defaultPrevented && onToggleExpanded) {
      onToggleExpanded(task.id);
    }
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={handleCardClick}
          sx={{
            mb: 1,
            minHeight: showCompact ? 56 : 170, // Use minHeight for Safari compatibility
            height: 'auto',
            flexShrink: 0, // Prevent Safari from collapsing cards
            transition: 'min-height 0.2s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: showCompact ? 'center' : 'space-between',
            cursor: compactMode ? 'pointer' : 'default',
            backgroundColor: snapshot.isDragging
              ? 'action.hover'
              : task.status === 'Completada'
                ? '#e8f5e9'
                : isUnassignedNew
                  ? '#fce4ec'
                  : 'background.paper',
            borderLeft: task.status === 'Completada'
              ? '4px solid #2e7d32'
              : isUnassignedNew
                ? '4px solid #e91e63'
                : 'none',
            '&:hover': {
              boxShadow: 3
            }
          }}
        >
          {showCompact ? (
            /* Compact View - Single row with essential info */
            <CardContent sx={{ py: 1, px: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title={task.category?.name || 'Sin categoría'}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>
                  {task.category?.emoji || '📋'}
                </span>
              </Tooltip>
              <Typography
                variant="body2"
                fontWeight="bold"
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.9rem'
                }}
              >
                {task.title}
              </Typography>
              <Tooltip title={sizeConfig[task.size || 'Pequena']?.tooltip}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '4px',
                    backgroundColor: sizeConfig[task.size || 'Pequena']?.color,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    flexShrink: 0
                  }}
                >
                  {sizeConfig[task.size || 'Pequena']?.label}
                </Box>
              </Tooltip>
              {task.assignedTo ? (
                <Tooltip title={`Asignado a: ${task.assignedTo.name}`}>
                  <Box sx={{ flexShrink: 0 }}>
                    <UserAvatar
                      user={task.assignedTo}
                      sx={{ width: 26, height: 26 }}
                      showTooltip={false}
                    />
                  </Box>
                </Tooltip>
              ) : (
                <Tooltip title={isUnassignedNew ? "¡Sin asignar!" : "Sin asignar"}>
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: '2px solid',
                      borderColor: isUnassignedNew ? '#e91e63' : 'grey.300',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      animation: isUnassignedNew ? 'pulse 2s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.6 }
                      }
                    }}
                  >
                    {isUnassignedNew ? (
                      <PersonAddIcon sx={{ fontSize: 14, color: '#e91e63' }} />
                    ) : (
                      <PersonIcon sx={{ fontSize: 14, color: 'grey.400' }} />
                    )}
                  </Box>
                </Tooltip>
              )}
            </CardContent>
          ) : (
            /* Expanded/Full View - Original layout */
            <CardContent sx={{ pb: 1, flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, flex: 1, minWidth: 0 }}>
                  <Tooltip title={task.category?.name || 'Sin categoría'}>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>
                      {task.category?.emoji || '📋'}
                    </span>
                  </Tooltip>
                  <Typography
                    variant="body1"
                    component="div"
                    fontWeight="bold"
                    sx={{
                      fontSize: '1.05rem',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}
                  >
                    {task.title}
                  </Typography>
                </Box>
                <Box sx={{ flexShrink: 0 }}>
                  <ToggleButtonGroup
                    value={task.size || 'Pequena'}
                    exclusive
                    onChange={handleSizeChange}
                    size="small"
                    disabled={isCompleted}
                    sx={{ minHeight: 24 }}
                  >
                    {Object.entries(sizeConfig).map(([size, config]) => (
                      <Tooltip key={size} title={config.tooltip} arrow>
                        <span>
                          <ToggleButton
                            value={size}
                            sx={{
                              px: 0.75,
                              py: 0,
                              minWidth: 24,
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              color: (task.size || 'Pequena') === size ? 'white' : config.color,
                              borderColor: config.color,
                              backgroundColor: (task.size || 'Pequena') === size ? config.color : 'transparent',
                              '&:hover': {
                                backgroundColor: (task.size || 'Pequena') === size ? config.color : `${config.color}20`
                              },
                              '&.Mui-selected': {
                                backgroundColor: config.color,
                                color: 'white',
                                '&:hover': {
                                  backgroundColor: config.color
                                }
                              },
                              '&.Mui-disabled': {
                                color: (task.size || 'Pequena') === size ? 'white' : `${config.color}80`,
                                backgroundColor: (task.size || 'Pequena') === size ? config.color : 'transparent',
                                borderColor: `${config.color}80`
                              }
                            }}
                          >
                            {config.label}
                          </ToggleButton>
                        </span>
                      </Tooltip>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              </Box>

              <Box sx={{ mt: 1, mb: 1, height: 36, overflow: 'hidden', flexShrink: 0 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '0.85rem',
                    lineHeight: 1.4
                  }}
                >
                  {task.description || (
                    <Box component="span" sx={{ fontStyle: 'italic', opacity: 0.4 }}>
                      Sin descripción
                    </Box>
                  )}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Tooltip title={`Creado por: ${task.createdBy?.name || 'Desconocido'}`}>
                    <Box component="span">
                      <UserAvatar
                        user={task.createdBy}
                        sx={{ width: 32, height: 32 }}
                        showTooltip={false}
                      />
                    </Box>
                  </Tooltip>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(task.createdAt).toLocaleDateString()}
                  </Typography>
                  {isCompleted && task.completedAt && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckCircleIcon sx={{ fontSize: 14, color: '#2e7d32' }} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(task.completedAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {task.assignedTo ? (
                  <Tooltip title={`Asignado a: ${task.assignedTo.name}`}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={handleOpenMenu}
                        disabled={isCompleted}
                        sx={{
                          border: '2px solid',
                          borderColor: 'primary.main',
                          p: 0.25,
                          cursor: isCompleted ? 'default' : 'pointer'
                        }}
                      >
                        <UserAvatar
                          user={task.assignedTo}
                          sx={{ width: 30, height: 30 }}
                          showTooltip={false}
                        />
                      </IconButton>
                    </span>
                  </Tooltip>
                ) : !isCompleted ? (
                  <Tooltip title={isUnassignedNew ? "¡Sin asignar! - clic para asignar" : "Sin asignar - clic para asignar"}>
                    <IconButton
                      size="small"
                      onClick={handleOpenMenu}
                      sx={{
                        border: '2px solid',
                        borderColor: isUnassignedNew ? '#e91e63' : 'grey.300',
                        p: 0.25,
                        animation: isUnassignedNew ? 'pulse 2s infinite' : 'none',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.6 }
                        }
                      }}
                    >
                      {isUnassignedNew ? (
                        <PersonAddIcon fontSize="small" sx={{ color: '#e91e63' }} />
                      ) : (
                        <PersonIcon fontSize="small" color="disabled" />
                      )}
                    </IconButton>
                  </Tooltip>
                ) : null}
              </Box>
            </CardContent>
          )}

          {!showCompact && (
            <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
              <Tooltip title="Ver Historial">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); navigate(`/history/${task.id}`); }}>
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {!isCompleted && (
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(task); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Eliminar">
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(task); }} color="error">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </CardActions>
          )}

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
            onClick={(e) => e.stopPropagation()}
          >
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                Asignar a:
              </Typography>
            </MenuItem>
            <Divider />
            {users.map((user) => (
              <MenuItem
                key={user.id}
                onClick={() => handleAssign(user.id)}
                selected={task.assignedTo?.id === user.id}
              >
                <ListItemIcon>
                  <UserAvatar user={user} sx={{ width: 32, height: 32 }} showTooltip={false} />
                </ListItemIcon>
                <ListItemText>{user.name}</ListItemText>
              </MenuItem>
            ))}
            {task.assignedTo && task.status === 'Nueva' && (
              <>
                <Divider />
                <MenuItem onClick={() => handleAssign(null)}>
                  <ListItemIcon>
                    <PersonOffIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Quitar asignación</ListItemText>
                </MenuItem>
              </>
            )}
          </Menu>
        </Card>
      )}
    </Draggable>
  );
}