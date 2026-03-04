import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Leaf, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <Leaf className="h-6 w-6 text-primary" />
          <span className="font-serif text-xl">Kabale Market</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              {role === "buyer" && (
                <Link to="/products">
                  <Button variant="ghost">Browse Products</Button>
                </Link>
              )}
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost">Sign In</Button></Link>
              <Link to="/register"><Button>Get Started</Button></Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t bg-card px-4 py-3 space-y-2">
          {user ? (
            <>
              <Link to="/dashboard" onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
              </Link>
              {role === "buyer" && (
                <Link to="/products" onClick={() => setOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start">Browse Products</Button>
                </Link>
              )}
              <Button variant="outline" className="w-full" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full">Sign In</Button>
              </Link>
              <Link to="/register" onClick={() => setOpen(false)}>
                <Button className="w-full">Get Started</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
