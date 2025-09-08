import React, { useState, useEffect } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const AddUsers = () => {
  const { user: currentUser } = useUser();

  const [formData, setFormData] = useState({
    // Basic Information
    fullName: "",
    username: "",
    email: "",
    phoneNumber: "",

    // Role and Department
    role: "",
    department: "",
    position: "",
    employeeId: "",

    // Address Information
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",

    // Personal Information
    dateOfBirth: "",
    gender: "",
    emergencyContactName: "",
    emergencyContactPhone: "",

    // Employment Details
    dateOfJoining: "",
    employmentType: "full-time",
    salary: "",
    reportingManager: "",

    // Bank Details
    bankName: "",
    bankBranch: "",
    accountNumber: "",
    routingNumber: "",

    // Additional Details
    nationalId: "",
    taxId: "",
    notes: "",
  });

  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showNewRoleInput, setShowNewRoleInput] = useState(false);
  const [showNewDepartmentInput, setShowNewDepartmentInput] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
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

  // Generate secure password
  const generatePassword = () => {
    const length = 12;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  // Initialize generated password
  useEffect(() => {
    setGeneratedPassword(generatePassword());
  }, []);

  const regeneratePassword = () => {
    setGeneratedPassword(generatePassword());
  };

  // Check username availability
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setUsernameChecking(true);
    try {
      const usernameDoc = await getDocs(
        query(collection(db, "usernames"), where("__name__", "==", username))
      );
      setUsernameAvailable(usernameDoc.empty);
    } catch (error) {
      console.error("Error checking username:", error);
      setUsernameAvailable(null);
    } finally {
      setUsernameChecking(false);
    }
  };

  // Debounced username check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.username) {
        checkUsernameAvailability(formData.username);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData.username]);

  // Load roles and departments on component mount
  useEffect(() => {
    loadRolesAndDepartments();
  }, []);

  const loadRolesAndDepartments = async () => {
    try {
      // Load roles
      const rolesSnapshot = await getDocs(collection(db, "roles"));
      const rolesData = rolesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRoles(rolesData);

      // Load departments
      const departmentsSnapshot = await getDocs(collection(db, "departments"));
      const departmentsData = departmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDepartments(departmentsData);
    } catch (error) {
      console.error("Error loading roles and departments:", error);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    // Format specific fields
    if (field === "username") {
      value = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    } else if (field === "email") {
      value = value.toLowerCase();
    } else if (field === "employeeId") {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
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

  const addNewRole = async () => {
    if (!newRole.trim()) return;

    try {
      await addDoc(collection(db, "roles"), {
        name: newRole.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid,
      });

      setNewRole("");
      setShowNewRoleInput(false);
      await loadRolesAndDepartments();
      setFormData((prev) => ({ ...prev, role: newRole.trim() }));
    } catch (error) {
      console.error("Error adding new role:", error);
    }
  };

  const addNewDepartment = async () => {
    if (!newDepartment.trim()) return;

    try {
      await addDoc(collection(db, "departments"), {
        name: newDepartment.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUser?.uid,
      });

      setNewDepartment("");
      setShowNewDepartmentInput(false);
      await loadRolesAndDepartments();
      setFormData((prev) => ({ ...prev, department: newDepartment.trim() }));
    } catch (error) {
      console.error("Error adding new department:", error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields validation
    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.username.trim()) newErrors.username = "Username is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.role.trim()) newErrors.role = "Role is required";
    if (!formData.department.trim())
      newErrors.department = "Department is required";
    // if (!formData.employeeId.trim())
    //   newErrors.employeeId = "Employee ID is required";

    // Username availability check
    if (formData.username && usernameAvailable === false) {
      newErrors.username = "Username is already taken";
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Phone number validation
    if (formData.phoneNumber && !/^\+?[\d\s-()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateEmployeeId = () => {
    const prefix = formData.department.substring(0, 3).toUpperCase();
    const randomNum = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `${prefix}${randomNum}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Check if current user is authenticated
    if (!currentUser?.uid) {
      setErrorMessage(
        "You must be logged in to create users. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        generatedPassword // Use generated password instead of storing user input
      );

      const newUser = userCredential.user;

      // Update display name
      await updateProfile(newUser, {
        displayName: formData.fullName,
      });

      // Prepare user data for Firestore (don't store password)
      // Filter out undefined values to prevent Firestore errors
      const cleanData = (obj) => {
        const cleaned = {};
        Object.keys(obj).forEach((key) => {
          if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
            if (
              typeof obj[key] === "object" &&
              !Array.isArray(obj[key]) &&
              obj[key].constructor === Object
            ) {
              const cleanedNested = cleanData(obj[key]);
              if (Object.keys(cleanedNested).length > 0) {
                cleaned[key] = cleanedNested;
              }
            } else {
              cleaned[key] = obj[key];
            }
          }
        });
        return cleaned;
      };

      const userData = cleanData({
        // Basic Info
        uid: newUser.uid,
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        phoneNumber: formData.phoneNumber,

        // Role and Department
        role: formData.role,
        department: formData.department,
        position: formData.position,
        employeeId: formData.employeeId || generateEmployeeId(),

        // Address
        address: {
          street: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
        },

        // Personal Info
        personalInfo: {
          dateOfBirth: formData.dateOfBirth,
          gender: formData.gender,
          emergencyContact: {
            name: formData.emergencyContactName,
            phone: formData.emergencyContactPhone,
          },
        },

        // Employment Details
        employment: {
          dateOfJoining: formData.dateOfJoining,
          employmentType: formData.employmentType,
          salary: formData.salary,
          reportingManager: formData.reportingManager,
        },

        // Bank Details
        bankDetails: {
          bankName: formData.bankName,
          bankBranch: formData.bankBranch,
          accountNumber: formData.accountNumber,
          routingNumber: formData.routingNumber,
        },

        // Additional Details
        additionalInfo: {
          nationalId: formData.nationalId,
          taxId: formData.taxId,
          notes: formData.notes,
        },

        // System fields
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: currentUser.uid, // Remove optional chaining since we verified it exists
        updatedAt: serverTimestamp(),
      });

      // Save to Firestore
      await setDoc(doc(db, "users", newUser.uid), userData);

      // Reserve username
      await setDoc(doc(db, "usernames", formData.username), {
        uid: newUser.uid,
        createdAt: serverTimestamp(),
      });

      // Log activity (only if we have required data)
      try {
        await addDoc(collection(db, "activities"), {
          type: "user_created",
          description: `New user ${formData.fullName} (${formData.username}) was created`,
          performedBy: currentUser.uid,
          targetUserId: newUser.uid,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        // Log activity error but don't fail the main operation
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        `User ${formData.fullName} has been successfully created with password: ${generatedPassword}`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        fullName: "",
        username: "",
        email: "",
        phoneNumber: "",
        role: "",
        department: "",
        position: "",
        employeeId: "",
        streetAddress: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
        dateOfBirth: "",
        gender: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        dateOfJoining: "",
        employmentType: "full-time",
        salary: "",
        reportingManager: "",
        bankName: "",
        bankBranch: "",
        accountNumber: "",
        routingNumber: "",
        nationalId: "",
        taxId: "",
        notes: "",
      });

      // Generate new password for next user
      setGeneratedPassword(generatePassword());
      setUsernameAvailable(null);
    } catch (error) {
      console.error("Error creating user:", error);

      // Provide more specific error messages
      let errorMsg = "Failed to create user. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMsg =
          "This email is already registered. Please use a different email.";
      } else if (error.code === "auth/weak-password") {
        errorMsg = "Password is too weak. Please generate a stronger password.";
      } else if (error.code === "auth/invalid-email") {
        errorMsg = "Please enter a valid email address.";
      } else if (error.message) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Employee Registration
            </h1>
            <p className="text-gray-600">
              Register a new employee with complete details
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Full Name"
                  type="text"
                  placeholder="Enter full name"
                  value={formData.fullName}
                  onChange={handleInputChange("fullName")}
                  error={errors.fullName}
                  required
                />
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
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
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
                      <div className="absolute right-3 top-3">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {usernameAvailable === true && (
                      <div className="absolute right-3 top-3 text-green-500">
                        ✓
                      </div>
                    )}
                    {usernameAvailable === false && (
                      <div className="absolute right-3 top-3 text-red-500">
                        ✗
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
                <InputField
                  label="Email"
                  type="email"
                  placeholder="Enter email address"
                  value={formData.email}
                  onChange={handleInputChange("email")}
                  error={errors.email}
                  required
                />
                <InputField
                  label="Phone Number"
                  type="tel"
                  placeholder="Enter phone number"
                  value={formData.phoneNumber}
                  onChange={handleInputChange("phoneNumber")}
                  error={errors.phoneNumber}
                />
              </div>

              {/* Auto-generated Password */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">
                      Auto-generated Password
                    </h3>
                    <p className="text-lg font-mono font-bold text-blue-700 mt-1">
                      {generatedPassword}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      This password will be shared with the employee
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={regeneratePassword}
                  >
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>

            {/* Role and Department */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Role & Department
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.role}
                      onChange={handleInputChange("role")}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a role</option>
                      <option value="HR">HR</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Employee">Employee</option>
                      <option value="Manager">Manager</option>
                      <option value="Admin">Admin</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.name}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowNewRoleInput(!showNewRoleInput)}
                    >
                      +
                    </Button>
                  </div>
                  {showNewRoleInput && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="New role name"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button type="button" size="sm" onClick={addNewRole}>
                        Add
                      </Button>
                    </div>
                  )}
                  {errors.role && (
                    <p className="text-sm text-red-600 mt-1">{errors.role}</p>
                  )}
                </div>

                {/* Department Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.department}
                      onChange={handleInputChange("department")}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a department</option>
                      <option value="Human Resources">Human Resources</option>
                      <option value="Finance">Finance</option>
                      <option value="IT">IT</option>
                      <option value="Sales">Sales</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Operations">Operations</option>
                      {departments
                        .filter((dept) => dept.isActive !== false)
                        .map((dept) => (
                          <option key={dept.id} value={dept.name}>
                            {dept.name}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setShowNewDepartmentInput(!showNewDepartmentInput)
                      }
                    >
                      +
                    </Button>
                  </div>
                  {showNewDepartmentInput && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="New department name"
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={addNewDepartment}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                  {errors.department && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.department}
                    </p>
                  )}
                </div>

                <InputField
                  label="Position"
                  type="text"
                  placeholder="Enter position/job title"
                  value={formData.position}
                  onChange={handleInputChange("position")}
                  error={errors.position}
                />
                <InputField
                  label="Employee ID"
                  type="text"
                  placeholder="Enter employee ID (auto-generated if empty)"
                  value={formData.employeeId}
                  onChange={handleInputChange("employeeId")}
                  error={errors.employeeId}
                />
              </div>
            </div>

            {/* Address Information */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Address Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <InputField
                    label="Street Address"
                    type="text"
                    placeholder="Enter street address"
                    value={formData.streetAddress}
                    onChange={handleInputChange("streetAddress")}
                  />
                </div>
                <InputField
                  label="City"
                  type="text"
                  placeholder="Enter city"
                  value={formData.city}
                  onChange={handleInputChange("city")}
                />
                <InputField
                  label="State/Province"
                  type="text"
                  placeholder="Enter state or province"
                  value={formData.state}
                  onChange={handleInputChange("state")}
                />
                <InputField
                  label="ZIP/Postal Code"
                  type="text"
                  placeholder="Enter ZIP or postal code"
                  value={formData.zipCode}
                  onChange={handleInputChange("zipCode")}
                />
                <InputField
                  label="Country"
                  type="text"
                  placeholder="Enter country"
                  value={formData.country}
                  onChange={handleInputChange("country")}
                />
              </div>
            </div>

            {/* Personal Information */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Date of Birth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange("dateOfBirth")}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={handleInputChange("gender")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <InputField
                  label="Emergency Contact Name"
                  type="text"
                  placeholder="Enter emergency contact name"
                  value={formData.emergencyContactName}
                  onChange={handleInputChange("emergencyContactName")}
                />
                <InputField
                  label="Emergency Contact Phone"
                  type="tel"
                  placeholder="Enter emergency contact phone"
                  value={formData.emergencyContactPhone}
                  onChange={handleInputChange("emergencyContactPhone")}
                />
              </div>
            </div>

            {/* Employment Details */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Employment Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Date of Joining"
                  type="date"
                  value={formData.dateOfJoining}
                  onChange={handleInputChange("dateOfJoining")}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employment Type
                  </label>
                  <select
                    value={formData.employmentType}
                    onChange={handleInputChange("employmentType")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="intern">Intern</option>
                    <option value="consultant">Consultant</option>
                  </select>
                </div>
                <InputField
                  label="Salary"
                  type="number"
                  placeholder="Enter salary amount"
                  value={formData.salary}
                  onChange={handleInputChange("salary")}
                />
                <InputField
                  label="Reporting Manager"
                  type="text"
                  placeholder="Enter reporting manager"
                  value={formData.reportingManager}
                  onChange={handleInputChange("reportingManager")}
                />
              </div>
            </div>

            {/* Bank Details */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Bank Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Bank Name"
                  type="text"
                  placeholder="Enter bank name"
                  value={formData.bankName}
                  onChange={handleInputChange("bankName")}
                />
                <InputField
                  label="Bank Branch"
                  type="text"
                  placeholder="Enter bank branch"
                  value={formData.bankBranch}
                  onChange={handleInputChange("bankBranch")}
                />
                <InputField
                  label="Account Number"
                  type="text"
                  placeholder="Enter account number"
                  value={formData.accountNumber}
                  onChange={handleInputChange("accountNumber")}
                />
                <InputField
                  label="Routing Number / IFSC Code"
                  type="text"
                  placeholder="Enter routing number or IFSC code"
                  value={formData.routingNumber}
                  onChange={handleInputChange("routingNumber")}
                />
              </div>
            </div>

            {/* Additional Details */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Additional Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="National ID"
                  type="text"
                  placeholder="Enter national ID number"
                  value={formData.nationalId}
                  onChange={handleInputChange("nationalId")}
                />
                <InputField
                  label="Tax ID"
                  type="text"
                  placeholder="Enter tax ID number"
                  value={formData.taxId}
                  onChange={handleInputChange("taxId")}
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={handleInputChange("notes")}
                    placeholder="Enter any additional notes..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading} size="lg">
                {loading ? "Registering Employee..." : "Register Employee"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Dialog */}
      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Employee Registered Successfully!"
        message={successMessage}
        buttonText="Register Another Employee"
      />

      {/* Error Dialog */}
      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Failed to Register Employee"
        message={errorMessage}
        buttonText="Try Again"
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default AddUsers;
