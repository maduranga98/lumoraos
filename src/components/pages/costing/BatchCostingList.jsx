import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import { useNavigate } from "react-router-dom";
import Button from "../../ui/Button";

const BatchCostingList = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();

  const [batches, setBatches] = useState([]);
  const [costings, setCostings] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  useEffect(() => {
    filterBatches();
  }, [batches, costings, searchTerm, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadBatches(), loadCostings()]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async () => {
    try {
      const batchesQuery = query(
        collection(db, "production_batches"),
        orderBy("productionDate", "desc")
      );
      const snapshot = await getDocs(batchesQuery);
      const batchesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setBatches(batchesData);
    } catch (error) {
      console.error("Error loading batches:", error);
    }
  };

  const loadCostings = async () => {
    try {
      const costingsQuery = query(collection(db, "batch_costing"));
      const snapshot = await getDocs(costingsQuery);
      const costingsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCostings(costingsData);
    } catch (error) {
      console.error("Error loading costings:", error);
    }
  };

  const filterBatches = () => {
    let filtered = batches.map((batch) => {
      const costing = costings.find((c) => c.batchId === batch.id);
      return {
        ...batch,
        costingId: costing?.id || null,
        costingStatus: costing?.status || "uncosted",
        unitCost: costing?.costs?.unitCost || null,
        retailPrice: costing?.pricing?.retailPrice || null,
        wholesalePrice: costing?.pricing?.wholesalePrice || null,
      };
    });

    if (searchTerm) {
      filtered = filtered.filter(
        (batch) =>
          batch.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter(
        (batch) => batch.costingStatus === filterStatus
      );
    }

    setFilteredBatches(filtered);
  };

  const getStatusBadge = (status) => {
    const badges = {
      uncosted: "bg-gray-100 text-gray-800",
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return badges[status] || badges.uncosted;
  };

  const getStatusLabel = (status) => {
    const labels = {
      uncosted: "Not Costed",
      pending: "Pending Approval",
      approved: "Approved",
      rejected: "Rejected",
    };
    return labels[status] || "Unknown";
  };

  const formatCurrency = (amount) => {
    if (!amount) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleAddCosting = (batch) => {
    navigate("/add-batch-costing", { state: { batch } });
  };

  const handleEditCosting = (batch) => {
    navigate("/add-batch-costing", {
      state: { batch, costingId: batch.costingId },
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const stats = {
    total: filteredBatches.length,
    uncosted: filteredBatches.filter((b) => b.costingStatus === "uncosted")
      .length,
    pending: filteredBatches.filter((b) => b.costingStatus === "pending")
      .length,
    approved: filteredBatches.filter((b) => b.costingStatus === "approved")
      .length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
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

        {/* Header */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Batch Costing
              </h1>
              <p className="text-gray-600">
                Manage production batch costs, pricing, and margins
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium">Total Batches</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">
                {stats.total}
              </p>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
              <p className="text-sm text-gray-600 font-medium">Not Costed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {stats.uncosted}
              </p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4">
              <p className="text-sm text-yellow-600 font-medium">Pending</p>
              <p className="text-2xl font-bold text-yellow-900 mt-1">
                {stats.pending}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <p className="text-sm text-green-600 font-medium">Approved</p>
              <p className="text-2xl font-bold text-green-900 mt-1">
                {stats.approved}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                placeholder="Search by batch ID, product name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="uncosted">Not Costed</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {/* Batches List */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {filteredBatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
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
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No batches found
              </h3>
              <p className="text-gray-600">
                {searchTerm || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : "No production batches available"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Batch Info
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Product
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">
                      Quantity
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">
                      Unit Cost
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">
                      Retail Price
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredBatches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-semibold text-gray-900">
                            {batch.batchId || batch.batchNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDate(batch.productionDate)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {batch.productName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-semibold text-gray-900">
                          {batch.quantityProduced}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(batch.unitCost)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-semibold text-green-700">
                          {formatCurrency(batch.retailPrice)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                            batch.costingStatus
                          )}`}
                        >
                          {getStatusLabel(batch.costingStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {batch.costingStatus === "uncosted" ? (
                          <Button
                            onClick={() => handleAddCosting(batch)}
                            size="sm"
                          >
                            Add Costing
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleEditCosting(batch)}
                            size="sm"
                            variant="secondary"
                          >
                            View Details
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchCostingList;
