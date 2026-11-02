import express from "express";
import multer from "multer";
import { requireAdmin } from "../middlewares/adminAuth.js";
import {
  createService,
  deleteService,
  getService,
  getServiceById,
  updateService,
} from "../controllers/serviceController.js";

const upload = multer({
  dest: "/tmp",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }
    // server.js turns this message into a 400 response
    return cb(new Error("Only images are allowed"));
  },
});

const serviceRouter = express.Router();

// Public
serviceRouter.get("/", getService);
serviceRouter.get("/:id", getServiceById);

// Admin only (auth runs before multer so rejected requests never write files)
serviceRouter.post("/", requireAdmin, upload.single("image"), createService);
serviceRouter.put("/:id", requireAdmin, upload.single("image"), updateService);
serviceRouter.delete("/:id", requireAdmin, deleteService);

export default serviceRouter;
