"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { setPropertyFavorite } from "@/app/actions/marketplace";

export function FavoriteControl({
  propertyId,
  title,
  isSaved,
  isAuthenticated,
  next,
}: {
  propertyId: string;
  title: string;
  isSaved: boolean;
  isAuthenticated: boolean;
  next: string;
}) {
  const [saved, setSaved] = useState(isSaved);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!isAuthenticated) {
    return (
      <Link
        className="favorite-button"
        href={`/login?next=${encodeURIComponent(next)}`}
        aria-label={`Sign in to save ${title}`}
      >
        <Heart size={21} aria-hidden="true" />
      </Link>
    );
  }

  function toggleFavorite() {
    setError("");
    startTransition(async () => {
      try {
        const result = await setPropertyFavorite(propertyId, !saved);
        if (result.error) {
          if ("signInRequired" in result && result.signInRequired) {
            router.push(`/login?next=${encodeURIComponent(next)}`);
            return;
          }
          setError(result.error);
          return;
        }
        setSaved(!saved);
        router.refresh();
      } catch {
        setError("We couldn't update this saved property. Please try again.");
      }
    });
  }

  return (
    <>
      <button
        className={`favorite-button${saved ? " is-saved" : ""}`}
        type="button"
        aria-label={saved ? `Remove ${title} from saved homes` : `Save ${title}`}
        aria-pressed={saved}
        aria-busy={pending}
        disabled={pending}
        onClick={toggleFavorite}
      >
        <Heart size={21} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      </button>
      {error ? <span className="favorite-control-error" role="alert">{error}</span> : null}
    </>
  );
}
