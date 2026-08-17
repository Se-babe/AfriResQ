import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../auth_state.dart';
import '../constants.dart';
import '../widgets/common.dart';
import 'emergency_detail_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List emergencies = [];
  List responders = [];
  Map<String, dynamic>? analytics;
  String status = '';
  String category = '';
  String? err;
  WebSocketChannel? ws;

  @override
  void initState() {
    super.initState();
    _load();
    _connectWs();
  }

  @override
  void dispose() {
    ws?.sink.close();
    super.dispose();
  }

  void _connectWs() {
    try {
      final base = context.read<AuthState>().api.baseUrl;
      final wsUrl = base.replaceFirst(RegExp(r'^http'), 'ws');
      ws = WebSocketChannel.connect(Uri.parse('$wsUrl/ws'));
      ws!.stream.listen((_) => _load(), onError: (_) {});
    } catch (_) {}
  }

  Future<void> _load() async {
    final api = context.read<AuthState>().api;
    try {
      final qs = <String>[];
      if (status.isNotEmpty) qs.add('status=$status');
      if (category.isNotEmpty) qs.add('category=$category');
      qs.add('limit=80');
      final e = await api.request('/emergencies?${qs.join('&')}');
      final a = await api.request('/analytics/summary');
      final r = await api.request('/responders');
      if (mounted) {
        setState(() {
          emergencies = e as List;
          analytics = a as Map<String, dynamic>;
          responders = r as List;
          err = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => err = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final mapEmergencies = emergencies.cast<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
    final mapResponders = responders
        .cast<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((r) => r['current_lat'] != null)
        .toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (analytics != null)
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _stat('Active', '${analytics!['activeEmergencies'] ?? '—'}'),
                _stat('Reports', '${analytics!['totalEmergencies']}'),
                _stat('Match', analytics!['matchingSuccessRate'] == null ? '—' : '${((analytics!['matchingSuccessRate'] as num) * 100).round()}%'),
                _stat('Available', '${analytics!['availableResponders']}'),
              ],
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: status,
                  items: [
                    const DropdownMenuItem(value: '', child: Text('All statuses')),
                    ...['notified', 'accepted', 'in_progress', 'matching', 'resolved', 'cancelled']
                        .map((s) => DropdownMenuItem(value: s, child: Text(s.replaceAll('_', ' ')))),
                  ],
                  onChanged: (v) { setState(() => status = v ?? ''); _load(); },
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: DropdownButtonFormField<String>(
                  initialValue: category,
                  items: [
                    const DropdownMenuItem(value: '', child: Text('All types')),
                    ...categories.map((c) => DropdownMenuItem(value: c.$1, child: Text(c.$2))),
                  ],
                  onChanged: (v) { setState(() => category = v ?? ''); _load(); },
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          IncidentMap(emergencies: mapEmergencies, responders: mapResponders, height: 280),
          if (err != null) Text(err!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 12),
          ...emergencies.map((item) => EmergencyTile(
                item: Map<String, dynamic>.from(item as Map),
                onOpen: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EmergencyDetailScreen(id: item['id'] as String))).then((_) => _load()),
              )),
        ],
      ),
    );
  }

  Widget _stat(String label, String value) {
    return SizedBox(
      width: 150,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            Text(label),
          ]),
        ),
      ),
    );
  }
}
