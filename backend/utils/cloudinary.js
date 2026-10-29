import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const removeLocalFile = (filePath) => {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
};

export async function uploadToCloudinary(filePath, folder = "Doctor") {
  try {
    return await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "image",
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  } finally {
    removeLocalFile(filePath);
  }
}

export async function deleteFromCloudinary(publicId) {
  try {
    if (!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
}

export default cloudinary;
