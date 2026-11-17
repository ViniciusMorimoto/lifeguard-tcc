import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';

// Fixed Google endpoint: never accept a key URL from a token or request.
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {
  timeoutDuration: 5000,
  cooldownDuration: 30_000,
  cacheMaxAge: 600_000,
});

const identitySchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(254),
  email_verified: z.literal(true),
  azp: z.string().min(1).optional(),
});

export type GoogleIdentity = { subject: string; email: string };

/** Verifies identity only. Does not link accounts or issue LifeGuard sessions. */
export function createGoogleIdentityVerifier(options: {
  webClientId?: string;
  androidClientId?: string;
  // Trusted server-side dependency for offline tests; never populate from HTTP input.
  keys?: JWTVerifyGetKey;
}) {
  const audience = options.webClientId?.trim();
  const authorizedParties = new Set([audience, options.androidClientId?.trim()].filter(Boolean));
  const keys = options.keys ?? googleKeys;

  return async (token: unknown): Promise<GoogleIdentity> => {
    if (!audience) {
      throw new HttpError(503, 'Login com Google ainda não disponível.', 'GOOGLE_NOT_CONFIGURED');
    }
    const invalid = () => new HttpError(401, 'Não foi possível validar o login com Google. Tente novamente.', 'INVALID_GOOGLE_TOKEN');
    if (typeof token !== 'string' || token.length === 0 || token.length > 16_384) throw invalid();

    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ['RS256'],
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience,
        requiredClaims: ['sub', 'iat', 'exp', 'email', 'email_verified'],
        maxTokenAge: '1h',
        clockTolerance: 5,
      });
      const identity = identitySchema.parse(payload);
      // This Android flow expects exactly the configured Web audience.
      if (payload.aud !== audience || (identity.azp && !authorizedParties.has(identity.azp))) throw invalid();
      return { subject: identity.sub, email: identity.email.toLowerCase() };
    } catch (error) {
      // Avoid exposing the token, claims, or upstream error text in API responses/logs.
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 'ERR_JWKS_TIMEOUT' || error instanceof TypeError) {
        throw new HttpError(503, 'Google temporariamente indisponível. Tente novamente.', 'GOOGLE_UNAVAILABLE');
      }
      throw invalid();
    }
  };
}
