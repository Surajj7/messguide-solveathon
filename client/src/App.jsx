import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import StudentLayout from "./layouts/StudentLayout.jsx";
import StudentHome from "./pages/student/StudentHome.jsx";
import StudentMenu from "./pages/student/StudentMenu.jsx";
import StudentCalendar from "./pages/student/StudentCalendar.jsx";
import MenuItemPage from "./pages/student/MenuItemPage.jsx";
import AIChatPage from "./pages/student/AIChatPage.jsx";
import CommunityPage from "./pages/student/CommunityPage.jsx";
import SuggestionsPage from "./pages/student/SuggestionsPage.jsx";
import NightMessPage from "./pages/student/NightMessPage.jsx";
import NotificationsPage from "./pages/student/NotificationsPage.jsx";
import ProfilePage from "./pages/student/ProfilePage.jsx";
import AdvancedRequestsPage from "./pages/student/AdvancedRequestsPage.jsx";
import CalorieTrackerPage from "./pages/student/CalorieTrackerPage.jsx";
import LeftoversPage from "./pages/student/LeftoversPage.jsx";
import MessSwapLayout from "./layouts/MessSwapLayout.jsx";
import MessSwapHubPage from "./pages/student/MessSwapHubPage.jsx";
import CatererSwapPage from "./pages/student/CatererSwapPage.jsx";
import MessUpgradePage from "./pages/student/MessUpgradePage.jsx";
import MessSwapHistoryPage from "./pages/student/MessSwapHistoryPage.jsx";
import StudentAttendancePage from "./pages/student/StudentAttendancePage.jsx";
import MessDashboard from "./pages/mess/MessDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import ParentDashboard from "./pages/parent/ParentDashboard.jsx";
import StudentVotingPage from "./pages/student/StudentVotingPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        path="/"
        element={
          user ? (
            user.role === "STUDENT" ? (
              <Navigate to="/app" replace />
            ) : user.role === "MESS_INCHARGE" ? (
              <Navigate to="/mess" replace />
            ) : user.role === "PARENT" ? (
              <Navigate to="/parent" replace />
            ) : (
              <Navigate to="/admin" replace />
            )
          ) : (
            <LandingPage />
          )
        }
      />

      <Route
        path="/app"
        element={
          <PrivateRoute roles={["STUDENT"]}>
            <StudentLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<StudentHome />} />
        <Route path="menu" element={<StudentMenu />} />
        <Route path="calendar" element={<StudentCalendar />} />
        <Route path="item/:itemId" element={<MenuItemPage />} />
        <Route path="ai" element={<AIChatPage />} />
        <Route path="community" element={<CommunityPage />} />
        <Route path="suggestions" element={<SuggestionsPage />} />
        <Route path="night" element={<NightMessPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="advanced-requests" element={<AdvancedRequestsPage />} />
        <Route path="calories" element={<CalorieTrackerPage />} />
        <Route path="leftovers" element={<LeftoversPage />} />
        <Route path="mess-swap" element={<MessSwapLayout />}>
          <Route index element={<MessSwapHubPage />} />
          <Route path="caterer" element={<CatererSwapPage />} />
          <Route path="upgrade" element={<MessUpgradePage />} />
          <Route path="history" element={<MessSwapHistoryPage />} />
        </Route>
        <Route path="attendance" element={<StudentAttendancePage />} />
        <Route path="voting" element={<StudentVotingPage />} />
      </Route>

      <Route
        path="/parent/*"
        element={
          <PrivateRoute roles={["PARENT"]}>
            <ParentDashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/mess/*"
        element={
          <PrivateRoute roles={["MESS_INCHARGE", "ADMIN"]}>
            <MessDashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/*"
        element={
          <PrivateRoute roles={["ADMIN"]}>
            <AdminDashboard />
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
