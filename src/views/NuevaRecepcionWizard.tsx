import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Save,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  FileDown,
  Truck,
  Wrench,
  Check,
  X,
  Copy,
  Info,
  Calendar,
  Layers,
  FileCheck,
} from 'lucide-react';
import {
  RecepcionData,
  Propietario,
  PlanListaSector,
  FiltrosLista,
  Responsable,
  UnidadContador,
  AceiteGrasa,
  UnidadCantidad,
  UnidadFrecuencia,
} from '../types';
import {
  getPropietarios,
  getSectores,
  getFiltros,
  getResponsables,
  getRecepciones,
  saveRecepcion,
} from '../lib/offlineStore';
import {
  ensureValidUuid,
  fetchPropietariosDirect,
  createPropietarioDirect,
  fetchSectoresDirect,
  fetchFiltrosDirect,
  fetchResponsablesDirect,
} from '../lib/supabaseService';
import { syncRecepcionToSupabase } from '../lib/supabase';
import { UploaderFotos } from '../components/UploaderFotos';
import { downloadRecepcionPdf, formatFechaArg, formatNumeroArg } from '../lib/pdfGenerator';

interface WizardProps {
  initialData?: RecepcionData | null;
  activeObra: string;
  onClose: () => void;
  onFinish: (recepcion: RecepcionData) => void;
}

const STEPS = [
  { id: 1, title: 'Equipo y Dueño' },
  { id: 2, title: 'Datos Recepción' },
  { id: 3, title: 'Relevamiento' },
  { id: 4, title: 'Mantenimiento' },
  { id: 5, title: 'Fotos' },
  { id: 6, title: 'Complementarios' },
  { id: 7, title: 'Cierre y PDF' },
];

