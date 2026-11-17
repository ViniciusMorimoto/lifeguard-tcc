import type { UserType } from '../generated/prisma/enums.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: {
        userId: string;
        type: UserType;
        sessionVersion: number;
        sessionId?: string;
      };
    }
  }
}

export {};
