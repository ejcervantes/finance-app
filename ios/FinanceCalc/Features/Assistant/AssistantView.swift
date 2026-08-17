import SwiftUI

/// Renderiza markdown inline (negritas, cursivas) preservando saltos de línea.
enum Markdown {
    static func attributed(_ text: String) -> AttributedString {
        (try? AttributedString(
            markdown: text,
            options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)
    }
}

struct AssistantView: View {
    @StateObject private var vm = AssistantViewModel()
    @State private var showInsights = false

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if vm.messages.isEmpty && !vm.isSending {
                            emptyState
                        }
                        ForEach(vm.messages) { message in
                            ChatBubbleView(message: message).id(message.id)
                        }
                        if vm.isSending {
                            typingIndicator.id("typing")
                        }
                    }
                    .padding()
                }
                .onChange(of: vm.messages.count) { _, _ in scrollToBottom(proxy) }
                .onChange(of: vm.isSending) { _, _ in scrollToBottom(proxy) }
            }
            .navigationTitle("Asesor")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showInsights = true
                        Task { await vm.loadInsights() }
                    } label: {
                        Image(systemName: "chart.bar.doc.horizontal")
                    }
                }
            }
            .safeAreaInset(edge: .bottom) { inputBar }
            .sheet(isPresented: $showInsights) { InsightsView(vm: vm) }
            .task { await vm.loadHistory() }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        withAnimation {
            if vm.isSending {
                proxy.scrollTo("typing", anchor: .bottom)
            } else if let last = vm.messages.last {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 8) {
            TextField("Pregúntale a tu asesor…", text: $vm.input, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...4)
                .autocorrectionDisabled()
            Button {
                Task { await vm.send() }
            } label: {
                Image(systemName: "arrow.up.circle.fill").font(.largeTitle)
            }
            .disabled(vm.input.trimmingCharacters(in: .whitespaces).isEmpty || vm.isSending)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    private var typingIndicator: some View {
        HStack {
            HStack(spacing: 4) {
                ProgressView()
                Text("Pensando…").foregroundStyle(.secondary)
            }
            .padding(12)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
            Spacer(minLength: 40)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "sparkles").font(.system(size: 44)).foregroundStyle(.tint)
            Text("Tu asesor de finanzas")
                .font(.headline)
            Text("Pregúntale cómo vas este mes, en qué gastas de más, o cómo ahorrar. Responde con tus datos reales.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.top, 60)
        .padding(.horizontal)
    }
}

struct ChatBubbleView: View {
    let message: ChatMessage
    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 40) }
            Text(Markdown.attributed(message.content))
                .padding(12)
                .background(
                    isUser ? Color.accentColor : Color(.secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 16)
                )
                .foregroundStyle(isUser ? Color.white : Color.primary)
                .textSelection(.enabled)
            if !isUser { Spacer(minLength: 40) }
        }
    }
}

struct InsightsView: View {
    @ObservedObject var vm: AssistantViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if vm.isLoadingInsights {
                    ProgressView("Analizando tu mes…")
                } else if let error = vm.insightsError {
                    ContentUnavailableView("No se pudo cargar", systemImage: "exclamationmark.triangle", description: Text(error))
                } else if let insights = vm.insights {
                    List {
                        Section("Señales del mes") {
                            ForEach(insights.signals, id: \.self) { signal in
                                Label(signal, systemImage: "dot.radiowaves.left.and.right")
                                    .font(.subheadline)
                            }
                        }
                        Section("Consejos") {
                            Text(Markdown.attributed(insights.advice))
                                .font(.subheadline)
                        }
                    }
                }
            }
            .navigationTitle("Análisis del mes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
    }
}
