let io = null;

export function setIO(socketIO) {
  io = socketIO;
}

export function getIO() {
  return io;
}

export function emitTaskUpdate(event, data) {
  if (io) {
    io.emit(event, data);
  }
}

export function emitDeviceUpdate(data) {
  if (io) {
    io.emit('device:updated', data);
  }
}

export function emitDevicePulse(data) {
  if (io) {
    io.emit('device:pulsed', data);
  }
}

export function emitRiegoUpdate(data) {
  if (io) {
    io.emit('riego:updated', data);
  }
}

export function emitInverterData(data) {
  if (io) {
    io.emit('inverter:data', data);
  }
}
