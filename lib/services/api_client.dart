import 'dart:convert';
import 'package:http/http.dart' as http;

/// Thin wrapper around the Node/Express backend. All Firestore/Storage
/// access happens server-side (see server/routes) — the Flutter app never
/// touches Firebase directly, so there's one trusted path for every write
/// and audit_log entry, and no Firestore security rules to maintain here.
class ApiClient {
  // Overridable at build time: `flutter build web --dart-define=API_BASE_URL=https://...`
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static Future<List<Map<String, dynamic>>> fetchRegisterTypes() async {
    final res = await http.get(Uri.parse('$baseUrl/api/register-types'));
    return _decodeListOrThrow(res);
  }

  static Future<Map<String, dynamic>> uploadComplianceDoc(String title, String content, {String? expiryDate}) async {
    final payload = <String, dynamic>{'title': title, 'content': content};
    if (expiryDate != null && expiryDate.isNotEmpty) payload['expiryDate'] = expiryDate;

    final res = await http.post(
      Uri.parse('$baseUrl/api/compliance-docs'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    return _decodeOrThrow(res);
  }

  static Future<List<Map<String, dynamic>>> fetchComplianceDocs() async {
    final res = await http.get(Uri.parse('$baseUrl/api/compliance-docs'));
    return _decodeListOrThrow(res);
  }

  static Future<Map<String, dynamic>> fetchDigest() async {
    final res = await http.get(Uri.parse('$baseUrl/api/digest'));
    return _decodeOrThrow(res);
  }

  static Future<Map<String, dynamic>> extractRecord(List<int> imageBytes, String mimeType, String registerType) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/extract-record'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'imageBase64': base64Encode(imageBytes),
        'mimeType': mimeType,
        'registerType': registerType,
      }),
    );
    return _decodeOrThrow(res);
  }

  static Future<List<Map<String, dynamic>>> fetchPendingRecords({String? registerType}) async {
    final uri = Uri.parse('$baseUrl/api/pending-records').replace(
      queryParameters: registerType != null ? {'registerType': registerType} : null,
    );
    final res = await http.get(uri);
    return _decodeListOrThrow(res);
  }

  static Future<List<Map<String, dynamic>>> fetchRecords({String? registerType}) async {
    final uri = Uri.parse('$baseUrl/api/records').replace(
      queryParameters: registerType != null ? {'registerType': registerType} : null,
    );
    final res = await http.get(uri);
    return _decodeListOrThrow(res);
  }

  static Future<Map<String, dynamic>> approveRecord(String id, {Map<String, dynamic>? fields}) async {
    final payload = <String, dynamic>{'id': id};
    if (fields != null) payload['fields'] = fields;

    final res = await http.post(
      Uri.parse('$baseUrl/api/approve-record'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    return _decodeOrThrow(res);
  }

  static Future<void> rejectRecord(String id, {String? reason}) async {
    final payload = <String, dynamic>{'id': id};
    if (reason != null) payload['reason'] = reason;

    final res = await http.post(
      Uri.parse('$baseUrl/api/reject-record'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    _decodeOrThrow(res);
  }

  static Future<Map<String, dynamic>> query(String question) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/query'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'question': question}),
    );
    return _decodeOrThrow(res);
  }

  static Map<String, dynamic> _decodeOrThrow(http.Response res) {
    final body = jsonDecode(res.body);
    if (res.statusCode >= 400) {
      throw ApiException(body is Map && body['error'] != null ? body['error'].toString() : 'Request failed (${res.statusCode})');
    }
    return body as Map<String, dynamic>;
  }

  static List<Map<String, dynamic>> _decodeListOrThrow(http.Response res) {
    final body = jsonDecode(res.body);
    if (res.statusCode >= 400) {
      throw ApiException(body is Map && body['error'] != null ? body['error'].toString() : 'Request failed (${res.statusCode})');
    }
    return (body as List).cast<Map<String, dynamic>>();
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}
