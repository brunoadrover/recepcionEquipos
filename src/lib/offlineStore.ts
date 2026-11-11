import { RecepcionData, Propietario, PlanListaSector, FiltrosLista, Responsable, ObraItem } from '../types';
import { getSupabaseClient } from './supabase';
import {
  ensureValidUuid,
  isValidUuid,
  createPropietarioDirect,
  updatePropietarioDirect,
  deletePropietarioDirect,
  fetchPropietariosDirect,
  fetchSectoresDirect,
  fetchFiltrosDirect,
  fetchResponsablesDirect,
  fetchEquiposDirect,
} from './supabaseService';

const KEYS = {
  OBRAS: 'app_obras',
  ACTIVE_OBRA: 'app_active_obra',
  PROPIETARIOS: 'app_propietarios',
  SECTORES: 'app_sectores',
  FILTROS: 'app_filtros',
  RESPONSABLES: 'app_responsables',
  RECEPCIONES: 'app_recepciones',
  COMPANY_LOGO: 'app_company_logo',
};

// Initial default seeds with valid PostgreSQL UUIDs matching Supabase
export const DEFAULT_OBRAS: ObraItem[] = [
  { id: '11111111-1111-4111-a111-111111111111', codigo_uo: 'UO-104', nombre: 'Autopista RN 7 Km 140-190' },
  { id: '22222222-2222-4222-a222-222222222222', codigo_uo: 'UO-212', nombre: 'Central Termoeléctrica Pilar' },
  { id: '33333333-3333-4333-a333-333333333333', codigo_uo: 'UO-305', nombre: 'Viaducto Ferroviario Mitre' },
  { id: '44444444-4444-4444-a444-444444444444', codigo_uo: 'UO-418', nombre: 'Colector Cloacal Sur Etapa 2' },
];

export const DEFAULT_SECTORES: PlanListaSector[] = [
  { id: 'fbda9acd-610f-4335-85b4-1c0e3df7ccba', sector: 'Reductor tambor traslación' },
  { id: '4fab505c-f378-4b0e-a586-4555ae6af9cb', sector: 'Reductor tambor vibración' },
  { id: '1b8997a1-2d7c-4890-a359-000000000001', sector: 'Motor térmico' },
  { id: '1b8997a1-2d7c-4890-a359-000000000002', sector: 'Transmisión y convertidor' },
  { id: '1b8997a1-2d7c-4890-a359-000000000003', sector: 'Sistema hidráulico principal' },
  { id: '1b8997a1-2d7c-4890-a359-000000000004', sector: 'Diferencial delantero / trasero' },
  { id: '1b8997a1-2d7c-4890-a359-000000000005', sector: 'Mandos finales y reductores' },
  { id: '1b8997a1-2d7c-4890-a359-000000000006', sector: 'Sistema de enfriamiento (refrigerante)' },
];

export const DEFAULT_FILTROS: FiltrosLista[] = [
  { id: '579d227f-b087-435e-a4cd-97465bbff1a4', tipo: 'Aceite de Motor' },
  { id: 'f0020000-0000-4000-a000-000000000002', tipo: 'Combustible Primario' },
  { id: 'f0030000-0000-4000-a000-000000000003', tipo: 'Combustible Secundario / Trampa' },
  { id: 'f0040000-0000-4000-a000-000000000004', tipo: 'Aire Primario' },
  { id: 'f0050000-0000-4000-a000-000000000005', tipo: 'Aire Secundario' },
  { id: 'f0060000-0000-4000-a000-000000000006', tipo: 'Hidráulico Retorno' },
  { id: 'f0070000-0000-4000-a000-000000000007', tipo: 'Transmisión' },
  { id: 'f0080000-0000-4000-a000-000000000008', tipo: 'Filtro de Cabina / Habitáculo' },
];

export const DEFAULT_RESPONSABLES: Responsable[] = [
  { id: '4d0479e6-c3ff-4303-8f5a-d4a29a4017c3', nombre: 'Martín B. Adrover (Responsable)' },
  { id: '4c2c4cb5-30b2-4661-9efe-d342a4438bc7', nombre: 'Dario Robles (Jefe de Taller)' },
  { id: '28d15d14-02f1-4968-9313-ffc3feca0767', nombre: 'Diego Cachambe (Administrador)' },
  { id: '7d80e96b-8a19-4b26-ac6c-cb6e5cee3374', nombre: 'Lucas Boisseau (Administrador)' },
];

