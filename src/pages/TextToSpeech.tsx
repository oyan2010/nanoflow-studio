import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Play, Loader2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Voice {
  id: string;
  name: string;
}

export default function TextToSpeech() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchVoices() {
      try {
        const { data, error } = await supabase.functions.invoke("generate-voice", {
          body: { action: "list" },
        });

        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || "Failed to fetch voices");
        }

        setVoices(data.voices || []);
        if (data.voices && data.voices.length > 0) {
          setVoice(data.voices[0].id);
        }
      } catch (err: any) {
        console.error("Error fetching voices:", err);
        toast({ title: "Failed to load voices", description: err.message, variant: "destructive" });
      } finally {
        setIsLoadingVoices(false);
      }
    }
    fetchVoices();
  }, [toast]);

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({ title: "Text required", description: "Please enter some text.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setAudioUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-voice", {
        body: { text, voice },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Failed to generate voice");
      }

      setAudioUrl(data.audioUrl);
      toast({ title: "Success!", description: "Audio generated successfully." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Layout>
      <div className="container px-4 py-8 max-w-4xl mx-auto">
        <div className="mb-8 text-center animate-fade-up">
          <h1 className="font-display text-4xl font-bold mb-4">AI Text to Speech</h1>
          <p className="text-muted-foreground">Convert your text into natural-sounding speech</p>
        </div>

        <div className="glass rounded-2xl p-6 md:p-8 space-y-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Voice Selection</label>
                <Select value={voice} onValueChange={setVoice}>
                  <SelectTrigger className="bg-background/50 h-12">
                    <SelectValue placeholder="Select a voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Your Text (max 15,000 chars)</label>
              <Textarea
                placeholder="Enter the text you want to convert to speech..."
                className="min-h-[200px] resize-none bg-background/50"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={15000}
              />
              <div className="text-right mt-2 text-xs text-muted-foreground">
                {text.length} / 15,000
              </div>
            </div>
          </div>

          <Button
            variant="hero"
            className="w-full h-12 gap-2"
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Audio...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Generate Speech
              </>
            )}
          </Button>

          {audioUrl && (
            <div className="mt-8 p-6 rounded-xl bg-muted/30 border border-border animate-fade-in text-center">
              <h3 className="font-medium mb-4">Your Audio is Ready</h3>
              <audio src={audioUrl} controls className="w-full max-w-md mx-auto mb-6" />
              
              <Button variant="outline" className="gap-2" onClick={() => window.open(audioUrl, "_blank")}>
                <Download className="w-4 h-4" />
                Download MP3
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
