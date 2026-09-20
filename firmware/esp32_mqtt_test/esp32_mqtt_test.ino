#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

const char* MQTT_HOST = "dc6dab53fd5c454fbb9f99d619926bb2.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883;
const char* MQTT_USER = "Users";
const char* MQTT_PASS = "COLOQUE_A_SENHA_DO_HIVEMQ_AQUI";

const int ONE_WIRE_PIN = 5;
const int PULSE_PIN = 32;

#define BLE_SERVICE_UUID     "0000ffff-0000-1000-8000-00805f9b34fb"
#define BLE_SSID_CHAR_UUID   "0000ff01-0000-1000-8000-00805f9b34fb"
#define BLE_PASS_CHAR_UUID   "0000ff02-0000-1000-8000-00805f9b34fb"
#define BLE_STATUS_CHAR_UUID "0000ff03-0000-1000-8000-00805f9b34fb"
#define BLE_SCAN_CHAR_UUID   "0000ff04-0000-1000-8000-00805f9b34fb"
#define BLE_MAC_CHAR_UUID    "0000ff05-0000-1000-8000-00805f9b34fb"

String wifi_ssid;
String wifi_pass;
String device_mac;
String wifi_scan_cache = "[]";
bool provisioned = false;
bool ap_active = false;

WiFiClientSecure wifi_client;
PubSubClient mqtt_client(wifi_client);
WebServer ap_server(80);
OneWire one_wire(ONE_WIRE_PIN);
DallasTemperature temp_sensor(&one_wire);

unsigned long last_publish = 0;
unsigned long last_mqtt_attempt = 0;
const unsigned long PUBLISH_INTERVAL = 5000;
const unsigned long MQTT_RETRY_INTERVAL = 5000;

void tryConnectWifi();
void tryConnectMQTT();

String getMacAddress() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buffer[13];
  snprintf(buffer, sizeof(buffer), "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buffer);
}

String scanNetworks() {
  int count = WiFi.scanNetworks(false, true);
  DynamicJsonDocument document(1536);
  JsonArray networks = document.to<JsonArray>();
  int limit = min(count, 8);

  for (int i = 0; i < limit; i++) {
    JsonObject network = networks.createNestedObject();
    network["ssid"] = WiFi.SSID(i);
    network["rssi"] = WiFi.RSSI(i);
  }

  String output;
  serializeJson(document, output);
  WiFi.scanDelete();
  return output;
}

class SsidCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    wifi_ssid = characteristic->getValue().c_str();
  }
};

class PassCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* characteristic) override {
    wifi_pass = characteristic->getValue().c_str();
    tryConnectWifi();
  }
};

class StatusCallbacks : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* characteristic) override {
    characteristic->setValue(provisioned ? "connected" : "waiting");
  }
};

class ScanCallbacks : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* characteristic) override {
    characteristic->setValue(wifi_scan_cache.c_str());
  }
};

class MacCallbacks : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic* characteristic) override {
    characteristic->setValue(device_mac.c_str());
  }
};

