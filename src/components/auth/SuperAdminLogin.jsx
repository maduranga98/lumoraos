import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../services/firebase";
import InputField from "../ui/InputField";
import Button from "../ui/Button";
import FailDialog from "../ui/FailDialog";
import { useUser } from "../../contexts/userContext";

const SuperAdminLogin = () => {
  const { loading: authLoading, setUser } = useUser();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    usernameOrEmail: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.usernameOrEmail.trim()) {
      newErrors.usernameOrEmail = "Username or email is required";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isEmailFormat = (input) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  };

  const findUserByUsername = async (username) => {
    try {
      // First check if username exists in usernames collection
      const usernameDocRef = doc(db, "usernames", username.toLowerCase());
      const usernameDoc = await getDoc(usernameDocRef);

      if (usernameDoc.exists()) {
        const userId = usernameDoc.data().userId;
        // Get user data from users collection
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          return {
            id: userDoc.id,
            ...userDoc.data(),
          };
        }
      }
      return null;
    } catch (error) {
      console.error("Error finding user by username:", error);
      return null;
    }
  };

  const findUserByEmail = async (email) => {
    try {
      // Query users collection by email field
      const usersRef = collection(db, "users");
      const emailQuery = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(emailQuery);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return {
          id: userDoc.id,
          ...userDoc.data(),
        };
      }
      return null;
    } catch (error) {
      console.error("Error finding user by email:", error);
      return null;
    }
  };

  const verifyPassword = async (plainPassword, userDataPassword) => {
    try {
      if (plainPassword === userDataPassword) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Error verifying password:", error);
      return false;
    }
  };

  const updateLastLogin = async (userId) => {
    try {
      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error updating last login:", error);
      // Don't throw error here, login should still succeed
    }
  };

  const createSession = (userData, rememberMe) => {
    const sessionData = {
      userId: userData.userId || userData.id,
      username: userData.username,
      loginTime: new Date().toISOString(),
      rememberMe: rememberMe,
      isSuperAdmin: true,
    };

    const userDataForContext = {
      userId: userData.userId || userData.id,
      fullName: userData.fullName,
      username: userData.username,
      phoneNumber: userData.phoneNumber || "",
      isActive: userData.isActive,
      createdAt: userData.createdAt,
      roleId: userData.roleId,
      role: userData.role,
      isSuperAdmin: true,
    };

    // Set user in context
    console.log("Super Admin logged in:", userDataForContext);
    setUser(userDataForContext);

    // Store in localStorage based on remember me preference
    if (rememberMe) {
      localStorage.setItem("lumoraUser", JSON.stringify(userDataForContext));
      localStorage.setItem("lumoraSession", JSON.stringify(sessionData));
    } else {
      sessionStorage.setItem("lumoraUser", JSON.stringify(userDataForContext));
      sessionStorage.setItem("lumoraSession", JSON.stringify(sessionData));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      let userData = null;
      const input = formData.usernameOrEmail.trim();

      // Determine if input is email or username and find user
      if (isEmailFormat(input)) {
        userData = await findUserByEmail(input);
      } else {
        userData = await findUserByUsername(input);
      }

      // Check if user exists
      if (!userData) {
        setErrorMessage("No account found with this username or email.");
        setShowError(true);
        setLoading(false);
        return;
      }

      // Check if user is a super admin
      if (userData.roleId !== "superadmin") {
        setErrorMessage(
          "Access denied. This login is only for Super Administrators."
        );
        setShowError(true);
        setLoading(false);
        return;
      }

      // Check if account is active
      if (!userData.isActive) {
        setErrorMessage(
          "This account has been disabled. Please contact support."
        );
        setShowError(true);
        setLoading(false);
        return;
      }

      // Verify password
      const isPasswordValid = verifyPassword(
        formData.password,
        userData.password
      );

      if (!isPasswordValid) {
        setErrorMessage("Incorrect password. Please try again.");
        setShowError(true);
        setLoading(false);
        return;
      }

      // Update last login timestamp
      await updateLastLogin(userData.userId || userData.id);

      // Create user session
      createSession(userData, rememberMe);

      // Clear form
      setFormData({
        usernameOrEmail: "",
        password: "",
      });

      // Show success message briefly
      setErrorMessage("Login successful! Welcome Super Admin.");
      setShowError(true);

      // Navigate to super admin dashboard after brief delay
      setTimeout(() => {
        navigate("/superadmin/dashboard");
      }, 1000);
    } catch (error) {
      console.error("Super Admin login error:", error);

      let errorMsg = "An unexpected error occurred. Please try again.";

      // Handle specific Firestore errors
      if (error.code === "permission-denied") {
        errorMsg = "Permission denied. Please check your network connection.";
      } else if (error.code === "unavailable") {
        errorMsg = "Service temporarily unavailable. Please try again later.";
      } else if (error.message.includes("network")) {
        errorMsg = "Network error. Please check your connection and try again.";
      } else if (error.message === "Too many requests") {
        errorMsg = "Too many failed attempts. Please try again later.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while auth state is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border-t-4 border-purple-600">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg
              className="w-8 h-8 text-white"
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Super Admin Access
          </h1>
          <p className="text-gray-600 text-sm">
            Restricted area - Super Administrator login only
          </p>
          <div className="mt-3 flex items-center justify-center space-x-2">
            <svg
              className="w-4 h-4 text-purple-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-purple-600 font-semibold">
              High Security Zone
            </span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <InputField
            label="Username or Email"
            type="text"
            placeholder="Enter super admin username or email"
            value={formData.usernameOrEmail}
            onChange={handleInputChange("usernameOrEmail")}
            error={errors.usernameOrEmail}
            required
            autoComplete="username"
          />

          <InputField
            label="Password"
            type="password"
            placeholder="Enter super admin password"
            value={formData.password}
            onChange={handleInputChange("password")}
            error={errors.password}
            required
            autoComplete="current-password"
          />

          {/* Remember Me */}
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>
          </div>

          {/* Submit Button */}
          <Button type="submit" loading={loading} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700" size="lg">
            {loading ? "Authenticating..." : "Access Super Admin Panel"}
          </Button>
        </form>

        {/* Additional Options */}
        <div className="mt-6 space-y-3">
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-purple-600 hover:text-purple-800 hover:underline font-medium focus:outline-none"
              onClick={() => navigate("/login")}
            >
              ← Back to regular login
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="flex items-start space-x-2">
              <svg
                className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-left">
                <p className="text-xs font-semibold text-amber-800">
                  Security Notice
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  All login attempts are logged and monitored
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-400">
              Powered by{" "}
              <span className="font-semibold text-gray-600">
                Lumora Ventures
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Success/Error Dialog */}
      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title={
          errorMessage.includes("successful") ? "Success!" : "Login Failed"
        }
        message={errorMessage}
        buttonText={
          errorMessage.includes("successful") ? "Continue" : "Try Again"
        }
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default SuperAdminLogin;
