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
} from "firebase/firestore";
import { db } from "../../../../services/firebase";
import { useUser } from "../../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../../ui/InputField";
import Button from "../../../ui/Button";
import SuccessDialog from "../../../ui/SuccessDialog";
import FailDialog from "../../../ui/FailDialog";

const MaterialIssue = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    issueDate: new Date().toISOString().split("T")[0],
    purpose: "",
    issuedTo: "",
    department: "",
    notes: "",
  });

  // Items to issue
  const [issueItems, setIssueItems] = useState([
    {
      materialId: "",
      materialName: "",
      category: "",
      availableStock: 0,
      requestedQuantity: "",
      unit: "pcs",
    },
  ]);

  // Component state
  const [availableMaterials, setAvailableMaterials] = useState([]);
  const [materialStock, setMaterialStock] = useState({});
  const [issues, setIssues] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // View state
  const [showForm, setShowForm] = useState(false);

  const departments = [
    "Production",
    "Quality Control",
    "Maintenance",
    "R&D",
    "Office Administration",
    "Warehouse",
    "Other",
  ];

  const purposeOptions = [
    "Production Order",
    "Maintenance Work",
    "Quality Testing",
    "Research & Development",
    "Office Use",
    "Emergency Repair",
    "Training",
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
      loadAvailableMaterials();
      loadMaterialIssues();
    }
  }, [currentUser]);

  const loadAvailableMaterials = async () => {
    try {
      // Get all material purchases
      const materialsQuery = query(
        collection(db, "materials"),
        orderBy("purchaseDate", "desc")
      );
      const materialsSnapshot = await getDocs(materialsQuery);

      // Flatten all items from all purchases
      const allItems = [];
      materialsSnapshot.docs.forEach((doc) => {
        const materialData = doc.data();
        if (materialData.items) {
          materialData.items.forEach((item) => {
            const existingItem = allItems.find(
              (existing) =>
                existing.itemName === item.itemName &&
                existing.category === item.category
            );

            if (existingItem) {
              existingItem.totalPurchased += item.quantity;
            } else {
              allItems.push({
                id: `${item.itemName}_${item.category}`.replace(/\s+/g, "_"),
                itemName: item.itemName,
                category: item.category,
                totalPurchased: item.quantity,
                unit: "pcs", // Default unit, can be enhanced later
              });
            }
          });
        }
      });

      setAvailableMaterials(allItems);
    } catch (error) {
      console.error("Error loading materials:", error);
      setErrorMessage("Failed to load available materials.");
      setShowError(true);
    }
  };

  const loadMaterialIssues = async () => {
    try {
      const issuesQuery = query(
        collection(db, "materialIssues"),
        orderBy("issueDate", "desc")
      );
      const issuesSnapshot = await getDocs(issuesQuery);
      const issuesData = issuesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setIssues(issuesData);
    } catch (error) {
      console.error("Error loading material issues:", error);
    }
  };

  const calculateMaterialStock = useCallback(async () => {
    try {
      // Calculate issued quantities
      const issuesQuery = query(collection(db, "materialIssues"));
      const issuesSnapshot = await getDocs(issuesQuery);

      const issuedQuantities = {};

      issuesSnapshot.docs.forEach((doc) => {
        const issueData = doc.data();
        if (issueData.items) {
          issueData.items.forEach((item) => {
            const key = `${item.materialName}_${item.category}`.replace(
              /\s+/g,
              "_"
            );
            if (!issuedQuantities[key]) {
              issuedQuantities[key] = 0;
            }
            issuedQuantities[key] += item.requestedQuantity || 0;
          });
        }
      });

      // Calculate current stock
      const stockLevels = {};
      availableMaterials.forEach((material) => {
        const key = material.id;
        const totalPurchased = material.totalPurchased || 0;
        const totalIssued = issuedQuantities[key] || 0;

        stockLevels[key] = {
          available: Math.max(0, totalPurchased - totalIssued),
          totalPurchased,
          totalIssued,
          itemName: material.itemName,
          category: material.category,
          unit: material.unit,
        };
      });

      setMaterialStock(stockLevels);
    } catch (error) {
      console.error("Error calculating stock:", error);
    }
  }, [availableMaterials]);

  // Calculate stock levels
  useEffect(() => {
    calculateMaterialStock();
  }, [availableMaterials, calculateMaterialStock]);
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

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...issueItems];
    updatedItems[index][field] = value;

    // Auto-populate material details when material is selected
    if (field === "materialId" && value) {
      const selectedMaterial = availableMaterials.find((m) => m.id === value);
      const stock = materialStock[value];

      if (selectedMaterial && stock) {
        updatedItems[index].materialName = selectedMaterial.itemName;
        updatedItems[index].category = selectedMaterial.category;
        updatedItems[index].availableStock = stock.available;
        updatedItems[index].unit = selectedMaterial.unit;
      }
    }

    // Validate quantity doesn't exceed available stock
    if (field === "requestedQuantity") {
      const quantity = parseFloat(value) || 0;
      const available = updatedItems[index].availableStock || 0;

      if (quantity > available) {
        setErrors((prev) => ({
          ...prev,
          [`item_${index}_quantity`]: `Only ${available} units available in stock`,
        }));
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[`item_${index}_quantity`];
          return newErrors;
        });
      }
    }

    setIssueItems(updatedItems);
  };

  const addIssueItem = () => {
    setIssueItems((prev) => [
      ...prev,
      {
        materialId: "",
        materialName: "",
        category: "",
        availableStock: 0,
        requestedQuantity: "",
        unit: "pcs",
      },
    ]);
  };

  const removeIssueItem = (index) => {
    if (issueItems.length > 1) {
      setIssueItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Basic form validation
    if (!formData.issueDate) newErrors.issueDate = "Issue date is required";
    if (!formData.purpose.trim()) newErrors.purpose = "Purpose is required";
    if (!formData.issuedTo.trim())
      newErrors.issuedTo = "Issued to field is required";
    if (!formData.department) newErrors.department = "Department is required";

    // Validate items
    const validItems = issueItems.filter(
      (item) =>
        item.materialId &&
        item.requestedQuantity &&
        parseFloat(item.requestedQuantity) > 0
    );

    if (validItems.length === 0) {
      newErrors.items = "Please add at least one material with valid quantity";
    }

    // Validate each item
    issueItems.forEach((item, index) => {
      if (item.materialId && !item.requestedQuantity) {
        newErrors[`item_${index}`] = "Quantity is required";
      }

      if (item.requestedQuantity) {
        const quantity = parseFloat(item.requestedQuantity);
        const available = item.availableStock || 0;

        if (quantity <= 0) {
          newErrors[`item_${index}`] = "Quantity must be greater than 0";
        } else if (quantity > available) {
          newErrors[`item_${index}`] = `Only ${available} units available`;
        }
      }
    });

    if (formData.issueDate && new Date(formData.issueDate) > new Date()) {
      newErrors.issueDate = "Issue date cannot be in the future";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage(
        "You must be logged in to issue materials. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const issueDocRef = doc(collection(db, "materialIssues"));
      const issueId = issueDocRef.id;

      // Filter valid items
      const validItems = issueItems
        .filter(
          (item) =>
            item.materialId &&
            item.requestedQuantity &&
            parseFloat(item.requestedQuantity) > 0
        )
        .map((item) => ({
          materialId: item.materialId,
          materialName: item.materialName,
          category: item.category,
          requestedQuantity: parseFloat(item.requestedQuantity),
          unit: item.unit,
          availableStock: item.availableStock,
        }));

      const issueData = {
        issueId: issueId,
        issueDate: formData.issueDate,
        purpose: formData.purpose.trim(),
        issuedTo: formData.issuedTo.trim(),
        department: formData.department,
        items: validItems,
        totalItems: validItems.length,
        notes: formData.notes.trim(),
        status: "completed",

        // System fields
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      };

      await setDoc(issueDocRef, issueData);

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: "material_issued",
          description: `Materials issued to ${formData.issuedTo} for ${formData.purpose} (${validItems.length} items)`,
          performedBy: currentUser.userId,
          targetIssueId: issueId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        `Materials successfully issued to ${formData.issuedTo}! Issue ID: ${issueId}`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        issueDate: new Date().toISOString().split("T")[0],
        purpose: "",
        issuedTo: "",
        department: "",
        notes: "",
      });
      setIssueItems([
        {
          materialId: "",
          materialName: "",
          category: "",
          availableStock: 0,
          requestedQuantity: "",
          unit: "pcs",
        },
      ]);

      // Reload data
      await loadMaterialIssues();
      await calculateMaterialStock();
    } catch (error) {
      console.error("Error issuing materials:", error);
      let errorMsg = "Failed to issue materials. Please try again.";

      if (error.code === "permission-denied") {
        errorMsg = "You don't have permission to issue materials.";
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStockStatus = (available, total) => {
    const percentage = total > 0 ? (available / total) * 100 : 0;
    if (percentage === 0)
      return { status: "out", color: "bg-red-100 text-red-800" };
    if (percentage < 20)
      return { status: "low", color: "bg-orange-100 text-orange-800" };
    if (percentage < 50)
      return { status: "medium", color: "bg-yellow-100 text-yellow-800" };
    return { status: "good", color: "bg-green-100 text-green-800" };
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
                Material Issue
              </h1>
              <p className="text-gray-600 mt-1">
                Issue materials from inventory to departments
              </p>
            </div>
            <div className="mt-4 sm:mt-0 space-x-3">
              <Button
                variant={showForm ? "outline" : "primary"}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "View Issues" : "Issue Materials"}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {Object.keys(materialStock).length}
              </div>
              <div className="text-sm text-blue-800">Material Types</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {
                  Object.values(materialStock).filter(
                    (stock) => stock.available > 0
                  ).length
                }
              </div>
              <div className="text-sm text-green-800">In Stock</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {
                  Object.values(materialStock).filter((stock) => {
                    const percentage =
                      stock.totalPurchased > 0
                        ? (stock.available / stock.totalPurchased) * 100
                        : 0;
                    return percentage < 20 && percentage > 0;
                  }).length
                }
              </div>
              <div className="text-sm text-orange-800">Low Stock</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">
                {issues.length}
              </div>
              <div className="text-sm text-red-800">Total Issues</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Issue Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Issue Materials
              </h2>
              <p className="text-gray-600">
                Select materials and quantities to issue to departments
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Issue Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Issue Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Issue Date"
                    type="date"
                    value={formData.issueDate}
                    onChange={handleInputChange("issueDate")}
                    error={errors.issueDate}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purpose <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.purpose}
                      onChange={handleInputChange("purpose")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select purpose</option>
                      {purposeOptions.map((purpose) => (
                        <option key={purpose} value={purpose}>
                          {purpose}
                        </option>
                      ))}
                    </select>
                    {errors.purpose && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.purpose}
                      </p>
                    )}
                  </div>

                  <InputField
                    label="Issued To"
                    type="text"
                    placeholder="Enter recipient name"
                    value={formData.issuedTo}
                    onChange={handleInputChange("issuedTo")}
                    error={errors.issuedTo}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.department}
                      onChange={handleInputChange("department")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select department</option>
                      {departments.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    {errors.department && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.department}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Materials Selection */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Materials to Issue
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addIssueItem}
                  >
                    Add Material
                  </Button>
                </div>

                {errors.items && (
                  <p className="text-sm text-red-600 mb-4">{errors.items}</p>
                )}

                <div className="space-y-4">
                  {issueItems.map((item, index) => (
                    <div
                      key={index}
                      className="border border-gray-100 rounded-lg p-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Material <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={item.materialId}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "materialId",
                                e.target.value
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select material</option>
                            {availableMaterials.map((material) => {
                              const stock = materialStock[material.id];
                              const available = stock?.available || 0;
                              return (
                                <option
                                  key={material.id}
                                  value={material.id}
                                  disabled={available === 0}
                                >
                                  {material.itemName} ({material.category}) -
                                  Available: {available}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div>
                          <InputField
                            label="Quantity"
                            type="number"
                            placeholder="Enter quantity"
                            value={item.requestedQuantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "requestedQuantity",
                                e.target.value
                              )
                            }
                            step="0.01"
                          />
                          {item.availableStock > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Available: {item.availableStock} {item.unit}
                            </p>
                          )}
                        </div>

                        <div className="flex items-end">
                          {issueItems.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeIssueItem(index)}
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>

                      {(errors[`item_${index}`] ||
                        errors[`item_${index}_quantity`]) && (
                        <p className="text-sm text-red-600 mt-2">
                          {errors[`item_${index}`] ||
                            errors[`item_${index}_quantity`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
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
                  {loading ? "Issuing Materials..." : "Issue Materials"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Material Stock & Issues List */
          <div className="space-y-6">
            {/* Material Stock Overview */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  Current Material Stock
                </h3>
                <p className="text-gray-600">
                  Available materials in inventory
                </p>
              </div>

              {Object.keys(materialStock).length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 text-4xl mb-4">📦</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No materials in stock
                  </h3>
                  <p className="text-gray-600">
                    Purchase materials first to see them here
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Material
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Available
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total Purchased
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Total Issued
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {Object.entries(materialStock).map(([key, stock]) => {
                        const stockStatus = getStockStatus(
                          stock.available,
                          stock.totalPurchased
                        );
                        return (
                          <tr
                            key={key}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {stock.itemName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {stock.category}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <span className="font-medium">
                                {stock.available}
                              </span>{" "}
                              {stock.unit}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {stock.totalPurchased}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {stock.totalIssued}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${stockStatus.color}`}
                              >
                                {stockStatus.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Issues */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-xl font-bold text-gray-900">
                  Recent Material Issues
                </h3>
                <p className="text-gray-600">Latest material issue records</p>
              </div>

              {issues.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 text-4xl mb-4">📋</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No issues recorded
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Start issuing materials to see records here
                  </p>
                  <Button onClick={() => setShowForm(true)}>
                    Issue First Materials
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
                          Issued To
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Department
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Purpose
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Items
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {issues.slice(0, 10).map((issue) => (
                        <tr
                          key={issue.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(issue.issueDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {issue.issuedTo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {issue.department}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {issue.purpose}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              {issue.totalItems} items
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              {issue.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Dialog */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="Materials Issued Successfully!"
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

export default MaterialIssue;
