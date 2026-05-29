import { Link } from "@tanstack/react-router";

export default function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-cream">
      <div className="mx-auto max-w-7xl px-6 md:px-10 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm text-body">
        <div>
          <p className="font-medium text-ink">
            ReverseHire<span className="text-ink/40 text-xs align-super">™</span>
          </p>
          <p className="mt-1 max-w-md">
            Signals shown are interpretive, not factual claims. Always do your own research before
            accepting an offer.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link to="/" className="hover:text-ink transition-colors">
            Home
          </Link>
          <Link to="/how-it-works" className="hover:text-ink transition-colors">
            The Process
          </Link>
          <Link to="/features" className="hover:text-ink transition-colors">
            Features
          </Link>
          <Link to="/pricing" className="hover:text-ink transition-colors">
            Tariffs
          </Link>
          <Link to="/about" className="hover:text-ink transition-colors">
            About
          </Link>
          <Link to="/contact" className="hover:text-ink transition-colors">
            Contact
          </Link>
          <Link to="/analyze" className="hover:text-ink transition-colors">
            Analyze
          </Link>
        </nav>
      </div>
    </footer>
  );
}
