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

const AddingSuppliers = ({ editSupplier = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const isEditMode = !!editSupplier;

  // Form state
  const [formData, setFormData] = useState({
    supplierName: "",
    phoneNumber: "",
    email: "",
    address: "",
    supplierNumber: "",
    joinedDate: "",
    contactPerson: "",
    businessType: "",
    paymentTerms: "",
    taxId: "",
    website: "",
    notes: "",
  });

  // Component state
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
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
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const businessTypes = [
    "Manufacturer",
    "Distributor",
    "Retailer",
    "Service Provider",
    "Parts Supplier",
    "Fuel Station",
    "Insurance Company",
    "Other",
  ];

  const paymentTermsOptions = [
    "Net 30",
    "Net 15",
    "Net 7",
    "Cash on Delivery",
    "Prepayment",
    "2/10 Net 30",
    "Other",
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load suppliers
  useEffect(() => {
    if (currentUser) {
      loadSuppliers();
    }
  }, [currentUser]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editSupplier) {
      setFormData({
        supplierName: editSupplier.name || "",
        phoneNumber: editSupplier.phoneNumber || "",
        email: editSupplier.email || "",
        address: editSupplier.address || "",
        supplierNumber: editSupplier.supplierNumber || "",
        joinedDate: editSupplier.joinedDate || "",
        contactPerson: editSupplier.contactPerson || "",
        businessType: editSupplier.businessType || "",
        paymentTerms: editSupplier.paymentTerms || "",
        taxId: editSupplier.taxId || "",
        website: editSupplier.website || "",
        notes: editSupplier.notes || "",
      });
      setShowForm(true);
    }
  }, [editSupplier]);

  // Filter suppliers
  useEffect(() => {
    let filtered = suppliers;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (supplier) =>
          supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          supplier.supplierNumber
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          supplier.contactPerson
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          supplier.businessType
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Apply business type filter
    if (filterType !== "all") {
      filtered = filtered.filter(
        (supplier) => supplier.businessType === filterType
      );
    }

    setFilteredSuppliers(filtered);
  }, [suppliers, searchTerm, filterType]);

  const loadSuppliers = async () => {
    try {
      const suppliersQuery = query(
        collection(db, "suppliers"),
        orderBy("createdAt", "desc")
      );
      const suppliersSnapshot = await getDocs(suppliersQuery);
      const suppliersData = suppliersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Error loading suppliers:", error);
      setErrorMessage("Failed to load suppliers. Please try again.");
      setShowError(true);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "supplierNumber") {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    } else if (field === "phoneNumber") {
      value = value.replace(/[^0-9+\s-()]/g, "");
    } else if (field === "email") {
      value = value.toLowerCase();
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
    if (!formData.supplierName.trim())
      newErrors.supplierName = "Supplier name is required";
    if (!formData.phoneNumber.trim())
      newErrors.phoneNumber = "Phone number is required";
    // if (!formData.supplierNumber.trim())
    //   newErrors.supplierNumber = "Supplier number is required";

    // Email validation (optional but must be valid if provided)
    if (formData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = "Please enter a valid email address";
      }
    }

    // Phone number validation
    if (formData.phoneNumber && !/^\+?[\d\s-()]+$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Please enter a valid phone number";
    }

    // Website validation (optional but must be valid if provided)
    if (formData.website) {
      try {
        new URL(
          formData.website.startsWith("http")
            ? formData.website
            : `https://${formData.website}`
        );
      } catch {
        newErrors.website = "Please enter a valid website URL";
      }
    }

    // Date validation
    if (formData.joinedDate && new Date(formData.joinedDate) > new Date()) {
      newErrors.joinedDate = "Joined date cannot be in the future";
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
        "You must be logged in to manage suppliers. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      let supplierId;
      let supplierDocRef;

      if (isEditMode) {
        supplierId = editSupplier.supplierId || editSupplier.id;
        supplierDocRef = doc(db, "suppliers", supplierId);
      } else {
        supplierDocRef = doc(collection(db, "suppliers"));
        supplierId = supplierDocRef.id;
      }

      const supplierData = cleanData({
        ...(isEditMode ? {} : { supplierId: supplierId }),
        name: formData.supplierName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        supplierNumber: formData.supplierNumber.trim(),
        joinedDate: formData.joinedDate,
        contactPerson: formData.contactPerson.trim(),
        businessType: formData.businessType,
        paymentTerms: formData.paymentTerms,
        taxId: formData.taxId.trim(),
        website: formData.website.trim(),
        notes: formData.notes.trim(),

        // System fields
        ...(isEditMode
          ? {}
          : {
              isActive: true,
              createdAt: serverTimestamp(),
              createdBy: currentUser.userId,
            }),
        updatedAt: serverTimestamp(),
        ...(isEditMode ? { updatedBy: currentUser.userId } : {}),
      });

      if (isEditMode) {
        await updateDoc(supplierDocRef, supplierData);
      } else {
        await setDoc(supplierDocRef, supplierData);
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: isEditMode ? "supplier_updated" : "supplier_added",
          description: isEditMode
            ? `Supplier ${formData.supplierName} was updated`
            : `New supplier ${formData.supplierName} was added`,
          performedBy: currentUser.userId,
          targetSupplierId: supplierId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        isEditMode
          ? `Supplier ${formData.supplierName} has been successfully updated!`
          : `Supplier ${formData.supplierName} has been successfully registered with ID: ${supplierId}`
      );
      setShowSuccess(true);

      // Reset form and reload suppliers
      if (!isEditMode) {
        setFormData({
          supplierName: "",
          phoneNumber: "",
          email: "",
          address: "",
          supplierNumber: "",
          joinedDate: "",
          contactPerson: "",
          businessType: "",
          paymentTerms: "",
          taxId: "",
          website: "",
          notes: "",
        });
      } else {
        setTimeout(() => {
          setShowForm(false);
        }, 1500);
      }

      await loadSuppliers();
    } catch (error) {
      console.error("Error managing supplier:", error);

      let errorMsg = `Failed to ${
        isEditMode ? "update" : "register"
      } supplier. Please try again.`;

      if (error.code === "permission-denied") {
        errorMsg = `You don't have permission to ${
          isEditMode ? "update" : "add"
        } suppliers.`;
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      } else {
        errorMsg =
          error.message || "An unexpected error occurred. Please try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setShowModal(true);
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
                Supplier Management
              </h1>
              <p className="text-gray-600 mt-1">
                Manage and track all your suppliers
              </p>
            </div>
            <div className="mt-4 sm:mt-0 space-x-3">
              <Button
                variant={showForm ? "outline" : "primary"}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "View Suppliers" : "Add Supplier"}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {suppliers.length}
              </div>
              <div className="text-sm text-blue-800">Total Suppliers</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {suppliers.filter((s) => s.isActive !== false).length}
              </div>
              <div className="text-sm text-green-800">Active Suppliers</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {
                  suppliers.filter((s) => s.businessType === "Manufacturer")
                    .length
                }
              </div>
              <div className="text-sm text-purple-800">Manufacturers</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {
                  suppliers.filter((s) => s.businessType === "Service Provider")
                    .length
                }
              </div>
              <div className="text-sm text-orange-800">Service Providers</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Add/Edit Supplier Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditMode ? "Edit Supplier" : "Add New Supplier"}
              </h2>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update supplier information"
                  : "Register a new supplier with complete details"}
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
                    label="Supplier Name"
                    type="text"
                    placeholder="Enter supplier name"
                    value={formData.supplierName}
                    onChange={handleInputChange("supplierName")}
                    error={errors.supplierName}
                    required
                  />

                  <InputField
                    label="Supplier Number"
                    type="text"
                    placeholder="Enter supplier number/code"
                    value={formData.supplierNumber}
                    onChange={handleInputChange("supplierNumber")}
                    error={errors.supplierNumber}
                  />

                  <InputField
                    label="Phone Number"
                    type="tel"
                    placeholder="Enter phone number"
                    value={formData.phoneNumber}
                    onChange={handleInputChange("phoneNumber")}
                    error={errors.phoneNumber}
                    required
                  />

                  <InputField
                    label="Email"
                    type="email"
                    placeholder="Enter supplier email"
                    value={formData.email}
                    onChange={handleInputChange("email")}
                    error={errors.email}
                  />

                  <InputField
                    label="Contact Person"
                    type="text"
                    placeholder="Enter contact person name"
                    value={formData.contactPerson}
                    onChange={handleInputChange("contactPerson")}
                  />

                  <InputField
                    label="Joined Date"
                    type="date"
                    value={formData.joinedDate}
                    onChange={handleInputChange("joinedDate")}
                    error={errors.joinedDate}
                  />

                  <div className="md:col-span-2">
                    <InputField
                      label="Address"
                      type="text"
                      placeholder="Enter supplier address"
                      value={formData.address}
                      onChange={handleInputChange("address")}
                    />
                  </div>
                </div>
              </div>

              {/* Business Details */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Business Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type
                    </label>
                    <select
                      value={formData.businessType}
                      onChange={handleInputChange("businessType")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select business type</option>
                      {businessTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Terms
                    </label>
                    <select
                      value={formData.paymentTerms}
                      onChange={handleInputChange("paymentTerms")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select payment terms</option>
                      {paymentTermsOptions.map((term) => (
                        <option key={term} value={term}>
                          {term}
                        </option>
                      ))}
                    </select>
                  </div>

                  <InputField
                    label="Tax ID/Registration Number"
                    type="text"
                    placeholder="Enter tax ID or registration number"
                    value={formData.taxId}
                    onChange={handleInputChange("taxId")}
                  />

                  <InputField
                    label="Website"
                    type="url"
                    placeholder="Enter website URL"
                    value={formData.website}
                    onChange={handleInputChange("website")}
                    error={errors.website}
                  />
                </div>
              </div>

              {/* Additional Notes */}
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
                      ? "Updating Supplier..."
                      : "Registering Supplier..."
                    : isEditMode
                    ? "Update Supplier"
                    : "Register Supplier"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Suppliers List */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search suppliers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Business Types</option>
                  {businessTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Suppliers Table */}
            {filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">🏢</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No suppliers found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterType !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by adding your first supplier"}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  Add First Supplier
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Supplier
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Business Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Joined Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSuppliers.map((supplier) => (
                      <tr
                        key={supplier.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {supplier.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {supplier.supplierNumber}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {supplier.phoneNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {supplier.email || "No email"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {supplier.businessType || "Not specified"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(supplier.joinedDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewSupplier(supplier)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                setFormData({
                                  supplierName: supplier.name,
                                  phoneNumber: supplier.phoneNumber,
                                  email: supplier.email || "",
                                  address: supplier.address || "",
                                  supplierNumber: supplier.supplierNumber,
                                  joinedDate: supplier.joinedDate || "",
                                  contactPerson: supplier.contactPerson || "",
                                  businessType: supplier.businessType || "",
                                  paymentTerms: supplier.paymentTerms || "",
                                  taxId: supplier.taxId || "",
                                  website: supplier.website || "",
                                  notes: supplier.notes || "",
                                });
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

        {/* View Supplier Modal */}
        {showModal && selectedSupplier && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Supplier Details
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
                      Supplier Name:
                    </span>
                    <p className="text-gray-900">{selectedSupplier.name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Supplier Number:
                    </span>
                    <p className="text-gray-900">
                      {selectedSupplier.supplierNumber}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Phone:</span>
                    <p className="text-gray-900">
                      {selectedSupplier.phoneNumber}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <p className="text-gray-900">
                      {selectedSupplier.email || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Contact Person:
                    </span>
                    <p className="text-gray-900">
                      {selectedSupplier.contactPerson || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Business Type:
                    </span>
                    <p className="text-gray-900">
                      {selectedSupplier.businessType || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Payment Terms:
                    </span>
                    <p className="text-gray-900">
                      {selectedSupplier.paymentTerms || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Joined Date:
                    </span>
                    <p className="text-gray-900">
                      {formatDate(selectedSupplier.joinedDate)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">Address:</span>
                    <p className="text-gray-900">
                      {selectedSupplier.address || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tax ID:</span>
                    <p className="text-gray-900">
                      {selectedSupplier.taxId || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Website:</span>
                    {selectedSupplier.website ? (
                      <a
                        href={
                          selectedSupplier.website.startsWith("http")
                            ? selectedSupplier.website
                            : `https://${selectedSupplier.website}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {selectedSupplier.website}
                      </a>
                    ) : (
                      <p className="text-gray-900">N/A</p>
                    )}
                  </div>
                  {selectedSupplier.notes && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-700">Notes:</span>
                      <p className="text-gray-900">{selectedSupplier.notes}</p>
                    </div>
                  )}
                </div>
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
          title={isEditMode ? "Supplier Updated!" : "Supplier Registered!"}
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

export default AddingSuppliers;
