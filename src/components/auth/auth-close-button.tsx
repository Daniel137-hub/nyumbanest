"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

function closeAuthPage(router: ReturnType<typeof useRouter>) {
  const previousUrl = document.referrer
    ? new URL(document.referrer, window.location.origin)
    : null;
  if (previousUrl?.origin === window.location.origin &&
    (previousUrl.pathname !== window.location.pathname || previousUrl.search !== window.location.search)) {
    router.back();
  } else {
    router.replace("/");
  }
}

export function AuthCloseButton() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeAuthPage(router);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <button
      className="auth-close"
      type="button"
      aria-label="Close authentication"
      onClick={() => closeAuthPage(router)}
    >
      <X size={20} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
