"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Grid,
  Home,
  List,
  Menu,
  PlusSquare,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { navbarStyles as ns } from "../assets/dummyStyles.js";
import logoImg from "@/app/assets/logo.png";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: Home },
  { href: "/add", label: "Add Doctor", Icon: UserPlus },
  { href: "/list", label: "List Doctors", Icon: Users },
  { href: "/appointments", label: "Appointments", Icon: Calendar },
  { href: "/service-dashboard", label: "Service Dashboard", Icon: Grid },
  { href: "/add-service", label: "Add Service", Icon: PlusSquare },
  { href: "/list-service", label: "List Services", Icon: List },
  {
    href: "/service-appointments",
    label: "Service Appointments",
    Icon: Calendar,
  },
];

const isActiveLink = (pathname, href) =>
  pathname === href || pathname.startsWith(`${href}/`);

function CenterNavItem({ href, icon, label }) {
  const pathname = usePathname();
  const isActive = isActiveLink(pathname, href);

  return (
    <div>
      <Link
        href={href}
        className={`nav-item ${isActive ? "active" : ""} ${
          ns.centerNavItemBase
        } ${isActive ? ns.centerNavItemActive : ns.centerNavItemInactive}`}
      >
        <span>{icon}</span>
        <span className="text-xs">{label}</span>
      </Link>
    </div>
  );
}

function MobileItem({ href, icon, label, onClick }) {
  const pathname = usePathname();
  const isActive = isActiveLink(pathname, href);

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`nav-item ${isActive ? "active" : ""} ${ns.mobileItemBase} ${
        isActive ? ns.mobileItemActive : ns.mobileItemInactive
      }`}
    >
      <span>{icon}</span>
      <span className="text-xs">{label}</span>
    </Link>
  );
}

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const navInnerRef = useRef(null);
  const indicatorRef = useRef(null);
  const pathname = usePathname();
  const clerk = useClerk();
  const { isSignedIn, isLoaded } = useAuth();

  const moveIndicator = useCallback(() => {
    const container = navInnerRef.current;
    const ind = indicatorRef.current;
    if (!container || !ind) return;

    const active = container.querySelector(".nav-item.active");
    if (!active) {
      ind.style.opacity = "0";
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const left = activeRect.left - containerRect.left + container.scrollLeft;

    ind.style.transform = `translateX(${left}px)`;
    ind.style.width = `${activeRect.width}px`;
    ind.style.opacity = "1";
  }, []);

  useLayoutEffect(() => {
    moveIndicator();
    const t = setTimeout(moveIndicator, 120);
    return () => clearTimeout(t);
  }, [pathname, moveIndicator]);

  useEffect(() => {
    const container = navInnerRef.current;
    if (!container) return;

    container.addEventListener("scroll", moveIndicator, { passive: true });

    const ro = new ResizeObserver(moveIndicator);
    ro.observe(container);
    if (container.parentElement) ro.observe(container.parentElement);

    window.addEventListener("resize", moveIndicator);
    moveIndicator();

    return () => {
      container.removeEventListener("scroll", moveIndicator);
      ro.disconnect();
      window.removeEventListener("resize", moveIndicator);
    };
  }, [moveIndicator]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleOpenSignIn = () => {
    clerk.openSignIn({ forceRedirectUrl: "/dashboard" });
  };

  const handleSignOut = async () => {
    try {
      await clerk.signOut({ redirectUrl: "/" });
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  return (
    <header className={ns.header}>
      <nav className={ns.navContainer}>
        <div className={ns.flexContainer}>
          <div className={ns.logoContainer}>
            <Image src={logoImg} alt="logo" className={ns.logoImage} />

            <Link href="/">
              <div className={ns.logoLink}>MediCare</div>
              <div className={ns.logoSubtext}>Healthcare Solutions</div>
            </Link>
          </div>

          <div className={ns.centerNavContainer}>
            <div className={ns.glowEffect}>
              <div className={ns.centerNavInner}>
                <div
                  ref={navInnerRef}
                  tabIndex={0}
                  className={ns.centerNavScrollContainer}
                  style={{
                    WebkitOverflowScrolling: "touch",
                    position: "relative",
                  }}
                >
                  {NAV_ITEMS.map(({ href, label, Icon }) => (
                    <CenterNavItem
                      key={href}
                      href={href}
                      label={label}
                      icon={<Icon size={16} />}
                    />
                  ))}

                  <div
                    ref={indicatorRef}
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: 0,
                      bottom: 0,
                      height: "2px",
                      width: 0,
                      opacity: 0,
                      borderRadius: "9999px",
                      background: "linear-gradient(90deg, #10b981, #06b6d4)",
                      transition:
                        "transform 0.3s ease, width 0.3s ease, opacity 0.2s ease",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={ns.rightContainer}>
            {isLoaded &&
              (isSignedIn ? (
                <button
                  onClick={handleSignOut}
                  className={ns.signOutButton + " " + ns.cursorPointer}
                >
                  Sign Out
                </button>
              ) : (
                <div className="hidden lg:flex items-center gap-2">
                  <button
                    onClick={handleOpenSignIn}
                    className={ns.loginButton + " " + ns.cursorPointer}
                  >
                    Login
                  </button>
                </div>
              ))}

            <button
              onClick={() => setOpen((v) => !v)}
              className={ns.mobileMenuButton}
              aria-label="Toggle menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {open && (
          <div className={ns.mobileOverlay} onClick={() => setOpen(false)} />
        )}

        {open && (
          <div className={ns.mobileMenuContainer} id="mobile-menu">
            <div className={ns.mobileMenuInner}>
              {NAV_ITEMS.map(({ href, label, Icon }) => (
                <MobileItem
                  key={href}
                  href={href}
                  label={label}
                  icon={<Icon size={16} />}
                  onClick={() => setOpen(false)}
                />
              ))}

              <div className={ns.mobileAuthContainer}>
                {isLoaded &&
                  (isSignedIn ? (
                    <button
                      onClick={() => {
                        setOpen(false);
                        handleSignOut();
                      }}
                      className={ns.mobileSignOutButton}
                    >
                      Sign Out
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setOpen(false);
                          handleOpenSignIn();
                        }}
                        className={
                          ns.mobileLoginButton + " " + ns.cursorPointer
                        }
                      >
                        Login
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
