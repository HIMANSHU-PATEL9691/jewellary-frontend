import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useLocalState,
  inr,
  type Product,
  type Customer,
  type Invoice,
  type Expense,
  type Repair,
  type JobWork,
  type Purchase,
  type Supplier,
  type MetalRates,
} from "@/lib/storage";
import {
  Package,
  Receipt,
  TrendingUp,
  Star,
  UserCheck,
  CalendarRange,
  Wallet,
  AlertTriangle,
  Wrench,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";

const LOYAL_THRESHOLD = 3;
const defaultRates: MetalRates = { updatedAt: new Date().toISOString(), gold24: 7850, gold22: 7200, gold18: 5890, silver: 98 };

export default function Dashboard() {
  const [products] = useLocalState<Product[]>("ajms.products", []);
  const [customers] = useLocalState<Customer[]>("ajms.customers", []);
  const [invoices] = useLocalState<Invoice[]>("ajms.invoices", []);
  const [expenses] = useLocalState<Expense[]>("ajms.expenses", []);
  const [repairs] = useLocalState<Repair[]>("ajms.repairs", []);
  const [jobwork] = useLocalState<JobWork[]>("ajms.jobwork", []);
  const [purchases] = useLocalState<Purchase[]>("ajms.purchases", []);
  const [suppliers] = useLocalState<Supplier[]>("ajms.suppliers", []);
  const [rates] = useLocalState<MetalRates>("ajms.metalRates", defaultRates);

  const displayRates = {
    gold24: rates.gold24 ?? defaultRates.gold24,
    gold22: rates.gold22 ?? defaultRates.gold22,
    gold18: rates.gold18 ?? defaultRates.gold18,
    silver: rates.silver ?? defaultRates.silver,
    updatedAt: rates.updatedAt ?? defaultRates.updatedAt,
  };

  const now = new Date();
  const today = now.toDateString();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const inMonth = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}` === monthKey; };

  const todayInvoices = invoices.filter((i) => new Date(i.createdAt).toDateString() === today);
  const monthInvoices = invoices.filter((i) => inMonth(i.createdAt));
  const todaySales = todayInvoices.reduce((s, i) => s + i.total, 0);
  const totalSell = invoices.reduce((s, i) => s + i.total, 0);
  const monthRevenue = monthInvoices.reduce((s, i) => s + i.total, 0);
  const todayExpense = expenses.filter((e) => new Date(e.date).toDateString() === today).reduce((s, e) => s + e.amount, 0);
  const monthExpense = expenses.filter((e) => inMonth(e.date)).reduce((s, e) => s + e.amount, 0);
  const totalDue = suppliers.reduce((s, sup) => s + (sup.outstanding || 0), 0);
  const purchaseAmount = purchases.reduce((s, p) => s + p.total, 0);
  const todayCustomers = new Set(todayInvoices.map((i) => i.customerId || i.customerMobile || i.customerName)).size;

  const counts = new Map<string, number>();
  invoices.forEach((i) => { if (i.customerId) counts.set(i.customerId, (counts.get(i.customerId) || 0) + 1); });
  const loyal = customers.filter((c) => (counts.get(c.id) || 0) >= LOYAL_THRESHOLD).length;
  const normal = customers.length - loyal;

  const stockValue = products.reduce((s, p) => s + p.netWeight * p.ratePerGram * p.stock, 0);
  const goldGrams = products.filter(p => p.category === "Gold").reduce((s, p) => s + p.netWeight * p.stock, 0);
  const silverGrams = products.filter(p => p.category === "Silver").reduce((s, p) => s + p.netWeight * p.stock, 0);

  // 7-day trend
  const days: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const lbl = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    const total = invoices.filter(inv => new Date(inv.createdAt).toDateString() === d.toDateString()).reduce((s, x) => s + x.total, 0);
    days.push({ label: lbl, total });
  }
  const maxDay = Math.max(1, ...days.map(d => d.total));

  const lowStock = products.filter(p => p.stock <= 2).length;
  const pendingRepairs = repairs.filter(r => r.status !== "Delivered").length;
  const pendingJobs = jobwork.filter(j => j.status !== "Settled").length;

  const stats = [
    { label: "Total Sell", value: inr(totalSell), icon: TrendingUp, sub: `${invoices.length} invoices`, to: "/sales" },
    { label: "Total Money Today", value: inr(todaySales), icon: Wallet, sub: `${todayInvoices.length} invoices`, to: "/sales" },
    { label: "Total Due", value: inr(totalDue), icon: AlertTriangle, sub: `${suppliers.length} suppliers`, to: "/suppliers" },
    { label: "Purchase Amount", value: inr(purchaseAmount), icon: Package, sub: `${purchases.length} purchases`, to: "/purchases" },
    { label: "Today's Customers", value: todayCustomers, icon: UserCheck, sub: `${todayInvoices.length} invoices`, to: "/customers" },
    { label: "Today's Sales", value: inr(todaySales), icon: TrendingUp, sub: `${todayInvoices.length} invoices`, to: "/sales" },
    { label: "24K Gold Rate", value: inr(displayRates.gold24), icon: TrendingUp, sub: "/g", to: "/gold-rates" },
    { label: "22K Gold Rate", value: inr(displayRates.gold22), icon: TrendingUp, sub: "/g", to: "/gold-rates" },
    { label: "Silver Rate", value: inr(displayRates.silver), icon: TrendingUp, sub: "/g", to: "/gold-rates" },
    { label: "Total Gold (g)", value: `${goldGrams.toFixed(2)}g`, icon: Package, sub: `${goldGrams.toFixed(2)} g`, to: "/inventory" },
    { label: "Total Silver (g)", value: `${silverGrams.toFixed(2)}g`, icon: Package, sub: `${silverGrams.toFixed(2)} g`, to: "/inventory" },
    { label: "Today's Income (net)", value: inr(todaySales - todayExpense), icon: Wallet, sub: `Expense ${inr(todayExpense)}`, to: "/reports" },
    { label: "Monthly Revenue", value: inr(monthRevenue), icon: CalendarRange, sub: `${monthInvoices.length} invoices`, to: "/sales" },
    { label: "Monthly Net", value: inr(monthRevenue - monthExpense), icon: TrendingUp, sub: `Expense ${inr(monthExpense)}`, to: "/reports" },
    { label: "Loyal Customers", value: loyal, icon: Star, sub: `${LOYAL_THRESHOLD}+ purchases`, to: "/customers" },
    { label: "Normal Customers", value: normal, icon: UserCheck, sub: "<3 purchases", to: "/customers" },
    { label: "Stock Value", value: inr(stockValue), icon: Package, sub: `${goldGrams.toFixed(1)}g gold`, to: "/inventory" },
    { label: "Total Invoices", value: invoices.length, icon: Receipt, sub: `${customers.length} customers`, to: "/sales" },
    { label: "Inventory Items", value: products.length, icon: Package, sub: `${goldGrams.toFixed(2)}g stock`, to: "/inventory" },
    { label: "Pending Repairs", value: pendingRepairs, icon: Wrench, sub: `${pendingRepairs} open`, to: "/repairs" },
  ];

  const recent = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const [dateString, setDateString] = useState("");
  useEffect(() => {
    setDateString(new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  }, []);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-4xl">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your business overview for {dateString}</p>
        </div>
        <Link to="/billing"><Button size="lg">New Invoice</Button></Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => {
          const card = (
            <Card key={s.label} className="border-border hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">{s.label}</div>
                    <div className="text-2xl font-display mt-1">{s.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
                  </div>
                  <div className="w-10 h-10 rounded-md bg-accent text-accent-foreground grid place-items-center">
                    <s.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          return s.to ? (
            <Link key={s.label} to={s.to} className="block">
              {card}
            </Link>
          ) : card;
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Sales Trend (7 Days)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-48">
              {days.map(d => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs text-muted-foreground">{d.total ? inr(d.total).replace("₹","₹") : ""}</div>
                  <div className="w-full bg-accent rounded-t-md relative" style={{ height: `${(d.total / maxDay) * 100}%`, minHeight: "4px" }}>
                    <div className="absolute inset-0 bg-primary rounded-t-md opacity-90"/>
                  </div>
                  <div className="text-xs text-muted-foreground">{d.label}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-sidebar text-sidebar-foreground">
          <CardHeader><CardTitle className="font-display">Today's Metal Rates</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <RateBox label="24K Gold" value={displayRates.gold24} />
            <RateBox label="22K Gold" value={displayRates.gold22} />
            <RateBox label="18K Gold" value={displayRates.gold18} />
            <RateBox label="Silver" value={displayRates.silver} />
            <div className="col-span-2 text-xs text-muted-foreground text-right">
              <span suppressHydrationWarning>Updated: {formatDate(displayRates.updatedAt) || dateString || "—"}</span>
              <Link to="/gold-rates" className="ml-2 underline">Edit</Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Recent Sales</CardTitle></CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No invoices yet. Create your first one from Billing.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Invoice</th><th>Customer</th><th>Type</th><th>Mode</th><th className="text-right">Total</th></tr></thead>
                <tbody>{recent.map((i) => (<tr key={i.id} className="border-b last:border-0"><td className="py-2 font-medium">{i.number}</td><td>{i.customerName || "—"}</td><td>{i.type}</td><td>{i.paymentMode}</td><td className="text-right">{inr(i.total)}</td></tr>))}</tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-600"/>Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <AlertRow icon={Package} label="Low Stock Items" value={lowStock} to="/inventory" />
            <AlertRow icon={Wrench} label="Pending Repairs" value={pendingRepairs} to="/repairs" />
            <AlertRow icon={ClipboardList} label="Pending Job Work" value={pendingJobs} to="/jobwork" />
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function RateBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background/10 rounded-md p-3 border border-sidebar-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-display">{inr(value)}<span className="text-xs text-muted-foreground">/g</span></div>
    </div>
  );
}

function AlertRow({ icon: Icon, label, value, to }: { icon: typeof Package; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent transition-colors">
      <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground"/><span className="text-sm">{label}</span></div>
      <span className="font-display text-lg">{value}</span>
    </Link>
  );
}
