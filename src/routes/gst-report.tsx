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
import { Download, FileText } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

export default function GstReportPage() {
  const { data: invoices = [], isLoading } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());

  const [reportType, setReportType] = useState<"Daily" | "Monthly">("Daily");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [page, setPage] = useState(1);

  const gstInvoices = useMemo(() => {
    return invoices.filter((i) => i.type === "GST");
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    if (reportType === "Daily") {
      return gstInvoices.filter((i) => i.createdAt && i.createdAt.startsWith(selectedDate));
    } else {
      return gstInvoices.filter((i) => i.createdAt && i.createdAt.startsWith(selectedMonth));
    }
  }, [gstInvoices, reportType, selectedDate, selectedMonth]);

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

    return { taxable, cgst, sgst, tax, total, count: filteredInvoices.length };
  }, [filteredInvoices]);

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
              <DatePicker value={selectedDate} onChange={setSelectedDate} className="w-full sm:w-48 bg-background" />
            ) : (
              <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full sm:w-48 bg-background h-9" />
            )}
          </div>
          <Button onClick={exportToExcel} disabled={filteredInvoices.length === 0} variant="outline" className="h-9 w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Export to Excel
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total Invoices</div><div className="text-2xl font-display mt-1">{stats.count}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Taxable Value</div><div className="text-2xl font-display mt-1 text-blue-600">{inr(stats.taxable)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total Tax (CGST + SGST)</div><div className="text-2xl font-display mt-1 text-amber-600">{inr(stats.tax)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-1">Total Bill Amount</div><div className="text-2xl font-display mt-1 text-green-600">{inr(stats.total)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><FileText className="w-5 h-5"/> {reportType} GST Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
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
    </Layout>
  );
}