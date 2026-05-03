
export enum Department {
  BRAND = "Brand",
  MKT_ONLINE_YODY = "MKT Online YODY",
  MKT_ONLINE_NEVO = "MKT Online NEVO",
  MKT_VUNG = "MKT Vùng",
  OMNI_SHOPEE = "OMNI/SHOPEE",
  OMNI_TIKTOK = "OMNI/TIKTOK",
  OMNI_SALE = "OMNI/SALE",
  TRADE = "Trade",
  BVH = "BVH",
  NSHP = "NSHP",
  PHONG_BAN_KHAC = "Phòng ban khác",
  MKT_CRM = "MKT CRM",
}

export enum Status {
  HOAN_TAT = "Hoàn tất",
  DANG_HAU_KI = "Đang hậu kì",
  XAC_NHAN = "Xác nhận",
  CHO_DUYET = "Chờ duyệt",
  DANG_QUAY = "Đang thực hiện",
  HUY = "Hủy",
}

// Keep Enums for legacy support if needed, but lists below are now independent
export enum Stylist {
  KHONG = "Không",
  LOAN_OUTSOURCE = "Loan - Outsource",
  THU_OUTSOURCE = "Thu - Outsource",
  LOAN_YD15118 = "Loan - YD15118",
  THU_YD0181 = "Thu - YD0181",
}

export enum VideoEditor {
  A_BANH = "A Bành",
  A_BANH_OUT = "A Bành - Outsource",
  TUAN_ANH = "Tuấn Anh",
  TUAN_ANH_OUT = "Tuấn Anh - Outsource",
  QUOC_HUNG = "Quốc Hùng",
  QUOC_HUNG_OUT = "Quốc Hùng - Outsource",
}

export enum PhotoEditor {
  PHUONG_THAO = "Phương Thảo",
  PHUONG_THAO_OUT = "Phương Thảo - Outsource",
  KHANH_DUY = "Khánh Duy",
  KHANH_DUY_OUT = "Khánh Duy - Outsource",
}

export enum Designer {
  THUAN = "Thuận",
  DUAN = "Duẩn",
  YEN = "Yến",
  DUNG = "Dung",
  HOANG_KHANH = "Hoàng Khánh",
  PHUONG_LINH = "Phương Linh",
  HAU_NGUYEN = "Hậu Nguyễn",
  THAI = "Thái",
}

// --- HARDCODED LISTS (SYSTEM DEFAULTS) ---
// Danh sách được đồng bộ hóa với Enum Department
export const HARDCODED_LISTS: Record<string, string[]> = {
  department: [
    "Brand", "MKT Online YODY", "MKT Online NEVO", "MKT Vùng", "OMNI/SHOPEE", "OMNI/TIKTOK", "OMNI/SALE", "Trade", "BVH", "NSHP", "Phòng ban khác", "MKT CRM"
  ],
  status: [
    "Xác nhận", "Đang thực hiện", "Đang hậu kì", "Hoàn tất", "Chờ duyệt", "Hủy"
  ],
  stylist: [
    "Không", "Loan - Outsource", "Thu - Outsource", "Loan - YD15118", "Thu - YD0181", "ctv.phuong"
  ],
  videoPerson: [
    "A Bành", "A Bành - Outsource", "Tuấn Anh", "Tuấn Anh - Outsource", "Quốc Hùng", "Quốc Hùng - Outsource"
  ],
  photoPerson: [
    "Phương Thảo", "Phương Thảo - Outsource", "Khánh Duy", "Khánh Duy - Outsource"
  ],
  ctvStylist: [
    "Không", "Khác"
  ],
  ctvVideo: [
    "Không", "Khác"
  ],
  ctvPhoto: [
    "Không", "Khác"
  ],
  designer: [
    "Thuận", "Duẩn", "Yến", "Dung", "Hoàng Khánh", "Phương Linh", "Hậu Nguyễn", "Thái"
  ],
  orderer: [
    "Hiền Hồ Brand", "Tú Đinh Brand", "Thanh Nga Brand", "Linh Brand", "Tuyết Brand", "Lê Chân Brand", "Mai Uyên", "Viết Vinh Brand", "Huyền Brand", "Hường Digital", "Hà Digital", "Thành Digital", "Duyên Digital", "Trọng Digital", "Lập Digital", "Huế Digital", "Ngân Digital", "Phương Digital", "Long Online", "Tài Online", "Đức Online", "Nguyên Online", "Hiếu Online", "Hà Online", "Dương Trade", "Tuyên Trade", "Thương Trade", "Thanh Shopee", "Quyền Tiktok"
  ],
  productType: [
    "Polo", "Office", "Jeans Kaki", "Casual", "Kids", "Phụ kiện", "Áo khoác", "Len", "Thun", "Đồ lót"
  ],
  category: [
    "Hình ảnh", "Video", "Giả live", "Design", "Animation", "Khác"
  ],
  classType: [
    "New Arrival", "Shooting", "Restock", "Sale", "Best Seller", "Pre-order"
  ],
  platform: [
    "Facebook", "Tiktok", "Website", "Shopee", "Lazada", "Instagram", "Zalo"
  ]
};

