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

const ProductionBatches = ({ editBatch = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const isEditMode = !!editBatch;

  // Form state
  const [formData, setFormData] = useState({
    productId: "",
    productionDate: new Date().toISOString().split("T")[0],
    quantityProduced: "",
    sellingPrice: "",
    producedBy: "",
    notes: "",
  });

  // Raw materials used in production
  const [materialsUsed, setMaterialsUsed] = useState([
    {
      materialId: "",
      materialName: "",
      supplierId: "",
      supplierName: "",
      quantity: "",
      cost: "",
    },
  ]);

  // Component state
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [batches, setBatches] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // View state
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const statusOptions = [
    { value: "in_production", label: "In Production", color: "orange" },
    { value: "completed", label: "Completed", color: "green" },
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
      loadProducts();
      loadRawMaterials();
      loadSuppliers();
      loadEmployees();
      loadBatches();
    }
  }, [currentUser]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editBatch) {
      setFormData({
        productId: editBatch.productId || "",
        productionDate:
          editBatch.productionDate?.toDate?.()?.toISOString().split("T")[0] ||
          "",
        quantityProduced: editBatch.quantityProduced?.toString() || "",
        sellingPrice: editBatch.sellingPrice?.toString() || "",
        producedBy: editBatch.producedBy || "",
        notes: editBatch.notes || "",
      });

      if (editBatch.rawMaterialsUsed && editBatch.rawMaterialsUsed.length > 0) {
        setMaterialsUsed(editBatch.rawMaterialsUsed);
      }

      setShowForm(true);
    }
  }, [editBatch]);

  // Filter batches
  useEffect(() => {
    let filtered = batches;

    if (searchTerm) {
      filtered = filtered.filter(
        (batch) =>
          batch.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.productName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterProduct !== "all") {
      filtered = filtered.filter((batch) => batch.productId === filterProduct);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((batch) => batch.status === filterStatus);
    }

    setFilteredBatches(filtered);
  }, [batches, searchTerm, filterProduct, filterStatus]);

  // Calculate unit cost and expiry date when product changes
  useEffect(() => {
    if (formData.productId && formData.productionDate) {
      const product = products.find((p) => p.id === formData.productId);
      if (product && !formData.sellingPrice) {
        setFormData((prev) => ({
          ...prev,
          sellingPrice: product.defaultSellingPrice?.toString() || "",
        }));
      }
    }
  }, [formData.productId, formData.productionDate, products]);

  const loadProducts = async () => {
    try {
      const productsQuery = query(collection(db, "products"), orderBy("name"));
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
    }
  };

  const loadRawMaterials = async () => {
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
      setRawMaterials(materialsData);
    } catch (error) {
      console.error("Error loading raw materials:", error);
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
      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Error loading suppliers:", error);
    }
  };

  const loadEmployees = async () => {
    try {
      const employeesQuery = query(
        collection(db, "users"),
        orderBy("fullName")
      );
      const employeesSnapshot = await getDocs(employeesQuery);
      const employeesData = employeesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEmployees(employeesData.filter((e) => e.isActive));
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const loadBatches = async () => {
    try {
      const batchesQuery = query(
        collection(db, "production_batches"),
        orderBy("productionDate", "desc")
      );
      const batchesSnapshot = await getDocs(batchesQuery);
      const batchesData = batchesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Enrich with product names
      const enrichedBatches = await Promise.all(
        batchesData.map(async (batch) => {
          if (batch.productId) {
            try {
              const productDoc = await getDoc(
                doc(db, "products", batch.productId)
              );
              if (productDoc.exists()) {
                return {
                  ...batch,
                  productName: productDoc.data().name,
                  productUnit: productDoc.data().unit,
                };
              }
            } catch (error) {
              console.error("Error fetching product:", error);
            }
          }
          return batch;
        })
      );

      setBatches(enrichedBatches);
    } catch (error) {
      console.error("Error loading batches:", error);
      setErrorMessage("Failed to load production batches. Please try again.");
      setShowError(true);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "quantityProduced" || field === "sellingPrice") {
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

  const handleMaterialChange = (index, field, value) => {
    const updatedMaterials = [...materialsUsed];
    updatedMaterials[index][field] = value;

    // Auto-populate material and supplier details
    if (field === "materialId" && value) {
      const material = rawMaterials.find((m) => m.id === value);
      if (material) {
        updatedMaterials[index].materialName = material.name;

        // Get last supplier for this material
        if (material.lastSupplier) {
          updatedMaterials[index].supplierId = material.lastSupplier;
          const supplier = suppliers.find(
            (s) => s.id === material.lastSupplier
          );
          if (supplier) {
            updatedMaterials[index].supplierName = supplier.name;
          }
        }
      }
    }

    if (field === "supplierId" && value) {
      const supplier = suppliers.find((s) => s.id === value);
      if (supplier) {
        updatedMaterials[index].supplierName = supplier.name;
      }
    }

    if (field === "quantity" || field === "cost") {
      value = value.replace(/[^0-9.]/g, "");
      updatedMaterials[index][field] = value;
    }

    setMaterialsUsed(updatedMaterials);
  };

  const addMaterial = () => {
    setMaterialsUsed((prev) => [
      ...prev,
      {
        materialId: "",
        materialName: "",
        supplierId: "",
        supplierName: "",
        quantity: "",
        cost: "",
      },
    ]);
  };

  const removeMaterial = (index) => {
    if (materialsUsed.length > 1) {
      setMaterialsUsed((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const calculateUnitCost = () => {
    const totalMaterialCost = materialsUsed.reduce((sum, material) => {
      const cost = parseFloat(material.cost) || 0;
      return sum + cost;
    }, 0);

    const quantity = parseFloat(formData.quantityProduced) || 1;
    return totalMaterialCost / quantity;
  };

  const calculateExpiryDate = () => {
    if (!formData.productId || !formData.productionDate) return null;

    const product = products.find((p) => p.id === formData.productId);
    if (!product || !product.expiryDays) return null;

    const productionDate = new Date(formData.productionDate);
    const expiryDate = new Date(productionDate);
    expiryDate.setDate(expiryDate.getDate() + product.expiryDays);

    return expiryDate;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.productId) newErrors.productId = "Product is required";
    if (!formData.productionDate)
      newErrors.productionDate = "Production date is required";
    if (!formData.quantityProduced.trim())
      newErrors.quantityProduced = "Quantity is required";
    if (!formData.sellingPrice.trim())
      newErrors.sellingPrice = "Selling price is required";
    if (!formData.producedBy) newErrors.producedBy = "Producer is required";

    if (
      formData.quantityProduced &&
      (isNaN(formData.quantityProduced) ||
        parseFloat(formData.quantityProduced) <= 0)
    ) {
      newErrors.quantityProduced =
        "Please enter a valid quantity greater than 0";
    }

    if (
      formData.sellingPrice &&
      (isNaN(formData.sellingPrice) || parseFloat(formData.sellingPrice) <= 0)
    ) {
      newErrors.sellingPrice = "Please enter a valid price greater than 0";
    }

    // Validate materials
    const validMaterials = materialsUsed.filter(
      (m) => m.materialId && m.supplierId && m.quantity && m.cost
    );

    if (validMaterials.length === 0) {
      newErrors.materials = "Please add at least one material with all details";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateBatchId = () => {
    const date = new Date(formData.productionDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
    return `B${year}-${month}-${day}-${random}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage(
        "You must be logged in to record production. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      let batchId;
      let batchDocRef;

      if (isEditMode) {
        batchId = editBatch.batchId || editBatch.id;
        batchDocRef = doc(db, "production_batches", batchId);
      } else {
        batchId = generateBatchId();
        batchDocRef = doc(collection(db, "production_batches"));
      }

      const expiryDate = calculateExpiryDate();
      const unitCost = calculateUnitCost();

      // Filter valid materials
      const validMaterials = materialsUsed
        .filter((m) => m.materialId && m.supplierId && m.quantity && m.cost)
        .map((m) => ({
          materialId: m.materialId,
          materialName: m.materialName,
          supplierId: m.supplierId,
          supplierName: m.supplierName,
          quantity: parseFloat(m.quantity),
          cost: parseFloat(m.cost),
        }));

      const batchData = {
        batchId: batchId,
        productId: formData.productId,
        productionDate: new Date(formData.productionDate),
        expiryDate: expiryDate,
        quantityProduced: parseFloat(formData.quantityProduced),
        unitCost: unitCost,
        sellingPrice: parseFloat(formData.sellingPrice),
        rawMaterialsUsed: validMaterials,
        producedBy: formData.producedBy,
        status: "completed",
        notes: formData.notes.trim(),
        ...(isEditMode
          ? {}
          : { createdAt: serverTimestamp(), createdBy: currentUser.userId }),
        updatedAt: serverTimestamp(),
        ...(isEditMode ? { updatedBy: currentUser.userId } : {}),
      };

      if (isEditMode) {
        await updateDoc(batchDocRef, batchData);
      } else {
        await setDoc(batchDocRef, batchData);

        // Record material movements for each material used
        for (const material of validMaterials) {
          const movementDocRef = doc(
            collection(
              db,
              "raw_materials",
              material.materialId,
              "material_movements"
            )
          );

          await setDoc(movementDocRef, {
            movementId: `MOV-${batchId}-${material.materialId.slice(-4)}`,
            type: "used_in_production",
            supplierId: material.supplierId,
            batchId: batchId,
            quantity: material.quantity,
            date: new Date(formData.productionDate),
            notes: `Used in production batch ${batchId}`,
            createdAt: serverTimestamp(),
            createdBy: currentUser.userId,
            updatedAt: serverTimestamp(),
          });

          // Update material stock
          const materialRef = doc(db, "raw_materials", material.materialId);
          const materialDoc = await getDoc(materialRef);

          if (materialDoc.exists()) {
            const currentStock = materialDoc.data().currentStock || 0;
            await updateDoc(materialRef, {
              currentStock: Math.max(0, currentStock - material.quantity),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: isEditMode ? "batch_updated" : "batch_created",
          description: isEditMode
            ? `Production batch ${batchId} was updated`
            : `New production batch ${batchId} was created (${formData.quantityProduced} units)`,
          performedBy: currentUser.userId,
          targetBatchId: batchId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        isEditMode
          ? `Batch ${batchId} has been successfully updated!`
          : `Production batch ${batchId} has been successfully recorded!`
      );
      setShowSuccess(true);

      if (!isEditMode) {
        setFormData({
          productId: "",
          productionDate: new Date().toISOString().split("T")[0],
          quantityProduced: "",
          sellingPrice: "",
          producedBy: "",
          notes: "",
        });
        setMaterialsUsed([
          {
            materialId: "",
            materialName: "",
            supplierId: "",
            supplierName: "",
            quantity: "",
            cost: "",
          },
        ]);
      } else {
        setTimeout(() => {
          setShowForm(false);
        }, 1500);
      }

      await loadBatches();
    } catch (error) {
      console.error("Error managing batch:", error);

      let errorMsg = `Failed to ${
        isEditMode ? "update" : "record"
      } production batch. Please try again.`;

      if (error.code === "permission-denied") {
        errorMsg = `You don't have permission to ${
          isEditMode ? "update" : "record"
        } production batches.`;
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewBatch = (batch) => {
    setSelectedBatch(batch);
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

  const getStatusColor = (status) => {
    const statusObj = statusOptions.find((s) => s.value === status);
    const colors = {
      orange: "bg-orange-100 text-orange-700",
      green: "bg-green-100 text-green-700",
    };
    return colors[statusObj?.color] || "bg-gray-100 text-gray-700";
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
                Production Batches
              </h1>
              <p className="text-gray-600">
                Record and track production batches
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
                    View Batches
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
                    Record Production
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                {batches.length}
              </div>
              <div className="text-sm text-blue-600 font-medium">
                Total Batches
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {batches.filter((b) => b.status === "completed").length}
              </div>
              <div className="text-sm text-green-600 font-medium">
                Completed
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                {batches.reduce((sum, b) => sum + (b.quantityProduced || 0), 0)}
              </div>
              <div className="text-sm text-purple-600 font-medium">
                Total Units
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
              <div className="text-2xl font-bold text-orange-700">
                {products.length}
              </div>
              <div className="text-sm text-orange-600 font-medium">
                Products
              </div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Record Production Form */
          <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
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
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditMode
                  ? "Edit Production Batch"
                  : "Record Production Batch"}
              </h2>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update batch information"
                  : "Record a new production batch with materials used"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Production Details */}
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
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </span>
                  Production Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.productId}
                      onChange={handleInputChange("productId")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      <option value="">Select product</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.unit})
                        </option>
                      ))}
                    </select>
                    {errors.productId && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.productId}
                      </p>
                    )}
                  </div>

                  <InputField
                    label="Production Date"
                    type="date"
                    value={formData.productionDate}
                    onChange={handleInputChange("productionDate")}
                    error={errors.productionDate}
                    required
                  />

                  <InputField
                    label="Quantity Produced"
                    type="number"
                    placeholder="Enter quantity"
                    value={formData.quantityProduced}
                    onChange={handleInputChange("quantityProduced")}
                    error={errors.quantityProduced}
                    required
                    step="0.01"
                  />

                  <InputField
                    label="Selling Price per Unit"
                    type="number"
                    placeholder="Enter selling price"
                    value={formData.sellingPrice}
                    onChange={handleInputChange("sellingPrice")}
                    error={errors.sellingPrice}
                    required
                    step="0.01"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Produced By <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.producedBy}
                      onChange={handleInputChange("producedBy")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      requirerequired
                    >
                      <option value="">Select employee</option>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.fullName}
                        </option>
                      ))}
                    </select>
                    {errors.producedBy && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.producedBy}
                      </p>
                    )}
                  </div>

                  {/* Expiry Date Display */}
                  {calculateExpiryDate() && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <span className="text-xs font-medium text-orange-600">
                        Expiry Date
                      </span>
                      <p className="text-sm font-bold text-orange-900 mt-1">
                        {formatDate(calculateExpiryDate())}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Raw Materials Used */}
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Raw Materials Used
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMaterial}
                  >
                    Add Material
                  </Button>
                </div>

                {errors.materials && (
                  <p className="text-sm text-red-600 mb-4">
                    {errors.materials}
                  </p>
                )}

                <div className="space-y-4">
                  {materialsUsed.map((material, index) => (
                    <div
                      key={index}
                      className="border border-gray-100 rounded-lg p-4 bg-white"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Material <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={material.materialId}
                            onChange={(e) =>
                              handleMaterialChange(
                                index,
                                "materialId",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Select material</option>
                            {rawMaterials.map((rm) => (
                              <option key={rm.id} value={rm.id}>
                                {rm.name} ({rm.unit})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Supplier <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={material.supplierId}
                            onChange={(e) =>
                              handleMaterialChange(
                                index,
                                "supplierId",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          >
                            <option value="">Select supplier</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <InputField
                          label="Quantity"
                          type="number"
                          placeholder="Enter qty"
                          value={material.quantity}
                          onChange={(e) =>
                            handleMaterialChange(
                              index,
                              "quantity",
                              e.target.value
                            )
                          }
                          step="0.01"
                        />

                        <InputField
                          label="Total Cost"
                          type="number"
                          placeholder="Enter cost"
                          value={material.cost}
                          onChange={(e) =>
                            handleMaterialChange(index, "cost", e.target.value)
                          }
                          step="0.01"
                        />

                        <div className="flex items-end">
                          {materialsUsed.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeMaterial(index)}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Summary */}
              {formData.quantityProduced &&
                materialsUsed.some((m) => m.cost) && (
                  <div className="border border-blue-200 rounded-xl p-6 bg-blue-50">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">
                      Cost Summary
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-blue-600 mb-1">
                          Total Material Cost
                        </p>
                        <p className="text-lg font-bold text-blue-900">
                          {formatCurrency(
                            materialsUsed.reduce(
                              (sum, m) => sum + (parseFloat(m.cost) || 0),
                              0
                            )
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 mb-1">Unit Cost</p>
                        <p className="text-lg font-bold text-blue-900">
                          {formatCurrency(calculateUnitCost())}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 mb-1">
                          Selling Price
                        </p>
                        <p className="text-lg font-bold text-blue-900">
                          {formatCurrency(
                            parseFloat(formData.sellingPrice) || 0
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 mb-1">
                          Profit Margin
                        </p>
                        <p className="text-lg font-bold text-green-700">
                          {formatCurrency(
                            (parseFloat(formData.sellingPrice) || 0) -
                              calculateUnitCost()
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* Notes */}
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Additional Notes
                </h3>
                <textarea
                  value={formData.notes}
                  onChange={handleInputChange("notes")}
                  placeholder="Enter any additional notes about this production batch..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

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
                    ? "Update Batch"
                    : "Record Production"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Batches List */
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search batches..."
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
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Products</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Status</option>
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Batches Table */}
            {filteredBatches.length === 0 ? (
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
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {searchTerm ||
                  filterProduct !== "all" ||
                  filterStatus !== "all"
                    ? "No batches match your filters"
                    : "No production batches yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm ||
                  filterProduct !== "all" ||
                  filterStatus !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by recording your first production batch"}
                </p>
                {!searchTerm &&
                  filterProduct === "all" &&
                  filterStatus === "all" && (
                    <Button onClick={() => setShowForm(true)} size="lg">
                      Record First Batch
                    </Button>
                  )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Batch ID
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Unit Cost
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Expiry Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredBatches.map((batch) => (
                      <tr
                        key={batch.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">
                            {batch.batchId}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(batch.productionDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {batch.productName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            {batch.quantityProduced} {batch.productUnit}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatCurrency(batch.unitCost)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(batch.expiryDate)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(
                              batch.status
                            )}`}
                          >
                            {
                              statusOptions.find(
                                (s) => s.value === batch.status
                              )?.label
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewBatch(batch)}
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

        {/* View Batch Modal */}
        {showModal && selectedBatch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedBatch.batchId}
                    </h2>
                    <p className="text-gray-600">{selectedBatch.productName}</p>
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
                {/* Production Info */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Production Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Production Date
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDate(selectedBatch.productionDate)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Expiry Date
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDate(selectedBatch.expiryDate)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Quantity Produced
                      </span>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {selectedBatch.quantityProduced}{" "}
                        {selectedBatch.productUnit}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Status
                      </span>
                      <p className="mt-1">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${getStatusColor(
                            selectedBatch.status
                          )}`}
                        >
                          {
                            statusOptions.find(
                              (s) => s.value === selectedBatch.status
                            )?.label
                          }
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cost Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Cost & Pricing
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <span className="text-xs font-medium text-blue-600">
                        Unit Cost
                      </span>
                      <p className="text-lg font-bold text-blue-900 mt-1">
                        {formatCurrency(selectedBatch.unitCost)}
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <span className="text-xs font-medium text-green-600">
                        Selling Price
                      </span>
                      <p className="text-lg font-bold text-green-900 mt-1">
                        {formatCurrency(selectedBatch.sellingPrice)}
                      </p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                      <span className="text-xs font-medium text-purple-600">
                        Profit Margin
                      </span>
                      <p className="text-lg font-bold text-purple-900 mt-1">
                        {formatCurrency(
                          selectedBatch.sellingPrice - selectedBatch.unitCost
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Raw Materials Used */}
                {selectedBatch.rawMaterialsUsed &&
                  selectedBatch.rawMaterialsUsed.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Raw Materials Used
                      </h3>
                      <div className="bg-gray-50 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left py-3 px-4">Material</th>
                              <th className="text-left py-3 px-4">Supplier</th>
                              <th className="text-right py-3 px-4">Quantity</th>
                              <th className="text-right py-3 px-4">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedBatch.rawMaterialsUsed.map(
                              (material, index) => (
                                <tr key={index}>
                                  <td className="py-3 px-4 font-medium">
                                    {material.materialName}
                                  </td>
                                  <td className="py-3 px-4">
                                    {material.supplierName}
                                  </td>
                                  <td className="text-right py-3 px-4">
                                    {material.quantity}
                                  </td>
                                  <td className="text-right py-3 px-4 font-medium">
                                    {formatCurrency(material.cost)}
                                  </td>
                                </tr>
                              )
                            )}
                            <tr className="bg-gray-100 font-bold">
                              <td colSpan="3" className="py-3 px-4 text-right">
                                Total Material Cost:
                              </td>
                              <td className="text-right py-3 px-4">
                                {formatCurrency(
                                  selectedBatch.rawMaterialsUsed.reduce(
                                    (sum, m) => sum + m.cost,
                                    0
                                  )
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Notes */}
                {selectedBatch.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Notes
                    </h3>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-sm text-gray-900">
                        {selectedBatch.notes}
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
          title={isEditMode ? "Batch Updated!" : "Production Recorded!"}
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

export default ProductionBatches;
