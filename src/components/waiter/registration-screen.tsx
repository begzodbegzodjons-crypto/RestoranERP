'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Phone, Lock, Store, ArrowLeft, CheckCircle2 } from 'lucide-react';

export function RegistrationScreen({ onBack }: { onBack: () => void }) {
  const [restaurantName, setRestaurantName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName || !phone || !password) {
      setError('Barcha maydonlarni to\'ldiring');
      return;
    }
    if (password.length < 4) {
      setError('Parol kamida 4 ta belgidan iborat bo\'lishi kerak');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ restaurantName, phone, password }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? 'Ro\'yxatdan o\'tish amalga oshmadi');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Tabriklaymiz!</h1>
          <p className="text-sm text-slate-500 mb-6">
            Restoran muvaffaqiyatli ro'yxatdan o'tdi. Endi telefon va parol bilan kirishingiz mumkin.
          </p>
          <Button onClick={onBack} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700">
            Tizimga kirish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-slate-50 to-emerald-50 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-emerald-600 items-center justify-center mb-3">
            <Store className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Restoran ro'yxatdan o'tkazish</h1>
          <p className="text-sm text-slate-500 mt-1">Yangi restoran uchun hisob yarating</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Restoran nomi</label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                placeholder="Mening Oshxonam"
                className="pl-10 h-11"
              />
            </div>
          </div>

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
            disabled={loading}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Ro\'yxatdan o\'tish'}
          </Button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 text-center">
          <button
            onClick={onBack}
            className="text-sm text-slate-500 hover:text-slate-700 font-medium flex items-center justify-center gap-1 mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Tizimga kirishga qaytish
          </button>
        </div>
      </div>
    </div>
  );
}
