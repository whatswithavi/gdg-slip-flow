import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'theme/app_theme_controller.dart';
import 'widgets/app_header.dart';
import 'widgets/nav_tab_bar.dart';
import 'screens/upload_screen.dart';
import 'screens/approval_screen.dart';
import 'screens/query_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
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

  static const _tabOrder = ['upload', 'approve', 'query'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.screenBg,
      appBar: const AppHeader(),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: IndexedStack(
            index: _tabOrder.indexOf(_activeTab),
            children: const [
              UploadScreen(),
              ApprovalScreen(),
              QueryScreen(),
            ],
          ),
        ),
      ),
      bottomNavigationBar: NavTabBar(
        activeTabId: _activeTab,
        onTabSelected: (id) => setState(() => _activeTab = id),
      ),
    );
  }
}
