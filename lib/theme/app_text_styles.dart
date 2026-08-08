import 'package:flutter/material.dart';
import 'app_colors.dart';

/// Ported from aavii_website's AppTextStyles API (mono/serif/sans), but
/// without bundling its custom font assets — uses the platform default
/// font family to keep this new app's setup minimal.
class AppTextStyles {
  AppTextStyles._();

  static TextStyle mono({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.normal,
    Color color = AppColors.black,
  }) =>
      TextStyle(fontFamily: 'monospace', fontSize: fontSize, fontWeight: fontWeight, color: color);

  static TextStyle serif({
    double fontSize = 16,
    FontWeight fontWeight = FontWeight.normal,
    FontStyle fontStyle = FontStyle.normal,
    Color color = AppColors.black,
  }) =>
      TextStyle(fontSize: fontSize, fontWeight: fontWeight, fontStyle: fontStyle, color: color);

  static TextStyle sans({
    double fontSize = 16,
    FontWeight fontWeight = FontWeight.normal,
    Color color = AppColors.black,
  }) =>
      TextStyle(fontSize: fontSize, fontWeight: fontWeight, color: color);
}
