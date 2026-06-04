import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, type Invoice } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { invoicesAPI } from "@/lib/api";
import { Search, AlertCircle, MessageCircle } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

export default function DuesPage() {
  const { data: invoices = [], isLoading } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const [q, setQ] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const dueInvoices = useMemo(() => {
    return invoices
      .filter((i) => (i.balanceDue || 0) > 0)
      .filter(
        (i) =>
          i.customerName.toLowerCase().includes(q.toLowerCase()) ||
          i.customerMobile.includes(q) ||
          i.number.toLowerCase().includes(q.toLowerCase())
      )
      .filter((i) => {
        if (!dateFilter) return true;
        return new Date(i.createdAt).toISOString().slice(0, 10) === dateFilter;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Oldest first
  }, [invoices, q, dateFilter]);

  const totalDue = dueInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);

  const totalPages = Math.ceil(dueInvoices.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = dueInvoices.slice((currentPage - 1) * 10, currentPage * 10);

  const sendWhatsApp = (inv: Invoice) => {
    let phone = inv.customerMobile.replace(/\D/g, "");
    // Default to Indian country code if standard 10 digits are provided
    if (phone.length === 10) phone = "91" + phone;
    
    const message = `Hello ${inv.customerName},\n\nThis is a gentle reminder regarding your pending due of *${inr(inv.balanceDue || 0)}* for Invoice No: ${inv.number} dated ${formatDate(inv.createdAt)}.\n\nPlease clear the due amount at your earliest convenience.\n\nThank you!`;
    const encoded = encodeURIComponent(message);
    
    window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Customer Dues</h1>
          <p className="text-muted-foreground mt-1">Track unpaid invoices and send WhatsApp reminders.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertCircle className="w-4 h-4 text-rose-500" /> Total Outstanding Dues
            </div>
            <div className="text-3xl font-display mt-1 text-rose-600">{inr(totalDue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Unpaid Invoices</div>
            <div className="text-3xl font-display mt-1">{dueInvoices.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4 max-w-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 bg-background" placeholder="Search by customer name, mobile or invoice no" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <DatePicker 
            value={dateFilter} 
            onChange={setDateFilter} 
            className="w-40 bg-background"
          />
          {dateFilter && (
            <Button variant="ghost" onClick={() => setDateFilter("")}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">Pending Dues</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading dues...</p>
          ) : dueInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No pending dues found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b bg-muted/20">
                  <tr>
                    <th className="py-3 px-4 font-medium">Invoice Date</th>
                    <th className="py-3 font-medium">Invoice No</th>
                    <th className="py-3 font-medium">Customer</th>
                    <th className="py-3 font-medium text-right">Total Bill</th>
                    <th className="py-3 font-medium text-right text-rose-600">Due Amount</th>
                    <th className="py-3 px-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
              {paginated.map((inv) => (
                    <tr key={inv._id || inv.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 px-4">{formatDate(inv.createdAt)}</td>
                      <td className="py-3 font-medium">{inv.number}</td>
                      <td className="py-3">
                        <div className="font-medium">{inv.customerName}</div>
                        <div className="text-xs text-muted-foreground">{inv.customerMobile}</div>
                      </td>
                      <td className="py-3 text-right">{inr(inv.total)}</td>
                      <td className="py-3 text-right font-medium text-rose-600">{inr(inv.balanceDue || 0)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="outline" className="border-green-200 hover:bg-green-50 hover:text-green-700" onClick={() => sendWhatsApp(inv)}>
                          <MessageCircle className="w-4 h-4 mr-2 text-green-600" /> Reminder
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, dueInvoices.length)} of {dueInvoices.length} entries</div>
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