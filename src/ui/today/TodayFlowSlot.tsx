import { lazy, Suspense } from 'react';
import { useRouteSearch } from '../hashRoute.ts';
import { isTodayOrigin, parseAssignmentOrigin } from '../startParams.ts';

// Loaded on demand only when a route carries from=today or assignment=<id>, keeping startup free
// of TodayPlan and assignment progress rules.
const TodayNextBar = lazy(() => import('./TodayNextBar.tsx'));
const AssignmentNextBar = lazy(() => import('../assignments/AssignmentNextBar.tsx'));

/** Renders the Today or Assignment flow bar slot when a route carries its origin marker. */
export function TodayFlowSlot() {
  const search = useRouteSearch();
  if (isTodayOrigin(search)) {
    return (
      <Suspense fallback={null}>
        <TodayNextBar />
      </Suspense>
    );
  }
  const assignmentId = parseAssignmentOrigin(search);
  if (assignmentId) {
    return (
      <Suspense fallback={null}>
        <AssignmentNextBar assignmentId={assignmentId} />
      </Suspense>
    );
  }
  return null;
}
