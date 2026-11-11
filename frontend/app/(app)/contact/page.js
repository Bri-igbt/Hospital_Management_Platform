"use client";

import Footer from "@/app/component/Footer.js";
import Navbar from "@/app/component/Navbar.js";
import React, { useState, useEffect } from "react";
import { contactPageStyles as s } from "@/app/assets/dummyStyles.js";
import {
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  SendHorizonal,
  Stethoscope,
  User,
} from "lucide-react";

const WHATSAPP_NUMBER = "2348117862013";

const INITIAL_FORM = {
  name: "",
  email: "",
  phone: "",
  department: "",
  service: "",
  message: "",
};

const DEPARTMENTS = [
  "General Physician",
  "Cardiology",
  "Orthopedics",
  "Dermatology",
  "Pediatrics",
  "Gynecology",
];

const SERVICES_MAPPING = {
  "General Physician": [
    "General Consultation",
    "Adult Checkup",
    "Vaccination",
    "Health Screening",
  ],
  Cardiology: ["ECG", "Echocardiography", "Stress Test", "Heart Consultation"],
  Orthopedics: ["Fracture Care", "Joint Pain Consultation", "Physiotherapy"],
  Dermatology: ["Skin Consultation", "Allergy Test", "Acne Treatment"],
  Pediatrics: ["Child Checkup", "Vaccination (Child)", "Growth Monitoring"],
  Gynecology: ["Antenatal Care", "Pap Smear", "Ultrasound"],
};

const GENERIC_SERVICES = [
  "General Consultation",
  "ECG",
  "Blood Test",
  "X-Ray",
  "Ultrasound",
  "Physiotherapy",
  "Vaccination",
];

function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234") && digits.length >= 13) {
    digits = "0" + digits.slice(3, 13);
  } else if (digits.length === 10 && !digits.startsWith("0")) {
    digits = "0" + digits;
  }
  return digits.slice(0, 11);
}

const isValidPhone = (p) => /^0\d{10}$/.test(normalizePhone(p));

const Page = () => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(false), 4000);
    return () => clearTimeout(t);
  }, [sent]);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = "Full name is required";

    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      e.email = "Enter a valid email";

    if (!form.phone.trim()) e.phone = "Phone number is required";
    else if (!isValidPhone(form.phone))
      e.phone = "Enter an 11-digit number, e.g. 08117862013";

    if (!form.department && !form.service) {
      e.department = "Please choose a department or service";
      e.service = "Please choose a department or service";
    }

    if (!form.message.trim()) e.message = "Please write a short message";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => {
      if (name === "department") {
        return { ...prev, department: value, service: "" };
      }
      if (name === "phone") {
        return { ...prev, phone: value.replace(/[^\d+\s]/g, "") };
      }
      return { ...prev, [name]: value };
    });

    setErrors((prev) => {
      const copy = { ...prev, [name]: undefined };
      if ((name === "department" || name === "service") && value) {
        delete copy.department;
        delete copy.service;
      }
      return copy;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const text = [
      "*Contact Request*",
      `Name: ${form.name.trim()}`,
      `Email: ${form.email.trim()}`,
      `Phone: ${normalizePhone(form.phone)}`,
      `Department: ${form.department || "N/A"}`,
      `Service: ${form.service || "N/A"}`,
      `Message: ${form.message.trim()}`,
    ].join("\n");

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      text
    )}`;

    const win = window.open(url, "_blank");
    if (!win) {
      window.location.href = url;
      return;
    }
    win.opener = null;

    setForm(INITIAL_FORM);
    setErrors({});
    setSent(true);
  }

  const availableServices = form.department
    ? SERVICES_MAPPING[form.department] || []
    : GENERIC_SERVICES;

  return (
    <div>
      <Navbar />

      <div className={s.pageContainer}>
        <div className={s.bgAccent1} />
        <div className={s.bgAccent2} />

        <div className={s.gridContainer}>
          <div className={s.formContainer}>
            <h2 className={s.formTitle}>Contact Our Clinic</h2>
            <p className={s.formSubtitle}>
              Complete the form, and we’ll redirect you to WhatsApp to connect
              with our team instantly.
            </p>

            <form onSubmit={handleSubmit} noValidate className={s.formSpace}>
              <div className={s.formGrid}>
                <div>
                  <label htmlFor="contact-name" className={s.label}>
                    <User size={16} /> Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Full Name"
                    className={s.input}
                  />
                  {errors.name && <p className={s.error}>{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="contact-email" className={s.label}>
                    <Mail size={16} /> Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="example@yahoo.com"
                    className={s.input}
                  />
                  {errors.email && <p className={s.error}>{errors.email}</p>}
                </div>
              </div>

              <div className={s.formGrid}>
                <div>
                  <label htmlFor="contact-phone" className={s.label}>
                    <Phone size={16} /> Phone
                  </label>
                  <input
                    id="contact-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="08012345678"
                    className={s.input}
                    maxLength={17}
                    aria-invalid={!!errors.phone}
                  />
                  {errors.phone && <p className={s.error}>{errors.phone}</p>}
                </div>

                <div>
                  <label htmlFor="contact-department" className={s.label}>
                    <MapPin size={16} /> Department
                  </label>
                  <select
                    id="contact-department"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    className={s.input}
                  >
                    <option value="">Select Department</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {errors.department && (
                    <p className={s.error}>{errors.department}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="contact-service" className={s.label}>
                  <Stethoscope size={16} /> Service
                </label>
                <select
                  id="contact-service"
                  name="service"
                  value={form.service}
                  onChange={handleChange}
                  className={s.input}
                >
                  <option value="">
                    Select Service (or choose Department above)
                  </option>

                  {availableServices.map((svc) => (
                    <option value={svc} key={svc}>
                      {svc}
                    </option>
                  ))}
                </select>

                {errors.service && <p className={s.error}>{errors.service}</p>}
              </div>

              <div>
                <label htmlFor="contact-message" className={s.label}>
                  <MessageSquare size={16} /> Message
                </label>

                <textarea
                  id="contact-message"
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Describe your concern briefly"
                  rows={4}
                  maxLength={600}
                  className={s.textarea}
                />
                {errors.message && <p className={s.error}>{errors.message}</p>}
              </div>

              <div className={s.buttonContainer}>
                <button type="submit" className={s.button}>
                  <SendHorizonal size={18} />
                  <span>Send via WhatsApp</span>
                </button>

                {sent && (
                  <p className={s.sentMessage}>
                    Opening WhatsApp and clearing form...
                  </p>
                )}
              </div>
            </form>
          </div>

          <div className={s.infoContainer}>
            <div className={s.infoCard}>
              <h3 className={s.infoTitle}>Visit Our Clinic</h3>
              <p className={s.infoText}>Lagos, Nigeria</p>
              <p className={s.infoItem}>
                <Phone size={16} />
                +2348117862013
              </p>
              <p className={s.infoItem}>
                <Mail size={16} />
                info@medicare.com
              </p>
            </div>

            <iframe
              src="https://www.google.com/maps?q=Lekki,Lagos,Nigeria&output=embed"
              className={s.map}
              title="Lagos Map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            ></iframe>

            <div className={s.hoursContainer}>
              <h4 className={s.hoursTitle}>Clinic Hours</h4>
              <p className={s.hoursText}>Mon - Sat: 9:00AM - 6:00PM</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Page;
