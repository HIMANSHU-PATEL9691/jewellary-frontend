import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inr, type Girvi, type GirviItem, useLocalState } from "@/lib/storage";
import { useApi, useApiMutation } from "@/hooks/useApi";
import { girviAPI, customerAPI } from "@/lib/api";
import { useMemo, useState } from "react";
import { Plus, Trash2, Printer, Pencil, Search, Image as ImageIcon, Wallet, Scale, Landmark, TrendingUp } from "lucide-react";
import { calculateCompoundInterest, formatDate, formatCompactIfLarge } from "@/lib/utils";
import { toast } from "sonner";
import { PaymentQr } from "@/components/PaymentQr";
import { InvoiceTerms, ShopHeader } from "@/components/InvoiceBranding";

function getElapsedMonthsAndDays(dateStr: string) {
  if (!dateStr) return { months: 0, days: 0 };
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (now.getTime() <= start.getTime()) return { months: 0, days: 0 };

  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }

  return { months, days };
}

function getElapsedDays(dateStr: string) {
  if (!dateStr) return 0;
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (now.getTime() <= start.getTime()) return 0;
  return Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function getElapsedTimeString(dateStr: string) {
  const { months, days } = getElapsedMonthsAndDays(dateStr);
  
  if (months > 0 && days > 0) return `${months} mo, ${days} days`;
  if (months > 0) return `${months} mo`;
  return `${days} days`;
}

function calculateInterest(girvi: any) {
  const isDaily = girvi.interestPeriod === "Daily" || girvi.note?.includes("[IntPeriod:Daily]");
  const P = girvi.loanAmount;
  const monthlyRatePct = girvi.interestPct;

  if (!girvi.date || !P || !monthlyRatePct) return 0;

  if (isDaily) {
    const elapsedDays = getElapsedDays(girvi.date);
    const dailyRate = monthlyRatePct / 100;
    return Math.round(Math.pow(1 + dailyRate, elapsedDays) * P - P);
  }

  const { months, days } = getElapsedMonthsAndDays(girvi.date);
  const totalMonths = months + days / 30;
  return Math.round(calculateCompoundInterest(P, monthlyRatePct, totalMonths).interest);
}

function isGirviForwardedSettled(girvi: any) {
  return girvi.isForwardedSettled || (girvi.note && /\[Forwarding to .*? cleared on .*? - Paid .*?\]/.test(girvi.note));
}

function calculateForwardedInterest(girvi: any) {
  if (isGirviForwardedSettled(girvi)) {
    if (girvi.forwardedSettledInterest !== undefined) return girvi.forwardedSettledInterest;
    const match = girvi.note?.match(/cleared on .*? - Paid (.*?)\]/);
    if (match && match[1]) {
      const parsedTotal = parseFloat(match[1].replace(/[^\d.-]/g, ''));
      if (!isNaN(parsedTotal)) return Math.max(0, parsedTotal - (girvi.forwardedAmount || 0));
    }
    return 0;
  }
  if (!girvi.forwardedAmount || !girvi.forwardedInterestPct) return 0;

  const isDaily = girvi.forwardedInterestPeriod === "Daily" || girvi.note?.includes("[FwdIntPeriod:Daily]");
  const P = girvi.forwardedAmount;
  const monthlyRatePct = girvi.forwardedInterestPct;
  const startDate = girvi.forwardedDate || girvi.date;

  if (!startDate) return 0;

  if (isDaily) {
    const elapsedDays = getElapsedDays(startDate);
    const dailyRate = monthlyRatePct / 100;
    return Math.round(Math.pow(1 + dailyRate, elapsedDays) * P - P);
  }

  const { months, days } = getElapsedMonthsAndDays(startDate);
  const totalMonths = months + days / 30;
  return Math.round(calculateCompoundInterest(P, monthlyRatePct, totalMonths).interest);
}

