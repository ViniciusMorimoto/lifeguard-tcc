#pragma once

// Copie este arquivo para config.h. Nunca envie config.h ao Git.
// A rede Wi-Fi e a credencial são recebidas diretamente pelo aplicativo.
constexpr char API_URL[] = "https://152-67-44-170.sslip.io/api/dispositivos/leituras";

// Cole o certificado PEM da autoridade certificadora da API.
constexpr char LIFEGUARD_ROOT_CA[] = R"EOF(
-----BEGIN CERTIFICATE-----
COLE_AQUI_O_CERTIFICADO_RAIZ_EM_PEM
-----END CERTIFICATE-----
)EOF";
