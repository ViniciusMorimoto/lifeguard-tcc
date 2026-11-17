import 'dotenv/config';
import { z } from 'zod';

const optionalNonEmptyString = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3333),
  APP_ORIGIN: z.string().default('*'),
  SIMULATOR_DEVICE_CODE: z.string().default('ESP32-DEMO-001'),
  SIMULATOR_INTERVAL_MS: z.coerce.number().int().min(1000).default(5000),
  SMTP_HOST: optionalNonEmptyString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.string().transform((value) => value === 'true').default(false),
  SMTP_USER: optionalNonEmptyString,
  SMTP_PASSWORD: optionalNonEmptyString,
  EMAIL_FROM: optionalNonEmptyString,
  DEMO_SEED_ENABLED: z.string().transform((value) => value === 'true').default(false),
  DEMO_SEED_PASSWORD: optionalNonEmptyString,
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.JWT_SECRET.length < 64) {
    context.addIssue({
      code: 'custom',
      path: ['JWT_SECRET'],
      message: 'em produção deve ter pelo menos 64 caracteres',
    });
  }
  if (value.NODE_ENV === 'production' && value.DEMO_SEED_ENABLED) {
    context.addIssue({
      code: 'custom',
      path: ['DEMO_SEED_ENABLED'],
      message: 'não pode ser ativado em produção',
    });
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Configuração inválida do backend: ${details}`);
}

export const env = result.data;
