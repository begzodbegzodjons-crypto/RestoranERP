'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Phone, Lock } from 'lucide-react';

export function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('+99890');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !pin) {
      setError('Telefon va PIN kiriting');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(phone, pin);
    } catch (err: any) {
      const msg = err?.code === 'ACCOUNT_LOCKED'
        ? 'Hisob bloklangan. 15 daqiqadan keyin urinib ko\'ring.'
        : err?.code === 'RATE_LIMIT'
        ? 'Juda ko\'p urinish. 1 daqiqadan keyin urinib ko\'ring.'
        : err?.message ?? 'Login yoki PIN noto\'g\'ri';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pin.length < 8) setPin(prev => prev + digit);
  };
  const handlePinDelete = () => setPin(prev => prev.slice(0, -1));
  const handlePinClear = () => setPin('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-600 items-center justify-center mb-3">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Restoran POS</h1>
          <p className="text-sm text-slate-500 mt-1">Ofitsiant tizimiga kirish</p>
        </div>

        {/* Phone */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefon raqami</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+998901234567"
                className="pl-10 h-11"
                autoComplete="tel"
                inputMode="tel"
              />
            </div>
          </div>

          {/* PIN dots */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">PIN kod</label>
            <div className="flex gap-2 justify-center py-2">
              {[0,1,2,3].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-colors ${i < pin.length ? 'bg-emerald-600' : 'bg-slate-200'}`}
                />
              ))}
            </div>
          </div>

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => handlePinDigit(d)}
                className="h-14 text-xl font-semibold text-slate-900 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handlePinClear}
              className="h-14 text-sm font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl"
            >
              Tozalash
            </button>
            <button
              type="button"
              onClick={() => handlePinDigit('0')}
              className="h-14 text-xl font-semibold text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl"
            >
              0
            </button>
            <button
              type="button"
              onClick={handlePinDelete}
              className="h-14 text-sm font-medium text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center"
              aria-label="O'chirish"
            >
              ⌫
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-2.5 text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-base mt-2"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Kirish'}
          </Button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-6 leading-relaxed">
          Demo: admin/cashier/waiter PIN — <span className="font-mono">1234</span>
        </p>
      </div>
    </div>
  );
}
