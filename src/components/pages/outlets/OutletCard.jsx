import { useState } from "react";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../services/firebase";

const OutletCard = ({ outlet, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(outlet.name);
  const [location, setLocation] = useState(outlet.location);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${outlet.name}"?`)) return;

    try {
      await deleteDoc(doc(db, "outlets", outlet.id));
      if (onDelete) onDelete();
    } catch (error) {
      console.error("Error deleting outlet:", error);
      alert("Failed to delete outlet");
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!name.trim() || !location.trim()) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, "outlets", outlet.id), {
        name: name.trim(),
        location: location.trim(),
      });

      setIsEditing(false);
      if (onEdit) onEdit();
    } catch (error) {
      console.error("Error updating outlet:", error);
      alert("Failed to update outlet");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setName(outlet.name);
    setLocation(outlet.location);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form
        onSubmit={handleUpdate}
        className="bg-white p-5 rounded-lg shadow-sm border"
      >
        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />

          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />

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
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-gray-800">{outlet.name}</h3>

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

      <p className="text-gray-600 flex items-center gap-2">
        <span className="text-gray-400">📍</span>
        {outlet.location}
      </p>
    </div>
  );
};

export default OutletCard;
