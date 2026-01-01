import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function CategoryDialog({ open, category, onClose, onSave }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setEmoji(category.emoji || '');
    } else {
      setName('');
      setEmoji('');
    }
  }, [category, open]);

  const handleSave = async () => {
    if (!name.trim() || !emoji.trim()) return;

    setSaving(true);
    try {
      await onSave({ name, emoji }, category?.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(category?.id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Nombre"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Box sx={{ mt: 2 }}>
          <TextField
            margin="dense"
            label="Emoji"
            fullWidth
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            required
            helperText="Introduce un emoji (puedes copiarlo desde cualquier fuente)"
            inputProps={{ style: { fontSize: 24 } }}
          />
          {emoji && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Vista previa:</Typography>
              <Typography fontSize={32}>{emoji}</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name.trim() || !emoji.trim() || saving}
        >
          {saving ? 'Guardando...' : isEdit ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
