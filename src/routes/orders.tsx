import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Order } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { ordersAPI, customerAPI } from "@/lib/api";
import { Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export default function OrdersPage() {
  const { data: list = [], isLoading } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  
  const createMutation = useApiMutation((data: Order) => ordersAPI.create(data), ["orders"]);
  const updateMutation = useApiMutation((data: { id: string; body: Order }) => ordersAPI.update(data.id, data.body), ["orders"]);
  const deleteMutation = useApiMutation((id: string) => ordersAPI.delete(id), ["orders"]);

  const [open, setOpen] = useState(false);
  const [searchCust, setSearchCust] = useState("");
  const empty: Order = {
    id: "",
    orderNo: "",
    date: new Date().toISOString().slice(0, 10),
    customerName: "",
    customerMobile: "",
    itemDescription: "",
    metal: "Gold",
    purity: "22K",
    estimatedWeight: 0,
    estimatedPrice: 0,
    advancePaid: 0,
    dueDate: "",
    status: "Pending",
    note: ""
  };
  const [form, setForm] = useState<Order>(empty);

  const save = async () => {
    if (!form.customerName || !form.itemDescription) return;
    const orderNo = form.orderNo || `ORD-${(list.length + 1).toString().padStart(4, "0")}`;
    try {
      await createMutation.mutateAsync({ ...form, orderNo });
      setForm(empty);
      setOpen(false);
      toast.success("Order created successfully!");
    } catch (error) {
      console.error("[Orders] Error saving to DB:", error);
      toast.error("Failed to connect to backend server. Is it running?");
    }
  };

  const setStatus = async (id: string, status: Order["status"]) => {
    const order = list.find(r => r.id === id || (r as any)._id === id);
    if (order) {
      await updateMutation.mutateAsync({ id, body: { ...order, status } });
    }
  };

  const remove = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const activeOrders = list.filter(r => r.status === "Pending" || r.status === "In Progress" || r.status === "Ready").length;
  const totalAdvance = list.reduce((s, r) => s + (r.advancePaid || 0), 0);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Customer Orders</h1>
          <p className="text-muted-foreground mt-1">Manage custom jewelry orders and advances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg"><Plus className="w-4 h-4 mr-2"/>New Order</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Create Custom Order</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search Customer</Label>
                  <Input 
                    placeholder="Search name or mobile..." 
                    value={searchCust} 
                    onChange={(e) => {
                      setSearchCust(e.target.value);
                      const match = customers.find(c => c.mobile === e.target.value || (c as any).phone === e.target.value || c.name.toLowerCase() === e.target.value.toLowerCase());
                      if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || ""});
                    }} 
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer *</Label>
                  <Select value={form.customerMobile || ""} onValueChange={(val) => {
                    const match = customers.find(c => (c.mobile || c.phone) === val);
                    if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || ""});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.filter(c => c.name.toLowerCase().includes(searchCust.toLowerCase()) || (c.mobile || (c as any).phone || "").includes(searchCust)).map((c) => (
                        <SelectItem key={c.mobile || c.phone} value={c.mobile || c.phone}>{c.name} · {c.mobile || (c as any).phone}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Field label="Item Description *" v={form.itemDescription} on={v => setForm({...form, itemDescription: v})} />
              <div>
                <Label className="text-xs">Metal</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background text-sm" value={form.metal} onChange={e => setForm({...form, metal: e.target.value as Order["metal"]})}>
                  <option>Gold</option><option>Silver</option><option>Diamond</option><option>Platinum</option><option>Other</option>
                </select>
              </div>
              <Field label="Purity" v={form.purity} on={v => setForm({...form, purity: v})} />
              <Field label="Estimated Weight (g)" type="number" v={String(form.estimatedWeight || "")} on={v => setForm({...form, estimatedWeight: +v})} />
              <Field label="Estimated Price ₹" type="number" v={String(form.estimatedPrice || "")} on={v => setForm({...form, estimatedPrice: +v})} />
              <Field label="Advance Paid ₹" type="number" v={String(form.advancePaid || "")} on={v => setForm({...form, advancePaid: +v})} />
              <Field label="Date" type="date" v={form.date} on={v => setForm({...form, date: v})} />
              <Field label="Due Date" type="date" v={form.dueDate || ""} on={v => setForm({...form, dueDate: v})} />
              <div className="col-span-2"><Field label="Note" v={form.note || ""} on={v => setForm({...form, note: v})} /></div>
            </div>
            <Button onClick={save} className="mt-2">Save Order</Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total Orders" value={list.length} />
        <Stat label="Active Orders" value={activeOrders} />
        <Stat label="Total Advances Collected" value={inr(totalAdvance)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5"/>All Orders</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading orders...</p> : list.length === 0 ? <p className="text-center text-muted-foreground py-12">No orders recorded yet.</p> :
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Order No</th><th>Customer</th><th>Item</th><th>Est. Wt</th><th>Est. Total</th><th>Advance</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map(r => (<tr key={(r as any)._id || r.id} className="border-b last:border-0 hover:bg-muted/40">
              <td className="py-2">
                <div className="font-medium">{r.orderNo}</div>
                <div className="text-xs text-muted-foreground">{formatDate(r.date)}</div>
              </td>
              <td><div>{r.customerName}</div><div className="text-xs text-muted-foreground">{r.customerMobile}</div></td>
              <td><div>{r.itemDescription}</div><div className="text-xs text-muted-foreground">{r.metal} {r.purity}</div></td>
              <td>{r.estimatedWeight}g</td>
              <td>{inr(r.estimatedPrice)}</td>
              <td className="text-green-600 font-medium">{inr(r.advancePaid)}</td>
              <td>{r.dueDate ? formatDate(r.dueDate) : "—"}</td>
              <td><select className="border rounded px-2 py-1 bg-background text-xs" value={r.status} onChange={e => setStatus((r as any)._id || r.id, e.target.value as Order["status"])}>
                {["Pending","In Progress","Ready","Delivered","Cancelled"].map(s => <option key={s}>{s}</option>)}
              </select></td>
              <td className="text-right"><Button size="sm" variant="ghost" onClick={() => remove((r as any)._id || r.id)}><Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500"/></Button></td>
            </tr>))}</tbody></table>}
        </CardContent>
      </Card>
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return <div><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={e => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}