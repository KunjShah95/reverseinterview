import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, Sparkles, History } from "lucide-react";

type NavLink = { to: string; label: string };

const navLinks: NavLink[] = [
  { to: "/how-it-works", label: "The Process" },
  { to: "/pricing", label: "Tariffs" },
  { to: "/history", label: "Your Reports" },
];

type Props = {
  /** When true, nav assumes a light backdrop (cream) and uses solid pill */
  solid?: boolean;
};

export default function SiteNav({ solid = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

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

  const pillBg = solid
    ? "bg-cream/80 backdrop-blur-md border-ink/10"
    : "bg-white/70 backdrop-blur-md border-white/60";

  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 md:px-10 py-4 sm:py-6">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 text-ink font-semibold text-lg tracking-tight"
          onClick={() => setMenuOpen(false)}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-cream">
            <Sparkles size={14} />
          </span>
          ReverseHire<span className="text-ink/40 text-xs align-super">™</span>
        </Link>

        {/* Desktop pill nav */}
        <nav
          className={`hidden lg:flex items-center gap-1 ${pillBg} rounded-full pl-6 pr-1 py-1 shadow-sm border`}
        >
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="px-4 py-2 text-sm font-medium text-ink/80 hover:text-ink transition-opacity hover:opacity-80"
              activeProps={{ className: "text-ink" }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/analyze"
            className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink-hover"
          >
            Try it Live
          </Link>
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <Link
            to="/history"
            className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-white/70 backdrop-blur-md border border-white/60 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-white/90"
          >
            <History size={14} />
            Saved
          </Link>
          <Link
            to="/analyze"
            className="hidden md:inline-flex lg:hidden items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-ink-hover"
          >
            Analyze
          </Link>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="lg:hidden relative flex items-center justify-center w-10 h-10 rounded-full bg-white/70 backdrop-blur-md border border-white/60 text-ink transition-all duration-300 hover:bg-white/90"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <Menu
              size={18}
              className={`absolute transition-all duration-300 ${
                menuOpen
                  ? "opacity-0 rotate-90 scale-50"
                  : "opacity-100 rotate-0 scale-100"
              }`}
            />
            <X
              size={18}
              className={`absolute transition-all duration-300 ${
                menuOpen
                  ? "opacity-100 rotate-0 scale-100"
                  : "opacity-0 -rotate-90 scale-50"
              }`}
            />
          </button>
        </div>
      </header>

      {/* Mobile overlay backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      />

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[85%] max-w-sm bg-cream shadow-2xl transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full pt-24 px-8 pb-8">
          <nav className="flex flex-col">
            {navLinks.map((link, i) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`text-2xl font-semibold text-ink py-4 border-b border-ink/10 transition-all duration-500 ${
                  menuOpen ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
                }`}
                style={{
                  transitionDelay: menuOpen ? `${150 + i * 70}ms` : "0ms",
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div
            className={`mt-auto flex flex-col gap-3 transition-all duration-500 ${
              menuOpen ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
            }`}
            style={{ transitionDelay: menuOpen ? "400ms" : "0ms" }}
          >
            <Link
              to="/analyze"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-3.5 text-base font-medium text-cream transition-colors hover:bg-ink-hover"
            >
              Try it Live
            </Link>
            <Link
              to="/history"
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 px-6 py-3.5 text-base font-medium text-ink transition-colors hover:bg-ink/5"
            >
              <History size={16} />
              Saved Reports
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
