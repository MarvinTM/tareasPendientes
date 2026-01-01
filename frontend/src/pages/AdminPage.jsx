import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import api from '../services/api';
import UserAvatar from '../components/UserAvatar';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ shortName: '', color: '#000000' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError('Error al cargar los usuarios');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    setActionLoading(userId);
    try {
      await api.patch(`/admin/users/${userId}/approve`);
      fetchUsers();
    } catch (err) {
      setError('Error al aprobar el usuario');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (userId) => {
    setActionLoading(userId);
    try {
      await api.patch(`/admin/users/${userId}/revoke`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al revocar el acceso del usuario');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(deleteConfirm.id);
    try {
      await api.delete(`/admin/users/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el usuario');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditOpen = (user) => {
    setEditUser(user);
    setEditForm({
      shortName: user.shortName || '',
      color: user.color || '#1976d2'
    });
  };

  const handleEditClose = () => {
    setEditUser(null);
    setEditForm({ shortName: '', color: '#000000' });
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setActionLoading(editUser.id);
    try {
      await api.patch(`/admin/users/${editUser.id}`, editForm);
      handleEditClose();
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al actualizar el usuario');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  const pendingUsers = users.filter((u) => !u.isApproved);
  const approvedUsers = users.filter((u) => u.isApproved);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Gestión de Usuarios
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {pendingUsers.length > 0 && (
        <Box mb={4}>
          <Typography variant="h6" gutterBottom color="warning.main">
            Pendientes de Aprobación ({pendingUsers.length})
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Registrado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <UserAvatar user={user} sx={{ width: 40, height: 40 }} showTooltip={false} />
                        {user.name}
                      </Box>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <Box display="flex" gap={1} justifyContent="flex-end">
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => handleApprove(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          Aprobar
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => setDeleteConfirm(user)}
                          disabled={actionLoading === user.id}
                        >
                          Eliminar
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Typography variant="h6" gutterBottom>
        Usuarios Aprobados ({approvedUsers.length})
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Usuario</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Registrado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {approvedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <UserAvatar user={user} sx={{ width: 40, height: 40 }} showTooltip={false} />
                    {user.name}
                  </Box>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip label="Aprobado" color="success" size="small" />
                </TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <Box display="flex" gap={1} justifyContent="flex-end" alignItems="center">
                    <IconButton
                      size="small"
                      onClick={() => handleEditOpen(user)}
                      disabled={actionLoading === user.id}
                    >
                      <EditIcon />
                    </IconButton>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleRevoke(user.id)}
                      disabled={actionLoading === user.id}
                    >
                      Revocar
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit User Dialog */}
      <Dialog open={Boolean(editUser)} onClose={handleEditClose}>
        <DialogTitle>Editar Usuario</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 1, minWidth: 300 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <UserAvatar 
                user={{ ...editUser, ...editForm }} 
                sx={{ width: 64, height: 64 }} 
                showTooltip={false}
              />
              <Typography variant="body2" color="text.secondary">
                Previsualización
              </Typography>
            </Box>

            <TextField
              label="Nombre Corto"
              value={editForm.shortName}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().slice(0, 5);
                setEditForm({ ...editForm, shortName: val });
              }}
              helperText="Máximo 5 letras, mayúsculas"
              fullWidth
            />
            
            <Box>
              <Typography gutterBottom variant="caption" color="text.secondary">
                Color de Fondo
              </Typography>
              <input
                type="color"
                value={editForm.color}
                onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                style={{ width: '100%', height: 40, cursor: 'pointer' }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose}>Cancelar</Button>
          <Button onClick={handleUpdate} variant="contained">
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Eliminar Usuario</DialogTitle>
        <DialogContent>
          ¿Estás seguro de que quieres eliminar a "{deleteConfirm?.name}"? Esta acción no se puede deshacer.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} disabled={actionLoading === deleteConfirm?.id}>
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={actionLoading === deleteConfirm?.id}
          >
            {actionLoading === deleteConfirm?.id ? 'Eliminando...' : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}