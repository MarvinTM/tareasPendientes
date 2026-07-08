import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import TaskHistoryPage from './pages/TaskHistoryPage';
import AllHistoryPage from './pages/AllHistoryPage';
import AdminPage from './pages/AdminPage';
import CategoriesAdminPage from './pages/CategoriesAdminPage';
import ScoreboardPage from './pages/ScoreboardPage';
import PeriodicTasksPage from './pages/PeriodicTasksPage';
import DevicesPage from './pages/DevicesPage';
import RiegoPage from './pages/RiegoPage';
import RiegoPlansPage from './pages/RiegoPlansPage';
import RiegoEventsPage from './pages/RiegoEventsPage';
import ActivationPlansPage from './pages/ActivationPlansPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import SolarPage from './pages/SolarPage';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

function ProtectedRoute({ children, requireApproval = true }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requireApproval && !user.isApproved) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" flexDirection="column" gap={2}>
        <h2>Cuenta Pendiente de Aprobación</h2>
        <p>Tu cuenta está esperando la aprobación del administrador. Por favor, vuelve más tarde.</p>
      </Box>
    );
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!user || !user.isAdmin) {
    return <Navigate to="/" />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/tareas" replace />} />
        <Route path="tareas" element={<MainPage />} />
        <Route path="tareas/recurrentes" element={<PeriodicTasksPage />} />
        <Route path="tareas/puntuacion" element={<ScoreboardPage />} />
        <Route path="usuario" element={<Navigate to="/usuario/historial" replace />} />
        <Route path="usuario/historial" element={<AllHistoryPage />} />
        <Route path="usuario/historial/:taskId" element={<TaskHistoryPage />} />
        <Route path="usuario/configuracion" element={<ConfiguracionPage />} />
        <Route path="dispositivos" element={<DevicesPage />} />
        <Route path="dispositivos/planes" element={<ActivationPlansPage />} />
        <Route path="riego" element={<RiegoPage />} />
        <Route path="riego/planes" element={<RiegoPlansPage />} />
        <Route path="riego/eventos" element={<RiegoEventsPage />} />
        <Route path="solar" element={<SolarPage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/categorias"
          element={
            <AdminRoute>
              <CategoriesAdminPage />
            </AdminRoute>
          }
        />
        <Route path="periodic" element={<Navigate to="/tareas/recurrentes" replace />} />
        <Route path="scoreboard" element={<Navigate to="/tareas/puntuacion" replace />} />
        <Route path="history" element={<Navigate to="/usuario/historial" replace />} />
        <Route path="history/:taskId" element={<Navigate to="/usuario/historial/:taskId" replace />} />
        <Route path="admin/categories" element={<Navigate to="/admin/categorias" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
