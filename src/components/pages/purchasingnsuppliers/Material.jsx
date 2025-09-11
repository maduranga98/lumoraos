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

const Material = ({ editMaterial = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const isEditMode = !!editMaterial;

  // Form state
  const [formData, setFormData] = useState({
    supplierId: "",
    purchaseDate: "",
    paymentMethod: "",
    invoiceNumber: "",
    notes: "",
  });

  // Items management
  const [items, setItems] = useState([
    { itemName: "", category: "", quantity: "", unitPrice: "", totalPrice: "" },
  ]);

  // Component state
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
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
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Item management
  const [showItemForm, setShowItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "",
    description: "",
  });

  const paymentMethods = [
    "Cash",
    "Cheque",
    "Credit",
    "Bank Transfer",
    "Account",
  ];

  const itemCategories = [
    "Raw Materials",
    "Office Supplies",
    "Vehicle Parts",
    "Tools & Equipment",
    "Electronics",
    "Consumables",
    "Safety Equipment",
    "Other",
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
      loadSuppliers();
      loadMaterials();
      loadAvailableItems();
    }
  }, [currentUser]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editMaterial) {
      setFormData({
        supplierId: editMaterial.supplierId || "",
        purchaseDate: editMaterial.purchaseDate || "",
        paymentMethod: editMaterial.paymentMethod || "",
        invoiceNumber: editMaterial.invoiceNumber || "",
        notes: editMaterial.notes || "",
      });

      if (editMaterial.items && editMaterial.items.length > 0) {
        setItems(editMaterial.items);
      }

      setShowForm(true);
    }
  }, [editMaterial]);

  // Filter materials
  useEffect(() => {
    let filtered = materials;

    if (searchTerm) {
      filtered = filtered.filter(
        (material) =>
          material.invoiceNumber
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          material.supplierName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          material.items?.some((item) =>
            item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    if (filterSupplier !== "all") {
      filtered = filtered.filter(
        (material) => material.supplierId === filterSupplier
      );
    }

    if (filterPayment !== "all") {
      filtered = filtered.filter(
        (material) => material.paymentMethod === filterPayment
      );
    }

    setFilteredMaterials(filtered);
  }, [materials, searchTerm, filterSupplier, filterPayment]);

  // Calculate item total price
  useEffect(() => {
    const updatedItems = items.map((item) => ({
      ...item,
      totalPrice:
        (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0),
    }));

    // Only update if there's an actual change to avoid infinite loop
    if (JSON.stringify(updatedItems) !== JSON.stringify(items)) {
      setItems(updatedItems);
    }
  }, [items.map((item) => `${item.quantity}-${item.unitPrice}`).join(",")]);

  const loadSuppliers = async () => {
    try {
      const suppliersSnapshot = await getDocs(collection(db, "suppliers"));
      const suppliersData = suppliersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSuppliers(suppliersData.filter((s) => s.isActive !== false));
    } catch (error) {
      console.error("Error loading suppliers:", error);
    }
  };

  const loadMaterials = async () => {
    try {
      const materialsQuery = query(
        collection(db, "materials"),
        orderBy("purchaseDate", "desc")
      );
      const materialsSnapshot = await getDocs(materialsQuery);
      const materialsData = materialsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Add supplier names
      const materialsWithSuppliers = materialsData.map((material) => {
        const supplier = suppliers.find((s) => s.id === material.supplierId);
        return {
          ...material,
          supplierName: supplier?.name || "Unknown Supplier",
        };
      });

      setMaterials(materialsWithSuppliers);
    } catch (error) {
      console.error("Error loading materials:", error);
      setErrorMessage("Failed to load materials. Please try again.");
      setShowError(true);
    }
  };

  const loadAvailableItems = async () => {
    try {
      const itemsSnapshot = await getDocs(collection(db, "items"));
      const itemsData = itemsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAvailableItems(itemsData);
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

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

  const handleItemChange = (index, field, value) => {
    if (field === "quantity" || field === "unitPrice") {
      value = value.replace(/[^0-9.]/g, "");
    }

    const updatedItems = [...items];
    updatedItems[index][field] = value;

    // Auto-calculate total price
    if (field === "quantity" || field === "unitPrice") {
      const quantity = parseFloat(updatedItems[index].quantity) || 0;
      const unitPrice = parseFloat(updatedItems[index].unitPrice) || 0;
      updatedItems[index].totalPrice = quantity * unitPrice;
    }

    setItems(updatedItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        itemName: "",
        category: "",
        quantity: "",
        unitPrice: "",
        totalPrice: "",
      },
    ]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      const updatedItems = items.filter((_, i) => i !== index);
      setItems(updatedItems);
    }
  };

  const handleAddNewItem = async () => {
    if (!newItem.name.trim()) {
      setErrorMessage("Item name is required");
      setShowError(true);
      return;
    }

    try {
      const itemDocRef = doc(collection(db, "items"));
      const itemData = {
        itemId: itemDocRef.id,
        name: newItem.name.trim(),
        category: newItem.category,
        description: newItem.description.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
      };

      await setDoc(itemDocRef, itemData);

      setAvailableItems((prev) => [
        ...prev,
        { id: itemDocRef.id, ...itemData },
      ]);
      setNewItem({ name: "", category: "", description: "" });
      setShowItemForm(false);

      setSuccessMessage("Item added successfully!");
      setShowSuccess(true);
    } catch (error) {
      console.error("Error adding item:", error);
      setErrorMessage("Failed to add item. Please try again.");
      setShowError(true);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.supplierId)
      newErrors.supplierId = "Supplier selection is required";
    if (!formData.purchaseDate)
      newErrors.purchaseDate = "Purchase date is required";
    if (!formData.paymentMethod)
      newErrors.paymentMethod = "Payment method is required";

    // Validate items
    const validItems = items.filter(
      (item) =>
        item.itemName.trim() && item.quantity.trim() && item.unitPrice.trim()
    );

    if (validItems.length === 0) {
      newErrors.items =
        "Please add at least one item with name, quantity, and price";
    }

    // Validate individual items
    items.forEach((item, index) => {
      if (item.itemName && (!item.quantity || !item.unitPrice)) {
        newErrors[`item_${index}`] =
          "Quantity and unit price are required for all items";
      }
    });

    if (formData.purchaseDate && new Date(formData.purchaseDate) > new Date()) {
      newErrors.purchaseDate = "Purchase date cannot be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTotalAmount = () => {
    return items.reduce((sum, item) => {
      const total = parseFloat(item.totalPrice) || 0;
      return sum + total;
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
        materialId = editMaterial.materialId || editMaterial.id;
        materialDocRef = doc(db, "materials", materialId);
      } else {
        materialDocRef = doc(collection(db, "materials"));
        materialId = materialDocRef.id;
      }

      // Get supplier name
      const supplier = suppliers.find((s) => s.id === formData.supplierId);

      // Filter valid items
      const validItems = items
        .filter(
          (item) =>
            item.itemName.trim() &&
            item.quantity.trim() &&
            item.unitPrice.trim()
        )
        .map((item) => ({
          itemName: item.itemName.trim(),
          category: item.category,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unitPrice),
          totalPrice: parseFloat(item.totalPrice),
        }));

      const materialData = cleanData({
        ...(isEditMode ? {} : { materialId: materialId }),
        supplierId: formData.supplierId,
        supplierName: supplier?.name || "Unknown Supplier",
        purchaseDate: formData.purchaseDate,
        items: validItems,
        totalAmount: calculateTotalAmount(),
        paymentMethod: formData.paymentMethod,
        invoiceNumber: formData.invoiceNumber.trim(),
        notes: formData.notes.trim(),

        // System fields
        ...(isEditMode
          ? {}
          : { createdAt: serverTimestamp(), createdBy: currentUser.userId }),
        updatedAt: serverTimestamp(),
        ...(isEditMode ? { updatedBy: currentUser.userId } : {}),
      });

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
            ? `Material purchase record was updated (${validItems.length} items)`
            : `New material purchase record was added (${validItems.length} items)`,
          performedBy: currentUser.userId,
          targetMaterialId: materialId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        isEditMode
          ? `Material record has been successfully updated!`
          : `Material record has been successfully added with ID: ${materialId}`
      );
      setShowSuccess(true);

      // Reset form and reload materials
      if (!isEditMode) {
        setFormData({
          supplierId: "",
          purchaseDate: "",
          paymentMethod: "",
          invoiceNumber: "",
          notes: "",
        });
        setItems([
          {
            itemName: "",
            category: "",
            quantity: "",
            unitPrice: "",
            totalPrice: "",
          },
        ]);
      } else {
        setTimeout(() => {
          setShowForm(false);
        }, 1500);
      }

      await loadMaterials();
    } catch (error) {
      console.error("Error managing material:", error);

      let errorMsg = `Failed to ${
        isEditMode ? "update" : "add"
      } material record. Please try again.`;

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

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find((s) => s.id === supplierId);
    return supplier?.name || "Unknown Supplier";
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
                Material Management
              </h1>
              <p className="text-gray-600 mt-1">
                Track purchases and inventory from suppliers
              </p>
            </div>
            <div className="mt-4 sm:mt-0 space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowItemForm(!showItemForm)}
              >
                {showItemForm ? "Cancel" : "Add Item Type"}
              </Button>
              <Button
                variant={showForm ? "outline" : "primary"}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "View Records" : "Add Purchase"}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {materials.length}
              </div>
              <div className="text-sm text-blue-800">Total Purchases</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  materials.reduce(
                    (sum, material) => sum + (material.totalAmount || 0),
                    0
                  )
                )}
              </div>
              <div className="text-sm text-green-800">Total Value</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {suppliers.length}
              </div>
              <div className="text-sm text-purple-800">Active Suppliers</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {availableItems.length}
              </div>
              <div className="text-sm text-orange-800">Item Types</div>
            </div>
          </div>
        </div>

        {/* Add Item Form */}
        {showItemForm && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Add New Item Type
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InputField
                label="Item Name"
                type="text"
                placeholder="Enter item name"
                value={newItem.name}
                onChange={(e) =>
                  setNewItem((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newItem.category}
                  onChange={(e) =>
                    setNewItem((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  {itemCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <InputField
                label="Description"
                type="text"
                placeholder="Enter description (optional)"
                value={newItem.description}
                onChange={(e) =>
                  setNewItem((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex justify-end space-x-3 mt-4">
              <Button variant="outline" onClick={() => setShowItemForm(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNewItem}>Add Item</Button>
            </div>
          </div>
        )}

        {showForm ? (
          /* Add/Edit Material Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditMode
                  ? "Edit Material Purchase"
                  : "Add Material Purchase"}
              </h2>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update purchase details"
                  : "Record a new material purchase from supplier"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Purchase Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Purchase Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.supplierId}
                      onChange={handleInputChange("supplierId")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} - {supplier.supplierNumber}
                        </option>
                      ))}
                    </select>
                    {errors.supplierId && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.supplierId}
                      </p>
                    )}
                  </div>

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
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={handleInputChange("paymentMethod")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select payment method</option>
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                    {errors.paymentMethod && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.paymentMethod}
                      </p>
                    )}
                  </div>

                  <InputField
                    label="Invoice Number"
                    type="text"
                    placeholder="Enter invoice number"
                    value={formData.invoiceNumber}
                    onChange={handleInputChange("invoiceNumber")}
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Items Purchased
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                  >
                    Add Item
                  </Button>
                </div>

                {errors.items && (
                  <p className="text-sm text-red-600 mb-4">{errors.items}</p>
                )}

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="border border-gray-100 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Item Name <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={item.itemName}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "itemName",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select item</option>
                            {availableItems.map((availableItem) => (
                              <option
                                key={availableItem.id}
                                value={availableItem.name}
                              >
                                {availableItem.name} ({availableItem.category})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category
                          </label>
                          <select
                            value={item.category}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "category",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select category</option>
                            {itemCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>

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

                        <InputField
                          label="Unit Price"
                          type="number"
                          placeholder="Enter unit price"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(index, "unitPrice", e.target.value)
                          }
                          step="0.01"
                          required
                        />

                        <div className="flex items-end space-x-2">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Total
                            </label>
                            <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg font-medium text-gray-900">
                              {formatCurrency(item.totalPrice || 0)}
                            </div>
                          </div>
                          {items.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeItem(index)}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                      {errors[`item_${index}`] && (
                        <p className="text-sm text-red-600 mt-2">
                          {errors[`item_${index}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-green-50 rounded-lg">
                  <p className="text-lg font-bold text-green-900">
                    Total Purchase Amount:{" "}
                    {formatCurrency(calculateTotalAmount())}
                  </p>
                </div>
              </div>

              {/* Additional Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Additional Information
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={handleInputChange("notes")}
                    placeholder="Enter any additional notes..."
                    rows={4}
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
                  {loading
                    ? isEditMode
                      ? "Updating..."
                      : "Adding..."
                    : isEditMode
                    ? "Update Purchase"
                    : "Add Purchase"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Materials List */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search materials..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Payment Methods</option>
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Materials Table */}
            {filteredMaterials.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">📦</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No material purchases found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm ||
                  filterSupplier !== "all" ||
                  filterPayment !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by adding your first material purchase"}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  Add First Purchase
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
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Items
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Payment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredMaterials.map((material) => (
                      <tr
                        key={material.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(material.purchaseDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {material.supplierName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {material.items?.length || 0} items
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              material.paymentMethod === "Cash"
                                ? "bg-green-100 text-green-800"
                                : material.paymentMethod === "Credit"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {material.paymentMethod}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(material.totalAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewMaterial(material)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                setFormData({
                                  supplierId: material.supplierId,
                                  purchaseDate: material.purchaseDate,
                                  paymentMethod: material.paymentMethod,
                                  invoiceNumber: material.invoiceNumber || "",
                                  notes: material.notes || "",
                                });
                                if (material.items) {
                                  setItems(material.items);
                                }
                                setShowForm(true);
                              }}
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

        {/* View Material Modal */}
        {showModal && selectedMaterial && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Purchase Details
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
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Supplier:</span>
                    <p className="text-gray-900">
                      {selectedMaterial.supplierName}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Purchase Date:
                    </span>
                    <p className="text-gray-900">
                      {formatDate(selectedMaterial.purchaseDate)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Payment Method:
                    </span>
                    <p className="text-gray-900">
                      {selectedMaterial.paymentMethod}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Invoice Number:
                    </span>
                    <p className="text-gray-900">
                      {selectedMaterial.invoiceNumber || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Items List */}
                {selectedMaterial.items &&
                  selectedMaterial.items.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-3">
                        Items Purchased:
                      </h3>
                      <div className="bg-gray-50 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="text-left py-3 px-4">Item Name</th>
                              <th className="text-left py-3 px-4">Category</th>
                              <th className="text-right py-3 px-4">Quantity</th>
                              <th className="text-right py-3 px-4">
                                Unit Price
                              </th>
                              <th className="text-right py-3 px-4">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedMaterial.items.map((item, index) => (
                              <tr key={index}>
                                <td className="py-3 px-4 font-medium">
                                  {item.itemName}
                                </td>
                                <td className="py-3 px-4">
                                  {item.category || "N/A"}
                                </td>
                                <td className="text-right py-3 px-4">
                                  {item.quantity}
                                </td>
                                <td className="text-right py-3 px-4">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="text-right py-3 px-4 font-medium">
                                  {formatCurrency(item.totalPrice)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Total Amount */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-medium text-gray-700">
                      Total Purchase Amount:
                    </span>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(selectedMaterial.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {selectedMaterial.notes && (
                  <div>
                    <span className="font-medium text-gray-700">Notes:</span>
                    <p className="text-gray-900 mt-1">
                      {selectedMaterial.notes}
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
          title={isEditMode ? "Purchase Updated!" : "Purchase Added!"}
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

export default Material;
