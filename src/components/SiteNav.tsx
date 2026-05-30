"use client";

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Show, UserButton } from "@clerk/tanstack-react-start";
import { Menu, X, Sparkles } from "lucide-react";

type NavLink = { to: string; label: string };

const navLinks: NavLink[] = [
  { to: "/how-it-works", label: "The Process" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Tariffs" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

type Props = {
  solid?: boolean;
  hideDashboard?: boolean;
};

export default function SiteNav({ solid = false, hideDashboard = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const headerBg =
    scrolled || solid
      ? "bg-white/80 backdrop-blur-xl border-ink/5 shadow-lg ring-1 ring-black/[0.03]"
      : "bg-white/40 backdrop-blur-md border-white/40 shadow-sm";

  return (
    <>
      <header className="fixed top-4 sm:top-6 left-0 right-0 z-50 px-4">
        <div
          className={`mx-auto max-w-6xl rounded-full border transition-all duration-300 ${headerBg}`}
        >
          <div className="flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6">
            {/* Logo Section */}
            <div className="flex-1 flex items-center min-w-0">
              <Link
                to="/"
                className="flex items-center gap-1.5 sm:gap-2 text-ink font-semibold text-sm sm:text-lg tracking-tight"
                onClick={() => setMenuOpen(false)}
              >
                <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-ink text-cream">
                  <Sparkles size={12} className="sm:hidden" />
                  <Sparkles size={14} className="hidden sm:block" />
                </span>
                <span className="truncate">
                  ReverseInterview
                  <span className="text-ink/40 text-[9px] sm:text-[10px] align-super">™</span>
                </span>
              </Link>
            </div>

            {/* Centered Navigation Links (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="px-3 py-1.5 text-sm font-medium text-ink/70 hover:text-ink transition-colors"
                  activeProps={{ className: "text-ink bg-ink/5 rounded-full" }}
                >
                  {link.label}
                </Link>
              ))}
              {!hideDashboard && (
                <Show when="signed-in">
                  <Link
                    to="/dashboard"
                    className="px-3 py-1.5 text-sm font-medium text-ink/70 hover:text-ink transition-colors"
                  >
                    Dashboard
                  </Link>
                </Show>
              )}
            </nav>

            {/* Auth & Menu Section */}
            <div className="flex-1 flex items-center justify-end gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-3">
                <Show when="signed-in">
                  <div className="flex items-center gap-3 pr-2 border-r border-ink/10">
                    <UserButton />
                  </div>
                </Show>
                <Show when="signed-out">
                  <Link
                    to="/sign-in/$"
                    className="text-sm font-medium text-ink/70 hover:text-ink transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/sign-up/$"
                    className="inline-flex items-center justify-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream shadow-sm transition-colors hover:bg-ink-hover"
                  >
                    Get started
                  </Link>
                </Show>
              </div>

              {/* Mobile Menu Trigger */}
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="lg:hidden relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-ink transition-all duration-300 hover:bg-white/20"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
              >
                <Menu
                  size={20}
                  className={`absolute transition-all duration-300 ${
                    menuOpen ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
                  }`}
                />
                <X
                  size={20}
                  className={`absolute transition-all duration-300 ${
                    menuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm transition-opacity duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Mobile Menu Drawer */}
      <aside
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-[70] w-[85%] max-w-sm bg-paper shadow-2xl transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full pt-20 px-8 pb-8">
          <nav className="flex flex-col">
            {navLinks.map((link, i) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`text-2xl font-semibold text-ink py-4 border-b border-ink/10 transition-all duration-500 ${
                  menuOpen ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
                }`}
                style={{ transitionDelay: menuOpen ? `${150 + i * 70}ms` : "0ms" }}
              >
                {link.label}
              </Link>
            ))}
            <Show when="signed-in">
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="text-2xl font-semibold text-ink py-4 border-b border-ink/10"
              >
                Dashboard
              </Link>
              {!hideDashboard && (
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="text-2xl font-semibold text-ink py-4 border-b border-ink/10"
                >
                  Settings
                </Link>
              )}
              <div className="mt-8 flex items-center gap-4">
                <UserButton />
                <div>
                  <p className="text-sm font-medium text-ink">Your Account</p>
                  <p className="text-xs text-body">Manage profile & billing</p>
                </div>
              </div>
            </Show>
            <Show when="signed-out">
              <div className="mt-8 flex flex-col gap-3">
                <Link
                  to="/sign-in/$"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center rounded-full bg-ink px-6 py-4 text-lg font-medium text-cream"
                >
                  Sign in
                </Link>
                <Link
                  to="/sign-up/$"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-center rounded-full border border-ink/15 bg-white px-6 py-4 text-lg font-medium text-ink"
                >
                  Get started
                </Link>
              </div>
            </Show>
          </nav>
        </div>
      </aside>
    </>
  );
}
