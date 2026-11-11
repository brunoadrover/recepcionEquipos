import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { RecepcionesList } from './views/RecepcionesList';
import { NuevaRecepcionWizard } from './views/NuevaRecepcionWizard';
import { EquiposView } from './views/EquiposView';
import { AjustesView } from './views/AjustesView';
import { RecepcionDetalleModal } from './views/RecepcionDetalleModal';
import { RecepcionData } from './types';
import { getActiveObra, syncWithSupabaseRemote } from './lib/offlineStore';
import { testSupabaseConnection } from './lib/supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState<'recepciones' | 'equipos' | 'ajustes'>('recepciones');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingRecepcion, setEditingRecepcion] = useState<RecepcionData | null>(null);
  const [viewingRecepcion, setViewingRecepcion] = useState<RecepcionData | null>(null);
  const [activeObra, setActiveObraState] = useState<string>(() => getActiveObra());
  const [onlineStatus, setOnlineStatus] = useState<boolean>(true);

  // Sync active obra from custom event or storage
  useEffect(() => {
    const handleObraChange = () => {
      setActiveObraState(getActiveObra());
    };
    window.addEventListener('obra-changed', handleObraChange);
    return () => window.removeEventListener('obra-changed', handleObraChange);
  }, []);

  // Periodic network & Supabase health check
  useEffect(() => {
    const checkStatus = async () => {
      if (!navigator.onLine) {
        setOnlineStatus(false);
        return;
      }
      const test = await testSupabaseConnection();
      setOnlineStatus(test.success);
    };

    checkStatus();
    syncWithSupabaseRemote().catch(() => {});

    window.addEventListener('online', checkStatus);
    window.addEventListener('offline', () => setOnlineStatus(false));

    const interval = setInterval(checkStatus, 30000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', checkStatus);
      window.removeEventListener('offline', () => setOnlineStatus(false));
    };
  }, []);

  const handleStartNewRecepcion = () => {
    setEditingRecepcion(null);
    setIsWizardOpen(true);
  };

  const handleEditRecepcion = (rec: RecepcionData) => {
    setEditingRecepcion(rec);
    setIsWizardOpen(true);
  };

  const handleWizardFinish = (savedRec: RecepcionData) => {
    setIsWizardOpen(false);
    setEditingRecepcion(null);
    setActiveTab('recepciones');
    setViewingRecepcion(savedRec);
  };

  const handleWizardClose = () => {
    setIsWizardOpen(false);
    setEditingRecepcion(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Header - Always visible with active Obra selector */}
      <Header
        onNewRecepcion={handleStartNewRecepcion}
        activeTab={isWizardOpen ? 'wizard' : activeTab}
        setActiveTab={(tab) => {
          setIsWizardOpen(false);
          setActiveTab(tab as any);
        }}
        onlineStatus={onlineStatus}
      />

      {/* Main View Router */}
      <div className="flex-1">
        {isWizardOpen ? (
          <NuevaRecepcionWizard
            initialData={editingRecepcion}
            activeObra={activeObra}
            onClose={handleWizardClose}
            onFinish={handleWizardFinish}
          />
        ) : (
          <>
            {activeTab === 'recepciones' && (
              <RecepcionesList
                activeObra={activeObra}
                onNewRecepcion={handleStartNewRecepcion}
                onEditRecepcion={handleEditRecepcion}
                onViewRecepcion={(rec) => setViewingRecepcion(rec)}
              />
            )}

            {activeTab === 'equipos' && <EquiposView />}

            {activeTab === 'ajustes' && <AjustesView />}
          </>
        )}
      </div>

      {/* Reception Detail Fullscreen Inspection Modal */}
      {viewingRecepcion && (
        <RecepcionDetalleModal
          recepcion={viewingRecepcion}
          onClose={() => setViewingRecepcion(null)}
          onEdit={(rec) => {
            setViewingRecepcion(null);
            handleEditRecepcion(rec);
          }}
          onUpdated={(rec) => {
            setViewingRecepcion(rec);
          }}
        />
      )}

      {/* Mobile Bottom Navigation Bar (Hidden when Wizard is open to maximize screen) */}
      {!isWizardOpen && (
        <BottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setIsWizardOpen(false);
            setActiveTab(tab as any);
          }}
          onNewRecepcion={handleStartNewRecepcion}
        />
      )}

    </div>
  );
}
