ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Contas anteriores à confirmação por e-mail permanecem válidas.
UPDATE "User" SET "emailVerifiedAt" = "createdAt";

CREATE TYPE "AccountCodeType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

CREATE TABLE "AccountCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AccountCodeType" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountCode_userId_type_usedAt_expiresAt_idx"
ON "AccountCode"("userId", "type", "usedAt", "expiresAt");

ALTER TABLE "AccountCode"
ADD CONSTRAINT "AccountCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
