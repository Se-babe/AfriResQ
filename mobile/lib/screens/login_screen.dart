import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../auth_state.dart';
import '../widgets/common.dart';
import 'register_screen.dart';
import 'report_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.guestReport = false});
  final bool guestReport;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final phone = TextEditingController();
  final password = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    phone.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => busy = true);
    try {
      await context.read<AuthState>().login(phone.text.trim(), password.text);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (widget.guestReport) ...[
            FilledButton(
              onPressed: () => Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const ReportScreen(anonymous: true))),
              child: const Text('Continue without account'),
            ),
            const SizedBox(height: 16),
            const Divider(),
            const SizedBox(height: 8),
          ],
          TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
          const SizedBox(height: 12),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password')),
          const SizedBox(height: 16),
          FilledButton(onPressed: busy ? null : _submit, child: Text(busy ? 'Signing in…' : 'Sign in')),
          TextButton(
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
            child: const Text('Create an account'),
          ),
        ],
      ),
    );
  }
}
