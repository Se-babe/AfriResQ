import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

const _maxSeconds = 60;

/// Records a short voice note and hands the parent a
/// {audioBase64, mimeType, durationSeconds} map (or null once cleared).
class VoiceNoteRecorder extends StatefulWidget {
  const VoiceNoteRecorder({super.key, required this.onChange});
  final ValueChanged<Map<String, dynamic>?> onChange;

  @override
  State<VoiceNoteRecorder> createState() => _VoiceNoteRecorderState();
}

class _VoiceNoteRecorderState extends State<VoiceNoteRecorder> {
  final _recorder = AudioRecorder();
  final _player = AudioPlayer();
  Timer? _timer;
  bool recording = false;
  bool hasClip = false;
  int seconds = 0;
  String? _path;
  String? err;

  @override
  void dispose() {
    _timer?.cancel();
    _recorder.dispose();
    _player.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    setState(() => err = null);
    try {
      if (!await _recorder.hasPermission()) {
        setState(() => err = 'Microphone permission was denied.');
        return;
      }
      final dir = await getTemporaryDirectory();
      final path = '${dir.path}/afriresq_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await _recorder.start(const RecordConfig(encoder: AudioEncoder.aacLc), path: path);
      setState(() {
        recording = true;
        hasClip = false;
        seconds = 0;
        _path = path;
      });
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() => seconds++);
        if (seconds >= _maxSeconds) _stop();
      });
    } catch (_) {
      setState(() => err = 'Could not start recording.');
    }
  }

  Future<void> _stop() async {
    _timer?.cancel();
    final path = await _recorder.stop();
    setState(() {
      recording = false;
      hasClip = path != null;
    });
    if (path != null) {
      final bytes = await File(path).readAsBytes();
      widget.onChange({
        'audioBase64': base64Encode(bytes),
        'mimeType': 'audio/m4a',
        'durationSeconds': seconds,
      });
    }
  }

  void _clear() {
    setState(() {
      hasClip = false;
      seconds = 0;
      _path = null;
    });
    widget.onChange(null);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!recording && !hasClip)
          OutlinedButton.icon(onPressed: _start, icon: const Icon(Icons.mic), label: const Text('Record a voice note')),
        if (recording)
          OutlinedButton.icon(
            onPressed: _stop,
            icon: const Icon(Icons.stop, color: Colors.red),
            label: Text('Stop recording (${seconds}s)'),
          ),
        if (hasClip && _path != null)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(icon: const Icon(Icons.play_arrow), onPressed: () => _player.play(DeviceFileSource(_path!))),
              Text('Voice note (${seconds}s)'),
              IconButton(icon: const Icon(Icons.close), onPressed: _clear),
            ],
          ),
        if (err != null) Text(err!, style: const TextStyle(color: Colors.red, fontSize: 12)),
      ],
    );
  }
}
