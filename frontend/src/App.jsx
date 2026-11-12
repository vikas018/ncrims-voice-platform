import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spinner } from './components/ui.jsx';
import AppShell from './components/AppShell.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Campaigns from './pages/Campaigns.jsx';
import CallLogs from './pages/CallLogs.jsx';
import Billing from './pages/Billing.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
// Isolated test feature — Claude-driven Hindi voice chat, gated by a flag.
import ClaudeVoiceTest from './features/claude-voice/ClaudeVoiceTest.jsx';

const CLAUDE_VOICE_ENABLED = import.meta.env.VITE_ENABLE_CLAUDE_VOICE === 'true';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      {/* Standalone, no-auth test route for the Claude voice feature. */}
      {CLAUDE_VOICE_ENABLED && <Route path="/voice-test" element={<ClaudeVoiceTest />} />}
      <Route
        path="/"
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="calls" element={<CallLogs />} />
        <Route path="billing" element={<Billing />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
