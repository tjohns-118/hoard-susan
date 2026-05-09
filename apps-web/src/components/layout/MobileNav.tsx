'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/app/store/useAppStore';

const AGENT_TABS = [
  { href: '/',            label: 'Home',     icon: '⌂' },
  { href: '/leads',       label: 'Leads',    icon: '◈' },
  { href: '/contacts',    label: 'Contacts', icon: '◉' },
  { href: '/tasks',       label: 'Tasks',    icon: '✦' },
  { href: '/calendar',    label: 'Calendar', icon: '◻' },
];

const BROKER_TABS = [
  { href: '/',            label: 'Home',      icon: '⌂' },
  { href: '/leads',       label: 'Leads',     icon: '◈' },
  { href: '/oversight',   label: 'Oversight', icon: '◎' },
  { href: '/tasks',       label: 'Tasks',     icon: '✦' },
  { href: '/settings',    label: 'Settings',  icon: '◫' },
];

export function MobileNav() {
  const pathname    = usePathname();
  const currentRole = useAppStore((s) => s.currentRole);
  const tabs        = currentRole === 'broker' ? BROKER_TABS : AGENT_TABS;

  return (
    <nav className="r-mobile-bottom-nav" aria-label="Mobile navigation">
      {tabs.map(({ href, label, icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`r-mob-tab${active ? ' active' : ''}`}
          >
            <span className="r-mob-tab-icon">{icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
