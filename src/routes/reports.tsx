import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalState, inr, type Invoice, type Expense, type Product, type Purchase } from "@/lib/storage";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  const [invoices] = useLocalState<Invoice[]>("ajms.invoices", []);
  const [expenses] = useLocalState<Expense[]>("ajms.expenses", []);
  const [products] = useLocalState<Product[]>("ajms.products", []);
  const [purchases] = useLocalState<Purchase[]>("ajms.purchases", []);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const inMonth = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}` === monthKey; };

  const monthSales = invoices.filter(i => inMonth(i.createdAt)).reduce((s, i) => s + i.total, 0);
  const monthExpense = expenses.filter(e => inMonth(e.date)).reduce((s, e) => s + e.amount, 0);
  const monthPurchases = purchases.filter(p => inMonth(p.date)).reduce((s, p) => s + p.total, 0);
  const totalSales = invoices.reduce((s, i) => s + i.total, 0);
  const totalGst = invoices.filter(i => i.type === "GST").reduce((s, i) => s + i.gstAmount, 0);

  // Top products by qty sold
  const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
  invoices.forEach(inv => inv.items.forEach(it => {
    const cur = productSales.get(it.productId) || { name: it.name, qty: 0, revenue: 0 };
    cur.qty += it.qty;
    cur.revenue += (it.netWeight * it.ratePerGram + it.makingCharge + it.stoneCharge) * it.qty;
    productSales.set(it.productId, cur);
  }));
  const fast = [...productSales.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const dead = products.filter(p => !productSales.has(p.id)).slice(0, 5);

  return (
    <Layout>
      <header className="mb-6">
        <h1 className="text-4xl">Reports</h1>
        <p className="text-muted-foreground mt-1">Financial & inventory overview.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Monthly Sales" value={inr(monthSales)} />
        <Stat label="Monthly Expenses" value={inr(monthExpense)} />
        <Stat label="Monthly Purchases" value={inr(monthPurchases)} />
        <Stat label="Monthly Net" value={inr(monthSales - monthExpense - monthPurchases)} />
        <Stat label="Lifetime Sales" value={inr(totalSales)} />
        <Stat label="GST Collected" value={inr(totalGst)} />
        <Stat label="Total Invoices" value={invoices.length} />
        <Stat label="SKUs" value={products.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="font-display flex items-center gap-2"><BarChart3 className="w-5 h-5"/>Fast-Selling Products</CardTitle></CardHeader>
          <CardContent>
            {fast.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No sales recorded.</p> :
            <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Product</th><th className="text-right">Qty</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>{fast.map((p, i) => (<tr key={i} className="border-b last:border-0"><td className="py-2">{p.name}</td><td className="text-right">{p.qty}</td><td className="text-right">{inr(p.revenue)}</td></tr>))}</tbody>
            </table>}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle className="font-display">Dead Stock (never sold)</CardTitle></CardHeader>
          <CardContent>
            {dead.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">All stock has movement.</p> :
            <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Product</th><th>Purity</th><th className="text-right">Stock</th></tr></thead>
              <tbody>{dead.map(p => (<tr key={p.id} className="border-b last:border-0"><td className="py-2">{p.name}</td><td>{p.purity}</td><td className="text-right">{p.stock}</td></tr>))}</tbody>
            </table>}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}
