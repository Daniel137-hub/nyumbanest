"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, UserRound } from "lucide-react";
import { updateProfilePhoto } from "@/app/actions/profile";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfilePhotoForm({
  photoUrl,
}: {
  photoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const imageRefreshAttempted = useRef(false);
  const [state, formAction, isPending] = useActionState(updateProfilePhoto, {});
  const [clientError, setClientError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (state.success || state.error) {
      if (inputRef.current) inputRef.current.value = "";
    }
    if (state.success) {
      imageRefreshAttempted.current = false;
    }
  }, [state]);

  return (
    <form className="profile-photo-form" action={formAction}>
      <div className="profile-card__avatar">
        {photoUrl && !imageFailed ? (
          <Image
            src={photoUrl}
            alt="Your profile photo"
            fill
            loading="eager"
            sizes="90px"
            unoptimized
            className="profile-card__avatar-image"
            onError={() => {
              if (!imageRefreshAttempted.current) {
                imageRefreshAttempted.current = true;
                router.refresh();
              } else {
                setImageFailed(true);
              }
            }}
          />
        ) : (
          <UserRound size={34} strokeWidth={1.5} aria-hidden="true" />
        )}
        <button
          className="profile-card__avatar-edit"
          type="button"
          aria-label="Edit profile photo"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          <Camera size={17} aria-hidden="true" />
        </button>
      </div>
      <button
        className="profile-photo-form__label"
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? "Uploading photo…" : "Edit profile photo"}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        name="photo"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Choose a profile photo"
        disabled={isPending}
        onClick={(event) => {
          event.currentTarget.value = "";
        }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) return;

          if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
            setClientError("Choose a JPEG, PNG, or WebP photo.");
            event.currentTarget.value = "";
            return;
          }
          if (file.size > MAX_PHOTO_BYTES) {
            setClientError("Choose a photo no larger than 5 MiB.");
            event.currentTarget.value = "";
            return;
          }

          setClientError(null);
          setImageFailed(false);
          imageRefreshAttempted.current = false;
          event.currentTarget.form?.requestSubmit();
        }}
      />
      {imageFailed ? (
        <p className="profile-photo-form__message profile-photo-form__message--error" role="alert">
          Your photo could not be displayed.{" "}
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              imageRefreshAttempted.current = false;
              setImageFailed(false);
              router.refresh();
            }}
          >
            Try again
          </button>
        </p>
      ) : null}
      {clientError || state.error ? (
        <p className="profile-photo-form__message profile-photo-form__message--error" role="alert">
          {clientError ?? state.error}
        </p>
      ) : null}
      {state.success ? <p className="profile-photo-form__message" role="status">{state.success}</p> : null}
    </form>
  );
}
