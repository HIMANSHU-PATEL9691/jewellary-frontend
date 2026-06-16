import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Invoice } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { invoicesAPI } from "@/lib/api";
import { purchasesAPI } from "@/lib/api";
import { Download, FileText, ShoppingBag } from "lucide-react";

export default function GstReportPage() {
  const { data: invoices = [], isLoading } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: purchases = [], isLoading: isLoadingP } = useApi<any[]>(["purchases"], () => purchasesAPI.getAll());

  const [reportType, setReportType] = useState<"Daily" | "Monthly">("Daily");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [page, setPage] = useState(1);
  const [dateFocused, setDateFocused] = useState(false);

  const gstInvoices = useMemo(() => {
    return invoices.filter((i) => i.type === "GST");
  }, [invoices]);

  const gstPurchases = useMemo(() => {
    return purchases.filter((p) => p.type === "GST" || p.gstPct > 0);
  }, [purchases]);

  const filteredInvoices = useMemo(() => {
    let result = gstInvoices;
    if (reportType === "Daily") {
      result = gstInvoices.filter((i) => i.createdAt && i.createdAt.startsWith(selectedDate));
    } else {
      result = gstInvoices.filter((i) => i.createdAt && i.createdAt.startsWith(selectedMonth));
    }
    return [...result].sort((a, b) => (a.customerName || "").localeCompare(b.customerName || ""));
  }, [gstInvoices, reportType, selectedDate, selectedMonth]);

  const filteredPurchases = useMemo(() => {
    let result = gstPurchases;
    if (reportType === "Daily") {
      result = gstPurchases.filter((p) => p.date && p.date.startsWith(selectedDate));
    } else {
      result = gstPurchases.filter((p) => p.date && p.date.startsWith(selectedMonth));
    }
    return [...result].sort((a, b) => (a.supplierName || "").localeCompare(b.supplierName || ""));
  }, [gstPurchases, reportType, selectedDate, selectedMonth]);

  const stats = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let tax = 0;
    let total = 0;

    filteredInvoices.forEach((i) => {
      const invTaxable = i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0);
      taxable += invTaxable;
      tax += i.gstAmount;
      cgst += i.gstAmount / 2;
      sgst += i.gstAmount / 2;
      total += i.total;
    });

    let pTaxable = 0;
    let pCgst = 0;
    let pSgst = 0;
    let pTax = 0;
    let pTotal = 0;

    filteredPurchases.forEach((p) => {
      const base = p.weight * p.ratePerGram + (p.makingCharge || 0);
      const pTaxAmt = (base * (p.gstPct || 3)) / 100;
      pTaxable += base;
      pTax += pTaxAmt;
      pCgst += pTaxAmt / 2;
      pSgst += pTaxAmt / 2;
      pTotal += p.total;
    });

    return { taxable, cgst, sgst, tax, total, count: filteredInvoices.length, pTaxable, pCgst, pSgst, pTax, pTotal, pCount: filteredPurchases.length };
  }, [filteredInvoices, filteredPurchases]);

  const totalPages = Math.ceil(filteredInvoices.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filteredInvoices.slice((currentPage - 1) * 10, currentPage * 10);

  const exportToExcel = () => {
    const periodLabel = reportType === "Daily" ? selectedDate : selectedMonth;
    const rows = [
      ["GST Report", reportType, periodLabel],
      [],
      ["Invoice No", "Date", "Customer Name", "Customer Mobile", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "Total Tax (Rs)", "Total Amount (Rs)"]
    ];

    filteredInvoices.forEach((i) => {
      const invTaxable = i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0);
      const invCgst = i.gstAmount / 2;
      const invSgst = i.gstAmount / 2;
      rows.push([
        i.number,
        formatDate(i.createdAt),
        i.customerName,
        i.customerMobile,
        invTaxable.toFixed(2),
        invCgst.toFixed(2),
        invSgst.toFixed(2),
        i.gstAmount.toFixed(2),
        i.total.toFixed(2)
      ]);
    });

    rows.push([]);
    rows.push(["TOTAL", "", "", "", stats.taxable.toFixed(2), stats.cgst.toFixed(2), stats.sgst.toFixed(2), stats.tax.toFixed(2), stats.total.toFixed(2)]);

    rows.push([]);
    rows.push(["GST Purchases"]);
    rows.push(["Bill No", "Date", "Supplier Name", "Payment Mode", "Taxable Value (Rs)", "CGST (Rs)", "SGST (Rs)", "Total Tax (Rs)", "Total Amount (Rs)"]);
    filteredPurchases.forEach((p) => {
      const base = p.weight * p.ratePerGram + (p.makingCharge || 0);
      const pTaxAmt = (base * (p.gstPct || 3)) / 100;
      rows.push([p.billNo, formatDate(p.date), p.supplierName, p.paymentMode, base.toFixed(2), (pTaxAmt/2).toFixed(2), (pTaxAmt/2).toFixed(2), pTaxAmt.toFixed(2), p.total.toFixed(2)]);
    });
    rows.push(["TOTAL", "", "", "", stats.pTaxable.toFixed(2), stats.pCgst.toFixed(2), stats.pSgst.toFixed(2), stats.pTax.toFixed(2), stats.pTotal.toFixed(2)]);

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `gst_report_${reportType.toLowerCase()}_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl">GST Report</h1>
          <p className="text-muted-foreground mt-1">Daily and monthly summary of GST invoices.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-end w-full sm:w-auto gap-4">
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Report Type</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as "Daily" | "Monthly")}>
              <SelectTrigger className="w-full sm:w-32 bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Daily">Daily</SelectItem>
                <SelectItem value="Monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 w-full sm:w-auto">
            <Label className="text-xs">Select Period</Label>
            {reportType === "Daily" ? (
              (() => {
                let displayValue = selectedDate;
                if (!dateFocused && selectedDate) {
                  const parts = selectedDate.split('-');
                  if (parts.length === 3) {
                    displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
                  }
                }
                return (
                  <Input type={dateFocused ? "date" : "text"} placeholder="DD/MM/YYYY" value={displayValue} onChange={(e) => setSelectedDate(e.target.value)} onFocus={() => setDateFocused(true)} onBlur={() => setDateFocused(false)} className="w-full sm:w-48 bg-background h-9" />
                );
              })()
            ) : (
              <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full sm:w-48 bg-background h-9" />
            )}
          </div>
          <Button onClick={exportToExcel} disabled={filteredInvoices.length === 0} variant="outline" className="h-9 w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Export to Excel
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <Card><CardContent className="pt-6 px-4"><div className="text-xs text-muted-foreground">Total Sales Invs</div><div className="text-xl font-display mt-1">{stats.count}</div></CardContent></Card>
        <Card><CardContent className="pt-6 px-4"><div className="text-xs text-muted-foreground">Sales Taxable</div><div className="text-xl font-display mt-1 text-blue-600">{inr(stats.taxable)}</div></CardContent></Card>
        <Card><CardContent className="pt-6 px-4"><div className="text-xs text-muted-foreground">Sales Tax</div><div className="text-xl font-display mt-1 text-amber-600">{inr(stats.tax)}</div></CardContent></Card>
        <Card><CardContent className="pt-6 px-4"><div className="text-xs text-muted-foreground">Total Sales</div><div className="text-xl font-display mt-1 text-green-600">{inr(stats.total)}</div></CardContent></Card>
        <Card><CardContent className="pt-6 px-4"><div className="text-xs text-muted-foreground">Total Purchases</div><div className="text-xl font-display mt-1">{stats.pCount}</div></CardContent></Card>
        <Card><CardContent className="pt-6 px-4"><div className="text-xs text-muted-foreground">Purch. Taxable</div><div className="text-xl font-display mt-1 text-blue-600">{inr(stats.pTaxable)}</div></CardContent></Card>
        <Card><CardContent className="pt-6 px-4"><div className="text-xs text-muted-foreground">Purch. Tax</div><div className="text-xl font-display mt-1 text-amber-600">{inr(stats.pTax)}</div></CardContent></Card>
        <Card><CardContent className="pt-6 px-4"><div className="text-xs text-muted-foreground">Total Purchases</div><div className="text-xl font-display mt-1 text-rose-600">{inr(stats.pTotal)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><FileText className="w-5 h-5"/> {reportType} GST Sales (Outward)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading || isLoadingP ? (
            <p className="text-center text-muted-foreground py-12">Loading data...</p>
          ) : filteredInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No GST invoices found for the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b bg-muted/20">
                  <tr><th className="py-3 px-4">Invoice No</th><th>Date</th><th>Customer</th><th className="text-right">Taxable Val</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right px-4">Total Amount</th></tr>
                </thead>
                <tbody>
              {paginated.map(i => {
                    const invTaxable = i.subtotal - (i.discount || 0) - (i.oldGoldAmount || 0);
                    return (<tr key={i.id || i._id} className="border-b last:border-0 hover:bg-muted/40"><td className="py-3 px-4 font-medium">{i.number}</td><td>{formatDate(i.createdAt)}</td><td>{i.customerName}</td><td className="text-right">{inr(invTaxable)}</td><td className="text-right text-muted-foreground">{inr(i.gstAmount / 2)}</td><td className="text-right text-muted-foreground">{inr(i.gstAmount / 2)}</td><td className="text-right px-4 font-medium text-green-700">{inr(i.total)}</td></tr>);
                  })}
                </tbody>
              </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filteredInvoices.length)} of {filteredInvoices.length} entries</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="mt-6">
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5"/> {reportType} GST Purchases (Inward)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading || isLoadingP ? (
            <p className="text-center text-muted-foreground py-12">Loading data...</p>
          ) : filteredPurchases.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No GST purchases found for the selected period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b bg-muted/20">
                  <tr><th className="py-3 px-4">Bill No</th><th>Date</th><th>Supplier</th><th className="text-right">Taxable Val</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right px-4">Total Amount</th></tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => {
                    const base = p.weight * p.ratePerGram + (p.makingCharge || 0);
                    const pTaxAmt = (base * (p.gstPct || 3)) / 100;
                    return (<tr key={p.id || p._id} className="border-b last:border-0 hover:bg-muted/40"><td className="py-3 px-4 font-medium">{p.billNo}</td><td>{formatDate(p.date)}</td><td>{p.supplierName}</td><td className="text-right">{inr(base)}</td><td className="text-right text-muted-foreground">{inr(pTaxAmt / 2)}</td><td className="text-right text-muted-foreground">{inr(pTaxAmt / 2)}</td><td className="text-right px-4 font-medium text-rose-700">{inr(p.total)}</td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}