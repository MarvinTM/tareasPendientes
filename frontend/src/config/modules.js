import ChecklistRtlIcon from '@mui/icons-material/ChecklistRtl';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

export const modules = [
  {
    id: 'tareas',
    label: 'Tareas',
    icon: ChecklistRtlIcon,
    path: '/tareas',
    subNav: [
      { label: 'Tablero', path: '/tareas' },
      { label: 'Recurrentes', path: '/tareas/recurrentes' },
      { label: 'Puntuación', path: '/tareas/puntuacion' },
    ],
  },
  {
    id: 'dispositivos',
    label: 'Dispositivos',
    icon: LightbulbIcon,
    path: '/dispositivos',
    subNav: [
      { label: 'Luces', path: '/dispositivos/luces' },
    ],
  },
  {
    id: 'riego',
    label: 'Riego',
    icon: WaterDropIcon,
    path: '/riego',
    subNav: [
      { label: 'Control', path: '/riego' },
      { label: 'Planes', path: '/riego/planes' },
      { label: 'Histórico de Riegos', path: '/riego/eventos' },
    ],
  },
  {
    id: 'usuario',
    label: 'Usuario',
    icon: PersonIcon,
    path: '/usuario',
    subNav: [
      { label: 'Historial', path: '/usuario/historial' },
      { label: 'Configuración', path: '/usuario/configuracion' },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: AdminPanelSettingsIcon,
    path: '/admin',
    adminOnly: true,
    subNav: [
      { label: 'Usuarios', path: '/admin' },
      { label: 'Categorías', path: '/admin/categorias' },
    ],
  },
];
