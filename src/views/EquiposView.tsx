import React, { useState, useEffect } from 'react';
import {
  Truck,
  Users,
  Plus,
  Trash2,
  Edit2,
  Search,
  X,
  Check,
  Phone,
  Mail,
  Building,
  RefreshCw,
  Database,
  AlertCircle,
} from 'lucide-react';
import { Propietario, RecepcionData } from '../types';
import {
  getPropietarios,
  savePropietario,
  deletePropietario,
  getRecepciones,
  saveRecepcion,
  getActiveObra,
} from '../lib/offlineStore';
import {
  fetchPropietariosDirect,
  fetchEquiposDirect,
  ensureValidUuid,
} from '../lib/supabaseService';
import { syncRecepcionToSupabase } from '../lib/supabase';
import { formatNumeroArg } from '../lib/pdfGenerator';

export const EquiposView: React.FC = () => {
  const [subTab, setSubTab] = useState<'propietarios' | 'equipos'>('propietarios');
  const [propietarios, setPropietarios] = useState<Propietario[]>(() => getPropietarios());
  const [recepciones, setRecepciones] = useState<RecepcionData[]>(() => getRecepciones());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Propietario modal
  const [showPropModal, setShowPropModal] = useState(false);
  const [editingProp, setEditingProp] = useState<Propietario | null>(null);
  const [propRazon, setPropRazon] = useState('');
  const [propCuit, setPropCuit] = useState('');
  const [propContacto, setPropContacto] = useState('');
  const [propTel, setPropTel] = useState('');
  const [propCorreo, setPropCorreo] = useState('');
  const [propModalError, setPropModalError] = useState<string | null>(null);
  const [isSavingProp, setIsSavingProp] = useState(false);

  // Equipo modal
  const [showEquipoModal, setShowEquipoModal] = useState(false);
  const [eqInterno, setEqInterno] = useState('');
  const [eqTipo, setEqTipo] = useState('');
  const [eqMarca, setEqMarca] = useState('');
  const [eqModelo, setEqModelo] = useState('');
  const [eqSerie, setEqSerie] = useState('');
  const [eqDominio, setEqDominio] = useState('');
  const [eqPropietario, setEqPropietario] = useState('');

  // Proactive fetch from Supabase on mount
  useEffect(() => {
    loadData();

    const handlePropsUpdated = (e: any) => {
      if (e.detail) setPropietarios(e.detail);
    };
    const handleRecsUpdated = (e: any) => {
      if (e.detail) setRecepciones(e.detail);
    };

    window.addEventListener('propietarios-updated', handlePropsUpdated);
    window.addEventListener('recepciones-updated', handleRecsUpdated);
    return () => {
      window.removeEventListener('propietarios-updated', handlePropsUpdated);
      window.removeEventListener('recepciones-updated', handleRecsUpdated);
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [pRes, eRes] = await Promise.allSettled([
      fetchPropietariosDirect(),
      fetchEquiposDirect(),
    ]);

    if (pRes.status === 'fulfilled' && pRes.value.data.length > 0) {
      setPropietarios(pRes.value.data);
    } else {
      setPropietarios(getPropietarios());
    }

    if (eRes.status === 'fulfilled' && eRes.value.data.length > 0) {
      setRecepciones(eRes.value.data);
    } else {
      setRecepciones(getRecepciones());
    }

    setIsLoading(false);
  };

  const handleOpenNewProp = () => {
    setEditingProp(null);
    setPropRazon('');
    setPropCuit('');
    setPropContacto('');
    setPropTel('');
    setPropCorreo('');
    setPropModalError(null);
    setShowPropModal(true);
  };

  const handleOpenEditProp = (p: Propietario) => {
    setEditingProp(p);
    setPropRazon(p.razon_social);
    setPropCuit(p.cuit ? String(p.cuit) : '');
    setPropContacto(p.nombre_contacto || '');
    setPropTel(p.tel_contacto ? String(p.tel_contacto) : '');
    setPropCorreo(p.correo_contacto || '');
    setPropModalError(null);
    setShowPropModal(true);
  };

  const handleSaveProp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propRazon.trim()) {
      setPropModalError('La razón social es obligatoria.');
      return;
    }

    setIsSavingProp(true);
    setPropModalError(null);

    const item: Propietario = {
      id: editingProp ? editingProp.id : ensureValidUuid(),
      razon_social: propRazon.trim(),
      cuit: propCuit.trim() ? Number(propCuit.replace(/\D/g, '')) : null,
      nombre_contacto: propContacto.trim() || null,
      tel_contacto: propTel.trim() ? Number(propTel.replace(/\D/g, '')) : null,
      correo_contacto: propCorreo.trim() || null,
    };

    try {
      await savePropietario(item);
      setSyncStatusMsg('Propietario guardado y sincronizado con Supabase.');
      setTimeout(() => setSyncStatusMsg(null), 3000);
      setShowPropModal(false);
      // Refresh list
      const res = await fetchPropietariosDirect();
      if (res.data.length > 0) setPropietarios(res.data);
    } catch (err: any) {
      console.error('Error saving propietario:', err);
      setPropModalError(`Error: ${err.message || 'No se pudo guardar en Supabase'}`);
    } finally {
      setIsSavingProp(false);
    }
  };

  const handleDeleteProp = async (id: string) => {
    if (window.confirm('¿Eliminar este propietario de Supabase?')) {
      await deletePropietario(id);
      const res = await fetchPropietariosDirect();
      if (res.data) setPropietarios(res.data);
    }
  };

  const handleSaveEquipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqInterno.trim()) return;

    const newRec: RecepcionData = {
      id: ensureValidUuid(),
      fecha: new Date().toISOString().split('T')[0],
      interno: eqInterno.trim(),
      tipo: eqTipo.trim() || 'Maquinaria',
      marca: eqMarca.trim(),
      modelo: eqModelo.trim(),
      serie: eqSerie.trim(),
      dominio: eqDominio.trim().toUpperCase(),
      propietario: eqPropietario || (propietarios[0]?.id ?? ''),
      obra: getActiveObra(),
      origen: 'Terceros (Alquiler)',
      contador: 0,
      unidad_cont: 'hs',
      mantenimiento_propietario: false,
      estado: 'borrador',
      filtros_instalados: [],
      elementos_desgaste: [],
      faltantes: [],
      ultimos_servicios: [],
      lubricantes: [],
      datos_complementarios: '',
      documentos_accesorios: {
        documentacion: false,
        gato_hidraulico: false,
        matafuego: false,
        botiquin: false,
        calzas_cuñas: false,
        rueda_auxilio: false,
        kit_seguridad: false,
      },
      adjuntos: [],
    };

    saveRecepcion(newRec);
    await syncRecepcionToSupabase(newRec);

    setShowEquipoModal(false);
    setEqInterno('');
    setEqTipo('');
    setEqMarca('');
    setEqModelo('');
    setEqSerie('');
    setEqDominio('');

    const res = await fetchEquiposDirect();
    if (res.data) setRecepciones(res.data);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-5">
      
      {/* Header and Sub-Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Gestión de Equipos y Propietarios
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
              <Database className="w-3 h-3" /> Supabase Conectado
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Administrá el catálogo de empresas socias, transportistas y parque de maquinaria.
          </p>
        </div>

        {/* SubTab Toggle & Refresh */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Recargar desde Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
          </button>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSubTab('propietarios')}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                subTab === 'propietarios'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-amber-600" />
              <span>Propietarios ({propietarios.length})</span>
            </button>
            <button
              onClick={() => setSubTab('equipos')}
              className={`min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                subTab === 'equipos'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-4 h-4 text-amber-600" />
              <span>Equipos ({recepciones.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span className="font-bold">{syncStatusMsg}</span>
        </div>
      )}

      {/* SubTab 1: Propietarios */}
      {subTab === 'propietarios' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por razón social o CUIT..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleOpenNewProp}
              className="min-h-[42px] px-4 py-2 bg-[#0F2D3C] hover:bg-[#163e52] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Nuevo Propietario</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {propietarios
              .filter(
                (p) =>
                  p.razon_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  String(p.cuit || '').includes(searchTerm)
              )
              .map((p) => (
                <div
                  key={p.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-sm text-slate-900 leading-tight">
                        {p.razon_social}
                      </h3>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                        CUIT: {p.cuit ? formatNumeroArg(p.cuit) : 'S/D'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 mt-2">
                      {p.nombre_contacto && (
                        <p className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.nombre_contacto}</span>
                        </p>
                      )}
                      {p.tel_contacto && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono">{p.tel_contacto}</span>
                        </p>
                      )}
                      {p.correo_contacto && (
                        <p className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{p.correo_contacto}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-3">
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[130px]" title={p.id}>
                      UUID: {p.id.substring(0, 8)}...
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditProp(p)}
                        className="p-1.5 text-slate-600 hover:text-[#0F2D3C] hover:bg-slate-100 rounded-lg"
                        title="Editar en Supabase"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProp(p.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Eliminar de Supabase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SubTab 2: Equipos Catálogo */}
      {subTab === 'equipos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por interno, marca o patente..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => {
                setEqPropietario(propietarios[0]?.id || '');
                setShowEquipoModal(true);
              }}
              className="min-h-[42px] px-4 py-2 bg-[#0F2D3C] hover:bg-[#163e52] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4 text-amber-400" />
              <span>Nuevo Equipo</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Interno</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Marca y Modelo</th>
                  <th className="py-3 px-4">Serie / Chasis</th>
                  <th className="py-3 px-4">Dominio</th>
                  <th className="py-3 px-4">Obra Actual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recepciones
                  .filter(
                    (eq) =>
                      eq.interno?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      eq.marca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      eq.dominio?.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold font-mono text-slate-900">[{eq.interno}]</td>
                      <td className="py-3 px-4 text-slate-600">{eq.tipo}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{eq.marca} {eq.modelo}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{eq.serie || '-'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{eq.dominio || '-'}</td>
                      <td className="py-3 px-4 text-slate-600 truncate max-w-[200px]">{eq.obra}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Propietario Form */}
      {showPropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingProp ? 'Editar Propietario' : 'Nuevo Propietario (Supabase)'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Se guardará en la tabla relacional <strong className="font-mono text-slate-700">propietario</strong>.
            </p>

            {propModalError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{propModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProp} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Razón Social *</label>
                <input
                  type="text"
                  required
                  value={propRazon}
                  onChange={(e) => setPropRazon(e.target.value)}
                  placeholder="ej. VialSur Maquinarias S.A."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">CUIT</label>
                <input
                  type="text"
                  value={propCuit}
                  onChange={(e) => setPropCuit(e.target.value)}
                  placeholder="ej. 30712345678"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de Contacto</label>
                <input
                  type="text"
                  value={propContacto}
                  onChange={(e) => setPropContacto(e.target.value)}
                  placeholder="ej. Juan Pérez"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={propTel}
                    onChange={(e) => setPropTel(e.target.value)}
                    placeholder="ej. 1154329876"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={propCorreo}
                    onChange={(e) => setPropCorreo(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPropModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProp}
                  className="px-4 py-2 text-xs font-bold bg-[#0F2D3C] text-white hover:bg-[#163e52] rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  {isSavingProp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSavingProp ? 'Guardando en Supabase...' : 'Guardar en Supabase'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Equipo Form */}
      {showEquipoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Alta de Equipo en Obra</h3>
            <p className="text-xs text-slate-500 mb-4">Ingresá los datos identificatorios de la máquina.</p>

            <form onSubmit={handleSaveEquipo} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nº Interno *</label>
                  <input
                    type="text"
                    required
                    value={eqInterno}
                    onChange={(e) => setEqInterno(e.target.value)}
                    placeholder="ej. EX-301"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Dominio / Patente</label>
                  <input
                    type="text"
                    value={eqDominio}
                    onChange={(e) => setEqDominio(e.target.value.toUpperCase())}
                    placeholder="ej. AD 345 TY"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Máquina</label>
                <input
                  type="text"
                  value={eqTipo}
                  onChange={(e) => setEqTipo(e.target.value)}
                  placeholder="ej. Pala Cargadora, Grúa, Minicargador"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={eqMarca}
                    onChange={(e) => setEqMarca(e.target.value)}
                    placeholder="ej. CAT"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={eqModelo}
                    onChange={(e) => setEqModelo(e.target.value)}
                    placeholder="ej. 950H"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nº de Serie / Chasis</label>
                <input
                  type="text"
                  value={eqSerie}
                  onChange={(e) => setEqSerie(e.target.value)}
                  placeholder="ej. K9H04512"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Propietario</label>
                <select
                  value={eqPropietario}
                  onChange={(e) => setEqPropietario(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-semibold"
                >
                  {propietarios.map((p) => (
                    <option key={p.id} value={p.id}>{p.razon_social}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEquipoModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-[#0F2D3C] text-white rounded-lg shadow-sm"
                >
                  Registrar Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
