import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RecepcionData, Propietario, PlanListaSector, FiltrosLista, Responsable } from '../types';

// Default Supabase credentials provided in specification
const DEFAULT_SUPABASE_URL = 'https://nlttnkqilffbaauthern.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_kAA1CiF0WlhchmZvytyryw_tAPJAqlh';
const DEFAULT_BUCKET_NAME = 'recepciones';

const STORAGE_KEYS = {
  URL: 'app_supabase_url',
  ANON_KEY: 'app_supabase_anon_key',
  BUCKET: 'app_supabase_bucket',
};

/**
 * Normalizes Supabase URL by trimming spaces and stripping /rest/v1 or trailing slashes
 */
export function sanitizeSupabaseUrl(url: string): string {
  let cleaned = (url || '').trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

export function getStoredSupabaseConfig() {
  const url = localStorage.getItem(STORAGE_KEYS.URL) || DEFAULT_SUPABASE_URL;
  const anonKey = localStorage.getItem(STORAGE_KEYS.ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY;
  const bucket = localStorage.getItem(STORAGE_KEYS.BUCKET) || DEFAULT_BUCKET_NAME;

  return {
    url: sanitizeSupabaseUrl(url),
    rawUrl: url,
    anonKey: anonKey.trim(),
    bucket: bucket.trim(),
  };
}

export function saveSupabaseConfig(url: string, anonKey: string, bucket?: string) {
  localStorage.setItem(STORAGE_KEYS.URL, url.trim());
  localStorage.setItem(STORAGE_KEYS.ANON_KEY, anonKey.trim());
  if (bucket) {
    localStorage.setItem(STORAGE_KEYS.BUCKET, bucket.trim());
  }
  cachedClient = null; // Reset cached client
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const config = getStoredSupabaseConfig();
  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return cachedClient;
}

/**
 * Test connectivity with Supabase by pinging a table or checking auth
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  try {
    const client = getSupabaseClient();
    // Try to query any of the master tables
    const { data, error } = await client.from('propietario').select('id').limit(1);
    if (error) {
      // Check if it's table not found or auth failure
      return {
        success: false,
        message: `Error al conectar: ${error.message}`,
        details: error,
      };
    }
    return {
      success: true,
      message: 'Conexión exitosa con Supabase.',
      details: data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Fallo de conexión o red: ${err.message || String(err)}`,
      details: err,
    };
  }
}

/**
 * Upload an attachment to Supabase Storage in the required path structure:
 * {id_obra}/{id_recepcion}/{tipo}/{uuid}.jpg
 */
export async function uploadArchivoStorage(
  obra: string,
  recepcionId: string,
  tipo: string,
  file: File,
  bucketName?: string
): Promise<{ path: string; signedUrl: string; publicUrl: string }> {
  const client = getSupabaseClient();
  const bucket = bucketName || getStoredSupabaseConfig().bucket;

  const safeObra = encodeURIComponent(obra.toLowerCase().replace(/[^a-z0-9_-]/g, '_')) || 'general';
  const safeTipo = encodeURIComponent(tipo.toLowerCase().replace(/[^a-z0-9_-]/g, '_')) || 'foto';
  const fileExt = file.name.split('.').pop() || 'jpg';
  const uniqueId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
  const path = `${safeObra}/${recepcionId}/${safeTipo}/${uniqueId}.${fileExt}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadError) {
    throw new Error(`Error al subir imagen al bucket ${bucket}: ${uploadError.message}`);
  }

  // Get signed URL (1 hour)
  const { data: signedData, error: signedError } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  const signedUrl = signedData?.signedUrl || '';

  // Also get public URL if bucket is public
  const { data: publicData } = client.storage.from(bucket).getPublicUrl(path);
  const publicUrl = publicData?.publicUrl || signedUrl;

  return {
    path,
    signedUrl: signedUrl || publicUrl,
    publicUrl,
  };
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteArchivoStorage(path: string, bucketName?: string): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    const bucket = bucketName || getStoredSupabaseConfig().bucket;
    const { error } = await client.storage.from(bucket).remove([path]);
    if (error) {
      console.warn('Error deleting storage file:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to delete storage file:', err);
    return false;
  }
}

/**
 * Save complete reception to Supabase tables
 */
export async function syncRecepcionToSupabase(recepcion: RecepcionData): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getSupabaseClient();
    const safeEquipoId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recepcion.id)
      ? recepcion.id
      : (crypto.randomUUID ? crypto.randomUUID() : recepcion.id);

    const safePropietarioId = recepcion.propietario && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recepcion.propietario)
      ? recepcion.propietario
      : null;

    // 1. Upsert `equipo`
    const equipoPayload: any = {
      id: safeEquipoId,
      fecha: recepcion.fecha || new Date().toISOString().split('T')[0],
      interno: recepcion.interno,
      tipo: recepcion.tipo || null,
      marca: recepcion.marca || null,
      modelo: recepcion.modelo || null,
      contador: recepcion.contador ? Number(recepcion.contador) : null,
      unidad_cont: recepcion.unidad_cont || 'hs',
      serie: recepcion.serie || null,
      origen: recepcion.origen || null,
      mantenimiento_propietario: Boolean(recepcion.mantenimiento_propietario),
      url_imagen_1: recepcion.adjuntos?.[0]?.url || recepcion.url_imagen_1 || null,
      url_imagen_2: recepcion.adjuntos?.[1]?.url || recepcion.url_imagen_2 || null,
      url_imagen_3: recepcion.adjuntos?.[2]?.url || recepcion.url_imagen_3 || null,
      url_imagen_4: recepcion.adjuntos?.[3]?.url || recepcion.url_imagen_4 || null,
      obra: recepcion.obra,
      remito: recepcion.remito ? Number(recepcion.remito) || null : null,
      propietario: safePropietarioId,
      dominio: recepcion.dominio || null,
    };

    const { error: equipoError } = await client.from('equipo').upsert(equipoPayload);
    if (equipoError) {
      console.warn('Error upserting equipo in Supabase:', equipoError);
      return { success: false, error: equipoError.message };
    }

    // 2. Motor Combustión
    if (recepcion.motor_combustion && recepcion.motor_combustion.marca) {
      await client.from('motor_combustion').delete().eq('equipo', safeEquipoId);
      await client.from('motor_combustion').insert({
        equipo: safeEquipoId,
        marca: recepcion.motor_combustion.marca,
        modelo: recepcion.motor_combustion.modelo,
        serie: recepcion.motor_combustion.serie,
        correa: recepcion.motor_combustion.correa,
      });
    }

    // 3. Motor Eléctrico
    if (recepcion.motor_electrico && recepcion.motor_electrico.marca) {
      await client.from('motor_electrico').delete().eq('equipo', safeEquipoId);
      await client.from('motor_electrico').insert({
        equipo: safeEquipoId,
        marca: recepcion.motor_electrico.marca,
        modelo: recepcion.motor_electrico.modelo,
        potencia: recepcion.motor_electrico.potencia,
        serie: recepcion.motor_electrico.serie,
      });
    }

    // 4. Filtros Instalados
    if (recepcion.filtros_instalados?.length > 0) {
      await client.from('filtros_instalados').delete().eq('equipo', safeEquipoId);
      const filtrosPayload = recepcion.filtros_instalados
        .filter((f) => f.tipo_filtro && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(f.tipo_filtro))
        .map((f) => ({
          equipo: safeEquipoId,
          tipo_filtro: f.tipo_filtro,
          codigo: f.codigo || null,
          marca: f.marca || null,
          observacion: f.observacion || null,
        }));
      if (filtrosPayload.length > 0) {
        await client.from('filtros_instalados').insert(filtrosPayload);
      }
    }

    // 5. Elementos de Desgaste
    if (recepcion.elementos_desgaste?.length > 0) {
      await client.from('elementos_desgaste').delete().eq('equipo', safeEquipoId);
      const desgPayload = recepcion.elementos_desgaste
        .filter((e) => e.descripcion && e.descripcion.trim())
        .map((e) => ({
          equipo: safeEquipoId,
          descripcion: e.descripcion,
        }));
      if (desgPayload.length > 0) {
        await client.from('elementos_desgaste').insert(desgPayload);
      }
    }

    // 6. Faltantes
    if (recepcion.faltantes?.length > 0) {
      await client.from('faltantes').delete().eq('equipo', safeEquipoId);
      const faltPayload = recepcion.faltantes
        .filter((f) => f.descripcion && f.descripcion.trim())
        .map((f) => ({
          equipo: safeEquipoId,
          descripcion: f.descripcion,
        }));
      if (faltPayload.length > 0) {
        await client.from('faltantes').insert(faltPayload);
      }
    }

    // 7. Datos Complementarios
    if (recepcion.datos_complementarios && recepcion.datos_complementarios.trim()) {
      await client.from('datos_complementarios').delete().eq('equipo', safeEquipoId);
      await client.from('datos_complementarios').insert({
        equipo: safeEquipoId,
        descripcion: recepcion.datos_complementarios,
      });
    }

    // 8. Último Servicio
    if (recepcion.ultimos_servicios?.length > 0) {
      await client.from('ultimo_servicio').delete().eq('equipo', safeEquipoId);
      const servPayload = recepcion.ultimos_servicios
        .filter((s) => s.fecha || s.tipo_servicio)
        .map((s) => ({
          equipo: safeEquipoId,
          fecha: s.fecha || null,
          contador: s.contador ? Number(s.contador) : null,
          unidad: s.unidad || 'hs',
          tipo_servicio: s.tipo_servicio || 'Mantenimiento Preventivo',
        }));
      if (servPayload.length > 0) {
        await client.from('ultimo_servicio').insert(servPayload);
      }
    }

    // 9. Lubricantes
    if (recepcion.lubricantes?.length > 0) {
      await client.from('lubricantes').delete().eq('equipo', safeEquipoId);
      const lubPayload = recepcion.lubricantes
        .filter((l) => l.sector && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(l.sector))
        .map((l) => ({
          equipo: safeEquipoId,
          sector: l.sector,
          aceite_grasa: l.aceite_grasa || null,
          marca: l.marca || null,
          cantidad: l.cantidad ? Number(l.cantidad) : null,
          unidad_cant: l.unidad_cant || 'litros',
          frecuencia: l.frecuencia ? Number(l.frecuencia) : null,
          unidad_fcia: l.unidad_fcia || 'hs',
          refrigerante_tipo: l.refrigerante_tipo || null,
          refrigerante_cantidad: l.refrigerante_cantidad ? Number(l.refrigerante_cantidad) : null,
          planilla_adjunta: Boolean(l.planilla_adjunta),
          comentarios: l.comentarios || null,
        }));
      if (lubPayload.length > 0) {
        await client.from('lubricantes').insert(lubPayload);
      }
    }

    // 10. Documentos y Accesorios
    if (recepcion.documentos_accesorios) {
      await client.from('documentos_accesorios').delete().eq('equipo', safeEquipoId);
      await client.from('documentos_accesorios').insert({
        equipo: safeEquipoId,
        documentacion: Boolean(recepcion.documentos_accesorios.documentacion),
        gato_hidraulico: Boolean(recepcion.documentos_accesorios.gato_hidraulico),
        matafuego: Boolean(recepcion.documentos_accesorios.matafuego),
        botiquin: Boolean(recepcion.documentos_accesorios.botiquin),
        calzas_cuñas: Boolean(recepcion.documentos_accesorios.calzas_cuñas),
        rueda_auxilio: Boolean(recepcion.documentos_accesorios.rueda_auxilio),
        kit_seguridad: Boolean(recepcion.documentos_accesorios.kit_seguridad),
        comentario: recepcion.documentos_accesorios.comentario || null,
      });
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to sync reception to Supabase:', err);
    return { success: false, error: err.message || String(err) };
  }
}
