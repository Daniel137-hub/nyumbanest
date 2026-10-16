"use client";

import { useRef, useState, type FormEvent } from "react";
import { submitPropertyInquiry } from "@/app/actions/marketplace";

export function PropertyInquiryForm({ propertyId }: { propertyId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    const form = event.currentTarget;
    const values = new FormData(form);
    setFeedback(null);
    try {
      const result = await submitPropertyInquiry({
        propertyId,
        name: String(values.get("name") ?? ""),
        email: String(values.get("email") ?? ""),
        phone: String(values.get("phone") ?? ""),
        message: String(values.get("message") ?? ""),
        website: String(values.get("website") ?? ""),
      });
      if (result.error) {
        setFeedback({ error: true, message: result.error });
        return;
      }
      formRef.current?.reset();
      setFeedback({ error: false, message: "Your inquiry was sent. The property owner can now follow up with you." });
    } catch {
      setFeedback({ error: true, message: "We couldn't send your inquiry. Please try again." });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <section className="property-inquiry" aria-labelledby="property-inquiry-title">
      <h2 id="property-inquiry-title">Interested in this property?</h2>
      <p>Send a message to the owner. Your contact details will only be shared with them for this inquiry.</p>
      <form ref={formRef} className="property-inquiry__form" onSubmit={submit}
        aria-labelledby="property-inquiry-title">
        <div className="inquiry-honeypot" aria-hidden="true">
          <label htmlFor={`website-${propertyId}`}>Website</label>
          <input id={`website-${propertyId}`} name="website" tabIndex={-1} autoComplete="off" disabled={pending} />
        </div>
        <label>
          Your name
          <input name="name" autoComplete="name" required maxLength={160} disabled={pending} />
        </label>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required maxLength={320} disabled={pending} />
        </label>
        <label>
          Phone number <span>(optional)</span>
          <input name="phone" type="tel" autoComplete="tel" maxLength={40} disabled={pending} />
        </label>
        <label>
          Message
          <textarea name="message" required minLength={10} maxLength={4000} rows={5} disabled={pending} />
        </label>
        {feedback ? (
          <p className={feedback.error ? "form-message form-message--error" : "form-message form-message--success"}
            role={feedback.error ? "alert" : "status"}>
            {feedback.message}
          </p>
        ) : null}
        <button className="button button--primary" type="submit" disabled={pending}>
          {pending ? "Sending..." : "Send inquiry"}
        </button>
      </form>
    </section>
  );
}
