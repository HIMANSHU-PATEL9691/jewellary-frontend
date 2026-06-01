import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Repair, type Karigar } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { repairsAPI, karigarsAPI, customerAPI } from "@/lib/api";
import { Plus, Trash2, Wrench, Pencil, Printer } from "lucide-react";

export default function RepairsPage() {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchCust, setSearchCust] = useState("");
  const [searchKar, setSearchKar] = useState("");
  const empty: Repair = { ticketNo: "", date: new Date().toISOString().slice(0,10), customerName: "", customerMobile: "", itemDescription: "", itemWeight: 0, problem: "", estimate: 0, advance: 0, deliveryDate: "", karigarId: "", status: "Received", note: "", customerSignature: "", authorizedSignatory: "" };
  const [form, setForm] = useState<Repair>(empty);
  const [viewingReceipt, setViewingReceipt] = useState<Repair | null>(null);

  const { data = [], isLoading, error } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());
  const { data: karigars = [] } = useApi<Karigar[]>(["karigars"], () => karigarsAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const createMutation = useApiMutation((data: Repair) => repairsAPI.create(data), ["repairs"]);
  const updateMutation = useApiMutation(
    (data: { id: string; body: Repair }) => repairsAPI.update(data.id, data.body),
    ["repairs"]
  );
  const deleteMutation = useApiMutation((id: string) => repairsAPI.delete(id), ["repairs"]);

  const list = (data || []).map((item) => ({
    ...item,
    id: item.id || item._id,
    date: item.date ? new Date(item.date).toISOString().slice(0,10) : new Date().toISOString().slice(0,10),
    deliveryDate: item.deliveryDate ? new Date(item.deliveryDate).toISOString().slice(0,10) : "",
  }));

  const save = async () => {
    if (!form.customerName) return;
    const ticketNo = form.ticketNo || `REP-${(list.length + 1).toString().padStart(4, "0")}`;
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

    const payload = { ...form, ticketNo, status: form.status || "Received", karigarId: finalKarigarId, note: safeNote.trim() };

    console.log("[Repairs] Attempting to save to DB:", payload);
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      console.log("[Repairs] Successfully saved to DB!");
      setForm(empty);
      setEditingId(null);
      setOpen(false);
    } catch (error: any) {
      console.error("[Repairs] Error saving to DB:", error);
    }
  };

  const setStatus = async (id: string, status: Repair["status"]) => {
    const repair = list.find((r) => r.id === id || r._id === id);
    if (!repair || !repair._id) return;
    await updateMutation.mutateAsync({ id: repair._id, body: { ...repair, status } });
  };

  const remove = async (id: string) => {
    const repair = list.find((r) => r.id === id || r._id === id);
    if (!repair || !repair._id) return;
    await deleteMutation.mutateAsync(repair._id);
  };

  const pending = list.filter((r) => r.status !== "Delivered").length;
  const totalEstimate = list.filter((r) => r.status !== "Delivered").reduce((s, r) => s + (r.estimate || 0), 0);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Repairs</h1>
          <p className="text-muted-foreground mt-1">Customer repair orders & status.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={() => { setForm(empty); setEditingId(null); }}>
              <Plus className="w-4 h-4 mr-2" />New Repair
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>New Repair Ticket</DialogTitle>
            </DialogHeader>
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
              <div className="col-span-2">
                <Field label="Item Description" v={form.itemDescription} on={(v) => setForm({ ...form, itemDescription: v })} />
              </div>
              <Field label="Item Weight (g)" type="number" v={String(form.itemWeight)} on={(v) => setForm({ ...form, itemWeight: +v })} />
              <Field label="Problem" v={form.problem} on={(v) => setForm({ ...form, problem: v })} />
              <Field label="Estimate ₹" type="number" v={String(form.estimate)} on={(v) => setForm({ ...form, estimate: +v })} />
              <Field label="Advance ₹" type="number" v={String(form.advance)} on={(v) => setForm({ ...form, advance: +v })} />
              <Field label="Date" type="date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
              <Field label="Delivery Date" type="date" v={form.deliveryDate || ""} on={(v) => setForm({ ...form, deliveryDate: v })} />
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
                  <Label className="text-xs">Karigar</Label>
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
              <div className="col-span-2">
                <Field label="Note" v={form.note || ""} on={(v) => setForm({ ...form, note: v })} />
              </div>
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
            <Button onClick={save} className="mt-2">
              {editingId ? "Save Changes" : "Create Ticket"}
            </Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total Tickets" value={list.length} />
        <Stat label="Pending" value={pending} />
        <Stat label="Pending Estimates" value={inr(totalEstimate)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Wrench className="w-5 h-5" />Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading repairs...</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12">Failed to load repairs.</p>
          ) : list.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No repair tickets yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2">Ticket</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Item</th>
                  <th>Karigar</th>
                  <th>Estimate</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{r.ticketNo}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>{r.customerName}</td>
                    <td>{r.itemDescription}</td>
                    <td>{karigars.find((k) => k._id === r.karigarId || k.id === r.karigarId)?.name || r.note?.match(/\[Assigned:\s*(.*?)\]/)?.[1] || "—"}</td>
                    <td>{inr(r.estimate)}</td>
                    <td>
                      <select
                        className={`border rounded px-2 py-1 text-xs ${r.status === 'Ready' ? 'bg-green-50 text-green-700 border-green-200 font-medium' : 'bg-background'}`}
                        value={r.status}
                        onChange={(e) => setStatus(r.id || r._id || '', e.target.value as Repair['status'])}
                      >
                        {['Received', 'In Progress', 'Ready', 'Delivered'].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setViewingReceipt(r)}>
                        <Printer className="w-4 h-4 text-muted-foreground hover:text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setForm(r); setEditingId(r.id || r._id || null); setOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id || r._id || '')}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {viewingReceipt && <RepairInvoiceModal repair={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return <div><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={(e) => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}

