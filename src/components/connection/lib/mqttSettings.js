const STORAGE_KEY = 'tcc_mqtt_settings';

export const CENTRAL_BROKER = {
  host: 'dc6dab53fd5c454fbb9f99d619926bb2.s1.eu.hivemq.cloud',
  port: 8884,
  path: '/mqtt',
  username: 'Users',
  password: '@aeN3hM4J4ADRpX',
  useTls: true,
};

export function getMqttSettings() {
  return {
    ...CENTRAL_BROKER,
    ...readStoredSettings(),
    clientId: `app_${Math.random().toString(16).slice(2, 10)}`,
  };
}

export function saveMqttSettings(settings) {
  const { clientId, ...settingsToStore } = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToStore));
}

export function hasMqttSettings() {
  return !!CENTRAL_BROKER.host;
}

function readStoredSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}