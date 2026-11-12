"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/$/, "");

const Page = () => {
  const router = useRouter();
  const [message, setMessage] = useState("Confirming your payment...");

  useEffect(() => {
    let cancelled = false;

    const go = (status) => {
      if (!cancelled) {
        router.replace(`/appointments?payment_status=${status}`);
      }
    };

    const verifyPayment = async () => {
      const { pathname, search } = window.location;
      const sessionId = new URLSearchParams(search).get("session_id");
      const isService = pathname.startsWith("/service-appointment");

      if (pathname.endsWith("/cancel")) {
        setMessage("Payment cancelled. Taking you back...");
        go("Cancelled");
        return;
      }

      if (!sessionId) {
        go("Failed");
        return;
      }

      try {
        const endpoint = isService
          ? "/api/service-appointments/confirm"
          : "/api/appointments/confirm";

        const res = await axios.get(`${API_BASE}${endpoint}`, {
          params: { session_id: sessionId },
          timeout: 15000,
        });

        go(res?.data?.success ? "Paid" : "Failed");
      } catch (error) {
        console.error("Payment verification failed:", error);
        go("Failed");
      }
    };

    verifyPayment();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-gray-600" role="status">
        {message}
      </p>
    </div>
  );
};

export default Page;
