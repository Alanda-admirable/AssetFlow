import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  permissionsJson: text("permissions_json").notNull().default("[]"),
  ...timestamps,
});

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  building: text("building").notNull(),
  floor: text("floor"),
  room: text("room").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeCode: text("employee_code").unique(),
  username: text("username").unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordIterations: integer("password_iterations").notNull().default(210000),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  roleId: integer("role_id").references(() => roles.id),
  departmentId: integer("department_id").references(() => departments.id),
  status: text("status").notNull().default("active"),
  lastLoginAt: text("last_login_at"),
  ...timestamps,
});

export const authSessions = sqliteTable("auth_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenHash: text("token_hash").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  revokedAt: text("revoked_at"),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("auth_sessions_user_idx").on(table.userId),
  index("auth_sessions_expires_idx").on(table.expiresAt),
]);

export const assetCategories = sqliteTable("asset_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  usefulLifeYears: integer("useful_life_years").default(5),
  depreciationRate: real("depreciation_rate").default(20),
  ...timestamps,
});

export const manufacturers = sqliteTable("manufacturers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  website: text("website"),
  ...timestamps,
});

export const assetModels = sqliteTable("asset_models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").references(() => assetCategories.id),
  manufacturerId: integer("manufacturer_id").references(() => manufacturers.id),
  name: text("name").notNull(),
  modelNumber: text("model_number"),
  specificationsJson: text("specifications_json").notNull().default("{}"),
  ...timestamps,
}, (table) => [uniqueIndex("asset_model_unique").on(table.manufacturerId, table.name)]);

export const assetStatuses = sqliteTable("asset_statuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  color: text("color").notNull().default("blue"),
  deployable: integer("deployable", { mode: "boolean" }).notNull().default(false),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const suppliers = sqliteTable("suppliers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  taxId: text("tax_id"),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  ...timestamps,
});

export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetCode: text("asset_code").notNull().unique(),
  serialNumber: text("serial_number"),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => assetCategories.id),
  modelId: integer("model_id").references(() => assetModels.id),
  statusId: integer("status_id").references(() => assetStatuses.id),
  locationId: integer("location_id").references(() => locations.id),
  departmentId: integer("department_id").references(() => departments.id),
  assignedUserId: integer("assigned_user_id").references(() => users.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  purchaseDate: text("purchase_date"),
  receivedDate: text("received_date"),
  purchasePrice: real("purchase_price").notNull().default(0),
  budgetYear: text("budget_year"),
  budgetSource: text("budget_source"),
  warrantyEnd: text("warranty_end"),
  qrToken: text("qr_token").unique(),
  condition: text("condition").notNull().default("good"),
  createdBy: integer("created_by").references(() => users.id),
  ...timestamps,
}, (table) => [
  index("assets_status_idx").on(table.statusId),
  index("assets_location_idx").on(table.locationId),
  index("assets_department_idx").on(table.departmentId),
]);

export const assetImages = sqliteTable("asset_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  objectKey: text("object_key").notNull(),
  imageType: text("image_type").notNull().default("main"),
  altText: text("alt_text"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  ...timestamps,
});

export const assetRelations = sqliteTable("asset_relations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  parentAssetId: integer("parent_asset_id").notNull().references(() => assets.id),
  childAssetId: integer("child_asset_id").notNull().references(() => assets.id),
  relationType: text("relation_type").notNull().default("component"),
  ...timestamps,
}, (table) => [uniqueIndex("asset_relation_unique").on(table.parentAssetId, table.childAssetId)]);

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentNo: text("document_no"),
  documentType: text("document_type").notNull(),
  relatedType: text("related_type").notNull(),
  relatedId: integer("related_id").notNull(),
  title: text("title").notNull(),
  objectKey: text("object_key"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  checksum: text("checksum"),
  visibility: text("visibility").notNull().default("internal"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  ...timestamps,
});

export const documentRunningNumbers = sqliteTable("document_running_numbers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  documentType: text("document_type").notNull(),
  fiscalYear: text("fiscal_year").notNull(),
  prefix: text("prefix").notNull(),
  currentNumber: integer("current_number").notNull().default(0),
  padding: integer("padding").notNull().default(5),
  ...timestamps,
}, (table) => [uniqueIndex("document_running_unique").on(table.documentType, table.fiscalYear)]);

export const assetRequests = sqliteTable("asset_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestNo: text("request_no").notNull().unique(),
  requestType: text("request_type").notNull(),
  requesterId: integer("requester_id").references(() => users.id),
  departmentId: integer("department_id").references(() => departments.id),
  purpose: text("purpose").notNull(),
  useLocation: text("use_location"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  status: text("status").notNull().default("draft"),
  currentApprovalStep: integer("current_approval_step").notNull().default(0),
  submittedAt: text("submitted_at"),
  completedAt: text("completed_at"),
  ...timestamps,
}, (table) => [index("asset_requests_status_idx").on(table.status)]);

