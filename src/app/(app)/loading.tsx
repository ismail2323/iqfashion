import { Iskelet } from "@/components/ui";

/** Sayfa verisi hazırlanırken anında görünür (Next, gezinmede bunu hemen gösterir; ekran "donmuş" görünmez). */
export default function Yukleniyor() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Yükleniyor">
      <div className="space-y-2">
        <Iskelet className="h-9 w-56" />
        <Iskelet className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Iskelet key={i} className="h-44 rounded-2xl" />)}
      </div>
      <Iskelet className="h-72 rounded-2xl" />
    </div>
  );
}