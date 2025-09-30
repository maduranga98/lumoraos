import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const MaterialMovements = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    materialId: "",
    type: "adjustment",
    supplierId: "",
    batchId: "",
    quantity: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Component state
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [filteredMovements, setFilteredMovements] = useState([]);
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
  const [filterMaterial, setFilterMaterial] = useState("all");
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const movementTypes = [
    { value: "purchase", label: "Purchase", color: "green" },
    { value: "used_in_production", label: "Used in Production", color: "blue" },
    { value: "adjustment", label: "Stock Adjustment", color: "orange" },
    { value: "wastage", label: "Wastage", color: "red" },
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load data
  useEffect(() => {
    if (currentUser) {
      loadMaterials();
      loadSuppliers();
      loadAllMovements();
    }
  }, [currentUser]);

  // Filter movements
  useEffect(() => {
    let filtered = movements;

    if (searchTerm) {
      filtered = filtered.filter(
        (movement) =>
          movement.materialName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          movement.movementId
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          movement.supplierName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter((movement) => movement.type === filterType);
    }

    if (filterMaterial !== "all") {
      filtered = filtered.filter(
        (movement) => movement.materialId === filterMaterial
      );
    }

    setFilteredMovements(filtered);
  }, [movements, searchTerm, filterType, filterMaterial]);

  const loadMaterials = async () => {
    try {
      const materialsQuery = query(
        collection(db, "raw_materials"),
        orderBy("name")
      );
      const materialsSnapshot = await getDocs(materialsQuery);
      const materialsData = materialsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMaterials(materialsData);
    } catch (error) {
      console.error("Error loading materials:", error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const suppliersQuery = query(
        collection(db, "suppliers"),
        orderBy("name")
      );
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersData = suppliersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSuppliers(suppliersData.filter((s) => s.status === "active"));
    } catch (error) {
      console.error("Error loading suppliers:", error);
    }
  };

  const loadAllMovements = async () => {
    try {
      const allMovements = [];

      // Get all materials
      const materialsSnapshot = await getDocs(collection(db, "raw_materials"));

      // For each material, get their movements subcollection
      for (const materialDoc of materialsSnapshot.docs) {
        const movementsQuery = query(
          collection(db, "raw_materials", materialDoc.id, "material_movements"),
          orderBy("date", "desc")
        );
        const movementsSnapshot = await getDocs(movementsQuery);

        movementsSnapshot.docs.forEach((movementDoc) => {
          allMovements.push({
            id: movementDoc.id,
            materialId: materialDoc.id,
            materialName: materialDoc.data().name,
            materialUnit: materialDoc.data().unit,
            ...movementDoc.data(),
          });
        });
      }

      // Enrich with supplier names
      const enrichedMovements = await Promise.all(
        allMovements.map(async (movement) => {
          if (movement.supplierId) {
            try {
              const supplierDoc = await getDoc(
                doc(db, "suppliers", movement.supplierId)
              );
              if (supplierDoc.exists()) {
                return {
                  ...movement,
                  supplierName: supplierDoc.data().name,
                };
              }
            } catch (error) {
              console.error("Error fetching supplier:", error);
            }
          }
          return movement;
        })
      );

      setMovements(enrichedMovements);
    } catch (error) {
      console.error("Error loading movements:", error);
      setErrorMessage("Failed to load movements. Please try again.");
      setShowError(true);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "quantity") {
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

    if (!formData.materialId) newErrors.materialId = "Material is required";
    if (!formData.type) newErrors.type = "Movement type is required";
    if (!formData.quantity.trim()) newErrors.quantity = "Quantity is required";
    if (!formData.date) newErrors.date = "Date is required";

    if (formData.type === "purchase" && !formData.supplierId) {
      newErrors.supplierId = "Supplier is required for purchases";
    }

    if (
      formData.quantity &&
      (isNaN(formData.quantity) || parseFloat(formData.quantity) <= 0)
    ) {
      newErrors.quantity = "Please enter a valid quantity greater than 0";
    }

    if (formData.date && new Date(formData.date) > new Date()) {
      newErrors.date = "Date cannot be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateMovementId = () => {
    const prefix = "MOV";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
    return `${prefix}${timestamp}${random}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage(
        "You must be logged in to record movements. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const materialId = formData.materialId;
      const movementId = generateMovementId();
      const movementDocRef = doc(
        collection(db, "raw_materials", materialId, "material_movements")
      );

      const quantity = parseFloat(formData.quantity);

      const movementData = {
        movementId: movementId,
        type: formData.type,
        supplierId: formData.supplierId || null,
        batchId: formData.batchId || null,
        quantity: quantity,
        date: new Date(formData.date),
        notes: formData.notes.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      };

      await setDoc(movementDocRef, movementData);

      // Update material's current stock
      const materialRef = doc(db, "raw_materials", materialId);
      const materialDoc = await getDoc(materialRef);

      if (materialDoc.exists()) {
        const currentStock = materialDoc.data().currentStock || 0;
        let newStock = currentStock;

        // Adjust stock based on movement type
        if (formData.type === "purchase" || formData.type === "adjustment") {
          newStock = currentStock + quantity;
        } else if (
          formData.type === "used_in_production" ||
          formData.type === "wastage"
        ) {
          newStock = Math.max(0, currentStock - quantity);
        }

        const updateData = {
          currentStock: newStock,
          updatedAt: serverTimestamp(),
        };

        // Update lastSupplier if it's a purchase
        if (formData.type === "purchase" && formData.supplierId) {
          updateData.lastSupplier = formData.supplierId;
        }

        await updateDoc(materialRef, updateData);
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: "material_movement",
          description: `${formData.type} recorded: ${quantity} units of ${
            materials.find((m) => m.id === materialId)?.name
          }`,
          performedBy: currentUser.userId,
          targetMovementId: movementId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        `Movement recorded successfully! Movement ID: ${movementId}`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        materialId: "",
        type: "adjustment",
        supplierId: "",
        batchId: "",
        quantity: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });

      await loadAllMovements();
      await loadMaterials();
    } catch (error) {
      console.error("Error recording movement:", error);

      let errorMsg = "Failed to record movement. Please try again.";

      if (error.code === "permission-denied") {
        errorMsg = "You don't have permission to record movements.";
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMovement = (movement) => {
    setSelectedMovement(movement);
    setShowModal(true);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getMovementTypeColor = (type) => {
    const typeObj = movementTypes.find((t) => t.value === type);
    const colors = {
      green: "bg-green-100 text-green-700",
      blue: "bg-blue-100 text-blue-700",
      orange: "bg-orange-100 text-orange-700",
      red: "bg-red-100 text-red-700",
    };
    return colors[typeObj?.color] || "bg-gray-100 text-gray-700";
  };

  const getMovementIcon = (type) => {
    switch (type) {
      case "purchase":
        return "↓";
      case "used_in_production":
        return "→";
      case "adjustment":
        return "⟳";
      case "wastage":
        return "×";
      default:
        return "•";
    }
  };

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
      <div className="max-w-7xl mx-auto">
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

        {/* Header */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Material Movements
              </h1>
              <p className="text-gray-600">
                Track all material stock movements and transactions
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Button onClick={() => setShowForm(!showForm)} size="lg">
                {showForm ? (
                  <>
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
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                    View Movements
                  </>
                ) : (
                  <>
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Record Movement
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                {movements.length}
              </div>
              <div className="text-sm text-blue-600 font-medium">
                Total Movements
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {movements.filter((m) => m.type === "purchase").length}
              </div>
              <div className="text-sm text-green-600 font-medium">
                Purchases
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                {
                  movements.filter((m) => m.type === "used_in_production")
                    .length
                }
              </div>
              <div className="text-sm text-purple-600 font-medium">
                Used in Production
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
              <div className="text-2xl font-bold text-red-700">
                {movements.filter((m) => m.type === "wastage").length}
              </div>
              <div className="text-sm text-red-600 font-medium">Wastage</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Record Movement Form */
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Record Material Movement
              </h2>
              <p className="text-gray-600">
                Track material transactions and stock changes
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Movement Details */}
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
                    <svg
                      className="w-5 h-5 text-indigo-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  Movement Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Material <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.materialId}
                      onChange={handleInputChange("materialId")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      <option value="">Select material</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name} - Current Stock:{" "}
                          {material.currentStock} {material.unit}
                        </option>
                      ))}
                    </select>
                    {errors.materialId && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.materialId}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Movement Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.type}
                      onChange={handleInputChange("type")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      {movementTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {errors.type && (
                      <p className="text-sm text-red-600 mt-1">{errors.type}</p>
                    )}
                  </div>

                  <InputField
                    label="Quantity"
                    type="number"
                    placeholder="Enter quantity"
                    value={formData.quantity}
                    onChange={handleInputChange("quantity")}
                    error={errors.quantity}
                    required
                    step="0.01"
                  />

                  <InputField
                    label="Date"
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange("date")}
                    error={errors.date}
                    required
                  />

                  {formData.type === "purchase" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Supplier <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.supplierId}
                        onChange={handleInputChange("supplierId")}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required={formData.type === "purchase"}
                      >
                        <option value="">Select supplier</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                      {errors.supplierId && (
                        <p className="text-sm text-red-600 mt-1">
                          {errors.supplierId}
                        </p>
                      )}
                    </div>
                  )}

                  {formData.type === "used_in_production" && (
                    <InputField
                      label="Batch ID (Optional)"
                      type="text"
                      placeholder="Enter production batch ID"
                      value={formData.batchId}
                      onChange={handleInputChange("batchId")}
                    />
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={handleInputChange("notes")}
                      placeholder="Enter any additional notes..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Stock Impact Indicator */}
              {formData.materialId && formData.quantity && (
                <div
                  className={`border rounded-xl p-4 ${
                    formData.type === "purchase" ||
                    formData.type === "adjustment"
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center">
                    <svg
                      className={`w-5 h-5 mr-2 ${
                        formData.type === "purchase" ||
                        formData.type === "adjustment"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p
                      className={`text-sm font-medium ${
                        formData.type === "purchase" ||
                        formData.type === "adjustment"
                          ? "text-green-700"
                          : "text-red-700"
                      }`}
                    >
                      {formData.type === "purchase" ||
                      formData.type === "adjustment"
                        ? `✓ Stock will increase by ${formData.quantity} units`
                        : `⚠ Stock will decrease by ${formData.quantity} units`}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowForm(false)}
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
                  {loading ? "Recording..." : "Record Movement"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Movements List */
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search movements..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 pl-11 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <svg
                      className="absolute left-3.5 top-3.5 h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <select
                  value={filterMaterial}
                  onChange={(e) => setFilterMaterial(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Materials</option>
                  {materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {material.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Types</option>
                  {movementTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Movements Table */}
            {filteredMovements.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-10 h-10 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm ||
                  filterType !== "all" ||
                  filterMaterial !== "all"
                    ? "No movements match your filters"
                    : "No movements yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm ||
                  filterType !== "all" ||
                  filterMaterial !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by recording your first movement"}
                </p>
                {!searchTerm &&
                  filterType === "all" &&
                  filterMaterial === "all" && (
                    <Button onClick={() => setShowForm(true)} size="lg">
                      Record First Movement
                    </Button>
                  )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Material
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reference
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredMovements.map((movement) => (
                      <tr
                        key={`${movement.materialId}-${movement.id}`}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(movement.date)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {movement.movementId}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {movement.materialName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${getMovementTypeColor(
                              movement.type
                            )}`}
                          >
                            <span className="mr-1.5 text-base">
                              {getMovementIcon(movement.type)}
                            </span>
                            {
                              movementTypes.find(
                                (t) => t.value === movement.type
                              )?.label
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            {movement.type === "purchase" ||
                            movement.type === "adjustment"
                              ? "+"
                              : "-"}
                            {movement.quantity} {movement.materialUnit}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {movement.supplierName || movement.batchId || "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewMovement(movement)}
                            className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* View Movement Modal */}
        {showModal && selectedMovement && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Movement Details
                    </h2>
                    <p className="text-gray-600">
                      {selectedMovement.movementId}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
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

              {/* Modal Body */}
              <div className="px-8 py-6 space-y-6">
                {/* Movement Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Movement Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Material
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {selectedMovement.materialName}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Type
                      </span>
                      <p className="mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${getMovementTypeColor(
                            selectedMovement.type
                          )}`}
                        >
                          {
                            movementTypes.find(
                              (t) => t.value === selectedMovement.type
                            )?.label
                          }
                        </span>
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Date
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDate(selectedMovement.date)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Quantity
                      </span>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {selectedMovement.type === "purchase" ||
                        selectedMovement.type === "adjustment"
                          ? "+"
                          : "-"}
                        {selectedMovement.quantity}{" "}
                        {selectedMovement.materialUnit}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Reference Information */}
                {(selectedMovement.supplierName ||
                  selectedMovement.batchId) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Reference Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedMovement.supplierName && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <span className="text-xs font-medium text-gray-500">
                            Supplier
                          </span>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {selectedMovement.supplierName}
                          </p>
                        </div>
                      )}
                      {selectedMovement.batchId && (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <span className="text-xs font-medium text-gray-500">
                            Batch ID
                          </span>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {selectedMovement.batchId}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedMovement.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Notes
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-900">
                        {selectedMovement.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-8 py-5 rounded-b-3xl border-t border-gray-200">
                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Dialog */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="Movement Recorded!"
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

export default MaterialMovements;
