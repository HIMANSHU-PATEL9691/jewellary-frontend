import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { useLocalState, uid, inr, type Product } from "@/lib/storage";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { inventoryAPI } from "@/lib/api";

const empty: Product = {
  id: "",
  name: "",
  category: "Gold",
  subcategory: "",
  note: "",
  huid: "",
  purity: "22K",
  grossWeight: 0,
  netWeight: 0,
  stoneWeight: 0,
  wastagePct: 8,
  makingCharge: 500,
  gstPct: 3,
  ratePerGram: 7200,
  stock: 1,
  barcode: "",
};

export default function InventoryPage() {
  const { data: products = [], isLoading } = useApi<Product[]>(["inventory"], () => inventoryAPI.getAll());
  const createMutation = useApiMutation((data: Product) => inventoryAPI.create(data), ["inventory"]);
  const updateMutation = useApiMutation((data: { id: string; body: Product }) => inventoryAPI.update(data.id, data.body), ["inventory"]);
  const deleteMutation = useApiMutation((id: string) => inventoryAPI.delete(id), ["inventory"]);

  const [categories, setCategories] = useLocalState<string[]>("ajms.categories", ["Gold", "Silver", "Diamond", "Platinum", "Coin"]);
  const [subcategories, setSubcategories] = useLocalState<Record<string, string[]>>("ajms.subcategories", {});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Product>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [newSub, setNewSub] = useState("");
  const [q, setQ] = useState("");

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.barcode.toLowerCase().includes(q.toLowerCase()) ||
      (p.huid || "").toLowerCase().includes(q.toLowerCase())
  );

  const startNew = () => {
    setEditingId(null);
    setDraft({ ...empty, id: uid(), barcode: "AJ-" + uid().toUpperCase() });
    setOpen(true);
  };
  const startEdit = (p: Product) => {
    setEditingId((p as any)._id || p.id);
    setDraft(p);
    setOpen(true);
  };
  const save = async () => {
    if (!draft.name) return;
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, body: draft });
      } else {
        await createMutation.mutateAsync(draft);
      }
      setOpen(false);
    } catch (error) {
      console.error("[Inventory] Error saving to DB:", error);
    }
  };
  const remove = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const set = <K extends keyof Product>(k: K, v: Product[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (!categories.includes(c)) setCategories((p) => [...p, c]);
    setDraft((d) => ({ ...d, category: c }));
    setNewCat("");
    setAddCatOpen(false);
  };

  const addSubcategory = () => {
    const s = newSub.trim();
    if (!s || !draft.category) return;
    setSubcategories((prev) => {
      const map = { ...(prev || {}) } as Record<string, string[]>;
      map[draft.category] = Array.from(new Set([...(map[draft.category] || []), s]));
      return map;
    });
    setDraft((d) => ({ ...d, subcategory: s }));
    setNewSub("");
    setAddSubOpen(false);
  };

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Inventory</h1>
          <p className="text-muted-foreground mt-1">
            {products.length} item{products.length === 1 ? "" : "s"} in stock.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={startNew}>
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {editingId ? "Edit" : "New"} product
              </DialogTitle>
              <DialogDescription>
                Fill in product details, category, pricing and stock information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Product Name">
                <Input value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Category">
                <div className="flex gap-2 items-center">
                  <Select value={draft.category} onValueChange={(v) => set("category", v as Product["category"]) }>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
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
                        <DialogDescription>Add a new product category for organizing your inventory.</DialogDescription>
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
              </Field>
              <Field label="Subcategory">
                <div className="flex gap-2 items-center">
                  <Select value={draft.subcategory || ""} onValueChange={(v) => set("subcategory", v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                    <SelectContent>
                      {(subcategories[draft.category || ""] || []).map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={addSubOpen} onOpenChange={setAddSubOpen}>
                    <DialogTrigger asChild>
                      <Button size="icon" variant="outline" className="shrink-0" disabled={!draft.category} title="Add Subcategory">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[60vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add Subcategory</DialogTitle>
                        <DialogDescription>
                          Add a new subcategory under <strong>{draft.category || "the selected category"}</strong>.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Subcategory name" autoFocus />
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAddSubOpen(false)}>Cancel</Button>
                        <Button onClick={addSubcategory}>Add</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </Field>
              <Field label="Note">
                <Textarea value={draft.note || ""} onChange={(e) => set("note", e.target.value)} />
              </Field>
              <Field label="HUID"><Input value={draft.huid} onChange={(e) => set("huid", e.target.value)} /></Field>
              <Field label="Purity"><Input value={draft.purity} onChange={(e) => set("purity", e.target.value)} /></Field>
              <Field label="Gross Weight (g)"><NumIn v={draft.grossWeight} on={(v) => set("grossWeight", v)} /></Field>
              <Field label="Net Weight (g)"><NumIn v={draft.netWeight} on={(v) => set("netWeight", v)} /></Field>
              <Field label="Stone Weight (g)"><NumIn v={draft.stoneWeight} on={(v) => set("stoneWeight", v)} /></Field>
              <Field label="Wastage %"><NumIn v={draft.wastagePct} on={(v) => set("wastagePct", v)} /></Field>
              <Field label="Making Charge (₹)"><NumIn v={draft.makingCharge} on={(v) => set("makingCharge", v)} /></Field>
              <Field label="GST %"><NumIn v={draft.gstPct} on={(v) => set("gstPct", v)} /></Field>
              <Field label="Rate / gram (₹)"><NumIn v={draft.ratePerGram} on={(v) => set("ratePerGram", v)} /></Field>
              <Field label="Stock Qty"><NumIn v={draft.stock} on={(v) => set("stock", v)} /></Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, HUID or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading inventory...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No products yet. Click "Add Product" to start.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="p-3">Name</th>
                  <th>Category</th>
                  <th>Subcat</th>
                  <th>Purity</th>
                  <th>Net Wt</th>
                  <th>Rate/g</th>
                  <th>Stock</th>
                  <th>Value</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={(p as any)._id || p.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.barcode}</div>
                    </td>
                    <td><Badge variant="secondary">{p.category}</Badge></td>
                    <td>{p.subcategory || "—"}</td>
                    <td>{p.purity}</td>
                    <td>{p.netWeight} g</td>
                    <td>{inr(p.ratePerGram)}</td>
                    <td>{p.stock}</td>
                    <td>{inr(p.netWeight * p.ratePerGram * p.stock)}</td>
                    <td>
                      <div className="flex gap-1 justify-end pr-3">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => remove((p as any)._id || p.id)}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function NumIn({ v, on }: { v: number; on: (n: number) => void }) {
  return (
    <Input type="number" value={v} onChange={(e) => on(parseFloat(e.target.value) || 0)} />
  );
}
