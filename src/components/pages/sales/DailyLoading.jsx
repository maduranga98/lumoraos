import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const DailyLoading = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    repId: "",
    routeId: "",
    lorryId: "",
    driverId: "",
    helperId: "",
  });

  const [employees, setEmployees] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [stockItems, setStockItems] = useState([]);

  const [currentItem, setCurrentItem] = useState({
    productId: "",
    batchId: "",
    qty: "",
    price: "",
  });

  const [selectedBatch, setSelectedBatch] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  const fetchEmployees = useCallback(async () => {
    try {
      const employeesSnapshot = await getDocs(collection(db, "users"));
      const employeesData = employeesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error fetching employees:", error);
      throw error;
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const vehiclesSnapshot = await getDocs(collection(db, "vehicles"));
      const vehiclesData = vehiclesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVehicles(vehiclesData.filter((v) => v.isActive));
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      throw error;
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const productsSnapshot = await getDocs(collection(db, "products"));
      const productsData = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  }, []);

  const fetchAssignments = useCallback(async () => {
    try {
      const assignmentsSnapshot = await getDocs(
        collection(db, "route_assignments")
      );
      const assignmentsData = assignmentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAssignments(assignmentsData);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      throw error;
    }
  }, []);

  const fetchAssignedRoutes = useCallback(async () => {
    try {
      const activeAssignments = assignments.filter(
        (assignment) =>
          assignment.repId === formData.repId && assignment.assignedTo === null
      );

      const routesRef = collection(db, "routes");
      const routesSnapshot = await getDocs(routesRef);
      const allRoutes = routesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const assignedRoutes = activeAssignments
        .map((assignment) => {
          const route = allRoutes.find((r) => r.id === assignment.routeId);
          return route ? { ...route, assignmentId: assignment.id } : null;
        })
        .filter((route) => route !== null);

      setRoutes(assignedRoutes);
    } catch (error) {
      console.error("Error fetching assigned routes:", error);
    }
  }, [formData.repId, assignments]);

  const fetchAllData = useCallback(async () => {
    setFetchingData(true);
    try {
      await Promise.all([
        fetchEmployees(),
        fetchVehicles(),
        fetchProducts(),
        fetchAssignments(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
      setErrorMessage("Failed to load data");
      setShowError(true);
    } finally {
      setFetchingData(false);
    }
  }, [fetchEmployees, fetchVehicles, fetchProducts, fetchAssignments]);

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    }
  }, [currentUser, fetchAllData]);

  useEffect(() => {
    if (currentItem.batchId) {
      const batch = batches.find((b) => b.id === currentItem.batchId);
      setSelectedBatch(batch);
      if (batch) {
        setCurrentItem((prev) => ({
          ...prev,
          price: batch.sellingPrice || "",
        }));
      }
    } else {
      setSelectedBatch(null);
    }
  }, [currentItem.batchId, batches]);

  useEffect(() => {
    if (formData.repId) {
      fetchAssignedRoutes();
    } else {
      setRoutes([]);
    }
  }, [formData.repId, fetchAssignedRoutes]);

  const fetchBatchesByProduct = useCallback(async (productId) => {
    try {
      const batchesRef = collection(db, "production_batches");
      const batchesQuery = query(
        batchesRef,
        where("productId", "==", productId)
      );
      const batchesSnapshot = await getDocs(batchesQuery);
      const batchesData = batchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter batches with available quantity
      const availableBatches = batchesData.filter(
        (batch) => batch.quantityProduced > 0
      );

      setBatches(availableBatches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      setErrorMessage("Failed to load batches");
      setShowError(true);
    }
  }, []);

  useEffect(() => {
    if (currentItem.productId) {
      fetchBatchesByProduct(currentItem.productId);
    } else {
      setBatches([]);
      setSelectedBatch(null);
    }
  }, [currentItem.productId, fetchBatchesByProduct]);

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));

    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleItemChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "qty" || field === "price") {
      value = value.replace(/[^0-9.]/g, "");
    }

    setCurrentItem((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateItem = () => {
    if (!currentItem.productId) {
      setErrorMessage("Please select a product");
      setShowError(true);
      return false;
    }
    if (!currentItem.batchId) {
      setErrorMessage("Please select a batch");
      setShowError(true);
      return false;
    }
    if (!currentItem.qty || parseFloat(currentItem.qty) <= 0) {
      setErrorMessage("Please enter a valid quantity");
      setShowError(true);
      return false;
    }
    if (
      selectedBatch &&
      parseFloat(currentItem.qty) > selectedBatch.quantityProduced
    ) {
      setErrorMessage(
        `Quantity cannot exceed available stock (${selectedBatch.quantityProduced})`
      );
      setShowError(true);
      return false;
    }
    if (!currentItem.price || parseFloat(currentItem.price) <= 0) {
      setErrorMessage("Please enter a valid price");
      setShowError(true);
      return false;
    }

    return true;
  };

  const addStockItem = () => {
    if (!validateItem()) return;

    const product = products.find((p) => p.id === currentItem.productId);
    const batch = batches.find((b) => b.id === currentItem.batchId);

    const newItem = {
      productId: currentItem.productId,
      productName: product?.name || "Unknown Product",
      batchId: currentItem.batchId,
      batchNumber: batch?.batchId || "Unknown Batch",
      qty: parseFloat(currentItem.qty),
      price: parseFloat(currentItem.price),
    };

    setStockItems([...stockItems, newItem]);

    // Reset current item
    setCurrentItem({
      productId: "",
      batchId: "",
      qty: "",
      price: "",
    });
    setSelectedBatch(null);
  };

  const removeStockItem = (index) => {
    setStockItems(stockItems.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.repId) newErrors.repId = "Sales rep is required";
    if (!formData.routeId) newErrors.routeId = "Route is required";
    if (!formData.lorryId) newErrors.lorryId = "Vehicle is required";
    if (!formData.driverId) newErrors.driverId = "Driver is required";

    if (stockItems.length === 0) {
      setErrorMessage("Please add at least one stock item");
      setShowError(true);
      return false;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage("You must be logged in to create daily loading");
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const loadingData = {
        date: formData.date,
        repId: formData.repId,
        routeId: formData.routeId,
        lorryId: formData.lorryId,
        driverId: formData.driverId,
        helperId: formData.helperId || null,
        stock: stockItems.map((item) => ({
          productId: item.productId,
          batchId: item.batchId,
          qty: item.qty,
          price: item.price,
        })),
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
      };

      await addDoc(collection(db, "daily_loadings"), loadingData);

      setSuccessMessage("Daily loading created successfully!");
      setShowSuccess(true);

      // Reset form
      setFormData({
        date: new Date().toISOString().split("T")[0],
        repId: "",
        routeId: "",
        lorryId: "",
        driverId: "",
        helperId: "",
      });
      setStockItems([]);
      setRoutes([]);
    } catch (error) {
      console.error("Error creating daily loading:", error);
      setErrorMessage("Failed to create daily loading. Please try again.");
      setShowError(true);
    } finally {
      setLoading(false);
    }
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

  if (authLoading || fetchingData) {
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

  const salesReps = employees.filter((emp) => emp.role === "Sales Rep");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Daily Loading
            </h1>
            <p className="text-gray-600">Create daily loading for delivery</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    Sales Representative <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.repId}
                    onChange={handleInputChange("repId")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Select sales rep</option>
                    {salesReps.map((rep) => (
                      <option key={rep.id} value={rep.id}>
                        {rep.fullName}
                      </option>
                    ))}
                  </select>
                  {errors.repId && (
                    <p className="text-sm text-red-600 mt-1">{errors.repId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Route <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.routeId}
                    onChange={handleInputChange("routeId")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                    disabled={!formData.repId || routes.length === 0}
                  >
                    <option value="">Select route</option>
                    {routes.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.name} ({route.area_covered?.join(", ")})
                      </option>
                    ))}
                  </select>
                  {errors.routeId && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.routeId}
                    </p>
                  )}
                  {formData.repId && routes.length === 0 && (
                    <p className="text-sm text-yellow-600 mt-1">
                      No routes assigned to this sales rep
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.lorryId}
                    onChange={handleInputChange("lorryId")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.brand} - {vehicle.regNo}
                      </option>
                    ))}
                  </select>
                  {errors.lorryId && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.lorryId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driver <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.driverId}
                    onChange={handleInputChange("driverId")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  >
                    <option value="">Select driver</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} - {emp.role}
                      </option>
                    ))}
                  </select>
                  {errors.driverId && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.driverId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Helper (Optional)
                  </label>
                  <select
                    value={formData.helperId}
                    onChange={handleInputChange("helperId")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select helper (optional)</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} - {emp.role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Stock Loading */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Stock Loading
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product
                  </label>
                  <select
                    value={currentItem.productId}
                    onChange={handleItemChange("productId")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batch
                  </label>
                  <select
                    value={currentItem.batchId}
                    onChange={handleItemChange("batchId")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    disabled={!currentItem.productId || batches.length === 0}
                  >
                    <option value="">Select batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.batchId} (Avail: {batch.quantityProduced})
                      </option>
                    ))}
                  </select>
                  {currentItem.productId && batches.length === 0 && (
                    <p className="text-xs text-yellow-600 mt-1">
                      No batches available
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    placeholder="Enter qty"
                    value={currentItem.qty}
                    onChange={handleItemChange("qty")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price (Rs.)
                  </label>
                  <input
                    type="number"
                    placeholder="Price"
                    value={currentItem.price}
                    onChange={handleItemChange("price")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    step="0.01"
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={addStockItem}
                    className="w-full"
                  >
                    Add Item
                  </Button>
                </div>
              </div>

              {/* Batch Details */}
              {selectedBatch && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    Batch Details
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Available:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {selectedBatch.quantityProduced}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Expiry Date:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        {formatDate(selectedBatch.expiryDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Unit Cost:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        Rs. {selectedBatch.unitCost}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Selling Price:</span>
                      <span className="ml-2 font-semibold text-green-600">
                        Rs. {selectedBatch.sellingPrice}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Stock Items Table */}
              {stockItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Batch
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Quantity
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Price
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Total
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stockItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.productName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.batchNumber}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.qty}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            Rs. {item.price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            Rs. {(item.qty * item.price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <button
                              type="button"
                              onClick={() => removeStockItem(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2">
                      <tr>
                        <td
                          colSpan="4"
                          className="px-4 py-3 text-right text-sm font-semibold text-gray-900"
                        >
                          Grand Total:
                        </td>
                        <td
                          colSpan="2"
                          className="px-4 py-3 text-sm font-bold text-gray-900"
                        >
                          Rs.{" "}
                          {stockItems
                            .reduce(
                              (sum, item) => sum + item.qty * item.price,
                              0
                            )
                            .toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading} size="lg">
                {loading ? "Creating..." : "Create Loading"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Loading Created Successfully!"
        message={successMessage}
        buttonText="Create Another"
      />

      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Error"
        message={errorMessage}
        buttonText="Try Again"
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default DailyLoading;
