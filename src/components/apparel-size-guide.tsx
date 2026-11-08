import { Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import chart from "@/assets/catalog/apparel-size-guide.jpg.asset.json";

export function ApparelSizeGuide() {
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline" size="sm"><Ruler className="mr-2 size-4" />Size guide</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl overflow-auto border-white/10 bg-ink p-4 text-ink-foreground">
      <DialogTitle className="font-display uppercase tracking-wide">Jerseys & T-shirts — Size guide</DialogTitle>
      <DialogDescription className="text-ink-foreground/60">Chest and length in CM / Inches. Available sizes: XS–5XL.</DialogDescription>
      <a href={chart.url} target="_blank" rel="noopener noreferrer" aria-label="Open full-resolution size chart"><img src={chart.url} alt="Standard apparel size guide: chest and length measurements in centimeters and inches, XS to 5XL" className="w-full rounded-md" /></a>
    </DialogContent>
  </Dialog>;
}
