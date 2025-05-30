export function resizeImage(file: File, maxSize = 1024, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error("Failed to read file."));
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");

        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height = Math.round(height * (maxSize / width));
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round(width * (maxSize / height));
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("Failed to get canvas context."));
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Convert to JPEG with specified quality
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to convert canvas to blob."));
          }
        }, "image/jpeg", quality);
      };
      img.onerror = (err) => reject(err);
      img.src = event.target.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}