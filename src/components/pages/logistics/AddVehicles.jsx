import React, { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const AddVehicles = ({ editVehicle = null }) => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  // Check if we're in edit mode
  const isEditMode = !!editVehicle;

  const [formData, setFormData] = useState({
    // Basic info
    vehiclename: "",
    vehiclenumber: "",
    type: "", // van, lorry, truck
    brand: "",
    chassisnumber: "",

    // Ownership
    ownership: "",

    // Financial and legal
    purchasedate: "",
    purchaseamount: "",
    insuranceprovider: "",
    expirydate: "",
    licenserenewaldate: "",

    // Operational info
    currentodometerreading: "",
    fueltype: "",
    averagekmperliter: "",
    purpose: "",

    // Maintenance info
    lastservicedate: "",
    nextservicedate: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Vehicle number availability checking
  const [vehicleNumberAvailable, setVehicleNumberAvailable] = useState(null);
  const [vehicleNumberChecking, setVehicleNumberChecking] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "vehiclenumber") {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    } else if (field === "chassisnumber") {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    } else if (
      field === "currentodometerreading" ||
      field === "averagekmperliter" ||
      field === "purchaseamount"
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

  // Vehicle number availability check
  //   const checkVehicleNumberAvailability = async (vehicleNumber) => {
  //     if (!vehicleNumber || vehicleNumber.length < 3) {
  //       setVehicleNumberAvailable(null);
  //       return;
  //     }

  //     setVehicleNumberChecking(true);
  //     try {
  //       const vehicleDocRef = doc(
  //         db,
  //         "vehiclenumbers",
  //         vehicleNumber.toLowerCase()
  //       );
  //       const vehicleDoc = await getDoc(vehicleDocRef);
  //       setVehicleNumberAvailable(!vehicleDoc.exists());
  //     } catch (error) {
  //       console.error("Error checking vehicle number:", error);
  //       setVehicleNumberAvailable(null);
  //     } finally {
  //       setVehicleNumberChecking(false);
  //     }
  //   };

  // Debounced vehicle number check
  //   useEffect(() => {
  //     const timeoutId = setTimeout(() => {
  //       if (formData.vehiclenumber) {
  //         checkVehicleNumberAvailability(formData.vehiclenumber);
  //       }
  //     }, 500);

  //     return () => clearTimeout(timeoutId);
  //   }, [formData.vehiclenumber]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.vehiclenumber.trim())
      newErrors.vehiclenumber = "Vehicle number is required";
    if (!formData.type.trim()) newErrors.type = "Vehicle type is required";
    if (!formData.brand.trim()) newErrors.brand = "Brand is required";

    // Vehicle number validation
    if (formData.vehiclenumber) {
      if (formData.vehiclenumber.length < 3) {
        newErrors.vehiclenumber =
          "Vehicle number must be at least 3 characters";
      } else if (vehicleNumberAvailable === false) {
        newErrors.vehiclenumber = "Vehicle number is already registered";
      }
    }

    // Numeric field validation
    if (formData.purchaseamount && isNaN(formData.purchaseamount)) {
      newErrors.purchaseamount = "Please enter a valid amount";
    }
    if (
      formData.currentodometerreading &&
      isNaN(formData.currentodometerreading)
    ) {
      newErrors.currentodometerreading = "Please enter a valid reading";
    }
    if (formData.averagekmperliter && isNaN(formData.averagekmperliter)) {
      newErrors.averagekmperliter = "Please enter a valid number";
    }

    // Date validation (ensure dates are not in the future where inappropriate)
    if (formData.purchasedate && new Date(formData.purchasedate) > new Date()) {
      newErrors.purchasedate = "Purchase date cannot be in the future";
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
        "You must be logged in to add vehicles. Please refresh and try again."
      );
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      // Create a new document reference to get the auto-generated ID
      const vehicleDocRef = doc(collection(db, "vehicles"));
      const vehicleId = vehicleDocRef.id;

      // Prepare vehicle data with the document ID as vehicleId
      const vehicleData = cleanData({
        // System fields
        vehicleId: vehicleId,

        // Basic Information
        vehiclename: formData.vehiclename,
        vehiclenumber: formData.vehiclenumber,
        type: formData.type,
        brand: formData.brand,
        chassisnumber: formData.chassisnumber,

        // Ownership
        ownership: formData.ownership,

        // Financial and Legal
        financialInfo: {
          purchasedate: formData.purchasedate,
          purchaseamount: formData.purchaseamount
            ? parseFloat(formData.purchaseamount)
            : null,
          insuranceprovider: formData.insuranceprovider,
          expirydate: formData.expirydate,
          licenserenewaldate: formData.licenserenewaldate,
        },

        // Operational Info
        operationalInfo: {
          currentodometerreading: formData.currentodometerreading
            ? parseFloat(formData.currentodometerreading)
            : null,
          fueltype: formData.fueltype,
          averagekmperliter: formData.averagekmperliter
            ? parseFloat(formData.averagekmperliter)
            : null,
          purpose: formData.purpose,
        },

        // Maintenance Info
        maintenanceInfo: {
          lastservicedate: formData.lastservicedate,
          nextservicedate: formData.nextservicedate,
        },

        // System fields
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      });

      // Save vehicle data to Firestore
      await setDoc(vehicleDocRef, vehicleData);

      // Reserve vehicle number
      await setDoc(
        doc(db, "vehiclenumbers", formData.vehiclenumber.toLowerCase()),
        {
          vehicleId: vehicleId,
          createdAt: serverTimestamp(),
        }
      );

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: "vehicle_added",
          description: `New vehicle ${formData.vehiclename} (${formData.vehiclenumber}) was added`,
          performedBy: currentUser.userId,
          targetVehicleId: vehicleId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        `Vehicle ${formData.vehiclename} (${formData.vehiclenumber}) has been successfully registered with ID: ${vehicleId}`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        vehiclename: "",
        vehiclenumber: "",
        type: "",
        brand: "",
        chassisnumber: "",
        ownership: "",
        purchasedate: "",
        purchaseamount: "",
        insuranceprovider: "",
        expirydate: "",
        licenserenewaldate: "",
        currentodometerreading: "",
        fueltype: "",
        averagekmperliter: "",
        purpose: "",
        lastservicedate: "",
        nextservicedate: "",
      });

      setVehicleNumberAvailable(null);
    } catch (error) {
      console.error("Error adding vehicle:", error);

      let errorMsg = "Failed to add vehicle. Please try again.";

      if (error.code === "permission-denied") {
        errorMsg = "You don't have permission to add vehicles.";
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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Vehicle Registration
            </h1>
            <p className="text-gray-600">
              Register a new vehicle with complete details
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Information */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Basic Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Vehicle Name"
                  type="text"
                  placeholder="Enter vehicle name"
                  value={formData.vehiclename}
                  onChange={handleInputChange("vehiclename")}
                  error={errors.vehiclename}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Enter vehicle number"
                      value={formData.vehiclenumber}
                      onChange={handleInputChange("vehiclenumber")}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                        errors.vehiclenumber
                          ? "border-red-500"
                          : vehicleNumberAvailable === true
                          ? "border-green-500"
                          : vehicleNumberAvailable === false
                          ? "border-red-500"
                          : "border-gray-300"
                      }`}
                      required
                    />
                    {vehicleNumberChecking && (
                      <div className="absolute right-3 top-3">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                    {vehicleNumberAvailable === true && (
                      <div className="absolute right-3 top-3 text-green-500">
                        ✓
                      </div>
                    )}
                    {vehicleNumberAvailable === false && (
                      <div className="absolute right-3 top-3 text-red-500">
                        ✗
                      </div>
                    )}
                  </div>
                  {errors.vehiclenumber && (
                    <p className="text-sm text-red-600 mt-1">
                      {errors.vehiclenumber}
                    </p>
                  )}
                  {vehicleNumberAvailable === true && !errors.vehiclenumber && (
                    <p className="text-sm text-green-600 mt-1">
                      Vehicle number is available!
                    </p>
                  )}
                  {vehicleNumberAvailable === false &&
                    !errors.vehiclenumber && (
                      <p className="text-sm text-red-600 mt-1">
                        Vehicle number is already registered
                      </p>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.type}
                    onChange={handleInputChange("type")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select vehicle type</option>
                    <option value="van">Van</option>
                    <option value="lorry">Lorry</option>
                    <option value="truck">Truck</option>
                    <option value="car">Car</option>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="bus">Bus</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.type && (
                    <p className="text-sm text-red-600 mt-1">{errors.type}</p>
                  )}
                </div>

                <InputField
                  label="Brand"
                  type="text"
                  placeholder="Enter vehicle brand"
                  value={formData.brand}
                  onChange={handleInputChange("brand")}
                  error={errors.brand}
                  required
                />

                <InputField
                  label="Chassis Number"
                  type="text"
                  placeholder="Enter chassis number"
                  value={formData.chassisnumber}
                  onChange={handleInputChange("chassisnumber")}
                  error={errors.chassisnumber}
                />
              </div>
            </div>

            {/* Ownership */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Ownership
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ownership
                  </label>
                  <select
                    value={formData.ownership}
                    onChange={handleInputChange("ownership")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select ownership type</option>
                    <option value="owned">Owned</option>
                    <option value="leased">Leased</option>
                    <option value="rented">Rented</option>
                    <option value="hired">Hired</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Financial and Legal */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Financial & Legal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Purchase Date"
                  type="date"
                  value={formData.purchasedate}
                  onChange={handleInputChange("purchasedate")}
                  error={errors.purchasedate}
                />

                <InputField
                  label="Purchase Amount"
                  type="number"
                  placeholder="Enter purchase amount"
                  value={formData.purchaseamount}
                  onChange={handleInputChange("purchaseamount")}
                  error={errors.purchaseamount}
                />

                <InputField
                  label="Insurance Provider"
                  type="text"
                  placeholder="Enter insurance provider"
                  value={formData.insuranceprovider}
                  onChange={handleInputChange("insuranceprovider")}
                />

                <InputField
                  label="Insurance Expiry Date"
                  type="date"
                  value={formData.expirydate}
                  onChange={handleInputChange("expirydate")}
                />

                <InputField
                  label="License Renewal Date"
                  type="date"
                  value={formData.licenserenewaldate}
                  onChange={handleInputChange("licenserenewaldate")}
                />
              </div>
            </div>

            {/* Operational Information */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Operational Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Current Odometer Reading (KM)"
                  type="number"
                  placeholder="Enter current reading"
                  value={formData.currentodometerreading}
                  onChange={handleInputChange("currentodometerreading")}
                  error={errors.currentodometerreading}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fuel Type
                  </label>
                  <select
                    value={formData.fueltype}
                    onChange={handleInputChange("fueltype")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select fuel type</option>
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="electric">Electric</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="lpg">LPG</option>
                    <option value="cng">CNG</option>
                  </select>
                </div>

                <InputField
                  label="Average KM per Liter"
                  type="number"
                  placeholder="Enter average km/l"
                  value={formData.averagekmperliter}
                  onChange={handleInputChange("averagekmperliter")}
                  error={errors.averagekmperliter}
                />

                <InputField
                  label="Purpose"
                  type="text"
                  placeholder="Enter vehicle purpose"
                  value={formData.purpose}
                  onChange={handleInputChange("purpose")}
                />
              </div>
            </div>

            {/* Maintenance Information */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Maintenance Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Last Service Date"
                  type="date"
                  value={formData.lastservicedate}
                  onChange={handleInputChange("lastservicedate")}
                />

                <InputField
                  label="Next Service Date"
                  type="date"
                  value={formData.nextservicedate}
                  onChange={handleInputChange("nextservicedate")}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading} size="lg">
                {loading ? "Registering Vehicle..." : "Register Vehicle"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Dialog */}
      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title={
          isEditMode
            ? "Vehicle Updated Successfully!"
            : "Vehicle Registered Successfully!"
        }
        message={successMessage}
        buttonText={isEditMode ? "Continue" : "Register Another Vehicle"}
      />

      {/* Error Dialog */}
      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title={
          isEditMode ? "Failed to Update Vehicle" : "Failed to Register Vehicle"
        }
        message={errorMessage}
        buttonText="Try Again"
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default AddVehicles;
