import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'services/api_client.dart';
import 'theme/app_theme_controller.dart';
import 'theme/app_text_styles.dart';
import 'widgets/app_header.dart';
import 'widgets/nav_tab_bar.dart';
import 'screens/upload_screen.dart';
import 'screens/approval_screen.dart';
import 'screens/query_screen.dart';
import 'screens/insights_screen.dart';
import 'screens/face_attendance_screen.dart';

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
  List<Map<String, dynamic>>? _registerTypes;
  String? _loadError;

  static const _tabOrder = ['upload', 'approve', 'faces', 'query', 'insights'];

  @override
  void initState() {
    super.initState();
    _loadRegisterTypes();
  }

  Future<void> _loadRegisterTypes() async {
    try {
      final types = await ApiClient.fetchRegisterTypes();
      setState(() => _registerTypes = types);
    } catch (e) {
      setState(() => _loadError = 'Could not reach the backend: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.screenBg,
      appBar: const AppHeader(),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: _registerTypes == null
              ? Center(
                  child: _loadError != null
                      ? Text(_loadError!, style: AppTextStyles.sans(fontSize: 13, color: Colors.red), textAlign: TextAlign.center)
                      : const CircularProgressIndicator(),
                )
              : IndexedStack(
                  index: _tabOrder.indexOf(_activeTab),
                  children: [
                    UploadScreen(registerTypes: _registerTypes!),
                    ApprovalScreen(registerTypes: _registerTypes!),
                    const FaceAttendanceScreen(),
                    const QueryScreen(),
                    const InsightsScreen(),
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
