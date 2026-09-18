/**
 * Shared ExcelJS column definitions (T296–T298, extended by T331) —
 * Products, Inventory, and SOLD OUT all report the exact same
 * `ProductExportRow` shape (spec FR-103/FR-106/FR-108/FR-124), so their
 * three Route Handlers share one column list rather than three copies that
 * could drift out of sync. The four Special Offers columns (spec FR-124)
 * apply here too, not just the Products report — a deliberate, structural
 * choice (the same row type, not a second one) rather than a gap, since an
 * admin reviewing Inventory or SOLD OUT stock benefits from seeing offer
 * state on the same row just as much as on the plain Products report.
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
  { header: "Offer Status", key: "offerStatus", width: 14 },
  { header: "On Sale", key: "isOnSale", width: 10 },
  { header: "Sale Price", key: "salePrice", width: 12 },
  { header: "Sale Start", key: "saleStartAt", width: 22 },
  { header: "Sale End", key: "saleEndAt", width: 22 },
];
