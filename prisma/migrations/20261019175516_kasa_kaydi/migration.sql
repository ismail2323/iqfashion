-- CreateEnum
CREATE TYPE "KasaTipi" AS ENUM ('GELIR', 'GIDER');

-- CreateTable
CREATE TABLE "KasaKaydi" (
    "id" TEXT NOT NULL,
    "tip" "KasaTipi" NOT NULL,
    "kategori" TEXT NOT NULL,
    "tutar" DECIMAL(12,2) NOT NULL,
    "aciklama" TEXT,
    "subeId" TEXT,
    "kullaniciId" TEXT,
    "kullaniciSnap" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KasaKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KasaKaydi_tip_tarih_idx" ON "KasaKaydi"("tip", "tarih");

-- CreateIndex
CREATE INDEX "KasaKaydi_subeId_tarih_idx" ON "KasaKaydi"("subeId", "tarih");
