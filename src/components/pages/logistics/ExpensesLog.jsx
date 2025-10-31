import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";
import Button from "../../ui/Button";

const ExpensesLog = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    vehicleId: "",
    date: "",
    type: "",
    amount: "",
    note: "",
  });

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
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const expenseTypes = [
    "fuel",
    "repair",
    "maintenance",
    "insurance",
    "license",
    "parking",
    "toll",
    "other",
  ];

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Filter expenses
  useEffect(() => {
    let filtered = expenses;

    if (filterVehicle !== "all") {
      filtered = filtered.filter((exp) => exp.vehicleId === filterVehicle);
    }

    if (filterType !== "all") {
      filtered = filtered.filter((exp) => exp.type === filterType);
    }

    setFilteredExpenses(filtered);
  }, [expenses, filterVehicle, filterType]);

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

  const loadAllExpenses = useCallback(async () => {
    if (vehicles.length === 0) return; // Guard clause

    try {
      const allExpenses = [];

      for (const vehicle of vehicles) {
        const expensesRef = collection(db, `vehicles/${vehicle.id}/expenses`);
        const expensesQuery = query(expensesRef, orderBy("date", "desc"));
        const expensesSnapshot = await getDocs(expensesQuery);

        expensesSnapshot.docs.forEach((doc) => {
          allExpenses.push({
            id: doc.id,
            vehicleId: vehicle.id,
            vehicleBrand: vehicle.brand,
            vehicleRegNo: vehicle.regNo,
            ...doc.data(),
          });
        });
      }

      // Sort all expenses by date
      allExpenses.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
      });

      setExpenses(allExpenses);
    } catch (error) {
      console.error("Error loading expenses:", error);
      setErrorMessage("Failed to load expenses. Please try again.");
      setShowError(true);
    }
  }, [vehicles]);

  useEffect(() => {
    if (currentUser) {
      loadVehicles();
      loadAllExpenses();
    }
  }, [currentUser, loadAllExpenses]);
  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "amount") {
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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.vehicleId) {
      newErrors.vehicleId = "Vehicle selection is required";
    }
    if (!formData.date) {
      newErrors.date = "Date is required";
    }
    if (!formData.type) {
      newErrors.type = "Expense type is required";
    }
    if (!formData.amount) {
      newErrors.amount = "Amount is required";
    }
    // if (!formData.note.trim()) {
    //   newErrors.note = "Note is required";
    // }

    if (
      formData.amount &&
      (isNaN(formData.amount) || parseFloat(formData.amount) <= 0)
    ) {
      newErrors.amount = "Please enter a valid amount greater than 0";
    }

    if (formData.date && new Date(formData.date) > new Date()) {
      newErrors.date = "Date cannot be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage("You must be logged in to add expenses.");
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const expenseRef = collection(
        db,
        `vehicles/${formData.vehicleId}/expenses`
      );

      const expenseData = {
        date: new Date(formData.date),
        type: formData.type,
        amount: parseFloat(formData.amount),
        note: formData.note.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
      };

      await addDoc(expenseRef, expenseData);

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: "expense_added",
          description: `New ${formData.type} expense added: Rs. ${formData.amount}`,
          performedBy: currentUser.userId,
          targetVehicleId: formData.vehicleId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        `Expense of Rs. ${formData.amount} for ${formData.type} has been successfully recorded!`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        vehicleId: "",
        date: "",
        type: "",
        amount: "",
        note: "",
      });

      // Reload expenses
      await loadAllExpenses();
    } catch (error) {
      console.error("Error adding expense:", error);

      let errorMsg = "Failed to add expense. Please try again.";

      if (error.code === "permission-denied") {
        errorMsg = "You don't have permission to add expenses.";
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `Rs. ${parseFloat(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const dateObj = date?.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Vehicle Expenses
              </h1>
              <p className="text-gray-600 mt-1">Track vehicle expenses</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Button
                variant={showForm ? "outline" : "primary"}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "View List" : "Add Expense"}
              </Button>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Add Expense Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Add New Expense
              </h2>
              <p className="text-gray-600">Record a vehicle expense</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                      {vehicle.brand} - {vehicle.regNo}
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
                label="Date"
                type="date"
                value={formData.date}
                onChange={handleInputChange("date")}
                error={errors.date}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expense Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={handleInputChange("type")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select expense type</option>
                  {expenseTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
                {errors.type && (
                  <p className="text-sm text-red-600 mt-1">{errors.type}</p>
                )}
              </div>

              <InputField
                label="Amount (Rs.)"
                type="number"
                placeholder="Enter amount"
                value={formData.amount}
                onChange={handleInputChange("amount")}
                error={errors.amount}
                required
                step="0.01"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Enter note or description"
                  value={formData.note}
                  onChange={handleInputChange("note")}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* {errors.note && (
                  <p className="text-sm text-red-600 mt-1">{errors.note}</p>
                )} */}
              </div>

              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={loading} size="lg">
                  {loading ? "Adding..." : "Add Expense"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Expenses List */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <select
                  value={filterVehicle}
                  onChange={(e) => setFilterVehicle(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Vehicles</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} - {vehicle.regNo}
                    </option>
                  ))}
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  {expenseTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            {filteredExpenses.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">💸</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No expenses found
                </h3>
                <p className="text-gray-600 mb-6">
                  {filterVehicle !== "all" || filterType !== "all"
                    ? "Try adjusting your filters"
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
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Note
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
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {expense.vehicleBrand} - {expense.vehicleRegNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {expense.type.charAt(0).toUpperCase() +
                              expense.type.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {expense.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="Expense Added Successfully!"
          message={successMessage}
          buttonText="Add Another Expense"
        />

        <FailDialog
          isOpen={showError}
          onClose={() => setShowError(false)}
          title="Failed to Add Expense"
          message={errorMessage}
          buttonText="Try Again"
          onRetry={() => setShowError(false)}
        />
      </div>
    </div>
  );
};

export default ExpensesLog;
