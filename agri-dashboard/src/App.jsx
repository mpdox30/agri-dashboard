// src/App.jsx
import { useState } from 'react';
import TopBar from './components/TopBar';
import Homepage from './pages/Homepage';
import CommunityView from './pages/CommunityView';
import EntryForm from './pages/EntryForm';
import ApprovalQueue from './pages/ApprovalQueue';
import DataQuality from './pages/DataQuality';
import ExecutiveSummary from './pages/ExecutiveSummary';

export default function App() {
  const [mode, setMode] = useState('public');

  return (
    <>
      <TopBar activeMode={mode} onModeChange={setMode} />
      {mode === 'public' && <Homepage />}
      {mode === 'internal' && <CommunityView />}
      {mode === 'entry' && <EntryForm />}
      {mode === 'approval' && <ApprovalQueue />}
      {mode === 'dataquality' && <DataQuality />}
      {mode === 'executive' && <ExecutiveSummary />}
    </>
  );
}
