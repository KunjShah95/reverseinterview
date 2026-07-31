import {
  Building2,
  Brain,
  Clock,
  DollarSign,
  FileText,
  Flame,
  Gavel,
  Handshake,
  Image as ImageIcon,
  MessageSquare,
  Scan,
  Search,
  ShieldAlert,
  Siren,
  Sparkles,
  Type,
  UserSearch,
  Users,
} from "lucide-react";
import type { DocTypeResult } from "./extract.functions";
import type { RunProgress } from "./run-analysis";

export type Mode = "text" | "pdf" | "image" | "company";

export const AGENT_STEPS: { id: keyof RunProgress; label: string; icon: typeof Sparkles }[] = [
  { id: "culture", label: "Culture & toxicity scan", icon: ShieldAlert },
  { id: "burnout", label: "Burnout risk assessment", icon: Flame },
  { id: "salary", label: "Salary fairness analysis", icon: DollarSign },
  { id: "ghost", label: "Ghost-hiring detection", icon: Search },
  { id: "negotiation", label: "Negotiation strategy", icon: Handshake },
  { id: "reverse", label: "Reverse interview questions", icon: MessageSquare },
  { id: "lie", label: "HR claim verification", icon: Scan },
  { id: "simulation", label: "Career simulation", icon: Clock },
  { id: "legal", label: "Legal scan", icon: Gavel },
  { id: "managerRadar", label: "Manager radar", icon: UserSearch },
  { id: "powerDynamics", label: "Power dynamics", icon: Siren },
  { id: "teamChemistry", label: "Team chemistry", icon: Users },
  { id: "critic", label: "Peer review", icon: Brain },
  { id: "orchestrator", label: "Final verdict", icon: Gavel },
];

export const MODE_TABS: { id: Mode | "timeline"; label: string; icon: typeof Type }[] = [
  { id: "text", label: "Paste text", icon: Type },
  { id: "pdf", label: "Upload PDF", icon: FileText },
  { id: "image", label: "Screenshot", icon: ImageIcon },
  { id: "company", label: "Company URL", icon: Building2 },
  { id: "timeline", label: "Audit timeline", icon: Clock },
];

export const DEMO_JD = `Senior Full-Stack Engineer — URGENT HIRE

We're a fast-paced, family-style startup looking for a true rockstar who can wear many hats and thrive under pressure. You'll own the entire product end-to-end, work directly with the founders, and ship at lightning speed.

Responsibilities:
- Build features across frontend, backend, mobile, and infrastructure
- Handle on-call rotations (we move fast and break things, then fix them at 2am)
- Be a self-starter — we don't micromanage
- Wear multiple hats: design, engineering, customer support
- 5+ years experience required, but we move like a 1-year-old startup
- Salary: $85,000 - $110,000 (very competitive!)
- "Unlimited" PTO — most people take ~10 days
- Equity: TBD after 6-month review
- Location: Remote, but you must overlap 6+ hours with PST

We value work-life balance and a flat hierarchy. Apply ASAP — we're filling this immediately!`;

export const PDF_CHUNK = 3;

export const DOC_LABELS: Record<DocTypeResult["docType"], string> = {
  job_description: "Job description",
  offer_letter: "Offer letter",
  recruiter_chat: "Recruiter chat",
  company_brief: "Company brief",
  unknown: "Document",
};

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
