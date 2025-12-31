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
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import api from '../services/api';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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
                        <Avatar src={user.picture} sx={{ width: 32, height: 32 }}>
                          {user.name?.[0]}
                        </Avatar>
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
                    <Avatar src={user.picture} sx={{ width: 32, height: 32 }}>
                      {user.name?.[0]}
                    </Avatar>
                    {user.name}
                  </Box>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Chip label="Aprobado" color="success" size="small" />
                </TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={() => handleRevoke(user.id)}
                    disabled={actionLoading === user.id}
                  >
                    Revocar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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
