import React, { useState, useEffect } from 'react';
import { HardHat, ChevronDown, CheckCircle2, CloudOff, RefreshCw, Plus, Building2 } from 'lucide-react';
import { getObras, getActiveObra, setActiveObra, saveObra, syncWithSupabaseRemote } from '../lib/offlineStore';
import { ObraItem } from '../types';

interface HeaderProps {
  onNewRecepcion: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onlineStatus: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onNewRecepcion,
  activeTab,
  setActiveTab,
  onlineStatus,
}) => {
  const [obras, setObras] = useState<ObraItem[]>([]);
  const [selectedObra, setSelectedObraState] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showNewObraModal, setShowNewObraModal] = useState(false);
  const [newObraNombre, setNewObraNombre] = useState('');
  const [newObraCodigo, setNewObraCodigo] = useState('');

  useEffect(() => {
    const list = getObras();
    setObras(list);
    const active = getActiveObra();
    setSelectedObraState(active);
  }, []);

  const handleSelectObra = (nombre: string) => {
    setActiveObra(nombre);
    setSelectedObraState(nombre);
    setIsDropdownOpen(false);
    window.dispatchEvent(new Event('obra-changed'));
  };

  const handleCreateObra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newObraNombre.trim()) return;
    const newObra: ObraItem = {
      id: 'obra-' + Date.now(),
      codigo_uo: newObraCodigo.trim() || 'UO-' + Math.floor(100 + Math.random() * 900),
      nombre: newObraNombre.trim(),
    };
    saveObra(newObra);
    const updated = getObras();
    setObras(updated);
    handleSelectObra(newObra.nombre);
    setShowNewObraModal(false);
    setNewObraNombre('');
    setNewObraCodigo('');
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncWithSupabaseRemote();
    setTimeout(() => setIsSyncing(false), 600);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#0F2D3C] text-white shadow-md border-b border-slate-700/60">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Brand title */}
          <div 
            onClick={() => setActiveTab('recepciones')} 
            className="flex items-center gap-2 cursor-pointer shrink-0"
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-inner">
              <HardHat className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-sm sm:text-base text-white">CONTROL OBRAS</span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded">RECEPCIÓN</span>
              </div>
              <p className="text-[10px] text-slate-300 hidden sm:block">Relevamiento de Equipos de Terceros</p>
            </div>
          </div>

          {/* Selector de Obra Activa - Visible en todo momento */}
          <div className="relative flex-1 max-w-xs sm:max-w-sm">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-600/70 rounded-lg text-left text-xs sm:text-sm text-slate-100 transition-colors"
              title="Obra activa seleccionada"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 block sm:hidden">Obra actual</span>
                  <span className="font-semibold truncate block">{selectedObra || 'Seleccionar Obra'}</span>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 z-50 max-h-72 overflow-y-auto">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                  <span>OBRAS DISPONIBLES</span>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      setShowNewObraModal(true);
                    }}
                    className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 text-[11px]"
                  >
                    <Plus className="w-3 h-3" /> Nueva
                  </button>
                </div>
                {obras.map((obra) => {
                  const isSelected = obra.nombre === selectedObra;
                  return (
                    <button
                      key={obra.id}
                      onClick={() => handleSelectObra(obra.nombre)}
                      className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-800 transition-colors ${
                        isSelected ? 'bg-amber-500/15 text-amber-300 font-bold' : 'text-slate-200'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="text-[10px] text-slate-400 mr-1.5 font-mono">[{obra.codigo_uo}]</span>
                        <span className="truncate">{obra.nombre}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Desktop Navigation Links & Action */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold text-slate-300">
            <button
              onClick={() => setActiveTab('recepciones')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'recepciones' ? 'bg-slate-800 text-white font-bold' : 'hover:text-white'
              }`}
            >
              Recepciones
            </button>
            <button
              onClick={() => setActiveTab('equipos')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'equipos' ? 'bg-slate-800 text-white font-bold' : 'hover:text-white'
              }`}
            >
              Equipos y Propietarios
            </button>
            <button
              onClick={() => setActiveTab('ajustes')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                activeTab === 'ajustes' ? 'bg-slate-800 text-white font-bold' : 'hover:text-white'
              }`}
            >
              Ajustes y Catálogos
            </button>
          </nav>

          {/* Right actions: Sync status & New Recepcion button */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleManualSync}
              title={onlineStatus ? 'Conectado con Supabase. Clic para forzar sincronización' : 'Sin conexión / Modo local seguro'}
              className="flex items-center gap-1.5 px-2 py-1 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-md text-[11px] text-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline font-mono">
                {onlineStatus ? 'Supabase OK' : 'Local'}
              </span>
            </button>

            <button
              onClick={onNewRecepcion}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden xs:inline">Nueva Recepción</span>
              <span className="xs:hidden">Nueva</span>
            </button>
          </div>

        </div>
      </header>

      {/* Modal for adding a new Obra */}
      {showNewObraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Agregar Nueva Obra</h3>
            <p className="text-xs text-slate-500 mb-4">Ingresá el nombre y código de unidad operativa.</p>
            <form onSubmit={handleCreateObra} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre de Obra</label>
                <input
                  type="text"
                  required
                  value={newObraNombre}
                  onChange={(e) => setNewObraNombre(e.target.value)}
                  placeholder="ej. Autovía Ruta 11 Km 320"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Código UO</label>
                <input
                  type="text"
                  value={newObraCodigo}
                  onChange={(e) => setNewObraCodigo(e.target.value)}
                  placeholder="ej. UO-510"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewObraModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm"
                >
                  Guardar Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
