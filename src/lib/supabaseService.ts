import { getSupabaseClient } from './supabase';
import {
  Propietario,
  PlanListaSector,
  FiltrosLista,
  Responsable,
  RecepcionData,
  MotorCombustion,
  MotorElectrico,
  FiltroInstalado,
  ElementoDesgaste,
  Faltante,
  UltimoServicio,
  LubricanteItem,
  DocumentosAccesorios,
} from '../types';

/**
 * Checks if a string is a valid UUID v4 / v1-v5 format
 */
export function isValidUuid(val?: string | null): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

/**
 * Ensures a valid UUID: returns input if valid, otherwise generates a standard RFC4122 UUID v4
 */
export function ensureValidUuid(val?: string | null): string {
  if (val && isValidUuid(val)) return val;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// -------------------------------------------------------------
// PROPIETARIO SERVICE (Direct Supabase CRUD with Cache Sync)
// -------------------------------------------------------------

export async function fetchPropietariosDirect(): Promise<{ data: Propietario[]; error?: string }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('propietario')
      .select('id, razon_social, cuit, nombre_contacto, tel_contacto, correo_contacto')
      .order('razon_social', { ascending: true });

    if (error) {
      console.warn('Error fetching propietarios from Supabase:', error.message);
      return { data: [], error: error.message };
    }

    const list: Propietario[] = (data || []).map((row: any) => ({
      id: row.id,
      razon_social: row.razon_social,
      cuit: row.cuit,
      nombre_contacto: row.nombre_contacto,
      tel_contacto: row.tel_contacto,
      correo_contacto: row.correo_contacto,
    }));

    // Update local cache
    localStorage.setItem('app_propietarios', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('propietarios-updated', { detail: list }));

    return { data: list };
  } catch (err: any) {
    console.error('Network failure in fetchPropietariosDirect:', err);
    return { data: [], error: err.message || 'Error de conexión' };
  }
}

export async function createPropietarioDirect(item: {
  razon_social: string;
  cuit?: number | string | null;
  nombre_contacto?: string | null;
  tel_contacto?: number | string | null;
  correo_contacto?: string | null;
}): Promise<{ data: Propietario | null; error?: string }> {
  try {
    const client = getSupabaseClient();
    const uuid = ensureValidUuid();

    const payload = {
      id: uuid,
      razon_social: item.razon_social.trim(),
      cuit: item.cuit ? Number(String(item.cuit).replace(/\D/g, '')) || null : null,
      nombre_contacto: item.nombre_contacto?.trim() || null,
      tel_contacto: item.tel_contacto ? Number(String(item.tel_contacto).replace(/\D/g, '')) || null : null,
      correo_contacto: item.correo_contacto?.trim() || null,
    };

    const { data, error } = await client
      .from('propietario')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating propietario in Supabase:', error);
      return { data: null, error: error.message };
    }

    const created: Propietario = {
      id: data.id,
      razon_social: data.razon_social,
      cuit: data.cuit,
      nombre_contacto: data.nombre_contacto,
      tel_contacto: data.tel_contacto,
      correo_contacto: data.correo_contacto,
    };

    // Update local cache
    const currentListStr = localStorage.getItem('app_propietarios');
    const currentList: Propietario[] = currentListStr ? JSON.parse(currentListStr) : [];
    const updated = [created, ...currentList.filter((p) => p.id !== created.id)];
    localStorage.setItem('app_propietarios', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('propietarios-updated', { detail: updated }));

    return { data: created };
  } catch (err: any) {
    console.error('Exception in createPropietarioDirect:', err);
    return { data: null, error: err.message || 'Error de conexión' };
  }
}

export async function updatePropietarioDirect(item: Propietario): Promise<{ data: Propietario | null; error?: string }> {
  try {
    const client = getSupabaseClient();
    if (!isValidUuid(item.id)) {
      return { data: null, error: 'ID de propietario no válido' };
    }

    const payload = {
      razon_social: item.razon_social.trim(),
      cuit: item.cuit ? Number(String(item.cuit).replace(/\D/g, '')) || null : null,
      nombre_contacto: item.nombre_contacto?.trim() || null,
      tel_contacto: item.tel_contacto ? Number(String(item.tel_contacto).replace(/\D/g, '')) || null : null,
      correo_contacto: item.correo_contacto?.trim() || null,
    };

    const { data, error } = await client
      .from('propietario')
      .update(payload)
      .eq('id', item.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating propietario in Supabase:', error);
      return { data: null, error: error.message };
    }

    const updatedItem: Propietario = {
      id: data.id,
      razon_social: data.razon_social,
      cuit: data.cuit,
      nombre_contacto: data.nombre_contacto,
      tel_contacto: data.tel_contacto,
      correo_contacto: data.correo_contacto,
    };

    // Update cache
    const currentListStr = localStorage.getItem('app_propietarios');
    const currentList: Propietario[] = currentListStr ? JSON.parse(currentListStr) : [];
    const updated = currentList.map((p) => (p.id === updatedItem.id ? updatedItem : p));
    localStorage.setItem('app_propietarios', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('propietarios-updated', { detail: updated }));

    return { data: updatedItem };
  } catch (err: any) {
    return { data: null, error: err.message || 'Error al actualizar propietario' };
  }
}

