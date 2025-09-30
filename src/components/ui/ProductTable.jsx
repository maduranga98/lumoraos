// src/components/ui/ProductSelector.jsx
import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";

const ProductSelector = ({
  value,
  onChange,
  placeholder = "Select a product...",
  required = false,
  error,
  showStock = true, // Option to show stock information
}) => {
  const [products, setProducts] = useState([]);
  const [productStock, setProductStock] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(value || null);

  useEffect(() => {
    if (showModal) {
      loadProducts();
    }
  }, [showModal]);

  useEffect(() => {
    setSelectedProduct(value);
  }, [value]);

  const loadProducts = async () => {
    try {
      setLoading(true);

      // Load product definitions
      const productsSnapshot = await getDocs(collection(db, "products"));
      const productsData = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Load product stock if needed
      if (showStock) {
        const stockQuery = query(
          collection(db, "productStock"),
          where("status", "==", "available")
        );
        const stockSnapshot = await getDocs(stockQuery);
        const stockData = stockSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProductStock(stockData);
      }

      setProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  };

  const getProductStock = (productId) => {
    return productStock.filter((stock) => stock.productId === productId);
  };

  const getTotalStock = (productId) => {
    const stocks = getProductStock(productId);
    return stocks.reduce((sum, stock) => sum + (stock.quantity || 0), 0);
  };

  const handleSelectProduct = (product, stockItem = null) => {
    const selectedData = {
      ...product,
      stockItem: stockItem, // Include specific stock item if selected
      availableStock: getTotalStock(product.id),
    };

    setSelectedProduct(selectedData);
    onChange(selectedData);
    setShowModal(false);
    setSearchTerm("");
  };

  const filteredProducts = products.filter(
    (product) =>
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.productCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <>
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Product {required && <span className="text-red-500">*</span>}
        </label>

        <div
          onClick={() => setShowModal(true)}
          className={`w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors
            ${
              error ? "border-red-500" : "border-gray-300 hover:border-gray-400"
            }
            ${selectedProduct ? "bg-blue-50" : "bg-white"}
          `}
        >
          {selectedProduct ? (
            <div className="flex justify-between items-center">
              <div>
                <span className="font-medium">{selectedProduct.name}</span>
                {selectedProduct.sku && (
                  <span className="text-sm text-gray-500 ml-2">
                    (SKU: {selectedProduct.sku})
                  </span>
                )}
              </div>
              {showStock && (
                <span className="text-sm text-blue-600">
                  Stock: {selectedProduct.availableStock || 0} units
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
      </div>

      {/* Product Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  Select Product
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setSearchTerm("");
                  }}
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

              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search products by name, SKU, or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            {/* Product Table */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <span className="text-gray-600 mt-2">
                    Loading products...
                  </span>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-gray-400 text-4xl mb-4">📦</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No products found
                  </h3>
                  <p className="text-gray-600">
                    {searchTerm
                      ? "Try adjusting your search terms"
                      : "No products available"}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Product Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Main Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Unit Price
                      </th>
                      {showStock && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Available Batches
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Total Stock
                          </th>
                        </>
                      )}
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredProducts.map((product) => {
                      const stockItems = showStock
                        ? getProductStock(product.id)
                        : [];
                      const totalStock = getTotalStock(product.id);

                      return (
                        <React.Fragment key={product.id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {product.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  SKU: {product.sku || "N/A"} | Code:{" "}
                                  {product.productCode || "N/A"}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`text-sm font-medium ${
                                  product.quantity > 0
                                    ? "text-gray-900"
                                    : "text-red-600"
                                }`}
                              >
                                {product.quantity || 0} units
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(product.unitPrice || 0)}
                            </td>
                            {showStock && (
                              <>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm text-blue-600">
                                    {stockItems.length} batch(es)
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-medium text-green-600">
                                    {totalStock} units
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <button
                                onClick={() => handleSelectProduct(product)}
                                className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                              >
                                Select
                              </button>
                            </td>
                          </tr>

                          {/* Show batch details if available */}
                          {showStock && stockItems.length > 0 && (
                            <tr>
                              <td colSpan="6" className="px-6 py-2 bg-gray-50">
                                <div className="text-xs text-gray-600">
                                  <div className="font-medium mb-2">
                                    Available Batches:
                                  </div>
                                  <div className="space-y-1">
                                    {stockItems.map((stock) => (
                                      <div
                                        key={stock.id}
                                        className="flex justify-between items-center p-2 bg-white rounded border border-gray-200"
                                      >
                                        <div>
                                          <span className="font-medium">
                                            Batch: {stock.batchNumber}
                                          </span>
                                          <span className="ml-4">
                                            Qty: {stock.quantity} units
                                          </span>
                                          <span className="ml-4">
                                            Mfg:{" "}
                                            {formatDate(stock.manufacturedDate)}
                                          </span>
                                          {stock.expiryDate && (
                                            <span className="ml-4">
                                              Exp:{" "}
                                              {formatDate(stock.expiryDate)}
                                            </span>
                                          )}
                                        </div>
                                        <button
                                          onClick={() =>
                                            handleSelectProduct(product, stock)
                                          }
                                          className="text-xs text-blue-600 hover:text-blue-800"
                                        >
                                          Select This Batch
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductSelector;
