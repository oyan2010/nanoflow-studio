import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface VideoPreviewModalProps {
  videoBase64: string;
  onClose: () => void;
}

export function VideoPreviewModal({ videoBase64, onClose }: VideoPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-primary-foreground hover:bg-primary-foreground/10"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </Button>
      <video
        src={videoBase64.startsWith("http") ? videoBase64 : `data:video/mp4;base64,${videoBase64}`}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg animate-scale-in"
        controls
        autoPlay
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
