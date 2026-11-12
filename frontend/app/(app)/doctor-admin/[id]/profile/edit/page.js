"use client";

import React from "react";
import DoctorNavbar from "@/app/component/doctor/DoctorNavbar.js";
import EditProfile from "@/app/component/doctor/EditProfile.js";

const Page = () => {
  return (
    <div className="min-h-screen">
      <DoctorNavbar />
      <main className="pt-16 md:pt-20">
        <EditProfile />
      </main>
    </div>
  );
};

export default Page;
