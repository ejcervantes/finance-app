import SwiftUI
import UIKit

struct TransactionsView: View {
    @EnvironmentObject var session: Session
    @StateObject private var vm = TransactionsViewModel()

    @State private var showingAdd = false
    @State private var showingScanOptions = false
    @State private var imageSource: ImageSource?
    @State private var isScanning = false
    @State private var scannedDraft: ScannedDraft?
    @State private var scanError: String?

    var body: some View {
        NavigationStack {
            Group {
                if vm.transactions.isEmpty && !vm.isLoading {
                    emptyState
                } else {
                    list
                }
            }
            .navigationTitle("Movimientos")
            .toolbar {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button {
                        showingScanOptions = true
                    } label: {
                        Image(systemName: "camera.viewfinder")
                    }
                    Button {
                        showingAdd = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .overlay { if isScanning { scanningOverlay } }
            // Alta manual
            .sheet(isPresented: $showingAdd) {
                AddTransactionView(categories: vm.categories) { request in
                    try await vm.create(request)
                }
            }
            // Alta desde recibo escaneado (formulario pre-llenado)
            .sheet(item: $scannedDraft) { draft in
                AddTransactionView(categories: vm.categories, draft: draft) { request in
                    try await vm.create(request)
                }
            }
            // Selector de imagen (cámara o galería)
            .sheet(item: $imageSource) { source in
                ImagePicker(sourceType: source.type) { image in
                    Task { await handleScan(image) }
                }
                .ignoresSafeArea()
            }
            .confirmationDialog("Escanear recibo", isPresented: $showingScanOptions, titleVisibility: .visible) {
                if UIImagePickerController.isSourceTypeAvailable(.camera) {
                    Button("Tomar foto") { imageSource = ImageSource(type: .camera) }
                }
                Button("Elegir de la galería") { imageSource = ImageSource(type: .photoLibrary) }
                Button("Cancelar", role: .cancel) {}
            }
            .alert("No se pudo escanear", isPresented: .constant(scanError != nil)) {
                Button("OK") { scanError = nil }
            } message: {
                Text(scanError ?? "")
            }
            .task { await vm.load() }
            .refreshable { await vm.load() }
        }
    }

    private func handleScan(_ image: UIImage) async {
        isScanning = true
        let draft = await vm.scan(image)
        isScanning = false
        if let draft {
            scannedDraft = draft
        } else {
            scanError = vm.errorMessage
        }
    }

    private var scanningOverlay: some View {
        ZStack {
            Color.black.opacity(0.35).ignoresSafeArea()
            VStack(spacing: 12) {
                ProgressView()
                Text("Analizando recibo con IA…")
                    .font(.subheadline)
            }
            .padding(24)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
    }

    private var list: some View {
        List {
            ForEach(vm.transactions) { tx in
                row(tx)
            }
            .onDelete { indexSet in
                let items = indexSet.map { vm.transactions[$0] }
                Task { for item in items { await vm.delete(item) } }
            }
        }
        .listStyle(.plain)
    }

    private func row(_ tx: TransactionRead) -> some View {
        HStack(spacing: 12) {
            Image(systemName: tx.type == .income ? "arrow.down.circle.fill" : "arrow.up.circle.fill")
                .foregroundStyle(tx.type == .income ? .green : .red)
                .font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text(tx.description?.isEmpty == false ? tx.description! : (vm.categoryNames[tx.categoryId] ?? "Movimiento"))
                    .font(.body)
                HStack(spacing: 6) {
                    Text(vm.categoryNames[tx.categoryId] ?? "")
                    if tx.source == "receipt_scan" {
                        Image(systemName: "camera.fill").font(.caption2)
                    }
                    Text("·")
                    Text(APIDate.display(tx.transactionDate))
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            Spacer()
            Text(Money.format(tx.amount, currency: tx.currency))
                .font(.callout.weight(.semibold))
                .foregroundStyle(tx.type == .income ? .green : .primary)
        }
        .padding(.vertical, 4)
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Sin movimientos", systemImage: "tray")
        } description: {
            Text("Agrega tu primer ingreso o gasto con +, o escanea un recibo.")
        }
    }
}
