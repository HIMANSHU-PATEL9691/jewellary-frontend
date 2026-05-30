import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr, type Girvi, useLocalState, uid } from "@/lib/storage";
import { formatDate } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { girviAPI } from "@/lib/api";
import { Store, Eye, ArrowUpRight, Plus, MapPin, FileText, Phone } from "lucide-react";

function calculateForwardedInterest(girvi: Girvi) {
  if (!girvi.date || !girvi.forwardedAmount || !girvi.forwardedInterestPct) return 0;
  
  const start = new Date(girvi.date);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const diffTime = now.getTime() > start.getTime() ? now.getTime() - start.getTime() : 0;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const months = Math.max(1, diffDays / 30); 
  return Math.round((girvi.forwardedAmount * (girvi.forwardedInterestPct / 100)) * months);
}

export type ForwardedShopProfile = {
  id: string;
  name: string;
  phone: string;
  address: string;
  gst: string;
};

export default function ForwardedShopsPage() {
  const { data: girvis = [], isLoading } = useApi<Girvi[]>(["girvis"], () => girviAPI.getAll());
  const [profiles, setProfiles] = useLocalState<ForwardedShopProfile[]>("ajms.forwardedShops", []);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<ForwardedShopProfile>({ id: "", name: "", phone: "", address: "", gst: "" });

  const shops = useMemo(() => {
    const map = new Map<string, any>();
    
    // 1. Initialize with explicitly saved profiles
    profiles.forEach(p => {
      map.set(p.name.toLowerCase().trim(), {
        profileId: p.id,
        name: p.name,
        phone: p.phone,
        address: p.address,
        gst: p.gst,
        records: [],
      });
    });

    // 2. Group girvis by forwarded shop name
    girvis.forEach(g => {
      const originalName = (g.forwardedShopName || g.forwardedTo)?.trim();
      if (originalName) {
        const key = originalName.toLowerCase();
        const existing = map.get(key);
        const records = existing ? existing.records : [];
        records.push(g);
        
        map.set(key, {
          ...(existing || {
            name: originalName,
            address: g.forwardedShopAddress,
            gst: g.forwardedShopGstNo,
          }),
          records,
        });
      }
    });

    return Array.from(map.values()).map(shop => {
      const activeRecords = shop.records.filter((r: Girvi) => r.status === "Active");
      const totalPrincipal = activeRecords.reduce((s: number, r: Girvi) => s + (r.forwardedAmount || 0), 0);
      const totalInterest = activeRecords.reduce((s: number, r: Girvi) => s + calculateForwardedInterest(r), 0);
      
      let addr = shop.address;
      let gst = shop.gst;
      if (!shop.profileId && shop.records.length > 0) {
        const latest = [...shop.records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        addr = latest.forwardedShopAddress;
        gst = latest.forwardedShopGstNo;
      }

      return {
        ...shop,
        address: addr,
        gst: gst,
        activeRecords,
        totalPrincipal,
        totalInterest,
      };
    }).sort((a, b) => b.totalPrincipal - a.totalPrincipal); // Sort by highest principal first
  }, [girvis, profiles]);

  const activeProfile = shops.find(s => s.name === selectedShop);

  const totalMarketOwed = shops.reduce((s, shop) => s + shop.totalPrincipal + shop.totalInterest, 0);
  const totalMarketPrincipal = shops.reduce((s, shop) => s + shop.totalPrincipal, 0);

  return (
    <Layout>
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-4xl">Forwarded Shops</h1>
          <p className="text-muted-foreground mt-1">Manage profiles and payouts for shops you forward Girvi items to.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="lg" onClick={() => setForm({ id: "", name: "", phone: "", address: "", gst: "" })}>
              <Plus className="w-4 h-4 mr-2" /> Add Shop Profile
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit Shop Profile" : "New Shop Profile"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Shop Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="E.g., ABC Jewellers" /></div>
              <div><Label>Mobile / Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div><Label>GST No</Label><Input value={form.gst} onChange={e => setForm({...form, gst: e.target.value})} /></div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => {
                if (!form.name) return;
                if (form.id) {
                  setProfiles(profiles.map(p => p.id === form.id ? form : p));
                } else {
                  setProfiles([...profiles, { ...form, id: uid() }]);
                }
                setOpenNew(false);
              }}>Save Profile</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Shops Forwarded To</div>
            <div className="text-2xl font-display mt-1">{shops.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Market Principal (Active)</div>
            <div className="text-2xl font-display mt-1 text-purple-700">{inr(totalMarketPrincipal)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-rose-600 font-medium">Total Market Payable (w/ Interest)</div>
            <div className="text-2xl font-display mt-1 text-rose-700">{inr(totalMarketOwed)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Store className="w-5 h-5 text-purple-700" /> Forwarding Partners
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-12">Loading shops...</p>
          ) : shops.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No items have been forwarded to other shops yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b bg-muted/20">
                <tr>
                  <th className="py-3 px-4 font-medium">Shop Name</th>
                  <th className="py-3 font-medium">Active Items</th>
                  <th className="py-3 font-medium text-right">Principal Taken</th>
                  <th className="py-3 font-medium text-right">Interest Due</th>
                  <th className="py-3 font-medium text-right text-rose-600">Total Owed</th>
                  <th className="py-3 px-4 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => (
                  <tr key={shop.name} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 px-4 font-medium text-primary">{shop.name}</td>
                    <td className="py-3">{shop.activeRecords.length} items</td>
                    <td className="py-3 text-right">{inr(shop.totalPrincipal)}</td>
                    <td className="py-3 text-right text-amber-600">{inr(shop.totalInterest)}</td>
                    <td className="py-3 text-right font-medium text-rose-600">{inr(shop.totalPrincipal + shop.totalInterest)}</td>
                    <td className="py-3 px-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedShop(shop.name)}>
                        <Eye className="w-4 h-4 mr-2" /> View Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Shop Profile Dialog */}
      <Dialog open={!!selectedShop} onOpenChange={(v) => !v && setSelectedShop(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          {activeProfile && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl font-display flex items-center gap-2 text-purple-800">
                  <Store className="w-6 h-6" /> {activeProfile.name}
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><Phone className="w-4 h-4 mt-0.5 shrink-0" /> {activeProfile.phone || "No phone on file"}</div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {activeProfile.address || "No address on file"}</div>
                <div className="flex items-start gap-2 text-sm text-muted-foreground"><FileText className="w-4 h-4 mt-0.5 shrink-0" /> GST: {activeProfile.gst || "—"}</div>
              </div>
              
              <h3 className="font-semibold mt-6 mb-2 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-rose-500"/> Forwarded Items Currently Active</h3>
              <div className="border rounded-md overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b bg-muted/20">
                    <tr>
                      <th className="py-2 px-3 font-medium">Original Loan</th>
                      <th className="py-2 font-medium">Item Details</th>
                      <th className="py-2 font-medium text-right">Rate</th>
                      <th className="py-2 font-medium text-right">Principal</th>
                      <th className="py-2 font-medium text-right">Accrued Interest</th>
                      <th className="py-2 px-3 font-medium text-right">Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProfile.activeRecords.map((r: Girvi) => {
                      const interest = calculateForwardedInterest(r);
                      return (
                        <tr key={r.id || (r as any)._id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 px-3">
                            <div className="font-medium">{r.loanNo}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(r.date)}</div>
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-3">
                              {r.forwardedImageUrl ? (
                                <img src={r.forwardedImageUrl} alt="Forwarded Item" className="w-10 h-10 rounded object-cover border border-border shrink-0" />
                              ) : r.imageUrl ? (
                                <img src={r.imageUrl} alt="Pledged Item" className="w-10 h-10 rounded object-cover border border-border shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border border-border shrink-0 text-[10px] text-muted-foreground">No img</div>
                              )}
                              <div>
                                <div className="font-medium text-primary">{r.itemDescription}</div>
                                <div className="text-xs text-muted-foreground">{r.itemType} {r.purity} • {r.netWeight}g</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 text-right">{r.forwardedInterestPct}%/mo</td>
                          <td className="py-2 text-right">{inr(r.forwardedAmount || 0)}</td>
                          <td className="py-2 text-right text-amber-600">{inr(interest)}</td>
                          <td className="py-2 px-3 text-right font-medium text-rose-600">{inr((r.forwardedAmount || 0) + interest)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}