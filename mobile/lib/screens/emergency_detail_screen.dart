import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../api.dart';
import '../auth_state.dart';
import '../constants.dart';
import '../theme.dart';
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
  WebSocketChannel? ws;
  Timer? pollTimer;
  Timer? locationTimer;
  final AudioPlayer _player = AudioPlayer();
  bool playingVoiceNote = false;

  @override
  void initState() {
    super.initState();
    _load();
    _connectWs();
    pollTimer = Timer.periodic(const Duration(seconds: 15), (_) => _load());
  }

  @override
  void dispose() {
    ws?.sink.close();
    pollTimer?.cancel();
    locationTimer?.cancel();
    _player.dispose();
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
    try {
      final d = await context.read<AuthState>().api.request('/emergencies/${widget.id}') as Map<String, dynamic>;
      if (mounted) {
        setState(() {
          data = d;
          err = null;
        });
        _maybeStartLocationSharing();
      }
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

  // While the assigned responder has this case open and it's active, share
  // location every 20s so the reporter's map/ETA stays live. Foreground-only
  // (no background service) — a deliberate, small-scope v1.
  void _maybeStartLocationSharing() {
    final e = data?['emergency'] as Map<String, dynamic>?;
    if (e == null) return;
    final auth = context.read<AuthState>();
    final isMyActiveCase = auth.role == 'responder' &&
        e['assigned_responder_id'] == auth.user?['id'] &&
        ['accepted', 'in_progress'].contains(e['status']);
    if (isMyActiveCase && locationTimer == null) {
      _shareLocationOnce();
      locationTimer = Timer.periodic(const Duration(seconds: 20), (_) => _shareLocationOnce());
    } else if (!isMyActiveCase && locationTimer != null) {
      locationTimer?.cancel();
      locationTimer = null;
    }
  }

  Future<void> _shareLocationOnce() async {
    final api = context.read<AuthState>().api;
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;
      final pos = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      await api.request('/responders/me/location', method: 'PATCH', body: {
        'lat': pos.latitude,
        'lng': pos.longitude,
      });
    } catch (_) {
      // Best-effort background refresh; surfaced errors would be noisy here.
    }
  }

  Future<void> _playVoiceNote() async {
    setState(() => playingVoiceNote = true);
    try {
      final res = await context.read<AuthState>().api.request('/emergencies/${widget.id}/voice-note') as Map<String, dynamic>;
      final bytes = base64Decode(res['audioBase64'] as String);
      final dir = await getTemporaryDirectory();
      final ext = (res['mimeType'] as String? ?? '').contains('webm') ? 'webm' : 'm4a';
      final file = File('${dir.path}/voice_note_${widget.id}.$ext');
      await file.writeAsBytes(bytes, flush: true);
      await _player.play(DeviceFileSource(file.path));
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => playingVoiceNote = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (err != null && data == null) return Scaffold(appBar: AppBar(), body: Center(child: Text(err!)));
    if (data == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final auth = context.watch<AuthState>();
    final e = data!['emergency'] as Map<String, dynamic>;
    final assignedResponder = data!['assignedResponder'] as Map<String, dynamic>?;
    final rating = data!['rating'] as Map<String, dynamic>?;
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
    final canRate = role == 'citizen' &&
        e['reporter_id'] == auth.user?['id'] &&
        ['resolved', 'closed'].contains(e['status']);

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
          if (assignedResponder?['distance_km'] != null) ...[
            const SizedBox(height: 10),
            Text(
              '🚑 ${assignedResponder!['name']} is ${assignedResponder['distance_km']} km away · ~${assignedResponder['eta_minutes']} min',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ],
          if (e['hasVoiceNote'] == true) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: playingVoiceNote ? null : _playVoiceNote,
              icon: const Icon(Icons.mic),
              label: Text(playingVoiceNote ? 'Loading…' : 'Play voice note'),
            ),
          ],
          const SizedBox(height: 12),
          IncidentMap(
            emergencies: [e],
            responders: assignedResponder?['current_lat'] != null ? [assignedResponder!] : const [],
            center: LatLng((e['lat'] as num).toDouble(), (e['lng'] as num).toDouble()),
          ),
          if (canRate) ...[
            const SizedBox(height: 16),
            _RatingCard(emergencyId: widget.id, existingRating: rating, onRated: _load),
          ],
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

class _RatingCard extends StatefulWidget {
  const _RatingCard({required this.emergencyId, required this.existingRating, required this.onRated});
  final String emergencyId;
  final Map<String, dynamic>? existingRating;
  final VoidCallback onRated;

  @override
  State<_RatingCard> createState() => _RatingCardState();
}

class _RatingCardState extends State<_RatingCard> {
  int stars = 0;
  final _comment = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (stars == 0) return;
    setState(() => busy = true);
    try {
      await context.read<AuthState>().api.request('/emergencies/${widget.emergencyId}/rating', method: 'POST', body: {
        'stars': stars,
        if (_comment.text.trim().isNotEmpty) 'comment': _comment.text.trim(),
      });
      widget.onRated();
    } on ApiException catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final existing = widget.existingRating;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: existing != null
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Your rating', style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text('★' * (existing['stars'] as int) + '☆' * (5 - existing['stars'] as int), style: const TextStyle(fontSize: 20, color: amber)),
                  if ((existing['comment'] as String?)?.isNotEmpty == true) ...[
                    const SizedBox(height: 4),
                    Text(existing['comment'] as String),
                  ],
                ],
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Rate the response', style: TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Row(
                    children: List.generate(5, (i) {
                      final n = i + 1;
                      return IconButton(
                        onPressed: () => setState(() => stars = n),
                        icon: Icon(n <= stars ? Icons.star : Icons.star_border, color: amber, size: 30),
                      );
                    }),
                  ),
                  TextField(
                    controller: _comment,
                    decoration: const InputDecoration(hintText: 'Comment (optional)'),
                  ),
                  const SizedBox(height: 10),
                  FilledButton(onPressed: busy ? null : _submit, child: const Text('Submit rating')),
                ],
              ),
      ),
    );
  }
}
