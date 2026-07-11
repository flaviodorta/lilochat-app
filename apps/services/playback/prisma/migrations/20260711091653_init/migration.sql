-- CreateEnum
CREATE TYPE "QueueItemStatus" AS ENUM ('PENDING', 'PLAYING', 'DONE', 'SKIPPED');

-- CreateTable
CREATE TABLE "videos" (
    "video_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration_s" INTEGER NOT NULL,
    "thumb_url" TEXT NOT NULL,
    "embeddable" BOOLEAN NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("video_id")
);

-- CreateTable
CREATE TABLE "queue_items" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "video_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration_s" INTEGER NOT NULL,
    "thumb_url" TEXT NOT NULL,
    "added_by_id" UUID NOT NULL,
    "added_by_nickname" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "QueueItemStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "queue_items_room_id_status_position_idx" ON "queue_items"("room_id", "status", "position");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_id_idx" ON "outbox_events"("published_at", "id");
