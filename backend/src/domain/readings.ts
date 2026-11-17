export type ReadingInput = {
  heartRate: number | null;
  temperature: number | null;
  valid: boolean;
  contactDetected: boolean;
  timestamp?: Date;
};

export type AlertLimitsInput = {
  heartRateMinimum: number;
  heartRateMaximum: number;
  temperatureMinimum: number;
  temperatureMaximum: number;
};

export type MonitoringStatus = 'normal' | 'atencao' | 'alerta' | 'sem_sinal';

export function classifyReading(reading: ReadingInput | null, limits: AlertLimitsInput): MonitoringStatus {
  if (!reading || !reading.valid || !reading.contactDetected) return 'sem_sinal';
  if (reading.timestamp && Date.now() - reading.timestamp.getTime() > 90_000) return 'sem_sinal';

  const heartRateAlert = reading.heartRate !== null
    && (reading.heartRate < limits.heartRateMinimum || reading.heartRate > limits.heartRateMaximum);
  const temperatureAlert = reading.temperature !== null
    && (reading.temperature < limits.temperatureMinimum || reading.temperature > limits.temperatureMaximum);

  if (heartRateAlert || temperatureAlert) return 'alerta';

  const heartMargin = Math.max(5, Math.round((limits.heartRateMaximum - limits.heartRateMinimum) * 0.1));
  const temperatureMargin = 0.3;
  const heartRateAttention = reading.heartRate !== null
    && (reading.heartRate <= limits.heartRateMinimum + heartMargin
      || reading.heartRate >= limits.heartRateMaximum - heartMargin);
  const temperatureAttention = reading.temperature !== null
    && (reading.temperature <= limits.temperatureMinimum + temperatureMargin
      || reading.temperature >= limits.temperatureMaximum - temperatureMargin);

  return heartRateAttention || temperatureAttention ? 'atencao' : 'normal';
}

export function findLimitViolations(reading: ReadingInput, limits: AlertLimitsInput) {
  if (!reading.valid || !reading.contactDetected) return [];

  const violations: Array<{ type: 'HEART_RATE' | 'TEMPERATURE'; value: number; message: string }> = [];

  if (reading.heartRate !== null
    && (reading.heartRate < limits.heartRateMinimum || reading.heartRate > limits.heartRateMaximum)) {
    violations.push({
      type: 'HEART_RATE',
      value: reading.heartRate,
      message: `Batimento fora do limite: ${reading.heartRate} bpm.`,
    });
  }

  if (reading.temperature !== null
    && (reading.temperature < limits.temperatureMinimum || reading.temperature > limits.temperatureMaximum)) {
    violations.push({
      type: 'TEMPERATURE',
      value: reading.temperature,
      message: `Temperatura fora do limite: ${reading.temperature.toFixed(1)} °C.`,
    });
  }

  return violations;
}
