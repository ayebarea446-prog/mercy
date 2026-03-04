import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Package, Star, User, Trash2, Plus, Minus, Receipt } from "lucide-react";
import OrderReceipt from "./OrderReceipt";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"];

type CartItem = {
  product: Product & { farmer_name?: string };
  quantity: number;
};

const categories = ["all", "vegetables", "fruits", "grains", "dairy", "livestock"] as const;

export default function BuyerDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [products, setProducts] = useState<(Product & { farmer_name?: string })[]>([]);
  const [orders, setOrders] = useState<(Order & { product_name?: string })[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "cash_on_delivery">("mobile_money");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [pickupStation, setPickupStation] = useState("");
  const [reviewDialog, setReviewDialog] = useState<Order | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", location: "" });
  const [receiptOrder, setReceiptOrder] = useState<(Order & { product_name?: string; farmer_name?: string }) | null>(null);

  const fetchProducts = async () => {
    let q = supabase.from("products").select("*").eq("status", "approved").order("created_at", { ascending: false });
    if (categoryFilter !== "all") q = q.eq("category", categoryFilter as Database["public"]["Enums"]["product_category"]);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    if (data) {
      const enriched = await Promise.all(data.map(async (p) => {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", p.farmer_id).single();
        return { ...p, farmer_name: prof?.full_name };
      }));
      setProducts(enriched);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase.from("orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false });
    if (data) {
      const enriched = await Promise.all(data.map(async (o) => {
        const [prodRes, farmerRes] = await Promise.all([
          supabase.from("products").select("name").eq("id", o.product_id).single(),
          supabase.from("profiles").select("full_name").eq("user_id", o.farmer_id).single(),
        ]);
        return { ...o, product_name: prodRes.data?.name, farmer_name: farmerRes.data?.full_name };
      }));
      setOrders(enriched);
    }
  };

  useEffect(() => { fetchProducts(); }, [categoryFilter, search]);
  useEffect(() => { fetchOrders(); }, [user]);
  useEffect(() => {
    if (profile) setProfileForm({ full_name: profile.full_name || "", phone: profile.phone || "", location: profile.location || "" });
  }, [profile]);

  const addToCart = (product: Product & { farmer_name?: string }) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast({ title: "Max stock reached", variant: "destructive" });
          return prev;
        }
        return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: `${product.name} added to cart` });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.product.id !== productId) return i;
      const newQty = i.quantity + delta;
      if (newQty <= 0) return i;
      if (newQty > i.product.quantity) return i;
      return { ...i, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + i.quantity * i.product.price, 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || cart.length === 0) return;

    if (paymentMethod === "mobile_money" && !paymentPhone.trim()) {
      toast({ title: "Enter phone number", variant: "destructive" });
      return;
    }

    for (const item of cart) {
      const { error } = await supabase.from("orders").insert({
        buyer_id: user.id,
        product_id: item.product.id,
        farmer_id: item.product.farmer_id,
        quantity: item.quantity,
        total_price: item.quantity * item.product.price,
        payment_phone: paymentMethod === "mobile_money" ? paymentPhone : "",
        payment_method: paymentMethod,
        pickup_station: pickupStation,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    toast({ title: "Orders placed!", description: `Total: UGX ${cartTotal.toLocaleString()}` });
    setCart([]);
    setCheckoutOpen(false);
    setPaymentPhone("");
    setPickupStation("");
    fetchOrders();
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewDialog) return;
    const { error } = await supabase.from("reviews").insert({
      buyer_id: user.id,
      product_id: reviewDialog.product_id,
      order_id: reviewDialog.id,
      rating: reviewRating,
      comment: reviewComment,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Review submitted!" });
    setReviewDialog(null);
    setReviewComment("");
    setReviewRating(5);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("profiles").update(profileForm).eq("user_id", user.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Profile updated" });
    refreshProfile();
  };

  return (
    <div className="min-h-screen rounded-2xl bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-6">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Buyer Dashboard</h1>
      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse" className="gap-1"><ShoppingCart className="h-4 w-4" /> Browse</TabsTrigger>
          <TabsTrigger value="cart" className="gap-1 relative">
            <ShoppingCart className="h-4 w-4" /> Cart
            {cart.length > 0 && (
              <span className="ml-1 bg-primary text-primary-foreground rounded-full text-xs w-5 h-5 flex items-center justify-center">{cart.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="orders" className="gap-1"><Package className="h-4 w-4" /> My Orders</TabsTrigger>
          <TabsTrigger value="profile" className="gap-1"><User className="h-4 w-4" /> Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-4">
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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => (
              <Card key={p.id} className="overflow-hidden">
                {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover" />}
                <CardContent className="pt-4">
                  <h3 className="font-semibold text-lg">{p.name}</h3>
                  <p className="text-sm text-muted-foreground mb-1">{p.description}</p>
                  <p className="text-sm text-muted-foreground mb-2">By {p.farmer_name || "Farmer"}</p>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-primary">UGX {p.price.toLocaleString()}/{p.unit}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} {p.unit} available</p>
                    </div>
                    <Button size="sm" onClick={() => addToCart(p)} disabled={p.quantity <= 0}>
                      {p.quantity > 0 ? "Add to Cart" : "Out of stock"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {products.length === 0 && <p className="text-muted-foreground col-span-full text-center py-10">No products found</p>}
          </div>
        </TabsContent>

        {/* Cart Tab */}
        <TabsContent value="cart" className="mt-4">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Your cart is empty. Browse products and add items!</p>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <Card key={item.product.id}>
                  <CardContent className="flex items-center gap-4 py-4">
                    {item.product.image_url && <img src={item.product.image_url} alt={item.product.name} className="w-16 h-16 object-cover rounded" />}
                    <div className="flex-1">
                      <h4 className="font-semibold">{item.product.name}</h4>
                      <p className="text-sm text-muted-foreground">UGX {item.product.price.toLocaleString()}/{item.product.unit}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateCartQty(item.product.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateCartQty(item.product.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="font-bold w-32 text-right">UGX {(item.quantity * item.product.price).toLocaleString()}</p>
                    <Button size="icon" variant="ghost" onClick={() => removeFromCart(item.product.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
              <div className="flex justify-between items-center border-t pt-4">
                <p className="text-xl font-bold">Total: UGX {cartTotal.toLocaleString()}</p>
                <Button size="lg" onClick={() => setCheckoutOpen(true)}>Proceed to Checkout</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Pickup Station</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Feedback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell>{o.product_name || "—"}</TableCell>
                  <TableCell>{o.quantity}</TableCell>
                  <TableCell>UGX {o.total_price.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{(o as any).payment_method === "cash_on_delivery" ? "Cash" : "MoMo"}</Badge></TableCell>
                  <TableCell>{(o as any).pickup_station || "—"}</TableCell>
                  <TableCell><Badge variant={o.status === "delivered" ? "default" : "secondary"}>{o.status}</Badge></TableCell>
                  <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="space-x-1">
                    {(o.status === "confirmed" || o.status === "delivered") && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setReceiptOrder(o)}>
                        <Receipt className="h-3 w-3" /> Receipt
                      </Button>
                    )}
                    {o.status === "delivered" && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => setReviewDialog(o)}>
                        <Star className="h-3 w-3" /> Review
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No orders yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <Card className="max-w-md">
            <CardHeader><CardTitle>Edit Profile</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div><Label>Full Name</Label><Input value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input value={profileForm.phone} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>Location</Label><Input value={profileForm.location} onChange={e => setProfileForm(f => ({ ...f, location: e.target.value }))} /></div>
                <Button type="submit">Save Changes</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Checkout — {cart.length} item(s)</DialogTitle></DialogHeader>
          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cart.map(item => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span>{item.product.name} × {item.quantity}</span>
                  <span className="font-medium">UGX {(item.quantity * item.product.price).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2">
              <p className="font-bold text-lg">Total: UGX {cartTotal.toLocaleString()}</p>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Payment Method</Label>
              <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as any)}>
                <div className="flex items-center space-x-2 border rounded-lg p-3">
                  <RadioGroupItem value="mobile_money" id="mobile_money" />
                  <Label htmlFor="mobile_money" className="flex-1 cursor-pointer">
                    <span className="font-medium">📱 Mobile Money</span>
                    <p className="text-xs text-muted-foreground">Pay via MTN or Airtel Mobile Money (simulated)</p>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3">
                  <RadioGroupItem value="cash_on_delivery" id="cash_on_delivery" />
                  <Label htmlFor="cash_on_delivery" className="flex-1 cursor-pointer">
                    <span className="font-medium">💵 Cash on Delivery</span>
                    <p className="text-xs text-muted-foreground">Pay when you receive your order</p>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {paymentMethod === "mobile_money" && (
              <div>
                <Label>Phone Number</Label>
                <Input value={paymentPhone} onChange={e => setPaymentPhone(e.target.value)} placeholder="+256 7XX XXX XXX" required />
                <p className="text-xs text-muted-foreground mt-1">A payment prompt will be sent to this number (simulated).</p>
              </div>
            )}

            <div>
              <Label>Pickup Station</Label>
              <Input value={pickupStation} onChange={e => setPickupStation(e.target.value)} placeholder="e.g. Kampala Central, Jinja Road Branch" required />
              <p className="text-xs text-muted-foreground mt-1">Where you'd like to pick up your order.</p>
            </div>

            <Button type="submit" className="w-full" size="lg">Place Order</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={o => { if (!o) setReviewDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Leave a Review</DialogTitle></DialogHeader>
          <form onSubmit={handleReview} className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setReviewRating(n)}>
                    <Star className={`h-6 w-6 ${n <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Comment</Label><Textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Tell us about your experience..." /></div>
            <Button type="submit" className="w-full">Submit Review</Button>
          </form>
        </DialogContent>
      </Dialog>

      <OrderReceipt
        order={receiptOrder}
        buyerName={profile?.full_name || "Buyer"}
        open={!!receiptOrder}
        onOpenChange={(o) => { if (!o) setReceiptOrder(null); }}
      />
    </div>
  );
}
