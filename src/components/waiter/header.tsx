'use client';

import { useAuth } from '@/lib/auth-context';
import { LogOut, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReactElement } from 'react';

export interface HeaderProps {
  onHome: () => void;
  viewSwitcher?: ReactElement | null;
}

export function Header({ onHome, viewSwitcher }: HeaderProps) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.name.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onHome}
            className="px-2"
            aria-label="Bosh sahifa"
          >
            <Home className="h-5 w-5" />
          </Button>
          <div className="min-w-0 hidden sm:block">
            <div className="font-semibold text-slate-900 text-sm truncate">{user.name}</div>
            <div className="text-xs text-slate-500 truncate">
              {user.roleDisplayName ?? user.roleName ?? 'Xodim'}
            </div>
          </div>
        </div>

        {viewSwitcher}

        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold text-sm">
            {initials}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="px-2 text-slate-500"
            aria-label="Chiqish"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
