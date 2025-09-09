import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";

import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";
import Button from "../../ui/Button";

const ExpensesLog = ({ editExpense = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const isEditMode = !!editExpense;

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: "",
    expenseDate: "",
    expenseType: "",
    description: "",
    vendor: "",
    odometerReading: "",
    paymentMethod: "",
    amount: "",
    invoiceNumber: "",
    category: "",
  });

  // Component state
  const [vehicles, setVehicles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // View state
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const expenseTypes = [
    "Fuel",
    "Insurance",
    "License Renewal",
    "Tires",
    "Parking",
    "Tolls",
    "Maintenance",
    "Repairs",
    "Registration",
    "Miscellaneous",
  ];

  const paymentMethods = [
    "Cash",
    "Bank Transfer",
    "Credit Card",
    "Debit Card",
    "Account",
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load vehicles and expenses
  useEffect(() => {
    if (currentUser) {
      loadVehicles();
      loadExpenses();
    }
  }, [currentUser]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editExpense) {
      setFormData({
        vehicleId: editExpense.vehicleId || "",
        expenseDate: editExpense.expenseDate || "",
        expenseType: editExpense.expenseType || "",
        description: editExpense.description || "",
        vendor: editExpense.vendor || "",
        odometerReading: editExpense.odometerReading?.toString() || "",
        paymentMethod: editExpense.paymentMethod || "",
        amount: editExpense.amount?.toString() || "",
        invoiceNumber: editExpense.invoiceNumber || "",
        category: editExpense.category || editExpense.expenseType || "",
      });
      setShowForm(true);
    }
  }, [editExpense]);

  // Filter expenses
  useEffect(() => {
    let filtered = expenses;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (expense) =>
          expense.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          expense.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          expense.expenseType
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          expense.invoiceNumber
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter(
        (expense) => expense.expenseType === filterType
      );
    }

    // Apply vehicle filter
    if (filterVehicle !== "all") {
      filtered = filtered.filter(
        (expense) => expense.vehicleId === filterVehicle
      );
    }

    setFilteredExpenses(filtered);
  }, [expenses, searchTerm, filterType, filterVehicle]);

  const loadVehicles = async () => {
    try {
      const vehiclesSnapshot = await getDocs(collection(db, "vehicles"));
      const vehiclesData = vehiclesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVehicles(vehiclesData.filter((v) => v.isActive));
    } catch (error) {
      console.error("Error loading vehicles:", error);
    }
  };

  const loadExpenses = async () => {
    try {
      const expensesQuery = query(
        collection(db, "expenses"),
        orderBy("expenseDate", "desc")
      );
      const expensesSnapshot = await getDocs(expensesQuery);
      const expensesData = expensesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setExpenses(expensesData);
    } catch (error) {
      console.error("Error loading expenses:", error);
      setErrorMessage("Failed to load expenses. Please try again.");
      setShowError(true);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "amount" || field === "odometerReading") {
      value = value.replace(/[^0-9.]/g, "");
    } else if (field === "category") {
      // Auto-set category based on expense type if not manually changed
      if (formData.expenseType && !value) {
        value = formData.expenseType;
      }
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
      // Auto-sync category with expense type
      ...(field === "expenseType" ? { category: value } : {}),
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("File size must be less than 5MB");
        setShowError(true);
        return;
      }
      // Check file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        setErrorMessage("Only JPG, PNG, and PDF files are allowed");
        setShowError(true);
        return;
      }
      setSelectedFile(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.vehicleId)
      newErrors.vehicleId = "Vehicle selection is required";
    if (!formData.expenseDate)
      newErrors.expenseDate = "Expense date is required";
    if (!formData.expenseType)
      newErrors.expenseType = "Expense type is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (!formData.amount) newErrors.amount = "Amount is required";
    if (!formData.paymentMethod)
      newErrors.paymentMethod = "Payment method is required";

    // Validation rules
    if (
      formData.amount &&
      (isNaN(formData.amount) || parseFloat(formData.amount) <= 0)
    ) {
      newErrors.amount = "Please enter a valid amount greater than 0";
    }

    if (formData.odometerReading && isNaN(formData.odometerReading)) {
      newErrors.odometerReading = "Please enter a valid odometer reading";
    }

    if (formData.expenseDate && new Date(formData.expenseDate) > new Date()) {
      newErrors.expenseDate = "Expense date cannot be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadReceiptFile = async (file, expenseId) => {
    try {
      const fileExtension = file.name.split(".").pop();
      const fileName = `receipts/${expenseId}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);

      const uploadTask = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);

      return downloadURL;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error("Failed to upload receipt");
    }
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
        "You must be logged in to manage expenses. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      let expenseId;
      let expenseDocRef;

      if (isEditMode) {
        expenseId = editExpense.expenseId || editExpense.id;
        expenseDocRef = doc(db, "expenses", expenseId);
      } else {
        expenseDocRef = doc(collection(db, "expenses"));
        expenseId = expenseDocRef.id;
      }

      // Upload receipt if selected
      let receiptURL = editExpense?.receiptURL || null;
      if (selectedFile) {
        receiptURL = await uploadReceiptFile(selectedFile, expenseId);
      }

      const expenseData = cleanData({
        ...(isEditMode ? {} : { expenseId: expenseId }),
        vehicleId: formData.vehicleId,
        expenseDate: formData.expenseDate,
        expenseType: formData.expenseType,
        description: formData.description.trim(),
        vendor: formData.vendor.trim(),
        odometerReading: formData.odometerReading
          ? parseFloat(formData.odometerReading)
          : null,
        paymentMethod: formData.paymentMethod,
        amount: parseFloat(formData.amount),
        invoiceNumber: formData.invoiceNumber.trim(),
        category: formData.category || formData.expenseType,
        receiptURL: receiptURL,

        // System fields
        ...(isEditMode
          ? {}
          : { createdAt: serverTimestamp(), createdBy: currentUser.userId }),
        updatedAt: serverTimestamp(),
        ...(isEditMode ? { updatedBy: currentUser.userId } : {}),
      });

      if (isEditMode) {
        await updateDoc(expenseDocRef, expenseData);
      } else {
        await setDoc(expenseDocRef, expenseData);
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: isEditMode ? "expense_updated" : "expense_added",
          description: isEditMode
            ? `Expense ${formData.description} was updated (${formData.amount})`
            : `New expense ${formData.description} was added (${formData.amount})`,
          performedBy: currentUser.userId,
          targetExpenseId: expenseId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        isEditMode
          ? `Expense has been successfully updated!`
          : `Expense has been successfully recorded with ID: ${expenseId}`
      );
      setShowSuccess(true);

      // Reset form and reload expenses
      if (!isEditMode) {
        setFormData({
          vehicleId: "",
          expenseDate: "",
          expenseType: "",
          description: "",
          vendor: "",
          odometerReading: "",
          paymentMethod: "",
          amount: "",
          invoiceNumber: "",
          category: "",
        });
        setSelectedFile(null);
      } else {
        setTimeout(() => {
          setShowForm(false);
        }, 1500);
      }

      await loadExpenses();
    } catch (error) {
      console.error("Error managing expense:", error);

      let errorMsg = `Failed to ${
        isEditMode ? "update" : "add"
      } expense. Please try again.`;

      if (error.message === "Failed to upload receipt") {
        errorMsg =
          "Failed to upload receipt. Please try again or proceed without receipt.";
      } else if (error.code === "permission-denied") {
        errorMsg = `You don't have permission to ${
          isEditMode ? "update" : "add"
        } expenses.`;
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewExpense = (expense) => {
    setSelectedExpense(expense);
    setShowModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(
      (v) => v.id === vehicleId || v.vehicleId === vehicleId
    );
    return vehicle
      ? `${vehicle.vehiclename} (${vehicle.vehiclenumber})`
      : "Unknown Vehicle";
  };

  // Show loading while checking auth
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

  // Don't render if user is not authenticated
  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Vehicle Expenses
              </h1>
              <p className="text-gray-600 mt-1">
                Track and manage all vehicle-related expenses
              </p>
            </div>
            <div className="mt-4 sm:mt-0 space-x-3">
              <Button
                variant={showForm ? "outline" : "primary"}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "View List" : "Add Expense"}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {expenses.length}
              </div>
              <div className="text-sm text-blue-800">Total Expenses</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
                )}
              </div>
              <div className="text-sm text-green-800">Total Amount</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {expenses.filter((exp) => exp.expenseType === "Fuel").length}
              </div>
              <div className="text-sm text-purple-800">Fuel Expenses</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {new Date().toLocaleDateString("en-US", { month: "short" })}
              </div>
              <div className="text-sm text-orange-800">This Month</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Add/Edit Expense Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditMode ? "Edit Expense" : "Add New Expense"}
              </h2>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update expense details"
                  : "Record a new vehicle expense"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.vehicleId}
                      onChange={handleInputChange("vehicleId")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a vehicle</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehiclename} ({vehicle.vehiclenumber})
                        </option>
                      ))}
                    </select>
                    {errors.vehicleId && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.vehicleId}
                      </p>
                    )}
                  </div>

                  <InputField
                    label="Expense Date"
                    type="date"
                    value={formData.expenseDate}
                    onChange={handleInputChange("expenseDate")}
                    error={errors.expenseDate}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expense Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.expenseType}
                      onChange={handleInputChange("expenseType")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select expense type</option>
                      {expenseTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {errors.expenseType && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.expenseType}
                      </p>
                    )}
                  </div>

                  <InputField
                    label="Amount"
                    type="number"
                    placeholder="Enter amount"
                    value={formData.amount}
                    onChange={handleInputChange("amount")}
                    error={errors.amount}
                    required
                    step="0.01"
                  />
                </div>
              </div>

              {/* Detailed Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <InputField
                      label="Description"
                      type="text"
                      placeholder="Enter expense description"
                      value={formData.description}
                      onChange={handleInputChange("description")}
                      error={errors.description}
                      required
                    />
                  </div>

                  <InputField
                    label="Vendor/Supplier"
                    type="text"
                    placeholder="Enter vendor name"
                    value={formData.vendor}
                    onChange={handleInputChange("vendor")}
                  />

                  <InputField
                    label="Odometer Reading"
                    type="number"
                    placeholder="Enter odometer reading (optional)"
                    value={formData.odometerReading}
                    onChange={handleInputChange("odometerReading")}
                    error={errors.odometerReading}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={handleInputChange("paymentMethod")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select payment method</option>
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                    {errors.paymentMethod && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.paymentMethod}
                      </p>
                    )}
                  </div>

                  <InputField
                    label="Invoice/Receipt Number"
                    type="text"
                    placeholder="Enter invoice number (optional)"
                    value={formData.invoiceNumber}
                    onChange={handleInputChange("invoiceNumber")}
                  />

                  <InputField
                    label="Category"
                    type="text"
                    placeholder="Category for finance tracking"
                    value={formData.category}
                    onChange={handleInputChange("category")}
                  />

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Receipt Upload
                    </label>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleFileSelect}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {selectedFile && (
                      <p className="text-sm text-green-600 mt-1">
                        Selected: {selectedFile.name} (
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Supported formats: JPG, PNG, PDF (Max 5MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={loading} size="lg">
                  {loading
                    ? isEditMode
                      ? "Updating..."
                      : "Adding..."
                    : isEditMode
                    ? "Update Expense"
                    : "Add Expense"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Expenses List */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search expenses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  {expenseTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  value={filterVehicle}
                  onChange={(e) => setFilterVehicle(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Vehicles</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehiclename} ({vehicle.vehiclenumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Expenses Table */}
            {filteredExpenses.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">💸</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No expenses found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterType !== "all" || filterVehicle !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by adding your first expense"}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  Add First Expense
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Vehicle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredExpenses.map((expense) => (
                      <tr
                        key={expense.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(expense.expenseDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getVehicleName(expense.vehicleId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {expense.expenseType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {expense.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewExpense(expense)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                // Set edit mode and show form
                                setFormData({
                                  vehicleId: expense.vehicleId,
                                  expenseDate: expense.expenseDate,
                                  expenseType: expense.expenseType,
                                  description: expense.description,
                                  vendor: expense.vendor || "",
                                  odometerReading:
                                    expense.odometerReading?.toString() || "",
                                  paymentMethod: expense.paymentMethod,
                                  amount: expense.amount?.toString(),
                                  invoiceNumber: expense.invoiceNumber || "",
                                  category:
                                    expense.category || expense.expenseType,
                                });
                                setShowForm(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* View Expense Modal */}
        {showModal && selectedExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Expense Details
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-2"
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
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Vehicle:</span>
                    <p className="text-gray-900">
                      {getVehicleName(selectedExpense.vehicleId)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Date:</span>
                    <p className="text-gray-900">
                      {formatDate(selectedExpense.expenseDate)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Type:</span>
                    <p className="text-gray-900">
                      {selectedExpense.expenseType}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Amount:</span>
                    <p className="text-gray-900 font-bold text-lg">
                      {formatCurrency(selectedExpense.amount)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">
                      Description:
                    </span>
                    <p className="text-gray-900">
                      {selectedExpense.description}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Vendor:</span>
                    <p className="text-gray-900">
                      {selectedExpense.vendor || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Payment Method:
                    </span>
                    <p className="text-gray-900">
                      {selectedExpense.paymentMethod}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Invoice Number:
                    </span>
                    <p className="text-gray-900">
                      {selectedExpense.invoiceNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Odometer:</span>
                    <p className="text-gray-900">
                      {selectedExpense.odometerReading
                        ? `${selectedExpense.odometerReading} km`
                        : "N/A"}
                    </p>
                  </div>
                  {selectedExpense.receiptURL && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">
                        Receipt:
                      </span>
                      <a
                        href={selectedExpense.receiptURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        View Receipt
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl">
                <Button variant="outline" onClick={() => setShowModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success Dialog */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title={isEditMode ? "Expense Updated!" : "Expense Added!"}
          message={successMessage}
          buttonText="Continue"
        />

        {/* Error Dialog */}
        <FailDialog
          isOpen={showError}
          onClose={() => setShowError(false)}
          title="Error"
          message={errorMessage}
          buttonText="Try Again"
          onRetry={() => setShowError(false)}
        />
      </div>
    </div>
  );
};

export default ExpensesLog;
