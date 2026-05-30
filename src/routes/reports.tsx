import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr } from "@/lib/storage";
import { TrendingUp, Wallet, AlertTriangle, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import { invoicesAPI, expensesAPI, supplierAPI } from "@/lib/api";

export default function ReportsPage() {
  const { data: invoices = [] } = useApi<any[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: expenses = [] } = useApi<any[]>(["expenses"], () => expensesAPI.getAll());
  const { data: suppliers = [] } = useApi<any[]>(["suppliers"], () => supplierAPI.getAll());

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const targetDateStr = useMemo(() => new Date(selectedDate).toDateString(), [selectedDate]);

  const dailyInvoices = useMemo(() => invoices.filter((i) => new Date(i.createdAt).toDateString() === targetDateStr), [invoices, targetDateStr]);
  const dailyExpenses = useMemo(() => expenses.filter((e) => new Date(e.date).toDateString() === targetDateStr), [expenses, targetDateStr]);

  const suppliersWithDue = useMemo(() => suppliers.filter((s) => (s.outstanding || 0) > 0), [suppliers]);

  const stats = useMemo(() => {
    const dailyIncome = dailyInvoices.reduce((s, i) => s + i.total, 0);
    const dailyExpenseTotal = dailyExpenses.reduce((s, e) => s + e.amount, 0);
    const totalDue = suppliers.reduce((s, sup) => s + (sup.outstanding || 0), 0);
    
    return {
      dailyIncome,
      dailyExpenseTotal,
      totalDue,
      net: dailyIncome - dailyExpenseTotal,
      invoicesCount: dailyInvoices.length,
      expensesCount: dailyExpenses.length
    };
  }, [dailyInvoices, dailyExpenses, suppliers]);

  const exportToExcel = () => {
    const rows = [
      ["Report Date", targetDateStr],
      ["Daily Income", stats.dailyIncome],
      ["Daily Expenses", stats.dailyExpenseTotal],
      ["Total Due", stats.totalDue],
      ["Net Revenue", stats.net],
      [],
      ["Type", "Date/ID", "Description", "Amount"]
    ];

    dailyInvoices.forEach(i => rows.push(["Income", i.number, i.customerName || "Walk-in", i.total]));
    dailyExpenses.forEach(e => rows.push(["Expense", e.date, `${e.category} - ${e.description}`, e.amount]));
    suppliers.forEach(s => {
      const due = s.outstanding || 0;
      if (due > 0) rows.push(["Supplier Due", "", s.name, due]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_report_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-4xl">Reports</h1>
          <p className="text-muted-foreground mt-1">View your daily income, expenses, and due.</p>
        </div>
        <div className="flex items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Select Date</Label>
            <Input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)} 
              className="w-48 bg-background"
            />
          </div>
          <Button onClick={exportToExcel} variant="outline" className="h-10">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Daily Income</div>
                <div className="text-2xl font-display mt-1 text-green-600">{inr(stats.dailyIncome)}</div>
                <div className="text-xs text-muted-foreground mt-1">{stats.invoicesCount} invoices</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-green-100 text-green-700 grid place-items-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Daily Expenses</div>
                <div className="text-2xl font-display mt-1 text-rose-600">{inr(stats.dailyExpenseTotal)}</div>
                <div className="text-xs text-muted-foreground mt-1">{stats.expensesCount} expenses</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-rose-100 text-rose-700 grid place-items-center">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Total Due (Suppliers)</div>
                <div className="text-2xl font-display mt-1 text-amber-600">{inr(stats.totalDue)}</div>
                <div className="text-xs text-muted-foreground mt-1">{suppliers.length} suppliers</div>
              </div>
              <div className="w-10 h-10 rounded-md bg-amber-100 text-amber-700 grid place-items-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mb-6 bg-sidebar text-sidebar-foreground border-sidebar-border">
        <CardHeader>
           <CardTitle className="font-display">Daily Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm">
             On <strong>{targetDateStr}</strong>, you have a net revenue of <strong className={stats.net >= 0 ? "text-green-500" : "text-rose-500"}>{inr(stats.net)}</strong> after deducting your daily expenses from your daily sales.
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Daily Income</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No income for this date.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Invoice</th>
                      <th>Customer</th>
                      <th>Mode</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyInvoices.map((i) => (
                      <tr key={i._id || i.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2 font-medium">{i.number}</td>
                        <td>{i.customerName || "Walk-in"}</td>
                        <td>{i.paymentMode}</td>
                        <td className="text-right text-green-600">{inr(i.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2"><Wallet className="w-5 h-5"/> Daily Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No expenses for this date.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2">Category</th>
                      <th>Description</th>
                      <th>Mode</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyExpenses.map((e) => (
                      <tr key={(e as any)._id || e.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2">{e.category}</td>
                        <td>{e.description}</td>
                        <td>{e.paymentMode}</td>
                        <td className="text-right text-rose-600">{inr(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600"/> Suppliers with Dues</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliersWithDue.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No outstanding supplier dues.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2">Supplier Name</th>
                    <th>Mobile</th>
                    <th>Category</th>
                    <th className="text-right">Due Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersWithDue.map((s) => (
                    <tr key={(s as any)._id || (s as any).id || s.name} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 font-medium">{s.name}</td>
                      <td>{s.mobile}</td>
                      <td>{s.category}</td>
                      <td className="text-right text-amber-600 font-medium">{inr(s.outstanding || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}