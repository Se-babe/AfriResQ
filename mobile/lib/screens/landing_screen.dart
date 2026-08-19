import 'package:flutter/material.dart';

import '../theme.dart';
import 'login_screen.dart';
import 'register_screen.dart';

class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: sand,
      body: Column(
        children: [
          const Expanded(
            flex: 5,
            child: _Hero(),
          ),
          Expanded(
            flex: 4,
            child: SafeArea(
              top: false,
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(28, 28, 28, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    FilledButton(
                      onPressed: () => Navigator.push(
                          context, MaterialPageRoute(builder: (_) => const LoginScreen(guestReport: true))),
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(56),
                        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('Report an emergency'),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: () =>
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen())),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size.fromHeight(56),
                        side: const BorderSide(color: ink, width: 1.4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('Sign in', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: ink)),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: () =>
                          Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
                      child: const Text('Create an account · join as a responder'),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Free for citizens and organisations. Complements police, fire, ambulance, and hospitals.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11.5, color: Color(0xFF8A7C68)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: ink,
        borderRadius: BorderRadius.only(bottomLeft: Radius.circular(36), bottomRight: Radius.circular(36)),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -40,
            top: -40,
            child: _ringDot(140, terracotta.withValues(alpha: 0.14)),
          ),
          Positioned(
            left: -30,
            bottom: 20,
            child: _ringDot(90, amber.withValues(alpha: 0.10)),
          ),
          SafeArea(
            bottom: false,
            child: Align(
              alignment: const Alignment(0, 0.05),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(20),
                      child: Image.asset('assets/icon/icon.png', width: 72, height: 72),
                    ),
                    const SizedBox(height: 18),
                    const Text(
                      'AfriResQ Uganda',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Uganda’s digital emergency coordination infrastructure.\nFree for every Ugandan. Funded by Government.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white70, fontSize: 15, height: 1.4),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _ringDot(double size, Color color) {
    return Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
  }
}
