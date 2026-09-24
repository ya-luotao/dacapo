import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Header } from './Header.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { PlayPage } from './pages/PlayPage.tsx';
import { ProgressPage } from './pages/ProgressPage.tsx';
import { ReadPage } from './pages/ReadPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

export function App() {
  return (
    <Router hook={useHashLocation}>
      <Header />
      <main className="main" id="main">
        <Switch>
          <Route path="/" component={PlayPage} />
          <Route path="/read" component={ReadPage} />
          <Route path="/progress" component={ProgressPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFoundPage} />
        </Switch>
      </main>
    </Router>
  );
}
