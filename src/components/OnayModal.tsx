"use client";
import { useState } from "react";
import { Buton, Modal } from "@/components/ui";

/** Tek adımlı onay penceresi (silme, pasife alma gibi geri alınabilir/zararsız işlemler için). */
export function OnayModal({ acik, kapat, baslik, mesaj, onayMetni = "Onayla", tehlikeli, calistir }: {
  acik: boolean; kapat: () => void; baslik: string; mesaj: React.ReactNode; onayMetni?: string; tehlikeli?: boolean; calistir: () => Promise<void>;
}) {
  const [yukleniyor, setYukleniyor] = useState(false);
  return (
    <Modal acik={acik} kapat={kapat} baslik={baslik}>
      <div className="space-y-5">
        <div className="text-sm text-muted">{mesaj}</div>
        <div className="flex justify-end gap-2">
          <Buton varyant="ikincil" onClick={kapat}>Vazgeç</Buton>
          <Buton varyant={tehlikeli ? "tehlike" : "birincil"} yukleniyor={yukleniyor} onClick={async () => {
            setYukleniyor(true);
            try { await calistir(); kapat(); } finally { setYukleniyor(false); }
          }}>{onayMetni}</Buton>
        </div>
      </div>
    </Modal>
  );
}