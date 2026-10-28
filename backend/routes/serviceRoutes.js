import express from "express";
import { getAuth } from "@clerk/express";
import { requireAdmin, requireUserOrAdmin } from "../middlewares/adminAuth.js";
import {
  cancelServiceAppointment,
  confirmServicePayment,
  createServiceAppointment,
  getServiceAppointment,
  getServiceAppointmentById,
  getServiceAppointmentByPatient,
  getServiceAppointmentStats,
  updateServiceAppointment,
} from "../controllers/serviceAppointmentController.js";

const serviceAppointmentRouter = express.Router();

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

serviceAppointmentRouter.get(
  "/", 
  requireAdmin, 
  getServiceAppointment
);

serviceAppointmentRouter.get(
  "/stats/summary",
  requireAdmin,
  getServiceAppointmentStats
);

serviceAppointmentRouter.get(
  "/me",
  requireUser,
  getServiceAppointmentByPatient
);
serviceAppointmentRouter.post(
  "/", 
  requireUser, 
  createServiceAppointment
);

serviceAppointmentRouter.get(
  "/confirm", 
  confirmServicePayment
);

serviceAppointmentRouter.get(
  "/:id",
  requireUserOrAdmin,
  getServiceAppointmentById
);
serviceAppointmentRouter.put(
  "/:id",
  requireUserOrAdmin,
  updateServiceAppointment
);
serviceAppointmentRouter.post(
  "/:id/cancel",
  requireUserOrAdmin,
  cancelServiceAppointment
);
serviceAppointmentRouter.post(
  "/:id",
  requireUserOrAdmin,
  cancelServiceAppointment
);

export default serviceAppointmentRouter;
