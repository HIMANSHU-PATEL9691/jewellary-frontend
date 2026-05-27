import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { inr, type JobWork, type Karigar } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { jobworkAPI, karigarsAPI } from "@/lib/api";
import { Plus, Trash2, ClipboardList } from "lucide-react";

export default function JobWorkPage() {
  const { data: list = [], isLoading } = useApi<JobWork[]>(["jobwork"], () => jobworkAPI.getAll());
  const { data: karigars = [] } = useApi<Karigar[]>(["karigars"], () => karigarsAPI.getAll());
  
  const createMutation = useApiMutation((data: JobWork) => jobworkAPI.create(data), ["jobwork"]);
  const updateMutation = useApiMutation((data: { id: string; body: JobWork }) => jobworkAPI.update(data.id, data.body), ["jobwork"]);
  const deleteMutation = useApiMutation((id: string) => jobworkAPI.delete(id), ["jobwork"]);

  const [open, setOpen] = useState(false);
  const empty: JobWork = { id: "", jobNo: "", date: new Date().toISOString().slice(0,10), karigarId: "", karigarName: "", itemDescription: "", metal: "Gold", purity: "22K", issuedWeight: 0, receivedWeight: 0, wastage: 0, makingCharge: 0, dueDate: "", status: "Issued", note: "" };
  const [form, setForm] = useState<JobWork>(empty);

  const save = async () => {
    if (!form.karigarName || !form.itemDescription) return;
    const jobNo = form.jobNo || `JW-${(list.length + 1).toString().padStart(4, "0")}`;
    try {
      await createMutation.mutateAsync({ ...form, jobNo });
      setForm(empty); 
      setOpen(false);
    } catch (error) {
      console.error("[JobWork] Error saving to DB:", error);
    }
  };
  const setStatus = async (id: string, status: JobWork["status"]) => {
    const job = list.find(r => r.id === id || (r as any)._id === id);
    if (job) {
      await updateMutation.mutateAsync({ id, body: { ...job, status } });
    }
  };
  const remove = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const pending = list.filter(r => r.status !== "Settled").length;
  const issuedG = list.filter(r => r.status !== "Settled").reduce((s, r) => s + r.issuedWeight, 0);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div><h1 className="text-4xl">Job Work</h1><p className="text-muted-foreground mt-1">Metal issued to karigars & received back.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="lg"><Plus className="w-4 h-4 mr-2"/>New Job</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>Issue Job Work</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Karigar *</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background" value={form.karigarId || ""} onChange={e => {
                  const k = karigars.find(x => x.id === e.target.value || (x as any)._id === e.target.value);
                  setForm({...form, karigarId: e.target.value, karigarName: k?.name || ""});
                }}>
                  <option value="">— Select —</option>
                  {karigars.map(k => <option key={(k as any)._id || k.id} value={(k as any)._id || k.id}>{k.name}</option>)}
                </select>
              </div>
              <Field label="Item Description *" v={form.itemDescription} on={v => setForm({...form, itemDescription: v})} />
              <div><Label className="text-xs">Metal</Label>
                <select className="w-full h-10 border rounded-md px-3 bg-background" value={form.metal} onChange={e => setForm({...form, metal: e.target.value as JobWork["metal"]})}>
                  <option>Gold</option><option>Silver</option>
                </select></div>
              <Field label="Purity" v={form.purity} on={v => setForm({...form, purity: v})} />
              <Field label="Issued Weight (g)" type="number" v={String(form.issuedWeight)} on={v => setForm({...form, issuedWeight: +v})} />
              <Field label="Received Weight (g)" type="number" v={String(form.receivedWeight)} on={v => setForm({...form, receivedWeight: +v})} />
              <Field label="Wastage (g)" type="number" v={String(form.wastage)} on={v => setForm({...form, wastage: +v})} />
              <Field label="Making Charge ₹" type="number" v={String(form.makingCharge)} on={v => setForm({...form, makingCharge: +v})} />
              <Field label="Date" type="date" v={form.date} on={v => setForm({...form, date: v})} />
              <Field label="Due Date" type="date" v={form.dueDate || ""} on={v => setForm({...form, dueDate: v})} />
              <div className="col-span-2"><Field label="Note" v={form.note || ""} on={v => setForm({...form, note: v})} /></div>
            </div>
            <Button onClick={save} className="mt-2">Issue</Button>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Total Jobs" value={list.length} />
        <Stat label="Pending" value={pending} />
        <Stat label="Issued (active)" value={`${issuedG.toFixed(2)} g`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="font-display flex items-center gap-2"><ClipboardList className="w-5 h-5"/>Jobs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading jobs...</p> : list.length === 0 ? <p className="text-center text-muted-foreground py-12">No jobs issued yet.</p> :
          <table className="w-full text-sm"><thead className="text-left text-muted-foreground border-b"><tr><th className="py-2">Job</th><th>Date</th><th>Karigar</th><th>Item</th><th>Issued</th><th>Received</th><th>Making</th><th>Status</th><th></th></tr></thead>
            <tbody>{list.map(r => (<tr key={(r as any)._id || r.id} className="border-b last:border-0">
              <td className="py-2 font-medium">{r.jobNo}</td><td>{formatDate(r.date)}</td><td>{r.karigarName}</td><td>{r.itemDescription}</td>
              <td>{r.issuedWeight}g</td><td>{r.receivedWeight}g</td><td>{inr(r.makingCharge)}</td>
              <td><select className="border rounded px-2 py-1 bg-background text-xs" value={r.status} onChange={e => setStatus((r as any)._id || r.id, e.target.value as JobWork["status"])}>
                {["Issued","In Progress","Received","Settled"].map(s => <option key={s}>{s}</option>)}
              </select></td>
              <td className="text-right"><Button size="sm" variant="ghost" onClick={() => remove((r as any)._id || r.id)}><Trash2 className="w-4 h-4"/></Button></td>
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
