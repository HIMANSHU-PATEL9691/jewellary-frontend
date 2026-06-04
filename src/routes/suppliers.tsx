import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalState } from "@/lib/storage";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { supplierAPI } from "@/lib/api";
import { Plus, Trash2, Pencil, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Supplier {
  _id?: string;
  name: string;
  mobile: string;
  companyNo: string;
  email?: string;
  category: string;
  gstNumber?: string;
  address: string;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function SuppliersPage() {
  const { data: list = [], isLoading, error } = useApi<Supplier[]>(["suppliers"], () => supplierAPI.getAll());
  const createMutation = useApiMutation((data: Supplier) => supplierAPI.create(data), ["suppliers"]);
  const updateMutation = useApiMutation((data: { id: string; body: Supplier }) => supplierAPI.update(data.id, data.body), ["suppliers"]);
  const deleteMutation = useApiMutation((id: string) => supplierAPI.delete(id), ["suppliers"]);

  const [open, setOpen] = useState(false);
  const empty: Supplier = { name: "", mobile: "", companyNo: "", email: "", category: "", gstNumber: "", address: "", note: "" };
  const [form, setForm] = useState<Supplier>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useLocalState<string[]>("ajms.supplierCategories", ["Wholesale", "Manufacturer", "Distributor"]);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const save = async () => {
    if (!form.name || !form.mobile || !form.companyNo || !form.category || !form.address || !form.note) {
      toast.error("Name, mobile, company no, category, address, and note are required");
      return;
    }
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: form });
        toast.success("Supplier updated successfully");
      } else {
        await createMutation.mutateAsync(form);
        toast.success("Supplier created successfully");
      }
      setForm(empty);
      setEditingId(null);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save supplier");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Supplier deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete supplier");
    }
  };

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (!categories.includes(c)) setCategories((p) => [...p, c]);
    setForm((d) => ({ ...d, category: c }));
    setNewCat("");
    setAddCatOpen(false);
  };

  const filtered = list.filter(s => 
    s.name.toLowerCase().includes(q.toLowerCase()) || 
    s.mobile.includes(q) || 
    s.companyNo.toLowerCase().includes(q.toLowerCase())
  );

  const isLoading_UI = isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Suppliers</h1>
          <p className="text-muted-foreground mt-1">{list.length} on file.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={() => { setForm(empty); setEditingId(null); }} disabled={isLoading_UI}>
              <Plus className="w-4 h-4 mr-2"/> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">{editingId ? "Edit" : "New"} supplier</DialogTitle>
              <DialogDescription>Add or update supplier information</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Supplier Name *" v={form.name} on={v => setForm({...form, name: v})} />
              <Field label="Mobile No *" v={form.mobile} on={v => setForm({...form, mobile: v})} />
              <Field label="Company No *" v={form.companyNo} on={v => setForm({...form, companyNo: v})} />
              <Field label="Email (optional)" v={form.email || ""} on={v => setForm({...form, email: v})} />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Category *</Label>
                <div className="flex gap-2 items-center">
                  <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="outline" className="shrink-0" title="Add Category">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[60vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Category</DialogTitle>
                        <DialogDescription>Add a new category label for your suppliers.</DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name" autoFocus />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddCatOpen(false)}>Cancel</Button>
                        <Button onClick={addCategory}>Add</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <Field label="GST No (optional)" v={form.gstNumber || ""} on={v => setForm({...form, gstNumber: v})} />
              <div className="col-span-2 space-y-3 mt-1">
                <Field label="Address *" v={form.address} on={v => setForm({...form, address: v})} />
                <Field label="Note *" v={form.note} on={v => setForm({...form, note: v})} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI}>Cancel</Button>
              <Button onClick={save} disabled={isLoading_UI || !form.name || !form.mobile || !form.companyNo || !form.category || !form.address || !form.note}>
                {isLoading_UI ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, mobile or company no" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <p className="text-center text-muted-foreground py-12">Loading suppliers...</p> : error ? <p className="text-center text-red-500 py-12">Failed to load suppliers</p> : filtered.length === 0 ? <p className="text-center text-muted-foreground py-12">No suppliers yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="p-3">Name</th><th>Mobile</th><th>Company No</th><th>Category</th><th>Address</th><th>GST No</th><th></th></tr>
            </thead>
        <tbody>{paginated.map(s => (
              <tr key={s._id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="p-3 font-medium">{s.name}</td>
                <td>{s.mobile}</td>
                <td>{s.companyNo}</td>
                <td><span className="inline-flex items-center rounded-full border border-sidebar-border bg-sidebar px-2.5 py-0.5 text-xs font-semibold">{s.category}</span></td>
                <td className="text-muted-foreground max-w-50 truncate" title={s.address}>{s.address || "—"}</td>
                <td className="text-muted-foreground">{s.gstNumber || "—"}</td>
                <td>
                  <div className="flex gap-1 justify-end pr-3">
                    <Button size="icon" variant="ghost" onClick={() => { setForm(s); setEditingId(s._id || null); setOpen(true); }} disabled={isLoading_UI}><Pencil className="w-4 h-4"/></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(s._id || "")} disabled={isLoading_UI}><Trash2 className="w-4 h-4"/></Button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-xs text-muted-foreground">Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filtered.length)} of {filtered.length} entries</div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
              </div>
            </div>
          )}
          </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}

function Field({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return <div className="space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">{label}</Label><Input value={v} onChange={e => on(e.target.value)} /></div>;
}
