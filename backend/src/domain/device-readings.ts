import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { AlertLimitsInput, ReadingInput } from './readings.js';

export const DEVICE_STALE_MS = 90_000;
export const deviceSampleSchema = z.object({
  sampleId: z.uuid(),
  timestamp: z.iso.datetime(),
  heartRate: z.number().int().min(0).max(250).nullable(),
  temperature: z.number().min(-20).max(100).nullable(),
  contactDetected: z.boolean(),
  signalQuality: z.enum(['GOOD', 'FAIR', 'POOR', 'NO_CONTACT', 'UNKNOWN']),
}).strict();
export type DeviceSample = z.infer<typeof deviceSampleSchema>;
export const hashDeviceValue = (value: string) => createHash('sha256').update(value).digest('hex');
export const newDeviceSecret = () => randomBytes(32).toString('hex');
export function matchesDeviceSecret(secret: string, hash: string | null) {
  return Boolean(hash && /^[a-f0-9]{64}$/.test(hash) && /^[a-f0-9]{64}$/.test(secret)
    && timingSafeEqual(Buffer.from(hashDeviceValue(secret), 'hex'), Buffer.from(hash, 'hex')));
}
export function normalizeDeviceSample(sample: DeviceSample) {
  const invalidReason = !sample.contactDetected || sample.signalQuality === 'NO_CONTACT' ? 'Sem contato com o sensor.'
    : !['GOOD', 'FAIR'].includes(sample.signalQuality) ? 'Qualidade de sinal insuficiente.'
    : sample.heartRate === null && sample.temperature === null ? 'Nenhuma medida disponível.'
    : (sample.heartRate !== null && (sample.heartRate < 30 || sample.heartRate > 250))
      || (sample.temperature !== null && (sample.temperature < 30 || sample.temperature > 45)) ? 'Medida fora da faixa técnica aceita.' : null;
  return {
    heartRate: invalidReason ? null : sample.heartRate,
    temperature: invalidReason ? null : sample.temperature,
    contactDetected: sample.contactDetected,
    signalQuality: sample.signalQuality,
    valid: invalidReason === null,
    invalidReason,
  };
}

// Prototype signal filter, not a clinically validated alarm algorithm.
export function sustainedState(readings: Array<ReadingInput & { timestamp: Date }>, limits: AlertLimitsInput, type: 'HEART_RATE' | 'TEMPERATURE'): 'high' | 'low' | 'normal' | null {
  if (readings.length < 3) return null;
  const samples = readings.slice(0, 3);
  const span = samples[0]!.timestamp.getTime() - samples[2]!.timestamp.getTime();
  if (span < 8_000 || span > 30_000) return null;
  const states = samples.map((reading) => {
    if (!reading.valid || !reading.contactDetected) return null;
    const value = type === 'HEART_RATE' ? reading.heartRate : reading.temperature;
    if (value === null) return null;
    const min = type === 'HEART_RATE' ? limits.heartRateMinimum : limits.temperatureMinimum;
    const max = type === 'HEART_RATE' ? limits.heartRateMaximum : limits.temperatureMaximum;
    return value < min ? 'low' : value > max ? 'high' : 'normal';
  });
  return states.every((state) => state === states[0]) ? states[0]! : null;
}
