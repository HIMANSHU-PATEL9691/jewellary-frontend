import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Purchase, type Supplier, useLocalState } from "@/lib/storage";
import { useDebounce } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { purchasesAPI, supplierAPI } from "@/lib/api";
import { Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const formatDate = (date: string | Date) => {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return isNaN(d.getTime()) ? "" : format(d, "dd/MM/yyyy");
};
function calcTotal(p: Purchase) {
  const base = p.weight * p.ratePerGram + p.makingCharge;
  return base + (base * p.gstPct) / 100;
}

export default function PurchasesPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const isOperator = authUser?.role === "operator";
  const { data: list = [], isLoading } = useApi<Purchase[]>(["purchases"], () => purchasesAPI.getAll());
  const { data: suppliers = [] } = useApi<Supplier[]>(["suppliers"], () => supplierAPI.getAll());

  const createMutation = useApiMutation((data: Purchase) => purchasesAPI.create(data), ["purchases"]);
  const deleteMutation = useApiMutation((id: string) => purchasesAPI.delete(id), ["purchases"]);
  const updateSupplierMutation = useApiMutation((data: { id: string; body: Supplier }) => supplierAPI.update(data.id, data.body), ["suppliers"]);

  const [open, setOpen] = useState(false);
  const [searchSup, setSearchSup] = useState("");
  const debouncedSearchSup = useDebounce(searchSup, 300);
  const [page, setPage] = useState(1);
  const empty: any = { id: "", type: "GST", billNo: "", date: new Date().toISOString().slice(0,10), supplierId: "", supplierName: "", metal: "Gold", purity: "22K", weight: 0, ratePerGram: 0, makingCharge: 0, gstPct: 3, total: 0, paymentMode: "Cash", note: "" };
  const [form, setForm] = useState<Purchase & { type?: string }>({
    ...empty, type: isOperator ? "GST" : "NON-GST", gstPct: isOperator ? 3 : 0
  });

  const save = async () => {
    if (!form.supplierName || !form.weight) return;
    const billNo = form.billNo || `PUR-${(list.length + 1).toString().padStart(4, "0")}`;
    const total = calcTotal(form);
    try {
      await createMutation.mutateAsync({ ...form, billNo, total } as any);
      
      // Auto-update Supplier Ledger Balance & Transactions
      if (form.supplierId) {
        const s: any = suppliers.find(x => (x._id || x.id) === form.supplierId);
        if (s) {
          const newTx = {
            id: Date.now().toString(),
            date: form.date,
            type: "Credit" as const, // Credit means we owe the supplier metal/money
            metal: form.metal as any,
            purity: form.purity || "22K",
            weight: Number(form.weight) || 0,
            note: `Purchase Bill: ${billNo} (${(form as any).type || "GST"})`
          };
          const isGold = form.metal === "Gold";
          
          let newOutstanding = s.outstanding || 0;
          if (form.paymentMode === "Credit") newOutstanding += total;

          await updateSupplierMutation.mutateAsync({
            id: s._id || s.id || "",
            body: {
              ...s,
              balanceGold: (s.balanceGold || 0) + (isGold ? form.weight : 0),
              balanceSilver: (s.balanceSilver || 0) + (!isGold ? form.weight : 0),
              outstanding: newOutstanding,
              transactions: [...(s.transactions || []), newTx]
            } as any
          });
        }
      }

      setForm(empty); 
      setOpen(false);
      toast.success("Purchase recorded successfully!");
    } catch (error) {
      console.error("[Purchases] Error saving to DB:", error);
    }
  };

  const remove = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this purchase? This will also remove the transaction from the supplier's ledger.")) {
      const p: any = list.find((x: any) => (x._id || x.id) === id);
      if (p && p.supplierId) {
        const s: any = suppliers.find((x: any) => (x._id || x.id) === p.supplierId);
        if (s) {
          const txIndex = (s.transactions || []).findIndex((t: any) => t.note && t.note.includes(`Purchase Bill: ${p.billNo}`));
          let updatedTransactions = s.transactions || [];
          let weightToDeduct = p.weight || 0;
          let isGold = p.metal === "Gold";

          // If the matching transaction is found, safely pull its exact weight to reverse
          if (txIndex !== -1) {
            const tx = updatedTransactions[txIndex];
            if (tx.type === "Credit") {
              weightToDeduct = tx.weight;
              isGold = tx.metal === "Gold";
            } else {
              weightToDeduct = 0;
            }
            updatedTransactions = [...s.transactions];
            updatedTransactions.splice(txIndex, 1);
          }

          let newOutstanding = s.outstanding || 0;
          if (p.paymentMode === "Credit") newOutstanding -= p.total;

          try {
            await updateSupplierMutation.mutateAsync({ id: s._id || s.id || "", body: { ...s, balanceGold: (s.balanceGold || 0) - (isGold ? weightToDeduct : 0), balanceSilver: (s.balanceSilver || 0) - (!isGold ? weightToDeduct : 0), outstanding: newOutstanding, transactions: updatedTransactions } as any });
          } catch (e) {
            console.error("Failed to reverse supplier ledger:", e);
          }
        }
      }
      await deleteMutation.mutateAsync(id);
      toast.success("Purchase deleted successfully!");
    }
  };

  const filteredPurchases = useMemo(() => list.filter(p => isOperator ? (p as any).type === "GST" || p.gstPct > 0 : (p as any).type !== "GST" && (!p.gstPct || p.gstPct === 0)), [list, isOperator]);

  const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
  const monthTotal = filteredPurchases.filter(p => { const d = new Date(p.date); return `${d.getFullYear()}-${d.getMonth()}` === monthKey; }).reduce((s, p) => s + p.total, 0);

  const totalPages = Math.ceil(filteredPurchases.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const sortedList = [...filteredPurchases].sort((a, b) => (a.supplierName || "").localeCompare(b.supplierName || ""));
  const paginated = sortedList.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div><h1 className="text-4xl">Purchases</h1><p className="text-muted-foreground mt-1">Stock & metal purchased from suppliers.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg" className="w-full sm:w-auto" onClick={() => { setForm({...empty, type: isOperator ? "GST" : "NON-GST", gstPct: isOperator ? 3 : 0}); setSearchSup(""); }}><Plus className="w-4 h-4 mr-2"/>New Purchase</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>Record Purchase</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Search Supplier</Label>
                  <Input placeholder="Search name, mobile, or address..." value={searchSup} onChange={e => {
                    setSearchSup(e.target.value);
                    const match = suppliers.find(s => s.name.toLowerCase() === e.target.value.toLowerCase() || (s.mobile||"").includes(e.target.value) || (s.address || "").toLowerCase().includes(e.target.value.toLowerCase()));
                    if (match) setForm({...form, supplierId: match._id || match.id, supplierName: match.name});
                  }} />
                </div>
                <div>
                  <Label className="text-xs">Supplier *</Label>
                  <Select value={form.supplierId || ""} onValueChange={val => {
                    const s = suppliers.find(x => (x._id || x.id) === val);
                    if (s) setForm({...form, supplierId: val, supplierName: s.name});
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>
                    {suppliers.filter(s => s.name.toLowerCase().includes(debouncedSearchSup.toLowerCase()) || (s.mobile||"").includes(debouncedSearchSup) || (s.address || "").toLowerCase().includes(debouncedSearchSup.toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(s => (
                        <SelectItem key={s._id || s.id} value={s._id || s.id}>{s.name} · {s.mobile}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Bill Type</Label>
                <Select value={(form as any).type || "GST"} onValueChange={v => setForm({...form, type: v, gstPct: v === "NON-GST" ? 0 : 3} as any)}>
                  <SelectTrigger className="w-full h-10 border rounded-md px-3 bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GST">GST Included</SelectItem>
                    <SelectItem value="NON-GST">NON-GST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Metal</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background" value={form.metal} onChange={e => setForm({...form, metal: e.target.value as Purchase["metal"]})}>
                  <option>Gold</option><option>Silver</option><option>Diamond</option><option>Other</option>
                </select></div>
              <Field label="Purity" v={form.purity || ""} on={v => setForm({...form, purity: v})} />
              <Field label="Weight (g) *" type="number" v={String(form.weight)} on={v => setForm({...form, weight: +v})} />
              <Field label="Rate ₹/g" type="number" v={String(form.ratePerGram)} on={v => setForm({...form, ratePerGram: +v})} />
              <Field label="Making Charge ₹" type="number" v={String(form.makingCharge)} on={v => setForm({...form, makingCharge: +v})} />
              {((form as any).type || "GST") === "GST" && (
                <Field label="GST %" type="number" v={String(form.gstPct)} on={v => setForm({...form, gstPct: +v})} />
              )}
              <Field label="Bill Date" type="date" v={form.date} on={v => setForm({...form, date: v})} />
              <div><Label className="text-xs">Payment Mode</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background" value={form.paymentMode} onChange={e => setForm({...form, paymentMode: e.target.value as Purchase["paymentMode"]})}>
                  {["Cash","UPI","Card","Bank","Credit"].map(m => <option key={m}>{m}</option>)}
                </select></div>
              <div className="col-span-2"><Field label="Note" v={form.note || ""} on={v => setForm({...form, note: v})} /></div>
              <div className="col-span-2 text-right text-sm text-muted-foreground">Total: <span className="font-display text-lg text-foreground ml-2">{inr(calcTotal(form))}</span></div>
            </div>
            <Button onClick={save} className="mt-2" disabled={createMutation.isPending}>{createMutation.isPending ? "Saving..." : "Save"}</Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Purchases" value={filteredPurchases.length} />
        <Stat label="This Month" value={inr(monthTotal)} />
        <Stat label="Suppliers Used" value={new Set(filteredPurchases.map(p => p.supplierName)).size} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="w-5 h-5"/>Purchase Bills</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading purchases...</p> : filteredPurchases.length === 0 ? <p className="text-center text-muted-foreground py-12">No purchases yet.</p> :
          <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b bg-muted/20"><tr><th className="py-2 px-4">Bill</th><th>Type</th><th>Date</th><th>Supplier</th><th>Metal</th><th>Wt</th><th>Rate</th><th>Mode</th><th className="text-right">Total</th><th></th></tr></thead>
          <tbody>{paginated.map(p => (<tr key={(p as any)._id || p.id} className="border-b last:border-0">
              <td className="py-2 px-4 font-medium">{p.billNo}</td><td><span className="text-[10px] font-semibold uppercase tracking-wider border rounded-sm px-1.5 py-0.5 text-muted-foreground">{(p as any).type || "GST"}</span></td><td>{formatDate(p.date)}</td><td>{p.supplierName}</td>
              <td>{p.metal} {p.purity}</td><td>{p.weight}g</td><td>{inr(p.ratePerGram)}</td><td>{p.paymentMode}</td>
              <td className="text-right">{inr(p.total)}</td>
              <td className="text-right px-4"><Button size="sm" variant="ghost" onClick={() => remove((p as any)._id || p.id)}><Trash2 className="w-4 h-4"/></Button></td>
            </tr>))}</tbody></table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filteredPurchases.length)} of {filteredPurchases.length} entries</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
            </div>}
        </CardContent>
      </Card>
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  const [focused, setFocused] = useState(false);

  if (type === "date") {
    let displayValue = v;
    if (!focused && v) {
      const parts = v.split('-');
      if (parts.length === 3) {
        displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        <Input 
          type={focused ? "date" : "text"} 
          placeholder="DD/MM/YYYY"
          value={displayValue} 
          onChange={(e) => on(e.target.value)} 
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full h-9" 
        />
      </div>
    );
  }
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={e => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}
