"use client";

import Image from "next/image";
import { useState } from "react";
import { getPublicImageUrl, isLocalSupabaseUrl } from "@/lib/property-image-url";
import type { PublicPropertyImage } from "@/lib/marketplace";

export function PropertyGallery({
  title,
  images,
}: {
  title: string;
  images: PublicPropertyImage[];
}) {
  const [selected, setSelected] = useState(0);
  const current = images[selected];

  return (
    <div className="property-gallery">
      <div className="property-detail__photo">
        {current ? (
          <Image
            src={getPublicImageUrl(current.storage_path)}
            alt={current.alt_text || title}
            fill
            sizes="(max-width: 800px) 100vw, 65vw"
            priority
            unoptimized={isLocalSupabaseUrl()}
          />
        ) : (
          <div className="image-fallback" role="img" aria-label={`No photographs available for ${title}`}>
            <span>Photographs coming soon</span>
          </div>
        )}
      </div>
      {images.length > 1 ? (
        <div className="property-gallery__thumbnails" aria-label="Property photographs">
          {images.map((image, index) => (
            <button
              key={image.storage_path}
              className={`property-gallery__thumbnail${selected === index ? " is-selected" : ""}`}
              type="button"
              aria-label={`Show photograph ${index + 1} of ${images.length}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <Image
                src={getPublicImageUrl(image.storage_path)}
                alt=""
                fill
                sizes="100px"
                unoptimized={isLocalSupabaseUrl()}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
