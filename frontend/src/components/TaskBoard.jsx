import Box from '@mui/material/Box';
import { DragDropContext } from '@hello-pangea/dnd';
import TaskColumn from './TaskColumn';

const STATUSES = ['NEW', 'ONGOING', 'BACKLOG'];

export default function TaskBoard({ tasks, onDragEnd, onEdit, onDelete }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 2
        }}
      >
        {STATUSES.map((status) => (
          <TaskColumn
            key={status}
            status={status}
            tasks={tasks[status] || []}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </Box>
    </DragDropContext>
  );
}