export const assetRequestItems = sqliteTable("asset_request_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull().references(() => assetRequests.id, { onDelete: "cascade" }),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  itemStatus: text("item_status").notNull().default("requested"),
  checkoutCondition: text("checkout_condition"),
  returnCondition: text("return_condition"),
  note: text("note"),
  ...timestamps,
});

export const approvalLogs = sqliteTable("approval_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").notNull().references(() => assetRequests.id, { onDelete: "cascade" }),
  stepNo: integer("step_no").notNull(),
  approverId: integer("approver_id").references(() => users.id),
  action: text("action").notNull(),
  comment: text("comment"),
  actedAt: text("acted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const assetMovements = sqliteTable("asset_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  movementType: text("movement_type").notNull(),
  fromLocationId: integer("from_location_id").references(() => locations.id),
  toLocationId: integer("to_location_id").references(() => locations.id),
  fromUserId: integer("from_user_id").references(() => users.id),
  toUserId: integer("to_user_id").references(() => users.id),
  requestId: integer("request_id").references(() => assetRequests.id),
  performedBy: integer("performed_by").references(() => users.id),
  note: text("note"),
  happenedAt: text("happened_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("asset_movements_asset_idx").on(table.assetId, table.happenedAt)]);

export const assetAcceptances = sqliteTable("asset_acceptances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: integer("request_id").references(() => assetRequests.id),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  acceptedBy: integer("accepted_by").references(() => users.id),
  acceptanceType: text("acceptance_type").notNull(),
  signatureObjectKey: text("signature_object_key"),
  acceptedAt: text("accepted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  note: text("note"),
});

export const returnChecklists = sqliteTable("return_checklists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestItemId: integer("request_item_id").notNull().references(() => assetRequestItems.id),
  checklistJson: text("checklist_json").notNull().default("[]"),
  overallCondition: text("overall_condition").notNull(),
  damageNote: text("damage_note"),
  checkedBy: integer("checked_by").references(() => users.id),
  checkedAt: text("checked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const maintenanceRecords = sqliteTable("maintenance_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  maintenanceNo: text("maintenance_no").notNull().unique(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  reportedBy: integer("reported_by").references(() => users.id),
  problem: text("problem").notNull(),
  priority: text("priority").notNull().default("normal"),
  repairType: text("repair_type").notNull().default("corrective"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  cost: real("cost").notNull().default(0),
  status: text("status").notNull().default("reported"),
  reportedAt: text("reported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  dueAt: text("due_at"),
  completedAt: text("completed_at"),
  note: text("note"),
  ...timestamps,
});

export const maintenanceSchedules = sqliteTable("maintenance_schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").references(() => assets.id),
  categoryId: integer("category_id").references(() => assetCategories.id),
  title: text("title").notNull(),
  frequencyMonths: integer("frequency_months").notNull(),
  nextDueDate: text("next_due_date").notNull(),
  checklistJson: text("checklist_json").notNull().default("[]"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const auditSessions = sqliteTable("audit_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  auditNo: text("audit_no").notNull().unique(),
  name: text("name").notNull(),
  fiscalYear: text("fiscal_year").notNull(),
  departmentId: integer("department_id").references(() => departments.id),
  locationId: integer("location_id").references(() => locations.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("planned"),
  createdBy: integer("created_by").references(() => users.id),
  ...timestamps,
});

export const auditItems = sqliteTable("audit_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  auditSessionId: integer("audit_session_id").notNull().references(() => auditSessions.id, { onDelete: "cascade" }),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  expectedLocationId: integer("expected_location_id").references(() => locations.id),
  foundLocationId: integer("found_location_id").references(() => locations.id),
  result: text("result").notNull().default("pending"),
  condition: text("condition"),
  checkedBy: integer("checked_by").references(() => users.id),
  checkedAt: text("checked_at"),
  note: text("note"),
});

export const auditCommittees = sqliteTable("audit_committees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  auditSessionId: integer("audit_session_id").notNull().references(() => auditSessions.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  committeeRole: text("committee_role").notNull(),
  ...timestamps,
});

export const auditSignoffs = sqliteTable("audit_signoffs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  auditSessionId: integer("audit_session_id").notNull().references(() => auditSessions.id),
  userId: integer("user_id").notNull().references(() => users.id),
  decision: text("decision").notNull(),
  comment: text("comment"),
  signedAt: text("signed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const contracts = sqliteTable("contracts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contractNo: text("contract_no").notNull().unique(),
  contractType: text("contract_type").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  title: text("title").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  renewalNoticeDays: integer("renewal_notice_days").notNull().default(30),
  cost: real("cost").notNull().default(0),
  status: text("status").notNull().default("active"),
  ...timestamps,
});

export const contractAssets = sqliteTable("contract_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contractId: integer("contract_id").notNull().references(() => contracts.id, { onDelete: "cascade" }),
  assetId: integer("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  ...timestamps,
}, (table) => [uniqueIndex("contract_asset_unique").on(table.contractId, table.assetId)]);

export const depreciationProfiles = sqliteTable("depreciation_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  method: text("method").notNull().default("straight_line"),
  usefulLifeYears: integer("useful_life_years").notNull(),
  salvageValue: real("salvage_value").notNull().default(0),
  startDate: text("start_date").notNull(),
  ...timestamps,
});

export const depreciationEntries = sqliteTable("depreciation_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id").notNull().references(() => depreciationProfiles.id, { onDelete: "cascade" }),
  periodDate: text("period_date").notNull(),
  amount: real("amount").notNull(),
  accumulatedAmount: real("accumulated_amount").notNull(),
  netBookValue: real("net_book_value").notNull(),
  ...timestamps,
});

export const disposalRequests = sqliteTable("disposal_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  disposalNo: text("disposal_no").notNull().unique(),
  reason: text("reason").notNull(),
  description: text("description"),
  requestedBy: integer("requested_by").references(() => users.id),
  status: text("status").notNull().default("draft"),
  committeeOrderNo: text("committee_order_no"),
  submittedAt: text("submitted_at"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: text("approved_at"),
  ...timestamps,
});

export const disposalItems = sqliteTable("disposal_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  disposalRequestId: integer("disposal_request_id").notNull().references(() => disposalRequests.id, { onDelete: "cascade" }),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  conditionNote: text("condition_note"),
  estimatedValue: real("estimated_value").notNull().default(0),
  finalAction: text("final_action"),
  finalValue: real("final_value"),
  ...timestamps,
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("info"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedType: text("related_type"),
  relatedId: integer("related_id"),
  readAt: text("read_at"),
  ...timestamps,
});

export const notificationRules = sqliteTable("notification_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleKey: text("rule_key").notNull().unique(),
  channelsJson: text("channels_json").notNull().default("[\"system\"]"),
  daysBefore: integer("days_before"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  template: text("template"),
  ...timestamps,
});

export const customFields = sqliteTable("custom_fields", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetType: text("target_type").notNull(),
  fieldKey: text("field_key").notNull(),
  fieldLabel: text("field_label").notNull(),
  fieldType: text("field_type").notNull().default("text"),
  optionsJson: text("options_json").notNull().default("[]"),
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
}, (table) => [uniqueIndex("custom_field_unique").on(table.targetType, table.fieldKey)]);

