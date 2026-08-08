import 'package:flutter_test/flutter_test.dart';

import 'package:gdg_slip_flow/main.dart';

void main() {
  testWidgets('App shell renders the nav tabs', (WidgetTester tester) async {
    await tester.pumpWidget(const SlipFlowApp());
    await tester.pumpAndSettle();

    expect(find.text('UPLOAD'), findsOneWidget);
    expect(find.text('APPROVE'), findsOneWidget);
    expect(find.text('QUERY'), findsOneWidget);

    await tester.tap(find.text('APPROVE'));
    await tester.pumpAndSettle();

    expect(find.text('approve screen coming next'), findsOneWidget);
  });
}
