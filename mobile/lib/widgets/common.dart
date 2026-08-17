import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../constants.dart';
import '../theme.dart';

class SeverityChip extends StatelessWidget {
  const SeverityChip(this.severity, {super.key});
  final String? severity;

  @override
  Widget build(BuildContext context) {
    final label = (severity == null || severity == 'unclassified') ? 'unclassified' : severity!;
    return Chip(
      label: Text(label.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
      visualDensity: VisualDensity.compact,
      backgroundColor: severityColor(severity).withValues(alpha: 0.15),
      side: BorderSide(color: severityColor(severity).withValues(alpha: 0.4)),
    );
  }
}

class EmergencyTile extends StatelessWidget {
  const EmergencyTile({super.key, required this.item, this.onOpen, this.actions});
  final Map<String, dynamic> item;
  final VoidCallback? onOpen;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        onTap: onOpen,
        title: Text(categoryLabel(item['category'] as String?)),
        subtitle: Text(
          [
            if (item['description'] != null) item['description'],
            prettyStatus(item['status'] as String?),
            if (item['address_text'] != null) item['address_text'],
            if (item['distance_km'] != null) '${item['distance_km']} km',
          ].join(' · '),
          maxLines: 3,
        ),
        leading: SeverityChip(item['severity'] as String?),
        trailing: actions == null
            ? const Icon(Icons.chevron_right)
            : Wrap(spacing: 4, children: actions!),
      ),
    );
  }
}

class IncidentMap extends StatelessWidget {
  const IncidentMap({
    super.key,
    this.emergencies = const [],
    this.responders = const [],
    this.center,
    this.height = 240,
  });

  final List<Map<String, dynamic>> emergencies;
  final List<Map<String, dynamic>> responders;
  final LatLng? center;
  final double height;

  @override
  Widget build(BuildContext context) {
    final points = <LatLng>[
      ?center,
      ...emergencies
          .where((e) => e['lat'] != null && e['lng'] != null)
          .map((e) => LatLng((e['lat'] as num).toDouble(), (e['lng'] as num).toDouble())),
      ...responders
          .where((r) => r['current_lat'] != null && r['current_lng'] != null)
          .map((r) => LatLng((r['current_lat'] as num).toDouble(), (r['current_lng'] as num).toDouble())),
    ];
    final start = points.isEmpty ? const LatLng(kampalaLat, kampalaLng) : points.first;

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: height,
        child: FlutterMap(
          options: MapOptions(initialCenter: start, initialZoom: points.length > 1 ? 12 : 13),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'org.afriresq.afriresq',
            ),
            CircleLayer(
              circles: [
                if (center != null)
                  CircleMarker(point: center!, radius: 10, color: amber, borderStrokeWidth: 2, borderColor: ink),
                ...emergencies.where((e) => e['lat'] != null).map(
                      (e) => CircleMarker(
                        point: LatLng((e['lat'] as num).toDouble(), (e['lng'] as num).toDouble()),
                        radius: e['severity'] == 'critical' ? 12 : 9,
                        color: severityColor(e['severity'] as String?),
                      ),
                    ),
                ...responders.where((r) => r['current_lat'] != null).map(
                      (r) => CircleMarker(
                        point: LatLng((r['current_lat'] as num).toDouble(), (r['current_lng'] as num).toDouble()),
                        radius: 7,
                        color: teal,
                      ),
                    ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

Future<void> showError(BuildContext context, Object e) {
  return showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('AfriResQ'),
      content: Text('$e'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))],
    ),
  );
}
