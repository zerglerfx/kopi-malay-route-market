import { useState } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { imageFor } from "@/lib/shop";

export function ProductImageViewer({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const gallery = Array.from(new Set(images.length ? images : [""]));
  return <div>
    <Button variant="ghost" aria-label={`Zoom photo of ${name}`} onClick={() => setOpen(true)} className="relative block aspect-square h-auto w-full overflow-hidden rounded-lg border bg-muted p-0 hover:bg-muted">
      <img src={imageFor(gallery[index])} alt={name} width={1024} height={1024} className="size-full object-contain" />
      <span className="absolute bottom-3 right-3 rounded-md bg-card p-2 text-foreground"><ZoomIn className="size-5" /></span>
    </Button>
    {gallery.length > 1 && <div className="mt-3 flex flex-wrap gap-2">{gallery.map((g, i) => <Button key={g} variant="outline" aria-label={`View photo ${i + 1}`} aria-pressed={i === index} onClick={() => setIndex(i)} className={`size-20 overflow-hidden p-0 ${i === index ? "border-primary" : ""}`}><img src={imageFor(g)} alt="" className="size-full object-contain" /></Button>)}</div>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-5xl gap-3 p-4">
        <DialogTitle className="pr-8 text-base">{name}</DialogTitle>
        <DialogDescription className="sr-only">Detailed product photo</DialogDescription>
        <TransformWrapper key={index} initialScale={1} minScale={1} maxScale={6}>
          {({ zoomIn, zoomOut, resetTransform }) => <>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" aria-label="Zoom in" title="Zoom in" onClick={() => zoomIn()}><ZoomIn className="size-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Zoom out" title="Zoom out" onClick={() => zoomOut()}><ZoomOut className="size-4" /></Button>
              <Button variant="outline" size="icon" aria-label="Reset zoom" title="Reset zoom" onClick={() => resetTransform()}><RotateCcw className="size-4" /></Button>
              {gallery.length > 1 && <><Button variant="outline" size="icon" aria-label="Previous photo" onClick={() => setIndex((index + gallery.length - 1) % gallery.length)}><ChevronLeft className="size-4" /></Button><span className="text-sm">{index + 1} / {gallery.length}</span><Button variant="outline" size="icon" aria-label="Next photo" onClick={() => setIndex((index + 1) % gallery.length)}><ChevronRight className="size-4" /></Button></>}
            </div>
            <TransformComponent wrapperClass="!w-full !h-[min(65vh,700px)] bg-muted" contentClass="!w-full !h-full">
              <img src={imageFor(gallery[index])} alt={name} className="size-full object-contain" draggable={false} />
            </TransformComponent>
          </>}
        </TransformWrapper>
      </DialogContent>
    </Dialog>
  </div>;
}