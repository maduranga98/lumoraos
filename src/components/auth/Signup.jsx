import React, { useState } from "react";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { db } from "../../services/firebase";
import InputField from "../ui/InputField";
import Button from "../ui/Button";
import FailDialog from "../ui/FailDialog";
import { useUser } from "../../contexts/userContext";

const Signup = () => {
  const { loading: authLoading, setUser } = useUser();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    // Format username
    if (field === "username") {
      value = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
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

    // Full Name validation
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters";
    }

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (formData.username.length > 20) {
      newErrors.username = "Username must be less than 20 characters";
    } else if (!/^[a-z0-9_]+$/.test(formData.username)) {
      newErrors.username =
        "Username can only contain lowercase letters, numbers, and underscores";
    }

    // Phone number validation (optional but if provided, should be valid)
    if (
      formData.phoneNumber.trim() &&
      !/^\+?[\d\s-()]+$/.test(formData.phoneNumber)
    ) {
      newErrors.phoneNumber = "Please enter a valid phone number";
    }

    // Password validation
    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password =
        "Password must contain at least one uppercase letter, one lowercase letter, and one number";
    }

    // Confirm password validation
    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Terms acceptance validation
    if (!acceptTerms) {
      newErrors.terms = "You must accept the terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkUsernameAvailability = async (username) => {
    try {
      // Check if username exists in usernames collection
      const usernameDocRef = doc(db, "usernames", username);
      const usernameDoc = await getDoc(usernameDocRef);
      return !usernameDoc.exists();
    } catch (error) {
      console.error("Error checking username availability:", error);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      // Check username availability
      const isUsernameAvailable = await checkUsernameAvailability(
        formData.username
      );

      if (!isUsernameAvailable) {
        setErrorMessage("Username is already taken. Please choose another.");
        setShowError(true);
        setLoading(false);
        return;
      }

      // Hash the password before storing
      // const hashedPassword = await hashPassword(formData.password);

      // Create user document in Firestore users collection
      const usersCollectionRef = collection(db, "users");
      const userDocRef = await addDoc(usersCollectionRef, {
        fullName: formData.fullName,
        username: formData.username,
        phoneNumber: formData.phoneNumber || "",
        password: formData.password,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        lastLoginAt: null,
      });

      // The document ID is now the user ID
      const userId = userDocRef.id;

      // Update the user document with the userId field
      await setDoc(userDocRef, {
        userId: userId,
        fullName: formData.fullName,
        username: formData.username,
        phoneNumber: formData.phoneNumber || "",
        password: formData.password,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isActive: true,
        lastLoginAt: null,
      });

      // Reserve the username in usernames collection
      await setDoc(doc(db, "usernames", formData.username), {
        userId: userId,
        createdAt: serverTimestamp(),
      });

      // Create user session data (without sensitive info)
      const userData = {
        userId: userId,
        fullName: formData.fullName,
        username: formData.username,
        phoneNumber: formData.phoneNumber || "",
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      // Set user in context (auto-login)
      setUser(userData);

      // Store user session in localStorage for persistence
      localStorage.setItem("lumoraUser", JSON.stringify(userData));
      localStorage.setItem(
        "lumoraSession",
        JSON.stringify({
          userId: userId,
          username: formData.username,
          loginTime: new Date().toISOString(),
        })
      );

      // Clear form
      setFormData({
        fullName: "",
        username: "",
        phoneNumber: "",
        password: "",
        confirmPassword: "",
      });
      setAcceptTerms(false);

      // Show success message briefly before redirect
      setErrorMessage("Account created successfully! Welcome to LumoraOS.");
      setShowError(true);

      // Navigate to dashboard after a brief delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (error) {
      console.error("Registration error:", error);

      let errorMsg = "An unexpected error occurred. Please try again.";

      // Handle specific errors
      if (error.message === "Failed to process password") {
        errorMsg = "Password processing failed. Please try again.";
      } else if (error.code === "permission-denied") {
        errorMsg = "Permission denied. Please check your network connection.";
      } else if (error.code === "unavailable") {
        errorMsg = "Service temporarily unavailable. Please try again later.";
      } else if (error.message.includes("network")) {
        errorMsg = "Network error. Please check your connection and try again.";
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Join LumoraOS
          </h1>
          <p className="text-gray-600 text-sm">
            Create your cooperative account
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <InputField
            label="Full Name"
            type="text"
            placeholder="Enter your full name"
            value={formData.fullName}
            onChange={handleInputChange("fullName")}
            error={errors.fullName}
            required
            autoComplete="name"
          />

          <InputField
            label="Username"
            type="text"
            placeholder="Choose a username"
            value={formData.username}
            onChange={handleInputChange("username")}
            error={errors.username}
            required
            autoComplete="username"
          />

          <InputField
            label="Phone Number"
            type="tel"
            placeholder="Enter your phone number (optional)"
            value={formData.phoneNumber}
            onChange={handleInputChange("phoneNumber")}
            error={errors.phoneNumber}
            autoComplete="tel"
          />

          <InputField
            label="Password"
            type="password"
            placeholder="Create a strong password"
            value={formData.password}
            onChange={handleInputChange("password")}
            error={errors.password}
            required
            autoComplete="new-password"
          />

          <InputField
            label="Confirm Password"
            type="password"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleInputChange("confirmPassword")}
            error={errors.confirmPassword}
            required
            autoComplete="new-password"
          />

          {/* Password Requirements */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>Password must contain:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li
                className={
                  formData.password.length >= 6 ? "text-green-600" : ""
                }
              >
                At least 6 characters
              </li>
              <li
                className={
                  /(?=.*[a-z])/.test(formData.password) ? "text-green-600" : ""
                }
              >
                One lowercase letter
              </li>
              <li
                className={
                  /(?=.*[A-Z])/.test(formData.password) ? "text-green-600" : ""
                }
              >
                One uppercase letter
              </li>
              <li
                className={
                  /(?=.*\d)/.test(formData.password) ? "text-green-600" : ""
                }
              >
                One number
              </li>
            </ul>
          </div>

          {/* Terms and Conditions */}
          <div className="space-y-2">
            <label className="flex items-start">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  if (errors.terms) {
                    setErrors((prev) => ({
                      ...prev,
                      terms: "",
                    }));
                  }
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5 flex-shrink-0"
              />
              <span className="ml-2 text-sm text-gray-600">
                I agree to the{" "}
                <a href="#" className="text-blue-600 hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
              </span>
            </label>
            {errors.terms && (
              <p className="text-sm text-red-600">{errors.terms}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button type="submit" loading={loading} className="w-full" size="lg">
            {loading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <span className="text-sm text-gray-600">
            Already have an account?{" "}
            <button
              type="button"
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium focus:outline-none"
              onClick={() => navigate("/login")}
            >
              Sign in here
            </button>
          </span>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 mb-3">
            By creating an account, you agree to our terms and privacy policy
          </p>

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
          errorMessage.includes("successfully")
            ? "Success!"
            : "Registration Failed"
        }
        message={errorMessage}
        buttonText={
          errorMessage.includes("successfully") ? "Continue" : "Try Again"
        }
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default Signup;
