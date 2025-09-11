import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../services/firebase";

const SimpleProductSelector = ({
  value = null,
  onChange = () => {},
  placeholder = "Select a product",
  error = "",
  required = false,
  disabled = false,
  className = "",
}) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load products from Firebase
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        console.log("Loading products...");

        const productsQuery = query(
          collection(db, "productDefinitions"),
          orderBy("productName", "asc")
        );

        const productsSnapshot = await getDocs(productsQuery);
        console.log("Products snapshot:", productsSnapshot.size, "documents");

        const productsData = productsSnapshot.docs.map((doc) => {
          const data = doc.data();
          console.log("Product data:", { id: doc.id, ...data });
          return {
            id: doc.id,
            ...data,
          };
        });

        console.log("All products:", productsData);
        setProducts(productsData);
      } catch (error) {
        console.error("Error loading products:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Filter products based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter((product) =>
        product.productName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [products, searchTerm]);

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
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleProductSelect = (product) => {
    onChange(product);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = () => {
    onChange(null);
  };

  const selectedProduct = value && products.find((p) => p.id === value.id);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Label */}
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Product {required && <span className="text-red-500">*</span>}
      </label>

      {/* Main Input */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-4 py-3 text-left bg-white border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error ? "border-red-300" : "border-gray-300"}
            ${isOpen ? "ring-2 ring-blue-500 border-blue-500" : ""}
            transition-all duration-200
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {loading ? (
                <span className="text-gray-500">Loading products...</span>
              ) : selectedProduct ? (
                <div className="text-gray-900 font-medium">
                  {selectedProduct.productName}
                </div>
              ) : (
                <span className="text-gray-500">{placeholder}</span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {selectedProduct && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}

              <svg
                className={`w-5 h-5 text-gray-400 transform transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </button>

        {/* Dropdown Menu */}
        {isOpen && !loading && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl max-h-64 overflow-hidden">
            {/* Search Input */}
            <div className="p-3 border-b border-gray-200">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Products List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchTerm ? "No products found" : "No products available"}
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductSelect(product)}
                    className={`
                      w-full px-4 py-3 text-left hover:bg-blue-50 focus:bg-blue-50 
                      focus:outline-none transition-colors duration-150
                      ${selectedProduct?.id === product.id ? "bg-blue-100" : ""}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900">
                        {product.productName}
                      </div>

                      {selectedProduct?.id === product.id && (
                        <svg
                          className="w-4 h-4 text-blue-600 ml-2 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Loading indicator when open */}
      {isOpen && loading && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-xl p-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600">
              Loading products...
            </span>
          </div>
        </div>
      )}

      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-2 text-xs text-gray-400">
          Debug: {products.length} products loaded, {filteredProducts.length}{" "}
          filtered
        </div>
      )}

      {/* Error Message */}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
};

export default SimpleProductSelector;
