import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem('token');
  const role = localStorage.getItem('role');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === 'SuperAdmin') return <Navigate to="/super-admin" replace />;
    if (role === 'Admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/user" replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
