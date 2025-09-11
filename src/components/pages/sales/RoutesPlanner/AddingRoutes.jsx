import React, { useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { toast } from "react-hot-toast";
import Input from "../../../ui/InputField";
import { db } from "../../../../services/firebase";
import { MapPin, Plus, X, Save, Loader2, Info } from "lucide-react";

const AddingRoutes = ({ onRouteAdded }) => {
  const [name, setName] = useState("");
  const [areas, setAreas] = useState([""]);
  const [description, setDescription] = useState("");
  const [estimatedDistance, setEstimatedDistance] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // Add new area input
  const addAreaInput = () => {
    setAreas([...areas, ""]);
  };

  // Remove area input
  const removeAreaInput = (index) => {
    if (areas.length > 1) {
      const newAreas = areas.filter((_, i) => i !== index);
      setAreas(newAreas);
    }
  };

  // Update specific area
  const updateArea = (index, value) => {
    const newAreas = [...areas];
    newAreas[index] = value;
    setAreas(newAreas);
  };

  // Reset form
  const resetForm = () => {
    setName("");
    setAreas([""]);
    setDescription("");
    setEstimatedDistance("");
    setEstimatedTime("");
  };

  // Validate form
  const validateForm = () => {
    if (!name.trim()) {
      toast.error("Route name is required");
      return false;
    }

    const validAreas = areas.filter((area) => area.trim() !== "");
    if (validAreas.length === 0) {
      toast.error("At least one area is required");
      return false;
    }

    return true;
  };

  // Save route to Firebase
  const handleSaveRoute = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const validAreas = areas.filter((area) => area.trim() !== "");

      // Reference to the routes collection
      const routesRef = collection(db, "routes");

      // Add the route document first to get the docId
      const docRef = await addDoc(routesRef, {
        name: name.trim(),
        areas: validAreas,
        description: description.trim(),
        estimatedDistance: estimatedDistance
          ? parseFloat(estimatedDistance)
          : null,
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        routeId: "",
      });

      // Update the document with the routeId (docId)
      await updateDoc(docRef, {
        routeId: docRef.id,
        updatedAt: serverTimestamp(),
      });

      toast.success("Route saved successfully!");
      console.log("Route saved with ID:", docRef.id);

      // Reset form after successful save
      resetForm();

      // Call the callback if provided
      if (onRouteAdded) {
        onRouteAdded();
      }
    } catch (error) {
      console.error("Error saving route:", error);
      toast.error("Failed to save route. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Compact Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Add New Route</h1>
              <p className="text-sm text-gray-600">
                Create delivery routes quickly
              </p>
            </div>
          </div>

          {/* Tips Toggle */}
          <button
            onClick={() => setShowTips(!showTips)}
            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Info className="h-4 w-4" />
            <span>Tips</span>
          </button>
        </div>

        {/* Collapsible Tips */}
        {showTips && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Use clear, descriptive names</p>
              <p>• Add multiple areas for comprehensive coverage</p>
              <p>• Include distance/time for better planning</p>
            </div>
          </div>
        )}
      </div>

      {/* Compact Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="space-y-4">
          {/* Route Name */}
          <div>
            <Input
              label="Route Name"
              type="text"
              placeholder="e.g., Downtown Route, Zone A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Areas - Compact Layout */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Areas Covered <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {areas.map((area, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder={`Area ${index + 1}`}
                      value={area}
                      onChange={(e) => updateArea(index, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {areas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAreaInput(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove area"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addAreaInput}
                className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Area</span>
              </button>
            </div>
          </div>

          {/* Route Details - Inline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Distance (km)"
                type="number"
                placeholder="25.5"
                value={estimatedDistance}
                onChange={(e) => setEstimatedDistance(e.target.value)}
                step="0.1"
                min="0"
              />
            </div>
            <div>
              <Input
                label="Time (min)"
                type="number"
                placeholder="45"
                value={estimatedTime}
                onChange={(e) => setEstimatedTime(e.target.value)}
                min="0"
              />
            </div>
          </div>

          {/* Description - Compact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows="2"
              placeholder="Route notes or special instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Action Buttons - Compact */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              disabled={isLoading}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSaveRoute}
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors text-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Route</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Preview */}
      {(name || areas.some((area) => area.trim())) && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
          <div className="text-sm text-gray-600 space-y-1">
            {name && (
              <p>
                <span className="font-medium">Route:</span> {name}
              </p>
            )}
            {areas.filter((area) => area.trim()).length > 0 && (
              <p>
                <span className="font-medium">Areas:</span>{" "}
                {areas.filter((area) => area.trim()).join(", ")}
              </p>
            )}
            {estimatedDistance && (
              <p>
                <span className="font-medium">Distance:</span>{" "}
                {estimatedDistance} km
              </p>
            )}
            {estimatedTime && (
              <p>
                <span className="font-medium">Time:</span> {estimatedTime}{" "}
                minutes
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddingRoutes;
