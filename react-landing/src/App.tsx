import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { CustomerPage } from './pages/CustomerPage';
import { BrokerPage } from './pages/BrokerPage';
import { AuthModal } from './components/AuthModal';
import { RoleRoute } from './components/RoleRoute';
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
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
        </Routes>
        <AuthModal />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
