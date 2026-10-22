ALTER TABLE "Presentation" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'nl';
ALTER TABLE "Presentation" ADD COLUMN "translationNeedsReview" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Presentation"
SET "narrationSettings" = jsonb_strip_nulls(
  jsonb_build_object(
    'rate', COALESCE(("narrationSettings"->>'rate')::numeric, 1),
    'voiceURI', "narrationSettings"->>'voiceURI'
  )
);
