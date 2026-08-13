'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Phone, Lock, UserPlus } from 'lucide-react';
import { RegistrationScreen } from './registration-screen';

export function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError('Telefon va parolni kiriting');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(phone, password);
    } catch (err: any) {
      setError(err?.message ?? 'Noto\'g\'ri telefon yoki parol');
    } finally {
      setLoading(false);
    }
  };

  if (showRegistration) {
    return <RegistrationScreen onBack={() => setShowRegistration(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-600 items-center justify-center mb-3">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Restoran POS</h1>
          <p className="text-sm text-slate-500 mt-1">Tizimga kirish</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefon raqam</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+998901234567"
                className="pl-10 h-11"
                autoComplete="tel"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Parol</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••"
                className="pl-10 h-11"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-2.5 text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !phone || !password}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Kirish'}
          </Button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <button
            onClick={() => setShowRegistration(true)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center justify-center gap-1 mx-auto"
          >
            <UserPlus className="h-4 w-4" />
            Restoran ro'yxatdan o'tkazish
          </button>
        </div>
      </div>
    </div>
  );
}
