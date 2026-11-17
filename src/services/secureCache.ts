import * as SecureStore from 'expo-secure-store';

const CACHE_PREFIX = 'lifeguard.cache.v1';
const CHUNK_SIZE = 400;
const MIN_WRITE_INTERVAL_MS = 30_000;
const lastWriteByKey = new Map<string, number>();
const pendingWrites = new Set<string>();
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

type CacheEnvelope<T> = {
  version: 1;
  userId: string;
  savedAt: string;
  data: T;
};

type CacheManifest = {
  chunks: number;
};

function safePart(value: string) {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function baseKey(userId: string, scope: string) {
  return `${CACHE_PREFIX}.${safePart(userId)}.${safePart(scope)}`;
}

function indexKey(userId: string) {
  return `${CACHE_PREFIX}.index.${safePart(userId)}`;
}

async function isAvailable() {
  return SecureStore.isAvailableAsync().catch(() => false);
}

async function readManifest(key: string): Promise<CacheManifest | null> {
  const raw = await SecureStore.getItemAsync(`${key}.manifest`, secureOptions);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as CacheManifest;
  return Number.isInteger(parsed.chunks) && parsed.chunks > 0 ? parsed : null;
}

function parseScopeIndex(raw: string | null) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export async function writeSecureCache<T>(userId: string, scope: string, data: T) {
  const key = baseKey(userId, scope);
  if (pendingWrites.has(key) || Date.now() - (lastWriteByKey.get(key) ?? 0) < MIN_WRITE_INTERVAL_MS) return;
  if (!(await isAvailable())) return;
  pendingWrites.add(key);
  try {
    const previous = await readManifest(key).catch(() => null);
    const envelope: CacheEnvelope<T> = { version: 1, userId, savedAt: new Date().toISOString(), data };
    const characters = Array.from(JSON.stringify(envelope));
    const chunks: string[] = [];
    for (let index = 0; index < characters.length; index += CHUNK_SIZE) {
      chunks.push(characters.slice(index, index + CHUNK_SIZE).join(''));
    }

    for (let index = 0; index < chunks.length; index += 1) {
      await SecureStore.setItemAsync(`${key}.chunk.${index}`, chunks[index], secureOptions);
    }
    await SecureStore.setItemAsync(`${key}.manifest`, JSON.stringify({ chunks: chunks.length }), secureOptions);
    for (let index = chunks.length; index < (previous?.chunks ?? 0); index += 1) {
      await SecureStore.deleteItemAsync(`${key}.chunk.${index}`, secureOptions).catch(() => undefined);
    }

    const rawIndex = await SecureStore.getItemAsync(indexKey(userId), secureOptions).catch(() => null);
    const scopes = parseScopeIndex(rawIndex);
    if (!scopes.includes(scope)) {
      await SecureStore.setItemAsync(indexKey(userId), JSON.stringify([...scopes, scope]), secureOptions);
    }
    lastWriteByKey.set(key, Date.now());
  } finally {
    pendingWrites.delete(key);
  }
}

export async function readSecureCache<T>(userId: string, scope: string): Promise<CacheEnvelope<T> | null> {
  if (!(await isAvailable())) return null;
  try {
    const key = baseKey(userId, scope);
    const manifest = await readManifest(key);
    if (!manifest) return null;
    const chunks = await Promise.all(Array.from({ length: manifest.chunks }, (_, index) => (
      SecureStore.getItemAsync(`${key}.chunk.${index}`, secureOptions)
    )));
    if (chunks.some((chunk) => chunk === null)) return null;
    const envelope = JSON.parse(chunks.join('')) as CacheEnvelope<T>;
    if (envelope.version !== 1 || envelope.userId !== userId || !envelope.savedAt) return null;
    return envelope;
  } catch {
    return null;
  }
}

export async function clearSecureCaches(userId: string) {
  if (!(await isAvailable())) return;
  try {
    const rawIndex = await SecureStore.getItemAsync(indexKey(userId), secureOptions);
    const scopes = parseScopeIndex(rawIndex);
    await Promise.all(scopes.map(async (scope) => {
      const key = baseKey(userId, scope);
      const manifest = await readManifest(key).catch(() => null);
      if (manifest) {
        await Promise.all(Array.from({ length: manifest.chunks }, (_, index) => (
          SecureStore.deleteItemAsync(`${key}.chunk.${index}`, secureOptions).catch(() => undefined)
        )));
      }
      await SecureStore.deleteItemAsync(`${key}.manifest`, secureOptions).catch(() => undefined);
    }));
    await SecureStore.deleteItemAsync(indexKey(userId), secureOptions);
    for (const scope of scopes) lastWriteByKey.delete(baseKey(userId, scope));
  } catch {
    // O encerramento da sessão não deve falhar se o sistema apagar o cache antes.
  }
}
