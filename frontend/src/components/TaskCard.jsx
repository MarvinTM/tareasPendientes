import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import PersonIcon from '@mui/icons-material/Person';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import { Draggable } from '@hello-pangea/dnd';

export default function TaskCard({ task, index, users, onEdit, onDelete, onAssign }) {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleOpenMenu = (event) => {
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

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          sx={{
            mb: 1,
            backgroundColor: snapshot.isDragging ? 'action.hover' : 'background.paper',
            '&:hover': {
              boxShadow: 3
            }
          }}
        >
          <CardContent sx={{ pb: 1 }}>
            <Typography variant="subtitle1" component="div" fontWeight="medium">
              {task.title}
            </Typography>
            {task.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {task.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title={`Creado por: ${task.createdBy?.name || 'Desconocido'}`}>
                  <Avatar
                    src={task.createdBy?.picture}
                    sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
                  >
                    {task.createdBy?.name?.[0]}
                  </Avatar>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  {new Date(task.createdAt).toLocaleDateString()}
                </Typography>
              </Box>

              <Tooltip title={task.assignedTo ? `Asignado a: ${task.assignedTo.name}` : 'Sin asignar - clic para asignar'}>
                <IconButton
                  size="small"
                  onClick={handleOpenMenu}
                  sx={{
                    border: '2px solid',
                    borderColor: task.assignedTo ? 'primary.main' : 'grey.300',
                    p: 0.25
                  }}
                >
                  {task.assignedTo ? (
                    <Avatar
                      src={task.assignedTo.picture}
                      sx={{ width: 22, height: 22, fontSize: '0.7rem' }}
                    >
                      {task.assignedTo.name?.[0]}
                    </Avatar>
                  ) : (
                    <PersonIcon fontSize="small" color="disabled" />
                  )}
                </IconButton>
              </Tooltip>
            </Box>
          </CardContent>

          <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
            <Tooltip title="Ver Historial">
              <IconButton size="small" onClick={() => navigate(`/history/${task.id}`)}>
                <HistoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => onEdit(task)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Eliminar">
              <IconButton size="small" onClick={() => onDelete(task)} color="error">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </CardActions>

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
                  <Avatar src={user.picture} sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                    {user.name?.[0]}
                  </Avatar>
                </ListItemIcon>
                <ListItemText>{user.name}</ListItemText>
              </MenuItem>
            ))}
            {task.assignedTo && (
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
