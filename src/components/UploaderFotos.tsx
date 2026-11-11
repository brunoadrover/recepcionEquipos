import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, FileText, Trash2, RotateCw, Maximize2, X, Check, AlertCircle, UploadCloud } from 'lucide-react';
import { RecepcionAdjunto, TipoAdjunto } from '../types';
import { compressImage } from '../lib/imageCompressor';
import { uploadArchivoStorage, deleteArchivoStorage } from '../lib/supabase';

interface UploaderFotosProps {
  obra: string;
  recepcionId: string;
  adjuntos: RecepcionAdjunto[];
  onChange: (adjuntos: RecepcionAdjunto[]) => void;
}

interface UploadProgressItem {
  id: string;
  fileName: string;
  progress: number;
  status: 'compressing' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
  file?: File;
  tipo: TipoAdjunto;
  tipoSugerido?: string;
}

const SUGGESTED_PHOTOS = [
  'Frente',
  'Lateral izquierdo',
  'Lateral derecho',
  'Trasera',
  'Tablero / Horómetro',
  'Placa de identificación / serie',
  'Cubiertas / Tren de rodaje',
  'Daños visibles',
];

export const UploaderFotos: React.FC<UploaderFotosProps> = ({
  obra,
  recepcionId,
  adjuntos,
  onChange,
}) => {
  const [activeTipo, setActiveTipo] = useState<TipoAdjunto>('Foto');
  const [selectedSugerencia, setSelectedSugerencia] = useState<string>('');
  const [uploadQueue, setUploadQueue] = useState<UploadProgressItem[]>([]);
  const [previewModalUrl, setPreviewModalUrl] = useState<{ url: string; title: string; isPdf?: boolean } | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Check which suggestions are already taken
  const takenSuggestions = new Set(
    adjuntos.map((a) => a.tipo_sugerido).filter(Boolean)
  );

  const processFile = async (file: File, tipo: TipoAdjunto, tipoSugerido?: string) => {
    const tempId = 'up-' + Math.random().toString(36).substring(2, 9);
    
    // Add to progress queue
    const queueItem: UploadProgressItem = {
      id: tempId,
      fileName: file.name,
      progress: 20,
      status: 'compressing',
      file,
      tipo,
      tipoSugerido,
    };

    setUploadQueue((prev) => [queueItem, ...prev]);

    try {
      // 1. Compress
      const { file: processedFile, dataUrl } = await compressImage(file);
      
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === tempId ? { ...item, progress: 60, status: 'uploading' } : item
        )
      );

      // 2. Upload to Supabase Storage (or keep local base64 fallback)
      let storagePath = `local/${recepcionId}/${file.name}`;
      let finalUrl = dataUrl;

      try {
        const res = await uploadArchivoStorage(obra, recepcionId, tipo, processedFile);
        storagePath = res.path;
        finalUrl = res.signedUrl || res.publicUrl || dataUrl;
      } catch (err: any) {
        console.warn('Storage upload error (fallback to local dataUrl):', err);
        // We still keep the photo locally so field work is never stopped
      }

      // 3. Mark complete & add to adjuntos
      const newAdjunto: RecepcionAdjunto = {
        id: crypto.randomUUID ? crypto.randomUUID() : 'adj-' + Date.now(),
        recepcion_id: recepcionId,
        tipo,
        storage_path: storagePath,
        nombre_archivo: file.name,
        url: finalUrl,
        data_url: dataUrl,
        fecha_subida: new Date().toISOString(),
        tamanio: processedFile.size,
        tipo_sugerido: tipoSugerido || (tipo === 'Foto' ? 'Foto de inspección' : tipo),
      };

      onChange([...adjuntos, newAdjunto]);

      // Remove from active queue
      setUploadQueue((prev) => prev.filter((item) => item.id !== tempId));
    } catch (err: any) {
      console.error('File processing failed:', err);
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === tempId
            ? { ...item, status: 'error', errorMessage: err.message || 'Error al procesar archivo' }
            : item
        )
      );
    }
  };

  const handleFilesSelected = (files: FileList | null, tipo: TipoAdjunto, tipoSugerido?: string) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      processFile(file, tipo, tipoSugerido);
    });
  };

  const handleRetryUpload = (queueItem: UploadProgressItem) => {
    if (queueItem.file) {
      setUploadQueue((prev) => prev.filter((item) => item.id !== queueItem.id));
      processFile(queueItem.file, queueItem.tipo, queueItem.tipoSugerido);
    }
  };

  const handleDeleteAdjunto = async (adjunto: RecepcionAdjunto) => {
    // Optimistically remove from list
    onChange(adjuntos.filter((a) => a.id !== adjunto.id));

    // Try deleting from Supabase Storage
    if (adjunto.storage_path && !adjunto.storage_path.startsWith('local/')) {
      await deleteArchivoStorage(adjunto.storage_path);
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Notice Banner */}
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-800">
          <p className="font-bold text-slate-900">Aviso importante de recepción:</p>
          <p className="mt-0.5 text-slate-700">
            Si el propietario tiene <strong>planilla de mantenimiento</strong> o remito firmado, adjuntala acá (en foto o PDF) para respaldo legal.
          </p>
        </div>
      </div>

      {/* Tipo de Adjunto Selector */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
          Tipo de Adjunto a Cargar
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {(['Foto', 'Remito', 'Planilla de mantenimiento del propietario', 'Documentación', 'Otro'] as TipoAdjunto[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTipo(t)}
              className={`min-h-[44px] px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all text-center flex items-center justify-center leading-tight ${
                activeTipo === t
                  ? 'bg-[#0F2D3C] text-white border-[#0F2D3C] shadow-sm'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {t === 'Planilla de mantenimiento del propietario' ? 'Planilla Mant.' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Checklist Visual Sugerido (solo para fotos) */}
      {activeTipo === 'Foto' && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Checklist fotográfico sugerido (Toque para etiquetar):
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {takenSuggestions.size}/{SUGGESTED_PHOTOS.length}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PHOTOS.map((sug) => {
              const isTaken = takenSuggestions.has(sug);
              const isSelected = selectedSugerencia === sug;
              return (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setSelectedSugerencia(isSelected ? '' : sug)}
                  className={`min-h-[36px] px-2.5 py-1 text-xs rounded-md border flex items-center gap-1.5 transition-colors ${
                    isTaken
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-medium'
                      : isSelected
                      ? 'bg-amber-500 text-slate-950 border-amber-600 font-bold'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  {isTaken ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : null}
                  <span>{sug}</span>
                </button>
              );
            })}
          </div>
          {selectedSugerencia && (
            <p className="mt-2 text-[11px] text-amber-700 font-medium">
              Próxima foto se etiquetará como: <strong>{selectedSugerencia}</strong>
            </p>
          )}
        </div>
      )}

      {/* Botones Grandes de Captura y Carga (Hitbox >= 48px, táctil con guantes) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        
        {/* 1. Botón Sacar Foto (Cámara en vivo) */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="min-h-[52px] px-4 py-3 bg-[#0F2D3C] hover:bg-[#163e52] active:scale-[0.98] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-sm transition-all"
        >
          <Camera className="w-5 h-5 text-amber-400" />
          <span>Sacar foto</span>
        </button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files, activeTipo, selectedSugerencia);
            setSelectedSugerencia('');
            e.target.value = '';
          }}
        />

        {/* 2. Botón Galería (Múltiple) */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="min-h-[52px] px-4 py-3 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 border-2 border-slate-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xs transition-all"
        >
          <ImageIcon className="w-5 h-5 text-slate-600" />
          <span>Elegir de galería</span>
        </button>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files, activeTipo, selectedSugerencia);
            setSelectedSugerencia('');
            e.target.value = '';
          }}
        />

        {/* 3. Botón Adjuntar PDF */}
        <button
          type="button"
          onClick={() => pdfInputRef.current?.click()}
          className="min-h-[52px] px-4 py-3 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 border border-slate-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all"
        >
          <FileText className="w-5 h-5 text-amber-600" />
          <span>Adjuntar PDF / Remito</span>
        </button>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(e.target.files, activeTipo === 'Foto' ? 'Remito' : activeTipo);
            e.target.value = '';
          }}
        />
      </div>

      {/* Cola de Subida Activa con Barra de Progreso */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2">
          {uploadQueue.map((item) => (
            <div
              key={item.id}
              className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-800 truncate">{item.fileName}</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {item.status === 'compressing' && 'Comprimiendo...'}
                    {item.status === 'uploading' && 'Subiendo a Storage...'}
                    {item.status === 'error' && 'Error'}
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      item.status === 'error' ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                {item.errorMessage && (
                  <p className="text-[11px] text-red-600 mt-1">{item.errorMessage}</p>
                )}
              </div>
              {item.status === 'error' && (
                <button
                  type="button"
                  onClick={() => handleRetryUpload(item)}
                  className="min-h-[36px] min-w-[36px] p-2 text-slate-700 hover:bg-slate-100 rounded-lg flex items-center justify-center"
                  title="Reintentar subida"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Grid de Miniaturas de Archivos y Fotos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Archivos Adjuntos ({adjuntos.length})
          </span>
          {adjuntos.length === 0 && (
            <span className="text-xs text-amber-700 font-medium">
              * Se requiere al menos 1 foto para finalizar
            </span>
          )}
        </div>

        {adjuntos.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-slate-300 rounded-2xl text-center bg-white/50">
            <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Todavía no cargaste fotos o remitos</p>
            <p className="text-xs text-slate-500 mt-1">Usá los botones superiores para sacar fotos al equipo desde la obra.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {adjuntos.map((adj) => {
              const isPdf = adj.nombre_archivo?.toLowerCase().endsWith('.pdf') || adj.url?.includes('.pdf');
              return (
                <div
                  key={adj.id}
                  className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Thumbnail */}
                  <div
                    onClick={() =>
                      setPreviewModalUrl({
                        url: adj.data_url || adj.url,
                        title: adj.tipo_sugerido || adj.nombre_archivo,
                        isPdf,
                      })
                    }
                    className="relative w-full h-32 bg-slate-100 cursor-pointer overflow-hidden flex items-center justify-center"
                  >
                    {isPdf ? (
                      <div className="flex flex-col items-center justify-center text-red-600 p-2 text-center">
                        <FileText className="w-12 h-12 stroke-[1.5]" />
                        <span className="text-[10px] font-bold text-slate-700 mt-1 uppercase">Documento PDF</span>
                      </div>
                    ) : (
                      <img
                        src={adj.data_url || adj.url}
                        alt={adj.nombre_archivo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                    )}

                    {/* Overlay zoom icon */}
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="w-6 h-6 text-white drop-shadow" />
                    </div>

                    {/* Badge tipo */}
                    <span className="absolute top-1.5 left-1.5 px-2 py-0.5 text-[9px] font-bold bg-slate-900/80 text-white rounded backdrop-blur-xs">
                      {adj.tipo}
                    </span>
                  </div>

                  {/* Caption & Delete action */}
                  <div className="p-2 flex items-center justify-between gap-1.5 bg-white border-t border-slate-100">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-800 truncate" title={adj.tipo_sugerido || adj.nombre_archivo}>
                        {adj.tipo_sugerido || adj.nombre_archivo}
                      </p>
                      <p className="text-[9px] text-slate-400 truncate font-mono">
                        {adj.nombre_archivo}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAdjunto(adj);
                      }}
                      className="min-h-[36px] min-w-[36px] p-2 text-red-600 hover:bg-red-50 active:scale-95 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      title="Eliminar archivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visor a Pantalla Completa Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 animate-fade-in">
          {/* Header */}
          <div className="w-full max-w-4xl flex items-center justify-between text-white pb-3 border-b border-slate-800">
            <span className="font-bold text-sm truncate">{previewModalUrl.title}</span>
            <button
              type="button"
              onClick={() => setPreviewModalUrl(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-300 hover:text-white rounded-lg p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 w-full max-w-4xl flex items-center justify-center py-4 overflow-auto">
            {previewModalUrl.isPdf ? (
              <div className="bg-white rounded-xl p-6 text-center max-w-md w-full shadow-2xl">
                <FileText className="w-16 h-16 text-red-600 mx-auto mb-3" />
                <h4 className="font-bold text-slate-900 mb-1">{previewModalUrl.title}</h4>
                <p className="text-xs text-slate-500 mb-4">Documento en formato PDF escaneado.</p>
                <a
                  href={previewModalUrl.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2.5 bg-[#0F2D3C] text-white rounded-lg text-xs font-bold"
                >
                  Abrir PDF en pestaña
                </a>
              </div>
            ) : (
              <img
                src={previewModalUrl.url}
                alt={previewModalUrl.title}
                className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </div>
      )}

    </div>
  );
};
