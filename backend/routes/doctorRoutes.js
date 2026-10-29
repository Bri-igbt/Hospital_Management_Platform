import express from "express";
import multer from "multer";
import { doctorAuth } from "../middlewares/doctorAuth.js";
import { requireAdmin } from "../middlewares/adminAuth.js";
import {
  createDoctor,
  deleteDoctor,
  doctorLogin,
  getDoctorById,
  getDoctors,
  toggleAvailability,
  updateDoctor,
} from "../controllers/doctorController.js";

const upload = multer({ dest: "/tmp" });
const doctorRouter = express.Router();

doctorRouter.get("/", getDoctors);
doctorRouter.post("/login", doctorLogin);
doctorRouter.get("/:id", getDoctorById);
doctorRouter.post("/", requireAdmin, upload.single("image"), createDoctor);
doctorRouter.delete("/:id", requireAdmin, deleteDoctor);
doctorRouter.put("/:id", doctorAuth, upload.single("image"), updateDoctor);
doctorRouter.post("/:id/toggle-availability", doctorAuth, toggleAvailability);

export default doctorRouter;
