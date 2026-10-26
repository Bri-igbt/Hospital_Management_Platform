import dotenv from "dotenv";
import mongoose from "mongoose";
import Stripe from "stripe";
import { getAuth } from "@clerk/express";
import ServiceAppointment from "../models/ServiceAppointment.js";
import Service from "../models/Service.js";

dotenv.config();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const CURRENCY = (process.env.PAYMENT_CURRENCY || "inr").toLowerCase();
const GENDERS = ["Male", "Female", "Other"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const safeNumber = (val) => {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

const escapeRegex = (str = "") =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidId = (id) => mongoose.isValidObjectId(id);

const pad2 = (n) => String(n).padStart(2, "0");

const getUserId = (req) => {
  try {
    return getAuth(req)?.userId || null;
  } catch {
    return null;
  }
};

const isAdmin = (userId) =>
  Boolean(userId) &&
  Boolean(process.env.MAJOR_ADMIN_ID) &&
  userId === process.env.MAJOR_ADMIN_ID;

const buildFrontendBase = (req) => {
  const env = process.env.FRONTEND_URL;
  if (env) return env.replace(/\/$/, "");

  const origin = req.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const referer = req.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {

    }
  }
  return null;
};

function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const m = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;

  const hh = parseInt(m[1], 10);
  const mm = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = (m[3] || "").toUpperCase();
  if (mm < 0 || mm > 59) return null;

  if (ampm) {
    if (hh < 1 || hh > 12) return null;
    return { hour: hh, minute: mm, ampm };
  }

  if (hh < 0 || hh > 23) return null;
  if (hh === 0) return { hour: 12, minute: mm, ampm: "AM" };
  if (hh === 12) return { hour: 12, minute: mm, ampm: "PM" };
  if (hh > 12) return { hour: hh - 12, minute: mm, ampm: "PM" };
  return { hour: hh, minute: mm, ampm: "AM" };
}

function resolveSlot({ time, hour, minute, ampm }) {
  if (time) return parseTimeString(String(time));

  const h = safeNumber(hour);
  const m = safeNumber(minute);
  const ap = String(ampm || "").toUpperCase();
  if (h === null || m === null || (ap !== "AM" && ap !== "PM")) return null;
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 1 || h > 12 || m < 0 || m > 59) return null;
  return { hour: h, minute: m, ampm: ap };
}


const formatSlot = (slot) =>
  `${pad2(slot.hour)}:${pad2(slot.minute)} ${slot.ampm}`;

function isSlotOffered(svc, date, slot) {
  const slots = svc?.slots;
  if (!slots || typeof slots !== "object") return true;

  const dateKeys = Object.keys(slots).filter((k) => k !== "unspecified");
  if (dateKeys.length === 0) return true;

  const list = slots[date];
  return Array.isArray(list) && list.includes(formatSlot(slot));
}

const normalizeGender = (g) => {
  if (!g) return "";
  const s = String(g).trim();
  const cap = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return GENDERS.includes(cap) ? cap : "";
};

