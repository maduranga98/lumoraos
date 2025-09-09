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

const Login = () => {
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
    };

    const userDataForContext = {
      userId: userData.userId || userData.id,
      fullName: userData.fullName,
      username: userData.username,
      phoneNumber: userData.phoneNumber || "",
      isActive: userData.isActive,
      createdAt: userData.createdAt,
    };

    // Set user in context
    console.log(userDataForContext);
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
      setErrorMessage("Login successful! Welcome back.");
      setShowError(true);

      // Navigate to dashboard after brief delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } catch (error) {
      console.error("Login error:", error);

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

  const handleForgotPassword = () => {
    console.log("Forgot password clicked");
    // navigate("/forgot-password");
    alert(
      "Forgot password functionality would redirect to password reset page"
    );
  };

  // Show loading while auth state is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m0 0h2M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 4h1m4 0h1M9 16h1"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back to LumoraOS
          </h1>
          <p className="text-gray-600 text-sm">
            Sign in to your cooperative account
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <InputField
            label="Username or Email"
            type="text"
            placeholder="Enter your username or email"
            value={formData.usernameOrEmail}
            onChange={handleInputChange("usernameOrEmail")}
            error={errors.usernameOrEmail}
            required
            autoComplete="username"
          />

          <InputField
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleInputChange("password")}
            error={errors.password}
            required
            autoComplete="current-password"
          />

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-600">Remember me</span>
            </label>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit Button */}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {/* Additional Options */}
        <div className="mt-6 space-y-3">
          <div className="text-center">
            <span className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium focus:outline-none"
                onClick={() => navigate("/signup")}
              >
                Sign up here
              </button>
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to our{" "}
            <a href="#" className="text-blue-600 hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
          </p>

          <div className="border-t border-gray-200 pt-4 mt-4">
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

export default Login;
