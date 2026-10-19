-- CreateIndex
CREATE INDEX "AlisBelgesi_tarih_idx" ON "AlisBelgesi"("tarih");

-- CreateIndex
CREATE INDEX "Satis_durum_createdAt_idx" ON "Satis"("durum", "createdAt");

-- CreateIndex
CREATE INDEX "Satis_subeId_durum_createdAt_idx" ON "Satis"("subeId", "durum", "createdAt");

-- CreateIndex
CREATE INDEX "StokHareketi_subeId_createdAt_idx" ON "StokHareketi"("subeId", "createdAt");
