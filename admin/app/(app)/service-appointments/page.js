"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { serviceAppointmentsStyles as s } from "@/app/assets/dummyStyles.js";
import {
  Banknote,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  Phone,
  SearchIcon,
  User,
  XCircle,
  XIcon,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 200;
const MAX_PAGES = 20;

function formatTwo(n) {
  return String(n).padStart(2, "0");
}

function formatNaira(v) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);
}

function formatDateNice(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseTimeToParts(timeStr) {
  if (!timeStr) return { hour: 12, minute: 0, ampm: "AM" };
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    const ampm = m[3] ? m[3].toUpperCase() : null;
    if (!ampm) {
      const hour12 = hh % 12 === 0 ? 12 : hh % 12;
      return { hour: hour12, minute: mm, ampm: hh >= 12 ? "PM" : "AM" };
    }
    return { hour: hh, minute: mm, ampm };
  }
  return { hour: 12, minute: 0, ampm: "AM" };
}

function timePartsToInputValue(a) {
  const hour = Number(a.hour || 0);
  const minute = Number(a.minute || 0);
  const ampm = (a.ampm || "AM").toUpperCase();
  let hh24 = hour % 12;
  if (ampm === "PM") hh24 += 12;
  return `${formatTwo(hh24)}:${formatTwo(minute)}`;
}

