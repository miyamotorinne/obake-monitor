'use client';

import { useFormStatus } from 'react-dom';

export default function SubmitButton({ children, pendingText = '送信中...', className, ...props }) {
  const { pending } = useFormStatus();

  return (
    <button 
      type="submit" 
      disabled={pending} 
      className={`${className} ${pending ? 'opacity-50 cursor-not-allowed' : ''}`}
      {...props}
    >
      {pending ? pendingText : children}
    </button>
  );
}
