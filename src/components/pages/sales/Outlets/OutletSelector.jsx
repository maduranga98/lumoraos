// components/outlets/OutletSelector.jsx
import React from "react";
import OutletDropdown from "../../../../utils/OutletDropdown";
import { useOutlets } from "../../../../hooks/useOutlets";
import Button from "../../../ui/Button";

const OutletSelector = ({ selectedOutlet, onOutletSelect }) => {
  // Load outlets using the custom hook
  const {
    outlets,
    loading,
    error: outletsError,
  } = useOutlets({
    activeOnly: true,
    orderByField: "outletName",
    orderDirection: "asc",
  });

  const handleOutletSelect = (outlet) => {
    onOutletSelect(outlet);
  };

  const handleClearSelection = () => {
    onOutletSelect(null);
  };

  return (
    <div className="space-y-4">
      {/* Outlet Selection Dropdown */}
      <OutletDropdown
        label="Select Outlet"
        outlets={outlets}
        selectedOutlet={selectedOutlet}
        onSelect={handleOutletSelect}
        placeholder="Choose an outlet..."
        required
        disabled={loading}
        showSearch={true}
        className="w-full"
      />

      {/* Loading State */}
      {loading && (
        <div className="text-sm text-gray-500 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Loading outlets...
        </div>
      )}

      {/* Error State */}
      {outletsError && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          {outletsError}
        </div>
      )}

      {/* Selected Outlet Details */}
      {selectedOutlet && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                Selected Outlet:
              </h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>
                  <span className="font-medium">Name:</span>{" "}
                  {selectedOutlet.outletName || "Unnamed Outlet"}
                </p>
                <p>
                  <span className="font-medium">Phone:</span>{" "}
                  {selectedOutlet.telephoneNumber}
                </p>
                {selectedOutlet.address && (
                  <p>
                    <span className="font-medium">Address:</span>{" "}
                    {selectedOutlet.address}
                  </p>
                )}
                {selectedOutlet.contactPerson && (
                  <p>
                    <span className="font-medium">Contact:</span>{" "}
                    {selectedOutlet.contactPerson}
                  </p>
                )}
                {selectedOutlet.email && (
                  <p>
                    <span className="font-medium">Email:</span>{" "}
                    {selectedOutlet.email}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearSelection}
            >
              Change
            </Button>
          </div>
        </div>
      )}

      {/* No Outlets Available */}
      {!loading && outlets.length === 0 && !outletsError && (
        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg text-center">
          No active outlets found. Please add outlets first.
        </div>
      )}
    </div>
  );
};

export default OutletSelector;
