import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_state.dart';
import '../widgets/common.dart';
import 'emergency_detail_screen.dart';

class MyReportsScreen extends StatefulWidget {
  const MyReportsScreen({super.key});

  @override
  State<MyReportsScreen> createState() => _MyReportsScreenState();
}

class _MyReportsScreenState extends State<MyReportsScreen> {
  List rows = [];
  String? err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<AuthState>().api.request('/emergencies/reported');
      if (mounted) setState(() { rows = data as List; err = null; });
    } catch (e) {
      if (mounted) setState(() => err = '$e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (err != null) return Center(child: Text(err!));
    if (rows.isEmpty) return const Center(child: Text('No reports yet.'));
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: rows
            .map((item) => EmergencyTile(
                  item: Map<String, dynamic>.from(item as Map),
                  onOpen: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EmergencyDetailScreen(id: item['id'] as String))),
                ))
            .toList(),
      ),
    );
  }
}
