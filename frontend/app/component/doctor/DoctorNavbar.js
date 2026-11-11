"use client";

import React, { useMemo, useState } from "react";
import { navbarStylesDr as s } from "@/app/assets/dummyStyles.js";
import logo from "@/app/assets/logo.png";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Calendar, Edit, Home, LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const STORAGE_KEY = "doctorToken_v1";

const DoctorNavbar = () => {
  const [open, setOpen] = useState(false);
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  const doctorId = useMemo(() => {
    if (params?.id) return params.id;
    const m = pathname?.match(/\/doctor-admin\/([^/]+)/);
    if (m) return m[1];
    return null;
  }, [params, pathname]);

  const basePath = doctorId
    ? `/doctor-admin/${doctorId}`
    : "/doctor-admin/login";

  const navItems = [
    { name: "Dashboard", to: basePath, Icon: Home },
    { name: "Appointments", to: `${basePath}/appointments`, Icon: Calendar },
    { name: "Edit Profile", to: `${basePath}/profile/edit`, Icon: Edit },
  ];

  const isActive = (to) =>
    to === basePath ? pathname === to : pathname?.startsWith(to);

  const handleLogout = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: null })
      );
    } catch (err) {
      console.error("logout error", err);
    }
    router.push("/doctor-admin/login");
  };

  return (
    <div className={s.navContainer}>
      <div className={s.leftBrand}>
        <div className={s.logoContainer}>
          <Image
            src={logo}
            alt="logo"
            className={s.logoImage}
            width={120}
            height={120}
          />
        </div>

        <div className={s.brandTextContainer}>
          <div className={s.brandTitle}>MedTek</div>
          <div className={s.brandSubtitle}>Healthcare Solution</div>
        </div>
      </div>

      <div className={s.desktopMenu}>
        <div className={s.desktopMenuItems}>
          {navItems.map(({ name, to, Icon }) => (
            <Link
              key={to}
              href={to}
              className={`${s.baseLink} ${
                isActive(to) ? s.activeLink : s.inactiveLink
              }`}
              onClick={() => setOpen(false)}
            >
              <span className={s.linkContent}>
                <Icon size={16} className={s.linkIcon} />
                <span className={s.linkText}>{name}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className={s.rightActions}>
        <button onClick={handleLogout} className={s.logoutButtonDesktop}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default DoctorNavbar;
