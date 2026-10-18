"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RetryServiceButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button type="button" className="btn ghost sm" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      {pending ? "Checking…" : "Try again"}
    </button>
  );
}
