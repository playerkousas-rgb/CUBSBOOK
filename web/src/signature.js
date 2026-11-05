/**
 * 將手寫或簽名墨跡縮細並轉為單色透明底 PNG，大幅節省本機儲存及二維碼體積。
 */
export function shrinkInk(dataUrl, { maxW = 320, maxH = 96 } = {}) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
        const width = Math.max(1, Math.round((img.width || 1) * scale));
        const height = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const frame = ctx.getImageData(0, 0, width, height);
          const px = frame.data;
          for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] > 90) {
              px[i] = 32;
              px[i + 1] = 20;
              px[i + 2] = 26;
              px[i + 3] = 255;
            } else {
              px[i + 3] = 0;
            }
          }
          ctx.putImageData(frame, 0, 0);
        } catch {
          /* keep scaled image */
        }
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function shrinkSignature(dataUrl, opts) {
  return shrinkInk(dataUrl, opts);
}

/** 個人近照重新壓縮為適中 JPEG，避免撐爆 localStorage。 */
export function shrinkPhoto(dataUrl, { maxW = 360, quality = 0.72 } = {}) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxW / (img.width || 1));
        const width = Math.max(1, Math.round((img.width || 1) * scale));
        const height = Math.max(1, Math.round((img.height || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