// TO CREATE A SERVICE APPOINTMENT
export const createServiceAppointment = async (req, res) => {
  try {
    const clerkUserId = getUserId(req);
    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to create a service appointment",
      });
    }

    const {
      serviceId,
      patientName,
      mobile,
      age,
      gender,
      date,
      time,
      hour,
      minute,
      ampm,
      paymentMethod = "Online",
      email,
      meta = {},
      notes = "",
    } = req.body || {};

    if (!serviceId || !isValidId(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "A valid serviceId is required",
      });
    }
    if (!patientName || !String(patientName).trim()) {
      return res.status(400).json({
        success: false,
        message: "patientName is required",
      });
    }
    if (!mobile || !String(mobile).trim()) {
      return res.status(400).json({
        success: false,
        message: "mobile is required",
      });
    }
    if (!date || !DATE_RE.test(String(date))) {
      return res.status(400).json({
        success: false,
        message: "date is required (YYYY-MM-DD)",
      });
    }

    let numericAge;
    if (age !== undefined && age !== null && age !== "") {
      numericAge = safeNumber(age);
      if (numericAge === null || numericAge < 0 || numericAge > 130) {
        return res.status(400).json({
          success: false,
          message: "age must be a valid number",
        });
      }
    }

    const slot = resolveSlot({ time, hour, minute, ampm });
    if (!slot) {
      return res.status(400).json({
        success: false,
        message:
          "Time missing or invalid. Provide a time string, or hour, minute and ampm.",
      });
    }

    const svc = await Service.findById(serviceId).lean();
    if (!svc) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }
    if (svc.available === false) {
      return res.status(400).json({
        success: false,
        message: "This service is currently unavailable",
      });
    }

    if (!isSlotOffered(svc, String(date), slot)) {
      return res.status(400).json({
        success: false,
        message: "The selected date and time is not available for this service",
      });
    }

    const numericFee = safeNumber(svc.price ?? 0);
    if (numericFee === null || numericFee < 0) {
      return res.status(500).json({
        success: false,
        message: "Service price is not configured correctly",
      });
    }

    const slotQuery = {
      serviceId: svc._id,
      createdBy: clerkUserId,
      date: String(date),
      hour: slot.hour,
      minute: slot.minute,
      ampm: slot.ampm,
    };

    await ServiceAppointment.deleteMany({
      ...slotQuery,
      status: "Pending",
      "payment.method": "Online",
      "payment.status": "Pending",
    });

    const existing = await ServiceAppointment.findOne({
      ...slotQuery,
      status: { $ne: "Canceled" },
    }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "You already have a booking for this service at the selected date and time.",
      });
    }

    const method = paymentMethod === "Cash" ? "Cash" : "Online";

    const base = {
      serviceId: svc._id,
      serviceName: String(svc.name || "Service").trim(),
      serviceImage: {
        url: String(svc.imageUrl || "").trim(),
        publicId: String(svc.imagePublicId || "").trim(),
      },
      patientName: String(patientName).trim(),
      mobile: String(mobile).trim(),
      age: numericAge,
      gender: normalizeGender(gender),
      date: String(date),
      hour: slot.hour,
      minute: slot.minute,
      ampm: slot.ampm,
      fees: numericFee,
      createdBy: clerkUserId,
      notes: notes ? String(notes) : "",
    };

    if (numericFee === 0) {
      const created = await ServiceAppointment.create({
        ...base,
        status: "Confirmed",
        payment: {
          method,
          status: "Paid",
          amount: 0,
          paidAt: new Date(),
        },
      });
      return res.status(201).json({
        success: true,
        appointment: created,
        checkoutUrl: null,
      });
    }

    if (method === "Cash") {
      const created = await ServiceAppointment.create({
        ...base,
        status: "Pending",
        payment: {
          method: "Cash",
          status: "Pending",
          amount: numericFee,
          meta,
        },
      });
      return res.status(201).json({
        success: true,
        appointment: created,
        checkoutUrl: null,
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe not configured on server",
      });
    }

    const frontendBase = buildFrontendBase(req);
    if (!frontendBase) {
      return res.status(500).json({
        success: false,
        message:
          "Frontend base URL not available. Set FRONTEND_URL or send an Origin header.",
      });
    }

    const created = await ServiceAppointment.create({
      ...base,
      status: "Pending",
      payment: {
        method: "Online",
        status: "Pending",
        amount: numericFee,
      },
    });

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: email ? String(email) : undefined,
        line_items: [
          {
            price_data: {
              currency: CURRENCY,
              product_data: {
                name: `Service: ${base.serviceName.slice(0, 60)}`,
                description: `Appointment on ${base.date} at ${formatSlot(
                  slot
                )}`,
              },
              unit_amount: Math.round(numericFee * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${frontendBase}/service-appointment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendBase}/service-appointment/cancel`,
        metadata: {
          appointmentId: String(created._id),
          serviceId: String(svc._id),
          serviceName: base.serviceName.slice(0, 200),
          patientName: base.patientName,
          mobile: base.mobile,
          clerkUserId,
        },
      });
    } catch (stripeErr) {
      console.error("Stripe create session error:", stripeErr);
      await ServiceAppointment.findByIdAndDelete(created._id).catch(() => {});
      const message =
        stripeErr?.raw?.message || stripeErr?.message || "Stripe error";
      return res.status(502).json({
        success: false,
        message: `Payment provider error: ${message}`,
      });
    }

    created.payment.sessionId = session.id || "";
    await created.save();

    return res.status(201).json({
      success: true,
      appointment: created,
      checkoutUrl: session.url || null,
    });
  } catch (error) {
    console.error("createServiceAppointment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO CONFIRM SERVICE PAYMENT
export const confirmServicePayment = async (req, res) => {
  try {
    const session_id = String(
      req.query?.session_id || req.body?.session_id || ""
    );
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Session id is required",
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe is not configured",
      });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (error) {
      console.error("Stripe retrieve session error:", error);
      return res.status(404).json({
        success: false,
        message: "Stripe session not found",
      });
    }

    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
      });
    }

    const appt = await ServiceAppointment.findOne({
      "payment.sessionId": session_id,
    });
    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Service appointment not found",
      });
    }

    if (appt.payment.status !== "Paid") {
      appt.payment.status = "Paid";
      appt.payment.providerId = String(session.payment_intent || "");
      appt.payment.paidAt = new Date();
      if (appt.status === "Pending") appt.status = "Confirmed";
      await appt.save();
    }

    return res.json({
      success: true,
      message: "Payment confirmed successfully",
      appointment: appt,
    });
  } catch (error) {
    console.error("ConfirmServicePayment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO GET SERVICE APPOINTMENT
export const getServiceAppointment = async (req, res) => {
  try {
    const {
      serviceId,
      mobile,
      status,
      page: pageRaw = 1,
      limit: limitRaw = 50,
      search = "",
    } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (serviceId) {
      if (!isValidId(serviceId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service id",
        });
      }
      filter.serviceId = serviceId;
    }
    if (mobile) filter.mobile = String(mobile);
    if (status) filter.status = String(status);
    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ patientName: re }, { mobile: re }, { notes: re }];
    }

    const appointments = await ServiceAppointment.find(filter)
      .populate("serviceId", "name imageUrl")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ServiceAppointment.countDocuments(filter);
    return res.json({
      success: true,
      appointments,
      meta: {
        page,
        total,
        limit,
        count: appointments.length,
      },
    });
  } catch (error) {
    console.error("GetServiceAppointment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO GET SERVICE APPOINTMENT BY ID
export const getServiceAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment id",
      });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const appt = await ServiceAppointment.findById(id).lean();
    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (appt.createdBy !== userId && !isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    return res.json({
      success: true,
      data: appt,
    });
  } catch (error) {
    console.error("GetServiceAppointmentById Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO UPDATE SERVICE APPOINTMENT
export const updateServiceAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment id",
      });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const appt = await ServiceAppointment.findById(id);
    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const admin = isAdmin(userId);
    if (appt.createdBy !== userId && !admin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    const body = req.body || {};
    const terminal = appt.status === "Completed" || appt.status === "Canceled";
    const updates = {};

    if (body.status !== undefined) {
      if (!admin) {
        return res.status(403).json({
          success: false,
          message: "Only an admin can change the status",
        });
      }
      if (terminal && body.status !== appt.status) {
        return res.status(400).json({
          success: false,
          message: "Cannot change status of a completed/canceled appointment",
        });
      }
      updates.status = body.status;

      if (
        body.status === "Completed" &&
        appt.payment.method === "Cash" &&
        appt.payment.status === "Pending"
      ) {
        updates["payment.status"] = "Paid";
        updates["payment.paidAt"] = new Date();
      }
    }

    if (body.notes !== undefined) updates.notes = String(body.notes);

    if (body.rescheduledTo) {
      if (terminal) {
        return res.status(400).json({
          success: false,
          message: "Cannot reschedule a completed/canceled appointment",
        });
      }

      const { date, time, hour, minute, ampm } = body.rescheduledTo;
      const hasTime = Boolean(time) || hour !== undefined;

      if (!date && !hasTime) {
        return res.status(400).json({
          success: false,
          message: "A new date or time is required",
        });
      }
      if (date && !DATE_RE.test(String(date))) {
        return res.status(400).json({
          success: false,
          message: "rescheduledTo.date must be YYYY-MM-DD",
        });
      }

      const newDate = date ? String(date) : appt.date;
      let slot = { hour: appt.hour, minute: appt.minute, ampm: appt.ampm };
      if (hasTime) {
        slot = resolveSlot({ time, hour, minute, ampm });
        if (!slot) {
          return res.status(400).json({
            success: false,
            message: "rescheduledTo time couldn't be parsed",
          });
        }
      }

      const svc = await Service.findById(appt.serviceId).lean();
      if (svc && !isSlotOffered(svc, newDate, slot)) {
        return res.status(400).json({
          success: false,
          message: "The new date and time is not available for this service",
        });
      }

      updates.date = newDate;
      updates.hour = slot.hour;
      updates.minute = slot.minute;
      updates.ampm = slot.ampm;
      updates.rescheduledTo = {
        date: newDate,
        hour: slot.hour,
        minute: slot.minute,
        ampm: slot.ampm,
      };
      if (updates.status === undefined) updates.status = "Rescheduled";
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nothing to update" });
    }

    const updated = await ServiceAppointment.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("UpdateServiceAppointment Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// TO CANCEL SERVICE APPOINTMENT
export const cancelServiceAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid appointment id" });
    }

    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const appt = await ServiceAppointment.findById(id);
    if (!appt) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
    }

    if (appt.createdBy !== userId && !isAdmin(userId)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (appt.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a completed appointment",
      });
    }

    if (appt.status !== "Canceled") {
      appt.status = "Canceled";
      await appt.save();
    }

    return res.status(200).json({
      success: true,
      message: "Appointment canceled successfully",
      data: appt,
    });
  } catch (error) {
    console.error("CancelServiceAppointment Error:", error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

// TO GET SERVICE APPOINTMENT STATS
export const getServiceAppointmentStats = async (req, res) => {
  try {
    const services = await Service.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "serviceappointments",
          localField: "_id",
          foreignField: "serviceId",
          as: "appointments",
        },
      },
      {
        $addFields: {
          totalAppointments: { $size: "$appointments" },
          completedList: {
            $filter: {
              input: "$appointments",
              as: "a",
              cond: { $eq: ["$$a.status", "Completed"] },
            },
          },
          canceled: {
            $size: {
              $filter: {
                input: "$appointments",
                as: "a",
                cond: { $eq: ["$$a.status", "Canceled"] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          completed: { $size: "$completedList" },
          earning: { $sum: "$completedList.fees" },
        },
      },
      {
        $project: {
          name: 1,
          price: 1,
          image: "$imageUrl",
          totalAppointments: 1,
          completed: 1,
          canceled: 1,
          earning: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      services,
      totalServices: services.length,
    });
  } catch (error) {
    console.error("GetServiceAppointmentStats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO GET SERVICE APPOINTMENT BY PATIENT
export const getServiceAppointmentByPatient = async (req, res) => {
  try {
    const clerkUserId = getUserId(req);
    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const filter = { createdBy: clerkUserId };
    if (req.query.mobile) filter.mobile = String(req.query.mobile);

    const list = await ServiceAppointment.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    console.error("GetServiceAppointmentByPatient Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
