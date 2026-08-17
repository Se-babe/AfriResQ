import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../auth_state.dart';
import '../constants.dart';
import '../widgets/common.dart';

class EmergencyDetailScreen extends StatefulWidget {
  const EmergencyDetailScreen({super.key, required this.id});
  final String id;

  @override
  State<EmergencyDetailScreen> createState() => _EmergencyDetailScreenState();
}

class _EmergencyDetailScreenState extends State<EmergencyDetailScreen> {
  Map<String, dynamic>? data;
  String? err;
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await context.read<AuthState>().api.request('/emergencies/${widget.id}') as Map<String, dynamic>;
      if (mounted) setState(() { data = d; err = null; });
    } catch (e) {
      if (mounted) setState(() => err = '$e');
    }
  }

  Future<void> _act(String path, [Map<String, dynamic>? body]) async {
    setState(() => busy = true);
    try {
      await context.read<AuthState>().api.request(path, method: 'POST', body: body);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (err != null && data == null) return Scaffold(appBar: AppBar(), body: Center(child: Text(err!)));
    if (data == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final auth = context.watch<AuthState>();
    final e = data!['emergency'] as Map<String, dynamic>;
    final matches = (data!['matches'] as List?)?.cast<dynamic>() ?? [];
    final events = (data!['events'] as List?)?.cast<dynamic>() ?? [];
    final role = auth.role;
    final myMatch = matches.cast<Map>().where((m) => m['responder_id'] == auth.user?['id']).toList();
    final canAccept = role == 'responder' &&
        myMatch.isNotEmpty &&
        ['proposed', 'notified'].contains(myMatch.first['status']) &&
        e['assigned_responder_id'] == null;
    final canAdvance = (role == 'responder' && e['assigned_responder_id'] == auth.user?['id']) ||
        role == 'coordinator' ||
        role == 'admin';

    return Scaffold(
      appBar: AppBar(title: Text(categoryLabel(e['category'] as String?))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(children: [SeverityChip(e['severity'] as String?), const SizedBox(width: 8), Text(prettyStatus(e['status'] as String?))]),
          const SizedBox(height: 8),
          Text(e['description'] as String? ?? 'No description provided.'),
          Text('${e['address_text'] ?? '${e['lat']}, ${e['lng']}'}', style: const TextStyle(color: Colors.black54)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (canAccept) ...[
                FilledButton(onPressed: busy ? null : () => _act('/emergencies/${widget.id}/accept'), child: const Text('Accept')),
                OutlinedButton(onPressed: busy ? null : () => _act('/emergencies/${widget.id}/decline'), child: const Text('Decline')),
              ],
              if (canAdvance && e['status'] == 'accepted')
                FilledButton(onPressed: busy ? null : () => _act('/emergencies/${widget.id}/status', {'status': 'in_progress'}), child: const Text('In progress')),
              if (canAdvance && e['status'] == 'in_progress')
                FilledButton(onPressed: busy ? null : () => _act('/emergencies/${widget.id}/status', {'status': 'resolved'}), child: const Text('Resolved')),
              if ((role == 'coordinator' || role == 'admin') && e['assigned_responder_id'] == null)
                OutlinedButton(onPressed: busy ? null : () => _act('/emergencies/${widget.id}/rematch'), child: const Text('Rematch')),
            ],
          ),
          const SizedBox(height: 12),
          IncidentMap(
            emergencies: [e],
            center: LatLng((e['lat'] as num).toDouble(), (e['lng'] as num).toDouble()),
          ),
          if (matches.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Text('Matched responders', style: TextStyle(fontWeight: FontWeight.w800)),
            ...matches.map((m) => ListTile(
                  title: Text('${m['name']}'),
                  subtitle: Text('${m['phone']} · ${m['distance_km']} km · ${m['status']}'),
                )),
          ],
          const SizedBox(height: 16),
          const Text('Audit trail', style: TextStyle(fontWeight: FontWeight.w800)),
          ...events.map((ev) => ListTile(
                dense: true,
                title: Text(prettyStatus(ev['event_type'] as String?)),
                subtitle: Text('${ev['created_at']}'),
              )),
        ],
      ),
    );
  }
}
