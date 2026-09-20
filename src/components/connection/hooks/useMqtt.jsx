import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { mqttManager } from '@/lib/mqttClients';
import { hasMqttSettings } from '@/lib/mqttSettings';
import { localClient } from '@/api/localClient';

const MqttContext = createContext(null);

export function MqttProvider({ children }) {
  const { data: devices = [], refetch: refetchDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: () => localClient.entities.Device.list(),
  });

  const [readings, setReadings] = useState({});
  const [status, setStatus] = useState(mqttManager.status);
  const pendingWrites = useRef(new Map());
  const devicesRef = useRef(devices);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    if (hasMqttSettings()) {
      mqttManager.connect();
    }
    const unsubStatus = mqttManager.onStatus(setStatus);
    return () => {
      unsubStatus();
    };
  }, []);

  useEffect(() => {
    if (!devices || devices.length === 0) return;

    devices.forEach((d) => mqttManager.subscribeToDevice(d.mac_address));

    const unsubMsg = mqttManager.onMessage((reading) => {
      const key = `${reading.device_mac}_${reading.sensor_type}`;

      if (reading.sensor_type === 'status') {
        const device = devicesRef.current?.find((d) => d.mac_address === reading.device_mac);
        if (device) {
          localClient.entities.Device
            .update(device.id, {
              status: reading.value === 1 ? 'online' : 'offline',
              last_seen: new Date().toISOString(),
            })
            .catch(() => {});
        }
        return;
      }

      setReadings((prev) => ({
        ...prev,
        [key]: reading,
      }));

      const device = devicesRef.current?.find((d) => d.mac_address === reading.device_mac);
      if (device) {
        pendingWrites.current.set(key, { ...reading, device_id: device.id });
      }
    });

    const flushInterval = setInterval(async () => {
      if (pendingWrites.current.size === 0) return;

      const writes = Array.from(pendingWrites.current.values());
      pendingWrites.current.clear();

      try {
        await localClient.entities.SensorReading.bulkCreate(
          writes.map((w) => ({
            device_id: w.device_id,
            device_mac: w.device_mac,
            sensor_type: w.sensor_type,
            value: w.value,
            recorded_at: new Date(w.timestamp).toISOString(),
          }))
        );

        const deviceUpdates = new Map();
        writes.forEach((w) => {
          let update = deviceUpdates.get(w.device_id);
          if (!update) {
            update = { last_seen: new Date().toISOString(), status: 'online' };
            deviceUpdates.set(w.device_id, update);
          }
          if (w.sensor_type === 'temperature') update.last_temperature = w.value;
          if (w.sensor_type === 'pulse') update.last_pulse = w.value;
        });

        for (const [id, update] of deviceUpdates) {
          await localClient.entities.Device.update(id, update);
        }
        refetchDevices();
      } catch (err) {
        // silent fail - will retry next flush
      }
    }, 3000);

    return () => {
      unsubMsg();
      clearInterval(flushInterval);
    };
  }, [devices, refetchDevices]);

  const getLatestReading = useCallback(
    (mac, sensorType) => {
      return readings[`${mac}_${sensorType}`];
    },
    [readings]
  );

  return (
    <MqttContext.Provider value={{ readings, status, devices, getLatestReading, refetchDevices }}>
      {children}
    </MqttContext.Provider>
  );
}

export function useMqtt() {
  const ctx = useContext(MqttContext);
  if (!ctx) throw new Error('useMqtt must be used within MqttProvider');
  return ctx;
}