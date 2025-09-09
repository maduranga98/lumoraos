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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const ServicesAndRepairs = ({ editService = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const isEditMode = !!editService;

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: "",
    serviceDate: "",
    serviceType: "",
    description: "",
    odometerReading: "",
    serviceCenter: "",
    laborCharges: "",
    paymentMethod: "",
    invoiceNumber: "",
    nextServiceDate: "",
    nextServiceOdometer: "",
  });

  // Parts management
  const [parts, setParts] = useState([{ name: "", cost: "" }]);
  const [totalPartsValue, setTotalPartsValue] = useState(0);

  // Component state
  const [vehicles, setVehicles] = useState([]);
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
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
  const [filterVehicle, setFilterVehicle] = useState("all");
  const [selectedService, setSelectedService] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);

  const serviceTypes = [
    "Routine Service",
    "Engine Repair",
    "Tire Change",
    "Brake Repair",
    "Body Repair",
    "Oil Change",
    "Electrical Work",
    "Transmission Repair",
    "Air Conditioning",
    "Battery Replacement",
    "Other",
  ];

  const paymentMethods = [
    "Cash",
    "Bank Transfer",
    "Credit Card",
    "Debit Card",
    "Account",
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load vehicles and services
  useEffect(() => {
    if (currentUser) {
      loadVehicles();
      loadServices();
    }
  }, [currentUser]);

  // Pre-populate form when editing
  useEffect(() => {
    if (editService) {
      setFormData({
        vehicleId: editService.vehicleId || "",
        serviceDate: editService.serviceDate || "",
        serviceType: editService.serviceType || "",
        description: editService.description || "",
        odometerReading: editService.odometerReading?.toString() || "",
        serviceCenter: editService.serviceCenter || "",
        laborCharges: editService.laborCharges?.toString() || "",
        paymentMethod: editService.paymentMethod || "",
        invoiceNumber: editService.invoiceNumber || "",
        nextServiceDate: editService.nextServiceDate || "",
        nextServiceOdometer: editService.nextServiceOdometer?.toString() || "",
      });

      // Load parts data
      if (editService.partsReplaced && editService.partsReplaced.length > 0) {
        setParts(editService.partsReplaced);
      }

      setShowForm(true);
    }
  }, [editService]);

  // Calculate total parts value
  useEffect(() => {
    const total = parts.reduce((sum, part) => {
      const cost = parseFloat(part.cost) || 0;
      return sum + cost;
    }, 0);
    setTotalPartsValue(total);
  }, [parts]);

  // Filter services
  useEffect(() => {
    let filtered = services;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (service) =>
          service.description
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          service.serviceCenter
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          service.serviceType
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          service.invoiceNumber
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filtered = filtered.filter(
        (service) => service.serviceType === filterType
      );
    }

    // Apply vehicle filter
    if (filterVehicle !== "all") {
      filtered = filtered.filter(
        (service) => service.vehicleId === filterVehicle
      );
    }

    setFilteredServices(filtered);
  }, [services, searchTerm, filterType, filterVehicle]);

  const loadVehicles = async () => {
    try {
      const vehiclesSnapshot = await getDocs(collection(db, "vehicles"));
      const vehiclesData = vehiclesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVehicles(vehiclesData.filter((v) => v.isActive));
    } catch (error) {
      console.error("Error loading vehicles:", error);
    }
  };

  const loadServices = async () => {
    try {
      const servicesQuery = query(
        collection(db, "services"),
        orderBy("serviceDate", "desc")
      );
      const servicesSnapshot = await getDocs(servicesQuery);
      const servicesData = servicesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setServices(servicesData);
    } catch (error) {
      console.error("Error loading services:", error);
      setErrorMessage("Failed to load services. Please try again.");
      setShowError(true);
    }
  };

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (
      field === "laborCharges" ||
      field === "odometerReading" ||
      field === "nextServiceOdometer"
    ) {
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

  const handlePartChange = (index, field, value) => {
    if (field === "cost") {
      value = value.replace(/[^0-9.]/g, "");
    }

    const updatedParts = [...parts];
    updatedParts[index][field] = value;
    setParts(updatedParts);
  };

  const addPart = () => {
    setParts([...parts, { name: "", cost: "" }]);
  };

  const removePart = (index) => {
    if (parts.length > 1) {
      const updatedParts = parts.filter((_, i) => i !== index);
      setParts(updatedParts);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrorMessage("File size must be less than 5MB");
        setShowError(true);
        return;
      }
      // Check file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
      ];
      if (!allowedTypes.includes(file.type)) {
        setErrorMessage("Only JPG, PNG, and PDF files are allowed");
        setShowError(true);
        return;
      }
      setSelectedFile(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.vehicleId)
      newErrors.vehicleId = "Vehicle selection is required";
    if (!formData.serviceDate)
      newErrors.serviceDate = "Service date is required";
    if (!formData.serviceType)
      newErrors.serviceType = "Service type is required";
    if (!formData.description.trim())
      newErrors.description = "Description is required";
    if (!formData.odometerReading)
      newErrors.odometerReading = "Odometer reading is required";
    if (!formData.serviceCenter.trim())
      newErrors.serviceCenter = "Service center is required";

    // Validation rules
    if (
      formData.laborCharges &&
      (isNaN(formData.laborCharges) || parseFloat(formData.laborCharges) < 0)
    ) {
      newErrors.laborCharges = "Please enter a valid labor charges amount";
    }

    if (
      formData.odometerReading &&
      (isNaN(formData.odometerReading) ||
        parseFloat(formData.odometerReading) < 0)
    ) {
      newErrors.odometerReading = "Please enter a valid odometer reading";
    }

    if (
      formData.nextServiceOdometer &&
      (isNaN(formData.nextServiceOdometer) ||
        parseFloat(formData.nextServiceOdometer) < 0)
    ) {
      newErrors.nextServiceOdometer =
        "Please enter a valid next service odometer reading";
    }

    if (formData.serviceDate && new Date(formData.serviceDate) > new Date()) {
      newErrors.serviceDate = "Service date cannot be in the future";
    }

    // Validate parts
    const validParts = parts.filter(
      (part) => part.name.trim() && part.cost.trim()
    );
    if (validParts.length === 0) {
      newErrors.parts = "Please add at least one part with name and cost";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const uploadReceiptFile = async (file, serviceId) => {
    try {
      const fileExtension = file.name.split(".").pop();
      const fileName = `service_receipts/${serviceId}_${Date.now()}.${fileExtension}`;
      const storageRef = ref(storage, fileName);

      const uploadTask = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);

      return downloadURL;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error("Failed to upload receipt");
    }
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

  const calculateTotalCost = () => {
    const laborCost = parseFloat(formData.laborCharges) || 0;
    return totalPartsValue + laborCost;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage(
        "You must be logged in to manage services. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      let serviceId;
      let serviceDocRef;

      if (isEditMode) {
        serviceId = editService.serviceId || editService.id;
        serviceDocRef = doc(db, "services", serviceId);
      } else {
        serviceDocRef = doc(collection(db, "services"));
        serviceId = serviceDocRef.id;
      }

      // Upload receipt if selected
      let receiptURL = editService?.receiptURL || null;
      if (selectedFile) {
        receiptURL = await uploadReceiptFile(selectedFile, serviceId);
      }

      // Filter out empty parts
      const validParts = parts.filter(
        (part) => part.name.trim() && part.cost.trim()
      );

      const serviceData = cleanData({
        ...(isEditMode ? {} : { serviceId: serviceId }),
        vehicleId: formData.vehicleId,
        serviceDate: formData.serviceDate,
        serviceType: formData.serviceType,
        description: formData.description.trim(),
        odometerReading: parseFloat(formData.odometerReading),
        serviceCenter: formData.serviceCenter.trim(),
        partsReplaced: validParts.map((part) => ({
          name: part.name.trim(),
          cost: parseFloat(part.cost),
        })),
        laborCharges: formData.laborCharges
          ? parseFloat(formData.laborCharges)
          : 0,
        totalCost: calculateTotalCost(),
        paymentMethod: formData.paymentMethod,
        invoiceNumber: formData.invoiceNumber.trim(),
        nextServiceDate: formData.nextServiceDate,
        nextServiceOdometer: formData.nextServiceOdometer
          ? parseFloat(formData.nextServiceOdometer)
          : null,
        receiptURL: receiptURL,

        // System fields
        ...(isEditMode
          ? {}
          : { createdAt: serverTimestamp(), createdBy: currentUser.userId }),
        updatedAt: serverTimestamp(),
        ...(isEditMode ? { updatedBy: currentUser.userId } : {}),
      });

      if (isEditMode) {
        await updateDoc(serviceDocRef, serviceData);
      } else {
        await setDoc(serviceDocRef, serviceData);
      }

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: isEditMode ? "service_updated" : "service_added",
          description: isEditMode
            ? `Service record ${formData.description} was updated`
            : `New service record ${formData.description} was added`,
          performedBy: currentUser.userId,
          targetServiceId: serviceId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        isEditMode
          ? `Service record has been successfully updated!`
          : `Service record has been successfully added with ID: ${serviceId}`
      );
      setShowSuccess(true);

      // Reset form and reload services
      if (!isEditMode) {
        setFormData({
          vehicleId: "",
          serviceDate: "",
          serviceType: "",
          description: "",
          odometerReading: "",
          serviceCenter: "",
          laborCharges: "",
          paymentMethod: "",
          invoiceNumber: "",
          nextServiceDate: "",
          nextServiceOdometer: "",
        });
        setParts([{ name: "", cost: "" }]);
        setSelectedFile(null);
      } else {
        setTimeout(() => {
          setShowForm(false);
        }, 1500);
      }

      await loadServices();
    } catch (error) {
      console.error("Error managing service:", error);

      let errorMsg = `Failed to ${
        isEditMode ? "update" : "add"
      } service record. Please try again.`;

      if (error.message === "Failed to upload receipt") {
        errorMsg =
          "Failed to upload receipt. Please try again or proceed without receipt.";
      } else if (error.code === "permission-denied") {
        errorMsg = `You don't have permission to ${
          isEditMode ? "update" : "add"
        } services.`;
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection and try again.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleViewService = (service) => {
    setSelectedService(service);
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

  const getVehicleName = (vehicleId) => {
    const vehicle = vehicles.find(
      (v) => v.id === vehicleId || v.vehicleId === vehicleId
    );
    return vehicle
      ? `${vehicle.vehiclename} (${vehicle.vehiclenumber})`
      : "Unknown Vehicle";
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
                Vehicle Services & Repairs
              </h1>
              <p className="text-gray-600 mt-1">
                Track and manage all vehicle maintenance records
              </p>
            </div>
            <div className="mt-4 sm:mt-0 space-x-3">
              <Button
                variant={showForm ? "outline" : "primary"}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? "View Records" : "Add Service"}
              </Button>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {services.length}
              </div>
              <div className="text-sm text-blue-800">Total Services</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  services.reduce((sum, svc) => sum + (svc.totalCost || 0), 0)
                )}
              </div>
              <div className="text-sm text-green-800">Total Cost</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {
                  services.filter(
                    (svc) => svc.serviceType === "Routine Service"
                  ).length
                }
              </div>
              <div className="text-sm text-purple-800">Routine Services</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                {
                  services.filter(
                    (svc) => svc.serviceType !== "Routine Service"
                  ).length
                }
              </div>
              <div className="text-sm text-orange-800">Repairs</div>
            </div>
          </div>
        </div>

        {showForm ? (
          /* Add/Edit Service Form */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEditMode
                  ? "Edit Service Record"
                  : "Add Service/Repair Record"}
              </h2>
              <p className="text-gray-600">
                {isEditMode
                  ? "Update service details"
                  : "Record a new service or repair"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Basic Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Service Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.vehicleId}
                      onChange={handleInputChange("vehicleId")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select a vehicle</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.vehiclename} ({vehicle.vehiclenumber})
                        </option>
                      ))}
                    </select>
                    {errors.vehicleId && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.vehicleId}
                      </p>
                    )}
                  </div>

                  <InputField
                    label="Service Date"
                    type="date"
                    value={formData.serviceDate}
                    onChange={handleInputChange("serviceDate")}
                    error={errors.serviceDate}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.serviceType}
                      onChange={handleInputChange("serviceType")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select service type</option>
                      {serviceTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {errors.serviceType && (
                      <p className="text-sm text-red-600 mt-1">
                        {errors.serviceType}
                      </p>
                    )}
                  </div>

                  <InputField
                    label="Odometer Reading"
                    type="number"
                    placeholder="Enter odometer reading"
                    value={formData.odometerReading}
                    onChange={handleInputChange("odometerReading")}
                    error={errors.odometerReading}
                    required
                  />

                  <div className="md:col-span-2">
                    <InputField
                      label="Description/Notes"
                      type="text"
                      placeholder="Enter service description"
                      value={formData.description}
                      onChange={handleInputChange("description")}
                      error={errors.description}
                      required
                    />
                  </div>

                  <InputField
                    label="Service Center/Mechanic"
                    type="text"
                    placeholder="Enter service center name"
                    value={formData.serviceCenter}
                    onChange={handleInputChange("serviceCenter")}
                    error={errors.serviceCenter}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={handleInputChange("paymentMethod")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select payment method</option>
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Parts Replaced */}
              <div className="border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">
                    Parts Replaced
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPart}
                  >
                    Add Part
                  </Button>
                </div>

                {errors.parts && (
                  <p className="text-sm text-red-600 mb-4">{errors.parts}</p>
                )}

                <div className="space-y-3">
                  {parts.map((part, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                    >
                      <InputField
                        label={`Part ${index + 1} Name`}
                        type="text"
                        placeholder="Enter part name"
                        value={part.name}
                        onChange={(e) =>
                          handlePartChange(index, "name", e.target.value)
                        }
                      />
                      <InputField
                        label="Cost"
                        type="number"
                        placeholder="Enter cost"
                        value={part.cost}
                        onChange={(e) =>
                          handlePartChange(index, "cost", e.target.value)
                        }
                        step="0.01"
                      />
                      <div className="flex space-x-2">
                        {parts.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removePart(index)}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">
                    Total Parts Cost: {formatCurrency(totalPartsValue)}
                  </p>
                </div>
              </div>

              {/* Cost Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Cost & Payment Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Labor Charges"
                    type="number"
                    placeholder="Enter labor charges"
                    value={formData.laborCharges}
                    onChange={handleInputChange("laborCharges")}
                    error={errors.laborCharges}
                    step="0.01"
                  />

                  <div className="flex items-end">
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Cost
                      </label>
                      <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-lg font-bold text-gray-900">
                        {formatCurrency(calculateTotalCost())}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Parts + Labor
                      </p>
                    </div>
                  </div>

                  <InputField
                    label="Invoice/Job Card Number"
                    type="text"
                    placeholder="Enter invoice number"
                    value={formData.invoiceNumber}
                    onChange={handleInputChange("invoiceNumber")}
                  />
                </div>
              </div>

              {/* Next Service Information */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Next Service Due
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InputField
                    label="Next Service Date"
                    type="date"
                    value={formData.nextServiceDate}
                    onChange={handleInputChange("nextServiceDate")}
                  />

                  <InputField
                    label="Next Service Odometer"
                    type="number"
                    placeholder="Enter odometer reading for next service"
                    value={formData.nextServiceOdometer}
                    onChange={handleInputChange("nextServiceOdometer")}
                    error={errors.nextServiceOdometer}
                  />
                </div>
              </div>

              {/* Receipt Upload */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Receipt/Job Card
                </h3>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleFileSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {selectedFile && (
                  <p className="text-sm text-green-600 mt-2">
                    Selected: {selectedFile.name} (
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: JPG, PNG, PDF (Max 5MB)
                </p>
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
                    ? "Update Service"
                    : "Add Service"}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* Services List */
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Search and Filters */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search services..."
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
                  <option value="all">All Types</option>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <select
                  value={filterVehicle}
                  onChange={(e) => setFilterVehicle(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Vehicles</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.vehiclename} ({vehicle.vehiclenumber})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Services Table */}
            {filteredServices.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">🔧</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No service records found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm || filterType !== "all" || filterVehicle !== "all"
                    ? "Try adjusting your search terms or filters"
                    : "Get started by adding your first service record"}
                </p>
                <Button onClick={() => setShowForm(true)}>
                  Add First Service
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
                        Vehicle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Service Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Cost
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredServices.map((service) => (
                      <tr
                        key={service.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(service.serviceDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {getVehicleName(service.vehicleId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              service.serviceType === "Routine Service"
                                ? "bg-green-100 text-green-800"
                                : "bg-orange-100 text-orange-800"
                            }`}
                          >
                            {service.serviceType}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {service.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(service.totalCost)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewService(service)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                // Set edit mode and show form
                                setFormData({
                                  vehicleId: service.vehicleId,
                                  serviceDate: service.serviceDate,
                                  serviceType: service.serviceType,
                                  description: service.description,
                                  odometerReading:
                                    service.odometerReading?.toString() || "",
                                  serviceCenter: service.serviceCenter,
                                  laborCharges:
                                    service.laborCharges?.toString() || "",
                                  paymentMethod: service.paymentMethod || "",
                                  invoiceNumber: service.invoiceNumber || "",
                                  nextServiceDate:
                                    service.nextServiceDate || "",
                                  nextServiceOdometer:
                                    service.nextServiceOdometer?.toString() ||
                                    "",
                                });
                                if (service.partsReplaced) {
                                  setParts(service.partsReplaced);
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

        {/* View Service Modal */}
        {showModal && selectedService && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">
                    Service Details
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
                    <span className="font-medium text-gray-700">Vehicle:</span>
                    <p className="text-gray-900">
                      {getVehicleName(selectedService.vehicleId)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Service Date:
                    </span>
                    <p className="text-gray-900">
                      {formatDate(selectedService.serviceDate)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Service Type:
                    </span>
                    <p className="text-gray-900">
                      {selectedService.serviceType}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Odometer Reading:
                    </span>
                    <p className="text-gray-900">
                      {selectedService.odometerReading} km
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">
                      Description:
                    </span>
                    <p className="text-gray-900">
                      {selectedService.description}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Service Center:
                    </span>
                    <p className="text-gray-900">
                      {selectedService.serviceCenter}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Payment Method:
                    </span>
                    <p className="text-gray-900">
                      {selectedService.paymentMethod || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Parts Replaced */}
                {selectedService.partsReplaced &&
                  selectedService.partsReplaced.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-700 mb-3">
                        Parts Replaced:
                      </h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2">Part Name</th>
                              <th className="text-right py-2">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedService.partsReplaced.map(
                              (part, index) => (
                                <tr
                                  key={index}
                                  className="border-b border-gray-200"
                                >
                                  <td className="py-2">{part.name}</td>
                                  <td className="text-right py-2">
                                    {formatCurrency(part.cost)}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                {/* Cost Breakdown */}
                <div>
                  <h3 className="font-medium text-gray-700 mb-3">
                    Cost Breakdown:
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center py-1">
                      <span>Parts Total:</span>
                      <span>
                        {formatCurrency(
                          (selectedService.partsReplaced || []).reduce(
                            (sum, part) => sum + part.cost,
                            0
                          )
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span>Labor Charges:</span>
                      <span>
                        {formatCurrency(selectedService.laborCharges || 0)}
                      </span>
                    </div>
                    <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between items-center font-bold text-lg">
                      <span>Total Cost:</span>
                      <span>{formatCurrency(selectedService.totalCost)}</span>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">
                      Invoice Number:
                    </span>
                    <p className="text-gray-900">
                      {selectedService.invoiceNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Next Service Date:
                    </span>
                    <p className="text-gray-900">
                      {formatDate(selectedService.nextServiceDate)}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">
                      Next Service Odometer:
                    </span>
                    <p className="text-gray-900">
                      {selectedService.nextServiceOdometer
                        ? `${selectedService.nextServiceOdometer} km`
                        : "N/A"}
                    </p>
                  </div>
                  {selectedService.receiptURL && (
                    <div>
                      <span className="font-medium text-gray-700">
                        Receipt:
                      </span>
                      <a
                        href={selectedService.receiptURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 ml-2"
                      >
                        View Receipt
                      </a>
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
          title={isEditMode ? "Service Updated!" : "Service Added!"}
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

export default ServicesAndRepairs;
