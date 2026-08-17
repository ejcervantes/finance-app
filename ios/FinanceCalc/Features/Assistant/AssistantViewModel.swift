import Foundation

@MainActor
final class AssistantViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var input = ""
    @Published var isSending = false

    @Published var insights: InsightsResponse?
    @Published var isLoadingInsights = false
    @Published var insightsError: String?

    func loadHistory() async {
        do {
            let history: [MessageRead] = try await APIClient.shared.request(
                Endpoint(path: "assistant/history")
            )
            messages = history.map { ChatMessage(role: $0.role, content: $0.content) }
        } catch {
            // Historial vacío o error de red: se ignora, el chat sigue usable.
        }
    }

    func send() async {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        input = ""
        messages.append(ChatMessage(role: .user, content: text))
        isSending = true
        defer { isSending = false }
        do {
            let body = try APIClient.shared.jsonBody(ChatRequest(message: text))
            let response: ChatResponse = try await APIClient.shared.request(
                Endpoint(path: "assistant/chat", method: .post, body: body)
            )
            messages.append(ChatMessage(role: .assistant, content: response.reply))
        } catch {
            messages.append(
                ChatMessage(role: .assistant, content: "⚠️ \(error.localizedDescription)")
            )
        }
    }

    func loadInsights() async {
        isLoadingInsights = true
        insightsError = nil
        defer { isLoadingInsights = false }
        do {
            insights = try await APIClient.shared.request(
                Endpoint(path: "assistant/insights")
            )
        } catch {
            insightsError = error.localizedDescription
        }
    }
}
