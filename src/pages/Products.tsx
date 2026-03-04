import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

const categories = ["all", "vegetables", "fruits", "grains", "dairy", "livestock"] as const;

export default function Products() {
  const { user, role } = useAuth();
  const [products, setProducts] = useState<(Product & { farmer_name?: string; avg_rating?: number })[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<(Product & { farmer_name?: string; avg_rating?: number }) | null>(null);
  const [orderQty, setOrderQty] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "cash_on_delivery">("mobile_money");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [pickupStation, setPickupStation] = useState("");

  const fetchProducts = async () => {
    let q = supabase.from("products").select("*").eq("status", "approved").order("created_at", { ascending: false });
    if (categoryFilter !== "all") q = q.eq("category", categoryFilter as Database["public"]["Enums"]["product_category"]);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    if (data) {
      const enriched = await Promise.all(data.map(async (p) => {
        const [profRes, revRes] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("user_id", p.farmer_id).single(),
          supabase.from("reviews").select("rating").eq("product_id", p.id),
        ]);
        const avg = revRes.data?.length ? revRes.data.reduce((s, r) => s + r.rating, 0) / revRes.data.length : 0;
        return { ...p, farmer_name: profRes.data?.full_name, avg_rating: avg };
      }));
      setProducts(enriched);
    }
  };

  const fetchReviews = async (productId: string) => {
    const { data } = await supabase.from("reviews").select("*, profiles:buyer_id(full_name)").eq("product_id", productId);
    setReviews(data || []);
  };

  useEffect(() => { fetchProducts(); }, [categoryFilter, search]);

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selected) return;
    if (paymentMethod === "mobile_money" && !paymentPhone.trim()) {
      toast({ title: "Enter phone number", variant: "destructive" });
      return;
    }
    const qty = parseInt(orderQty);
    const total = qty * selected.price;
    const { error } = await supabase.from("orders").insert({
      buyer_id: user.id,
      product_id: selected.id,
      farmer_id: selected.farmer_id,
      quantity: qty,
      total_price: total,
      payment_phone: paymentMethod === "mobile_money" ? paymentPhone : "",
      payment_method: paymentMethod,
      pickup_station: pickupStation,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Order placed!", description: `UGX ${total.toLocaleString()}` });
    setSelected(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold mb-6">Browse Products</h1>
        <div className="flex flex-wrap gap-3 mb-6">
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c === "all" ? "All Categories" : c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map(p => (
            <Card key={p.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setSelected(p); fetchReviews(p.id); }}>
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />}
              <CardContent className="pt-4">
                <h3 className="font-semibold">{p.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">{p.category}</p>
                <p className="text-sm text-muted-foreground">By {p.farmer_name || "Farmer"}</p>
                {p.avg_rating ? (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="h-3 w-3 fill-accent text-accent" />
                    <span className="text-sm">{p.avg_rating.toFixed(1)}</span>
                  </div>
                ) : null}
                <p className="font-bold text-primary mt-2">UGX {p.price.toLocaleString()}/{p.unit}</p>
              </CardContent>
            </Card>
          ))}
          {products.length === 0 && <p className="text-muted-foreground col-span-full text-center py-10">No products found</p>}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={o => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.name}</DialogTitle></DialogHeader>
              {selected.image_url && <img src={selected.image_url} alt={selected.name} className="w-full h-48 object-cover rounded-lg" />}
              <p className="text-muted-foreground">{selected.description}</p>
              <div className="flex justify-between">
                <p className="font-bold text-primary text-lg">UGX {selected.price.toLocaleString()}/{selected.unit}</p>
                <p className="text-sm text-muted-foreground">{selected.quantity} {selected.unit} available</p>
              </div>
              <p className="text-sm">Farmer: {selected.farmer_name || "—"}</p>

              {reviews.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <h4 className="font-semibold mb-2">Reviews</h4>
                  {reviews.map(r => (
                    <div key={r.id} className="mb-2 text-sm">
                      <div className="flex items-center gap-1">{"⭐".repeat(r.rating)} <span className="text-muted-foreground">— {(r as any).profiles?.full_name || "Buyer"}</span></div>
                      {r.comment && <p className="text-muted-foreground ml-1">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}

              {user && role === "buyer" && selected.quantity > 0 && (
                <form onSubmit={handleOrder} className="border-t pt-3 mt-3 space-y-3">
                  <h4 className="font-semibold">Place Order</h4>
                  <div><Label>Quantity</Label><Input type="number" min="1" max={selected.quantity} value={orderQty} onChange={e => setOrderQty(e.target.value)} required /></div>
                  <p className="font-semibold">Total: UGX {(parseInt(orderQty || "0") * selected.price).toLocaleString()}</p>
                  
                  <div className="space-y-2">
                    <Label className="font-semibold">Payment Method</Label>
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                      <div className="flex items-center space-x-2 border rounded-lg p-3">
                        <RadioGroupItem value="mobile_money" id="pm_momo" />
                        <Label htmlFor="pm_momo" className="flex-1 cursor-pointer">
                          <span className="font-medium">📱 Mobile Money</span>
                          <p className="text-xs text-muted-foreground">MTN or Airtel (simulated)</p>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 border rounded-lg p-3">
                        <RadioGroupItem value="cash_on_delivery" id="pm_cash" />
                        <Label htmlFor="pm_cash" className="flex-1 cursor-pointer">
                          <span className="font-medium">💵 Cash on Delivery</span>
                          <p className="text-xs text-muted-foreground">Pay when you receive</p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {paymentMethod === "mobile_money" && (
                    <div className="border rounded-lg p-3 bg-muted/50">
                      <Input value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} placeholder="+256 7XX XXX XXX" required />
                    </div>
                  )}
                  <div>
                    <Label>Pickup Station</Label>
                    <Input value={pickupStation} onChange={e => setPickupStation(e.target.value)} placeholder="e.g. Kampala Central, Jinja Road Branch" required />
                    <p className="text-xs text-muted-foreground mt-1">Where you'd like to pick up your order.</p>
                  </div>
                  <Button type="submit" className="w-full">Confirm Order</Button>
                </form>
              )}
              {!user && <p className="text-sm text-muted-foreground border-t pt-3 mt-3">Please <a href="/login" className="text-primary underline">sign in</a> to place orders.</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
