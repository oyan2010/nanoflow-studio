import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedIcon } from "@/components/ui/AnimatedIcon";
import { Layout } from "@/components/layout/Layout";
import {
  Sparkles,
  Image,
  Video,
  Zap,
  Shield,
  ArrowRight,
  Play,
  Check,
  Star,
  Crown,
  Mail,
  Phone
} from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Image,
    preset: "float-subtle",
    title: "Image Studio",
    description: "Generate stunning AI images with single or batch processing up to 200 prompts at once.",
    link: "/image-studio"
  },
  {
    icon: Video,
    preset: "pulse-glow",
    title: "Video Generation",
    description: "Transform your prompts or images into captivating AI-powered videos.",
    link: "/video-gen"
  },
  {
    icon: Zap,
    preset: "bounce-soft",
    title: "Batch Processing",
    description: "Process hundreds of prompts simultaneously with smart queue management.",
    link: "/image-studio"
  },
  {
    icon: Shield,
    preset: "pulse-glow",
    title: "Enterprise Ready",
    description: "Secure admin controls, user management, and subscription plans built-in.",
    link: "/admin"
  }
];

const stats = [
  { value: "10M+", label: "Images Generated" },
  { value: "500K+", label: "Videos Created" },
  { value: "99.9%", label: "Uptime" },
  { value: "50ms", label: "Avg Response" }
];

const pricingPlans = [
  {
    name: "Pro",
    price: "1,600",
    features: ["2,000 videos/month", "All AI features", "Priority support"],
    popular: true
  },
  {
    name: "Ultra",
    price: "2,199",
    features: ["3,000 videos/month", "Priority queue", "Enterprise support"],
    popular: false,
    icon: Crown
  }
];

