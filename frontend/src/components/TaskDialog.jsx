import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';

const sizeConfig = {
  Pequena: { label: 'S', color: '#4caf50', tooltip: 'Pequeña - menos de 1 hora' },
  Mediana: { label: 'M', color: '#ff9800', tooltip: 'Mediana - entre 1 y 2 horas' },
  Grande: { label: 'L', color: '#f44336', tooltip: 'Grande - más de 2 horas' }
};

export default function TaskDialog({ open, task, onClose, onSave, users = [], categories = [] }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setSize(task.size || '');
      setAssignedToId(task.assignedTo?.id || '');
      setCategoryId(task.category?.id || '');
    } else {
      setTitle('');
      setDescription('');
      setSize('');
      setAssignedToId('');
      setCategoryId('');
    }
  }, [task, open]);

  const handleSave = async () => {
    if (!title.trim() || !size || !categoryId) return;

    setSaving(true);
    try {
      const data = { title, description, size, categoryId };
      if (!task?.id) {
        // Only include assignedToId for new tasks
        data.assignedToId = assignedToId || null;
      }
      await onSave(data, task?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(task?.id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Título"
          fullWidth
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <TextField
          margin="dense"
          label="Descripción"
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <FormControl fullWidth sx={{ mt: 2 }} required>
          <InputLabel>Categoría</InputLabel>
          <Select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            label="Categoría"
          >
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                <Box display="flex" alignItems="center" gap={1}>
                  <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                  {cat.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Dificultad *
          </Typography>
          <ToggleButtonGroup
            value={size}
            exclusive
            onChange={(e, newSize) => newSize && setSize(newSize)}
            fullWidth
          >
            {Object.entries(sizeConfig).map(([key, config]) => (
              <Tooltip key={key} title={config.tooltip} arrow>
                <ToggleButton
                  value={key}
                  sx={{
                    py: 1,
                    fontWeight: 'bold',
                    color: size === key ? 'white' : config.color,
                    borderColor: config.color,
                    '&.Mui-selected': {
                      backgroundColor: config.color,
                      color: 'white',
                      '&:hover': {
                        backgroundColor: config.color
                      }
                    },
                    '&:hover': {
                      backgroundColor: `${config.color}20`
                    }
                  }}
                >
                  {config.label}
                </ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>
        </Box>

        {!isEdit && (
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Asignar a (opcional)</InputLabel>
            <Select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              label="Asignar a (opcional)"
            >
              <MenuItem value="">
                <em>Sin asignar</em>
              </MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!title.trim() || !size || !categoryId || saving}
        >
          {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
