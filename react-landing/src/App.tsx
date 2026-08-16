import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { CustomerPage } from './pages/CustomerPage';
import { BrokerPage } from './pages/BrokerPage';
import { BrokerCommissionPage } from './pages/BrokerCommissionPage';
import { AuthModal } from './components/AuthModal';
import { RoleRoute } from './components/RoleRoute';
import { AuthProvider, useAuth } from './hooks/useAuth';
import type { Role } from './services/authApi';

const roleHome: Record<Role, string> = {
  customer: '/customer',
  broker: '/broker',
};

/** A returning visitor with an active session (e.g. reopening the tab) should land on
 * their own dashboard, not the marketing landing page. Signed-out visitors see the
 * landing page as normal. */
function HomeRoute() {
  const { session } = useAuth();
  if (session) return <Navigate to={roleHome[session.role]} replace />;
  return <LandingPage />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route
            path="/customer"
            element={
              <RoleRoute role="customer">
                <CustomerPage />
              </RoleRoute>
            }
          />
          <Route
            path="/broker"
            element={
              <RoleRoute role="broker">
                <BrokerPage />
              </RoleRoute>
            }
          />
          <Route
            path="/broker/commission"
            element={
              <RoleRoute role="broker">
                <BrokerCommissionPage />
              </RoleRoute>
            }
          />
        </Routes>
        <AuthModal />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
