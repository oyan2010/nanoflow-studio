import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  Image as ImageIcon, 
  Layers, 
  Download, 
  RefreshCw, 
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  X,
  Play,
  RectangleHorizontal,
  Square,
  RectangleVertical
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JSZip from "jszip";

type AspectRatio = "16:9" | "1:1" | "9:16";

interface GeneratedImage {
  id: number;
  prompt: string;
  status: "pending" | "generating" | "done" | "error";
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
}

const BATCH_CONCURRENCY = 80;

export default function ImageStudio() {
  const [singlePrompt, setSinglePrompt] = useState("");
  const [batchPrompts, setBatchPrompts] = useState("");
  const [consistencyMode, setConsistencyMode] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const generateImage = async (
    prompt: string, 
    useConsistency: boolean,
    ratio: AspectRatio
  ): Promise<{ imageBase64: string; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt,
          aspectRatio: ratio,
          useConsistency
        }
      });

      if (error) {
        console.error("Edge function error:", error);
        return { imageBase64: "", error: error.message };
      }

      if (data.error) {
        return { imageBase64: "", error: data.error };
      }

      return { imageBase64: data.imageBase64 };
    } catch (err: any) {
      console.error("Generate error:", err);
      return { imageBase64: "", error: err.message || "Generation failed" };
    }
  };

  const handleSingleGenerate = async () => {
    if (!singlePrompt.trim()) return;
    setIsGenerating(true);
    
    setGeneratedImages([{
      id: 1,
      prompt: singlePrompt,
      status: "generating"
    }]);
    
    const result = await generateImage(singlePrompt, consistencyMode, aspectRatio);
    
    if (result.error) {
      setGeneratedImages([{
        id: 1,
        prompt: singlePrompt,
        status: "error",
        error: result.error
      }]);
      toast.error(result.error);
    } else {
      const imageUrl = `data:image/png;base64,${result.imageBase64}`;
      setGeneratedImages([{
        id: 1,
        prompt: singlePrompt,
        status: "done",
        imageUrl,
        imageBase64: result.imageBase64
      }]);
      toast.success("Image generated successfully!");
    }
    
    setIsGenerating(false);
  };

  const handleBatchGenerate = async () => {
    const prompts = batchPrompts.split("\n").filter(p => p.trim()).slice(0, 200);
    if (prompts.length === 0) return;
    
    setIsGenerating(true);
    const images: GeneratedImage[] = prompts.map((prompt, i) => ({
      id: i + 1,
      prompt: prompt.trim(),
      status: "pending" as const
    }));
    setGeneratedImages(images);

    // Process images with concurrent batches
    const processBatch = async (startIdx: number) => {
      const batch = prompts.slice(startIdx, startIdx + BATCH_CONCURRENCY);
      
      await Promise.all(batch.map(async (prompt, batchIdx) => {
        const actualIdx = startIdx + batchIdx;
        
        // Update status to generating
        setGeneratedImages(prev => prev.map(p => 
          p.id === actualIdx + 1 ? { ...p, status: "generating" as const } : p
        ));

        const result = await generateImage(prompt.trim(), consistencyMode, aspectRatio);

        if (result.error) {
          setGeneratedImages(prev => prev.map(p => 
            p.id === actualIdx + 1 
              ? { ...p, status: "error" as const, error: result.error } 
              : p
          ));
        } else {
          const imageUrl = `data:image/png;base64,${result.imageBase64}`;
          setGeneratedImages(prev => prev.map(p => 
            p.id === actualIdx + 1 
              ? { 
                  ...p, 
                  status: "done" as const, 
                  imageUrl,
                  imageBase64: result.imageBase64
                } 
              : p
          ));
        }
      }));
    };

    // Process all batches
    for (let i = 0; i < prompts.length; i += BATCH_CONCURRENCY) {
      await processBatch(i);
    }
    
    setIsGenerating(false);
    toast.success("Batch generation complete!");
  };

  const handleRetryFailed = async () => {
    const failed = generatedImages.filter(img => img.status === "error");
    
    // Retry with concurrent batches too
    for (let i = 0; i < failed.length; i += BATCH_CONCURRENCY) {
      const batch = failed.slice(i, i + BATCH_CONCURRENCY);
      
      await Promise.all(batch.map(async (img) => {
        setGeneratedImages(prev => prev.map(p => 
          p.id === img.id ? { ...p, status: "generating" as const, error: undefined } : p
        ));

        const result = await generateImage(img.prompt, consistencyMode, aspectRatio);

        if (result.error) {
          setGeneratedImages(prev => prev.map(p => 
            p.id === img.id 
              ? { ...p, status: "error" as const, error: result.error } 
              : p
          ));
        } else {
          const imageUrl = `data:image/png;base64,${result.imageBase64}`;
          setGeneratedImages(prev => prev.map(p => 
            p.id === img.id 
              ? { 
                  ...p, 
                  status: "done" as const, 
                  imageUrl,
                  imageBase64: result.imageBase64,
                  error: undefined
                } 
              : p
          ));
        }
      }));
    }
    
    toast.success("Retry complete!");
  };

  const handleDownloadSingle = (img: GeneratedImage) => {
    if (!img.imageBase64) return;
    
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${img.imageBase64}`;
    link.download = `image_${img.id}.png`;
    link.click();
  };

  const handleDownloadAll = async () => {
    const completedImages = generatedImages.filter(img => img.status === "done" && img.imageBase64);
    if (completedImages.length === 0) return;

    try {
      const zip = new JSZip();
      
      completedImages.forEach((img, i) => {
        if (img.imageBase64) {
          zip.file(`image_${i + 1}.png`, img.imageBase64, { base64: true });
        }
      });

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = "generated_images.zip";
      link.click();
      
      toast.success("Images downloaded!");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to create zip file");
    }
  };

  const successCount = generatedImages.filter(i => i.status === "done").length;
  const errorCount = generatedImages.filter(i => i.status === "error").length;
  const pendingCount = generatedImages.filter(i => i.status === "pending" || i.status === "generating").length;

  return (
    <Layout>
      <div className="container px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1 className="font-display text-3xl font-bold mb-2">Image Studio</h1>
          <p className="text-muted-foreground">
            Generate stunning AI images with single or batch processing
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel - Controls */}
          <div className="space-y-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <Tabs defaultValue="single" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="single" className="gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Single Image
                </TabsTrigger>
                <TabsTrigger value="batch" className="gap-2">
                  <Layers className="w-4 h-4" />
                  Batch Generation
                </TabsTrigger>
              </TabsList>

              <TabsContent value="single" className="space-y-4">
                <div className="glass rounded-xl p-6 space-y-4">
                  <Label htmlFor="single-prompt">Enter your prompt</Label>
                  <Textarea
                    id="single-prompt"
                    placeholder="A majestic mountain landscape at sunset with golden clouds..."
                    value={singlePrompt}
                    onChange={(e) => setSinglePrompt(e.target.value)}
                    className="min-h-[120px] resize-none"
                  />
                  
                  {/* Aspect Ratio Selection */}
                  <div className="space-y-2">
                    <Label>Aspect Ratio</Label>
                    <ToggleGroup 
                      type="single" 
                      value={aspectRatio} 
                      onValueChange={(v) => v && setAspectRatio(v as AspectRatio)}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="16:9" aria-label="Landscape 16:9" className="gap-2">
                        <RectangleHorizontal className="w-4 h-4" />
                        16:9
                      </ToggleGroupItem>
                      <ToggleGroupItem value="1:1" aria-label="Square 1:1" className="gap-2">
                        <Square className="w-4 h-4" />
                        1:1
                      </ToggleGroupItem>
                      <ToggleGroupItem value="9:16" aria-label="Portrait 9:16" className="gap-2">
                        <RectangleVertical className="w-4 h-4" />
                        9:16
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                  
                  {/* Consistency Toggle for single */}
                  <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
                    <div className="space-y-0.5">
                      <Label htmlFor="consistency-single">Consistency Mode</Label>
                      <p className="text-xs text-muted-foreground">
                        Use fixed seed for reproducible results
                      </p>
                    </div>
                    <Switch
                      id="consistency-single"
                      checked={consistencyMode}
                      onCheckedChange={setConsistencyMode}
                    />
                  </div>
                  
                  <Button 
                    variant="hero" 
                    className="w-full gap-2"
                    onClick={handleSingleGenerate}
                    disabled={isGenerating || !singlePrompt.trim()}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Generate Image
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="batch" className="space-y-4">
                <div className="glass rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="batch-prompts">Enter prompts (one per line, max 200)</Label>
                    <span className="text-xs text-muted-foreground">
                      {batchPrompts.split("\n").filter(p => p.trim()).length} / 200 prompts
                    </span>
                  </div>
                  <Textarea
                    id="batch-prompts"
                    placeholder="A serene beach at sunrise&#10;A bustling city street at night&#10;A peaceful forest path in autumn..."
                    value={batchPrompts}
                    onChange={(e) => setBatchPrompts(e.target.value)}
                    className="min-h-[200px] resize-none font-mono text-sm"
                  />
                  
                  {/* Aspect Ratio Selection */}
                  <div className="space-y-2">
                    <Label>Aspect Ratio</Label>
                    <ToggleGroup 
                      type="single" 
                      value={aspectRatio} 
                      onValueChange={(v) => v && setAspectRatio(v as AspectRatio)}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="16:9" aria-label="Landscape 16:9" className="gap-2">
                        <RectangleHorizontal className="w-4 h-4" />
                        16:9
                      </ToggleGroupItem>
                      <ToggleGroupItem value="1:1" aria-label="Square 1:1" className="gap-2">
                        <Square className="w-4 h-4" />
                        1:1
                      </ToggleGroupItem>
                      <ToggleGroupItem value="9:16" aria-label="Portrait 9:16" className="gap-2">
                        <RectangleVertical className="w-4 h-4" />
                        9:16
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {/* Consistency Toggle */}
                  <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50">
                    <div className="space-y-0.5">
                      <Label htmlFor="consistency">Consistency Mode</Label>
                      <p className="text-xs text-muted-foreground">
                        Use fixed seed for all images
                      </p>
                    </div>
                    <Switch
                      id="consistency"
                      checked={consistencyMode}
                      onCheckedChange={setConsistencyMode}
                    />
                  </div>

                  <Button 
                    variant="hero" 
                    className="w-full gap-2"
                    onClick={handleBatchGenerate}
                    disabled={isGenerating || !batchPrompts.trim()}
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Start Batch Generation
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            {generatedImages.length > 0 && (
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={handleRetryFailed}
                  disabled={errorCount === 0 || isGenerating}
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry Failed ({errorCount})
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 gap-2"
                  onClick={handleDownloadAll}
                  disabled={successCount === 0}
                >
                  <Download className="w-4 h-4" />
                  Download All
                </Button>
              </div>
            )}
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-4 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            {/* Stats */}
            {generatedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-primary">{successCount}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-chart-4">{pendingCount}</div>
                  <div className="text-xs text-muted-foreground">Processing</div>
                </div>
                <div className="glass rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-destructive">{errorCount}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            )}

            {/* Image Grid */}
            <div className="glass rounded-xl p-4 min-h-[400px]">
              {generatedImages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-1">No images yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate your first image to get started
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {generatedImages.map((img) => (
                    <div
                      key={img.id}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-300",
                        img.status === "done" && "border-primary/50 cursor-pointer hover:border-primary",
                        img.status === "generating" && "border-chart-4/50",
                        img.status === "pending" && "border-border",
                        img.status === "error" && "border-destructive/50"
                      )}
                      onClick={() => img.status === "done" && img.imageUrl && setPreviewImage(img.imageUrl)}
                    >
                      {img.status === "done" && img.imageUrl ? (
                        <>
                          <img 
                            src={img.imageUrl} 
                            alt={img.prompt}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end p-2">
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="glass" 
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage(img.imageUrl!);
                                }}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="glass" 
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadSingle(img);
                                }}
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="absolute top-2 right-2">
                            <CheckCircle className="w-5 h-5 text-primary" />
                          </div>
                        </>
                      ) : img.status === "error" ? (
                        <div className="w-full h-full bg-destructive/10 flex flex-col items-center justify-center p-2">
                          <XCircle className="w-6 h-6 text-destructive mb-1" />
                          <span className="text-xs text-destructive text-center line-clamp-2">{img.error || "Failed"}</span>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-muted flex flex-col items-center justify-center gap-2">
                          <Loader2 className={cn(
                            "w-6 h-6 text-muted-foreground",
                            img.status === "generating" && "animate-spin text-primary"
                          )} />
                          <span className="text-xs text-muted-foreground">
                            {img.status === "generating" ? "Generating..." : "Pending"}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl w-full animate-scale-in">
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute -top-12 right-0"
              onClick={() => setPreviewImage(null)}
            >
              <X className="w-6 h-6" />
            </Button>
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-full rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </Layout>
  );
}
