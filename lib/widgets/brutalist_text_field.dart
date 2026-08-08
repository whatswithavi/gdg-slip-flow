import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';

/// Ported from aavii_website's BrutalistTextField, but softened on arrival
/// per the vault-ui-soften skill — the source file was still in the old
/// hard-border/hard-shadow style (not yet converted in the source app),
/// so this version applies rule 1 (hairline border instead of a 4px hard
/// one) and rule 2 (real blurred shadow instead of a 0-blur offset) directly.
class BrutalistTextField extends StatefulWidget {
  final String label;
  final TextEditingController controller;
  final TextInputType keyboardType;
  final int maxLines;

  const BrutalistTextField({
    super.key,
    required this.label,
    required this.controller,
    this.keyboardType = TextInputType.text,
    this.maxLines = 1,
  });

  @override
  State<BrutalistTextField> createState() => _BrutalistTextFieldState();
}

class _BrutalistTextFieldState extends State<BrutalistTextField> {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label.toUpperCase(),
          style: AppTextStyles.sans(fontSize: 11, fontWeight: FontWeight.w800, color: context.inkMuted),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.ink.withValues(alpha: 0.12), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: AppColors.black.withValues(alpha: 0.08),
                offset: const Offset(0, 3),
                blurRadius: 8,
              ),
            ],
          ),
          child: TextField(
            controller: widget.controller,
            keyboardType: widget.keyboardType,
            maxLines: widget.maxLines,
            style: AppTextStyles.mono(fontSize: 14),
            decoration: InputDecoration(
              filled: true,
              fillColor: AppColors.white,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.all(16),
            ),
          ),
        ),
      ],
    );
  }
}
