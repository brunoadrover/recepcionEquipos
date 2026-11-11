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
  RefreshCw,
} from 'lucide-react';
import {
  getStoredSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../lib/supabase';
import {
  getCompanyLogo,
  saveCompanyLogo,
} from '../lib/offlineStore';
import {
  fetchPropietariosDirect,
  createPropietarioDirect,
  deletePropietarioDirect,
  fetchSectoresDirect,
  createSectorDirect,
  deleteSectorDirect,
  fetchFiltrosDirect,
  createFiltroDirect,
  deleteFiltroDirect,
  fetchResponsablesDirect,
  createResponsableDirect,
  deleteResponsableDirect,
} from '../lib/supabaseService';
import { PlanListaSector, FiltrosLista, Responsable, Propietario } from '../types';
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
  const [propietarios, setPropietarios] = useState<Propietario[]>([]);
  const [sectores, setSectores] = useState<PlanListaSector[]>([]);
  const [filtros, setFiltros] = useState<FiltrosLista[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);

  // Input states for quick add
  const [newPropRazon, setNewPropRazon] = useState('');
  const [newPropCuit, setNewPropCuit] = useState('');
  const [newPropContacto, setNewPropContacto] = useState('');
  const [isSubmittingProp, setIsSubmittingProp] = useState(false);

  const [newSector, setNewSector] = useState('');
  const [newFiltro, setNewFiltro] = useState('');
  const [newResponsable, setNewResponsable] = useState('');

  // Status message for catalog operations
  const [catalogFeedback, setCatalogFeedback] = useState<{ msg: string; isError?: boolean } | null>(null);

  useEffect(() => {
    const config = getStoredSupabaseConfig();
    setSupabaseUrl(config.rawUrl || config.url);
    setSupabaseKey(config.anonKey);
    setSupabaseBucket(config.bucket);

    setCompanyLogo(getCompanyLogo());
    refreshCatalogs();
  }, []);

  const refreshCatalogs = async () => {
    setIsLoadingCatalogs(true);
    setCatalogFeedback(null);
    try {
      const [pRes, sRes, fRes, rRes] = await Promise.all([
        fetchPropietariosDirect(),
        fetchSectoresDirect(),
        fetchFiltrosDirect(),
        fetchResponsablesDirect(),
      ]);

      if (pRes.data) setPropietarios(pRes.data);
      if (sRes.data) setSectores(sRes.data);
      if (fRes.data) setFiltros(fRes.data);
      if (rRes.data) setResponsables(rRes.data);
    } catch (err: any) {
      console.warn('Error refreshing catalogs from Supabase:', err);
    } finally {
      setIsLoadingCatalogs(false);
    }
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
    if (result.success) {
      refreshCatalogs();
    }
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

  // Add Propietario directly to Supabase
  const handleAddPropietario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropRazon.trim()) return;
    setIsSubmittingProp(true);
    const res = await createPropietarioDirect({
      razon_social: newPropRazon.trim(),
      cuit: newPropCuit.trim() || null,
      nombre_contacto: newPropContacto.trim() || null,
    });

    if (res.error) {
      setCatalogFeedback({ msg: `Error en tabla propietario: ${res.error}`, isError: true });
    } else {
      setCatalogFeedback({ msg: `Propietario "${newPropRazon}" guardado exitosamente en Supabase.` });
      setNewPropRazon('');
      setNewPropCuit('');
      setNewPropContacto('');
      await refreshCatalogs();
    }
    setIsSubmittingProp(false);
  };

  const handleDeletePropietario = async (id: string) => {
    if (window.confirm('¿Eliminar este propietario de Supabase?')) {
      const res = await deletePropietarioDirect(id);
      if (res.error) {
        setCatalogFeedback({ msg: `Error al eliminar: ${res.error}`, isError: true });
      } else {
        setCatalogFeedback({ msg: 'Propietario eliminado de la base de datos.' });
        await refreshCatalogs();
      }
    }
  };

  // Add Sector
  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSector.trim()) return;
    const res = await createSectorDirect(newSector.trim());
    if (res.error) {
      setCatalogFeedback({ msg: `Error en plan_lista_sector: ${res.error}`, isError: true });
    } else {
      setCatalogFeedback({ msg: `Sector guardado en Supabase.` });
      setNewSector('');
      await refreshCatalogs();
    }
  };

  const handleDeleteSector = async (id: string) => {
    await deleteSectorDirect(id);
    await refreshCatalogs();
  };

  // Add Filtro
  const handleAddFiltro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFiltro.trim()) return;
    const res = await createFiltroDirect(newFiltro.trim());
    if (res.error) {
      setCatalogFeedback({ msg: `Error en filtros_lista: ${res.error}`, isError: true });
    } else {
      setCatalogFeedback({ msg: `Tipo de filtro guardado en Supabase.` });
      setNewFiltro('');
      await refreshCatalogs();
    }
  };

  const handleDeleteFiltro = async (id: string) => {
    await deleteFiltroDirect(id);
    await refreshCatalogs();
  };

  // Add Responsable
  const handleAddResponsable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResponsable.trim()) return;
    const res = await createResponsableDirect(newResponsable.trim());
    if (res.error) {
      setCatalogFeedback({ msg: `Error en responsable: ${res.error}`, isError: true });
    } else {
      setCatalogFeedback({ msg: `Responsable guardado en Supabase.` });
      setNewResponsable('');
      await refreshCatalogs();
    }
  };

  const handleDeleteResponsable = async (id: string) => {
    await deleteResponsableDirect(id);
    await refreshCatalogs();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-8">
      
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-amber-500" />
          Ajustes y Configuración de Base de Datos
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Parámetros de conexión con Supabase (REST API y Storage), logo para PDF y catálogos maestros.
        </p>
      </div>

      {/* 1. SECCIÓN: CONEXIÓN SUPABASE */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#0F2D3C]" />
            <h2 className="text-base font-bold text-slate-900">Conexión con Supabase</h2>
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
              placeholder="https://nlttnkqilffbaauthern.supabase.co"
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
                    ? 'Conexión activa con la base de datos PostgreSQL de Supabase.'
                    : 'Verificá que la URL y la API key coincidan con el proyecto de Supabase.'}
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
              className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-2 border border-slate-300 transition-colors"
            >
              <RotateCw className={`w-4 h-4 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Probando conexión...' : 'Probar Conexión con Supabase'}</span>
            </button>

            <button
              type="submit"
              className="min-h-[44px] px-6 py-2 bg-[#0F2D3C] hover:bg-[#163e52] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </form>
      </div>

      {/* Feedback banner for catalog actions */}
      {catalogFeedback && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
          catalogFeedback.isError
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex items-center gap-2">
            {catalogFeedback.isError ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span className="font-semibold">{catalogFeedback.msg}</span>
          </div>
          <button
            onClick={() => setCatalogFeedback(null)}
            className="text-slate-500 hover:text-slate-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. SECCIÓN: TABLA PROPIETARIO (ABM Directo en Supabase) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-[#0F2D3C]" />
            <h2 className="text-base font-bold text-slate-900">
              Tabla <span className="font-mono text-amber-700">propietario</span>
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded font-mono">
              {propietarios.length} registros
            </span>
          </div>
          <button
            onClick={refreshCatalogs}
            disabled={isLoadingCatalogs}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            title="Sincronizar tabla"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingCatalogs ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Empresas y dueños de equipos. Cada registro se almacena directamente con clave primaria UUID en Supabase.
        </p>

        {/* Formulario rápido para alta de Propietario */}
        <form onSubmit={handleAddPropietario} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-4 space-y-3">
          <span className="text-xs font-bold text-slate-800 block">Agregar nuevo propietario:</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              required
              value={newPropRazon}
              onChange={(e) => setNewPropRazon(e.target.value)}
              placeholder="Razón Social * (ej. VialSur S.A.)"
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              value={newPropCuit}
              onChange={(e) => setNewPropCuit(e.target.value)}
              placeholder="CUIT (ej. 30712345678)"
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={newPropContacto}
                onChange={(e) => setNewPropContacto(e.target.value)}
                placeholder="Contacto (ej. Juan Pérez)"
                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={isSubmittingProp}
                className="px-3.5 py-2 bg-[#0F2D3C] hover:bg-[#163e52] text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSubmittingProp ? 'Guardando...' : 'Agregar'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Listado de Propietarios */}
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
          {propietarios.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 italic">
              No hay registros en la tabla propietario de Supabase.
            </div>
          ) : (
            propietarios.map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{p.razon_social}</span>
                    {p.cuit && (
                      <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                        CUIT: {p.cuit}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono block truncate">
                    UUID: {p.id}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePropietario(p.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                  title="Eliminar propietario"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. SECCIÓN: CATÁLOGOS SECTORES, FILTROS Y RESPONSABLES */}
      <div className="space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Catálogos de Parámetros en Supabase
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Catálogo 1: Sectores (plan_lista_sector) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Sectores / Componentes</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-bold">{sectores.length}</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3 font-mono">plan_lista_sector</p>

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
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Tipos de Filtro</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-bold">{filtros.length}</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3 font-mono">filtros_lista</p>

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
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">Personal Responsable</h3>
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-bold">{responsables.length}</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3 font-mono">responsable</p>

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

      {/* 4. SECCIÓN: LOGO DE LA EMPRESA */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="w-5 h-5 text-[#0F2D3C]" />
          <h2 className="text-base font-bold text-slate-900">Logo Institucional para el Acta en PDF</h2>
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

    </div>
  );
};
