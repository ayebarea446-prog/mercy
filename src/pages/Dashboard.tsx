import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import FarmerDashboard from "@/components/dashboard/FarmerDashboard";
import BuyerDashboard from "@/components/dashboard/BuyerDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import Navbar from "@/components/Navbar";

export default function Dashboard() {
  const { user, role, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6">
        {role === "farmer" && <FarmerDashboard />}
        {role === "buyer" && <BuyerDashboard />}
        {role === "admin" && <AdminDashboard />}
        {!role && <p className="text-center text-muted-foreground py-10">Loading your dashboard...</p>}
      </div>
    </div>
  );
}
