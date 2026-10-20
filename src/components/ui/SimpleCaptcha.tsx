import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";

interface SimpleCaptchaProps {
    onVerify: (isValid: boolean) => void;
    isVerified: boolean;
}

export function SimpleCaptcha({ onVerify, isVerified }: SimpleCaptchaProps) {
    const [num1, setNum1] = useState(0);
    const [num2, setNum2] = useState(0);
    const [userAnswer, setUserAnswer] = useState("");
    const [error, setError] = useState("");

    const generateCaptcha = () => {
        setNum1(Math.floor(Math.random() * 10) + 1);
        setNum2(Math.floor(Math.random() * 10) + 1);
        setUserAnswer("");
        setError("");
        onVerify(false);
    };

    useEffect(() => {
        generateCaptcha();
    }, []);

    const handleVerify = () => {
        const correctAnswer = num1 + num2;
        const answer = parseInt(userAnswer);

        if (answer === correctAnswer) {
            onVerify(true);
            setError("");
        } else {
            setError("Incorrect answer. Please try again.");
            onVerify(false);
            generateCaptcha();
        }
    };

    if (isVerified) {
        return (
            <div className="p-4 rounded-xl bg-chart-2/10 border border-chart-2/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-chart-2 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <span className="text-sm font-medium text-chart-2">Verified</span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateCaptcha}
                    className="h-8 text-muted-foreground"
                >
                    Reset
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <Label>Security Verification</Label>
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex-1 text-center">
                        <div
                            className="text-2xl font-mono font-bold select-none bg-gradient-to-br from-primary to-purple-600 bg-clip-text text-transparent"
                            style={{ userSelect: "none", WebkitUserSelect: "none" }}
                            onCopy={(e) => e.preventDefault()}
                            onCut={(e) => e.preventDefault()}
                        >
                            {num1} + {num2} = ?
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={generateCaptcha}
                        className="h-8 w-8 rounded-lg"
                        title="Generate new question"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Input
                        type="number"
                        placeholder="Your answer"
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === "Enter") {
                                handleVerify();
                            }
                        }}
                        className="h-10 text-center"
                        autoComplete="off"
                    />
                    <Button
                        onClick={handleVerify}
                        disabled={!userAnswer}
                        className="h-10 px-6"
                    >
                        Verify
                    </Button>
                </div>

                {error && (
                    <p className="text-xs text-destructive mt-2 animate-fade-in">{error}</p>
                )}
            </div>

            <p className="text-xs text-muted-foreground">
                Solve the simple math problem to continue
            </p>
        </div>
    );
}
