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
  where,
} from "firebase/firestore";
import { db } from "../../../../services/firebase";
import { useUser } from "../../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../../ui/InputField";
import Button from "../../../ui/Button";
import SuccessDialog from "../../../ui/SuccessDialog";
import FailDialog from "../../../ui/FailDialog";
import ProductSelector from "../../../ui/ProductSelector";
const ProductionEntry = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    productionDate: new Date().toISOString().split("T")[0],
    productionBatch: "",
    shift: "",
    supervisor: "",
    notes: "",
  });

  // Production items with additional pricing fields
  const [productionItems, setProductionItems] = useState([
    {
      productId: "",
      productName: "",
      productCode: "",
      quantity: "",
      unit: "pcs",
      batchNumber: "",
      manufacturedDate: new Date().toISOString().split("T")[0],
      expiryDate: "",
      qualityGrade: "A",
      storageLocation: "",
      costPerUnit: "", // Production cost
      retailPrice: "", // Selling price to end customers
      wholesalePrice: "", // Selling price to retailers/distributors
      margin: "", // Profit margin
      sellingPriceCategory: "retail", // Default pricing category
      notes: "", // Item-specific notes
    },
  ]);

  // Component state
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productions, setProductions] = useState([]);
  const [filteredProductions, setFilteredProductions] = useState([]);
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
  const [selectedProduction, setSelectedProduction] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const shiftOptions = ["Morning", "Afternoon", "Night", "Day", "Evening"];
  const qualityGrades = ["A", "B", "C", "Reject"];
  const storageLocations = [
    "Warehouse A",
    "Warehouse B",
    "Cold Storage",
    "Finished Goods",
    "Quality Hold",
    "Dispatch Ready",
  ];

  const sellingPriceCategories = [
    { value: "retail", label: "Retail Price" },
    { value: "wholesale", label: "Wholesale Price" },
    { value: "both", label: "Both Prices" },
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
      loadAvailableProducts();
      loadProductions();
    }
  }, [currentUser]);

  // Filter productions
  useEffect(() => {
    let filtered = productions;

    if (searchTerm) {
      filtered = filtered.filter(
        (production) =>
          production.productionBatch
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          production.supervisor
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          production.items?.some(
            (item) =>
              item.productName
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    if (filterProduct !== "all") {
      filtered = filtered.filter((production) =>
        production.items?.some((item) => item.productId === filterProduct)
      );
    }

    setFilteredProductions(filtered);
  }, [productions, searchTerm, filterProduct]);

  const loadAvailableProducts = async () => {
    try {
      const productsQuery = query(
        collection(db, "productDefinitions"),
        where("isActive", "==", true),
        orderBy("productName", "asc")
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productsData = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvailableProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
    }
  };

  const loadProductions = async () => {
    try {
      const productionsQuery = query(
        collection(db, "productions"),
        orderBy("productionDate", "desc")
      );
      const productionsSnapshot = await getDocs(productionsQuery);
      const productionsData = productionsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProductions(productionsData);
    } catch (error) {
      console.error("Error loading productions:", error);
      setErrorMessage("Failed to load production records. Please try again.");
      setShowError(true);
    }
  };

  const generateBatchNumber = useCallback(() => {
    const date = new Date(formData.productionDate);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const random = Math.floor(Math.random() * 999)
      .toString()
      .padStart(3, "0");

    const batchNumber = `PROD${year}${month}${day}${random}`;
    setFormData((prev) => ({
      ...prev,
      productionBatch: batchNumber,
    }));
  }, [formData.productionDate]);
  // Auto-generate batch numbers
  useEffect(() => {
    if (formData.productionDate) {
      generateBatchNumber();
    }
  }, [formData.productionDate, generateBatchNumber]);

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

  const handleProductSelect = (index, selectedProduct) => {
    const updatedItems = [...productionItems];

    if (selectedProduct) {
      // Auto-populate product details
      updatedItems[index].productId = selectedProduct.id;
      updatedItems[index].productName = selectedProduct.productName;
      updatedItems[index].productCode = selectedProduct.productCode;
      updatedItems[index].unit = selectedProduct.unit;

      // Auto-generate batch number for this item
      const date = new Date();
      const dateStr = date.toISOString().slice(2, 10).replace(/-/g, "");
      const random = Math.floor(Math.random() * 99)
        .toString()
        .padStart(2, "0");
      updatedItems[
        index
      ].batchNumber = `${selectedProduct.productCode}-${dateStr}-${random}`;

      // Calculate expiry date if shelf life is available
      if (selectedProduct.shelfLife) {
        const expiryDate = new Date(updatedItems[index].manufacturedDate);
        expiryDate.setDate(expiryDate.getDate() + selectedProduct.shelfLife);
        updatedItems[index].expiryDate = expiryDate.toISOString().split("T")[0];
      }
    } else {
      // Clear product details if no product selected
      updatedItems[index].productId = "";
      updatedItems[index].productName = "";
      updatedItems[index].productCode = "";
      updatedItems[index].unit = "pcs";
      updatedItems[index].batchNumber = "";
      updatedItems[index].expiryDate = "";
    }

    setProductionItems(updatedItems);

    // Clear any existing errors for this item
    if (errors[`item_${index}`]) {
      setErrors((prev) => ({
        ...prev,
        [`item_${index}`]: "",
      }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...productionItems];

    // Handle numeric fields
    if (
      [
        "quantity",
        "costPerUnit",
        "retailPrice",
        "wholesalePrice",
        "margin",
      ].includes(field)
    ) {
      value = value.replace(/[^0-9.]/g, "");
    }

    updatedItems[index][field] = value;

    // Auto-calculate expiry date when manufactured date changes
    if (field === "manufacturedDate" && value) {
      const selectedProduct = availableProducts.find(
        (p) => p.id === updatedItems[index].productId
      );
      if (selectedProduct && selectedProduct.shelfLife) {
        const expiryDate = new Date(value);
        expiryDate.setDate(expiryDate.getDate() + selectedProduct.shelfLife);
        updatedItems[index].expiryDate = expiryDate.toISOString().split("T")[0];
      }
    }

    // Auto-calculate margin when cost and selling prices change
    if (["costPerUnit", "retailPrice", "wholesalePrice"].includes(field)) {
      const cost = parseFloat(updatedItems[index].costPerUnit) || 0;
      const retail = parseFloat(updatedItems[index].retailPrice) || 0;
      const wholesale = parseFloat(updatedItems[index].wholesalePrice) || 0;

      if (cost > 0) {
        let margin = 0;
        if (
          updatedItems[index].sellingPriceCategory === "retail" &&
          retail > 0
        ) {
          margin = ((retail - cost) / cost) * 100;
        } else if (
          updatedItems[index].sellingPriceCategory === "wholesale" &&
          wholesale > 0
        ) {
          margin = ((wholesale - cost) / cost) * 100;
        } else if (
          updatedItems[index].sellingPriceCategory === "both" &&
          retail > 0
        ) {
          margin = ((retail - cost) / cost) * 100; // Use retail for margin calculation
        }
        updatedItems[index].margin = margin > 0 ? margin.toFixed(2) : "";
      }
    }

    setProductionItems(updatedItems);
  };

  const addProductionItem = () => {
    setProductionItems((prev) => [
      ...prev,
      {
        productId: "",
        productName: "",
        productCode: "",
        quantity: "",
        unit: "pcs",
        batchNumber: "",
        manufacturedDate: new Date().toISOString().split("T")[0],
        expiryDate: "",
        qualityGrade: "A",
        storageLocation: "",
        costPerUnit: "",
        retailPrice: "",
        wholesalePrice: "",
        margin: "",
        sellingPriceCategory: "retail",
        notes: "",
      },
    ]);
  };

  const removeProductionItem = (index) => {
    if (productionItems.length > 1) {
      setProductionItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Basic form validation
    if (!formData.productionDate)
      newErrors.productionDate = "Production date is required";
    if (!formData.productionBatch.trim())
      newErrors.productionBatch = "Production batch is required";
    if (!formData.supervisor.trim())
      newErrors.supervisor = "Supervisor name is required";

    // Validate items
    const validItems = productionItems.filter(
      (item) =>
        item.productId &&
        item.quantity &&
        parseFloat(item.quantity) > 0 &&
        item.batchNumber &&
        item.manufacturedDate
    );

    if (validItems.length === 0) {
      newErrors.items = "Please add at least one product with valid details";
    }

    // Validate each item
    productionItems.forEach((item, index) => {
      if (item.productId && !item.quantity) {
        newErrors[`item_${index}`] = "Quantity is required";
      }

      if (item.quantity) {
        const quantity = parseFloat(item.quantity);
        if (quantity <= 0) {
          newErrors[`item_${index}`] = "Quantity must be greater than 0";
        }
      }

      if (item.productId && !item.batchNumber) {
        newErrors[`item_${index}`] = "Batch number is required";
      }

      if (
        item.manufacturedDate &&
        new Date(item.manufacturedDate) > new Date()
      ) {
        newErrors[`item_${index}`] =
          "Manufactured date cannot be in the future";
      }

      if (
        item.expiryDate &&
        item.manufacturedDate &&
        new Date(item.expiryDate) <= new Date(item.manufacturedDate)
      ) {
        newErrors[`item_${index}`] =
          "Expiry date must be after manufactured date";
      }

      // Validate pricing
      if (item.costPerUnit && parseFloat(item.costPerUnit) < 0) {
        newErrors[`item_${index}`] = "Cost per unit cannot be negative";
      }

      if (item.retailPrice && parseFloat(item.retailPrice) < 0) {
        newErrors[`item_${index}`] = "Retail price cannot be negative";
      }

      if (item.wholesalePrice && parseFloat(item.wholesalePrice) < 0) {
        newErrors[`item_${index}`] = "Wholesale price cannot be negative";
      }
    });

    if (
      formData.productionDate &&
      new Date(formData.productionDate) > new Date()
    ) {
      newErrors.productionDate = "Production date cannot be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTotalQuantity = () => {
    return productionItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      return sum + quantity;
    }, 0);
  };

  const calculateTotalProductionValue = () => {
    return productionItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const cost = parseFloat(item.costPerUnit) || 0;
      return sum + quantity * cost;
    }, 0);
  };

  const calculateTotalRetailValue = () => {
    return productionItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const retailPrice = parseFloat(item.retailPrice) || 0;
      return sum + quantity * retailPrice;
    }, 0);
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
        "You must be logged in to record production. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const productionDocRef = doc(collection(db, "productions"));
      const productionId = productionDocRef.id;

      // Filter valid items
      const validItems = productionItems
        .filter(
          (item) =>
            item.productId &&
            item.quantity &&
            parseFloat(item.quantity) > 0 &&
            item.batchNumber &&
            item.manufacturedDate
        )
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: parseFloat(item.quantity),
          unit: item.unit,
          batchNumber: item.batchNumber.trim(),
          manufacturedDate: item.manufacturedDate,
          expiryDate: item.expiryDate,
          qualityGrade: item.qualityGrade,
          storageLocation: item.storageLocation,
          costPerUnit: item.costPerUnit ? parseFloat(item.costPerUnit) : null,
          retailPrice: item.retailPrice ? parseFloat(item.retailPrice) : null,
          wholesalePrice: item.wholesalePrice
            ? parseFloat(item.wholesalePrice)
            : null,
          margin: item.margin ? parseFloat(item.margin) : null,
          sellingPriceCategory: item.sellingPriceCategory,
          totalProductionValue: item.costPerUnit
            ? parseFloat(item.quantity) * parseFloat(item.costPerUnit)
            : null,
          totalRetailValue: item.retailPrice
            ? parseFloat(item.quantity) * parseFloat(item.retailPrice)
            : null,
          totalWholesaleValue: item.wholesalePrice
            ? parseFloat(item.quantity) * parseFloat(item.wholesalePrice)
            : null,
          notes: item.notes.trim(),
        }));

      const productionData = cleanData({
        productionId: productionId,
        productionDate: formData.productionDate,
        productionBatch: formData.productionBatch.trim(),
        shift: formData.shift,
        supervisor: formData.supervisor.trim(),
        items: validItems,
        totalItems: validItems.length,
        totalQuantity: calculateTotalQuantity(),
        totalProductionValue: calculateTotalProductionValue(),
        totalRetailValue: calculateTotalRetailValue(),
        notes: formData.notes.trim(),
        status: "completed",

        // System fields
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      });

      await setDoc(productionDocRef, productionData);

      // Update product stock in a separate collection for easy tracking
      for (const item of validItems) {
        const stockDocRef = doc(collection(db, "productStock"));
        await setDoc(stockDocRef, {
          stockId: stockDocRef.id,
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          batchNumber: item.batchNumber,
          quantity: item.quantity,
          unit: item.unit,
          manufacturedDate: item.manufacturedDate,
          expiryDate: item.expiryDate,
          qualityGrade: item.qualityGrade,
          storageLocation: item.storageLocation,
          costPerUnit: item.costPerUnit,
          retailPrice: item.retailPrice,
          wholesalePrice: item.wholesalePrice,
          margin: item.margin,
          sellingPriceCategory: item.sellingPriceCategory,
          totalProductionValue: item.totalProductionValue,
          totalRetailValue: item.totalRetailValue,
          totalWholesaleValue: item.totalWholesaleValue,
          productionId: productionId,
          productionBatch: formData.productionBatch,
          status: "available",
          createdAt: serverTimestamp(),
          createdBy: currentUser.userId,
          itemNotes: item.notes,
        });
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: "production_recorded",
          description: `Production batch ${
            formData.productionBatch
          } recorded (${
            validItems.length
          } products, ${calculateTotalQuantity()} total units)`,
          performedBy: currentUser.userId,
          targetProductionId: productionId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        `Production successfully recorded! Batch: ${
          formData.productionBatch
        } with ${
          validItems.length
        } products (${calculateTotalQuantity()} total units)`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        productionDate: new Date().toISOString().split("T")[0],
        productionBatch: "",
        shift: "",
        supervisor: "",
        notes: "",
      });
      setProductionItems([
        {
          productId: "",
          productName: "",
          productCode: "",
          quantity: "",
          unit: "pcs",
          batchNumber: "",
          manufacturedDate: new Date().toISOString().split("T")[0],
          expiryDate: "",
          qualityGrade: "A",
          storageLocation: "",
          costPerUnit: "",
          retailPrice: "",
          wholesalePrice: "",
          margin: "",
          sellingPriceCategory: "retail",
          notes: "",
        },
      ]);

      // Reload data
      await loadProductions();
    } catch (error) {
      console.error("Error recording production:", error);
      let errorMsg = "Failed to record production. Please try again.";

      if (error.code === "permission-denied") {
        errorMsg = "You don't have permission to record production.";
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProduction = (production) => {
    setSelectedProduction(production);
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
                Production Entry
              </h1>
              <p className="text-gray-600 mt-1">
                Record produced items and add to inventory
              </p>
            </div>
            <div className="mt-4 sm:mt-0 space-x-3">
              <Button
                variant={showForm ? "outline" : "primary"}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "View Records" : "Record Production"}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {productions.length}
              </div>
              <div className="text-sm text-blue-800">Production Batches</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {productions.reduce(
                  (sum, prod) => sum + (prod.totalQuantity || 0),
                  0
                )}
              </div>
              <div className="text-sm text-green-800">Total Units Produced</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {availableProducts.length}
              </div>
              <div className="text-sm text-purple-800">Product Types</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(
                  productions.reduce(
                    (sum, prod) => sum + (prod.totalProductionValue || 0),
                    0
                  )
                )}
              </div>
              <div className="text-sm text-orange-800">Production Value</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Production Entry Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Record Production
              </h2>
              <p className="text-gray-600">
                Enter details of produced items to add to inventory
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Production Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Production Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Production Date"
                    type="date"
                    value={formData.productionDate}
                    onChange={handleInputChange("productionDate")}
                    error={errors.productionDate}
                    required
                  />

                  <InputField
                    label="Production Batch Number"
                    type="text"
                    placeholder="Auto-generated batch number"
                    value={formData.productionBatch}
                    onChange={handleInputChange("productionBatch")}
                    error={errors.productionBatch}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Shift
                    </label>
                    <select
                      value={formData.shift}
                      onChange={handleInputChange("shift")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select shift</option>
                      {shiftOptions.map((shift) => (
                        <option key={shift} value={shift}>
                          {shift}
                        </option>
                      ))}
                    </select>
                  </div>

                  <InputField
                    label="Supervisor"
                    type="text"
                    placeholder="Enter supervisor name"
                    value={formData.supervisor}
                    onChange={handleInputChange("supervisor")}
                    error={errors.supervisor}
                    required
                  />
                </div>
              </div>

              {/* Production Items */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Produced Items
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addProductionItem}
                  >
                    Add Product
                  </Button>
                </div>

                {errors.items && (
                  <p className="text-sm text-red-600 mb-4">{errors.items}</p>
                )}

                <div className="space-y-8">
                  {productionItems.map((item, index) => (
                    <div
                      key={index}
                      className="border border-gray-100 rounded-lg p-6 bg-gray-50"
                    >
                      {/* Product Selection */}
                      <div className="mb-4">
                        <ProductSelector
                          value={
                            item.productId
                              ? availableProducts.find(
                                  (p) => p.id === item.productId
                                )
                              : null
                          }
                          onChange={(product) =>
                            handleProductSelect(index, product)
                          }
                          placeholder="Select a product to produce..."
                          required
                          error={errors[`item_${index}_product`]}
                        />
                      </div>

                      {/* Basic Production Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <InputField
                          label="Quantity"
                          type="number"
                          placeholder="Enter quantity"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                          }
                          step="0.01"
                          required
                        />

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quality Grade
                          </label>
                          <select
                            value={item.qualityGrade}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "qualityGrade",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {qualityGrades.map((grade) => (
                              <option key={grade} value={grade}>
                                Grade {grade}
                              </option>
                            ))}
                          </select>
                        </div>

                        <InputField
                          label="Batch Number"
                          type="text"
                          placeholder="Auto-generated"
                          value={item.batchNumber}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "batchNumber",
                              e.target.value
                            )
                          }
                          required
                        />

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Storage Location
                          </label>
                          <select
                            value={item.storageLocation}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "storageLocation",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select location</option>
                            {storageLocations.map((location) => (
                              <option key={location} value={location}>
                                {location}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Date Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <InputField
                          label="Manufactured Date"
                          type="date"
                          value={item.manufacturedDate}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "manufacturedDate",
                              e.target.value
                            )
                          }
                          required
                        />

                        <InputField
                          label="Expiry Date"
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "expiryDate",
                              e.target.value
                            )
                          }
                        />
                      </div>

                      {/* Pricing Information */}
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="text-lg font-medium text-gray-800 mb-3">
                          Pricing Information
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <InputField
                            label="Production Cost/Unit"
                            type="number"
                            placeholder="0.00"
                            value={item.costPerUnit}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "costPerUnit",
                                e.target.value
                              )
                            }
                            step="0.01"
                          />

                          <InputField
                            label="Retail Price/Unit"
                            type="number"
                            placeholder="0.00"
                            value={item.retailPrice}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "retailPrice",
                                e.target.value
                              )
                            }
                            step="0.01"
                          />

                          <InputField
                            label="Wholesale Price/Unit"
                            type="number"
                            placeholder="0.00"
                            value={item.wholesalePrice}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "wholesalePrice",
                                e.target.value
                              )
                            }
                            step="0.01"
                          />

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Primary Selling Category
                            </label>
                            <select
                              value={item.sellingPriceCategory}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "sellingPriceCategory",
                                  e.target.value
                                )
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {sellingPriceCategories.map((category) => (
                                <option
                                  key={category.value}
                                  value={category.value}
                                >
                                  {category.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Pricing Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-blue-900">
                              Profit Margin:
                            </span>
                            <p className="text-blue-700 font-bold">
                              {item.margin ? `${item.margin}%` : "N/A"}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-blue-900">
                              Production Value:
                            </span>
                            <p className="text-blue-700 font-bold">
                              {item.quantity && item.costPerUnit
                                ? formatCurrency(
                                    parseFloat(item.quantity) *
                                      parseFloat(item.costPerUnit)
                                  )
                                : formatCurrency(0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-blue-900">
                              Retail Value:
                            </span>
                            <p className="text-blue-700 font-bold">
                              {item.quantity && item.retailPrice
                                ? formatCurrency(
                                    parseFloat(item.quantity) *
                                      parseFloat(item.retailPrice)
                                  )
                                : formatCurrency(0)}
                            </p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-blue-900">
                              Wholesale Value:
                            </span>
                            <p className="text-blue-700 font-bold">
                              {item.quantity && item.wholesalePrice
                                ? formatCurrency(
                                    parseFloat(item.quantity) *
                                      parseFloat(item.wholesalePrice)
                                  )
                                : formatCurrency(0)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Item Notes */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Item Notes
                        </label>
                        <textarea
                          value={item.notes}
                          onChange={(e) =>
                            handleItemChange(index, "notes", e.target.value)
                          }
                          placeholder="Enter specific notes for this product..."
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>

                      {/* Remove Button */}
                      {productionItems.length > 1 && (
                        <div className="flex justify-end mt-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeProductionItem(index)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            Remove Product
                          </Button>
                        </div>
                      )}

                      {/* Error Display */}
                      {errors[`item_${index}`] && (
                        <p className="text-sm text-red-600 mt-2">
                          {errors[`item_${index}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Production Summary */}
                <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    Production Summary
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-blue-900">
                        Total Products:
                      </span>
                      <p className="text-blue-700 text-lg font-bold">
                        {
                          productionItems.filter((item) => item.productId)
                            .length
                        }
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">
                        Total Quantity:
                      </span>
                      <p className="text-blue-700 text-lg font-bold">
                        {calculateTotalQuantity()}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">
                        Production Value:
                      </span>
                      <p className="text-blue-700 text-lg font-bold">
                        {formatCurrency(calculateTotalProductionValue())}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-blue-900">
                        Retail Value:
                      </span>
                      <p className="text-blue-700 text-lg font-bold">
                        {formatCurrency(calculateTotalRetailValue())}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Additional Information
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Production Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={handleInputChange("notes")}
                    placeholder="Enter any production notes or special instructions..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
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
                  {loading ? "Recording Production..." : "Record Production"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Production Records List */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search production records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Products</option>
                  {availableProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.productName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Production Records Table */}
            {filteredProductions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">🏭</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No production records found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterProduct !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by recording your first production batch"}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  Record First Production
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
                        Batch Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Supervisor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Production Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Retail Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProductions.map((production) => (
                      <tr
                        key={production.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(production.productionDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {production.productionBatch}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {production.supervisor}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {production.totalItems || 0} items
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {production.totalQuantity || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(production.totalProductionValue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatCurrency(production.totalRetailValue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleViewProduction(production)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            View Details
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

        {/* View Production Modal */}
        {showModal && selectedProduction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Production Details
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

              <div className="p-6 space-y-6">
                {/* Production Header Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">
                      Production Date:
                    </span>
                    <p className="text-gray-900">
                      {formatDate(selectedProduction.productionDate)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Batch Number:
                    </span>
                    <p className="text-gray-900">
                      {selectedProduction.productionBatch}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Supervisor:
                    </span>
                    <p className="text-gray-900">
                      {selectedProduction.supervisor}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Shift:</span>
                    <p className="text-gray-900">
                      {selectedProduction.shift || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Production Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedProduction.totalItems || 0}
                    </div>
                    <div className="text-sm text-blue-800">Product Types</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedProduction.totalQuantity || 0}
                    </div>
                    <div className="text-sm text-blue-800">Total Units</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(selectedProduction.totalProductionValue)}
                    </div>
                    <div className="text-sm text-blue-800">
                      Production Value
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(selectedProduction.totalRetailValue)}
                    </div>
                    <div className="text-sm text-green-800">Retail Value</div>
                  </div>
                </div>

                {/* Production Items */}
                {selectedProduction.items &&
                  selectedProduction.items.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-3">
                        Produced Items:
                      </h3>
                      <div className="bg-gray-50 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left py-3 px-4">Product</th>
                              <th className="text-left py-3 px-4">
                                Batch Number
                              </th>
                              <th className="text-right py-3 px-4">Quantity</th>
                              <th className="text-left py-3 px-4">Quality</th>
                              <th className="text-right py-3 px-4">
                                Cost/Unit
                              </th>
                              <th className="text-right py-3 px-4">
                                Retail Price
                              </th>
                              <th className="text-right py-3 px-4">
                                Wholesale Price
                              </th>
                              <th className="text-right py-3 px-4">Margin</th>
                              <th className="text-right py-3 px-4">
                                Total Value
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedProduction.items.map((item, index) => (
                              <tr key={index}>
                                <td className="py-3 px-4">
                                  <div>
                                    <div className="font-medium">
                                      {item.productName}
                                    </div>
                                    <div className="text-gray-500 text-xs">
                                      {item.productCode}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-xs">
                                  {item.batchNumber}
                                </td>
                                <td className="text-right py-3 px-4">
                                  {item.quantity} {item.unit}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`px-2 py-1 text-xs rounded-full ${
                                      item.qualityGrade === "A"
                                        ? "bg-green-100 text-green-800"
                                        : item.qualityGrade === "B"
                                        ? "bg-yellow-100 text-yellow-800"
                                        : item.qualityGrade === "C"
                                        ? "bg-orange-100 text-orange-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {item.qualityGrade}
                                  </span>
                                </td>
                                <td className="text-right py-3 px-4">
                                  {item.costPerUnit
                                    ? formatCurrency(item.costPerUnit)
                                    : "N/A"}
                                </td>
                                <td className="text-right py-3 px-4">
                                  {item.retailPrice
                                    ? formatCurrency(item.retailPrice)
                                    : "N/A"}
                                </td>
                                <td className="text-right py-3 px-4">
                                  {item.wholesalePrice
                                    ? formatCurrency(item.wholesalePrice)
                                    : "N/A"}
                                </td>
                                <td className="text-right py-3 px-4">
                                  {item.margin ? `${item.margin}%` : "N/A"}
                                </td>
                                <td className="text-right py-3 px-4 font-medium">
                                  <div className="space-y-1">
                                    <div className="text-blue-600">
                                      {item.totalProductionValue
                                        ? formatCurrency(
                                            item.totalProductionValue
                                          )
                                        : "N/A"}
                                    </div>
                                    {item.totalRetailValue && (
                                      <div className="text-green-600 text-xs">
                                        R:{" "}
                                        {formatCurrency(item.totalRetailValue)}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Notes */}
                {selectedProduction.notes && (
                  <div>
                    <span className="font-medium text-gray-700">
                      Production Notes:
                    </span>
                    <p className="text-gray-900 mt-1 p-3 bg-gray-50 rounded-lg">
                      {selectedProduction.notes}
                    </p>
                  </div>
                )}
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
          title="Production Recorded Successfully!"
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

export default ProductionEntry;
