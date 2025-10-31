import React, { useState } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../services/firebase";
import { useUser } from "../../../../contexts/userContext";
import InputField from "../../../ui/InputField";
import Button from "../../../ui/Button";
import SuccessDialog from "../../../ui/SuccessDialog";
import FailDialog from "../../../ui/FailDialog";

const AddingRoutes = ({ onRouteAdded }) => {
  const { user: currentUser } = useUser();

  const [formData, setFormData] = useState({
    name: "",
    notes: "",
  });

  const [areas, setAreas] = useState([""]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

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

  const addAreaInput = () => {
    setAreas([...areas, ""]);
  };

  const removeAreaInput = (index) => {
    if (areas.length > 1) {
      const newAreas = areas.filter((_, i) => i !== index);
      setAreas(newAreas);
    }
  };

  const updateArea = (index, value) => {
    const newAreas = [...areas];
    newAreas[index] = value;
    setAreas(newAreas);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Route name is required";
    }

    const validAreas = areas.filter((area) => area.trim() !== "");
    if (validAreas.length === 0) {
      newErrors.areas = "At least one area is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!currentUser?.userId) {
      setErrorMessage("You must be logged in to add routes.");
      setShowError(true);
      return;
    }

    setLoading(true);

    try {
      const validAreas = areas.filter((area) => area.trim() !== "");

      const routeDocRef = doc(collection(db, "routes"));
      const routeId = routeDocRef.id;

      const routeData = {
        routeId: routeId,
        name: formData.name.trim(),
        area_covered: validAreas,
        notes: formData.notes.trim(),
        createdAt: serverTimestamp(),
        createdBy: currentUser.userId,
        updatedAt: serverTimestamp(),
      };

      await setDoc(routeDocRef, routeData);

      setSuccessMessage(
        `Route "${formData.name}" has been successfully created!`
      );
      setShowSuccess(true);

      // Reset form
      setFormData({
        name: "",
        notes: "",
      });
      setAreas([""]);

      if (onRouteAdded) {
        onRouteAdded();
      }
    } catch (error) {
      console.error("Error adding route:", error);

      let errorMsg = "Failed to add route. Please try again.";

      if (error.code === "permission-denied") {
        errorMsg = "You don't have permission to add routes.";
      } else if (error.code === "network-request-failed") {
        errorMsg = "Network error. Please check your connection.";
      }

      setErrorMessage(errorMsg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Add New Route
          </h2>
          <p className="text-gray-600">Create a delivery route</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <InputField
            label="Route Name"
            type="text"
            placeholder="Enter route name"
            value={formData.name}
            onChange={handleInputChange("name")}
            error={errors.name}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Areas Covered <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {areas.map((area, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder={`Area ${index + 1}`}
                    value={area}
                    onChange={(e) => updateArea(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  {areas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAreaInput(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addAreaInput}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add Area
              </button>
            </div>
            {errors.areas && (
              <p className="text-sm text-red-600 mt-1">{errors.areas}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              placeholder="Enter route notes (optional)"
              value={formData.notes}
              onChange={handleInputChange("notes")}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({ name: "", notes: "" });
                setAreas([""]);
              }}
            >
              Reset
            </Button>
            <Button type="submit" loading={loading} size="lg">
              {loading ? "Saving..." : "Save Route"}
            </Button>
          </div>
        </form>
      </div>

      <SuccessDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Route Added Successfully!"
        message={successMessage}
        buttonText="Add Another Route"
      />

      <FailDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Failed to Add Route"
        message={errorMessage}
        buttonText="Try Again"
        onRetry={() => setShowError(false)}
      />
    </div>
  );
};

export default AddingRoutes;
