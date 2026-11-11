"use client";

import DoctorDashboard from "@/app/component/doctor/DoctorDashboard.js";
import DoctorNavbar from "@/app/component/doctor/DoctorNavbar.js";
import React from "react";

const Page = () => {
  return (
    <div className="min-h-screen">
      <DoctorNavbar />
      <main className="pt-16 md:pt-20">
        <DoctorDashboard />
      </main>
    </div>
  );
};

export default Page;
