-- CreateEnum
CREATE TYPE "VoteResult" AS ENUM ('PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "votes" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "started_by" UUID NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "result" "VoteResult",
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "votes_room_id_result_idx" ON "votes"("room_id", "result");
