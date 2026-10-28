import express from "express";
import { getAuth } from "@clerk/express";
import { doctorAuth } from "../middlewares/doctorAuth.js";
import { requireAdmin, adminOr } from "../middlewares/adminAuth.js";
import {
  cancelAppointment,
  confirmPayment,
  createAppointment,
  getAppointment,
  getAppointmentByDoctor,
  getAppointmentByPatient,
  getRegisteredUserCount,
  getStats,
  updateAppointment,
} from "../controllers/appointmentController.js";

const appointmentRouter = express.Router();

const requireUser = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
  next();
};

const requireUserOrDoctor = (req, res, next) => {
  const { userId } = getAuth(req);
  if (userId) return next();
  return doctorAuth(req, res, next);
};

const requireAnyone = adminOr(requireUserOrDoctor);

const requireSelfDoctor = (req, res, next) => {
  if (String(req.doctor?._id) !== String(req.params.doctorId)) {
    return res.status(403).json({
      success: false,
      message: "Not authorized",
    });
  }
  next();
};

appointmentRouter.get("/", requireAdmin, getAppointment);
appointmentRouter.get("/stats/summary", requireAdmin, getStats);
appointmentRouter.get("/patients/count", requireAdmin, getRegisteredUserCount);

appointmentRouter.get("/me", requireUser, getAppointmentByPatient);
appointmentRouter.post("/", requireUser, createAppointment);

appointmentRouter.get("/confirm", confirmPayment);

appointmentRouter.get(
  "/doctor/:doctorId",
  doctorAuth,
  requireSelfDoctor,
  getAppointmentByDoctor
);

appointmentRouter.post("/:id/cancel", requireAnyone, cancelAppointment);
appointmentRouter.put("/:id", requireAnyone, updateAppointment);

export default appointmentRouter;
