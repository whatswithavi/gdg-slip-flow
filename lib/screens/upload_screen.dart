import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_client.dart';
import '../theme/app_colors.dart';
import '../theme/app_text_styles.dart';
import '../theme/app_theme_controller.dart';
import '../widgets/brutalist_card.dart';
import '../widgets/brutalist_button.dart';

class UploadScreen extends StatefulWidget {
  const UploadScreen({super.key});

  @override
  State<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends State<UploadScreen> {
  Uint8List? _imageBytes;
  String _mimeType = 'image/jpeg';
  bool _loading = false;
  String? _statusMessage;
  Map<String, dynamic>? _lastResult;
  bool _lastFailed = false;

  Future<void> _pickImage(ImageSource source) async {
    final picked = await ImagePicker().pickImage(source: source, imageQuality: 85);
    if (picked == null) return;

    final bytes = await picked.readAsBytes();
    setState(() {
      _imageBytes = bytes;
      _mimeType = picked.mimeType ?? 'image/jpeg';
      _lastResult = null;
      _lastFailed = false;
      _statusMessage = null;
    });
  }

  Future<void> _uploadAndExtract() async {
    if (_imageBytes == null) return;

    setState(() {
      _loading = true;
      _statusMessage = null;
      _lastResult = null;
      _lastFailed = false;
    });

    try {
      final result = await ApiClient.extractSlip(_imageBytes!, _mimeType);
      setState(() {
        _lastResult = result;
        _statusMessage = 'Extracted — review it in the Approve tab.';
      });
    } catch (e) {
      setState(() {
        _lastFailed = true;
        _statusMessage = 'Extraction failed: $e';
      });
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Upload a slip', style: AppTextStyles.sans(fontSize: 20, fontWeight: FontWeight.w900, color: context.ink)),
          const SizedBox(height: 4),
          Text(
            'Photograph or pick an image of a raw-material intake slip.',
            style: AppTextStyles.sans(fontSize: 13, color: context.inkMuted),
          ),
          const SizedBox(height: 16),
          if (_imageBytes != null)
            BrutalistCard(
              backgroundColor: context.cardBg,
              padding: const EdgeInsets.all(8),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.memory(_imageBytes!, height: 220, fit: BoxFit.cover, width: double.infinity),
              ),
            ),
          if (_imageBytes != null) const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: BrutalistButton(
                  label: 'Camera',
                  icon: Icons.camera_alt_outlined,
                  backgroundColor: AppColors.vaultPink,
                  textColor: AppColors.white,
                  onPressed: _loading ? null : () => _pickImage(ImageSource.camera),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: BrutalistButton(
                  label: 'Gallery',
                  icon: Icons.photo_library_outlined,
                  onPressed: _loading ? null : () => _pickImage(ImageSource.gallery),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          BrutalistButton(
            label: _loading ? 'Extracting...' : 'Upload & Extract',
            icon: Icons.auto_awesome,
            backgroundColor: AppColors.vaultGreen,
            onPressed: (_imageBytes == null || _loading) ? null : _uploadAndExtract,
          ),
          if (_statusMessage != null) ...[
            const SizedBox(height: 16),
            BrutalistCard(
              backgroundColor: context.cardBg,
              borderColor: _lastFailed ? Colors.red : AppColors.vaultGreen,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _statusMessage!,
                    style: AppTextStyles.sans(fontSize: 14, fontWeight: FontWeight.w700, color: context.ink),
                  ),
                  if (_lastResult != null) ...[
                    const SizedBox(height: 8),
                    Text('Item: ${_lastResult!['item'] ?? '—'}', style: AppTextStyles.mono(fontSize: 13, color: context.inkMuted)),
                    Text('Quantity: ${_lastResult!['quantity'] ?? '—'} ${_lastResult!['unit'] ?? ''}',
                        style: AppTextStyles.mono(fontSize: 13, color: context.inkMuted)),
                    Text('Confidence: ${((_lastResult!['confidence'] ?? 0) * 100).toStringAsFixed(0)}%',
                        style: AppTextStyles.mono(fontSize: 13, color: context.inkMuted)),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