void startBLE() {
  BLEDevice::init("ESP32-BioConnect");
  BLEServer* server = BLEDevice::createServer();
  BLEService* service = server->createService(BLE_SERVICE_UUID);

  BLECharacteristic* ssid_characteristic = service->createCharacteristic(BLE_SSID_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  ssid_characteristic->setCallbacks(new SsidCallbacks());

  BLECharacteristic* pass_characteristic = service->createCharacteristic(BLE_PASS_CHAR_UUID, BLECharacteristic::PROPERTY_WRITE);
  pass_characteristic->setCallbacks(new PassCallbacks());

  BLECharacteristic* status_characteristic = service->createCharacteristic(BLE_STATUS_CHAR_UUID, BLECharacteristic::PROPERTY_READ);
  status_characteristic->setCallbacks(new StatusCallbacks());

  BLECharacteristic* scan_characteristic = service->createCharacteristic(BLE_SCAN_CHAR_UUID, BLECharacteristic::PROPERTY_READ);
  scan_characteristic->setCallbacks(new ScanCallbacks());

  BLECharacteristic* mac_characteristic = service->createCharacteristic(BLE_MAC_CHAR_UUID, BLECharacteristic::PROPERTY_READ);
  mac_characteristic->setCallbacks(new MacCallbacks());
  mac_characteristic->setValue(device_mac.c_str());

  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->start();
}

void addCorsHeaders() {
  ap_server.sendHeader("Access-Control-Allow-Origin", "*");
  ap_server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  ap_server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

void handleOptions() {
  addCorsHeaders();
  ap_server.send(204);
}

void handleScan() {
  addCorsHeaders();
  ap_server.send(200, "application/json", "{\"networks\":" + wifi_scan_cache + "}");
}

void handleProvision() {
  addCorsHeaders();
  if (!ap_server.hasArg("plain")) {
    ap_server.send(400, "application/json", "{\"error\":\"no body\"}");
    return;
  }

  DynamicJsonDocument document(1024);
  if (deserializeJson(document, ap_server.arg("plain"))) {
    ap_server.send(400, "application/json", "{\"error\":\"invalid json\"}");
    return;
  }

  wifi_ssid = document["ssid"].as<String>();
  wifi_pass = document["password"].as<String>();
  if (wifi_ssid.length() == 0) {
    ap_server.send(400, "application/json", "{\"error\":\"ssid required\"}");
    return;
  }

  ap_server.send(200, "application/json", "{\"status\":\"ok\",\"mac\":\"" + device_mac + "\"}");
  delay(100);
  tryConnectWifi();
}

void handleRoot() {
  addCorsHeaders();
  ap_server.send(200, "text/plain", "ESP32 BioConnect - Provisionamento");
}

void startAP() {
  WiFi.mode(WIFI_AP);
  String ap_name = "ESP32-SETUP-" + device_mac.substring(4, 8);
  WiFi.softAP(ap_name.c_str());

  ap_server.on("/", HTTP_GET, handleRoot);
  ap_server.on("/scan", HTTP_GET, handleScan);
  ap_server.on("/scan", HTTP_OPTIONS, handleOptions);
  ap_server.on("/provision", HTTP_POST, handleProvision);
  ap_server.on("/provision", HTTP_OPTIONS, handleOptions);
  ap_server.begin();
  ap_active = true;
}

void tryConnectWifi() {
  if (wifi_ssid.length() == 0) return;

  WiFi.mode(WIFI_STA);
  WiFi.begin(wifi_ssid.c_str(), wifi_pass.c_str());
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    provisioned = true;
    if (ap_active) {
      ap_server.stop();
      WiFi.softAPdisconnect(true);
      ap_active = false;
    }
    wifi_client.setInsecure();
    mqtt_client.setServer(MQTT_HOST, MQTT_PORT);
  } else {
    WiFi.disconnect();
    provisioned = false;
    if (!ap_active) startAP();
  }
}

void publishReading(const char* sensor_type, float value) {
  if (!mqtt_client.connected() || !isfinite(value)) return;
  String topic = "esp32/" + device_mac + "/" + String(sensor_type);
  DynamicJsonDocument document(128);
  document["value"] = value;
  document["timestamp"] = millis();
  String payload;
  serializeJson(document, payload);
  mqtt_client.publish(topic.c_str(), payload.c_str());
}

void publishStatus(const char* status) {
  if (!mqtt_client.connected()) return;
  String topic = "esp32/" + device_mac + "/status";
  String payload = String("{\"status\":\"") + status + "\",\"timestamp\":" + millis() + "}";
  mqtt_client.publish(topic.c_str(), payload.c_str(), true);
}

float readTemperature() {
  temp_sensor.requestTemperatures();
  return temp_sensor.getTempCByIndex(0);
}

float readPulse() {
  int raw = analogRead(PULSE_PIN);
  return (raw / 4095.0f) * 120.0f;
}

void tryConnectMQTT() {
  if (!provisioned || mqtt_client.connected()) return;
  if (millis() - last_mqtt_attempt < MQTT_RETRY_INTERVAL) return;
  last_mqtt_attempt = millis();

  String client_id = "esp32_" + device_mac;
  Serial.print("Conectando ao MQTT...");
  if (mqtt_client.connect(client_id.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println(" conectado");
    publishStatus("online");
  } else {
    Serial.print(" falhou, rc=");
    Serial.println(mqtt_client.state());
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  WiFi.mode(WIFI_STA);
  device_mac = getMacAddress();
  Serial.print("MAC do dispositivo: ");
  Serial.println(device_mac);

  temp_sensor.begin();
  temp_sensor.setResolution(12);
  wifi_scan_cache = scanNetworks();
  WiFi.disconnect(true);
  delay(100);

  startBLE();
  startAP();
}

void loop() {
  if (ap_active) ap_server.handleClient();

  if (provisioned) {
    tryConnectMQTT();
    if (mqtt_client.connected()) {
      mqtt_client.loop();
      unsigned long current_time = millis();
      if (current_time - last_publish >= PUBLISH_INTERVAL) {
        last_publish = current_time;
        publishReading("temperature", readTemperature());
        publishReading("pulse", readPulse());
      }
    }
  }

  delay(10);
}
