export const SHOP_DETAILS = {
  name: "Arihant Jewellers",
  address: "224, Maheshwar Road, Barwaha (Dist. Khargone) M.P.",
  phones: ["9826049083", "9926702700"],
  gstNumber: "23AVHPB4250H1Z2",
};

const TERMS = [
  "भूल-चूक लेनी-देनी",
  "70% एडवांस पेमेंट पर ही भाव फिक्स किया जाएगा।",
  "न्याय क्षेत्र बड़वाह रहेगा।",
];

export function ShopHeader({ documentLabel, compact = false }: { documentLabel?: string; compact?: boolean }) {
  return (
    <div className={`text-center border-b-2 border-slate-300 ${compact ? "pb-3 mb-4" : "pb-5 mb-6"}`}>
      <h2 className={`${compact ? "text-3xl" : "text-4xl"} font-display font-bold uppercase tracking-widest text-slate-900`}>
        {SHOP_DETAILS.name}
      </h2>
      <p className="mt-2 text-sm font-medium text-slate-700">{SHOP_DETAILS.address}</p>
      <p className="text-sm font-semibold text-slate-800">Mobile: {SHOP_DETAILS.phones.join(" / ")}</p>
      {documentLabel === "Tax Invoice" && (
        <p className="text-sm font-semibold text-slate-800">GSTIN: {SHOP_DETAILS.gstNumber}</p>
      )}
      {documentLabel && (
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-slate-500">{documentLabel}</p>
      )}
    </div>
  );
}

export function InvoiceTerms({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`border border-slate-300 bg-slate-50 ${compact ? "p-3" : "p-4"} text-xs text-slate-700`}>
      <p className="mb-2 font-bold uppercase tracking-wider text-slate-900">Terms & Conditions</p>
      <ol className="list-decimal space-y-1 pl-4 font-medium">
        {TERMS.map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ol>
    </div>
  );
}
