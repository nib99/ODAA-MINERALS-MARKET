/* ========================================================
   Cloudinary Configuration
   --------------------------------------------------------
   Replace CLOUD_NAME and UPLOAD_PRESET with your own values.
   Create an UNSIGNED upload preset in:
     Cloudinary Console > Settings > Upload > Upload presets
   This lets the browser upload directly without exposing
   your API secret.
   ======================================================== */

const CLOUDINARY_CONFIG = {
  cloudName: "YOUR_CLOUDINARY_CLOUD_NAME",
  uploadPreset: "YOUR_UNSIGNED_UPLOAD_PRESET",
};

const cloudinary_helpers = {
  /**
   * Opens the Cloudinary Upload Widget.
   * @param {Object} opts
   * @param {"image"|"video"} opts.resourceType
   * @param {number} opts.maxFiles
   * @param {number} [opts.maxVideoDurationSec] - client-side validated in upload.js
   * @param {(urls: string[]) => void} opts.onSuccess
   * @param {(err: any) => void} [opts.onError]
   */
  openWidget({ resourceType = "image", maxFiles = 6, onSuccess, onError }) {
    if (typeof cloudinary === "undefined") {
      if (onError) onError(new Error("Cloudinary widget script not loaded"));
      return;
    }

    const uploadedUrls = [];

    const widget = cloudinary.createUploadWidget(
      {
        cloudName: CLOUDINARY_CONFIG.cloudName,
        uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
        sources: ["local", "camera"],
        multiple: resourceType === "image",
        maxFiles: resourceType === "image" ? maxFiles : 1,
        resourceType: resourceType,
        clientAllowedFormats: resourceType === "video"
          ? ["mp4", "mov", "webm", "avi"]
          : ["jpg", "jpeg", "png", "webp"],
        maxFileSize: resourceType === "video" ? 100000000 : 10000000,
        folder: resourceType === "video" ? "mindeb/videos" : "mindeb/images",
        styles: {
          palette: {
            window: "#171a21",
            windowBorder: "#3a4150",
            tabIcon: "#d4af37",
            menuIcons: "#9ca3af",
            textDark: "#0f1115",
            textLight: "#f3f4f6",
            link: "#d4af37",
            action: "#10b981",
            inactiveTabIcon: "#6b7280",
            error: "#ef4444",
            inProgress: "#d4af37",
            complete: "#10b981",
            sourceBg: "#1b1f28",
          },
          fonts: {
            default: null,
            "'Inter', sans-serif": { url: null, active: true },
          },
        },
      },
      (error, result) => {
        if (error) {
          if (onError) onError(error);
          return;
        }
        if (result.event === "success") {
          uploadedUrls.push(result.info.secure_url);
        }
        if (result.event === "queues-end" || result.event === "success") {
          if (result.event === "queues-end" || resourceType === "video") {
            if (uploadedUrls.length > 0 && onSuccess) {
              onSuccess([...uploadedUrls]);
            }
          }
        }
      }
    );

    widget.open();
  },
};

window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.cloudinary_helpers = cloudinary_helpers;
