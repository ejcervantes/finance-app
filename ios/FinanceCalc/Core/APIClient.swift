import Foundation

struct APIError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

extension Data {
    /// Agrega texto UTF-8 (para construir cuerpos multipart).
    mutating func appendString(_ string: String) {
        if let data = string.data(using: .utf8) { append(data) }
    }
}

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case delete = "DELETE"
}

struct Endpoint {
    var path: String                     // relativo a /api/v1, ej. "auth/login"
    var method: HTTPMethod = .get
    var body: Data? = nil
    var queryItems: [URLQueryItem] = []
    var authorized: Bool = true
}

/// Cliente HTTP contra el backend. Un solo punto para armar peticiones,
/// inyectar el token y decodificar respuestas/errores.
final class APIClient {
    static let shared = APIClient()

    // Simulador (dev en tu Mac) → localhost; iPhone real → producción en Render.
    // (El iPhone no puede alcanzar el localhost de la Mac, por eso usa Render.)
    #if targetEnvironment(simulator)
    private let baseURL = URL(string: "http://localhost:8000/api/v1")!
    #else
    private let baseURL = URL(string: "https://finance-backend-9rh6.onrender.com/api/v1")!
    #endif
    private let urlSession = URLSession.shared

    /// Token actual (lo fija Session al iniciar sesión / al arrancar).
    var accessToken: String?

    let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.keyEncodingStrategy = .convertToSnakeCase
        return e
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.keyDecodingStrategy = .convertFromSnakeCase
        return d
    }()

    func jsonBody<T: Encodable>(_ value: T) throws -> Data {
        try encoder.encode(value)
    }

    /// Petición que devuelve un objeto decodificable.
    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        let data = try await perform(endpoint)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError(message: "No se pudo leer la respuesta del servidor.")
        }
    }

    /// Petición sin cuerpo de respuesta (204, deletes, etc.).
    func requestVoid(_ endpoint: Endpoint) async throws {
        _ = try await perform(endpoint)
    }

    /// Sube una imagen como multipart/form-data (campo "file") y decodifica la respuesta.
    func uploadImage<T: Decodable>(
        _ path: String,
        imageData: Data,
        filename: String,
        mimeType: String
    ) async throws -> T {
        let boundary = "Boundary-\(UUID().uuidString)"
        var request = URLRequest(url: baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.setValue(
            "multipart/form-data; boundary=\(boundary)",
            forHTTPHeaderField: "Content-Type"
        )
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        var body = Data()
        body.appendString("--\(boundary)\r\n")
        body.appendString(
            "Content-Disposition: form-data; name=\"file\"; filename=\"\(filename)\"\r\n"
        )
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(imageData)
        body.appendString("\r\n--\(boundary)--\r\n")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await urlSession.upload(for: request, from: body)
        } catch {
            throw APIError(message: "No se pudo subir la imagen.")
        }
        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "Respuesta inválida del servidor.")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError(message: Self.decodeDetail(data) ?? "Error \(http.statusCode).")
        }
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError(message: "No se pudo leer la respuesta del servidor.")
        }
    }

    // MARK: - Interno

    private func perform(_ endpoint: Endpoint) async throws -> Data {
        var components = URLComponents(
            url: baseURL.appendingPathComponent(endpoint.path),
            resolvingAgainstBaseURL: false
        )!
        if !endpoint.queryItems.isEmpty {
            components.queryItems = endpoint.queryItems
        }

        var request = URLRequest(url: components.url!)
        request.httpMethod = endpoint.method.rawValue

        if endpoint.authorized, let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body = endpoint.body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await urlSession.data(for: request)
        } catch {
            throw APIError(message: "No se pudo conectar con el servidor.")
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError(message: "Respuesta inválida del servidor.")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError(message: Self.decodeDetail(data) ?? "Error \(http.statusCode).")
        }
        return data
    }

    /// El backend responde errores como { "detail": "..." }.
    private static func decodeDetail(_ data: Data) -> String? {
        struct ErrorBody: Decodable { let detail: DetailValue }
        // detail puede ser un string o una lista (errores de validación de FastAPI)
        enum DetailValue: Decodable {
            case text(String)
            case validation([ValidationItem])
            struct ValidationItem: Decodable { let msg: String }

            init(from decoder: Decoder) throws {
                let c = try decoder.singleValueContainer()
                if let s = try? c.decode(String.self) {
                    self = .text(s)
                } else if let list = try? c.decode([ValidationItem].self) {
                    self = .validation(list)
                } else {
                    self = .text("Error desconocido.")
                }
            }
        }
        guard let body = try? JSONDecoder().decode(ErrorBody.self, from: data) else {
            return nil
        }
        switch body.detail {
        case .text(let s): return s
        case .validation(let items): return items.first?.msg ?? "Datos inválidos."
        }
    }
}
