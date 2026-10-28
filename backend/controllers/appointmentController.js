import mongoose from "mongoose";
import dotenv from "dotenv";
import Stripe from "stripe";
import { getAuth, clerkClient } from "@clerk/express";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";

dotenv.config();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL;
const CURRENCY = (process.env.PAYMENT_CURRENCY || "ngn").toLowerCase();

const PENDING_HOLD_MINUTES = 30;

const stripe = STRIPE_KEY ? new Stripe(STRIPE_KEY) : null;

const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const escapeRegex = (str = "") =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidId = (id) => mongoose.isValidObjectId(id);

const getUserId = (req) => {
  try {
    return getAuth(req)?.userId || null;
  } catch {
    return null;
  }
};

const buildFrontendBase = (req) => {
  if (FRONTEND_URL) return FRONTEND_URL.replace(/\/$/, "");

  const origin = req.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const referer = req.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {}
  }

  const host = req.get("host");
  if (host) return `${req.protocol || "http"}://${host}`;
  return null;
};

const findSlotConflict = ({ doctorId, date, time, excludeId = null }) => {
  const staleCutoff = new Date(Date.now() - PENDING_HOLD_MINUTES * 60 * 1000);

  const query = {
    doctorId,
    date: String(date),
    time: String(time),
    status: { $ne: "Canceled" },
    $nor: [
      {
        status: "Pending",
        "payment.method": "Online",
        createdAt: { $lt: staleCutoff },
      },
    ],
  };

  if (excludeId) query._id = { $ne: excludeId };

  return Appointment.findOne(query).lean();
};

