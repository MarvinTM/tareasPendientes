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
        <Route index element={<MainPage />} />
        <Route path="scoreboard" element={<ScoreboardPage />} />
        <Route path="history" element={<AllHistoryPage />} />
        <Route path="history/:taskId" element={<TaskHistoryPage />} />
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/categories"
          element={
            <AdminRoute>
              <CategoriesAdminPage />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
