import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

import '../api.dart';
import '../auth_state.dart';
import '../constants.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'emergency_detail_screen.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key, this.anonymous = false});
  final bool anonymous;

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  String category = 'medical';
  final description = TextEditingController();
  final address = TextEditingController();
  final phone = TextEditingController();
  Position? position;
  bool locating = false;
  bool busy = false;
  Map<String, dynamic>? result;

  @override
  void initState() {
    super.initState();
    _locate();
  }

  @override
  void dispose() {
    description.dispose();
    address.dispose();
    phone.dispose();
    super.dispose();
  }

  Future<void> _locate() async {
    setState(() => locating = true);
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high));
      if (mounted) setState(() => position = pos);
    } catch (_) {
      // landmark fallback
    } finally {
      if (mounted) setState(() => locating = false);
    }
  }

  Future<void> _queue(Map<String, dynamic> payload) async {
    final prefs = await SharedPreferences.getInstance();
    final list = jsonDecode(prefs.getString('offline_queue') ?? '[]') as List;
    list.add(payload);
    await prefs.setString('offline_queue', jsonEncode(list));
  }

  Future<void> _submit() async {
    final auth = context.read<AuthState>();
    final payload = {
      'category': category,
      'description': description.text,
      'lat': position?.latitude ?? kampalaLat,
      'lng': position?.longitude ?? kampalaLng,
      'addressText': address.text,
      'locationAccuracyM': position?.accuracy,
      'channel': 'app',
      if (widget.anonymous || !auth.signedIn) 'reporterPhone': phone.text.trim(),
    };
    if ((widget.anonymous || !auth.signedIn) && phone.text.trim().isEmpty) {
      showError(context, 'Enter a phone number so responders can reach you.');
      return;
    }
    setState(() => busy = true);
    try {
      final data = await auth.api.request('/emergencies', method: 'POST', body: payload) as Map<String, dynamic>;
      if (mounted) setState(() => result = data);
    } on ApiException catch (e) {
      await _queue(payload);
      if (mounted) {
        showError(context, '$e\nSaved on this device and will retry when you submit again online.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final locLabel = locating
        ? 'Finding you…'
        : position == null
            ? 'Use my location'
            : 'Location captured (±${position!.accuracy.round()} m)';
    final emergency = result?['emergency'] as Map<String, dynamic>?;
    final matching = result?['matching'] as Map<String, dynamic>?;
    final classification = result?['classification'] as Map<String, dynamic>?;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('If you can reach official services, call them as well. AfriResQ alerts nearby community responders.'),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: categories
              .map(
                (c) => ChoiceChip(
                  label: Text(c.$2),
                  selected: category == c.$1,
                  selectedColor: teal.withValues(alpha: 0.25),
                  onSelected: (_) => setState(() => category = c.$1),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 12),
        TextField(controller: description, maxLines: 3, decoration: const InputDecoration(labelText: 'What is happening? (optional)')),
        if (widget.anonymous || !context.watch<AuthState>().signedIn) ...[
          const SizedBox(height: 12),
          TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Your phone number')),
        ],
        const SizedBox(height: 12),
        TextField(controller: address, decoration: const InputDecoration(labelText: 'Landmark / address')),
        const SizedBox(height: 12),
        OutlinedButton.icon(onPressed: locating ? null : _locate, icon: const Icon(Icons.my_location), label: Text(locLabel)),
        const SizedBox(height: 12),
        IncidentMap(
          center: LatLng(position?.latitude ?? kampalaLat, position?.longitude ?? kampalaLng),
        ),
        const SizedBox(height: 16),
        FilledButton(onPressed: busy ? null : _submit, child: Text(busy ? 'Sending…' : 'Submit report')),
        if (result != null) ...[
          const SizedBox(height: 16),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [const Text('Report received', style: TextStyle(fontWeight: FontWeight.w800)), const SizedBox(width: 8), SeverityChip(classification?['severity'] as String?)]),
                  Text('Priority ${classification?['priorityScore']} / 100'),
                  const SizedBox(height: 8),
                  if ((matching?['candidates'] as List?)?.isNotEmpty == true)
                    Text('${(matching!['candidates'] as List).length} nearby responder(s) notified within ${matching['searchRadiusKm']} km.')
                  else
                    Text(matching?['warning'] as String? ?? 'No nearby responder was available.'),
                  if (emergency != null && context.read<AuthState>().signedIn)
                    TextButton(
                      onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EmergencyDetailScreen(id: emergency['id'] as String))),
                      child: const Text('Track this report'),
                    ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
