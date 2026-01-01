import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    // Only connect if user is authenticated
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Construct socket URL based on environment
    let socketUrl;
    if (import.meta.env.VITE_API_URL) {
      socketUrl = import.meta.env.VITE_API_URL;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      socketUrl = '';
    } else {
      // nip.io development
      const backendPort = 3001;
      socketUrl = `${window.location.protocol}//${window.location.hostname}:${backendPort}`;
    }

    const newSocket = io(socketUrl, {
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
