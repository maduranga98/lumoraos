import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Store, Search, MapPin, Phone } from "lucide-react";

const OutletDropdown = ({
  outlets = [],
  selectedOutlet = null,
  onSelect,
  placeholder = "Select an outlet",
  error = "",
  disabled = false,
  required = false,
  className = "",
  showSearch = true,
  label = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredOutlets, setFilteredOutlets] = useState(outlets);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  const handleSelect = (outlet) => {
    onSelect(outlet);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const getDisplayText = () => {
    if (selectedOutlet) {
      return (
        selectedOutlet.outletName ||
        `Outlet - ${selectedOutlet.telephoneNumber}` ||
        "Selected Outlet"
      );
    }
    return placeholder;
  };

  return (
    <div className={`relative ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Dropdown Button */}
      <div
        ref={dropdownRef}
        className={`relative w-full bg-white border rounded-lg transition-all duration-200 ${
          disabled
            ? "bg-gray-50 cursor-not-allowed"
            : "cursor-pointer hover:border-gray-400"
        } ${
          error
            ? "border-red-300 focus-within:ring-2 focus-within:ring-red-500"
            : "border-gray-300 focus-within:ring-2 focus-within:ring-blue-500"
        } ${isOpen ? "ring-2 ring-blue-500 border-blue-500" : ""}`}
      >
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className="w-full px-4 py-3 text-left flex items-center justify-between focus:outline-none"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex items-center min-w-0">
            <Store className="h-4 w-4 text-gray-400 mr-3 flex-shrink-0" />
            <span
              className={`truncate ${
                selectedOutlet ? "text-gray-900" : "text-gray-500"
              }`}
            >
              {getDisplayText()}
            </span>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
            {/* Search Input */}
            {showSearch && (
              <div className="p-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search outlets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredOutlets.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500">
                  <Store className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">
                    {searchTerm
                      ? "No outlets match your search"
                      : "No outlets available"}
                  </p>
                </div>
              ) : (
                filteredOutlets.map((outlet) => (
                  <button
                    key={outlet.id}
                    type="button"
                    onClick={() => handleSelect(outlet)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors ${
                      selectedOutlet?.id === outlet.id
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-900"
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <Store className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {outlet.outletName || "Unnamed Outlet"}
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          {outlet.telephoneNumber && (
                            <div className="flex items-center text-xs text-gray-500">
                              <Phone className="h-3 w-3 mr-1" />
                              {outlet.telephoneNumber}
                            </div>
                          )}
                          {outlet.address && (
                            <div className="flex items-center text-xs text-gray-500">
                              <MapPin className="h-3 w-3 mr-1" />
                              <span className="truncate max-w-32">
                                {outlet.address}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-600 mt-1 flex items-center">
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export default OutletDropdown;
