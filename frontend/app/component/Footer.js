'use client'

import React from 'react'
import { footerStyles as s } from '@/app/assets/dummyStyles.js'
import logo from '@/app/assets/logo.png'
import { Activity, Stethoscope } from 'lucide-react'
import Image from 'next/image.js'

const Footer = () => {
  const currenYear = new Date().getFullYear();

  const quickLinks = [
    { name: "Home", href: "/" },
    { name: "Doctors", href: "/doctors" },
    { name: "Services", href: "/services" },
    { name: "Contact", href: "/contact" },
    { name: "Appointments", href: "/appointments" },
  ];

  const services = [
    { name: "Blood Pressure Check", href: "/services" },
    { name: "Blood Sugar Test", href: "/services" },
    { name: "Full Blood Count", href: "/services" },
    { name: "X-Ray Scan", href: "/services" },
    { name: "Blood Sugar Test", href: "/services" },
  ];

  const socialLinks = [
    {
      Icon: Facebook,
      color: footerStyles.facebookColor,
      name: "Facebook",
      href: "https://www.facebook.com/people/Hexagon-Digital-Services/61567156598660/",
    },
    {
      Icon: Twitter,
      color: footerStyles.twitterColor,
      name: "Twitter",
      href: "https://www.linkedin.com/company/hexagondigtial-services/",
    },
    {
      Icon: Instagram,
      color: footerStyles.instagramColor,
      name: "Instagram",
      href: "http://instagram.com/hexagondigitalservices?igsh=MWp2NG1oNTlibWVnZA%3D%3D",
    },
    {
      Icon: Linkedin,
      color: footerStyles.linkedinColor,
      name: "LinkedIn",
      href: "https://www.linkedin.com/company/hexagondigtial-services/",
    },
    {
      Icon: Youtube,
      color: footerStyles.youtubeColor,
      name: "YouTube",
      href: "https://youtube.com/@hexagondigitalservices?si=lxEFYNCP42t6AoDJ",
    },
  ];

  return (
    <footer className={s.footerContainer}>
      <div className={s.floatingIcon1}>
        <Stethoscope className={s.stethoscopeIcon} />
      </div>

      <div
        className={s.floatingIcon2}
        style={{
          animationDelay: "3s"
        }}
      >
        <Activity className={s.activityIcon} />
      </div>

      <div className={s.mainContent}>
        <div className={s.gridContainer}>
          <div className={s.companySection}>
            <div className={s.logoWrapper}>
              <div className={s.logoImageContainer}>
                <Image
                  src={logo}
                  alt='logo'
                  className={s.logoImage}
                  width={120}
                  height={120}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
