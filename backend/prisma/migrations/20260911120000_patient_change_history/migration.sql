CREATE TABLE "PatientChangeLog" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "changedById" UUID,
    "category" TEXT NOT NULL,
    "changedFields" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientChangeLog_patientId_createdAt_idx" ON "PatientChangeLog"("patientId", "createdAt" DESC);

ALTER TABLE "PatientChangeLog" ADD CONSTRAINT "PatientChangeLog_patientId_fkey"
FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientChangeLog" ADD CONSTRAINT "PatientChangeLog_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
