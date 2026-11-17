CREATE TABLE "PushDelivery" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "pushTokenId" UUID,
    "providerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PushDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PushDelivery_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "PushToken"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PushDelivery_providerId_key" ON "PushDelivery"("providerId");
CREATE INDEX "PushDelivery_status_nextCheckAt_idx" ON "PushDelivery"("status", "nextCheckAt");
CREATE INDEX "PushDelivery_userId_createdAt_idx" ON "PushDelivery"("userId", "createdAt");
