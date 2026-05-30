import { Link } from "react-router-dom";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, type Invoice } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { Receipt, Trash2 } from "lucide-react";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { invoicesAPI } from "@/lib/api";

export default function SalesPage() {
  const { data: invoices = [] } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const deleteMutation = useApiMutation((id: string) => invoicesAPI.delete(id), ["invoices"]);

  const [q, setQ] = useState("");
  const [type, setType] = useState<"All" | "GST" | "NON-GST">("All");

  const filtered = invoices.filter(i =>
    (type === "All" || i.type === type) &&
    (i.number + i.customerName + i.customerMobile).toLowerCase().includes(q.toLowerCase())
  );
  const total = filtered.reduce((s, i) => s + i.total, 0);

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
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Invoice</th><th>Date</th><th>Customer</th><th>Type</th><th>Mode</th><th>Items</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>{[...filtered].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).map(i => (<tr key={i._id || i.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{i.number}</td>
              <td>{formatDate(i.createdAt)}</td>
              <td>{i.customerName}<div className="text-xs text-muted-foreground">{i.customerMobile}</div></td>
              <td>{i.type}</td><td>{i.paymentMode}</td><td>{i.items.length}</td>
              <td className="text-right">{inr(i.total)}</td>
              <td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutateAsync(i._id || i.id)}>
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
