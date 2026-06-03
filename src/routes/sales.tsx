import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, type Invoice } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { Receipt, Trash2, TrendingUp } from "lucide-react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { invoicesAPI, inventoryAPI } from "@/lib/api";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

export default function SalesPage() {
  const { data: invoices = [] } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: products = [] } = useApi<any[]>(["inventory"], () => inventoryAPI.getAll());
  const deleteMutation = useApiMutation((id: string) => invoicesAPI.delete(id), ["invoices"]);
  const updateProductMutation = useApiMutation((data: { id: string; body: any }) => inventoryAPI.update(data.id, data.body), ["inventory"]);

  const [q, setQ] = useState("");
  const [type, setType] = useState<"All" | "GST" | "NON-GST">("All");

  const filtered = invoices.filter(i =>
    (type === "All" || i.type === type) &&
    (i.number + i.customerName + i.customerMobile).toLowerCase().includes(q.toLowerCase())
  );
  const total = filtered.reduce((s, i) => s + i.total, 0);

  const last30Days = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toDateString();
      const dayTotal = filtered.filter(inv => new Date(inv.createdAt).toDateString() === dStr).reduce((s, x) => s + x.total, 0);
      arr.push({ date: `${d.getDate()}/${d.getMonth()+1}`, Sales: dayTotal });
    }
    return arr;
  }, [filtered]);

  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 100000) return `₹${(tickItem / 100000).toFixed(1)}L`;
    if (tickItem >= 1000) return `₹${(tickItem / 1000).toFixed(1)}k`;
    return `₹${tickItem}`;
  };

  const removeInvoice = async (invoice: Invoice) => {
    if (window.confirm(`Are you sure you want to delete Invoice ${invoice.number}? This will also add the sold items back to your inventory.`)) {
      try {
        // Add stock back to inventory
        for (const item of invoice.items) {
          const p = products.find((x) => (x.id || x._id) === item.productId);
          if (p) {
            const newStock = (p.stock || 0) + (item.qty || 1);
            await updateProductMutation.mutateAsync({ id: p._id || p.id, body: { ...p, stock: newStock } });
          }
        }
        await deleteMutation.mutateAsync(invoice._id || invoice.id || "");
        toast.success("Invoice deleted and stock restored.");
      } catch (e) { toast.error("Failed to delete invoice."); }
    }
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div><h1 className="text-4xl">Sales</h1><p className="text-muted-foreground mt-1">All invoices issued.</p></div>
        <Link to="/billing"><Button size="lg">New Invoice</Button></Link>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total Invoices" value={invoices.length} />
        <Stat label="Filtered Total" value={inr(total)} />
        <Stat label="Avg Invoice" value={inr(filtered.length ? total / filtered.length : 0)} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Sales Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last30Days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} tickFormatter={formatYAxis} />
              <RechartsTooltip formatter={(value: number) => [inr(value), "Sales"]} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="font-display flex items-center gap-2"><Receipt className="w-5 h-5"/>Invoice History</CardTitle>
          <div className="flex gap-2">
            <select className="border rounded px-2 bg-background text-sm" value={type} onChange={e => setType(e.target.value as typeof type)}>
              <option>All</option><option>GST</option><option>NON-GST</option>
            </select>
            <Input placeholder="Search invoice / customer" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? <p className="text-center text-muted-foreground py-12">No invoices match.</p> :
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Invoice</th><th>Date</th><th>Customer</th><th>Type</th><th>Mode</th><th>Items</th><th className="text-right">Total</th><th className="text-center px-4">Status</th><th></th></tr></thead>
            <tbody>{[...filtered].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(i => (<tr key={i._id || i.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{i.number}</td>
              <td>{formatDate(i.createdAt)}</td>
              <td>{i.customerName}<div className="text-xs text-muted-foreground">{i.customerMobile}</div></td>
              <td>{i.type}</td><td>{i.paymentMode}</td><td>{i.items.length}</td>
              <td className="text-right">{inr(i.total)}</td>
              <td className="text-center px-4">
                {(i.balanceDue || 0) <= 0 ? (
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Paid</span>
                ) : (
                  <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">Due</span>
                )}
              </td>
              <td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => removeInvoice(i)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </td>
            </tr>))}</tbody></table>}
        </CardContent>
      </Card>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}
