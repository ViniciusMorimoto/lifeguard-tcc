ALTER TABLE "Device" ADD COLUMN "credentialHash" TEXT;
ALTER TABLE "Reading" ADD COLUMN "sampleId" UUID, ADD COLUMN "payloadHash" TEXT;
CREATE UNIQUE INDEX "Reading_deviceId_sampleId_key" ON "Reading"("deviceId", "sampleId");
CREATE TABLE "DeviceAlertDispatch" (
  "id" UUID NOT NULL,
  "alertId" UUID NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  CONSTRAINT "DeviceAlertDispatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeviceAlertDispatch_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DeviceAlertDispatch_alertId_key" ON "DeviceAlertDispatch"("alertId");
CREATE INDEX "DeviceAlertDispatch_sentAt_nextAt_idx" ON "DeviceAlertDispatch"("sentAt", "nextAt");
