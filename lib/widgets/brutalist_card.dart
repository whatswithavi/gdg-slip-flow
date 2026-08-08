import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// Ported verbatim from aavii_website — soft rounded card, blurred shadow.
class BrutalistCard extends StatelessWidget {
  final Widget child;
  final Color backgroundColor;
  final double borderWidth;
  final double shadowOffset;
  final EdgeInsetsGeometry padding;
  final double borderRadius;
  final Color borderColor;
  final Color shadowColor;

  const BrutalistCard({
    super.key,
    required this.child,
    this.backgroundColor = AppColors.white,
    this.borderWidth = 1.5,
    this.shadowOffset = 8,
    this.padding = const EdgeInsets.all(16),
    this.borderColor = AppColors.black,
    this.shadowColor = AppColors.black,
    this.borderRadius = 18,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(
          color: borderColor.withValues(alpha: 0.14),
          width: borderWidth,
        ),
        boxShadow: [
          BoxShadow(
            color: shadowColor.withValues(alpha: 0.12),
            offset: Offset(0, shadowOffset * 0.4),
            blurRadius: shadowOffset * 1.6,
            spreadRadius: 0,
          ),
        ],
      ),
      child: child,
    );
  }
}
