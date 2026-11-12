"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { listPageStyles as s } from "@/app/assets/dummyStyles.js";
import { Calendar, Phone, Search, X } from "lucide-react";
import Image from "next/image.js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const STORAGE_KEY = "doctorToken_v1";
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

function getStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function authHeaders(extra = {}) {
  const token = getStoredToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function httpErrorMessage(status, body, fallback, forbidden) {
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403)
    return forbidden || "You don't have permission to do that.";
  return body?.message || `${fallback} (${status})`;
}

const formatNaira = (v) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateTime(date, time) {
  const t = new Date(`${date}T${time || "00:00"}:00`).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatTimeAMPM(time24) {
  if (!time24) return "";
  const [hh, mm] = time24.split(":");
  let h = parseInt(hh, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${mm} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function to24HourFromMaybe12(timeStr) {
  if (!timeStr) return "00:00";
  const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return timeStr;
  let hh = Number(m[1]);
  const mm = m[2];
  const ampm = m[3];
  if (!ampm) return `${String(hh).padStart(2, "0")}:${mm}`;
  const up = ampm.toUpperCase();
  if (up === "AM") {
    if (hh === 12) hh = 0;
  } else if (hh !== 12) {
    hh += 12;
  }
  return `${String(hh).padStart(2, "0")}:${mm}`;
}

function to12HourFrom24(hhmm, padHour = true) {
  if (!hhmm) return "12:00 AM";
  const [hh, mm] = hhmm.split(":").map(Number);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const hour = padHour ? String(h12).padStart(2, "0") : String(h12);
  return `${hour}:${String(mm).padStart(2, "0")} ${ampm}`;
}

function backendToFrontendStatus(status) {
  if (!status) return "pending";
  const v = String(status).toLowerCase();
  if (v === "pending") return "pending";
  if (v === "confirmed") return "confirmed";
  if (v === "completed" || v === "complete") return "complete";
  if (v === "canceled" || v === "cancelled") return "cancelled";
  if (v === "rescheduled") return "rescheduled";
  return v;
}

function frontendToBackendStatus(fs) {
  if (!fs) return "Pending";
  const v = String(fs).toLowerCase();
  if (v === "pending") return "Pending";
  if (v === "confirmed") return "Confirmed";
  if (v === "complete") return "Completed";
  if (v === "cancelled") return "Canceled";
  if (v === "rescheduled") return "Rescheduled";
  return fs;
}

function normalizeAppointment(a) {
  if (!a) return null;
  const id = a._id || a.id || String(Math.random()).slice(2);
  const patient = a.patientName || a.patient || a.name || "Unknown";
  const age = a.age ?? a.patientAge ?? "";
  const gender = a.gender || "";
  const mobile = a.mobile || a.phone || "";
  const fee = Number(a.fees ?? a.fee ?? a.payment?.amount ?? 0) || 0;

  const populated =
    a.doctorId && typeof a.doctorId === "object" ? a.doctorId : null;

  const doctorName = populated?.name || a.doctorName || a.doctor || "";
  const doctorImage =
    populated?.imageUrl ||
    a.doctorImage?.url ||
    (typeof a.doctorImage === "string" ? a.doctorImage : "") ||
    a.doctorImageUrl ||
    "";
  const speciality =
    populated?.specialization ||
    populated?.speciality ||
    a.speciality ||
    a.specialization ||
    "";

  const date = String(a.date || (a.slot && a.slot.date) || "").slice(0, 10);
  const rawTime =
    a.time ||
    (a.slot && a.slot.time) ||
    (a.hour != null
      ? `${String(a.hour).padStart(2, "0")}:${String(a.minute || 0).padStart(
          2,
          "0"
        )}`
      : "");
  const time = to24HourFromMaybe12(rawTime);
  const status = backendToFrontendStatus(
    a.status || a.payment?.status || "pending"
  );
  return {
    id,
    patient,
    age,
    gender,
    mobile,
    doctorName,
    doctorImage,
    speciality,
    date,
    time,
    fee,
    status,
    raw: a,
  };
}

function mergeAppointment(prev, updated, fallbackBackendStatus) {
  const patch = updated && typeof updated === "object" ? updated : {};
  const mergedRaw = { ...(prev.raw || {}), ...patch };
  if (!patch.status) mergedRaw.status = fallbackBackendStatus;
  return { ...normalizeAppointment(mergedRaw), id: prev.id };
}

function Avatar({ src, name }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={s.cardAvatarFallback}>{(name || "D").charAt(0)}</div>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className={s.cardAvatarImage}
    />
  );
}

function StatusBadge({ status }) {
  const base = s.statusBadgeBase;
  if (status === "complete")
    return (
      <span className={`${base} ${s.statusBadgeComplete}`}>Completed</span>
    );
  if (status === "cancelled")
    return (
      <span className={`${base} ${s.statusBadgeCancelled}`}>Cancelled</span>
    );
  if (status === "confirmed")
    return (
      <span className={`${base} ${s.statusBadgeConfirmed}`}>Confirmed</span>
    );
  if (status === "rescheduled")
    return (
      <span className={`${base} ${s.statusBadgeRescheduled}`}>Rescheduled</span>
    );
  return <span className={`${base} ${s.statusBadgePending}`}>Pending</span>;
}

function StatusSelect({ appointment, onChange }) {
  const terminal =
    appointment.status === "complete" || appointment.status === "cancelled";

  if (appointment.status === "rescheduled") {
    return (
      <select
        value={appointment.status}
        onChange={(e) => onChange(e.target.value)}
        className={`${s.statusSelect} ${s.statusSelectEnabled}`}
        title="After reschedule you can mark Completed or Cancelled"
      >
        <option value="rescheduled" disabled>
          Rescheduled
        </option>
        <option value="complete">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    );
  }

  const options = [
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "complete", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <select
      value={appointment.status}
      onChange={(e) => onChange(e.target.value)}
      disabled={terminal}
      className={`${s.statusSelect} ${
        terminal ? s.statusSelectDisabled : s.statusSelectEnabled
      }`}
      title={terminal ? "Status cannot be changed" : "Change status"}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="text-sm">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function RescheduleButton({ appointment, onReschedule }) {
  const terminal =
    appointment.status === "complete" || appointment.status === "cancelled";
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const today = getTodayISO();
    const apptDate = appointment.date
      ? String(appointment.date).slice(0, 10)
      : "";
    setDate(apptDate && apptDate >= today ? apptDate : today);
    setTime(appointment.time || "09:00");
    setFormError("");
  }, [appointment.date, appointment.time]);

  function save() {
    if (!date || !time) {
      setFormError("Choose a date and time.");
      return;
    }
    const picked = new Date(`${date}T${time}:00`);
    if (Number.isNaN(picked.getTime()) || picked.getTime() <= Date.now()) {
      setFormError("Choose a future date and time.");
      return;
    }
    setFormError("");
    onReschedule(date, time);
    setEditing(false);
  }

  function cancel() {
    const today = getTodayISO();
    const apptDate = appointment.date
      ? String(appointment.date).slice(0, 10)
      : "";
    setDate(apptDate && apptDate >= today ? apptDate : today);
    setTime(appointment.time || "09:00");
    setFormError("");
    setEditing(false);
  }

  return (
    <div className="w-full">
      {!editing ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={terminal}
            title={
              terminal ? "Cannot reschedule completed/cancelled" : "Reschedule"
            }
            className={`${s.rescheduleButton} ${
              terminal ? s.rescheduleButtonDisabled : s.rescheduleButtonEnabled
            }`}
          >
            Reschedule
          </button>
        </div>
      ) : (
        <div className={s.rescheduleForm}>
          <input
            type="date"
            value={date}
            min={getTodayISO()}
            onChange={(e) => setDate(e.target.value)}
            className={s.dateInput}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={s.timeInput}
          />
          {formError && (
            <p className="text-xs text-rose-600" role="alert">
              {formError}
            </p>
          )}
          <div className={s.rescheduleButtons}>
            <button type="button" onClick={save} className={s.saveButton}>
              Save
            </button>
            <button type="button" onClick={cancel} className={s.cancelButton}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ListPage = () => {
  const params = useParams();
  const doctorId = params?.id;

  const [appointments, setAppointments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadIdRef = useRef(0);

  const fetchAppointments = useCallback(async () => {
    const myLoad = ++loadIdRef.current;
    const stale = () => myLoad !== loadIdRef.current;

    if (!doctorId) {
      setLoading(false);
      return;
    }

    if (!getStoredToken()) {
      setError("Please log in as a doctor to view appointments.");
      setAppointments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const all = [];
      let page = 1;

      while (page <= MAX_PAGES) {
        const res = await fetch(
          `${API_BASE}/api/appointments/doctor/${encodeURIComponent(
            doctorId
          )}?limit=${PAGE_SIZE}&page=${page}`,
          { headers: authHeaders() }
        );
        if (stale()) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            httpErrorMessage(
              res.status,
              body,
              "Failed to fetch appointments",
              "You can only view your own appointments."
            )
          );
        }

        const body = await res.json();
        if (stale()) return;

        const list = Array.isArray(body.appointments)
          ? body.appointments
          : Array.isArray(body)
          ? body
          : body.items ?? body.data ?? [];
        const rows = Array.isArray(list) ? list : [];

        all.push(...rows);

        const total = body?.meta?.total ?? all.length;
        if (rows.length === 0 || all.length >= total) break;
        page += 1;
      }

      setAppointments(all.map(normalizeAppointment).filter(Boolean));
    } catch (err) {
      if (stale()) return;
      console.error("fetchAppointments:", err);
      setError(err.message || "Failed to load appointments");
      setAppointments([]);
    } finally {
      if (!stale()) setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    fetchAppointments();
    return () => {
      loadIdRef.current += 1;
    };
  }, [fetchAppointments]);

  async function updateStatusRemote(id, newStatus) {
    const appt = appointments.find((p) => p.id === id);
    if (!appt) return;
    if (appt.status === "complete" || appt.status === "cancelled") return;
    if (newStatus === appt.status) return;

    const backendStatus = frontendToBackendStatus(newStatus);

    setActionError(null);
    setAppointments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );

    try {
      const res = await fetch(`${API_BASE}/api/appointments/${id}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status: backendStatus }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          httpErrorMessage(res.status, body, "Status update failed")
        );
      }
      const updated = body.appointment || body;

      setAppointments((prev) =>
        prev.map((p) =>
          p.id === id ? mergeAppointment(p, updated, backendStatus) : p
        )
      );
    } catch (err) {
      console.error("updateStatusRemote:", err);
      setAppointments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: appt.status } : p))
      );
      setActionError(err.message || "Failed to update status");
    }
  }

  async function rescheduleRemote(id, newDate, newTime24) {
    const appt = appointments.find((p) => p.id === id);
    if (!appt) return;
    if (appt.status === "complete" || appt.status === "cancelled") return;

    const sample = String(appt.raw?.time || "");
    const time12 = to12HourFrom24(newTime24, !/^\d:/.test(sample));

    setActionError(null);
    setAppointments((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, date: newDate, time: newTime24, status: "rescheduled" }
          : p
      )
    );

    try {
      const res = await fetch(`${API_BASE}/api/appointments/${id}`, {
        method: "PUT",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ date: newDate, time: time12 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          httpErrorMessage(res.status, body, "Reschedule failed")
        );
      }
      const updated = body.appointment || body;

      setAppointments((prev) =>
        prev.map((p) =>
          p.id === id ? mergeAppointment(p, updated, "Rescheduled") : p
        )
      );
    } catch (err) {
      console.error("rescheduleRemote:", err);
      setActionError(err.message || "Failed to reschedule");
      await fetchAppointments();
    }
  }

  function updateStatus(id, newStatus) {
    const appt = appointments.find((p) => p.id === id);
    if (!appt) return;

    if (newStatus === "cancelled" || newStatus === "complete") {
      const action = newStatus === "cancelled" ? "cancel" : "mark as completed";
      const ok = window.confirm(
        `Are you sure you want to ${action} the appointment for ${appt.patient}? This can't be changed afterwards.`
      );
      if (!ok) return;
    }

    updateStatusRemote(id, newStatus);
  }

  function updateDateTime(id, newDate, newTime) {
    rescheduleRemote(id, newDate, newTime);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...appointments]
      .filter((a) => (q ? (a.patient || "").toLowerCase().includes(q) : true))
      .filter((a) => (statusFilter ? a.status === statusFilter : true))
      .sort(
        (a, b) => parseDateTime(b.date, b.time) - parseDateTime(a.date, a.time)
      );
  }, [appointments, search, statusFilter]);

  return (
    <div className={s.pageContainer}>
      <div className={s.contentWrapper}>
        <div className={s.headerContainer}>
          <div>
            <h1 className={s.headerTitle}>All Appointments</h1>
            <p className={s.headerSubtitle}>
              View the latest appointments first and quickly find bookings by
              patient name.
            </p>
          </div>

          <div className={s.searchFilterContainer}>
            <div className={s.searchContainer}>
              <div className={s.searchIconContainer}>
                <Search className={s.searchIcon} />
              </div>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={s.searchInput}
                placeholder="Search Patient name"
              />

              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className={s.clearSearchButton}
                >
                  <X className={s.clearSearchIcon} />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={s.statusFilter}
              title="Filter by status"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="complete">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {actionError && (
          <div className="mt-4 text-sm text-rose-600" role="alert">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className={s.loadingContainer}>Loading Appointments</div>
        ) : error ? (
          <div className={s.errorContainer}> Error: {error} </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 text-center text-sm text-gray-500">
            No appointments found.
          </div>
        ) : (
          <div className={s.appointmentsGrid}>
            {filtered.map((a) => {
              const patientMeta = [a.age ? `${a.age} yrs` : "", a.gender]
                .filter(Boolean)
                .join(" · ");

              return (
                <article key={a.id} className={s.appointmentCard}>
                  <header className={s.cardHeader}>
                    <div className={s.cardAvatar}>
                      <Avatar
                        key={a.doctorImage}
                        src={a.doctorImage}
                        name={a.doctorName}
                      />
                    </div>

                    <div className={s.cardContent}>
                      <div className={s.cardPatientName}>{a.patient}</div>
                      <div className={s.cardPatientInfo}>{patientMeta}</div>
                      <div className={s.cardDoctorInfo}>
                        <span className={s.cardDoctorName}>{a.doctorName}</span>
                      </div>

                      <div className={s.cardSpeciality}>{a.speciality}</div>
                    </div>
                  </header>

                  <div className={s.dateTimeSection}>
                    <div className={s.dateTimeContainer}>
                      <Calendar className={s.calendarIcon} />
                      <span className={s.dateText}>{formatDate(a.date)}</span>
                      <span className="hidden sm:inline">:</span>
                      <span>{formatTimeAMPM(a.time)}</span>
                    </div>
                    <div className={s.feeText}>{formatNaira(a.fee)}</div>
                  </div>

                  <div className={s.contactStatusSection}>
                    <div className={s.phoneContainer}>
                      <Phone className={s.phoneIcon} />
                      <span className={s.phoneNumber}>{a.mobile}</span>
                    </div>

                    <div className={s.statusContainer}>
                      <StatusBadge status={a.status} />
                      <StatusSelect
                        appointment={a}
                        onChange={(next) => updateStatus(a.id, next)}
                      />
                    </div>
                  </div>

                  <div className={s.rescheduleContainer}>
                    <RescheduleButton
                      appointment={a}
                      onReschedule={(d, t) => updateDateTime(a.id, d, t)}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListPage;
