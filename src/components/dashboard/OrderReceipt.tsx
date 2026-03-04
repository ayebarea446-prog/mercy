import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Printer } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface OrderReceiptProps {
  order: (Order & { product_name?: string; farmer_name?: string }) | null;
  buyerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OrderReceipt({ order, buyerName, open, onOpenChange }: OrderReceiptProps) {
  if (!order) return null;

  const handlePrint = () => {
    const printContent = document.getElementById("receipt-content");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 40px auto; padding: 20px; }
        h2 { text-align: center; margin-bottom: 4px; }
        .subtitle { text-align: center; color: #666; font-size: 14px; margin-bottom: 20px; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .row.bold { font-weight: bold; font-size: 16px; }
        hr { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 24px; }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const date = new Date(order.created_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Order Receipt</DialogTitle>
        </DialogHeader>

        <div id="receipt-content" className="space-y-3">
          <div className="text-center">
            <h2 className="text-lg font-bold">🧾 FarmConnect</h2>
            <p className="subtitle text-xs text-muted-foreground">Order Receipt</p>
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1 text-sm">
            <div className="row flex justify-between"><span className="text-muted-foreground">Receipt #</span><span className="font-mono">{order.id.slice(0, 8).toUpperCase()}</span></div>
            <div className="row flex justify-between"><span className="text-muted-foreground">Date</span><span>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="row flex justify-between"><span className="text-muted-foreground">Buyer</span><span>{buyerName}</span></div>
            {order.farmer_name && (
              <div className="row flex justify-between"><span className="text-muted-foreground">Farmer</span><span>{order.farmer_name}</span></div>
            )}
          </div>

          <Separator className="border-dashed" />

          <div className="space-y-1 text-sm">
            <div className="row flex justify-between"><span>{order.product_name || "Product"}</span><span>× {order.quantity}</span></div>
          </div>

          <Separator className="border-dashed" />

          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>UGX {order.total_price.toLocaleString()}</span>
          </div>

          <div className="space-y-1 text-sm">
            <div className="row flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span>{order.payment_method === "cash_on_delivery" ? "Cash on Delivery" : "Mobile Money"}</span>
            </div>
            {order.payment_method === "mobile_money" && order.payment_phone && (
              <div className="row flex justify-between"><span className="text-muted-foreground">Phone</span><span>{order.payment_phone}</span></div>
            )}
            <div className="row flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="capitalize font-medium">{order.status}</span>
            </div>
          </div>

          <Separator className="border-dashed" />

          <p className="footer text-center text-xs text-muted-foreground">Thank you for shopping with FarmConnect!</p>
        </div>

        <Button onClick={handlePrint} className="w-full gap-2 mt-2">
          <Printer className="h-4 w-4" /> Print Receipt
        </Button>
      </DialogContent>
    </Dialog>
  );
}
