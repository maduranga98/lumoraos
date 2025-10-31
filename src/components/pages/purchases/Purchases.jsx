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
  getDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const Purchases = ({ editPurchase = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const isEditMode = !!editPurchase;

  // Form state
  const [formData, setFormData] = useState({
    supplierId: "",
    materialId: "",
    quantity: "",
    unitPrice: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    paymentStatus: "pending",
  });

  // Component state
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // View state
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load data
  useEffect(() => {
    if (currentUser) {
      loadSuppliers();
      loadMaterials();
      loadAllPurchases();
    }
  }, [currentUser]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editPurchase) {
      setFormData({
        supplierId: editPurchase.supplierId || "",
        materialId: editPurchase.materialId || "",
        quantity: editPurchase.quantity?.toString() || "",
        unitPrice: editPurchase.unitPrice?.toString() || "",
        purchaseDate:
          editPurchase.purchaseDate?.toDate?.()?.toISOString().split("T")[0] ||
          "",
        paymentStatus: editPurchase.paymentStatus || "pending",
      });
      setShowForm(true);
    }
  }, [editPurchase]);

  // Filter purchases
  useEffect(() => {
    let filtered = purchases;

    if (searchTerm) {
      filtered = filtered.filter(
        (purchase) =>
          purchase.supplierName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          purchase.materialName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          purchase.purchaseId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterSupplier !== "all") {
      filtered = filtered.filter(
        (purchase) => purchase.supplierId === filterSupplier
      );
    }

    if (filterPayment !== "all") {
      filtered = filtered.filter(
        (purchase) => purchase.paymentStatus === filterPayment
      );
    }

    setFilteredPurchases(filtered);
  }, [purchases, searchTerm, filterSupplier, filterPayment]);

  // Calculate total cost
  const calculateTotalCost = () => {
    const quantity = parseFloat(formData.quantity) || 0;
    const unitPrice = parseFloat(formData.unitPrice) || 0;
    return quantity * unitPrice;
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

  const loadAllPurchases = async () => {
    try {
      const allPurchases = [];

      // Get all suppliers
      const suppliersSnapshot = await getDocs(collection(db, "suppliers"));

      // For each supplier, get their purchases subcollection
      for (const supplierDoc of suppliersSnapshot.docs) {
        const purchasesQuery = query(
          collection(db, "suppliers", supplierDoc.id, "purchases"),
          orderBy("purchaseDate", "desc")
        );
        const purchasesSnapshot = await getDocs(purchasesQuery);

        purchasesSnapshot.docs.forEach((purchaseDoc) => {
          allPurchases.push({
            id: purchaseDoc.id,
            supplierId: supplierDoc.id,
            supplierName: supplierDoc.data().name,
            ...purchaseDoc.data(),
          });
        });
      }

      // Enrich with material names
      const enrichedPurchases = await Promise.all(
        allPurchases.map(async (purchase) => {
          if (purchase.materialId) {
            try {
              const materialDoc = await getDoc(
                doc(db, "raw_materials", purchase.materialId)
              );
              if (materialDoc.exists()) {
                return {
                  ...purchase,
                  materialName: materialDoc.data().name,
                  materialUnit: materialDoc.data().unit,
                };
              }
            } catch (error) {
              console.error("Error fetching material:", error);
            }
          }
          return purchase;
        })
      );

      setPurchases(enrichedPurchases);
    } catch (error) {
      console.error("Error loading purchases:", error);
      setErrorMessage("Failed to load purchases. Please try again.");
      setShowError(true);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "quantity" || field === "unitPrice") {
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

    if (!formData.supplierId) newErrors.supplierId = "Supplier is required";
    if (!formData.materialId) newErrors.materialId = "Material is required";
    if (!formData.quantity.trim()) newErrors.quantity = "Quantity is required";
    if (!formData.unitPrice.trim())
      newErrors.unitPrice = "Unit price is required";
    if (!formData.purchaseDate)
      newErrors.purchaseDate = "Purchase date is required";

    if (
      formData.quantity &&
      (isNaN(formData.quantity) || parseFloat(formData.quantity) <= 0)
    ) {
      newErrors.quantity = "Please enter a valid quantity greater than 0";
    }

    if (
      formData.unitPrice &&
      (isNaN(formData.unitPrice) || parseFloat(formData.unitPrice) <= 0)
    ) {
      newErrors.unitPrice = "Please enter a valid unit price greater than 0";
    }

    if (formData.purchaseDate && new Date(formData.purchaseDate) > new Date()) {
      newErrors.purchaseDate = "Purchase date cannot be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generatePurchaseId = () => {
    const prefix = "PUR";
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
        "You must be logged in to manage purchases. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const supplierId = formData.supplierId;
      let purchaseId;
      let purchaseDocRef;

      if (isEditMode) {
        purchaseId = editPurchase.purchaseId || editPurchase.id;
        purchaseDocRef = doc(
          db,
          "suppliers",
          supplierId,
          "purchases",
          purchaseId
        );
      } else {
        purchaseId = generatePurchaseId();
        purchaseDocRef = doc(
          collection(db, "suppliers", supplierId, "purchases")
        );
      }

      const purchaseData = {
        purchaseId: purchaseId,
        materialId: formData.materialId,
        quantity: parseFloat(formData.quantity),
        unitPrice: parseFloat(formData.unitPrice),
        totalCost: calculateTotalCost(),
        purchaseDate: new Date(formData.purchaseDate),
        paymentStatus: formData.paymentStatus,
        ...(isEditMode
          ? {}
          : { createdAt: serverTimestamp(), createdBy: currentUser.userId }),
        updatedAt: serverTimestamp(),
        ...(isEditMode ? { updatedBy: currentUser.userId } : {}),
      };

      if (isEditMode) {
        await updateDoc(purchaseDocRef, purchaseData);
      } else {
        await setDoc(purchaseDocRef, purchaseData);

        // Update material's lastSupplier and stock
        const materialRef = doc(db, "raw_materials", formData.materialId);
        const materialDoc = await getDoc(materialRef);

        if (materialDoc.exists()) {
          const currentStock = materialDoc.data().currentStock || 0;
          await updateDoc(materialRef, {
            currentStock: currentStock + parseFloat(formData.quantity),
            lastSupplier: supplierId,
            updatedAt: serverTimestamp(),
          });
        }
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: isEditMode ? "purchase_updated" : "purchase_added",
          description: isEditMode
            ? `Purchase ${purchaseId} was updated`
            : `New purchase ${purchaseId} was recorded`,
          performedBy: currentUser.userId,
          targetPurchaseId: purchaseId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        isEditMode
          ? "Purchase has been successfully updated!"
          : `Purchase has been successfully recorded with ID: ${purchaseId}`
      );
      setShowSuccess(true);

      if (!isEditMode) {
        setFormData({
          supplierId: "",
          materialId: "",
          quantity: "",
          unitPrice: "",
          purchaseDate: new Date().toISOString().split("T")[0],
          paymentStatus: "pending",
        });
      } else {
        setTimeout(() => {
          setShowForm(false);
        }, 1500);
      }

      await loadAllPurchases();
    } catch (error) {
      console.error("Error managing purchase:", error);

      let errorMsg = `Failed to ${
        isEditMode ? "update" : "record"
      } purchase. Please try again.`;

      if (error.code === "permission-denied") {
        errorMsg = `You don't have permission to ${
          isEditMode ? "update" : "add"
        } purchases.`;
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (purchase, newStatus) => {
    try {
      const purchaseRef = doc(
        db,
        "suppliers",
        purchase.supplierId,
        "purchases",
        purchase.id
      );

      await updateDoc(purchaseRef, {
        paymentStatus: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.userId,
      });

      // Update local state
      const updatedPurchases = purchases.map((p) =>
        p.id === purchase.id && p.supplierId === purchase.supplierId
          ? { ...p, paymentStatus: newStatus }
          : p
      );
      setPurchases(updatedPurchases);

      setSuccessMessage(`Payment status updated to ${newStatus}!`);
      setShowSuccess(true);
    } catch (error) {
      console.error("Error updating payment status:", error);
      setErrorMessage("Failed to update payment status. Please try again.");
      setShowError(true);
    }
  };

  const handleViewPurchase = (purchase) => {
    setSelectedPurchase(purchase);
    setShowModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
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

  // const getSupplierName = (supplierId) => {
  //   const supplier = suppliers.find((s) => s.id === supplierId);
  //   return supplier?.name || "Unknown Supplier";
  // };

  // const getMaterialName = (materialId) => {
  //   const material = materials.find((m) => m.id === materialId);
  //   return material?.name || "Unknown Material";
  // };

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
                Purchase Records
              </h1>
              <p className="text-gray-600">
                Track all material purchases from suppliers
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
                    View Purchases
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
                    Record Purchase
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                {purchases.length}
              </div>
              <div className="text-sm text-blue-600 font-medium">
                Total Purchases
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(
                  purchases.reduce((sum, p) => sum + (p.totalCost || 0), 0)
                )}
              </div>
              <div className="text-sm text-green-600 font-medium">
                Total Value
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
              <div className="text-2xl font-bold text-orange-700">
                {purchases.filter((p) => p.paymentStatus === "pending").length}
              </div>
              <div className="text-sm text-orange-600 font-medium">
                Pending Payments
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                {purchases.filter((p) => p.paymentStatus === "paid").length}
              </div>
              <div className="text-sm text-purple-600 font-medium">Paid</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Add/Edit Purchase Form */
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditMode ? "Edit Purchase" : "Record New Purchase"}
              </h2>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update purchase details"
                  : "Record a new material purchase"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Purchase Details */}
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
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
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </span>
                  Purchase Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.supplierId}
                      onChange={handleInputChange("supplierId")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      <option value="">Select supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} - {supplier.supplierId}
                        </option>
                      ))}
                    </select>
                    {errors.supplierId && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.supplierId}
                      </p>
                    )}
                  </div>

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
                          {material.name} ({material.unit})
                        </option>
                      ))}
                    </select>
                    {errors.materialId && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.materialId}
                      </p>
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
                    label="Unit Price"
                    type="number"
                    placeholder="Enter price per unit"
                    value={formData.unitPrice}
                    onChange={handleInputChange("unitPrice")}
                    error={errors.unitPrice}
                    required
                    step="0.01"
                  />

                  <InputField
                    label="Purchase Date"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={handleInputChange("purchaseDate")}
                    error={errors.purchaseDate}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.paymentStatus}
                      onChange={handleInputChange("paymentStatus")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Cost Summary */}
              {formData.quantity && formData.unitPrice && (
                <div className="border border-green-200 rounded-xl p-6 bg-green-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">
                        Total Cost
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        {formData.quantity} ×{" "}
                        {formatCurrency(parseFloat(formData.unitPrice))}
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-green-700">
                      {formatCurrency(calculateTotalCost())}
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
                  {loading
                    ? isEditMode
                      ? "Updating..."
                      : "Recording..."
                    : isEditMode
                    ? "Update Purchase"
                    : "Record Purchase"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Purchases List */
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search purchases..."
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
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Suppliers</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterPayment}
                  onChange={(e) => setFilterPayment(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Payment Status</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            {/* Purchases Table */}
            {filteredPurchases.length === 0 ? (
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
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 a2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm ||
                  filterSupplier !== "all" ||
                  filterPayment !== "all"
                    ? "No purchases match your filters"
                    : "No purchases yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm ||
                  filterSupplier !== "all" ||
                  filterPayment !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by recording your first purchase"}
                </p>
                {!searchTerm &&
                  filterSupplier === "all" &&
                  filterPayment === "all" && (
                    <Button onClick={() => setShowForm(true)} size="lg">
                      Record First Purchase
                    </Button>
                  )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Purchase ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Supplier
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Material
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Total Cost
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Payment
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredPurchases.map((purchase) => (
                      <tr
                        key={`${purchase.supplierId}-${purchase.id}`}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {purchase.purchaseId}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(purchase.purchaseDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {purchase.supplierName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {purchase.materialName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {purchase.quantity} {purchase.materialUnit}
                          </div>
                          <div className="text-xs text-gray-500">
                            @ {formatCurrency(purchase.unitPrice)}/
                            {purchase.materialUnit}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            {formatCurrency(purchase.totalCost)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${
                              purchase.paymentStatus === "paid"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                purchase.paymentStatus === "paid"
                                  ? "bg-green-500"
                                  : "bg-orange-500"
                              }`}
                            ></span>
                            {purchase.paymentStatus === "paid"
                              ? "Paid"
                              : "Pending"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleViewPurchase(purchase)}
                              className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
                            >
                              View
                            </button>
                            {purchase.paymentStatus === "pending" && (
                              <button
                                onClick={() =>
                                  updatePaymentStatus(purchase, "paid")
                                }
                                className="text-green-600 hover:text-green-800 transition-colors font-medium"
                              >
                                Mark Paid
                              </button>
                            )}
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

        {/* View Purchase Modal */}
        {showModal && selectedPurchase && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      Purchase Details
                    </h2>
                    <p className="text-gray-600">
                      {selectedPurchase.purchaseId}
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
                {/* Purchase Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Purchase Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Supplier
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {selectedPurchase.supplierName}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Material
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {selectedPurchase.materialName}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Purchase Date
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDate(selectedPurchase.purchaseDate)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Payment Status
                      </span>
                      <p className="mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            selectedPurchase.paymentStatus === "paid"
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {selectedPurchase.paymentStatus === "paid"
                            ? "Paid"
                            : "Pending"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cost Breakdown */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Cost Breakdown
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Quantity</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {selectedPurchase.quantity}{" "}
                        {selectedPurchase.materialUnit}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Unit Price</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(selectedPurchase.unitPrice)}/
                        {selectedPurchase.materialUnit}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                      <span className="text-base font-semibold text-gray-900">
                        Total Cost
                      </span>
                      <span className="text-xl font-bold text-gray-900">
                        {formatCurrency(selectedPurchase.totalCost)}
                      </span>
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
                  {selectedPurchase.paymentStatus === "pending" && (
                    <Button
                      onClick={() => {
                        updatePaymentStatus(selectedPurchase, "paid");
                        setShowModal(false);
                      }}
                    >
                      Mark as Paid
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Success Dialog */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title={isEditMode ? "Purchase Updated!" : "Purchase Recorded!"}
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

export default Purchases;
