import Foundation

@MainActor
final class DashboardViewModel: ObservableObject {
    @Published var summary: SummaryReport?
    @Published var byCategory: [CategoryReportItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            async let summaryResult: SummaryReport = APIClient.shared.request(
                Endpoint(path: "reports/summary")
            )
            async let categoriesResult: [CategoryReportItem] = APIClient.shared.request(
                Endpoint(path: "reports/by-category")
            )
            summary = try await summaryResult
            byCategory = try await categoriesResult
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
