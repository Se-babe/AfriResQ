import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../auth_state.dart';
import '../constants.dart';
import '../theme.dart';
import '../widgets/common.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final name = TextEditingController();
  final phone = TextEditingController();
  final password = TextEditingController();
  String role = 'citizen';
  final selectedSkills = <String>{'first_aid'};
  String? organizationId;
  List orgs = [];
  bool busy = false;

  @override
  void initState() {
    super.initState();
    context.read<AuthState>().api.request('/organizations').then((data) {
      if (mounted) setState(() => orgs = data as List);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => busy = true);
    try {
      final body = <String, dynamic>{
        'name': name.text.trim(),
        'phone': phone.text.trim(),
        'password': password.text,
        'role': role,
      };
      if (role == 'responder') {
        body['skills'] = selectedSkills.toList();
        if (organizationId != null) body['organizationId'] = organizationId;
      }
      await context.read<AuthState>().register(body);
      if (mounted) Navigator.popUntil(context, (r) => r.isFirst);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: role,
            items: const [
              DropdownMenuItem(value: 'citizen', child: Text('Community member')),
              DropdownMenuItem(value: 'responder', child: Text('Responder / volunteer')),
            ],
            onChanged: (v) => setState(() => role = v ?? 'citizen'),
            decoration: const InputDecoration(labelText: 'I am a'),
          ),
          if (role == 'responder') ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              children: skills
                  .map(
                    (s) => FilterChip(
                      label: Text(s.replaceAll('_', ' ')),
                      selected: selectedSkills.contains(s),
                      selectedColor: teal.withValues(alpha: 0.25),
                      onSelected: (v) => setState(() => v ? selectedSkills.add(s) : selectedSkills.remove(s)),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String?>(
              initialValue: organizationId,
              items: [
                const DropdownMenuItem(value: null, child: Text('Independent volunteer')),
                ...orgs.map((o) => DropdownMenuItem(value: o['id'] as String, child: Text(o['name'] as String))),
              ],
              onChanged: (v) => setState(() => organizationId = v),
              decoration: const InputDecoration(labelText: 'Organization'),
            ),
          ],
          const SizedBox(height: 12),
          TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
          const SizedBox(height: 12),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: 'Password (8+ characters)')),
          const SizedBox(height: 16),
          FilledButton(onPressed: busy ? null : _submit, child: Text(busy ? 'Creating…' : 'Create account')),
        ],
      ),
    );
  }
}
