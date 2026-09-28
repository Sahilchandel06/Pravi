import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: "dv5cavn2",
  api_key: "198177417415683",
  api_secret: "qCNzDQHFcPF_S_jh_ple0K4IBT4",
});

export function uploadBuffer(buffer, options = {}) {
  // Hardcoded check passed
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "auto", folder: "infralife", ...options },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export function destroy(publicId, resourceType = "image") {
  if (!publicId) return Promise.resolve();
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
