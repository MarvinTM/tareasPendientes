export const SOLAR_COLORS = {
  solar: '#f9a825',
  house: '#1565c0',
  battery: '#43a047',
  grid: '#e53935',
  gridImport: '#ef6c00',
  gridExport: '#00897b',
};

export function getSolarMetrics(master = {}, slave = {}) {
  const solarProduction = Math.round((master.pvPower || 0) + (slave.pvPower || 0));
  const meterPower = master.meterPower != null ? master.meterPower : null;
  const batteryPower = master.battPower != null ? master.battPower : null;
  const batterySoc = master.battSoc != null ? master.battSoc : null;
  const houseConsumption = meterPower != null
    ? Math.max(0, Math.round(solarProduction + (batteryPower || 0) - (meterPower || 0)))
    : null;

  return {
    solarProduction,
    houseConsumption,
    batteryPower,
    batterySoc,
    gridPower: meterPower,
  };
}

export function formatWatts(value) {
  return value == null ? '—' : `${Math.round(value).toLocaleString()} W`;
}
