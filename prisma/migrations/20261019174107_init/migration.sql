-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'SUBE_MUDURU', 'KASIYER');

-- CreateEnum
CREATE TYPE "HareketTipi" AS ENUM ('ALIS', 'SATIS', 'IADE', 'TRANSFER_CIKIS', 'TRANSFER_GIRIS', 'DUZELTME_ARTIS', 'DUZELTME_AZALIS', 'SAYIM');

-- CreateEnum
CREATE TYPE "OdemeTipi" AS ENUM ('NAKIT', 'KART', 'HAVALE', 'KARISIK');

-- CreateEnum
CREATE TYPE "SatisDurumu" AS ENUM ('TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "TransferDurumu" AS ENUM ('BEKLEMEDE', 'YOLDA', 'TAMAMLANDI', 'IPTAL');

-- CreateEnum
CREATE TYPE "Cinsiyet" AS ENUM ('KADIN', 'ERKEK', 'COCUK', 'UNISEX');

-- CreateEnum
CREATE TYPE "Sezon" AS ENUM ('YAZLIK', 'KISLIK', 'IKI_SEZON');

-- CreateTable
CREATE TABLE "Sube" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "adres" TEXT,
    "telefon" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "satisSayac" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kullanici" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "sifreHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "subeId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "sonGiris" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kullanici_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Oturum" (
    "id" TEXT NOT NULL,
    "kullaniciId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Oturum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GirisDenemesi" (
    "id" TEXT NOT NULL,
    "anahtar" TEXT NOT NULL,
    "basarili" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GirisDenemesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marka" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,

    CONSTRAINT "Marka_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kategori" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,

    CONSTRAINT "Kategori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tedarikci" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "telefon" TEXT,
    "email" TEXT,
    "adres" TEXT,
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tedarikci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Urun" (
    "id" TEXT NOT NULL,
    "ad" TEXT NOT NULL,
    "markaId" TEXT,
    "kategoriId" TEXT,
    "cinsiyet" "Cinsiyet",
    "sezon" "Sezon",
    "aciklama" TEXT,
    "gorselUrl" TEXT,
    "tedarikciId" TEXT,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Urun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Varyant" (
    "id" TEXT NOT NULL,
    "urunId" TEXT NOT NULL,
    "renk" TEXT NOT NULL,
    "beden" TEXT NOT NULL,
    "barkod" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "alisFiyati" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "satisFiyati" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minStok" INTEGER NOT NULL DEFAULT 1,
    "aktif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Varyant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stok" (
    "varyantId" TEXT NOT NULL,
    "subeId" TEXT NOT NULL,
    "miktar" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stok_pkey" PRIMARY KEY ("varyantId","subeId")
);

-- CreateTable
CREATE TABLE "StokHareketi" (
    "id" TEXT NOT NULL,
    "tip" "HareketTipi" NOT NULL,
    "varyantId" TEXT,
    "subeId" TEXT NOT NULL,
    "miktar" INTEGER NOT NULL,
    "birimMaliyet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "birimSatis" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "belgeTipi" TEXT,
    "belgeId" TEXT,
    "aciklama" TEXT,
    "kullaniciId" TEXT,
    "urunAdiSnap" TEXT,
    "barkodSnap" TEXT,
    "kullaniciSnap" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StokHareketi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Satis" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "subeId" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "kullaniciSnap" TEXT,
    "odemeTipi" "OdemeTipi" NOT NULL,
    "araToplam" DECIMAL(12,2) NOT NULL,
    "indirim" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "toplam" DECIMAL(12,2) NOT NULL,
    "maliyet" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "durum" "SatisDurumu" NOT NULL DEFAULT 'TAMAMLANDI',
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Satis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SatisKalemi" (
    "id" TEXT NOT NULL,
    "satisId" TEXT NOT NULL,
    "varyantId" TEXT,
    "urunAdi" TEXT NOT NULL,
    "marka" TEXT,
    "kategori" TEXT,
    "renk" TEXT NOT NULL,
    "beden" TEXT NOT NULL,
    "barkod" TEXT NOT NULL,
    "miktar" INTEGER NOT NULL,
    "birimFiyat" DECIMAL(12,2) NOT NULL,
    "birimMaliyet" DECIMAL(12,2) NOT NULL,
    "iadeAdet" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SatisKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlisBelgesi" (
    "id" TEXT NOT NULL,
    "no" TEXT,
    "subeId" TEXT NOT NULL,
    "tedarikciId" TEXT,
    "kullaniciId" TEXT,
    "toplam" DECIMAL(12,2) NOT NULL,
    "notlar" TEXT,
    "tarih" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlisBelgesi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlisKalemi" (
    "id" TEXT NOT NULL,
    "belgeId" TEXT NOT NULL,
    "varyantId" TEXT,
    "urunAdi" TEXT NOT NULL,
    "renk" TEXT NOT NULL,
    "beden" TEXT NOT NULL,
    "barkod" TEXT NOT NULL,
    "miktar" INTEGER NOT NULL,
    "birimMaliyet" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "AlisKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "kaynakSubeId" TEXT NOT NULL,
    "hedefSubeId" TEXT NOT NULL,
    "durum" "TransferDurumu" NOT NULL DEFAULT 'BEKLEMEDE',
    "kullaniciId" TEXT,
    "notlar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferKalemi" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "varyantId" TEXT NOT NULL,
    "urunAdi" TEXT NOT NULL,
    "renk" TEXT NOT NULL,
    "beden" TEXT NOT NULL,
    "barkod" TEXT NOT NULL,
    "miktar" INTEGER NOT NULL,

    CONSTRAINT "TransferKalemi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiyatGecmisi" (
    "id" TEXT NOT NULL,
    "varyantId" TEXT NOT NULL,
    "alis" DECIMAL(12,2) NOT NULL,
    "satis" DECIMAL(12,2) NOT NULL,
    "kullaniciId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiyatGecmisi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DenetimKaydi" (
    "id" TEXT NOT NULL,
    "kullaniciId" TEXT,
    "kullaniciSnap" TEXT,
    "eylem" TEXT NOT NULL,
    "nesne" TEXT NOT NULL,
    "nesneId" TEXT,
    "detay" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DenetimKaydi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKullanim" (
    "id" TEXT NOT NULL,
    "hash" TEXT,
    "saglayici" TEXT NOT NULL,
    "gorev" TEXT NOT NULL,
    "basarili" BOOLEAN NOT NULL,
    "sonuc" JSONB,
    "kullaniciId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiKullanim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ayar" (
    "anahtar" TEXT NOT NULL,
    "deger" TEXT NOT NULL,

    CONSTRAINT "Ayar_pkey" PRIMARY KEY ("anahtar")
);

-- CreateTable
CREATE TABLE "Sayac" (
    "ad" TEXT NOT NULL,
    "deger" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sayac_pkey" PRIMARY KEY ("ad")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sube_kod_key" ON "Sube"("kod");

-- CreateIndex
CREATE UNIQUE INDEX "Kullanici_email_key" ON "Kullanici"("email");

-- CreateIndex
CREATE INDEX "Kullanici_subeId_idx" ON "Kullanici"("subeId");

-- CreateIndex
CREATE UNIQUE INDEX "Oturum_tokenHash_key" ON "Oturum"("tokenHash");

-- CreateIndex
CREATE INDEX "Oturum_kullaniciId_idx" ON "Oturum"("kullaniciId");

-- CreateIndex
CREATE INDEX "Oturum_expiresAt_idx" ON "Oturum"("expiresAt");

-- CreateIndex
CREATE INDEX "GirisDenemesi_anahtar_createdAt_idx" ON "GirisDenemesi"("anahtar", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Marka_ad_key" ON "Marka"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "Kategori_ad_key" ON "Kategori"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "Tedarikci_ad_key" ON "Tedarikci"("ad");

-- CreateIndex
CREATE INDEX "Urun_markaId_idx" ON "Urun"("markaId");

-- CreateIndex
CREATE INDEX "Urun_kategoriId_idx" ON "Urun"("kategoriId");

-- CreateIndex
CREATE INDEX "Urun_ad_idx" ON "Urun"("ad");

-- CreateIndex
CREATE UNIQUE INDEX "Varyant_barkod_key" ON "Varyant"("barkod");

-- CreateIndex
CREATE UNIQUE INDEX "Varyant_sku_key" ON "Varyant"("sku");

-- CreateIndex
CREATE INDEX "Varyant_urunId_idx" ON "Varyant"("urunId");

-- CreateIndex
CREATE UNIQUE INDEX "Varyant_urunId_renk_beden_key" ON "Varyant"("urunId", "renk", "beden");

-- CreateIndex
CREATE INDEX "Stok_subeId_idx" ON "Stok"("subeId");

-- CreateIndex
CREATE INDEX "StokHareketi_subeId_tip_createdAt_idx" ON "StokHareketi"("subeId", "tip", "createdAt");

-- CreateIndex
CREATE INDEX "StokHareketi_varyantId_idx" ON "StokHareketi"("varyantId");

-- CreateIndex
CREATE INDEX "StokHareketi_belgeId_idx" ON "StokHareketi"("belgeId");

-- CreateIndex
CREATE INDEX "StokHareketi_createdAt_idx" ON "StokHareketi"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Satis_no_key" ON "Satis"("no");

-- CreateIndex
CREATE INDEX "Satis_subeId_createdAt_idx" ON "Satis"("subeId", "createdAt");

-- CreateIndex
CREATE INDEX "Satis_createdAt_idx" ON "Satis"("createdAt");

-- CreateIndex
CREATE INDEX "SatisKalemi_satisId_idx" ON "SatisKalemi"("satisId");

-- CreateIndex
CREATE INDEX "SatisKalemi_varyantId_idx" ON "SatisKalemi"("varyantId");

-- CreateIndex
CREATE INDEX "SatisKalemi_marka_idx" ON "SatisKalemi"("marka");

-- CreateIndex
CREATE INDEX "AlisBelgesi_subeId_tarih_idx" ON "AlisBelgesi"("subeId", "tarih");

-- CreateIndex
CREATE INDEX "AlisKalemi_belgeId_idx" ON "AlisKalemi"("belgeId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_no_key" ON "Transfer"("no");

-- CreateIndex
CREATE INDEX "Transfer_kaynakSubeId_idx" ON "Transfer"("kaynakSubeId");

-- CreateIndex
CREATE INDEX "Transfer_hedefSubeId_idx" ON "Transfer"("hedefSubeId");

-- CreateIndex
CREATE INDEX "TransferKalemi_transferId_idx" ON "TransferKalemi"("transferId");

-- CreateIndex
CREATE INDEX "FiyatGecmisi_varyantId_createdAt_idx" ON "FiyatGecmisi"("varyantId", "createdAt");

-- CreateIndex
CREATE INDEX "DenetimKaydi_createdAt_idx" ON "DenetimKaydi"("createdAt");

-- CreateIndex
CREATE INDEX "DenetimKaydi_kullaniciId_idx" ON "DenetimKaydi"("kullaniciId");

-- CreateIndex
CREATE INDEX "AiKullanim_hash_gorev_idx" ON "AiKullanim"("hash", "gorev");

-- CreateIndex
CREATE INDEX "AiKullanim_kullaniciId_createdAt_idx" ON "AiKullanim"("kullaniciId", "createdAt");

-- AddForeignKey
ALTER TABLE "Kullanici" ADD CONSTRAINT "Kullanici_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "Sube"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Oturum" ADD CONSTRAINT "Oturum_kullaniciId_fkey" FOREIGN KEY ("kullaniciId") REFERENCES "Kullanici"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Urun" ADD CONSTRAINT "Urun_markaId_fkey" FOREIGN KEY ("markaId") REFERENCES "Marka"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Urun" ADD CONSTRAINT "Urun_kategoriId_fkey" FOREIGN KEY ("kategoriId") REFERENCES "Kategori"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Urun" ADD CONSTRAINT "Urun_tedarikciId_fkey" FOREIGN KEY ("tedarikciId") REFERENCES "Tedarikci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Varyant" ADD CONSTRAINT "Varyant_urunId_fkey" FOREIGN KEY ("urunId") REFERENCES "Urun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stok" ADD CONSTRAINT "Stok_varyantId_fkey" FOREIGN KEY ("varyantId") REFERENCES "Varyant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stok" ADD CONSTRAINT "Stok_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "Sube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_varyantId_fkey" FOREIGN KEY ("varyantId") REFERENCES "Varyant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StokHareketi" ADD CONSTRAINT "StokHareketi_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "Sube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Satis" ADD CONSTRAINT "Satis_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "Sube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SatisKalemi" ADD CONSTRAINT "SatisKalemi_satisId_fkey" FOREIGN KEY ("satisId") REFERENCES "Satis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlisBelgesi" ADD CONSTRAINT "AlisBelgesi_subeId_fkey" FOREIGN KEY ("subeId") REFERENCES "Sube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlisBelgesi" ADD CONSTRAINT "AlisBelgesi_tedarikciId_fkey" FOREIGN KEY ("tedarikciId") REFERENCES "Tedarikci"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlisKalemi" ADD CONSTRAINT "AlisKalemi_belgeId_fkey" FOREIGN KEY ("belgeId") REFERENCES "AlisBelgesi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_kaynakSubeId_fkey" FOREIGN KEY ("kaynakSubeId") REFERENCES "Sube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_hedefSubeId_fkey" FOREIGN KEY ("hedefSubeId") REFERENCES "Sube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferKalemi" ADD CONSTRAINT "TransferKalemi_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiyatGecmisi" ADD CONSTRAINT "FiyatGecmisi_varyantId_fkey" FOREIGN KEY ("varyantId") REFERENCES "Varyant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stok asla negatife dusemez (uygulama hatasi olsa bile veritabani korur)
ALTER TABLE "Stok" ADD CONSTRAINT "Stok_miktar_nonneg" CHECK ("miktar" >= 0);
ALTER TABLE "Varyant" ADD CONSTRAINT "Varyant_fiyat_nonneg" CHECK ("alisFiyati" >= 0 AND "satisFiyati" >= 0);
