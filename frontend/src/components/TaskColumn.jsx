import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';

const statusConfig = {
  NEW: { title: 'Nuevas', color: '#1976d2' },
  ONGOING: { title: 'En Progreso', color: '#ed6c02' },
  BACKLOG: { title: 'Pendientes', color: '#9c27b0' }
};

export default function TaskColumn({ status, tasks, onEdit, onDelete }) {
  const config = statusConfig[status];

  return (
    <Paper
      sx={{
        flex: 1,
        minWidth: 300,
        maxWidth: 400,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fafafa'
      }}
    >
      <Box
        sx={{
          p: 2,
          borderBottom: 3,
          borderColor: config.color
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {config.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {tasks.length} tarea{tasks.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              flex: 1,
              p: 1,
              minHeight: 200,
              backgroundColor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
              transition: 'background-color 0.2s ease'
            }}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </Paper>
  );
}