export const NuevaRecepcionWizard: React.FC<WizardProps> = ({
  initialData,
  activeObra,
  onClose,
  onFinish,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Master lists
  const [propietarios, setPropietarios] = useState<Propietario[]>([]);
  const [sectores, setSectores] = useState<PlanListaSector[]>([]);
  const [filtros, setFiltros] = useState<FiltrosLista[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [allEquiposExistentes, setAllEquiposExistentes] = useState<RecepcionData[]>([]);

  // Search & quick-add states
  const [equipoSearchTerm, setEquipoSearchTerm] = useState('');
  const [showQuickAddOwner, setShowQuickAddOwner] = useState(false);
  const [newOwnerRazon, setNewOwnerRazon] = useState('');
  const [newOwnerCuit, setNewOwnerCuit] = useState('');
  const [newOwnerContacto, setNewOwnerContacto] = useState('');
  const [newOwnerTel, setNewOwnerTel] = useState('');

  // Accordion state for Step 4 Lubricants
  const [expandedSectorId, setExpandedSectorId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<RecepcionData>(() => {
    if (initialData) return initialData;

    return {
      id: ensureValidUuid(),
      fecha: new Date().toISOString().split('T')[0],
      interno: '',
      tipo: '',
      marca: '',
      modelo: '',
      contador: null,
      unidad_cont: 'hs',
      serie: '',
      origen: 'Terceros (Alquiler)',
      mantenimiento_propietario: false,
      obra: activeObra,
      remito: null,
      propietario: '',
      dominio: '',
      estado: 'borrador',
      responsable_id: '',
      responsable_nombre: '',
      fecha_informe: new Date().toISOString().split('T')[0],
      observaciones_generales: '',
      datos_complementarios: '',
      motor_combustion: null,
      motor_electrico: null,
      filtros_instalados: [],
      elementos_desgaste: [],
      faltantes: [],
      ultimos_servicios: [],
      lubricantes: [],
      documentos_accesorios: {
        documentacion: false,
        gato_hidraulico: false,
        matafuego: false,
        botiquin: false,
        calzas_cuñas: false,
        rueda_auxilio: false,
        kit_seguridad: false,
        comentario: '',
      },
      adjuntos: [],
    };
  });

  useEffect(() => {
    // Initial load from cache
    setPropietarios(getPropietarios());
    setSectores(getSectores());
    setFiltros(getFiltros());
    const resps = getResponsables();
    setResponsables(resps);
    if (!formData.responsable_id && resps.length > 0) {
      setFormData((prev) => ({
        ...prev,
        responsable_id: resps[0].id,
        responsable_nombre: resps[0].nombre,
      }));
    }
    setAllEquiposExistentes(getRecepciones());

    // Asynchronously fetch fresh data directly from Supabase
    Promise.all([
      fetchPropietariosDirect(),
      fetchSectoresDirect(),
      fetchFiltrosDirect(),
      fetchResponsablesDirect(),
    ]).then(([pRes, sRes, fRes, rRes]) => {
      if (pRes.data && pRes.data.length > 0) setPropietarios(pRes.data);
      if (sRes.data && sRes.data.length > 0) setSectores(sRes.data);
      if (fRes.data && fRes.data.length > 0) setFiltros(fRes.data);
      if (rRes.data && rRes.data.length > 0) {
        setResponsables(rRes.data);
        setFormData((prev) => ({
          ...prev,
          responsable_id: prev.responsable_id || rRes.data[0].id,
          responsable_nombre: prev.responsable_nombre || rRes.data[0].nombre,
        }));
      }
    }).catch((err) => console.warn('Wizard async fetch from Supabase:', err));
  }, []);

  // Auto-save whenever step changes or explicitly triggered
  const persistDraft = async (dataToSave = formData) => {
    setIsSaving(true);
    // 1. Local storage save
    saveRecepcion(dataToSave);

    // 2. Background sync to Supabase
    try {
      await syncRecepcionToSupabase(dataToSave);
    } catch (err) {
      console.warn('Silent auto-save sync error:', err);
    }

    setIsSaving(false);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 2000);
  };

  const handleStepChange = (newStep: number) => {
    persistDraft(formData);
    setCurrentStep(newStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Autocomplete equipment if user picks existing
  const handleSelectExistingEquipo = (existing: RecepcionData) => {
    setFormData((prev) => ({
      ...prev,
      interno: existing.interno,
      tipo: existing.tipo || prev.tipo,
      marca: existing.marca || prev.marca,
      modelo: existing.modelo || prev.modelo,
      serie: existing.serie || prev.serie,
      dominio: existing.dominio || prev.dominio,
      origen: existing.origen || prev.origen,
      propietario: existing.propietario || prev.propietario,
      motor_combustion: existing.motor_combustion || prev.motor_combustion,
      motor_electrico: existing.motor_electrico || prev.motor_electrico,
      filtros_instalados: existing.filtros_instalados?.length ? existing.filtros_instalados : prev.filtros_instalados,
    }));
    setEquipoSearchTerm('');
  };

  // Quick add owner directly with Supabase
  const handleQuickAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerRazon.trim()) return;
    
    const res = await createPropietarioDirect({
      razon_social: newOwnerRazon.trim(),
      cuit: newOwnerCuit.trim() || null,
      nombre_contacto: newOwnerContacto.trim() || null,
      tel_contacto: newOwnerTel.trim() || null,
    });

    if (res.data) {
      const updatedList = [res.data, ...propietarios];
      setPropietarios(updatedList);
      setFormData((prev) => ({ ...prev, propietario: res.data!.id }));
    }
    
    setShowQuickAddOwner(false);
    setNewOwnerRazon('');
    setNewOwnerCuit('');
    setNewOwnerContacto('');
    setNewOwnerTel('');
  };

  // Copy from last reception
  const handleCopyLastReception = () => {
    const list = getRecepciones();
    const last = list.find((r) => r.id !== formData.id && (r.lubricantes?.length > 0 || r.ultimos_servicios?.length > 0));
    if (last) {
      setFormData((prev) => ({
        ...prev,
        lubricantes: last.lubricantes || prev.lubricantes,
        ultimos_servicios: last.ultimos_servicios || prev.ultimos_servicios,
      }));
    }
  };

  // Final Validation
  const validateForm = (): boolean => {
    const errors: string[] = [];
    if (!formData.obra?.trim()) errors.push('Falta especificar la Obra.');
    if (!formData.interno?.trim()) errors.push('Falta el Nº Interno del equipo.');
    if (!formData.fecha) errors.push('Falta la fecha de recepción.');
    if (formData.contador === null || formData.contador === undefined || isNaN(Number(formData.contador))) {
      errors.push('Falta la lectura de horas o kilómetros (contador).');
    }
    if (!formData.adjuntos || formData.adjuntos.length === 0) {
      errors.push('Se requiere adjuntar al menos una foto de la recepción.');
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleFinalize = async () => {
    if (!validateForm()) {
      return;
    }

    const finalData: RecepcionData = {
      ...formData,
      estado: 'completa',
      fecha_informe: new Date().toISOString().split('T')[0],
      synced_with_supabase: true,
    };

    setFormData(finalData);
    await persistDraft(finalData);
    onFinish(finalData);
  };

  const handleDownloadPdf = async () => {
    setIsPdfGenerating(true);
    try {
      await downloadRecepcionPdf(formData);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24">
      
      {/* Wizard Header Sticky */}
      <div className="sticky top-14 sm:top-16 z-20 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          <div className="text-center flex-1 min-w-0">
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                Paso {currentStep} de 7: {STEPS[currentStep - 1]?.title}
              </span>
              {saveSuccessMsg && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <Check className="w-3 h-3" /> Guardado
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate font-mono">
              Equipo: {formData.interno || 'Sin número'} · {formData.marca || 'Marca'} · Obra: {formData.obra}
            </p>
          </div>

          <button
            type="button"
            onClick={() => persistDraft()}
            disabled={isSaving}
            className="min-h-[44px] px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg"
            title="Guardar borrador ahora"
          >
            <Save className={`w-3.5 h-3.5 text-amber-600 ${isSaving ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Borrador</span>
          </button>

        </div>

        {/* Progress Bar Top */}
        <div className="w-full bg-slate-100 h-1.5 overflow-hidden">
          <div
            className="bg-amber-500 h-full transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / 7) * 100}%` }}
          />
        </div>

        {/* Horizontal Step Navigation Pill for tablets & desktop */}
        <div className="hidden sm:flex items-center justify-between max-w-4xl mx-auto px-4 py-2 overflow-x-auto gap-1 text-[11px]">
          {STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepChange(step.id)}
                className={`px-2.5 py-1 rounded-md font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                  isActive
                    ? 'bg-[#0F2D3C] text-white'
                    : isCompleted
                    ? 'text-emerald-700 bg-emerald-50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{step.id}. {step.title}</span>
                {isCompleted && <Check className="w-3 h-3 text-emerald-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6">
        
        {/* ============================================================== */}
        {/* PASO 1: EQUIPO Y PROPIETARIO */}
        {/* ============================================================== */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-500" />
                1. Identificación del Equipo y Propietario
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Buscá si el equipo ya fue recibido anteriormente para autocompletar sus datos o cargalo de cero.
              </p>

              {/* Buscador de equipo existente */}
              <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Buscador de equipo existente (Nº Interno, Marca o Dominio)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={equipoSearchTerm}
                    onChange={(e) => setEquipoSearchTerm(e.target.value)}
                    placeholder="Escribí para buscar, ej. EX-204, Mercedes, AF892TR..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  {equipoSearchTerm && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto py-1">
                      {allEquiposExistentes
                        .filter(
                          (eq) =>
                            eq.interno?.toLowerCase().includes(equipoSearchTerm.toLowerCase()) ||
                            eq.marca?.toLowerCase().includes(equipoSearchTerm.toLowerCase()) ||
                            eq.dominio?.toLowerCase().includes(equipoSearchTerm.toLowerCase())
                        )
                        .map((eq) => (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={() => handleSelectExistingEquipo(eq)}
                            className="w-full px-4 py-2.5 text-left text-xs hover:bg-amber-50/70 border-b border-slate-100 last:border-0 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-slate-900 mr-2">[{eq.interno}]</span>
                              <span className="text-slate-700 font-medium">{eq.tipo} {eq.marca} {eq.modelo}</span>
                              <span className="text-slate-400 block text-[11px]">Patente: {eq.dominio || 'S/D'} · Serie: {eq.serie || 'S/N'}</span>
                            </div>
                            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                              Seleccionar
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Formulario de Equipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Nº Interno */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Nº Interno / Identificación del Equipo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.interno}
                    onChange={(e) => setFormData({ ...formData, interno: e.target.value })}
                    placeholder="ej. EX-204 / CAM-12 / MOT-03"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Dominio / Patente */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Dominio / Patente (si aplica)
                  </label>
                  <input
                    type="text"
                    value={formData.dominio || ''}
                    onChange={(e) => setFormData({ ...formData, dominio: e.target.value.toUpperCase() })}
                    placeholder="ej. AF 892 TR / Orugas s/patente"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Tipo / Familia */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tipo / Familia de Máquina
                  </label>
                  <input
                    type="text"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    placeholder="ej. Excavadora / Motoniveladora / Camión"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Marca */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                    placeholder="ej. Caterpillar / Komatsu / Scania"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Modelo */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                    placeholder="ej. 320D L / D6T / 4144"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Nº de Serie / Chasis */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Nº de Serie / Chasis
                  </label>
                  <input
                    type="text"
                    value={formData.serie}
                    onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                    placeholder="ej. CAT0320DLCKD78412"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Origen */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Origen / Procedencia
                  </label>
                  <select
                    value={formData.origen}
                    onChange={(e) => setFormData({ ...formData, origen: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Terceros (Alquiler)">Terceros (Alquiler)</option>
                    <option value="Subcontratista Obra">Subcontratista Obra</option>
                    <option value="Socio / UTE">Socio / UTE</option>
                    <option value="Traslado entre Obras Propias">Traslado entre Obras Propias</option>
                    <option value="Proveedor">Proveedor</option>
                  </select>
                </div>

                {/* Propietario Dropdown + Alta Rápida */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Propietario / Empresa *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddOwner(true)}
                      className="text-xs text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Alta Rápida
                    </button>
                  </div>
                  <select
                    value={formData.propietario}
                    onChange={(e) => setFormData({ ...formData, propietario: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">-- Seleccionar Propietario --</option>
                    {propietarios.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.razon_social} {p.cuit ? `(CUIT: ${p.cuit})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Modal Alta Rápida Propietario */}
        {showQuickAddOwner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
              <h3 className="text-base font-bold text-slate-900 mb-1">Nuevo Propietario / Empresa</h3>
              <p className="text-xs text-slate-500 mb-4">Cargá los datos fiscales y de contacto para el acta.</p>
              <form onSubmit={handleQuickAddOwner} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={newOwnerRazon}
                    onChange={(e) => setNewOwnerRazon(e.target.value)}
                    placeholder="ej. VialSur Maquinarias S.A."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">CUIT (sin guiones)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newOwnerCuit}
                    onChange={(e) => setNewOwnerCuit(e.target.value)}
                    placeholder="ej. 30712345678"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de Contacto</label>
                  <input
                    type="text"
                    value={newOwnerContacto}
                    onChange={(e) => setNewOwnerContacto(e.target.value)}
                    placeholder="ej. Ing. Martín Almada"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={newOwnerTel}
                    onChange={(e) => setNewOwnerTel(e.target.value)}
                    placeholder="ej. 1154329876"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowQuickAddOwner(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-sm"
                  >
                    Guardar y Asociar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 2: DATOS DE RECEPCIÓN */}
        {/* ============================================================== */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                2. Datos de Recepción en Obra
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Ingresá la fecha de ingreso, remito de entrega y el horómetro o kilometraje actual.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Fecha */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Fecha de Recepción *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Nº Remito */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Nº de Remito
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={formData.remito || ''}
                    onChange={(e) => setFormData({ ...formData, remito: e.target.value ? Number(e.target.value) : null })}
                    placeholder="ej. 84920"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Contador Horas / Km */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Lectura de Contador (Horómetro / Odómetro) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      required
                      value={formData.contador ?? ''}
                      onChange={(e) => setFormData({ ...formData, contador: e.target.value ? Number(e.target.value) : null })}
                      placeholder="ej. 4850"
                      className="flex-1 px-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-300">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, unidad_cont: 'hs' })}
                        className={`min-h-[40px] px-4 text-xs font-bold rounded-md transition-all ${
                          formData.unidad_cont === 'hs'
                            ? 'bg-[#0F2D3C] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Horas (Hs)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, unidad_cont: 'km' })}
                        className={`min-h-[40px] px-4 text-xs font-bold rounded-md transition-all ${
                          formData.unidad_cont === 'km'
                            ? 'bg-[#0F2D3C] text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Kilómetros (Km)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* PREGUNTA DESTACADA CON BOTONES GIGANTES SÍ / NO */}
              <div className="mt-8 p-5 sm:p-6 bg-slate-100/90 rounded-2xl border-2 border-slate-300 text-center">
                <span className="text-xs uppercase font-extrabold tracking-wider text-amber-700 block mb-1">
                  Cláusula contractual crítica
                </span>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-950 mb-4 max-w-lg mx-auto">
                  ¿Los servicios de mantenimiento los realiza el propietario?
                </h3>

                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  {/* Botón SÍ */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mantenimiento_propietario: true })}
                    className={`min-h-[64px] sm:min-h-[72px] rounded-2xl font-black text-base sm:text-lg flex flex-col items-center justify-center gap-1 border-2 transition-all active:scale-95 ${
                      formData.mantenimiento_propietario === true
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg ring-4 ring-emerald-500/20'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-5 h-5 stroke-[3]" />
                      <span>SÍ</span>
                    </div>
                    <span className="text-[10px] font-medium opacity-90">A cargo del Dueño</span>
                  </button>

                  {/* Botón NO */}
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, mantenimiento_propietario: false })}
                    className={`min-h-[64px] sm:min-h-[72px] rounded-2xl font-black text-base sm:text-lg flex flex-col items-center justify-center gap-1 border-2 transition-all active:scale-95 ${
                      formData.mantenimiento_propietario === false
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-lg ring-4 ring-amber-500/20'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <X className="w-5 h-5 stroke-[3]" />
                      <span>NO</span>
                    </div>
                    <span className="text-[10px] font-medium opacity-90">A cargo de la Obra</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 3: RELEVAMIENTO TÉCNICO */}
        {/* ============================================================== */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-500" />
                3. Relevamiento Técnico del Equipo
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Completá los componentes presentes en la unidad recibida.
              </p>

              {/* Sub-sección A: Motor Combustión */}
              <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Motor de Combustión</h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.motor_combustion) {
                        setFormData({ ...formData, motor_combustion: null });
                      } else {
                        setFormData({
                          ...formData,
                          motor_combustion: { marca: '', modelo: '', serie: '', correa: '' },
                        });
                      }
                    }}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800"
                  >
                    {formData.motor_combustion ? 'Quitar Motor' : '+ Relevar Motor'}
                  </button>
                </div>

                {formData.motor_combustion ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Marca Motor</label>
                      <input
                        type="text"
                        value={formData.motor_combustion.marca}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motor_combustion: { ...formData.motor_combustion!, marca: e.target.value },
                          })
                        }
                        placeholder="ej. Caterpillar, Cummins, Scania"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Modelo Motor</label>
                      <input
                        type="text"
                        value={formData.motor_combustion.modelo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motor_combustion: { ...formData.motor_combustion!, modelo: e.target.value },
                          })
                        }
                        placeholder="ej. C6.4 ACERT / QSB 6.7"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nº de Serie Motor</label>
                      <input
                        type="text"
                        value={formData.motor_combustion.serie}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motor_combustion: { ...formData.motor_combustion!, serie: e.target.value },
                          })
                        }
                        placeholder="ej. C6D-981234"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Estado de Correas</label>
                      <input
                        type="text"
                        value={formData.motor_combustion.correa}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motor_combustion: { ...formData.motor_combustion!, correa: e.target.value },
                          })
                        }
                        placeholder="ej. 8PK-1540 en buen estado"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No aplica o sin datos ingresados.</p>
                )}
              </div>

              {/* Sub-sección B: Motor Eléctrico */}
              <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Motor Eléctrico (si posee)</h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.motor_electrico) {
                        setFormData({ ...formData, motor_electrico: null });
                      } else {
                        setFormData({
                          ...formData,
                          motor_electrico: { marca: '', modelo: '', potencia: '', serie: '' },
                        });
                      }
                    }}
                    className="text-xs font-bold text-amber-700 hover:text-amber-800"
                  >
                    {formData.motor_electrico ? 'Quitar Motor Eléctrico' : '+ Relevar Motor Eléctrico'}
                  </button>
                </div>

                {formData.motor_electrico ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Marca</label>
                      <input
                        type="text"
                        value={formData.motor_electrico.marca}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motor_electrico: { ...formData.motor_electrico!, marca: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Potencia (HP / kW)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={formData.motor_electrico.potencia}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motor_electrico: { ...formData.motor_electrico!, potencia: e.target.value },
                          })
                        }
                        placeholder="ej. 75 kW / 100 HP"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Modelo</label>
                      <input
                        type="text"
                        value={formData.motor_electrico.modelo}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motor_electrico: { ...formData.motor_electrico!, modelo: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Nº de Serie</label>
                      <input
                        type="text"
                        value={formData.motor_electrico.serie}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motor_electrico: { ...formData.motor_electrico!, serie: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No aplica o sin datos ingresados.</p>
                )}
              </div>

              {/* Sub-sección C: Filtros Instalados */}
              <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Filtros Instalados</h3>
                  <button
                    type="button"
                    onClick={() => {
                      const firstFiltro = filtros[0];
                      setFormData({
                        ...formData,
                        filtros_instalados: [
                          ...formData.filtros_instalados,
                          {
                            tipo_filtro: firstFiltro?.id || '',
                            tipo_filtro_nombre: firstFiltro?.tipo || 'Filtro',
                            codigo: '',
                            marca: '',
                            observacion: '',
                          },
                        ],
                      });
                    }}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-bold bg-[#0F2D3C] text-white rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Filtro
                  </button>
                </div>

                {formData.filtros_instalados.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No se agregaron filtros instalados todavía.</p>
                ) : (
                  <div className="space-y-3">
                    {formData.filtros_instalados.map((item, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                        <select
                          value={item.tipo_filtro}
                          onChange={(e) => {
                            const selected = filtros.find((f) => f.id === e.target.value);
                            const updated = [...formData.filtros_instalados];
                            updated[idx].tipo_filtro = e.target.value;
                            updated[idx].tipo_filtro_nombre = selected?.tipo || '';
                            setFormData({ ...formData, filtros_instalados: updated });
                          }}
                          className="w-full sm:w-44 px-2 py-1.5 text-xs border border-slate-300 rounded-md font-semibold"
                        >
                          {filtros.map((f) => (
                            <option key={f.id} value={f.id}>{f.tipo}</option>
                          ))}
                        </select>

                        <input
                          type="text"
                          placeholder="Código (ej. 1R-1808)"
                          value={item.codigo}
                          onChange={(e) => {
                            const updated = [...formData.filtros_instalados];
                            updated[idx].codigo = e.target.value;
                            setFormData({ ...formData, filtros_instalados: updated });
                          }}
                          className="w-full sm:w-32 px-2 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                        />

                        <input
                          type="text"
                          placeholder="Marca (ej. CAT, Mann)"
                          value={item.marca}
                          onChange={(e) => {
                            const updated = [...formData.filtros_instalados];
                            updated[idx].marca = e.target.value;
                            setFormData({ ...formData, filtros_instalados: updated });
                          }}
                          className="w-full sm:w-28 px-2 py-1.5 text-xs border border-slate-300 rounded-md"
                        />

                        <input
                          type="text"
                          placeholder="Observación (ej. Nuevo)"
                          value={item.observacion}
                          onChange={(e) => {
                            const updated = [...formData.filtros_instalados];
                            updated[idx].observacion = e.target.value;
                            setFormData({ ...formData, filtros_instalados: updated });
                          }}
                          className="flex-1 w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              filtros_instalados: formData.filtros_instalados.filter((_, i) => i !== idx),
                            });
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md shrink-0"
                          title="Eliminar filtro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-sección D: Elementos de Desgaste */}
              <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Elementos de Desgaste</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        elementos_desgaste: [...formData.elementos_desgaste, { descripcion: '' }],
                      });
                    }}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-bold bg-[#0F2D3C] text-white rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Ítem
                  </button>
                </div>

                {formData.elementos_desgaste.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No se agregaron elementos de desgaste aún.</p>
                ) : (
                  <div className="space-y-2">
                    {formData.elementos_desgaste.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.descripcion}
                          onChange={(e) => {
                            const updated = [...formData.elementos_desgaste];
                            updated[idx].descripcion = e.target.value;
                            setFormData({ ...formData, elementos_desgaste: updated });
                          }}
                          placeholder="ej. Cuchillas de balde al 50%, orugas con zapatas sanas"
                          className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              elementos_desgaste: formData.elementos_desgaste.filter((_, i) => i !== idx),
                            });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sub-sección E: Documentación y Accesorios (Checklist con toggles grandes) */}
              <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <h3 className="text-sm font-bold text-slate-800 mb-3">
                  Documentación y Accesorios de Seguridad
                </h3>

                <div className="space-y-2">
                  {[
                    { key: 'documentacion', label: 'Documentación técnica / seguro vigente' },
                    { key: 'gato_hidraulico', label: 'Gato hidráulico' },
                    { key: 'matafuego', label: 'Matafuego reglamentario con marbete' },
                    { key: 'botiquin', label: 'Botiquín de primeros auxilios' },
                    { key: 'calzas_cuñas', label: 'Calzas / Cuñas de seguridad' },
                    { key: 'rueda_auxilio', label: 'Rueda de auxilio' },
                    { key: 'kit_seguridad', label: 'Kit de seguridad (Balizas y chaleco)' },
                  ].map((acc) => {
                    const isChecked = (formData.documentos_accesorios as any)[acc.key];
                    return (
                      <div
                        key={acc.key}
                        className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3"
                      >
                        <span className="text-xs font-semibold text-slate-800">{acc.label}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                documentos_accesorios: {
                                  ...formData.documentos_accesorios,
                                  [acc.key]: true,
                                },
                              })
                            }
                            className={`min-h-[40px] px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                              isChecked
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            Está ✔
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                documentos_accesorios: {
                                  ...formData.documentos_accesorios,
                                  [acc.key]: false,
                                },
                              })
                            }
                            className={`min-h-[40px] px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                              !isChecked
                                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            No está ✘
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Comentario de accesorios
                  </label>
                  <input
                    type="text"
                    value={formData.documentos_accesorios.comentario || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        documentos_accesorios: {
                          ...formData.documentos_accesorios,
                          comentario: e.target.value,
                        },
                      })
                    }
                    placeholder="ej. Matafuego vence en 12/2026, falta llave de ruedas"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* Sub-sección F: Faltantes */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Faltantes adicionales</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        faltantes: [...formData.faltantes, { descripcion: '' }],
                      });
                    }}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-bold bg-[#0F2D3C] text-white rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Faltante
                  </button>
                </div>

                {formData.faltantes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No se declararon faltantes adicionales.</p>
                ) : (
                  <div className="space-y-2">
                    {formData.faltantes.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.descripcion}
                          onChange={(e) => {
                            const updated = [...formData.faltantes];
                            updated[idx].descripcion = e.target.value;
                            setFormData({ ...formData, faltantes: updated });
                          }}
                          placeholder="ej. Falta tapa de tanque de combustible, falta antena de radio"
                          className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              faltantes: formData.faltantes.filter((_, i) => i !== idx),
                            });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 4: PLAN DE MANTENIMIENTO */}
        {/* ============================================================== */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-500" />
                    4. Plan de Mantenimiento y Lubricantes
                  </h2>
                  <p className="text-xs text-slate-500">
                    Historial de últimos servicios y fluidos por sector.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyLastReception}
                  className="min-h-[44px] px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copiar de última recepción</span>
                </button>
              </div>

              {/* 1. Últimos Servicios Realizados */}
              <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">Últimos Servicios Realizados</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        ultimos_servicios: [
                          ...formData.ultimos_servicios,
                          {
                            fecha: new Date().toISOString().split('T')[0],
                            contador: null,
                            unidad: 'hs',
                            tipo_servicio: 'Mantenimiento Preventivo 250 Hs',
                          },
                        ],
                      });
                    }}
                    className="min-h-[36px] px-2.5 py-1 text-xs font-bold bg-[#0F2D3C] text-white rounded-lg flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Servicio
                  </button>
                </div>

                {formData.ultimos_servicios.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No hay servicios previos registrados.</p>
                ) : (
                  <div className="space-y-2.5">
                    {formData.ultimos_servicios.map((serv, idx) => (
                      <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Fecha</label>
                          <input
                            type="date"
                            value={serv.fecha}
                            onChange={(e) => {
                              const updated = [...formData.ultimos_servicios];
                              updated[idx].fecha = e.target.value;
                              setFormData({ ...formData, ultimos_servicios: updated });
                            }}
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Hs / Km</label>
                          <input
                            type="number"
                            value={serv.contador ?? ''}
                            onChange={(e) => {
                              const updated = [...formData.ultimos_servicios];
                              updated[idx].contador = e.target.value ? Number(e.target.value) : null;
                              setFormData({ ...formData, ultimos_servicios: updated });
                            }}
                            placeholder="ej. 4500"
                            className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
                          />
                        </div>

                        <div className="sm:col-span-2 flex items-center gap-2">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Tipo de Servicio</label>
                            <input
                              type="text"
                              value={serv.tipo_servicio}
                              onChange={(e) => {
                                const updated = [...formData.ultimos_servicios];
                                updated[idx].tipo_servicio = e.target.value;
                                setFormData({ ...formData, ultimos_servicios: updated });
                              }}
                              placeholder="ej. Cambio de aceite motor y filtros"
                              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-md"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                ultimos_servicios: formData.ultimos_servicios.filter((_, i) => i !== idx),
                              });
                            }}
                            className="mt-3 p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Lubricantes por Sector (Acordeón táctil en celular) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Lubricantes y Fluidos por Sector</h3>
                    <p className="text-[11px] text-slate-500">Tocá un sector para abrir sus especificaciones.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {sectores.map((sec) => {
                    const isExpanded = expandedSectorId === sec.id;
                    const existingLub = formData.lubricantes.find((l) => l.sector === sec.id);

                    return (
                      <div
                        key={sec.id}
                        className={`bg-white rounded-xl border transition-all ${
                          existingLub ? 'border-amber-300 shadow-xs' : 'border-slate-200'
                        }`}
                      >
                        {/* Accordion Trigger Header */}
                        <button
                          type="button"
                          onClick={() => setExpandedSectorId(isExpanded ? null : sec.id)}
                          className="w-full min-h-[48px] px-3.5 py-3 flex items-center justify-between text-left hover:bg-slate-50 rounded-xl"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">{sec.sector}</span>
                            {existingLub && (
                              <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                                {existingLub.marca || 'Configurado'}
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {/* Accordion Body */}
                        {isExpanded && (
                          <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/40">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              
                              {/* Tipo */}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Aceite / Grasa</label>
                                <select
                                  value={existingLub?.aceite_grasa || 'aceite'}
                                  onChange={(e) => {
                                    const val = e.target.value as AceiteGrasa;
                                    const currentList = [...formData.lubricantes];
                                    const idx = currentList.findIndex((l) => l.sector === sec.id);
                                    if (idx >= 0) {
                                      currentList[idx].aceite_grasa = val;
                                    } else {
                                      currentList.push({
                                        sector: sec.id,
                                        sector_nombre: sec.sector,
                                        aceite_grasa: val,
                                        marca: '',
                                        planilla_adjunta: false,
                                      });
                                    }
                                    setFormData({ ...formData, lubricantes: currentList });
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                >
                                  <option value="aceite">Aceite</option>
                                  <option value="grasa">Grasa</option>
                                </select>
                              </div>

                              {/* Marca / Grado */}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Marca y Grado</label>
                                <input
                                  type="text"
                                  value={existingLub?.marca || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const currentList = [...formData.lubricantes];
                                    const idx = currentList.findIndex((l) => l.sector === sec.id);
                                    if (idx >= 0) {
                                      currentList[idx].marca = val;
                                    } else {
                                      currentList.push({
                                        sector: sec.id,
                                        sector_nombre: sec.sector,
                                        marca: val,
                                        aceite_grasa: 'aceite',
                                        planilla_adjunta: false,
                                      });
                                    }
                                    setFormData({ ...formData, lubricantes: currentList });
                                  }}
                                  placeholder="ej. Mobil Delvac 15W40 / Shell Tellus 46"
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                />
                              </div>

                              {/* Cantidad y Unidad */}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Cantidad</label>
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    step="any"
                                    value={existingLub?.cantidad ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? Number(e.target.value) : null;
                                      const currentList = [...formData.lubricantes];
                                      const idx = currentList.findIndex((l) => l.sector === sec.id);
                                      if (idx >= 0) {
                                        currentList[idx].cantidad = val;
                                      } else {
                                        currentList.push({
                                          sector: sec.id,
                                          sector_nombre: sec.sector,
                                          cantidad: val,
                                          marca: '',
                                          planilla_adjunta: false,
                                        });
                                      }
                                      setFormData({ ...formData, lubricantes: currentList });
                                    }}
                                    placeholder="ej. 28"
                                    className="w-20 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                                  />
                                  <select
                                    value={existingLub?.unidad_cant || 'litros'}
                                    onChange={(e) => {
                                      const val = e.target.value as UnidadCantidad;
                                      const currentList = [...formData.lubricantes];
                                      const idx = currentList.findIndex((l) => l.sector === sec.id);
                                      if (idx >= 0) currentList[idx].unidad_cant = val;
                                      setFormData({ ...formData, lubricantes: currentList });
                                    }}
                                    className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                  >
                                    <option value="litros">Litros</option>
                                    <option value="kg">Kg</option>
                                  </select>
                                </div>
                              </div>

                              {/* Frecuencia */}
                              <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Frecuencia de Cambio</label>
                                <div className="flex gap-1.5">
                                  <input
                                    type="number"
                                    value={existingLub?.frecuencia ?? ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? Number(e.target.value) : null;
                                      const currentList = [...formData.lubricantes];
                                      const idx = currentList.findIndex((l) => l.sector === sec.id);
                                      if (idx >= 0) currentList[idx].frecuencia = val;
                                      setFormData({ ...formData, lubricantes: currentList });
                                    }}
                                    placeholder="ej. 250"
                                    className="w-20 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                                  />
                                  <span className="self-center text-xs font-semibold text-slate-600">hs</span>
                                </div>
                              </div>

                              {/* Comentarios */}
                              <div className="sm:col-span-2">
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">Comentarios / Observaciones</label>
                                <input
                                  type="text"
                                  value={existingLub?.comentarios || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const currentList = [...formData.lubricantes];
                                    const idx = currentList.findIndex((l) => l.sector === sec.id);
                                    if (idx >= 0) currentList[idx].comentarios = val;
                                    setFormData({ ...formData, lubricantes: currentList });
                                  }}
                                  placeholder="ej. Nivel óptimo, sin fugas"
                                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                                />
                              </div>

                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 5: FOTOS Y ADJUNTOS */}
        {/* ============================================================== */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                5. Registro Fotográfico y Adjuntos
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Fotografiá el estado del equipo al ingresar a la obra.
              </p>

              <UploaderFotos
                obra={formData.obra}
                recepcionId={formData.id}
                adjuntos={formData.adjuntos}
                onChange={(adjuntos) => setFormData({ ...formData, adjuntos })}
              />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 6: DATOS COMPLEMENTARIOS */}
        {/* ============================================================== */}
        {currentStep === 6 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                6. Datos Complementarios y Observaciones Generales
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Detallá el estado general de pintura, cabina, vidrios, pérdidas visibles o condiciones particulares del transporte.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Observaciones Generales de Recepción
                  </label>
                  <textarea
                    rows={6}
                    value={formData.observaciones_generales || ''}
                    onChange={(e) => setFormData({ ...formData, observaciones_generales: e.target.value })}
                    placeholder="Describí el estado visual general, golpes, abolladuras, parabrisas o si vino en carretón o por sus propios medios..."
                    className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Datos Complementarios (campo específico de tabla)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.datos_complementarios || ''}
                    onChange={(e) => setFormData({ ...formData, datos_complementarios: e.target.value })}
                    placeholder="Notas adicionales técnicas o administrativas del equipo..."
                    className="w-full p-3.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* PASO 7: RESUMEN, CIERRE Y GENERACIÓN DE PDF */}
        {/* ============================================================== */}
        {currentStep === 7 && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-amber-500" />
                    7. Resumen y Cierre del Acta
                  </h2>
                  <p className="text-xs text-slate-500">
                    Verificá todos los datos cargados antes de finalizar el acta y descargar el PDF oficial.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isPdfGenerating}
                  className="min-h-[48px] px-4 py-2.5 bg-[#0F2D3C] hover:bg-[#163e52] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <FileDown className="w-4 h-4 text-amber-400" />
                  <span>{isPdfGenerating ? 'Generando PDF...' : 'Descargar PDF'}</span>
                </button>
              </div>

              {/* Errores de Validación si existen */}
              {validationErrors.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>No se puede finalizar la recepción:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tarjeta de Resumen con accesos directos a "Editar" */}
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden mb-6">
                
                {/* 1. Equipo */}
                <div className="p-4 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Equipo y Propietario
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      [{formData.interno || 'S/N'}] {formData.tipo} {formData.marca} {formData.modelo}
                    </p>
                    <p className="text-xs text-slate-600">
                      Serie: {formData.serie || 'S/N'} · Patente: {formData.dominio || 'S/D'} · Obra: {formData.obra}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStepChange(1)}
                    className="min-h-[40px] px-3 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-lg"
                  >
                    Editar
                  </button>
                </div>

                {/* 2. Datos Recepción */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Datos de Recepción
                    </span>
                    <p className="text-xs text-slate-800 mt-0.5">
                      Fecha: <strong>{formatFechaArg(formData.fecha)}</strong> · Remito: <strong>{formData.remito || '-'}</strong>
                    </p>
                    <p className="text-xs text-slate-800">
                      Lectura: <strong>{formatNumeroArg(formData.contador)} {formData.unidad_cont}</strong>
                    </p>
                    <p className="text-xs font-semibold mt-1">
                      Mantenimiento a cargo de:{' '}
                      <span className={formData.mantenimiento_propietario ? 'text-emerald-700' : 'text-amber-700'}>
                        {formData.mantenimiento_propietario ? 'PROPIETARIO (SÍ)' : 'OBRA (NO)'}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStepChange(2)}
                    className="min-h-[40px] px-3 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-lg"
                  >
                    Editar
                  </button>
                </div>

                {/* 3. Relevamiento */}
                <div className="p-4 bg-slate-50/70 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Relevamiento
                    </span>
                    <p className="text-xs text-slate-700 mt-0.5">
                      Filtros: {formData.filtros_instalados.length} · Desgaste: {formData.elementos_desgaste.length} · Faltantes: {formData.faltantes.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStepChange(3)}
                    className="min-h-[40px] px-3 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-lg"
                  >
                    Editar
                  </button>
                </div>

                {/* 4. Fotos */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Registro Fotográfico
                    </span>
                    <p className="text-xs text-slate-800 mt-0.5 font-bold">
                      {formData.adjuntos.length} fotos / documentos cargados
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStepChange(5)}
                    className="min-h-[40px] px-3 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-lg"
                  >
                    Editar
                  </button>
                </div>

              </div>

              {/* Responsable de Confección */}
              <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 mb-6">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Confeccionó el Acta (Personal Responsable) *
                </label>
                <select
                  value={formData.responsable_id}
                  onChange={(e) => {
                    const sel = responsables.find((r) => r.id === e.target.value);
                    setFormData({
                      ...formData,
                      responsable_id: e.target.value,
                      responsable_nombre: sel?.nombre || '',
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {responsables.map((r) => (
                    <option key={r.id} value={r.id}>{r.nombre}</option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Fecha de informe: {formatFechaArg(formData.fecha_informe || formData.fecha)}
                </span>
              </div>

              {/* Botón Finalizar Recepción */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFinalize}
                  className="w-full min-h-[56px] bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white rounded-2xl font-black text-base shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all"
                >
                  <CheckCircle className="w-6 h-6 stroke-[2.5]" />
                  <span>Finalizar y Aprobar Recepción</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* Fixed Bottom Action Bar (Touch Targets >= 48px) */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3 px-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          
          {/* Botón Anterior */}
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => handleStepChange(currentStep - 1)}
            className={`min-h-[48px] px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors ${
              currentStep === 1
                ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100'
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-98'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          {/* Botón Siguiente / Resumen */}
          {currentStep < 7 ? (
            <button
              type="button"
              onClick={() => handleStepChange(currentStep + 1)}
              className="min-h-[48px] px-6 bg-[#0F2D3C] hover:bg-[#163e52] active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all"
            >
              <span>Siguiente</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalize}
              className="min-h-[48px] px-6 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all"
            >
              <span>Finalizar Recepción</span>
              <CheckCircle className="w-4 h-4" />
            </button>
          )}

        </div>
      </footer>

    </div>
  );
};
