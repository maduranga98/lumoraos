import React, { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const AddUsers = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    roleId: "",
    salary: "",
    commission: "",
    phone: "",
    email: "",
    hasAccount: false,
    username: "",
  });

  const [roles, setRoles] = useState([]);
  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePermissions, setNewRolePermissions] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Username availability checking
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  // Auto-generated password
  const [generatedPassword, setGeneratedPassword] = useState("");

  // Available permissions
  const availablePermissions = [
    "view_employees",
    "manage_employees",
    "view_inventory",
    "manage_inventory",
    "view_sales",
    "manage_sales",
    "view_reports",
    "manage_suppliers",
    "manage_vehicles",
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load roles on component mount
  useEffect(() => {
    if (currentUser) {
      loadRoles();
    }
  }, [currentUser]);

  // Generate password when hasAccount is enabled
  useEffect(() => {
    if (formData.hasAccount && !generatedPassword) {
      setGeneratedPassword(generatePassword());
    }
  }, [formData.hasAccount]);

  // Update password when name or username changes
  useEffect(() => {
    if (formData.hasAccount && (formData.name || formData.username)) {
      setGeneratedPassword(generatePassword(formData.name, formData.username));
    }
  }, [formData.name, formData.username, formData.hasAccount]);

  const loadRoles = async () => {
    try {
      const rolesQuery = query(collection(db, "roles"), orderBy("name"));
      const rolesSnapshot = await getDocs(rolesQuery);
      const rolesData = rolesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRoles(rolesData);
    } catch (error) {
      console.error("Error loading roles:", error);
      setErrorMessage("Failed to load roles. Please try again.");
      setShowError(true);
    }
  };

  const generatePassword = (
    name = formData.name,
    username = formData.username
  ) => {
    if (!name && !username) {
      const words = ["Easy", "Safe", "Cool", "Good"];
      const numbers = Math.floor(Math.random() * 99) + 1;
      return `${words[Math.floor(Math.random() * words.length)]}${numbers}`;
    }

    const firstName = name
      ? name
          .trim()
          .split(" ")[0]
          .replace(/[^a-zA-Z]/g, "")
      : "";
    const cleanUsername = username ? username.replace(/[^a-zA-Z0-9]/g, "") : "";

    let passwordBase = "";

    if (firstName && cleanUsername) {
      passwordBase =
        firstName.charAt(0).toUpperCase() +
        firstName.slice(1).toLowerCase() +
        cleanUsername.toLowerCase();
    } else if (firstName) {
      passwordBase =
        firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    } else if (cleanUsername) {
      passwordBase =
        cleanUsername.charAt(0).toUpperCase() +
        cleanUsername.slice(1).toLowerCase();
    }

    const currentYear = new Date().getFullYear();
    const numbers = Math.floor(Math.random() * 99) + 1;
    const suffix = Math.random() > 0.5 ? currentYear : numbers;

    return passwordBase + suffix;
  };

  const regeneratePassword = () => {
    setGeneratedPassword(generatePassword(formData.name, formData.username));
  };

  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setUsernameChecking(true);
    try {
      const usernameDocRef = doc(db, "usernames", username.toLowerCase());
      const usernameDoc = await getDoc(usernameDocRef);
      setUsernameAvailable(!usernameDoc.exists());
    } catch (error) {
      console.error("Error checking username:", error);
      setUsernameAvailable(null);
    } finally {
      setUsernameChecking(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.hasAccount && formData.username) {
        checkUsernameAvailability(formData.username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.username, formData.hasAccount]);

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "username") {
      value = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    } else if (field === "email") {
      value = value.toLowerCase();
    } else if (field === "salary" || field === "commission") {
      value = value.replace(/[^0-9.]/g, "");
    }

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
  };

  const handleAccountToggle = () => {
    setFormData((prev) => ({
      ...prev,
      hasAccount: !prev.hasAccount,
      username: !prev.hasAccount ? prev.username : "",
    }));

    if (!formData.hasAccount) {
      setGeneratedPassword(generatePassword());
    } else {
      setGeneratedPassword("");
      setUsernameAvailable(null);
    }
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      setErrorMessage("Role name is required");
      setShowError(true);
      return;
    }

    try {
      const roleData = {
        name: newRoleName.trim(),
        permissions: newRolePermissions,
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "roles"), roleData);

      const newRole = {
        id: docRef.id,
        ...roleData,
      };

      setRoles((prev) => [...prev, newRole]);
      setFormData((prev) => ({ ...prev, roleId: docRef.id }));

      setNewRoleName("");
      setNewRolePermissions([]);
      setShowNewRoleModal(false);
    } catch (error) {
      console.error("Error adding role:", error);
      setErrorMessage("Failed to add role. Please try again.");
      setShowError(true);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.roleId) newErrors.roleId = "Role is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";

    // Phone validation
    if (formData.phone && !/^\+?[\d\s-()]+$/.test(formData.phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    // Email validation (optional but must be valid if provided)
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    // Salary and commission validation
    if (
      formData.salary &&
      (isNaN(formData.salary) || parseFloat(formData.salary) < 0)
    ) {
      newErrors.salary = "Please enter a valid salary amount";
    }

    if (
      formData.commission &&
      (isNaN(formData.commission) || parseFloat(formData.commission) < 0)
    ) {
      newErrors.commission = "Please enter a valid commission amount";
    }

    // Account-specific validation
    if (formData.hasAccount) {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required for system accounts";
      } else if (formData.username.length < 3) {
        newErrors.username = "Username must be at least 3 characters";
      } else if (formData.username.length > 20) {
        newErrors.username = "Username must be less than 20 characters";
      } else if (!/^[a-z0-9_]+$/.test(formData.username)) {
        newErrors.username =
          "Username can only contain lowercase letters, numbers, and underscores";
      } else if (usernameAvailable === false) {
        newErrors.username = "Username is already taken";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateEmployeeId = () => {
    const prefix = "EMP";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
    return `${prefix}${timestamp}${random}`;
  };

  const cleanData = (obj) => {
    const cleaned = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage(
        "You must be logged in to create employees. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const employeeDocRef = doc(collection(db, "employees"));
      const employeeId = generateEmployeeId();

      // Get role name for display
      const selectedRole = roles.find((r) => r.id === formData.roleId);

      const employeeData = cleanData({
        employeeId: employeeId,
        name: formData.name.trim(),
        roleId: formData.roleId,
        roleName: selectedRole?.name || "", // For easy display
        salary: formData.salary ? parseFloat(formData.salary) : 0,
        commission: formData.commission ? parseFloat(formData.commission) : 0,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        hasAccount: formData.hasAccount,
        username: formData.hasAccount ? formData.username.toLowerCase() : null,
        passwordHash: formData.hasAccount ? generatedPassword : null, // In production, hash this
        status: "active",
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      });

      await setDoc(employeeDocRef, employeeData);

      // Reserve username if account is created
      if (formData.hasAccount) {
        await setDoc(doc(db, "usernames", formData.username.toLowerCase()), {
          employeeId: employeeId,
          userId: employeeDocRef.id,
          createdAt: serverTimestamp(),
        });
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: "employee_created",
          description: `New employee ${formData.name} was created${
            formData.hasAccount ? " with system account" : ""
          }`,
          performedBy: currentUser.userId,
          targetEmployeeId: employeeId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      const successMsg = formData.hasAccount
        ? `Employee ${formData.name} has been successfully created!\n\nEmployee ID: ${employeeId}\nUsername: ${formData.username}\nPassword: ${generatedPassword}\n\nPlease share these credentials with the employee.`
        : `Employee ${formData.name} has been successfully created with ID: ${employeeId}`;

      setSuccessMessage(successMsg);
      setShowSuccess(true);

      // Reset form
      setFormData({
        name: "",
        roleId: "",
        salary: "",
        commission: "",
        phone: "",
        email: "",
        hasAccount: false,
        username: "",
      });
      setGeneratedPassword("");
      setUsernameAvailable(null);
    } catch (error) {
      console.error("Error creating employee:", error);

      let errorMsg = "Failed to create employee. Please try again.";

      if (error.code === "permission-denied") {
        errorMsg = "You don't have permission to create employees.";
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </button>

        <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Add New Employee
            </h1>
            <p className="text-gray-600">Fill in the employee details below</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </span>
                Basic Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Full Name"
                  type="text"
                  placeholder="Enter employee name"
                  value={formData.name}
                  onChange={handleInputChange("name")}
                  error={errors.name}
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.roleId}
                      onChange={handleInputChange("roleId")}
                      className="flex-1 px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      <option value="">Select a role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewRoleModal(true)}
                      title="Add new role"
                      className="px-4"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </Button>
                  </div>
                  {errors.roleId && (
                    <p className="text-sm text-red-600 mt-1">{errors.roleId}</p>
                  )}
                </div>

                <InputField
                  label="Phone Number"
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChange={handleInputChange("phone")}
                  error={errors.phone}
                  required
                />

                <InputField
                  label="Email Address"
                  type="email"
                  placeholder="Enter email (optional)"
                  value={formData.email}
                  onChange={handleInputChange("email")}
                  error={errors.email}
                />
              </div>
            </div>

            {/* Compensation */}
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </span>
                Compensation
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Monthly Salary"
                  type="number"
                  placeholder="Enter salary amount"
                  value={formData.salary}
                  onChange={handleInputChange("salary")}
                  error={errors.salary}
                  step="0.01"
                />

                <InputField
                  label="Commission Rate (%)"
                  type="number"
                  placeholder="Enter commission percentage"
                  value={formData.commission}
                  onChange={handleInputChange("commission")}
                  error={errors.commission}
                  step="0.01"
                />
              </div>
            </div>

            {/* System Account */}
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                    <svg
                      className="w-5 h-5 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </span>
                  System Account
                </h2>

                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={formData.hasAccount}
                      onChange={handleAccountToggle}
                    />
                    <div
                      className={`block w-14 h-8 rounded-full transition ${
                        formData.hasAccount ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    ></div>
                    <div
                      className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${
                        formData.hasAccount ? "transform translate-x-6" : ""
                      }`}
                    ></div>
                  </div>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    Create login account
                  </span>
                </label>
              </div>

              {formData.hasAccount && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter username"
                        value={formData.username}
                        onChange={handleInputChange("username")}
                        className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                          errors.username
                            ? "border-red-500"
                            : usernameAvailable === true
                            ? "border-green-500"
                            : usernameAvailable === false
                            ? "border-red-500"
                            : "border-gray-300"
                        }`}
                        required
                      />
                      {usernameChecking && (
                        <div className="absolute right-3 top-3.5">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                      {usernameAvailable === true && (
                        <div className="absolute right-3 top-3.5 text-green-500">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                      {usernameAvailable === false && (
                        <div className="absolute right-3 top-3.5 text-red-500">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    {errors.username && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.username}
                      </p>
                    )}
                    {usernameAvailable === true && !errors.username && (
                      <p className="text-sm text-green-600 mt-1">
                        Username is available!
                      </p>
                    )}
                    {usernameAvailable === false && !errors.username && (
                      <p className="text-sm text-red-600 mt-1">
                        Username is already taken
                      </p>
                    )}
                  </div>

                  {/* Auto-generated Password */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-blue-900 mb-1">
                          Auto-generated Password
                        </h3>
                        <p className="text-xl font-mono font-bold text-blue-700">
                          {generatedPassword}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Save this password - it won't be shown again
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={regeneratePassword}
                        className="ml-4"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(-1)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={loading}
                size="lg"
                className="px-8"
              >
                {loading ? "Creating Employee..." : "Create Employee"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Add Role Modal */}
      {showNewRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Add New Role</h3>
              <button
                onClick={() => {
                  setShowNewRoleModal(false);
                  setNewRoleName("");
                  setNewRolePermissions([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <InputField
                label="Role Name"
                type="text"
                placeholder="Enter role name (e.g., Sales Manager)"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Permissions
                </label>
                <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {availablePermissions.map((permission) => (
                    <label
                      key={permission}
                      className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={newRolePermissions.includes(permission)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewRolePermissions((prev) => [
                              ...prev,
                              permission,
                            ]);
                          } else {
                            setNewRolePermissions((prev) =>
                              prev.filter((p) => p !== permission)
                            );
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {permission
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowNewRoleModal(false);
                    setNewRoleName("");
                    setNewRolePermissions([]);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddRole}
                  disabled={!newRoleName.trim()}
                >
                  Add Role
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Dialog */}
      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => {
          setShowSuccess(false);
          navigate("/employeelist");
        }}
        title="Employee Created Successfully!"
        message={successMessage}
        buttonText="View Employees"
        onConfirm={() => navigate("/employeelist")}
      />

      {/* Error Dialog */}
      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Failed to Create Employee"
        message={errorMessage}
        buttonText="Try Again"
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default AddUsers;
