import { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../../services/firebase";

const AddOutletForm = ({ onSuccess }) => {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !location.trim()) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "outlets"), {
        name: name.trim(),
        location: location.trim(),
      });

      setName("");
      setLocation("");
      alert("Outlet added successfully!");

      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error adding outlet:", error);
      alert("Failed to add outlet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-lg shadow-sm border"
    >
      <h2 className="text-xl font-semibold mb-4">Add New Outlet</h2>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="Outlet Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />

        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add Outlet"}
        </button>
      </div>
    </form>
  );
};

export default AddOutletForm;
