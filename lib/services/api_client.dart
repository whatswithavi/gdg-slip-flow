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

  static Future<Map<String, dynamic>> extractSlip(List<int> imageBytes, String mimeType) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/extract-slip'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'imageBase64': base64Encode(imageBytes), 'mimeType': mimeType}),
    );
    return _decodeOrThrow(res);
  }

  static Future<List<Map<String, dynamic>>> fetchPendingSlips() async {
    final res = await http.get(Uri.parse('$baseUrl/api/pending-slips'));
    final decoded = _decodeListOrThrow(res);
    return decoded;
  }

  static Future<List<Map<String, dynamic>>> fetchApprovedSlips() async {
    final res = await http.get(Uri.parse('$baseUrl/api/slips'));
    return _decodeListOrThrow(res);
  }

  static Future<Map<String, dynamic>> approveSlip(
    String id, {
    String? item,
    num? quantity,
    String? unit,
    String? date,
    String? supplier,
  }) async {
    final payload = <String, dynamic>{'id': id};
    if (item != null) payload['item'] = item;
    if (quantity != null) payload['quantity'] = quantity;
    if (unit != null) payload['unit'] = unit;
    if (date != null) payload['date'] = date;
    if (supplier != null) payload['supplier'] = supplier;

    final res = await http.post(
      Uri.parse('$baseUrl/api/approve-slip'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    return _decodeOrThrow(res);
  }

  static Future<void> rejectSlip(String id, {String? reason}) async {
    final payload = <String, dynamic>{'id': id};
    if (reason != null) payload['reason'] = reason;

    final res = await http.post(
      Uri.parse('$baseUrl/api/reject-slip'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(payload),
    );
    _decodeOrThrow(res);
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
