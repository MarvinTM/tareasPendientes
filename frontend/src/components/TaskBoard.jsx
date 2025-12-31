import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { DragDropContext } from '@hello-pangea/dnd';
import TaskColumn from './TaskColumn';

const STATUSES = ['Nueva', 'EnProgreso', 'Completada'];

const medalColors = {
  0: '#FFD700', // Gold
  1: '#C0C0C0', // Silver
  2: '#CD7F32'  // Bronze
};

export default function TaskBoard({ tasks, users, weeklyScores, onDragEnd, onEdit, onDelete, onAssign, onSizeChange, newFilter, onNewFilterChange, completedFilter, onCompletedFilterChange }) {
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
            onSizeChange={onSizeChange}
            newFilter={newFilter}
            onNewFilterChange={onNewFilterChange}
            completedFilter={completedFilter}
            onCompletedFilterChange={onCompletedFilterChange}
          />
        ))}

        <Paper
          sx={{
            minWidth: 200,
            maxWidth: 200,
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
                  <ListItemAvatar sx={{ minWidth: 32 }}>
                    <Avatar src={user.picture} sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                      {user.name?.[0]}
                    </Avatar>
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
      </Box>
    </DragDropContext>
  );
}
