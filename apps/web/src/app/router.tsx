import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminApiAuthFailureBridge } from '../features/auth/admin-api-auth-failure-bridge';
import { LoginPage } from '../features/auth/login-page';
import { ProtectedRoute } from '../features/auth/protected-route';
import { AdminShell } from './layout/admin-shell';
import { ConversationDetailPage } from '../pages/conversation-detail-page';
import { ConversationsPage } from '../pages/conversations-page';
import { ChatsPage } from '../pages/chats-page';
import { DashboardPage } from '../pages/dashboard-page';
import { LogsPage } from '../pages/logs-page';
import { ProfilePage } from '../pages/profile-page';
import { ReminderSettingsGuidePage } from '../pages/reminder-settings-guide-page';
import { ReminderSettingsPage } from '../pages/reminder-settings-page';
import { RemindersPage } from '../pages/reminders-page';
import { SurveySettingsPage } from '../pages/survey-settings-page';
import { SurveysPage } from '../pages/surveys-page';
import { UnauthorizedPage } from '../pages/unauthorized-page';

export function AppRouter() {
  return (
    <>
      <AdminApiAuthFailureBridge />
      <Routes>
        <Route path="/" element={<Navigate replace to="/admin/dashboard" />} />
        <Route path="/admin" element={<Navigate replace to="/admin/dashboard" />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/unauthorized" element={<UnauthorizedPage />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminShell />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="chats" element={<ChatsPage />} />
          <Route path="conversations" element={<ConversationsPage />} />
          <Route
            path="conversations/:conversationId"
            element={<ConversationDetailPage />}
          />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="reminders/settings" element={<ReminderSettingsPage />} />
          <Route path="reminders/settings/guide" element={<ReminderSettingsGuidePage />} />
          <Route path="surveys" element={<SurveysPage />} />
          <Route path="surveys/settings" element={<SurveySettingsPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate replace to="/admin/dashboard" />} />
      </Routes>
    </>
  );
}
