import RequireAuth from "@/app/components/Requireauth.js"
import Navbar from "@/app/components/Navbar";

export default function DashboardLayout({ children }) {
  return (
    <RequireAuth>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
      </div>
    </RequireAuth>
  );
}