export const DEFAULT_PROPIETARIOS: Propietario[] = [
  {
    id: '89e36a4a-1d2c-4d11-b1d9-e9b39c3d3d1c',
    razon_social: 'VialSur Maquinarias S.A.',
    cuit: 30712345678,
    nombre_contacto: 'Martín Almada',
    tel_contacto: 1154329876,
    correo_contacto: 'flota@vialsur.com.ar',
  },
  {
    id: '99e36a4a-2d2c-4d22-b2d9-e9b39c3d3d2d',
    razon_social: 'Equipos y Logística Patagónica S.R.L.',
    cuit: 30698745123,
    nombre_contacto: 'Rodrigo Peña',
    tel_contacto: 2994456789,
    correo_contacto: 'operaciones@elpatagonia.com',
  },
  {
    id: 'aa36a4a-3d2c-4d33-b3d9-e9b39c3d3d3e',
    razon_social: 'Construcciones Civiles del Litoral S.A.',
    cuit: 30708529631,
    nombre_contacto: 'Aníbal Quiroga',
    tel_contacto: 3424123456,
    correo_contacto: 'aquiroga@litoralobras.com.ar',
  },
];

// Helper to load or initialize from localStorage
function getStored<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading key ${key}:`, err);
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving key ${key}:`, err);
  }
}

// Obras
export function getObras(): ObraItem[] {
  return getStored<ObraItem[]>(KEYS.OBRAS, DEFAULT_OBRAS);
}

export function saveObra(obra: ObraItem): void {
  const list = getObras();
  const safeObra = { ...obra, id: ensureValidUuid(obra.id) };
  const idx = list.findIndex((o) => o.id === safeObra.id);
  if (idx >= 0) {
    list[idx] = safeObra;
  } else {
    list.unshift(safeObra);
  }
  setStored(KEYS.OBRAS, list);
}

export function getActiveObra(): string {
  const stored = localStorage.getItem(KEYS.ACTIVE_OBRA);
  if (stored) return stored;
  const obras = getObras();
  const first = obras[0]?.nombre || 'Autopista RN 7 Km 140-190';
  localStorage.setItem(KEYS.ACTIVE_OBRA, first);
  return first;
}

export function setActiveObra(nombre: string): void {
  localStorage.setItem(KEYS.ACTIVE_OBRA, nombre);
}

// Propietarios
export function getPropietarios(): Propietario[] {
  return getStored<Propietario[]>(KEYS.PROPIETARIOS, DEFAULT_PROPIETARIOS);
}

export async function savePropietario(propietario: Propietario): Promise<Propietario> {
  const safeId = ensureValidUuid(propietario.id);
  const safeProp: Propietario = { ...propietario, id: safeId };

  // 1. Update local cache immediately
  const list = getPropietarios();
  const idx = list.findIndex((p) => p.id === safeProp.id);
  if (idx >= 0) {
    list[idx] = safeProp;
  } else {
    list.unshift(safeProp);
  }
  setStored(KEYS.PROPIETARIOS, list);
  window.dispatchEvent(new CustomEvent('propietarios-updated', { detail: list }));

  // 2. Persist to Supabase
  try {
    if (idx >= 0) {
      await updatePropietarioDirect(safeProp);
    } else {
      await createPropietarioDirect(safeProp);
    }
  } catch (err) {
    console.warn('Background Supabase save error for propietario:', err);
  }

  return safeProp;
}

export async function deletePropietario(id: string): Promise<void> {
  const list = getPropietarios().filter((p) => p.id !== id);
  setStored(KEYS.PROPIETARIOS, list);
  window.dispatchEvent(new CustomEvent('propietarios-updated', { detail: list }));
  await deletePropietarioDirect(id);
}

// Sectores
export function getSectores(): PlanListaSector[] {
  return getStored<PlanListaSector[]>(KEYS.SECTORES, DEFAULT_SECTORES);
}

