import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../auth_state.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'login_screen.dart';
import 'register_screen.dart';

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  late final TextEditingController _api;

  @override
  void initState() {
    super.initState();
    _api = TextEditingController(text: context.read<AuthState>().api.baseUrl);
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }

  Future<void> _saveApiUrl() async {
    try {
      await context.read<AuthState>().api.setBaseUrl(_api.text.trim());
      if (mounted) {
        setState(() {});
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('API URL saved')));
      }
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ready = context.watch<AuthState>().api.baseUrl.isNotEmpty;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(22),
          children: [
            const SizedBox(height: 12),
            Text('AfriResQ', style: Theme.of(context).textTheme.displaySmall?.copyWith(color: ink, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('Help is closer than the next phone call.', style: TextStyle(fontSize: 22, height: 1.2)),
            const SizedBox(height: 12),
            const Text(
              'Report once. Nearby verified responders are classified, matched, and notified.',
              style: TextStyle(color: Color(0xFF6B5E4E), height: 1.4),
            ),
            const SizedBox(height: 24),
            const Text('API server', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            TextField(
              controller: _api,
              keyboardType: TextInputType.url,
              decoration: const InputDecoration(
                hintText: 'https://your-afriresq-api.onrender.com',
                helperText: 'Required before you can sign in or report. Must be an https:// address.',
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(onPressed: _saveApiUrl, child: const Text('Save API URL')),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: !ready
                  ? null
                  : () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen(guestReport: true))),
              child: const Text('Report an emergency'),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: !ready ? null : () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen())),
              child: const Text('Sign in'),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: !ready ? null : () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
              child: const Text('Create an account / join as responder'),
            ),
            const SizedBox(height: 8),
            const Text('This does not replace police, fire, ambulance, or hospitals.', style: TextStyle(fontSize: 12, color: Color(0xFF6B5E4E))),
          ],
        ),
      ),
    );
  }
}
