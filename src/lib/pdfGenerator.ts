import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RecepcionData, Propietario } from '../types';
import { getPropietarios, getCompanyLogo } from './offlineStore';

/**
 * Format date from YYYY-MM-DD or ISO string to dd/mm/aaaa (Argentine standard)
 */
export function formatFechaArg(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return dateStr;
}

/**
 * Format numbers with decimal comma (Argentine standard)
 */
export function formatNumeroArg(num?: number | string | null): string {
  if (num === null || num === undefined || num === '') return '-';
  const val = Number(num);
  if (isNaN(val)) return String(num);
  return val.toLocaleString('es-AR');
}

/**
 * Converts an image URL (including Supabase signed URL or public URL) to a base64 data URL
 */
async function getBase64Image(urlOrData: string): Promise<string | null> {
  if (!urlOrData) return null;
  if (urlOrData.startsWith('data:image/')) {
    return urlOrData;
  }

  try {
    const response = await fetch(urlOrData, { mode: 'cors' });
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Could not load image for PDF:', urlOrData, err);
    return null;
  }
}

export async function generateRecepcionPdf(recepcion: RecepcionData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm

  const propietarios = getPropietarios();
  const prop = propietarios.find((p) => p.id === recepcion.propietario);
  const razonSocial = prop ? prop.razon_social : (recepcion.propietario || 'No especificado');
  const cuit = prop?.cuit ? formatNumeroArg(prop.cuit) : '-';

  const logoData = getCompanyLogo();

  // Primary colors: petroleum slate header (#0F2D3C) & accent machinery yellow (#D97706)
  const headerBgColor = [15, 45, 60] as [number, number, number];
  const sectionBgColor = [241, 245, 249] as [number, number, number];
  const borderColor = [203, 213, 225] as [number, number, number];

  let currentY = margin;

  // 1. ENCABEZADO
  // Border container for header
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  // Left: Logo or Company mark
  if (logoData) {
    try {
      doc.addImage(logoData, 'JPEG', margin + 3, currentY + 3, 30, 18);
    } catch {
      drawTextLogo(doc, margin + 4, currentY + 8);
    }
  } else {
    drawTextLogo(doc, margin + 4, currentY + 8);
  }

  // Center: Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 60);
  doc.text('CONTROL Y RELEVAMIENTO EN RECEPCIÓN', margin + 38, currentY + 9);
  doc.text('DE EQUIPO DE TERCEROS', margin + 38, currentY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Obra: ${recepcion.obra || 'Sin asignar'}`, margin + 38, currentY + 19);

  // Right: Metadata Box (Acta N° & Estado)
  const shortId = (recepcion.id || 'N/A').substring(0, 8).toUpperCase();
  doc.setFillColor(...sectionBgColor);
  doc.rect(pageWidth - margin - 46, currentY + 2, 44, 20, 'F');
  doc.setDrawColor(...borderColor);
  doc.rect(pageWidth - margin - 46, currentY + 2, 44, 20, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 45, 60);
  doc.text('ACTA Nº:', pageWidth - margin - 43, currentY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(shortId, pageWidth - margin - 25, currentY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ESTADO:', pageWidth - margin - 43, currentY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  
  if (recepcion.estado === 'aprobada') {
    doc.setTextColor(22, 101, 52); // green
  } else if (recepcion.estado === 'completa') {
    doc.setTextColor(30, 64, 175); // blue
  } else if (recepcion.estado === 'anulada') {
    doc.setTextColor(153, 27, 27); // red
  } else {
    doc.setTextColor(71, 85, 105); // gray
  }
  doc.text(recepcion.estado.toUpperCase(), pageWidth - margin - 43, currentY + 19);

  currentY += 28;

  // 2. DATOS DEL EQUIPO Y PROPIETARIO
  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [[{ content: '1. DATOS DEL EQUIPO Y PROPIETARIO', colSpan: 4, styles: { fillColor: headerBgColor, fontStyle: 'bold' } }]],
    body: [
      [
        { content: 'Propietario / Razón Social:', styles: { fontStyle: 'bold', cellWidth: 42 } },
        { content: razonSocial, styles: { cellWidth: 51 } },
        { content: 'CUIT Propietario:', styles: { fontStyle: 'bold', cellWidth: 38 } },
        { content: cuit, styles: { cellWidth: 55 } },
      ],
      [
        { content: 'Nº Interno de Equipo:', styles: { fontStyle: 'bold' } },
        { content: recepcion.interno || '-', styles: { fontStyle: 'bold' } },
        { content: 'Fecha Recepción:', styles: { fontStyle: 'bold' } },
        { content: formatFechaArg(recepcion.fecha) },
      ],
      [
        { content: 'Tipo / Familia:', styles: { fontStyle: 'bold' } },
        { content: recepcion.tipo || '-' },
        { content: 'Remito Nº:', styles: { fontStyle: 'bold' } },
        { content: recepcion.remito ? String(recepcion.remito) : '-' },
      ],
      [
        { content: 'Marca:', styles: { fontStyle: 'bold' } },
        { content: recepcion.marca || '-' },
        { content: 'Modelo:', styles: { fontStyle: 'bold' } },
        { content: recepcion.modelo || '-' },
      ],
      [
        { content: 'Nº de Serie / Chasis:', styles: { fontStyle: 'bold' } },
        { content: recepcion.serie || '-' },
        { content: 'Dominio / Patente:', styles: { fontStyle: 'bold' } },
        { content: recepcion.dominio || '-' },
      ],
      [
        { content: 'Origen / Procedencia:', styles: { fontStyle: 'bold' } },
        { content: recepcion.origen || '-' },
        { content: 'Lectura Contador:', styles: { fontStyle: 'bold' } },
        { content: recepcion.contador ? `${formatNumeroArg(recepcion.contador)} ${recepcion.unidad_cont || 'hs'}` : '-' },
      ],
    ],
    styles: { fontSize: 8.5, cellPadding: 2, textColor: [30, 41, 59], lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // 3. RESPONSABILIDAD DE MANTENIMIENTO
  const siMark = recepcion.mantenimiento_propietario ? '[ X ]' : '[   ]';
  const noMark = !recepcion.mantenimiento_propietario ? '[ X ]' : '[   ]';

  autoTable(doc, {
    startY: currentY,
    theme: 'plain',
    body: [
      [
        {
          content: `¿Los servicios de mantenimiento deberán ser realizados por el propietario?       ${siMark} SÍ         ${noMark} NO`,
          styles: {
            fontStyle: 'bold',
            fontSize: 9,
            fillColor: recepcion.mantenimiento_propietario ? [254, 243, 199] : [241, 245, 249],
            textColor: [15, 23, 42],
            cellPadding: 3,
            lineColor: borderColor,
            lineWidth: 0.3,
          },
        },
      ],
    ],
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // 4. MOTORES (COMBUSTIÓN Y ELÉCTRICO)
  const mc = recepcion.motor_combustion;
  const me = recepcion.motor_electrico;

  const motorBody = [];
  if (mc && (mc.marca || mc.modelo || mc.serie)) {
    motorBody.push([
      'Combustión',
      mc.marca || '-',
      mc.modelo || '-',
      mc.serie || '-',
      mc.correa || '-',
    ]);
  } else {
    motorBody.push(['Combustión', 'No aplica / Sin datos', '-', '-', '-']);
  }

  if (me && (me.marca || me.modelo || me.serie || me.potencia)) {
    motorBody.push([
      'Eléctrico',
      me.marca || '-',
      me.modelo || '-',
      me.serie || '-',
      me.potencia ? `${me.potencia}` : '-',
    ]);
  } else {
    motorBody.push(['Eléctrico', 'No aplica / Sin datos', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [
      [{ content: '2. RELEVAMIENTO DE MOTORES', colSpan: 5, styles: { fillColor: headerBgColor, fontStyle: 'bold' } }],
      ['Tipo de Motor', 'Marca', 'Modelo', 'Nº de Serie', 'Correa / Potencia'],
    ],
    body: motorBody,
    headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // 5. FILTROS INSTALADOS
  const filtrosBody = (recepcion.filtros_instalados && recepcion.filtros_instalados.length > 0)
    ? recepcion.filtros_instalados.map((f) => [
        f.tipo_filtro_nombre || 'Filtro',
        f.codigo || '-',
        f.marca || '-',
        f.observacion || '-',
      ])
    : [['No se relevaron filtros instalados', '-', '-', '-']];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [
      [{ content: '3. FILTROS INSTALADOS', colSpan: 4, styles: { fillColor: headerBgColor, fontStyle: 'bold' } }],
      ['Descripción / Tipo', 'Código', 'Marca', 'Observación'],
    ],
    body: filtrosBody,
    headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // 6. ELEMENTOS DE DESGASTE
  const desgBody = (recepcion.elementos_desgaste && recepcion.elementos_desgaste.length > 0)
    ? recepcion.elementos_desgaste.map((e, idx) => [`Item ${idx + 1}`, e.descripcion])
    : [['-', 'Sin observaciones de desgaste registradas']];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [
      [{ content: '4. ELEMENTOS DE DESGASTE', colSpan: 2, styles: { fillColor: headerBgColor, fontStyle: 'bold' } }],
      ['Ítem', 'Descripción / Estado'],
    ],
    body: desgBody,
    headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Check if we need page break before Documentos y Accesorios
  if (currentY > pageHeight - 60) {
    doc.addPage();
    currentY = margin;
  }

  // 7. DOCUMENTACIÓN Y ACCESORIOS
  const da = recepcion.documentos_accesorios || {
    documentacion: false,
    gato_hidraulico: false,
    matafuego: false,
    botiquin: false,
    calzas_cuñas: false,
    rueda_auxilio: false,
    kit_seguridad: false,
  };

  const checklistItems = [
    { name: 'Documentación obligatoria del equipo (Seguro, VTV, Certificados)', val: da.documentacion },
    { name: 'Gato hidráulico de capacidad correspondiente', val: da.gato_hidraulico },
    { name: 'Matafuego reglamentario con carga y marbete al día', val: da.matafuego },
    { name: 'Botiquín de primeros auxilios completo', val: da.botiquin },
    { name: 'Calzas / Cuñas de seguridad para estacionamiento', val: da.calzas_cuñas },
    { name: 'Rueda de auxilio en condición operativa', val: da.rueda_auxilio },
    { name: 'Kit de seguridad (Balizas reglamentarias, chaleco reflectivo)', val: da.kit_seguridad },
  ];

  const daBody = checklistItems.map((item, idx) => [
    `Acc. ${idx + 1}`,
    item.name,
    item.val ? '✔' : '',
    !item.val ? '✔' : '',
  ]);

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [
      [{ content: '5. DOCUMENTACIÓN Y ACCESORIOS', colSpan: 4, styles: { fillColor: headerBgColor, fontStyle: 'bold' } }],
      ['Ítem', 'Descripción', 'Está en equipo', 'No está'],
    ],
    body: daBody,
    headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 120 },
      2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      3: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
    styles: { fontSize: 8, cellPadding: 2, lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 2;

  if (da.comentario) {
    autoTable(doc, {
      startY: currentY,
      theme: 'plain',
      body: [
        [
          {
            content: `Comentarios de accesorios: ${da.comentario}`,
            styles: { fontSize: 8, fontStyle: 'italic', textColor: [71, 85, 105], cellPadding: 2 },
          },
        ],
      ],
      margin: { left: margin, right: margin },
    });
    currentY = (doc as any).lastAutoTable.finalY + 3;
  } else {
    currentY += 2;
  }

  // 8. FALTANTES
  // Combine unchecked accessory items + custom faltantes
  const faltantesList: string[] = [];
  checklistItems.forEach((c) => {
    if (!c.val) faltantesList.push(`Falta accesorio: ${c.name}`);
  });
  if (recepcion.faltantes && recepcion.faltantes.length > 0) {
    recepcion.faltantes.forEach((f) => {
      if (f.descripcion?.trim()) faltantesList.push(f.descripcion.trim());
    });
  }

  const faltBody = faltantesList.length > 0
    ? faltantesList.map((f, i) => [`Faltante ${i + 1}`, f])
    : [['-', 'Sin faltantes detectados al momento de la entrega']];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [
      [{ content: '6. DETALLE DE FALTANTES', colSpan: 2, styles: { fillColor: headerBgColor, fontStyle: 'bold' } }],
      ['Ítem', 'Detalle'],
    ],
    body: faltBody,
    headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Check page break
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = margin;
  }

  // 9. DATOS COMPLEMENTARIOS
  const datosCompl = recepcion.datos_complementarios || recepcion.observaciones_generales || 'Sin observaciones complementarias.';
  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [[{ content: '7. DATOS COMPLEMENTARIOS / OBSERVACIONES', styles: { fillColor: headerBgColor, fontStyle: 'bold' } }]],
    body: [[datosCompl]],
    styles: { fontSize: 8.5, cellPadding: 3, lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // 10. ÚLTIMOS SERVICIOS
  const servBody = (recepcion.ultimos_servicios && recepcion.ultimos_servicios.length > 0)
    ? recepcion.ultimos_servicios.map((s) => [
        formatFechaArg(s.fecha),
        s.contador ? `${formatNumeroArg(s.contador)} ${s.unidad || 'hs'}` : '-',
        s.tipo_servicio || 'Mantenimiento Preventivo',
      ])
    : [['-', '-', 'Sin registros de servicios previos']];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [
      [{ content: '8. PLAN DE MANTENIMIENTO: ÚLTIMOS SERVICIOS REALIZADOS', colSpan: 3, styles: { fillColor: headerBgColor, fontStyle: 'bold' } }],
      ['Fecha', 'Horas / Km', 'Tipo de Servicio'],
    ],
    body: servBody,
    headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Check page break
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = margin;
  }

  // 11. LUBRICANTES
  const lubBody = (recepcion.lubricantes && recepcion.lubricantes.length > 0)
    ? recepcion.lubricantes.map((l) => [
        l.sector_nombre || 'Sector',
        l.aceite_grasa ? l.aceite_grasa.toUpperCase() : '-',
        l.marca || '-',
        l.cantidad ? `${formatNumeroArg(l.cantidad)} ${l.unidad_cant || 'lts'}` : '-',
        l.frecuencia ? `${formatNumeroArg(l.frecuencia)} ${l.unidad_fcia || 'hs'}` : '-',
        l.comentarios || (l.planilla_adjunta ? 'Planilla adjunta' : '-'),
      ])
    : [['Sin especificación de lubricantes', '-', '-', '-', '-', '-']];

  autoTable(doc, {
    startY: currentY,
    theme: 'grid',
    head: [
      [{ content: '9. TABLA DE LUBRICANTES Y FLUIDOS', colSpan: 6, styles: { fillColor: headerBgColor, fontStyle: 'bold' } }],
      ['Sector', 'Tipo', 'Marca / Grado', 'Cantidad', 'Frecuencia', 'Observaciones'],
    ],
    body: lubBody,
    headStyles: { fillColor: [51, 65, 85], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, lineColor: borderColor, lineWidth: 0.2 },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 12. REGISTRO FOTOGRÁFICO (Grilla de 2 columnas)
  const adjuntosFotos = (recepcion.adjuntos || []).filter((a) => a.tipo === 'Foto' || a.url || a.data_url);
  // Also include equipo legacy url_imagen_1..4 if any
  const legacyImages = [recepcion.url_imagen_1, recepcion.url_imagen_2, recepcion.url_imagen_3, recepcion.url_imagen_4].filter(Boolean) as string[];
  
  const allImagesToRender: { title: string; src: string }[] = [];
  adjuntosFotos.forEach((a, i) => {
    allImagesToRender.push({
      title: a.tipo_sugerido || a.nombre_archivo || `Fotografía ${i + 1}`,
      src: a.data_url || a.url,
    });
  });
  legacyImages.forEach((img, i) => {
    if (!allImagesToRender.some((x) => x.src === img)) {
      allImagesToRender.push({
        title: `Fotografía Inspección ${i + 1}`,
        src: img,
      });
    }
  });

  if (allImagesToRender.length > 0) {
    // New page for photographic inspection
    doc.addPage();
    currentY = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 45, 60);
    doc.text('10. REGISTRO FOTOGRÁFICO DE RECEPCIÓN', margin, currentY + 4);
    currentY += 8;

    const colWidth = (contentWidth - 6) / 2; // ~90mm
    const imgHeight = 60; // 60mm

    for (let i = 0; i < allImagesToRender.length; i++) {
      const item = allImagesToRender[i];
      const isCol2 = i % 2 === 1;
      const x = isCol2 ? margin + colWidth + 6 : margin;

      // Check if row overflows
      if (!isCol2 && currentY + imgHeight + 12 > pageHeight - margin - 25) {
        doc.addPage();
        currentY = margin + 4;
      }

      // Draw photo container border
      doc.setDrawColor(...borderColor);
      doc.setLineWidth(0.3);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, currentY, colWidth, imgHeight + 8, 1.5, 1.5, 'FD');

      // Caption banner
      doc.setFillColor(...sectionBgColor);
      doc.rect(x, currentY + imgHeight, colWidth, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(item.title.substring(0, 36), x + 2, currentY + imgHeight + 5.5);

      // Render image
      try {
        const base64Data = await getBase64Image(item.src);
        if (base64Data) {
          doc.addImage(base64Data, 'JPEG', x + 1, currentY + 1, colWidth - 2, imgHeight - 2);
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text('[Imagen no disponible]', x + colWidth / 2 - 16, currentY + imgHeight / 2);
        }
      } catch (err) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('[Error de carga de imagen]', x + colWidth / 2 - 18, currentY + imgHeight / 2);
      }

      if (isCol2 || i === allImagesToRender.length - 1) {
        currentY += imgHeight + 12;
      }
    }
  }

  // 13. FIRMAS Y RESPONSABLES
  if (currentY > pageHeight - 55) {
    doc.addPage();
    currentY = margin;
  }

  const responsableName = recepcion.responsable_nombre || 'Personal Autorizado de Obra';
  const fechaInforme = formatFechaArg(recepcion.fecha_informe || recepcion.fecha);

  autoTable(doc, {
    startY: currentY,
    theme: 'plain',
    body: [
      [
        {
          content: `Confeccionó: ${responsableName}          |          Fecha de Informe: ${fechaInforme}`,
          styles: { fontStyle: 'bold', fontSize: 9, textColor: [15, 23, 42], cellPadding: 2 },
        },
      ],
    ],
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // Signature boxes
  const boxWidth = (contentWidth - 10) / 2;
  const boxHeight = 28;

  // Recibió (Obra)
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('RECIBIÓ (OBRA)', margin + 3, currentY + 5);

  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin + 6, currentY + 20, margin + boxWidth - 6, currentY + 20);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Firma, Aclaración y DNI Responsable de Obra', margin + boxWidth / 2 - 28, currentY + 24);

  // Entregó (Propietario / Transportista)
  const xBox2 = margin + boxWidth + 10;
  doc.roundedRect(xBox2, currentY, boxWidth, boxHeight, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('ENTREGÓ (PROPIETARIO / TRANSPORTISTA)', xBox2 + 3, currentY + 5);

  doc.setLineDashPattern([1, 1], 0);
  doc.line(xBox2 + 6, currentY + 20, xBox2 + boxWidth - 6, currentY + 20);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Firma, Aclaración y DNI / Chapa Patente Transporte', xBox2 + boxWidth / 2 - 32, currentY + 24);

  // 14. PIE DE PÁGINA EN TODAS LAS HOJAS: "Página X de Y", timestamp e ID
  const totalPages = doc.getNumberOfPages();
  const timestampStr = new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);

    // Subtle top border of footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 8, pageWidth - margin, pageHeight - 8);

    doc.text(`Acta ID: ${shortId} · Emitido: ${timestampStr} hs`, margin, pageHeight - 5);
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin - 20, pageHeight - 5);
  }

  return doc;
}

/**
 * Downloads the generated PDF with required naming convention:
 * Acta_Recepcion_{nro_equipo}_{AAAA-MM-DD}.pdf
 */
export async function downloadRecepcionPdf(recepcion: RecepcionData): Promise<void> {
  const doc = await generateRecepcionPdf(recepcion);
  const nroEquipo = (recepcion.interno || 'S-N').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fechaStr = recepcion.fecha || new Date().toISOString().split('T')[0];
  const filename = `Acta_Recepcion_${nroEquipo}_${fechaStr}.pdf`;
  doc.save(filename);
}

function drawTextLogo(doc: jsPDF, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(217, 119, 6); // amber
  doc.text('OBRAS', x, y);
  doc.setTextColor(15, 45, 60);
  doc.text('& EQUIPOS', x + 16, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SISTEMA TÉCNICO VIAL', x, y + 4.5);
}
