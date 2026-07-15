import LightbulbIcon from '@mui/icons-material/Lightbulb';
import PoolIcon from '@mui/icons-material/Pool';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import GrassIcon from '@mui/icons-material/Grass';
import YardIcon from '@mui/icons-material/Yard';
import WaterIcon from '@mui/icons-material/WaterDrop';
import WavesIcon from '@mui/icons-material/Waves';
import GarageIcon from '@mui/icons-material/Garage';

const ICONS = {
  Lightbulb: LightbulbIcon,
  Pool: PoolIcon,
  LocalFlorist: LocalFloristIcon,
  Grass: GrassIcon,
  Yard: YardIcon,
  WaterDrop: WaterIcon,
  Waves: WavesIcon,
  Garage: GarageIcon,
};

export function getGroupIcon(iconName) {
  return ICONS[iconName] || LightbulbIcon;
}

export function getPhaseIcon(iconName) {
  return ICONS[iconName] || WaterIcon;
}
