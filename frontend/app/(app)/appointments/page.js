"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Footer from "@/app/component/Footer.js";
import Navbar from "@/app/component/Navbar.js";
import {
  appointmentPageStyles as s,
  cardStyles,
  badgeStyles,
  iconSize,
} from "@/app/assets/dummyStyles.js";
import axios from "axios";
import {
  Bell,
  CalendarDays,
  CheckCircle,
  Clock,
  CreditCard,
  Wallet,
  XCircle,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API = axios.create({ baseURL: API_BASE });

const DOCTOR_PLACEHOLDER = "/placeholder-doctor.jpg";
const SERVICE_PLACEHOLDER = "/placeholder-service.jpg";

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function pad(n) {
  return String(n ?? 0).padStart(2, "0");
}

const formatNaira = (v) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

// "2026-11-05" (or "05 Nov 2026") + "10:30 AM" -> local Date, or null
function parseDateTime(dateStr, timeStr) {
  let y;
  let m;
  let d;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ""));
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]) - 1;
    d = Number(iso[3]);
  } else {
    const parts = String(dateStr || "")
      .trim()
      .split(/\s+/);
    const month =
      parts.length === 3
        ? MONTHS[parts[1].slice(0, 3).toLowerCase()]
        : undefined;
    if (month === undefined) return null;
    d = Number(parts[0]);
    m = month;
    y = Number(parts[2]);
  }

  let hh = 0;
  let mm = 0;
  const t = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(
    String(timeStr || "").trim()
  );
  if (t) {
    hh = Number(t[1]);
    mm = Number(t[2]);
    const ap = (t[3] || "").toUpperCase();
    if (ap === "PM" && hh !== 12) hh += 12;
    if (ap === "AM" && hh === 12) hh = 0;
  }

  const out = new Date(y, m, d, hh, mm);
  return Number.isNaN(out.getTime()) ? null : out;
}

