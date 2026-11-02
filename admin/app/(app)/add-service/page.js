"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { addServiceStyles as s } from "@/app/assets/dummyStyles.js";
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  ImageIcon,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";

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

const formatNaira = (v) => {
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);
};

// Accepts either ["01 Nov 2026 • 11:00 AM", ...] or { "2026-11-01": ["11:00 AM"] }
function slotsToDisplay(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const out = [];
    Object.entries(raw).forEach(([date, times]) => {
      if (!Array.isArray(times)) return;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
      times.forEach((t) => {
        if (m) out.push(`${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]} • ${t}`);
        else out.push(t);
      });
    });
    return out;
  }
  return [];
}

const Page = ({ serviceId }) => {
  const { getToken } = useAuth();

  const fileRef = useRef(null);
  const toastTimerRef = useRef(null);

  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [hasExistingImage, setHasExistingImage] = useState(false);
  const [removeImage, setRemoveImage] = useState(false);

  const [serviceName, setServiceName] = useState("");
  const [about, setAbout] = useState("");
  const [price, setPrice] = useState("");
  const [availability, setAvailability] = useState("available");

  const [instructions, setInstructions] = useState([""]);
  const [slots, setSlots] = useState([]);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDate = today.getDate();

  const years = Array.from({ length: 5 }).map((_, i) => currentYear + i);
  const months = MONTHS;
  const hours = Array.from({ length: 12 }).map((_, i) =>
    String(i + 1).padStart(2, "0")
  );
  const minutes = Array.from({ length: 12 }).map((_, i) =>
    String(i * 5).padStart(2, "0")
  );
  const ampm = ["AM", "PM"];

  const [slotDay, setSlotDay] = useState(String(currentDate));
  const [slotMonth, setSlotMonth] = useState(String(currentMonth));
  const [slotYear, setSlotYear] = useState(String(currentYear));
  const [slotHour, setSlotHour] = useState("11");
  const [slotMinute, setSlotMinute] = useState("00");
  const [slotAmPm, setSlotAmPm] = useState("AM");

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});

  const selectedYearNum = Number(slotYear);
  const selectedMonthNum = Number(slotMonth);
  const daysInSelectedMonth = new Date(
    selectedYearNum,
    selectedMonthNum + 1,
    0
  ).getDate();
  const days = Array.from({ length: daysInSelectedMonth }).map((_, i) =>
    String(i + 1)
  );

  useEffect(() => {
    if (Number(slotDay) > daysInSelectedMonth) {
      setSlotDay(String(daysInSelectedMonth));
    }
  }, [slotDay, slotMonth, slotYear, daysInSelectedMonth]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadService() {
      if (!serviceId) return;
      try {
        const res = await fetch(`${API_BASE}/api/services/${serviceId}`);
        if (!mounted) return;
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.warn("Failed to fetch service:", res.status, txt);
          showToast(
            "error",
            "Load failed",
            "Could not load service for editing."
          );
          return;
        }
        const payload = await res.json().catch(() => null);
        const data = payload?.data || payload;
        if (!data || !mounted) return;

        setServiceName(data.name || "");
        setAbout(data.about || data.description || "");
        setPrice(data.price != null ? String(data.price) : "");
        setAvailability(data.available ? "available" : "unavailable");
        setInstructions(
          Array.isArray(data.instructions) && data.instructions.length
            ? data.instructions
            : [""]
        );
        setSlots(slotsToDisplay(data.slots));
        if (data.imageUrl) {
          setImagePreview(data.imageUrl);
          setHasExistingImage(true);
          setRemoveImage(false);
        } else {
          setImagePreview(null);
          setHasExistingImage(false);
        }
      } catch (err) {
        console.error("loadService error:", err);
        if (mounted) {
          showToast("error", "Network error", "Could not load service.");
        }
      }
    }
    loadService();
    return () => {
      mounted = false;
    };
  }, [serviceId]);

  function handleImageChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (imagePreview && imagePreview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(imagePreview);
      } catch (err) {}
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
    setRemoveImage(false);
    setHasExistingImage(false);
  }

  function addInstruction() {
    setInstructions((prev) => [...prev, ""]);
  }
  function updateInstruction(i, v) {
    setInstructions((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  }
  function removeInstruction(i) {
    setInstructions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function resetForm() {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(imagePreview);
      } catch (err) {}
    }
    setImagePreview(null);
    setImageFile(null);
    setHasExistingImage(false);
    setRemoveImage(false);
    setServiceName("");
    setAbout("");
    setPrice("");
    setAvailability("available");
    setInstructions([""]);
    setSlots([]);
    setErrors({});
    if (fileRef.current) fileRef.current.value = null;
  }

  function showToast(type, title, message) {
    setToast({ type, title, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }

  function selectedDateTime() {
    const d = Number(slotDay);
    const m = Number(slotMonth);
    const y = Number(slotYear);
    let h = Number(slotHour);
    const mm = Number(slotMinute);
    const ap = slotAmPm;

    if (ap === "AM") {
      if (h === 12) h = 0;
    } else {
      if (h !== 12) h = h + 12;
    }

    return new Date(y, m, d, h, mm, 0, 0);
  }

  function isSelectedDateTimeInPast() {
    const sel = selectedDateTime();
    return sel.getTime() <= Date.now();
  }

  function addSlot() {
    const m = months[Number(slotMonth)];
    const d = String(slotDay).padStart(2, "0");
    const y = slotYear;
    const h = String(slotHour).padStart(2, "0");
    const mm = slotMinute;
    const ap = slotAmPm;
    const formatted = `${d} ${m} ${y} • ${h}:${mm} ${ap}`;

    if (slots.includes(formatted)) {
      showToast(
        "error",
        "Duplicate Slot",
        "This time slot has already been added. Please select a different time."
      );
      return;
    }

    if (isSelectedDateTimeInPast()) {
      showToast(
        "error",
        "Past Time",
        "You cannot add a time slot in the past. Please select a future date/time."
      );
      setErrors((prev) => ({ ...prev, slots: true }));
      return;
    }

    setSlots((prev) => [...prev, formatted]);
    setErrors((prev) => ({ ...prev, slots: false }));
    showToast("success", "Slot Added", `Time slot added: ${formatted}`);
  }

  function removeSlot(i) {
    const removedSlot = slots[i];
    setSlots((prev) => prev.filter((_, idx) => idx !== i));
    showToast("info", "Slot Removed", `Removed: ${removedSlot}`);
  }

  function validate() {
    const newErrors = {};
    const numericPrice = String(price).replace(/[^\d.]/g, "");

    if (!imageFile && !hasExistingImage) newErrors.image = true;
    if (!serviceName.trim()) newErrors.serviceName = true;
    if (!about.trim()) newErrors.about = true;
    if (
      numericPrice === "" ||
      !Number.isFinite(Number(numericPrice)) ||
      Number(numericPrice) < 0
    )
      newErrors.price = true;
    if (!instructions.some((ins) => ins.trim())) newErrors.instructions = true;
    if (!slots.length) newErrors.slots = true;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      showToast(
        "error",
        "Missing Fields",
        "Please fill all required fields before submitting."
      );
      return;
    }

    setSubmitting(true);

    try {
      const token = await getToken();
      if (!token) {
        showToast("error", "Not signed in", "Please sign in again.");
        return;
      }

      const fd = new FormData();
      fd.append("name", serviceName.trim());
      fd.append("about", about.trim());
      fd.append("price", String(price).replace(/[^\d.]/g, "") || "0");
      fd.append("availability", availability);
      // arrays serialized as JSON
      fd.append(
        "instructions",
        JSON.stringify(instructions.map((x) => x.trim()).filter(Boolean))
      );
      fd.append("slots", JSON.stringify(slots));

      if (imageFile) {
        fd.append("image", imageFile);
      } else if (removeImage) {
        fd.append("removeImage", "true");
      }

      const url = serviceId
        ? `${API_BASE}/api/services/${serviceId}`
        : `${API_BASE}/api/services`;
      const method = serviceId ? "PUT" : "POST";

      // Don't set Content-Type: the browser sets the multipart boundary
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = data?.message || `Server error (${res?.status || "?"})`;
        showToast("error", "Save Failed", msg);
        return;
      }

      showToast(
        "success",
        serviceId ? "Service Updated" : "Service Added",
        `${serviceName} saved with ${slots.length} slot(s).`
      );

      // Let the service dashboard refresh itself
      try {
        window.dispatchEvent(new Event("services:updated"));
      } catch {}

      if (!serviceId) {
        resetForm();
      } else {
        const saved = data?.data || null;
        if (saved) {
          setHasExistingImage(Boolean(saved.imageUrl));
          setImagePreview(saved.imageUrl || null);
          setImageFile(null);
          setRemoveImage(false);
        }
      }
    } catch (err) {
      console.error("service submit error:", err);
      showToast("error", "Network error", "Could not reach server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={s.container.main}>
      <div className={s.toast.container}>
        {toast && (
          <div
            className={`${s.toast.toastBase} ${
              toast.type === "error"
                ? s.toast.toastError
                : toast.type === "info"
                ? s.toast.toastInfo
                : s.toast.toastSuccess
            } animate-slideIn`}
          >
            <div className={s.toast.iconContainer(toast.type)}>
              {toast.type === "error" ? (
                <AlertTriangle className="w-5 h-5" />
              ) : toast.type === "info" ? (
                <Clock className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className={s.toast.title}>{toast.title}</div>
              <div className={s.toast.message}>{toast.message}</div>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className={s.buttons.toastClose}
            >
              <XCircle className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className={s.container.form}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className={s.header.title}>
              {serviceId ? "Edit Service" : "Add Service"}
            </h1>
            <p className={s.header.subtitle}>
              Create a beautiful service card with unique time slots
            </p>
          </div>

          <div className={s.headerActions}>
            <button
              type="button"
              onClick={resetForm}
              className={s.buttons.reset}
            >
              Reset
            </button>

            <button
              type="submit"
              disabled={submitting}
              className={s.buttons.submit}
            >
              {submitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {serviceId ? "Update Service" : "Save Service"}
                </>
              )}
            </button>
          </div>
        </div>

        <div className={s.grids.main}>
          <div className="lg:col-span-1 md:col-span-1 col-span-1 flex flex-col items-center">
            <div className={s.imageUpload.container(errors.image)}>
              <div className={s.imageUpload.preview}>
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={s.imageUpload.placeholder}>
                    <ImageIcon className="w-10 h-10" />
                    <div className="mt-2 text-sm">Service image (required)</div>
                  </div>
                )}
              </div>

              <div className="w-full flex gap-2 items-center">
                <input
                  type="file"
                  accept="image/*"
                  ref={fileRef}
                  onChange={handleImageChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={s.buttons.uploadImage}
                >
                  <Plus className="w-4 h-4" />{" "}
                  {imagePreview ? "Replace Image" : "Upload Image"}
                </button>

                {(imagePreview || hasExistingImage) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (imagePreview && imagePreview.startsWith("blob:")) {
                        try {
                          URL.revokeObjectURL(imagePreview);
                        } catch (err) {}
                      }
                      setImagePreview(null);
                      setImageFile(null);
                      if (hasExistingImage) {
                        setRemoveImage(true);
                        setHasExistingImage(false);
                      }
                      if (fileRef.current) fileRef.current.value = null;
                    }}
                    className={s.buttons.removeImage}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 md:col-span-1 col-span-1 space-y-6">
            <div className={s.grids.formFields}>
              <div>
                <label className={s.labels.standard}>Service name</label>
                <input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. General Consultation"
                  className={s.formFields.input(errors.serviceName)}
                />
              </div>

              <div>
                <label className={s.labels.standard}>Price (₦)</label>
                <input
                  value={price}
                  onChange={(e) =>
                    setPrice(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  placeholder="e.g. 5000"
                  className={s.formFields.input(errors.price)}
                  inputMode="decimal"
                />
                {String(price).trim() !== "" && (
                  <div className="mt-1 text-xs text-gray-500">
                    {formatNaira(price)}
                  </div>
                )}

                <div className="mt-3">
                  <label className={s.labels.standard}>Availability</label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className={s.formFields.select}
                  >
                    <option value="available">Available</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className={s.labels.standard}>About this service</label>
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Short description"
                rows={4}
                className={s.formFields.textarea(errors.about)}
              />
            </div>

            {/* instructions */}
            <div>
              <div className="flex items-center justify-between">
                <label className={s.labels.standard}>
                  Instructions (point wise)
                </label>
                <button
                  type="button"
                  onClick={addInstruction}
                  className={s.buttons.addInstruction}
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              <div className={s.instructions.container(errors.instructions)}>
                {instructions.map((ins, idx) => (
                  <div key={idx} className={s.instructions.item}>
                    <div className={s.icon.number}>{idx + 1}.</div>
                    <input
                      value={ins}
                      onChange={(e) => updateInstruction(idx, e.target.value)}
                      placeholder={`Instruction ${idx + 1}`}
                      className={s.instructions.input}
                    />
                    {instructions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInstruction(idx)}
                        className={s.instructions.removeButton}
                      >
                        <Trash2 className={s.icon.removeInstruction} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* slot controls */}
            <div className={s.slots.container(errors.slots)}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <Calendar className="w-5 h-5" /> Slots & Schedule
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-500">
                    {slots.length} slot{slots.length !== 1 ? "s" : ""} added
                  </div>
                </div>
              </div>

              <div className={s.grids.timeGrid}>
                <div className="min-w-0">
                  <label className={s.labels.small}>Day</label>
                  <select
                    value={slotDay}
                    onChange={(e) => setSlotDay(e.target.value)}
                    className={s.formFields.smallSelect}
                  >
                    {days.map((d) => {
                      const dNum = Number(d);
                      const disabled =
                        Number(slotYear) === currentYear &&
                        Number(slotMonth) === currentMonth &&
                        dNum < currentDate;
                      return (
                        <option key={d} value={d} disabled={disabled}>
                          {d}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="min-w-0">
                  <label className={s.labels.small}>Month</label>
                  <select
                    value={slotMonth}
                    onChange={(e) => setSlotMonth(e.target.value)}
                    className={s.formFields.smallSelect}
                  >
                    {months.map((m, idx) => {
                      const disabled =
                        Number(slotYear) === currentYear && idx < currentMonth;
                      return (
                        <option key={m} value={String(idx)} disabled={disabled}>
                          {m}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="min-w-0">
                  <label className={s.labels.small}>Year</label>
                  <select
                    value={slotYear}
                    onChange={(e) => setSlotYear(e.target.value)}
                    className={s.formFields.smallSelect}
                  >
                    {years.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={s.grids.timeSubGrid}>
                  <div className="min-w-0">
                    <label className={s.labels.small}>Hour</label>
                    <select
                      value={slotHour}
                      onChange={(e) => setSlotHour(e.target.value)}
                      className={s.formFields.timeSelect}
                    >
                      {hours.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className={s.labels.small}>Minute</label>
                    <select
                      value={slotMinute}
                      onChange={(e) => setSlotMinute(e.target.value)}
                      className={s.formFields.timeSelect}
                    >
                      {minutes.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <label className={s.labels.small}>AM/PM</label>
                    <select
                      value={slotAmPm}
                      onChange={(e) => setSlotAmPm(e.target.value)}
                      className={s.formFields.ampmSelect}
                    >
                      {ampm.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <button
                  type="button"
                  onClick={addSlot}
                  className={s.buttons.addSlot}
                >
                  <Plus className="w-4 h-4" /> Add This Time Slot
                </button>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-2">
                  Added Slots ({slots.length})
                </div>

                <div className={s.grids.slotsGrid}>
                  {slots.length === 0 ? (
                    <div className="text-sm text-gray-400 italic px-4 py-2">
                      No slots added yet. Select a time and click &quot;Add This
                      Time Slot&quot;
                    </div>
                  ) : (
                    slots.map((slot, idx) => (
                      <div key={slot} className={s.slots.slotItem}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Clock className={s.icon.clock} />
                          <div className={s.slots.slotText}>{slot}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSlot(idx)}
                          className={s.buttons.slotRemove}
                        >
                          <Trash2 className={s.icon.trash} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Page;
