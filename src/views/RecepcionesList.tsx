import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Plus,
  FileDown,
  Eye,
  Trash2,
  Calendar,
  Clock,
  Truck,
  CheckCircle,
  FileText,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { RecepcionData, EstadoRecepcion, Propietario } from '../types';
import { getRecepciones, deleteRecepcion, getPropietarios } from '../lib/offlineStore';
import { downloadRecepcionPdf, formatFechaArg, formatNumeroArg } from '../lib/pdfGenerator';
import { fetchEquiposDirect, fetchPropietariosDirect } from '../lib/supabaseService';

interface RecepcionesListProps {
  activeObra: string;
  onNewRecepcion: () => void;
  onEditRecepcion: (rec: RecepcionData) => void;
  onViewRecepcion: (rec: RecepcionData) => void;
}

export const RecepcionesList: React.FC<RecepcionesListProps> = ({
  activeObra,
  onNewRecepcion,
  onEditRecepcion,
  onViewRecepcion,
}) => {
  const [recepciones, setRecepciones] = useState<RecepcionData[]>(() => getRecepciones());
  const [propietarios, setPropietarios] = useState<Propietario[]>(() => getPropietarios());

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [ownerFilter, setOwnerFilter] = useState<string>('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filterObraOnly, setFilterObraOnly] = useState(true);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch from Supabase
    Promise.all([fetchEquiposDirect(), fetchPropietariosDirect()]).then(([eRes, pRes]) => {
      if (eRes.data && eRes.data.length > 0) setRecepciones(eRes.data);
      if (pRes.data && pRes.data.length > 0) setPropietarios(pRes.data);
    }).catch((err) => console.warn('Supabase fetch error:', err));

    const handleRecs = (e: any) => {
      if (e.detail) setRecepciones(e.detail);
    };
    const handleProps = (e: any) => {
      if (e.detail) setPropietarios(e.detail);
    };

    window.addEventListener('recepciones-updated', handleRecs);
    window.addEventListener('propietarios-updated', handleProps);
    return () => {
      window.removeEventListener('recepciones-updated', handleRecs);
      window.removeEventListener('propietarios-updated', handleProps);
    };
  }, []);

  const refreshList = () => {
    setRecepciones(getRecepciones());
    setPropietarios(getPropietarios());
  };

  const propietariosMap = useMemo(() => {
    const map = new Map<string, string>();
    propietarios.forEach((p) => map.set(p.id, p.razon_social));
    return map;
  }, [propietarios]);

  const filteredList = useMemo(() => {
    return recepciones.filter((rec) => {
      // 1. Obra filter
      if (filterObraOnly && activeObra && rec.obra !== activeObra) {
        return false;
      }

      // 2. Status filter
      if (statusFilter !== 'todos' && rec.estado !== statusFilter) {
        return false;
      }

      // 3. Owner filter
      if (ownerFilter !== 'todos' && rec.propietario !== ownerFilter) {
        return false;
      }

      // 4. Date range filter
      if (fechaDesde && rec.fecha < fechaDesde) {
        return false;
      }
      if (fechaHasta && rec.fecha > fechaHasta) {
        return false;
      }

      // 5. Search text (interno, dominio, serie, marca, modelo, owner)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const ownerName = propietariosMap.get(rec.propietario || '')?.toLowerCase() || '';
        const matchInterno = rec.interno?.toLowerCase().includes(term);
        const matchDominio = rec.dominio?.toLowerCase().includes(term);
        const matchSerie = rec.serie?.toLowerCase().includes(term);
        const matchMarca = rec.marca?.toLowerCase().includes(term);
        const matchModelo = rec.modelo?.toLowerCase().includes(term);
        const matchOwner = ownerName.includes(term);

        if (!matchInterno && !matchDominio && !matchSerie && !matchMarca && !matchModelo && !matchOwner) {
          return false;
        }
      }

      return true;
    });
  }, [recepciones, activeObra, filterObraOnly, statusFilter, ownerFilter, fechaDesde, fechaHasta, searchTerm, propietariosMap]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('¿Estás seguro de eliminar esta acta de recepción? Esta acción no se puede deshacer.')) {
      deleteRecepcion(id);
      refreshList();
    }
  };

  const handleDownloadPdf = async (rec: RecepcionData, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(rec.id);
    try {
      await downloadRecepcionPdf(rec);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (estado: EstadoRecepcion) => {
    switch (estado) {
      case 'aprobada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            Aprobada
          </span>
        );
      case 'completa':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
            Completa
          </span>
        );
      case 'anulada':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
            Anulada
          </span>
        );
      case 'borrador':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
            Borrador
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28">
      
      {/* Top Banner / Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        
        {/* Title & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Actas de Recepción
            </h1>
            <p className="text-xs text-slate-500">
              {filterObraOnly ? (
                <span>Filtrando por obra activa: <strong>{activeObra}</strong></span>
              ) : (
                <span>Mostrando todas las obras</span>
              )}
              {' '}· {filteredList.length} recepciones
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setFilterObraOnly(!filterObraOnly)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                filterObraOnly
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-amber-500/15 text-amber-900 border-amber-300 font-bold'
              }`}
            >
              {filterObraOnly ? 'Ver todas las obras' : 'Solo obra activa'}
            </button>

            <button
              onClick={onNewRecepcion}
              className="hidden sm:flex items-center gap-1.5 min-h-[40px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nueva Recepción</span>
            </button>
          </div>
        </div>

        {/* Search input + Filter button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por Nº interno, dominio, serie o propietario..."
              className="w-full pl-9 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFiltersModal(true)}
            className={`min-h-[44px] px-3.5 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-colors ${
              statusFilter !== 'todos' || ownerFilter !== 'todos' || fechaDesde || fechaHasta
                ? 'bg-[#0F2D3C] text-white border-[#0F2D3C]'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {(statusFilter !== 'todos' || ownerFilter !== 'todos' || fechaDesde || fechaHasta) && (
              <span className="w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>
        </div>

      </div>

      {/* Empty State */}
      {filteredList.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-4">
            <Truck className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            Todavía no hay recepciones registradas
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            {searchTerm || statusFilter !== 'todos'
              ? 'No hay actas que coincidan con los filtros seleccionados.'
              : 'Registrá el ingreso del primer equipo o vehículo de terceros en esta obra.'}
          </p>
          <button
            onClick={onNewRecepcion}
            className="inline-flex items-center gap-2 min-h-[46px] px-5 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Crear primera recepción</span>
          </button>
        </div>
      )}

      {/* CELULAR: Cards List (Mobile-First) */}
      <div className="lg:hidden space-y-3">
        {filteredList.map((rec) => {
          const ownerName = propietariosMap.get(rec.propietario || '') || 'Propietario s/d';
          return (
            <div
              key={rec.id}
              onClick={() => onViewRecepcion(rec)}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 active:scale-[0.99] transition-all flex flex-col gap-2.5 cursor-pointer"
            >
              {/* Header card: Interno + Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-base text-slate-900 tracking-tight font-mono">
                      [{rec.interno || 'S/N'}]
                    </span>
                    <span className="font-bold text-sm text-slate-800">
                      {rec.marca} {rec.modelo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{rec.tipo || 'Equipo vial/civil'}</p>
                </div>
                {getStatusBadge(rec.estado)}
              </div>

              {/* Data points */}
              <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Propietario</span>
                  <span className="font-semibold text-slate-800 truncate block">{ownerName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Fecha Ingreso</span>
                  <span className="font-semibold text-slate-800 block font-mono">{formatFechaArg(rec.fecha)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Lectura Contador</span>
                  <span className="font-bold text-slate-900 block font-mono">
                    {formatNumeroArg(rec.contador)} {rec.unidad_cont || 'hs'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Mantenimiento</span>
                  <span className={`text-[11px] font-bold ${rec.mantenimiento_propietario ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {rec.mantenimiento_propietario ? 'Dueño (SÍ)' : 'Obra (NO)'}
                  </span>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 font-mono">
                  {rec.adjuntos?.length || 0} fotos
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleDownloadPdf(rec, e)}
                    disabled={downloadingId === rec.id}
                    className="min-h-[38px] px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1.5"
                    title="Descargar PDF"
                  >
                    <FileDown className="w-3.5 h-3.5 text-amber-600" />
                    <span>{downloadingId === rec.id ? 'PDF...' : 'PDF'}</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditRecepcion(rec);
                    }}
                    className="min-h-[38px] px-3 py-1.5 bg-[#0F2D3C] hover:bg-[#163e52] text-white rounded-lg text-xs font-bold"
                  >
                    Editar
                  </button>

                  <button
                    onClick={(e) => handleDelete(rec.id, e)}
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* ESCRITORIO: Full Data Table */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Nº Equipo</th>
              <th className="py-3 px-4">Familia / Tipo</th>
              <th className="py-3 px-4">Marca y Modelo</th>
              <th className="py-3 px-4">Propietario</th>
              <th className="py-3 px-4 font-mono">Fecha</th>
              <th className="py-3 px-4 font-mono">Lectura</th>
              <th className="py-3 px-4">Mantenimiento</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredList.map((rec) => {
              const ownerName = propietariosMap.get(rec.propietario || '') || 'S/D';
              return (
                <tr
                  key={rec.id}
                  onClick={() => onViewRecepcion(rec)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                    [{rec.interno || 'S/N'}]
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {rec.tipo || '-'}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900">
                    {rec.marca} {rec.modelo}
                    {rec.dominio ? <span className="text-[11px] text-slate-400 block font-mono">{rec.dominio}</span> : null}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-semibold truncate max-w-[180px]">
                    {ownerName}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-700">
                    {formatFechaArg(rec.fecha)}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                    {formatNumeroArg(rec.contador)} {rec.unidad_cont || 'hs'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`text-[11px] font-bold ${rec.mantenimiento_propietario ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {rec.mantenimiento_propietario ? 'Dueño' : 'Obra'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {getStatusBadge(rec.estado)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDownloadPdf(rec, e)}
                        disabled={downloadingId === rec.id}
                        className="p-1.5 text-slate-700 hover:text-amber-600 hover:bg-slate-100 rounded-md"
                        title="Descargar PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEditRecepcion(rec)}
                        className="p-1.5 text-slate-700 hover:text-[#0F2D3C] hover:bg-slate-100 rounded-md"
                        title="Editar"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(rec.id, e)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating Action Button on Mobile */}
      <div className="lg:hidden fixed right-4 bottom-20 z-30">
        <button
          onClick={onNewRecepcion}
          className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 active:scale-95 shadow-xl flex items-center justify-center text-slate-950 font-black border-2 border-slate-950/20"
          title="Nueva recepción"
        >
          <Plus className="w-7 h-7 stroke-[3]" />
        </button>
      </div>

      {/* Filters Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Filtros de Búsqueda</h3>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Estado */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Estado de Recepción</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="todos">Todos los estados</option>
                  <option value="borrador">Borrador</option>
                  <option value="completa">Completa</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="anulada">Anulada</option>
                </select>
              </div>

              {/* Propietario */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Propietario</label>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="todos">Todos los propietarios</option>
                  {propietarios.map((p) => (
                    <option key={p.id} value={p.id}>{p.razon_social}</option>
                  ))}
                </select>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-5 border-t border-slate-100 mt-5">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('todos');
                  setOwnerFilter('todos');
                  setFechaDesde('');
                  setFechaHasta('');
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Limpiar Filtros
              </button>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="px-4 py-2 text-xs font-bold bg-[#0F2D3C] text-white rounded-lg"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
