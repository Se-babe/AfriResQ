import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_state.dart';
import '../theme.dart';
import '../widgets/common.dart';

class RespondersScreen extends StatefulWidget {
  const RespondersScreen({super.key});

  @override
  State<RespondersScreen> createState() => _RespondersScreenState();
}

class _RespondersScreenState extends State<RespondersScreen> {
  List rows = [];
  List pending = [];
  String notes = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final api = context.read<AuthState>().api;
    final all = await api.request('/responders');
    final wait = await api.request('/responders/pending');
    if (mounted) setState(() { rows = all as List; pending = wait as List; });
  }

  Future<void> _verify(String id, String status) async {
    try {
      await context.read<AuthState>().api.request('/responders/$id/verify', method: 'POST', body: {'status': status, 'notes': notes});
      await _load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mapped = rows.cast<Map>().map((e) => Map<String, dynamic>.from(e)).where((r) => r['current_lat'] != null).toList();
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Verification queue', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          TextField(decoration: const InputDecoration(labelText: 'Notes'), onChanged: (v) => notes = v),
          if (pending.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('No responders waiting.')),
          ...pending.map((p) => Card(
                child: ListTile(
                  title: Text('${p['name']}'),
                  subtitle: Text('${p['phone']} · ${(p['skills'] as List?)?.join(', ') ?? ''}'),
                  trailing: Wrap(children: [
                    IconButton(icon: const Icon(Icons.check, color: teal), onPressed: () => _verify(p['id'] as String, 'verified')),
                    IconButton(icon: const Icon(Icons.close, color: Colors.red), onPressed: () => _verify(p['id'] as String, 'rejected')),
                  ]),
                ),
              )),
          const SizedBox(height: 12),
          IncidentMap(responders: mapped, height: 240),
          const SizedBox(height: 12),
          const Text('All responders', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          ...rows.map((r) => ListTile(
                title: Text('${r['name']}'),
                subtitle: Text('${r['verification_status']} · ${r['availability_status']} · ${r['organization_name'] ?? 'Independent'}'),
              )),
        ],
      ),
    );
  }
}
