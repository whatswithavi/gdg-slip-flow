import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';

class NavTab {
  final String id;
  final IconData icon;
  final String label;

  const NavTab({required this.id, required this.icon, required this.label});
}

/// Adapted from aavii_website's NavTabBar for this app's screens (dropped
/// the onboarding-tour hooks — no tour system in this project).
const List<NavTab> kNavTabs = [
  NavTab(id: 'upload', icon: Icons.camera_alt_outlined, label: 'Upload'),
  NavTab(id: 'approve', icon: Icons.fact_check_outlined, label: 'Approve'),
  NavTab(id: 'query', icon: Icons.search, label: 'Query'),
  NavTab(id: 'insights', icon: Icons.insights_outlined, label: 'Insights'),
];

const Map<String, Color> _kTabAccents = {
  'upload': AppColors.vaultPink,
  'approve': Color(0xFF34D399),
  'query': AppColors.vaultPurple,
  'insights': AppColors.vaultYellowDeep,
};

class NavTabBar extends StatelessWidget {
  final String activeTabId;
  final ValueChanged<String> onTabSelected;

  const NavTabBar({super.key, required this.activeTabId, required this.onTabSelected});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: context.screenBg,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Row(
        children: [
          for (int i = 0; i < kNavTabs.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: GestureDetector(
                onTap: () => onTabSelected(kNavTabs[i].id),
                child: Builder(builder: (context) {
                  final active = activeTabId == kNavTabs[i].id;
                  final accent = _kTabAccents[kNavTabs[i].id] ?? AppColors.black;
                  // Yellow is too light for white text to read against —
                  // falls back to ink (near-black) for that one accent.
                  final fg = active && accent != AppColors.vaultYellowDeep ? AppColors.white : context.ink;
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: Curves.easeOutCubic,
                    decoration: BoxDecoration(
                      color: active ? accent : context.cardBg,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: active
                          ? [
                              BoxShadow(
                                color: accent.withValues(alpha: 0.35),
                                offset: const Offset(0, 3),
                                blurRadius: 10,
                              ),
                            ]
                          : [],
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(kNavTabs[i].icon, size: 18, color: fg),
                        const SizedBox(height: 4),
                        Text(
                          kNavTabs[i].label.toUpperCase(),
                          style: AppTextStyles.sans(fontSize: 9, fontWeight: FontWeight.w800, color: fg),
                        ),
                      ],
                    ),
                  );
                }),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
