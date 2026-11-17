-- Manual acknowledgement and physiological recovery are independent.
-- Existing episodes remain blocked until three normal readings confirm recovery.
ALTER TABLE "Alert" ADD COLUMN "signalRecoveredAt" TIMESTAMP(3);
