import SwiftUI

struct AddTransactionView: View {
    let categories: [CategoryRead]
    let draft: ScannedDraft?
    let onSave: (TransactionCreateRequest) async throws -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var type: TransactionType = .expense
    @State private var amount = ""
    @State private var categoryId: String = ""
    @State private var expenseNature: ExpenseNature = .fixed
    @State private var date = Date()
    @State private var descriptionText = ""
    @State private var errorMessage: String?
    @State private var isSaving = false

    init(
        categories: [CategoryRead],
        draft: ScannedDraft? = nil,
        onSave: @escaping (TransactionCreateRequest) async throws -> Void
    ) {
        self.categories = categories
        self.draft = draft
        self.onSave = onSave
        // Pre-llena desde el recibo escaneado (si viene de un escaneo).
        _amount = State(initialValue: draft?.amount ?? "")
        _categoryId = State(initialValue: draft?.suggestedCategoryId ?? "")
        _expenseNature = State(initialValue: draft?.suggestedExpenseNature ?? .fixed)
        _date = State(initialValue: draft?.date ?? Date())
        _descriptionText = State(initialValue: draft?.description ?? "")
    }

    private var activeCategories: [CategoryRead] {
        categories.filter { !$0.isArchived }
    }

    private var canSave: Bool {
        !amount.isEmpty && Decimal(string: amount) != nil && !categoryId.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                if let draft {
                    Section {
                        Label("Escaneado con IA — revisa y confirma", systemImage: "sparkles")
                            .font(.subheadline.weight(.semibold))
                        if let reasoning = draft.reasoning {
                            Text(reasoning)
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        if let confidence = draft.confidence {
                            Text("Confianza: \(Int((confidence * 100).rounded()))%")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Section {
                    Picker("Tipo", selection: $type) {
                        ForEach(TransactionType.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Monto") {
                    TextField("0.00", text: $amount)
                        .keyboardType(.decimalPad)
                }

                Section("Categoría") {
                    Picker("Categoría", selection: $categoryId) {
                        Text("Selecciona…").tag("")
                        ForEach(activeCategories) { cat in
                            Text(cat.name).tag(cat.id)
                        }
                    }
                }

                if type == .expense {
                    Section("Naturaleza del gasto") {
                        Picker("Naturaleza", selection: $expenseNature) {
                            ForEach(ExpenseNature.allCases) { Text($0.label).tag($0) }
                        }
                        .pickerStyle(.segmented)
                    }
                }

                Section("Detalles") {
                    DatePicker("Fecha", selection: $date, displayedComponents: .date)
                    TextField("Descripción (opcional)", text: $descriptionText)
                }

                if let errorMessage {
                    Text(errorMessage).font(.footnote).foregroundStyle(.red)
                }
            }
            .navigationTitle("Nuevo movimiento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { Task { await save() } }
                        .disabled(!canSave || isSaving)
                }
            }
        }
    }

    private func save() async {
        errorMessage = nil
        isSaving = true
        defer { isSaving = false }
        let request = TransactionCreateRequest(
            type: type.rawValue,
            amount: amount,
            currency: nil,   // el backend usa la divisa base del usuario
            expenseNature: type == .expense ? expenseNature.rawValue : nil,
            description: descriptionText.isEmpty ? nil : descriptionText,
            transactionDate: APIDate.string(from: date),
            categoryId: categoryId,
            accountId: nil,
            receiptId: draft?.receiptId   // enlaza el recibo si viene de un escaneo
        )
        do {
            try await onSave(request)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
