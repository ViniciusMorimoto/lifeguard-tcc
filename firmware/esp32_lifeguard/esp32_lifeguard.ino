#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <PulseSensorPlayground.h>
#include <time.h>
#include <esp_system.h>
#include <WebServer.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#include "config.h"

constexpr uint8_t PULSE_SENSOR_PIN = 32;
constexpr uint8_t DS18B20_PIN = 5;
constexpr uint16_t PULSE_THRESHOLD = 550;
constexpr unsigned long SAMPLE_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_RETRY_MS = 10'000;
constexpr char PROVISIONING_NAME[] = "LIFEGUARD-ESP32";
constexpr char BLE_SERVICE_UUID[] = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
constexpr char BLE_DATA_UUID[] = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
constexpr char BLE_COMMAND_UUID[] = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

OneWire oneWire(DS18B20_PIN);
DallasTemperature temperatureSensor(&oneWire);
PulseSensorPlayground pulseSensor;

struct PendingSample {
  bool active = false;
  String body;
  uint8_t attempts = 0;
  unsigned long retryAt = 0;
};

PendingSample pending;
int bpm = 0;
unsigned long lastBeatAt = 0;
unsigned long lastSampleAt = 0;
unsigned long lastWifiAttemptAt = 0;
unsigned long lastClockSyncAttemptAt = 0;
Preferences preferences;
WebServer setupServer(80);
String wifiSsid;
String wifiPassword;
String deviceCredential;
bool setupActive = false;
bool wifiAttempted = false;
bool wifiWasConnected = false;
bool clockSyncAttempted = false;
BLECharacteristic *bleDataCharacteristic = nullptr;
bool bleClientConnected = false;

void handleBluetoothCommand(String command);

class ProvisioningConnectionCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {
    bleClientConnected = true;
  }

  void onDisconnect(BLEServer *server) override {
    bleClientConnected = false;
    server->getAdvertising()->start();
  }
};

class ProvisioningCommandCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String command = characteristic->getValue().c_str();
    command.replace("\r", "");
    command.replace("\n", "");
    handleBluetoothCommand(command);
  }
};

void sendBluetoothMessage(const String &message) {
  if (!bleDataCharacteristic || !bleClientConnected) return;
  bleDataCharacteristic->setValue(message.c_str());
  bleDataCharacteristic->notify();
}

void startBluetooth() {
  BLEDevice::init(PROVISIONING_NAME);
  BLEDevice::setMTU(185);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ProvisioningConnectionCallbacks());
  BLEService *service = server->createService(BLE_SERVICE_UUID);

  bleDataCharacteristic = service->createCharacteristic(
    BLE_DATA_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  bleDataCharacteristic->addDescriptor(new BLE2902());

  BLECharacteristic *commandCharacteristic = service->createCharacteristic(
    BLE_COMMAND_UUID, BLECharacteristic::PROPERTY_WRITE);
  commandCharacteristic->setCallbacks(new ProvisioningCommandCallbacks());

  service->start();
  server->getAdvertising()->addServiceUUID(BLE_SERVICE_UUID);
  server->getAdvertising()->start();
}

void handleBluetoothCommand(String command) {
  if (command == "SAVE") {
    if (wifiSsid.isEmpty() || deviceCredential.isEmpty()) {
      sendBluetoothMessage("{\"type\":\"error\",\"message\":\"dados_incompletos\"}");
      return;
    }
    preferences.putString("ssid", wifiSsid);
    preferences.putString("password", wifiPassword);
    preferences.putString("credential", deviceCredential);
    sendBluetoothMessage("{\"type\":\"config_saved\",\"ok\":true}");
    WiFi.disconnect();
    lastWifiAttemptAt = 0;
    wifiAttempted = false;
    connectWifi();
    return;
  }

  const int separator = command.indexOf('=');
  if (separator <= 0) {
    sendBluetoothMessage("{\"type\":\"error\",\"message\":\"comando_invalido\"}");
    return;
  }
  String key = command.substring(0, separator);
  String value = command.substring(separator + 1);
  key.toUpperCase();
  if (key == "SSID") wifiSsid = value;
  else if (key == "PASSWORD") wifiPassword = value;
  else if (key == "CREDENTIAL") deviceCredential = value;
  else {
    sendBluetoothMessage("{\"type\":\"error\",\"message\":\"campo_invalido\"}");
    return;
  }
  sendBluetoothMessage("{\"type\":\"config_received\",\"ok\":true}");
}

