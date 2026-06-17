'use client';

import { login } from '../actions';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function handleSubmit(formData) {
    const password = formData.get('password');
    const result = await login(password);
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error);
    }
  }

  return (
    <main className="mt-20">
      <div className="section-title">ADMIN LOGIN</div>
      <form action={handleSubmit} className="flex flex-col gap-4 mt-8">
        <input 
          type="password" 
          name="password" 
          placeholder="password" 
          required 
          autoFocus
        />
        {error && <div className="text-[#844] text-sm">{error}</div>}
        <button type="submit">ENTER</button>
      </form>
      <div className="mt-8 text-center text-xs">
        <Link href="/">戻る</Link>
      </div>
    </main>
  );
}
