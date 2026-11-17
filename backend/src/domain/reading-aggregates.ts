export type TimedReading = {
  timestamp: Date;
  valid: boolean;
  heartRate: number | null;
  temperature: number | null;
};

export type ReadingBucket = {
  timestamp: Date;
  heartRateAverage: number | null;
  heartRateMinimum: number | null;
  heartRateMaximum: number | null;
  temperatureAverage: number | null;
  temperatureMinimum: number | null;
  temperatureMaximum: number | null;
  sampleCount: number;
};

export function aggregateReadingsByInterval(readings: TimedReading[], intervalMs: number): ReadingBucket[] {
  const buckets = new Map<number, TimedReading[]>();
  for (const reading of readings) {
    const start = Math.floor(reading.timestamp.getTime() / intervalMs) * intervalMs;
    const bucket = buckets.get(start) ?? [];
    bucket.push(reading);
    buckets.set(start, bucket);
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([start, samples]) => {
      const validSamples = samples.filter((reading) => reading.valid);
      const hearts = validSamples.flatMap((reading) => reading.heartRate === null ? [] : [reading.heartRate]);
      const temperatures = validSamples.flatMap((reading) => reading.temperature === null ? [] : [reading.temperature]);
      const average = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
      return {
        timestamp: new Date(start),
        heartRateAverage: average(hearts),
        heartRateMinimum: hearts.length ? Math.min(...hearts) : null,
        heartRateMaximum: hearts.length ? Math.max(...hearts) : null,
        temperatureAverage: average(temperatures),
        temperatureMinimum: temperatures.length ? Math.min(...temperatures) : null,
        temperatureMaximum: temperatures.length ? Math.max(...temperatures) : null,
        sampleCount: validSamples.length,
      };
    });
}
