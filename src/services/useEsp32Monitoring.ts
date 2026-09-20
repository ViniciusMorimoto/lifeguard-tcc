import { useEffect, useState } from 'react';
import { useDeviceStore } from '../store/deviceStore';
import { espMqttService, type Reading } from './mqttService';

export function useEsp32Monitoring() {
  const mac = useDeviceStore((state) => state.mac);
  const [readings, setReadings] = useState<Partial<Record<Reading['sensor'], Reading>>>({});
  const [mqttStatus, setMqttStatus] = useState('disconnected');

  useEffect(() => {
    espMqttService.connect();
    const unsubscribeStatus = espMqttService.onStatus(setMqttStatus);
    const unsubscribeReading = espMqttService.onReading((reading) => {
      if (!mac || reading.mac.toLowerCase() !== mac.toLowerCase()) return;
      setReadings((current) => ({ ...current, [reading.sensor]: reading }));
    });
    if (mac) espMqttService.subscribe(mac);
    return () => {
      unsubscribeStatus();
      unsubscribeReading();
    };
  }, [mac]);

  return {
    pulse: readings.pulse?.value ?? null,
    temperature: readings.temperature?.value ?? null,
    online: readings.status?.value === 1,
    lastUpdate: Math.max(readings.pulse?.timestamp || 0, readings.temperature?.timestamp || 0),
    mqttStatus,
    hasDevice: Boolean(mac),
  };
}
