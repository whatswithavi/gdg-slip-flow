import 'package:flutter_test/flutter_test.dart';

import 'package:gdg_slip_flow/main.dart';

/// Flutter's TestWidgetsFlutterBinding blocks all real HTTP (forces a 400
/// on every request — see the warning `flutter test` prints), and
/// HomeShell now gates its screen content on a successful
/// `fetchRegisterTypes()` call (added when register types became backend-
/// driven, see DECISIONS.md Part 11). So a widget test here can only
/// exercise the no-backend path, not the real screens — that's exactly why
/// the actual functional coverage lives in tests/api-flow.spec.ts and
/// tests/app-loads.spec.ts (Playwright, against the real running app and
/// backend) rather than here. This test just confirms the app boots and
/// fails gracefully — with a visible error, not a crash — when the
/// backend is unreachable.
void main() {
  testWidgets('App shell boots and shows a readable error when the backend is unreachable', (WidgetTester tester) async {
    await tester.pumpWidget(const SlipFlowApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('Could not reach the backend'), findsOneWidget);

    // The nav bar itself isn't gated on the backend call, so it should
    // still render underneath the error.
    expect(find.text('UPLOAD'), findsOneWidget);
    expect(find.text('APPROVE'), findsOneWidget);
    expect(find.text('CHECK-IN'), findsOneWidget);
    expect(find.text('QUERY'), findsOneWidget);
    expect(find.text('INSIGHTS'), findsOneWidget);
  });
}
