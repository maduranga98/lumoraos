import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useUser } from "../../../contexts/userContext";
import Button from "../../ui/Button";
import InputField from "../../ui/InputField";
import SuccessDialog from "../../ui/SuccessDialog";
import FailDialog from "../../ui/FailDialog";

const AddBatchCosting = () => {
  const { user: currentUser, loading: authLoading } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  // Get batch data from navigation state
  const batch = location.state?.batch;
  const costingId = location.state?.costingId;
  const isEditMode = !!costingId;

  // State
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Available options
  const [rawMaterials, setRawMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Form Data
  const [formData, setFormData] = useState({
    batchId: batch?.id || "",
    productId: batch?.productId || "",
    productName: batch?.productName || "",
    batchNumber: batch?.batchNumber || batch?.batchId || "",
    quantity: batch?.quantityProduced || 0,

    // Costs
    rawMaterialCosts: [],
    laborCosts: [],
    overheadCosts: [],

    // Pricing
    retailMarginPercentage: "",
    wholesaleMarginPercentage: "",

    // Free Issues & Discounts (for later)
    freeIssues: [],
    discounts: [],

    notes: "",
  });

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate("/login");
    }
  }, [authLoading, currentUser, navigate]);

  useEffect(() => {
    if (!batch) {
      setErrorMessage("No batch data found");
      setShowError(true);
      setTimeout(() => navigate("/batch-costing"), 2000);
      return;
    }

    if (currentUser) {
      loadInitialData();
    }
  }, [currentUser, batch]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      await Promise.all([loadRawMaterials(), loadSuppliers(), loadEmployees()]);

      if (isEditMode) {
        await loadExistingCosting();
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setErrorMessage("Failed to load data");
      setShowError(true);
    } finally {
      setLoadingData(false);
    }
  };

  const loadRawMaterials = async () => {
    try {
      const snapshot = await getDocs(collection(db, "raw_materials"));
      const materials = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRawMaterials(materials);
    } catch (error) {
      console.error("Error loading raw materials:", error);
    }
  };

  const loadSuppliers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "suppliers"));
      const suppliersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSuppliers(suppliersData);
    } catch (error) {
      console.error("Error loading suppliers:", error);
    }
  };

  const loadEmployees = async () => {
    try {
      const snapshot = await getDocs(collection(db, "users"));
      const employeesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEmployees(employeesData);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const loadExistingCosting = async () => {
    try {
      const costingDoc = await getDoc(doc(db, "batch_costing", costingId));
      if (costingDoc.exists()) {
        const data = costingDoc.data();
        setFormData((prev) => ({
          ...prev,
          rawMaterialCosts: data.costs?.rawMaterials || [],
          laborCosts: data.costs?.labor || [],
          overheadCosts: data.costs?.overheads || [],
          retailMarginPercentage: data.pricing?.retailMarginPercentage || "",
          wholesaleMarginPercentage:
            data.pricing?.wholesaleMarginPercentage || "",
          freeIssues: data.freeIssues || [],
          discounts: data.discounts || [],
          notes: data.notes || "",
        }));
      }
    } catch (error) {
      console.error("Error loading existing costing:", error);
    }
  };

  // Add Raw Material Cost
  const addRawMaterialCost = () => {
    setFormData((prev) => ({
      ...prev,
      rawMaterialCosts: [
        ...prev.rawMaterialCosts,
        {
          materialId: "",
          materialName: "",
          supplierId: "",
          supplierName: "",
          quantity: "",
          unitCost: "",
          totalCost: 0,
        },
      ],
    }));
  };

  const removeRawMaterialCost = (index) => {
    setFormData((prev) => ({
      ...prev,
      rawMaterialCosts: prev.rawMaterialCosts.filter((_, i) => i !== index),
    }));
  };

  const handleRawMaterialChange = (index, field, value) => {
    const updated = [...formData.rawMaterialCosts];
    updated[index][field] = value;

    // Auto-populate material name
    if (field === "materialId") {
      const material = rawMaterials.find((m) => m.id === value);
      if (material) {
        updated[index].materialName = material.name;
      }
    }

    // Auto-populate supplier name
    if (field === "supplierId") {
      const supplier = suppliers.find((s) => s.id === value);
      if (supplier) {
        updated[index].supplierName = supplier.name;
      }
    }

    // Calculate total cost
    if (field === "quantity" || field === "unitCost") {
      const qty = parseFloat(updated[index].quantity) || 0;
      const cost = parseFloat(updated[index].unitCost) || 0;
      updated[index].totalCost = qty * cost;
    }

    setFormData((prev) => ({
      ...prev,
      rawMaterialCosts: updated,
    }));
  };

  // Add Labor Cost
  const addLaborCost = () => {
    setFormData((prev) => ({
      ...prev,
      laborCosts: [
        ...prev.laborCosts,
        {
          workerId: "",
          workerName: "",
          laborType: "",
          hours: "",
          ratePerHour: "",
          totalCost: 0,
        },
      ],
    }));
  };

  const removeLaborCost = (index) => {
    setFormData((prev) => ({
      ...prev,
      laborCosts: prev.laborCosts.filter((_, i) => i !== index),
    }));
  };

  const handleLaborChange = (index, field, value) => {
    const updated = [...formData.laborCosts];
    updated[index][field] = value;

    // Auto-populate worker name
    if (field === "workerId") {
      const worker = employees.find((e) => e.id === value);
      if (worker) {
        updated[index].workerName = worker.fullName || worker.name;
      }
    }

    // Calculate total cost
    if (field === "hours" || field === "ratePerHour") {
      const hrs = parseFloat(updated[index].hours) || 0;
      const rate = parseFloat(updated[index].ratePerHour) || 0;
      updated[index].totalCost = hrs * rate;
    }

    setFormData((prev) => ({
      ...prev,
      laborCosts: updated,
    }));
  };

  // Add Overhead Cost
  const addOverheadCost = () => {
    setFormData((prev) => ({
      ...prev,
      overheadCosts: [
        ...prev.overheadCosts,
        {
          overheadType: "",
          description: "",
          amount: "",
        },
      ],
    }));
  };

  const removeOverheadCost = (index) => {
    setFormData((prev) => ({
      ...prev,
      overheadCosts: prev.overheadCosts.filter((_, i) => i !== index),
    }));
  };

  const handleOverheadChange = (index, field, value) => {
    const updated = [...formData.overheadCosts];
    updated[index][field] = value;

    setFormData((prev) => ({
      ...prev,
      overheadCosts: updated,
    }));
  };

  // Calculations
  const calculateTotalRawMaterialCost = () => {
    return formData.rawMaterialCosts.reduce(
      (sum, item) => sum + (parseFloat(item.totalCost) || 0),
      0
    );
  };

  const calculateTotalLaborCost = () => {
    return formData.laborCosts.reduce(
      (sum, item) => sum + (parseFloat(item.totalCost) || 0),
      0
    );
  };

  const calculateTotalOverheadCost = () => {
    return formData.overheadCosts.reduce(
      (sum, item) => sum + (parseFloat(item.amount) || 0),
      0
    );
  };

  const calculateGrandTotalCost = () => {
    return (
      calculateTotalRawMaterialCost() +
      calculateTotalLaborCost() +
      calculateTotalOverheadCost()
    );
  };

  const calculateUnitCost = () => {
    const grandTotal = calculateGrandTotalCost();
    const qty = parseFloat(formData.quantity) || 1;
    return grandTotal / qty;
  };

  const calculateRetailPrice = () => {
    const unitCost = calculateUnitCost();
    const margin = parseFloat(formData.retailMarginPercentage) || 0;
    return unitCost * (1 + margin / 100);
  };

  const calculateWholesalePrice = () => {
    const unitCost = calculateUnitCost();
    const margin = parseFloat(formData.wholesaleMarginPercentage) || 0;
    return unitCost * (1 + margin / 100);
  };

  const calculateRetailProfit = () => {
    return calculateRetailPrice() - calculateUnitCost();
  };

  const calculateWholesaleProfit = () => {
    return calculateWholesalePrice() - calculateUnitCost();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  if (authLoading || loadingData) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate("/batch-costing")}
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
          Back to Batch Costing List
        </button>

        {/* Header */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isEditMode ? "Edit" : "Add"} Batch Costing
          </h1>
          <p className="text-gray-600">
            Configure costs, pricing, and margins for production batch
          </p>
        </div>

        {/* Batch Information Display */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Batch Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <span className="text-xs font-medium text-blue-600">
                Batch Number
              </span>
              <p className="text-lg font-bold text-blue-900 mt-1">
                {formData.batchNumber}
              </p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <span className="text-xs font-medium text-purple-600">
                Product
              </span>
              <p className="text-lg font-bold text-purple-900 mt-1">
                {formData.productName}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <span className="text-xs font-medium text-green-600">
                Quantity
              </span>
              <p className="text-lg font-bold text-green-900 mt-1">
                {formData.quantity}
              </p>
            </div>
            <div className="bg-orange-50 rounded-xl p-4">
              <span className="text-xs font-medium text-orange-600">
                Unit Cost
              </span>
              <p className="text-lg font-bold text-orange-900 mt-1">
                {formatCurrency(calculateUnitCost())}
              </p>
            </div>
          </div>
        </div>

        {/* Success/Error Dialogs */}
        <SuccessDialog
          isOpen={showSuccess}
          onClose={() => {
            setShowSuccess(false);
            navigate("/batch-costing");
          }}
          message={successMessage}
        />
        <FailDialog
          isOpen={showError}
          onClose={() => setShowError(false)}
          message={errorMessage}
        />
      </div>
    </div>
  );
};

export default AddBatchCosting;