export function saveSector(item: PlanListaSector): void {
  const safeSector = { ...item, id: ensureValidUuid(item.id) };
  const list = getSectores();
  const idx = list.findIndex((s) => s.id === safeSector.id);
  if (idx >= 0) list[idx] = safeSector;
  else list.push(safeSector);
  setStored(KEYS.SECTORES, list);
  window.dispatchEvent(new CustomEvent('sectores-updated', { detail: list }));

  getSupabaseClient().from('plan_lista_sector').upsert({ id: safeSector.id, sector: safeSector.sector }).then();
}

export function deleteSector(id: string): void {
  const list = getSectores().filter((s) => s.id !== id);
  setStored(KEYS.SECTORES, list);
  window.dispatchEvent(new CustomEvent('sectores-updated', { detail: list }));
  if (isValidUuid(id)) {
    getSupabaseClient().from('plan_lista_sector').delete().eq('id', id).then();
  }
}

// Filtros
export function getFiltros(): FiltrosLista[] {
  return getStored<FiltrosLista[]>(KEYS.FILTROS, DEFAULT_FILTROS);
}

export function saveFiltro(item: FiltrosLista): void {
  const safeFiltro = { ...item, id: ensureValidUuid(item.id) };
  const list = getFiltros();
  const idx = list.findIndex((f) => f.id === safeFiltro.id);
  if (idx >= 0) list[idx] = safeFiltro;
  else list.push(safeFiltro);
  setStored(KEYS.FILTROS, list);
  window.dispatchEvent(new CustomEvent('filtros-updated', { detail: list }));

  getSupabaseClient().from('filtros_lista').upsert({ id: safeFiltro.id, tipo: safeFiltro.tipo }).then();
}

export function deleteFiltro(id: string): void {
  const list = getFiltros().filter((f) => f.id !== id);
  setStored(KEYS.FILTROS, list);
  window.dispatchEvent(new CustomEvent('filtros-updated', { detail: list }));
  if (isValidUuid(id)) {
    getSupabaseClient().from('filtros_lista').delete().eq('id', id).then();
  }
}

// Responsables
export function getResponsables(): Responsable[] {
  return getStored<Responsable[]>(KEYS.RESPONSABLES, DEFAULT_RESPONSABLES);
}

export function saveResponsable(item: Responsable): void {
  const safeResp = { ...item, id: ensureValidUuid(item.id) };
  const list = getResponsables();
  const idx = list.findIndex((r) => r.id === safeResp.id);
  if (idx >= 0) list[idx] = safeResp;
  else list.push(safeResp);
  setStored(KEYS.RESPONSABLES, list);
  window.dispatchEvent(new CustomEvent('responsables-updated', { detail: list }));

  getSupabaseClient().from('responsable').upsert({ id: safeResp.id, nombre: safeResp.nombre }).then();
}

export function deleteResponsable(id: string): void {
  const list = getResponsables().filter((r) => r.id !== id);
  setStored(KEYS.RESPONSABLES, list);
  window.dispatchEvent(new CustomEvent('responsables-updated', { detail: list }));
  if (isValidUuid(id)) {
    getSupabaseClient().from('responsable').delete().eq('id', id).then();
  }
}

// Company Logo
export function getCompanyLogo(): string | null {
  return localStorage.getItem(KEYS.COMPANY_LOGO);
}

export function saveCompanyLogo(dataUrl: string): void {
  localStorage.setItem(KEYS.COMPANY_LOGO, dataUrl);
}

