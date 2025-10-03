import { useState } from "react";
import { doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";

const OutletStockCard = ({ outletId, stock, onDelete, onEdit }) => {
  const { user } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [quantity, setQuantity] = useState(stock.qtyAvailable);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm("Delete this stock entry?")) return;

    try {
      await deleteDoc(doc(db, `outlets/${outletId}/stock`, stock.id));
      if (onDelete) onDelete();
    } catch (error) {
      console.error("Error deleting stock:", error);
      alert("Failed to delete stock");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!quantity || quantity < 0) {
      alert("Please enter a valid quantity");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, `outlets/${outletId}/stock`, stock.id), {
        qtyAvailable: parseInt(quantity),
        lastUpdated: serverTimestamp(),
        addedBy: user?.userId || user?.uid || "unknown",
      });

      setIsEditing(false);
      if (onEdit) onEdit();
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Failed to update stock");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setQuantity(stock.qtyAvailable);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form
        onSubmit={handleUpdate}
        className="bg-white p-5 rounded-lg shadow-sm border"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              type="number"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white p-5 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="text-lg font-semibold text-gray-800">
            {stock.productName || "Product"}
          </h4>
          <p className="text-sm text-gray-500">
            Batch: {stock.batchNumber || stock.batchId || "N/A"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="text-blue-500 hover:text-blue-700 text-sm font-medium"
          >
            Edit
          </button>

          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Available Quantity:</span>
          <span className="text-xl font-bold text-blue-600">
            {stock.qtyAvailable}
          </span>
        </div>

        {stock.lastUpdated && (
          <p className="text-xs text-gray-400">
            Last updated:{" "}
            {new Date(stock.lastUpdated?.toDate()).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
};

export default OutletStockCard;
