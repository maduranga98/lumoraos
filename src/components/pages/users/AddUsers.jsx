// src/components/pages/users/AddUsers.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  doc,
  setDoc,
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate, useLocation } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";
import {
  PREDEFINED_ROLES,
  getModulesForSelection,
} from "../../../config/permissions.config";
import { Shield, Users, Lock, CheckCircle } from "lucide-react";

const AddUsers = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    salary: "",
    commission: "",
    phone: "",
    email: "",
    hasAccount: false,
    username: "",
  });

  // Role & Permission state
  const [roleType, setRoleType] = useState("predefined"); // "predefined" or "custom"
  const [selectedPredefinedRole, setSelectedPredefinedRole] = useState("");
  const [customRoleName, setCustomRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [expandedModules, setExpandedModules] = useState({});

  // Other state
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  // Get modules for permission selection
  const modules = getModulesForSelection();

  // Handle predefined role selection
  const handlePredefinedRoleChange = useCallback((roleId) => {
    setSelectedPredefinedRole(roleId);

    if (roleId) {
      const role = PREDEFINED_ROLES[roleId.toUpperCase()];
      if (role) {
        if (role.permissions === "all") {
          // Admin role - select all permissions
          const allPerms = [];
          modules.forEach((module) => {
            module.permissions.forEach((perm) => {
              allPerms.push(perm.value);
            });
          });
          setSelectedPermissions(allPerms);
        } else {
          // Set predefined role permissions
          setSelectedPermissions([...role.permissions]);
        }
      }
    } else {
      setSelectedPermissions([]);
    }
  }, [modules]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Handle edit mode - populate form with existing employee data
  useEffect(() => {
    if (location.state?.editEmployee) {
      const employee = location.state.editEmployee;
      setIsEditMode(true);
      setEditEmployeeId(employee.id);

      // Populate form data
      setFormData({
        name: employee.name || employee.fullName || "",
        salary: employee.salary || "",
        commission: employee.commission || "",
        phone: employee.phone || employee.phoneNumber || "",
        email: employee.email || "",
        hasAccount: employee.hasAccount || false,
        username: employee.username || "",
      });

      // Set role information
      if (employee.roleType === "predefined") {
        setRoleType("predefined");
        setSelectedPredefinedRole(employee.roleId || "");
        handlePredefinedRoleChange(employee.roleId || "");
      } else {
        setRoleType("custom");
        setCustomRoleName(employee.role || "");
        setSelectedPermissions(employee.permissions || []);
      }
    }
  }, [location.state, handlePredefinedRoleChange]);

  // Toggle role type
  const handleRoleTypeChange = (type) => {
    setRoleType(type);
    setSelectedPredefinedRole("");
    setCustomRoleName("");
    setSelectedPermissions([]);
  };

  // Toggle module expansion
  const toggleModule = (moduleKey) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleKey]: !prev[moduleKey],
    }));
  };

  // Toggle individual permission
  const togglePermission = (permissionValue) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permissionValue)) {
        return prev.filter((p) => p !== permissionValue);
      } else {
        return [...prev, permissionValue];
      }
    });
  };

  // Toggle all permissions in a module
  const toggleModulePermissions = (module) => {
    const modulePermValues = module.permissions.map((p) => p.value);
    const allSelected = modulePermValues.every((p) =>
      selectedPermissions.includes(p)
    );

    if (allSelected) {
      // Deselect all
      setSelectedPermissions((prev) =>
        prev.filter((p) => !modulePermValues.includes(p))
      );
    } else {
      // Select all
      setSelectedPermissions((prev) => {
        const newPerms = [...prev];
        modulePermValues.forEach((p) => {
          if (!newPerms.includes(p)) {
            newPerms.push(p);
          }
        });
        return newPerms;
      });
    }
  };

  // Check if module is fully selected
  const isModuleFullySelected = (module) => {
    return module.permissions.every((p) =>
      selectedPermissions.includes(p.value)
    );
  };

  // Check if module is partially selected
  const isModulePartiallySelected = (module) => {
    const selected = module.permissions.filter((p) =>
      selectedPermissions.includes(p.value)
    );
    return selected.length > 0 && selected.length < module.permissions.length;
  };

  // Handle input changes
  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "username") {
      value = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
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

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

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

  // Generate password
  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setGeneratedPassword(password);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (roleType === "predefined" && !selectedPredefinedRole) {
      newErrors.role = "Please select a role";
    }

    if (roleType === "custom" && !customRoleName.trim()) {
      newErrors.customRole = "Please enter a custom role name";
    }

    if (selectedPermissions.length === 0) {
      newErrors.permissions = "Please select at least one permission";
    }

    if (formData.hasAccount) {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required for account access";
      } else if (formData.username.length < 3) {
        newErrors.username = "Username must be at least 3 characters";
      } else if (usernameAvailable === false) {
        newErrors.username = "Username is already taken";
      }

      if (!generatedPassword) {
        newErrors.password = "Please generate a password";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Check if user is authenticated
    if (!currentUser) {
      setErrorMessage("You must be logged in to manage employees.");
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      // Determine final role name
      const finalRole =
        roleType === "predefined"
          ? PREDEFINED_ROLES[selectedPredefinedRole.toUpperCase()].name
          : customRoleName;

      // Get current user ID - support multiple ID field names
      const creatorId = currentUser.id || currentUser.uid || currentUser.userId;

      // Prepare user data
      const userData = {
        name: formData.name,
        fullName: formData.name,
        role: finalRole,
        roleType: roleType,
        roleId:
          roleType === "predefined"
            ? selectedPredefinedRole
            : customRoleName.toLowerCase().replace(/\s+/g, "_"),
        permissions: selectedPermissions,
        salary: Number(formData.salary) || 0,
        commission: Number(formData.commission) || 0,
        phone: formData.phone || "",
        phoneNumber: formData.phone || "",
        email: formData.email || "",
        hasAccount: formData.hasAccount,
        updatedAt: serverTimestamp(),
        updatedBy: creatorId,
        status: "active",
        isActive: true,
      };

      if (isEditMode) {
        // Update existing employee
        const employeeRef = doc(db, "users", editEmployeeId);
        await updateDoc(employeeRef, userData);

        setSuccessMessage(`Employee "${formData.name}" updated successfully!`);
        setShowSuccess(true);
      } else {
        // Create new employee
        userData.createdAt = serverTimestamp();
        userData.createdBy = creatorId;

        if (formData.hasAccount) {
          userData.username = formData.username.toLowerCase();
          userData.password = generatedPassword; // In production, hash this!
        }

        // Save to Firestore
        const userRef = await addDoc(collection(db, "users"), userData);

        // If username provided, reserve it
        if (formData.hasAccount && formData.username) {
          await setDoc(doc(db, "usernames", formData.username.toLowerCase()), {
            userId: userRef.id,
            createdAt: serverTimestamp(),
          });
        }

        setSuccessMessage(
          `Employee "${formData.name}" added successfully!${
            formData.hasAccount
              ? `\n\nLogin Credentials:\nUsername: ${formData.username}\nPassword: ${generatedPassword}\n\n⚠️ Please save these credentials securely!`
              : ""
          }`
        );
        setShowSuccess(true);

        // Reset form
        setFormData({
          name: "",
          salary: "",
          commission: "",
          phone: "",
          email: "",
          hasAccount: false,
          username: "",
        });
        setRoleType("predefined");
        setSelectedPredefinedRole("");
        setCustomRoleName("");
        setSelectedPermissions([]);
        setGeneratedPassword("");
        setUsernameAvailable(null);
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? "updating" : "adding"} user:`, error);
      setErrorMessage(
        `Failed to ${isEditMode ? "update" : "add"} employee. Please try again.`
      );
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
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
          Back
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isEditMode ? "Edit Employee" : "Add New Employee"}
              </h1>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update employee information and permissions"
                  : "Create user account with role-based permissions"}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Full Name"
                value={formData.name}
                onChange={handleInputChange("name")}
                error={errors.name}
                required
              />

              <InputField
                label="Phone Number"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange("phone")}
              />

              <InputField
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleInputChange("email")}
              />

              <InputField
                label="Salary"
                type="number"
                value={formData.salary}
                onChange={handleInputChange("salary")}
              />

              <InputField
                label="Commission (%)"
                type="number"
                value={formData.commission}
                onChange={handleInputChange("commission")}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Shield className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Role & Permissions
              </h2>
            </div>

            {/* Role Type Toggle */}
            <div className="flex space-x-4 mb-6">
              <button
                type="button"
                onClick={() => handleRoleTypeChange("predefined")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  roleType === "predefined"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Predefined Role
              </button>
              <button
                type="button"
                onClick={() => handleRoleTypeChange("custom")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  roleType === "custom"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Custom Role
              </button>
            </div>

            {/* Predefined Role Selection */}
            {roleType === "predefined" && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedPredefinedRole}
                  onChange={(e) => handlePredefinedRoleChange(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">Choose a role...</option>
                  {Object.entries(PREDEFINED_ROLES).map(([key, role]) => (
                    <option key={key} value={role.id}>
                      {role.name} - {role.description}
                    </option>
                  ))}
                </select>
                {errors.role && (
                  <p className="mt-1 text-sm text-red-600">{errors.role}</p>
                )}
              </div>
            )}

            {/* Custom Role Input */}
            {roleType === "custom" && (
              <div className="mb-6">
                <InputField
                  label="Custom Role Name"
                  value={customRoleName}
                  onChange={(e) => setCustomRoleName(e.target.value)}
                  placeholder="e.g., Warehouse Assistant"
                  error={errors.customRole}
                  required
                />
              </div>
            )}

            {/* Permissions Section */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Select Permissions
                </h3>
                <span className="text-sm text-gray-600">
                  {selectedPermissions.length} permissions selected
                </span>
              </div>

              {errors.permissions && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{errors.permissions}</p>
                </div>
              )}

              {/* Permissions by Module */}
              <div className="space-y-3">
                {modules.map((module) => {
                  const isExpanded = expandedModules[module.key];
                  const isFullySelected = isModuleFullySelected(module);
                  const isPartiallySelected = isModulePartiallySelected(module);

                  return (
                    <div
                      key={module.key}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Module Header */}
                      <div className="bg-gray-50 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isFullySelected}
                              ref={(input) => {
                                if (input) {
                                  input.indeterminate =
                                    isPartiallySelected && !isFullySelected;
                                }
                              }}
                              onChange={() => toggleModulePermissions(module)}
                              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <Lock className="w-5 h-5 text-gray-600" />
                            <span className="font-semibold text-gray-900">
                              {module.label}
                            </span>
                            <span className="text-sm text-gray-500">
                              (
                              {
                                module.permissions.filter((p) =>
                                  selectedPermissions.includes(p.value)
                                ).length
                              }
                              /{module.permissions.length})
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleModule(module.key)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </div>
                      </div>

                      {/* Module Permissions */}
                      {isExpanded && (
                        <div className="p-4 bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
                          {module.permissions.map((permission) => (
                            <label
                              key={permission.value}
                              className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedPermissions.includes(
                                  permission.value
                                )}
                                onChange={() =>
                                  togglePermission(permission.value)
                                }
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                              <span className="text-sm text-gray-700">
                                {permission.label}
                              </span>
                              {selectedPermissions.includes(
                                permission.value
                              ) && (
                                <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Account Access */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Account Access
            </h2>

            <label className="flex items-center space-x-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.hasAccount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    hasAccount: e.target.checked,
                  }))
                }
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <span className="text-gray-700 font-medium">
                Grant system access to this employee
              </span>
            </label>

            {formData.hasAccount && (
              <div className="space-y-4 mt-4 p-4 bg-indigo-50 rounded-lg">
                <div>
                  <InputField
                    label="Username"
                    value={formData.username}
                    onChange={handleInputChange("username")}
                    onBlur={(e) => checkUsernameAvailability(e.target.value)}
                    error={errors.username}
                    required
                  />
                  {usernameChecking && (
                    <p className="mt-1 text-sm text-gray-600">
                      Checking availability...
                    </p>
                  )}
                  {usernameAvailable === true && (
                    <p className="mt-1 text-sm text-green-600">
                      ✓ Username available
                    </p>
                  )}
                  {usernameAvailable === false && (
                    <p className="mt-1 text-sm text-red-600">
                      ✗ Username taken
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={generatedPassword}
                      readOnly
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                      placeholder="Click generate to create password"
                    />
                    <Button
                      type="button"
                      onClick={generatePassword}
                      variant="secondary"
                    >
                      Generate
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/employeelist")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditMode
                  ? "Updating Employee..."
                  : "Adding Employee..."
                : isEditMode
                ? "Update Employee"
                : "Add Employee"}
            </Button>
          </div>
        </form>

        {/* Success/Error Dialogs */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => {
            setShowSuccess(false);
            navigate("/employeelist");
          }}
          message={successMessage}
        />

        <FailDialog
          isOpen={showError}
          onClose={() => setShowError(false)}
          message={errorMessage}
        />
      </div>
    </div>
  );
};

export default AddUsers;
