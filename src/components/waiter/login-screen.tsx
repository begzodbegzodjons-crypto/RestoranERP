'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';

export function LoginScreen() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Parolni kiriting');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login('', password);
    } catch (err: any) {
      const msg = err?.code === 'ACCOUNT_LOCKED'
        ? 'Hisob bloklangan. 15 daqiqadan keyin urinib ko\'ring.'
        : err?.code === 'RATE_LIMIT'
        ? 'Juda ko\'p urinish. 1 daqiqadan keyin urinib ko\'ring.'
        : err?.message ?? 'Noto\'g\'ri parol';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (password.length < 8) setPassword(prev => prev + digit);
  };
  const handleDelete = () => setPassword(prev => prev.slice(0, -1));
  const handleClear = () => setPassword('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-600 items-center justify-center mb-3">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Restoran POS</h1>
          <p className="text-sm text-slate-500 mt-1">Parolni kiriting</p>
        </div>

        {/* Password dots */}
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2 justify-center py-3 mb-2">
            {[0,1,2,3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-colors ${i < password.length ? 'bg-emerald-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-14 text-xl font-semibold text-slate-900 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 text-sm font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl"
            >
              Tozalash
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-14 text-xl font-semibold text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-14 text-sm font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center"
              aria-label="O'chirish"
            >
              ⌫
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-2.5 text-center mt-3">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || password.length < 4}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-base mt-3"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Kirish'}
          </Button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-4">
          Parol: <span className="font-mono">1234</span> (admin, kassir, ofitsiant)
        </p>
      </div>
    </div>
  );
}
