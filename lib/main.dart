import 'package:flutter/material.dart';
import 'theme/app_theme_controller.dart';
import 'theme/app_text_styles.dart';
import 'widgets/app_header.dart';
import 'widgets/nav_tab_bar.dart';
import 'widgets/brutalist_card.dart';

void main() {
  runApp(const SlipFlowApp());
}

class SlipFlowApp extends StatefulWidget {
  const SlipFlowApp({super.key});

  @override
  State<SlipFlowApp> createState() => _SlipFlowAppState();
}

class _SlipFlowAppState extends State<SlipFlowApp> {
  final _themeController = AppThemeController();

  @override
  void initState() {
    super.initState();
    _themeController.load();
  }

  @override
  Widget build(BuildContext context) {
    return AppThemeScope(
      controller: _themeController,
      child: MaterialApp(
        title: 'Slip Flow',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple)),
        home: const HomeShell(),
      ),
    );
  }
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  String _activeTab = 'upload';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.screenBg,
      appBar: const AppHeader(),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: _PlaceholderBody(tabId: _activeTab),
        ),
      ),
      bottomNavigationBar: NavTabBar(
        activeTabId: _activeTab,
        onTabSelected: (id) => setState(() => _activeTab = id),
      ),
    );
  }
}

class _PlaceholderBody extends StatelessWidget {
  final String tabId;
  const _PlaceholderBody({required this.tabId});

  @override
  Widget build(BuildContext context) {
    return BrutalistCard(
      backgroundColor: context.cardBg,
      child: Text(
        '$tabId screen coming next',
        style: AppTextStyles.sans(fontSize: 16, color: context.ink),
      ),
    );
  }
}
