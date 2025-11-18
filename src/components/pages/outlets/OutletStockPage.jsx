import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../services/firebase";
import AddOutletStock from "./AddOutletStock";
import OutletStockCard from "./OutletStockCard";

const OutletStockPage = () => {
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState("");
  const [stocks, setStocks] = useState([]);
  const [products, setProducts] = useState({});
  const [batches, setBatches] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingOutlets, setLoadingOutlets] = useState(true);

  useEffect(() => {
    fetchOutlets();
    fetchProductsAndBatches();
  }, []);

  const fetchOutlets = async () => {
    setLoadingOutlets(true);
    try {
      const querySnapshot = await getDocs(collection(db, "outlets"));
      const outletsData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOutlets(outletsData);
    } catch (error) {
      console.error("Error fetching outlets:", error);
      alert("Failed to load outlets");
    } finally {
      setLoadingOutlets(false);
    }
  };

  const fetchProductsAndBatches = async () => {
    try {
      const [productsSnap, batchesSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "production_batches")),
      ]);

      const productsMap = {};
      productsSnap.docs.forEach((doc) => {
        productsMap[doc.id] = { id: doc.id, ...doc.data() };
      });

      const batchesMap = {};
      batchesSnap.docs.forEach((doc) => {
        batchesMap[doc.id] = { id: doc.id, ...doc.data() };
      });

      setProducts(productsMap);
      setBatches(batchesMap);
    } catch (error) {
      console.error("Error fetching products/batches:", error);
    }
  };

  const fetchOutletStock = useCallback(async () => {
    if (!selectedOutlet) return;

    setLoading(true);
    try {
      const stockRef = collection(db, `outlets/${selectedOutlet}/stock`);
      const querySnapshot = await getDocs(stockRef);

      const stockData = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          productName:
            products[data.productId]?.name ||
            products[data.productId]?.productName ||
            "Unknown Product",
          batchNumber:
            batches[data.batchId]?.batchNumber ||
            batches[data.batchId]?.batchId ||
            "Unknown Batch",
        };
      });

      setStocks(stockData);
    } catch (error) {
      console.error("Error fetching outlet stock:", error);
      alert("Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, [selectedOutlet, products, batches]);

  useEffect(() => {
    if (selectedOutlet) {
      fetchOutletStock();
    }
  }, [selectedOutlet, fetchOutletStock]);

  const selectedOutletData = outlets.find((o) => o.id === selectedOutlet);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </button>

        {/* Page Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h1 className="text-3xl font-bold text-gray-900">
            Outlet Stock Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage stock levels for each outlet
          </p>
        </div>

        {/* Outlet Selection */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Outlet
          </label>
          {loadingOutlets ? (
            <p className="text-gray-600">Loading outlets...</p>
          ) : (
            <select
              value={selectedOutlet}
              onChange={(e) => setSelectedOutlet(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg"
            >
              <option value="">-- Choose an Outlet --</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name} - {outlet.location}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Content - Only show when outlet is selected */}
        {selectedOutlet && (
          <>
            {/* Selected Outlet Info */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">
                {selectedOutletData?.name}
              </h2>
              <p className="flex items-center gap-2 text-blue-100">
                <span>📍</span>
                {selectedOutletData?.location}
              </p>
            </div>

            {/* Add Stock Form */}
            <AddOutletStock
              outletId={selectedOutlet}
              onSuccess={fetchOutletStock}
            />

            {/* Stock List */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h3 className="text-2xl font-semibold mb-6 text-gray-900">
                Current Stock
              </h3>

              {loading && (
                <div className="text-center py-8">
                  <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-600 mt-3">Loading stock...</p>
                </div>
              )}

              {!loading && stocks.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <svg
                    className="w-16 h-16 mx-auto mb-4 text-gray-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="text-lg">No stock entries found</p>
                  <p className="text-sm">Add stock using the form above</p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stocks.map((stock) => (
                  <OutletStockCard
                    key={stock.id}
                    outletId={selectedOutlet}
                    stock={stock}
                    onDelete={fetchOutletStock}
                    onEdit={fetchOutletStock}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Empty State - No outlet selected */}
        {!selectedOutlet && !loadingOutlets && (
          <div className="bg-white rounded-2xl shadow-lg p-12 border border-gray-100 text-center">
            <svg
              className="w-20 h-20 mx-auto mb-4 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <p className="text-xl text-gray-600 mb-2">
              Please select an outlet
            </p>
            <p className="text-gray-400">
              Choose an outlet from the dropdown above to view and manage its
              stock
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutletStockPage;
