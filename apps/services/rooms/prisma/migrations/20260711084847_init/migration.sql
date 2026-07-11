-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_cards" (
    "room_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "viewers" INTEGER NOT NULL DEFAULT 0,
    "video_id" TEXT,
    "video_title" TEXT,
    "video_thumb_url" TEXT,
    "video_duration_s" INTEGER,
    "video_started_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_cards_pkey" PRIMARY KEY ("room_id")
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
CREATE INDEX "room_cards_created_at_room_id_idx" ON "room_cards"("created_at" DESC, "room_id" DESC);

-- CreateIndex
CREATE INDEX "outbox_events_published_at_id_idx" ON "outbox_events"("published_at", "id");

-- Trigram index for room search: `name ILIKE %q%` stays fast as the directory grows
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "room_cards_name_trgm_idx" ON "room_cards" USING gin ("name" gin_trgm_ops);
