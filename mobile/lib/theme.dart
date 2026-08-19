import 'package:flutter/material.dart';

const ink = Color(0xFF0A1628);
const sand = Color(0xFFF4EEE4);
const paper = Color(0xFFFFFAF2);
const terracotta = Color(0xFFC1121F);
const teal = Color(0xFF1A7A6D);
const amber = Color(0xFFE0B400);

ThemeData afriTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: teal,
    brightness: Brightness.light,
    primary: teal,
    secondary: terracotta,
    surface: paper,
  );
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: sand,
    useMaterial3: true,
    appBarTheme: const AppBarTheme(
      backgroundColor: ink,
      foregroundColor: Colors.white,
      centerTitle: false,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: terracotta,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
}

Color severityColor(String? severity) {
  switch (severity) {
    case 'critical':
      return const Color(0xFFB42318);
    case 'high':
      return amber;
    case 'moderate':
      return const Color(0xFF2A6EBB);
    case 'low':
      return teal;
    default:
      return Colors.grey;
  }
}
