import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { Droppable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';

const statusConfig = {
  Nueva: { title: 'Nueva', color: '#1976d2', headerBg: '#1976d218' },
  EnProgreso: { title: 'En Progreso', color: '#ed6c02', headerBg: '#ed6c0210' },
  Completada: { title: 'Completada', color: '#2e7d32', headerBg: '#2e7d3210' }
};

const getMonthName = () => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[new Date().getMonth()];
};

export default function TaskColumn({ status, title, tasks, users, categories, onEdit, onDelete, onAssign, onSizeChange, newFilter, onNewFilterChange, categoryFilter, onCategoryFilterChange, completedFilter, onCompletedFilterChange, isGrid = false, hideHeader = false, fluidWidth = false }) {
  const config = status.startsWith('Pendientes') ? statusConfig['Nueva'] : statusConfig[status];
  const displayTitle = title || config.title;

  return (
    <Paper
      elevation={hideHeader ? 0 : 1}
      sx={{
        flex: 1,
        minWidth: isGrid || fluidWidth ? 0 : 300,
        maxWidth: isGrid || fluidWidth ? '100%' : 400,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: hideHeader ? 'transparent' : '#fafafa',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {!hideHeader && (
      <Box
        sx={{
          p: 2,
          height: 160, // Increased fixed height for alignment and spacing
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderBottom: 3,
          borderColor: config.color,
          backgroundColor: config.headerBg,
          flexShrink: 0
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              {displayTitle}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {tasks.length} tarea{tasks.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>

        {/* Filters Area */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
          {status === 'Completada' && completedFilter && onCompletedFilterChange && (
            <ToggleButtonGroup
              value={completedFilter}
              exclusive
              onChange={(e, newValue) => newValue && onCompletedFilterChange(newValue)}
              size="small"
            >
              <ToggleButton
                value="week"
                sx={{
                  px: 1,
                  py: 0.25,
                  fontSize: '0.7rem',
                  '&.Mui-selected': {
                    backgroundColor: '#e8f5e9',
                    color: '#2e7d32',
                    '&:hover': { backgroundColor: '#c8e6c9' }
                  }
                }}
              >
                Semana
              </ToggleButton>
              <ToggleButton
                value="month"
                sx={{
                  px: 1,
                  py: 0.25,
                  fontSize: '0.7rem',
                  '&.Mui-selected': {
                    backgroundColor: '#e8f5e9',
                    color: '#2e7d32',
                    '&:hover': { backgroundColor: '#c8e6c9' }
                  }
                }}
              >
                {getMonthName()}
              </ToggleButton>
              <ToggleButton
                value="year"
                sx={{
                  px: 1,
                  py: 0.25,
                  fontSize: '0.7rem',
                  '&.Mui-selected': {
                    backgroundColor: '#e8f5e9',
                    color: '#2e7d32',
                    '&:hover': { backgroundColor: '#c8e6c9' }
                  }
                }}
              >
                {new Date().getFullYear()}
              </ToggleButton>
            </ToggleButtonGroup>
          )}

          {/* Secondary Category Filter for "Nueva" column - This part is usually hidden by hideHeader but kept for consistency if needed elsewhere */}
          {status.startsWith('Pendientes') && categories && categories.length > 0 && categoryFilter && onCategoryFilterChange && (
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
      )}

      <Droppable droppableId={status} direction="vertical">
        {(provided, snapshot) => (
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              flex: 1,
              p: 1,
              backgroundColor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
              transition: 'background-color 0.2s ease',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}
          >
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                index={index}
                users={users}
                onEdit={onEdit}
                onDelete={onDelete}
                onAssign={onAssign}
                onSizeChange={onSizeChange}
              />
            ))}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
    </Paper>
  );
}