function RepairInvoiceModal({ repair, onClose }: { repair: Repair; onClose: () => void }) {
  const balanceDue = (repair.estimate || 0) - (repair.advance || 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative">
        <div className="p-6 sm:p-10 print:p-0 border-2 border-transparent print:border-none m-2 print:m-0 bg-white">
          
          {/* Shop Header */}
          <div className="text-center border-b-2 border-slate-300 pb-5 mb-6">
            <h2 className="text-4xl font-display font-bold uppercase tracking-widest text-slate-900">Cloudiefy Jewellers</h2>
            <p className="text-sm mt-2 text-slate-700">123 Main Bazaar, City Center, State - 123456</p>
            <p className="text-sm text-slate-700">Mobile: +91 98765 43210 | Email: contact@cloudiefy.com</p>
          </div>

          {/* Invoice Meta & Customer Details */}
          <div className="flex justify-between items-start mb-6 text-sm">
            <div>
              <div className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-1">Customer Details:</div>
              <div className="font-bold text-lg">{repair.customerName}</div>
              <div className="text-slate-700">{repair.customerMobile}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-display font-bold mb-2 text-slate-900">REPAIR RECEIPT</div>
              <table className="ml-auto text-left text-slate-700">
                <tbody>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Ticket No:</td><td className="font-semibold text-slate-900">{repair.ticketNo}</td></tr>
                  <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Date Received:</td><td className="font-semibold text-slate-900">{formatDate(repair.date)}</td></tr>
                  {repair.deliveryDate && <tr><td className="pr-4 py-0.5 text-right font-medium text-slate-500">Delivery Date:</td><td className="font-semibold text-slate-900">{formatDate(repair.deliveryDate)}</td></tr>}
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
                <th className="border border-slate-300 py-2 px-3 text-left text-slate-600">Problem / Work Done</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Weight (g)</th>
                <th className="border border-slate-300 py-2 px-3 text-right text-slate-600">Charges</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-300 last:border-0">
                <td className="border border-slate-300 py-2 px-3 text-center text-slate-600">1</td>
                <td className="border border-slate-300 py-2 px-3 font-semibold">{repair.itemDescription}</td>
                <td className="border border-slate-300 py-2 px-3 text-rose-600">{repair.problem}</td>
                <td className="border border-slate-300 py-2 px-3 text-right">{repair.itemWeight} g</td>
                <td className="border border-slate-300 py-2 px-3 text-right font-bold">{inr(repair.estimate)}</td>
              </tr>
            </tbody>
          </table>

          {/* Calculations & Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start text-sm gap-6">
            <div className="w-full sm:w-1/2 sm:pr-8 order-2 sm:order-1">
               {/* Terms and conditions */}
               <div className="text-xs text-slate-600 p-4 bg-slate-50 rounded-md border border-slate-200">
                 <p className="font-bold mb-1 text-slate-800 uppercase tracking-wider">Terms & Conditions:</p>
                 <ol className="list-decimal pl-4 space-y-1">
                   <li>We are not responsible for old ornaments given for repair without proper documentation.</li>
                   <li>Please verify weight and purity before taking delivery.</li>
                   <li>Subject to local jurisdiction.</li>
                 </ol>
               </div>
               
              {balanceDue <= 0 && (
                <div className="mt-4 p-2 bg-green-50 border border-green-200 text-green-800 text-center font-bold rounded tracking-widest text-lg">
                  PAYMENT DONE
                </div>
              )}
            </div>
            <div className="w-full sm:w-1/2 max-w-sm order-1 sm:order-2">
              <table className="w-full">
                <tbody>
                  <tr className="border-t-2 border-slate-300 text-lg">
                    <td className="py-2 font-bold text-slate-900">Total Charges</td>
                    <td className="py-2 text-right font-bold text-slate-900">{inr(repair.estimate)}</td>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <td className="py-1.5 text-slate-600">Advance Paid</td>
                    <td className="py-1.5 text-right font-semibold text-green-700">{inr(repair.advance)}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 font-bold">Balance Due</td>
                    <td className="py-1.5 text-right font-bold text-rose-700">{inr(balanceDue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures */}
          <div className="mt-16 flex justify-between items-end text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="text-center">
              {repair.customerSignature ? (
                <img src={repair.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-48 border-t-2 border-slate-300 mb-2 mx-auto"></div>
              )}
              Customer Signature
            </div>
            <div className="text-center">
              {repair.authorizedSignatory ? (
                <img src={repair.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
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
