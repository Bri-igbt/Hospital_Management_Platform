"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Image as ImageIcon,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  Search,
  Calendar,
  Plus,
} from "lucide-react";
import { serviceListStyles as s } from "@/app/assets/dummyStyles.js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n) => String(n).padStart(2, "0");

const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const formatNaira = (v) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

function formatDateHuman(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const mon = MONTHS[Number(m) - 1] || m;
  return `${String(Number(d))} ${mon} ${y}`;
}

function slotDateTimeToMs(slot) {
  const [y, m, d] = (slot.date || "").split("-");
  if (!y || !m || !d) return 0;
  let h = Number(slot.hour || 0);
  const mm = Number(slot.minute || 0);
  const ap = (slot.ampm || "AM").toUpperCase();
  if (ap === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return new Date(Number(y), Number(m) - 1, Number(d), h, mm, 0, 0).getTime();
}

function parseFrontendSlotString(date, timeStr) {
  const slot = {
    date: date && date !== "unspecified" ? date : "",
    hour: "10",
    minute: "00",
    ampm: "AM",
    raw: timeStr,
  };

  if (!timeStr) return slot;
  const raw = String(timeStr);

  const isoMatch = raw.match(
    /[T\s](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})?$/
  );
  if (isoMatch) {
    const hh24 = Number(isoMatch[1]);
    slot.minute = pad2(Number(isoMatch[2]));
    if (hh24 === 0) {
      slot.hour = "12";
      slot.ampm = "AM";
    } else if (hh24 === 12) {
      slot.hour = "12";
      slot.ampm = "PM";
    } else if (hh24 > 12) {
      slot.hour = String(hh24 - 12);
      slot.ampm = "PM";
    } else {
      slot.hour = String(hh24);
      slot.ampm = "AM";
    }
    return slot;
  }

  const m = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (m) {
    slot.hour = String(Number(m[1]));
    slot.minute = pad2(m[2]);
    slot.ampm = (m[3] || "AM").toUpperCase();
  }
  return slot;
}

// ["05 Nov 2026 • 10:00 AM", ...]  ->  [{ id, date, hour, minute, ampm }]
function convertSlotsForUI(slotStrings = []) {
  return (slotStrings || []).map((str, idx) => {
    const raw = String(str || "");
    const m = raw.match(
      /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*•\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i
    );
    if (m) {
      const mi = MONTHS.findIndex(
        (mm) => mm.toLowerCase() === m[2].toLowerCase()
      );
      const monthNum = mi >= 0 ? pad2(mi + 1) : "01";
      return {
        id: `s-${idx}`,
        date: `${m[3]}-${monthNum}-${pad2(m[1])}`,
        hour: String(Number(m[4])),
        minute: pad2(m[5]),
        ampm: (m[6] || "AM").toUpperCase(),
        raw,
      };
    }

    const isoMatch = raw.match(
      /^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})?)?/
    );
    if (isoMatch) {
      let hour = "10";
      let minute = "00";
      let ampm = "AM";
      if (isoMatch[2]) {
        const hh = Number(isoMatch[2]);
        minute = pad2(Number(isoMatch[3] || "0"));
        if (hh === 0) {
          hour = "12";
        } else if (hh === 12) {
          hour = "12";
          ampm = "PM";
        } else if (hh > 12) {
          hour = String(hh - 12);
          ampm = "PM";
        } else {
          hour = String(hh);
        }
      }
      return { id: `s-${idx}`, date: isoMatch[1], hour, minute, ampm, raw };
    }

    const timeOnly = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeOnly) {
      return {
        id: `s-${idx}`,
        date: "",
        hour: String(Number(timeOnly[1])),
        minute: pad2(timeOnly[2]),
        ampm: (timeOnly[3] || "AM").toUpperCase(),
        raw,
      };
    }

    return {
      id: `s-${idx}`,
      date: "",
      hour: "10",
      minute: "00",
      ampm: "AM",
      raw,
    };
  });
}

// { "2026-11-05": ["10:00 AM"] }  ->  [{ id, date, hour, minute, ampm }]
function convertSlotsMapToArray(slotsMap) {
  try {
    const out = [];
    const entries =
      slotsMap instanceof Map
        ? Array.from(slotsMap.entries())
        : Object.entries(slotsMap || {});

    entries.forEach(([date, arr]) => {
      (arr || []).forEach((t, idx) => {
        out.push({
          id: `${date}-${idx}`,
          ...parseFrontendSlotString(date, t),
        });
      });
    });
    return out;
  } catch (e) {
    return [];
  }
}

