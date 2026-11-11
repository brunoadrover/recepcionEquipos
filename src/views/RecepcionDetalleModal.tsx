import React, { useState } from 'react';
import {
  X,
  FileDown,
  Edit2,
  Calendar,
  Clock,
  Truck,
  CheckCircle,
  AlertTriangle,
  Building,
  Wrench,
  Layers,
  Image as ImageIcon,
  Check,
  FileText,
} from 'lucide-react';
import { RecepcionData, EstadoRecepcion } from '../types';
import { getPropietarios, saveRecepcion } from '../lib/offlineStore';
import { downloadRecepcionPdf, formatFechaArg, formatNumeroArg } from '../lib/pdfGenerator';

interface DetalleModalProps {
  recepcion: RecepcionData;
  onClose: () => void;
  onEdit: (rec: RecepcionData) => void;
  onUpdated: (rec: RecepcionData) => void;
}

export const RecepcionDetalleModal: React.FC<DetalleModalProps> = ({
  recepcion,
  onClose,
  onEdit,
  onUpdated,
}) => {
  const [currentRec, setCurrentRec] = useState<RecepcionData>(recepcion);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const propietarios = getPropietarios();
  const owner = propietarios.find((p) => p.id === currentRec.propietario);

  const handleStatusChange = (newEstado: EstadoRecepcion) => {
    const updated = { ...currentRec, estado: newEstado };
    setCurrentRec(updated);
    saveRecepcion(updated);
    onUpdated(updated);
  };

  const handleDownload = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadRecepcionPdf(currentRec);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto animate-scale-up">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-[#0F2D3C] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-base sm:text-lg text-amber-400">
                [{currentRec.interno || 'S/N'}]
              </span>
              <span className="font-bold text-sm sm:text-base truncate">
                {currentRec.marca} {currentRec.modelo}
              </span>
            </div>
            <p className="text-xs text-slate-300 truncate">
              Acta #{currentRec.id.substring(0, 8).toUpperCase()} · Obra: {currentRec.obra}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={isDownloadingPdf}
              className="min-h-[38px] px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isDownloadingPdf ? 'Generando...' : 'PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          
          {/* Status selector bar */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600">Estado actual:</span>
              <span className="font-bold text-xs uppercase px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800">
                {currentRec.estado}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {(['borrador', 'completa', 'aprobada', 'anulada'] as EstadoRecepcion[]).map((st) => (
                <button
                  key={st}
                  onClick={() => handleStatusChange(st)}
                  className={`min-h-[32px] px-2.5 text-[11px] font-bold rounded-lg capitalize border transition-all ${
                    currentRec.estado === st
                      ? 'bg-[#0F2D3C] text-white border-[#0F2D3C]'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* 1. Datos del Equipo y Propietario */}
          <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-500" />
              Datos del Equipo y Propietario
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Propietario</span>
                <span className="font-semibold text-slate-900">{owner?.razon_social || currentRec.propietario || '-'}</span>
                {owner?.cuit && <span className="block text-[10px] text-slate-500 font-mono">CUIT: {formatNumeroArg(owner.cuit)}</span>}
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Tipo / Familia</span>
                <span className="font-semibold text-slate-900">{currentRec.tipo || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Dominio / Patente</span>
                <span className="font-bold font-mono text-slate-900">{currentRec.dominio || 'S/D'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Nº de Serie</span>
                <span className="font-mono text-slate-900">{currentRec.serie || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Origen</span>
                <span className="text-slate-900">{currentRec.origen || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Fecha de Recepción</span>
                <span className="font-mono font-bold text-slate-900">{formatFechaArg(currentRec.fecha)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Lectura Contador</span>
                <span className="font-mono font-bold text-slate-900">{formatNumeroArg(currentRec.contador)} {currentRec.unidad_cont || 'hs'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase">Nº de Remito</span>
                <span className="font-mono text-slate-900">{currentRec.remito || '-'}</span>
              </div>
            </div>
          </div>

          {/* 2. Mantenimiento Highlight */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            currentRec.mantenimiento_propietario
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider block">Responsabilidad de Mantenimiento</span>
              <p className="font-extrabold text-sm mt-0.5">
                {currentRec.mantenimiento_propietario
                  ? 'SÍ: Los servicios de mantenimiento los realiza el PROPIETARIO'
                  : 'NO: Los servicios de mantenimiento están a cargo de la OBRA'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center font-bold">
              {currentRec.mantenimiento_propietario ? 'SÍ' : 'NO'}
            </div>
          </div>

          {/* 3. Relevamiento Motores y Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Motor */}
            <div className="border border-slate-200 rounded-2xl p-4">
              <h4 className="font-bold text-slate-900 mb-2">Motor de Combustión</h4>
              {currentRec.motor_combustion ? (
                <div className="space-y-1">
                  <p><strong>Marca:</strong> {currentRec.motor_combustion.marca || '-'}</p>
                  <p><strong>Modelo:</strong> {currentRec.motor_combustion.modelo || '-'}</p>
                  <p><strong>Serie:</strong> {currentRec.motor_combustion.serie || '-'}</p>
                  <p><strong>Correa:</strong> {currentRec.motor_combustion.correa || '-'}</p>
                </div>
              ) : (
                <p className="text-slate-400 italic">No aplica o no relevado.</p>
              )}
            </div>

            {/* Filtros */}
            <div className="border border-slate-200 rounded-2xl p-4">
              <h4 className="font-bold text-slate-900 mb-2">Filtros Instalados ({currentRec.filtros_instalados?.length || 0})</h4>
              {currentRec.filtros_instalados?.length ? (
                <ul className="space-y-1">
                  {currentRec.filtros_instalados.map((f, i) => (
                    <li key={i} className="text-[11px]">
                      • <strong>{f.tipo_filtro_nombre || 'Filtro'}:</strong> {f.codigo || 'S/C'} ({f.marca || 'S/M'})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 italic">Sin filtros especificados.</p>
              )}
            </div>
          </div>

          {/* 4. Fotos */}
          <div className="border border-slate-200 rounded-2xl p-4">
            <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-amber-500" />
              Fotografías y Adjuntos ({currentRec.adjuntos?.length || 0})
            </h4>

            {currentRec.adjuntos?.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {currentRec.adjuntos.map((adj) => (
                  <div key={adj.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <img
                      src={adj.data_url || adj.url}
                      alt={adj.nombre_archivo}
                      className="w-full h-24 object-cover"
                    />
                    <div className="p-1.5 text-center">
                      <span className="text-[10px] font-bold block truncate">{adj.tipo_sugerido || adj.tipo}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 italic">No hay fotos adjuntas a esta recepción.</p>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              onClose();
              onEdit(currentRec);
            }}
            className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Editar Relevamiento</span>
          </button>

          <button
            onClick={handleDownload}
            disabled={isDownloadingPdf}
            className="min-h-[44px] px-5 py-2 bg-[#0F2D3C] hover:bg-[#163e52] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs"
          >
            <FileDown className="w-4 h-4 text-amber-400" />
            <span>{isDownloadingPdf ? 'Generando PDF...' : 'Descargar PDF Oficial'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
