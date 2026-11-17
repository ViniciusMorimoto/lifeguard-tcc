type LogLevel = 'info' | 'warn' | 'error';
type LogFields = Record<string, unknown>;

const SENSITIVE_KEY = /(authorization|cookie|password|senha|secret|token|email|phone|telefone|body|payload|medical|medicamento|alergia|condicao|observacao)/i;

function sanitize(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (depth > 4) return '[TRUNCATED]';
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, '', depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        sanitize(childValue, childKey, depth + 1),
      ]),
    );
  }
  return String(value);
}

export function formatLog(level: LogLevel, event: string, fields: LogFields = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(fields) as LogFields,
  });
}

export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  const line = formatLog(level, event, fields);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function safeErrorFields(error: unknown): LogFields {
  if (!(error instanceof Error)) return { errorType: typeof error };
  const candidate = error as Error & { code?: unknown };
  return {
    errorType: error.name || 'Error',
    errorCode: typeof candidate.code === 'string' || typeof candidate.code === 'number'
      ? candidate.code
      : undefined,
  };
}