export async function deletePropietarioDirect(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    if (isValidUuid(id)) {
      const { error } = await client.from('propietario').delete().eq('id', id);
      if (error) {
        console.warn('Error deleting propietario in Supabase:', error);
        return { success: false, error: error.message };
      }
    }

    // Update cache
    const currentListStr = localStorage.getItem('app_propietarios');
    const currentList: Propietario[] = currentListStr ? JSON.parse(currentListStr) : [];
    const filtered = currentList.filter((p) => p.id !== id);
    localStorage.setItem('app_propietarios', JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('propietarios-updated', { detail: filtered }));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// PLAN_LISTA_SECTOR SERVICE
// -------------------------------------------------------------

export async function fetchSectoresDirect(): Promise<{ data: PlanListaSector[]; error?: string }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('plan_lista_sector')
      .select('id, sector')
      .order('sector', { ascending: true });

    if (error) {
      console.warn('Error fetching sectores from Supabase:', error);
      return { data: [], error: error.message };
    }

    const list: PlanListaSector[] = data || [];
    localStorage.setItem('app_sectores', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('sectores-updated', { detail: list }));
    return { data: list };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function createSectorDirect(sectorName: string): Promise<{ data: PlanListaSector | null; error?: string }> {
  try {
    const client = getSupabaseClient();
    const uuid = ensureValidUuid();
    const { data, error } = await client
      .from('plan_lista_sector')
      .insert({ id: uuid, sector: sectorName.trim() })
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    const created: PlanListaSector = { id: data.id, sector: data.sector };
    const curStr = localStorage.getItem('app_sectores');
    const list: PlanListaSector[] = curStr ? JSON.parse(curStr) : [];
    const updated = [...list, created];
    localStorage.setItem('app_sectores', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('sectores-updated', { detail: updated }));
    return { data: created };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function deleteSectorDirect(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    if (isValidUuid(id)) {
      const { error } = await client.from('plan_lista_sector').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }
    const curStr = localStorage.getItem('app_sectores');
    const list: PlanListaSector[] = curStr ? JSON.parse(curStr) : [];
    const filtered = list.filter((s) => s.id !== id);
    localStorage.setItem('app_sectores', JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('sectores-updated', { detail: filtered }));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// FILTROS_LISTA SERVICE
// -------------------------------------------------------------

export async function fetchFiltrosDirect(): Promise<{ data: FiltrosLista[]; error?: string }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('filtros_lista')
      .select('id, tipo')
      .order('tipo', { ascending: true });

    if (error) return { data: [], error: error.message };

    const list: FiltrosLista[] = data || [];
    localStorage.setItem('app_filtros', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('filtros-updated', { detail: list }));
    return { data: list };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function createFiltroDirect(tipoName: string): Promise<{ data: FiltrosLista | null; error?: string }> {
  try {
    const client = getSupabaseClient();
    const uuid = ensureValidUuid();
    const { data, error } = await client
      .from('filtros_lista')
      .insert({ id: uuid, tipo: tipoName.trim() })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    const created: FiltrosLista = { id: data.id, tipo: data.tipo };
    const curStr = localStorage.getItem('app_filtros');
    const list: FiltrosLista[] = curStr ? JSON.parse(curStr) : [];
    const updated = [...list, created];
    localStorage.setItem('app_filtros', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('filtros-updated', { detail: updated }));
    return { data: created };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function deleteFiltroDirect(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    if (isValidUuid(id)) {
      const { error } = await client.from('filtros_lista').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }
    const curStr = localStorage.getItem('app_filtros');
    const list: FiltrosLista[] = curStr ? JSON.parse(curStr) : [];
    const filtered = list.filter((f) => f.id !== id);
    localStorage.setItem('app_filtros', JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('filtros-updated', { detail: filtered }));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// RESPONSABLE SERVICE
// -------------------------------------------------------------

export async function fetchResponsablesDirect(): Promise<{ data: Responsable[]; error?: string }> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('responsable')
      .select('id, nombre')
      .order('nombre', { ascending: true });

    if (error) return { data: [], error: error.message };

    const list: Responsable[] = data || [];
    localStorage.setItem('app_responsables', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('responsables-updated', { detail: list }));
    return { data: list };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

export async function createResponsableDirect(nombre: string): Promise<{ data: Responsable | null; error?: string }> {
  try {
    const client = getSupabaseClient();
    const uuid = ensureValidUuid();
    const { data, error } = await client
      .from('responsable')
      .insert({ id: uuid, nombre: nombre.trim() })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    const created: Responsable = { id: data.id, nombre: data.nombre };
    const curStr = localStorage.getItem('app_responsables');
    const list: Responsable[] = curStr ? JSON.parse(curStr) : [];
    const updated = [...list, created];
    localStorage.setItem('app_responsables', JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('responsables-updated', { detail: updated }));
    return { data: created };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function deleteResponsableDirect(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    if (isValidUuid(id)) {
      const { error } = await client.from('responsable').delete().eq('id', id);
      if (error) return { success: false, error: error.message };
    }
    const curStr = localStorage.getItem('app_responsables');
    const list: Responsable[] = curStr ? JSON.parse(curStr) : [];
    const filtered = list.filter((r) => r.id !== id);
    localStorage.setItem('app_responsables', JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('responsables-updated', { detail: filtered }));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// EQUIPO AND RECEPTION SERVICE (All tables synced)
// -------------------------------------------------------------

export async function fetchEquiposDirect(): Promise<{ data: RecepcionData[]; error?: string }> {
  try {
    const client = getSupabaseClient();
    
    // Fetch equipo
    const { data: equipoRows, error: eqError } = await client
      .from('equipo')
      .select('*')
      .order('fecha', { ascending: false });

    if (eqError) {
      console.warn('Error fetching equipo from Supabase:', eqError);
      return { data: [], error: eqError.message };
    }

    if (!equipoRows || equipoRows.length === 0) {
      return { data: [] };
    }

    // For each equipo, fetch child tables
    const results: RecepcionData[] = [];
    for (const eq of equipoRows) {
      const eqId = eq.id;

      // Child tables in parallel
      const [
        motorCombRes,
        motorElecRes,
        filtrosRes,
        desgasteRes,
        faltantesRes,
        complRes,
        servicioRes,
        lubricantesRes,
        docAccRes,
      ] = await Promise.all([
        client.from('motor_combustion').select('*').eq('equipo', eqId).maybeSingle(),
        client.from('motor_electrico').select('*').eq('equipo', eqId).maybeSingle(),
        client.from('filtros_instalados').select('*').eq('equipo', eqId),
        client.from('elementos_desgaste').select('*').eq('equipo', eqId),
        client.from('faltantes').select('*').eq('equipo', eqId),
        client.from('datos_complementarios').select('*').eq('equipo', eqId).maybeSingle(),
        client.from('ultimo_servicio').select('*').eq('equipo', eqId),
        client.from('lubricantes').select('*').eq('equipo', eqId),
        client.from('documentos_accesorios').select('*').eq('equipo', eqId).maybeSingle(),
      ]);

      const adjuntos: any[] = [];
      if (eq.url_imagen_1) adjuntos.push({ id: `${eqId}-img1`, url: eq.url_imagen_1, tipo: 'Foto', nombre_archivo: 'Foto 1', storage_path: '' });
      if (eq.url_imagen_2) adjuntos.push({ id: `${eqId}-img2`, url: eq.url_imagen_2, tipo: 'Foto', nombre_archivo: 'Foto 2', storage_path: '' });
      if (eq.url_imagen_3) adjuntos.push({ id: `${eqId}-img3`, url: eq.url_imagen_3, tipo: 'Foto', nombre_archivo: 'Foto 3', storage_path: '' });
      if (eq.url_imagen_4) adjuntos.push({ id: `${eqId}-img4`, url: eq.url_imagen_4, tipo: 'Foto', nombre_archivo: 'Foto 4', storage_path: '' });

      const rec: RecepcionData = {
        id: eq.id,
        fecha: eq.fecha,
        interno: eq.interno,
        tipo: eq.tipo || '',
        marca: eq.marca || '',
        modelo: eq.modelo || '',
        contador: eq.contador,
        unidad_cont: eq.unidad_cont || 'hs',
        serie: eq.serie || '',
        origen: eq.origen || 'Terceros (Alquiler)',
        mantenimiento_propietario: eq.mantenimiento_propietario ?? false,
        url_imagen_1: eq.url_imagen_1,
        url_imagen_2: eq.url_imagen_2,
        url_imagen_3: eq.url_imagen_3,
        url_imagen_4: eq.url_imagen_4,
        obra: eq.obra || '',
        remito: eq.remito,
        propietario: eq.propietario,
        dominio: eq.dominio || '',
        estado: 'completa',
        datos_complementarios: complRes.data?.descripcion || '',
        motor_combustion: motorCombRes.data ? {
          marca: motorCombRes.data.marca,
          modelo: motorCombRes.data.modelo,
          serie: motorCombRes.data.serie,
          correa: motorCombRes.data.correa,
        } : null,
        motor_electrico: motorElecRes.data ? {
          marca: motorElecRes.data.marca,
          modelo: motorElecRes.data.modelo,
          potencia: motorElecRes.data.potencia,
          serie: motorElecRes.data.serie,
        } : null,
        filtros_instalados: (filtrosRes.data || []).map((f: any) => ({
          tipo_filtro: f.tipo_filtro,
          codigo: f.codigo || '',
          marca: f.marca || '',
          observacion: f.observacion || '',
        })),
        elementos_desgaste: (desgasteRes.data || []).map((d: any) => ({
          descripcion: d.descripcion || '',
        })),
        faltantes: (faltantesRes.data || []).map((fl: any) => ({
          descripcion: fl.descripcion || '',
        })),
        ultimos_servicios: (servicioRes.data || []).map((s: any) => ({
          fecha: s.fecha,
          contador: s.contador,
          unidad: s.unidad,
          tipo_servicio: s.tipo_servicio,
        })),
        lubricantes: (lubricantesRes.data || []).map((l: any) => ({
          sector: l.sector,
          aceite_grasa: l.aceite_grasa,
          marca: l.marca || '',
          cantidad: l.cantidad,
          unidad_cant: l.unidad_cant,
          frecuencia: l.frecuencia,
          unidad_fcia: l.unidad_fcia,
          refrigerante_tipo: l.refrigerante_tipo,
          refrigerante_cantidad: l.refrigerante_cantidad,
          planilla_adjunta: l.planilla_adjunta ?? false,
          comentarios: l.comentarios,
        })),
        documentos_accesorios: docAccRes.data ? {
          documentacion: docAccRes.data.documentacion ?? false,
          gato_hidraulico: docAccRes.data.gato_hidraulico ?? false,
          matafuego: docAccRes.data.matafuego ?? false,
          botiquin: docAccRes.data.botiquin ?? false,
          calzas_cuñas: docAccRes.data.calzas_cuñas ?? false,
          rueda_auxilio: docAccRes.data.rueda_auxilio ?? false,
          kit_seguridad: docAccRes.data.kit_seguridad ?? false,
          comentario: docAccRes.data.comentario || '',
        } : {
          documentacion: false,
          gato_hidraulico: false,
          matafuego: false,
          botiquin: false,
          calzas_cuñas: false,
          rueda_auxilio: false,
          kit_seguridad: false,
        },
        adjuntos,
        synced_with_supabase: true,
      };

      results.push(rec);
    }

    // Merge with local drafts that have not yet been synced
    const localStr = localStorage.getItem('app_recepciones');
    const localList: RecepcionData[] = localStr ? JSON.parse(localStr) : [];
    const mergedMap = new Map<string, RecepcionData>();
    
    // Remote records take precedence for confirmed items
    results.forEach((r) => mergedMap.set(r.id, r));
    // Keep local drafts if not in remote
    localList.forEach((r) => {
      if (!mergedMap.has(r.id)) {
        mergedMap.set(r.id, r);
      }
    });

    const finalMerged = Array.from(mergedMap.values());
    localStorage.setItem('app_recepciones', JSON.stringify(finalMerged));
    window.dispatchEvent(new CustomEvent('recepciones-updated', { detail: finalMerged }));

    return { data: finalMerged };
  } catch (err: any) {
    console.error('Error in fetchEquiposDirect:', err);
    return { data: [], error: err.message };
  }
}
