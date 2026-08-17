import Foundation

// MARK: - Enums

enum TransactionType: String, Codable, CaseIterable, Identifiable {
    case income
    case expense
    var id: String { rawValue }
    var label: String { self == .income ? "Ingreso" : "Gasto" }
}

enum ExpenseNature: String, Codable, CaseIterable, Identifiable {
    case fixed
    case variable
    case discretionary
    var id: String { rawValue }
    var label: String {
        switch self {
        case .fixed: return "Fijo"
        case .variable: return "Variable"
        case .discretionary: return "Prescindible"
        }
    }
}

// MARK: - Auth

struct LoginRequest: Encodable {
    let email: String
    let password: String
}

struct RegisterRequest: Encodable {
    let email: String
    let password: String
    let firstName: String
    let lastName: String
    let country: String
    let baseCurrency: String
}

struct TokenPair: Decodable {
    let accessToken: String
    let refreshToken: String
}

struct UserRead: Decodable, Identifiable {
    let id: String
    let email: String
    let firstName: String
    let lastName: String
    let country: String
    let baseCurrency: String
}

// MARK: - Categorías

struct CategoryRead: Decodable, Identifiable {
    let id: String
    let userId: String?
    let isSystem: Bool
    let name: String
    let icon: String?
    let color: String?
    let isArchived: Bool
}

// MARK: - Transacciones

struct TransactionRead: Decodable, Identifiable {
    let id: String
    let type: TransactionType
    let amount: String            // el backend envía dinero como string exacto
    let currency: String
    let expenseNature: ExpenseNature?
    let description: String?
    let transactionDate: String   // "YYYY-MM-DD"
    let accountId: String?
    let categoryId: String
    let notes: String?
    let source: String
    let natureSource: String?
    let receiptId: String?
    let createdAt: String
    let updatedAt: String
}

struct TransactionList: Decodable {
    let items: [TransactionRead]
    let total: Int
    let page: Int
    let pageSize: Int
}

struct TransactionCreateRequest: Encodable {
    let type: String
    let amount: String
    let currency: String?
    let expenseNature: String?
    let description: String?
    let transactionDate: String
    let categoryId: String
    let accountId: String?
    let receiptId: String?
}

// MARK: - Escaneo de recibos

struct ReceiptScanResponse: Decodable {
    let receiptId: String
    let imageUrl: String
    let amount: String?
    let transactionDate: String?
    let description: String?
    let suggestedCategoryId: String?
    let suggestedExpenseNature: ExpenseNature?
    let confidence: Double?
    let reasoning: String?
    let rawItems: [String]
}

/// Borrador ya normalizado para pre-llenar el formulario de alta.
struct ScannedDraft: Identifiable {
    var id: String { receiptId }
    let receiptId: String
    let amount: String?
    let date: Date?
    let description: String?
    let suggestedCategoryId: String?
    let suggestedExpenseNature: ExpenseNature?
    let confidence: Double?
    let reasoning: String?

    init(from response: ReceiptScanResponse) {
        receiptId = response.receiptId
        amount = response.amount
        date = response.transactionDate.flatMap { APIDate.formatter.date(from: $0) }
        description = response.description
        suggestedCategoryId = response.suggestedCategoryId
        suggestedExpenseNature = response.suggestedExpenseNature
        confidence = response.confidence
        reasoning = response.reasoning
    }
}

// MARK: - Reportes

struct DateRange: Decodable {
    let from: String
    let to: String
}

struct SummaryReport: Decodable {
    let period: DateRange
    let totalIncome: String
    let totalExpense: String
    let balance: String
    let savingsRate: Double?
}

struct CategoryReportItem: Decodable, Identifiable {
    var id: String { categoryId }
    let categoryId: String
    let categoryName: String
    let total: String
    let count: Int
}

// MARK: - Asesor de IA

enum MessageRole: String, Codable {
    case user
    case assistant
}

struct MessageRead: Decodable {
    let role: MessageRole
    let content: String
    let createdAt: String
}

struct ChatRequest: Encodable {
    let message: String
}

struct ChatResponse: Decodable {
    let reply: String
}

struct InsightsResponse: Decodable {
    let signals: [String]
    let advice: String
}

/// Mensaje de chat para la UI (con id estable para SwiftUI).
struct ChatMessage: Identifiable {
    let id = UUID()
    let role: MessageRole
    let content: String
}
