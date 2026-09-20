import mqtt, { type MqttClient } from 'mqtt';

type MqttSettings = {
  host: string;
  port: number;
  path: string;
  username: string;
  password: string;
};

type Reading = {
  mac: string;
  sensor: 'pulse' | 'temperature' | 'status';
  value: number;
  timestamp: number;
};

const settings: MqttSettings = {
  host: 'dc6dab53fd5c454fbb9f99d619926bb2.s1.eu.hivemq.cloud',
  port: 8884,
  path: '/mqtt',
  username: 'Users',
  password: '@aeN3hM4J4ADRpX',
};

class EspMqttService {
  private client: MqttClient | null = null;
  private listeners = new Set<(reading: Reading) => void>();
  private statusListeners = new Set<(status: string) => void>();
  private status = 'disconnected';

  connect() {
    if (this.client) return;
    this.setStatus('connecting');
    this.client = mqtt.connect(`wss://${settings.host}:${settings.port}${settings.path}`, {
      clientId: `lifeguard_${Math.random().toString(16).slice(2, 10)}`,
      username: settings.username,
      password: settings.password,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    });
    this.client.on('connect', () => this.setStatus('connected'));
    this.client.on('reconnect', () => this.setStatus('reconnecting'));
    this.client.on('close', () => this.setStatus('disconnected'));
    this.client.on('error', () => this.setStatus('error'));
    this.client.on('message', (topic, payload) => this.handleMessage(topic, payload.toString()));
  }

  subscribe(mac: string) {
    if (!this.client || !mac) return;
    ['pulse', 'temperature', 'status'].forEach((sensor) => {
      this.client?.subscribe(`esp32/${mac}/${sensor}`);
      this.client?.subscribe(`esp32/+/+/${sensor}`);
    });
  }

  onReading(listener: (reading: Reading) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: (status: string) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private handleMessage(topic: string, raw: string) {
    const parts = topic.split('/');
    if (parts.length < 3) return;
    const sensor = parts[parts.length - 1] as Reading['sensor'];
    if (!['pulse', 'temperature', 'status'].includes(sensor)) return;
    const mac = parts.length >= 4 ? parts[2] : parts[1];
    let payload: { value?: number; status?: string; timestamp?: number; ts?: number } = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { value: Number(raw) };
    }
    const value = sensor === 'status' ? (payload.status === 'online' ? 1 : 0) : Number(payload.value);
    if (!Number.isFinite(value)) return;
    this.listeners.forEach((listener) => listener({ mac, sensor, value, timestamp: payload.timestamp || payload.ts || Date.now() }));
  }

  private setStatus(status: string) {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}

export const espMqttService = new EspMqttService();
export type { Reading };
