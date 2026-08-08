import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app_colors.dart';

/// Ported verbatim from aavii_website — dark mode toggle, persisted locally.
class AppThemeController extends ChangeNotifier {
  static const _darkModeKey = 'gdgslipflow-dark';

  bool _darkMode = false;

  bool get darkMode => _darkMode;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    _darkMode = prefs.getBool(_darkModeKey) ?? false;
    notifyListeners();
  }

  Future<void> setDarkMode(bool value) async {
    _darkMode = value;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_darkModeKey, value);
  }
}

class AppThemeScope extends InheritedNotifier<AppThemeController> {
  const AppThemeScope({super.key, required AppThemeController controller, required super.child})
      : super(notifier: controller);

  static AppThemeController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppThemeScope>();
    return scope?.notifier ?? AppThemeController();
  }
}

extension ThemeInk on BuildContext {
  bool get isDark => AppThemeScope.of(this).darkMode;
  Color get ink => isDark ? AppColors.white : AppColors.black;
  Color get inkMuted => isDark ? AppColors.white.withValues(alpha: 0.6) : AppColors.black.withValues(alpha: 0.6);
  Color get screenBg => isDark ? const Color(0xFF18181B) : AppColors.white;
  Color get cardBg => isDark ? const Color(0xFF27272A) : AppColors.white;
}
