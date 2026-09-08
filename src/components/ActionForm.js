'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

export default function ActionForm({ action, children, className }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function clientAction(formData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      await action(formData);
      startTransition(() => {
        router.refresh();
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <form action={clientAction} className={className} aria-busy={isSubmitting || isPending}>
      <fieldset disabled={isSubmitting || isPending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
