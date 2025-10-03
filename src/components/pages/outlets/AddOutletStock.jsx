import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";

const AddOutletStock = ({ outletId, onSuccess }) => {
  const { user } = useUser();
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedBatchData, setSelectedBatchData] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    fetchProductsAndBatches();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      const batchData = batches.find((b) => b.id === selectedBatch);
      setSelectedBatchData(batchData);
    } else {
      setSelectedBatchData(null);
    }
  }, [selectedBatch, batches]);

  const fetchProductsAndBatches = async () => {
    setLoadingData(true);
    try {
      const [productsSnap, batchesSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "production_batches")),
      ]);

      const productsData = productsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const batchesData = batchesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProducts(productsData);
      setBatches(batchesData);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to load products and batches");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProduct || !selectedBatch || !quantity) {
      alert("Please fill all fields");
      return;
    }

    const qty = parseInt(quantity);

    // Validate quantity
    if (qty <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }

    if (qty > selectedBatchData.quantityProduced) {
      alert(
        `Not enough stock! Available: ${selectedBatchData.quantityProduced}`
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Add stock to outlet
      const stockRef = collection(db, `outlets/${outletId}/stock`);
      await addDoc(stockRef, {
        productId: selectedProduct,
        productRef: doc(db, "products", selectedProduct),
        batchId: selectedBatch,
        batchRef: doc(db, "production_batches", selectedBatch),
        qtyAvailable: qty,
        qtyAdded: qty,
        movementType: "production_to_outlet",
        lastUpdated: serverTimestamp(),
        addedBy: user?.userId || user?.uid || "unknown",
      });

      // 2. Create product movement record
      await addDoc(collection(db, "product_movements"), {
        from: "production",
        to: "outlet",
        outletId: outletId,
        batchId: selectedBatch,
        productId: selectedProduct,
        quantity: qty,
        movementType: "production_to_outlet",
        timestamp: serverTimestamp(),
        performedBy: user?.userId || user?.uid || "unknown",
      });

      // 3. Update batch quantity
      const batchRef = doc(db, "production_batches", selectedBatch);
      await updateDoc(batchRef, {
        quantityProduced: increment(-qty),
        updatedAt: serverTimestamp(),
      });

      setSelectedProduct("");
      setSelectedBatch("");
      setQuantity("");
      setSelectedBatchData(null);
      alert("Stock added successfully!");

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error adding stock:", error);
      alert("Failed to add stock");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <p className="text-gray-600">Loading products and batches...</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-lg shadow-sm border"
    >
      <h3 className="text-xl font-semibold mb-4">Add Stock to Outlet</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          >
            <option value="">Select Product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name || product.productName || product.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Batch
          </label>
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          >
            <option value="">Select Batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.batchId || batch.batchNumber || batch.id} - Available:{" "}
                {batch.quantityProduced}
              </option>
            ))}
          </select>
        </div>

        {/* Batch Details */}
        {selectedBatchData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-blue-900 mb-3">Batch Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Available Qty:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  {selectedBatchData.quantityProduced}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Selling Price:</span>
                <span className="ml-2 font-semibold text-green-600">
                  Rs. {selectedBatchData.sellingPrice}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Unit Cost:</span>
                <span className="ml-2 font-semibold text-gray-900">
                  Rs. {selectedBatchData.unitCost}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Batch ID:</span>
                <span className="ml-2 font-semibold text-gray-900 text-xs">
                  {selectedBatchData.batchId}
                </span>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity to Transfer
          </label>
          <input
            type="number"
            min="1"
            max={selectedBatchData?.quantityProduced || ""}
            placeholder="Enter quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
          {selectedBatchData && quantity && (
            <p className="text-sm text-gray-500 mt-1">
              Total Value: Rs.{" "}
              {(parseInt(quantity) * selectedBatchData.sellingPrice).toFixed(2)}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !selectedBatchData}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add Stock to Outlet"}
        </button>
      </div>
    </form>
  );
};

export default AddOutletStock;
