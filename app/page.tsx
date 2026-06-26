"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main
      className="fixed inset-0 z-50 grid min-h-dvh place-items-center bg-gray-50 px-4 text-[#14121A]"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex min-w-[240px] flex-col items-center gap-4 rounded-[18px] border border-[#E9E6F2] bg-white/95 px-6 py-5 text-center shadow-[0_18px_48px_rgba(20,18,26,0.10)]">
        <div className="relative h-12 w-12" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border-4 border-[#F1EAFE]" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-[#7C3AED]" />
          <div className="absolute inset-[14px] rounded-full bg-[radial-gradient(circle_at_30%_30%,#B49BFF,#7C3AED)]" />
        </div>
        <div className="grid gap-1">
          <div className="text-sm font-extrabold">Loading home</div>
          <div className="text-xs font-semibold text-[#6B6777]">
            Preparing your dashboard...
          </div>
        </div>
      </div>
    </main>
  );
}
