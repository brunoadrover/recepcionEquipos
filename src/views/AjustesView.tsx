import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  Database,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Image as ImageIcon,
  RotateCw,
  Save,
  Layers,
  Filter,
  Users,
  Building,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';
import {
  getSectores,
  saveSector,
  deleteSector,
  getFiltros,
  saveFiltro,
  deleteFiltro,
  getResponsables,
  saveResponsable,
  deleteResponsable,
  getCompanyLogo,
  saveCompanyLogo,
} from '../lib/offlineStore';
import { PlanListaSector, FiltrosLista, Responsable } from '../types';
import { fileToDataUrl } from '../lib/imageCompressor';

export const AjustesView: React.FC = () => {
  // Supabase Config State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseBucket, setSupabaseBucket] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveConfigMsg, setSaveConfigMsg] = useState(false);

  // Logo State
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Catalogs State
  const [sectores, setSectores] = useState<PlanListaSector[]>([]);
  const [filtros, setFiltros] = useState<FiltrosLista[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);

  // Input states for quick add
  const [newSector, setNewSector] = useState('');
  const [newFiltro, setNewFiltro] = useState('');
  const [newResponsable, setNewResponsable] = useState('');

  useEffect(() => {
    const config = getStoredSupabaseConfig();
    setSupabaseUrl(config.rawUrl || config.url);
    setSupabaseKey(config.anonKey);
    setSupabaseBucket(config.bucket);

    setCompanyLogo(getCompanyLogo());
    refreshCatalogs();
  }, []);

  const refreshCatalogs = () => {
    setSectores(getSectores());
    setFiltros(getFiltros());
    setResponsables(getResponsables());
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(supabaseUrl, supabaseKey, supabaseBucket);
    setSaveConfigMsg(true);
    setTimeout(() => setSaveConfigMsg(false), 2500);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    saveSupabaseConfig(supabaseUrl, supabaseKey, supabaseBucket);
    const result = await testSupabaseConnection();
    setTestResult(result);
    setIsTesting(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      saveCompanyLogo(dataUrl);
      setCompanyLogo(dataUrl);
    } catch (err) {
      console.error('Error loading logo:', err);
    }
  };

  const handleAddSector = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSector.trim()) return;
    const item: PlanListaSector = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'sec-' + Date.now(),
      sector: newSector.trim(),
    };
    saveSector(item);
    setNewSector('');
    refreshCatalogs();
  };

  const handleDeleteSector = (id: string) => {
    deleteSector(id);
    refreshCatalogs();
  };

  const handleAddFiltro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFiltro.trim()) return;
    const item: FiltrosLista = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'filt-' + Date.now(),
      tipo: newFiltro.trim(),
    };
    saveFiltro(item);
    setNewFiltro('');
    refreshCatalogs();
  };

  const handleDeleteFiltro = (id: string) => {
    deleteFiltro(id);
    refreshCatalogs();
  };

  const handleAddResponsable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResponsable.trim()) return;
    const item: Responsable = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'resp-' + Date.now(),
      nombre: newResponsable.trim(),
    };
    saveResponsable(item);
    setNewResponsable('');
    refreshCatalogs();
  };

  const handleDeleteResponsable = (id: string) => {
    deleteResponsable(id);
    refreshCatalogs();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-8">
      
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-500" />
          Ajustes y Configuración del Sistema
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Parámetros de conexión con Supabase (Base de datos y Storage), logo institucional y catálogos de obra.
        </p>
      </div>

      {/* 1. SECCIÓN: CONEXIÓN SUPABASE */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#0F2D3C]" />
            <h2 className="text-base font-bold text-slate-900">Configuración de Supabase</h2>
          </div>
          {saveConfigMsg && (
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full animate-fade-in flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> Parámetros guardados
            </span>
          )}
        </div>

        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              URL del Proyecto Supabase (VITE_SUPABASE_URL)
            </label>
            <input
              type="text"
              required
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              API Anon Key (VITE_SUPABASE_ANON_KEY)
            </label>
            <input
              type="password"
              required
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="sb_publishable_..."
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Bucket de Supabase Storage para Fotos y Documentos
            </label>
            <input
              type="text"
              required
              value={supabaseBucket}
              onChange={(e) => setSupabaseBucket(e.target.value)}
              placeholder="recepciones"
              className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-red-50 border-red-300 text-red-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold">{testResult.message}</p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  {testResult.success
                    ? 'La base de datos y la conexión con Supabase responden correctamente.'
                    : 'Si la señal es débil en la obra, la app guarda todo en modo local y sincroniza al volver la conexión.'}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-300"
            >
              <RotateCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Probando conexión...' : 'Probar Conexión'}</span>
            </button>

            <button
              type="submit"
              className="min-h-[44px] px-6 py-2 bg-[#0F2D3C] hover:bg-[#163e52] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. SECCIÓN: LOGO DE LA EMPRESA */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="w-5 h-5 text-[#0F2D3C]" />
          <h2 className="text-base font-bold text-slate-900">Logo Institucional para el PDF</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Este logo se incluirá en el encabezado oficial de todas las actas de recepción generadas en PDF.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="w-36 h-20 bg-white border border-slate-300 rounded-xl overflow-hidden flex items-center justify-center p-2 shadow-inner">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo empresa" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[11px] text-slate-400 font-semibold text-center">Sin logo cargado</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="min-h-[40px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold"
              >
                Cargar imagen del logo
              </button>
              {companyLogo && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('app_company_logo');
                    setCompanyLogo(null);
                  }}
                  className="min-h-[40px] px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold"
                >
                  Quitar logo
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Formatos recomendados: PNG o JPG con fondo transparente o blanco.</p>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>
      </div>

      {/* 3. SECCIÓN: CATÁLOGOS DEL SISTEMA (ABM) */}
      <div className="space-y-6">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">Catálogos de Parámetros</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Catálogo 1: Sectores (plan_lista_sector) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Sectores / Componentes</h3>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Tabla: plan_lista_sector</p>

              {/* Add form */}
              <form onSubmit={handleAddSector} className="flex gap-1.5 mb-3">
                <input
                  type="text"
                  value={newSector}
                  onChange={(e) => setNewSector(e.target.value)}
                  placeholder="Nuevo sector..."
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-[#0F2D3C] text-white text-xs font-bold rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* Items List */}
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                {sectores.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-800 font-medium truncate">{s.sector}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSector(s.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Catálogo 2: Filtros (filtros_lista) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Filter className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Tipos de Filtro</h3>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Tabla: filtros_lista</p>

              {/* Add form */}
              <form onSubmit={handleAddFiltro} className="flex gap-1.5 mb-3">
                <input
                  type="text"
                  value={newFiltro}
                  onChange={(e) => setNewFiltro(e.target.value)}
                  placeholder="Nuevo tipo filtro..."
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-[#0F2D3C] text-white text-xs font-bold rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* Items List */}
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                {filtros.map((f) => (
                  <div key={f.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-800 font-medium truncate">{f.tipo}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteFiltro(f.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Catálogo 3: Responsables (responsable) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">Personal Responsable</h3>
              </div>
              <p className="text-[11px] text-slate-500 mb-3">Tabla: responsable</p>

              {/* Add form */}
              <form onSubmit={handleAddResponsable} className="flex gap-1.5 mb-3">
                <input
                  type="text"
                  value={newResponsable}
                  onChange={(e) => setNewResponsable(e.target.value)}
                  placeholder="Nombre y cargo..."
                  className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-[#0F2D3C] text-white text-xs font-bold rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* Items List */}
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                {responsables.map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-800 font-medium truncate">{r.nombre}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteResponsable(r.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