bool isConfigured(const char *value) {
  return value && value[0] && strstr(value, "COLE_AQUI") == nullptr && strstr(value, "NOME_DA_REDE") == nullptr &&
    strstr(value, "SENHA_DA_REDE") == nullptr && strstr(value, "UUID_DO_DISPOSITIVO") == nullptr && strstr(value, "TROQUE_POR") == nullptr;
}

void connectWifi() {
  if (wifiSsid.isEmpty()) return;
  if (WiFi.status() == WL_CONNECTED || (wifiAttempted && millis() - lastWifiAttemptAt < WIFI_RETRY_MS)) return;
  lastWifiAttemptAt = millis();
  wifiAttempted = true;
  Serial.printf("Tentando conectar ao Wi-Fi %s (status %d)...\n", wifiSsid.c_str(), WiFi.status());
  WiFi.disconnect();
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
}

void startSetup() {
  if (setupActive) return;
  WiFi.mode(WIFI_AP_STA);
  if (!WiFi.softAP(PROVISIONING_NAME)) {
    Serial.println("Falha ao iniciar rede de configuracao.");
    return;
  }
  setupServer.on("/provision", HTTP_POST, []() {
    const String ssid = setupServer.arg("ssid");
    const String password = setupServer.arg("password");
    const String credential = setupServer.arg("credential");
    if (ssid.isEmpty() || (credential.isEmpty() && deviceCredential.isEmpty())) {
      setupServer.send(400, "application/json", "{\"erro\":\"Dados incompletos\"}");
      return;
    }
    preferences.putString("ssid", ssid);
    preferences.putString("password", password);
    if (!credential.isEmpty()) preferences.putString("credential", credential);
    setupServer.send(200, "application/json", "{\"ok\":true}");
    delay(300);
    ESP.restart();
  });
  setupServer.begin();
  setupActive = true;
  Serial.println("Configuracao pelo app: Wi-Fi LIFEGUARD-ESP32 em 192.168.4.1 ou Bluetooth BLE.");
}

