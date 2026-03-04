import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Users, Package, ShoppingCart, MessageSquare, BarChart3, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type Order = Database["public"]["Tables"]["orders"]["Row"];

const COLORS = ["hsl(142,44%,32%)", "hsl(33,80%,55%)", "hsl(200,70%,50%)", "hsl(0,84%,60%)", "hsl(280,60%,50%)"];

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  const fetchAll = async () => {
    const [profilesRes, rolesRes, prodsRes, ordersRes, reviewsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
    ]);
    if (profilesRes.data && rolesRes.data) {
      const merged = profilesRes.data.map(p => ({
        ...p,
        user_roles: rolesRes.data.filter(r => r.user_id === p.user_id),
      }));
      setUsers(merged);
    }
    if (prodsRes.data) setProducts(prodsRes.data);
    if (ordersRes.data) setOrders(ordersRes.data);
    if (reviewsRes.data && profilesRes.data && prodsRes.data) {
      const enrichedReviews = reviewsRes.data.map(r => {
        const buyer = profilesRes.data?.find(p => p.user_id === r.buyer_id);
        const product = prodsRes.data?.find(p => p.id === r.product_id);
        const farmer = product ? profilesRes.data?.find(p => p.user_id === product.farmer_id) : null;
        return { ...r, buyer_name: buyer?.full_name, product_name: product?.name, farmer_name: farmer?.full_name };
      });
      setReviews(enrichedReviews);
    } else if (reviewsRes.data) {
      setReviews(reviewsRes.data);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleToggleActive = async (userId: string, current: boolean) => {
    await supabase.from("profiles").update({ is_active: !current }).eq("user_id", userId);
    toast({ title: `User ${current ? "blocked" : "unblocked"} successfully` });
    fetchAll();
  };

  const handleChangeRole = async (userId: string, currentRole: string, newRole: Database["public"]["Enums"]["app_role"]) => {
    if (currentRole === newRole) return;
    const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
    if (error) {
      toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Role changed to ${newRole}` });
      fetchAll();
    }
  };

  const handleProductStatus = async (id: string, status: Database["public"]["Enums"]["product_status"]) => {
    await supabase.from("products").update({ status }).eq("id", id);
    toast({ title: `Product ${status}` });
    fetchAll();
  };

  const handleDeleteReview = async (id: string) => {
    await supabase.from("reviews").delete().eq("id", id);
    toast({ title: "Review removed" });
    fetchAll();
  };

  const handleDeleteUser = async (userId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const res = await supabase.functions.invoke("delete-user", {
      body: { user_id: userId },
    });
    if (res.error) {
      toast({ title: "Failed to delete user", description: res.error.message, variant: "destructive" });
    } else {
      toast({ title: "User permanently deleted" });
      fetchAll();
    }
  };

  const handleOrderStatus = async (id: string, status: Database["public"]["Enums"]["order_status"]) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    toast({ title: `Order ${status}` });
    fetchAll();
  };

  // Stats
  const totalRevenue = orders.reduce((sum, o) => sum + o.total_price, 0);
  const ordersByStatus = ["pending", "confirmed", "delivered", "cancelled"].map(s => ({
    name: s, count: orders.filter(o => o.status === s).length,
  }));
  const productsByCategory = ["vegetables", "fruits", "grains", "dairy", "livestock"].map(c => ({
    name: c, count: products.filter(p => p.category === c).length,
  }));

  return (
    <div className="min-h-screen rounded-2xl bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100 p-6">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Admin Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{users.length}</p><p className="text-sm text-muted-foreground">Users</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{products.length}</p><p className="text-sm text-muted-foreground">Products</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">{orders.length}</p><p className="text-sm text-muted-foreground">Orders</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><p className="text-2xl font-bold">UGX {totalRevenue.toLocaleString()}</p><p className="text-sm text-muted-foreground">Revenue</p></CardContent></Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users" className="gap-1"><Users className="h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="products" className="gap-1"><Package className="h-4 w-4" /> Products</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1"><ShoppingCart className="h-4 w-4" /> Orders</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-1"><MessageSquare className="h-4 w-4" /> Reviews</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1"><BarChart3 className="h-4 w-4" /> Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Location</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name || "—"}</TableCell>
                  <TableCell>{u.phone || "—"}</TableCell>
                  <TableCell>{u.location || "—"}</TableCell>
                  <TableCell>
                    <Select
                      defaultValue={u.user_roles?.[0]?.role || "buyer"}
                      onValueChange={(val) => handleChangeRole(u.user_id, u.user_roles?.[0]?.role, val as Database["public"]["Enums"]["app_role"])}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="farmer">Farmer</SelectItem>
                        <SelectItem value="buyer">Buyer</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Badge variant={u.is_active ? "default" : "destructive"}>{u.is_active ? "Active" : "Blocked"}</Badge></TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(u.user_id, u.is_active)}>
                      {u.is_active ? "Block" : "Unblock"}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User Permanently?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove <strong>{u.full_name || "this user"}</strong> and all their data. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteUser(u.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete Forever
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {products.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="capitalize">{p.category}</TableCell>
                  <TableCell>UGX {p.price.toLocaleString()}</TableCell>
                  <TableCell><Badge variant={p.status === "approved" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>{p.status}</Badge></TableCell>
                  <TableCell className="space-x-2">
                    {p.status !== "approved" && <Button size="sm" onClick={() => handleProductStatus(p.id, "approved")}>Approve</Button>}
                    {p.status !== "rejected" && <Button size="sm" variant="destructive" onClick={() => handleProductStatus(p.id, "rejected")}>Reject</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Table>
            <TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>Farmer</TableHead><TableHead>Qty</TableHead><TableHead>Total</TableHead><TableHead>Pickup Station</TableHead><TableHead>Status</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {orders.map(o => {
                const farmer = users.find(u => u.user_id === o.farmer_id);
                return (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}...</TableCell>
                  <TableCell>{farmer?.full_name || "Unknown"}</TableCell>
                  <TableCell>{o.quantity}</TableCell>
                  <TableCell>UGX {o.total_price.toLocaleString()}</TableCell>
                  <TableCell>{(o as any).pickup_station || "—"}</TableCell>
                  <TableCell><Badge variant={o.status === "delivered" ? "default" : o.status === "cancelled" ? "destructive" : "secondary"}>{o.status}</Badge></TableCell>
                  <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="space-x-1">
                    {o.status === "pending" && <Button size="sm" onClick={() => handleOrderStatus(o.id, "confirmed")}>Confirm</Button>}
                    {o.status === "confirmed" && <Button size="sm" onClick={() => handleOrderStatus(o.id, "delivered")}>Deliver</Button>}
                    {o.status !== "cancelled" && o.status !== "delivered" && <Button size="sm" variant="destructive" onClick={() => handleOrderStatus(o.id, "cancelled")}>Cancel</Button>}
                  </TableCell>
                </TableRow>
                );
              })}
              {orders.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No orders</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Buyer</TableHead><TableHead>Farmer</TableHead><TableHead>Rating</TableHead><TableHead>Comment</TableHead><TableHead>Date</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {reviews.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.product_name || "—"}</TableCell>
                  <TableCell>{r.buyer_name || "—"}</TableCell>
                  <TableCell>{r.farmer_name || "—"}</TableCell>
                  <TableCell>{"⭐".repeat(r.rating)}</TableCell>
                  <TableCell>{r.comment || "—"}</TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Button size="sm" variant="destructive" onClick={() => handleDeleteReview(r.id)}>Remove</Button></TableCell>
                </TableRow>
              ))}
              {reviews.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No reviews</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Orders by Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={ordersByStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(142,44%,32%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">Products by Category</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={productsByCategory} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {productsByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
