import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr, type Scheme } from "@/lib/storage";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { schemesAPI, customerAPI } from "@/lib/api";
import { Plus, Trash2, PiggyBank } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

export default function SchemesPage() {
  const { data: list = [], isLoading } = useApi<Scheme[]>(["schemes"], () => schemesAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const createMutation = useApiMutation((data: Scheme) => schemesAPI.create(data), ["schemes"]);
  const updateMutation = useApiMutation((data: { id: string; body: Scheme }) => schemesAPI.update(data.id, data.body), ["schemes"]);
  const deleteMutation = useApiMutation((id: string) => schemesAPI.delete(id), ["schemes"]);

  const [open, setOpen] = useState(false);
  const [searchCust, setSearchCust] = useState("");
  const empty: Scheme = { id: "", schemeNo: "", date: new Date().toISOString().slice(0,10), customerName: "", customerMobile: "", planName: "11+1 Monthly", monthlyAmount: 0, tenureMonths: 11, paidMonths: 0, totalPaid: 0, maturityDate: "", status: "Active" };
  const [form, setForm] = useState<Scheme>(empty);

  const save = async () => {
    if (!form.customerName || !form.monthlyAmount) return;
    const schemeNo = form.schemeNo || `SCH-${(list.length + 1).toString().padStart(4, "0")}`;
    const totalPaid = form.monthlyAmount * form.paidMonths;
    try {
      await createMutation.mutateAsync({ ...form, schemeNo, totalPaid });
      setForm(empty); 
      setOpen(false);
    } catch (error) {
      console.error("[Schemes] Error saving to DB:", error);
    }
  };
  const payInstallment = async (id: string) => {
    const scheme = list.find(s => s.id === id || (s as any)._id === id);
    if (scheme) {
      await updateMutation.mutateAsync({ id, body: { ...scheme, paidMonths: scheme.paidMonths + 1, totalPaid: scheme.totalPaid + scheme.monthlyAmount, status: scheme.paidMonths + 1 >= scheme.tenureMonths ? "Matured" : scheme.status } });
    }
  };
  const remove = async (id: string) => { await deleteMutation.mutateAsync(id); };

  const active = list.filter(s => s.status === "Active").length;
  const collected = list.reduce((s, x) => s + x.totalPaid, 0);

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div><h1 className="text-4xl">Schemes</h1><p className="text-muted-foreground mt-1">Customer savings plans.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg" className="w-full sm:w-auto"><Plus className="w-4 h-4 mr-2"/>New Scheme</Button></DialogTrigger>
          <DialogContent className="max-h-[75vh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>Enroll Customer</DialogTitle></DialogHeader>
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
              <Field label="Plan Name" v={form.planName} on={v => setForm({...form, planName: v})} />
              <Field label="Monthly Amount ₹ *" type="number" v={String(form.monthlyAmount)} on={v => setForm({...form, monthlyAmount: +v})} />
              <Field label="Tenure (months)" type="number" v={String(form.tenureMonths)} on={v => setForm({...form, tenureMonths: +v})} />
              <Field label="Paid Months" type="number" v={String(form.paidMonths)} on={v => setForm({...form, paidMonths: +v})} />
              <Field label="Start Date" type="date" v={form.date} on={v => setForm({...form, date: v})} />
              <Field label="Maturity Date" type="date" v={form.maturityDate || ""} on={v => setForm({...form, maturityDate: v})} />
            </div>
            <Button onClick={save} className="mt-2">Enroll</Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total Schemes" value={list.length} />
        <Stat label="Active" value={active} />
        <Stat label="Total Collected" value={inr(collected)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><PiggyBank className="w-5 h-5"/>Members</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading schemes...</p> : list.length === 0 ? <p className="text-center text-muted-foreground py-12">No schemes yet.</p> :
          <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">No</th><th>Customer</th><th>Plan</th><th>Monthly</th><th>Progress</th><th>Paid</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map(s => (<tr key={(s as any)._id || s.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{s.schemeNo}</td><td>{s.customerName}<div className="text-xs text-muted-foreground">{s.customerMobile}</div></td>
              <td>{s.planName}</td><td>{inr(s.monthlyAmount)}</td>
              <td>{s.paidMonths}/{s.tenureMonths}</td><td>{inr(s.totalPaid)}</td>
              <td><span className="text-xs px-2 py-1 rounded-full bg-accent">{s.status}</span></td>
              <td className="text-right space-x-1">
                {s.status === "Active" && <Button size="sm" variant="outline" onClick={() => payInstallment((s as any)._id || s.id)}>+ Pay</Button>}
                <Button size="sm" variant="ghost" onClick={() => remove((s as any)._id || s.id)}><Trash2 className="w-4 h-4"/></Button>
              </td>
            </tr>))}</tbody></table>
            </div>}
        </CardContent>
      </Card>
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
