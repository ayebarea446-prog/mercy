import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Package, ShoppingCart, User, Upload, X, Star } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"];

const categories = ["vegetables", "fruits", "grains", "dairy", "livestock"] as const;
const units = ["kg", "g", "pieces", "heads", "litres", "bunches", "bags", "crates", "trays", "tonnes", "bundles", "baskets", "dozen", "sacks"] as const;

export default function FarmerDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<(Order & { product_name?: string; buyer_name?: string })[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "vegetables" as string, quantity: "", unit: "kg", image_url: "" });
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", location: "" });
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reviews, setReviews] = useState<any[]>([]);

  const fetchProducts = async () => {
    if (!user) return;
    const { data } = await supabase.from("products").select("*").eq("farmer_id", user.id).order("created_at", { ascending: false });
    if (data) setProducts(data);
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase.from("orders").select("*").eq("farmer_id", user.id).order("created_at", { ascending: false });
    if (data) {
      const enriched = await Promise.all(data.map(async (o) => {
        const [prodRes, buyerRes] = await Promise.all([
          supabase.from("products").select("name").eq("id", o.product_id).single(),
          supabase.from("profiles").select("full_name").eq("user_id", o.buyer_id).single(),
        ]);
        return { ...o, product_name: prodRes.data?.name, buyer_name: buyerRes.data?.full_name };
      }));
      setOrders(enriched);
    }
  };

  const fetchReviews = async () => {
    if (!user) return;
    // Fetch reviews for this farmer's products
    const { data: farmerProducts } = await supabase.from("products").select("id").eq("farmer_id", user.id);
    if (!farmerProducts?.length) { setReviews([]); return; }
    const productIds = farmerProducts.map(p => p.id);
    const { data } = await supabase.from("reviews").select("*").in("product_id", productIds).order("created_at", { ascending: false });
    if (data) {
      const enriched = await Promise.all(data.map(async (r) => {
        const [prodRes, buyerRes] = await Promise.all([
          supabase.from("products").select("name").eq("id", r.product_id).single(),
          supabase.from("profiles").select("full_name").eq("user_id", r.buyer_id).single(),
        ]);
        return { ...r, product_name: prodRes.data?.name, buyer_name: buyerRes.data?.full_name };
      }));
      setReviews(enriched);
    }
  };

  useEffect(() => { fetchProducts(); fetchOrders(); fetchReviews(); }, [user]);
  useEffect(() => {
    if (profile) setProfileForm({ full_name: profile.full_name || "", phone: profile.phone || "", location: profile.location || "" });
  }, [profile]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm(f => ({ ...f, image_url: urlData.publicUrl }));
    setImagePreview(urlData.publicUrl);
    setUploading(false);
    toast({ title: "Image uploaded!" });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      category: form.category as Database["public"]["Enums"]["product_category"],
      quantity: parseInt(form.quantity),
      unit: form.unit,
      image_url: form.image_url,
      farmer_id: user.id,
    };

    if (editingProduct) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Product updated" });
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Product added" });
    }
    setDialogOpen(false);
    setEditingProduct(null);
    setForm({ name: "", description: "", price: "", category: "vegetables", quantity: "", unit: "kg", image_url: "" });
    setImagePreview(null);
    fetchProducts();
  };

  const handleDeleteProduct = async (id: string) => {
    await supabase.from("products").delete().eq("id", id);
    toast({ title: "Product deleted" });
    fetchProducts();
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Database["public"]["Enums"]["order_status"]) => {
    await supabase.from("orders").update({ status }).eq("id", orderId);
    toast({ title: `Order ${status}` });
    fetchOrders();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("profiles").update(profileForm).eq("user_id", user.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Profile updated" });
    refreshProfile();
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setForm({ name: p.name, description: p.description || "", price: String(p.price), category: p.category, quantity: String(p.quantity), unit: p.unit, image_url: p.image_url || "" });
    setImagePreview(p.image_url || null);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingProduct(null);
    setForm({ name: "", description: "", price: "", category: "vegetables", quantity: "", unit: "kg", image_url: "" });
    setImagePreview(null);
    setDialogOpen(true);
  };

  const statusColor = (s: string) => {
    if (s === "approved") return "default";
    if (s === "pending") return "secondary";
    return "destructive";
  };

  return (
    <div className="min-h-screen rounded-2xl bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-6">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Farmer Dashboard</h1>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products" className="gap-1"><Package className="h-4 w-4" /> My Products</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1"><ShoppingCart className="h-4 w-4" /> Orders</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1"><Star className="h-4 w-4" /> Reviews</TabsTrigger>
          <TabsTrigger value="profile" className="gap-1"><User className="h-4 w-4" /> Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-muted-foreground">{products.length} product(s)</p>
            <Button className="gap-1" onClick={openNew}><Plus className="h-4 w-4" /> Add Product</Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingProduct(null); setImagePreview(null); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveProduct} className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Price (UGX)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required /></div>
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Quantity</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required /></div>
                  <div><Label>Unit</Label>
                    <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{units.map(u => <SelectItem key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Image upload */}
                <div>
                  <Label>Product Image</Label>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  {imagePreview ? (
                    <div className="relative mt-2">
                      <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg border" />
                      <Button type="button" size="sm" variant="destructive" className="absolute top-2 right-2" onClick={() => { setImagePreview(null); setForm(f => ({ ...f, image_url: "" })); }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                    >
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Click to upload image"}</p>
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={uploading}>{editingProduct ? "Update" : "Add"} Product</Button>
              </form>
            </DialogContent>
          </Dialog>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map(p => (
              <Card key={p.id}>
                {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-40 object-cover rounded-t-lg" />}
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{p.name}</h3>
                    <Badge variant={statusColor(p.status)}>{p.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{p.description}</p>
                  <p className="font-bold text-primary">UGX {p.price.toLocaleString()}/{p.unit}</p>
                  <p className="text-sm text-muted-foreground">Stock: {p.quantity} {p.unit}</p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(p.id)}>Delete</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell>{o.product_name || "—"}</TableCell>
                  <TableCell>{o.buyer_name || "—"}</TableCell>
                  <TableCell>{o.quantity}</TableCell>
                  <TableCell>UGX {o.total_price.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="outline">{(o as any).payment_method === "cash_on_delivery" ? "Cash" : "MoMo"}</Badge></TableCell>
                  <TableCell><Badge variant={o.status === "delivered" ? "default" : "secondary"}>{o.status}</Badge></TableCell>
                  <TableCell>
                    {o.status === "pending" && <Button size="sm" onClick={() => handleUpdateOrderStatus(o.id, "confirmed")}>Confirm</Button>}
                    {o.status === "confirmed" && <Button size="sm" onClick={() => handleUpdateOrderStatus(o.id, "delivered")}>Delivered</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No orders yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <h3 className="text-lg font-semibold mb-3">Buyer Feedback on Your Products</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.product_name || "—"}</TableCell>
                  <TableCell>{r.buyer_name || "—"}</TableCell>
                  <TableCell>{"⭐".repeat(r.rating)}</TableCell>
                  <TableCell>{r.comment || "—"}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
              {reviews.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No reviews yet</TableCell></TableRow>}
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
    </div>
  );
}
