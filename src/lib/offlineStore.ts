import { RecepcionData, Propietario, PlanListaSector, FiltrosLista, Responsable, ObraItem } from '../types';
import { getSupabaseClient } from './supabase';

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

// Initial default seeds
export const DEFAULT_OBRAS: ObraItem[] = [
  { id: 'obra-1', codigo_uo: 'UO-104', nombre: 'Autopista RN 7 Km 140-190' },
  { id: 'obra-2', codigo_uo: 'UO-212', nombre: 'Central Termoeléctrica Pilar' },
  { id: 'obra-3', codigo_uo: 'UO-305', nombre: 'Viaducto Ferroviario Mitre' },
  { id: 'obra-4', codigo_uo: 'UO-418', nombre: 'Colector Cloacal Sur Etapa 2' },
];

export const DEFAULT_SECTORES: PlanListaSector[] = [
  { id: '1b8997a1-2d7c-4890-a359-001', sector: 'Motor térmico' },
  { id: '1b8997a1-2d7c-4890-a359-002', sector: 'Transmisión y convertidor' },
  { id: '1b8997a1-2d7c-4890-a359-003', sector: 'Sistema hidráulico principal' },
  { id: '1b8997a1-2d7c-4890-a359-004', sector: 'Diferencial delantero / trasero' },
  { id: '1b8997a1-2d7c-4890-a359-005', sector: 'Mandos finales y reductores' },
  { id: '1b8997a1-2d7c-4890-a359-006', sector: 'Mecanismo de giro / tornamesa' },
  { id: '1b8997a1-2d7c-4890-a359-007', sector: 'Caja tándem' },
  { id: '1b8997a1-2d7c-4890-a359-008', sector: 'Sistema de enfriamiento (refrigerante)' },
];

export const DEFAULT_FILTROS: FiltrosLista[] = [
  { id: 'f001-a1', tipo: 'Aceite Motor' },
  { id: 'f002-a2', tipo: 'Combustible Primario' },
  { id: 'f003-a3', tipo: 'Combustible Secundario / Trampa' },
  { id: 'f004-a4', tipo: 'Aire Primario' },
  { id: 'f005-a5', tipo: 'Aire Secundario' },
  { id: 'f006-a6', tipo: 'Hidráulico Retorno' },
  { id: 'f007-a7', tipo: 'Transmisión' },
  { id: 'f008-a8', tipo: 'Filtro de Cabina / Habitáculo' },
];

export const DEFAULT_RESPONSABLES: Responsable[] = [
  { id: 'resp-001', nombre: 'Ing. Carlos Mendoza (Jefe de Taller Central)' },
  { id: 'resp-002', nombre: 'Marcos Galván (Capataz Mecánico de Obra)' },
  { id: 'resp-003', nombre: 'Esteban Benítez (Inspector de Equipos)' },
  { id: 'resp-004', nombre: 'Guillermo Funes (Recepción y Logística)' },
];

