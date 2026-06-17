import type { ReactNode } from "react";

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
  "मैंने उल्लिखित उत्पाद की डिलीवरी प्राप्त करने से पहले सभी आभूषणों की सावधानीपूर्वक जांच कर ली है और उन्हें अच्छी स्थिति में पाया है। मैंने इस चालान (इनवॉइस) के पीछे उल्लिखित सभी नियमों एवं शर्तों को पढ़ लिया है तथा उन्हें स्वीकार करता/करती हूँ।"
];

export function ShopHeader({ documentLabel, compact = false, rightElement }: { documentLabel?: string; compact?: boolean; rightElement?: ReactNode }) {
  return (
    <div className={`border-b-2 border-slate-300 flex flex-col sm:flex-row justify-between items-start gap-4 ${compact ? "pb-3 mb-4" : "pb-5 mb-6"}`}>
      <div className={rightElement ? "text-left flex-1" : "text-center w-full"}>
        <div className={`flex ${rightElement ? "justify-start" : "justify-center"} mb-3`}>
        <img src="/logo.png" alt="Shop Logo" className={`object-contain ${compact ? "h-16" : "h-20"}`} />
      </div>
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
      {rightElement && (
        <div className="shrink-0 w-full sm:w-120">
          {rightElement}
        </div>
      )}
    </div>
  );
}

export function InvoiceTerms({}: { compact?: boolean }) {
  return (
    <p className="text-center leading-tight">
      <span className="font-bold">नियम व शर्तें:</span> {TERMS.join(" | ")}
    </p>
  );
}
