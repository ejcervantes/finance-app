import Foundation
import UIKit

@MainActor
final class TransactionsViewModel: ObservableObject {
    @Published var transactions: [TransactionRead] = []
    @Published var categories: [CategoryRead] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    /// Mapa id -> nombre de categoría, para mostrar en la lista.
    var categoryNames: [String: String] {
        Dictionary(uniqueKeysWithValues: categories.map { ($0.id, $0.name) })
    }

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let list: TransactionList = APIClient.shared.request(
                Endpoint(path: "transactions", queryItems: [
                    URLQueryItem(name: "page_size", value: "100"),
                ])
            )
            async let cats: [CategoryRead] = APIClient.shared.request(
                Endpoint(path: "categories")
            )
            transactions = try await list.items
            categories = try await cats
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func create(_ request: TransactionCreateRequest) async throws {
        let body = try APIClient.shared.jsonBody(request)
        let _: TransactionRead = try await APIClient.shared.request(
            Endpoint(path: "transactions", method: .post, body: body)
        )
        await load()
    }

    /// Sube la imagen del recibo a la IA y devuelve un borrador para confirmar.
    func scan(_ image: UIImage) async -> ScannedDraft? {
        errorMessage = nil
        guard let data = image.jpegData(compressionQuality: 0.8) else {
            errorMessage = "No se pudo procesar la imagen."
            return nil
        }
        do {
            let response: ReceiptScanResponse = try await APIClient.shared.uploadImage(
                "transactions/scan",
                imageData: data,
                filename: "receipt.jpg",
                mimeType: "image/jpeg"
            )
            return ScannedDraft(from: response)
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    func delete(_ transaction: TransactionRead) async {
        do {
            try await APIClient.shared.requestVoid(
                Endpoint(path: "transactions/\(transaction.id)", method: .delete)
            )
            transactions.removeAll { $0.id == transaction.id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