export const customFieldValues = sqliteTable("custom_field_values", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customFieldId: integer("custom_field_id").notNull().references(() => customFields.id, { onDelete: "cascade" }),
  targetId: integer("target_id").notNull(),
  valueText: text("value_text"),
  ...timestamps,
}, (table) => [uniqueIndex("custom_field_value_unique").on(table.customFieldId, table.targetId)]);

export const importJobs = sqliteTable("import_jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobType: text("job_type").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key"),
  status: text("status").notNull().default("pending"),
  totalRows: integer("total_rows").notNull().default(0),
  successRows: integer("success_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  ...timestamps,
});

export const importErrors = sqliteTable("import_errors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  importJobId: integer("import_job_id").notNull().references(() => importJobs.id, { onDelete: "cascade" }),
  rowNumber: integer("row_number").notNull(),
  fieldName: text("field_name"),
  errorMessage: text("error_message").notNull(),
  rawDataJson: text("raw_data_json").notNull().default("{}"),
  ...timestamps,
});

export const savedReports = sqliteTable("saved_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(),
  filtersJson: text("filters_json").notNull().default("{}"),
  columnsJson: text("columns_json").notNull().default("[]"),
  ownerId: integer("owner_id").references(() => users.id),
  isShared: integer("is_shared", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});

export const activityLogs = sqliteTable("activity_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  summary: text("summary").notNull(),
  beforeJson: text("before_json"),
  afterJson: text("after_json"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  happenedAt: text("happened_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("activity_logs_target_idx").on(table.targetType, table.targetId)]);

export const scanLogs = sqliteTable("scan_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").references(() => assets.id),
  auditSessionId: integer("audit_session_id").references(() => auditSessions.id),
  scannedBy: integer("scanned_by").references(() => users.id),
  scanType: text("scan_type").notNull(),
  locationId: integer("location_id").references(() => locations.id),
  rawToken: text("raw_token"),
  scannedAt: text("scanned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  settingGroup: text("setting_group").notNull().default("general"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  ...timestamps,
});
