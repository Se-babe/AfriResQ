import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Layout } from './components/Layout.jsx';
import { Landing } from './pages/Landing.jsx';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { Report } from './pages/Report.jsx';
import { MyReports } from './pages/MyReports.jsx';
import { EmergencyDetail } from './pages/EmergencyDetail.jsx';
import { ResponderConsole } from './pages/ResponderConsole.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Responders } from './pages/Responders.jsx';
import { Organizations } from './pages/Organizations.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Guest><Login /></Guest>} />
        <Route path="/register" element={<Guest><Register /></Guest>} />
        <Route path="/report" element={<Report />} />
        <Route path="/reports" element={<Require roles={['citizen']}><MyReports /></Require>} />
        <Route path="/emergencies/:id" element={<Require><EmergencyDetail /></Require>} />
        <Route path="/respond" element={<Require roles={['responder']}><ResponderConsole /></Require>} />
        <Route path="/dashboard" element={<Require roles={['coordinator', 'admin']}><Dashboard /></Require>} />
        <Route path="/responders" element={<Require roles={['coordinator', 'admin']}><Responders /></Require>} />
        <Route path="/organizations" element={<Require roles={['coordinator', 'admin']}><Organizations /></Require>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function Guest({ children }) {
  const { user } = useAuth();
  if (user) {
    if (user.role === 'responder') return <Navigate to="/respond" replace />;
    if (user.role === 'coordinator' || user.role === 'admin') return <Navigate to="/dashboard" replace />;
    return <Navigate to="/report" replace />;
  }
  return children;
}

function Require({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
