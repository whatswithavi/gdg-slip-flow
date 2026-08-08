import 'package:flutter_test/flutter_test.dart';

import 'package:gdg_slip_flow/main.dart';

void main() {
  testWidgets('App shell renders the nav tabs and switches screens', (WidgetTester tester) async {
    await tester.pumpWidget(const SlipFlowApp());
    await tester.pump();

    expect(find.text('UPLOAD'), findsOneWidget);
    expect(find.text('APPROVE'), findsOneWidget);
    expect(find.text('QUERY'), findsOneWidget);

    // Upload screen is the default tab.
    expect(find.text('Upload a slip'), findsOneWidget);

    await tester.tap(find.text('APPROVE'));
    await tester.pump();

    // Heading renders immediately regardless of the pending-slips fetch
    // outcome (no backend running in this widget test).
    expect(find.text('Review pending slips'), findsOneWidget);
  });
}
