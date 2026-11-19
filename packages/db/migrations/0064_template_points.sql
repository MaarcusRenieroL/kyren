-- A task estimate is at most 100 points, so templates above that could never
-- be used. They now carry the highest estimate a task accepts.
UPDATE "taskTemplate" SET "estimatePoints" = 100 WHERE "estimatePoints" > 100;
