# Firmware do ESP32

Este sketch envia ao LifeGuard a frequência cardíaca do PulseSensor e a temperatura do DS18B20 a cada cinco segundos. As leituras entram no mesmo endpoint e nas mesmas telas que antes recebiam dados do simulador.

## Ligação

- **PulseSensor**: saída analógica em GPIO **32**, VCC em **3,3 V** e GND comum. Não aplique 5 V no ADC do ESP32.
- **DS18B20**: DATA em GPIO **5**, VDD em **3,3 V**, GND comum e resistor pull-up de **4,7 kΩ** entre DATA e 3,3 V.

## Preparação

1. No Arduino IDE, instale a placa **esp32 by Espressif Systems**.
2. Instale as bibliotecas **OneWire**, **DallasTemperature** e **PulseSensor Playground** pelo Gerenciador de Bibliotecas.
3. Copie `config.example.h` para `config.h` e preencha Wi-Fi, a credencial exibida pelo aplicativo e o certificado raiz PEM da API.
4. Abra `esp32_lifeguard.ino`, selecione a placa/porta e grave.
5. Abra o Monitor Serial em 115200 baud para conferir Wi-Fi, NTP e a resposta HTTP.

O sketch valida TLS com o certificado configurado e não usa `setInsecure()`. A credencial identifica somente este ESP32; não use senha da conta, token de login ou segredos do banco no firmware.

## Operação

Quando uma leitura retorna HTTP 201, ela foi gravada. A tela do paciente, a tela do cuidador e o histórico passam a obtê-la pelas rotas já existentes da API. Em falhas de rede, o sketch reenvia o mesmo JSON (incluindo `sampleId`) com espera progressiva, evitando duplicação no banco.

O algoritmo do PulseSensor depende de posicionamento e limiar. Ajuste `PULSE_THRESHOLD` com o Monitor Serial e valide o resultado com referência apropriada antes de qualquer demonstração. Este protótipo não é equipamento médico nem substitui monitoramento clínico.
