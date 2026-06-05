"use client";

import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, History, LayoutDashboard, LogOut, Sparkles, Settings } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase-auth";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
  { to: "/analyze", label: "New analysis", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export default function DashboardSidebar() {
  const { user, signOut } = useFirebaseAuth();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-ink/10 lg:bg-[#1f2a1d] lg:text-cream">
      <div className="flex h-full flex-col px-5 py-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-cream text-ink">
            <BarChart3 size={15} />
          </span>
          ReverseHire
        </Link>

        <div className="mt-8">
          <p className="text-xs uppercase tracking-[0.22em] text-cream/55">Workspace</p>
          <nav className="mt-3 space-y-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeProps={{ className: "bg-white/10 text-white" }}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-cream/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
          {user ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink text-sm font-semibold">
                  {(user.displayName ?? user.email ?? "U").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user.displayName ?? "Signed in"}</p>
                  <p className="text-xs text-cream/60">{user.email ?? "Firebase account"}</p>
                </div>
              </div>
              <Link
                to="/analyze"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
              >
                Start a new analysis <ArrowRight size={14} />
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-white">Sign in to save reports</p>
              <p className="mt-1 text-xs text-cream/60">Create an account to keep your dashboard history.</p>
              <div className="mt-4 flex gap-2">
                <Link
                  to="/login"
                  className="inline-flex flex-1 items-center justify-center rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-cream"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="inline-flex flex-1 items-center justify-center rounded-full border border-white/15 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  Sign up
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
