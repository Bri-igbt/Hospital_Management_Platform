import React from 'react'
import Navbar from '@/app/component/Navbar.js'
import Banner from '@/app/component/Banner.js'
import Certification from '@/app/component/Certification.js'
import HomeDoctors from '@/app/component/HomeDoctors.js'
import Testimonal from '@/app/component/Testimonal.js'
import Footer from '@/app/component/Footer.js'

const page = () => {
  return (
    <div>
      <Navbar />
      <Banner />
      <Certification />
      <HomeDoctors />
      <Testimonal />
      <Footer />
    </div>
  )
}

export default page
