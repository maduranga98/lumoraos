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
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const RawMaterials = ({ editMaterial = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    unit: "kg",
    currentStock: "",
    reorderLevel: "",
    lastSupplier: "",
  });

  // Component state
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // View state
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUnit, setFilterUnit] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);

  const isEditMode = !!editMaterial || !!editingMaterial;

  const unitOptions = [
    { value: "kg", label: "Kilograms (kg)" },
    { value: "liters", label: "Liters" },
    { value: "grams", label: "Grams (g)" },
    { value: "ml", label: "Milliliters (ml)" },
    { value: "units", label: "Units" },
    { value: "packets", label: "Packets" },
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load materials and suppliers
  useEffect(() => {
    if (currentUser) {
      loadMaterials();
      loadSuppliers();
    }
  }, [currentUser]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editMaterial) {
      setFormData({
        name: editMaterial.name || "",
        unit: editMaterial.unit || "kg",
        currentStock: editMaterial.currentStock?.toString() || "",
        reorderLevel: editMaterial.reorderLevel?.toString() || "",
        lastSupplier: editMaterial.lastSupplier || "",
      });
      setShowForm(true);
    }
  }, [editMaterial]);

  // Filter materials
  useEffect(() => {
    let filtered = materials;

    if (searchTerm) {
      filtered = filtered.filter(
        (material) =>
          material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.materialId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterUnit !== "all") {
      filtered = filtered.filter((material) => material.unit === filterUnit);
    }

    if (filterStock !== "all") {
      filtered = filtered.filter((material) => {
        if (filterStock === "low") {
          return material.currentStock <= material.reorderLevel;
        } else if (filterStock === "adequate") {
          return material.currentStock > material.reorderLevel;
        }
        return true;
      });
    }

    setFilteredMaterials(filtered);
  }, [materials, searchTerm, filterUnit, filterStock]);

  const loadMaterials = async () => {
    try {
      const materialsQuery = query(
        collection(db, "raw_materials"),
        orderBy("createdAt", "desc")
      );
      const materialsSnapshot = await getDocs(materialsQuery);
      const materialsData = materialsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMaterials(materialsData);
    } catch (error) {
      console.error("Error loading materials:", error);
      setErrorMessage("Failed to load materials. Please try again.");
      setShowError(true);
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

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "currentStock" || field === "reorderLevel") {
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

    if (!formData.name.trim()) newErrors.name = "Material name is required";
    if (!formData.unit) newErrors.unit = "Unit is required";
    if (!formData.currentStock.trim())
      newErrors.currentStock = "Current stock is required";
    if (!formData.reorderLevel.trim())
      newErrors.reorderLevel = "Reorder level is required";

    if (
      formData.currentStock &&
      (isNaN(formData.currentStock) || parseFloat(formData.currentStock) < 0)
    ) {
      newErrors.currentStock = "Please enter a valid stock quantity";
    }

    if (
      formData.reorderLevel &&
      (isNaN(formData.reorderLevel) || parseFloat(formData.reorderLevel) < 0)
    ) {
      newErrors.reorderLevel = "Please enter a valid reorder level";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateMaterialId = () => {
    const prefix = "MAT";
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
        "You must be logged in to manage materials. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      let materialId;
      let materialDocRef;

      if (isEditMode) {
        const materialToEdit = editMaterial || editingMaterial;
        materialId = materialToEdit.id;
        materialDocRef = doc(db, "raw_materials", materialId);
      } else {
        materialDocRef = doc(collection(db, "raw_materials"));
        materialId = generateMaterialId();
      }

      const materialData = {
        materialId: materialId,
        name: formData.name.trim(),
        unit: formData.unit,
        currentStock: parseFloat(formData.currentStock),
        reorderLevel: parseFloat(formData.reorderLevel),
        lastSupplier: formData.lastSupplier || null,
        ...(isEditMode
          ? {}
          : { createdAt: serverTimestamp(), createdBy: currentUser.userId }),
        updatedAt: serverTimestamp(),
        ...(isEditMode ? { updatedBy: currentUser.userId } : {}),
      };

      if (isEditMode) {
        await updateDoc(materialDocRef, materialData);
      } else {
        await setDoc(materialDocRef, materialData);
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: isEditMode ? "material_updated" : "material_added",
          description: isEditMode
            ? `Material ${formData.name} was updated`
            : `New material ${formData.name} was added`,
          performedBy: currentUser.userId,
          targetMaterialId: materialId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        isEditMode
          ? `Material ${formData.name} has been successfully updated!`
          : `Material ${formData.name} has been successfully added with ID: ${materialId}`
      );
      setShowSuccess(true);

      if (!isEditMode) {
        setFormData({
          name: "",
          unit: "kg",
          currentStock: "",
          reorderLevel: "",
          lastSupplier: "",
        });
      } else {
        setEditingMaterial(null);
        setTimeout(() => {
          setShowForm(false);
        }, 1500);
      }

      await loadMaterials();
    } catch (error) {
      console.error("Error managing material:", error);

      let errorMsg = `Failed to ${
        isEditMode ? "update" : "add"
      } material. Please try again.`;

      if (error.code === "permission-denied") {
        errorMsg = `You don't have permission to ${
          isEditMode ? "update" : "add"
        } materials.`;
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMaterial = (material) => {
    setSelectedMaterial(material);
    setShowModal(true);
  };

  const getSupplierName = (supplierId) => {
    if (!supplierId) return "N/A";
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier?.name || "Unknown Supplier";
  };

  const getStockStatus = (material) => {
    if (material.currentStock <= material.reorderLevel) {
      return {
        label: "Low Stock",
        color: "bg-red-100 text-red-700",
        dotColor: "bg-red-500",
      };
    }
    return {
      label: "Adequate",
      color: "bg-green-100 text-green-700",
      dotColor: "bg-green-500",
    };
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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
                Raw Materials Inventory
              </h1>
              <p className="text-gray-600">
                Manage stock levels and track materials
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <Button
                onClick={() => {
                  if (showForm) {
                    setEditingMaterial(null);
                    setFormData({
                      name: "",
                      unit: "kg",
                      currentStock: "",
                      reorderLevel: "",
                      lastSupplier: "",
                    });
                  }
                  setShowForm(!showForm);
                }}
                size="lg"
              >
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
                    View Materials
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
                    Add Material
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                {materials.length}
              </div>
              <div className="text-sm text-blue-600 font-medium">
                Total Materials
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4 border border-red-200">
              <div className="text-2xl font-bold text-red-700">
                {
                  materials.filter((m) => m.currentStock <= m.reorderLevel)
                    .length
                }
              </div>
              <div className="text-sm text-red-600 font-medium">Low Stock</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {
                  materials.filter((m) => m.currentStock > m.reorderLevel)
                    .length
                }
              </div>
              <div className="text-sm text-green-600 font-medium">
                Adequate Stock
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                {suppliers.length}
              </div>
              <div className="text-sm text-purple-600 font-medium">
                Active Suppliers
              </div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Add/Edit Material Form */
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditMode ? "Edit Material" : "Add New Material"}
              </h2>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update material information"
                  : "Add a new raw material to inventory"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Material Information */}
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
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
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </span>
                  Material Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Material Name"
                    type="text"
                    placeholder="Enter material name (e.g., Milk, Sugar)"
                    value={formData.name}
                    onChange={handleInputChange("name")}
                    error={errors.name}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit of Measurement{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.unit}
                      onChange={handleInputChange("unit")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      {unitOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.unit && (
                      <p className="text-sm text-red-600 mt-1">{errors.unit}</p>
                    )}
                  </div>

                  <InputField
                    label="Current Stock"
                    type="number"
                    placeholder="Enter current stock quantity"
                    value={formData.currentStock}
                    onChange={handleInputChange("currentStock")}
                    error={errors.currentStock}
                    required
                    step="0.01"
                  />

                  <InputField
                    label="Reorder Level"
                    type="number"
                    placeholder="Enter minimum stock level"
                    value={formData.reorderLevel}
                    onChange={handleInputChange("reorderLevel")}
                    error={errors.reorderLevel}
                    required
                    step="0.01"
                  />

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Supplier (Optional)
                    </label>
                    <select
                      value={formData.lastSupplier}
                      onChange={handleInputChange("lastSupplier")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} - {supplier.supplierId}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Stock Alert */}
              {formData.currentStock && formData.reorderLevel && (
                <div
                  className={`border rounded-xl p-4 ${
                    parseFloat(formData.currentStock) <=
                    parseFloat(formData.reorderLevel)
                      ? "bg-red-50 border-red-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
                  <div className="flex items-center">
                    <svg
                      className={`w-5 h-5 mr-2 ${
                        parseFloat(formData.currentStock) <=
                        parseFloat(formData.reorderLevel)
                          ? "text-red-600"
                          : "text-green-600"
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
                        parseFloat(formData.currentStock) <=
                        parseFloat(formData.reorderLevel)
                          ? "text-red-700"
                          : "text-green-700"
                      }`}
                    >
                      {parseFloat(formData.currentStock) <=
                      parseFloat(formData.reorderLevel)
                        ? "⚠️ Stock level is below reorder threshold - Consider reordering"
                        : "✓ Stock level is adequate"}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingMaterial(null);
                    setFormData({
                      name: "",
                      unit: "kg",
                      currentStock: "",
                      reorderLevel: "",
                      lastSupplier: "",
                    });
                    setShowForm(false);
                  }}
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
                  {loading
                    ? isEditMode
                      ? "Updating..."
                      : "Adding..."
                    : isEditMode
                    ? "Update Material"
                    : "Add Material"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Materials List */
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search materials..."
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
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Units</option>
                  {unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStock}
                  onChange={(e) => setFilterStock(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Stock Levels</option>
                  <option value="low">Low Stock</option>
                  <option value="adequate">Adequate Stock</option>
                </select>
              </div>
            </div>

            {/* Materials Table */}
            {filteredMaterials.length === 0 ? (
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm || filterUnit !== "all" || filterStock !== "all"
                    ? "No materials match your filters"
                    : "No materials yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterUnit !== "all" || filterStock !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by adding your first raw material"}
                </p>
                {!searchTerm &&
                  filterUnit === "all" &&
                  filterStock === "all" && (
                    <Button onClick={() => setShowForm(true)} size="lg">
                      Add First Material
                    </Button>
                  )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Material
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Current Stock
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Reorder Level
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Last Supplier
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredMaterials.map((material) => {
                      const status = getStockStatus(material);
                      return (
                        <tr
                          key={material.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                                {material.name
                                  ? material.name.substring(0, 2).toUpperCase()
                                  : "??"}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-semibold text-gray-900">
                                  {material.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {material.materialId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {material.currentStock} {material.unit}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {material.reorderLevel} {material.unit}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${status.color}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status.dotColor}`}
                              ></span>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {getSupplierName(material.lastSupplier)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleViewMaterial(material)}
                                className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  setEditingMaterial(material);
                                  setFormData({
                                    name: material.name,
                                    unit: material.unit,
                                    currentStock:
                                      material.currentStock?.toString(),
                                    reorderLevel:
                                      material.reorderLevel?.toString(),
                                    lastSupplier: material.lastSupplier || "",
                                  });
                                  setShowForm(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* View Material Modal */}
        {showModal && selectedMaterial && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {selectedMaterial.name
                        ? selectedMaterial.name.substring(0, 2).toUpperCase()
                        : "??"}
                    </div>
                    <div className="ml-5">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedMaterial.name}
                      </h2>
                      <p className="text-gray-600">
                        {selectedMaterial.materialId}
                      </p>
                    </div>
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
                {/* Stock Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Stock Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Current Stock
                      </span>
                      <p className="text-xl font-bold text-gray-900 mt-1">
                        {selectedMaterial.currentStock} {selectedMaterial.unit}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Reorder Level
                      </span>
                      <p className="text-xl font-bold text-gray-900 mt-1">
                        {selectedMaterial.reorderLevel} {selectedMaterial.unit}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Unit of Measurement
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {unitOptions.find(
                          (u) => u.value === selectedMaterial.unit
                        )?.label || selectedMaterial.unit}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Stock Status
                      </span>
                      <p className="mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            getStockStatus(selectedMaterial).color
                          }`}
                        >
                          {getStockStatus(selectedMaterial).label}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Supplier Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Supplier Information
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <span className="text-xs font-medium text-gray-500">
                      Last Supplier
                    </span>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {getSupplierName(selectedMaterial.lastSupplier)}
                    </p>
                  </div>
                </div>

                {/* Record Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Record Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Created On
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDate(selectedMaterial.createdAt)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Last Updated
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDate(selectedMaterial.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-8 py-5 rounded-b-3xl border-t border-gray-200">
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingMaterial(selectedMaterial);
                      setFormData({
                        name: selectedMaterial.name,
                        unit: selectedMaterial.unit,
                        currentStock: selectedMaterial.currentStock?.toString(),
                        reorderLevel: selectedMaterial.reorderLevel?.toString(),
                        lastSupplier: selectedMaterial.lastSupplier || "",
                      });
                      setShowModal(false);
                      setShowForm(true);
                    }}
                  >
                    Edit Material
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
          title={isEditMode ? "Material Updated!" : "Material Added!"}
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

export default RawMaterials;
