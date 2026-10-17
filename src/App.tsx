import { Routes, Route } from "react-router-dom";
import RootLayout from "./routes/__root";
import Index from "./routes/index";
import Auth from "./routes/auth";
import Register from "./routes/register";
import ForgotPassword from "./routes/forgot-password";
import ResetPassword from "./routes/reset-password";
import AuthenticatedLayout from "./routes/_authenticated/route";
import Dashboard from "./routes/_authenticated/dashboard";
import Admin from "./routes/_authenticated/admin";
import AdminProfile from "./routes/_authenticated/admin.profile";
import Profile from "./routes/_authenticated/profile";
import Documents from "./routes/_authenticated/documents";
import EligibleSchemes from "./routes/_authenticated/eligible";
import AllSchemes from "./routes/_authenticated/schemes.index";
import SchemeDetail from "./routes/_authenticated/schemes.$id";
import Applications from "./routes/_authenticated/applications";
import Settings from "./routes/_authenticated/settings";

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        <Route element={<AuthenticatedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/profile" element={<AdminProfile />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/eligible" element={<EligibleSchemes />} />
          <Route path="/schemes" element={<AllSchemes />} />
          <Route path="/schemes/:id" element={<SchemeDetail />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}
