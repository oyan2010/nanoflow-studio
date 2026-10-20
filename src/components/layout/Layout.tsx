import { ReactNode } from "react";
import { Navbar } from "./Navbar";

interface LayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

export function Layout({ children, showNav = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {showNav && (
        <header>
          <Navbar />
        </header>
      )}
      <main className={showNav ? "pt-16" : ""} role="main" aria-label="Main content">
        {children}
      </main>
    </div>
  );
}
