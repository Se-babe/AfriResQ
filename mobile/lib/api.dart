import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class AfriApi {
  AfriApi();

  static const _tokenKey = 'afriresq_token';
  static const _refreshKey = 'afriresq_refresh_token';
  static const _userKey = 'afriresq_user';
  static const _baseKey = 'afriresq_api_base';

  String baseUrl = '';
  String? token;
  String? refreshToken;
  Map<String, dynamic>? user;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    baseUrl = prefs.getString(_baseKey) ?? baseUrl;
    token = prefs.getString(_tokenKey);
    refreshToken = prefs.getString(_refreshKey);
    final raw = prefs.getString(_userKey);
    if (raw != null) user = jsonDecode(raw) as Map<String, dynamic>;
  }

  Future<void> setBaseUrl(String url) async {
    final trimmed = url.replaceAll(RegExp(r'/+$'), '');
    if (!trimmed.startsWith('https://')) {
      throw ApiException('The API server URL must start with https://');
    }
    baseUrl = trimmed;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_baseKey, baseUrl);
  }

  Future<void> _persistSession() async {
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString(_tokenKey, token!);
    } else {
      await prefs.remove(_tokenKey);
    }
    if (refreshToken != null) {
      await prefs.setString(_refreshKey, refreshToken!);
    } else {
      await prefs.remove(_refreshKey);
    }
    if (user != null) {
      await prefs.setString(_userKey, jsonEncode(user));
    } else {
      await prefs.remove(_userKey);
    }
  }

  Future<void> saveSession({
    required String access,
    required String refresh,
    required Map<String, dynamic> nextUser,
  }) async {
    token = access;
    refreshToken = refresh;
    user = nextUser;
    await _persistSession();
  }

  Future<void> clearSession() async {
    token = null;
    refreshToken = null;
    user = null;
    await _persistSession();
  }

  Uri _uri(String path) {
    final p = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl/api$p');
  }

  String? _errorMessage(dynamic data, int status) {
    if (data is Map && data['error'] is String) return data['error'] as String;
    if (data is Map && data['error'] is Map) {
      final err = data['error'] as Map;
      if (err['formErrors'] is List) {
        return (err['formErrors'] as List).join(', ');
      }
    }
    return 'Request failed ($status)';
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    bool retry = true,
  }) async {
    if (baseUrl.isEmpty) {
      throw ApiException('Set the AfriResQ API server URL on the landing screen first.');
    }
    final headers = {'Content-Type': 'application/json'};
    if (token != null) headers['Authorization'] = 'Bearer $token';

    http.Response res;
    try {
      final uri = _uri(path);
      final encoded = body == null ? null : jsonEncode(body);
      res = switch (method) {
        'POST' => await http.post(uri, headers: headers, body: encoded),
        'PATCH' => await http.patch(uri, headers: headers, body: encoded),
        'PUT' => await http.put(uri, headers: headers, body: encoded),
        _ => await http.get(uri, headers: headers),
      };
    } catch (e) {
      throw ApiException('Cannot reach AfriResQ at $baseUrl. Check the API URL and that the backend is running.');
    }

    dynamic data;
    try {
      data = res.body.isEmpty ? {} : jsonDecode(res.body);
    } catch (_) {
      data = {};
    }

    if (res.statusCode >= 200 && res.statusCode < 300) return data;

    final isAuth = path.startsWith('/auth/login') ||
        path.startsWith('/auth/register') ||
        path.startsWith('/auth/refresh');
    if (res.statusCode == 401 && retry && !isAuth) {
      final ok = await _refresh();
      if (ok) return request(path, method: method, body: body, retry: false);
    }
    throw ApiException(_errorMessage(data, res.statusCode) ?? 'Request failed');
  }

  Future<bool> _refresh() async {
    if (refreshToken == null) return false;
    try {
      final data = await request(
        '/auth/refresh',
        method: 'POST',
        body: {'refreshToken': refreshToken},
        retry: false,
      ) as Map<String, dynamic>;
      await saveSession(
        access: data['token'] as String,
        refresh: data['refreshToken'] as String,
        nextUser: data['user'] as Map<String, dynamic>? ?? user ?? {},
      );
      return true;
    } catch (_) {
      await clearSession();
      return false;
    }
  }
}