// Use hardcoded lists as defaults
export const DEFAULT_ORDERERS = HARDCODED_LISTS.orderer;
export const DEFAULT_PRODUCT_TYPES = HARDCODED_LISTS.productType;

export interface ChangeLogEntry {
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  user?: string;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  target: string;
  details: string;
  module?: string;
}

export interface CostDetails {
  model: number;
  makeup: number;
  location: number;
  transport: number;
  outsource: {
    video: number;
    photo: number;
    stylist: number;
    assistant: number;
  };
  others: number;
  note: string;
}

export interface WorkOrder {
  id: string;
  department: string;    // Task/Phòng ban
  orderCode: string;     // Mã Order
  orderer: string;       // Người order
  category: string;      // Hình ảnh/Video/Thể loại/Loại hình
  title: string;         // Tiêu đề
  content: string;       // Brief (Nội dung)
  productType: string;   // CATE HÀNG
  classType: string;     // Phân loại
  status: string;        // Trạng thái
  isConfirmed: boolean;  // Trạng thái CV/Check xác nhận
  productLink: string;   // Link trả sản phẩm
  startDate: string;     // Ngày Order
  implementationDate: string; // Ngày triển khai (Tracking)
  dueDate: string;       // Deadline/Ngày đến hạn
  stylist: string;       // Stylist
  videoPerson: string;   // Video
  photoPerson: string;   // Photo
  ctvStylist?: string;   // CTV Stylist (NEW)
  ctvVideo?: string;     // CTV Video (NEW)
  ctvPhoto?: string;     // CTV Photo (NEW)
  designer?: string;     // Người phụ trách (Design) - NEW
  platform?: string;     // Nền tảng (Design) - NEW
  estimatedCost: string; // Chi phí dự kiến (Tổng)
  costDetails?: CostDetails; // Chi tiết chi phí
  trackingNote: string;  // Ghi chú (Tracking)
  historyLogs?: ChangeLogEntry[]; // Lịch sử thay đổi
  isDraft?: boolean;     // Trạng thái nháp (đã đặt chỗ mã nhưng chưa lưu)
}

// --- BUDGET TRACKING INTERFACE ---
export interface BudgetItem {
  id: string;
  date: string;
  content: string;
  tag: string; // Loại chi
  pic: string; // Người chi
  
  // Dynamic Cost Columns: key matches the BudgetColumnConfig.name (or id)
  // Example: { "Chi phí Daily Task": 100000, "Chi phí SX BST": 200000 }
  [key: string]: any; 
}

export interface BudgetColumnConfig {
  id: string;
  name: string;      // Display Name (and Key for DB)
  code: string;      // Mã dòng tiền (e.g. Y26.1043)
  plan: number;      // Budget Plan Amount
  order: number;     // Display Order
}

// --- PLAN & STRATEGY INTERFACE (NEW) ---
export interface PlanItem {
  id: string;
  monthYear: string; // Format: "MM/YYYY" e.g., "02/2025"
  department: string; // "Bộ phận"
  campaign: string; // "Loại nguyên liệu/Chiến dịch"
  format: string; // "Định dạng"
  totalTarget: number; // "Tổng Target"
  outcome: string; // "Outcome"
  comment: string; // "Creative comment"
  estimatedCost: number; // "Chi phí dự kiến"
  updatedAt?: string; // ISO timestamp for conflict detection
  
  // Dynamic daily columns: key "d1", "d2"... "d31"
  // Value represents quantity for that day
  [key: string]: any;
}

// --- MASTER DATA INTERFACE ---
export interface MasterDataItem {
  id: string;
  listKey: string; // e.g., 'orderer', 'department', 'status', 'SYSTEM_USERS'
  value: string;   // Also used for Email in UserAccount
  color?: string;  // Used for Password in UserAccount (Hack for storage)
  textColor?: string; // Used for Role in UserAccount
  order?: number;
  isSystem?: boolean; // Flag to indicate hardcoded items
  description?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  password?: string;
  name?: string;
  role: 'admin' | 'member' | 'collaborator';
}

// Generate Default Master Data from Hardcoded Lists for Fallback
export const DEFAULT_MASTER_DATA: MasterDataItem[] = Object.entries(HARDCODED_LISTS).flatMap(([key, values]) => 
  values.map((val, idx) => ({
    id: `hardcoded-${key}-${idx}`,
    listKey: key,
    value: val,
    order: idx,
    isSystem: true
  }))
);

export const INITIAL_DATA: WorkOrder[] = [];