export default function GirviPage() {
  const [authUser] = useLocalState<any>("ajms.auth", null);
  const { data: girvis = [], isLoading } = useApi<Girvi[]>(["girvis"], () => girviAPI.getAll());
  const { data: customers = [] } = useApi<any[]>(["customers"], () => customerAPI.getAll());
  const [forwardedShops] = useLocalState<any[]>("ajms.forwardedShops", []);
  const createMutation = useApiMutation((data: Girvi) => girviAPI.create(data), ["girvis"]);
  const updateMutation = useApiMutation((data: { id: string; body: Girvi }) => girviAPI.update(data.id, data.body), ["girvis"]);
  const deleteMutation = useApiMutation((id: string) => girviAPI.delete(id), ["girvis"]);
  const createCustomerMutation = useApiMutation((data: any) => customerAPI.create(data), ["customers"]);

  const [filter, setFilter] = useState<"All" | Girvi["status"]>("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<Girvi | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchCust, setSearchCust] = useState("");
  const [newCust, setNewCust] = useState({ name: "", phone: "", phone2: "", address: "" });
  const [form, setForm] = useState<Omit<Girvi, "id"> & { interestType?: "Simple" | "Compound", forwardedInterestType?: "Simple" | "Compound" }>({
    date: new Date().toISOString().slice(0, 10),
    loanNo: `GL-${Date.now().toString().slice(-6)}`,
    customerName: "",
    customerMobile: "",
    customerMobile2: "",
    customerAddress: "",
    items: [{
      itemType: "Gold",
      itemCategory: "",
      itemDescription: "",
      grossWeight: 0,
      netWeight: 0,
      purity: "22K",
    }],
    loanAmount: 0,
    interestPct: 1.5,
    interestPeriod: "Monthly",
    interestType: "Simple",
    documentType: "Invoice",
    documentNumber: "",
    imageUrl: "",
    dueDate: "",
    status: "Active",
    note: "",
    forwardedTo: "",
    forwardedShopName: "",
    forwardedShopGstNo: "",
    forwardedShopAddress: "",
    forwardedDate: "",
    forwardedAmount: 0,
    forwardedInterestPct: 0,
    forwardedInterestPeriod: "Monthly",
    forwardedInterestType: "Simple",
    forwardedImageUrl: "",
    customerSignature: "",
    authorizedSignatory: "",
  });
  const categories = ["Gold Jewellery", "Silver Jewellery", "Pendants", "Rings"];
  const [imagePreview, setImagePreview] = useState("");
  const [dateFocused, setDateFocused] = useState(false);
  const [forwardedImagePreview, setForwardedImagePreview] = useState("");
  const [page, setPage] = useState(1);

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        {
          itemType: "Gold",
          itemCategory: "",
          itemDescription: "",
          grossWeight: 0,
          netWeight: 0,
          purity: "22K",
        },
      ],
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== index),
    }));
  }

  function updateItem(index: number, updates: Partial<GirviItem>) {
    setForm((prev) => ({
      ...prev,
      items: (prev.items || []).map((item, i) => (i === index ? { ...item, ...updates } : item)),
    }));
  }

  function getTotalWeights() {
    const items = form.items || [];
    return {
      totalGross: items.reduce((sum, item) => sum + (item.grossWeight || 0), 0),
      totalNet: items.reduce((sum, item) => sum + (item.netWeight || 0), 0),
    };
  }

  const totals = useMemo(() => {
    const active = girvis.filter((g) => g.status === "Active");
    const forwarded = active.filter(g => (g.forwardedAmount || 0) > 0 && !isGirviForwardedSettled(g));
    return {
      activeCount: active.length,
      principal: active.reduce((s, g) => s + g.loanAmount, 0),
      pledgedWeight: active.reduce((s, g) => {
        if (g.items && g.items.length > 0) {
          return s + g.items.reduce((sum, item) => sum + (item.netWeight || 0), 0);
        }
        return s + (g.netWeight || 0);
      }, 0),
      collateralValue: active.reduce((s, g) => {
        if (g.items && g.items.length > 0) {
          return s + g.items.reduce((sum, item) => sum + (item.marketValue || 0), 0);
        }
        return s + (g.marketValue || 0);
      }, 0),
      forwardedPrincipal: forwarded.reduce((s, g) => s + (g.forwardedAmount || 0), 0),
      forwardedInterest: forwarded.reduce((s, g) => s + calculateForwardedInterest(g), 0),
    };
  }, [girvis]);

  const filtered = useMemo(() => {
    let list = filter === "All" ? girvis : girvis.filter((g) => g.status === filter);
    if (q.trim()) {
      const lowerQ = q.toLowerCase().trim();
      list = list.filter((g) => 
        g.customerName.toLowerCase().includes(lowerQ) || 
        g.loanNo.toLowerCase().includes(lowerQ) || 
        g.customerMobile.includes(lowerQ) ||
        (g.customerAddress || "").toLowerCase().includes(lowerQ)
      );
    }
    return [...list].sort((a, b) => (a.customerName || "").localeCompare(b.customerName || ""));
  }, [girvis, filter, q]);

  const totalPages = Math.ceil(filtered.length / 10) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * 10, currentPage * 10);

  async function add(createInvoice = false) {
    if (!form.loanAmount) {
      toast.error("Loan amount is required.");
      return;
    }
    if (form.customerMobile !== "NEW" && !form.customerName) {
      toast.error("Customer selection is required.");
      return;
    }
    if (!form.items || form.items.length === 0) {
      toast.error("At least one item is required.");
      return;
    }
    for (const item of form.items) {
      if (!item.itemDescription) {
        toast.error("Item description is required for all items.");
        return;
      }
    }

    let custName = form.customerName;
    let custMobile = form.customerMobile;
    let custMobile2 = form.customerMobile2;
    let custAddress = form.customerAddress;

    if (form.customerMobile === "NEW") {
      if (!newCust.name) {
        toast.error("Customer name is required for a new customer.");
        return;
      }
      if (!newCust.address) {
        toast.error("Customer address is required for a new customer.");
        return;
      }
      try {
        const created = await createCustomerMutation.mutateAsync(newCust);
        custName = created.name;
        custMobile = created.phone || created.mobile || "";
        custAddress = created.address || "";
      } catch (e) {
        toast.error("Failed to create new customer");
        return;
      }
    }

    const dueDate = form.dueDate || undefined;
    const payload: any = { ...form, customerName: custName, customerMobile: custMobile, customerMobile2: custMobile2, customerAddress: custAddress, dueDate };
    if (createInvoice) {
      payload.documentType = payload.documentType || "Bill";
      payload.documentNumber = payload.documentNumber || `GRV-${Date.now().toString().slice(-6)}`;
    }

    let safeNote = form.note || "";
    // Clean old period and type flags
    safeNote = safeNote.replace(/\[IntPeriod:.*?\]/g, "").trim();
    safeNote = safeNote.replace(/\[FwdIntPeriod:.*?\]/g, "").trim();
    safeNote = safeNote.replace(/\[IntType:.*?\]/g, "").trim();
    safeNote = safeNote.replace(/\[FwdIntType:.*?\]/g, "").trim();
    payload.note = safeNote.trim();

    try {
      let saved;
      if (editingId) {
        saved = await updateMutation.mutateAsync({ id: editingId, body: payload });
        toast.success("Girvi loan updated successfully!");
      } else {
        saved = await createMutation.mutateAsync(payload);
        toast.success("Girvi loan saved successfully!");
      }
      setForm({
        ...form,
        loanNo: `GL-${Date.now().toString().slice(-6)}`,
        customerName: "",
        customerMobile: "",
        customerMobile2: "",
        customerAddress: "",
        items: [
          {
            itemType: "Gold",
            itemCategory: "",
            itemDescription: "",
            grossWeight: 0,
            netWeight: 0,
            purity: "22K",
          },
        ],
        loanAmount: 0,
        interestPct: 1.5,
        interestPeriod: "Monthly",
        interestType: "Simple",
        documentType: "Invoice",
        documentNumber: "",
        imageUrl: "",
        note: "",
        forwardedTo: "",
        forwardedShopName: "",
        forwardedShopGstNo: "",
        forwardedShopAddress: "",
        forwardedDate: "",
        forwardedAmount: 0,
        forwardedInterestPct: 0,
        forwardedInterestPeriod: "Monthly",
        forwardedInterestType: "Simple",
        forwardedImageUrl: "",
        customerSignature: "",
        authorizedSignatory: "",
      });
      setNewCust({ name: "", phone: "", phone2: "", address: "" });
      setImagePreview("");
      setForwardedImagePreview("");
      setEditingId(null);
      if (createInvoice) {
        setOpen(false);
        setViewing(saved);
      }
    } catch (error) {
      console.error("[Girvi] Error saving to DB:", error);
      toast.error("Failed to connect to backend server. Is it running?");
    }
  }
  
  function handleImageChange(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 400; // Drastically reduce size for shorter Base64
        let { width, height } = img;
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/webp", 0.5);
        setForm((prev) => ({ ...prev, imageUrl: compressedBase64 }));
        setImagePreview(compressedBase64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
  function handleForwardedImageChange(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 400; // Drastically reduce size for shorter Base64
        let { width, height } = img;
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/webp", 0.5);
        setForm((prev) => ({ ...prev, forwardedImageUrl: compressedBase64 }));
        setForwardedImagePreview(compressedBase64);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  async function setStatus(id: string, status: Girvi["status"]) {
    const g = girvis.find((x) => x.id === id || (x as any)._id === id);

    if ((status === "Closed" || status === "Auctioned") && g) {
      if (Number(g.forwardedAmount) > 0 && !isGirviForwardedSettled(g)) {
        window.alert("Take item from Forwarded Shops first before closing or auctioning this loan.");
        return;
      }
    }

    if (status === "Closed" && g) {
      const interest = calculateInterest(g);
      const total = g.loanAmount + interest;
      const confirmed = window.confirm(`Are you sure you want to close this loan?\n\nPrincipal: ${inr(g.loanAmount)}\nAccrued Interest: ${inr(interest)}\nTotal to Collect: ${inr(total)}\n\nIs the full amount cleared?`);
      if (!confirmed) return;
    }
    if (g) await updateMutation.mutateAsync({ id, body: { ...g, status } });
  }
  async function remove(id: string) {
    if (!window.confirm("Are you sure you want to delete this girvi record?")) return;
    await deleteMutation.mutateAsync(id);
  }

  const startNew = () => {
    setEditingId(null);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      loanNo: `GL-${Date.now().toString().slice(-6)}`,
      customerName: "",
      customerMobile: "",
      customerMobile2: "",
      customerAddress: "",
      items: [
        {
          itemType: "Gold",
          itemCategory: "",
          itemDescription: "",
          grossWeight: 0,
          netWeight: 0,
          purity: "22K",
        },
      ],
      loanAmount: 0,
      interestPct: 1.5,
      interestPeriod: "Monthly",
      interestType: "Simple",
      documentType: "Invoice",
      documentNumber: "",
      imageUrl: "",
      dueDate: "",
      status: "Active",
      note: "",
      forwardedTo: "",
      forwardedShopName: "",
      forwardedShopGstNo: "",
      forwardedShopAddress: "",
      forwardedDate: "",
      forwardedAmount: 0,
      forwardedInterestPct: 0,
      forwardedInterestPeriod: "Monthly",
      forwardedInterestType: "Simple",
      forwardedImageUrl: "",
      customerSignature: "",
      authorizedSignatory: "",
    });
    setNewCust({ name: "", phone: "", phone2: "", address: "" });
    setImagePreview("");
    setForwardedImagePreview("");
    setSearchCust("");
    setDateFocused(false);
  };

  const startEdit = (g: Girvi) => {
    setEditingId((g as any)._id || g.id);
    
    setForm({
      ...g,
      items: g.items && g.items.length > 0 ? g.items : [
        {
          itemType: (g.itemType || "Gold") as any,
          itemCategory: g.itemCategory,
          itemDescription: g.itemDescription || "",
          grossWeight: g.grossWeight || 0,
          netWeight: g.netWeight || 0,
          purity: g.purity || "22K",
        },
      ],
      interestPeriod: "Monthly" as any,
      forwardedInterestPeriod: "Monthly" as any,
      interestType: "Simple" as any,
      forwardedInterestType: "Simple" as any,
      note: g.note ? g.note.replace(/\[(IntPeriod|FwdIntPeriod|IntType|FwdIntType):.*?\]/g, '').trim() : "",
      date: g.date ? new Date(g.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      forwardedDate: g.forwardedDate ? new Date(g.forwardedDate).toISOString().slice(0, 10) : "",
      dueDate: g.dueDate ? new Date(g.dueDate).toISOString().slice(0, 10) : "",
    });
    setImagePreview(g.imageUrl || "");
    setForwardedImagePreview(g.forwardedImageUrl || "");
    setDateFocused(false);
    setOpen(true);
  };

  return (
    <Layout>
      <header className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl">Girvi — Gold &amp; Silver Loans</h1>
          <p className="text-muted-foreground mt-1">
            Pledged item records, loan amount, interest and tenure.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full sm:w-auto" onClick={startNew}>
              <Plus className="w-4 h-4 mr-2" /> New Girvi
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[75vh] overflow-y-auto" aria-describedby={undefined} onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Girvi Loan" : "New Girvi Loan"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Arrival Date</Label>
                {(() => {
                  let displayValue = form.date;
                  if (!dateFocused && form.date) {
                    const parts = form.date.split('-');
                    if (parts.length === 3) {
                      displayValue = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                  }
                  return (
                    <Input type={dateFocused ? "date" : "text"} placeholder="DD/MM/YYYY" value={displayValue} onChange={(e) => setForm({ ...form, date: e.target.value })} onFocus={() => setDateFocused(true)} onBlur={() => setDateFocused(false)} className="w-full" />
                  );
                })()}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Search Customer</Label>
                  <Input 
                    placeholder="Search name, mobile, or address..." 
                    value={searchCust} 
                    onChange={(e) => {
                      setSearchCust(e.target.value);
                      const match = customers.find(c => c.mobile === e.target.value || c.phone === e.target.value || c.name.toLowerCase() === e.target.value.toLowerCase() || (c.address || "").toLowerCase().includes(e.target.value.toLowerCase()));
                      if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || match.phone || "", customerMobile2: match.phone2 || "", customerAddress: match.address || ""});
                    }} 
                  />
                </div>
                <div>
                  <Label className="text-xs">Customer *</Label>
              <Select value={form.customerMobile || form.customerName || ""} onValueChange={(val) => {
                    if (val === "NEW") {
                      setForm({...form, customerMobile: "NEW", customerName: "", customerMobile2: "", customerAddress: ""});
                    } else {
                  const match = customers.find(c => (c.mobile || c.phone || c.name) === val);
                      if (match) setForm({...form, customerName: match.name, customerMobile: match.mobile || match.phone || "", customerMobile2: match.phone2 || "", customerAddress: match.address || ""});
                    }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW" className="font-semibold text-primary">+ Create New Customer</SelectItem>
                      {customers.filter(c => c.name.toLowerCase().includes(searchCust.toLowerCase()) || (c.mobile || c.phone || "").includes(searchCust) || (c.address || "").toLowerCase().includes(searchCust.toLowerCase())).sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((c) => (
                    <SelectItem key={c._id || c.id} value={c.mobile || c.phone || c.name}>{c.name} {c.mobile || c.phone ? `· ${c.mobile || c.phone}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.customerMobile === "NEW" && (
                <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-sm space-y-3 mt-2 col-span-2">
                  <div className="space-y-1.5"><Label className="text-xs">Full Name *</Label><Input value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Mobile No (optional)</Label><Input value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Mobile No 2 (optional)</Label><Input value={newCust.phone2} onChange={e => setNewCust({...newCust, phone2: e.target.value})} className="h-8 bg-background" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">Address *</Label><Input value={newCust.address} onChange={e => setNewCust({...newCust, address: e.target.value})} className="h-8 bg-background" /></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Customer Name</Label>
                  <Input value={form.customerName} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input value={form.customerMobile} readOnly className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mobile 2</Label>
                  <Input value={form.customerMobile2} onChange={(e) => setForm({ ...form, customerMobile2: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Textarea rows={2} value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Item Details</h3>
                  <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {(form.items || []).map((item, idx) => (
                    <div key={idx} className="p-3 rounded-md border border-input bg-muted/30 space-y-3 relative">
                      <div className="absolute top-2 right-2">
                        <Button variant="ghost" size="sm" onClick={() => removeItem(idx)} className="h-6 w-6 p-0">
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select value={item.itemType} onValueChange={(v) => updateItem(idx, { itemType: v as any })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Gold">Gold</SelectItem>
                              <SelectItem value="Silver">Silver</SelectItem>
                              <SelectItem value="Mixed">Mixed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Category</Label>
                          <Select value={item.itemCategory || ""} onValueChange={(v) => updateItem(idx, { itemCategory: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Description *</Label>
                        <Input className="h-8 text-xs" value={item.itemDescription} onChange={(e) => updateItem(idx, { itemDescription: e.target.value })} placeholder="e.g. 2 bangles, 1 chain" />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Gross (g)</Label>
                          <Input type="number" className="h-8 text-xs" value={item.grossWeight || ""} onChange={(e) => updateItem(idx, { grossWeight: +e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Net (g)</Label>
                          <Input type="number" className="h-8 text-xs" value={item.netWeight || ""} onChange={(e) => updateItem(idx, { netWeight: +e.target.value })} />
                        </div>
                        <div>
                          <Label className="text-xs">Purity</Label>
                          <Input className="h-8 text-xs" value={item.purity} onChange={(e) => updateItem(idx, { purity: e.target.value })} />
                        </div>
                      </div>
                      
                    </div>
                  ))}
                </div>
                
                {(form.items || []).length > 0 && (
                  <div className="mt-3 p-2 rounded-md bg-muted/50 text-xs">
                    <div className="grid grid-cols-2 gap-2 font-medium">
                      <div>Total Gross: {getTotalWeights().totalGross.toFixed(3)} g</div>
                      <div>Total Net: {getTotalWeights().totalNet.toFixed(3)} g</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Loan Amount *</Label>
                  <Input type="number" value={form.loanAmount || ""} onChange={(e) => setForm({ ...form, loanAmount: +e.target.value })} />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input type="number" step="0.1" value={form.interestPct || ""} onChange={(e) => setForm({ ...form, interestPct: +e.target.value })} placeholder="e.g. 12" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Bill / Invoice No.</Label>
                  <Input value={form.documentNumber || ""} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} placeholder="INV-12345" />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Item Image</Label>
                <Input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0])} />
                {imagePreview && <img src={imagePreview} alt="Item" className="mt-2 h-28 w-full rounded-md object-cover" />}
              </div>
              <div>
                <Label>Note</Label>
                <Textarea rows={2} value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              
              <div className="border-t pt-4 mt-2">
                <h3 className="text-sm font-medium mb-3 text-purple-700">Forwarding Details (Optional)</h3>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <Label>Shop Name</Label>
                    <div className="flex gap-1">
                      <Input value={form.forwardedShopName || ""} onChange={(e) => setForm({ ...form, forwardedShopName: e.target.value })} placeholder="Shop Name" className="flex-1" />
                      {forwardedShops.length > 0 && (
                        <Select onValueChange={(val) => {
                          const match = forwardedShops.find(s => s.name === val);
                          if (match) setForm({...form, forwardedShopName: match.name, forwardedShopGstNo: match.gst || "", forwardedShopAddress: match.address || ""});
                        }}>
                          <SelectTrigger className="w-10 px-0 flex justify-center bg-muted"><SelectValue placeholder=""/></SelectTrigger>
                          <SelectContent>
                            {forwardedShops.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Shop GST No. (Optional)</Label>
                    <Input value={form.forwardedShopGstNo || ""} onChange={(e) => setForm({ ...form, forwardedShopGstNo: e.target.value })} placeholder="GSTIN" />
                  </div>
                </div>
                <div className="mb-2">
                  <Label>Shop Address</Label>
                  <Textarea rows={2} value={form.forwardedShopAddress || ""} onChange={(e) => setForm({ ...form, forwardedShopAddress: e.target.value })} placeholder="Address" />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <Label>Forwarded Date</Label>
                    <Input type="date" value={form.forwardedDate || ""} onChange={(e) => setForm({ ...form, forwardedDate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Forwarded Amount ₹</Label>
                    <Input type="number" value={form.forwardedAmount || ""} onChange={(e) => setForm({ ...form, forwardedAmount: +e.target.value })} />
                  </div>
                  <div>
                    <Label>Shop Interest Rate (%)</Label>
                    <Input type="number" step="0.1" value={form.forwardedInterestPct || ""} onChange={(e) => setForm({ ...form, forwardedInterestPct: +e.target.value })} placeholder="e.g. 12" />
                  </div>
                </div>
                <div>
                  <Label>Forwarded Item Image</Label>
                  <Input type="file" accept="image/*" onChange={(e) => handleForwardedImageChange(e.target.files?.[0])} />
                  {forwardedImagePreview && <img src={forwardedImagePreview} alt="Forwarded Item" className="mt-2 h-28 w-full rounded-md object-cover" />}
                </div>
              </div>

              <div className="border-t pt-4 mt-2 mb-2">
                <Label className="text-muted-foreground font-medium block mb-3">Signatures (Optional)</Label>
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

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 pt-2">
                <Button className="w-full" onClick={() => add(false)}>Save Girvi</Button>
                <Button className="w-full" onClick={() => add(true)}>Save & Print Bill</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI label="Active Loans" value={totals.activeCount} icon={Landmark} colorClass="text-primary" />
        <KPI label="Principal Out" value={formatCompactIfLarge(totals.principal)} icon={Wallet} colorClass="text-amber-600" />
        <KPI label="Pledged Weight" value={`${totals.pledgedWeight.toFixed(3)} g`} icon={Scale} colorClass="text-blue-600" />
        <KPI label="Collateral Value" value={formatCompactIfLarge(totals.collateralValue)} icon={TrendingUp} colorClass="text-emerald-600" />
      </div>

      {totals.forwardedPrincipal > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <KPI label="Forwarded Principal" value={formatCompactIfLarge(totals.forwardedPrincipal)} icon={Landmark} colorClass="text-purple-600" />
          <KPI label="Shop Interest Due" value={formatCompactIfLarge(totals.forwardedInterest)} icon={TrendingUp} colorClass="text-rose-500" />
          <KPI label="Total Shop Payable" value={formatCompactIfLarge(totals.forwardedPrincipal + totals.forwardedInterest)} icon={Wallet} colorClass="text-rose-700" />
        </div>
      )}

      <Card className="shadow-sm border-border overflow-hidden flex flex-col">
          <CardHeader className="bg-muted/20 border-b border-border pb-3 pt-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-base font-semibold font-display">Loan Records</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search customer, loan no, or address..." 
                    value={q} 
                    onChange={e => setQ(e.target.value)} 
                    className="pl-9 h-8 bg-background text-xs border-border shadow-sm"
                  />
                </div>
                <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="w-32 h-8 bg-background text-xs font-medium border-border shadow-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Auctioned">Auctioned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <p className="text-sm text-muted-foreground py-12 text-center">Loading records...</p> : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Search className="w-10 h-10 mb-3 opacity-20" />
                <p>No girvi records found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/40 text-muted-foreground text-[11px] uppercase tracking-wider border-b border-border">
                    <tr>
                      <th className="py-3 px-3 sm:px-4 font-semibold">Loan No</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold">Date & Time</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold">Customer</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold">Item Details</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right">Net Wt.</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right">Principal</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right">Interest</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-center">Status</th>
                      <th className="py-3 px-3 sm:px-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                {paginated.map((g) => {
                      const interestAmt = calculateInterest(g);
                      const hasMultipleItems = g.items && g.items.length > 0;
                      const totalNetWeight = hasMultipleItems
                        ? (g.items || []).reduce((sum, item) => sum + (item.netWeight || 0), 0)
                        : (g.netWeight || 0);

                      const statusColors = {
                        Active: "bg-amber-100 text-amber-800 border-amber-200",
                        Closed: "bg-green-100 text-green-800 border-green-200",
                        Auctioned: "bg-rose-100 text-rose-800 border-rose-200",
                      };

                      return (
                        <tr key={(g as any)._id || g.id} className="border-b border-border/50 last:border-0 align-top hover:bg-muted/20 transition-colors">
                          <td className="py-3 px-3 sm:px-4 font-medium text-foreground break-all min-w-20">{g.loanNo}</td>
                          <td className="py-3 px-3 sm:px-4 min-w-25">
                            <div className="text-sm">{formatDate(g.date)}</div>
                            <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{getElapsedTimeString(g.date)} elapsed</div>
                            {g.dueDate && <div className="text-[11px] text-rose-500 font-medium mt-0.5">Due: {formatDate(g.dueDate)}</div>}
                          </td>
                          <td className="py-3 px-3 sm:px-4">
                            <div className="font-medium text-foreground">{g.customerName}</div>
                            <div className="text-xs text-muted-foreground">{g.customerMobile}</div>
                          </td>
                          <td className="py-3 px-3 sm:px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-md bg-muted/50 flex items-center justify-center border border-border shadow-sm shrink-0">
                                {g.imageUrl ? <img src={g.imageUrl} alt="Item" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-muted-foreground/50" />}
                              </div>
                              <div className="min-w-0">
                                {hasMultipleItems ? (
                                  <div className="font-medium text-foreground">{g.items?.length || 0} items</div>
                                ) : (
                                  <div className="font-medium text-foreground">{g.itemType} {g.purity}</div>
                                )}
                                <div className="text-xs text-muted-foreground line-clamp-2 max-w-37.5 lg:max-w-xs mt-0.5" title={hasMultipleItems ? (g.items || []).map(it => it.itemDescription).join(', ') : g.itemDescription}>{hasMultipleItems ? (g.items || []).map(it => it.itemDescription).join(', ') : g.itemDescription}</div>
                              {(g.forwardedShopName || g.forwardedTo) && (
                                <div className={`mt-1 text-[10px] font-semibold border inline-block px-1.5 py-0.5 rounded truncate max-w-37.5 lg:max-w-xs ${(g as any).isForwardedSettled ? "text-green-700 border-green-200 bg-green-50" : "text-purple-700 border-purple-200 bg-purple-50"}`} title={g.forwardedShopName || g.forwardedTo}>
                                  Fwd: {g.forwardedShopName || g.forwardedTo} {(g as any).isForwardedSettled ? "(Settled)" : ""}
                                </div>
                              )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right font-medium text-foreground">{(totalNetWeight || 0).toFixed(3)} g</td>
                          <td className="py-3 px-3 sm:px-4 text-right font-semibold text-foreground">{formatCompactIfLarge(g.loanAmount)}</td>
                          <td className="py-3 px-3 sm:px-4 text-right min-w-27.5">
                            <div className="font-semibold text-amber-600">{formatCompactIfLarge(interestAmt)}</div>
                            <div className="text-[10px] leading-tight text-muted-foreground font-medium mt-0.5">@ {g.interestPct}%/mo<br/>(compound mo)</div>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-center">
                            <Select value={g.status} onValueChange={(v) => setStatus((g as any)._id || g.id, v as Girvi["status"])}>
                              <SelectTrigger className={`mx-auto h-7 w-24 text-[10px] font-bold uppercase tracking-wider shadow-none border-transparent ${statusColors[g.status] || ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Closed">Closed</SelectItem>
                                <SelectItem value="Auctioned">Auctioned</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" className="h-8 bg-background" onClick={() => setViewing(g as Girvi)}>View</Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(g as Girvi)}>
                                <Pencil className="w-4 h-4 text-muted-foreground hover:text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove((g as any)._id || g.id)}>
                                <Trash2 className="w-4 h-4 text-rose-500 hover:text-rose-600" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
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
      {viewing && <GirviModal girvi={viewing} authUser={authUser} onClose={() => setViewing(null)} />}
    </Layout>
  );
}

function KPI({ label, value, icon: Icon, colorClass }: { label: string; value: string | number; icon?: any; colorClass?: string }) {
  const bgClass = colorClass ? colorClass.replace('text-', 'bg-').replace(/-\d00$/, '-100') : 'bg-muted';
  
  return (
    <Card className="shadow-sm border-border hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-muted-foreground truncate" title={label}>{label}</div>
          <div className={`text-xl lg:text-2xl font-display font-bold mt-1 truncate ${colorClass || "text-foreground"}`} title={String(value)}>{value}</div>
        </div>
        {Icon && (
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bgClass} bg-opacity-50 shrink-0`}>
            <Icon className={`w-6 h-6 ${colorClass || "text-muted-foreground"}`} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GirviModal({ girvi, authUser, onClose }: { girvi: Girvi; authUser: any; onClose: () => void }) {
  const interest = calculateInterest(girvi);
  const total = girvi.loanAmount + interest;
  const forwardedInterest = calculateForwardedInterest(girvi);
  const forwardedTotal = (girvi.forwardedAmount || 0) + forwardedInterest;

  const displayNote = girvi.note?.replace(/\[(IntPeriod|FwdIntPeriod|IntType|FwdIntType):.*?\]/g, '').trim();

  return (
    <div className="fixed inset-0 z-100 bg-black/50 flex justify-center items-start p-2 sm:p-4 print:bg-white print:p-0 overflow-y-auto pointer-events-auto">
      <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl print:shadow-none print:max-w-none text-slate-900 my-auto relative flex flex-col max-h-[95vh] print:max-h-none print:block">
        <style>{`@media print { @page { margin: 4mm; } body { zoom: 0.9; } }`}</style>
        <div className="p-5 border-2 border-slate-800 m-2 print:m-0 print:p-2 rounded-sm bg-white overflow-y-auto flex-1 print:overflow-visible">
          <ShopHeader documentLabel="Girvi / Pawn Ticket" compact rightElement={<PaymentQr amount={girvi.status === "Closed" ? 0 : total} compact />} />
          
          {/* Meta Info */}
          <div className="flex justify-between items-end mb-4 text-xs">
            <div>
              <div className="font-bold text-lg">{girvi.loanNo}</div>
              <div className="text-slate-600 mt-1">
                Status: <span className="uppercase font-bold text-slate-900">{girvi.status}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 text-left">
                <span className="text-slate-500 font-medium text-right">Date:</span>
                <span className="font-bold">{formatDate(girvi.date)}</span>
                {girvi.dueDate && (
                  <>
                    <span className="text-slate-500 font-medium text-right">Due Date:</span>
                    <span className="font-bold">{formatDate(girvi.dueDate)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Customer Info Box */}
          <div className="border border-slate-300 rounded p-3 mb-4">
            <h3 className="font-bold text-xs uppercase text-slate-500 mb-3 tracking-wider">Customer Details</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-bold text-base mb-1">{girvi.customerName}</div>
                <div>{girvi.customerMobile} {girvi.customerMobile2 ? `/ ${girvi.customerMobile2}` : ""}</div>
                <div className="text-slate-600 mt-1">{girvi.customerAddress || "No address provided"}</div>
              </div>
              <div className="text-right flex flex-col justify-end">
                {girvi.documentType && <div><span className="text-slate-500">ID Type:</span> <span className="font-medium">{girvi.documentType}</span></div>}
                {girvi.documentNumber && <div><span className="text-slate-500">ID No:</span> <span className="font-medium">{girvi.documentNumber}</span></div>}
              </div>
            </div>
          </div>

          {/* Item Details Table */}
          <div className="mb-4">
            <h3 className="font-bold text-xs uppercase text-slate-500 mb-3 tracking-wider">Pledged Item Details</h3>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs border-collapse border border-slate-300 min-w-125 print:min-w-full">
                <thead className="bg-slate-50">
                <tr>
                  <th className="border border-slate-300 p-1.5 text-left font-semibold">Description</th>
                  <th className="border border-slate-300 p-1.5 text-left font-semibold">Type</th>
                  <th className="border border-slate-300 p-1.5 text-right font-semibold">Gross Wt</th>
                  <th className="border border-slate-300 p-1.5 text-right font-semibold">Net Wt</th>
                  <th className="border border-slate-300 p-1.5 text-right font-semibold">Purity</th>
                </tr>
              </thead>
              <tbody>
                {(girvi.items && girvi.items.length > 0 ? girvi.items : [{
                  itemDescription: girvi.itemDescription || "",
                  itemType: girvi.itemType || "",
                  itemCategory: girvi.itemCategory || "",
                  grossWeight: girvi.grossWeight || 0,
                  netWeight: girvi.netWeight || 0,
                  purity: girvi.purity || "",
                }]).map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="border border-slate-300 p-1.5">{item.itemDescription}</td>
                    <td className="border border-slate-300 p-1.5">{item.itemType} {item.itemCategory ? `- ${item.itemCategory}` : ""}</td>
                    <td className="border border-slate-300 p-1.5 text-right">{(item.grossWeight || 0).toFixed ? (item.grossWeight || 0).toFixed(3) : item.grossWeight} g</td>
                    <td className="border border-slate-300 p-1.5 text-right font-bold">{(item.netWeight || 0).toFixed ? (item.netWeight || 0).toFixed(3) : item.netWeight} g</td>
                    <td className="border border-slate-300 p-1.5 text-right">{item.purity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Financials Box */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border border-slate-300 rounded p-3 text-xs flex flex-col justify-center">
              <div className="flex justify-between mb-2">
                <span className="text-slate-500">Interest Rate</span>
                <span className="font-bold">{girvi.interestPct}% per month (compound monthly)</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-500">Time Elapsed</span>
                <span className="font-bold">{getElapsedTimeString(girvi.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. Market Value</span>
                <span className="font-bold">{inr(girvi.marketValue || 0)}</span>
              </div>
              {girvi.status === "Closed" && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 text-green-800 text-center font-bold rounded tracking-wide">
                  LOAN CLOSED & CLEARED
                </div>
              )}
            </div>

            <div className="border border-slate-300 rounded p-3 text-xs bg-slate-50">
              <div className="flex justify-between mb-1.5 text-sm">
                <span className="text-slate-600">Principal Amount</span>
                <span className="font-bold">{inr(girvi.loanAmount)}</span>
              </div>
              {girvi.status !== "Closed" && (
                <div className="flex justify-between mb-2 text-sm">
                  <span className="text-slate-600">Accrued Interest</span>
                  <span className="font-bold">{inr(interest)}</span>
                </div>
              )}
              <div className="border-t border-slate-300 mt-1.5 pt-2 flex justify-between font-bold text-lg">
                <span>{girvi.status === "Closed" ? "Balance Due" : "Total Payable"}</span>
                <span className={girvi.status === "Closed" ? "text-green-700" : "text-rose-700"}>
                  {girvi.status === "Closed" ? inr(0) : inr(total)}
                </span>
              </div>
            </div>
          </div>

          {/* Note and Images */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              {displayNote && (
                <div className="text-xs">
                  <strong className="text-xs uppercase text-slate-500 mb-1 block tracking-wider">Remarks / Note</strong>
                  <p className="p-2 border border-slate-200 bg-slate-50 rounded text-slate-700">{displayNote}</p>
                </div>
              )}
            </div>
            <div className="text-right flex justify-end">
              {girvi.imageUrl && (
                <div className="text-xs">
                   <strong className="text-xs uppercase text-slate-500 mb-1 block tracking-wider">Pledged Item</strong>
                   <img src={girvi.imageUrl} alt="Pledged Item" className="w-20 h-20 object-cover rounded border border-slate-300 shadow-sm ml-auto" />
                </div>
              )}
            </div>
          </div>

          {/* Forwarding Details (Hidden from print) */}
          {(girvi.forwardedShopName || girvi.forwardedTo) && (
            <div className="mb-4 p-3 border border-purple-200 bg-purple-50 rounded text-xs print:hidden">
              <h4 className="font-bold mb-3 uppercase tracking-wider text-purple-900 flex items-center gap-2">
                <span className="bg-purple-200 text-purple-900 px-2 py-0.5 rounded">Internal Use Only</span> 
                Forwarding Details
                {isGirviForwardedSettled(girvi) && <span className="ml-auto bg-green-100 text-green-800 px-2 py-0.5 rounded text-[10px]">SETTLED</span>}
              </h4>
              <div className="grid grid-cols-3 gap-4 text-purple-900">
                <div>
                  <div className="text-purple-600/80 mb-0.5">Shop / Location</div>
                  <div className="font-bold text-sm">{girvi.forwardedShopName || girvi.forwardedTo}</div>
                  <div>{girvi.forwardedShopAddress}</div>
                  <div>{girvi.forwardedShopGstNo && `GST: ${girvi.forwardedShopGstNo}`}</div>
                </div>
                <div>
                  <div className="text-purple-600/80 mb-0.5">Shop Financials</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <span>Forwarded Amount:</span> <span className="font-bold">{inr(girvi.forwardedAmount || 0)}</span>
                    <span>Fwd Date:</span> <span className="font-bold">{girvi.forwardedDate ? formatDate(girvi.forwardedDate) : formatDate(girvi.date)}</span>
                    <span>Rate:</span> <span className="font-bold">{girvi.forwardedInterestPct || 0}% per month (compound monthly)</span>
                    <span>{isGirviForwardedSettled(girvi) ? "Settled Interest:" : "Interest:"}</span> <span className="font-bold text-amber-700">{inr(forwardedInterest)}</span>
                    {isGirviForwardedSettled(girvi) && ((girvi as any).forwardedSettledDate || girvi.note?.match(/cleared on (.*?) - Paid/)) && (
                      <>
                        <span>Settled On:</span> <span className="font-bold">{girvi.note?.match(/cleared on (.*?) - Paid/)?.[1] || formatDate((girvi as any).forwardedSettledDate)}</span>
                      </>
                    )}
                    <span className="font-bold pt-1 border-t border-purple-200">{isGirviForwardedSettled(girvi) ? "Total Settled Amount:" : "Total Owed:"}</span> <span className="font-bold text-rose-700 pt-1 border-t border-purple-200">{inr(forwardedTotal)}</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  {girvi.forwardedImageUrl && (
                    <img src={girvi.forwardedImageUrl} alt="Forwarded" className="w-20 h-20 object-cover rounded border border-purple-300" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Signatures */}
          <div className="mt-12 print:mt-6 flex justify-between items-end text-xs font-bold text-slate-700 uppercase tracking-wider print:break-inside-avoid">
            <div className="text-center">
              {girvi.customerSignature ? (
                <img src={girvi.customerSignature} alt="Customer Signature" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-56 border-t-2 border-slate-400 mb-2"></div>
              )}
              Customer Signature
            </div>
            <div className="text-center">
              {girvi.authorizedSignatory ? (
                <img src={girvi.authorizedSignatory} alt="Authorized Signatory" className="h-16 mx-auto mb-2 object-contain" />
              ) : (
                <div className="w-56 border-t-2 border-slate-400 mb-2"></div>
              )}
              Authorized Signatory
            </div>
          </div>

          <div className="mt-8 print:mt-2 border-t border-slate-200 pt-4 print:pt-2 text-center text-xs normal-case tracking-normal font-normal text-slate-600 print:break-inside-avoid">
            {authUser?.termsAndConditions ? (
              <div className="text-[10px] text-slate-600 whitespace-pre-wrap">{authUser.termsAndConditions}</div>
            ) : (
              <InvoiceTerms compact />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 bg-slate-100 p-4 border-t border-slate-200 rounded-b-lg flex justify-end gap-3 print:hidden">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