function formatDate(dateStr) {
  const dt = parseDateTime(dateStr, "");
  if (!dt) return dateStr || "";
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function computeStatus(item) {
  if (!item) return "Pending";
  const now = new Date();

  if (item.status === "Canceled") return "Canceled";
  if (item.status === "Completed") return "Completed";

  if (item.status === "Rescheduled") {
    const dt = item.rescheduledTo
      ? parseDateTime(item.rescheduledTo.date, item.rescheduledTo.time)
      : null;
    return dt && now >= dt ? "Completed" : "Rescheduled";
  }

  const dt = parseDateTime(item.date, item.time);
  const past = dt ? now >= dt : false;

  if (item.status === "Confirmed") return past ? "Completed" : "Confirmed";
  return past ? "Completed" : "Pending";
}

function byLatest(a, b) {
  const ta = parseDateTime(a.date, a.time)?.getTime() ?? -Infinity;
  const tb = parseDateTime(b.date, b.time)?.getTime() ?? -Infinity;
  return tb - ta;
}

// Image fields can be a string or { url, publicId }
const pickUrl = (v) => (typeof v === "string" ? v : v?.url || "");

function normalizeRescheduled(rt) {
  if (!rt) return null;
  if (rt.date && rt.time) return { date: rt.date, time: rt.time };
  if (
    rt.date &&
    (rt.hour !== undefined || rt.minute !== undefined || rt.ampm)
  ) {
    const hour = rt.hour ?? 0;
    const minute = rt.minute ?? 0;
    const ampm = rt.ampm ?? "";
    return { date: rt.date, time: `${hour}:${pad(minute)} ${ampm}`.trim() };
  }
  if (!rt.date) return null;
  return { date: rt.date, time: rt.time || "" };
}

function buildTime(a) {
  if (a.time) return a.time;
  if (a.hour !== undefined && a.minute !== undefined && a.ampm) {
    return `${a.hour}:${pad(a.minute)} ${a.ampm}`;
  }
  if (a.hour !== undefined && a.ampm) return `${a.hour}:00 ${a.ampm}`;
  return "";
}

function errorMessage(err, fallback) {
  if (err?.response) {
    if (err.response.status === 401) {
      return "Your session has expired. Please sign in again.";
    }
    return err.response.data?.message || fallback;
  }
  return err?.message || fallback;
}

function CardImage({ src, alt, fallback, className }) {
  const [failed, setFailed] = useState(false);

  return (
    <img
      src={failed || !src ? fallback : src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

const PaymentBadge = ({ payment }) => {
  return payment === "Online" ? (
    <span className={badgeStyles.paymentBadge.online}>
      <CreditCard className={iconSize.small} /> Online
    </span>
  ) : (
    <span className={badgeStyles.paymentBadge.cash}>
      <Wallet className={iconSize.small} /> Cash
    </span>
  );
};

const StatusBadge = ({ itemStatus }) => {
  if (itemStatus === "Completed")
    return (
      <span className={badgeStyles.statusBadge.completed}>
        <CheckCircle className={iconSize.small} /> Completed
      </span>
    );

  if (itemStatus === "Confirmed")
    return (
      <span className={badgeStyles.statusBadge.confirmed}>
        <Bell className={iconSize.small} /> Confirmed
      </span>
    );

  if (itemStatus === "Pending")
    return (
      <span className={badgeStyles.statusBadge.pending}>
        <Clock className={iconSize.small} /> Pending
      </span>
    );

  if (itemStatus === "Canceled")
    return (
      <span className={badgeStyles.statusBadge.canceled}>
        <XCircle className={iconSize.small} /> Canceled
      </span>
    );

  return (
    <span className={badgeStyles.statusBadge.default}>
      <CalendarDays className={iconSize.small} /> Rescheduled
    </span>
  );
};

const Page = () => {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingServices, setLoadingServices] = useState(false);

  const [doctorAppts, setDoctorAppts] = useState([]);
  const [serviceAppts, setServiceAppts] = useState([]);

  const [doctorError, setDoctorError] = useState(null);
  const [serviceError, setServiceError] = useState(null);

  const loadDoctorAppointments = useCallback(async () => {
    setLoadingDoctors(true);
    setDoctorError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");

      const resp = await API.get("/api/appointments/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fetched = resp?.data?.appointments ?? resp?.data?.data ?? [];
      setDoctorAppts(Array.isArray(fetched) ? fetched : []);
    } catch (err) {
      console.error(
        "Error loading doctor appointments:",
        err?.response?.data || err?.message || err
      );
      setDoctorError(errorMessage(err, "Failed to load doctor appointments."));
      setDoctorAppts([]);
    } finally {
      setLoadingDoctors(false);
    }
  }, [getToken]);

  const loadServiceAppointments = useCallback(async () => {
    setLoadingServices(true);
    setServiceError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");

      const resp = await API.get("/api/service-appointments/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fetched = resp?.data?.data ?? resp?.data?.appointments ?? [];
      setServiceAppts(Array.isArray(fetched) ? fetched : []);
    } catch (err) {
      console.error(
        "Error loading service appointments:",
        err?.response?.data || err?.message || err
      );
      setServiceError(errorMessage(err, "Failed to load service bookings."));
      setServiceAppts([]);
    } finally {
      setLoadingServices(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadDoctorAppointments();
    loadServiceAppointments();
  }, [isLoaded, isSignedIn, loadDoctorAppointments, loadServiceAppointments]);

  const appointmentData = useMemo(() => {
    return doctorAppts
      .map((a) => {
        const id = a._id || a.id || "";
        const doctorObj =
          a.doctorId && typeof a.doctorId === "object" ? a.doctorId : {};

        const image =
          doctorObj.imageUrl ||
          pickUrl(doctorObj.image) ||
          pickUrl(doctorObj.avatar) ||
          pickUrl(a.doctorImage);

        const doctor =
          String(doctorObj.name || a.doctorName || a.doctor || "").trim() ||
          "Doctor";

        const specialization =
          doctorObj.specialization || a.specialization || a.speciality || "";
        const experience = doctorObj.experience || a.experience || "";

        const payment = (a.payment && a.payment.method) || "Cash";
        const status =
          a.status ||
          (a.payment && a.payment.status === "Paid" ? "Confirmed" : "Pending");

        const rescheduledTo = normalizeRescheduled(
          a.rescheduledTo || {
            date: a.rescheduledDate,
            time: a.rescheduledTime,
          }
        );

        return {
          id,
          image,
          doctor,
          specialization,
          experience,
          date: a.date || "",
          time: buildTime(a),
          payment,
          status,
          rescheduledTo,
        };
      })
      .map((x) => ({ ...x, status: computeStatus(x) }))
      .sort(byLatest);
  }, [doctorAppts]);

  const serviceData = useMemo(() => {
    return serviceAppts
      .map((appt) => {
        const id = appt._id || appt.id || "";
        const svc =
          appt.serviceId && typeof appt.serviceId === "object"
            ? appt.serviceId
            : {};

        const image =
          svc.imageUrl ||
          pickUrl(svc.image) ||
          pickUrl(svc.imageSmall) ||
          pickUrl(appt.serviceImage);

        const name = appt.serviceName || svc.name || svc.title || "Service";
        const price = appt.fees ?? appt.amount ?? appt.price ?? 0;

        const payment = (appt.payment && appt.payment.method) || "Cash";
        const status =
          appt.status ||
          (appt.payment && appt.payment.status === "Paid"
            ? "Confirmed"
            : "Pending");

        return {
          id,
          image,
          name,
          price,
          date: appt.date || "",
          time: buildTime(appt),
          payment,
          status,
          rescheduledTo: normalizeRescheduled(appt.rescheduledTo || null),
        };
      })
      .map((x) => ({ ...x, status: computeStatus(x) }))
      .sort(byLatest);
  }, [serviceAppts]);

  let content;

  if (!isLoaded) {
    content = <div className={s.loadingText}>Loading...</div>;
  } else if (!isSignedIn) {
    content = (
      <div className={s.emptyStateText}>
        Please sign in to view your appointments.
      </div>
    );
  } else {
    content = (
      <>
        <h1 className={s.doctorTitle}>Your Doctor Appointments</h1>

        {loadingDoctors && (
          <div className={s.loadingText}>Loading Doctors...</div>
        )}

        {doctorError && (
          <div className="mt-4 text-sm text-rose-600" role="alert">
            {doctorError}
          </div>
        )}

        {!loadingDoctors && !doctorError && appointmentData.length === 0 && (
          <div className={s.emptyStateText}>No doctor appointments found.</div>
        )}

        <div className={s.doctorGrid}>
          {appointmentData.map((item) => {
            const experienceText = item.experience
              ? /^\d+$/.test(String(item.experience))
                ? `${item.experience} yrs`
                : String(item.experience)
              : "";
            const subtitle = [item.specialization, experienceText]
              .filter(Boolean)
              .join(" • ");

            return (
              <div key={item.id} className={cardStyles.doctorCard}>
                <div className={cardStyles.doctorImageContainer}>
                  <CardImage
                    key={item.image}
                    src={item.image}
                    alt={item.doctor}
                    fallback={DOCTOR_PLACEHOLDER}
                    className={cardStyles.image}
                  />
                </div>

                <h2 className={cardStyles.doctorName}>{item.doctor}</h2>
                <div className={cardStyles.specialization}>{subtitle}</div>

                <p className={cardStyles.dateContainer}>
                  <CalendarDays className={iconSize.medium} />
                  {formatDate(item.date)}
                </p>
                <p className={cardStyles.timeContainer}>
                  <Clock className={iconSize.medium} />
                  {item.time}
                </p>

                <div className={cardStyles.badgesContainer}>
                  <PaymentBadge payment={item.payment} />
                  <StatusBadge itemStatus={item.status} />
                </div>

                {item.status === "Rescheduled" && item.rescheduledTo ? (
                  <div className={cardStyles.rescheduledText}>
                    Rescheduled to{" "}
                    <span className={cardStyles.rescheduledSpan}>
                      {formatDate(item.rescheduledTo.date)} :{" "}
                      {item.rescheduledTo.time}
                    </span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <h2 className={s.serviceTitle}>Your Service Bookings</h2>

        {loadingServices && (
          <div className={s.serviceLoadingText}>
            Loading Service Bookings...
          </div>
        )}

        {serviceError && (
          <div className="mt-4 text-sm text-rose-600" role="alert">
            {serviceError}
          </div>
        )}

        {!loadingServices && !serviceError && serviceData.length === 0 && (
          <div className={s.serviceEmptyStateText}>
            No service bookings found.
          </div>
        )}

        <div className={s.serviceGrid}>
          {serviceData.map((srv) => (
            <div key={srv.id} className={cardStyles.serviceCard}>
              <div className={cardStyles.serviceImageContainer}>
                <CardImage
                  key={srv.image}
                  src={srv.image}
                  alt={srv.name}
                  fallback={SERVICE_PLACEHOLDER}
                  className={cardStyles.image}
                />
              </div>

              <h3 className={cardStyles.serviceName}>{srv.name}</h3>

              <p className={cardStyles.price}>
                {srv.price ? formatNaira(srv.price) : "Free"}
              </p>

              <p className={cardStyles.serviceDateContainer}>
                <CalendarDays className={iconSize.medium} />{" "}
                {formatDate(srv.date)}
              </p>

              <p className={cardStyles.serviceTimeContainer}>
                <Clock className={iconSize.medium} /> {srv.time}
              </p>

              <div className={cardStyles.badgesContainer}>
                <PaymentBadge payment={srv.payment} />
                <StatusBadge itemStatus={srv.status} />
              </div>

              {srv.status === "Rescheduled" && srv.rescheduledTo ? (
                <div className={cardStyles.serviceRescheduledText}>
                  Rescheduled to{" "}
                  <span className={cardStyles.rescheduledSpan}>
                    {formatDate(srv.rescheduledTo.date)} :{" "}
                    {srv.rescheduledTo.time}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div>
      <Navbar />

      <div className={s.pageContainer}>
        <div className={s.maxWidthContainer}>{content}</div>
      </div>

      <Footer />
    </div>
  );
};

export default Page;
