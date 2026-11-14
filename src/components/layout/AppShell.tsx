import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { RegionMetaRecord } from '../../contracts/schemas';
import { FilterRail } from './FilterRail';
import { TopBar } from './TopBar';

export interface AppShellProps {
  regions: readonly RegionMetaRecord[];
  isDemoData: boolean;
  hideRail?: boolean;
  children: ReactNode;
}

export function AppShell({
  regions,
  isDemoData,
  hideRail,
  children,
}: AppShellProps) {
  const { pathname } = useLocation();
  const shouldHideRail =
    hideRail ?? (pathname.startsWith('/about') || pathname.startsWith('/firecast'));

  return (
    <div className="app-shell">
      <div className="orbital-bg-stage" aria-hidden="true" />
      <TopBar isDemoData={isDemoData} />
      <div className={shouldHideRail ? 'app-body app-body--no-rail' : 'app-body'}>
        {!shouldHideRail && <FilterRail regions={regions} />}
        <main
          style={{
            padding: '14px 16px 28px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
