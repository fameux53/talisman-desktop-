/**
 * Capture a photo using the device camera or file picker.
 * Returns a resized base64 JPEG data URL (max 400x400, 70% quality).
 */
export function capturePhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // back camera on mobile
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const resized = await resizeImage(file, 400);
      resolve(resized);
    };
    // Handle cancel (no file selected)
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

async function resizeImage(file: File, maxSize: number): Promise<string> {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  await new Promise<void>((r) => { img.onload = () => r(); });

  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  URL.revokeObjectURL(objectUrl);
  return canvas.toDataURL('image/jpeg', 0.7);
}
