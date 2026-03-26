import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RateGrid from './pages/RateGrid';
import RateHistory from './pages/RateHistory';
import ParityAlerts from './pages/ParityAlerts';
import RateChanges from './pages/RateChanges';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Setup from './pages/Setup';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/rate-grid" element={<RateGrid />} />
        <Route path="/rate-history" element={<RateHistory />} />
        <Route path="/parity-alerts" element={<ParityAlerts />} />
        <Route path="/rate-changes" element={<RateChanges />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
