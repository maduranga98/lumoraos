import React, { useState, useEffect, useCallback } from "react";
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
  deleteDoc,
  runTransaction,
  limit,
  startAfter,
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
    type: "purchase",
    supplierId: "",
    batchId: "",
    quantity: "",
    adjustmentDirection: "increase", // New: for stock adjustments
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
  const [editingMovement, setEditingMovement] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [totalPages, setTotalPages] = useState(1);

  // New: Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState(null);

  const movementTypes = [
    { value: "purchase", label: "Purchase", color: "green", icon: "↓" },
    { value: "used_in_production", label: "Used in Production", color: "blue", icon: "→" },
    { value: "adjustment", label: "Stock Adjustment", color: "orange", icon: "⟳" },
    { value: "wastage", label: "Wastage", color: "red", icon: "×" },
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load data - Fixed dependency array
  useEffect(() => {
    if (currentUser) {
      loadMaterials();
      loadSuppliers();
      loadAllMovements();
    }
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter movements with pagination
  useEffect(() => {
    let filtered = movements;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (movement) =>
          movement.materialName?.toLowerCase().includes(search) ||
          movement.movementId?.toLowerCase().includes(search) ||
          movement.supplierName?.toLowerCase().includes(search) ||
          movement.batchId?.toLowerCase().includes(search)
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

    // Calculate pagination
    const total = Math.ceil(filtered.length / itemsPerPage);
    setTotalPages(total);

    // Reset to page 1 if current page exceeds total
    if (currentPage > total && total > 0) {
      setCurrentPage(1);
    }

    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filtered.slice(startIndex, endIndex);

    setFilteredMovements(paginated);
  }, [movements, searchTerm, filterType, filterMaterial, currentPage, itemsPerPage]);

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
      setErrorMessage("Failed to load materials. Please refresh the page.");
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

  // Fixed: Improved performance and sorting
  const loadAllMovements = async () => {
    try {
      const allMovements = [];

      // Get all materials
      const materialsSnapshot = await getDocs(collection(db, "raw_materials"));

      // For each material, get their movements subcollection
      for (const materialDoc of materialsSnapshot.docs) {
        const movementsQuery = query(
          collection(db, "raw_materials", materialDoc.id, "material_movements"),
          orderBy("date", "desc"),
          orderBy("createdAt", "desc")
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

      // Enrich with supplier names (batch the requests)
      const supplierIds = [...new Set(allMovements.map(m => m.supplierId).filter(Boolean))];
      const supplierMap = new Map();

      for (const supplierId of supplierIds) {
        try {
          const supplierDoc = await getDoc(doc(db, "suppliers", supplierId));
          if (supplierDoc.exists()) {
            supplierMap.set(supplierId, supplierDoc.data().name);
          }
        } catch (error) {
          console.error("Error fetching supplier:", error);
        }
      }

      // Add supplier names to movements
      const enrichedMovements = allMovements.map(movement => ({
        ...movement,
        supplierName: movement.supplierId ? supplierMap.get(movement.supplierId) : null,
      }));

      // Sort by date descending (most recent first)
      enrichedMovements.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
      });

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

  // Fixed: Comprehensive validation including stock availability
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

    // New: Check stock availability for deductions
    if (formData.materialId && formData.quantity) {
      const material = materials.find(m => m.id === formData.materialId);
      const quantity = parseFloat(formData.quantity);

      if (material) {
        const currentStock = material.currentStock || 0;

        // Check if we're reducing stock
        const isReduction =
          formData.type === "used_in_production" ||
          formData.type === "wastage" ||
          (formData.type === "adjustment" && formData.adjustmentDirection === "decrease");

        if (isReduction && quantity > currentStock) {
          newErrors.quantity = `Insufficient stock. Available: ${currentStock} ${material.unit}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateMovementId = () => {
    const prefix = "MOV";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `${prefix}${timestamp}${random}`;
  };

  // Fixed: Use transactions for atomic stock updates
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
      const movementId = editingMovement?.movementId || generateMovementId();
      const quantity = parseFloat(formData.quantity);
      const isEdit = !!editingMovement;

      // Use transaction for atomic updates
      await runTransaction(db, async (transaction) => {
        const materialRef = doc(db, "raw_materials", materialId);
        const materialDoc = await transaction.get(materialRef);

        if (!materialDoc.exists()) {
          throw new Error("Material not found. Please refresh and try again.");
        }

        const currentStock = materialDoc.data().currentStock || 0;
        let newStock = currentStock;
        let oldQuantityEffect = 0;

        // If editing, reverse the old quantity effect first
        if (isEdit) {
          const oldMovement = editingMovement;
          if (oldMovement.type === "purchase" || oldMovement.type === "adjustment") {
            oldQuantityEffect = -parseFloat(oldMovement.quantity);
          } else if (oldMovement.type === "used_in_production" || oldMovement.type === "wastage") {
            oldQuantityEffect = parseFloat(oldMovement.quantity);
          }
        }

        // Calculate new stock with proper adjustment logic
        let quantityEffect = 0;
        if (formData.type === "purchase") {
          quantityEffect = quantity;
        } else if (formData.type === "adjustment") {
          // Fixed: Support both increase and decrease adjustments
          quantityEffect = formData.adjustmentDirection === "increase" ? quantity : -quantity;
        } else if (formData.type === "used_in_production" || formData.type === "wastage") {
          quantityEffect = -quantity;
        }

        newStock = Math.max(0, currentStock + oldQuantityEffect + quantityEffect);

        // Create/update movement document
        const movementDocRef = isEdit
          ? doc(db, "raw_materials", materialId, "material_movements", editingMovement.id)
          : doc(collection(db, "raw_materials", materialId, "material_movements"));

        const movementData = {
          movementId: movementId,
          type: formData.type,
          supplierId: formData.supplierId || null,
          batchId: formData.batchId?.trim() || null,
          quantity: quantity,
          adjustmentDirection: formData.type === "adjustment" ? formData.adjustmentDirection : null,
          date: new Date(formData.date),
          notes: formData.notes.trim(),
          createdAt: isEdit ? editingMovement.createdAt : serverTimestamp(),
          createdBy: isEdit ? editingMovement.createdBy : currentUser.userId,
          updatedAt: serverTimestamp(),
          updatedBy: isEdit ? currentUser.userId : null,
        };

        transaction.set(movementDocRef, movementData, { merge: isEdit });

        // Update material's current stock
        const updateData = {
          currentStock: newStock,
          updatedAt: serverTimestamp(),
        };

        // Update lastSupplier if it's a purchase
        if (formData.type === "purchase" && formData.supplierId) {
          updateData.lastSupplier = formData.supplierId;
        }

        transaction.update(materialRef, updateData);

        // Log activity
        const activityRef = doc(collection(db, "activities"));
        const materialName = materials.find((m) => m.id === materialId)?.name;
        transaction.set(activityRef, {
          type: "material_movement",
          description: `${isEdit ? 'Updated' : 'Recorded'} ${formData.type} movement: ${quantity} units of ${materialName}`,
          performedBy: currentUser.userId,
          targetMovementId: movementId,
          timestamp: serverTimestamp(),
        });
      });

      setSuccessMessage(
        `Movement ${isEdit ? 'updated' : 'recorded'} successfully! Movement ID: ${movementId}`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        materialId: "",
        type: "purchase",
        supplierId: "",
        batchId: "",
        quantity: "",
        adjustmentDirection: "increase",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setEditingMovement(null);
      setShowForm(false);

      await loadAllMovements();
      await loadMaterials();
    } catch (error) {
      console.error("Error recording movement:", error);

      let errorMsg = "Failed to record movement. Please try again.";

      if (error.message.includes("Material not found")) {
        errorMsg = error.message;
      } else if (error.code === "permission-denied") {
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

  // New: Edit movement
  const handleEditMovement = (movement) => {
    setEditingMovement(movement);
    setFormData({
      materialId: movement.materialId,
      type: movement.type,
      supplierId: movement.supplierId || "",
      batchId: movement.batchId || "",
      quantity: movement.quantity.toString(),
      adjustmentDirection: movement.adjustmentDirection || "increase",
      date: movement.date?.toDate ? movement.date.toDate().toISOString().split("T")[0] : new Date(movement.date).toISOString().split("T")[0],
      notes: movement.notes || "",
    });
    setShowForm(true);
    setShowModal(false);
  };

  // New: Delete movement with stock reversal
  const handleDeleteMovement = async () => {
    if (!movementToDelete) return;

    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const materialRef = doc(db, "raw_materials", movementToDelete.materialId);
        const materialDoc = await transaction.get(materialRef);

        if (!materialDoc.exists()) {
          throw new Error("Material not found");
        }

        const currentStock = materialDoc.data().currentStock || 0;
        let stockReversal = 0;

        // Reverse the stock effect
        if (movementToDelete.type === "purchase") {
          stockReversal = -parseFloat(movementToDelete.quantity);
        } else if (movementToDelete.type === "adjustment") {
          const dir = movementToDelete.adjustmentDirection || "increase";
          stockReversal = dir === "increase" ? -parseFloat(movementToDelete.quantity) : parseFloat(movementToDelete.quantity);
        } else if (movementToDelete.type === "used_in_production" || movementToDelete.type === "wastage") {
          stockReversal = parseFloat(movementToDelete.quantity);
        }

        const newStock = Math.max(0, currentStock + stockReversal);

        // Delete movement
        const movementRef = doc(
          db,
          "raw_materials",
          movementToDelete.materialId,
          "material_movements",
          movementToDelete.id
        );
        transaction.delete(movementRef);

        // Update material stock
        transaction.update(materialRef, {
          currentStock: newStock,
          updatedAt: serverTimestamp(),
        });

        // Log activity
        const activityRef = doc(collection(db, "activities"));
        transaction.set(activityRef, {
          type: "material_movement",
          description: `Deleted ${movementToDelete.type} movement: ${movementToDelete.movementId}`,
          performedBy: currentUser.userId,
          timestamp: serverTimestamp(),
        });
      });

      setSuccessMessage("Movement deleted successfully!");
      setShowSuccess(true);
      setShowDeleteConfirm(false);
      setMovementToDelete(null);
      setShowModal(false);

      await loadAllMovements();
      await loadMaterials();
    } catch (error) {
      console.error("Error deleting movement:", error);
      setErrorMessage("Failed to delete movement. Please try again.");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewMovement = (movement) => {
    setSelectedMovement(movement);
    setShowModal(true);
  };

  // New: Export to CSV
  const handleExportCSV = () => {
    try {
      // Prepare CSV data
      const headers = ["Date", "Movement ID", "Material", "Type", "Quantity", "Unit", "Supplier/Batch", "Notes", "Created By"];
      const rows = movements.map(m => [
        formatDate(m.date),
        m.movementId,
        m.materialName,
        movementTypes.find(t => t.value === m.type)?.label || m.type,
        `${m.type === "used_in_production" || m.type === "wastage" ? "-" : "+"}${m.quantity}`,
        m.materialUnit,
        m.supplierName || m.batchId || "-",
        m.notes || "-",
        m.createdBy || "-"
      ]);

      // Convert to CSV
      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `material_movements_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage("Movement history exported successfully!");
      setShowSuccess(true);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      setErrorMessage("Failed to export data. Please try again.");
      setShowError(true);
    }
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

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "N/A";
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    const typeObj = movementTypes.find((t) => t.value === type);
    return typeObj?.icon || "•";
  };

  // New: Get stock level status
  const getStockStatus = (material) => {
    if (!material) return null;
    const stock = material.currentStock || 0;
    const reorder = material.reorderLevel || 0;

    if (stock === 0) return { label: "Out of Stock", color: "red" };
    if (stock <= reorder) return { label: "Low Stock", color: "orange" };
    return { label: "In Stock", color: "green" };
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
            <div className="mt-4 sm:mt-0 flex gap-2">
              <Button
                onClick={handleExportCSV}
                variant="secondary"
                size="lg"
                disabled={movements.length === 0}
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
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Export CSV
              </Button>
              <Button onClick={() => {
                setShowForm(!showForm);
                if (showForm) {
                  setEditingMovement(null);
                  setFormData({
                    materialId: "",
                    type: "purchase",
                    supplierId: "",
                    batchId: "",
                    quantity: "",
                    adjustmentDirection: "increase",
                    date: new Date().toISOString().split("T")[0],
                    notes: "",
                  });
                }
              }} size="lg">
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
                {editingMovement ? "Edit" : "Record"} Material Movement
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
                      {materials.map((material) => {
                        const status = getStockStatus(material);
                        return (
                          <option key={material.id} value={material.id}>
                            {material.name} - Stock: {material.currentStock} {material.unit}
                            {status && ` (${status.label})`}
                          </option>
                        );
                      })}
                    </select>
                    {errors.materialId && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.materialId}
                      </p>
                    )}
                    {/* Stock warning */}
                    {formData.materialId && (() => {
                      const material = materials.find(m => m.id === formData.materialId);
                      const status = getStockStatus(material);
                      if (status && status.color !== "green") {
                        return (
                          <div className={`mt-2 p-2 rounded-lg text-sm ${
                            status.color === "red" ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"
                          }`}>
                            ⚠ {status.label}: {material.currentStock} {material.unit}
                          </div>
                        );
                      }
                      return null;
                    })()}
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
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                    {errors.type && (
                      <p className="text-sm text-red-600 mt-1">{errors.type}</p>
                    )}
                  </div>

                  {/* Adjustment Direction - Only show for adjustments */}
                  {formData.type === "adjustment" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adjustment Direction <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.adjustmentDirection}
                        onChange={handleInputChange("adjustmentDirection")}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        required
                      >
                        <option value="increase">Increase Stock (+)</option>
                        <option value="decrease">Decrease Stock (-)</option>
                      </select>
                    </div>
                  )}

                  <InputField
                    label="Quantity"
                    type="number"
                    placeholder="Enter quantity"
                    value={formData.quantity}
                    onChange={handleInputChange("quantity")}
                    error={errors.quantity}
                    required
                    step="0.01"
                    min="0.01"
                  />

                  <InputField
                    label="Date"
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange("date")}
                    error={errors.date}
                    required
                    max={new Date().toISOString().split("T")[0]}
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
                    (formData.type === "adjustment" && formData.adjustmentDirection === "increase")
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start">
                    <svg
                      className={`w-5 h-5 mr-2 mt-0.5 flex-shrink-0 ${
                        formData.type === "purchase" ||
                        (formData.type === "adjustment" && formData.adjustmentDirection === "increase")
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
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          formData.type === "purchase" ||
                          (formData.type === "adjustment" && formData.adjustmentDirection === "increase")
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {formData.type === "purchase" ||
                        (formData.type === "adjustment" && formData.adjustmentDirection === "increase")
                          ? `✓ Stock will increase by ${formData.quantity} units`
                          : `⚠ Stock will decrease by ${formData.quantity} units`}
                      </p>
                      {(() => {
                        const material = materials.find(m => m.id === formData.materialId);
                        if (material) {
                          const currentStock = material.currentStock || 0;
                          const quantity = parseFloat(formData.quantity) || 0;
                          let newStock = currentStock;

                          if (formData.type === "purchase" ||
                              (formData.type === "adjustment" && formData.adjustmentDirection === "increase")) {
                            newStock = currentStock + quantity;
                          } else {
                            newStock = Math.max(0, currentStock - quantity);
                          }

                          return (
                            <p className="text-xs text-gray-600 mt-1">
                              Current: {currentStock} {material.unit} → New: {newStock} {material.unit}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingMovement(null);
                    setFormData({
                      materialId: "",
                      type: "purchase",
                      supplierId: "",
                      batchId: "",
                      quantity: "",
                      adjustmentDirection: "increase",
                      date: new Date().toISOString().split("T")[0],
                      notes: "",
                    });
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
                  {loading ? (editingMovement ? "Updating..." : "Recording...") : (editingMovement ? "Update Movement" : "Record Movement")}
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
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1); // Reset to first page on search
                      }}
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
                  onChange={(e) => {
                    setFilterMaterial(e.target.value);
                    setCurrentPage(1);
                  }}
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
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setCurrentPage(1);
                  }}
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
              <>
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
                              (movement.type === "adjustment" && movement.adjustmentDirection === "increase")
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleViewMovement(movement)}
                              className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleEditMovement(movement)}
                              className="text-indigo-600 hover:text-indigo-800 transition-colors font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setMovementToDelete(movement);
                                setShowDeleteConfirm(true);
                              }}
                              className="text-red-600 hover:text-red-800 transition-colors font-medium"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, movements.filter(m => {
                        if (searchTerm) {
                          const search = searchTerm.toLowerCase();
                          if (!(
                            m.materialName?.toLowerCase().includes(search) ||
                            m.movementId?.toLowerCase().includes(search) ||
                            m.supplierName?.toLowerCase().includes(search) ||
                            m.batchId?.toLowerCase().includes(search)
                          )) return false;
                        }
                        if (filterType !== "all" && m.type !== filterType) return false;
                        if (filterMaterial !== "all" && m.materialId !== filterMaterial) return false;
                        return true;
                      }).length)}{" "}
                      of{" "}
                      {movements.filter(m => {
                        if (searchTerm) {
                          const search = searchTerm.toLowerCase();
                          if (!(
                            m.materialName?.toLowerCase().includes(search) ||
                            m.movementId?.toLowerCase().includes(search) ||
                            m.supplierName?.toLowerCase().includes(search) ||
                            m.batchId?.toLowerCase().includes(search)
                          )) return false;
                        }
                        if (filterType !== "all" && m.type !== filterType) return false;
                        if (filterMaterial !== "all" && m.materialId !== filterMaterial) return false;
                        return true;
                      }).length}{" "}
                      movements
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            // Show first, last, current, and pages around current
                            return page === 1 ||
                                   page === totalPages ||
                                   Math.abs(page - currentPage) <= 1;
                          })
                          .map((page, idx, arr) => {
                            // Add ellipsis if there's a gap
                            const showEllipsisBefore = idx > 0 && page - arr[idx - 1] > 1;
                            return (
                              <React.Fragment key={page}>
                                {showEllipsisBefore && (
                                  <span className="px-2 text-gray-500">...</span>
                                )}
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={`px-3 py-1 border rounded-lg text-sm font-medium ${
                                    currentPage === page
                                      ? "bg-blue-600 text-white border-blue-600"
                                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                                  }`}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            );
                          })}
                      </div>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
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
                        (selectedMovement.type === "adjustment" && selectedMovement.adjustmentDirection === "increase")
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

                {/* Timestamps */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Audit Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Created At
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDateTime(selectedMovement.createdAt)}
                      </p>
                      {selectedMovement.createdBy && (
                        <p className="text-xs text-gray-600 mt-1">
                          By: {selectedMovement.createdBy}
                        </p>
                      )}
                    </div>
                    {selectedMovement.updatedAt && selectedMovement.updatedBy && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <span className="text-xs font-medium text-gray-500">
                          Last Updated
                        </span>
                        <p className="text-sm font-semibold text-gray-900 mt-1">
                          {formatDateTime(selectedMovement.updatedAt)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          By: {selectedMovement.updatedBy}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

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
              <div className="sticky bottom-0 bg-gray-50 px-8 py-5 rounded-b-3xl border-t border-gray-200 flex justify-between">
                <div className="flex space-x-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleEditMovement(selectedMovement)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMovementToDelete(selectedMovement);
                      setShowDeleteConfirm(true);
                    }}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && movementToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Delete Movement
                </h2>
                <p className="text-gray-600 mb-4">
                  Are you sure you want to delete this movement? This will reverse the stock change.
                </p>
                <div className="bg-gray-50 rounded-xl p-4 text-left">
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">
                      {movementToDelete.materialName}
                    </p>
                    <p className="text-gray-600">
                      {movementTypes.find(t => t.value === movementToDelete.type)?.label}:{" "}
                      {movementToDelete.quantity} {movementToDelete.materialUnit}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {movementToDelete.movementId}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setMovementToDelete(null);
                  }}
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteMovement}
                  loading={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Success Dialog */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="Success!"
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
