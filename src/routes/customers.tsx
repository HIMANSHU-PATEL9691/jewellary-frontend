import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Plus, Trash2, Pencil, Search, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { customerAPI } from "@/lib/api";
import { toast } from "sonner";

interface Customer {
  _id?: string;
  name: string;
  phone: string;
  phone2?: string;
  address: string;
  gstNumber?: string;
  pan?: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

const empty: Customer = {
  name: "",
  phone: "",
  phone2: "",
  address: "",
  gstNumber: "",
  pan: "",
  notes: "",
};

export default function CustomersPage() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Customer>(empty);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch customers
  const { data: customers = [], isLoading, error } = useApi(
    ["customers"],
    () => customerAPI.getAll()
  );

  // Create mutation
  const createMutation = useApiMutation(
    (data: Customer) => customerAPI.create(data),
    ["customers"]
  );

  // Update mutation
  const updateMutation = useApiMutation(
    (data: { id: string; body: Customer }) => customerAPI.update(data.id, data.body),
    ["customers"]
  );

  // Delete mutation
  const deleteMutation = useApiMutation(
    (id: string) => customerAPI.delete(id),
    ["customers"]
  );

  const filtered = customers.filter(
    (c: Customer) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.phone.includes(q) ||
      (c.phone2 && c.phone2.includes(q))
  );

  const startNew = () => {
    setEditingId(null);
    setDraft({ ...empty });
    setOpen(true);
  };

  const startEdit = (c: Customer) => {
    setEditingId(c._id || null);
    setDraft(c);
    setOpen(true);
  };

  const save = async () => {
    console.log("[Frontend Component] Attempting to save customer draft:", draft);
    if (!draft.name || !draft.phone || !draft.address || !draft.notes) {
      toast.error("Name, phone, address, and notes are required");
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          body: draft,
        });
        toast.success("Customer updated successfully");
      } else {
        await createMutation.mutateAsync(draft);
        toast.success("Customer created successfully");
      }
      setOpen(false);
      setDraft(empty);
      setEditingId(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to save customer");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Customer deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete customer");
    }
  };

  const set = <K extends keyof Customer>(k: K, v: Customer[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const isLoading_UI = isLoading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Customers</h1>
          <p className="text-muted-foreground mt-1">{customers.length} on file.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={startNew} disabled={isLoading_UI}>
              <Plus className="w-4 h-4 mr-2" /> Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {editingId ? "Edit" : "New"} customer
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <F label="Customer Name *">
                <Input
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Customer name"
                />
              </F>
              <F label="Mobile No *">
                <Input
                  value={draft.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="Primary mobile number"
                />
              </F>
              <F label="Mobile No 2 (optional)">
                <Input
                  value={draft.phone2 || ""}
                  onChange={(e) => set("phone2", e.target.value)}
                  placeholder="Secondary mobile number"
                />
              </F>
              <F label="Address *">
                <Input
                  value={draft.address || ""}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Full address"
                />
              </F>
              <F label="GST No (optional)">
                <Input
                  value={draft.gstNumber || ""}
                  onChange={(e) => set("gstNumber", e.target.value)}
                  placeholder="GSTIN"
                />
              </F>
              <F label="PAN No (optional)">
                <Input
                  value={draft.pan || ""}
                  onChange={(e) => set("pan", e.target.value)}
                  placeholder="PAN number"
                />
              </F>
              <F label="Notes *">
                <Input
                  value={draft.notes || ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Additional notes"
                />
              </F>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading_UI}>
                Cancel
              </Button>
              <Button onClick={save} disabled={isLoading_UI || !draft.name || !draft.phone || !draft.address || !draft.notes}>
                {isLoading_UI ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading customers...</p>
          ) : error ? (
            <p className="text-sm text-red-500 py-12 text-center">Failed to load customers</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No customers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>GST No</th>
                  <th>PAN No</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: Customer) => (
                  <tr key={c._id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td>
                      <div>{c.phone}</div>
                      {c.phone2 && <div className="text-xs text-muted-foreground">{c.phone2}</div>}
                    </td>
                    <td className="text-muted-foreground">{c.address || "—"}</td>
                    <td className="text-muted-foreground">{c.gstNumber || "—"}</td>
                    <td className="text-muted-foreground">{c.pan || "—"}</td>
                    <td className="text-muted-foreground">
                      {c.createdAt ? formatDate(c.createdAt) : "—"}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end pr-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEdit(c)}
                          disabled={isLoading_UI}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(c._id || "")}
                          disabled={isLoading_UI}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
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


function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
