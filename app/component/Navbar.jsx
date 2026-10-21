'use client'

import React, { useState, useEffect, useRef } from 'react'
import { navbarStyles as s } from '@/app/assets/dummyStyles.js'
import { usePathname } from 'next/navigation'
import { Show, SignInButton, UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'
import logo from '@/app/assets/logo.png'
import { Key, Menu, User, X } from 'lucide-react'

const STORAGE_KEY = 'doctorToken_v1'

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Doctors', href: '/doctors' },
  { label: 'Services', href: '/services' },
  { label: 'Appointments', href: '/appointments' },
  { label: 'Contact', href: '/contact' },
]

const Navbar = () => {
  const [showNavbar, setShowNavbar] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [isDoctorLoggedIn, setIsDoctorLoggedIn] = useState(false)
  const lastScrollY = useRef(0)
  const navRef = useRef(null)
  const pathname = usePathname()

  const isActiveLink = (href) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  // Where the Doctor Admin button points
  const doctorAdminHref = isDoctorLoggedIn
    ? '/doctor-admin/dashboard'
    : '/doctor-admin/login'

  // Hide navbar on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY.current && currentScrollY > 80) {
        setShowNavbar(false)
        setIsOpen(false)
      } else {
        setShowNavbar(true)
      }
      lastScrollY.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Read doctor token on mount, then keep in sync with other tabs
  useEffect(() => {
    try {
      setIsDoctorLoggedIn(Boolean(localStorage.getItem(STORAGE_KEY)))
    } catch {
      setIsDoctorLoggedIn(false)
    }

    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        setIsDoctorLoggedIn(Boolean(e.newValue))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Close mobile menu when clicking outside the navbar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && navRef.current && !navRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <>
      <div className={s.navbarBorder} />

      <nav
        ref={navRef}
        className={`${s.navbarContainer} ${showNavbar ? s.navbarVisible : s.navbarHidden}`}
      >
        <div className={s.contentWrapper}>
          <div className={s.flexContainer}>
            {/* LOGO */}
            <Link href="/" className={s.logoLink}>
              <div className={s.logoContainer}>
                <div className={s.logoImageWrapper}>
                  <Image src={logo} alt="logo" className={s.logoImage} />
                </div>
              </div>
              <div className={s.logoTextContainer}>
                <h1 className={s.logoTitle}>MediCare</h1>
                <p className={s.logoSubtitle}>Healthcare Solutions</p>
              </div>
            </Link>

            {/* DESKTOP NAV */}
            <div className={s.desktopNav}>
              <div className={s.navItemsContainer}>
                {navItems.map((item) => (
                  <Link
                    href={item.href}
                    key={item.href}
                    className={`${s.navItem} ${isActiveLink(item.href) ? s.navItemActive : s.navItemInactive
                      }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className={s.rightContainer}>
              {/* Doctor Admin: visible only when signed out */}
              <Show when="signed-out">
                <Link href={doctorAdminHref} className={s.doctorAdminButton}>
                  <User className={s.doctorAdminIcon} />
                  <span className={s.doctorAdminText}>Doctor Admin</span>
                </Link>

                <SignInButton mode="modal">
                  <button className={s.loginButton}>
                    <Key className={s.loginIcon} />
                    Login
                  </button>
                </SignInButton>
              </Show>

              <Show when="signed-in">
                <UserButton />
              </Show>

              <button
                onClick={() => setIsOpen((prev) => !prev)}
                className={s.mobileToggle}
                aria-label="Toggle menu"
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <X className={s.toggleIcon} />
                ) : (
                  <Menu className={s.toggleIcon} />
                )}
              </button>
            </div>
          </div>

          {/* MOBILE MENU */}
          {isOpen && (
            <div className={s.mobileMenu}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`${s.mobileMenuItem} ${isActiveLink(item.href)
                      ? s.mobileMenuItemActive
                      : s.mobileMenuItemInactive
                    }`}
                >
                  {item.label}
                </Link>
              ))}

              {/* Doctor Admin + Login: visible only when signed out */}
              <Show when="signed-out">
                <Link
                  href={doctorAdminHref}
                  className={s.mobileDoctorAdminButton}
                  onClick={() => setIsOpen(false)}
                >
                  Doctor Admin
                </Link>

                <div className={s.mobileLoginContainer}>
                  <SignInButton mode="modal">
                    <button
                      className={s.mobileLoginButton}
                      onClick={() => setIsOpen(false)}
                    >
                      Login
                    </button>
                  </SignInButton>
                </div>
              </Show>
            </div>
          )}
        </div>

        <style>{s.animationStyles}</style>
      </nav>
    </>
  )
}

export default Navbar