ALTER TABLE "CreditLedger" ADD COLUMN "direction" TEXT NOT NULL DEFAULT 'consume';

CREATE INDEX "CreditLedger_direction_createdAt_idx" ON "CreditLedger"("direction", "createdAt");

INSERT INTO "CreditLedger" (
    "id",
    "userId",
    "requestId",
    "direction",
    "kind",
    "label",
    "credits",
    "createdAt"
)
SELECT
    'credit_signup_backfill_' || u."id",
    u."id",
    'signup-backfill:' || u."id",
    'increase',
    'signup',
    '注册送积分',
    GREATEST(0, u."credits" + COALESCE(consumed."credits", 0)),
    u."createdAt"
FROM "User" u
LEFT JOIN (
    SELECT "userId", SUM("credits") AS "credits"
    FROM "CreditLedger"
    WHERE "direction" = 'consume'
    GROUP BY "userId"
) consumed ON consumed."userId" = u."id"
WHERE NOT EXISTS (
    SELECT 1
    FROM "CreditLedger" existing
    WHERE existing."requestId" = 'signup-backfill:' || u."id"
      AND existing."kind" = 'signup'
);
