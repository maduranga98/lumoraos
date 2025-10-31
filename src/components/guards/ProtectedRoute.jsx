// src/components/guards/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useUser } from "../../contexts/userContext";

/**
 * ProtectedRoute Component
 * Protects routes based on authentication and permissions
 *
 * Usage:
 * <ProtectedRoute
 *   permission="hr_view_employees"
 *   fallback="/dashboard"
 * >
 *   <EmployeeList />
 * </ProtectedRoute>
 */
const ProtectedRoute = ({
  children,
  permission = null,
  permissions = [],
  requireAll = false,
  moduleAccess = null,
  adminOnly = false,
  fallback = "/dashboard",
  showUnauthorized = false,
}) => {
  const {
    loading,
    isAuthenticated,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasModuleAccess,
    isAdmin,
    isActive,
  } = useUser();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if account is active
  if (!isActive()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Account Inactive
          </h2>
          <p className="text-gray-600 mb-6">
            Your account has been deactivated. Please contact your
            administrator.
          </p>
        </div>
      </div>
    );
  }

  // Admin-only check
  if (adminOnly && !isAdmin()) {
    return showUnauthorized ? (
      <UnauthorizedAccess fallback={fallback} />
    ) : (
      <Navigate to={fallback} replace />
    );
  }

  // Single permission check
  if (permission && !hasPermission(permission)) {
    return showUnauthorized ? (
      <UnauthorizedAccess fallback={fallback} />
    ) : (
      <Navigate to={fallback} replace />
    );
  }

  // Multiple permissions check
  if (permissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);

    if (!hasAccess) {
      return showUnauthorized ? (
        <UnauthorizedAccess fallback={fallback} />
      ) : (
        <Navigate to={fallback} replace />
      );
    }
  }

  // Module access check
  if (moduleAccess && !hasModuleAccess(moduleAccess)) {
    return showUnauthorized ? (
      <UnauthorizedAccess fallback={fallback} />
    ) : (
      <Navigate to={fallback} replace />
    );
  }

  // All checks passed, render children
  return <>{children}</>;
};

// Unauthorized Access Component
const UnauthorizedAccess = ({ fallback }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-10 h-10 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page. Please contact your
          administrator if you believe this is an error.
        </p>
        <a
          href={fallback}
          className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Go Back to Dashboard
        </a>
      </div>
    </div>
  );
};

export default ProtectedRoute;

// =====================================================
// src/components/guards/PermissionGate.jsx
// =====================================================

/**
 * PermissionGate Component
 * Conditionally renders UI elements based on permissions
 *
 * Usage:
 * <PermissionGate permission="hr_edit_employees">
 *   <button>Edit</button>
 * </PermissionGate>
 */
export const PermissionGate = ({
  children,
  permission = null,
  permissions = [],
  requireAll = false,
  moduleAccess = null,
  canView: checkView = null,
  canAdd: checkAdd = null,
  canEdit: checkEdit = null,
  canDelete: checkDelete = null,
  adminOnly = false,
  fallback = null,
  hideIfNoAccess = true,
}) => {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasModuleAccess,
    canView,
    canAdd,
    canEdit,
    canDelete,
    isAdmin,
  } = useUser();

  // Admin check
  if (adminOnly && !isAdmin()) {
    return hideIfNoAccess ? null : fallback;
  }

  // Single permission check
  if (permission && !hasPermission(permission)) {
    return hideIfNoAccess ? null : fallback;
  }

  // Multiple permissions check
  if (permissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);

    if (!hasAccess) {
      return hideIfNoAccess ? null : fallback;
    }
  }

  // Module access check
  if (moduleAccess && !hasModuleAccess(moduleAccess)) {
    return hideIfNoAccess ? null : fallback;
  }

  // Specific action checks
  if (checkView && !canView(checkView)) {
    return hideIfNoAccess ? null : fallback;
  }

  if (checkAdd && !canAdd(checkAdd)) {
    return hideIfNoAccess ? null : fallback;
  }

  if (checkEdit && !canEdit(checkEdit)) {
    return hideIfNoAccess ? null : fallback;
  }

  if (checkDelete && !canDelete(checkDelete)) {
    return hideIfNoAccess ? null : fallback;
  }

  // All checks passed, render children
  return <>{children}</>;
};

// =====================================================
// USAGE EXAMPLES
// =====================================================

/*

// 1. PROTECTED ROUTE - Route-level protection
// In App.js or Routes file:

import ProtectedRoute from "./components/guards/ProtectedRoute";

<Route 
  path="/addemployees" 
  element={
    <ProtectedRoute permission="hr_add_employees">
      <AddUsers />
    </ProtectedRoute>
  }
/>

// Multiple permissions (any)
<Route 
  path="/employees" 
  element={
    <ProtectedRoute permissions={["hr_view_employees", "hr_edit_employees"]}>
      <UserList />
    </ProtectedRoute>
  }
/>

// Multiple permissions (all required)
<Route 
  path="/settings" 
  element={
    <ProtectedRoute 
      permissions={["settings_view_settings", "settings_edit_settings"]}
      requireAll={true}
    >
      <Settings />
    </ProtectedRoute>
  }
/>

// Module access
<Route 
  path="/logistics" 
  element={
    <ProtectedRoute moduleAccess="logistics">
      <LogisticsDashboard />
    </ProtectedRoute>
  }
/>

// Admin only
<Route 
  path="/admin-panel" 
  element={
    <ProtectedRoute adminOnly={true} showUnauthorized={true}>
      <AdminPanel />
    </ProtectedRoute>
  }
/>


// 2. PERMISSION GATE - UI element protection
// In any component:

import { PermissionGate } from "./components/guards/ProtectedRoute";

// Hide button if no permission
<PermissionGate permission="hr_edit_employees">
  <button>Edit Employee</button>
</PermissionGate>

// Show disabled button instead
<PermissionGate 
  permission="hr_delete_employees"
  fallback={<button disabled>Delete (No Permission)</button>}
  hideIfNoAccess={false}
>
  <button>Delete Employee</button>
</PermissionGate>

// Check if can add
<PermissionGate canAdd="products">
  <button>Add New Product</button>
</PermissionGate>

// Check if can edit
<PermissionGate canEdit="sales">
  <button>Edit Outlet</button>
</PermissionGate>

// Multiple permissions
<PermissionGate permissions={["sales_view_outlets", "sales_edit_outlets"]}>
  <div>Sales Management Panel</div>
</PermissionGate>

// Admin only
<PermissionGate adminOnly={true}>
  <div>Admin Settings</div>
</PermissionGate>

*/
