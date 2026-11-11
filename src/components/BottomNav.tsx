import React from 'react';
import { ClipboardList, PlusCircle, Truck, SlidersHorizontal } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewRecepcion: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onNewRecepcion,
}) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-safe">
      <div className="grid grid-cols-4 items-center h-16 max-w-md mx-auto">
        
        {/* 1. Inicio / Recepciones */}
        <button
          onClick={() => setActiveTab('recepciones')}
          className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
            activeTab === 'recepciones' ? 'text-[#0F2D3C]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <ClipboardList className={`w-5 h-5 ${activeTab === 'recepciones' ? 'stroke-[2.5]' : ''}`} />
            {activeTab === 'recepciones' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full" />
            )}
          </div>
          <span className={`text-[10px] mt-1 ${activeTab === 'recepciones' ? 'font-bold text-[#0F2D3C]' : 'font-medium'}`}>
            Inicio
          </span>
        </button>

        {/* 2. Nueva Recepción (Destacado) */}
        <button
          onClick={onNewRecepcion}
          className="min-h-[48px] flex flex-col items-center justify-center text-amber-600 hover:text-amber-700 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-amber-500 shadow-md flex items-center justify-center text-slate-950 -mt-3">
            <PlusCircle className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold text-slate-900 mt-0.5">
            Nueva
          </span>
        </button>

        {/* 3. Equipos y Propietarios */}
        <button
          onClick={() => setActiveTab('equipos')}
          className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
            activeTab === 'equipos' ? 'text-[#0F2D3C]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <Truck className={`w-5 h-5 ${activeTab === 'equipos' ? 'stroke-[2.5]' : ''}`} />
            {activeTab === 'equipos' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full" />
            )}
          </div>
          <span className={`text-[10px] mt-1 ${activeTab === 'equipos' ? 'font-bold text-[#0F2D3C]' : 'font-medium'}`}>
            Equipos
          </span>
        </button>

        {/* 4. Ajustes */}
        <button
          onClick={() => setActiveTab('ajustes')}
          className={`min-h-[48px] flex flex-col items-center justify-center transition-colors ${
            activeTab === 'ajustes' ? 'text-[#0F2D3C]' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="relative">
            <SlidersHorizontal className={`w-5 h-5 ${activeTab === 'ajustes' ? 'stroke-[2.5]' : ''}`} />
            {activeTab === 'ajustes' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full" />
            )}
          </div>
          <span className={`text-[10px] mt-1 ${activeTab === 'ajustes' ? 'font-bold text-[#0F2D3C]' : 'font-medium'}`}>
            Ajustes
          </span>
        </button>

      </div>
    </div>
  );
};
