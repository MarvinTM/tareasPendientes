import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { emitDeviceUpdate } from '../socket.js';
import {
  fetchAllStatuses,
  toggleDevice,
  getDeviceById,
} from '../services/shelly.js';
import { logActivity, ACTIONS } from '../services/activityLog.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const devices = await fetchAllStatuses();
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

router.post('/:deviceId/toggle', authenticateToken, async (req, res) => {
  const { deviceId } = req.params;

  try {
    const device = getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const result = await toggleDevice(deviceId);

    const action = result.on ? ACTIONS.DEVICE_TURNED_ON : ACTIONS.DEVICE_TURNED_OFF;
    logActivity(req.user.id, action, deviceId, device.name, { newState: result.on })
      .catch(err => console.error('Failed to log device activity:', err));

    emitDeviceUpdate({ id: deviceId, ...device, ...result });

    res.json({ id: deviceId, ...result });
  } catch (error) {
    if (error.message?.includes('Shelly API error') || error.message?.includes('Shelly API returned')) {
      console.error(`Toggle error for ${deviceId}:`, error.message);
      return res.status(502).json({ error: 'Shelly device unreachable' });
    }
    console.error(`Toggle error for ${deviceId}:`, error);
    res.status(500).json({ error: 'Failed to toggle device' });
  }
});

export default router;