bool syncClock() {
  configTime(0, 0, "pool.ntp.org", "time.google.com");
  const unsigned long deadline = millis() + 15'000;
  while (time(nullptr) < 1'700'000'000 && millis() < deadline) delay(250);
  return time(nullptr) >= 1'700'000'000;
}

String isoTimestamp() {
  time_t now = time(nullptr);
  struct tm utc;
  gmtime_r(&now, &utc);
  char formatted[25];
  strftime(formatted, sizeof(formatted), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(formatted);
}

String uuidV4() {
  uint8_t bytes[16];
  esp_fill_random(bytes, sizeof(bytes));
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  bytes[8] = (bytes[8] & 0x3F) | 0x80;
  char uuid[37];
  snprintf(uuid, sizeof(uuid),
    "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
    bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
    bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
  return String(uuid);
}

String buildSample() {
  const bool contactDetected = bpm >= 30 && bpm <= 240 && millis() - lastBeatAt <= SAMPLE_INTERVAL_MS;
  temperatureSensor.requestTemperatures();
  const float temperature = temperatureSensor.getTempCByIndex(0);
  const bool validTemperature = temperature != DEVICE_DISCONNECTED_C && temperature >= 30.0f && temperature <= 45.0f;

  String body = "{\"sampleId\":\"" + uuidV4() + "\",\"timestamp\":\"" + isoTimestamp() + "\",";
  body += "\"heartRate\":" + (contactDetected ? String(bpm) : "null") + ",";
  body += "\"temperature\":" + (validTemperature ? String(temperature, 2) : "null") + ",";
  body += "\"contactDetected\":" + String(contactDetected ? "true" : "false") + ",";
  body += "\"signalQuality\":\"" + String(contactDetected ? "GOOD" : "NO_CONTACT") + "\"}";
  return body;
}

void scheduleRetry() {
  pending.attempts++;
  // Mantém o mesmo JSON e UUID em cada tentativa, para que a API elimine duplicatas.
  const uint8_t cappedAttempts = pending.attempts > 5 ? 5 : pending.attempts;
  const unsigned long delayMs = min(30'000UL, 1'000UL << cappedAttempts);
  pending.retryAt = millis() + delayMs;
}

void sendPendingSample() {
  if (!pending.active || WiFi.status() != WL_CONNECTED || millis() < pending.retryAt) return;

  WiFiClientSecure client;
  client.setCACert(LIFEGUARD_ROOT_CA);
  HTTPClient http;
  if (!http.begin(client, API_URL)) {
    Serial.println("Não foi possível iniciar HTTPS.");
    scheduleRetry();
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + deviceCredential);
  const int status = http.POST(pending.body);
  const String response = http.getString();
  http.end();

  if (status == HTTP_CODE_OK || status == HTTP_CODE_CREATED) {
    Serial.printf("Leitura enviada (%d): %s\n", status, response.c_str());
    pending.active = false;
    return;
  }

  Serial.printf("Falha ao enviar leitura (%d): %s\n", status, response.c_str());
  scheduleRetry();
}

void updatePulse() {
  if (pulseSensor.sawStartOfBeat()) {
    bpm = pulseSensor.getBeatsPerMinute();
    lastBeatAt = millis();
    Serial.printf("Batimento: %d bpm\n", bpm);
  }
}

void setup() {
  Serial.begin(115200);
  if (!isConfigured(LIFEGUARD_ROOT_CA)) {
    Serial.println("Preencha LIFEGUARD_ROOT_CA em config.h antes de gravar.");
    while (true) delay(1000);
  }
  preferences.begin("lifeguard", false);
  wifiSsid = preferences.getString("ssid", "");
  wifiPassword = preferences.getString("password", "");
  deviceCredential = preferences.getString("credential", "");

  temperatureSensor.begin();
  pulseSensor.analogInput(PULSE_SENSOR_PIN);
  pulseSensor.setThreshold(PULSE_THRESHOLD);
  if (!pulseSensor.begin()) {
    Serial.println("PulseSensor não iniciou.");
    while (true) delay(1000);
  }

  WiFi.mode(WIFI_STA);
  // The temporary AP is available after every boot so a user can change Wi-Fi
  // through the app without a USB cable.
  startSetup();
  startBluetooth();
  if (!wifiSsid.isEmpty() && !deviceCredential.isEmpty()) connectWifi();
}

void loop() {
  if (setupActive) setupServer.handleClient();
  updatePulse();
  connectWifi();
  if (WiFi.status() == WL_CONNECTED && !wifiWasConnected) {
    wifiWasConnected = true;
    Serial.printf("Wi-Fi conectado. IP: %s\n", WiFi.localIP().toString().c_str());
  } else if (WiFi.status() != WL_CONNECTED && wifiWasConnected) {
    wifiWasConnected = false;
    Serial.printf("Wi-Fi desconectado (status %d). O firmware tentará reconectar.\n", WiFi.status());
  }
  if (WiFi.status() == WL_CONNECTED && time(nullptr) < 1'700'000'000 &&
      (!clockSyncAttempted || millis() - lastClockSyncAttemptAt >= 30'000)) {
    clockSyncAttempted = true;
    lastClockSyncAttemptAt = millis();
    Serial.println("Sincronizando relógio com NTP...");
    if (syncClock()) Serial.println("Relógio sincronizado; o envio de leituras será iniciado.");
    else Serial.println("Falha na sincronização NTP. Verifique se a rede permite acesso à internet e ao NTP.");
  }
  sendPendingSample();

  if (!pending.active && millis() - lastSampleAt >= SAMPLE_INTERVAL_MS && time(nullptr) >= 1'700'000'000) {
    pending.body = buildSample();
    pending.active = true;
    pending.attempts = 0;
    pending.retryAt = millis();
    lastSampleAt = millis();
  }
  delay(2);
}
