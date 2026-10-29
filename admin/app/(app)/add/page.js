"use client";

import React, { useEffect, useRef, useState } from "react";
import { doctorDetailStyles as s } from "@/app/assets/dummyStyles.js";
import {
  Calendar,
  CheckCircle,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  User,
  XCircle,
} from "lucide-react";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const emptyForm = {
  name: "",
  specialization: "",
  imageFile: null,
  imagePreview: "",
  experience: "",
  qualifications: "",
  location: "",
  about: "",
  fee: "",
  success: "",
  patients: "",
  rating: "",
  schedule: {},
  availability: "Available",
  email: "",
  password: "",
};

function timeStringToMinutes(t) {
  if (!t) return 0;
  const [hhmm, ampm] = t.split(" ");
  let [h, m] = hhmm.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function formatDateISO(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "June",
    "July",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(Number(d));
  const month = monthNames[dateObj.getMonth()] || "";
  return `${day} ${month} ${y}`;
}

function getFlatSlots(schedule) {
  const arr = [];
  Object.keys(schedule)
    .sort()
    .forEach((d) => {
      schedule[d].forEach((t) => arr.push({ date: d, time: t }));
    });
  return arr;
}

function revokePreview(url) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch (err) {}
}

function validate(f) {
  const req = [
    "name",
    "specialization",
    "experience",
    "qualifications",
    "location",
    "about",
    "fee",
    "success",
    "patients",
    "rating",
    "email",
    "password",
  ];

  for (const k of req) if (!f[k]) return false;
  if (!f.imageFile) return false;
  if (!Object.keys(f.schedule).length) return false;
  return true;
}

