import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import { Leaf, ShoppingBasket, Truck, Star, ArrowRight } from "lucide-react";

const categories = [
  { name: "Vegetables", emoji: "🥬" },
  { name: "Fruits", emoji: "🍌" },
  { name: "Grains", emoji: "🌾" },
  { name: "Dairy", emoji: "🥛" },
  { name: "Livestock", emoji: "🐄" },
];

const steps = [
  { icon: Leaf, title: "Farmers List Products", desc: "Local farmers upload fresh produce with prices and photos." },
  { icon: ShoppingBasket, title: "Buyers Browse & Order", desc: "Browse by category, place orders, and pay via Mobile Money." },
  { icon: Truck, title: "Fresh Delivery", desc: "Farmers confirm and deliver directly to buyers in Kabale." },
  { icon: Star, title: "Rate & Review", desc: "Buyers leave feedback to help the community grow." },
];

export default function Index() {
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Leaf className="h-4 w-4" /> Fresh from Kabale farms
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
              Farm Fresh Produce,{" "}
              <span className="text-primary">Directly to You</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Connect with local farmers in Kabale, Uganda. Buy fresh vegetables, fruits, grains, dairy and livestock — all in one marketplace.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg" className="gap-2">
                  Join as Buyer <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="outline" className="gap-2">
                  Sell as Farmer <Leaf className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10">Shop by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categories.map(c => (
              <Link to="/products" key={c.name}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer text-center">
                  <CardContent className="pt-6 pb-4">
                    <span className="text-4xl block mb-2">{c.emoji}</span>
                    <span className="font-semibold">{c.name}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <s.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2 font-serif">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="mb-8 opacity-90 max-w-md mx-auto">Join hundreds of farmers and buyers in Kabale's largest online marketplace.</p>
          <Link to="/register">
            <Button size="lg" variant="secondary" className="gap-2">
              Create Free Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t text-center text-sm text-muted-foreground">
        <p>© 2026 Kabale Farmers' Market. Built with ❤️ for local farmers.</p>
      </footer>
    </div>
  );
}