// Typing animation component
function TypingAnimation() {
  const phrases = [
    "AI Video Creation",
    "Batch Processing",
    "Smart Automation",
    "Creative Freedom"
  ];
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const phrase = phrases[currentPhrase];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (displayText.length < phrase.length) {
          setDisplayText(phrase.slice(0, displayText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (displayText.length > 0) {
          setDisplayText(displayText.slice(0, -1));
        } else {
          setIsDeleting(false);
          setCurrentPhrase((prev) => (prev + 1) % phrases.length);
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentPhrase]);

  return (
    <span className="text-gradient">
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
}

// Scroll animation component
function ScrollReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 75, rotateX: -15, scale: 0.95 }}
      animate={isInView ? {
        opacity: 1,
        y: 0,
        rotateX: 0,
        scale: 1,
      } : {}}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.22, 0.61, 0.36, 1],
        opacity: { duration: 0.6 }
      }}
      style={{
        transformPerspective: 1000,
        transformStyle: "preserve-3d"
      }}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroBg})` }}
        >
          <div className="absolute inset-0 bg-background/80 dark:bg-background/90" />
        </div>

        {/* Animated Gradient Orbs */}
        {/* Animated Gradient Orbs & Particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-primary/20 blur-[150px] animate-pulse-slow" />
          <div className="absolute -bottom-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(var(--gradient-end))] blur-[120px] opacity-30 animate-pulse-slow" />

          {/* Floating Particles */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="floating-particle bg-primary/40"
              style={{
                width: Math.random() * 6 + 2 + "px",
                height: Math.random() * 6 + 2 + "px",
                left: Math.random() * 100 + "%",
                top: Math.random() * 100 + "%",
                animationDelay: i * 1.5 + "s",
                animationDuration: 10 + Math.random() * 10 + "s"
              }}
            />
          ))}

          {/* Floating Shapes */}
          <div className="floating-shape absolute top-1/4 left-10 w-20 h-20 border-2 border-primary/10 rounded-full" />
          <div className="floating-shape absolute bottom-1/3 right-10 w-16 h-16 border-2 border-accent/10 rounded-lg rotate-45" style={{ animationDelay: "2s" }} />
        </div>

        <div className="container relative z-10 px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            >
              <AnimatedIcon icon={Star} preset="pulse-glow" className="text-primary" size={16} />
              <span className="text-sm font-medium text-foreground">
                AI-Powered Creative Platform
              </span>
            </motion.div>

            {/* Headline with Typing Animation */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6"
            >
              <span className="text-gradient block mb-3">ONanoFlow</span>
              <span className="block text-2xl sm:text-3xl md:text-4xl">
                <TypingAnimation />
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
            >
              Generate images, animate videos, and process batches at scale.
              Professional AI tools designed for creators and enterprises.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link to="/video-gen">
                <Button variant="hero" size="xl" className="gap-3">
                  Start Creating
                  <AnimatedIcon icon={ArrowRight} preset="wiggle" className="group-hover:translate-x-1 transition-transform" size={20} />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="heroOutline" size="xl" className="gap-3">
                  <Play className="w-5 h-5" />
                  View Pricing
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <ScrollReveal>
        <section className="py-16 border-b border-border/50">
          <div className="container px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.5, rotateY: -45 }}
                  whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.1,
                    type: "spring",
                    stiffness: 100
                  }}
                  className="text-center"
                >
                  <div className="text-3xl sm:text-4xl font-display font-bold text-gradient mb-2 icon-scale-hover cursor-default">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Features Section */}
      <ScrollReveal delay={0.2}>
        <section className="py-16 sm:py-20 lg:py-24 bg-gradient-subtle">
          <div className="container px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-6 text-shimmer">
                Everything You Need to Create
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Professional-grade AI tools with batch processing, smart load balancing, and enterprise controls.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, i) => {
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, z: -50, rotateX: -20 }}
                    whileInView={{ opacity: 1, z: 0, rotateX: 0 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.7,
                      delay: i * 0.1,
                      type: "spring",
                      stiffness: 80
                    }}
                    whileHover={{
                      scale: 1.05,
                      rotateY: 5,
                      transition: { duration: 0.3 }
                    }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <Link
                      to={feature.link}
                      className="block glass rounded-xl p-6 card-hover h-full"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                        <AnimatedIcon
                          icon={feature.icon}
                          preset={feature.preset as any}
                          className="text-primary-foreground"
                          size={24}
                        />
                      </div>
                      <h3 className="font-display font-semibold text-lg mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* Pricing Preview Section */}
      <ScrollReveal delay={0.3}>
        <section className="py-16 sm:py-20 lg:py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-primary opacity-5" />
          <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <Badge variant="outline" className="mb-4 px-4 py-1.5 bg-primary/10 border-primary/30">
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Simple Pricing
              </Badge>
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-6 text-shimmer">
                Choose Your <span className="text-gradient">Perfect Plan</span>
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Professional AI tools with transparent pricing. No hidden fees.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-10">
              {pricingPlans.map((plan, i) => {
                const Icon = plan.icon || Zap;
                return (
                  <motion.div
                    key={plan.name}
                    initial={{ opacity: 0, rotateY: -30, scale: 0.9 }}
                    whileInView={{ opacity: 1, rotateY: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      duration: 0.7,
                      delay: i * 0.2,
                      type: "spring"
                    }}
                    whileHover={{
                      scale: 1.03,
                      rotateY: 3,
                      transition: { duration: 0.3 }
                    }}
                    className={cn(
                      "glass rounded-xl p-6 text-center card-hover",
                      plan.popular && "ring-2 ring-primary"
                    )}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    {plan.popular && (
                      <Badge className="mb-3 bg-gradient-primary text-primary-foreground">
                        Most Popular
                      </Badge>
                    )}
                    <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center bg-muted group-hover:bg-primary/10 transition-colors duration-300">
                      <AnimatedIcon
                        icon={Icon}
                        preset={plan.popular ? "pulse-glow" : "float-subtle"}
                        className="text-primary"
                        size={24}
                      />
                    </div>
                    <h3 className="font-display font-bold text-xl">{plan.name}</h3>
                    <div className="flex items-baseline justify-center gap-1 my-3">
                      <span className="text-sm text-muted-foreground">PKR</span>
                      <span className="font-display text-4xl font-bold">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">/mo</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-2 mb-6">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center justify-center gap-2">
                          <Check className="w-4 h-4 text-primary" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link to="/pricing">
                      <Button variant={plan.popular ? "hero" : "outline"} className="w-full">
                        Get Started
                      </Button>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* CTA Section */}
      <ScrollReveal delay={0.4}>
        <section className="py-16 sm:py-20 lg:py-24 bg-gradient-subtle">
          <div className="container px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl mx-auto text-center"
            >
              <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-6 text-shimmer">
                Ready to Transform Your Workflow?
              </h2>
              <p className="text-muted-foreground mb-8">
                Join thousands of creators using ONanoFlow to generate stunning content at scale.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/pricing">
                  <Button variant="hero" size="xl">
                    Subscribe Now
                    <AnimatedIcon icon={ArrowRight} preset="wiggle" className="group-hover:translate-x-1 transition-transform" size={20} />
                  </Button>
                </Link>
              </div>
              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Instant access after payment
                </span>
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Cancel anytime
                </span>
              </div>
            </motion.div>
          </div>
        </section>
      </ScrollReveal>

      {/* Footer */}
      <ScrollReveal delay={0.5}>
        <footer className="py-12 border-t border-border/50 bg-muted/30">
          <div className="container px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
              {/* Brand */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                    <AnimatedIcon icon={Sparkles} preset="pulse-glow" className="text-primary-foreground" size={20} />
                  </div>
                  <span className="font-display font-bold text-xl">ONanoFlow</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Professional AI-powered video and image generation platform.
                </p>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="font-semibold mb-4">Quick Links</h3>
                <div className="flex flex-col gap-2 text-sm">
                  <Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors link-underline">Pricing</Link>
                  <Link to="/image-studio" className="text-muted-foreground hover:text-primary transition-colors link-underline">Image Studio</Link>
                  <Link to="/video-gen" className="text-muted-foreground hover:text-primary transition-colors link-underline">Video Generation</Link>
                  <Link to="/analytics" className="text-muted-foreground hover:text-primary transition-colors link-underline">Analytics</Link>
                </div>
              </div>

              {/* Contact */}
              <div>
                <h3 className="font-semibold mb-4">Contact OServices</h3>
                <div className="flex flex-col gap-3 text-sm">
                  <a href="tel:+923296125762" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                    <Phone className="w-4 h-4" />
                    +92 329 6125762
                  </a>
                  <a href="mailto:contactusonhere13@gmail.com" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                    <Mail className="w-4 h-4" />
                    contactusonhere13@gmail.com
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
              <p>© 2026 ONanoFlow. All rights reserved.</p>
              <p className="flex items-center gap-2">
                Built by <span className="font-semibold text-foreground">OServices</span>
              </p>
            </div>
          </div>
        </footer>
      </ScrollReveal>
    </Layout>
  );
}
