import type { ReactNode } from 'react';
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
  hideRail = false,
  children,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <TopBar isDemoData={isDemoData} />
      <div className={hideRail ? 'app-body app-body--no-rail' : 'app-body'}>
        {!hideRail && <FilterRail regions={regions} />}
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