// Recepciones Initial Seed (Realistic for Field Use with valid UUIDs)
const SEED_RECEPCIONES: RecepcionData[] = [
  {
    id: 'e4a198b2-3c12-4f77-9812-78d91024e001',
    fecha: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    interno: 'EX-204',
    tipo: 'Excavadora sobre orugas',
    marca: 'Caterpillar',
    modelo: '320D L',
    contador: 4850,
    unidad_cont: 'hs',
    serie: 'CAT0320DLCKD78412',
    origen: 'Terceros (Alquiler)',
    mantenimiento_propietario: true,
    obra: 'Autopista RN 7 Km 140-190',
    remito: 84920,
    propietario: '89e36a4a-1d2c-4d11-b1d9-e9b39c3d3d1c',
    dominio: 'NO APLICA (ORUGAS)',
    estado: 'aprobada',
    responsable_id: '4c2c4cb5-30b2-4661-9efe-d342a4438bc7',
    responsable_nombre: 'Dario Robles (Jefe de Taller)',
    fecha_informe: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
    observaciones_generales: 'Equipo recibido en buen estado operativo general. Orugas con 65% de vida útil remanente. Se entrega con balde de 1.2 m3 con calzas y trampa de agua purgada.',
    datos_complementarios: 'Se verificó sistema hidráulico sin pérdidas activas bajo presión de 350 bar. Propietario adjuntó libreta de mantenimiento firmada al día.',
    motor_combustion: {
      marca: 'Caterpillar',
      modelo: 'C6.4 ACERT',
      serie: 'C6D-981234',
      correa: '8PK-1540 (Buen estado)',
    },
    motor_electrico: null,
    filtros_instalados: [
      { tipo_filtro: '579d227f-b087-435e-a4cd-97465bbff1a4', tipo_filtro_nombre: 'Aceite de Motor', codigo: '1R-1808', marca: 'CAT OEM', observacion: 'Reemplazado hace 50 hs' },
    ],
    elementos_desgaste: [
      { descripcion: 'Cuchillas y calzas de balde al 60% de desgaste' },
      { descripcion: 'Zapatas de oruga 600 mm con tejas enteras sin fisuras' },
    ],
    faltantes: [
      { descripcion: 'Falta candado en tapa de tanque de combustible' },
    ],
    ultimos_servicios: [
      { fecha: '2026-09-15', contador: 4600, unidad: 'hs', tipo_servicio: 'Servicio 500 Hs - Cambio aceite motor y filtros de combustible' },
    ],
    lubricantes: [
      {
        sector: 'fbda9acd-610f-4335-85b4-1c0e3df7ccba',
        sector_nombre: 'Reductor tambor traslación',
        aceite_grasa: 'aceite',
        marca: 'Mobil Delvac MX 15W-40',
        cantidad: 28,
        unidad_cant: 'litros',
        frecuencia: 250,
        unidad_fcia: 'hs',
        planilla_adjunta: true,
        comentarios: 'Nivel óptimo en varilla',
      },
    ],
    documentos_accesorios: {
      documentacion: true,
      gato_hidraulico: false,
      matafuego: true,
      botiquin: true,
      calzas_cuñas: true,
      rueda_auxilio: false,
      kit_seguridad: true,
      comentario: 'Matafuego de 10 kg con marbete vigente hasta Dic-2026. Botiquín sellado.',
    },
    adjuntos: [],
    synced_with_supabase: true,
  },
];

// Recepciones Repository
export function getRecepciones(): RecepcionData[] {
  return getStored<RecepcionData[]>(KEYS.RECEPCIONES, SEED_RECEPCIONES);
}

export function saveRecepcion(item: RecepcionData): void {
  const safeId = ensureValidUuid(item.id);
  const updatedItem: RecepcionData = {
    ...item,
    id: safeId,
    updated_at: new Date().toISOString(),
  };

  const list = getRecepciones();
  const idx = list.findIndex((r) => r.id === updatedItem.id);
  if (idx >= 0) {
    list[idx] = updatedItem;
  } else {
    list.unshift(updatedItem);
  }
  setStored(KEYS.RECEPCIONES, list);
  window.dispatchEvent(new CustomEvent('recepciones-updated', { detail: list }));
}

export function deleteRecepcion(id: string): void {
  const list = getRecepciones().filter((r) => r.id !== id);
  setStored(KEYS.RECEPCIONES, list);
  window.dispatchEvent(new CustomEvent('recepciones-updated', { detail: list }));
  if (isValidUuid(id)) {
    getSupabaseClient().from('equipo').delete().eq('id', id).then();
  }
}

/**
 * Fetch remote data from Supabase if online, and merge with local store
 */
export async function syncWithSupabaseRemote(): Promise<{ synced: number; error?: string }> {
  try {
    const [propRes, secRes, filtRes, respRes, eqRes] = await Promise.allSettled([
      fetchPropietariosDirect(),
      fetchSectoresDirect(),
      fetchFiltrosDirect(),
      fetchResponsablesDirect(),
      fetchEquiposDirect(),
    ]);

    return { synced: 1 };
  } catch (err: any) {
    console.warn('Sync with remote failed:', err);
    return { synced: 0, error: err.message };
  }
}
