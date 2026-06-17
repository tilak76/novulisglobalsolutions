import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SuperAdminDashboard from './pages/SuperAdmin';
import AdminDashboard from './pages/Admin';
import UserDashboard from './pages/User';
import ComplianceDashboard from './pages/ComplianceDashboard';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/compliance" element={<ComplianceDashboard />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      <Route path="/super-admin/*" element={
        <ProtectedRoute allowedRoles={['SuperAdmin']}>
          <SuperAdminDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['Admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      
      <Route path="/user/*" element={
        <ProtectedRoute allowedRoles={['User']}>
          <UserDashboard />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;
