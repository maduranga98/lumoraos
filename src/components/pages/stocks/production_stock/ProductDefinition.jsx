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
import { db } from "../../../../services/firebase";
import { useUser } from "../../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../../ui/InputField";
import Button from "../../../ui/Button";
import SuccessDialog from "../../../ui/SuccessDialog";
import FailDialog from "../../../ui/FailDialog";

const ProductDefinition = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    productName: "",
    productCode: "",
    category: "",
    description: "",
    unit: "pcs",
    shelfLife: "",
    storageConditions: "",
    qualityStandards: "",
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
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const productCategories = [
    "Food & Beverages",
    "Personal Care",
    "Household Items",
    "Electronics",
    "Textiles",
    "Pharmaceuticals",
    "Chemicals",
    "Industrial Goods",
    "Other",
  ];

  const unitOptions = [
    "pcs",
    "kg",
    "g",
    "L",
    "mL",
    "m",
    "cm",
    "boxes",
    "bottles",
    "packets",
  ];

  const storageConditions = [
    "Room Temperature",
    "Refrigerated (2-8°C)",
    "Frozen (-18°C)",
    "Cool & Dry",
    "Dark Place",
    "Controlled Environment",
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

  // Filter products
  useEffect(() => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(
        (product) =>
          product.productName
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          product.productCode
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          product.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterCategory !== "all") {
      filtered = filtered.filter(
        (product) => product.category === filterCategory
      );
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, filterCategory]);

  const loadProducts = async () => {
    try {
      const productsQuery = query(
        collection(db, "productDefinitions"),
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
    let value = e.target.value;

    if (field === "productCode") {
      value = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    } else if (field === "shelfLife") {
      value = value.replace(/[^0-9]/g, "");
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

    // Required fields
    if (!formData.productName.trim())
      newErrors.productName = "Product name is required";
    if (!formData.productCode.trim())
      newErrors.productCode = "Product code is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.unit) newErrors.unit = "Unit is required";

    // Product code validation
    if (formData.productCode && formData.productCode.length < 2) {
      newErrors.productCode = "Product code must be at least 2 characters";
    }

    // Check for duplicate product code (only in add mode)
    if (!editMode && formData.productCode) {
      const isDuplicate = products.some(
        (product) =>
          product.productCode.toLowerCase() ===
          formData.productCode.toLowerCase()
      );
      if (isDuplicate) {
        newErrors.productCode = "Product code already exists";
      }
    }

    // Shelf life validation
    if (
      formData.shelfLife &&
      (isNaN(formData.shelfLife) || parseInt(formData.shelfLife) <= 0)
    ) {
      newErrors.shelfLife = "Please enter a valid shelf life in days";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        "You must be logged in to manage products. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      let productId;
      let productDocRef;

      if (editMode && selectedProduct) {
        productId = selectedProduct.id;
        productDocRef = doc(db, "productDefinitions", productId);
      } else {
        productDocRef = doc(collection(db, "productDefinitions"));
        productId = productDocRef.id;
      }

      const productData = cleanData({
        ...(!editMode ? { productId: productId } : {}),
        productName: formData.productName.trim(),
        productCode: formData.productCode.trim(),
        category: formData.category,
        description: formData.description.trim(),
        unit: formData.unit,
        shelfLife: formData.shelfLife ? parseInt(formData.shelfLife) : null,
        storageConditions: formData.storageConditions,
        qualityStandards: formData.qualityStandards.trim(),
        isActive: true,

        // System fields
        ...(!editMode
          ? {
              createdAt: serverTimestamp(),
              createdBy: currentUser.userId,
            }
          : {}),
        updatedAt: serverTimestamp(),
        ...(editMode ? { updatedBy: currentUser.userId } : {}),
      });

      if (editMode) {
        await updateDoc(productDocRef, productData);
      } else {
        await setDoc(productDocRef, productData);
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: editMode ? "product_updated" : "product_defined",
          description: editMode
            ? `Product ${formData.productName} (${formData.productCode}) was updated`
            : `New product ${formData.productName} (${formData.productCode}) was defined`,
          performedBy: currentUser.userId,
          targetProductId: productId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        editMode
          ? `Product ${formData.productName} has been successfully updated!`
          : `Product ${formData.productName} has been successfully defined with ID: ${productId}`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        productName: "",
        productCode: "",
        category: "",
        description: "",
        unit: "pcs",
        shelfLife: "",
        storageConditions: "",
        qualityStandards: "",
      });

      setEditMode(false);
      setSelectedProduct(null);

      if (editMode) {
        setShowForm(false);
        setShowModal(false);
      }

      await loadProducts();
    } catch (error) {
      console.error("Error managing product:", error);

      let errorMsg = `Failed to ${
        editMode ? "update" : "define"
      } product. Please try again.`;

      if (error.code === "permission-denied") {
        errorMsg = `You don't have permission to ${
          editMode ? "update" : "define"
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

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setFormData({
      productName: product.productName || "",
      productCode: product.productCode || "",
      category: product.category || "",
      description: product.description || "",
      unit: product.unit || "pcs",
      shelfLife: product.shelfLife?.toString() || "",
      storageConditions: product.storageConditions || "",
      qualityStandards: product.qualityStandards || "",
    });
    setEditMode(true);
    setShowModal(false);
    setShowForm(true);
  };

  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setShowModal(true);
  };

  // const formatDate = (dateString) => {
  //   if (!dateString) return "N/A";
  //   return new Date(dateString).toLocaleDateString("en-US", {
  //     year: "numeric",
  //     month: "short",
  //     day: "numeric",
  //   });
  // };

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
                Product Definition
              </h1>
              <p className="text-gray-600 mt-1">
                Define and manage product types for production
              </p>
            </div>
            <div className="mt-4 sm:mt-0 space-x-3">
              <Button
                variant={showForm ? "outline" : "primary"}
                onClick={() => {
                  if (showForm && editMode) {
                    setEditMode(false);
                    setSelectedProduct(null);
                    setFormData({
                      productName: "",
                      productCode: "",
                      category: "",
                      description: "",
                      unit: "pcs",
                      shelfLife: "",
                      storageConditions: "",
                      qualityStandards: "",
                    });
                  }
                  setShowForm(!showForm);
                }}
              >
                {showForm ? "View Products" : "Define New Product"}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {products.length}
              </div>
              <div className="text-sm text-blue-800">Total Products</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {products.filter((p) => p.isActive !== false).length}
              </div>
              <div className="text-sm text-green-800">Active Products</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {new Set(products.map((p) => p.category)).size}
              </div>
              <div className="text-sm text-purple-800">Categories</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {products.filter((p) => p.shelfLife).length}
              </div>
              <div className="text-sm text-orange-800">With Expiry</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Product Definition Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {editMode ? "Edit Product" : "Define New Product"}
              </h2>
              <p className="text-gray-600">
                {editMode
                  ? "Update product information"
                  : "Create a new product type for production tracking"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Product Name"
                    type="text"
                    placeholder="Enter product name"
                    value={formData.productName}
                    onChange={handleInputChange("productName")}
                    error={errors.productName}
                    required
                  />

                  <InputField
                    label="Product Code"
                    type="text"
                    placeholder="Enter unique product code"
                    value={formData.productCode}
                    onChange={handleInputChange("productCode")}
                    error={errors.productCode}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.category}
                      onChange={handleInputChange("category")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select category</option>
                      {productCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    {errors.category && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.category}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.unit}
                      onChange={handleInputChange("unit")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {unitOptions.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <InputField
                      label="Description"
                      type="text"
                      placeholder="Enter product description"
                      value={formData.description}
                      onChange={handleInputChange("description")}
                    />
                  </div>
                </div>
              </div>

              {/* Product Specifications */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Product Specifications
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Shelf Life (Days)"
                    type="number"
                    placeholder="Enter shelf life in days"
                    value={formData.shelfLife}
                    onChange={handleInputChange("shelfLife")}
                    error={errors.shelfLife}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Storage Conditions
                    </label>
                    <select
                      value={formData.storageConditions}
                      onChange={handleInputChange("storageConditions")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select storage conditions</option>
                      {storageConditions.map((condition) => (
                        <option key={condition} value={condition}>
                          {condition}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quality Standards
                    </label>
                    <textarea
                      value={formData.qualityStandards}
                      onChange={handleInputChange("qualityStandards")}
                      placeholder="Enter quality standards and specifications..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditMode(false);
                    setSelectedProduct(null);
                    setFormData({
                      productName: "",
                      productCode: "",
                      category: "",
                      description: "",
                      unit: "pcs",
                      shelfLife: "",
                      storageConditions: "",
                      qualityStandards: "",
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={loading} size="lg">
                  {loading
                    ? editMode
                      ? "Updating..."
                      : "Defining..."
                    : editMode
                    ? "Update Product"
                    : "Define Product"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Products List */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {productCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Products Table */}
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">📋</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No products defined
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterCategory !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by defining your first product"}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  Define First Product
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Unit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Shelf Life
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.productName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {product.productCode}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product.shelfLife
                            ? `${product.shelfLife} days`
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewProduct(product)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleEditProduct(product)}
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

        {/* View Product Modal */}
        {showModal && selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Product Details
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
                    <span className="font-medium text-gray-700">
                      Product Name:
                    </span>
                    <p className="text-gray-900">
                      {selectedProduct.productName}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Product Code:
                    </span>
                    <p className="text-gray-900">
                      {selectedProduct.productCode}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Category:</span>
                    <p className="text-gray-900">{selectedProduct.category}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Unit:</span>
                    <p className="text-gray-900">{selectedProduct.unit}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Shelf Life:
                    </span>
                    <p className="text-gray-900">
                      {selectedProduct.shelfLife
                        ? `${selectedProduct.shelfLife} days`
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Storage Conditions:
                    </span>
                    <p className="text-gray-900">
                      {selectedProduct.storageConditions || "N/A"}
                    </p>
                  </div>
                  {selectedProduct.description && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">
                        Description:
                      </span>
                      <p className="text-gray-900">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}
                  {selectedProduct.qualityStandards && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">
                        Quality Standards:
                      </span>
                      <p className="text-gray-900">
                        {selectedProduct.qualityStandards}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl">
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setShowModal(false)}>
                    Close
                  </Button>
                  <Button onClick={() => handleEditProduct(selectedProduct)}>
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
          title={editMode ? "Product Updated!" : "Product Defined!"}
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

export default ProductDefinition;
