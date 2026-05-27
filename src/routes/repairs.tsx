import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocalState, inr, type Repair, type Karigar } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { repairsAPI } from "@/lib/api";
import { Plus, Trash2, Wrench } from "lucide-react";

export default function RepairsPage() {
  const [karigars] = useLocalState<Karigar[]>("ajms.karigars", []);
  const [open, setOpen] = useState(false);
  const empty: Repair = { ticketNo: "", date: new Date().toISOString().slice(0,10), customerName: "", customerMobile: "", itemDescription: "", itemWeight: 0, problem: "", estimate: 0, advance: 0, deliveryDate: "", karigarId: "", status: "Received", note: "" };
  const [form, setForm] = useState<Repair>(empty);

  const { data = [], isLoading, error } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());
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
    const payload = { ...form, ticketNo, status: form.status || "Received" };

    console.log("[Repairs] Attempting to save to DB:", payload);
    try {
      await createMutation.mutateAsync(payload);
      console.log("[Repairs] Successfully saved to DB!");
      setForm(empty);
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
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" />New Repair
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>New Repair Ticket</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer Name *" v={form.customerName} on={(v) => setForm({ ...form, customerName: v })} />
              <Field label="Mobile" v={form.customerMobile} on={(v) => setForm({ ...form, customerMobile: v })} />
              <div className="col-span-2">
                <Field label="Item Description" v={form.itemDescription} on={(v) => setForm({ ...form, itemDescription: v })} />
              </div>
              <Field label="Item Weight (g)" type="number" v={String(form.itemWeight)} on={(v) => setForm({ ...form, itemWeight: +v })} />
              <Field label="Problem" v={form.problem} on={(v) => setForm({ ...form, problem: v })} />
              <Field label="Estimate ₹" type="number" v={String(form.estimate)} on={(v) => setForm({ ...form, estimate: +v })} />
              <Field label="Advance ₹" type="number" v={String(form.advance)} on={(v) => setForm({ ...form, advance: +v })} />
              <Field label="Date" type="date" v={form.date} on={(v) => setForm({ ...form, date: v })} />
              <Field label="Delivery Date" type="date" v={form.deliveryDate || ""} on={(v) => setForm({ ...form, deliveryDate: v })} />
              <div>
                <Label className="text-xs">Karigar</Label>
                <select
                  className="w-full h-10 border rounded-md px-3 bg-background"
                  value={form.karigarId || ""}
                  onChange={(e) => setForm({ ...form, karigarId: e.target.value })}
                >
                  <option value="">— Unassigned —</option>
                  {karigars.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <Field label="Note" v={form.note || ""} on={(v) => setForm({ ...form, note: v })} />
              </div>
            </div>
            <Button onClick={save} className="mt-2">
              Create Ticket
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
                    <td>{inr(r.estimate)}</td>
                    <td>
                      <select
                        className="border rounded px-2 py-1 bg-background text-xs"
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
    </Layout>
  );
}

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return <div><Label className="text-xs">{label}</Label><Input type={type} value={v} onChange={(e) => on(e.target.value)} /></div>;
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-display mt-1">{value}</div></CardContent></Card>;
}
