import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../../services/firebase";
import { useUser } from "../../../../contexts/userContext";
import {
  Store,
  MapPin,
  Phone,
  Save,
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";

const AddingOutlets = () => {
  const { user } = useUser();

  // Form state
  const [formData, setFormData] = useState({
    outletName: "",
    telephoneNumber: "",
    address: "",
    rent: "",
    notes: "",
  });

  // Component state
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [errors, setErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOutlets, setFilteredOutlets] = useState([]);
  const [editingOutlet, setEditingOutlet] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Load outlets on component mount
  useEffect(() => {
    if (user) {
      loadOutlets();
    }
  }, [user]);

  // Filter outlets based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOutlets(outlets);
    } else {
      const filtered = outlets.filter(
        (outlet) =>
          outlet.outletName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          outlet.telephoneNumber?.includes(searchTerm) ||
          outlet.address?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOutlets(filtered);
    }
  }, [outlets, searchTerm]);

  // Load outlets from Firebase
  const loadOutlets = async () => {
    try {
      setFetchingData(true);
      const outletsQuery = query(
        collection(db, "outlets"),
        orderBy("outletName", "asc")
      );
      const outletsSnapshot = await getDocs(outletsQuery);
      const outletsData = outletsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log(outletsData);
      setOutlets(outletsData);
    } catch (error) {
      console.error("Error loading outlets:", error);
      toast.error("Failed to load outlets");
    } finally {
      setFetchingData(false);
    }
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear errors when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Telephone number is required
    if (!formData.telephoneNumber.trim()) {
      newErrors.telephoneNumber = "Telephone number is required";
    }

    // Phone validation
    if (
      formData.telephoneNumber &&
      !/^\+?[\d\s\-\(\)]+$/.test(formData.telephoneNumber)
    ) {
      newErrors.telephoneNumber = "Please enter a valid telephone number";
    }

    // Rent validation
    if (formData.rent && isNaN(parseFloat(formData.rent))) {
      newErrors.rent = "Rent must be a valid number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!user?.uid && !user?.userId) {
      toast.error("You must be logged in to add outlets");
      return;
    }

    setLoading(true);

    try {
      const userId = user.uid || user.userId;
      const outletData = {
        ...formData,
        rent: formData.rent ? parseFloat(formData.rent) : null,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
      };

      if (editingOutlet) {
        // Update existing outlet
        const outletRef = doc(db, "outlets", editingOutlet.id);
        await updateDoc(outletRef, {
          ...outletData,
          createdAt: editingOutlet.createdAt, // Keep original creation date
          updatedBy: userId,
        });
        toast.success("Outlet updated successfully!");
      } else {
        // Add new outlet
        await addDoc(collection(db, "outlets"), outletData);
        toast.success("Outlet added successfully!");
      }

      // Reset form and reload data
      resetForm();
      await loadOutlets();
    } catch (error) {
      console.error("Error saving outlet:", error);
      toast.error("Failed to save outlet. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      outletName: "",
      telephoneNumber: "",
      address: "",
      rent: "",
      notes: "",
    });
    setErrors({});
    setEditingOutlet(null);
    setShowForm(false);
  };

  // Edit outlet
  const handleEdit = (outlet) => {
    setFormData({
      outletName: outlet.outletName || "",
      telephoneNumber: outlet.telephoneNumber || "",
      address: outlet.address || "",
      rent: outlet.rent?.toString() || "",
      notes: outlet.notes || "",
    });
    setEditingOutlet(outlet);
    setShowForm(true);
  };

  // Delete outlet
  const handleDelete = async (outletId) => {
    if (!window.confirm("Are you sure you want to delete this outlet?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "outlets", outletId));
      toast.success("Outlet deleted successfully!");
      await loadOutlets();
    } catch (error) {
      console.error("Error deleting outlet:", error);
      toast.error("Failed to delete outlet");
    }
  };

  // View outlet details
  const handleViewDetails = (outlet) => {
    setSelectedOutlet(outlet);
    setShowModal(true);
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (fetchingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
            <span className="text-gray-600">Loading outlets...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Store className="h-6 w-6 text-blue-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Food Outlets
                </h1>
              </div>
              <p className="text-gray-600">
                Manage your food product outlet information
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={() => {
                  if (showForm) {
                    resetForm();
                  } else {
                    setShowForm(true);
                  }
                }}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  showForm
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {showForm ? (
                  <>
                    <X className="h-5 w-5" />
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5" />
                    <span>Add New Outlet</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {outlets.length}
              </div>
              <div className="text-sm text-blue-800">Total Outlets</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {outlets.filter((o) => o.status === "active").length}
              </div>
              <div className="text-sm text-green-800">Active Outlets</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {outlets.filter((o) => o.rent).length}
              </div>
              <div className="text-sm text-purple-800">With Rent Info</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(
                  outlets.reduce((sum, o) => sum + (o.rent || 0), 0)
                )}
              </div>
              <div className="text-sm text-orange-800">Total Rent</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Add/Edit Outlet Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {editingOutlet ? "Edit Outlet" : "Add New Outlet"}
              </h2>
              <p className="text-gray-600">
                {editingOutlet
                  ? "Update the outlet information"
                  : "Fill in the outlet details"}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6 max-w-2xl mx-auto"
            >
              {/* Outlet Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Outlet Name <span className="text-gray-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={formData.outletName}
                  onChange={(e) =>
                    handleInputChange("outletName", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter outlet name"
                />
              </div>

              {/* Telephone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telephone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.telephoneNumber}
                  onChange={(e) =>
                    handleInputChange("telephoneNumber", e.target.value)
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter telephone number"
                />
                {errors.telephoneNumber && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.telephoneNumber}
                  </p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter outlet address"
                />
              </div>

              {/* Rent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Monthly Rent
                </label>
                <input
                  type="number"
                  value={formData.rent}
                  onChange={(e) => handleInputChange("rent", e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter monthly rent amount"
                  min="0"
                  step="0.01"
                />
                {errors.rent && (
                  <p className="text-sm text-red-600 mt-1">{errors.rent}</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Enter any additional notes..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-medium transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{editingOutlet ? "Updating..." : "Adding..."}</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      <span>
                        {editingOutlet ? "Update Outlet" : "Add Outlet"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Outlets List */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Search Bar */}
            <div className="p-6 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search outlets by name, telephone, or address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Outlets Table */}
            {filteredOutlets.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">🏪</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No outlets found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm
                    ? "Try adjusting your search terms"
                    : "Get started by adding your first outlet"}
                </p>
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors mx-auto"
                >
                  <Plus className="h-5 w-5" />
                  <span>Add First Outlet</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Outlet Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Monthly Rent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOutlets.map((outlet) => (
                      <tr
                        key={outlet.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {outlet.outletName || "Unnamed Outlet"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {outlet.telephoneNumber}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 flex items-start">
                            <MapPin className="h-4 w-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>{outlet.address || "No address provided"}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(outlet.rent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewDetails(outlet)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleEdit(outlet)}
                              className="text-indigo-600 hover:text-indigo-900 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(outlet.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                            >
                              Delete
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

        {/* View Outlet Modal */}
        {showModal && selectedOutlet && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Outlet Details
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-400 hover:text-gray-600 p-2"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <span className="font-medium text-gray-700">
                    Outlet Name:
                  </span>
                  <p className="text-gray-900">
                    {selectedOutlet.outletName || "Unnamed Outlet"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Telephone Number:
                  </span>
                  <p className="text-gray-900">
                    {selectedOutlet.telephoneNumber}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Address:</span>
                  <p className="text-gray-900">
                    {selectedOutlet.address || "No address provided"}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Monthly Rent:
                  </span>
                  <p className="text-gray-900">
                    {formatCurrency(selectedOutlet.rent)}
                  </p>
                </div>
                {selectedOutlet.notes && (
                  <div>
                    <span className="font-medium text-gray-700">Notes:</span>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-lg mt-1">
                      {selectedOutlet.notes}
                    </p>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      handleEdit(selectedOutlet);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit Outlet</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddingOutlets;
