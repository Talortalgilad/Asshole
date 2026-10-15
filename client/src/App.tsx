import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { CardGallery } from './components/CardGallery';
import { DecksPanel, FirstDeckPicker } from './components/DecksPanel';
import { NeonScreen } from './components/NeonBackground';
import { Shell } from './components/Shell';
import { JoinByCodePage } from './pages/JoinByCodePage';
import { DecksPage } from './pages/DecksPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LobbyPage } from './pages/LobbyPage';
import { ProfilePage } from './pages/ProfilePage';
import { TablePage } from './pages/TablePage';

// route לכל מסך, כדי שכפתור "אחורה" של הדפדפן והטלפון יעבוד
const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/lobby" replace /> },
      { path: 'lobby', element: <LobbyPage /> },
      { path: 'table/:id', element: <TablePage /> },
      { path: 'join/:code', element: <JoinByCodePage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'leaderboard', element: <LeaderboardPage /> },
      { path: 'decks', element: <DecksPage /> },
      { path: '*', element: <Navigate to="/lobby" replace /> },
    ],
  },
]);

const params = new URLSearchParams(location.search);

export function App() {
  if (params.get('preview') === 'cards') return <CardGallery />; // דף כיוונון עיצוב
  if (params.get('preview') === 'decks') return <DecksPreview />; // דף תצוגה: בחירה ראשונה ורשימת חבילות עם נעילה (35 נקודות)
  if (params.get('preview') === 'crash') throw new Error('בדיקת Error Boundary (?preview=crash)');
  return <RouterProvider router={router} />;
}

function DecksPreview() {
  return (
    <NeonScreen>
      <div className="flex flex-col gap-6 pb-10">
        <FirstDeckPicker onPick={() => {}} onSkip={() => {}} />
        <div className="px-4"><DecksPanel points={35} current="classic" onPick={() => {}} /></div>
      </div>
    </NeonScreen>
  );
}
