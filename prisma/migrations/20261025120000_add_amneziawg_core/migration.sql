-- AlterTable
ALTER TABLE "config_profiles" ADD COLUMN "core_type" TEXT NOT NULL DEFAULT 'XRAY';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "awg_private_key" TEXT,
ADD COLUMN "awg_public_key" TEXT,
ADD COLUMN "awg_preshared_key" TEXT;

-- CreateTable
CREATE TABLE "user_awg_peers" (
    "user_id" BIGINT NOT NULL,
    "inbound_uuid" UUID NOT NULL,
    "ip" INET NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_awg_peers_pkey" PRIMARY KEY ("user_id","inbound_uuid")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_awg_peers_inbound_uuid_ip_key" ON "user_awg_peers"("inbound_uuid", "ip");

-- AddForeignKey
ALTER TABLE "user_awg_peers" ADD CONSTRAINT "user_awg_peers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_awg_peers" ADD CONSTRAINT "user_awg_peers_inbound_uuid_fkey" FOREIGN KEY ("inbound_uuid") REFERENCES "config_profile_inbounds"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
