export type EstadoRecepcion = 'borrador' | 'completa' | 'aprobada' | 'anulada';

export type UnidadContador = 'hs' | 'km';
export type AceiteGrasa = 'aceite' | 'grasa';
export type UnidadCantidad = 'kg' | 'litros';
export type UnidadFrecuencia = 'hs' | 'km';

export interface PlanListaSector {
  id: string;
  sector: string;
}

export interface FiltrosLista {
  id: string;
  tipo: string;
}

export interface Responsable {
  id: string;
  nombre: string;
  cargo?: string;
}

export interface Propietario {
  id: string;
  razon_social: string;
  cuit?: number | string | null;
  nombre_contacto?: string | null;
  tel_contacto?: number | string | null;
  correo_contacto?: string | null;
}

export interface MotorCombustion {
  id?: string;
  equipo?: string;
  marca: string;
  modelo: string;
  serie: string;
  correa: string;
}

export interface MotorElectrico {
  id?: string;
  equipo?: string;
  marca: string;
  modelo: string;
  potencia: string;
  serie: string;
}

export interface FiltroInstalado {
  id?: string;
  equipo?: string;
  tipo_filtro: string; // uuid from filtros_lista
  tipo_filtro_nombre?: string;
  codigo: string;
  marca: string;
  observacion: string;
}

export interface ElementoDesgaste {
  id?: string;
  equipo?: string;
  descripcion: string;
}

export interface Faltante {
  id?: string;
  equipo?: string;
  descripcion: string;
}

export interface UltimoServicio {
  id?: string;
  equipo?: string;
  fecha: string; // YYYY-MM-DD
  contador?: number | null;
  unidad?: UnidadContador | null;
  tipo_servicio: string;
}

export interface LubricanteItem {
  id?: string;
  equipo?: string;
  sector: string; // uuid from plan_lista_sector
  sector_nombre?: string;
  aceite_grasa?: AceiteGrasa | null;
  marca: string;
  cantidad?: number | null;
  unidad_cant?: UnidadCantidad | null;
  frecuencia?: number | null;
  unidad_fcia?: UnidadFrecuencia | null;
  refrigerante_tipo?: string | null;
  refrigerante_cantidad?: number | null;
  planilla_adjunta: boolean;
  comentarios?: string | null;
}

export interface DocumentosAccesorios {
  id?: string;
  equipo?: string;
  documentacion: boolean;
  gato_hidraulico: boolean;
  matafuego: boolean;
  botiquin: boolean;
  calzas_cuñas: boolean;
  rueda_auxilio: boolean;
  kit_seguridad: boolean;
  comentario?: string;
}

export type TipoAdjunto = 'Foto' | 'Remito' | 'Planilla de mantenimiento del propietario' | 'Documentación' | 'Otro';

export interface RecepcionAdjunto {
  id: string;
  recepcion_id?: string;
  tipo: TipoAdjunto;
  storage_path: string;
  nombre_archivo: string;
  url: string;
  data_url?: string; // base64 preview for offline & PDF
  fecha_subida?: string;
  tamanio?: number;
  tipo_sugerido?: string; // e.g. "Frente", "Tablero / Horómetro"
}

export interface RecepcionData {
  id: string; // uuid
  fecha: string; // YYYY-MM-DD
  interno: string;
  tipo: string;
  marca: string;
  modelo: string;
  contador?: number | null;
  unidad_cont?: UnidadContador;
  serie: string;
  origen: string;
  mantenimiento_propietario: boolean;
  url_imagen_1?: string;
  url_imagen_2?: string;
  url_imagen_3?: string;
  url_imagen_4?: string;
  obra: string;
  remito?: number | string | null;
  propietario?: string; // uuid
  dominio?: string;
  
  // Extended reception fields
  estado: EstadoRecepcion;
  responsable_id?: string;
  responsable_nombre?: string;
  fecha_informe?: string;
  observaciones_generales?: string;
  
  // Sub-records
  motor_combustion?: MotorCombustion | null;
  motor_electrico?: MotorElectrico | null;
  filtros_instalados: FiltroInstalado[];
  elementos_desgaste: ElementoDesgaste[];
  faltantes: Faltante[];
  datos_complementarios: string;
  ultimos_servicios: UltimoServicio[];
  lubricantes: LubricanteItem[];
  documentos_accesorios: DocumentosAccesorios;
  adjuntos: RecepcionAdjunto[];

  // Meta
  updated_at?: string;
  synced_with_supabase?: boolean;
}

export interface ObraItem {
  id: string;
  codigo_uo: string;
  nombre: string;
}
