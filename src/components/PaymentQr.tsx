const UPI_ID = "9826049083@ybl";
const PAYEE_NAME = "Arihant Jewellers";
const BANK_ACCOUNTS = [
  {
    name: "Sourabh Bhandari",
    accountNo: "63011319379",
    bank: "SBI",
    ifsc: "SBIN0030029",
    branch: "Barwaha",
  },
  {
    name: "Arihant Jewellers",
    accountNo: "31420425663",
    bank: "SBI",
    ifsc: "SBIN0030029",
    branch: "Barwaha",
  },
];

function formatAmount(amount?: number) {
  if (!amount || amount <= 0) return null;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildUpiUrl() {
  const params = new URLSearchParams({
    pa: UPI_ID,
    pn: PAYEE_NAME,
    cu: "INR",
  });

  return `upi://pay?${params.toString()}`;
}

export function PaymentQr({ amount, compact = false, hideOnPrint = false }: { amount?: number; compact?: boolean; hideOnPrint?: boolean }) {
  const upiUrl = buildUpiUrl();
  const payableAmount = formatAmount(amount);
  const qrSize = compact ? 84 : 110;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&margin=4&data=${encodeURIComponent(upiUrl)}`;

  return (
    <div className={`w-full max-w-3xl rounded-md border border-slate-300 bg-white text-slate-900 overflow-hidden ${hideOnPrint ? "print:hidden" : ""}`}>
      <div className={`flex items-center justify-between gap-3 border-b border-slate-300 bg-slate-100/80 px-3 ${compact ? "py-1.5" : "py-2"}`}>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Payment Details</div>
        {payableAmount && (
          <div className="text-[11px] font-bold text-slate-900">
            Payable: <span className="text-rose-600">{payableAmount}</span>
          </div>
        )}
      </div>

      <div className={`grid ${compact ? "grid-cols-[auto_1fr] gap-0" : "grid-cols-1 sm:grid-cols-[auto_1fr] gap-0"}`}>
        {/* QR Code Section */}
        <div className={`flex flex-col items-center justify-center border-r border-slate-200 bg-slate-50/50 ${compact ? "p-2 w-28" : "p-3 w-36"} text-center`}>
          <div className="bg-white p-1 rounded-sm border border-slate-200 shadow-sm">
            <img
              src={qrSrc}
              alt={`UPI QR for ${UPI_ID}`}
              width={qrSize}
              height={qrSize}
              className="object-contain"
            />
          </div>
          <div className={`mt-1.5 ${compact ? "text-[9px]" : "text-[10px]"} font-bold uppercase tracking-wider text-slate-500`}>Scan to Pay</div>
          <div className={`break-all ${compact ? "text-[9px]" : "text-[10px]"} font-semibold leading-tight text-slate-900 mt-0.5`}>{UPI_ID}</div>
        </div>

        {/* Bank Details Table Section */}
        <div className="flex flex-col justify-center bg-white overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="border-r border-slate-200 px-2 py-1.5 whitespace-nowrap">Account Name</th>
                <th className="border-r border-slate-200 px-2 py-1.5 whitespace-nowrap">A/c No</th>
                <th className="border-r border-slate-200 px-2 py-1.5 whitespace-nowrap">IFSC</th>
                <th className="px-2 py-1.5 whitespace-nowrap">Branch</th>
              </tr>
            </thead>
            <tbody className="text-[10px] leading-tight text-slate-700">
              {BANK_ACCOUNTS.map((account, i) => (
                <tr key={account.accountNo} className={i !== BANK_ACCOUNTS.length - 1 ? "border-b border-slate-200" : ""}>
                  <td className="border-r border-slate-200 px-2 py-1.5 font-bold text-slate-900 whitespace-nowrap">{account.name}</td>
                  <td className="border-r border-slate-200 px-2 py-1.5 font-semibold font-mono tracking-tight">{account.accountNo}</td>
                  <td className="border-r border-slate-200 px-2 py-1.5 font-semibold font-mono tracking-tight">{account.ifsc}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{account.bank}, {account.branch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
