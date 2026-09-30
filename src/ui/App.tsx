import { lazy, Suspense } from 'react';
import { Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Footer } from './Footer.tsx';
import { Header } from './Header.tsx';
import { HomePage } from './home/HomePage.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { NotFoundPage } from './pages/NotFoundPage.tsx';
import { PlayPage } from './pages/PlayPage.tsx';
import { ProgressPage } from './pages/ProgressPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { StorageNotice } from './StorageNotice.tsx';
import { useDocumentTitle } from './useDocumentTitle.ts';

// Notation (VexFlow and its font) is only downloaded when the Read route is opened.
const ReadPage = lazy(() => import('./pages/ReadPage.tsx').then((m) => ({ default: m.ReadPage })));
const EarPage = lazy(() => import('./pages/EarPage.tsx').then((m) => ({ default: m.EarPage })));
const HarmonyPage = lazy(() =>
  import('./harmony/HarmonyPage.tsx').then((m) => ({ default: m.HarmonyPage })),
);
// A progression is practised as a piece: Verovio, loaded by the score itself.
const ProgressionPage = lazy(() =>
  import('./harmony/ProgressionPage.tsx').then((m) => ({ default: m.ProgressionPage })),
);
// Pieces load Verovio on their own, later still (ui/notation/verovio.ts).
const PiecesPage = lazy(() =>
  import('./pieces/PiecesPage.tsx').then((m) => ({ default: m.PiecesPage })),
);
const PiecePage = lazy(() =>
  import('./pieces/PiecePage.tsx').then((m) => ({ default: m.PiecePage })),
);
// Scales draw with Verovio too, loaded by the page itself.
const ScalesPage = lazy(() =>
  import('./scales/ScalesPage.tsx').then((m) => ({ default: m.ScalesPage })),
);
// The lessons load their own texts, per lesson and language (ui/learn/lessons/).
const LearnPage = lazy(() =>
  import('./learn/LearnPage.tsx').then((m) => ({ default: m.LearnPage })),
);
const LessonPage = lazy(() =>
  import('./learn/LessonPage.tsx').then((m) => ({ default: m.LessonPage })),
);
const MetronomePage = lazy(() =>
  import('./metronome/MetronomePage.tsx').then((m) => ({ default: m.MetronomePage })),
);

export function App() {
  return (
    <Router hook={useHashLocation}>
      <Shell />
    </Router>
  );
}

function Shell() {
  useDocumentTitle();
  return (
    <>
      <Header />
      <main className="main" id="main">
        <StorageNotice />
        <Suspense fallback={null}>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/learn" component={LearnPage} />
            <Route path="/learn/:slug">{({ slug }) => <LessonPage key={slug} slug={slug} />}</Route>
            <Route path="/play" component={PlayPage} />
            <Route path="/read" component={ReadPage} />
            <Route path="/ear" component={EarPage} />
            <Route path="/harmony" component={HarmonyPage} />
            <Route path="/harmony/progressions/:progression/:key/:pattern">
              {({ progression, key, pattern }) => (
                <ProgressionPage
                  key={`${progression}/${key}/${pattern}`}
                  progression={progression}
                  keyName={key}
                  pattern={pattern}
                />
              )}
            </Route>
            <Route path="/scales" component={ScalesPage} />
            <Route path="/pieces" component={PiecesPage} />
            <Route path="/pieces/:id">{({ id }) => <PiecePage key={id} id={id} />}</Route>
            <Route path="/metronome" component={MetronomePage} />
            <Route path="/progress" component={ProgressPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/about" component={AboutPage} />
            <Route component={NotFoundPage} />
          </Switch>
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
