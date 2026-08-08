import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';

/// Adapted from aavii_website's AppHeader for this app: dropped the
/// onboarding-tour hooks (TourTargets) and the animated logo (depended on
/// an asset this project doesn't have) since neither applies here — kept
/// the overall shape (bordered bottom, theme-aware background/text).
class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  const AppHeader({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.screenBg,
        border: Border(bottom: BorderSide(color: context.ink.withValues(alpha: 0.08), width: 1)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: SafeArea(
        bottom: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text('SLIP', style: AppTextStyles.sans(fontSize: 18, fontWeight: FontWeight.w900, color: context.ink)),
                Text('FLOW', style: AppTextStyles.sans(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.vaultPink)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
