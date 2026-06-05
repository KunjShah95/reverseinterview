import { createFileRoute } from "@tanstack/react-router";
import SiteNav from "@/components/SiteNav";
import FirebaseAuthCard from "@/components/FirebaseAuthCard";
import { useFirebaseAuth } from "@/lib/firebase-auth";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Reverse Interview AI" },
      { name: "description", content: "Sign in to access your dashboard and saved reports." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useFirebaseAuth();

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/dashboard" });
    }
  }, [loading, navigate, user]);

  return (
    <>
      <SiteNav solid hideDashboard />
      <FirebaseAuthCard mode="signIn" />
    </>
  );
}