export default function AddDoctorPage() {
  const [doctorList, setDoctorList] = useState([]);
  const fileInputRef = useRef(null);
  const previewRef = useRef("");

  const [form, setForm] = useState(emptyForm);

  const [slotDate, setSlotDate] = useState("");
  const [slotHour, setSlotHour] = useState("");
  const [slotMinute, setSlotMinute] = useState("00");
  const [slotAmpm, setSlotAmpm] = useState("AM");

  const [toast, setToast] = useState({
    show: false,
    type: "success",
    message: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [today] = useState(() => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tzOffset * 60000);
    return local.toISOString().split("T")[0];
  });

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(
      () => setToast((prev) => ({ ...prev, show: false })),
      3000
    );
    return () => clearTimeout(t);
  }, [toast.show]);

  useEffect(() => {
    previewRef.current = form.imagePreview;
  }, [form.imagePreview]);

  useEffect(() => {
    return () => revokePreview(previewRef.current);
  }, []);

  const showToast = (type, message) => setToast({ show: true, type, message });

  function handleImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    revokePreview(form.imagePreview);
    setForm((p) => ({
      ...p,
      imageFile: file,
      imagePreview: URL.createObjectURL(file),
    }));
  }

  function removeImage() {
    revokePreview(form.imagePreview);
    setForm((p) => ({ ...p, imageFile: null, imagePreview: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addSlotToForm() {
    if (!slotDate || !slotHour) {
      showToast("error", "Select date + time");
      return;
    }
    if (slotDate < today) {
      showToast("error", "Cannot add a slot in the past");
      return;
    }
    const time = `${slotHour}:${slotMinute} ${slotAmpm}`;

    if (slotDate === today) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (timeStringToMinutes(time) <= nowMinutes) {
        showToast("error", "Cannot add a time that has already passed today");
        return;
      }
    }

    setForm((f) => {
      const existing = f.schedule[slotDate] || [];
      if (existing.includes(time)) return f;
      const updated = [...existing, time].sort(
        (a, b) => timeStringToMinutes(a) - timeStringToMinutes(b)
      );
      return { ...f, schedule: { ...f.schedule, [slotDate]: updated } };
    });

    setSlotHour("");
    setSlotMinute("00");
  }

  function removeSlot(date, time) {
    setForm((f) => {
      const remaining = (f.schedule[date] || []).filter((t) => t !== time);
      const schedule = { ...f.schedule };
      if (remaining.length) schedule[date] = remaining;
      else delete schedule[date];
      return { ...f, schedule };
    });
  }

  async function handleAdd(e) {
    e.preventDefault();

    if (!validate(form)) {
      showToast("error", "Fill all fields + upload image + add slot");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      showToast("error", "Enter a valid email address");
      return;
    }
    if (form.password.length < 6) {
      showToast("error", "Password must be at least 6 characters");
      return;
    }
    const fee = Number(form.fee);
    if (Number.isNaN(fee) || fee < 0) {
      showToast("error", "Fee must be a valid number");
      return;
    }
    const r = Number(form.rating);
    if (Number.isNaN(r) || r < 1 || r > 5) {
      showToast("error", "Rating must be a number between 1 and 5");
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("specialization", form.specialization);
      fd.append("experience", form.experience);
      fd.append("qualifications", form.qualifications);
      fd.append("location", form.location);
      fd.append("about", form.about);
      fd.append("fee", String(fee));
      fd.append("success", form.success);
      fd.append("patients", form.patients);
      fd.append("rating", String(r));
      fd.append("availability", form.availability || "Available");
      fd.append("email", form.email);
      fd.append("password", form.password);
      fd.append("schedule", JSON.stringify(form.schedule));
      fd.append("image", form.imageFile);

      const res = await fetch(`${API_BASE}/api/doctors`, {
        method: "POST",
        body: fd,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        showToast("error", data?.message || `Server error (${res.status})`);
        return;
      }

      showToast("success", "Doctor Added Successfully!");

      const doctorFromServer = data?.data || {
        id: Date.now(),
        name: form.name,
        specialization: form.specialization,
        imageUrl: "",
      };

      setDoctorList((old) => [doctorFromServer, ...old]);

      revokePreview(form.imagePreview);
      setForm(emptyForm);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setSlotDate("");
      setSlotHour("");
      setSlotMinute("00");
      setSlotAmpm("AM");
      setShowPassword(false);
    } catch (err) {
      console.warn("submit error:", err);
      showToast("error", "Network or server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={s.pageContainer}>
      <div className={s.maxWidthContainerLg + " " + s.headerContainer}>
        <div className={s.headerFlexContainer}>
          <div className={s.headerIconContainer}>
            <User className="text-white" size={32} />
          </div>
          <h1 className={s.headerTitle}>Add New Doctor</h1>
        </div>
      </div>

      <div className={s.maxWidthContainer + " " + s.formContainer}>
        <form onSubmit={handleAdd} className={s.formGrid}>
          <div className="md:col-span-2">
            <label className={s.label}>Upload Profile Image</label>

            <div className="flex flex-wrap items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImage}
                className={s.fileInput}
              />

              {form.imagePreview && (
                <div className="relative group">
                  <img
                    src={form.imagePreview}
                    alt="preview"
                    className={s.imagePreview}
                  />

                  <button
                    className={s.removeImageButton + " " + s.cursorPointer}
                    type="button"
                    onClick={removeImage}
                    aria-label="Remove image"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <input
            className={s.inputBase}
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <input
            className={s.inputBase}
            placeholder="Specialization"
            value={form.specialization}
            onChange={(e) =>
              setForm({ ...form, specialization: e.target.value })
            }
          />

          <input
            className={s.inputBase}
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />

          <input
            className={s.inputBase}
            placeholder="Experience"
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
          />

          <input
            className={s.inputBase}
            placeholder="Qualifications"
            value={form.qualifications}
            onChange={(e) =>
              setForm({ ...form, qualifications: e.target.value })
            }
          />

          <input
            className={s.inputBase}
            placeholder="Consultation Fee"
            type="number"
            min={0}
            value={form.fee}
            onChange={(e) => setForm({ ...form, fee: e.target.value })}
          />

          <input
            className={s.inputBase}
            placeholder="Rating (1.0 - 5.0)"
            type="number"
            min={1}
            max={5}
            step={0.1}
            value={form.rating}
            onChange={(e) => setForm((p) => ({ ...p, rating: e.target.value }))}
            onBlur={() =>
              setForm((p) => {
                if (!p.rating) return p;
                const n = Number(p.rating);
                if (Number.isNaN(n)) return { ...p, rating: "" };
                return { ...p, rating: Math.max(1, Math.min(5, n)).toFixed(1) };
              })
            }
          />

          <input
            className={s.inputBase}
            placeholder="Patients"
            value={form.patients}
            onChange={(e) => setForm({ ...form, patients: e.target.value })}
          />

          <input
            className={s.inputBase}
            placeholder="Success Rate"
            value={form.success}
            onChange={(e) => setForm({ ...form, success: e.target.value })}
          />

          <input
            className={s.inputBase}
            placeholder="Doctor Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <div className="relative">
            <input
              className={s.inputBase + " " + s.inputWithIcon}
              placeholder="Doctor password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className={s.passwordToggleButton + " " + s.cursorPointer}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>

          <select
            className={s.inputBase}
            value={form.availability}
            onChange={(e) => setForm({ ...form, availability: e.target.value })}
          >
            <option value="Available">Available</option>
            <option value="Unavailable">Unavailable</option>
          </select>

          <textarea
            className={s.textareaBase + " md:col-span-2"}
            rows={3}
            placeholder="About Doctor"
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
          ></textarea>

          <div className={s.scheduleContainer + " md:col-span-2"}>
            <div className={s.scheduleHeader}>
              <Calendar className="text-emerald-600" />
              <p className={s.scheduleTitle}>Add Schedule Slots</p>
            </div>

            <div className={s.scheduleInputsContainer}>
              <input
                type="date"
                value={slotDate}
                min={today}
                onChange={(e) => setSlotDate(e.target.value)}
                className={s.scheduleDateInput}
              />

              <select
                value={slotHour}
                onChange={(e) => setSlotHour(e.target.value)}
                className={s.scheduleTimeSelect}
              >
                <option value="">Hour</option>
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={String(i + 1)}>
                    {i + 1}
                  </option>
                ))}
              </select>

              <select
                value={slotMinute}
                onChange={(e) => setSlotMinute(e.target.value)}
                className={s.scheduleTimeSelect}
              >
                {Array.from({ length: 60 }).map((_, i) => (
                  <option key={i} value={String(i).padStart(2, "0")}>
                    {String(i).padStart(2, "0")}
                  </option>
                ))}
              </select>

              <select
                value={slotAmpm}
                onChange={(e) => setSlotAmpm(e.target.value)}
                className={s.scheduleTimeSelect}
              >
                <option>AM</option>
                <option>PM</option>
              </select>

              <button
                type="button"
                onClick={addSlotToForm}
                className={s.addSlotButton + " " + s.cursorPointer}
              >
                <Plus size={18} /> Add Slot
              </button>
            </div>

            <div className={s.slotsGrid}>
              {getFlatSlots(form.schedule).map(({ date, time }) => (
                <div key={date + time} className={s.slotItem}>
                  <span>
                    {formatDateISO(date)} — {time}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSlot(date, time)}
                    className={"text-rose-500 " + s.cursorPointer}
                    aria-label={`Remove slot ${date} ${time}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={s.submitButtonContainer}>
            <button
              type="submit"
              disabled={loading}
              className={
                s.submitButton +
                " " +
                s.cursorPointer +
                " " +
                (loading ? s.submitButtonDisabled : s.submitButtonEnabled)
              }
            >
              {loading ? "Adding..." : "Add Doctor to Team"}
            </button>
          </div>

          {toast.show && (
            <div
              className={
                s.toastContainer +
                " " +
                (toast.type === "success" ? s.toastSuccess : s.toastError)
              }
            >
              {toast.type === "success" ? (
                <CheckCircle size={22} />
              ) : (
                <XCircle size={22} />
              )}
              <span>{toast.message}</span>
            </div>
          )}

          <div className={s.doctorListContainer}>
            {doctorList.length ? (
              <div className={s.doctorListGrid}>
                {doctorList.map((d) => (
                  <div key={d.id || d._id} className={s.doctorCard}>
                    <div className={s.doctorCardContent}>
                      <Image
                        src={d.imageUrl}
                        alt={d.name}
                        className={s.doctorImage}
                        width={120}
                        height={120}
                      />

                      <div>
                        <div className={s.doctorName}>{d.name}</div>
                        <div className={s.doctorSpecialization}>
                          {d.specialization}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={s.emptyState}>No Doctor</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
