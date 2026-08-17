import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:afriresq/api.dart';
import 'package:afriresq/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('AfriResQ landing renders', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(AfriResQApp(api: AfriApi()));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.textContaining('AfriResQ'), findsWidgets);
  });
}

