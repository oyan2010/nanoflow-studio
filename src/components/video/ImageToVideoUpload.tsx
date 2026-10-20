import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Loader2 } from "lucide-react";

interface ImageToVideoUploadProps {
    onGenerate: (imageBase64: string, prompt: string) => void;
    isGenerating: boolean;
}

export function ImageToVideoUpload({ onGenerate, isGenerating }: ImageToVideoUploadProps) {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");
    const [prompt, setPrompt] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith("image/")) {
            alert("Please select a valid image file");
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert("Image size must be less than 10MB");
            return;
        }

        setImageFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onload = (event) => {
            setImagePreview(event.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveImage = () => {
        setImageFile(null);
        setImagePreview("");
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleGenerate = async () => {
        if (!imageFile || !prompt.trim()) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = (event.target?.result as string).split(",")[1];
            onGenerate(base64, prompt);
        };
        reader.readAsDataURL(imageFile);
    };

    return (
        <div className="glass rounded-xl p-6 space-y-4">
            <div>
                <Label htmlFor="image-upload">Upload Image</Label>
                <div className="mt-2">
                    {imagePreview ? (
                        <div className="relative">
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="w-full h-48 object-cover rounded-lg"
                            />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2"
                                onClick={handleRemoveImage}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                        >
                            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Click to upload image
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                PNG, JPG up to 10MB
                            </p>
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                </div>
            </div>

            <div>
                <Label htmlFor="animation-prompt">Animation Prompt</Label>
                <Textarea
                    id="animation-prompt"
                    placeholder="Describe how you want to animate this image..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="min-h-[100px] resize-none mt-2"
                />
            </div>

            <Button
                variant="hero"
                className="w-full gap-2"
                onClick={handleGenerate}
                disabled={!imageFile || !prompt.trim() || isGenerating}
            >
                {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Upload className="w-4 h-4" />
                )}
                Animate Image
            </Button>

            <p className="text-xs text-muted-foreground text-center">
                Upload an image and describe the animation. Video generation takes 1-2 minutes.
            </p>
        </div>
    );
}
