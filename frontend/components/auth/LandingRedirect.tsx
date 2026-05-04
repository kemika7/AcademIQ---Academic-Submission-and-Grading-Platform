"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export function LandingRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (getSessionUser()) router.replace("/dashboard");
  }, [router]);
  return null;
}
