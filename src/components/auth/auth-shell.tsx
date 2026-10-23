import Link from "next/link";
import Image from "next/image";
import { House, ShieldCheck } from "lucide-react";
import { AuthCloseButton } from "@/components/auth/auth-close-button";

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <AuthCloseButton />
        <section className="auth-card" aria-labelledby="auth-title">
          <Link className="auth-brand" href="/" aria-label="NyumbaNest home">
            <span className="auth-brand__icon"><House size={22} strokeWidth={2.7} aria-hidden="true" /></span>
            <span>NyumbaNest</span>
          </Link>
          <header className="auth-card__header">
            <h1 id="auth-title">{title}</h1>
            <p>{subtitle}</p>
          </header>
          {children}
          <p className="auth-privacy"><ShieldCheck size={15} aria-hidden="true" /> Your account is protected with secure sign-in.</p>
        </section>
        <aside className="auth-story" aria-label="About NyumbaNest">
          <div className="auth-story__image">
            <Image
              src="/images/family-home.jpg"
              alt=""
              fill
              loading="eager"
              sizes="(max-width: 760px) 100vw, 40vw"
            />
          </div>
          <div className="auth-story__copy">
            <p className="eyebrow">A place to begin</p>
            <h2>Find a place that feels like yours.</h2>
            <p>Thoughtful homes and spaces, all in one welcoming place.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
