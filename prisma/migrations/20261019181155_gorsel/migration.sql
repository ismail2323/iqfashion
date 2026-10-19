-- CreateTable
CREATE TABLE "Gorsel" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "veri" BYTEA NOT NULL,
    "boyut" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gorsel_pkey" PRIMARY KEY ("id")
);