function formatTimeDisplay(a) {
  return `${formatTwo(a.hour)}:${formatTwo(a.minute)} ${a.ampm}`;
}

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${formatTwo(d.getMonth() + 1)}-${formatTwo(
    d.getDate()
  )}`;
}

function isDateBefore(aDateStr, bDateStr) {
  try {
    const a = new Date(`${aDateStr}T00:00:00`);
    const b = new Date(`${bDateStr}T00:00:00`);
    return a.getTime() < b.getTime();
  } catch {
    return false;
  }
}

function normalizeAppointment(a) {
  const hasParts = a.hour !== undefined && a.minute !== undefined;
  const parts = hasParts
    ? {
        hour: Number(a.hour) || 12,
        minute: Number(a.minute) || 0,
        ampm: String(a.ampm || "AM").toUpperCase(),
      }
    : parseTimeToParts(a.time || (a.slot && a.slot.time) || "");

  return {
    id: a._id || a.id,
    patientName: a.patientName || a.name || "Unknown",
    gender: a.gender || "",
    mobile: a.mobile || a.phone || "",
    age: a.age || "",
    serviceName:
      a.serviceName ||
      (a.serviceId && typeof a.serviceId === "object" && a.serviceId.name) ||
      a.service ||
      "",
    fees: a.fees ?? a.fee ?? a.payment?.amount ?? 0,
    date: a.date || (a.slot && a.slot.date) || "",
    hour: parts.hour,
    minute: parts.minute,
    ampm: parts.ampm,
    status: a.status || (a.payment && a.payment.status) || "Pending",
    raw: a,
  };
}


function mergeUpdated(prev, updated, fallbackStatus) {
  if (!updated || typeof updated !== "object" || !updated._id) {
    return { ...prev, status: fallbackStatus || prev.status };
  }
  const next = normalizeAppointment({ ...prev.raw, ...updated });
  return {
    ...next,
    id: prev.id,
    status: updated.status || fallbackStatus || prev.status,
  };
}

function StatusBadge({ status }) {
  return (
    <span className={s.statusBadge(status)}>
      {status === "Confirmed" && <CheckCircle className="h-4 w-4" />}
      {status === "Canceled" && <XCircle className="h-4 w-4" />}
      {status}
    </span>
  );
}

function Toast({ toasts, removeToast }) {
  return (
    <div className={s.toastContainer}>
      {toasts.map((t) => (
        <div key={t.id} className={s.toast}>
          <div className={s.toastContent}>
            <div className="mt-0.5">
              <Loader2 className={s.toastSpinner} />
            </div>
            <div className={s.toastText}>
              <div className={s.toastTitle}>{t.title}</div>
              <div className={s.toastMessage}>{t.message}</div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className={s.toastCloseButton}
              aria-label="close toast"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusSelect({ appointment, onChange, disabled }) {
  const terminal =
    appointment.status === "Completed" || appointment.status === "Canceled";

  const options = ["Pending", "Confirmed", "Completed", "Canceled"];
  if (appointment.status === "Rescheduled") options.splice(2, 0, "Rescheduled");

  return (
    <select
      value={appointment.status}
      onChange={(e) => onChange(e.target.value)}
      disabled={terminal || disabled}
      className={s.statusSelect(terminal)}
      title={terminal ? "Status cannot be changed" : "Change status"}
    >
      {options.map((opt) => (
        <option key={opt} value={opt} disabled={opt === "Rescheduled"}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function RescheduleButton({ appointment, onReschedule, disabled }) {
  const terminal =
    appointment.status === "Completed" || appointment.status === "Canceled";
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(appointment.date || getTodayISO());
  const [time, setTime] = useState(timePartsToInputValue(appointment));

  useEffect(() => {
    const todayISO = getTodayISO();
    const baseDate = appointment.date || "";
    setDate(
      baseDate && !isDateBefore(baseDate, todayISO) ? baseDate : todayISO
    );
    setTime(timePartsToInputValue(appointment));
  }, [
    appointment.date,
    appointment.hour,
    appointment.minute,
    appointment.ampm,
  ]);

  function save() {
    if (!date || !time) return;
    const picked = new Date(`${date}T${time}:00`);
    if (Number.isNaN(picked.getTime()) || picked.getTime() <= Date.now()) {
      alert("Please choose a future date and time for rescheduling.");
      return;
    }
    onReschedule(date, time);
    setEditing(false);
  }

  function cancel() {
    const todayISO = getTodayISO();
    const baseDate = appointment.date || "";
    setDate(
      baseDate && !isDateBefore(baseDate, todayISO) ? baseDate : todayISO
    );
    setTime(timePartsToInputValue(appointment));
    setEditing(false);
  }

  return (
    <div className="w-full">
      {!editing ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={terminal || disabled}
            title={
              terminal ? "Cannot reschedule completed/canceled" : "Reschedule"
            }
            className={s.rescheduleButton(terminal)}
          >
            Reschedule
          </button>
        </div>
      ) : (
        <div className={s.rescheduleEditContainer}>
          <input
            type="date"
            value={date}
            min={getTodayISO()}
            onChange={(e) => setDate(e.target.value)}
            className={s.rescheduleDateInput}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={s.rescheduleTimeInput}
          />
          <div className={s.rescheduleActions}>
            <button
              type="button"
              onClick={save}
              className={s.rescheduleSaveButton}
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              className={s.rescheduleCancelButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const Page = () => {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [appointments, setAppointments] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 220);
    return () => clearTimeout(t);
  }, [search]);

  const [statusFilter, setStatusFilter] = useState("");

  const authFetch = useCallback(
    async (url, options = {}) => {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again");
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [getToken]
  );

  function pushToast(title, message) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      3000
    );
  }
  function removeToast(id) {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  const fetchAppointments = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const all = [];
        let page = 1;

        while (page <= MAX_PAGES) {
          const res = await authFetch(
            `${API_BASE}/api/service-appointments?limit=${PAGE_SIZE}&page=${page}`
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(
              body?.message || `Failed to fetch appointments (${res.status})`
            );
          }
          const body = await res.json();
          const list = Array.isArray(body.appointments)
            ? body.appointments
            : body.items ?? body.data ?? [];

          all.push(...(Array.isArray(list) ? list : []));

          const total = body?.meta?.total ?? all.length;
          if (list.length === 0 || all.length >= total) break;
          page += 1;
        }

        setAppointments(all.map(normalizeAppointment));
      } catch (err) {
        console.error("fetchAppointments:", err);
        setError(err.message || "Failed to load appointments");
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetchAppointments();
  }, [isLoaded, isSignedIn, fetchAppointments]);

  function extractUpdated(body) {
    return body?.data || body?.appointment || null;
  }

  async function changeStatusRemote(id, newStatus) {
    const old = appointments.find((a) => a.id === id);
    if (!old) return;
    if (old.status === "Completed" || old.status === "Canceled") {
      pushToast(
        "Cannot change status",
        `${old.patientName}'s appointment is already ${old.status}.`
      );
      return;
    }
    if (newStatus === old.status) return;
    if (newStatus === "Canceled") {
      cancelRemote(id);
      return;
    }

    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    );
    pushToast("Updating status", `${old.patientName} → ${newStatus}`);

    try {
      const res = await authFetch(
        `${API_BASE}/api/service-appointments/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message || `Status update failed (${res.status})`
        );
      }
      const body = await res.json();
      const updated = extractUpdated(body);

      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? mergeUpdated(a, updated, newStatus) : a))
      );
      pushToast("Status updated", `${old.patientName} is now ${newStatus}`);
    } catch (err) {
      console.error("changeStatusRemote:", err);
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: old.status } : a))
      );
      pushToast("Update failed", err.message || "Failed to update status");
    }
  }

  async function rescheduleRemote(id, dateStr, time24) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;

    const [hh, mm] = time24.split(":").map(Number);
    const hour12 = hh % 12 === 0 ? 12 : hh % 12;
    const ampm = hh >= 12 ? "PM" : "AM";
    const timeStr = `${formatTwo(hour12)}:${formatTwo(mm)} ${ampm}`;

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              date: dateStr,
              hour: hour12,
              minute: mm,
              ampm,
              status: "Rescheduled",
            }
          : a
      )
    );

    pushToast(
      "Rescheduling",
      `${appt.patientName} → ${formatDateNice(dateStr)} ${timeStr}`
    );

    try {
      const res = await authFetch(
        `${API_BASE}/api/service-appointments/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rescheduledTo: { date: dateStr, time: timeStr },
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Reschedule failed (${res.status})`);
      }
      const body = await res.json();
      const updated = extractUpdated(body);

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id ? mergeUpdated(a, updated, "Rescheduled") : a
        )
      );
      pushToast(
        "Rescheduled",
        `${appt.patientName} moved to ${formatDateNice(dateStr)} ${timeStr}`
      );
    } catch (err) {
      console.error("rescheduleRemote:", err);
      pushToast("Reschedule failed", err.message || "Failed to reschedule");
      await fetchAppointments({ silent: true });
    }
  }

  async function cancelRemote(id) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    if (appt.status === "Canceled" || appt.status === "Completed") return;
    if (
      !window.confirm(
        `Mark appointment for ${appt.patientName} on ${formatDateNice(
          appt.date
        )} as CANCELED?`
      )
    )
      return;

    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "Canceled" } : a))
    );
    pushToast(
      "Canceling",
      `${appt.patientName}'s appointment is being canceled`
    );

    try {
      const res = await authFetch(
        `${API_BASE}/api/service-appointments/${id}/cancel`,
        { method: "POST" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Cancel failed (${res.status})`);
      }
      const body = await res.json();
      const updated = extractUpdated(body);

      setAppointments((prev) =>
        prev.map((a) =>
          a.id === id ? mergeUpdated(a, updated, "Canceled") : a
        )
      );
      pushToast("Canceled", `${appt.patientName}'s appointment canceled`);
    } catch (err) {
      console.error("cancelRemote:", err);
      pushToast("Cancel failed", err.message || "Failed to cancel");
      await fetchAppointments({ silent: true });
    }
  }

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return appointments
      .filter((a) =>
        q
          ? (a.patientName || "").toLowerCase().includes(q) ||
            (a.serviceName || "").toLowerCase().includes(q) ||
            (a.mobile || "").toLowerCase().includes(q)
          : true
      )
      .filter((a) => (statusFilter ? a.status === statusFilter : true));
  }, [appointments, debouncedSearch, statusFilter]);

  function getTimestamp(a) {
    try {
      const [y, m, d] = (a.date || "1970-01-01").split("-").map(Number);
      let hour = Number(a.hour) || 0;
      if ((a.ampm || "AM") === "PM" && hour !== 12) hour += 12;
      if ((a.ampm || "AM") === "AM" && hour === 12) hour = 0;
      const minute = Number(a.minute) || 0;
      return new Date(y, (m || 1) - 1, d || 1, hour, minute).getTime();
    } catch {
      return 0;
    }
  }

  const displayList = useMemo(() => {
    const copy = filtered.slice();
    copy.sort((x, y) => getTimestamp(y) - getTimestamp(x));
    return copy;
  }, [filtered]);

  return (
    <div className={s.container}>
      <header className={s.headerContainer}>
        <div className={s.headerTitleContainer}>
          <h1 className={s.headerTitle}>Appointments</h1>
          <p className={s.headerSubtitle}>
            Manage patient appointments, search bookings, and update appointment
            statuses with ease.
          </p>
        </div>

        <div className={s.searchContainer}>
          <div className={s.searchInputWrapper}>
            <label className={s.searchLabel}>
              <span className="sr-only">Search Appointments</span>

              <div className="flex items-center gap-2 relative w-full">
                <div className={s.searchIconContainer}>
                  <SearchIcon className={s.searchIcon} />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by patient, service or mobile"
                  className={s.searchInput}
                />
                {search ? (
                  <button
                    type="button"
                    className={s.clearSearchButton}
                    onClick={() => setSearch("")}
                  >
                    <XIcon className={s.clearSearchIcon} />
                  </button>
                ) : null}
              </div>
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={s.statusFilterSelect}
              title="Filter by status"
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Rescheduled">Rescheduled</option>
              <option value="Completed">Completed</option>
              <option value="Canceled">Canceled</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div>
              {displayList.length} result{displayList.length !== 1 ? "s" : ""}
            </div>
            <div>
              <button
                type="button"
                onClick={() => fetchAppointments()}
                className={s.refreshButton}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <div className={s.loadingContainer}>
          <Loader2 className="animate-spin" />
          Loading appointments...
        </div>
      ) : error ? (
        <div className={s.errorContainer}>{error}</div>
      ) : (
        <div className={s.gridContainer}>
          {displayList.length === 0 ? (
            <div className={s.noResultsContainer}>
              <div className={s.noResultsIcon}>
                <SearchIcon />
              </div>
              <div className={s.noResultsText}>
                No appointments match your search
              </div>
              <div className={s.noResultsSubtext}>
                Try a different patient name or service
              </div>
            </div>
          ) : (
            displayList.map((a) => {
              const isLocked =
                a.status === "Completed" || a.status === "Canceled";
              const patientMeta = [a.gender, a.age ? `${a.age} yrs` : ""]
                .filter(Boolean)
                .join(" • ");

              return (
                <article key={a.id} className={s.article}>
                  <div className={s.cardInner}>
                    <div>
                      <div className={s.cardHeader}>
                        <div className={s.patientInfoContainer}>
                          <div className={s.patientAvatar}>
                            <User className={s.patientAvatarIcon} />
                          </div>

                          <div>
                            <div className={s.patientName}>{a.patientName}</div>
                            <div className={s.patientDetails}>
                              {patientMeta}
                            </div>
                          </div>
                        </div>

                        <div className={s.statusContainer}>
                          <StatusBadge status={a.status} />
                          <div className="mt-1">
                            <StatusSelect
                              appointment={a}
                              onChange={(next) =>
                                changeStatusRemote(a.id, next)
                              }
                              disabled={false}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={s.detailsContainer}>
                        <div className={s.detailItem}>
                          <Phone className={s.detailIcon} />
                          <span className={s.detailText}>{a.mobile}</span>
                        </div>

                        <div className={s.detailItem}>
                          <Banknote className={s.detailIcon} />
                          <span className={s.feesText}>
                            Fees: {formatNaira(a.fees)}
                          </span>
                        </div>

                        <div className={s.detailItem}>
                          <Calendar className={s.detailIcon} />
                          <span className={s.detailText}>
                            Date: {formatDateNice(a.date)}
                          </span>
                        </div>

                        <div className={s.detailItem}>
                          <Clock className={s.detailIcon} />
                          <span className={s.detailText}>
                            Time: {formatTimeDisplay(a)}
                          </span>
                        </div>

                        <div className={s.serviceText}>
                          Service:{" "}
                          <span className={s.serviceName}>{a.serviceName}</span>
                        </div>
                      </div>
                    </div>

                    <div className={s.actionsContainer}>
                      <div className={s.actionsInnerContainer}>
                        <div className="flex-1">
                          <RescheduleButton
                            appointment={a}
                            onReschedule={(d, t) =>
                              rescheduleRemote(a.id, d, t)
                            }
                            disabled={false}
                          />
                        </div>

                        <div className="ml-3">
                          <button
                            type="button"
                            onClick={() => cancelRemote(a.id)}
                            disabled={isLocked}
                            className={s.cancelButton(isLocked)}
                            title={
                              isLocked ? "Cannot cancel" : "Cancel appointment"
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      <Toast toasts={toasts} removeToast={removeToast} />

      <div className={s.legendContainer}>
        <div className={s.legendItem}>
          <div className={`${s.legendDot} bg-amber-400`}></div>{" "}
          <span>Pending</span>
        </div>

        <div className={s.legendItem}>
          <div className={`${s.legendDot} bg-emerald-400`}></div>
          <span>Confirmed</span>
        </div>

        <div className={s.legendItem}>
          <div className={`${s.legendDot} bg-red-400`}></div>
          <span>Canceled</span>
        </div>

        <div className={s.legendItem}>
          <div className={`${s.legendDot} bg-sky-400`}></div>
          <span>Completed</span>
        </div>

        <div className={s.legendItem}>
          <div className={`${s.legendDot} bg-indigo-400`}></div>
          <span>Rescheduled</span>
        </div>
      </div>

      <style>{s.animatedBorderStyle}</style>
    </div>
  );
};

export default Page;
