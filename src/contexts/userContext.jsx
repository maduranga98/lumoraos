// src/contexts/userContext.jsx
import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize user from localStorage/sessionStorage OR Firebase Auth
  useEffect(() => {
    const initializeUser = async () => {
      setLoading(true);

      // First, check for existing session in localStorage/sessionStorage
      const storedUser =
        localStorage.getItem("lumoraUser") ||
        sessionStorage.getItem("lumoraUser");

      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);

          // Fetch full user data from Firestore including permissions
          const userDoc = await getDoc(
            doc(db, "users", userData.userId || userData.id)
          );

          if (userDoc.exists()) {
            const firestoreData = userDoc.data();
            setUser({
              id: userData.userId || userData.id,
              uid: userData.userId || userData.id,
              userId: userData.userId || userData.id,
              email: userData.email || firestoreData.email,
              name: userData.fullName || firestoreData.fullName,
              fullName: userData.fullName || firestoreData.fullName,
              username: userData.username || firestoreData.username,
              phoneNumber: userData.phoneNumber || firestoreData.phoneNumber,
              displayName: userData.fullName || firestoreData.fullName,
              // Role & Permissions
              role: firestoreData.role || "User",
              roleType: firestoreData.roleType || "predefined",
              roleId: firestoreData.roleId || "",
              permissions: firestoreData.permissions || [],
              status: firestoreData.status || "active",
              isActive:
                userData.isActive !== undefined ? userData.isActive : true,
              isSuperAdmin: firestoreData.roleId === "superadmin" || userData.isSuperAdmin || false,
            });
          } else {
            // If user doc doesn't exist, use stored data
            setUser({
              id: userData.userId || userData.id,
              uid: userData.userId || userData.id,
              userId: userData.userId || userData.id,
              name: userData.fullName,
              fullName: userData.fullName,
              username: userData.username,
              phoneNumber: userData.phoneNumber,
              role: "User",
              permissions: [],
              isActive:
                userData.isActive !== undefined ? userData.isActive : true,
            });
          }
          setLoading(false);
          return;
        } catch (error) {
          console.error("Error loading user from storage:", error);
        }
      }

      // If no stored user, listen for Firebase auth state
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            // Get additional user data from Firestore
            const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));

            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUser({
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                userId: firebaseUser.uid,
                email: firebaseUser.email,
                name: userData.fullName,
                fullName: userData.fullName,
                username: userData.username,
                phoneNumber: userData.phoneNumber,
                displayName: firebaseUser.displayName,
                // Role & Permissions
                role: userData.role || "User",
                roleType: userData.roleType || "predefined",
                roleId: userData.roleId || "",
                permissions: userData.permissions || [],
                status: userData.status || "active",
              });
            } else {
              // Fallback to Firebase user data only
              setUser({
                id: firebaseUser.uid,
                uid: firebaseUser.uid,
                userId: firebaseUser.uid,
                email: firebaseUser.email,
                name: firebaseUser.displayName,
                fullName: firebaseUser.displayName,
                displayName: firebaseUser.displayName,
                role: "User",
                permissions: [],
              });
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            // Set basic user info on error
            setUser({
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              userId: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              fullName: firebaseUser.displayName,
              displayName: firebaseUser.displayName,
              role: "User",
              permissions: [],
            });
          }
        } else {
          setUser(null);
        }

        setLoading(false);
      });

      return () => unsubscribe();
    };

    initializeUser();
  }, []);

  const clearUser = () => {
    setUser(null);
    localStorage.removeItem("lumoraUser");
    localStorage.removeItem("lumoraSession");
    sessionStorage.removeItem("lumoraUser");
    sessionStorage.removeItem("lumoraSession");
  };

  const updateUser = (userData) => {
    setUser((prev) => {
      const updatedUser = {
        ...prev,
        ...userData,
      };

      // Also update localStorage/sessionStorage
      const storedInLocal = localStorage.getItem("lumoraUser");
      const storedInSession = sessionStorage.getItem("lumoraUser");

      if (storedInLocal) {
        localStorage.setItem("lumoraUser", JSON.stringify(updatedUser));
      }
      if (storedInSession) {
        sessionStorage.setItem("lumoraUser", JSON.stringify(updatedUser));
      }

      return updatedUser;
    });
  };

  // Custom setUser that also updates storage
  const setUserWithStorage = (userData) => {
    setUser(userData);

    // Check if remember me is active
    const session =
      localStorage.getItem("lumoraSession") ||
      sessionStorage.getItem("lumoraSession");
    if (session) {
      const sessionData = JSON.parse(session);
      if (sessionData.rememberMe || localStorage.getItem("lumoraUser")) {
        localStorage.setItem("lumoraUser", JSON.stringify(userData));
      } else {
        sessionStorage.setItem("lumoraUser", JSON.stringify(userData));
      }
    }
  };

  // ==========================================
  // PERMISSION CHECKING FUNCTIONS
  // ==========================================

  /**
   * Check if user has a specific permission
   * @param {string} permission - Permission to check (e.g., 'hr_view_employees')
   * @returns {boolean}
   */
  const hasPermission = (permission) => {
    if (!user || !user.permissions) return false;

    // Super Admin and Admin have all permissions
    if (user.roleId === "superadmin" || user.roleId === "admin") return true;

    return user.permissions.includes(permission);
  };

  /**
   * Check if user has ANY of the specified permissions
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean}
   */
  const hasAnyPermission = (permissions) => {
    if (!user || !user.permissions) return false;

    // Super Admin and Admin have all permissions
    if (user.roleId === "superadmin" || user.roleId === "admin") return true;

    return permissions.some((permission) =>
      user.permissions.includes(permission)
    );
  };

  /**
   * Check if user has ALL of the specified permissions
   * @param {string[]} permissions - Array of permissions to check
   * @returns {boolean}
   */
  const hasAllPermissions = (permissions) => {
    if (!user || !user.permissions) return false;

    // Super Admin and Admin have all permissions
    if (user.roleId === "superadmin" || user.roleId === "admin") return true;

    return permissions.every((permission) =>
      user.permissions.includes(permission)
    );
  };

  /**
   * Check if user has access to a module (any permission in that module)
   * @param {string} modulePrefix - Module prefix (e.g., 'hr', 'logistics', 'sales')
   * @returns {boolean}
   */
  const hasModuleAccess = (modulePrefix) => {
    if (!user || !user.permissions) return false;

    // Super Admin and Admin have all permissions
    if (user.roleId === "superadmin" || user.roleId === "admin") return true;

    return user.permissions.some((permission) =>
      permission.startsWith(`${modulePrefix}_`)
    );
  };

  /**
   * Check if user can view a specific module
   * @param {string} modulePrefix - Module prefix (e.g., 'hr', 'logistics')
   * @returns {boolean}
   */
  const canView = (modulePrefix) => {
    if (!user || !user.permissions) return false;

    // Super Admin and Admin have all permissions
    if (user.roleId === "superadmin" || user.roleId === "admin") return true;

    // Check for any view permission in the module
    return user.permissions.some((permission) =>
      permission.startsWith(`${modulePrefix}_view`)
    );
  };

  /**
   * Check if user can add/create in a specific module
   * @param {string} modulePrefix - Module prefix (e.g., 'hr', 'logistics')
   * @returns {boolean}
   */
  const canAdd = (modulePrefix) => {
    if (!user || !user.permissions) return false;

    // Super Admin and Admin have all permissions
    if (user.roleId === "superadmin" || user.roleId === "admin") return true;

    // Check for any add permission in the module
    return user.permissions.some((permission) =>
      permission.startsWith(`${modulePrefix}_add`)
    );
  };

  /**
   * Check if user can edit in a specific module
   * @param {string} modulePrefix - Module prefix (e.g., 'hr', 'logistics')
   * @returns {boolean}
   */
  const canEdit = (modulePrefix) => {
    if (!user || !user.permissions) return false;

    // Super Admin and Admin have all permissions
    if (user.roleId === "superadmin" || user.roleId === "admin") return true;

    // Check for any edit permission in the module
    return user.permissions.some((permission) =>
      permission.startsWith(`${modulePrefix}_edit`)
    );
  };

  /**
   * Check if user can delete in a specific module
   * @param {string} modulePrefix - Module prefix (e.g., 'hr', 'logistics')
   * @returns {boolean}
   */
  const canDelete = (modulePrefix) => {
    if (!user || !user.permissions) return false;

    // Super Admin and Admin have all permissions
    if (user.roleId === "superadmin" || user.roleId === "admin") return true;

    // Check for any delete permission in the module
    return user.permissions.some((permission) =>
      permission.startsWith(`${modulePrefix}_delete`)
    );
  };

  /**
   * Check if user is an admin
   * @returns {boolean}
   */
  const isAdmin = () => {
    return user?.roleId === "admin";
  };

  /**
   * Check if user is a super admin
   * @returns {boolean}
   */
  const isSuperAdmin = () => {
    return user?.roleId === "superadmin" || user?.isSuperAdmin === true;
  };

  /**
   * Get user's role name
   * @returns {string}
   */
  const getUserRole = () => {
    return user?.role || "User";
  };

  /**
   * Get all user permissions
   * @returns {string[]}
   */
  const getUserPermissions = () => {
    return user?.permissions || [];
  };

  /**
   * Check if user account is active
   * @returns {boolean}
   */
  const isActive = () => {
    return user?.status === "active" || user?.isActive === true;
  };

  const value = {
    user,
    setUser: setUserWithStorage,
    clearUser,
    updateUser,
    loading,
    isAuthenticated: !!user,

    // Permission checking functions
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasModuleAccess,
    canView,
    canAdd,
    canEdit,
    canDelete,
    isAdmin,
    isSuperAdmin,
    getUserRole,
    getUserPermissions,
    isActive,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
