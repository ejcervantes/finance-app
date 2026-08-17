import Foundation

/// Formato de montos monetarios (el backend los envía como string "12500.00").
enum Money {
    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = 2
        return f
    }()

    static func format(_ raw: String, currency: String = "") -> String {
        guard let value = Decimal(string: raw) else { return raw }
        let text = formatter.string(from: value as NSDecimalNumber) ?? raw
        return currency.isEmpty ? text : "\(text) \(currency)"
    }
}

/// Convierte fechas entre Date y el formato "YYYY-MM-DD" que usa la API.
enum APIDate {
    static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func string(from date: Date) -> String {
        formatter.string(from: date)
    }

    /// Muestra "15 ago 2026" a partir de "2026-08-15".
    static func display(_ apiString: String) -> String {
        guard let date = formatter.date(from: apiString) else { return apiString }
        let out = DateFormatter()
        out.locale = Locale(identifier: "es")
        out.dateStyle = .medium
        return out.string(from: date)
    }
}
