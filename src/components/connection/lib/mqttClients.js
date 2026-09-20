import mqtt from 'mqtt';
import { getMqttSettings } from './mqttSettings';

class MqttManager {
  constructor() {
    this.client = null;
    this.status = 'disconnected';
    this.userId = null;
    this.statusListeners = new Set();
    this.messageListeners = new Set();
    this.subscribedTopics = new Set();
  }

  setUserId(userId) {
    this.userId = userId;
  }

  buildUrl(settings) {
    const protocol = settings.useTls ? 'wss' : 'ws';
    return `${protocol}://${settings.host}:${settings.port}${settings.path || '/mqtt'}`;
  }

  connect() {
    const settings = getMqttSettings();
    if (!settings.host) {
      this.setStatus('disconnected');
      return;
    }

    if (this.client) {
      this.client.end(true);
    }

    this.setStatus('connecting');

    const url = this.buildUrl(settings);
    const options = {
      clientId: settings.clientId,
      clean: true,
      reconnectPeriod: 3000,
      connectTimeout: 10000,
    };

    if (settings.username) {
      options.username = settings.username;
      options.password = settings.password;
    }

    this.client = mqtt.connect(url, options);

    this.client.on('connect', () => {
      this.setStatus('connected');
      this.subscribedTopics.forEach((topic) => {
        this.client.subscribe(topic);
      });
    });

    this.client.on('reconnect', () => {
      this.setStatus('reconnecting');
    });

    this.client.on('close', () => {
      this.setStatus('disconnected');
    });

    this.client.on('error', () => {
      this.setStatus('error');
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  handleMessage(topic, message) {
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch {
      payload = { value: parseFloat(message.toString()) };
    }

    // Accept both esp32/{mac}/{sensor} and esp32/{user}/{mac}/{sensor}.
    const parts = topic.split('/');
    if (parts.length >= 3) {
      const hasUserPrefix = parts.length >= 4;
      const mac = hasUserPrefix ? parts[2] : parts[1];
      const sensorType = hasUserPrefix ? parts[3] : parts[2];
      let value = payload.value;

      if (sensorType === 'status') {
        value = payload.status === 'online' ? 1 : 0;
      }

      const reading = {
        device_mac: mac,
        sensor_type: sensorType,
        value: value,
        timestamp: payload.timestamp || payload.ts || Date.now(),
      };

      this.messageListeners.forEach((cb) => cb(reading));
    }
  }

  subscribeToDevice(mac) {
    if (!mac) return;
    const topics = [
      `esp32/${mac}/temperature`,
      `esp32/${mac}/pulse`,
      `esp32/${mac}/status`,
    ];
    if (this.userId) {
      topics.push(
        `esp32/${this.userId}/${mac}/temperature`,
        `esp32/${this.userId}/${mac}/pulse`,
        `esp32/${this.userId}/${mac}/status`,
      );
    }

    topics.forEach((t) => {
      this.subscribedTopics.add(t);
      if (this.client && this.client.connected) {
        this.client.subscribe(t);
      }
    });
  }

  unsubscribeFromDevice(mac) {
    if (!mac) return;
    const topics = [
      `esp32/${mac}/temperature`,
      `esp32/${mac}/pulse`,
      `esp32/${mac}/status`,
    ];
    if (this.userId) {
      topics.push(
        `esp32/${this.userId}/${mac}/temperature`,
        `esp32/${this.userId}/${mac}/pulse`,
        `esp32/${this.userId}/${mac}/status`,
      );
    }

    topics.forEach((t) => {
      this.subscribedTopics.delete(t);
      if (this.client) {
        this.client.unsubscribe(t);
      }
    });
  }

  publish(topic, message) {
    if (this.client && this.client.connected) {
      this.client.publish(topic, typeof message === 'string' ? message : JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.subscribedTopics.clear();
    this.setStatus('disconnected');
  }

  setStatus(status) {
    this.status = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  onStatus(cb) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  onMessage(cb) {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }
}

export const mqttManager = new MqttManager();