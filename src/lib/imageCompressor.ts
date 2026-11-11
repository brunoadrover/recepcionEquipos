import imageCompression from 'browser-image-compression';

export interface CompressionResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
}

/**
 * Compresses an image file to max 1600px width/height, 0.8 quality JPEG.
 * Includes HTML5 Canvas fallback in case WebWorker or library is unavailable.
 */
export async function compressImage(file: File): Promise<CompressionResult> {
  const originalSize = file.size;

  // If it's a PDF, do not compress, just read
  if (file.type === 'application/pdf') {
    const dataUrl = await fileToDataUrl(file);
    return {
      file,
      dataUrl,
      originalSize,
      compressedSize: originalSize,
    };
  }

  try {
    const options = {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8,
    };

    const compressedBlob = await imageCompression(file, options);
    const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    const dataUrl = await fileToDataUrl(compressedFile);

    return {
      file: compressedFile,
      dataUrl,
      originalSize,
      compressedSize: compressedFile.size,
    };
  } catch (err) {
    console.warn('browser-image-compression failed, using canvas fallback:', err);
    return await compressImageCanvas(file);
  }
}

/**
 * Fallback compression using pure HTML5 Canvas
 */
export function compressImageCanvas(file: File): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo de imagen'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error al cargar la imagen en canvas'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxSide = 1600;

        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('No se pudo inicializar canvas 2D'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Error al generar blob comprimido'));
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve({
              file: compressedFile,
              dataUrl,
              originalSize: file.size,
              compressedSize: compressedFile.size,
            });
          },
          'image/jpeg',
          0.8
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
