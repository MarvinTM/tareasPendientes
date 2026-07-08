export const REGISTERS = [
  // ---- Identity (30000-30099) ----
  { label: 'Model',              addr: 30000, count: 15, type: 'string' },
  { label: 'Serial Number',      addr: 30015, count: 10, type: 'string' },
  { label: 'Rated Power (Pn)',   addr: 30074, count: 1,  type: 'uint16', unit: 'W' },
  { label: 'Max Apparent Power', addr: 30076, count: 1,  type: 'uint16', unit: 'VA' },
  { label: 'Max Active Power',   addr: 30078, count: 1,  type: 'uint16', unit: 'W' },
  { label: 'PV Strings',         addr: 30071, count: 1,  type: 'uint16' },
  { label: 'MPPT Trackers',      addr: 30072, count: 1,  type: 'uint16' },
  { label: 'Running Time',       addr: 30070, count: 1,  type: 'uint16', unit: 'h' },

  // ---- Status (32000-32009) ----
  { label: 'Running State',      addr: 32000, count: 1, type: 'uint16', map: { 0:'Standby', 1:'Self-check', 6:'On-Grid' } },
  { label: 'Daily Start Count',  addr: 32001, count: 1, type: 'uint16' },
  { label: 'Alarm Flags',        addr: 32002, count: 1, type: 'uint16', desc: 'Active alarm bitmask' },

  // ---- Yield (32064-32073) ----
  { label: 'Daily Yield',        addr: 32064, count: 2, type: 'uint32', unit: 'kWh', scale: 0.01 },
  { label: 'Total Yield',        addr: 32072, count: 2, type: 'uint32', unit: 'kWh', scale: 0.01 },

  // ---- PV Strings (32016-32019) ----
  { label: 'PV1 Voltage',        addr: 32016, count: 1, type: 'uint16', unit: 'V',   scale: 0.1,  id: 'pv1V' },
  { label: 'PV1 Current',        addr: 32017, count: 1, type: 'uint16', unit: 'A',   scale: 0.01, id: 'pv1I' },
  { label: 'PV2 Voltage',        addr: 32018, count: 1, type: 'uint16', unit: 'V',   scale: 0.1,  id: 'pv2V' },
  { label: 'PV2 Current',        addr: 32019, count: 1, type: 'uint16', unit: 'A',   scale: 0.01, id: 'pv2I' },

  // ---- Grid / Internal (32069, 32079-32087) ----
  { label: 'Grid Voltage',       addr: 32069, count: 1, type: 'uint16', unit: 'V',   scale: 0.1,  desc: 'Phase A voltage' },
  { label: 'Dc Bus Voltage',     addr: 32079, count: 1, type: 'uint16', unit: 'V',   scale: 0.1 },
  { label: 'Active Power',       addr: 32080, count: 2, type: 'int32',  unit: 'W',   desc: 'Inverter output' },

  // ---- Grid & Meter (32085, 32087, 37113-37114) ----
  { label: 'Grid Frequency',     addr: 32085, count: 1, type: 'uint16', unit: 'Hz',  scale: 0.01 },
  { label: 'Temperature',        addr: 32087, count: 1, type: 'uint16', unit: '°C',  scale: 0.1,  desc: 'Internal temp' },
  { label: 'Meter Active Power', addr: 37113, count: 2, type: 'int32',  unit: 'W',   desc: 'Grid meter: +import, −export', meter: true },

  // ---- Power Limiting (40118) ----
  { label: 'Grid Pwr Limit',     addr: 40118, count: 1, type: 'uint16', unit: 'W',   desc: 'Active power export limit' },

  // ---- Battery (37000-37015, LUNA2000 live telemetry — Master only) ----
  { label: 'Batt Status',        addr: 37000, count: 1,  type: 'uint16', desc: 'Operating status', battery: true },
  { label: 'Batt Current',       addr: 37002, count: 1,  type: 'int16',  unit: 'A',   scale: 0.01, desc: '−discharge / +charge', battery: true },
  { label: 'Batt Voltage',       addr: 37003, count: 1,  type: 'uint16', unit: 'V',   scale: 0.01, battery: true },
  { label: 'Batt SOC',           addr: 37004, count: 1,  type: 'uint16', unit: '%',   scale: 0.1,  desc: 'State of charge', battery: true },
  { label: 'Batt SOH',           addr: 37005, count: 1,  type: 'uint16', unit: '%',   scale: 0.1,  desc: 'State of health', battery: true },
  { label: 'Batt Temperature',   addr: 37007, count: 1,  type: 'uint16', unit: '°C',  scale: 0.1,  battery: true },
  // Battery configuration/settings (47000 range)
  { label: 'Batt Max Chg Power', addr: 47080, count: 1,  type: 'uint16', unit: 'W',   battery: true },
  { label: 'Batt Max Dis Power', addr: 47088, count: 1,  type: 'uint16', unit: 'W',   battery: true },
  { label: 'Batt Work Mode',     addr: 47150, count: 1,  type: 'uint16', battery: true },
  { label: 'Batt Chg/Dis St',    addr: 47152, count: 1,  type: 'uint16', desc: 'Charge/discharge state', battery: true },
  { label: 'Batt Min SOC',       addr: 47420, count: 1,  type: 'uint16', unit: '%',   desc: 'Discharge cutoff', battery: true },
  { label: 'Batt Max SOC',       addr: 47421, count: 1,  type: 'uint16', unit: '%',   desc: 'Charge cutoff', battery: true },
  { label: 'Batt Backup SOC',    addr: 47423, count: 1,  type: 'uint16', unit: '%',   desc: 'Backup reserve', battery: true },
  { label: 'Batt Max Chg Cur',   addr: 47428, count: 1,  type: 'uint16', unit: 'A',   scale: 0.1, battery: true },
  { label: 'Batt Max Dis Cur',   addr: 47429, count: 1,  type: 'uint16', unit: 'A',   scale: 0.1, battery: true },
];

export function computeDerived(values) {
  const derived = {};

  const v1 = values['PV1 Voltage'];
  const i1 = values['PV1 Current'];
  const v2 = values['PV2 Voltage'];
  const i2 = values['PV2 Current'];
  const acPwr = values['Active Power'];

  if (typeof v1 === 'number' && typeof i1 === 'number')
    derived['MPPT1 Power'] = { value: Math.round(v1 * i1), unit: 'W', desc: 'V1 × I1' };
  if (typeof v2 === 'number' && typeof i2 === 'number')
    derived['MPPT2 Power'] = { value: Math.round(v2 * i2), unit: 'W', desc: 'V2 × I2' };

  const pv1 = derived['MPPT1 Power']?.value || 0;
  const pv2 = derived['MPPT2 Power']?.value || 0;
  if (pv1 + pv2 > 0)
    derived['Total PV DC'] = { value: pv1 + pv2, unit: 'W', desc: 'MPPT1 + MPPT2' };

  if (typeof acPwr === 'number' && pv1 + pv2 > 0)
    derived['Efficiency'] = { value: Math.round(acPwr / (pv1 + pv2) * 100), unit: '%', desc: 'AC ÷ DC' };

  return derived;
}
