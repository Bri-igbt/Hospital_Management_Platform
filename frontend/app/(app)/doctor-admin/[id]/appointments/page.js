"use client";

import DoctorNavbar from "@/app/component/doctor/DoctorNavbar.js";
import ListPage from "@/app/component/doctor/ListPage.js";
import React from "react";

const Page = () => {
  return (
    <div className="min-h-screen">
      <DoctorNavbar />
      <main className="pt-16 md:pt-20">
        <ListPage />
      </main>
    </div>
  );
};

export default Page;
