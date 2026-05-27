import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardPage  from './pages/DashboardPage.jsx';
import OnboardingPage from './pages/OnboardingPage.jsx';
import CallPage       from './pages/CallPage.jsx';
import DebriefPage    from './pages/DebriefPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/"           element={<DashboardPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/call"       element={<CallPage />} />
      <Route path="/debrief"    element={<DebriefPage />} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}
