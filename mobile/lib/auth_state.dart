import 'package:flutter/foundation.dart';

import 'api.dart';

class AuthState extends ChangeNotifier {
  AuthState(this.api);

  final AfriApi api;
  bool ready = false;
  Map<String, dynamic>? profile;
  String? error;

  Map<String, dynamic>? get user => api.user;
  String? get role => user?['role'] as String?;
  bool get signedIn => api.token != null && user != null;

  Future<void> bootstrap() async {
    await api.load();
    if (api.token != null) {
      try {
        final data = await api.request('/auth/me') as Map<String, dynamic>;
        api.user = {...?api.user, ...data['user'] as Map<String, dynamic>};
        profile = data['responderProfile'] as Map<String, dynamic>?;
      } catch (_) {
        await api.clearSession();
        profile = null;
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<void> login(String phone, String password) async {
    error = null;
    notifyListeners();
    final data = await api.request('/auth/login', method: 'POST', body: {
      'phone': phone,
      'password': password,
    }) as Map<String, dynamic>;
    await api.saveSession(
      access: data['token'] as String,
      refresh: data['refreshToken'] as String,
      nextUser: data['user'] as Map<String, dynamic>,
    );
    await _loadMe();
    notifyListeners();
  }

  Future<void> register(Map<String, dynamic> body) async {
    error = null;
    final data = await api.request('/auth/register', method: 'POST', body: body) as Map<String, dynamic>;
    await api.saveSession(
      access: data['token'] as String,
      refresh: data['refreshToken'] as String,
      nextUser: data['user'] as Map<String, dynamic>,
    );
    await _loadMe();
    notifyListeners();
  }

  Future<void> _loadMe() async {
    try {
      final data = await api.request('/auth/me') as Map<String, dynamic>;
      api.user = {...?api.user, ...data['user'] as Map<String, dynamic>};
      profile = data['responderProfile'] as Map<String, dynamic>?;
    } catch (_) {}
  }

  Future<void> logout() async {
    try {
      if (api.refreshToken != null) {
        await api.request('/auth/logout', method: 'POST', body: {'refreshToken': api.refreshToken});
      }
    } catch (_) {}
    await api.clearSession();
    profile = null;
    notifyListeners();
  }

  void setProfile(Map<String, dynamic>? next) {
    profile = next;
    notifyListeners();
  }
}
