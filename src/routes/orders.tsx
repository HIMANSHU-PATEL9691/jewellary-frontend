import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Order, type Karigar } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { ordersAPI, customerAPI, karigarsAPI } from "@/lib/api";
import { Plus, Trash2, ShoppingBag, Pencil, Printer } from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { PaymentQr } from "@/components/PaymentQr";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

export default function OrdersPage() {
  const { data: list = [], isLoading } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const { data: karigars = [] } = useApi<Karigar[]>(["karigars"], () => karigarsAPI.getAll());
  
  const createMutation = useApiMutation((data: Order) => ordersAPI.create(data), ["orders"]);
  const updateMutation = useApiMutation((data: { id: string; body: Order }) => ordersAPI.update(data.id, data.body), ["orders"]);
  const deleteMutation = useApiMutation((id: string) => ordersAPI.delete(id), ["orders"]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchCust, setSearchCust] = useState("");
  const [searchKar, setSearchKar] = useState("");
  const [viewingReceipt, setViewingReceipt] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const empty: Order = {
    id: "",
    orderNo: "",
    date: new Date().toISOString().slice(0, 10),
    customerName: "",
    customerMobile: "",
    customerAddress: "",
    itemDescription: "",
    metal: "Gold",
    purity: "22K",
    estimatedWeight: 0,
    estimatedPrice: 0,
    advancePaid: 0,
    karigarId: "",
    dueDate: "",
    status: "Pending",
    note: "",
    customerSignature: "",
    authorizedSignatory: "",
  };
  const [form, setForm] = useState<Order>(empty);

  const save = async () => {
    if (!form.customerName || !form.itemDescription) return;
    const orderNo = form.orderNo || `ORD-${(list.length + 1).toString().padStart(4, "0")}`;
    const finalKarigarId = form.karigarId === "unassigned" ? "" : form.karigarId;
    
    // Fallback: Safely tag the assignment in the note just in case the backend silently drops the karigarId column.
    let safeNote = form.note || "";
    if (finalKarigarId) {
      const kName = karigars.find((k) => (k._id || k.id) === finalKarigarId)?.name;
      if (kName && !safeNote.includes(`[Assigned: ${kName}]`)) {
        safeNote = safeNote.replace(/\[Assigned:.*?\]/g, "").trim() + ` [Assigned: ${kName}]`;
      }
    } else {
      safeNote = safeNote.replace(/\[Assigned:.*?\]/g, "").trim();
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: { ...form, orderNo, karigarId: finalKarigarId, note: safeNote.trim() } });
        toast.success("Order updated successfully!");
      } else {
        await createMutation.mutateAsync({ ...form, orderNo, karigarId: finalKarigarId, note: safeNote.trim() });
        toast.success("Order created successfully!");
      }
      setForm(empty);
      setEditingId(null);
      setOpen(false);
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

  const totalPages = Math.ceil(list.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = list.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Customer Orders</h1>
          <p className="text-muted-foreground mt-1">Manage custom jewelry orders and advances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg" className="w-full sm:w-auto" onClick={() => { setForm(empty); setEditingId(null); }}><Plus className="w-4 h-4 mr-2"/>New Order</Button></DialogTrigger>
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
                      if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || ""});
                    }} 
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer *</Label>
                  <Select value={form.customerMobile || ""} onValueChange={(val) => {
                    const match = customers.find(c => (c.mobile || c.phone) === val);
                    if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || (match as any).phone || "", customerAddress: match.address || ""});
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
              <div className="col-span-2">
                <Field label="Customer Address" v={form.customerAddress || ""} on={v => setForm({...form, customerAddress: v})} />
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
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search Karigar</Label>
                  <Input placeholder="Search name..." value={searchKar} onChange={e => {
                    setSearchKar(e.target.value);
                    const match = karigars.find(k => k.name.toLowerCase() === e.target.value.toLowerCase() || (k.mobile||"").includes(e.target.value));
                    if (match) setForm({...form, karigarId: match._id || match.id});
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Assign Karigar</Label>
                  <Select value={form.karigarId || ""} onValueChange={val => setForm({...form, karigarId: val})}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {karigars.filter(k => k.name.toLowerCase().includes(searchKar.toLowerCase()) || (k.mobile||"").includes(searchKar)).map(k => (
                        <SelectItem key={k._id || k.id} value={k._id || k.id}>{k.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="col-span-2"><Field label="Note" v={form.note || ""} on={v => setForm({...form, note: v})} /></div>
              <div className="col-span-2 bg-muted/40 p-4 rounded-lg border border-border mt-2">
                <Label className="text-muted-foreground font-normal block mb-3">Signatures (Optional)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Customer Signature</Label>
                    <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setForm({ ...form, customerSignature: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }} />
                    {form.customerSignature && <img src={form.customerSignature} alt="Customer Signature" className="mt-2 h-16 object-contain" />}
                  </div>
                  <div>
                    <Label className="text-xs">Authorized Signatory</Label>
                    <Input type="file" accept="image/*" className="bg-background mt-1" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setForm({ ...form, authorizedSignatory: reader.result as string });
                        reader.readAsDataURL(file);
                      }
                    }} />
                    {form.authorizedSignatory && <img src={form.authorizedSignatory} alt="Authorized Signatory" className="mt-2 h-16 object-contain" />}
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={save} className="mt-2">{editingId ? "Save Changes" : "Save Order"}</Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Orders" value={list.length} />
        <Stat label="Active Orders" value={activeOrders} />
        <Stat label="Total Advances Collected" value={inr(totalAdvance)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5"/>All Orders</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading orders...</p> : list.length === 0 ? <p className="text-center text-muted-foreground py-12">No orders recorded yet.</p> :
          <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Order No</th><th>Customer</th><th>Item</th><th>Karigar</th><th>Est. Wt</th><th>Est. Total</th><th>Advance</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>{paginated.map(r => (<tr key={(r as any)._id || r.id} className="border-b last:border-0 hover:bg-muted/40">
              <td className="py-2">
                <div className="font-medium">{r.orderNo}</div>
                <div className="text-xs text-muted-foreground">{formatDate(r.date)}</div>
              </td>
              <td><div>{r.customerName}</div><div className="text-xs text-muted-foreground">{r.customerMobile}</div></td>
              <td><div>{r.itemDescription}</div><div className="text-xs text-muted-foreground">{r.metal} {r.purity}</div></td>
              <td>{karigars.find(k => k._id === r.karigarId || k.id === r.karigarId)?.name || r.note?.match(/\[Assigned:\s*(.*?)\]/)?.[1] || "—"}</td>
              <td>{r.estimatedWeight}g</td>
              <td>{inr(r.estimatedPrice)}</td>
              <td className="text-green-600 font-medium">{inr(r.advancePaid)}</td>
              <td>{r.dueDate ? formatDate(r.dueDate) : "—"}</td>
              <td><select className={`border rounded px-2 py-1 text-xs ${r.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200 font-medium' : 'bg-background'}`} value={r.status} onChange={e => setStatus((r as any)._id || r.id, e.target.value as Order["status"])}>
                {["Pending","In Progress","Ready","Delivered","Cancelled"].map(s => <option key={s}>{s}</option>)}
              </select></td>
              <td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => setViewingReceipt(r)}>
                  <Printer className="w-4 h-4 text-muted-foreground hover:text-primary" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setForm(r); setEditingId((r as any)._id || r.id || null); setOpen(true); }}><Pencil className="w-4 h-4 text-muted-foreground hover:text-primary"/></Button>
                <Button size="sm" variant="ghost" onClick={() => remove((r as any)._id || r.id)}><Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500"/></Button>
              </td>
            </tr>))}</tbody></table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, list.length)} of {list.length} entries</div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                  <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
              </div>
            )}
            </div>}
        </CardContent>
      </Card>

      {viewingReceipt && <OrderInvoiceModal order={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  if (type === "date") {
    return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><DatePicker value={v} onChange={on} className="w-full h-9" /></div>;
  }
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={e => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}

function OrderInvoiceModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const balanceDue = (order.estimatedPrice || 0) - (order.advancePaid || 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative">
        <div className="p-6 sm:p-10 print:p-0 border-2 border-transparent print:border-none m-2 print:m-0 bg-white">
          
          <ShopHeader documentLabel="Custom Order Receipt" />

          {/* Invoice Meta & Customer Details */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Customer Details:</div>
              <div className="font-bold text-lg">{order.customerName}</div>
              <div className="text-slate-700">{order.customerMobile}</div>
              {order.customerAddress && <div className="text-slate-700 mt-0.5 max-w-xs"><span className="font-medium">Address:</span> {order.customerAddress}</div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold mb-2 text-slate-900">CUSTOM ORDER RECEIPT</div>
              <table className="ml-auto text-left text-slate-700">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Order No:</td><td className="font-semibold text-slate-900">{order.orderNo}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Date Ordered:</td><td className="font-semibold text-slate-900">{formatDate(order.date)}</td></tr>
                  {order.dueDate && <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Expected Delivery:</td><td className="font-semibold text-slate-900">{formatDate(order.dueDate)}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-sm mb-6 border-collapse border border-slate-300">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-300 py-2 px-3 text-center w-12 text-slate-600">#</th>
                <th className="border border-slate-300 py-2 px-3 text-left text-slate-600">Item Description</th>
                <th className="border border-slate-300 py-2 px-3 text-left text-slate-600">Metal & Purity</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Est. Weight (g)</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Est. Price</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300 last:border-0">
                <td className="border border-slate-300 py-2 px-3 text-center text-slate-600">1</td>
                <td className="border border-slate-300 py-2 px-3 font-semibold">{order.itemDescription}</td>
                <td className="border border-slate-300 py-2 px-3 text-slate-600">{order.metal} - {order.purity}</td>
                <td className="border border-slate-300 py-2 px-3 text-right">{order.estimatedWeight} g</td>
                <td className="border border-slate-300 py-2 px-3 text-right font-bold">{inr(order.estimatedPrice)}</td>
              </tr>
            </tbody>
          </table>

          {/* Calculations & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-sm gap-6">
            <div className="w-full sm:w-1/2 sm:pr-8 order-2 sm:order-1">
            </div>
            <div className="w-full sm:w-1/2 max-w-sm order-1 sm:order-2">
              <table className="w-full">
                <tbody>
                  <tr className="border-t-2 border-slate-300 text-lg">
                    <td className="py-2 font-bold text-slate-900">Est. Total Price</td>
                    <td className="py-2 text-right font-bold text-slate-900">{inr(order.estimatedPrice)}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="py-1.5 text-slate-600">Advance Paid</td>
                    <td className="py-1.5 text-right font-semibold text-green-700">{inr(order.advancePaid)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-bold">Balance Due</td>
                    <td className="py-1.5 text-right font-bold text-rose-700">{inr(balanceDue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 flex justify-center border-t border-slate-200 pt-5">
            <PaymentQr amount={balanceDue} />
          </div>

          {/* Signatures */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 items-end text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="text-center order-2 sm:order-1">
              {order.customerSignature ? (
                <img src={order.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Customer Signature
            </div>
            <div className="normal-case tracking-normal font-normal text-left text-slate-800 order-1 sm:order-2">
              <InvoiceTerms compact />
            </div>
            <div className="text-center order-3 sm:order-3">
              {order.authorizedSignatory ? (
                <img src={order.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Authorized Signatory
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
