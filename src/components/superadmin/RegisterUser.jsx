import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebase";
import { useUser } from "../../contexts/userContext";
import InputField from "../ui/InputField";
import Button from "../ui/Button";
import SuccessDialog from "../ui/SuccessDialog";
import FailDialog from "../ui/FailDialog";
import {
  PREDEFINED_ROLES,
  getModulesForSelection,
} from "../../config/permissions.config";

const RegisterUser = () => {
  const { user: currentUser, isSuperAdmin } = useUser();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    email: "",
    phoneNumber: "",
    password: "",
    salary: "",
    commission: "",
  });

  const [roleType, setRoleType] = useState("predefined");
  const [selectedRole, setSelectedRole] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [isActive, setIsActive] = useState(true);

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);

  const modules = getModulesForSelection();

  // Redirect if not super admin
  React.useEffect(() => {
    if (!currentUser || !isSuperAdmin()) {
      navigate("/superadmin-login");
    }
  }, [currentUser, isSuperAdmin, navigate]);

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

  const handleRoleChange = useCallback((roleId) => {
    setSelectedRole(roleId);

    if (roleId) {
      const role = PREDEFINED_ROLES[roleId.toUpperCase()];
      if (role) {
        if (role.permissions === "all") {
          const allPerms = [];
          modules.forEach((module) => {
            module.permissions.forEach((perm) => {
              allPerms.push(perm.value);
            });
          });
          setSelectedPermissions(allPerms);
        } else {
          setSelectedPermissions([...role.permissions]);
        }
      }
    } else {
      setSelectedPermissions([]);
    }
  }, [modules]);

  const togglePermission = (permissionValue) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permissionValue)) {
        return prev.filter((p) => p !== permissionValue);
      } else {
        return [...prev, permissionValue];
      }
    });
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData((prev) => ({ ...prev, password }));
    return password;
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
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (roleType === "predefined" && !selectedRole) {
      newErrors.role = "Please select a role";
    }

    if (roleType === "custom") {
      if (!customRoleName.trim()) {
        newErrors.customRole = "Custom role name is required";
      }
      if (selectedPermissions.length === 0) {
        newErrors.permissions = "Please select at least one permission";
      }
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
      // Generate unique user ID
      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Determine role data
      let roleData = {};
      if (roleType === "predefined") {
        const role = PREDEFINED_ROLES[selectedRole.toUpperCase()];
        roleData = {
          role: role.name,
          roleType: "predefined",
          roleId: role.id,
          permissions: selectedPermissions,
        };
      } else {
        roleData = {
          role: customRoleName,
          roleType: "custom",
          roleId: "",
          permissions: selectedPermissions,
        };
      }

      // Create user document
      const userData = {
        userId: userId,
        fullName: formData.fullName.trim(),
        username: formData.username.toLowerCase().trim(),
        email: formData.email.trim() || "",
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password, // Note: Plain text storage (security issue)
        salary: parseFloat(formData.salary) || 0,
        commission: parseFloat(formData.commission) || 0,
        ...roleData,
        isActive: isActive,
        status: isActive ? "active" : "inactive",
        hasAccount: true,
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.userId,
      };

      // Save user document
      await setDoc(doc(db, "users", userId), userData);

      // Reserve username
      await setDoc(doc(db, "usernames", formData.username.toLowerCase()), {
        userId: userId,
        createdAt: serverTimestamp(),
      });

      setSuccessMessage(
        `User ${formData.fullName} has been registered successfully!`
      );
      setShowSuccess(true);

      // Reset form
      setTimeout(() => {
        navigate("/superadmin/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error registering user:", error);

      let errorMsg = "Failed to register user. Please try again.";
      if (error.code === "permission-denied") {
        errorMsg = "Permission denied. Please check your access rights.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate("/superadmin/dashboard")}
                className="text-white hover:text-purple-100"
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Register New User
                </h1>
                <p className="text-purple-100 text-sm">
                  Create a new user account
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Information Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-purple-600"
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
              User Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Full Name *"
                type="text"
                placeholder="Enter full name"
                value={formData.fullName}
                onChange={handleInputChange("fullName")}
                error={errors.fullName}
                required
              />

              <div>
                <InputField
                  label="Username *"
                  type="text"
                  placeholder="Enter username"
                  value={formData.username}
                  onChange={handleInputChange("username")}
                  error={errors.username}
                  required
                />
                {usernameChecking && (
                  <p className="text-xs text-gray-500 mt-1">Checking...</p>
                )}
                {usernameAvailable === true && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Username available
                  </p>
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
                placeholder="Enter email (optional)"
                value={formData.email}
                onChange={handleInputChange("email")}
                error={errors.email}
              />

              <InputField
                label="Phone Number *"
                type="tel"
                placeholder="Enter phone number"
                value={formData.phoneNumber}
                onChange={handleInputChange("phoneNumber")}
                error={errors.phoneNumber}
                required
              />

              <div>
                <InputField
                  label="Password *"
                  type="text"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={handleInputChange("password")}
                  error={errors.password}
                  required
                />
                <button
                  type="button"
                  onClick={generateRandomPassword}
                  className="text-xs text-purple-600 hover:text-purple-800 mt-1"
                >
                  Generate random password
                </button>
              </div>

              <div className="flex items-center space-x-4 pt-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Active account
                  </span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <InputField
                label="Salary (optional)"
                type="number"
                placeholder="Enter salary"
                value={formData.salary}
                onChange={handleInputChange("salary")}
                error={errors.salary}
              />

              <InputField
                label="Commission (optional)"
                type="number"
                placeholder="Enter commission"
                value={formData.commission}
                onChange={handleInputChange("commission")}
                error={errors.commission}
              />
            </div>
          </div>

          {/* Role Selection Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-purple-600"
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
              Role & Permissions
            </h2>

            <div className="mb-4">
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setRoleType("predefined")}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    roleType === "predefined"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Predefined Role
                </button>
                <button
                  type="button"
                  onClick={() => setRoleType("custom")}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    roleType === "custom"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Custom Permissions
                </button>
              </div>
            </div>

            {roleType === "predefined" ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Role *
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select a role...</option>
                  {Object.values(PREDEFINED_ROLES).map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </option>
                  ))}
                </select>
                {errors.role && (
                  <p className="text-red-600 text-sm mt-1">{errors.role}</p>
                )}

                {selectedPermissions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">
                      Selected permissions: {selectedPermissions.length}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <InputField
                  label="Custom Role Name *"
                  type="text"
                  placeholder="Enter role name"
                  value={customRoleName}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                  error={errors.customRole}
                  required
                />

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Permissions *
                  </label>
                  <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {modules.map((module) => (
                      <div key={module.key} className="border-b border-gray-100 pb-2">
                        <div className="font-medium text-gray-900 mb-2">
                          {module.label}
                        </div>
                        <div className="grid grid-cols-2 gap-2 ml-4">
                          {module.permissions.map((perm) => (
                            <label
                              key={perm.value}
                              className="flex items-center text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(perm.value)}
                                onChange={() => togglePermission(perm.value)}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-gray-700">
                                {perm.label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {errors.permissions && (
                    <p className="text-red-600 text-sm mt-1">
                      {errors.permissions}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              onClick={() => navigate("/superadmin/dashboard")}
              className="bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            >
              {loading ? "Registering..." : "Register User"}
            </Button>
          </div>
        </form>
      </div>

      {/* Success Dialog */}
      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="User Registered Successfully"
        message={successMessage}
      />

      {/* Error Dialog */}
      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Registration Failed"
        message={errorMessage}
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default RegisterUser;
