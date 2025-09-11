import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../services/firebase";

export const useOutlets = (options = {}) => {
  const {
    activeOnly = true,
    orderByField = "outletName",
    orderDirection = "asc",
  } = options;

  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadOutlets = async () => {
    try {
      setLoading(true);
      setError(null);

      let outletsQuery = collection(db, "outlets");

      // Build query with filters
      const queryConstraints = [];

      if (activeOnly) {
        queryConstraints.push(where("status", "==", "active"));
      }

      queryConstraints.push(orderBy(orderByField, orderDirection));

      if (queryConstraints.length > 0) {
        outletsQuery = query(outletsQuery, ...queryConstraints);
      }

      const outletsSnapshot = await getDocs(outletsQuery);
      const outletsData = outletsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setOutlets(outletsData);
    } catch (err) {
      console.error("Error loading outlets:", err);
      setError("Failed to load outlets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOutlets();
  }, [activeOnly, orderByField, orderDirection]);

  const refetch = () => {
    loadOutlets();
  };

  return {
    outlets,
    loading,
    error,
    refetch,
  };
};
