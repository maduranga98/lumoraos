import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import InputField from "../ui/InputField";
import Button from "../ui/Button";
import SuccessDialog from "../ui/SuccessDialog";
import FailDialog from "../ui/FailDialog";
import { PREDEFINED_ROLES } from "../../config/permissions.config";

const SuperAdminSetup = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [superAdminExists, setSuperAdminExists] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  useEffect(() => {
    checkForExistingSuperAdmin();
  }, []);

  const checkForExistingSuperAdmin = async () => {
    setCheckingExisting(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("roleId", "==", "superadmin"));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setSuperAdminExists(true);
      }
    } catch (error) {
      console.error("Error checking for super admin:", error);
      setErrorMessage("Failed to check for existing super admin.");
      setShowError(true);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleInputChange = (field) => (e) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }

    // Check username availability
    if (field === "username" && value.length >= 3) {
      checkUsernameAvailability(value);
    }
  };

  const checkUsernameAvailability = async (username) => {
    setUsernameChecking(true);
    try {
      const usernameDoc = await getDoc(
        doc(db, "usernames", username.toLowerCase())
      );
      setUsernameAvailable(!usernameDoc.exists());
    } catch (error) {
      console.error("Error checking username:", error);
    } finally {
      setUsernameChecking(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (usernameAvailable === false) {
      newErrors.username = "Username is already taken";
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setErrorMessage("Please fix the errors in the form.");
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      // Double-check that no super admin exists
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("roleId", "==", "superadmin"));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setErrorMessage(
          "A super admin account already exists. Please use the super admin login."
        );
        setShowError(true);
        setLoading(false);
        setSuperAdminExists(true);
        return;
      }

      // Generate unique user ID
      const userId = `superadmin_${Date.now()}`;

      // Get super admin role
      const superAdminRole = PREDEFINED_ROLES.SUPER_ADMIN;

      // Get all permissions
      const allPermissions = [];
      // Since super admin has "all" permissions, we don't need to list them all

      // Create super admin user document
      const userData = {
        userId: userId,
        fullName: formData.fullName.trim(),
        username: formData.username.toLowerCase().trim(),
        email: formData.email.trim() || "",
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password, // Note: Plain text storage (security issue)
        salary: 0,
        commission: 0,
        role: superAdminRole.name,
        roleType: "predefined",
        roleId: "superadmin",
        permissions: [], // Super admin doesn't need explicit permissions
        isActive: true,
        status: "active",
        hasAccount: true,
        isSuperAdmin: true,
        createdAt: serverTimestamp(),
        createdBy: "system",
        updatedAt: serverTimestamp(),
        updatedBy: "system",
      };

      // Save user document
      await setDoc(doc(db, "users", userId), userData);

      // Reserve username
      await setDoc(doc(db, "usernames", formData.username.toLowerCase()), {
        userId: userId,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage(
        "Super Admin account created successfully! You can now login with your credentials."
      );
      setShowSuccess(true);

      // Redirect to super admin login after delay
      setTimeout(() => {
        navigate("/superadmin-login");
      }, 3000);
    } catch (error) {
      console.error("Error creating super admin:", error);

      let errorMsg = "Failed to create super admin account. Please try again.";
      if (error.code === "permission-denied") {
        errorMsg =
          "Permission denied. Please check Firestore security rules.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <span className="ml-3 text-gray-600">Checking system...</span>
          </div>
        </div>
      </div>
    );
  }

  if (superAdminExists) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Setup Already Complete
          </h1>
          <p className="text-gray-600 mb-6">
            A Super Admin account already exists in the system. Please use the
            super admin login to access the dashboard.
          </p>
          <Button
            onClick={() => navigate("/superadmin-login")}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
          >
            Go to Super Admin Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
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
            Super Admin Setup
          </h1>
          <p className="text-gray-600 text-sm">
            Create the first Super Administrator account
          </p>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              This is a one-time setup. You're creating the master administrator
              account for the system.
            </p>
          </div>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField
            label="Full Name *"
            type="text"
            placeholder="Enter your full name"
            value={formData.fullName}
            onChange={handleInputChange("fullName")}
            error={errors.fullName}
            required
          />

          <div>
            <InputField
              label="Username *"
              type="text"
              placeholder="Choose a username"
              value={formData.username}
              onChange={handleInputChange("username")}
              error={errors.username}
              required
            />
            {usernameChecking && (
              <p className="text-xs text-gray-500 mt-1">Checking...</p>
            )}
            {usernameAvailable === true && (
              <p className="text-xs text-green-600 mt-1">✓ Username available</p>
            )}
            {usernameAvailable === false && (
              <p className="text-xs text-red-600 mt-1">
                ✗ Username already taken
              </p>
            )}
          </div>

          <InputField
            label="Email"
            type="email"
            placeholder="Enter your email (optional)"
            value={formData.email}
            onChange={handleInputChange("email")}
            error={errors.email}
          />

          <InputField
            label="Phone Number *"
            type="tel"
            placeholder="Enter your phone number"
            value={formData.phoneNumber}
            onChange={handleInputChange("phoneNumber")}
            error={errors.phoneNumber}
            required
          />

          <InputField
            label="Password *"
            type="password"
            placeholder="Create a strong password"
            value={formData.password}
            onChange={handleInputChange("password")}
            error={errors.password}
            required
          />

          <InputField
            label="Confirm Password *"
            type="password"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleInputChange("confirmPassword")}
            error={errors.confirmPassword}
            required
          />

          {/* Submit Button */}
          <Button
            type="submit"
            loading={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            size="lg"
          >
            {loading ? "Creating Super Admin..." : "Create Super Admin Account"}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/superadmin-login")}
              className="text-purple-600 hover:text-purple-800 hover:underline font-medium"
            >
              Login here
            </button>
          </p>
        </div>
      </div>

      {/* Success Dialog */}
      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Super Admin Created!"
        message={successMessage}
      />

      {/* Error Dialog */}
      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Setup Failed"
        message={errorMessage}
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default SuperAdminSetup;
