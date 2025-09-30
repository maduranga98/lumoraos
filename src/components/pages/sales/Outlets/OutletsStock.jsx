// src/components/pages/inventory/OutletsStock.jsx
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { db } from "../../../../services/firebase";
import { useUser } from "../../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import OutletSelector from "./OutletSelector";
import Button from "../../../ui/Button";
import SuccessDialog from "../../../ui/SuccessDialog";
import FailDialog from "../../../ui/FailDialog";

const OutletsStock = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  // State management
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [products, setProducts] = useState([]);
  const [outletStock, setOutletStock] = useState({});
  const [loading, setLoading] = useState(false);
  const [transferQuantities, setTransferQuantities] = useState({});

  // Dialog states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  // Load products when component mounts
  useEffect(() => {
    if (currentUser) {
      loadProducts();
    }
  }, [currentUser]);

  // Load outlet stock when outlet is selected
  useEffect(() => {
    if (selectedOutlet) {
      loadOutletStock(selectedOutlet.id);
    } else {
      setOutletStock({});
      setTransferQuantities({});
    }
  }, [selectedOutlet]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const productsSnapshot = await getDocs(collection(db, "productStock"));
      const productsData = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log(productsData);
      setProducts(productsData);
    } catch (error) {
      console.error("Error loading products:", error);
      setErrorMessage("Failed to load products");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadOutletStock = async (outletId) => {
    try {
      const stockQuery = query(
        collection(db, "outletStock"),
        where("outletId", "==", outletId)
      );
      const snapshot = await getDocs(stockQuery);

      const stockData = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        stockData[data.productId] = {
          id: doc.id,
          quantity: data.quantity || 0,
        };
      });

      setOutletStock(stockData);
    } catch (error) {
      console.error("Error loading outlet stock:", error);
    }
  };

  const handleTransferQuantityChange = (productId, value) => {
    const numValue = value.replace(/[^0-9]/g, "");
    setTransferQuantities((prev) => ({
      ...prev,
      [productId]: numValue,
    }));
  };

  const handleStockTransfer = async (productStockId, stockId) => {
    const transferQty = parseInt(transferQuantities[productStockId] || 0);

    if (!selectedOutlet) {
      setErrorMessage("Please select an outlet first");
      setShowError(true);
      return;
    }

    if (transferQty <= 0) {
      setErrorMessage("Please enter a valid quantity to transfer");
      setShowError(true);
      return;
    }

    // Find the product stock item by its document ID
    const productStock = products.find(
      (p) => p.productionId === productStockId
    );
    console.log("first", productStock);
    if (!productStock) {
      setErrorMessage("Product not found");
      setShowError(true);
      return;
    }

    if (transferQty > productStock.quantity) {
      setErrorMessage("Insufficient stock in main inventory");
      setShowError(true);
      return;
    }

    try {
      setLoading(true);

      // Use transaction to ensure data consistency
      await runTransaction(db, async (transaction) => {
        // 1. Update productStock document
        const productStockRef = doc(db, "productStock", stockId);
        const productStockDoc = await transaction.get(productStockRef);
        console.log(productStockId);
        if (!productStockDoc.exists()) {
          throw new Error("Product stock not found");
        }

        const currentMainStock = productStockDoc.data().quantity || 0;
        if (currentMainStock < transferQty) {
          throw new Error("Insufficient stock");
        }

        // Update the productStock quantity
        transaction.update(productStockRef, {
          quantity: currentMainStock - transferQty,
          updatedAt: serverTimestamp(),
        });

        // 2. Check for existing outlet stock - using productId not the document ID
        const outletStockQuery = query(
          collection(db, "outletStock"),
          where("outletId", "==", selectedOutlet.outletId),
          where("productId", "==", productStock.productId), // Use productId field
          where("batchNumber", "==", productStock.batchNumber) // Include batch for uniqueness
        );

        const outletStockSnapshot = await getDocs(outletStockQuery);

        if (outletStockSnapshot.empty) {
          // Create new outlet stock record
          const newOutletStockRef = doc(collection(db, "outletStock"));
          console.log(
            "Product Stock Data:",
            productStock,
            "selected Outlet:",
            selectedOutlet
          );
          transaction.set(newOutletStockRef, {
            stockId: stockId,
            outletId: selectedOutlet.outletId,
            outletName: selectedOutlet.outletName,
            productId: productStock.productId,
            productName: productStock.productName,
            productCode: productStock.productCode,
            batchNumber: productStock.batchNumber,
            productionBatch: productStock.productionBatch,
            productionId: productStock.productionId,
            quantity: transferQty,
            unit: productStock.unit,

            // Pricing information
            costPerUnit: productStock.costPerUnit || 0,
            retailPrice: productStock.retailPrice || 0,
            wholesalePrice: productStock.wholesalePrice || 0,
            margin: productStock.margin || 0,
            sellingPriceCategory: productStock.sellingPriceCategory,

            // Quality and storage
            qualityGrade: productStock.qualityGrade,
            storageLocation: productStock.storageLocation,
            manufacturedDate: productStock.manufacturedDate,
            expiryDate: productStock.expiryDate,

            // System fields
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: currentUser.userId,
            status: "available",
          });
        } else {
          // Update existing outlet stock
          const outletStockDoc = outletStockSnapshot.docs[0];
          const outletStockRef = doc(db, "outletStock", outletStockDoc.id);
          const currentOutletStock = outletStockDoc.data().quantity || 0;

          transaction.update(outletStockRef, {
            quantity: currentOutletStock + transferQty,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.userId,
          });
        }

        // 3. Create movement record
        const movementRef = doc(collection(db, "movements"));
        transaction.set(movementRef, {
          movementId: movementRef.id,
          type: "transfer_to_outlet",
          from: "productStock",
          fromId: productStockId,
          to: `outlet_${selectedOutlet.outletId}`,
          outletId: selectedOutlet.outletId,
          outletName: selectedOutlet.outletName,

          // Product details
          productId: productStock.productId,
          productName: productStock.productName,
          productCode: productStock.productCode,
          batchNumber: productStock.batchNumber,
          productionBatch: productStock.productionBatch,

          // Transfer details
          quantity: transferQty,
          unit: productStock.unit,
          costPerUnit: productStock.costPerUnit || 0,
          retailPrice: productStock.retailPrice || 0,
          wholesalePrice: productStock.wholesalePrice || 0,
          totalValue: transferQty * (productStock.retailPrice || 0),

          // Stock levels
          previousMainStock: currentMainStock,
          newMainStock: currentMainStock - transferQty,

          // Metadata
          performedBy: currentUser.userId,
          performedByName: currentUser.fullName,
          timestamp: serverTimestamp(),
          notes: `Stock transfer to ${selectedOutlet.name} - Batch: ${productStock.batchNumber}`,
        });
      });

      // Clear the transfer quantity for this product
      setTransferQuantities((prev) => ({
        ...prev,
        [productStockId]: "",
      }));

      // Reload data
      await loadProducts();
      await loadOutletStock(selectedOutlet.id);

      setSuccessMessage(
        `Successfully transferred ${transferQty} ${productStock.unit} of ${productStock.productName} (Batch: ${productStock.batchNumber}) to ${selectedOutlet.name}`
      );
      setShowSuccess(true);
    } catch (error) {
      console.error("Error transferring stock:", error);
      setErrorMessage(error.message || "Failed to transfer stock");
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  if (authLoading || loading) {
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Outlet Stock Management
          </h1>
          <p className="text-gray-600">
            Transfer stock from main inventory to outlets
          </p>
        </div>

        {/* Outlet Selector */}
        <OutletSelector
          selectedOutlet={selectedOutlet}
          onOutletSelect={setSelectedOutlet}
        />

        {/* Quick Actions Bar */}
        {selectedOutlet && products.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTransferQuantities({});
                }}
              >
                Clear All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadProducts();
                  loadOutletStock(selectedOutlet.id);
                }}
              >
                Refresh
              </Button>
            </div>
          </div>
        )}

        {/* Stock Table */}
        {selectedOutlet ? (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Stock Transfer - {selectedOutlet.name}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Transfer stock from main inventory to this outlet
              </p>
            </div>

            {products.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">📦</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No products found
                </h3>
                <p className="text-gray-600">
                  Add products to your main inventory first
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Product Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Main Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Unit Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Outlet Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Transfer Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {products.map((product) => (
                      <tr
                        key={product.productionId}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {product.productName}
                          </div>
                          {product.sku && (
                            <div className="text-sm text-gray-500">
                              SKU: {product.sku}
                            </div>
                          )}
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
                          {formatCurrency(product.retailPrice || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-blue-600">
                            {outletStock[product.productId]?.quantity || 0}{" "}
                            units
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            min="0"
                            max={product.quantity}
                            value={
                              transferQuantities[product.productionId] || ""
                            }
                            onChange={(e) =>
                              handleTransferQuantityChange(
                                product.productionId,
                                e.target.value
                              )
                            }
                            placeholder="0"
                            className="w-24 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            disabled={product.quantity === 0}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Button
                            size="sm"
                            onClick={() =>
                              handleStockTransfer(
                                product.productionId,
                                product.stockId
                              )
                            }
                            disabled={
                              product.quantity === 0 ||
                              !transferQuantities[product.productionId] ||
                              parseInt(
                                transferQuantities[product.productionId]
                              ) <= 0
                            }
                          >
                            Transfer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary Section */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <div className="text-sm text-gray-600">Total Products</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {products.length}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-sm text-gray-600">
                    Total Main Stock Value
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(
                      products.reduce(
                        (sum, p) =>
                          sum + (p.quantity || 0) * (p.unitPrice || 0),
                        0
                      )
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <div className="text-sm text-gray-600">
                    Total Outlet Stock Value
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(
                      Object.keys(outletStock).reduce((sum, productId) => {
                        const product = products.find(
                          (p) => p.id === productId
                        );
                        const stock = outletStock[productId];
                        return (
                          sum +
                          (stock?.quantity || 0) * (product?.unitPrice || 0)
                        );
                      }, 0)
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-gray-400 text-6xl mb-4">🏪</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Outlet Selected
            </h3>
            <p className="text-gray-600">
              Please select an outlet to manage its stock
            </p>
          </div>
        )}

        {/* Success Dialog */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="Transfer Successful!"
          message={successMessage}
          buttonText="Continue"
        />

        {/* Error Dialog */}
        <FailDialog
          isOpen={showError}
          onClose={() => setShowError(false)}
          title="Transfer Failed"
          message={errorMessage}
          buttonText="Try Again"
          onRetry={() => setShowError(false)}
        />
      </div>
    </div>
  );
};

export default OutletsStock;