export const DEFAULT_PROPIETARIOS: Propietario[] = [
  {
    id: 'prop-001',
    razon_social: 'VialSur Maquinarias S.A.',
    cuit: 30712345678,
    nombre_contacto: 'Martín Almada',
    tel_contacto: 1154329876,
    correo_contacto: 'flota@vialsur.com.ar',
  },
  {
    id: 'prop-002',
    razon_social: 'Equipos y Logística Patagónica S.R.L.',
    cuit: 30698745123,
    nombre_contacto: 'Rodrigo Peña',
    tel_contacto: 2994456789,
    correo_contacto: 'operaciones@elpatagonia.com',
  },
  {
    id: 'prop-003',
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
  const idx = list.findIndex((o) => o.id === obra.id);
  if (idx >= 0) {
    list[idx] = obra;
  } else {
    list.unshift(obra);
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

export function savePropietario(propietario: Propietario): void {
  const list = getPropietarios();
  const idx = list.findIndex((p) => p.id === propietario.id);
  if (idx >= 0) {
    list[idx] = propietario;
  } else {
    list.unshift(propietario);
  }
  setStored(KEYS.PROPIETARIOS, list);

  // Sync to Supabase in background
  syncPropietarioToSupabase(propietario).catch((err) => console.warn('Supabase sync prop error:', err));
}

export function deletePropietario(id: string): void {
  const list = getPropietarios().filter((p) => p.id !== id);
  setStored(KEYS.PROPIETARIOS, list);
  getSupabaseClient().from('propietario').delete().eq('id', id).then();
}

async function syncPropietarioToSupabase(p: Propietario) {
  try {
    const client = getSupabaseClient();
    await client.from('propietario').upsert({
      id: p.id,
      razon_social: p.razon_social,
      cuit: p.cuit ? Number(p.cuit) : null,
      nombre_contacto: p.nombre_contacto || null,
      tel_contacto: p.tel_contacto ? Number(p.tel_contacto) : null,
      correo_contacto: p.correo_contacto || null,
    });
  } catch (err) {
    console.warn('Could not sync propietario to Supabase:', err);
  }
}

// Sectores
export function getSectores(): PlanListaSector[] {
  return getStored<PlanListaSector[]>(KEYS.SECTORES, DEFAULT_SECTORES);
}

export function saveSector(item: PlanListaSector): void {
  const list = getSectores();
  const idx = list.findIndex((s) => s.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  setStored(KEYS.SECTORES, list);
  getSupabaseClient().from('plan_lista_sector').upsert({ id: item.id, sector: item.sector }).then();
}

export function deleteSector(id: string): void {
  const list = getSectores().filter((s) => s.id !== id);
  setStored(KEYS.SECTORES, list);
  getSupabaseClient().from('plan_lista_sector').delete().eq('id', id).then();
}

// Filtros
export function getFiltros(): FiltrosLista[] {
  return getStored<FiltrosLista[]>(KEYS.FILTROS, DEFAULT_FILTROS);
}

export function saveFiltro(item: FiltrosLista): void {
  const list = getFiltros();
  const idx = list.findIndex((f) => f.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  setStored(KEYS.FILTROS, list);
  getSupabaseClient().from('filtros_lista').upsert({ id: item.id, tipo: item.tipo }).then();
}

export function deleteFiltro(id: string): void {
  const list = getFiltros().filter((f) => f.id !== id);
  setStored(KEYS.FILTROS, list);
  getSupabaseClient().from('filtros_lista').delete().eq('id', id).then();
}

// Responsables
export function getResponsables(): Responsable[] {
  return getStored<Responsable[]>(KEYS.RESPONSABLES, DEFAULT_RESPONSABLES);
}

export function saveResponsable(item: Responsable): void {
  const list = getResponsables();
  const idx = list.findIndex((r) => r.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.push(item);
  setStored(KEYS.RESPONSABLES, list);
  getSupabaseClient().from('responsable').upsert({ id: item.id, nombre: item.nombre }).then();
}

export function deleteResponsable(id: string): void {
  const list = getResponsables().filter((r) => r.id !== id);
  setStored(KEYS.RESPONSABLES, list);
  getSupabaseClient().from('responsable').delete().eq('id', id).then();
}

// Company Logo
export function getCompanyLogo(): string | null {
  return localStorage.getItem(KEYS.COMPANY_LOGO);
}

export function saveCompanyLogo(dataUrl: string): void {
  localStorage.setItem(KEYS.COMPANY_LOGO, dataUrl);
}

// Recepciones Initial Seed (Realistic for Field Use)
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
    propietario: 'prop-001',
    dominio: 'NO APLICA (ORUGAS)',
    estado: 'aprobada',
    responsable_id: 'resp-001',
    responsable_nombre: 'Ing. Carlos Mendoza (Jefe de Taller Central)',
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
      { tipo_filtro: 'f001-a1', tipo_filtro_nombre: 'Aceite Motor', codigo: '1R-1808', marca: 'CAT OEM', observacion: 'Reemplazado hace 50 hs' },
      { tipo_filtro: 'f002-a2', tipo_filtro_nombre: 'Combustible Primario', codigo: '1R-0751', marca: 'CAT OEM', observacion: 'Limpio' },
      { tipo_filtro: 'f004-a4', tipo_filtro_nombre: 'Aire Primario', codigo: '131-8822', marca: 'Donaldson', observacion: 'Soplado e inspeccionado' },
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
      { fecha: '2026-06-10', contador: 4000, unidad: 'hs', tipo_servicio: 'Servicio 1000 Hs integral (Aceite hidráulico y mandos finales)' },
    ],
    lubricantes: [
      {
        sector: '1b8997a1-2d7c-4890-a359-001',
        sector_nombre: 'Motor térmico',
        aceite_grasa: 'aceite',
        marca: 'Mobil Delvac MX 15W-40',
        cantidad: 28,
        unidad_cant: 'litros',
        frecuencia: 250,
        unidad_fcia: 'hs',
        refrigerante_tipo: 'Cat ELC Rojo 50/50',
        refrigerante_cantidad: 30,
        planilla_adjunta: true,
        comentarios: 'Nivel óptimo en varilla',
      },
      {
        sector: '1b8997a1-2d7c-4890-a359-003',
        sector_nombre: 'Sistema hidráulico principal',
        aceite_grasa: 'aceite',
        marca: 'Shell Tellus S2 V 46',
        cantidad: 145,
        unidad_cant: 'litros',
        frecuencia: 2000,
        unidad_fcia: 'hs',
        planilla_adjunta: true,
        comentarios: 'Visor transparente en tres cuartos',
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
  {
    id: 'f8b271c3-4d23-4e88-9923-89e02135f002',
    fecha: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
    interno: 'CM-08',
    tipo: 'Camión Volcador 6x4',
    marca: 'Mercedes-Benz',
    modelo: 'Actros 3344K',
    contador: 142300,
    unidad_cont: 'km',
    serie: '9340321K882194',
    origen: 'Subcontratista Obra',
    mantenimiento_propietario: false,
    obra: 'Autopista RN 7 Km 140-190',
    remito: 67104,
    propietario: 'prop-002',
    dominio: 'AF 892 TR',
    estado: 'completa',
    responsable_id: 'resp-002',
    responsable_nombre: 'Marcos Galván (Capataz Mecánico de Obra)',
    fecha_informe: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
    observaciones_generales: 'Unidad recibida para movimiento de suelos en terraplén. Se detectó pequeña pérdida de aire en acople de frenos de caja volcadora.',
    datos_complementarios: 'Caja volcadora Baco de 16 m3 con cilindro telescópico frontal sin rayaduras.',
    motor_combustion: {
      marca: 'Mercedes-Benz',
      modelo: 'OM 501 LA V6',
      serie: '501-942-00-128',
      correa: 'Poli-V 8PK (Nueva)',
    },
    motor_electrico: null,
    filtros_instalados: [
      { tipo_filtro: 'f001-a1', tipo_filtro_nombre: 'Aceite Motor', codigo: 'HU 12140 x', marca: 'Mann-Filter', observacion: 'Ok' },
      { tipo_filtro: 'f002-a2', tipo_filtro_nombre: 'Combustible Primario', codigo: 'WK 842', marca: 'Mann-Filter', observacion: 'Ok' },
    ],
    elementos_desgaste: [
      { descripcion: 'Neumáticos 12.00 R24 eje trasero con 70% de dibujo' },
      { descripcion: 'Cintas de freno traseras al 50%' },
    ],
    faltantes: [
      { descripcion: 'Balizas triangulares reglamentarias no entregadas' },
    ],
    ultimos_servicios: [
      { fecha: '2026-08-20', contador: 135000, unidad: 'km', tipo_servicio: 'Service Completo Aceite y Filtros en Concesionario Oficial' },
    ],
    lubricantes: [],
    documentos_accesorios: {
      documentacion: true,
      gato_hidraulico: true,
      matafuego: true,
      botiquin: false,
      calzas_cuñas: true,
      rueda_auxilio: true,
      kit_seguridad: true,
      comentario: 'Cédula verde y VTV al día. Falta botiquín de primeros auxilios reglamentario.',
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
  const list = getRecepciones();
  const idx = list.findIndex((r) => r.id === item.id);
  const updatedItem: RecepcionData = {
    ...item,
    updated_at: new Date().toISOString(),
  };

  if (idx >= 0) {
    list[idx] = updatedItem;
  } else {
    list.unshift(updatedItem);
  }
  setStored(KEYS.RECEPCIONES, list);
}

export function deleteRecepcion(id: string): void {
  const list = getRecepciones().filter((r) => r.id !== id);
  setStored(KEYS.RECEPCIONES, list);
  getSupabaseClient().from('equipo').delete().eq('id', id).then();
}

/**
 * Fetch remote data from Supabase if online, and merge with local store
 */
export async function syncWithSupabaseRemote(): Promise<{ synced: number; error?: string }> {
  try {
    const client = getSupabaseClient();
    
    // Fetch propietarios
    const { data: propData } = await client.from('propietario').select('*');
    if (propData && propData.length > 0) {
      const localProps = getPropietarios();
      const mergedMap = new Map<string, Propietario>();
      localProps.forEach((p) => mergedMap.set(p.id, p));
      propData.forEach((p: any) => {
        mergedMap.set(p.id, {
          id: p.id,
          razon_social: p.razon_social,
          cuit: p.cuit,
          nombre_contacto: p.nombre_contacto,
          tel_contacto: p.tel_contacto,
          correo_contacto: p.correo_contacto,
        });
      });
      setStored(KEYS.PROPIETARIOS, Array.from(mergedMap.values()));
    }

    // Fetch sectores
    const { data: secData } = await client.from('plan_lista_sector').select('*');
    if (secData && secData.length > 0) {
      const localSec = getSectores();
      const map = new Map<string, PlanListaSector>();
      localSec.forEach((s) => map.set(s.id, s));
      secData.forEach((s: any) => map.set(s.id, { id: s.id, sector: s.sector }));
      setStored(KEYS.SECTORES, Array.from(map.values()));
    }

    // Fetch filtros
    const { data: filtData } = await client.from('filtros_lista').select('*');
    if (filtData && filtData.length > 0) {
      const localFilt = getFiltros();
      const map = new Map<string, FiltrosLista>();
      localFilt.forEach((f) => map.set(f.id, f));
      filtData.forEach((f: any) => map.set(f.id, { id: f.id, tipo: f.tipo }));
      setStored(KEYS.FILTROS, Array.from(map.values()));
    }

    // Fetch responsables
    const { data: respData } = await client.from('responsable').select('*');
    if (respData && respData.length > 0) {
      const localResp = getResponsables();
      const map = new Map<string, Responsable>();
      localResp.forEach((r) => map.set(r.id, r));
      respData.forEach((r: any) => map.set(r.id, { id: r.id, nombre: r.nombre }));
      setStored(KEYS.RESPONSABLES, Array.from(map.values()));
    }

    return { synced: 1 };
  } catch (err: any) {
    console.warn('Sync with remote failed:', err);
    return { synced: 0, error: err.message };
  }
}
