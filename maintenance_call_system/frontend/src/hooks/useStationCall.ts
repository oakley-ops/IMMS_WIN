import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import svc, { BadgeReader, MaintenanceCall } from '../services/maintenanceCallService';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4001';

interface State {
  reader: BadgeReader | null;
  activeCall: MaintenanceCall | null;
  loading: boolean;
  error: string;
  refreshCall: () => void;
  setActiveCall: (c: MaintenanceCall | null) => void;
}

/**
 * Fetches reader info by key, then keeps the active call for that reader's
 * machine in sync via Socket.io and a 10s polling fallback.
 */
export function useStationCall(readerKey: string): State {
  const [reader, setReader] = useState<BadgeReader | null>(null);
  const [activeCall, setActiveCall] = useState<MaintenanceCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshCall = useCallback(async () => {
    if (!reader) return;
    try {
      const calls = await svc.getActiveCalls();
      setActiveCall(calls.find((c) => c.machine_id === reader.machine_id) || null);
    } catch { /* non-fatal */ }
  }, [reader]);

  useEffect(() => {
    if (!readerKey) {
      setError('No ?reader= key in URL');
      setLoading(false);
      return;
    }
    svc.getReaderInfo(readerKey)
      .then((r) => { setReader(r); setLoading(false); })
      .catch(() => {
        setError('Reader not found. Check the reader key in the URL.');
        setLoading(false);
      });
  }, [readerKey]);

  useEffect(() => {
    if (!reader) return;
    refreshCall();

    const socket = io(SOCKET_URL, { transports: ['polling', 'websocket'] });
    socket.on('maintenance_call_created', refreshCall);
    socket.on('maintenance_call_updated', refreshCall);
    socket.on('maintenance_call_resolved', refreshCall);

    const poll = setInterval(refreshCall, 10000);

    return () => {
      socket.disconnect();
      clearInterval(poll);
    };
  }, [reader, refreshCall]);

  return { reader, activeCall, loading, error, refreshCall, setActiveCall };
}
