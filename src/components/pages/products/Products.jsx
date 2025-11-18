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

const Products = ({ editProduct = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const isEditMode = !!editProduct;

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    unit: "cup",
    category: "finished_goods",
    sku: "",
    barcode: "",
    defaultSellingPrice: "",
    costPrice: "",
    expiryDays: "",
    minStockLevel: "",
    maxStockLevel: "",
    description: "",
    isActive: true,
  });

  // Component state
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
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
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const unitOptions = [
    { value: "cup", label: "Cup" },
    { value: "pack", label: "Pack" },
    { value: "liter", label: "Liter" },
    { value: "ml", label: "Milliliter (ml)" },
    { value: "bottle", label: "Bottle" },
    { value: "sachet", label: "Sachet" },
    { value: "kg", label: "Kilogram (kg)" },
    { value: "grams", label: "Grams" },
    { value: "units", label: "Units" },
  ];

  const categoryOptions = [
    { value: "finished_goods", label: "Finished Goods", color: "blue" },
    { value: "beverages", label: "Beverages", color: "green" },
    { value: "dairy", label: "Dairy Products", color: "yellow" },
    { value: "bakery", label: "Bakery", color: "orange" },
    { value: "snacks", label: "Snacks", color: "purple" },
    { value: "frozen", label: "Frozen Products", color: "indigo" },
    { value: "others", label: "Others", color: "gray" },
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load products
  useEffect(() => {
    if (currentUser) {
      loadProducts();
    }
  }, [currentUser]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editProduct) {
      setFormData({
        name: editProduct.name || "",
        unit: editProduct.unit || "cup",
        category: editProduct.category || "finished_goods",
        sku: editProduct.sku || "",
        barcode: editProduct.barcode || "",
        defaultSellingPrice: editProduct.defaultSellingPrice?.toString() || "",
        costPrice: editProduct.costPrice?.toString() || "",
        expiryDays: editProduct.expiryDays?.toString() || "",
        minStockLevel: editProduct.minStockLevel?.toString() || "",
        maxStockLevel: editProduct.maxStockLevel?.toString() || "",
        description: editProduct.description || "",
        isActive: editProduct.isActive !== undefined ? editProduct.isActive : true,
      });
      setShowForm(true);
    }
  }, [editProduct]);

  // Filter products
  useEffect(() => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.productId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterUnit !== "all") {
      filtered = filtered.filter((product) => product.unit === filterUnit);
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter((product) => product.category === filterCategory);
    }

    if (filterStatus === "active") {
      filtered = filtered.filter((product) => product.isActive !== false);
    } else if (filterStatus === "inactive") {
      filtered = filtered.filter((product) => product.isActive === false);
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, filterUnit, filterCategory, filterStatus]);

  const loadProducts = async () => {
    try {
      const productsQuery = query(
        collection(db, "products"),
        orderBy("createdAt", "desc")
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
      setErrorMessage("Failed to load products. Please try again.");
      setShowError(true);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.type === "checkbox" ? e.target.checked : e.target.value;

    if (["defaultSellingPrice", "costPrice", "expiryDays", "minStockLevel", "maxStockLevel"].includes(field)) {
      value = value.toString().replace(/[^0-9.]/g, "");
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

    if (!formData.name.trim()) newErrors.name = "Product name is required";
    if (!formData.unit) newErrors.unit = "Unit is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.defaultSellingPrice.trim())
      newErrors.defaultSellingPrice = "Selling price is required";
    if (!formData.expiryDays.trim())
      newErrors.expiryDays = "Expiry days is required";

    if (
      formData.defaultSellingPrice &&
      (isNaN(formData.defaultSellingPrice) ||
        parseFloat(formData.defaultSellingPrice) <= 0)
    ) {
      newErrors.defaultSellingPrice =
        "Please enter a valid price greater than 0";
    }

    if (
      formData.costPrice &&
      (isNaN(formData.costPrice) || parseFloat(formData.costPrice) < 0)
    ) {
      newErrors.costPrice = "Please enter a valid cost price";
    }

    if (
      formData.expiryDays &&
      (isNaN(formData.expiryDays) || parseInt(formData.expiryDays) <= 0)
    ) {
      newErrors.expiryDays = "Please enter valid expiry days greater than 0";
    }

    if (
      formData.minStockLevel &&
      (isNaN(formData.minStockLevel) || parseInt(formData.minStockLevel) < 0)
    ) {
      newErrors.minStockLevel = "Please enter a valid minimum stock level";
    }

    if (
      formData.maxStockLevel &&
      (isNaN(formData.maxStockLevel) || parseInt(formData.maxStockLevel) < 0)
    ) {
      newErrors.maxStockLevel = "Please enter a valid maximum stock level";
    }

    if (
      formData.minStockLevel &&
      formData.maxStockLevel &&
      parseInt(formData.minStockLevel) > parseInt(formData.maxStockLevel)
    ) {
      newErrors.maxStockLevel = "Maximum stock must be greater than minimum stock";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateProductId = () => {
    const prefix = "PRD";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, "0");
    return `${prefix}${timestamp}${random}`;
  };

  const generateSKU = () => {
    const category = formData.category.substring(0, 3).toUpperCase();
    const name = formData.name.substring(0, 3).toUpperCase().replace(/\s/g, "");
    const timestamp = Date.now().toString().slice(-4);
    return `${category}-${name}-${timestamp}`;
  };

  const exportToCSV = () => {
    const headers = [
      "Product ID",
      "Name",
      "SKU",
      "Barcode",
      "Category",
      "Unit",
      "Selling Price",
      "Cost Price",
      "Profit Margin",
      "Expiry Days",
      "Min Stock",
      "Max Stock",
      "Status",
      "Created At",
    ];

    const rows = filteredProducts.map((product) => [
      product.productId || "",
      product.name || "",
      product.sku || "",
      product.barcode || "",
      categoryOptions.find((c) => c.value === product.category)?.label || product.category || "",
      unitOptions.find((u) => u.value === product.unit)?.label || product.unit || "",
      product.defaultSellingPrice || 0,
      product.costPrice || 0,
      product.defaultSellingPrice && product.costPrice
        ? (product.defaultSellingPrice - product.costPrice).toFixed(2)
        : 0,
      product.expiryDays || "",
      product.minStockLevel || "",
      product.maxStockLevel || "",
      product.isActive !== false ? "Active" : "Inactive",
      formatDate(product.createdAt),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowExportMenu(false);
    setSuccessMessage(`Successfully exported ${filteredProducts.length} products to CSV!`);
    setShowSuccess(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage(
        "You must be logged in to manage products. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      let productId;
      let productDocRef;

      if (isEditMode) {
        productId = editProduct.productId || editProduct.id;
        productDocRef = doc(db, "products", productId);
      } else {
        productDocRef = doc(collection(db, "products"));
        productId = generateProductId();
      }

      const productData = {
        productId: productId,
        name: formData.name.trim(),
        unit: formData.unit,
        category: formData.category,
        sku: formData.sku.trim() || (isEditMode ? editProduct.sku : generateSKU()),
        barcode: formData.barcode.trim(),
        defaultSellingPrice: parseFloat(formData.defaultSellingPrice),
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : null,
        expiryDays: parseInt(formData.expiryDays),
        minStockLevel: formData.minStockLevel ? parseInt(formData.minStockLevel) : null,
        maxStockLevel: formData.maxStockLevel ? parseInt(formData.maxStockLevel) : null,
        description: formData.description.trim(),
        isActive: formData.isActive,
        ...(isEditMode
          ? {}
          : { createdAt: serverTimestamp(), createdBy: currentUser.userId }),
        updatedAt: serverTimestamp(),
        ...(isEditMode ? { updatedBy: currentUser.userId } : {}),
      };

      if (isEditMode) {
        await updateDoc(productDocRef, productData);
      } else {
        await setDoc(productDocRef, productData);
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: isEditMode ? "product_updated" : "product_added",
          description: isEditMode
            ? `Product ${formData.name} was updated`
            : `New product ${formData.name} was added`,
          performedBy: currentUser.userId,
          targetProductId: productId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        isEditMode
          ? `Product ${formData.name} has been successfully updated!`
          : `Product ${formData.name} has been successfully added with ID: ${productId}`
      );
      setShowSuccess(true);

      if (!isEditMode) {
        setFormData({
          name: "",
          unit: "cup",
          category: "finished_goods",
          sku: "",
          barcode: "",
          defaultSellingPrice: "",
          costPrice: "",
          expiryDays: "",
          minStockLevel: "",
          maxStockLevel: "",
          description: "",
          isActive: true,
        });
      } else {
        setTimeout(() => {
          setShowForm(false);
        }, 1500);
      }

      await loadProducts();
    } catch (error) {
      console.error("Error managing product:", error);

      let errorMsg = `Failed to ${
        isEditMode ? "update" : "add"
      } product. Please try again.`;

      if (error.code === "permission-denied") {
        errorMsg = `You don't have permission to ${
          isEditMode ? "update" : "add"
        } products.`;
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
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
                Product Catalog
              </h1>
              <p className="text-gray-600">Define and manage your products</p>
            </div>
            <div className="mt-4 sm:mt-0 flex gap-3">
              {!showForm && (
                <div className="relative">
                  <Button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    variant="secondary"
                    size="lg"
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
                    Export
                  </Button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 z-10">
                      <button
                        onClick={exportToCSV}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded-t-xl flex items-center"
                      >
                        <svg
                          className="w-4 h-4 mr-2 text-green-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Export to CSV
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                    View Products
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
                    Add Product
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">
                {products.length}
              </div>
              <div className="text-sm text-blue-600 font-medium">
                Total Products
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {formatCurrency(
                  products.reduce(
                    (sum, p) => sum + (p.defaultSellingPrice || 0),
                    0
                  ) / (products.length || 1)
                )}
              </div>
              <div className="text-sm text-green-600 font-medium">
                Avg. Price
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                {products.filter((p) => p.unit === "cup").length}
              </div>
              <div className="text-sm text-purple-600 font-medium">
                Cup Products
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
              <div className="text-2xl font-bold text-orange-700">
                {products.filter((p) => p.unit === "liter").length}
              </div>
              <div className="text-sm text-orange-600 font-medium">
                Liter Products
              </div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Add/Edit Product Form */
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
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditMode ? "Edit Product" : "Add New Product"}
              </h2>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update product information"
                  : "Define a new product for your catalog"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
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
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                  </span>
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Product Name"
                    type="text"
                    placeholder="Enter product name (e.g., Yoghurt)"
                    value={formData.name}
                    onChange={handleInputChange("name")}
                    error={errors.name}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={handleInputChange("category")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {errors.category && (
                      <p className="text-sm text-red-600 mt-1">{errors.category}</p>
                    )}
                  </div>

                  <InputField
                    label="SKU"
                    type="text"
                    placeholder="Auto-generated if left empty"
                    value={formData.sku}
                    onChange={handleInputChange("sku")}
                    error={errors.sku}
                  />

                  <InputField
                    label="Barcode"
                    type="text"
                    placeholder="Enter barcode (optional)"
                    value={formData.barcode}
                    onChange={handleInputChange("barcode")}
                    error={errors.barcode}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit <span className="text-red-500">*</span>
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
                    label="Expiry Days"
                    type="number"
                    placeholder="Enter shelf life in days"
                    value={formData.expiryDays}
                    onChange={handleInputChange("expiryDays")}
                    error={errors.expiryDays}
                    required
                  />

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={handleInputChange("description")}
                      placeholder="Enter product description..."
                      rows={2}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
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
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  Pricing Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Default Selling Price"
                    type="number"
                    placeholder="Enter selling price"
                    value={formData.defaultSellingPrice}
                    onChange={handleInputChange("defaultSellingPrice")}
                    error={errors.defaultSellingPrice}
                    required
                    step="0.01"
                  />

                  <InputField
                    label="Cost Price"
                    type="number"
                    placeholder="Enter cost price (optional)"
                    value={formData.costPrice}
                    onChange={handleInputChange("costPrice")}
                    error={errors.costPrice}
                    step="0.01"
                  />

                  {formData.defaultSellingPrice && formData.costPrice && (
                    <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-blue-600 font-medium">Profit Margin</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {formatCurrency(
                              parseFloat(formData.defaultSellingPrice) - parseFloat(formData.costPrice)
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-blue-600 font-medium">Markup %</p>
                          <p className="text-2xl font-bold text-green-700">
                            {(
                              ((parseFloat(formData.defaultSellingPrice) - parseFloat(formData.costPrice)) /
                                parseFloat(formData.costPrice)) *
                              100
                            ).toFixed(1)}
                            %
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Inventory Management */}
              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                    <svg
                      className="w-5 h-5 text-purple-600"
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
                  </span>
                  Inventory Management
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Minimum Stock Level"
                    type="number"
                    placeholder="Enter minimum stock alert level"
                    value={formData.minStockLevel}
                    onChange={handleInputChange("minStockLevel")}
                    error={errors.minStockLevel}
                  />

                  <InputField
                    label="Maximum Stock Level"
                    type="number"
                    placeholder="Enter maximum stock level"
                    value={formData.maxStockLevel}
                    onChange={handleInputChange("maxStockLevel")}
                    error={errors.maxStockLevel}
                  />

                  <div className="md:col-span-2 flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={handleInputChange("isActive")}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-900">
                        Product is {formData.isActive ? "Active" : "Inactive"}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Info Box */}
              {formData.expiryDays && (
                <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
                  <div className="flex items-start">
                    <svg
                      className="w-5 h-5 text-blue-600 mr-2 mt-0.5"
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
                    <div className="text-sm text-blue-700">
                      <p className="font-medium">
                        Products produced today will expire in{" "}
                        {formData.expiryDays} days
                      </p>
                      <p className="text-xs mt-1">
                        Expiry date will be automatically calculated based on
                        production date
                      </p>
                    </div>
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
                      : "Adding..."
                    : isEditMode
                    ? "Update Product"
                    : "Add Product"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Products List */
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by name, Product ID, SKU, or barcode..."
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
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value="all">All Categories</option>
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value="all">All Units</option>
                    {unitOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  {(searchTerm || filterCategory !== "all" || filterUnit !== "all" || filterStatus !== "all") && (
                    <button
                      onClick={() => {
                        setSearchTerm("");
                        setFilterCategory("all");
                        setFilterUnit("all");
                        setFilterStatus("all");
                      }}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Products Table */}
            {filteredProducts.length === 0 ? (
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
                  {searchTerm || filterUnit !== "all"
                    ? "No products match your filters"
                    : "No products yet"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterUnit !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by adding your first product"}
                </p>
                {!searchTerm && filterUnit === "all" && (
                  <Button onClick={() => setShowForm(true)} size="lg">
                    Add First Product
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Selling Price
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Expiry Days
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                              {product.name
                                ? product.name.substring(0, 2).toUpperCase()
                                : "??"}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">
                                {product.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {product.productId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                            {unitOptions.find((u) => u.value === product.unit)
                              ?.label || product.unit}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            {formatCurrency(product.defaultSellingPrice)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {product.expiryDays} days
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleViewProduct(product)}
                              className="text-blue-600 hover:text-blue-800 transition-colors font-medium"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                setFormData({
                                  name: product.name,
                                  unit: product.unit,
                                  defaultSellingPrice:
                                    product.defaultSellingPrice?.toString(),
                                  expiryDays: product.expiryDays?.toString(),
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* View Product Modal */}
        {showModal && selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {selectedProduct.name
                        ? selectedProduct.name.substring(0, 2).toUpperCase()
                        : "??"}
                    </div>
                    <div className="ml-5">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedProduct.name}
                      </h2>
                      <p className="text-gray-600">Product Details</p>
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
                {/* Product Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Product Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Product ID
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {selectedProduct.productId}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Product Name
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {selectedProduct.name}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Unit
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {unitOptions.find(
                          (u) => u.value === selectedProduct.unit
                        )?.label || selectedProduct.unit}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Selling Price
                      </span>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {formatCurrency(selectedProduct.defaultSellingPrice)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expiry Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Expiry Information
                  </h3>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-orange-600 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-orange-900">
                          Shelf Life: {selectedProduct.expiryDays} days
                        </p>
                        <p className="text-xs text-orange-700 mt-1">
                          Products expire {selectedProduct.expiryDays} days
                          after production
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    System Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Created At
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDate(selectedProduct.createdAt)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <span className="text-xs font-medium text-gray-500">
                        Last Updated
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">
                        {formatDate(selectedProduct.updatedAt)}
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
                      setFormData({
                        name: selectedProduct.name,
                        unit: selectedProduct.unit,
                        defaultSellingPrice:
                          selectedProduct.defaultSellingPrice?.toString(),
                        expiryDays: selectedProduct.expiryDays?.toString(),
                      });
                      setShowModal(false);
                      setShowForm(true);
                    }}
                  >
                    Edit Product
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
          title={isEditMode ? "Product Updated!" : "Product Added!"}
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

export default Products;
