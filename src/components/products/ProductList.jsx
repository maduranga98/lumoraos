// components/products/ProductList.jsx
import React, { useState, useMemo } from "react";
import ProductTable from "./ProductTable";
import ProductFilters from "./ProductFilters";
import ProductStatistics from "./ProductStatistics";
import ProductModal from "./ProductModal";

const ProductList = ({
  products = [],
  loading = false,
  columns = [],
  filters = [],
  sortOptions = [],
  statistics = [],
  modalFields = [],
  onProductUpdate,
  onProductDelete,
  onProductView,
  emptyState = {},
  selectable = false,
  actions = [],
  customFilterActions = [],
  title = "Products",
  subtitle = "",
  className = "",
}) => {
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({});
  const [selectedSort, setSelectedSort] = useState(sortOptions[0]?.value || "");

  // Selection states
  const [selectedItems, setSelectedItems] = useState([]);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Apply search
    if (searchTerm) {
      filtered = filtered.filter((product) => {
        return columns.some((column) => {
          const value = product[column.key];
          return value
            ?.toString()
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        });
      });
    }

    // Apply filters
    Object.entries(selectedFilters).forEach(([filterKey, filterValue]) => {
      if (filterValue && filterValue !== "all") {
        const filter = filters.find((f) => f.key === filterKey);
        if (filter?.filterFn) {
          filtered = filtered.filter((product) =>
            filter.filterFn(product, filterValue)
          );
        } else {
          filtered = filtered.filter(
            (product) => product[filterKey] === filterValue
          );
        }
      }
    });

    // Apply sorting
    if (selectedSort) {
      const [sortKey, sortOrder] = selectedSort.split("-");
      filtered.sort((a, b) => {
        let aVal = a[sortKey];
        let bVal = b[sortKey];

        if (typeof aVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        const result = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        return sortOrder === "desc" ? -result : result;
      });
    }

    return filtered;
  }, [products, searchTerm, selectedFilters, selectedSort, columns, filters]);

  // Handlers
  const handleFilterChange = (filterKey, value) => {
    setSelectedFilters((prev) => ({ ...prev, [filterKey]: value }));
  };

  const handleSelectItem = (productId, checked) => {
    setSelectedItems((prev) => {
      if (checked) {
        return [...prev, productId];
      } else {
        return prev.filter((id) => id !== productId);
      }
    });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedItems(filteredProducts.map((p) => p.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleViewProduct = (product) => {
    setSelectedProduct(product);
    setShowModal(true);
    onProductView?.(product);
  };

  const handleUpdateProduct = async (productId, data) => {
    try {
      setModalLoading(true);
      await onProductUpdate?.(productId, data);
    } finally {
      setModalLoading(false);
    }
  };

  // Default actions if not provided
  const defaultActions = [
    {
      icon: require("lucide-react").Eye,
      onClick: handleViewProduct,
      className: "text-blue-600 hover:text-blue-900",
      title: "View details",
    },
  ];

  const finalActions = actions.length > 0 ? actions : defaultActions;

  return (
    <div className={className}>
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-6">
          {title && (
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          )}
          {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
        </div>
      )}

      {/* Statistics */}
      {statistics.length > 0 && (
        <div className="mb-6">
          <ProductStatistics stats={statistics} />
        </div>
      )}

      {/* Filters */}
      {(filters.length > 0 ||
        sortOptions.length > 0 ||
        customFilterActions.length > 0) && (
        <ProductFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filters={filters}
          selectedFilters={selectedFilters}
          onFilterChange={handleFilterChange}
          sortOptions={sortOptions}
          selectedSort={selectedSort}
          onSortChange={setSelectedSort}
          customActions={customFilterActions}
        />
      )}

      {/* Selected Items Actions */}
      {selectable && selectedItems.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">
              {selectedItems.length} item(s) selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedItems([])}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <ProductTable
          products={filteredProducts}
          loading={loading}
          columns={columns}
          actions={finalActions}
          emptyState={emptyState}
          onRowClick={onProductView ? handleViewProduct : undefined}
          selectable={selectable}
          selectedItems={selectedItems}
          onSelectItem={handleSelectItem}
          onSelectAll={handleSelectAll}
        />
      </div>

      {/* Product Modal */}
      {showModal && selectedProduct && modalFields.length > 0 && (
        <ProductModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          product={selectedProduct}
          fields={modalFields}
          onSave={handleUpdateProduct}
          loading={modalLoading}
        />
      )}
    </div>
  );
};

export default ProductList;
