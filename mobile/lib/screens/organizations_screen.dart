import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_state.dart';
import '../constants.dart';
import '../widgets/common.dart';

class OrganizationsScreen extends StatefulWidget {
  const OrganizationsScreen({super.key});

  @override
  State<OrganizationsScreen> createState() => _OrganizationsScreenState();
}

class _OrganizationsScreenState extends State<OrganizationsScreen> {
  List rows = [];
  final name = TextEditingController();
  String type = 'health_facility';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final data = await context.read<AuthState>().api.request('/organizations');
    if (mounted) setState(() => rows = data as List);
  }

  Future<void> _save() async {
    try {
      await context.read<AuthState>().api.request('/organizations', method: 'POST', body: {
        'name': name.text.trim(),
        'type': type,
        'lat': kampalaLat,
        'lng': kampalaLng,
      });
      name.clear();
      await _load();
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mapped = rows
        .cast<Map>()
        .map((o) => {
              'id': o['id'],
              'lat': o['lat'],
              'lng': o['lng'],
              'category': 'other',
              'severity': 'low',
              'status': o['type'],
              'address_text': o['name'],
            })
        .where((o) => o['lat'] != null)
        .toList();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(controller: name, decoration: const InputDecoration(labelText: 'Organization name')),
        const SizedBox(height: 8),
        DropdownButtonFormField<String>(
          initialValue: type,
          items: ['health_facility', 'police', 'fire', 'ngo', 'community_group', 'ambulance', 'other']
              .map((t) => DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' '))))
              .toList(),
          onChanged: (v) => setState(() => type = v ?? type),
        ),
        const SizedBox(height: 8),
        FilledButton(onPressed: _save, child: const Text('Save organization')),
        const SizedBox(height: 16),
        IncidentMap(emergencies: mapped.map((e) => Map<String, dynamic>.from(e)).toList()),
        ...rows.map((o) => ListTile(title: Text('${o['name']}'), subtitle: Text('${o['type']}'.replaceAll('_', ' ')))),
      ],
    );
  }
}
