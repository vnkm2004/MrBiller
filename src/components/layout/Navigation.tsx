import { useTranslation } from 'react-i18next';
import { ReceiptIndianRupee, LayoutDashboard, History, Settings, Package } from 'lucide-react';
import type { Page } from '../../types';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; icon: typeof ReceiptIndianRupee }[] = [
  { id: 'billing', icon: ReceiptIndianRupee },
  { id: 'inventory', icon: Package },
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'history', icon: History },
  { id: 'settings', icon: Settings },
];

// Desktop sidebar navigation
export function SidebarNav({ currentPage, onNavigate }: NavigationProps) {
  const { t } = useTranslation();

  return (
    <nav className="hidden md:flex flex-col gap-1 w-16 lg:w-56 border-r border-default bg-card min-h-screen py-4 sticky top-0">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = currentPage === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 px-4 py-3 transition-all ${
              active
                ? 'text-accent border-r-2 border-accent bg-accent/5'
                : 'text-secondary hover:text-primary hover:bg-secondary'
            }`}
          >
            <Icon size={22} />
            <span className="hidden lg:block font-medium">{t(`nav.${item.id}`)}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Mobile bottom navigation
export function BottomNav({ currentPage, onNavigate }: NavigationProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label="Main navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-default safe-bottom z-40">
      <div className="flex items-center justify-around gap-1 px-2 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
              className={`nav-item flex-1 ${
                active ? 'text-accent' : 'text-muted'
              } min-h-12 px-1`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{t(`nav.${item.id}`)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
