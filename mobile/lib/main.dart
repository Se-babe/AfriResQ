import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api.dart';
import 'auth_state.dart';
import 'screens/home_shell.dart';
import 'screens/landing_screen.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(AfriResQApp(api: AfriApi()));
}

class AfriResQApp extends StatelessWidget {
  const AfriResQApp({super.key, required this.api});
  final AfriApi api;

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthState(api)..bootstrap(),
      child: MaterialApp(
        title: 'AfriResQ Uganda',
        debugShowCheckedModeBanner: false,
        theme: afriTheme(),
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    if (!auth.ready) {
      return const Scaffold(
        backgroundColor: ink,
        body: Center(child: CircularProgressIndicator(color: amber)),
      );
    }
    if (!auth.signedIn) return const LandingScreen();
    return const HomeShell();
  }
}
