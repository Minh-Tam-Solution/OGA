'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cleanPin = pin.trim();
        if (!cleanPin) return;
        setLoading(true);
        setError('');

        try {
            console.log('[Auth] Submitting PIN...');
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: cleanPin }),
            });
            console.log('[Auth] Response status:', res.status);
            if (res.ok) {
                console.log('[Auth] PIN accepted, redirecting...');
                router.push('/');
                // Fallback: force reload if router.push stalls
                setTimeout(() => { window.location.href = '/'; }, 1000);
            } else {
                const data = await res.json().catch(() => ({}));
                console.log('[Auth] PIN rejected:', data.error);
                setError(data.error || 'Invalid PIN');
                setPin('');
            }
        } catch (err) {
            console.error('[Auth] Connection error:', err);
            setError('Connection error — check console');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-white mb-1">NQH Creative Studio</h1>
                    <p className="text-white/40 text-sm">Enter access PIN to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        placeholder="Access PIN"
                        autoFocus
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg tracking-widest placeholder:text-white/30 focus:outline-none focus:border-[#d9ff00]/50"
                    />
                    {error && (
                        <p className="text-red-400 text-sm text-center">{error}</p>
                    )}
                    <button
                        type="submit"
                        disabled={!pin.trim()}
                        className="w-full bg-[#d9ff00] text-black font-bold py-3 rounded-xl hover:bg-[#e5ff33] disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Verifying...' : 'Enter'}
                    </button>
                </form>
            </div>
        </div>
    );
}