function slotsFromService(slots) {
  if (Array.isArray(slots)) return convertSlotsForUI(slots);
  if (slots && typeof slots === "object") return convertSlotsMapToArray(slots);
  return [];
}

function sortSlotsForDisplay(slots = []) {
  if (!Array.isArray(slots)) return [];

  const today = new Date();
  const todayVal = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const dateOnlyVal = (dateStr) => {
    if (!dateStr || typeof dateStr !== "string")
      return Number.POSITIVE_INFINITY;
    const parts = dateStr.split("-");
    if (parts.length !== 3) return Number.POSITIVE_INFINITY;
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d))
      return Number.POSITIVE_INFINITY;
    return Date.UTC(y, m, d);
  };

  return slots.slice().sort((a, b) => {
    const aDateVal = dateOnlyVal(a.date);
    const bDateVal = dateOnlyVal(b.date);

    const aIsPast = aDateVal < todayVal;
    const bIsPast = bDateVal < todayVal;
    if (aIsPast !== bIsPast) return aIsPast ? -1 : 1;

    if (aIsPast && bIsPast && aDateVal !== bDateVal) {
      return bDateVal - aDateVal;
    }
    if (!aIsPast && !bIsPast && aDateVal !== bDateVal) {
      return aDateVal - bDateVal;
    }

    const aTs = slotDateTimeToMs(a) || Number.POSITIVE_INFINITY;
    const bTs = slotDateTimeToMs(b) || Number.POSITIVE_INFINITY;
    return aTs - bTs;
  });
}

function validateSlots(slots = []) {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot) {
      return {
        valid: false,
        message: "Please fill all slot date/time fields.",
      };
    }
    if (!slot.date || !DATE_RE.test(slot.date)) {
      return {
        valid: false,
        message:
          "Please provide a valid date (year-month-day) for all slots. Example: 2026-12-31.",
      };
    }
    if (!slot.hour || !/^(?:[1-9]|1[0-2])$/.test(String(slot.hour))) {
      return {
        valid: false,
        message: "Please select hour (1-12) for all slots.",
      };
    }
    if (!slot.minute || !/^\d{2}$/.test(String(slot.minute))) {
      return {
        valid: false,
        message: "Please select minute (00-59) for all slots.",
      };
    }
    const mm = Number(slot.minute);
    if (isNaN(mm) || mm < 0 || mm > 59) {
      return {
        valid: false,
        message: "Please select a valid minute (00-59) for all slots.",
      };
    }
    if (!slot.ampm || (slot.ampm !== "AM" && slot.ampm !== "PM")) {
      return {
        valid: false,
        message: "Please select AM or PM for all slots.",
      };
    }
  }
  return { valid: true };
}

