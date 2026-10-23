import Image from "next/image";
import { HomepagePropertySearch } from "@/components/marketplace/homepage-property-search";

const heroImages = [
  {
    src: "/Hero-1.png",
    alt: "Modern villa overlooking the city at sunset",
  },
  {
    src: "/Hero-2.png",
    alt: "Contemporary apartment complex at sunset",
  },
  {
    src: "/Hero-3.png",
    alt: "Residential plot of land in a green landscape at sunset",
  },
];

export function HomepageHero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div
        className="hero__image"
        role="group"
        aria-roledescription="carousel"
        aria-label="Featured homes"
      >
        <div className="hero__track" aria-live="off">
          {heroImages.map((image, index) => (
            <div
              className="hero__slide"
              key={image.src}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${heroImages.length}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="100vw"
                loading={index === 0 ? "eager" : "lazy"}
                priority={index === 0}
                fetchPriority={index === 0 ? "high" : "auto"}
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>
      <div className="hero__content">
        <p className="eyebrow">A better way home</p>
        <h1 id="hero-title">Find a place<br />to call <span>yours.</span></h1>
        <p className="hero__description">
          Discover quality homes, apartments, land and commercial spaces across Tanzania. Buy or rent with confidence.
        </p>
      </div>
      <HomepagePropertySearch />
    </section>
  );
}
