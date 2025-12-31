import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import HistoryIcon from '@mui/icons-material/History';
import { Draggable } from '@hello-pangea/dnd';

export default function TaskCard({ task, index, onEdit, onDelete }) {
  const navigate = useNavigate();

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
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
              <Tooltip title={task.createdBy?.name || 'Unknown'}>
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
        </Card>
      )}
    </Draggable>
  );
}