// TO GET APPONTMENT
export const getAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      mobile,
      status,
      search = "",
      limit: limitRaw = 50,
      page: pageRaw = 1,
      patientClerkId,
      createdBy,
    } = req.query;

    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));

    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = {};

    if (doctorId) {
      if (!isValidId(doctorId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid doctor id",
        });
      }

      filter.doctorId = doctorId;
    }

    if (mobile) filter.mobile = String(mobile);
    if (status) filter.status = String(status);
    if (patientClerkId) filter.createdBy = String(patientClerkId);
    if (createdBy) filter.createdBy = String(createdBy);

    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ patientName: re }, { mobile: re }, { notes: re }];
    }

    const items = await Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("doctorId", "name specialization imageUrl")
      .lean();

    const total = await Appointment.countDocuments(filter);

    return res.json({
      success: true,
      appointments: items,
      meta: { page, limit, total, count: items.length },
    });
  } catch (error) {
    console.error("GetAppointment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO GET APPOINTMENT BY PATIENT
export const getAppointmentByPatient = async (req, res) => {
  try {
    const clerkUserId = getUserId(req);

    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const filter = { createdBy: clerkUserId };

    if (req.query.mobile) {
      filter.mobile = String(req.query.mobile);
    }

    const appointments = await Appointment.find(filter)
      .sort({ date: 1, time: 1 })
      .lean();

    return res.json({
      success: true,
      appointments,
    });
  } catch (error) {
    console.error("GetAppointmentByPatient Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO CREATE AN APPOINTMENT
export const createAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      patientName,
      mobile,
      age = "",
      gender = "",
      date,
      time,
      notes = "",
      email,
      paymentMethod,
    } = req.body || {};

    const clerkUserId = getUserId(req);

    if (!clerkUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required",
      });
    }

    if (!doctorId || !patientName || !date || !mobile || !time) {
      return res.status(400).json({
        success: false,
        message: "Doctor, patient name, mobile, date and time are required",
      });
    }

    if (!isValidId(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor id",
      });
    }

    const doctor = await Doctor.findById(doctorId).lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    if (doctor.availability === "Unavailable") {
      return res.status(400).json({
        success: false,
        message: "This doctor is currently unavailable",
      });
    }

    const numericFee = safeNumber(doctor.fee ?? 0);

    if (numericFee === null || numericFee < 0) {
      return res.status(500).json({
        success: false,
        message: "Doctor fee is not configured correctly",
      });
    }

    const conflict = await findSlotConflict({
      doctorId: doctor._id,
      date,
      time,
    });

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: "This slot is already booked. Please choose another time.",
      });
    }

    const method = paymentMethod === "Cash" ? "Cash" : "Online";

    const base = {
      doctorId: doctor._id,
      doctorName: String(doctor.name || "").trim(),
      speciality: String(doctor.specialization || "").trim(),
      doctorImage: {
        url: String(doctor.imageUrl || "").trim(),
        publicId: String(doctor.imagePublicId || "").trim(),
      },
      patientName: String(patientName).trim(),
      mobile: String(mobile).trim(),
      age: age ? Number(age) : undefined,
      gender: gender ? String(gender) : "",
      date: String(date),
      time: String(time),
      fees: numericFee,
      status: "Pending",
      payment: {
        method,
        status: "Pending",
        amount: numericFee,
      },
      notes: notes || "",
      createdBy: clerkUserId,
      owner: doctor.owner || String(doctor._id),
      sessionId: null,
    };

    if (numericFee === 0) {
      const created = await Appointment.create({
        ...base,
        status: "Confirmed",
        payment: {
          method,
          status: "Paid",
          amount: 0,
        },
        paidAt: new Date(),
      });

      return res.status(201).json({
        success: true,
        appointment: created,
        checkoutUrl: null,
      });
    }

    if (method === "Cash") {
      const created = await Appointment.create(base);

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

    const frontBase = buildFrontendBase(req);

    if (!frontBase) {
      return res.status(500).json({
        success: false,
        message:
          "Frontend URL could not be determined. Set FRONTEND_URL or send an Origin header.",
      });
    }

    const created = await Appointment.create(base);

    let session;

    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: CURRENCY,
              product_data: {
                name: `Appointment - ${base.patientName.slice(0, 40)}`,
              },
              unit_amount: Math.round(numericFee * 100),
            },
            quantity: 1,
          },
        ],
        success_url: `${frontBase}/appointment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontBase}/appointment/cancel`,
        metadata: {
          appointmentId: String(created._id),
          doctorId: String(doctor._id),
          doctorName: base.doctorName,
          speciality: base.speciality,
          patientName: base.patientName,
          mobile: base.mobile,
          clerkUserId,
        },
      });
    } catch (stripeErr) {
      console.error("Stripe create session error:", stripeErr);

      await Appointment.findByIdAndDelete(created._id).catch(() => {});

      const message =
        stripeErr?.raw?.message || stripeErr?.message || "Stripe error";

      return res.status(502).json({
        success: false,
        message: `Payment provider error: ${message}`,
      });
    }

    created.sessionId = session.id;
    await created.save();

    return res.status(201).json({
      success: true,
      appointment: created,
      checkoutUrl: session.url || null,
    });
  } catch (error) {
    console.error("CreateAppointment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO CONFIRM PAYMENT
export const confirmPayment = async (req, res) => {
  try {
    const session_id = req.query.session_id ? String(req.query.session_id) : "";

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Session Id is required",
      });
    }

    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: "Stripe is not set up",
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

    const appt = await Appointment.findOneAndUpdate(
      { sessionId: session_id },
      {
        "payment.status": "Paid",
        "payment.providerId": session.payment_intent || "",
        status: "Confirmed",
        paidAt: new Date(),
      },
      { new: true }
    );

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found for this payment session",
      });
    }

    return res.json({
      success: true,
      message: "Payment confirmed successfully",
      appointment: appt,
    });
  } catch (error) {
    console.error("ConfirmPayment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO UPDATE AN APPOINTMENT
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment id",
      });
    }

    const body = req.body || {};
    const appt = await Appointment.findById(id);

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const terminal = appt.status === "Completed" || appt.status === "Canceled";

    if (terminal && body.status && body.status !== appt.status) {
      return res.status(400).json({
        success: false,
        message: "Cannot change status of a completed/canceled appointment",
      });
    }

    const update = {};

    if (body.status) update.status = body.status;
    if (body.notes !== undefined) update.notes = body.notes;

    if (body.date && body.time) {
      if (terminal) {
        return res.status(400).json({
          success: false,
          message: "Cannot reschedule a completed/canceled appointment",
        });
      }

      const conflict = await findSlotConflict({
        doctorId: appt.doctorId,
        date: body.date,
        time: body.time,
        excludeId: appt._id,
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          message: "The new slot is already booked",
        });
      }

      update.date = String(body.date);
      update.time = String(body.time);
      update.status = "Rescheduled";
      update.rescheduledTo = {
        date: String(body.date),
        time: String(body.time),
      };
    }

    const updated = await Appointment.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    })
      .populate({ path: "doctorId", select: "name imageUrl" })
      .lean();

    return res.json({
      success: true,
      appointment: updated,
    });
  } catch (error) {
    console.error("UpdateAppointment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO CANCEL APPOINTMENT
export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment id",
      });
    }

    const appt = await Appointment.findById(id);

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    if (appt.status === "Completed") {
      return res.status(400).json({
        success: false,
        message: "A completed appointment cannot be canceled",
      });
    }

    if (appt.status !== "Canceled") {
      appt.status = "Canceled";
      await appt.save();
    }

    return res.json({
      success: true,
      appointment: appt,
    });
  } catch (error) {
    console.error("CancelAppointment Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// TO GET STATS
export const getStats = async (req, res) => {
  try {
    const total = await Appointment.countDocuments();

    const paidAgg = await Appointment.aggregate([
      { $match: { "payment.status": "Paid" } },
      { $group: { _id: null, total: { $sum: "$fees" } } },
    ]);

    const revenue = (paidAgg[0] && paidAgg[0].total) || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recent = await Appointment.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    return res.json({
      success: true,
      stats: {
        total,
        revenue,
        recentLast7Days: recent,
      },
    });
  } catch (error) {
    console.error("GetStats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// GET APPOINTMENT BY DOCTOR
export const getAppointmentByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!doctorId || !isValidId(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "A valid doctor id is required",
      });
    }

    const {
      mobile,
      status,
      search = "",
      limit: limitRaw = 50,
      page: pageRaw = 1,
    } = req.query;

    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));

    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = { doctorId };

    if (mobile) filter.mobile = String(mobile);
    if (status) filter.status = String(status);

    if (search) {
      const re = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ patientName: re }, { mobile: re }, { notes: re }];
    }

    const items = await Appointment.find(filter)
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limit)
      .populate("doctorId", "name specialization imageUrl")
      .lean();

    const total = await Appointment.countDocuments(filter);

    return res.json({
      success: true,
      appointments: items,
      appointment: items,
      meta: {
        page,
        limit,
        total,
        count: items.length,
      },
    });
  } catch (error) {
    console.error("GetAppointmentByDoctor Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// GET REGISTERED USER COUNT (Medicare patients)
export const getRegisteredUserCount = async (req, res) => {
  try {
    const totalUsers = await clerkClient.users.getCount();

    return res.json({
      success: true,
      totalUsers,
    });
  } catch (error) {
    console.error("GetRegisteredUserCount Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
