export function formatRemaining(seconds) {
  if (seconds <= 0) return '0 seg';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes === 0) return `${secs} seg`;
  return `${minutes}m ${secs}s`;
}

export function getRiegoDisplay(current, localTick = 0) {
  const displayRemaining = Math.max(0, (current?.remaining ?? 0) - localTick);
  const isRunning = current?.status === 'running';
  const isDisconnecting = current?.status === 'disconnecting';
  const totalSeconds = current ? current.durationMin * 60 : 0;
  const progress = isRunning
    ? Math.max(0, Math.min(1, 1 - displayRemaining / Math.max(1, totalSeconds)))
    : isDisconnecting ? 1 : 0;

  return { displayRemaining, progress, isRunning, isDisconnecting };
}
