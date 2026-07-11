-- CreateTable
CREATE TABLE "watch_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "last_checkpoint_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watch_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_totals" (
    "user_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_totals_pkey" PRIMARY KEY ("user_id","period")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" UUID NOT NULL,
    "nickname" TEXT NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "room_states" (
    "room_id" UUID NOT NULL,
    "playing" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_states_pkey" PRIMARY KEY ("room_id")
);

-- CreateIndex
CREATE INDEX "watch_sessions_user_id_idx" ON "watch_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_totals_period_seconds_idx" ON "user_totals"("period", "seconds" DESC);
