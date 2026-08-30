/**
 * Shared ExcelJS column definitions (T296–T298) — Products, Inventory, and
 * SOLD OUT all report the exact same `ProductExportRow` shape (spec
 * FR-103/FR-106/FR-108), so their three Route Handlers share one column
 * list rather than three copies that could drift out of sync.
 */
export const PRODUCT_EXPORT_COLUMNS = [
  { header: "Product ID", key: "id", width: 24 },
  { header: "Name (English)", key: "nameEn", width: 28 },
  { header: "Name (Arabic)", key: "nameAr", width: 28 },
  { header: "Category", key: "category", width: 18 },
  { header: "Price", key: "price", width: 12 },
  { header: "Stock", key: "stock", width: 10 },
  { header: "Sold Out", key: "soldOut", width: 10 },
  { header: "Availability", key: "availability", width: 12 },
  { header: "New Arrival", key: "newArrival", width: 12 },
  { header: "Best Seller", key: "bestSeller", width: 12 },
];
