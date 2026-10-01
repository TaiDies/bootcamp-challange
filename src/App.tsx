/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { PlayerView } from './components/PlayerView.tsx';
import { AdminLogin } from './components/AdminLogin.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { HowToPlay } from './components/HowToPlay.tsx';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'play' | 'admin' | 'how-to'>('play');
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return localStorage.getItem('admin_quiz_token') || null;
  });
  const [initialRoomId, setInitialRoomId] = useState<string>('HAMMAM');

  // Read URL query parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const tab = params.get('tab');

    if (room) {
      setInitialRoomId(room.toUpperCase());
      setCurrentTab('play');
    }
    if (tab === 'admin') {
      setCurrentTab('admin');
    }
  }, []);

  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    localStorage.setItem('admin_quiz_token', token);
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('admin_quiz_token');
    setCurrentTab('play');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-black">
      {/* Universal Top Bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        isAdminLoggedIn={Boolean(adminToken)}
        activeRoomId={initialRoomId}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {currentTab === 'play' && (
          <PlayerView
            initialRoomId={initialRoomId}
            onGoToAdmin={() => setCurrentTab('admin')}
          />
        )}

        {currentTab === 'admin' && (
          adminToken ? (
            <AdminDashboard
              adminToken={adminToken}
              onLogout={handleAdminLogout}
              onSelectRoomForPlaying={(roomId) => {
                setInitialRoomId(roomId);
                setCurrentTab('play');
              }}
            />
          ) : (
            <AdminLogin
              onSuccess={handleAdminLoginSuccess}
              onCancel={() => setCurrentTab('play')}
            />
          )
        )}

        {currentTab === 'how-to' && (
          <HowToPlay onStartPlaying={() => setCurrentTab('play')} />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>مسابقة التحدي التفاعلية · نظام متعدد اللاعبين فوري مع النقاط والسرعة وتتويج الفائزين</p>
          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setCurrentTab('how-to')}
              className="hover:text-amber-400 transition-colors"
            >
              دليل القواعد
            </button>
            <span>·</span>
            <button
              onClick={() => setCurrentTab('admin')}
              className="hover:text-amber-400 transition-colors"
            >
              بوابة المضيف
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
