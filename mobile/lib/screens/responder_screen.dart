import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../api.dart';
import '../auth_state.dart';
import '../constants.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'emergency_detail_screen.dart';

class ResponderScreen extends StatefulWidget {
  const ResponderScreen({super.key});

  @override
  State<ResponderScreen> createState() => _ResponderScreenState();
}

class _ResponderScreenState extends State<ResponderScreen> {
  List cases = [];
  List notes = [];
  String? err;
  String availability = 'offline';
  final selectedSkills = <String>{};

  @override
  void initState() {
    super.initState();
    final profile = context.read<AuthState>().profile;
    availability = profile?['availability_status'] as String? ?? 'offline';
    selectedSkills.addAll(((profile?['skills'] as List?) ?? []).cast<String>());
    _load();
  }

  Future<void> _load() async {
    final api = context.read<AuthState>().api;
    try {
      final mine = await api.request('/emergencies/mine');
      final n = await api.request('/notifications');
      if (mounted) {
        setState(() {
          cases = mine as List;
          notes = n as List;
          err = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => err = '$e');
    }
  }

  Future<void> _setLive(String status) async {
    try {
      await context.read<AuthState>().api.request('/responders/me/availability', method: 'PATCH', body: {'status': status});
      setState(() => availability = status);
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _shareLocation() async {
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      final pos = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      await context.read<AuthState>().api.request('/responders/me/location', method: 'PATCH', body: {
        'lat': pos.latitude,
        'lng': pos.longitude,
      });
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location shared')));
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _saveSkills() async {
    try {
      await context.read<AuthState>().api.request('/responders/me/skills', method: 'PATCH', body: {'skills': selectedSkills.toList()});
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Skills saved')));
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final pending = cases.where((c) => c['match_status'] == 'notified' || c['match_status'] == 'proposed').toList();
    final active = cases.where((c) => c['status'] == 'accepted' || c['status'] == 'in_progress').toList();
    final profile = context.watch<AuthState>().profile;

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (profile != null && profile['verification_status'] != 'verified')
            Card(color: const Color(0xFFFCEFD4), child: ListTile(title: Text('Account is ${profile['verification_status']}. A coordinator must verify you before matching.'))),
          Wrap(
            spacing: 8,
            children: ['available', 'busy', 'offline']
                .map((s) => ChoiceChip(
                      label: Text(s),
                      selected: availability == s,
                      selectedColor: teal.withValues(alpha: 0.3),
                      onSelected: (_) => _setLive(s),
                    ))
                .toList(),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: _shareLocation, icon: const Icon(Icons.my_location), label: const Text('Share location')),
          if (err != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(err!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 12),
          IncidentMap(emergencies: cases.cast<Map>().map((e) => Map<String, dynamic>.from(e)).toList()),
          const SizedBox(height: 16),
          const Text('Incoming', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          if (pending.isEmpty) const Text('No proposed cases right now.'),
          ...pending.map((c) => EmergencyTile(
                item: Map<String, dynamic>.from(c as Map),
                onOpen: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EmergencyDetailScreen(id: c['id'] as String))).then((_) => _load()),
                actions: [
                  IconButton(
                    icon: const Icon(Icons.check, color: teal),
                    onPressed: () async {
                      await context.read<AuthState>().api.request('/emergencies/${c['id']}/accept', method: 'POST');
                      _load();
                    },
                  ),
                ],
              )),
          const SizedBox(height: 8),
          const Text('Active', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          if (active.isEmpty) const Text('Nothing assigned to you.'),
          ...active.map((c) => EmergencyTile(
                item: Map<String, dynamic>.from(c as Map),
                onOpen: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EmergencyDetailScreen(id: c['id'] as String))).then((_) => _load()),
              )),
          const SizedBox(height: 16),
          const Text('Skills', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
          Wrap(
            spacing: 6,
            children: skills
                .map((s) => FilterChip(
                      label: Text(s.replaceAll('_', ' ')),
                      selected: selectedSkills.contains(s),
                      onSelected: (v) => setState(() => v ? selectedSkills.add(s) : selectedSkills.remove(s)),
                    ))
                .toList(),
          ),
          TextButton(onPressed: _saveSkills, child: const Text('Save skills')),
          const Text('Alerts', style: TextStyle(fontWeight: FontWeight.w800)),
          ...notes.take(8).map((n) => ListTile(dense: true, title: Text('${n['message']}'), subtitle: Text('${n['status']}'))),
        ],
      ),
    );
  }
}
