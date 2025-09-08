import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import InputField from "../ui/InputField";
import Button from "../ui/Button";
import FailDialog from "../ui/FailDialog";
import { useUser } from "../../contexts/userContext";

const Login = () => {
  const { setUser } = useUser();
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

  const getUserEmailFromUsername = async (username) => {
    try {
      // First, check if username exists in usernames collection
      const usernameDocRef = doc(db, "usernames", username.toLowerCase());
      const usernameDoc = await getDoc(usernameDocRef);

      if (usernameDoc.exists()) {
        const uid = usernameDoc.data().uid;

        // Get user data from users collection
        const userDocRef = doc(db, "users", uid);
        const userDoc = await getDoc(userDocRef);
        setUser({
          id: userDoc.data().uid,
          name: userDoc.data().fullName,
          email: userDoc.data().email,
          username: userDoc.data().username,
          phoneNumber: userDoc.data().phoneNumber,
        });
        if (userDoc.exists()) {
          return userDoc.data().email;
        }
      }

      // Fallback: create email format like in signup
      return `${username.toLowerCase()}@lumoraos.local`;
    } catch (error) {
      console.error("Error getting user email:", error);
      // Fallback to generated email format
      return `${username.toLowerCase()}@lumoraos.local`;
    }
  };

  const loginUser = async (emailOrUsername, password) => {
    try {
      let email = emailOrUsername;

      // If input is not an email, treat it as username and get corresponding email
      if (!isEmailFormat(emailOrUsername)) {
        email = await getUserEmailFromUsername(emailOrUsername);
      }

      // Set persistence based on remember me checkbox
      const persistence = rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Get additional user data from Firestore
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();

        return {
          success: true,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            fullName: userData.fullName,
            username: userData.username,
            phoneNumber: userData.phoneNumber,
          },
        };
      } else {
        return {
          success: true,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          },
        };
      }
    } catch (error) {
      console.error("Login error:", error);

      let errorMessage = "An unexpected error occurred. Please try again.";

      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this username or email.";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format.";
      } else if (error.code === "auth/user-disabled") {
        errorMessage =
          "This account has been disabled. Please contact support.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage =
          "Invalid username/email or password. Please check your credentials.";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = await loginUser(
        formData.usernameOrEmail,
        formData.password
      );

      if (result.success) {
        console.log("Login successful:", result.user);

        // Clear form
        setFormData({
          usernameOrEmail: "",
          password: "",
        });

        // Redirect to dashboard or home page
        navigate("/dashboard");
        alert("Login successful! Redirecting to dashboard...");

        // You can also dispatch to a global state management system
        // dispatch(setUser(result.user));
      } else {
        setErrorMessage(result.error);
        setShowError(true);
      }
    } catch (error) {
      console.error("Unexpected login error:", error);
      setErrorMessage("An unexpected error occurred. Please try again.");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // You can implement password reset functionality here
    console.log("Forgot password clicked");

    // Example implementation:
    // navigate("/forgot-password");
    alert(
      "Forgot password functionality would redirect to password reset page"
    );
  };

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
          {/* Sign Up Link */}
          <div className="text-center">
            <span className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium focus:outline-none"
                onClick={() => {
                  navigate("/signup");
                }}
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

          {/* Lumora Ventures Branding */}
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

      {/* Error Dialog */}
      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Login Failed"
        message={errorMessage}
        buttonText="Try Again"
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default Login;
