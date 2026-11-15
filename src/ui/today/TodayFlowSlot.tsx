import { lazy, Suspense } from 'react';
import { useRouteSearch } from '../hashRoute.ts';
import { isTodayOrigin } from '../startParams.ts';

// Loaded on demand only when a route carries from=today, keeping startup free of TodayPlan.
const TodayNextBar = lazy(() => import('./TodayNextBar.tsx'));

/** Renders the Today flow bar slot only on routes opened from Today's plan. */
export function TodayFlowSlot() {
  if (!isTodayOrigin(useRouteSearch())) return null;
  return (
    <Suspense fallback={null}>
      <TodayNextBar />
    </Suspense>
  );
}
