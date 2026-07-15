import { describe, expect, it } from 'vitest';
import GarageIcon from '@mui/icons-material/Garage';
import { getGroupIcon } from '../../utils/iconMap';

describe('getGroupIcon', () => {
  it('exposes the Garage icon for device groups', () => {
    expect(getGroupIcon('Garage')).toBe(GarageIcon);
  });
});