function findDuplicateInSlots(slots = []) {
  const seen = new Set();
  for (const sl of slots) {
    const key = `${sl.date}|${sl.hour}|${pad2(sl.minute)}|${sl.ampm}`;
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}

// Always built from the fields, so edits are never lost
function slotsToFormattedStrings(slots = []) {
  return (slots || []).map((sl) => {
    const [year = "", monthRaw = "1", dayRaw = ""] = (sl.date || "").split("-");
    const monthName = MONTHS[Number(monthRaw) - 1] || MONTHS[0];
    const day = dayRaw ? pad2(Number(dayRaw)) : "";
    const hour = pad2(sl.hour || 10);
    const minute = pad2(sl.minute || 0);
    const ampm = (sl.ampm || "AM").toUpperCase();
    return `${day} ${monthName} ${year} • ${hour}:${minute} ${ampm}`;
  });
}

const Page = () => {
  const { getToken } = useAuth();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDetails, setOpenDetails] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [editForm, setEditForm] = useState(null);
  const fileRef = useRef();

  const [toasts, setToasts] = useState([]);
  function addToast(
    message,
    type = "success",
    ttl = 3000,
    position = "bottom-right",
    animated = false
  ) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, position, animated }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), ttl);
  }

  const todayISO = toISODate(new Date());

  async function fetchServices() {
    try {
      const res = await fetch(`${API_BASE}/api/services`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("Failed to fetch services", body);
        addToast("Failed to load services", "error");
        setServices([]);
        return;
      }
      const items = (body && (body.data || body.services || body.items)) || [];
      setServices(
        items.map((svc) => ({
          id: svc._id || svc.id,
          name: svc.name || "",
          about: svc.about || "",
          instructions: svc.instructions || svc.preInstructions || [],
          price: svc.price ?? svc.fee ?? 0,
          available: svc.available ?? svc.availability === "Available",
          image:
            svc.image || svc.imageUrl || svc.imageSrc || svc.imageSmall || "",
          slots: slotsFromService(svc.slots),
          _raw: svc,
        }))
      );
    } catch (err) {
      console.error("fetchServices error", err);
      addToast("Network error while loading services", "error");
      setServices([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchServices();
  }, []);

  function toggleDetails(id) {
    setOpenDetails((prev) => ({ [id]: !prev[id] }));
  }

  function revokePreview(url) {
    if (url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {}
    }
  }

  async function startEdit(service) {
    let latest = service._raw || service;
    if (service.id) {
      try {
        const res = await fetch(`${API_BASE}/api/services/${service.id}`);
        const body = await res.json().catch(() => null);
        if (res.ok && body) {
          latest = body.data || body.service || body;
        }
      } catch (e) {}
    }

    const normalized = {
      id: latest._id || latest.id || service.id,
      name: latest.name || "",
      about: latest.about || "",
      instructionsText: (
        latest.instructions ||
        latest.preInstructions ||
        []
      ).join("\n"),
      price: latest.price ?? latest.fee ?? 0,
      available:
        latest.available ??
        (latest.availability ? latest.availability === "Available" : true),
      imagePreview: latest.imageUrl || latest.image || latest.imageSrc || "",
      imageFile: null,
      slots: sortSlotsForDisplay(slotsFromService(latest.slots)),
    };

    setEditingId(normalized.id);
    setEditForm(normalized);
    setOpenDetails({ [normalized.id]: true });
  }

  function closeEdit() {
    revokePreview(editForm?.imagePreview);
    setEditingId(null);
    setEditForm(null);
  }

  async function saveEdit() {
    if (!editForm) return;

    if (!String(editForm.name || "").trim()) {
      addToast("Service name is required", "error");
      return;
    }

    const price = Number(editForm.price);
    if (!Number.isFinite(price) || price < 0) {
      addToast("Please enter a valid price in naira", "error");
      return;
    }

    // Expired slots are dropped automatically; slots with no date are
    // kept so validation can ask for one
    const allSlots = editForm.slots || [];
    const expired = allSlots.filter(
      (sl) =>
        sl.date && DATE_RE.test(sl.date) && slotDateTimeToMs(sl) <= Date.now()
    );
    const remaining = allSlots.filter((sl) => !expired.includes(sl));

    const validation = validateSlots(remaining);
    if (!validation.valid) {
      addToast(validation.message, "error");
      return;
    }

    if (remaining.length === 0) {
      addToast(
        expired.length
          ? "All slots have expired. Add at least one future slot."
          : "Add at least one time slot.",
        "error"
      );
      return;
    }

    const dupKey = findDuplicateInSlots(remaining);
    if (dupKey) {
      const [date, hour, minute, ampm] = dupKey.split("|");
      addToast(
        `Duplicate slot detected: ${formatDateHuman(
          date
        )} — ${hour}:${minute} ${ampm}`,
        "error",
        4000,
        "top-right",
        true
      );
      return;
    }

    try {
      const token = await getToken();
      if (!token) {
        addToast("Please sign in again", "error");
        return;
      }

      const fd = new FormData();
      fd.append("name", editForm.name.trim());
      fd.append("about", editForm.about || "");
      fd.append("price", String(price));
      fd.append(
        "availability",
        editForm.available ? "available" : "unavailable"
      );

      const instructions = (editForm.instructionsText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      fd.append("instructions", JSON.stringify(instructions));
      fd.append("slots", JSON.stringify(slotsToFormattedStrings(remaining)));

      if (editForm.imageFile) {
        fd.append("image", editForm.imageFile);
      }

      // Don't set Content-Type: the browser sets the multipart boundary
      const res = await fetch(`${API_BASE}/api/services/${editForm.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        console.error("Save failed:", body);
        addToast(body?.message || "Failed to save service", "error");
        return;
      }

      addToast(
        expired.length
          ? `Service updated. ${expired.length} expired slot${
              expired.length !== 1 ? "s" : ""
            } removed.`
          : "Service updated successfully",
        "success",
        3500
      );

      closeEdit();
      await fetchServices();
    } catch (err) {
      console.error("saveEdit error", err);
      addToast("Network error while saving", "error");
    }
  }

  async function removeService(id) {
    if (!window.confirm("Are you sure you want to remove this service?"))
      return;
    try {
      const token = await getToken();
      if (!token) {
        addToast("Please sign in again", "error");
        return;
      }

      const res = await fetch(`${API_BASE}/api/services/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        console.error("Delete failed", body);
        addToast(body?.message || "Failed to remove service", "error");
        return;
      }
      setServices((prev) => prev.filter((x) => x.id !== id));
      setOpenDetails({});
      if (editingId === id) closeEdit();
      addToast("Service removed", "success");
    } catch (err) {
      console.error("removeService error", err);
      addToast("Network error while removing", "error");
    }
  }

  function onImageFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    revokePreview(editForm?.imagePreview);
    const url = URL.createObjectURL(f);
    setEditForm((prev) => ({ ...prev, imagePreview: url, imageFile: f }));
  }

  function addNewSlot() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const newSlot = {
      id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: toISODate(tomorrow),
      hour: "10",
      minute: "00",
      ampm: "AM",
    };
    setEditForm((prev) => ({
      ...prev,
      slots: [...(prev.slots || []), newSlot],
    }));
  }

  function updateSlot(slotId, field, value) {
    if (!editForm) return;

    if (field === "date" && value && value < todayISO) {
      addToast(
        "Cannot select a past date. Choose today or a future date.",
        "error"
      );
      return;
    }

    const newSlots = (editForm.slots || []).map((sl) =>
      sl.id === slotId ? { ...sl, [field]: value } : sl
    );

    const dupKey = findDuplicateInSlots(newSlots);
    if (dupKey) {
      const [date, hour, minute, ampm] = dupKey.split("|");
      addToast(
        `Duplicate slot detected: ${formatDateHuman(
          date
        )} — ${hour}:${minute} ${ampm}`,
        "error",
        3500,
        "top-right",
        true
      );
    }

    setEditForm({ ...editForm, slots: newSlots });
  }

  function removeSlot(slotId) {
    setEditForm((prev) => ({
      ...prev,
      slots: (prev.slots || []).filter((sl) => sl.id !== slotId),
    }));
  }

  const filtered = services
    .filter((svc) =>
      (svc.name || "").toLowerCase().includes(search.trim().toLowerCase())
    )
    .filter((svc) => {
      if (filterMode === "all") return true;
      if (filterMode === "available") return svc.available === true;
      if (filterMode === "unavailable") return svc.available === false;
      return true;
    });

  function renderToast(t) {
    return (
      <div
        key={t.id}
        className={`${s.toast} ${t.animated ? s.toastAnimated : ""}`}
      >
        <div
          className={`${s.toastInner} ${
            t.type === "success" ? s.toastSuccess : s.toastError
          }`}
        >
          <div className={s.toastContent}>
            <div
              className={
                t.type === "success" ? s.toastIconSuccess : s.toastIconError
              }
            >
              <Check className={s.toastIconSvg} />
            </div>
            <div className={s.toastMessage}>{t.message}</div>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((x) => x.id !== t.id))
              }
              className={s.toastCloseButton}
            >
              <X className={s.toastCloseIcon} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={s.pageContainer}>
      <div className={s.headerContainer}>
        <div className="w-full md:w-auto">
          <h1 className={s.headerTitle}>Services</h1>
          <p className={s.headerSubtitle}>
            Manage your services, update details, adjust availability, or remove
            services.
          </p>
        </div>

        <div className={s.filterContainer}>
          <div className={s.filterButtonsContainer}>
            <button
              onClick={() => setFilterMode("all")}
              className={`${s.filterButton} ${
                filterMode === "all"
                  ? s.filterButtonActive
                  : s.filterButtonInactive
              } ${s.cursorPointer}`}
              type="button"
            >
              All
            </button>
            <button
              onClick={() => setFilterMode("available")}
              className={`${s.filterButton} ${
                filterMode === "available"
                  ? s.filterButtonActive
                  : s.filterButtonInactive
              } ${s.cursorPointer}`}
              type="button"
            >
              Available
            </button>
            <button
              onClick={() => setFilterMode("unavailable")}
              className={`${s.filterButton} ${
                filterMode === "unavailable"
                  ? s.filterButtonActive
                  : s.filterButtonInactive
              } ${s.cursorPointer}`}
              type="button"
            >
              Unavailable
            </button>
          </div>

          <div className={s.searchContainer}>
            <div className={s.searchIcon}>
              <Search className={s.searchIconSvg} />
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className={s.searchInput}
            />
          </div>
        </div>
      </div>

      <div className={s.servicesGrid}>
        {filtered.map((svc) => {
          const isOpen = !!openDetails[svc.id];
          const isEditing = editingId === svc.id && editForm;

          return (
            <div key={svc.id} className={s.serviceCard}>
              <div
                className={s.serviceCardContent}
                onClick={() => toggleDetails(svc.id)}
              >
                <div className={s.serviceImageContainer}>
                  {svc.image ? (
                    <img
                      src={svc.image}
                      alt={svc.name}
                      className={s.serviceImage}
                    />
                  ) : (
                    <div className={s.serviceImagePlaceholder}>
                      <ImageIcon />
                    </div>
                  )}
                </div>

                <div className={s.serviceInfoContainer}>
                  <div className={s.serviceHeader}>
                    <div className="min-w-0">
                      <h2 className={s.serviceName}>{svc.name}</h2>
                      <p className={s.serviceDescription}>{svc.about}</p>
                    </div>

                    <div className={s.servicePriceContainer}>
                      <div className={s.servicePrice}>
                        {formatNaira(svc.price)}
                      </div>
                      <div
                        className={`${s.availabilityBadge} ${
                          svc.available
                            ? s.availabilityAvailable
                            : s.availabilityUnavailable
                        }`}
                      >
                        {svc.available ? (
                          <>
                            <Check className="w-3 h-3" /> Available
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3" /> Unavailable
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={s.slotsInfo}>
                    <Calendar className="w-4 h-4" />
                    <span>
                      {svc.slots.length} slot{svc.slots.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className={s.chevronContainer}>
                  <ChevronDown
                    className={`${s.chevronIcon} ${
                      isOpen ? s.chevronOpen : s.chevronClosed
                    }`}
                  />
                </div>
              </div>

              <div
                className={`${s.detailsContainer} ${
                  isOpen ? s.block : s.hidden
                }`}
              >
                {isEditing ? (
                  <div className={s.editForm}>
                    <div className={s.editImageContainer}>
                      <div className={s.editImagePreview}>
                        {editForm.imagePreview ? (
                          <img
                            src={editForm.imagePreview}
                            alt="preview"
                            className={s.serviceImage}
                          />
                        ) : (
                          <div className={s.serviceImagePlaceholder}>
                            <ImageIcon />
                          </div>
                        )}
                      </div>

                      <div className={s.editFormFields}>
                        <input
                          className={s.inputBase}
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="Service name"
                        />
                        <input
                          className={`${s.inputBase} mt-1`}
                          value={editForm.price}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              price: e.target.value,
                            }))
                          }
                          type="number"
                          min="0"
                          placeholder="Price (₦)"
                        />

                        <div className={s.availabilitySelectContainer}>
                          <label className={s.availabilityLabel}>
                            Availability
                          </label>
                          <select
                            value={editForm.available ? "true" : "false"}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                available: e.target.value === "true",
                              }))
                            }
                            className={s.availabilitySelect}
                          >
                            <option value="true">Available</option>
                            <option value="false">Unavailable</option>
                          </select>
                        </div>

                        <div className={s.fileInputContainer}>
                          <label className={s.fileInputLabel}>
                            Change image
                          </label>
                          <input
                            ref={fileRef}
                            onChange={onImageFileChange}
                            type="file"
                            accept="image/*"
                            className={s.fileInput}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className={s.formLabel}>About</label>
                      <textarea
                        className={`${s.inputBase} ${s.textarea}`}
                        value={editForm.about}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            about: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <label className={s.formLabel}>
                        Instructions (one per line)
                      </label>
                      <textarea
                        className={`${s.inputBase} ${s.textareaInstructions}`}
                        value={editForm.instructionsText}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            instructionsText: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <div className={s.slotsHeader}>
                        <label className={s.formLabelSmall}>Slots</label>
                        <button
                          onClick={addNewSlot}
                          type="button"
                          className={`${s.addSlotButton} ${s.cursorPointer}`}
                        >
                          <Plus className="w-4 h-4" /> Add slot
                        </button>
                      </div>

                      <div className={s.slotsContainer}>
                        {(editForm.slots || []).map((slot) => (
                          <div key={slot.id} className={s.slotRow}>
                            <input
                              type="date"
                              value={slot.date}
                              onChange={(e) =>
                                updateSlot(slot.id, "date", e.target.value)
                              }
                              required
                              min={todayISO}
                              className={s.slotDateInput}
                            />

                            <div className={s.slotTimeContainer}>
                              <select
                                value={slot.hour}
                                onChange={(e) =>
                                  updateSlot(slot.id, "hour", e.target.value)
                                }
                                required
                                className={s.slotSelect}
                              >
                                {Array.from(
                                  { length: 12 },
                                  (_, i) => i + 1
                                ).map((h) => (
                                  <option key={h} value={String(h)}>
                                    {h}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={slot.minute}
                                onChange={(e) =>
                                  updateSlot(slot.id, "minute", e.target.value)
                                }
                                required
                                className={s.slotSelect}
                              >
                                {Array.from({ length: 60 }, (_, i) => i).map(
                                  (m) => (
                                    <option key={m} value={pad2(m)}>
                                      {pad2(m)}
                                    </option>
                                  )
                                )}
                              </select>

                              <select
                                value={slot.ampm}
                                onChange={(e) =>
                                  updateSlot(slot.id, "ampm", e.target.value)
                                }
                                required
                                className={s.slotSelect}
                              >
                                <option>AM</option>
                                <option>PM</option>
                              </select>
                            </div>

                            <div className="flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => removeSlot(slot.id)}
                                className={s.removeSlotButton}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={s.formActions}>
                      <button
                        type="button"
                        onClick={closeEdit}
                        className={s.cancelButton}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveEdit}
                        className={s.saveButton}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={s.viewSection}>
                    <div>
                      <h3 className={s.viewSectionTitle}>About</h3>
                      <p className={s.viewSectionContent}>{svc.about}</p>
                    </div>

                    <div>
                      <h3 className={s.viewSectionTitle}>Instructions</h3>
                      <ul className={s.instructionsList}>
                        {svc.instructions.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h3 className={s.viewSectionTitle}>Slots</h3>
                      <div className={s.slotsList}>
                        {svc.slots.length === 0 ? (
                          <div className={s.noSlotsMessage}>
                            No slots scheduled
                          </div>
                        ) : (
                          sortSlotsForDisplay(svc.slots).map((slot) => (
                            <div key={slot.id} className={s.slotItem}>
                              <Calendar className={s.slotIcon} />
                              <div>
                                <div>
                                  {formatDateHuman(slot.date)} — {slot.hour}:
                                  {pad2(slot.minute)} {slot.ampm}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className={s.viewActions}>
                      <button
                        type="button"
                        onClick={() => startEdit(svc)}
                        className={`${s.editButton} ${s.cursorPointer}`}
                      >
                        <Edit2 className="w-4 h-4 text-emerald-600" />{" "}
                        <span className={s.textEmerald700}>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => removeService(svc.id)}
                        className={`${s.removeButton} ${s.cursorPointer}`}
                      >
                        <Trash2 className="w-4 h-4" /> Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {loading && <div className={s.emptyState}>Loading services...</div>}

      {!loading && filtered.length === 0 && (
        <div className={s.emptyState}>No services match your search.</div>
      )}

      <div className={s.toastContainerTop}>
        {toasts.filter((t) => t.position === "top-right").map(renderToast)}
      </div>

      <div className={s.toastContainerBottom}>
        {toasts.filter((t) => t.position === "bottom-right").map(renderToast)}
      </div>
    </div>
  );
};

export default Page;
