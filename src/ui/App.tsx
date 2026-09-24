import { lazy, Suspense } from 'react';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Header } from './Header.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { PlayPage } from './pages/PlayPage.tsx';
import { ProgressPage } from './pages/ProgressPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { StorageNotice } from './StorageNotice.tsx';

// Notation (VexFlow and its font) is only downloaded when the Read route is opened.
const ReadPage = lazy(() => import('./pages/ReadPage.tsx').then((m) => ({ default: m.ReadPage })));

export function App() {
  return (
    <Router hook={useHashLocation}>
      <Header />
      <main className="main" id="main">
        <StorageNotice />
        <Suspense fallback={null}>
          <Switch>
            <Route path="/" component={PlayPage} />
            <Route path="/read" component={ReadPage} />
            <Route path="/progress" component={ProgressPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route component={NotFoundPage} />
          </Switch>
        </Suspense>
      </main>
    </Router>
  );
}
