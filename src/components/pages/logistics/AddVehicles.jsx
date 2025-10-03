import React, { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import InputField from "../../ui/InputField";
import Button from "../../ui/Button";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const AddVehicles = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    regNo: "",
    type: "",
    brand: "",
    fuelType: "",
    tankCapacity: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  const handleInputChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "regNo") {
      value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    } else if (field === "tankCapacity") {
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

  const validateForm = () => {
    const newErrors = {};

    if (!formData.regNo.trim()) {
      newErrors.regNo = "Registration number is required";
    }
    if (!formData.type.trim()) {
      newErrors.type = "Vehicle type is required";
    }
    if (!formData.brand.trim()) {
      newErrors.brand = "Brand is required";
    }
    if (!formData.fuelType.trim()) {
      newErrors.fuelType = "Fuel type is required";
    }
    if (formData.tankCapacity && isNaN(formData.tankCapacity)) {
      newErrors.tankCapacity = "Please enter a valid number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage("You must be logged in to add vehicles.");
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const vehicleDocRef = doc(collection(db, "vehicles"));
      const vehicleId = vehicleDocRef.id;

      const vehicleData = {
        vehicleId: vehicleId,
        regNo: formData.regNo,
        type: formData.type,
        brand: formData.brand,
        fuelType: formData.fuelType,
        tankCapacity: formData.tankCapacity
          ? parseFloat(formData.tankCapacity)
          : null,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      };

      await setDoc(vehicleDocRef, vehicleData);

      // Log activity
      try {
        await addDoc(collection(db, "activities"), {
          type: "vehicle_added",
          description: `New vehicle ${formData.brand} (${formData.regNo}) was added`,
          performedBy: currentUser.userId,
          targetVehicleId: vehicleId,
          timestamp: serverTimestamp(),
        });
      } catch (activityError) {
        console.warn("Failed to log activity:", activityError);
      }

      setSuccessMessage(
        `Vehicle ${formData.brand} (${formData.regNo}) has been successfully registered!`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        regNo: "",
        type: "",
        brand: "",
        fuelType: "",
        tankCapacity: "",
      });
    } catch (error) {
      console.error("Error adding vehicle:", error);

      let errorMsg = "Failed to add vehicle. Please try again.";

      if (error.code === "permission-denied") {
        errorMsg = "You don't have permission to add vehicles.";
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

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

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Vehicle Registration
            </h1>
            <p className="text-gray-600">Add a new vehicle to the system</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <InputField
                label="Registration Number"
                type="text"
                placeholder="Enter registration number (e.g., ABC1234)"
                value={formData.regNo}
                onChange={handleInputChange("regNo")}
                error={errors.regNo}
                required
              />

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
                  <option value="lorry">Lorry</option>
                  <option value="van">Van</option>
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
                placeholder="Enter vehicle brand (e.g., Toyota, Isuzu)"
                value={formData.brand}
                onChange={handleInputChange("brand")}
                error={errors.brand}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fuel Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.fuelType}
                  onChange={handleInputChange("fuelType")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select fuel type</option>
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="lpg">LPG</option>
                  <option value="cng">CNG</option>
                </select>
                {errors.fuelType && (
                  <p className="text-sm text-red-600 mt-1">{errors.fuelType}</p>
                )}
              </div>

              <InputField
                label="Tank Capacity (Liters)"
                type="number"
                placeholder="Enter tank capacity"
                value={formData.tankCapacity}
                onChange={handleInputChange("tankCapacity")}
                error={errors.tankCapacity}
              />
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </Button>
              <Button type="submit" loading={loading} size="lg">
                {loading ? "Registering..." : "Register Vehicle"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Vehicle Registered Successfully!"
        message={successMessage}
        buttonText="Register Another Vehicle"
      />

      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Failed to Register Vehicle"
        message={errorMessage}
        buttonText="Try Again"
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default AddVehicles;
