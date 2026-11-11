"use client";

import React, { useState } from "react";
import {
  loginPageStyles as s,
  toastStyles as t,
} from "@/app/assets/dummyStyles.js";
import logo from "@/app/assets/logo.png";
import toast, { Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

const STORAGE_KEY = "doctorToken_v1";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const page = () => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error("All fields are required", {
        style: t.errorToast,
      });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/doctors/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(json?.message || "Login failed", {
          duration: 4000,
          style: t.errorToast,
        });
        return;
      }

      const token = json?.token || json?.data?.token;
      if (!token) {
        toast.error("Authentication token missing", {
          style: t.errorToast,
        });
        return;
      }

      const doctorId =
        json?.data?._id || json?.doctor?._id || json?.data?.doctor?._id;
      if (!doctorId) {
        toast.error("Doctor ID missing from server response", {
          style: t.errorToast,
        });
        return;
      }

      localStorage.setItem(STORAGE_KEY, token);
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: token })
      );

      toast.success("Login successful — redirecting...", {
        style: t.successToast,
      });

      setTimeout(() => {
        router.push(`/doctor-admin/${doctorId}`);
      }, 700);
    } catch (error) {
      console.error("login error", error);
      toast.error("Network error during login", {
        style: t.errorToast,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={s.mainContainer}>
      <Toaster position="top-right" reverseOrder={false} />

      <button onClick={() => router.push("/")} className={s.backButton}>
        <ArrowLeft className={s.backButtonIcon} />
        Back to home
      </button>

      <div className={s.loginCard}>
        <div className={s.logoContainer}>
          <Image
            src={logo}
            alt="logo"
            className={s.logo}
            width={120}
            height={120}
          />
        </div>

        <h2 className={s.title}>Doctor Admin</h2>
        <p className={s.subtitle}>Sign in to manage your profile & schedule</p>

        <form onSubmit={handleLogin} className={s.form}>
          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            className={s.input}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            className={s.input}
            required
          />

          <button type="submit" disabled={busy} className={s.submitButton}>
            {busy ? "Signing In..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default page;
