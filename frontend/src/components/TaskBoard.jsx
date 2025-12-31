import Box from '@mui/material/Box';
import { DragDropContext } from '@hello-pangea/dnd';
import TaskColumn from './TaskColumn';

const STATUSES = ['Nueva', 'EnProgreso', 'Completada'];

export default function TaskBoard({ tasks, users, onDragEnd, onEdit, onDelete, onAssign }) {
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
            users={users}
            onEdit={onEdit}
            onDelete={onDelete}
            onAssign={onAssign}
          />
        ))}
      </Box>
    </DragDropContext>
  );
}
