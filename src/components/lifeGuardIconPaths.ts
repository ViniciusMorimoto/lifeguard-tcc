// Original 24 x 24 outlines: rounded strokes inspired by the brand book.
export const lifeGuardIconPaths = {
  'heart-pulse': ['M20.6 4.9a5 5 0 0 0-7.1 0L12 6.4l-1.5-1.5a5 5 0 0 0-7.1 7.1L12 20l8.6-8a5 5 0 0 0 0-7.1', 'M2 12h5l2-4 3 8 2-4h8'],
  thermometer: ['M9 14.5V5a3 3 0 0 1 6 0v9.5a5 5 0 1 1-6 0Z', 'M12 8v9', 'M10.5 18a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0', 'M17 6h2M17 10h2'],
  'chart-line': ['M4 3v17h17', 'M7 15l4-5 4 3 5-7', 'M17 6h3v3'],
  devices: ['M12 18H3V4h16v5', 'M7 18v3M4 21h6', 'M15 10h6v11h-6Z', 'M17.5 18h1'],
  'account-group': ['M9 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0', 'M6 21v-4a6 6 0 0 1 12 0v4', 'M5 5a3 3 0 0 0 0 6M19 5a3 3 0 0 1 0 6', 'M2 19v-3a4 4 0 0 1 2-3M22 19v-3a4 4 0 0 0-2-3'],
  'tune-variant': ['M3 7h9M16 7h5M3 17h5M12 17h9', 'M12 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0', 'M8 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0'],
  sos: ['M8 2h8l6 6v8l-6 6H8l-6-6V8Z', 'M12 7v6', 'M12 17h.01'],
} as const;

export type LifeGuardIconName = keyof typeof lifeGuardIconPaths;
