import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_state.dart';
import '../theme.dart';
import 'dashboard_screen.dart';
import 'my_reports_screen.dart';
import 'organizations_screen.dart';
import 'report_screen.dart';
import 'responder_screen.dart';
import 'responders_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final role = auth.role ?? 'citizen';
    final tabs = switch (role) {
      'responder' => [
          (Icons.medical_services, 'Cases', const ResponderScreen()),
        ],
      'coordinator' || 'admin' => [
          (Icons.dashboard, 'Live', const DashboardScreen()),
          (Icons.groups, 'Responders', const RespondersScreen()),
          (Icons.apartment, 'Orgs', const OrganizationsScreen()),
        ],
      _ => [
          (Icons.emergency, 'Report', const ReportScreen()),
          (Icons.history, 'My reports', const MyReportsScreen()),
        ],
    };

    return Scaffold(
      appBar: AppBar(
        title: const Text('AfriResQ Uganda'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Center(child: Text(auth.user?['name']?.toString().split(' ').first ?? '', style: const TextStyle(fontSize: 13))),
          ),
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => auth.logout(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: tabs[index].$3,
      bottomNavigationBar: tabs.length == 1
          ? null
          : NavigationBar(
              selectedIndex: index,
              indicatorColor: teal.withValues(alpha: 0.2),
              onDestinationSelected: (i) => setState(() => index = i),
              destinations: [
                for (final t in tabs) NavigationDestination(icon: Icon(t.$1), label: t.$2),
              ],
            ),
    );
  }
}
