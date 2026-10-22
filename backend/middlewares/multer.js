import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "upload";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_TYPES = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = ALLOWED_TYPES[file.mimetype] || path.extname(file.originalname);
    cb(null, uniqueName + ext);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error("Only PNG, JPEG and WEBP images are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, 
  },
});

export default upload;
