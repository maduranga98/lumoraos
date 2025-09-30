// src/components/pages/inventory/OutletSelector.jsx
import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../services/firebase";

const OutletSelector = ({ selectedOutlet, onOutletSelect }) => {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOutlets();
  }, []);

  const loadOutlets = async () => {
    try {
      setLoading(true);
      const outletsQuery = query(
        collection(db, "outlets"),
        where("status", "==", "active")
      );
      const snapshot = await getDocs(outletsQuery);
      const outletsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setOutlets(outletsData);
    } catch (error) {
      console.error("Error loading outlets:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Outlet
      </label>
      <select
        value={selectedOutlet?.id || ""}
        onChange={(e) => {
          const outlet = outlets.find((o) => o.id === e.target.value);
          onOutletSelect(outlet || null);
        }}
        className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">-- Select an Outlet --</option>
        {outlets.map((outlet) => (
          <option key={outlet.outletIds} value={outlet.outletId}>
            {outlet.outletName} - {outlet.address}
          </option>
        ))}
      </select>
    </div>
  );
};

export default OutletSelector;
